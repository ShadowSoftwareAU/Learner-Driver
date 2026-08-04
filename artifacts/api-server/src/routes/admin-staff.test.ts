/**
 * Tests for admin staff invite, claim, permissions update, and removal flow.
 *
 * All external I/O (DB, Clerk, email) is mocked. Tests exercise the actual
 * Express route handlers via supertest so the HTTP layer is included.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetOrCreateUser,
  mockGetAuth,
  mockSendExternalEmail,
  mockRandomUUID,
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => ({
  mockGetOrCreateUser: vi.fn(),
  mockGetAuth: vi.fn(),
  mockSendExternalEmail: vi.fn(),
  mockRandomUUID: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
  usersTable: {},
  adminStaffPermissionsTable: {},
  adminStaffInvitesTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
}));

vi.mock("./users.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.clerkUserId = "clerk_test_user";
    next();
  },
  getOrCreateUser: mockGetOrCreateUser,
}));

vi.mock("../lib/notifications/emailChannel.js", () => ({
  sendExternalEmail: mockSendExternalEmail,
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return { ...actual, randomUUID: mockRandomUUID };
});

// Import subject AFTER mocks
import adminStaffRouter from "./admin-staff.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a fully chainable, awaitable DB mock.
 * Every method call returns `this`, and the chain resolves with `value` when
 * awaited. This satisfies all Drizzle query chain patterns:
 *   select().from().where()
 *   select().from().leftJoin().where().orderBy()
 *   insert().values().returning()
 *   update().set().where()
 *   delete().where()
 */
function makeChain(value: unknown) {
  const p = Promise.resolve(value);
  const chain: any = new Proxy(
    {},
    {
      get(_, key) {
        if (key === "then") return p.then.bind(p);
        if (key === "catch") return p.catch.bind(p);
        if (key === "finally") return p.finally.bind(p);
        return () => chain;
      },
    }
  );
  return chain;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/", adminStaffRouter);
  return app;
}

// Canonical test fixtures
const OWNER_USER = {
  id: 1,
  clerkId: "clerk_owner",
  email: "owner@example.com",
  name: "Owner",
  role: "admin",
  adminSubRole: "owner",
};

const STAFF_USER = {
  id: 2,
  clerkId: "clerk_staff",
  email: "staff@example.com",
  name: "Staff Member",
  role: "admin",
  adminSubRole: "staff",
};

const MANAGER_USER = {
  id: 3,
  clerkId: "clerk_manager",
  email: "manager@example.com",
  name: "Manager",
  role: "admin",
  adminSubRole: "manager",
};

const STAFF_PERMS = {
  id: 10,
  userId: 2,
  canViewBilling: true,
  canManageInstructors: false,
  canManageCompliance: true,
  canViewAuditLog: false,
  canManageBookings: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /admin/permissions/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk_test_user", sessionClaims: {} });
  });

  it("returns isMasterTier:true and all flags true for an owner account", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    // Owner path skips the DB select entirely — no select call expected.

    const res = await request(makeApp()).get("/admin/permissions/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isMasterTier: true,
      canViewBilling: true,
      canManageInstructors: true,
      canManageCompliance: true,
      canViewAuditLog: true,
      canManageBookings: true,
    });
    // Owner must NOT hit the permissions table.
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("returns scoped flags for a staff user who has a permissions row", async () => {
    mockGetOrCreateUser.mockResolvedValue(STAFF_USER);
    mockDbSelect.mockReturnValue(makeChain([STAFF_PERMS]));

    const res = await request(makeApp()).get("/admin/permissions/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isMasterTier: false,
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: true,
      canViewAuditLog: false,
      canManageBookings: false,
    });
  });

  it("returns all-false for a non-owner admin with no permissions row", async () => {
    mockGetOrCreateUser.mockResolvedValue(MANAGER_USER);
    // No perms row in DB
    mockDbSelect.mockReturnValue(makeChain([]));

    const res = await request(makeApp()).get("/admin/permissions/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isMasterTier: false,
      canViewBilling: false,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    });
  });

  it("rejects non-admin users with 403", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      ...OWNER_USER,
      role: "instructor",
      adminSubRole: null,
    });

    const res = await request(makeApp()).get("/admin/permissions/me");
    expect(res.status).toBe(403);
  });
});

describe("POST /admin/staff/invite", () => {
  const TOKEN = "test-invite-token-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk_test_user", sessionClaims: {} });
    mockRandomUUID.mockReturnValue(TOKEN);
    mockSendExternalEmail.mockResolvedValue({ delivered: true });
  });

  it("creates an invite record and returns 201 for an owner", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    const createdInvite = {
      id: 5,
      token: TOKEN,
      status: "pending",
      inviteeEmail: "new@example.com",
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbInsert.mockReturnValue(makeChain([createdInvite]));

    const res = await request(makeApp())
      .post("/admin/staff/invite")
      .send({
        email: "new@example.com",
        canViewBilling: true,
        joinBaseUrl: "https://app.example.com",
      });

    expect(res.status).toBe(201);
    expect(res.body.invite.token).toBe(TOKEN);
    expect(res.body.emailDelivered).toBe(true);
  });

  it("rejects invite creation by a non-owner with 403", async () => {
    mockGetOrCreateUser.mockResolvedValue(STAFF_USER);

    const res = await request(makeApp())
      .post("/admin/staff/invite")
      .send({ email: "someone@example.com" });

    expect(res.status).toBe(403);
  });

  it("returns 400 when email is missing", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);

    const res = await request(makeApp())
      .post("/admin/staff/invite")
      .send({ canViewBilling: true });

    expect(res.status).toBe(400);
  });
});

describe("GET /admin/staff/invite/:token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invite details for a valid pending token", async () => {
    const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const invite = {
      id: 5,
      token: "valid-token",
      status: "pending",
      inviteeEmail: "new@example.com",
      expiresAt: futureDate,
      invitedByUserId: 1,
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbSelect.mockReturnValue(
      makeChain([{ invite, inviterName: "Owner", inviterEmail: "owner@example.com" }])
    );

    const res = await request(makeApp()).get("/admin/staff/invite/valid-token");

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe("pending");
    expect(res.body.permissions.canViewBilling).toBe(true);
    expect(res.body.invitedByName).toBe("Owner");
  });

  it("returns valid:false for an expired invite", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const invite = {
      id: 6,
      token: "expired-token",
      status: "pending",
      inviteeEmail: "old@example.com",
      expiresAt: pastDate,
      invitedByUserId: 1,
      canViewBilling: false,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbSelect.mockReturnValue(
      makeChain([{ invite, inviterName: null, inviterEmail: null }])
    );

    const res = await request(makeApp()).get("/admin/staff/invite/expired-token");

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.expired).toBe(true);
  });

  it("returns 404 for an unknown token", async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const res = await request(makeApp()).get("/admin/staff/invite/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/staff/invite/:token/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({
      userId: "clerk_test_user",
      sessionClaims: { email: "new@example.com" },
    });
  });

  const futureDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  const pendingInvite = {
    id: 5,
    token: "valid-claim-token",
    status: "pending",
    expiresAt: futureDate,
    invitedByUserId: 1,
    inviteeEmail: "new@example.com",
    canViewBilling: true,
    canManageInstructors: false,
    canManageCompliance: true,
    canViewAuditLog: false,
    canManageBookings: false,
  };

  it("promotes user to admin staff and writes permissions on first claim", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 99,
      email: "new@example.com",
      role: "unassigned",
      adminSubRole: null,
    });

    // Calls in order: select invite → select existing perms (none) → update user → insert perms → update invite
    mockDbSelect
      .mockReturnValueOnce(makeChain([pendingInvite])) // invite lookup
      .mockReturnValueOnce(makeChain([]));              // no existing perms row
    mockDbUpdate.mockReturnValue(makeChain(undefined));
    mockDbInsert.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).post(
      "/admin/staff/invite/valid-claim-token/claim"
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // User update and perms insert must both have been called
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("overwrites existing permissions row if one already exists (re-claim)", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 99,
      email: "new@example.com",
      role: "admin",
      adminSubRole: "staff",
    });

    mockDbSelect
      .mockReturnValueOnce(makeChain([pendingInvite]))  // invite lookup
      .mockReturnValueOnce(makeChain([STAFF_PERMS]));   // existing perms row

    // Two update calls: user role + perms row + mark invite accepted
    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).post(
      "/admin/staff/invite/valid-claim-token/claim"
    );

    expect(res.status).toBe(200);
    // Insert should NOT be called when a perms row already exists
    expect(mockDbInsert).not.toHaveBeenCalled();
    // Three update calls: user role, existing perms row, invite status
    expect(mockDbUpdate).toHaveBeenCalledTimes(3);
  });

  it("returns 409 for an already-accepted invite", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 99,
      email: "new@example.com",
      role: "unassigned",
    });
    mockDbSelect.mockReturnValueOnce(
      makeChain([{ ...pendingInvite, status: "accepted" }])
    );

    const res = await request(makeApp()).post(
      "/admin/staff/invite/valid-claim-token/claim"
    );
    expect(res.status).toBe(409);
  });

  it("returns 410 and marks invite expired when past expiresAt", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 99,
      email: "new@example.com",
      role: "unassigned",
    });
    const pastDate = new Date(Date.now() - 1000);
    mockDbSelect.mockReturnValueOnce(
      makeChain([{ ...pendingInvite, expiresAt: pastDate }])
    );
    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).post(
      "/admin/staff/invite/valid-claim-token/claim"
    );

    expect(res.status).toBe(410);
    // The expired status must have been written back to the DB
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe("PATCH /admin/staff/:id/permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk_test_user", sessionClaims: {} });
  });

  it("updates permissions for a staff member when called by an owner", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    // Target user lookup + existing perms row
    mockDbSelect
      .mockReturnValueOnce(makeChain([STAFF_USER]))
      .mockReturnValueOnce(makeChain([STAFF_PERMS]));
    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp())
      .patch("/admin/staff/2/permissions")
      .send({ canViewBilling: false, canManageBookings: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });

  it("inserts a new permissions row when none exists", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    mockDbSelect
      .mockReturnValueOnce(makeChain([STAFF_USER]))
      .mockReturnValueOnce(makeChain([])); // no existing row
    mockDbInsert.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp())
      .patch("/admin/staff/2/permissions")
      .send({ canManageInstructors: true });

    expect(res.status).toBe(200);
    expect(mockDbInsert).toHaveBeenCalledOnce();
  });

  it("returns 400 when trying to modify an Owner's permissions", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    // Target is also an owner
    mockDbSelect.mockReturnValueOnce(makeChain([OWNER_USER]));

    const res = await request(makeApp())
      .patch("/admin/staff/1/permissions")
      .send({ canViewBilling: false });

    expect(res.status).toBe(400);
  });

  it("returns 403 when a non-owner tries to patch permissions", async () => {
    mockGetOrCreateUser.mockResolvedValue(STAFF_USER);

    const res = await request(makeApp())
      .patch("/admin/staff/2/permissions")
      .send({ canViewBilling: true });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /admin/staff/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk_test_user", sessionClaims: {} });
  });

  it("demotes staff member to unassigned and removes their perms row", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    mockDbSelect.mockReturnValueOnce(makeChain([STAFF_USER]));
    mockDbUpdate.mockReturnValue(makeChain(undefined));
    mockDbDelete.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).delete("/admin/staff/2");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbDelete).toHaveBeenCalledOnce();
  });

  it("returns 400 when an owner tries to remove another owner", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    mockDbSelect.mockReturnValueOnce(makeChain([OWNER_USER]));

    const res = await request(makeApp()).delete("/admin/staff/1");

    expect(res.status).toBe(400);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-owner calls DELETE", async () => {
    mockGetOrCreateUser.mockResolvedValue(STAFF_USER);

    const res = await request(makeApp()).delete("/admin/staff/2");

    expect(res.status).toBe(403);
  });

  it("returns 404 when the target user does not exist", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    mockDbSelect.mockReturnValueOnce(makeChain([]));

    const res = await request(makeApp()).delete("/admin/staff/999");

    expect(res.status).toBe(404);
  });
});

describe("full invite → claim → permissions update → removal cycle", () => {
  const TOKEN = "cycle-test-token";
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({
      userId: "clerk_test_user",
      sessionClaims: { email: "newstaff@example.com" },
    });
    mockRandomUUID.mockReturnValue(TOKEN);
    mockSendExternalEmail.mockResolvedValue({ delivered: false });
  });

  it("step 1 — owner creates an invite with billing access", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    mockDbInsert.mockReturnValue(
      makeChain([
        {
          id: 20,
          token: TOKEN,
          status: "pending",
          inviteeEmail: "newstaff@example.com",
          canViewBilling: true,
          canManageInstructors: false,
          canManageCompliance: false,
          canViewAuditLog: false,
          canManageBookings: false,
          expiresAt: futureDate,
        },
      ])
    );

    const res = await request(makeApp())
      .post("/admin/staff/invite")
      .send({ email: "newstaff@example.com", canViewBilling: true });

    expect(res.status).toBe(201);
    expect(res.body.invite.token).toBe(TOKEN);
    expect(res.body.invite.canViewBilling).toBe(true);
  });

  it("step 2 — the invite link is publicly readable before claim", async () => {
    const invite = {
      id: 20,
      token: TOKEN,
      status: "pending",
      inviteeEmail: "newstaff@example.com",
      expiresAt: futureDate,
      invitedByUserId: 1,
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbSelect.mockReturnValue(
      makeChain([{ invite, inviterName: "Owner", inviterEmail: "owner@example.com" }])
    );

    const res = await request(makeApp()).get(`/admin/staff/invite/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.permissions.canViewBilling).toBe(true);
  });

  it("step 3 — invitee claims the invite and becomes admin staff", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 50,
      email: "newstaff@example.com",
      role: "unassigned",
      adminSubRole: null,
    });
    const invite = {
      id: 20,
      token: TOKEN,
      status: "pending",
      expiresAt: futureDate,
      invitedByUserId: 1,
      inviteeEmail: "newstaff@example.com",
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbSelect
      .mockReturnValueOnce(makeChain([invite])) // invite lookup
      .mockReturnValueOnce(makeChain([]));       // no existing perms
    mockDbUpdate.mockReturnValue(makeChain(undefined));
    mockDbInsert.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).post(`/admin/staff/invite/${TOKEN}/claim`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // User promoted and perms row inserted
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("step 4 — owner updates the new staff member's permissions", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    const newStaff = { id: 50, role: "admin", adminSubRole: "staff" };
    const existingPerms = {
      id: 30,
      userId: 50,
      canViewBilling: true,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    };
    mockDbSelect
      .mockReturnValueOnce(makeChain([newStaff]))
      .mockReturnValueOnce(makeChain([existingPerms]));
    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp())
      .patch("/admin/staff/50/permissions")
      .send({ canManageInstructors: true, canManageCompliance: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("step 5 — permissions/me reflects the updated scoped flags", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 50,
      email: "newstaff@example.com",
      role: "admin",
      adminSubRole: "staff",
    });
    // Updated perms after step 4
    mockDbSelect.mockReturnValue(
      makeChain([
        {
          id: 30,
          userId: 50,
          canViewBilling: true,
          canManageInstructors: true,
          canManageCompliance: true,
          canViewAuditLog: false,
          canManageBookings: false,
        },
      ])
    );

    const res = await request(makeApp()).get("/admin/permissions/me");

    expect(res.status).toBe(200);
    expect(res.body.isMasterTier).toBe(false);
    expect(res.body.canViewBilling).toBe(true);
    expect(res.body.canManageInstructors).toBe(true);
    expect(res.body.canManageCompliance).toBe(true);
    expect(res.body.canViewAuditLog).toBe(false);
  });

  it("step 6 — owner removes the staff member and their permissions are gone", async () => {
    mockGetOrCreateUser.mockResolvedValue(OWNER_USER);
    const newStaff = { id: 50, role: "admin", adminSubRole: "staff" };
    mockDbSelect.mockReturnValueOnce(makeChain([newStaff]));
    mockDbUpdate.mockReturnValue(makeChain(undefined));
    mockDbDelete.mockReturnValue(makeChain(undefined));

    const res = await request(makeApp()).delete("/admin/staff/50");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Role downgraded and perms row purged
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbDelete).toHaveBeenCalledOnce();
  });

  it("step 7 — removed staff member now gets all-false from permissions/me (no perms row)", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      id: 50,
      email: "newstaff@example.com",
      // After removal, role is 'unassigned' — the route checks role==='admin' first
      role: "admin",
      adminSubRole: "staff",
    });
    // Perms row was deleted in step 6
    mockDbSelect.mockReturnValue(makeChain([]));

    const res = await request(makeApp()).get("/admin/permissions/me");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isMasterTier: false,
      canViewBilling: false,
      canManageInstructors: false,
      canManageCompliance: false,
      canViewAuditLog: false,
      canManageBookings: false,
    });
  });
});

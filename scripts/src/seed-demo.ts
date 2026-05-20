/**
 * seed-demo.ts — Populates the database with realistic demo data for the
 * DriveTrack May 22 presentation. Safe to run multiple times (idempotent).
 *
 * Run: pnpm --filter @workspace/scripts run seed-demo
 */

import { db, pool } from "@workspace/db";
import {
  usersTable, instructorsTable, studentsTable, maneuversTable,
  assessmentsTable, maneuverResultsTable, bookingsTable,
  handoverNotesTable, instructorVerificationsTable,
  termsAcceptancesTable, instructorAvailabilityTable, instructorZonesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function upsertUser(clerkId: string, email: string, name: string, role: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;
  const [u] = await db.insert(usersTable).values({ clerkId, email, name, role }).returning();
  return u;
}

const LEVELS = ["not_attempted", "attempted", "practiced", "mastered"] as const;
type Level = typeof LEVELS[number];

function levelForProgress(maneuverIndex: number, totalManeuvers: number, progressFraction: number): Level {
  const threshold = maneuverIndex / totalManeuvers;
  if (progressFraction > threshold + 0.4) return "mastered";
  if (progressFraction > threshold + 0.2) return "practiced";
  if (progressFraction > threshold) return "attempted";
  return "not_attempted";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding demo data...\n");

  // ── Instructors ───────────────────────────────────────────────────────────

  const inst1User = await upsertUser("demo_inst_sarah_mitchell", "sarah.mitchell@drivetrack.demo", "Sarah Mitchell", "instructor");
  const inst2User = await upsertUser("demo_inst_james_nguyen", "james.nguyen@drivetrack.demo", "James Nguyen", "instructor");

  let [inst1] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, inst1User.id));
  if (!inst1) {
    [inst1] = await db.insert(instructorsTable).values({
      userId: inst1User.id, fullName: "Sarah Mitchell", email: "sarah.mitchell@drivetrack.demo",
      phone: "0412 345 678", licenseNumber: "QDI-10042",
      vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleYear: 2022,
      qualifications: "ADI Certificate, Q-SAFE Certified, 8 years experience",
    }).returning();
  }

  let [inst2] = await db.select().from(instructorsTable).where(eq(instructorsTable.userId, inst2User.id));
  if (!inst2) {
    [inst2] = await db.insert(instructorsTable).values({
      userId: inst2User.id, fullName: "James Nguyen", email: "james.nguyen@drivetrack.demo",
      phone: "0423 567 890", licenseNumber: "QDI-10087",
      vehicleMake: "Mazda", vehicleModel: "3", vehicleYear: 2023,
      qualifications: "ADI Certificate, Q-SAFE Certified, 5 years experience, Manual specialist",
    }).returning();
  }

  console.log(`✅ Instructors: ${inst1.fullName}, ${inst2.fullName}`);

  // ── Instructor availability ───────────────────────────────────────────────

  const existAvail = await db.select().from(instructorAvailabilityTable)
    .where(eq(instructorAvailabilityTable.instructorId, inst1.id));
  if (existAvail.length === 0) {
    await db.insert(instructorAvailabilityTable).values([
      { instructorId: inst1.id, dayOfWeek: 1, startTime: "08:00", endTime: "17:00", transmissionTypes: "automatic,manual", isActive: true },
      { instructorId: inst1.id, dayOfWeek: 2, startTime: "08:00", endTime: "17:00", transmissionTypes: "automatic,manual", isActive: true },
      { instructorId: inst1.id, dayOfWeek: 3, startTime: "09:00", endTime: "16:00", transmissionTypes: "automatic", isActive: true },
      { instructorId: inst1.id, dayOfWeek: 5, startTime: "08:00", endTime: "14:00", transmissionTypes: "automatic,manual", isActive: true },
      { instructorId: inst2.id, dayOfWeek: 2, startTime: "07:00", endTime: "15:00", transmissionTypes: "automatic,manual", isActive: true },
      { instructorId: inst2.id, dayOfWeek: 4, startTime: "10:00", endTime: "18:00", transmissionTypes: "manual", isActive: true },
      { instructorId: inst2.id, dayOfWeek: 6, startTime: "08:00", endTime: "13:00", transmissionTypes: "automatic,manual", isActive: true },
    ]);
  }

  const existZones = await db.select().from(instructorZonesTable)
    .where(eq(instructorZonesTable.instructorId, inst1.id));
  if (existZones.length === 0) {
    await db.insert(instructorZonesTable).values([
      { instructorId: inst1.id, suburb: "Chermside", postcode: "4032", state: "QLD", isActive: true },
      { instructorId: inst1.id, suburb: "Aspley", postcode: "4034", state: "QLD", isActive: true },
      { instructorId: inst1.id, suburb: "Bracken Ridge", postcode: "4017", state: "QLD", isActive: true },
      { instructorId: inst2.id, suburb: "Sunnybank", postcode: "4109", state: "QLD", isActive: true },
      { instructorId: inst2.id, suburb: "Eight Mile Plains", postcode: "4113", state: "QLD", isActive: true },
      { instructorId: inst2.id, suburb: "Carindale", postcode: "4152", state: "QLD", isActive: true },
    ]);
  }

  // ── Verifications ─────────────────────────────────────────────────────────

  const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));

  for (const inst of [inst1, inst2]) {
    const [existVerif] = await db.select().from(instructorVerificationsTable)
      .where(eq(instructorVerificationsTable.instructorId, inst.id));
    if (!existVerif) {
      await db.insert(instructorVerificationsTable).values({
        instructorId: inst.id,
        status: "approved",
        submittedAt: new Date(Date.now() - 30 * 86400000),
        reviewedAt: new Date(Date.now() - 25 * 86400000),
        reviewerId: adminUser?.id ?? null,
        reviewerNotes: "All documents verified. Approved to take bookings.",
      });
    }
  }

  // ── Terms acceptances ─────────────────────────────────────────────────────

  for (const u of [inst1User, inst2User]) {
    const [existing] = await db.select().from(termsAcceptancesTable).where(eq(termsAcceptancesTable.userId, u.id));
    if (!existing) {
      await db.insert(termsAcceptancesTable).values({ userId: u.id, version: "1.0" });
    }
  }

  // ── Students ──────────────────────────────────────────────────────────────

  type StudentSpec = {
    clerkId: string; email: string; name: string;
    phone: string; dob: string; licenseNumber: string;
    totalHours: number; progressFraction: number;
    instructor: typeof inst1;
    guardianName?: string; guardianPhone?: string;
  };

  const studentSpecs: StudentSpec[] = [
    {
      clerkId: "demo_stud_liam_patel", email: "liam.patel@email.demo", name: "Liam Patel",
      phone: "0431 111 222", dob: "2006-03-15", licenseNumber: "L-QLD-2024-001",
      totalHours: 12, progressFraction: 0.25, instructor: inst1,
      guardianName: "Raj Patel", guardianPhone: "0412 888 111",
    },
    {
      clerkId: "demo_stud_chloe_thompson", email: "chloe.thompson@email.demo", name: "Chloe Thompson",
      phone: "0432 222 333", dob: "2005-07-22", licenseNumber: "L-QLD-2024-002",
      totalHours: 28, progressFraction: 0.55, instructor: inst1,
    },
    {
      clerkId: "demo_stud_mason_chen", email: "mason.chen@email.demo", name: "Mason Chen",
      phone: "0433 333 444", dob: "2006-11-08", licenseNumber: "L-QLD-2025-003",
      totalHours: 5, progressFraction: 0.1, instructor: inst1,
      guardianName: "Wei Chen", guardianPhone: "0411 777 999",
    },
    {
      clerkId: "demo_stud_ava_williams", email: "ava.williams@email.demo", name: "Ava Williams",
      phone: "0434 444 555", dob: "2005-01-30", licenseNumber: "L-QLD-2024-004",
      totalHours: 47, progressFraction: 0.88, instructor: inst1,
    },
    {
      clerkId: "demo_stud_noah_johnson", email: "noah.johnson@email.demo", name: "Noah Johnson",
      phone: "0435 555 666", dob: "2006-05-14", licenseNumber: "L-QLD-2024-005",
      totalHours: 18, progressFraction: 0.38, instructor: inst2,
    },
  ];

  const studentRecords: Array<{ user: typeof inst1User; student: any; spec: StudentSpec }> = [];

  for (const spec of studentSpecs) {
    const u = await upsertUser(spec.clerkId, spec.email, spec.name, "student");
    let [s] = await db.select().from(studentsTable).where(eq(studentsTable.userId, u.id));
    if (!s) {
      [s] = await db.insert(studentsTable).values({
        userId: u.id, fullName: spec.name, email: spec.email, phone: spec.phone,
        dateOfBirth: spec.dob, licenseNumber: spec.licenseNumber,
        totalHours: spec.totalHours,
        guardianName: spec.guardianName ?? null,
        guardianPhone: spec.guardianPhone ?? null,
      }).returning();
    }

    const [existTerms] = await db.select().from(termsAcceptancesTable).where(eq(termsAcceptancesTable.userId, u.id));
    if (!existTerms) {
      await db.insert(termsAcceptancesTable).values({ userId: u.id, version: "1.0" });
    }

    studentRecords.push({ user: u, student: s, spec });
  }

  console.log(`✅ Students: ${studentSpecs.map(s => s.name).join(", ")}`);

  // ── Maneuvers ─────────────────────────────────────────────────────────────

  const allManeuvers = await db.select().from(maneuversTable).orderBy(maneuversTable.sortOrder);
  if (allManeuvers.length === 0) {
    console.error("❌ No maneuvers found — run the maneuver seed first.");
    process.exit(1);
  }

  // ── Assessments + Maneuver Results ────────────────────────────────────────

  const confidenceNotes = [
    "Great improvement today — roundabouts and right-of-way much more confident. Highway merging still needs work.",
    "Solid session. Reverse parallel parking coming along well. Still hesitant at busy intersections.",
    "Very focused and attentive. Hazard perception improving rapidly. Smooth progress.",
    "Good awareness of speed limits and road signs. More highway driving needed before test.",
    "Confidence building nicely. Three-point turns now consistent. Work on smoother gear transitions.",
    "Excellent session — student is close to test-ready. Minor polish on emergency stops.",
    "First lesson went well. Basic vehicle control good. Steering smoothness to develop.",
    "Great attitude. U-turns in quiet streets mastered. Next: busy suburban environments.",
  ];

  const focusAreas = [
    "Highway merging, overtaking procedures",
    "Roundabout priority, lane discipline",
    "Emergency stops, following distance",
    "Three-point turns, reverse parallel parking",
    "Hazard perception, scanning technique",
    "Speed management in school zones",
    "Freeway entry and exit, lane changes",
    "Night driving awareness and headlight use",
  ];

  for (const { student, spec } of studentRecords) {
    const numAssessments = Math.max(1, Math.floor(spec.totalHours / 2));
    const instrId = spec.instructor.id;

    const existAssessments = await db.select({ id: assessmentsTable.id })
      .from(assessmentsTable)
      .where(and(eq(assessmentsTable.studentId, student.id), eq(assessmentsTable.instructorId, instrId)));

    if (existAssessments.length > 0) continue;

    for (let i = 0; i < numAssessments; i++) {
      const daysBack = (numAssessments - i) * 7 + Math.floor(Math.random() * 3);
      const lessonDate = daysAgo(daysBack);
      const duration = [60, 90, 90, 120][i % 4];

      const [assessment] = await db.insert(assessmentsTable).values({
        studentId: student.id,
        instructorId: instrId,
        lessonDate,
        durationMinutes: duration,
        status: "completed",
        confidenceNote: confidenceNotes[(i + student.id) % confidenceNotes.length],
        focusAreasNext: focusAreas[(i + student.id + 1) % focusAreas.length],
      }).returning();

      const sessionProgress = spec.progressFraction * ((i + 1) / numAssessments);
      const maneuvCount = Math.floor(allManeuvers.length * (0.2 + 0.3 * sessionProgress));
      const selectedManeuvers = allManeuvers.slice(0, maneuvCount);

      const resultValues = selectedManeuvers.map((m, idx) => ({
        assessmentId: assessment.id,
        maneuverId: m.id,
        competencyLevel: levelForProgress(idx, allManeuvers.length, sessionProgress),
      }));

      if (resultValues.length > 0) {
        await db.insert(maneuverResultsTable).values(resultValues);
      }
    }
  }

  console.log("✅ Assessments and maneuver results seeded");

  // ── Handover notes ────────────────────────────────────────────────────────

  const ava = studentRecords.find(r => r.spec.name === "Ava Williams")!;
  const existHandover = await db.select().from(handoverNotesTable)
    .where(and(eq(handoverNotesTable.studentId, ava.student.id), eq(handoverNotesTable.instructorId, inst2.id)));

  if (existHandover.length === 0) {
    // Give inst2 an assessment with Ava first so the relationship exists
    const [existAvaInst2] = await db.select({ id: assessmentsTable.id })
      .from(assessmentsTable)
      .where(and(eq(assessmentsTable.studentId, ava.student.id), eq(assessmentsTable.instructorId, inst2.id)));

    if (!existAvaInst2) {
      await db.insert(assessmentsTable).values({
        studentId: ava.student.id,
        instructorId: inst2.id,
        lessonDate: daysAgo(60),
        durationMinutes: 90,
        status: "completed",
        confidenceNote: "Excellent student — already showing advanced skills for a learner.",
        focusAreasNext: "Highway driving, freeway entry",
      });
    }

    await db.insert(handoverNotesTable).values([
      {
        studentId: ava.student.id,
        instructorId: inst2.id,
        note: "Ava is an exceptional student. She has completed all QSAFE basic and intermediate maneuvers. Focus remaining lessons on freeway driving and night conditions. She is on track to test within 3–4 more lessons.",
        focusAreas: "Freeway driving, night awareness, emergency stops at higher speeds",
      },
      {
        studentId: ava.student.id,
        instructorId: inst1.id,
        note: "Picking up from James — Ava is nearly test-ready. Confirmed she has completed the required theory test. Will run two highway sessions and one night lesson before signing off.",
        focusAreas: "Highway confidence, test route familiarisation",
      },
    ]);
  }

  console.log("✅ Handover notes seeded");

  // ── Bookings ──────────────────────────────────────────────────────────────

  const liam = studentRecords.find(r => r.spec.name === "Liam Patel")!;
  const chloe = studentRecords.find(r => r.spec.name === "Chloe Thompson")!;
  const noah = studentRecords.find(r => r.spec.name === "Noah Johnson")!;

  const existBookings = await db.select({ id: bookingsTable.id })
    .from(bookingsTable).where(eq(bookingsTable.studentId, liam.student.id));

  if (existBookings.length === 0) {
    await db.insert(bookingsTable).values([
      {
        studentId: liam.student.id,
        instructorId: inst1.id,
        requestedDate: daysAgo(-7),
        requestedTime: "09:00",
        durationMinutes: 90,
        transmissionType: "automatic",
        suburb: "Chermside",
        postcode: "4032",
        status: "confirmed",
        studentNotes: "Keen to practise roundabouts and the school zone near Chermside library.",
        instructorNotes: "Will run through the Chermside Drive/Gympie Rd roundabout complex.",
        broadcastCount: 1,
        claimedAt: new Date(Date.now() - 5 * 86400000),
        confirmedAt: new Date(Date.now() - 4 * 86400000),
      },
      {
        studentId: chloe.student.id,
        instructorId: inst1.id,
        requestedDate: daysAgo(14),
        requestedTime: "14:00",
        durationMinutes: 120,
        transmissionType: "automatic",
        suburb: "Aspley",
        postcode: "4034",
        status: "completed",
        studentNotes: "Want to do highway practice on Gateway Motorway.",
        instructorNotes: "Excellent session — covered Gateway Motorway entry, cruise control awareness.",
        broadcastCount: 1,
        claimedAt: new Date(Date.now() - 20 * 86400000),
        confirmedAt: new Date(Date.now() - 19 * 86400000),
      },
      {
        studentId: noah.student.id,
        instructorId: inst2.id,
        requestedDate: daysAgo(-10),
        requestedTime: "10:00",
        durationMinutes: 90,
        transmissionType: "manual",
        suburb: "Sunnybank",
        postcode: "4109",
        status: "confirmed",
        studentNotes: "Need to work on hill starts with manual.",
        broadcastCount: 1,
        claimedAt: new Date(Date.now() - 8 * 86400000),
        confirmedAt: new Date(Date.now() - 7 * 86400000),
      },
      {
        studentId: liam.student.id,
        instructorId: null,
        requestedDate: daysAgo(-21),
        requestedTime: "11:00",
        durationMinutes: 60,
        transmissionType: "automatic",
        suburb: "Bracken Ridge",
        postcode: "4017",
        status: "pending",
        studentNotes: "First lesson — just want to get comfortable with the basics.",
        broadcastCount: 3,
      },
    ]);
  }

  console.log("✅ Bookings seeded");

  // ── Summary ───────────────────────────────────────────────────────────────

  const [maneuverCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(maneuversTable);
  const [studentCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(studentsTable);
  const [assessmentCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(assessmentsTable);
  const [bookingCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(bookingsTable);

  console.log("\n📊 Database summary:");
  console.log(`   Maneuvers:   ${maneuverCount.n}`);
  console.log(`   Students:    ${studentCount.n}`);
  console.log(`   Assessments: ${assessmentCount.n}`);
  console.log(`   Bookings:    ${bookingCount.n}`);
  console.log("\n✅ Demo seed complete. Ready for the May 22 presentation!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => pool.end());

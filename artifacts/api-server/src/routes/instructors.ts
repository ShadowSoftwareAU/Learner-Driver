import { Router } from "express";
import { eq, sql, count, desc } from "drizzle-orm";
import { db, instructorsTable, usersTable, studentsTable, assessmentsTable } from "@workspace/db";
import { requireAuth, getOrCreateUser } from "./users";

const router = Router();

router.get("/instructors", requireAuth, async (req: any, res): Promise<void> => {
  const rows = await db.select().from(instructorsTable).orderBy(instructorsTable.fullName);
  const result = await Promise.all(rows.map(async (i) => {
    const students = await db.select({ c: count() }).from(studentsTable);
    return formatInstructor(i, students[0]?.c ?? 0);
  }));
  res.json(result);
});

router.get("/instructors/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [i] = await db.select().from(instructorsTable).where(eq(instructorsTable.id, id));
  if (!i) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatInstructor(i, 0));
});

router.patch("/instructors/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { fullName, phone, licenseNumber, vehicleMake, vehicleModel, vehicleYear, qualifications } = req.body;
  const updates: any = {};
  if (fullName) updates.fullName = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
  if (vehicleMake !== undefined) updates.vehicleMake = vehicleMake;
  if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel;
  if (vehicleYear !== undefined) updates.vehicleYear = vehicleYear;
  if (qualifications !== undefined) updates.qualifications = qualifications;
  const [updated] = await db.update(instructorsTable).set(updates).where(eq(instructorsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatInstructor(updated, 0));
});

function formatInstructor(i: any, activeStudents: number) {
  return { id: i.id, userId: i.userId, fullName: i.fullName, email: i.email, phone: i.phone, licenseNumber: i.licenseNumber, vehicleMake: i.vehicleMake, vehicleModel: i.vehicleModel, vehicleYear: i.vehicleYear, qualifications: i.qualifications, activeStudents, createdAt: i.createdAt };
}

export default router;

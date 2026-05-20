import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import studentsRouter from "./students";
import instructorsRouter from "./instructors";
import maneuversRouter from "./maneuvers";
import assessmentsRouter from "./assessments";
import handoverRouter from "./handover";
import intakeRouter from "./intake";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(studentsRouter);
router.use(instructorsRouter);
router.use(maneuversRouter);
router.use(assessmentsRouter);
router.use(handoverRouter);
router.use(intakeRouter);
router.use(dashboardRouter);
router.use(auditRouter);

export default router;

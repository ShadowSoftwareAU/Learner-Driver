import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/errors/client", (req, res) => {
  const { level, message, stack, componentStack } = req.body ?? {};
  req.log.warn({ level, message, stack, componentStack }, "client error boundary report");
  res.status(204).end();
});

export default router;

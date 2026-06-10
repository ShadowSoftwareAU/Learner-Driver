import { Router } from "express";

const router = Router();

const CLERK_COOKIE_PREFIXES = [
  "__session",
  "__session_",
  "__clerk_db_jwt",
  "__clerk_db_jwt_",
  "__client_uat",
  "__client_uat_",
];

router.get("/clear-session", (req, res) => {
  const cookieHeader = req.headers.cookie ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0]?.trim())
    .filter((name): name is string => !!name && CLERK_COOKIE_PREFIXES.some((p) => name.startsWith(p)));

  const uniqueNames = [...new Set(cookieNames)];

  for (const name of uniqueNames) {
    res.setHeader("Set-Cookie", [
      ...(Array.isArray(res.getHeader("Set-Cookie")) ? res.getHeader("Set-Cookie") as string[] : []),
      `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
      `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
    ]);
  }

  req.log.info({ cleared: uniqueNames }, "clear-session: expired stale Clerk cookies");
  res.json({ cleared: uniqueNames.length });
});

export default router;

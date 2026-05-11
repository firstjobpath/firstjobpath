import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status: number }).status) : 500;
  const message =
    typeof err === "object" && err !== null && "message" in err && typeof (err as Error).message === "string"
      ? (err as Error).message
      : "Internal server error";
  if (!res.headersSent) {
    res.status(Number.isFinite(status) && status >= 400 && status < 600 ? status : 500).json({
      error: message,
    });
  }
};

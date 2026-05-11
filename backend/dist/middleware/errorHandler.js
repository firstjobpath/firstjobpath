export const errorHandler = (err, _req, res, _next) => {
    console.error(err);
    const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : 500;
    const message = typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
        ? err.message
        : "Internal server error";
    if (!res.headersSent) {
        res.status(Number.isFinite(status) && status >= 400 && status < 600 ? status : 500).json({
            error: message,
        });
    }
};

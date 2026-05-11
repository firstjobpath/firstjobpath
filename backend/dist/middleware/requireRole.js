export function requireRole(allowed) {
    return (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!allowed.includes(req.auth.role)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}

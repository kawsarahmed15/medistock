import { buildApiError, verifyAuthToken } from "../utils.js";

export function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      throw buildApiError(401, "Unauthorized");
    }
    const token = header.slice(7).trim();
    if (!token) {
      throw buildApiError(401, "Unauthorized");
    }
    const payload = verifyAuthToken(token);
    req.auth = {
      userId: String(payload.sub),
      email: String(payload.email || ""),
      name: String(payload.name || ""),
    };
    next();
  } catch (_error) {
    next(buildApiError(401, "Unauthorized"));
  }
}

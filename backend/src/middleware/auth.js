import { buildApiError, verifyAuthToken } from "../utils.js";
import { pool } from "../db.js";

export async function requireAuth(req, res, next) {
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
    const userId = String(payload.sub);
    const sessionId = req.headers["x-session-id"] || null;

    if (sessionId) {
      // Check if session exists in database
      const [rows] = await pool.query(
        "SELECT id FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
        [sessionId, userId]
      );
      
      // Check if sessions tracking is active for this user
      const [totalCount] = await pool.query(
        "SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?",
        [userId]
      );

      // If sessions exist in database but this specific session is missing, it is revoked!
      if (rows.length === 0 && totalCount[0].count > 0) {
        throw buildApiError(401, "Session has been revoked");
      }
    }

    req.auth = {
      userId,
      email: String(payload.email || ""),
      name: String(payload.name || ""),
      sessionId,
    };
    next();
  } catch (error) {
    if (error.status === 401 || error.message === "Session has been revoked") {
      res.status(401).json({ message: "Session has been revoked", revoked: true });
    } else {
      next(buildApiError(401, "Unauthorized"));
    }
  }
}

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function generateId() {
  return crypto.randomUUID();
}

export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function sanitizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isVerified: Boolean(row.is_verified),
    pharmacyName: row.pharmacy_name || undefined,
    pharmacyAddress: row.pharmacy_address || undefined,
    gstNumber: row.gst_number || undefined,
    billColor: row.bill_color || undefined,
    signature: row.signature || undefined,
    role: row.role || "user",
    accountStatus: row.account_status || "active",
  };
}

export function buildApiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

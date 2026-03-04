import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PASSWORD, SESSION_SECRET } from "./config";
import crypto from "crypto";

const TOKEN_COOKIE = "mediahub_session";
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h

function hmac(data: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET())
    .update(data)
    .digest("hex");
}

export function createSessionToken(): string {
  const expires = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `admin:${expires}`;
  const sig = hmac(payload);
  return `${payload}:${sig}`;
}

export function validateSessionToken(token: string): boolean {
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, expiresStr, sig] = parts;
  const payload = `${role}:${expiresStr}`;
  if (hmac(payload) !== sig) return false;
  if (Date.now() > parseInt(expiresStr, 10)) return false;
  return role === "admin";
}

export function isAuthenticated(req: NextRequest): boolean {
  // Check cookie
  const cookie = req.cookies.get(TOKEN_COOKIE)?.value;
  if (cookie && validateSessionToken(cookie)) return true;

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (validateSessionToken(token)) return true;
  }

  return false;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "Authentication required" },
    { status: 401 }
  );
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_EXPIRY_MS / 1000,
    path: "/",
  });
}

export { TOKEN_COOKIE };

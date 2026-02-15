import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory session store for admin authentication.
 * Sessions are lost on server restart (by design for v1).
 */
const sessions = new Set<string>();

/**
 * Returns whether admin access is configured (ADMIN_SECRET env var is set).
 */
export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_SECRET;
}

/**
 * Attempts to log in with the provided secret.
 * Returns a session token on success, or null on failure.
 */
export function login(secret: string): string | null {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return null;
  }

  const token = randomUUID();
  sessions.add(token);
  return token;
}

/**
 * Logs out by removing the session token.
 */
export function logout(token: string): void {
  sessions.delete(token);
}

/**
 * Checks whether a session token is valid.
 */
export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  return sessions.has(token);
}

/**
 * Parses a simple cookie header to extract a value by name.
 */
export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/**
 * Express middleware that checks for a valid admin session.
 * Sets `req.isAdmin` for downstream use, but does NOT block the request.
 */
export function authStatus(req: Request, _res: Response, next: NextFunction): void {
  const token = parseCookie(req.headers.cookie, "session");
  (req as any).isAdmin = isValidSession(token);
  next();
}

/**
 * Express middleware that requires admin authentication.
 * Returns 401 if not authenticated.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!(req as any).isAdmin) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

/**
 * Clears all sessions (useful for testing).
 */
export function clearSessions(): void {
  sessions.clear();
}

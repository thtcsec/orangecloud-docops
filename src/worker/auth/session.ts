import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@shared/domain";

export const SESSION_COOKIE_NAME = "docops_session";
const SESSION_EXPIRATION = "7d";

export type SessionPayload = {
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
};

function getSecretKey(env: Env): Uint8Array {
  const rawSecret =
    env.JWT_SECRET ||
    env.CF_ACCESS_AUD ||
    "orangecloud-docops-default-secure-session-key-32b";
  return new TextEncoder().encode(rawSecret.padEnd(32, "0").slice(0, 32));
}

/**
 * Signs a direct session JWT token.
 */
export async function createSessionToken(
  payload: SessionPayload,
  env: Env,
): Promise<string> {
  const key = getSecretKey(env);
  return new SignJWT({
    uid: payload.userId,
    oid: payload.organizationId,
    email: payload.email,
    name: payload.displayName,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .setIssuer("orangecloud-docops")
    .sign(key);
}

/**
 * Verifies a direct session JWT token and extracts the payload.
 */
export async function verifySessionToken(
  token: string,
  env: Env,
): Promise<SessionPayload | null> {
  try {
    const key = getSecretKey(env);
    const { payload } = await jwtVerify(token, key, {
      issuer: "orangecloud-docops",
    });

    if (
      typeof payload.uid === "string" &&
      typeof payload.oid === "string" &&
      typeof payload.email === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        userId: payload.uid,
        organizationId: payload.oid,
        email: payload.email,
        displayName: typeof payload.name === "string" ? payload.name : payload.email,
        role: payload.role as UserRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds the Set-Cookie header value for establishing a session.
 */
export function buildSessionCookieHeader(
  token: string,
  env: Env,
  maxAgeSeconds = 7 * 24 * 60 * 60,
): string {
  const isSecure = env.ENVIRONMENT !== "local";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

/**
 * Builds the Set-Cookie header value for clearing a session.
 */
export function buildClearSessionCookieHeader(env: Env): string {
  const isSecure = env.ENVIRONMENT !== "local";
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

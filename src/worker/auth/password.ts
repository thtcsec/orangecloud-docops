/**
 * Native Web Crypto PBKDF2 Password Hashing & Verification.
 * Works natively on Cloudflare Workers edge isolate without external native dependencies.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Constant-time comparison between two Uint8Arrays to prevent timing attacks.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Hashes a plaintext password into a serialized string:
 * `pbkdf2:sha256:<iterations>:<saltHex>:<hashHex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    KEY_LENGTH * 8,
  );

  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${bufferToHex(salt.buffer)}:${bufferToHex(derived)}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash string.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith("pbkdf2:sha256:")) {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 5) return false;

  const iterations = parseInt(parts[2], 10);
  const saltHex = parts[3];
  const hashHex = parts[4];

  if (!iterations || !saltHex || !hashHex) return false;

  const salt = hexToBuffer(saltHex);
  const expectedHash = hexToBuffer(hashHex);

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    expectedHash.byteLength * 8,
  );

  return timingSafeEqual(new Uint8Array(derived), expectedHash);
}

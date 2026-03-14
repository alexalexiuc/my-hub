/**
 * Auth utilities shared between mcp-server and hub.
 *
 * HMAC-SHA256 token format: base64url(JSON payload) + "." + base64url(HMAC sig)
 * Compatible with the algorithm used in hive-manager-mcp-server.
 */

export interface McpTokenPayload {
  client_id: string;
  user_id: string;
  exp: number; // Unix ms
}

export interface AuthCodePayload {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  exp: number; // Unix ms
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function base64urlEncodeStr(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str).buffer as ArrayBuffer);
}

function base64urlDecodeStr(str: string): string {
  return new TextDecoder().decode(base64urlDecode(str));
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function signToken(payload: object, secret: string): Promise<string> {
  const data = base64urlEncodeStr(JSON.stringify(payload));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${base64urlEncode(sig)}`;
}

export async function verifyToken<T extends { exp?: number }>(token: string, secret: string): Promise<T | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await getHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, base64urlDecode(sig), new TextEncoder().encode(data));
  if (!valid) return null;

  try {
    const parsed = JSON.parse(base64urlDecodeStr(data)) as T;
    if (typeof parsed.exp === "number" && parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Verify PKCE S256: SHA-256(code_verifier) base64url-encoded must equal code_challenge.
 */
export async function verifyPkceS256(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const encoded = base64urlEncode(hash);
  return encoded === codeChallenge;
}

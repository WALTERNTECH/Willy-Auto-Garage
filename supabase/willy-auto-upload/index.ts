/**
 * willy-auto-upload
 *
 * Receives a photo from the Willy Auto staff page and writes it into the
 * public `willy-auto` storage bucket.
 *
 * JWT verification is off on purpose: the staff page has no Supabase login.
 * Authentication is the shared staff passcode, checked here against a SHA-256
 * hash held in public.willy_auto_config, which only the service role can read.
 * The browser never sees a Supabase key, and the write happens here rather
 * than in the page, so nothing in the bucket is writable from the client.
 *
 * Deployed to the Krypton project. To redeploy:
 *   supabase functions deploy willy-auto-upload --no-verify-jwt
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "willy-auto";
const MAX_BYTES = 5 * 1024 * 1024;
// Only the slots the website actually renders.
const PATH_RE = /^(hero|services)\/[a-z0-9][a-z0-9-]{0,63}\.jpg$/;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The hash barely changes; re-reading it on every upload is wasted latency.
// Only a successful read is cached, so a failure never sticks.
let cachedHash: string | null = null;
let cachedAt = 0;

async function readHash(): Promise<string | null> {
  const { data, error } = await admin
    .from("willy_auto_config")
    .select("value")
    .eq("key", "staff_passcode_sha256")
    .maybeSingle();
  if (error || !data) return null;
  return (data.value as string) ?? null;
}

/**
 * The first request to a cold isolate can lose its database connection race,
 * which used to surface to staff as "passcode not configured" on an upload
 * that was actually fine. Give it a second go before believing it.
 */
async function expectedHash(): Promise<string> {
  if (cachedHash && Date.now() - cachedAt < 60_000) return cachedHash;

  let hash = await readHash();
  if (!hash) {
    await new Promise((r) => setTimeout(r, 300));
    hash = await readHash();
  }
  if (!hash) throw new Error("Could not reach the photo service. Try again in a moment.");

  cachedHash = hash;
  cachedAt = Date.now();
  return hash;
}

async function checkPasscode(passcode: unknown): Promise<boolean> {
  if (typeof passcode !== "string" || !passcode) return false;
  const ok = equalConstantTime(await sha256Hex(passcode.trim()), await expectedHash());
  // Slow down anyone working through the keyspace.
  if (!ok) await new Promise((r) => setTimeout(r, 400));
  return ok;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  try {
    if (!(await checkPasscode(body.passcode))) {
      return json({ error: "That passcode is not right." }, 401);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 503);
  }

  // Used by the staff page to check a passcode before saving it.
  if (body.action === "verify") return json({ ok: true });

  const path = typeof body.path === "string" ? body.path : "";
  if (!PATH_RE.test(path)) {
    return json({ error: "That is not a slot this website uses." }, 400);
  }

  if (typeof body.data !== "string" || !body.data) {
    return json({ error: "No photo was attached." }, 400);
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(body.data);
  } catch {
    return json({ error: "That photo could not be read." }, 400);
  }

  if (!bytes.length) return json({ error: "That photo is empty." }, 400);
  if (bytes.length > MAX_BYTES) {
    return json({ error: "That photo is larger than 5 MB." }, 413);
  }

  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: true,
    // Short cache so a replaced photo shows up on the site within a minute.
    cacheControl: "60",
  });

  if (error) return json({ error: error.message }, 500);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return json({ ok: true, path, url: data.publicUrl, bytes: bytes.length });
});

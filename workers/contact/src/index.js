/**
 * kitchensink4.ai contact form backend.
 *
 * POST /api/contact  ->  validate, spam-screen, rate limit, send one email.
 * Everything else    ->  404.
 *
 * Responses are machine envelopes only: {"ok":true} or {"ok":false,"error":"<code>"}.
 * The page owns all visitor-facing English; this Worker emits no prose.
 *
 * Privacy: message bodies, names, email addresses and IPs are never logged.
 * The only log line per request is {t, category, outcome}.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** category -> destination mailbox */
const DESTINATIONS = {
  support: "support@kitchensink4.ai",
  bug: "support@kitchensink4.ai",
  feature: "support@kitchensink4.ai",
  licensing: "licensing@kitchensink4.ai",
  investing: "investing@kitchensink4.ai",
  other: "admin@kitchensink4.ai",
};

/** category -> subject tag */
const SUBJECT_TAGS = {
  support: "[Support]",
  bug: "[Bug]",
  feature: "[Feature request]",
  licensing: "[Licensing]",
  investing: "[Investing]",
  other: "[Contact]",
};

const CATEGORIES = Object.keys(DESTINATIONS);

/** Hard ceilings. Payload cap is the brief's 32KB. */
const MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_MESSAGE_CHARS = 8000;
const MAX_NAME_CHARS = 200;
const MAX_EMAIL_CHARS = 254;

/** Hourly per-IP cap enforced through KV when a KV namespace is bound. */
const HOURLY_LIMIT = 10;
const HOURLY_TTL_SECONDS = 7200;

/** Defaults overridable through wrangler [vars]. */
const DEFAULT_FROM_EMAIL = "no-reply@kitchensink4.ai";
const DEFAULT_FROM_NAME = "kitchensink4.ai contact form";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function ok(status = 200) {
  return new Response(JSON.stringify({ ok: true }), {
    status,
    headers: JSON_HEADERS,
  });
}

function fail(status, code) {
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Single structured log line. Deliberately excludes every field a visitor
 * typed, so the privacy promise on the page holds even in the Workers log tail.
 */
function logOutcome(category, outcome) {
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      category: category || null,
      outcome,
    })
  );
}

function isString(v) {
  return typeof v === "string";
}

/**
 * Syntactic plausibility only. Real validation is the visitor receiving a
 * reply, so this rejects obvious garbage and nothing more.
 */
function plausibleEmail(value) {
  if (!isString(value)) return false;
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_EMAIL_CHARS) return false;
  if (/[\s<>,;"]/.test(v)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(v);
}

/** Strip CR and LF so nothing a visitor types can inject a header. */
function headerSafe(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown"
  );
}

function truthy(value) {
  return String(value).toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// Rate limiting: two independent layers, both optional at runtime.
//
// Layer 1 is the native Workers rate limiting binding. It is storage-free but
// its period is restricted to 10 or 60 seconds, so it can only absorb bursts.
// Layer 2 is a KV counter that enforces the real 10 per hour rule.
// If neither binding is present the Worker still runs, unlimited.
// ---------------------------------------------------------------------------

async function burstAllowed(env, ip) {
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== "function") {
    return true;
  }
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: `ip:${ip}` });
    return success !== false;
  } catch {
    // A limiter failure must not take the form down, but it must be visible,
    // otherwise the Worker runs unlimited and nothing says so.
    logOutcome(null, "burst_limiter_error");
    return true;
  }
}

async function hourlyAllowed(env, ip) {
  if (!env.CONTACT_RL || typeof env.CONTACT_RL.get !== "function") {
    return true;
  }
  const bucket = Math.floor(Date.now() / 3600000);
  const key = `rl:${bucket}:${ip}`;
  try {
    const raw = await env.CONTACT_RL.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= HOURLY_LIMIT) return false;
    await env.CONTACT_RL.put(key, String(count + 1), {
      expirationTtl: HOURLY_TTL_SECONDS,
    });
    return true;
  } catch {
    // Same reasoning as the burst guard: fail open, but say so in the log.
    logOutcome(null, "hourly_limiter_error");
    return true;
  }
}

// ---------------------------------------------------------------------------
// Turnstile, behind a config flag so the widget can be a fast follow.
// Enable by setting the var TURNSTILE_ENABLED = "true" and the secret
// TURNSTILE_SECRET. Until then this function is a no-op pass.
// ---------------------------------------------------------------------------

async function turnstilePassed(env, request, token) {
  if (!truthy(env.TURNSTILE_ENABLED)) return true;
  if (!env.TURNSTILE_SECRET) return false;
  if (!isString(token) || token.trim().length === 0) return false;

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token.trim());
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.append("remoteip", ip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Email composition
// ---------------------------------------------------------------------------

function buildEmail(env, fields) {
  const { category, name, email, message } = fields;

  const subjectWho = name ? headerSafe(name) : "message from the contact page";
  const subject = `${SUBJECT_TAGS[category]} ${subjectWho}`.slice(0, 900);

  const lines = [message.trim()];
  if (email) {
    lines.push("");
    lines.push("--");
    lines.push(`Reply to: ${email}`);
    if (name) lines.push(`Name: ${name}`);
    lines.push(`Category: ${category}`);
  } else {
    lines.push("");
    lines.push("--");
    lines.push("No reply address was given.");
    lines.push(`Category: ${category}`);
  }

  const msg = {
    to: DESTINATIONS[category],
    from: {
      email: env.FROM_EMAIL || DEFAULT_FROM_EMAIL,
      name: env.FROM_NAME || DEFAULT_FROM_NAME,
    },
    subject,
    text: lines.join("\n"),
  };
  if (email) msg.replyTo = email;
  return msg;
}

// ---------------------------------------------------------------------------
// Sending
//
// Primary path is the Cloudflare Email Service binding (wrangler [[send_email]]
// name = "EMAIL"). Two fallbacks are wired behind MAIL_PROVIDER so the owner can
// switch vendors without a code change:
//   MAIL_PROVIDER = "cloudflare" (default) | "zeptomail" | "resend" | "stub"
// The stub exists only for local tests and refuses to run unless STUB_SENDER
// is "true", so it can never fire in production.
// ---------------------------------------------------------------------------

async function sendCloudflare(env, msg) {
  if (!env.EMAIL || typeof env.EMAIL.send !== "function") {
    throw new Error("EMAIL binding missing");
  }
  await env.EMAIL.send(msg);
}

async function sendZeptomail(env, msg) {
  if (!env.ZEPTOMAIL_TOKEN) throw new Error("ZEPTOMAIL_TOKEN missing");
  const payload = {
    from: { address: msg.from.email, name: msg.from.name },
    to: [{ email_address: { address: msg.to } }],
    subject: msg.subject,
    textbody: msg.text,
  };
  if (msg.replyTo) payload.reply_to = [{ address: msg.replyTo }];

  const res = await fetch(
    env.ZEPTOMAIL_ENDPOINT || "https://api.zeptomail.com/v1.1/email",
    {
      method: "POST",
      headers: {
        Authorization: env.ZEPTOMAIL_TOKEN,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`zeptomail ${res.status}`);
}

async function sendResend(env, msg) {
  if (!env.RESEND_TOKEN) throw new Error("RESEND_TOKEN missing");
  const payload = {
    from: `${msg.from.name} <${msg.from.email}>`,
    to: [msg.to],
    subject: msg.subject,
    text: msg.text,
  };
  if (msg.replyTo) payload.reply_to = msg.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

async function sendStub(env, request) {
  if (!truthy(env.STUB_SENDER)) throw new Error("stub sender not enabled");
  // Local tests drive the outcome with a header. Prod never reaches here.
  if (request.headers.get("X-Test-Send") === "fail") {
    throw new Error("stubbed send failure");
  }
}

async function sendEmail(env, request, msg) {
  const provider = (env.MAIL_PROVIDER || "cloudflare").toLowerCase();
  switch (provider) {
    case "stub":
      return sendStub(env, request);
    case "zeptomail":
      return sendZeptomail(env, msg);
    case "resend":
      return sendResend(env, msg);
    default:
      return sendCloudflare(env, msg);
  }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

async function handleContact(request, env) {
  const ip = clientIp(request);

  // Burst guard first: storage-free, covers malformed floods too.
  if (!(await burstAllowed(env, ip))) {
    logOutcome(null, "rate_limited_burst");
    return fail(429, "rate_limited");
  }

  const declared = request.headers.get("content-length");
  if (declared && parseInt(declared, 10) > MAX_PAYLOAD_BYTES) {
    logOutcome(null, "too_large");
    return fail(413, "too_large");
  }

  const raw = await request.text();
  // Byte length, not character length, since the cap is on the payload.
  if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
    logOutcome(null, "too_large");
    return fail(413, "too_large");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    logOutcome(null, "bad_json");
    return fail(400, "bad_request");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    logOutcome(null, "bad_json");
    return fail(400, "bad_request");
  }

  // Honeypot. A filled "website" field means a bot walked the form. Answer
  // exactly like a success so the sender learns nothing, and send no email.
  if (isString(body.website) && body.website.trim().length > 0) {
    logOutcome(isString(body.category) ? body.category : null, "honeypot_drop");
    return ok();
  }
  if (body.website !== undefined && !isString(body.website)) {
    logOutcome(null, "honeypot_drop");
    return ok();
  }

  const category = isString(body.category) ? body.category.trim() : "";
  if (!CATEGORIES.includes(category)) {
    logOutcome(null, "invalid_category");
    return fail(400, "invalid_category");
  }

  const message = isString(body.message) ? body.message.trim() : "";
  if (message.length === 0) {
    logOutcome(category, "empty_message");
    return fail(400, "empty_message");
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    logOutcome(category, "message_too_long");
    return fail(400, "too_large");
  }

  let name = "";
  if (body.name !== undefined && body.name !== null) {
    if (!isString(body.name)) {
      logOutcome(category, "invalid_name");
      return fail(400, "bad_request");
    }
    name = body.name.trim().slice(0, MAX_NAME_CHARS);
  }

  let email = "";
  const rawEmail =
    body.email === undefined || body.email === null ? "" : body.email;
  if (!(isString(rawEmail) && rawEmail.trim().length === 0)) {
    if (!plausibleEmail(rawEmail)) {
      logOutcome(category, "invalid_email");
      return fail(400, "invalid_email");
    }
    email = rawEmail.trim();
  }

  if (!(await turnstilePassed(env, request, body["cf-turnstile-response"]))) {
    logOutcome(category, "captcha_failed");
    return fail(403, "captcha_failed");
  }

  if (!(await hourlyAllowed(env, ip))) {
    logOutcome(category, "rate_limited_hourly");
    return fail(429, "rate_limited");
  }

  const msg = buildEmail(env, { category, name, email, message });

  try {
    await sendEmail(env, request, msg);
  } catch {
    // The thrown error can carry the message body in some provider SDKs, so it
    // is never logged. The page shows its own failure state on a 502.
    logOutcome(category, "send_failed");
    return fail(502, "send_failed");
  }

  logOutcome(category, "sent");
  return ok();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/contact") {
      return fail(404, "not_found");
    }

    // The page and the endpoint share an origin, so no CORS headers are needed.
    // OPTIONS is answered defensively and grants nothing cross-origin.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { allow: "POST, OPTIONS" },
      });
    }

    if (request.method !== "POST") {
      return fail(405, "method_not_allowed");
    }

    return handleContact(request, env);
  },
};

// Exported for tests only.
export const __test = {
  DESTINATIONS,
  SUBJECT_TAGS,
  plausibleEmail,
  buildEmail,
};

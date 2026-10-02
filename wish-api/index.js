// Vercel Function: forwards a birthday wish to a Discord channel.
//
// No dependencies, no database, no build step. The webhook URL is read from
// DISCORD_WEBHOOK_URL at runtime, so it is never part of the site's JavaScript
// and cannot be scraped by a visitor.

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const MAX_LENGTH = 280;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Best effort, per instance. Stops one page from flooding the channel; it is not
// a real defence once requests are spread across instances.
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();

  if (hits.size > 1000) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  const entry = hits.get(ip);

  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  return (first ?? "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

function reply(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);

    // A 280 character wish is never this big. Bail out rather than buffer
    // whatever a bored stranger decides to upload.
    if (chunks.reduce((total, part) => total + part.length, 0) > 8192) {
      return null;
    }
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const path = (req.url ?? "").split("?")[0];

  if (path === "/api/healthz" || path === "/healthz") {
    return reply(res, 200, { status: "ok" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "Method not allowed" });
  }

  if (!WEBHOOK_URL) {
    console.error("DISCORD_WEBHOOK_URL is not set");
    return reply(res, 503, { error: "Wishes are not available right now" });
  }

  const body = await readJson(req);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (message.length < 1) {
    return reply(res, 400, { error: "Say something first" });
  }

  if (message.length > MAX_LENGTH) {
    return reply(res, 400, { error: `Keep it under ${MAX_LENGTH} characters` });
  }

  if (rateLimited(clientIp(req))) {
    return reply(res, 429, { error: "Too many wishes, try again later" });
  }

  const discord = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "make a wish",
      // Without this, a wish containing @everyone would ping the channel.
      allowed_mentions: { parse: [] },
      embeds: [
        {
          description: message,
          color: 0xd4507f,
          footer: { text: "sent from the birthday site" },
        },
      ],
    }),
  });

  if (discord.ok) {
    return reply(res, 201, { ok: true });
  }

  const retryAfter = discord.headers.get("retry-after");

  if (discord.status === 429) {
    console.warn("discord rate limited us", { retryAfter });
    return reply(res, 503, { error: "Wishes are not available right now" });
  }

  console.error("discord rejected the wish", {
    status: discord.status,
    body: (await discord.text()).slice(0, 500),
  });

  return reply(res, 502, { error: "Wishes are not available right now" });
}

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// The bundle runs from dist/, so step back up to the artifact root to find public/.
const publicDir = path.resolve(
  path.basename(artifactDir) === "dist" ? path.dirname(artifactDir) : artifactDir,
  "public",
);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".ktx2": "image/ktx2",
  ".task": "application/octet-stream",
};

function contentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// Fingerprinted build output and transcoder blobs never change, so they can be
// cached forever. The model and media payloads are large, so they get a long
// max-age that still allows a redeploy to be picked up.
function cacheControl(urlPath: string): string {
  if (
    urlPath.startsWith("/_next/static/") ||
    urlPath.startsWith("/basis/") ||
    urlPath.startsWith("/draco/")
  ) {
    return "public, max-age=31536000, immutable";
  }

  if (
    urlPath.startsWith("/models/") ||
    urlPath.startsWith("/mediapipe/") ||
    urlPath.startsWith("/og/")
  ) {
    return "public, max-age=604800";
  }

  return "no-cache";
}

function resolveWithinPublic(urlPath: string): string | null {
  let decoded: string;

  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const relative = path.posix.normalize(decoded).replace(/^\/+/, "");

  if (relative.startsWith("..")) {
    return null;
  }

  const resolved = path.resolve(publicDir, relative);

  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
    return null;
  }

  return resolved;
}

async function findFile(candidate: string): Promise<string | null> {
  const candidates = [candidate];

  // The Next.js static export writes both /about.html and /about/index.html
  // for nested routes, so try both shapes when the URL has no extension.
  if (!path.extname(candidate)) {
    candidates.push(`${candidate}.html`, path.join(candidate, "index.html"));
  }

  for (const entry of candidates) {
    const stats = await stat(entry).catch(() => null);

    if (stats?.isFile()) {
      return entry;
    }
  }

  return null;
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());

  if (!match) {
    return null;
  }

  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  let start: number;
  let end: number;

  if (rawStart === "") {
    const suffixLength = Number(rawEnd);

    if (rawEnd === "" || !Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

function baseHeaders(filePath: string, urlPath: string, stats: Stats): Record<string, string> {
  return {
    "Content-Type": contentType(filePath),
    "Cache-Control": cacheControl(urlPath),
    "Accept-Ranges": "bytes",
    "Last-Modified": stats.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  };
}

function sendFile(req: IncomingMessage, res: ServerResponse, filePath: string, urlPath: string): void {
  const stats = stat(filePath).catch(() => null);

  stats.then((fileStats) => {
    if (!fileStats) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
      return;
    }

    const size = fileStats.size;
    const headers = baseHeaders(filePath, urlPath, fileStats);
    const rangeHeader = req.headers.range;

    if (typeof rangeHeader === "string") {
      const range = parseRange(rangeHeader, size);

      if (!range) {
        // An unsatisfiable range must not silently degrade into a full 200, or
        // seeking in the audio/video elements breaks.
        res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": range.end - range.start + 1,
      });
      createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, "Content-Length": size });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  });
}

function sendNotFound(req: IncomingMessage, res: ServerResponse): void {
  findFile(path.join(publicDir, "404.html")).then((notFoundPath) => {
    if (!notFoundPath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const stats = stat(notFoundPath);

    stats.then((fileStats) => {
      res.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": fileStats.size,
        "Cache-Control": "no-cache",
      });

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      createReadStream(notFoundPath).pipe(res);
    });
  });
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
  const resolved = resolveWithinPublic(urlPath);

  if (!resolved) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  findFile(resolved).then((filePath) => {
    if (filePath) {
      sendFile(req, res, filePath, urlPath);
      return;
    }

    sendNotFound(req, res);
  });
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`Birthday site serving ${publicDir} on http://0.0.0.0:${port}`);
});

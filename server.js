// Nepal TVD - Node.js server for Render (Web Service)
// Serves static files from /public and runs the same API handlers
// that were written as Cloudflare Pages Functions (functions/api/*.js).
// Zero external dependencies - uses Node 18+ built-in fetch/Request/Response.

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

// Import Cloudflare-style Pages Functions and adapt them
import * as downloadFn from "./functions/api/download.js";
import * as proxyFn from "./functions/api/proxy.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

// Convert a Node request into a Web Request, call the Cloudflare-style
// handler with a minimal context, then write the Web Response back.
async function runPagesFunction(handler, req, res) {
  const url = `http://${req.headers.host || "localhost"}${req.url}`;

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks)));
          req.on("error", reject);
        });

  const webRequest = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body && body.length ? body : undefined,
  });

  const context = { request: webRequest, env: process.env, params: {} };
  const webResponse = await handler(context);

  res.writeHead(
    webResponse.status,
    Object.fromEntries(webResponse.headers.entries())
  );

  if (webResponse.body) {
    Readable.fromWeb(webResponse.body).pipe(res);
  } else {
    res.end();
  }
}

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/") pathname = "/index.html";

  // Prevent path traversal
  const safePath = normalize(join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const info = await stat(safePath);
    const filePath = info.isDirectory() ? join(safePath, "index.html") : safePath;
    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=300" });
    res.end(data);
  } catch {
    // SPA-style fallback to index.html
    try {
      const data = await readFile(join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://x").pathname;

    if (pathname === "/api/download") {
      if (req.method === "POST") return await runPagesFunction(downloadFn.onRequestPost, req, res);
      if (req.method === "OPTIONS") return await runPagesFunction(downloadFn.onRequestOptions, req, res);
      res.writeHead(405);
      return res.end("Method Not Allowed");
    }

    if (pathname === "/api/proxy") {
      if (req.method === "GET") return await runPagesFunction(proxyFn.onRequestGet, req, res);
      res.writeHead(405);
      return res.end("Method Not Allowed");
    }

    return await serveStatic(req, res);
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ success: false, error: "Internal server error" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Nepal TVD server running on http://0.0.0.0:${PORT}`);
});

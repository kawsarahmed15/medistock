import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createReadStream, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./dist/server/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, "dist", "client");
const port = Number.parseInt(process.env.PORT || "8080", 10);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function resolveAssetFile(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  if (!cleanPath.startsWith("/assets/") && cleanPath !== "/favicon.ico") {
    return { cleanPath, filePath: null };
  }

  const relativePath = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
  const filePath = path.join(clientDir, relativePath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(clientDir)) {
    return { cleanPath, filePath: null };
  }

  return { cleanPath, filePath: normalized };
}

function resolveLatestStylesheet() {
  const assetsDir = path.join(clientDir, "assets");
  if (!existsSync(assetsDir)) {
    return null;
  }

  const styleFile = readdirSync(assetsDir)
    .filter((name) => name.startsWith("styles-") && name.endsWith(".css"))
    .sort()
    .at(-1);

  if (!styleFile) {
    return null;
  }

  return path.join(assetsDir, styleFile);
}

function nodeReqToRequest(req) {
  const protocol = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0].trim();
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(req.method || "GET");
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

const server = createServer(async (req, res) => {
  try {
    const { cleanPath, filePath: assetFile } = resolveAssetFile(req.url);
    if (assetFile && existsSync(assetFile)) {
      const ext = path.extname(assetFile).toLowerCase();
      res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      createReadStream(assetFile).pipe(res);
      return;
    }

    // If a stale hashed stylesheet is requested, serve the latest built stylesheet.
    if (cleanPath && cleanPath.startsWith("/assets/styles-") && cleanPath.endsWith(".css")) {
      const latestStylesheet = resolveLatestStylesheet();
      if (latestStylesheet) {
        res.setHeader("Content-Type", mimeTypes[".css"]);
        res.setHeader("Cache-Control", "public, max-age=300");
        createReadStream(latestStylesheet).pipe(res);
        return;
      }
    }

    // Never route missing asset requests to SSR HTML.
    if (cleanPath && cleanPath.startsWith("/assets/")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Asset not found");
      return;
    }

    if (req.url === "/favicon.ico") {
      res.statusCode = 204;
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end("");
      return;
    }

    const request = nodeReqToRequest(req);
    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Frontend SSR adapter error", error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Frontend server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend SSR server running on port ${port}`);
});

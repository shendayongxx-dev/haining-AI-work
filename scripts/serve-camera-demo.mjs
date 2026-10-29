import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/demos/camera-gesture/" : url.pathname);
    const candidate = resolve(join(root, normalize(pathname).replace(/^[/\\]+/, "")));
    if (candidate !== root && !candidate.startsWith(`${root}\\`) && !candidate.startsWith(`${root}/`)) throw new Error("Forbidden");
    const info = await stat(candidate);
    const file = info.isDirectory() ? join(candidate, "index.html") : candidate;
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  } catch (error) {
    response.writeHead(error.message === "Forbidden" ? 403 : 404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message === "Forbidden" ? "Forbidden" : "Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Camera gesture demo: http://127.0.0.1:${port}/demos/camera-gesture/`);
});

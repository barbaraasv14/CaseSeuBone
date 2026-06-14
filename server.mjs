import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4173);
const root = process.cwd();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer((request, response) => {
  const rawPath = decodeURIComponent(request.url?.split("?")[0] ?? "/");
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = normalize(join(root, requestedPath));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Radar de Atividades rodando em http://localhost:${port}`);
});

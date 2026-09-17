import { createServer, request as httpRequest } from "node:http";

const LISTEN = Number(process.env.PROXY_PORT ?? 3001);
const TARGET = Number(process.env.PGRST_PORT ?? 3002);

createServer((req, res) => {
  const path = req.url.replace(/^\/rest\/v1/, "") || "/";

  const headers = { ...req.headers, host: `127.0.0.1:${TARGET}` };
  delete headers.authorization;
  delete headers.apikey;

  const upstream = httpRequest(
    { host: "127.0.0.1", port: TARGET, path, method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `proxy: ${err.message}` }));
  });
  req.pipe(upstream);
}).listen(LISTEN, "127.0.0.1", () => {
  console.log(`rest proxy :${LISTEN}/rest/v1/* -> postgrest :${TARGET}/*`);
});

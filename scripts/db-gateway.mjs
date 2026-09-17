import http from "node:http";

const PORT = Number(process.env.WELLPLACE_GATEWAY_PORT ?? 54321);
const UPSTREAM = process.env.WELLPLACE_TEST_REST_URL ?? "http://127.0.0.1:3002";

const server = http.createServer((req, res) => {
  const path = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
  const target = new URL(path, UPSTREAM);

  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers.apikey;
  delete headers.host;

  const upstream = http.request(
    target,
    { method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );

  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({
      message: `Local gateway could not reach PostgREST at ${UPSTREAM}. Run: npm run db:rest:up`,
      detail: err.message,
    }));
  });

  req.pipe(upstream);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`✓ gateway  http://127.0.0.1:${PORT}  →  ${UPSTREAM}`);
  console.log(`  set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${PORT} in .env`);
  console.log(`  everything through here runs as anon`);
});

import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import app from "./app.js";
import database from "./db/index.js";
const server = createServer(app);
server.listen(8080);
export default {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith("/api/"))
      return env.ASSETS.fetch(request);
    const connection = database.createConnection(env.DATABASE_URL);
    return database.scope.run(connection, async () => {
      try {
        return await handleAsNodeRequest(8080, request);
      } finally {
        ctx.waitUntil(connection.pool.end());
      }
    });
  },
};

require("dotenv").config({ path: [".env.development.local", ".env"] });
const app = require("./app");
const { close } = require("./db");
const server = app.listen(process.env.API_PORT || 3001, "127.0.0.1", () =>
  console.log(
    "Listing Studio API listening on port " + (process.env.API_PORT || 3001),
  ),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await close();
    process.exit(0);
  }),
);

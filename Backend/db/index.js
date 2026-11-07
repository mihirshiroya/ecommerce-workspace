const { AsyncLocalStorage } = require("node:async_hooks");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const schema = require("./schema");
const scope = new AsyncLocalStorage();
let local;
function createConnection(connectionString) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}
function connection() {
  if (scope.getStore()) return scope.getStore();
  if (!local) local = createConnection(process.env.DATABASE_URL);
  return local;
}
const db = new Proxy(
  {},
  {
    get: (_, key) => {
      const value = connection().db[key];
      return typeof value === "function" ? value.bind(connection().db) : value;
    },
  },
);
module.exports = {
  db,
  scope,
  createConnection,
  close: async () => local?.pool.end(),
};

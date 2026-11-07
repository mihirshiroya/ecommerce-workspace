const test = require("node:test"),
  assert = require("node:assert/strict"),
  { randomBytes } = require("node:crypto");
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString("hex");
const app = require("../Backend/app"),
  Auth = require("../Backend/utils/auth");
let server, base;
test.before(async () => {
  await new Promise((r) => {
    server = app.listen(0, "127.0.0.1", r);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((r) => server.close(r)));
test("business endpoints deny anonymous and fabricated tokens", async () => {
  for (const path of [
    "/accounts",
    "skus",
    "/mappings",
    "/drafts",
    "/history",
    "/dashboard",
  ]) {
    const url = base + "/api/workspace/" + path.replace(/^\//, "");
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (
        await fetch(url, {
          headers: { Authorization: "Bearer not-a-valid-token" },
        })
      ).status,
      401,
    );
  }
});
test("health reports only database, authentication, and email configuration", async () => {
  const response = await fetch(base + "/api/health");
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(
    Object.keys(data).sort(),
    [
      "service",
      "databaseConfigured",
      "authConfigured",
      "emailConfigured",
    ].sort(),
  );
});
test("mutations require the non-simple verification header", async () => {
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("Google OAuth and callback endpoints are removed", async () => {
  for (const path of ["/google", "/google/callback", "/google/status"])
    assert.equal((await fetch(base + "/api/auth" + path)).status, 404);
});
test("template manifest exposes schemas but not embedded workbook bytes", async () => {
  const r = await fetch(base + "/api/workspace/templates");
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(json.data.filter((t) => t.status === "ready").length, 12);
  assert.equal(
    json.data.filter(
      (t) => t.status === "ready" && t.marketplace === "flipkart",
    ).length,
    4,
  );
  assert.equal(json.data.filter((t) => t.status === "blocked").length, 0);
  assert.equal(JSON.stringify(json).includes("base64"), false);
});
test("bcrypt, signed JWTs, unique refresh rotation, and tamper rejection", async () => {
  const hash = await Auth.hashPassword("TestOnly-Strong-123!");
  assert.equal(await Auth.comparePassword("TestOnly-Strong-123!", hash), true);
  assert.equal(await Auth.comparePassword("wrong", hash), false);
  const a = Auth.generateTokens({ id: "unit-test", role: "USER" }),
    b = Auth.generateTokens({ id: "unit-test", role: "USER" });
  assert.notEqual(a.refreshToken, b.refreshToken);
  assert.equal(Auth.verifyToken(a.accessToken).id, "unit-test");
  assert.equal(Auth.verifyToken(a.accessToken + "tampered"), null);
  assert.equal(
    Auth.verifyToken(a.refreshToken, process.env.JWT_REFRESH_SECRET).sessionId,
    Auth.verifyToken(a.accessToken).sessionId,
  );
});

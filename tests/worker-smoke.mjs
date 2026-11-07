import app from "../Backend/app.js";
import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import auth from "../Backend/utils/auth.js";
import workbooks from "../Backend/services/workbooks.js";
import jwt from "../Backend/node_modules/jsonwebtoken/index.js";
const server = createServer(app);
server.listen(8081);
export default {
  async fetch(request) {
    if (new URL(request.url).pathname === "/api/runtime-proof") {
      const template = workbooks.registry.find(
        (t) => t.key === "meesho:earring:v1",
      );
      const row = Object.fromEntries(
        template.fields
          .filter((f) => f.required)
          .map((f) => [
            f.id,
            f.options[0] ||
              (f.type === "number"
                ? "1"
                : f.type === "url"
                  ? "https://images.example.com/test.jpg"
                  : "Runtime test"),
          ]),
      );
      for (const field of template.fields) {
        if (/^meesho price$/i.test(field.label)) row[field.id] = "100";
        if (/^mrp$/i.test(field.label)) row[field.id] = "999";
      }
      const start = performance.now();
      const workbook = await workbooks.generateWorkbook(
        template.key,
        Array.from({ length: 50 }, () => row),
      );
      const exportMs = performance.now() - start;
      const password = await auth.hashPassword("Runtime-Only-123!");
      const signature = jwt.sign(
        { test: true },
        "runtime-proof-only-key-not-used-by-app",
      );
      const valid = await auth.comparePassword("Runtime-Only-123!", password);
      return Response.json({
        exportBytes: workbook.length,
        exportMs,
        rows: 50,
        passwordVerified: valid,
        jwtVerified: jwt.verify(
          signature,
          "runtime-proof-only-key-not-used-by-app",
        ).test,
      });
    }
    return handleAsNodeRequest(8081, request);
  },
};

const test = require("node:test");
const assert = require("node:assert/strict");
const { safePublicUrl } = require("../Backend/services/workbooks");
test("catalog images accept public HTTPS links without uploading image bytes", () => {
  assert.equal(safePublicUrl("https://images.example.com/product.jpg"), true);
  assert.equal(
    safePublicUrl("https://cdn.example.com/image.png?version=2"),
    true,
  );
  for (const url of [
    "http://images.example.com/product.jpg",
    "https://localhost/image.png",
    "https://127.0.0.1/image.png",
    "https://192.168.1.2/image.png",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "not-a-url",
  ])
    assert.equal(safePublicUrl(url), false, url);
});

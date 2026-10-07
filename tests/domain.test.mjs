import test from "node:test";
import assert from "node:assert/strict";
import {
  parkingCost,
  plate,
  distanceKm,
  validateAttachments,
} from "../server/domain.mjs";
test("tarifa proporcional y bloques de tiempo", () => {
  assert.equal(parkingCost(800, 15), 200);
  assert.equal(parkingCost(500, 90), 750);
  for (const n of [-15, 0, 16, 241, "60", NaN])
    assert.throws(() => parkingCost(800, n));
});
test("validación de patentes argentinas", () => {
  assert.equal(plate(" ab123cd "), "AB123CD");
  assert.equal(plate("abc123"), "ABC123");
  for (const x of ["123456", "AB123C", "<script>", ""])
    assert.throws(() => plate(x));
});
test("distancia geográfica: mismo punto y simetría", () => {
  const a = { lat: -31.428, lng: -62.084 },
    b = { lat: -31.416, lng: -62.09 };
  assert.equal(distanceKm(a, a), 0);
  assert.ok(distanceKm(a, b) > 1);
  assert.equal(distanceKm(a, b), distanceKm(b, a));
});
test("adjuntos rechaza tipo, firma y cantidad incorrectos", () => {
  assert.throws(() =>
    validateAttachments([
      {
        name: "a.pdf",
        type: "application/pdf",
        data: "data:application/pdf;base64,YWJj",
      },
    ]),
  );
  assert.throws(() => validateAttachments(Array(4).fill({})));
  assert.deepEqual(validateAttachments([]), []);
  const data =
    "data:application/pdf;base64," +
    Buffer.from("%PDF-1.7 demo").toString("base64");
  assert.equal(
    validateAttachments([
      { name: "demo.pdf", type: "application/pdf", data },
    ])[0].size,
    13,
  );
});

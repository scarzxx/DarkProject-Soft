import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { getBrightnessControl } = await loadTypescript(
  new URL("../src/lib/lighting.ts", import.meta.url),
);

test("Bushido exposes only stable brightness levels and rounds imported values before apply", () => {
  for (const value of [0, 25, 50, 75, 100]) {
    assert.deepEqual(getBrightnessControl("CommonKeyboardSeries", value), { step: 25, value });
  }
  for (const [input, value] of [[1, 25], [26, 50], [27, 50], [51, 75], [76, 100]]) {
    assert.equal(getBrightnessControl("CommonKeyboardSeries", input).value, value);
  }
});

test("displayed Common brightness matches every vendor lighting packet", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/vendor-protocol-vectors.json", import.meta.url), "utf8",
  ));
  const vectors = fixture.vectors.filter(v => v.family === "common" && v.operation === "lighting");
  assert.ok(vectors.length > 0);
  for (const vector of vectors) {
    const packet = vector.packets.find(p => p.data[0] === 0x02).data;
    assert.equal(
      getBrightnessControl("CommonKeyboardSeries", vector.input.brightness).value,
      packet[9 + packet[8]] * 25,
    );
  }
});

test("other families and unknown devices keep their existing brightness values", async () => {
  const devices = JSON.parse(await readFile(
    new URL("../registry/devices.json", import.meta.url), "utf8",
  ));
  const protocols = new Set([undefined, "Unknown", ...devices.map(device => device.routerId)]);
  protocols.delete("CommonKeyboardSeries");
  for (const protocol of protocols) {
    assert.deepEqual(getBrightnessControl(protocol, 27), { step: 1, value: 27 });
  }
});

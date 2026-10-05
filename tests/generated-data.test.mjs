import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeGeneratedData } from "../scripts/import-generated-data.mjs";
import { loadTypescript } from "./load-typescript.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const source = Object.fromEntries(await Promise.all(["devices", "layouts", "protocols", "defaults"].map(async (name) =>
  [name, await readJson(`../registry/generated/${name}.generated.json`)])));
const compatibility = await readJson("../registry/layout-compatibility.json");
const registry = await loadTypescript(new URL("../src/data/registry.ts", import.meta.url));
const defaults = await loadTypescript(new URL("../src/data/defaults.ts", import.meta.url));
const picker = await loadTypescript(new URL("../src/components/DevicePicker.tsx", import.meta.url));
const { LanguageProvider } = await loadTypescript(new URL("../src/lib/i18n.tsx", import.meta.url));
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "cs" } });

test("all four generated tables reproducibly supply application metadata", async () => {
  const actual = normalizeGeneratedData(source, compatibility);
  for (const name of ["devices", "layouts", "protocols", "defaults"]) {
    assert.deepEqual(actual[name], await readJson(`../registry/${name}.json`));
  }
  for (const device of registry.DEVICE_REGISTRY) {
    const vendor = source.devices.devices.find((record) => record.SN === device.id);
    assert.equal(device.productName, vendor.productName);
    assert.equal(device.modelName, vendor.devicename);
    assert.ok(registry.PROTOCOL_REGISTRY.get(device.routerId).deviceIds.includes(device.id));
    const layout = registry.getLayout(device.styleName);
    const generated = source.layouts.layouts[device.styleName];
    assert.deepEqual(layout.keys.map((key) => key.keyMapping), generated.effectiveKeyMapping);
  }
});

test("inconsistent sources, missing defaults and conflicting geometry are rejected", () => {
  assert.throws(() => normalizeGeneratedData({ ...source, protocols: { ...source.protocols,
    meta: { generatedFromRuntimeSha256: "different" } } }, compatibility), /different vendor sources/);
  assert.throws(() => normalizeGeneratedData({ ...source, defaults: { ...source.defaults, devices: {} } }, compatibility),
    /Inconsistent device/);
  const original = source.layouts.layouts["8440US"];
  const malformed = { ...original, keys: [{ ...original.keys[0], left: 99 }, ...original.keys.slice(1)] };
  assert.throws(() => normalizeGeneratedData({ ...source, layouts: { ...source.layouts,
    layouts: { ...source.layouts.layouts, "8440US": malformed } } }, compatibility), /Conflicting geometry/);
  const duplicate = { ...source, devices: { ...source.devices, devices: [source.devices.devices[0], source.devices.devices[0]] } };
  assert.throws(() => normalizeGeneratedData(duplicate, compatibility), /duplicate vendor device/);
});

test("Bushido preview uses vendor defaults and legacy slots without mutating the source", async () => {
  const id = "0x342D0xE40F012";
  const preview = await defaults.getDefaultProfile(id, 0);
  const vendor = source.defaults.devices.DPKB_BUSHIDO_87_ANSI.deviceData.profile[0];
  assert.equal(preview.lighting.effect, vendor.LightingIndex);
  assert.equal(preview.lighting.speed, 70);
  assert.deepEqual(preview.lighting.color, [255, 0, 0]);
  assert.equal(preview.performance.pollingRate, 125);
  assert.equal(preview.keyBindings.length, 86);
  const slot = registry.getLayout("8440US").slotMapping.KeyA;
  assert.deepEqual(preview.keyBindings.find((binding) => binding.slot === slot), { slot, kind: 1, code: 4 });
  preview.lighting.color[0] = 0;
  assert.equal((await defaults.getDefaultProfile(id, 0)).lighting.color[0], 255);
  await assert.rejects(() => defaults.getDefaultProfile(id, -1), /Invalid vendor default/);
  await assert.rejects(() => defaults.getDefaultProfile(id, 3), /Invalid vendor default/);
  await assert.rejects(() => defaults.getDefaultProfile("unknown", 0), /Invalid vendor default/);
  const anomalous = registry.DEVICE_REGISTRY.find((device) => device.sourceId === "ALU85A");
  assert.equal(registry.getLayout(anomalous.styleName).keys.length, 68);
  assert.equal(source.defaults.devices.ALU85A.deviceData.profile[0].Keybinding.length, 97);
  assert.deepEqual((await defaults.getDefaultProfile(anomalous.id, 0)).keyBindings, []);
});

test("device picker searches models and USB IDs and renders a localized accessible trigger", () => {
  const devices = registry.DEVICE_REGISTRY.map(registry.previewDevice);
  assert.equal(picker.filterDevices(devices, "bushido ansi").length, 2);
  assert.equal(picker.filterDevices(devices, "0x342d bushido iso").length, 1);
  assert.equal(picker.filterDevices(devices, "does-not-exist").length, 0);
  assert.equal(picker.filterDevices(devices, "  ").length, 45);
  const generic = devices.find((device) => device.productName === "USB KEYBOARD");
  assert.equal(picker.deviceLabel(generic), "KD98UK");
  assert.equal(picker.deviceLabel({ ...generic, registryId: null, productName: "Unknown keyboard" }), "Unknown keyboard");
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(picker.default, { devices, selectedId: "0x342D0xE40F012", disabled: false, onSelect: () => {} })));
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes("BUSHIDO 87 ANSI"));
  assert.ok(html.includes('aria-label="Klávesnice"'));
  assert.ok(!html.includes("<select"));
});

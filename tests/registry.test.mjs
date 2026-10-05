import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extractMetadata } from "../scripts/extract-vendor-metadata.mjs";
import { loadTypescript } from "./load-typescript.mjs";

const registry = await loadTypescript(new URL("../src/data/registry.ts", import.meta.url));
const keyboard = await loadTypescript(new URL("../src/data/keyboard.ts", import.meta.url));
const { default: KeyboardView } = await loadTypescript(new URL("../src/components/KeyboardView.tsx", import.meta.url));
const { LanguageProvider } = await loadTypescript(new URL("../src/lib/i18n.tsx", import.meta.url));
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => "en" },
});

test("all registered models have exact, unique layout identities and complete geometry", () => {
  assert.equal(registry.DEVICE_REGISTRY.length, 45);
  assert.equal(registry.LAYOUT_REGISTRY.size, 17);
  assert.equal(new Set(registry.DEVICE_REGISTRY.map((d) => d.id)).size, 45);
  assert.equal(new Set(registry.DEVICE_REGISTRY.map((d) => d.routerId)).size, 7);
  for (const device of registry.DEVICE_REGISTRY) {
    assert.ok(registry.getLayout(device.styleName));
    assert.ok(device.profiles > 0);
    assert.ok(device.connections.every((c) => c.transport !== "Bootloader"));
    assert.equal(registry.hasSupportedDriver(device), true);
  }
  for (const layout of registry.LAYOUT_REGISTRY.values()) {
    assert.match(layout.width, /^\d*\.?\d+rem$/);
    assert.match(layout.height, /^\d*\.?\d+rem$/);
    assert.ok(["layout", "embeddedStylesheet"].includes(layout.canvasSource));
    assert.equal(new Set(layout.keys.map((key) => key.keyMapping)).size, layout.keys.length);
    for (const key of layout.keys) {
      for (const field of ["left", "top", "width", "height"]) {
        assert.match(key[field], /^\d*\.?\d+%$/);
      }
      assert.ok(parseFloat(key.width) > 0 && parseFloat(key.height) > 0);
    }
  }
});

test("inherited canvas dimensions come from vendor CSS, not renderer guesses", () => {
  const inherited = [...registry.LAYOUT_REGISTRY.values()].filter((layout) =>
    layout.canvasSource === "embeddedStylesheet");
  assert.deepEqual(inherited.map((layout) => layout.styleName),
    ["HFD81US", "WITMOD68US", "WITMOD69UK", "WITMOD83UK", "WITMOD83US"]);
  for (const layout of inherited) {
    assert.equal(layout.width, "8.352rem");
    assert.equal(layout.height, "3.6rem");
  }
});

test("all known models are supported while feature exposure stays family-specific", () => {
  assert.equal(registry.DRIVER_CAPABILITIES.size, 7);
  for (const device of registry.DEVICE_REGISTRY) {
    const preview = registry.previewDevice(device);
    assert.equal(preview.supported, true);
    assert.equal(preview.connected, false);
    assert.equal(preview.styleName, device.styleName);
    assert.equal(preview.advertisedCapabilities, device.capabilities);
  }
  const witmod = registry.DEVICE_REGISTRY.find((device) => device.routerId === "WitmodSeries");
  const witmodPreview = registry.previewDevice(witmod);
  assert.equal(registry.supportsProfileState(witmod), false);
  assert.equal(witmodPreview.capabilities.lighting, witmod.capabilities.lighting);
  assert.equal(witmodPreview.capabilities.snapTap, witmod.capabilities.snapTap);
  assert.equal(witmodPreview.capabilities.keybindings, false);
  assert.equal(witmodPreview.capabilities.macros, false);
  assert.equal(witmodPreview.capabilities.profiles, false);

  const bushido = registry.DEVICE_REGISTRY.find((device) => device.productName === "DPKB_BUSHIDO_87_ANSI");
  assert.equal(registry.supportsProfileState(bushido), true);
  for (const field of ["tft", "sync", "actuation"])
    assert.equal(registry.previewDevice(bushido).capabilities[field], false);
});

test("Bushido matrix slots preserve the previous firmware mapping and Fn slot", async () => {
  const keys = keyboard.getKeyboardKeys("8440US");
  assert.equal(keys.length, 87);
  assert.equal(keys.find((k) => k.id === "Custom_Fnkey").slot, 71);
  const baseline = JSON.parse(await readFile(new URL("./fixtures/bushido-slots.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.fromEntries(keys.filter((k) => k.hid > 0).map((k) => [k.hid, k.slot])), baseline);
  assert.equal(keyboard.getHidOptions(keys).length, 86);
  assert.equal(keyboard.keyHid("UnknownKey"), 0);
  assert.equal(keyboard.keyHid("KeyA"), 4);
  assert.equal(keyboard.keyHid("Numpad9"), 97);
  assert.equal(keyboard.getKeyboardKeys("8440US"), keys);
});

test("renderer preserves every vendor coordinate across all styles, including ISO", () => {
  for (const layout of registry.LAYOUT_REGISTRY.values()) {
    const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
      React.createElement(KeyboardView, { styleName: layout.styleName, color: [100, 20, 40] })));
    assert.equal((html.match(/class="keycap /g) ?? []).length, layout.keys.length);
    for (const key of layout.keys) {
      const title = key.keyMapping.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      assert.ok(html.includes(`title="${title}"`));
      assert.ok(html.includes(`left:${key.left};top:${key.top};width:${key.width};height:${key.height}`));
    }
  }
  assert.equal(keyboard.getKeyboardKeys("DPONE87ISO").length, 88);
  assert.equal(keyboard.getKeyboardKeys("KD98UK").length, 97);
  assert.equal(keyboard.getKeyboardKeys("HFD81US").length, 81);
});

test("unknown models/styles are inert and never inherit Bushido geometry", () => {
  assert.equal(registry.getLayout(null), undefined);
  assert.equal(registry.getLayout("unknown"), undefined);
  assert.equal(registry.getDeviceMetadata("unknown"), undefined);
  assert.deepEqual(keyboard.getKeyboardKeys("unknown"), []);
  assert.deepEqual(keyboard.getKeyboardKeys(null), []);
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(KeyboardView, { styleName: null, color: [0, 0, 0] })));
  assert.ok(html.includes("empty-state"));
  assert.ok(!html.includes("keycap"));
});

test("Bushido HID packet implementation is unchanged after moving into common driver", async () => {
  const source = (await readFile(new URL("../src-tauri/src/drivers/common.rs", import.meta.url), "utf8"))
    .replaceAll("\r\n", "\n")
    .replace("use super::transport::HidTransport;\n", "")
    .replace("pub struct Keyboard<T: HidTransport = HidDevice>", "pub struct Keyboard")
    .replace("pub(super) device: T", "device: HidDevice")
    .replace("impl Keyboard<HidDevice>", "impl Keyboard")
    .replace("}\n\nimpl<T: HidTransport> Keyboard<T> {\n", "")
    .replace("self.device.delay(20);", "thread::sleep(Duration::from_millis(20));");
  assert.equal(createHash("sha256").update(source).digest("hex"),
    "6db77e11c707d50a0bbe806e12b5d2035cfc805b9c0e78fd21b2e43009e3b1f1");
});

const fixture = `class Vendor { AllDevice = [{
  SN:"model1", devicename:"TEST", routerID:"WitmodSeries", ModelType:2,
  StateList:[{vid:"0x1234",pid:"0x5678",StateType:"USB"},{vid:1,pid:2,StateType:"Bootloader"}],
  set:[{usagepage:"0xFF01",usage:"1"}],
  deviceInfo:{HardwareName:"TEST",DisplayName:"Test",StyleName:"TESTSTYLE",
    HardwareProfileNum:1,FnNums:0,LightingFlag:!0,LightingData:[8],
    SnapTapFlag:!1,MacroMaxRepeatNumber:1,PerformanceFlag:!1,TFTFlag:!1,SyncFlag:!1,Actuation:!1}
}]; TESTSTYLE={width:"8rem",height:"3rem",keyMapping:["KeyA"],
  ItemCss:[{left:" 1% ",top:"2%",width:"3%",height:"4%"}]}; }`;

test("extractor emits only technical metadata and never executes vendor code", () => {
  const result = extractMetadata(`${fixture}; throw new Error("Never execute this");`);
  assert.equal(result.devices.length, 1);
  assert.equal(result.devices[0].vendorId, 0x1234);
  assert.equal(result.devices[0].verified, false);
  assert.equal(result.devices[0].connections.length, 1);
  assert.equal(result.layouts[0].keys[0].left, "1%");
  assert.equal(result.layouts[0].keys[0].keyMapping, "KeyA");
  assert.deepEqual(extractMetadata(fixture), extractMetadata(fixture));
  assert.throws(() => extractMetadata(fixture.replace('SN:"model1"', 'SN:execute()')),
    /Executable expressions/);
  assert.throws(() => extractMetadata(fixture.replace('height:"4%"', 'height:"auto"')),
    /Unsupported geometry/);
  assert.throws(() => extractMetadata(fixture.replace('["KeyA"]', '[]')),
    /mapping length/);
  assert.throws(() => extractMetadata("const data = [];"), /No vendor device registry/);
});

test("extractor derives the canonical inherited canvas and rejects ambiguous defaults", () => {
  const inheritedFixture = fixture.replace('width:"8rem",height:"3rem",', "");
  const stylesheet = 'const css=".keyboard-content .keyboad-position{width:9rem;height:4rem}";'
    + 'const responsive="@media(max-width:1000px){.keyboard-content .keyboad-position{width:703px;height:303px}}";';
  const result = extractMetadata(inheritedFixture + stylesheet);
  assert.equal(result.layouts[0].width, "9rem");
  assert.equal(result.layouts[0].height, "4rem");
  assert.equal(result.layouts[0].canvasSource, "embeddedStylesheet");
  assert.equal(extractMetadata(fixture + stylesheet).layouts[0].width, "8rem");
  assert.throws(() => extractMetadata(inheritedFixture), /Missing or ambiguous vendor canvas/);
  assert.throws(() => extractMetadata(inheritedFixture + stylesheet
    + 'const conflict=".keyboad-position{width:10rem;height:4rem}";'),
    /Missing or ambiguous vendor canvas/);
});

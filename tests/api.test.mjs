import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const api = await loadTypescript(new URL("../src/lib/api.ts", import.meta.url));
const verifiedId = "0x342D0xE40F012";

test("browser preview reads Bushido profiles and refuses every unverified model", async () => {
  const devices = await api.listDevices();
  assert.equal(devices.length, 45);
  assert.equal((await api.scanDevice()).registryId, verifiedId);
  assert.equal((await api.readProfile(1, verifiedId)).profile, 1);
  for (const device of devices.filter((device) => !device.verified)) {
    assert.equal((await api.scanDevice(device.id)).verified, false);
    const commands = [
      () => api.readProfile(0, device.id),
      () => api.switchProfile(0, device.id),
      () => api.applyLighting(0, {}, device.id),
      () => api.applyPerformance(0, {}, device.id),
      () => api.applySnapTap(0, false, [], device.id),
      () => api.applyKeyBinding(0, 1, {}, device.id),
      () => api.writeMacro(1, [], device.id),
    ];
    for (const command of commands) await assert.rejects(command, /unverified/);
  }
  await assert.rejects(() => api.scanDevice("unknown"), /no longer connected/);
  await assert.rejects(() => api.scanDevice(""), /no longer connected/);
});

test("a disconnected native selection never falls back to another device", async () => {
  const calls = [];
  const previous = globalThis.window;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, payload) => {
        calls.push({ command, payload });
        throw new Error("Selected device is no longer connected");
      },
    },
  };
  try {
    await assert.rejects(() => api.scanDevice("disconnected-hid-path"), /no longer connected/);
    assert.deepEqual(calls, [{ command: "scan_device", payload: { deviceId: "disconnected-hid-path" } }]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("native commands keep their original payload and target the selected HID path", async () => {
  const calls = [];
  const previous = globalThis.window;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, payload) => {
        calls.push({ command, payload });
        if (command === "scan_devices") return [];
        if (command === "read_profile") return { profile: payload.profile };
        return { id: payload.deviceId };
      },
    },
  };
  try {
    assert.deepEqual(await api.listDevices(), []);
    assert.equal((await api.scanDevice("selected-hid-path")).id, "selected-hid-path");
    assert.equal((await api.readProfile(2, "selected-hid-path")).profile, 2);
    await api.switchProfile(2, "selected-hid-path");
    const settings = { effect: 8, brightness: 80, speed: 50, direction: 0, color: [1, 2, 3], multiColor: false };
    await api.applyLighting(2, settings, "selected-hid-path");
    const performance = { pollingRate: 1000, inputLatency: 2, debounce: 5, sleepTime: 0 };
    await api.applyPerformance(2, performance, "selected-hid-path");
    const pairs = [{ kind: 0, key1: 4, key2: 7 }];
    await api.applySnapTap(2, true, pairs, "selected-hid-path");
    const patch = { slot: 71, kind: 1, code: 4 };
    await api.applyKeyBinding(2, 2, patch, "selected-hid-path");
    const events = [{ hid: 4, pressed: true, delay: 25 }];
    await api.writeMacro(1, events, "selected-hid-path");
    assert.deepEqual(calls, [
      { command: "scan_devices", payload: {} },
      { command: "scan_device", payload: { deviceId: "selected-hid-path" } },
      { command: "read_profile", payload: { profile: 2, deviceId: "selected-hid-path" } },
      { command: "switch_profile", payload: { profile: 2, deviceId: "selected-hid-path" } },
      { command: "apply_lighting", payload: { profile: 2, settings, deviceId: "selected-hid-path" } },
      { command: "apply_performance", payload: { profile: 2, settings: performance, deviceId: "selected-hid-path" } },
      { command: "apply_snap_tap", payload: { profile: 2, enabled: true, pairs, deviceId: "selected-hid-path" } },
      { command: "apply_key_binding", payload: { profile: 2, layer: 2, patch, deviceId: "selected-hid-path" } },
      { command: "write_macro", payload: { macroId: 1, events, deviceId: "selected-hid-path" } },
    ]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

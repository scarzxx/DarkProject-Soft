import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const tray = await loadTypescript(new URL("../src/lib/tray.ts", import.meta.url));

test("browser preview never claims it can hide to the native tray", async () => {
  assert.equal(tray.supportsTray(), false);
  assert.equal(await tray.getCloseToTray(), false);
  await tray.setTrayLanguage("cs");
  await assert.rejects(tray.hideToTray, /desktop app only/);
  await assert.rejects(() => tray.setCloseToTray(true), /desktop app only/);
});

test("tray preferences and actions use native commands and propagate save failures", async () => {
  const previous = globalThis.window;
  const calls = [];
  globalThis.window = { __TAURI_INTERNALS__: { invoke: async (command, payload) => {
    calls.push({command,payload});
    if (command === "get_close_to_tray") return true;
    if (command === "set_close_to_tray" && !payload.enabled) throw new Error("Access denied");
  } } };
  try {
    assert.equal(tray.supportsTray(), true);
    assert.equal(await tray.getCloseToTray(), true);
    await tray.setCloseToTray(true);
    await tray.setTrayLanguage("sk");
    await tray.hideToTray();
    await assert.rejects(() => tray.setCloseToTray(false), /Access denied/);
    assert.deepEqual(calls, [
      {command:"get_close_to_tray",payload:{}},
      {command:"set_close_to_tray",payload:{enabled:true}},
      {command:"set_tray_language",payload:{language:"sk"}},
      {command:"hide_to_tray",payload:{}},
      {command:"set_close_to_tray",payload:{enabled:false}},
    ]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

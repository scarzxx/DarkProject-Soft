import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const read = (path) => fs.readFileSync(path, "utf8");

test("unconfigured builds skip the updater plugin and configured checks remain coalesced", async () => {
  const updater = await loadTypescript(new URL("../src/lib/updater.ts", import.meta.url));
  const previous = globalThis.window;
  const calls = [];
  let configured = false;
  globalThis.window = { __TAURI_INTERNALS__: { invoke: async (command) => {
    calls.push(command);
    if (command === "updater_configured") return configured;
    if (command === "plugin:updater|check") return null;
    throw new Error(`Unexpected command: ${command}`);
  } } };
  try {
    const results = await Promise.allSettled([updater.checkForUpdate(), updater.checkForUpdate()]);
    assert.ok(results.every(result => result.status === "rejected"
      && result.reason.message === "Updater is not configured in this build."));
    assert.deepEqual(calls, ["updater_configured"]);
    calls.length = 0;
    configured = true;
    assert.deepEqual(await Promise.all([updater.checkForUpdate(), updater.checkForUpdate()]), [null, null]);
    assert.deepEqual(calls, ["updater_configured", "plugin:updater|check"]);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test("desktop settings expose automatic and manual updater controls", () => {
  const settings = read("src/components/PreferencesOverlay.tsx");
  assert.match(settings, /Automatically check for updates/);
  assert.match(settings, /downloadAndInstall/);
  assert.match(settings, /restartAfterInstall: true/);
  assert.match(settings, /AUTO_CHECK_SESSION_KEY/);
});

test("Tauri updater is registered and permitted", () => {
  const rust = read("src-tauri/src/lib.rs");
  const cargo = read("src-tauri/Cargo.toml");
  const capability = JSON.parse(read("src-tauri/capabilities/default.json"));
  assert.match(rust, /tauri_plugin_updater::Builder::new\(\)\.build\(\)/);
  assert.match(cargo, /tauri-plugin-updater\s*=\s*"2\.12\.0"/);
  assert.ok(capability.permissions.includes("updater:default"));
});

test("main builds downloadable Windows artifacts and tags publish signed updater releases", () => {
  const build = read(".github/workflows/build.yml");
  const release = read(".github/workflows/release.yml");
  assert.match(build, /--bundles msi,nsis/);
  assert.match(build, /src-tauri\/target\/release\/dark-control\.exe/);
  assert.match(build, /actions\/upload-artifact@v4/);
  assert.match(release, /tauri-apps\/tauri-action@v1/);
  assert.match(release, /createUpdaterArtifacts = \$true/);
  assert.match(release, /uploadUpdaterJson: true/);
  assert.match(release, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(release, /TAURI_SIGNING_PUBLIC_KEY/);
});

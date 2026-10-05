import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const read = (path) => fs.readFileSync(path, "utf8");

test("GitHub release version comparison handles stable and prerelease versions", async () => {
  const updater = await loadTypescript(new URL("../src/lib/updater.ts", import.meta.url));
  assert.equal(updater.isNewerVersion("0.4.1", "0.4.0"), true);
  assert.equal(updater.isNewerVersion("v0.5.0", "0.4.99"), true);
  assert.equal(updater.isNewerVersion("0.4.0", "0.4.0"), false);
  assert.equal(updater.isNewerVersion("0.4.0-beta.2", "0.4.0"), false);
  assert.equal(updater.isNewerVersion("0.4.1-beta.1", "0.4.0"), true);
});

test("desktop settings expose automatic and manual GitHub Release update controls", () => {
  const settings = read("src/components/PreferencesOverlay.tsx");
  const updater = read("src/lib/updater.ts");
  assert.match(settings, /Automatically check for updates/);
  assert.match(settings, /installGitHubUpdate/);
  assert.match(settings, /AUTO_CHECK_SESSION_KEY/);
  assert.match(updater, /api\.github\.com\/repos\/scarzxx\/DarkProject-Soft\/releases\/latest/);
  assert.match(updater, /install_github_release/);
  assert.doesNotMatch(settings, /downloadAndInstall/);
});

test("native updater only launches installers from this repository's GitHub Releases", () => {
  const rust = read("src-tauri/src/updater.rs");
  const lib = read("src-tauri/src/lib.rs");
  const capability = JSON.parse(read("src-tauri/capabilities/default.json"));
  assert.match(rust, /https:\/\/github\.com\/scarzxx\/DarkProject-Soft\/releases\/download\//);
  assert.match(rust, /install_github_release/);
  assert.match(lib, /updater::install_github_release/);
  assert.doesNotMatch(lib, /tauri_plugin_updater::Builder/);
  assert.ok(!capability.permissions.includes("updater:default"));
});

test("main builds Windows artifacts and tags publish ordinary GitHub Releases without signing keys", () => {
  const build = read(".github/workflows/build.yml");
  const release = read(".github/workflows/release.yml");
  assert.match(build, /--bundles msi,nsis/);
  assert.match(build, /src-tauri\/target\/release\/dark-control\.exe/);
  assert.match(build, /actions\/upload-artifact@v4/);
  assert.match(release, /softprops\/action-gh-release@v3/);
  assert.match(release, /Dark-Control-\$tag-Windows-x64-setup\.exe/);
  assert.match(release, /SHA256SUMS\.txt/);
  assert.doesNotMatch(release, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.doesNotMatch(release, /TAURI_SIGNING_PUBLIC_KEY/);
  assert.doesNotMatch(release, /createUpdaterArtifacts/);
});

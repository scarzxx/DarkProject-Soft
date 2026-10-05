import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/extract-release-notes.mjs", import.meta.url));

function fixture(changelog) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dark-control-changelog-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.4.3" }), "utf8");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), changelog, "utf8");
  return dir;
}

test("release notes contain only the requested changelog section", () => {
  const dir = fixture(`# Changelog\n\n## 0.4.3\n\n- Nový design.\n- Opraven updater.\n\n## 0.4.2\n\n- Starší změna.\n`);
  const result = spawnSync(process.execPath, [script, "0.4.3", "notes.md"], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dir, "notes.md"), "utf8"), "- Nový design.\n- Opraven updater.\n");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("release note extraction fails when the current version has no changelog entry", () => {
  const dir = fixture(`# Changelog\n\n## 0.4.2\n\n- Starší změna.\n`);
  const result = spawnSync(process.execPath, [script, "0.4.3", "notes.md"], { cwd: dir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not contain a section for 0\.4\.3/);
  fs.rmSync(dir, { recursive: true, force: true });
});

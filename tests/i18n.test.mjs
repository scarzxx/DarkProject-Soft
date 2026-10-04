import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import {
  MESSAGES,
  resolveLanguage,
  translate,
  translateError,
} from "../src/lib/messages.ts";

test("every translation preserves its template parameters", () => {
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1]).sort();
  for (const [key, translations] of Object.entries(MESSAGES)) {
    for (const language of ["cs", "sk"]) {
      assert.ok(translations[language].trim(), `${language}: ${key}`);
      assert.deepEqual(placeholders(translations[language]), placeholders(key));
    }
  }
});

test("stored preferences take priority over regional browser languages", () => {
  assert.equal(resolveLanguage("sk", "cs-CZ"), "sk");
  assert.equal(resolveLanguage("en", "sk-SK"), "en");
  assert.equal(resolveLanguage(null, "CS-cz"), "cs");
  assert.equal(resolveLanguage(null, "sk_SK"), "sk");
  assert.equal(resolveLanguage("invalid", "sk-SK"), "sk");
  assert.equal(resolveLanguage(null, "de-DE"), "en");
});

test("profile labels and operation messages can switch language from the same state", () => {
  const key = "Switching to Profile {number}";
  const parameters = { number: 3 };
  assert.equal(translate("cs", key, parameters), "Přepínám na profil 3");
  assert.equal(translate("sk", key, parameters), "Prepínam na profil 3");
  assert.equal(translate("en", key, parameters), "Switching to Profile 3");
  assert.equal(translate("cs", "Profile {number}", { number: 0 }), "Profil 0");
  assert.equal(translate("en", "Profile {number}"), "Profile {number}");
});

test("interpolation treats supplied values as literal text", () => {
  assert.equal(
    translate("cs", "Completed: {operation}", { operation: "$& {number}" }),
    "Dokončeno: $& {number}",
  );
});

test("backend errors translate without losing diagnostics", () => {
  assert.equal(
    translateError("cs", "No supported Dark Project keyboard found"),
    "Nebyla nalezena podporovaná klávesnice Dark Project",
  );
  assert.equal(translateError("sk", "Invalid key slot 91"), "Neplatná pozícia klávesu 91");
  assert.equal(translateError("cs", "HID error: OS code 5"), "Chyba HID: OS code 5");
  assert.equal(translateError("en", "Invalid key slot 91"), "Invalid key slot 91");
  assert.equal(translateError("cs", "Unknown driver diagnostic"), "Unknown driver diagnostic");
  assert.equal(translateError("cs", "constructor"), "constructor");
});

test("screen text and tooltips are rendered through React translations", async () => {
  const allowedText = new Set(["DARK", "CONTROL", "DARK PROJECT", "VID 0x", "PID 0x"]);
  const files = ["App.tsx", "components/ColorPicker.tsx", "components/PreferencesOverlay.tsx"];
  for (const file of files) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function inspect(node) {
      if (ts.isJsxText(node)) {
        const text = node.text.trim();
        if (/[a-z]{3}/i.test(text)) {
          assert.ok(allowedText.has(text), `${file}: untranslated JSX text: ${text}`);
        }
      }
      if (ts.isJsxAttribute(node) && ["title", "aria-label", "placeholder"].includes(node.name.text)) {
        assert.ok(
          !node.initializer || !ts.isStringLiteral(node.initializer)
            || node.initializer.text === "Bushido 87 ANSI",
          `${file}: untranslated attribute: ${node.getText(tree)}`,
        );
      }
      ts.forEachChild(node, inspect);
    }
    inspect(tree);
  }
});

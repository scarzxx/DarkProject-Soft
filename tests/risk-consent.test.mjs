import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypescript } from "./load-typescript.mjs";

const consent = await loadTypescript(new URL("../src/lib/riskConsent.ts", import.meta.url));
const { default: App } = await loadTypescript(new URL("../src/App.tsx", import.meta.url));
const { LanguageProvider } = await loadTypescript(new URL("../src/lib/i18n.tsx", import.meta.url));

test("first launch requires consent; reopening after acceptance skips the notice", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }});
  const render = () => renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(App)));
  try {
    assert.equal(consent.hasRiskConsent(), false);
    assert.match(render(), /id="risk-title"/);
    assert.equal(values.has(consent.RISK_CONSENT_KEY), false);
    consent.rememberRiskConsent();
    assert.equal(consent.hasRiskConsent(), true);
    assert.doesNotMatch(render(), /id="risk-title"/);
    localStorage.setItem("dark-control.language", "sk");
    assert.doesNotMatch(render(), /id="risk-title"/);
    localStorage.setItem(consent.RISK_CONSENT_KEY, "outdated-notice");
    assert.equal(consent.hasRiskConsent(), false);
    assert.match(render(), /id="risk-title"/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

test("unavailable storage never fabricates remembered consent or crashes acceptance", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousError = console.error;
  const errors = [];
  Object.defineProperty(globalThis, "localStorage", {configurable:true, get() { throw new Error("Storage blocked"); }});
  console.error = (...args) => errors.push(args);
  try {
    assert.equal(consent.hasRiskConsent(), false);
    assert.doesNotThrow(consent.rememberRiskConsent);
    assert.equal(errors.length, 2);
  } finally {
    console.error = previousError;
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

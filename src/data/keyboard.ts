import { getLayout } from "./registry";
import type { LayoutKey } from "./registry";

export interface KeyDef extends LayoutKey {
  id: string;
  label: string;
  hid: number;
  slot?: number;
}

const HID_BY_KEY: Readonly<Record<string, number>> = {
  Escape: 41, Backquote: 53, Minus: 45, Equal: 46, Backspace: 42,
  Tab: 43, CapsLock: 57, Enter: 40, Space: 44, BracketLeft: 47,
  BracketRight: 48, Backslash: 49, Hash: 50, IntlBackslash: 100, IntlRo: 135,
  IntlYen: 137, Semicolon: 51, Quote: 52, Comma: 54, Period: 55, Slash: 56,
  PrintScreen: 70, ScrollLock: 71, Pause: 72, Insert: 73, Home: 74,
  PageUp: 75, Delete: 76, End: 77, PageDown: 78, ArrowRight: 79,
  ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82, NumLock: 83,
  NumpadDivide: 84, NumpadMultiply: 85, NumpadSubtract: 86, NumpadAdd: 87,
  NumpadEnter: 88, Numpad0: 98, NumpadDecimal: 99, Menu: 101,
  ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227,
  ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231,
};
const LABELS: Readonly<Record<string, string>> = {
  Escape: "Esc", Backquote: "~", Minus: "-", Equal: "+", Tab: "Tab",
  CapsLock: "Caps", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Hash: "#",
  PrintScreen: "Print", ScrollLock: "Scrl", Insert: "Ins", Delete: "Del",
  PageUp: "PgUp", PageDown: "PgDn", Space: "", Custom_Fnkey: "Fn",
  ControlLeft: "Ctrl", ControlRight: "Ctrl", ShiftLeft: "Shift",
  ShiftRight: "Shift", AltLeft: "Alt", AltRight: "Alt", MetaLeft: "Win",
  MetaRight: "Win", Menu: "Menu", ArrowLeft: "\u2190", ArrowRight: "\u2192",
  ArrowUp: "\u2191", ArrowDown: "\u2193",
};

/** Convert physical browser key names to USB HID usage IDs. Unknown keys return 0. */
export function keyHid(id: string): number {
  if (/^Key[A-Z]$/.test(id)) return id.charCodeAt(3) - 61;
  if (/^Digit[0-9]$/.test(id)) return id === "Digit0" ? 39 : +id[5] + 29;
  if (/^F([1-9]|1[0-2])$/.test(id)) return +id.slice(1) + 57;
  if (/^Numpad[1-9]$/.test(id)) return +id[6] + 88;
  return HID_BY_KEY[id] ?? 0;
}

const KEYS_BY_STYLE = new Map<string, readonly KeyDef[]>();

/** Build keys once per style from vendor coordinates and matrix identities. */
export function getKeyboardKeys(styleName: string | null): readonly KeyDef[] {
  if (styleName === null) return [];
  const cached = KEYS_BY_STYLE.get(styleName);
  if (cached) return cached;
  const layout = getLayout(styleName);
  if (!layout) return [];
  const keys = layout.keys.map((key) => ({
    ...key,
    id: key.keyMapping,
    label: LABELS[key.keyMapping] ?? key.keyMapping.replace(/^(Key|Digit|Numpad)/, ""),
    hid: keyHid(key.keyMapping),
    slot: layout.slotMapping[key.keyMapping],
  }));
  KEYS_BY_STYLE.set(styleName, keys);
  return keys;
}

/** Provide assignable physical keys for the selected layout, without duplicate usages. */
export function getHidOptions(keys: readonly KeyDef[]): { label: string; hid: number }[] {
  const options = new Map<number, { label: string; hid: number }>();
  for (const key of keys) {
    if (key.hid > 0 && !options.has(key.hid)) {
      options.set(key.hid, { label: key.id.replace(/^Key/, ""), hid: key.hid });
    }
  }
  return [...options.values()];
}

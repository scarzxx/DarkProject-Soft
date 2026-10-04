import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  Gauge,
  Info,
  Keyboard as KeyboardIcon,
  Layers3,
  Lightbulb,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import ColorPicker from "./components/ColorPicker";
import KeyboardView from "./components/KeyboardView";
import { Panel, Slider, Toggle } from "./components/Ui";
import { EFFECTS, EFFECT_NAME } from "./data/effects";
import { FN_SLOT, HID_OPTIONS, ROWS, SLOT_BY_HID, type KeyDef } from "./data/keyboard";
import * as api from "./lib/api";
import { useLanguage } from "./lib/i18n";
import { translateError } from "./lib/messages";
import type { MessageKey, MessageParameters } from "./lib/messages";
import type {
  DeviceSummary,
  LightingSettings,
  MacroEvent,
  Page,
  PerformanceSettings,
  ProfileState,
  SnapPair,
} from "./lib/types";

const DEF_LIGHT: LightingSettings = { effect: 8, brightness: 100, speed: 75, direction: 0, color: [148, 5, 57], multiColor: false };
const DEF_PERF: PerformanceSettings = { pollingRate: 1000, inputLatency: 2, debounce: 5, sleepTime: 0 };
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const parseHex = (s: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : null;
};
const keyName = (hid: number) => ROWS.flat().find((k) => k.hid === hid)?.id ?? `HID_${hid}`;
const keyHid = (name: unknown, fallback: number) => typeof name === "string"
  ? (ROWS.flat().find((k) => k.id === name)?.hid ?? fallback)
  : (typeof name === "number" ? name : fallback);

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-title">
    <div><h2>{title}</h2><p>{subtitle}</p></div>
    {action && <div className="page-actions">{action}</div>}
  </div>;
}

type StatusMessage =
  | { key: MessageKey; parameters?: MessageParameters; completed?: boolean }
  | { error: string };

export default function App() {
  const { language, t } = useLanguage();
  const [page, setPage] = useState<Page>("device");
  const [device, setDevice] = useState<DeviceSummary | null>(null);
  const [profile, setProfile] = useState(0);
  const [state, setState] = useState<ProfileState | null>(null);
  const [lighting, setLighting] = useState<LightingSettings>(DEF_LIGHT);
  const [performance, setPerformance] = useState<PerformanceSettings>(DEF_PERF);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapPairs, setSnapPairs] = useState<SnapPair[]>([]);
  const [selectedKey, setSelectedKey] = useState<KeyDef | null>(null);
  const [layer, setLayer] = useState(1);
  const [mappingKind, setMappingKind] = useState(1);
  const [mappingCode, setMappingCode] = useState(4);
  const [macros, setMacros] = useState<Array<{ id: number; name: string; events: MacroEvent[] }>>([]);
  const [activeMacro, setActiveMacro] = useState<number | null>(null);
  const [busy, setBusy] = useState<StatusMessage | null>(null);
  const [status, setStatus] = useState<StatusMessage>({ key: "Starting…" });
  const [hexValue, setHexValue] = useState(hex(DEF_LIGHT.color));
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (label: Exclude<StatusMessage, { error: string }>, fn: () => Promise<void>) => {
    setBusy(label);
    setStatus(label);
    try {
      await fn();
      setStatus({ ...label, completed: true });
    } catch (e) {
      console.error(e);
      setStatus({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const hydrate = (s: ProfileState) => {
    setState(s);
    setLighting(s.lighting);
    setPerformance(s.performance);
    setSnapEnabled(s.snapTapEnabled);
    setSnapPairs(s.snapTapPairs);
    setHexValue(hex(s.lighting.color));
    const loaded = s.macros.map((m) => ({ id: m.id, name: `Macro ${m.id}`, events: m.events }));
    setMacros(loaded);
    setActiveMacro((current) => loaded.some((m) => m.id === current) ? current : (loaded[0]?.id ?? null));
  };

  const readBack = async (p = profile) => {
    const s = await api.readProfile(p);
    hydrate(s);
  };

  const loadDevice = () => run({ key: "Reading keyboard" }, async () => {
    const d = await api.scanDevice();
    const p = Math.max(0, Math.min(d.profiles - 1, d.activeProfile ?? 0));
    const s = await api.readProfile(p);
    setDevice(d);
    setProfile(p);
    hydrate(s);
  });

  useEffect(() => { void loadDevice(); }, []);

  useEffect(() => {
    if (page === "performance" && device && !device.capabilities.performance) setPage("device");
  }, [device, page]);

  const changeProfile = (p: number) => run({ key: "Switching to Profile {number}", parameters: { number: p + 1 } }, async () => {
    await api.switchProfile(p);
    await delay(90);
    setProfile(p);
    setSelectedKey(null);
    await readBack(p);
  });

  const caps = device?.capabilities;
  const nav = useMemo(() => {
    const items: Array<{ id: Page; label: MessageKey; icon: typeof Cpu }> = [{ id: "device", label: "Device", icon: Cpu }];
    if (!caps || caps.lighting) items.push({ id: "lighting", label: "Lighting", icon: Lightbulb });
    if (!caps || caps.keybindings) items.push({ id: "keybinds", label: "Keybindings", icon: KeyboardIcon });
    if (!caps || caps.snapTap) items.push({ id: "snaptap", label: "Snap Tap", icon: Zap });
    if (!caps || caps.macros) items.push({ id: "macros", label: "Macros", icon: Play });
    if (caps?.performance) items.push({ id: "performance", label: "Performance", icon: Gauge });
    if (!caps || caps.profiles) items.push({ id: "profiles", label: "Profiles", icon: Layers3 });
    items.push({ id: "settings", label: "Settings", icon: Settings });
    return items;
  }, [caps]);

  const snapSet = useMemo(() => new Set(snapPairs.flatMap((x) => [x.key1, x.key2])), [snapPairs]);
  const layerBindings = layer === 1 ? state?.keyBindings : state?.fnKeyBindings;
  const slot = selectedKey ? (selectedKey.special ? FN_SLOT : SLOT_BY_HID.get(selectedKey.hid)) : undefined;
  const binding = slot === undefined ? undefined : layerBindings?.find((x) => x.slot === slot);

  useEffect(() => {
    if (!selectedKey) return;
    setMappingKind(binding?.kind ?? 1);
    setMappingCode(binding?.code || selectedKey.hid || 4);
  }, [selectedKey?.id, layer, binding?.kind, binding?.code]);

  const effectMeta = EFFECTS.find((e) => e.id === lighting.effect) ?? EFFECTS.find((e) => e.id === 8)!;
  const visibleEffects = EFFECTS.filter((e) => e.id === 20 || !caps || caps.lightingEffects.includes(e.id));

  const applyLight = () => run({ key: "Applying lighting" }, async () => {
    await api.applyLighting(profile, lighting);
    await delay(90);
    await readBack();
  });

  const applyPerf = () => run({ key: "Applying performance" }, async () => {
    await api.applyPerformance(profile, performance);
    await delay(90);
    await readBack();
  });

  const applySnap = () => run({ key: "Applying Snap Tap" }, async () => {
    await api.applySnapTap(profile, snapEnabled, snapPairs);
    await delay(90);
    await readBack();
  });

  const applyBinding = () => {
    if (slot === undefined) {
      setStatus({ key: "Select a configurable key first" });
      return;
    }
    return run({ key: "Applying key binding" }, async () => {
      const patch = { slot, kind: mappingKind, code: mappingKind === 0 ? 0 : mappingCode };
      await api.applyKeyBinding(profile, layer, patch);
      await delay(90);
      await readBack();
    });
  };

  const setPair = (i: number, p: Partial<SnapPair>) => setSnapPairs((xs) => xs.map((x, n) => n === i ? { ...x, ...p } : x));
  const active = macros.find((m) => m.id === activeMacro);
  const patchMacro = (fn: (events: MacroEvent[]) => MacroEvent[]) => {
    if (activeMacro == null) return;
    setMacros((xs) => xs.map((m) => m.id === activeMacro ? { ...m, events: fn(m.events) } : m));
  };
  const createMacro = () => {
    const id = Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !macros.some((m) => m.id === n));
    if (!id) return setStatus({ key: "Maximum 10 macros in the editor" });
    setMacros((xs) => [...xs, { id, name: `Macro ${id}`, events: [] }]);
    setActiveMacro(id);
  };
  const saveMacro = () => {
    if (!active) return;
    void run({ key: "Writing Macro {id}", parameters: { id: active.id } }, async () => {
      await api.writeMacro(active.id, active.events);
    });
  };

  const exportDp = () => {
    const payload = {
      filename: "Profile",
      SN: device?.serialNumber ?? "0x342D0xE40F012",
      value: {
        verify: "Darkproject",
        version: "1.0.1.0",
        data: {
          profile: {
            profileName: `Profile ${profile + 1}`,
            profileid: profile + 1,
            LightingIndex: lighting.effect,
            Lighting: [{
              value: lighting.effect,
              name: EFFECT_NAME[lighting.effect] ?? "Solid",
              BrightnessValue: lighting.brightness,
              RateValue: lighting.speed,
              AngleValue: lighting.direction,
              CustomColor: [lighting.color],
              MultiColor: lighting.multiColor,
            }],
            Performance: {
              PollingRateValue: performance.pollingRate,
              InputLatencyValue: performance.inputLatency,
              DebounceTime: performance.debounce,
              SleepTime: performance.sleepTime,
            },
            SnapTap: {
              flag: snapEnabled ? 1 : 0,
              snapTapIndex: 0,
              snapTapShortcut: "ShiftRight",
              SnapTapData: snapPairs.map((x, i) => ({ value: i, Key1: keyName(x.key1), Key2: keyName(x.key2), type: x.kind })),
            },
          },
          macro: macros,
        },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DarkControl-Profile-${profile + 1}.dp`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ key: "Profile exported" });
  };

  const importDp = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const p = raw?.value?.data?.profile ?? raw?.profile ?? raw;
      if (p.Performance) setPerformance({
        pollingRate: p.Performance.PollingRateValue ?? 1000,
        inputLatency: p.Performance.InputLatencyValue ?? 2,
        debounce: p.Performance.DebounceTime ?? 5,
        sleepTime: p.Performance.SleepTime ?? 0,
      });
      const idx = p.LightingIndex ?? 8;
      const e = p.Lighting?.find?.((x: { value: number }) => x.value === idx) ?? p.Lighting?.[0];
      if (e) {
        const c = (e.CustomColor?.[0] ?? [148, 5, 57]) as [number, number, number];
        setLighting({ effect: e.value ?? idx, brightness: e.BrightnessValue ?? 100, speed: e.RateValue ?? 75, direction: e.AngleValue ?? 0, color: c, multiColor: !!e.MultiColor });
        setHexValue(hex(c));
      }
      if (p.SnapTap) {
        setSnapEnabled(!!p.SnapTap.flag);
        setSnapPairs((p.SnapTap.SnapTapData ?? []).map((x: { type?: number; Key1?: unknown; Key2?: unknown }) => ({ kind: x.type ?? 0, key1: keyHid(x.Key1, 4), key2: keyHid(x.Key2, 7) })));
      }
      setStatus({ key: "Imported to editor — use Apply to write it to hardware" });
    } catch (error) {
      console.error("Could not import profile", error);
      setStatus({ key: "Invalid .dp profile" });
    }
  };

  const devicePanel = <Panel title="Bushido 87 ANSI" icon={KeyboardIcon} className="keyboard-card">
    <KeyboardView
      color={lighting.color}
      selected={selectedKey?.id}
      onSelect={page === "keybinds" ? setSelectedKey : undefined}
      snapHids={page === "snaptap" ? snapSet : undefined}
      keyBindings={page === "keybinds" ? layerBindings : state?.keyBindings}
    />
  </Panel>;

  const renderDevice = () => <>
    <PageTitle title={t("Device")} subtitle={t("Live hardware state read directly from the keyboard.")} action={<button className="primary-btn" onClick={() => void loadDevice()}><RefreshCw size={16}/> {t("Reload hardware")}</button>} />
    <div className="device-page-grid">
      {devicePanel}
      <Panel title={device?.productName ?? t("Dark Project keyboard")} icon={Cpu} className="device-card page-device-card">
        <div className="device-art"><div/><span>87</span></div>
        <dl>
          <div><dt>{t("Connection")}</dt><dd>{device?.connected ? t("USB · Connected") : t("Not connected")}</dd></div>
          <div><dt>{t("Firmware")}</dt><dd>{device?.firmware === "preview" ? t("Preview") : device?.firmware ?? "—"}</dd></div>
          <div><dt>{t("Active profile")}</dt><dd>{t("Profile {number}", { number: profile + 1 })}</dd></div>
          <div><dt>{t("Serial")}</dt><dd>{device?.serialNumber ?? "—"}</dd></div>
          <div><dt>{t("Layout")}</dt><dd>{device?.layout ?? "—"}</dd></div>
          <div><dt>{t("Series")}</dt><dd>{device?.protocol ?? "—"}</dd></div>
        </dl>
        <div className="capabilities">
          {caps && ([
            ["Lighting", caps.lighting], ["Keybindings", caps.keybindings],
            ["FN layer", caps.fnLayer], ["Snap Tap", caps.snapTap],
            ["Macros", caps.macros], ["Performance", caps.performance],
          ] as const).map(([name, enabled]) =>
            <span className={enabled ? "supported" : "unsupported"} key={name}>{t(name)}<b>{enabled ? t("Supported") : t("Not exposed")}</b></span>)}
        </div>
      </Panel>
    </div>
  </>;

  const renderLighting = () => <>
    <PageTitle title={t("Lighting")} subtitle={`${t("Profile {number}", { number: profile + 1 })} · ${t(effectMeta.name)} · ${hex(lighting.color)}`} action={<button className="primary-btn" onClick={applyLight} disabled={!!busy}><Save size={16}/> {t("Apply to keyboard")}</button>} />
    {devicePanel}
    <div className="lighting-page-grid">
      <Panel title={t("Color & effect settings")} icon={Lightbulb} className="lighting-editor-card">
        <div className="lighting-editor">
          <div className="picker-column">
            {effectMeta.color ? <ColorPicker color={lighting.color} onChange={(c) => { setLighting({ ...lighting, color: c }); setHexValue(hex(c)); }} /> : <div className="no-color"><Sparkles size={30}/><b>{t("This effect controls its colors automatically")}</b><span>{t("No color picker is exposed by the Bushido profile.")}</span></div>}
            {effectMeta.color && <div className="hex-field large"><i style={{ background: `rgb(${lighting.color.join(",")})` }}/><input aria-label={t("Hex color")} value={hexValue} onChange={(e) => setHexValue(e.target.value)} onBlur={() => { const c = parseHex(hexValue); if (c) { setLighting({ ...lighting, color: c }); setHexValue(hex(c)); } else setHexValue(hex(lighting.color)); }}/></div>}
          </div>
          <div className="lighting-controls large-controls">
            <div className="setting-name"><small>{t("Selected effect")}</small><strong>{t(effectMeta.name)}</strong></div>
            <Slider label={t("Brightness")} value={lighting.brightness} onChange={(v) => setLighting({ ...lighting, brightness: v })}/>
            {effectMeta.rate && <Slider label={t("Speed")} value={lighting.speed} onChange={(v) => setLighting({ ...lighting, speed: v })}/>}
            {effectMeta.direction && <div className="directions"><b>{t("Direction")}</b>{(["Right", "Up", "Left", "Down"] as const).slice(0, lighting.effect === 1 ? 2 : 4).map((direction, i) => <button key={direction} aria-label={t(direction)} aria-pressed={lighting.direction === i} className={lighting.direction === i ? "active" : ""} onClick={() => setLighting({ ...lighting, direction: i })}>{["→", "↑", "←", "↓"][i]}</button>)}</div>}
            {effectMeta.custom && <div className="notice"><Info size={16}/><span>{t("Custom/per-key RGB exists on Bushido. This build preserves the currently selected hardware custom preset; the full per-key painter is the next isolated editor.")}</span></div>}
          </div>
        </div>
      </Panel>
      <Panel title={t("Effects available on Bushido")} icon={Sparkles} className="effects-card">
        <div className="effects-grid page-effects">{visibleEffects.map((effect) => {
          const Icon = effect.icon;
          const selected = lighting.brightness === 0 ? effect.id === 20 : lighting.effect === effect.id;
          return <button key={effect.id} className={selected ? "active" : ""} aria-pressed={selected} title={t(effect.name)} onClick={() => effect.id === 20 ? setLighting({ ...lighting, effect: 8, brightness: 0, color: [0, 0, 0], multiColor: false }) : setLighting({ ...lighting, effect: effect.id, brightness: Math.max(25, lighting.brightness) })}>
            <span className={`fx fx-${effect.id}`} aria-hidden="true"><Icon size={22} strokeWidth={1.75}/></span>
            <small>{t(effect.name)}</small>
          </button>;
        })}</div>
      </Panel>
    </div>
  </>;

  const renderKeybindings = () => <>
    <PageTitle title={t("Keybindings")} subtitle={t("Select a key on the keyboard, choose Base or FN layer, then write the mapping.")} action={<div className="tabs big-tabs"><button className={layer === 1 ? "active" : ""} onClick={() => setLayer(1)}>{t("Base layer")}</button>{caps?.fnLayer !== false && <button className={layer === 2 ? "active" : ""} onClick={() => setLayer(2)}>{t("FN layer")}</button>}</div>} />
    {devicePanel}
    <Panel title={selectedKey ? t("Edit {key}", { key: selectedKey.id }) : t("Select a key above")} icon={KeyboardIcon} className="wide-editor">
      <div className="key-editor-row">
        <div className="picked big-picked"><span>{selectedKey?.label || "?"}</span><div><b>{selectedKey?.id || t("No key selected")}</b><small>{slot === undefined ? t("Click a configurable key") : t("Firmware slot {slot} · {layer} layer", { slot, layer: layer === 1 ? t("Base") : "FN" })}</small></div></div>
        <label><span>{t("Action type")}</span><select value={mappingKind} onChange={(e) => setMappingKind(+e.target.value)}><option value={1}>{t("Keyboard key")}</option><option value={5}>{t("Macro")}</option><option value={0}>{t("Disabled")}</option></select></label>
        {mappingKind === 1 && <label><span>{t("Mapped key")}</span><select value={mappingCode} onChange={(e) => setMappingCode(+e.target.value)}>{HID_OPTIONS.map((o) => <option key={o.hid} value={o.hid}>{o.label}</option>)}</select></label>}
        {mappingKind === 5 && <label><span>{t("Macro ID")}</span><select value={mappingCode} onChange={(e) => setMappingCode(+e.target.value)}>{Array.from({ length: 10 }, (_, i) => i + 1).map((id) => <option key={id} value={id}>{t("Macro")} {id}</option>)}</select></label>}
        <button className="primary-btn" disabled={slot === undefined || !!busy} onClick={applyBinding}><Save size={16}/> {t("Apply key")}</button>
      </div>
    </Panel>
  </>;

  const renderSnapTap = () => <>
    <PageTitle title={t("Snap Tap")} subtitle={t("Hardware supports up to {count} key pairs.", { count: caps?.maxSnapTapPairs ?? 20 })} action={<div className="toggle-label"><span>{snapEnabled ? t("Enabled") : t("Disabled")}</span><Toggle value={snapEnabled} onChange={setSnapEnabled}/></div>} />
    {devicePanel}
    <Panel title={t("Snap Tap pairs")} icon={Zap} className="wide-editor" action={<button className="primary-btn" onClick={applySnap}><Save size={16}/> {t("Apply to keyboard")}</button>}>
      <div className="snap-page-list">
        {snapPairs.length === 0 && <div className="empty-state"><Zap size={28}/><b>{t("No Snap Tap pairs are stored in this profile.")}</b><span>{t("Add a pair to start.")}</span></div>}
        {snapPairs.map((p, i) => <div className="snap-row large-snap" key={i}>
          <select value={p.key1} onChange={(e) => setPair(i, { key1: +e.target.value })}>{HID_OPTIONS.map((o) => <option key={o.hid} value={o.hid}>{o.label}</option>)}</select>
          <span>↔</span>
          <select value={p.key2} onChange={(e) => setPair(i, { key2: +e.target.value })}>{HID_OPTIONS.map((o) => <option key={o.hid} value={o.hid}>{o.label}</option>)}</select>
          <select value={p.kind} onChange={(e) => setPair(i, { kind: +e.target.value })}><option value={0}>{t("Last input wins")}</option><option value={1}>{t("Key 1 priority")}</option><option value={2}>{t("Key 2 priority")}</option></select>
          <button aria-label={t("Remove pair")} onClick={() => setSnapPairs((xs) => xs.filter((_, n) => n !== i))}><Trash2 size={14}/></button>
        </div>)}
        <button className="outline-btn add-pair" disabled={snapPairs.length >= (caps?.maxSnapTapPairs ?? 20)} onClick={() => setSnapPairs((xs) => [...xs, { kind: 0, key1: 4, key2: 7 }])}><Plus size={15}/> {t("Add pair")}</button>
      </div>
    </Panel>
  </>;

  const renderMacros = () => <>
    <PageTitle title={t("Macros")} subtitle={t("Macros referenced by the current hardware profile are read back from the keyboard.")} action={<button className="outline-btn" onClick={createMacro}><Plus size={15}/> {t("New macro")}</button>} />
    <div className="macro-page-grid">
      <Panel title={t("Macros in this profile")} icon={Play} className="macro-list-card">
        <div className="macro-list">
          {macros.length === 0 && <div className="empty-state"><Play size={28}/><b>{t("No assigned macros found on the keyboard.")}</b><span>{t("Create one, then assign its ID from Keybindings.")}</span></div>}
          {macros.map((m) => <button key={m.id} className={m.id === activeMacro ? "active" : ""} onClick={() => setActiveMacro(m.id)}><span>{m.id}</span><div><b>{t("Macro {id}", { id: m.id })}</b><small>{t("Events: {count}", { count: m.events.length })}</small></div></button>)}
        </div>
      </Panel>
      <Panel title={active ? t("Macro {id}", { id: active.id }) : t("Macro editor")} icon={Play} className="macro-editor-card" action={active ? <button className="primary-btn" onClick={saveMacro}><Save size={16}/> {t("Write macro")}</button> : undefined}>
        {!active ? <div className="empty-state tall"><Play size={32}/><b>{t("Select or create a macro.")}</b></div> : <div className="macro-editor">
          {active.events.map((event, i) => <div className="macro-event big-event" key={i}>
            <select value={event.hid} onChange={(e) => patchMacro((xs) => xs.map((x, n) => n === i ? { ...x, hid: +e.target.value } : x))}>{HID_OPTIONS.map((o) => <option key={o.hid} value={o.hid}>{o.label}</option>)}</select>
            <label><input aria-label={t("Event delay")} type="number" min={0} max={32767} value={event.delay} onChange={(e) => patchMacro((xs) => xs.map((x, n) => n === i ? { ...x, delay: Math.max(0, Math.min(32767, +e.target.value)) } : x))}/><span>ms</span></label>
            <button className={event.pressed ? "down" : "up"} onClick={() => patchMacro((xs) => xs.map((x, n) => n === i ? { ...x, pressed: !x.pressed } : x))}>{event.pressed ? t("KEY DOWN") : t("KEY UP")}</button>
            <button aria-label={t("Remove event")} onClick={() => patchMacro((xs) => xs.filter((_, n) => n !== i))}><Trash2 size={14}/></button>
          </div>)}
          <button className="outline-btn" onClick={() => patchMacro((xs) => [...xs, { hid: 4, delay: 25, pressed: true }])}><Plus size={15}/> {t("Add event")}</button>
        </div>}
      </Panel>
    </div>
  </>;

  const renderProfiles = () => <>
    <PageTitle title={t("Profiles")} subtitle={t("Bushido stores three hardware profiles. The highlighted profile is the one the keyboard reported as active.")} />
    <div className="profiles-page-grid">
      {[0, 1, 2].map((p) => <button className={`profile-big ${p === profile ? "active" : ""}`} key={p} onClick={() => void changeProfile(p)}><Layers3 size={25}/><div><strong>{t("Profile {number}", { number: p + 1 })}</strong><span>{p === profile ? t("Active on keyboard") : t("Stored in hardware")}</span></div>{p === profile && <b>{t("ACTIVE")}</b>}</button>)}
    </div>
    <Panel title={t("Import / export")} icon={Layers3} className="profile-transfer">
      <p>{t("Import edits the current profile in the app first. Nothing is written until you press Apply in the relevant page.")}</p>
      <div className="transfer-buttons"><button className="outline-btn" onClick={() => fileRef.current?.click()}><ArrowUpFromLine size={16}/> {t("Import .dp")}</button><button className="primary-btn" onClick={exportDp}><ArrowDownToLine size={16}/> {t("Export current .dp")}</button></div>
    </Panel>
  </>;

  const renderPerformance = () => <>
    <PageTitle title={t("Performance")} subtitle={t("Shown only for models whose vendor capability metadata exposes Performance.")} action={<button className="primary-btn" onClick={applyPerf}><Save size={16}/> {t("Apply")}</button>} />
    <Panel title={t("Performance")} icon={Gauge} className="wide-editor">
      <div className="performance-editor"><div className="seg"><b>{t("Polling Rate")}</b>{[125, 250, 500, 1000].map((v) => <button key={v} className={performance.pollingRate === v ? "active" : ""} onClick={() => setPerformance({ ...performance, pollingRate: v })}>{v}</button>)}</div><div className="seg"><b>{t("Input Latency")}</b>{[0, 2, 8, 12].map((v) => <button key={v} className={performance.inputLatency === v ? "active" : ""} onClick={() => setPerformance({ ...performance, inputLatency: v })}>{v}</button>)}</div><Slider label={t("Debounce Time")} min={0} max={20} suffix=" ms" value={performance.debounce} onChange={(v) => setPerformance({ ...performance, debounce: v })}/><Slider label={t("Sleep Timer")} min={0} max={60} suffix=" min" value={performance.sleepTime} onChange={(v) => setPerformance({ ...performance, sleepTime: v })}/></div>
    </Panel>
  </>;

  const renderPage = () => {
    switch (page) {
      case "lighting": return renderLighting();
      case "keybinds": return renderKeybindings();
      case "snaptap": return renderSnapTap();
      case "macros": return renderMacros();
      case "performance": return renderPerformance();
      case "profiles": return renderProfiles();
      case "settings": return null;
      default: return renderDevice();
    }
  };

  return <div className={`app page-${page}`}>
    <aside className="sidebar">
      <div className="brand"><h1>DARK <span>CONTROL</span></h1><p>{t("for Dark Project keyboards")}</p></div>
      <nav>{nav.map((n) => <button key={n.id} className={page === n.id ? "active" : ""} onClick={() => setPage(n.id)}><n.icon size={20}/><span>{t(n.label)}</span></button>)}</nav>
      <div className="side-foot"><div className="pulse"><i/><i/><i/><i/><i/></div><b>DARK PROJECT</b><small>v0.3.0</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="device-mini"><div className="mini-kbd"><KeyboardIcon size={20}/></div><div><strong>{device?.productName?.replace("DPKB_", "").replaceAll("_", " ") ?? "BUSHIDO 87 ANSI"}</strong><span className={`connection ${device?.connected ? "on" : ""}`}><i/>{device?.connected ? t("Connected") : t("Waiting for device")}</span></div></div>
        <div className="meta"><span>VID 0x{(device?.vendorId ?? 0x342d).toString(16).toUpperCase()}</span><span>PID 0x{(device?.productId ?? 0xe40f).toString(16).toUpperCase()}</span><span>{device?.firmware === "preview" ? t("Preview") : device?.firmware ?? "FW —"}</span></div>
        <button className="icon-btn" title={t("Reload from keyboard")} onClick={() => void loadDevice()}><RefreshCw size={17} className={busy ? "spin" : ""}/></button>
        <div className="grow"/>
        <select className="profile-select" aria-label={t("Active profile")} value={profile} onChange={(e) => void changeProfile(+e.target.value)}>{Array.from({ length: device?.profiles ?? 3 }, (_, p) => <option key={p} value={p}>{t("Profile {number}", { number: p + 1 })}</option>)}</select>
        <input hidden ref={fileRef} type="file" accept=".dp,.json" onChange={(e) => e.target.files?.[0] && void importDp(e.target.files[0])}/>
      </header>
      <div className="workspace">{renderPage()}</div>
      <footer className="statusbar" role="status"><span className={busy ? "busy-dot" : "ok-dot"}/>{"error" in status ? translateError(language, status.error) : status.completed ? t("Completed: {operation}", { operation: t(status.key, status.parameters) }) : t(status.key, status.parameters)}</footer>
    </main>
  </div>;
}

import { Check, ChevronDown, Keyboard, Search, ShieldCheck } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getDeviceMetadata } from "../data/registry";
import { useLanguage } from "../lib/i18n";
import type { DeviceSummary } from "../lib/types";

type Props = {
  devices: DeviceSummary[];
  selectedId?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
};

/** Use the model label while preserving the actual HID product name in metadata. */
export function deviceLabel(device: DeviceSummary): string {
  const metadata = getDeviceMetadata(device.registryId);
  return (metadata?.modelName ?? device.productName).replace(/^DPKB_/, "").replaceAll("_", " ");
}

/** Filter models by readable name, layout, USB identity or vendor model ID. */
export function filterDevices(devices: DeviceSummary[], query: string): DeviceSummary[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/);
  return devices.filter((device) => {
    const metadata = getDeviceMetadata(device.registryId);
    const text = [deviceLabel(device), device.productName, device.styleName, device.layout,
      metadata?.displayName, metadata?.sourceId, device.vendorId.toString(16), device.productId.toString(16)]
      .join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term.replace(/^0x/, "")));
  });
}

/** Render a searchable device menu with keyboard navigation and focus restoration. */
export default function DevicePicker({ devices, selectedId, disabled, onSelect }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = devices.find((device) => device.id === selectedId);
  const filtered = useMemo(() => filterDevices(devices, query), [devices, query]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    setQuery("");
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <div className={`device-picker ${open ? "is-open" : ""}`} ref={root}
    onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
    }}>
    <button className="device-picker-trigger" ref={trigger} disabled={disabled}
      aria-label={t("Keyboard device")} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)}>
      <span className="device-picker-icon"><Keyboard size={18}/></span>
      <span className="device-picker-copy"><small>{t("Keyboard device")}</small>
        <strong>{selected ? deviceLabel(selected) : t("Select device")}</strong></span>
      {selected && <span className={`device-picker-dot ${selected.verified ? "verified" : ""}`} />}
      <ChevronDown className="device-picker-chevron" size={16}/>
    </button>
    {open && <div id={menuId} className="device-picker-menu" role="dialog" aria-label={t("Select device")}>
      <div className="device-picker-search"><Search size={16}/><input ref={search}
        aria-label={t("Search keyboards")} placeholder={t("Search keyboards")}
        value={query} onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); options.current?.querySelector("button")?.focus(); }
        }}/></div>
      <div className="device-picker-heading"><span>{t("Keyboard device")}</span><span>{filtered.length}</span></div>
      <div className="device-picker-options" ref={options} onKeyDown={(event) => {
        const buttons = [...event.currentTarget.querySelectorAll("button")];
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const target = event.key === "ArrowDown" ? Math.min(index + 1, buttons.length - 1)
          : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0
          : event.key === "End" ? buttons.length - 1 : null;
        if (target !== null) { event.preventDefault(); target < 0 ? search.current?.focus() : buttons[target]?.focus(); }
      }}>
        {filtered.map((device) => <button key={device.id} className={`device-picker-option ${selectedId === device.id ? "selected" : ""}`}
          aria-pressed={selectedId === device.id} onClick={() => { close(true); if (!disabled) onSelect(device.id); }}>
          <span className="device-option-icon"><Keyboard size={20}/></span>
          <span className="device-option-copy"><strong>{deviceLabel(device)}</strong>
            <small>{device.layout} <span>/</span> {device.styleName ?? t("Unknown")}
              <span>/</span> {device.vendorId.toString(16).toUpperCase()}:{device.productId.toString(16).toUpperCase()}</small>
            <span className={`device-option-status ${device.verified ? "verified" : ""}`}>
              {device.verified && <ShieldCheck size={11}/>} {device.verified ? t("Verified") : t("Unverified")}
              <span>/</span> {device.connected ? t("Connected") : t("Preview")}</span></span>
          {selectedId === device.id && <Check size={17} className="device-option-check"/>}
        </button>)}
        {!filtered.length && <div className="device-picker-empty"><Search size={24}/><span>{t("No keyboards found")}</span></div>}
      </div>
    </div>}
  </div>;
}

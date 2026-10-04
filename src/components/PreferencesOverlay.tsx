import { Check, Languages, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Language = "cs" | "sk" | "en";
type ThemeMode = "system" | "dark" | "light";

type Localized = { en: string; cs: string; sk: string };

const LANGUAGE_KEY = "dark-control.language";
const THEME_KEY = "dark-control.theme";

const copy: Record<string, Localized> = {
  settings: { en: "Settings", cs: "Nastavení", sk: "Nastavenia" },
  settingsSubtitle: { en: "Choose how Dark Control looks and speaks.", cs: "Nastavte vzhled a jazyk aplikace Dark Control.", sk: "Nastavte vzhľad a jazyk aplikácie Dark Control." },
  language: { en: "Language", cs: "Jazyk", sk: "Jazyk" },
  languageHint: { en: "Interface language", cs: "Jazyk rozhraní", sk: "Jazyk rozhrania" },
  appearance: { en: "Appearance", cs: "Vzhled", sk: "Vzhľad" },
  appearanceHint: { en: "Color mode", cs: "Barevný režim", sk: "Farebný režim" },
  system: { en: "System", cs: "Podle systému", sk: "Podľa systému" },
  systemHint: { en: "Follows Windows", cs: "Řídí se Windows", sk: "Riadi sa Windows" },
  dark: { en: "Dark", cs: "Tmavý", sk: "Tmavý" },
  light: { en: "Light", cs: "Světlý", sk: "Svetlý" },
  saved: { en: "Changes are saved automatically.", cs: "Změny se ukládají automaticky.", sk: "Zmeny sa ukladajú automaticky." },
  reset: { en: "Reset preferences", cs: "Obnovit nastavení", sk: "Obnoviť nastavenia" },
  appInfo: { en: "Dark Control", cs: "Dark Control", sk: "Dark Control" },
  appHint: { en: "Community configurator for supported Dark Project keyboards.", cs: "Komunitní konfigurátor pro podporované klávesnice Dark Project.", sk: "Komunitný konfigurátor pre podporované klávesnice Dark Project." },
};

const UI_TEXT: Localized[] = [
  { en: "Device", cs: "Zařízení", sk: "Zariadenie" },
  { en: "Lighting", cs: "Podsvícení", sk: "Podsvietenie" },
  { en: "Keybindings", cs: "Klávesy", sk: "Klávesy" },
  { en: "Snap Tap", cs: "Snap Tap", sk: "Snap Tap" },
  { en: "Macros", cs: "Makra", sk: "Makrá" },
  { en: "Profiles", cs: "Profily", sk: "Profily" },
  { en: "Settings", cs: "Nastavení", sk: "Nastavenia" },
  { en: "Performance", cs: "Výkon", sk: "Výkon" },
  { en: "Live hardware state read directly from the keyboard.", cs: "Aktuální stav načtený přímo z klávesnice.", sk: "Aktuálny stav načítaný priamo z klávesnice." },
  { en: "Reload hardware", cs: "Načíst znovu", sk: "Načítať znova" },
  { en: "Connection", cs: "Připojení", sk: "Pripojenie" },
  { en: "USB · Connected", cs: "USB · Připojeno", sk: "USB · Pripojené" },
  { en: "Not connected", cs: "Nepřipojeno", sk: "Nepripojené" },
  { en: "Connected", cs: "Připojeno", sk: "Pripojené" },
  { en: "Active profile", cs: "Aktivní profil", sk: "Aktívny profil" },
  { en: "Serial", cs: "Sériové číslo", sk: "Sériové číslo" },
  { en: "Layout", cs: "Rozložení", sk: "Rozloženie" },
  { en: "Series", cs: "Série", sk: "Séria" },
  { en: "Supported", cs: "Podporováno", sk: "Podporované" },
  { en: "Not exposed", cs: "Nedostupné", sk: "Nedostupné" },
  { en: "Changes are previewed in the app and written to the active hardware profile only when you press Apply.", cs: "Změny se nejprve zobrazí v aplikaci a do aktivního profilu se zapíší až po stisknutí Použít.", sk: "Zmeny sa najprv zobrazia v aplikácii a do aktívneho profilu sa zapíšu až po stlačení Použiť." },
  { en: "Apply lighting", cs: "Použít", sk: "Použiť" },
  { en: "Effects", cs: "Efekty", sk: "Efekty" },
  { en: "Current effect", cs: "Aktuální efekt", sk: "Aktuálny efekt" },
  { en: "Brightness", cs: "Jas", sk: "Jas" },
  { en: "Speed", cs: "Rychlost", sk: "Rýchlosť" },
  { en: "Direction", cs: "Směr", sk: "Smer" },
  { en: "This effect uses its own built-in colors.", cs: "Tento efekt používá vlastní vestavěné barvy.", sk: "Tento efekt používa vlastné vstavané farby." },
  { en: "Select a key on the keyboard, choose the Base or FN layer, then assign a new action.", cs: "Vyberte klávesu, zvolte základní nebo FN vrstvu a přiřaďte novou akci.", sk: "Vyberte kláves, zvoľte základnú alebo FN vrstvu a priraďte novú akciu." },
  { en: "Base Layer", cs: "Základní vrstva", sk: "Základná vrstva" },
  { en: "FN Layer", cs: "FN vrstva", sk: "FN vrstva" },
  { en: "Selected key", cs: "Vybraná klávesa", sk: "Vybraný kláves" },
  { en: "Action", cs: "Akce", sk: "Akcia" },
  { en: "Keyboard key", cs: "Klávesa", sk: "Kláves" },
  { en: "Disabled", cs: "Zakázáno", sk: "Zakázané" },
  { en: "Apply key", cs: "Použít klávesu", sk: "Použiť kláves" },
  { en: "Configure key pairs used by the keyboard firmware.", cs: "Nastavte dvojice kláves používané firmwarem klávesnice.", sk: "Nastavte dvojice kláves používané firmvérom klávesnice." },
  { en: "Enabled", cs: "Zapnuto", sk: "Zapnuté" },
  { en: "Add pair", cs: "Přidat dvojici", sk: "Pridať dvojicu" },
  { en: "Apply Snap Tap", cs: "Použít Snap Tap", sk: "Použiť Snap Tap" },
  { en: "Last input", cs: "Poslední vstup", sk: "Posledný vstup" },
  { en: "Edit and write hardware macros.", cs: "Upravujte a zapisujte hardwarová makra.", sk: "Upravujte a zapisujte hardvérové makrá." },
  { en: "New macro", cs: "Nové makro", sk: "Nové makro" },
  { en: "Add event", cs: "Přidat událost", sk: "Pridať udalosť" },
  { en: "Write macro", cs: "Zapsat makro", sk: "Zapísať makro" },
  { en: "Down", cs: "Stisk", sk: "Stlačenie" },
  { en: "Up", cs: "Uvolnění", sk: "Uvoľnenie" },
  { en: "Switch between the three hardware profiles or move settings through Dark Project .dp files.", cs: "Přepínejte mezi třemi hardwarovými profily nebo přenášejte nastavení pomocí souborů .dp.", sk: "Prepínajte medzi tromi hardvérovými profilmi alebo prenášajte nastavenia pomocou súborov .dp." },
  { en: "Import .dp", cs: "Importovat .dp", sk: "Importovať .dp" },
  { en: "Export .dp", cs: "Exportovat .dp", sk: "Exportovať .dp" },
  { en: "Current", cs: "Aktuální", sk: "Aktuálny" },
  { en: "Hardware", cs: "Hardware", sk: "Hardvér" },
  { en: "Profile exported", cs: "Profil exportován", sk: "Profil exportovaný" },
  { en: "Invalid .dp profile", cs: "Neplatný .dp profil", sk: "Neplatný .dp profil" },
  { en: "Starting…", cs: "Spouštím…", sk: "Spúšťam…" },
  { en: "Reading keyboard", cs: "Načítám klávesnici", sk: "Načítavam klávesnicu" },
  { en: "Applying lighting", cs: "Zapisuji podsvícení", sk: "Zapisujem podsvietenie" },
  { en: "Applying Snap Tap", cs: "Zapisuji Snap Tap", sk: "Zapisujem Snap Tap" },
  { en: "Applying key binding", cs: "Zapisuji klávesu", sk: "Zapisujem kláves" },
  { en: "Wave", cs: "Vlna", sk: "Vlna" },
  { en: "Spiral Wave", cs: "Spirálová vlna", sk: "Špirálová vlna" },
  { en: "Random", cs: "Náhodný", sk: "Náhodný" },
  { en: "Star", cs: "Hvězda", sk: "Hviezda" },
  { en: "Footprint", cs: "Stopa", sk: "Stopa" },
  { en: "River", cs: "Řeka", sk: "Rieka" },
  { en: "Color Cycle", cs: "Barevný cyklus", sk: "Farebný cyklus" },
  { en: "Breathing", cs: "Dýchání", sk: "Dýchanie" },
  { en: "Solid", cs: "Statická", sk: "Statická" },
  { en: "Ripples", cs: "Vlnění", sk: "Vlnenie" },
  { en: "Trigger", cs: "Spoušť", sk: "Spúšť" },
  { en: "Color Discharge", cs: "Barevný výboj", sk: "Farebný výboj" },
  { en: "Sine Wave", cs: "Sinusová vlna", sk: "Sínusová vlna" },
  { en: "Rain", cs: "Déšť", sk: "Dážď" },
  { en: "Custom", cs: "Vlastní", sk: "Vlastné" },
  { en: "LED Off", cs: "Vypnuto", sk: "Vypnuté" },
];

const reverseText = new Map<string, Localized>();
for (const item of UI_TEXT) {
  reverseText.set(item.en, item);
  reverseText.set(item.cs, item);
  reverseText.set(item.sk, item);
}

function browserLanguage(): Language {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("cs")) return "cs";
  if (lang.startsWith("sk")) return "sk";
  return "en";
}

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return stored === "cs" || stored === "sk" || stored === "en" ? stored : browserLanguage();
}

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}

function applyTranslations(language: Language) {
  const app = document.querySelector(".app");
  if (!app) return;
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  for (const textNode of nodes) {
    const raw = textNode.nodeValue ?? "";
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed === "v0.2.0") {
      textNode.nodeValue = raw.replace(trimmed, "v0.3.0");
      continue;
    }
    const item = reverseText.get(trimmed);
    if (!item) continue;
    const translated = item[language];
    if (translated !== trimmed) textNode.nodeValue = raw.replace(trimmed, translated);
  }
  document.documentElement.lang = language === "cs" ? "cs" : language === "sk" ? "sk" : "en";
}

function themeLabel(theme: ThemeMode, language: Language) {
  return copy[theme][language];
}

export default function PreferencesOverlay() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const tr = (key: keyof typeof copy) => copy[key][language];

  const resolvedTheme = useMemo(() => {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    let queued = false;
    const run = () => {
      queued = false;
      applyTranslations(language);
    };
    run();
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    });
    observer.observe(document.getElementById("root")!, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = theme;
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const reset = () => {
    localStorage.removeItem(LANGUAGE_KEY);
    localStorage.removeItem(THEME_KEY);
    setLanguage(browserLanguage());
    setTheme("system");
  };

  const languageOptions: Array<{ value: Language; label: string; flag: string }> = [
    { value: "cs", label: "Čeština", flag: "🇨🇿" },
    { value: "sk", label: "Slovenčina", flag: "🇸🇰" },
    { value: "en", label: "English", flag: "🇬🇧" },
  ];

  const themeOptions: Array<{ value: ThemeMode; icon: typeof Monitor }> = [
    { value: "system", icon: Monitor },
    { value: "dark", icon: Moon },
    { value: "light", icon: Sun },
  ];

  return <section className="preferences-shell" aria-label={tr("settings")}>
    <div className="preferences-page">
      <header className="preferences-title">
        <div>
          <h2>{tr("settings")}</h2>
          <p>{tr("settingsSubtitle")}</p>
        </div>
      </header>

      <div className="preferences-grid">
        <article className="preference-card">
          <div className="preference-card-head">
            <span className="preference-icon"><Languages size={20}/></span>
            <div><strong>{tr("language")}</strong><small>{tr("languageHint")}</small></div>
          </div>
          <div className="preference-options language-options">
            {languageOptions.map((item) => <button key={item.value} className={language === item.value ? "selected" : ""} onClick={() => setLanguage(item.value)}>
              <span className="flag">{item.flag}</span><span>{item.label}</span>{language === item.value && <Check size={17}/>} 
            </button>)}
          </div>
        </article>

        <article className="preference-card">
          <div className="preference-card-head">
            <span className="preference-icon"><Monitor size={20}/></span>
            <div><strong>{tr("appearance")}</strong><small>{tr("appearanceHint")}</small></div>
          </div>
          <div className="theme-options">
            {themeOptions.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} className={theme === item.value ? "selected" : ""} onClick={() => setTheme(item.value)}>
                <span className="theme-preview"><Icon size={22}/></span>
                <strong>{themeLabel(item.value, language)}</strong>
                <small>{item.value === "system" ? tr("systemHint") : "Dark Control"}</small>
                {theme === item.value && <Check className="theme-check" size={16}/>} 
              </button>;
            })}
          </div>
          <div className="resolved-theme">{tr("system")}: <b>{themeLabel(resolvedTheme, language)}</b></div>
        </article>

        <article className="preference-card app-card">
          <img src="/icon.png" alt="Dark Control"/>
          <div className="app-copy"><strong>{tr("appInfo")}</strong><span>v0.3.0</span><p>{tr("appHint")}</p></div>
          <button className="reset-preferences" onClick={reset}><RotateCcw size={15}/>{tr("reset")}</button>
        </article>
      </div>

      <footer className="preferences-footer"><span className="save-dot"/>{tr("saved")}</footer>
    </div>
  </section>;
}

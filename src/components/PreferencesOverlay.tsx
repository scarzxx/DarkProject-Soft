import { Check, Languages, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "../lib/i18n";
import { LANGUAGE_KEY, resolveLanguage } from "../lib/messages";
import type { Language, MessageKey } from "../lib/messages";
type ThemeMode = "system" | "dark" | "light";

const THEME_KEY = "dark-control.theme";

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}

export default function PreferencesOverlay() {
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const themeLabels: Record<ThemeMode, MessageKey> = { system: "System", dark: "Dark", light: "Light" };

  const resolvedTheme = useMemo(() => {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }, [theme]);

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
    setLanguage(resolveLanguage(null, navigator.language));
    setTheme("system");
  };

  const languageOptions: Array<{ value: Language; label: string; flag: string }> = [
    { value: "cs", label: "Čeština", flag: "/flags/cs.svg" },
    { value: "sk", label: "Slovenčina", flag: "/flags/sk.svg" },
    { value: "en", label: "English", flag: "/flags/en.svg" },
  ];

  const themeOptions: Array<{ value: ThemeMode; icon: typeof Monitor }> = [
    { value: "system", icon: Monitor },
    { value: "dark", icon: Moon },
    { value: "light", icon: Sun },
  ];

  return <section className="preferences-shell" aria-label={t("Settings")}>
    <div className="preferences-page">
      <header className="preferences-title">
        <div>
          <h2>{t("Settings")}</h2>
          <p>{t("Choose how Dark Control looks and speaks.")}</p>
        </div>
      </header>

      <div className="preferences-grid">
        <article className="preference-card">
          <div className="preference-card-head">
            <span className="preference-icon"><Languages size={20}/></span>
            <div><strong>{t("Language")}</strong><small>{t("Interface language")}</small></div>
          </div>
          <div className="preference-options language-options">
            {languageOptions.map((item) => <button key={item.value} className={language === item.value ? "selected" : ""} aria-pressed={language === item.value} onClick={() => setLanguage(item.value)}>
              <img className="flag" src={item.flag} alt="" width={26} height={18}/><span>{item.label}</span>{language === item.value && <Check size={17}/>}
            </button>)}
          </div>
        </article>

        <article className="preference-card">
          <div className="preference-card-head">
            <span className="preference-icon"><Monitor size={20}/></span>
            <div><strong>{t("Appearance")}</strong><small>{t("Color mode")}</small></div>
          </div>
          <div className="theme-options">
            {themeOptions.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} className={theme === item.value ? "selected" : ""} onClick={() => setTheme(item.value)}>
                <span className="theme-preview"><Icon size={22}/></span>
                <strong>{t(themeLabels[item.value])}</strong>
                <small>{item.value === "system" ? t("Follows Windows") : "Dark Control"}</small>
                {theme === item.value && <Check className="theme-check" size={16}/>}
              </button>;
            })}
          </div>
          <div className="resolved-theme">{t("System")}: <b>{t(themeLabels[resolvedTheme])}</b></div>
        </article>

        <article className="preference-card app-card">
          <img src="/icon.png" alt="Dark Control"/>
          <div className="app-copy"><strong>{"Dark Control"}</strong><span>v0.3.0</span><p>{t("Community configurator for supported Dark Project keyboards.")}</p></div>
          <button className="reset-preferences" onClick={reset}><RotateCcw size={15}/>{t("Reset preferences")}</button>
        </article>
      </div>

      <footer className="preferences-footer"><span className="save-dot"/>{t("Changes are saved automatically.")}</footer>
    </div>
  </section>;
}

import {
  Check,
  CheckCircle2,
  Download,
  Github,
  Languages,
  Monitor,
  Moon,
  PanelBottom,
  RefreshCw,
  RotateCcw,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "../lib/i18n";
import { LANGUAGE_KEY, resolveLanguage } from "../lib/messages";
import type { Language, MessageKey } from "../lib/messages";
import { getCloseToTray, hideToTray, setCloseToTray, setTrayLanguage, supportsTray } from "../lib/tray";
import {
  AUTO_CHECK_SESSION_KEY,
  AUTO_UPDATE_KEY,
  checkForUpdate,
  getAppVersion,
  installGitHubUpdate,
  supportsUpdater,
  type Update,
} from "../lib/updater";

type ThemeMode = "system" | "dark" | "light";
type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "installing" | "error";

const THEME_KEY = "dark-control.theme";

const UPDATE_COPY = {
  cs: {
    title: "Aktualizace",
    subtitle: "Kontrola a instalace nové verze z GitHub Releases.",
    automatic: "Automaticky kontrolovat aktualizace",
    automaticHint: "Při spuštění se na pozadí zkontroluje nejnovější veřejný GitHub Release. Pokud žádný nový není, nic se nezobrazí.",
    check: "Zkontrolovat aktualizace",
    checking: "Kontroluji GitHub Releases…",
    upToDate: "Používáte nejnovější verzi.",
    available: "Je dostupná nová verze",
    current: "Aktuální verze",
    newVersion: "Nová verze",
    download: "Stáhnout a nainstalovat",
    downloading: "Stahuji instalátor z GitHub Releases…",
    installing: "Instalátor byl spuštěn. Dark Control se ukončuje…",
    later: "Později",
    releaseNotes: "Poznámky k vydání",
    error: "Aktualizaci se nepodařilo zkontrolovat nebo nainstalovat.",
    desktopOnly: "Aktualizace jsou dostupné pouze v nainstalované desktopové aplikaci.",
    source: "Aktualizace se stahují přímo z veřejných GitHub Releases projektu.",
    promptTitle: "Dostupná aktualizace",
    promptText: "Na GitHub Releases je dostupná novější verze Dark Control.",
  },
  sk: {
    title: "Aktualizácie",
    subtitle: "Kontrola a inštalácia novej verzie z GitHub Releases.",
    automatic: "Automaticky kontrolovať aktualizácie",
    automaticHint: "Pri spustení sa na pozadí skontroluje najnovší verejný GitHub Release. Ak žiadny nový nie je, nič sa nezobrazí.",
    check: "Skontrolovať aktualizácie",
    checking: "Kontrolujem GitHub Releases…",
    upToDate: "Používate najnovšiu verziu.",
    available: "Je dostupná nová verzia",
    current: "Aktuálna verzia",
    newVersion: "Nová verzia",
    download: "Stiahnuť a nainštalovať",
    downloading: "Sťahujem inštalátor z GitHub Releases…",
    installing: "Inštalátor bol spustený. Dark Control sa ukončuje…",
    later: "Neskôr",
    releaseNotes: "Poznámky k vydaniu",
    error: "Aktualizáciu sa nepodarilo skontrolovať alebo nainštalovať.",
    desktopOnly: "Aktualizácie sú dostupné iba v nainštalovanej desktopovej aplikácii.",
    source: "Aktualizácie sa sťahujú priamo z verejných GitHub Releases projektu.",
    promptTitle: "Dostupná aktualizácia",
    promptText: "Na GitHub Releases je dostupná novšia verzia Dark Control.",
  },
  en: {
    title: "Updates",
    subtitle: "Check and install new versions from GitHub Releases.",
    automatic: "Automatically check for updates",
    automaticHint: "Dark Control checks the latest public GitHub Release in the background at startup. Nothing is shown when you are already up to date.",
    check: "Check for updates",
    checking: "Checking GitHub Releases…",
    upToDate: "You are using the latest version.",
    available: "A new version is available",
    current: "Current version",
    newVersion: "New version",
    download: "Download and install",
    downloading: "Downloading installer from GitHub Releases…",
    installing: "The installer was started. Dark Control is closing…",
    later: "Later",
    releaseNotes: "Release notes",
    error: "Dark Control could not check for or install the update.",
    desktopOnly: "Updates are available only in the installed desktop application.",
    source: "Updates are downloaded directly from this project's public GitHub Releases.",
    promptTitle: "Update available",
    promptText: "A newer Dark Control version is available on GitHub Releases.",
  },
} as const;

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}

function initialAutoUpdates(): boolean {
  return localStorage.getItem(AUTO_UPDATE_KEY) !== "false";
}

export default function PreferencesOverlay() {
  const { language, setLanguage, t } = useLanguage();
  const copy = UPDATE_COPY[language];
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [closeToTray, setTrayEnabled] = useState(false);
  const [trayReady, setTrayReady] = useState(false);
  const [trayBusy, setTrayBusy] = useState(supportsTray);
  const [trayError, setTrayError] = useState("");
  const [appVersion, setAppVersion] = useState("0.4.0");
  const [autoUpdates, setAutoUpdates] = useState(initialAutoUpdates);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const themeLabels: Record<ThemeMode, MessageKey> = { system: "System", dark: "Dark", light: "Light" };

  useEffect(() => {
    let active = true;
    getAppVersion().then((version) => { if (active) setAppVersion(version); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getCloseToTray().then((enabled) => {
      if (active) { setTrayEnabled(enabled); setTrayReady(supportsTray()); }
    }).catch((error: unknown) => {
      if (active) setTrayError(String(error));
    }).finally(() => { if (active) setTrayBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setTrayLanguage(language).catch((error: unknown) => {
      if (active) setTrayError(String(error));
    });
    return () => { active = false; };
  }, [language]);

  const performUpdateCheck = async (manual: boolean) => {
    if (!supportsUpdater()) {
      if (manual) {
        setUpdateStatus("error");
        setUpdateError(copy.desktopOnly);
      }
      return;
    }
    setUpdateStatus("checking");
    setUpdateError("");
    try {
      const update = await checkForUpdate();
      setAvailableUpdate(update);
      if (update) {
        setUpdateStatus("available");
        setShowUpdateDialog(true);
      } else {
        setUpdateStatus(manual ? "up-to-date" : "idle");
      }
    } catch (error: unknown) {
      if (manual) {
        setUpdateStatus("error");
        setUpdateError(String(error));
      } else {
        setUpdateStatus("idle");
      }
    }
  };

  useEffect(() => {
    if (!autoUpdates || !supportsUpdater() || sessionStorage.getItem(AUTO_CHECK_SESSION_KEY)) return;
    sessionStorage.setItem(AUTO_CHECK_SESSION_KEY, "1");
    void performUpdateCheck(false);
  }, []);

  const installAvailableUpdate = async () => {
    if (!availableUpdate) return;
    setUpdateStatus("downloading");
    setUpdateError("");
    try {
      await installGitHubUpdate(availableUpdate);
      setUpdateStatus("installing");
    } catch (error: unknown) {
      setUpdateStatus("error");
      setUpdateError(String(error));
    }
  };

  const updateAutoUpdates = (enabled: boolean) => {
    setAutoUpdates(enabled);
    localStorage.setItem(AUTO_UPDATE_KEY, String(enabled));
  };

  const updateTray = async (enabled: boolean) => {
    setTrayBusy(true);
    setTrayError("");
    try {
      await setCloseToTray(enabled);
      setTrayEnabled(enabled);
    } catch (error: unknown) {
      setTrayError(String(error));
    } finally { setTrayBusy(false); }
  };

  const hideWindow = async () => {
    setTrayBusy(true);
    setTrayError("");
    try { await hideToTray(); }
    catch (error: unknown) { setTrayError(String(error)); }
    finally { setTrayBusy(false); }
  };

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

  const reset = async () => {
    localStorage.removeItem(LANGUAGE_KEY);
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(AUTO_UPDATE_KEY);
    sessionStorage.removeItem(AUTO_CHECK_SESSION_KEY);
    setLanguage(resolveLanguage(null, navigator.language));
    setTheme("system");
    setAutoUpdates(true);
    if (trayReady) await updateTray(false);
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

  const updateStateText = updateStatus === "checking" ? copy.checking
    : updateStatus === "up-to-date" ? copy.upToDate
      : updateStatus === "available" ? `${copy.available}: ${availableUpdate?.version ?? ""}`
        : updateStatus === "downloading" ? copy.downloading
          : updateStatus === "installing" ? copy.installing
            : updateStatus === "error" ? copy.error
              : "";

  return <>
    <section className="preferences-shell" aria-label={t("Settings")}>
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

          <article className="preference-card tray-card">
            <div className="preference-card-head">
              <span className="preference-icon"><PanelBottom size={20}/></span>
              <div><strong>{t("System tray")}</strong><small>{t("Keep Dark Control running in the background.")}</small></div>
            </div>
            <div className="tray-preference-row">
              <div><strong id="close-to-tray-label">{t("Close to tray")}</strong><p id="close-to-tray-description">{t("Closing the window hides it in the system tray. Click its icon to reopen it, or choose Exit to quit.")}</p></div>
              <button type="button" role="switch" aria-checked={closeToTray} aria-labelledby="close-to-tray-label" aria-describedby="close-to-tray-description" className={`toggle ${closeToTray ? "on" : ""}`} disabled={!trayReady || trayBusy} onClick={() => updateTray(!closeToTray)}><i/></button>
            </div>
            {trayReady && <button type="button" className="reset-preferences tray-hide" disabled={!closeToTray || trayBusy} onClick={hideWindow}><PanelBottom size={15}/>{t("Hide to tray")}</button>}
            {!supportsTray() && <p className="tray-note">{t("System tray is available in the desktop app only.")}</p>}
            {trayError && <p className="tray-error" role="alert">{t("Could not configure the system tray.")} {trayError}</p>}
          </article>

          <article className="preference-card update-card">
            <div className="preference-card-head">
              <span className="preference-icon"><Download size={20}/></span>
              <div><strong>{copy.title}</strong><small>{copy.subtitle}</small></div>
            </div>
            <div className="tray-preference-row update-toggle-row">
              <div><strong id="auto-update-label">{copy.automatic}</strong><p id="auto-update-description">{copy.automaticHint}</p></div>
              <button type="button" role="switch" aria-checked={autoUpdates} aria-labelledby="auto-update-label" aria-describedby="auto-update-description" className={`toggle ${autoUpdates ? "on" : ""}`} onClick={() => updateAutoUpdates(!autoUpdates)}><i/></button>
            </div>
            <div className="update-version-row">
              <span>{copy.current}: <b>v{appVersion}</b></span>
              {availableUpdate && <span>{copy.newVersion}: <b>v{availableUpdate.version}</b></span>}
            </div>
            {updateStateText && <div className={`update-status ${updateStatus === "error" ? "error" : ""}`}>{updateStatus === "up-to-date" && <CheckCircle2 size={15}/>}<span>{updateStateText}</span></div>}
            {updateError && <p className="update-error" role="alert">{updateError}</p>}
            <div className="update-actions">
              <button className="reset-preferences" disabled={updateStatus === "checking" || updateStatus === "downloading" || updateStatus === "installing"} onClick={() => void performUpdateCheck(true)}><RefreshCw size={15}/>{copy.check}</button>
              {availableUpdate && <button className="primary-btn update-install" disabled={updateStatus === "downloading" || updateStatus === "installing"} onClick={() => void installAvailableUpdate()}><Download size={15}/>{copy.download}</button>}
            </div>
            <p className="update-signature-note"><Github size={14}/>{supportsUpdater() ? copy.source : copy.desktopOnly}</p>
          </article>

          <article className="preference-card app-card">
            <img src="/icon.png" alt="Dark Control"/>
            <div className="app-copy"><strong>{"Dark Control"}</strong><span>v{appVersion}</span><p>{t("Community configurator for supported Dark Project keyboards.")}</p></div>
            <button className="reset-preferences" disabled={trayBusy} onClick={reset}><RotateCcw size={15}/>{t("Reset preferences")}</button>
          </article>
        </div>

        <footer className="preferences-footer"><span className="save-dot"/>{t("Changes are saved automatically.")}</footer>
      </div>
    </section>

    {showUpdateDialog && availableUpdate && <div className="update-dialog-shell" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
      <div className="update-dialog">
        <span className="update-dialog-icon"><Download size={26}/></span>
        <div className="update-dialog-copy">
          <h2 id="update-dialog-title">{copy.promptTitle}</h2>
          <p>{copy.promptText}</p>
          <div className="update-dialog-versions"><span>{copy.current}: <b>v{appVersion}</b></span><span>{copy.newVersion}: <b>v{availableUpdate.version}</b></span></div>
          {availableUpdate.body && <div className="update-notes"><strong>{copy.releaseNotes}</strong><p>{availableUpdate.body}</p></div>}
          {updateStatus === "downloading" && <small>{copy.downloading}</small>}
          {updateStatus === "installing" && <small>{copy.installing}</small>}
          {updateError && <p className="update-error" role="alert">{copy.error} {updateError}</p>}
        </div>
        <div className="update-dialog-actions">
          <button className="outline-btn" disabled={updateStatus === "downloading" || updateStatus === "installing"} onClick={() => setShowUpdateDialog(false)}>{copy.later}</button>
          <button className="primary-btn" disabled={updateStatus === "downloading" || updateStatus === "installing"} onClick={() => void installAvailableUpdate()}><Download size={16}/>{copy.download}</button>
        </div>
      </div>
    </div>}
  </>;
}

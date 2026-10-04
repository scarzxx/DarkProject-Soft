export type Language = "cs" | "sk" | "en";
export type MessageParameters = Readonly<Record<string, string | number>>;

export const LANGUAGE_KEY = "dark-control.language";

export const MESSAGES = {
  "Device": { cs: "Zařízení", sk: "Zariadenie" },
  "Lighting": { cs: "Podsvícení", sk: "Podsvietenie" },
  "Keybindings": { cs: "Klávesy", sk: "Klávesy" },
  "Snap Tap": { cs: "Snap Tap", sk: "Snap Tap" },
  "Macros": { cs: "Makra", sk: "Makrá" },
  "Profiles": { cs: "Profily", sk: "Profily" },
  "Settings": { cs: "Nastavení", sk: "Nastavenia" },
  "Performance": { cs: "Výkon", sk: "Výkon" },
  "Choose how Dark Control looks and speaks.": { cs: "Nastavte vzhled a jazyk aplikace Dark Control.", sk: "Nastavte vzhľad a jazyk aplikácie Dark Control." },
  "Language": { cs: "Jazyk", sk: "Jazyk" },
  "Interface language": { cs: "Jazyk rozhraní", sk: "Jazyk rozhrania" },
  "Appearance": { cs: "Vzhled", sk: "Vzhľad" },
  "Color mode": { cs: "Barevný režim", sk: "Farebný režim" },
  "System": { cs: "Podle systému", sk: "Podľa systému" },
  "Follows Windows": { cs: "Řídí se Windows", sk: "Riadi sa Windows" },
  "Dark": { cs: "Tmavý", sk: "Tmavý" },
  "Light": { cs: "Světlý", sk: "Svetlý" },
  "Changes are saved automatically.": { cs: "Změny se ukládají automaticky.", sk: "Zmeny sa ukladajú automaticky." },
  "Reset preferences": { cs: "Obnovit nastavení", sk: "Obnoviť nastavenia" },
  "Community configurator for supported Dark Project keyboards.": { cs: "Komunitní konfigurátor pro podporované klávesnice Dark Project.", sk: "Komunitný konfigurátor pre podporované klávesnice Dark Project." },
  "for Dark Project keyboards": { cs: "pro klávesnice Dark Project", sk: "pre klávesnice Dark Project" },
  "Live hardware state read directly from the keyboard.": { cs: "Aktuální stav načtený přímo z klávesnice.", sk: "Aktuálny stav načítaný priamo z klávesnice." },
  "Reload hardware": { cs: "Načíst znovu", sk: "Načítať znova" },
  "Reload from keyboard": { cs: "Načíst z klávesnice", sk: "Načítať z klávesnice" },
  "Dark Project keyboard": { cs: "Klávesnice Dark Project", sk: "Klávesnica Dark Project" },
  "Connection": { cs: "Připojení", sk: "Pripojenie" },
  "USB · Connected": { cs: "USB · Připojeno", sk: "USB · Pripojené" },
  "Not connected": { cs: "Nepřipojeno", sk: "Nepripojené" },
  "Connected": { cs: "Připojeno", sk: "Pripojené" },
  "Waiting for device": { cs: "Čekám na zařízení", sk: "Čakám na zariadenie" },
  "Preview": { cs: "Náhled", sk: "Náhľad" },
  "Firmware": { cs: "Firmware", sk: "Firmvér" },
  "Active profile": { cs: "Aktivní profil", sk: "Aktívny profil" },
  "Profile {number}": { cs: "Profil {number}", sk: "Profil {number}" },
  "Serial": { cs: "Sériové číslo", sk: "Sériové číslo" },
  "Layout": { cs: "Rozložení", sk: "Rozloženie" },
  "Series": { cs: "Série", sk: "Séria" },
  "Supported": { cs: "Podporováno", sk: "Podporované" },
  "Not exposed": { cs: "Nedostupné", sk: "Nedostupné" },
  "Apply to keyboard": { cs: "Použít na klávesnici", sk: "Použiť na klávesnici" },
  "Color & effect settings": { cs: "Nastavení barvy a efektu", sk: "Nastavenia farby a efektu" },
  "This effect controls its colors automatically": { cs: "Tento efekt řídí barvy automaticky", sk: "Tento efekt riadi farby automaticky" },
  "No color picker is exposed by the Bushido profile.": { cs: "Profil Bushido u tohoto efektu neumožňuje volbu barvy.", sk: "Profil Bushido pri tomto efekte neumožňuje výber farby." },
  "Selected effect": { cs: "Vybraný efekt", sk: "Vybraný efekt" },
  "Brightness": { cs: "Jas", sk: "Jas" },
  "Speed": { cs: "Rychlost", sk: "Rýchlosť" },
  "Direction": { cs: "Směr", sk: "Smer" },
  "Right": { cs: "Doprava", sk: "Doprava" },
  "Left": { cs: "Doleva", sk: "Doľava" },
  "Up": { cs: "Nahoru", sk: "Nahor" },
  "Down": { cs: "Dolů", sk: "Nadol" },
  "Hue": { cs: "Odstín", sk: "Odtieň" },
  "Hex color": { cs: "Barva v HEX", sk: "Farba v HEX" },
  "Custom/per-key RGB exists on Bushido. This build preserves the currently selected hardware custom preset; the full per-key painter is the next isolated editor.": { cs: "Bushido podporuje vlastní RGB pro jednotlivé klávesy. Aplikace zachová aktuální vlastní předvolbu klávesnice; editor barev jednotlivých kláves zatím není dostupný.", sk: "Bushido podporuje vlastné RGB pre jednotlivé klávesy. Aplikácia zachová aktuálnu vlastnú predvoľbu klávesnice; editor farieb jednotlivých klávesov zatiaľ nie je dostupný." },
  "Effects available on Bushido": { cs: "Efekty dostupné na Bushido", sk: "Efekty dostupné na Bushido" },
  "Select a key on the keyboard, choose Base or FN layer, then write the mapping.": { cs: "Vyberte klávesu, zvolte základní nebo FN vrstvu a zapište přiřazení.", sk: "Vyberte kláves, zvoľte základnú alebo FN vrstvu a zapíšte priradenie." },
  "Base layer": { cs: "Základní vrstva", sk: "Základná vrstva" },
  "FN layer": { cs: "FN vrstva", sk: "FN vrstva" },
  "Base": { cs: "Základní", sk: "Základná" },
  "Edit {key}": { cs: "Upravit {key}", sk: "Upraviť {key}" },
  "Select a key above": { cs: "Vyberte klávesu nahoře", sk: "Vyberte kláves hore" },
  "No key selected": { cs: "Není vybrána klávesa", sk: "Nie je vybraný kláves" },
  "Click a configurable key": { cs: "Klikněte na nastavitelnou klávesu", sk: "Kliknite na nastaviteľný kláves" },
  "Firmware slot {slot} · {layer} layer": { cs: "Pozice ve firmwaru {slot} · {layer} vrstva", sk: "Pozícia vo firmvéri {slot} · {layer} vrstva" },
  "Action type": { cs: "Typ akce", sk: "Typ akcie" },
  "Keyboard key": { cs: "Klávesa", sk: "Kláves" },
  "Macro": { cs: "Makro", sk: "Makro" },
  "Disabled": { cs: "Vypnuto", sk: "Vypnuté" },
  "Mapped key": { cs: "Přiřazená klávesa", sk: "Priradený kláves" },
  "Macro ID": { cs: "ID makra", sk: "ID makra" },
  "Macro {id}": { cs: "Makro {id}", sk: "Makro {id}" },
  "Apply key": { cs: "Použít klávesu", sk: "Použiť kláves" },
  "Hardware supports up to {count} key pairs.": { cs: "Klávesnice podporuje až {count} dvojic kláves.", sk: "Klávesnica podporuje až {count} dvojíc klávesov." },
  "Enabled": { cs: "Zapnuto", sk: "Zapnuté" },
  "Snap Tap pairs": { cs: "Dvojice Snap Tap", sk: "Dvojice Snap Tap" },
  "No Snap Tap pairs are stored in this profile.": { cs: "V tomto profilu nejsou uloženy žádné dvojice Snap Tap.", sk: "V tomto profile nie sú uložené žiadne dvojice Snap Tap." },
  "Add a pair to start.": { cs: "Začněte přidáním dvojice.", sk: "Začnite pridaním dvojice." },
  "Last input wins": { cs: "Poslední vstup má přednost", sk: "Posledný vstup má prednosť" },
  "Key 1 priority": { cs: "Přednost klávesy 1", sk: "Prednosť klávesu 1" },
  "Key 2 priority": { cs: "Přednost klávesy 2", sk: "Prednosť klávesu 2" },
  "Add pair": { cs: "Přidat dvojici", sk: "Pridať dvojicu" },
  "Remove pair": { cs: "Odebrat dvojici", sk: "Odobrať dvojicu" },
  "Macros referenced by the current hardware profile are read back from the keyboard.": { cs: "Makra přiřazená k aktuálnímu profilu se načítají z klávesnice.", sk: "Makrá priradené k aktuálnemu profilu sa načítavajú z klávesnice." },
  "New macro": { cs: "Nové makro", sk: "Nové makro" },
  "Macros in this profile": { cs: "Makra v tomto profilu", sk: "Makrá v tomto profile" },
  "No assigned macros found on the keyboard.": { cs: "Na klávesnici nebyla nalezena přiřazená makra.", sk: "Na klávesnici sa nenašli priradené makrá." },
  "Create one, then assign its ID from Keybindings.": { cs: "Vytvořte makro a jeho ID přiřaďte v sekci Klávesy.", sk: "Vytvorte makro a jeho ID priraďte v sekcii Klávesy." },
  "Events: {count}": { cs: "Události: {count}", sk: "Udalosti: {count}" },
  "Macro editor": { cs: "Editor maker", sk: "Editor makier" },
  "Write macro": { cs: "Zapsat makro", sk: "Zapísať makro" },
  "Select or create a macro.": { cs: "Vyberte nebo vytvořte makro.", sk: "Vyberte alebo vytvorte makro." },
  "KEY DOWN": { cs: "STISK", sk: "STLAČENIE" },
  "KEY UP": { cs: "UVOLNĚNÍ", sk: "UVOĽNENIE" },
  "Add event": { cs: "Přidat událost", sk: "Pridať udalosť" },
  "Remove event": { cs: "Odebrat událost", sk: "Odobrať udalosť" },
  "Event delay": { cs: "Prodleva události", sk: "Oneskorenie udalosti" },
  "Bushido stores three hardware profiles. The highlighted profile is the one the keyboard reported as active.": { cs: "Bushido ukládá tři hardwarové profily. Zvýrazněný profil je podle klávesnice právě aktivní.", sk: "Bushido ukladá tri hardvérové profily. Zvýraznený profil je podľa klávesnice práve aktívny." },
  "Active on keyboard": { cs: "Aktivní na klávesnici", sk: "Aktívny na klávesnici" },
  "Stored in hardware": { cs: "Uloženo v klávesnici", sk: "Uložené v klávesnici" },
  "ACTIVE": { cs: "AKTIVNÍ", sk: "AKTÍVNY" },
  "Import / export": { cs: "Import / export", sk: "Import / export" },
  "Import edits the current profile in the app first. Nothing is written until you press Apply in the relevant page.": { cs: "Import nejprve upraví aktuální profil v aplikaci. Do klávesnice se změny zapíší až po stisknutí Použít na příslušné stránce.", sk: "Import najprv upraví aktuálny profil v aplikácii. Do klávesnice sa zmeny zapíšu až po stlačení Použiť na príslušnej stránke." },
  "Import .dp": { cs: "Importovat .dp", sk: "Importovať .dp" },
  "Export current .dp": { cs: "Exportovat aktuální .dp", sk: "Exportovať aktuálny .dp" },
  "Shown only for models whose vendor capability metadata exposes Performance.": { cs: "Dostupné jen pro modely, u kterých výrobce uvádí podporu nastavení výkonu.", sk: "Dostupné len pre modely, pri ktorých výrobca uvádza podporu nastavení výkonu." },
  "Apply": { cs: "Použít", sk: "Použiť" },
  "Polling Rate": { cs: "Frekvence dotazování", sk: "Frekvencia dotazovania" },
  "Input Latency": { cs: "Latence vstupu", sk: "Latencia vstupu" },
  "Debounce Time": { cs: "Potlačení zákmitů", sk: "Potlačenie zákmitov" },
  "Sleep Timer": { cs: "Časovač spánku", sk: "Časovač spánku" },
  "Starting…": { cs: "Spouštím…", sk: "Spúšťam…" },
  "Reading keyboard": { cs: "Načítám klávesnici", sk: "Načítavam klávesnicu" },
  "Switching to Profile {number}": { cs: "Přepínám na profil {number}", sk: "Prepínam na profil {number}" },
  "Applying lighting": { cs: "Zapisuji podsvícení", sk: "Zapisujem podsvietenie" },
  "Applying performance": { cs: "Zapisuji nastavení výkonu", sk: "Zapisujem nastavenia výkonu" },
  "Applying Snap Tap": { cs: "Zapisuji Snap Tap", sk: "Zapisujem Snap Tap" },
  "Applying key binding": { cs: "Zapisuji přiřazení klávesy", sk: "Zapisujem priradenie klávesu" },
  "Select a configurable key first": { cs: "Nejprve vyberte nastavitelnou klávesu", sk: "Najprv vyberte nastaviteľný kláves" },
  "Maximum 10 macros in the editor": { cs: "Editor podporuje nejvýše 10 maker", sk: "Editor podporuje najviac 10 makier" },
  "Writing Macro {id}": { cs: "Zapisuji makro {id}", sk: "Zapisujem makro {id}" },
  "Profile exported": { cs: "Profil exportován", sk: "Profil exportovaný" },
  "Imported to editor — use Apply to write it to hardware": { cs: "Importováno do editoru — pro zápis do klávesnice stiskněte Použít", sk: "Importované do editora — pre zápis do klávesnice stlačte Použiť" },
  "Invalid .dp profile": { cs: "Neplatný profil .dp", sk: "Neplatný profil .dp" },
  "Completed: {operation}": { cs: "Dokončeno: {operation}", sk: "Dokončené: {operation}" },
  "No supported Dark Project keyboard found": { cs: "Nebyla nalezena podporovaná klávesnice Dark Project", sk: "Nenašla sa podporovaná klávesnica Dark Project" },
  "Profile must be 0, 1 or 2": { cs: "Profil musí mít interní číslo 0, 1 nebo 2", sk: "Profil musí mať interné číslo 0, 1 alebo 2" },
  "Device returned a short report": { cs: "Klávesnice vrátila neúplná data", sk: "Klávesnica vrátila neúplné údaje" },
  "Too many Snap Tap pairs (maximum 20)": { cs: "Příliš mnoho dvojic Snap Tap (nejvýše 20)", sk: "Príliš veľa dvojíc Snap Tap (najviac 20)" },
  "Macro payload is too large": { cs: "Makro je příliš velké", sk: "Makro je príliš veľké" },
  "Unsupported lighting effect {value}": { cs: "Nepodporovaný efekt podsvícení {value}", sk: "Nepodporovaný efekt podsvietenia {value}" },
  "Invalid key slot {value}": { cs: "Neplatná pozice klávesy {value}", sk: "Neplatná pozícia klávesu {value}" },
  "Invalid polling rate {value}": { cs: "Neplatná frekvence dotazování {value}", sk: "Neplatná frekvencia dotazovania {value}" },
  "Invalid input latency {value}": { cs: "Neplatná latence vstupu {value}", sk: "Neplatná latencia vstupu {value}" },
  "HID error: {value}": { cs: "Chyba HID: {value}", sk: "Chyba HID: {value}" },
  "Wave": { cs: "Vlna", sk: "Vlna" },
  "Spiral Wave": { cs: "Spirálová vlna", sk: "Špirálová vlna" },
  "Random": { cs: "Náhodný", sk: "Náhodný" },
  "Star": { cs: "Hvězda", sk: "Hviezda" },
  "Footprint": { cs: "Stopa", sk: "Stopa" },
  "River": { cs: "Řeka", sk: "Rieka" },
  "Color Cycle": { cs: "Barevný cyklus", sk: "Farebný cyklus" },
  "Breathing": { cs: "Dýchání", sk: "Dýchanie" },
  "Solid": { cs: "Statická", sk: "Statická" },
  "Ripples": { cs: "Vlnění", sk: "Vlnenie" },
  "Trigger": { cs: "Spoušť", sk: "Spúšť" },
  "Color Discharge": { cs: "Barevný výboj", sk: "Farebný výboj" },
  "Sine Wave": { cs: "Sinusová vlna", sk: "Sínusová vlna" },
  "Rain": { cs: "Déšť", sk: "Dážď" },
  "Custom": { cs: "Vlastní", sk: "Vlastné" },
  "LED Off": { cs: "Vypnuto", sk: "Vypnuté" },
} as const;

export type MessageKey = keyof typeof MESSAGES;

const HARDWARE_ERROR_PREFIXES = [
  ["Unsupported lighting effect ", "Unsupported lighting effect {value}"],
  ["Invalid key slot ", "Invalid key slot {value}"],
  ["Invalid polling rate ", "Invalid polling rate {value}"],
  ["Invalid input latency ", "Invalid input latency {value}"],
  ["HID error: ", "HID error: {value}"],
] as const;

/** Translate UI text and substitute named parameters without interpreting values. */
export function translate(
  language: Language,
  key: MessageKey,
  parameters?: MessageParameters,
): string {
  const template = language === "en" ? key : MESSAGES[key][language];
  if (!parameters) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    parameters[name] === undefined ? token : String(parameters[name]),
  );
}

/** Resolve the interface language from a supported stored preference or locale. */
export function resolveLanguage(stored: string | null, locale: string): Language {
  if (stored === "cs" || stored === "sk" || stored === "en") return stored;
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return language === "cs" || language === "sk" ? language : "en";
}

/** Translate known backend errors while preserving device and OS diagnostics. */
export function translateError(language: Language, message: string): string {
  if (Object.hasOwn(MESSAGES, message)) {
    return translate(language, message as MessageKey);
  }
  for (const [prefix, key] of HARDWARE_ERROR_PREFIXES) {
    if (message.startsWith(prefix)) {
      return translate(language, key, { value: message.slice(prefix.length) });
    }
  }
  return message;
}

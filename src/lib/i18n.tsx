import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { LANGUAGE_KEY, resolveLanguage, translate } from "./messages";
import type { Language, MessageKey, MessageParameters } from "./messages";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, parameters?: MessageParameters) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Share and persist the interface language across all React screens. */
export function LanguageProvider({ children }: { children: ReactNode }): ReactElement {
  const [language, setLanguage] = useState<Language>(() =>
    resolveLanguage(localStorage.getItem(LANGUAGE_KEY), navigator.language),
  );
  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: MessageKey, parameters?: MessageParameters) =>
      translate(language, key, parameters),
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Read the current language and translator; requires LanguageProvider. */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage requires LanguageProvider");
  return context;
}

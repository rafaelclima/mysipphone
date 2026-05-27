import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import en from "./en";
import pt_BR from "./pt-BR";

export type Locale = "en" | "pt-BR";

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  "en": en,
  "pt-BR": pt_BR,
};

interface I18nContextType {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  t: (key) => key,
  setLocale: () => {},
});

export function I18nProvider({ children, initialLocale = "en" }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("locale") : null;
    return (saved === "en" || saved === "pt-BR") ? saved : initialLocale;
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  }, []);

  const t = useCallback((key: string): string => {
    return TRANSLATIONS[locale][key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

// The 10 languages the platform supports, mirrored from the native
// Partners app (GoMiamm-partners/lib/i18n.tsx SUPPORTED_LANGUAGES). The
// selected code is written to stores.preferred_language, which is the
// input consumed by edge-function emails/notifications and the app's
// kitchen-ticket locale — so the full set must be offered here even
// though the portal's own UI chrome only translates into en/fr/es.

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "zh", label: "Chinese (Simplified)", native: "中文" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "ja", label: "Japanese", native: "日本語" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function isSupportedLanguage(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** S2 1.8.2 locale strings. Copyright 2024 Adobe, Apache-2.0.
 * Source: https://github.com/adobe/react-spectrum
 */
const LABELS: Readonly<Record<string, readonly [string, string]>> = {
  "ar-ae": ["(مطلوب)", "(اختياري)"],
  "bg-bg": ["(задължително)", "(незадължително)"],
  "cs-cz": ["(požadováno)", "(volitelně)"],
  "da-dk": ["(obligatorisk)", "(valgfrit)"],
  "de-de": ["(erforderlich)", "(optional)"],
  "el-gr": ["(απαιτείται)", "(προαιρετικό)"],
  "en-us": ["(required)", "(optional)"],
  "es-es": ["(obligatorio)", "(opcional)"],
  "et-ee": ["(nõutav)", "(valikuline)"],
  "fi-fi": ["(pakollinen)", "(valinnainen)"],
  "fr-fr": ["(requis)", "(facultatif)"],
  "he-il": ["(נדרש)", "(אופציונלי)"],
  "hr-hr": ["(obvezno)", "(opcionalno)"],
  "hu-hu": ["(kötelező)", "(opcionális)"],
  "it-it": ["(obbligatorio)", "(facoltativo)"],
  "ja-jp": ["（必須）", "（オプション）"],
  "ko-kr": ["(필수 사항)", "(선택 사항)"],
  "lt-lt": ["(privaloma)", "(pasirenkama)"],
  "lv-lv": ["(obligāti)", "(neobligāti)"],
  "nb-no": ["(obligatorisk)", "(valgfritt)"],
  "nl-nl": ["(vereist)", "(optioneel)"],
  "pl-pl": ["(wymagane)", "(opcjonalne)"],
  "pt-br": ["(obrigatório)", "(opcional)"],
  "pt-pt": ["(obrigatório)", "(opcional)"],
  "ro-ro": ["(obligatoriu)", "(opţional)"],
  "ru-ru": ["(обязательно)", "(дополнительно)"],
  "sk-sk": ["(povinné)", "(nepovinné)"],
  "sl-si": ["(obvezno)", "(opcijsko)"],
  "sr-sp": ["(obavezno)", "(opciono)"],
  "sv-se": ["(krävs)", "(valfritt)"],
  "tr-tr": ["(gerekli)", "(isteğe bağlı)"],
  "uk-ua": ["(обов’язково)", "(необов’язково)"],
  "zh-cn": ["（必填）", "（非必须）"],
  "zh-tw": ["(必填)", "(選填)"],
};
export function necessityLabel(
  required: boolean,
  locale = globalThis.navigator?.language ?? "en-US",
): string {
  const key = locale.toLowerCase();
  let regional: string | undefined;
  try {
    const parsed = new Intl.Locale(locale).maximize();
    regional = `${parsed.language}-${parsed.region}`.toLowerCase();
  } catch {
    /* 잘못된 환경 locale은 지원 언어 또는 영어로 복원한다. */
  }
  const messages =
    LABELS[key] ??
    (regional ? LABELS[regional] : undefined) ??
    Object.entries(LABELS).find(
      ([name]) => name.split("-")[0] === key.split("-")[0],
    )?.[1] ??
    LABELS["en-us"]!;
  return messages[required ? 0 : 1];
}

import { spectrumLocaleFont } from "@composition/rendering";

/** Adobe Typekit 1.14가 외부로 노출하는 Font API. minified 내부 필드는 사용하지 않는다. */
interface KitFont {
  family: string;
  weight: string;
  style: string;
  unicodeRange: string;
  update(unicode: string): Promise<unknown>;
  load(): Promise<unknown>;
  getFontData(): { kind: string; data?: ArrayBuffer };
}
interface Kit {
  config: { t: string };
  kit: KitFont[];
  fonts: { add(font: KitFont): unknown };
  load(options: { active(): void; inactive(): void }): void;
}
export interface SpectrumLocaleFontData {
  family: string;
  weight: string;
  style: string;
  version: string;
  data: ArrayBuffer;
}
const documents = new WeakMap<Document, Map<string, Promise<Kit>>>();
const queues = new WeakMap<KitFont, Promise<unknown>>();
const dataCache = new WeakMap<KitFont, SpectrumLocaleFontData>();

function loadKit(doc: Document, id: string): Promise<Kit> {
  let kits = documents.get(doc);
  if (!kits) documents.set(doc, (kits = new Map()));
  const prior = kits.get(id);
  if (prior) return prior;
  const promise = new Promise<Kit>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = `https://use.typekit.net/${id}.js`;
    script.async = true;
    script.onload = () => {
      const kit = (doc.defaultView as unknown as { Typekit?: Kit })?.Typekit;
      if (
        !kit ||
        kit.config?.t !== id ||
        !Array.isArray(kit.kit) ||
        typeof kit.load !== "function"
      )
        reject(new Error(`SPECTRUM_KIT_API:${id}`));
      else
        kit.load({
          active: () => resolve(kit),
          inactive: () => reject(new Error(`SPECTRUM_KIT_INACTIVE:${id}`)),
        });
    };
    script.onerror = () => reject(new Error(`SPECTRUM_KIT_LOAD:${id}`));
    doc.head.appendChild(script);
  });
  kits.set(id, promise);
  void promise.catch(() => kits!.delete(id));
  return promise;
}

/** CSS Fonts의 400~500 굵기 탐색 순서를 보존한다. */
function closestWeight(
  fonts: readonly KitFont[],
  weight: number,
): KitFont | undefined {
  return [...fonts].sort((a, b) => {
    const rank = (font: KitFont) => {
      const w = Number.parseInt(font.weight) || 400;
      if (weight >= 400 && weight <= 500)
        return w >= weight && w <= 500
          ? w - weight
          : w < weight
            ? 1000 + weight - w
            : 2000 + w;
      return weight < 400
        ? w <= weight
          ? weight - w
          : 1000 + w
        : w >= weight
          ? w - weight
          : 1000 + weight - w;
    };
    return rank(a) - rank(b);
  })[0];
}

/** 동일한 Typekit face를 DOM에 등록하고 그 sfnt subset을 Canvas에도 반환한다. */
export async function loadSpectrumLocaleFont(
  doc: Document,
  locale: string,
  text: string,
  weight = 400,
): Promise<SpectrumLocaleFontData | undefined> {
  const entry = spectrumLocaleFont(locale);
  if (!entry || !text) return undefined;
  const kit = await loadKit(doc, entry.kit);
  const font = closestWeight(
    kit.kit.filter((font) => font.family === entry.family),
    weight,
  );
  if (
    !font ||
    typeof font.getFontData !== "function" ||
    typeof font.update !== "function"
  )
    throw new Error(`SPECTRUM_FONT_API:${entry.family}`);
  const unicode = [...new Set(Array.from(text, (char) => char.codePointAt(0)!))]
    .sort((a, b) => a - b)
    .map((code) => `U+${code.toString(16)}`)
    .join(",");
  const load = async () => {
    await font.update(unicode);
    await font.load();
    kit.fonts.add(font);
    const prior = dataCache.get(font);
    if (prior?.version === font.unicodeRange) return prior;
    const result = font.getFontData();
    if (result.kind !== "available" || !result.data)
      throw new Error(`SPECTRUM_FONT_DATA:${entry.family}:${result.kind}`);
    const data = {
      family: font.family,
      weight: String(Number.parseInt(font.weight) || 400),
      style: font.style,
      version: font.unicodeRange,
      data: result.data,
    };
    dataCache.set(font, data);
    return data;
  };
  const pending = (queues.get(font) ?? Promise.resolve())
    .catch(() => {})
    .then(load);
  queues.set(font, pending);
  return pending;
}

/** Preview/Publish의 문서 텍스트를 추적한다. 별도 측정용 DOM 복제는 만들지 않는다. */
export function observeSpectrumLocaleFonts(
  doc: Document,
  onError: (error: unknown) => void,
): () => void {
  let disposed = false;
  let scheduled = false;
  const sync = () => {
    if (disposed || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed) return;
      const locale = doc.documentElement.lang;
      if (!spectrumLocaleFont(locale)) return;
      const requests = new Map<number, string>();
      const walker = doc.createTreeWalker(doc.body, 4);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        const text = node.textContent;
        if (!parent || !text?.trim() || parent.closest("script,style"))
          continue;
        const style = doc.defaultView!.getComputedStyle(parent);
        if (!style.fontFamily.includes(spectrumLocaleFont(locale)!.family))
          continue;
        const weight = Number.parseInt(style.fontWeight) || 400;
        requests.set(weight, (requests.get(weight) ?? "") + text);
      }
      for (const [weight, text] of requests)
        void loadSpectrumLocaleFont(doc, locale, text, weight).catch(onError);
    });
  };
  const observer = new MutationObserver(sync);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["lang", "style"],
  });
  sync();
  return () => {
    disposed = true;
    observer.disconnect();
  };
}

import type { CatalogTextFont } from "../../../catalogRuntime/compositionRoot";

export interface CssLineBoxMetrics {
  height: number;
  baseline: number;
}

let caches = new WeakMap<object, Map<string, CssLineBoxMetrics>>();
const observed = new WeakSet<Document>();

/** Read CSS font metrics offscreen; visible content continues to be painted by Skia. */
export function measureCssLineBox(
  font: CatalogTextFont,
  generation?: object,
): CssLineBoxMetrics | undefined {
  if (typeof document === "undefined" || !document.body) return undefined;
  if (!observed.has(document)) {
    observed.add(document);
    const clear = () => {
      caches = new WeakMap();
    };
    document.fonts?.ready.then(clear);
    document.fonts?.addEventListener("loadingdone", clear);
  }
  const epoch = generation ?? document;
  let cache = caches.get(epoch);
  if (!cache) {
    cache = new Map();
    caches.set(epoch, cache);
  }
  const key = JSON.stringify([
    font.fontFamily,
    font.fontSize,
    font.fontWeight,
    font.fontStyle,
    font.lineHeight,
    font.locale ?? document.documentElement.lang,
    globalThis.devicePixelRatio,
  ]);
  const cached = cache.get(key);
  if (cached) return cached;
  const host = document.createElement("div");
  host.style.cssText =
    "all:initial;position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;display:block;width:max-content;white-space:pre;contain:layout style paint";
  host.lang = font.locale ?? document.documentElement.lang;
  host.style.fontFamily = font.fontFamily ?? "sans-serif";
  host.style.fontSize = `${font.fontSize}px`;
  host.style.fontWeight = String(font.fontWeight ?? 400);
  host.style.fontStyle = font.fontStyle ?? "normal";
  host.style.lineHeight =
    font.lineHeight > 0 ? String(font.lineHeight) : "normal";
  host.append("x");
  const marker = host.appendChild(document.createElement("span"));
  marker.style.cssText =
    "all:initial;display:inline-block;width:0;height:0;vertical-align:baseline";
  document.body.append(host);
  try {
    const rect = host.getBoundingClientRect();
    if (!(rect.height > 0)) return undefined;
    const result = {
      // A zero-height baseline marker can expand a line with negative leading.
      // Preserve authored line-height; the engine owns the full inline line box.
      height:
        font.lineHeight > 0 ? font.fontSize * font.lineHeight : rect.height,
      baseline: marker.getBoundingClientRect().top - rect.top,
    };
    const faceReady =
      !document.fonts ||
      document.fonts.check(
        `${font.fontStyle ?? "normal"} ${font.fontWeight ?? 400} ${font.fontSize}px ${host.style.fontFamily}`,
        "x",
      );
    if (faceReady && (!document.fonts || document.fonts.status === "loaded")) {
      if (cache.size >= 2048) cache.clear();
      cache.set(key, result);
    }
    return result;
  } finally {
    host.remove();
  }
}

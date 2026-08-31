/**
 * ADR-198 Phase 3 — Preview leg 의 DOM 측 산출물 (test-only)
 *
 * Skia leg 이 픽셀 하나로 끝나는 것과 달리 Preview leg 은 DOM 이라 **관측 가능한
 * 축이 더 많다**. 그 축을 안 내면 L2(style)/L3(pixel) 이 나중에 픽셀 하나만 보고
 * "왜 다른지" 를 못 말한다. 여기서 내는 것:
 *
 * - 정규화 computed style (L2 입력)
 * - 리소스 매니페스트 — 폰트/이미지/스타일시트 (R6: 로드 전 캡처 차단)
 * - 리소스 안정 대기 — 폰트 `ready`, 이미지 `decode()`, 스타일시트 접근 가능
 * - PNG → RGBA 디코드 (L3 입력이자 결정성 해시의 원본)
 *
 * 정규화는 **좁게** 둔다 (breakdown §3.6) — blur/resize/shift 없음. 여기서 하는
 * 것은 소수점 자리 고정뿐이고, 색 표기는 브라우저가 이미 `rgb()/rgba()` 로 정규화한다.
 */

/**
 * L2 비교 대상 속성. D3 시각 축(색/크기/폰트/형태/레이아웃)만 담는다 —
 * D1(ARIA/role) 과 D2(props) 는 대상이 아니다 (ssot-hierarchy §3).
 */
export const NORMALIZED_STYLE_KEYS = [
  "display",
  "box-sizing",
  "width",
  "height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "background-color",
  "color",
  "opacity",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "flex-direction",
  "justify-content",
  "align-items",
  "gap",
  "overflow-x",
  "overflow-y",
] as const;

/** `12.3456px` → `12.35px`. 그 외 값은 그대로 (색 표기는 브라우저가 이미 정규화). */
function normalizeValue(raw: string): string {
  return raw.replace(/(-?\d+\.\d+)px/g, (_m, n: string) =>
    `${Number.parseFloat(n).toFixed(2)}px`,
  );
}

export function normalizeStyles(
  win: Window,
  el: Element,
): Record<string, string> {
  const cs = win.getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const key of NORMALIZED_STYLE_KEYS) {
    out[key] = normalizeValue(cs.getPropertyValue(key).trim());
  }
  return out;
}

export interface ResourceManifest {
  fonts: string[];
  images: string[];
  styleSheets: string[];
  /** 교차 출처 요청 — G2 는 0 을 요구한다 */
  externalRequests: string[];
  /** 로드에 실패한 리소스 (이미지 디코드 실패 / 4xx·5xx 응답) */
  failedResources: string[];
}

/**
 * 리소스 매니페스트. **로드가 끝난 뒤에** 부르는 것이 전제다
 * (`waitForResourceStability` 이후). 그 전에 부르면 폰트 status 가 `unloaded`,
 * 이미지 naturalWidth 가 0 으로 잡혀 실패로 오인된다 (R6).
 */
export function captureResources(idoc: Document): ResourceManifest {
  const win = idoc.defaultView!;

  const fonts: string[] = [];
  idoc.fonts.forEach((f) => {
    fonts.push(`${f.family}|${f.weight}|${f.style}|${f.status}`);
  });

  const images: string[] = [];
  const failedResources: string[] = [];
  for (const img of Array.from(idoc.querySelectorAll("img"))) {
    const src = img.currentSrc || img.src;
    const path = src ? new URL(src, idoc.baseURI).pathname : "(empty)";
    images.push(`${path}|${img.naturalWidth}x${img.naturalHeight}`);
    if (img.complete && img.naturalWidth === 0) {
      failedResources.push(`img ${path} 디코드 실패`);
    }
  }

  const styleSheets: string[] = [];
  for (const sheet of Array.from(idoc.styleSheets)) {
    let ruleCount = -1;
    try {
      ruleCount = sheet.cssRules.length;
    } catch {
      // 교차 출처 스타일시트는 규칙을 못 읽는다 — 그 자체가 관측값이다
      failedResources.push(`stylesheet ${sheet.href ?? "(inline)"} 접근 불가`);
    }
    styleSheets.push(`${sheet.href ?? "(inline)"}|${ruleCount}`);
  }

  const externalRequests: string[] = [];
  const origin = win.location.origin;
  for (const entry of win.performance.getEntriesByType("resource")) {
    let entryOrigin: string;
    try {
      entryOrigin = new URL(entry.name).origin;
    } catch {
      continue;
    }
    if (entryOrigin !== origin) externalRequests.push(entry.name);
    const status = (entry as PerformanceResourceTiming & {
      responseStatus?: number;
    }).responseStatus;
    if (typeof status === "number" && status >= 400) {
      failedResources.push(`${entry.name} → HTTP ${status}`);
    }
  }

  return {
    fonts: fonts.sort(),
    images: images.sort(),
    styleSheets: styleSheets.sort(),
    externalRequests: externalRequests.sort(),
    failedResources: failedResources.sort(),
  };
}

/**
 * 폰트·이미지·스타일시트가 실제로 도착할 때까지 기다린다.
 *
 * DOM 서명 수렴만으로는 부족하다 — 늦게 도착하는 폰트는 레이아웃을 바꾸지 않는
 * 경우에도 **래스터** 를 바꾸고, 서명은 그걸 못 본다 (R6).
 */
export async function waitForResourceStability(
  idoc: Document,
  timeoutMs: number,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;

  await idoc.fonts.ready;

  const images = Array.from(idoc.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      if (img.complete) return;
      try {
        await img.decode();
      } catch {
        // 실패는 captureResources 의 failedResources 로 관측된다 — 여기선 삼킨다
      }
    }),
  );

  // 스타일시트는 규칙을 읽을 수 있을 때 로드 완료다. `<link>` 의 sheet 가 아직
  // null 이면 CSSOM 에 붙기 전이다.
  while (performance.now() < deadline) {
    const links = Array.from(
      idoc.querySelectorAll('link[rel="stylesheet"]'),
    ) as HTMLLinkElement[];
    if (links.every((l) => l.sheet !== null)) return;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  throw new Error("PARITY-RESOURCE: 스타일시트가 시간 안에 CSSOM 에 붙지 않았다");
}

/**
 * PNG → RGBA. 결정성 해시와 L3 비교의 **원본**이다.
 *
 * PNG 바이트를 그대로 해시하지 않는 이유: 인코더 메타데이터가 섞이면 픽셀이 같아도
 * 해시가 갈린다. Skia leg 도 raw RGBA 로 판정하므로 두 leg 의 판정 기준이 같아진다.
 */
export async function decodePngToRgba(bytes: Uint8Array): Promise<{
  pixels: Uint8Array;
  width: number;
  height: number;
}> {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: "image/png",
  });
  const bitmap = await createImageBitmap(blob);
  const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = surface.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const result = {
    pixels: new Uint8Array(data.buffer.slice(0)),
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return result;
}

/** base64 PNG → 바이트. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

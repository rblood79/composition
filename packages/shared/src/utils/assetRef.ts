/**
 * 자산 참조 규약 + 실행 문맥별 해석기 (ADR-235 Decision 2).
 *
 * 문서·폰트 레지스트리는 이미지·폰트 바이트 대신 `asset:sha256-<64 hex>` 를 든다.
 * consumer (Canvas `imageCache` · DOM `fillToCssLayer` · `<img>` 렌더러 · 폰트 CSS ·
 * Skia 폰트 로더) 는 이 모듈의 `resolveAssetUrl` 하나로 실행 시점 URL 을 얻는다 —
 * consumer 가 각자 해석하지 않는다 (HC6).
 *
 * 실행 문맥 (builder · Preview iframe · publish · 정적 내보내기) 마다 자기 해석기를
 * `setAssetUrlResolver` 로 한 번 설치한다. 소비 지점이 동기 함수라 해석기는
 * 동기 조회 (`resolveSync`) · 비동기 준비 (`ensure`) · 재렌더 알림 (`subscribe`)
 * 셋으로 나뉜다.
 *
 * dual-read: `asset:` 이 아닌 값 (dataURL · http · 상대 경로) 은 그대로 통과한다.
 * 해석되지 않은 `asset:` 은 `null` — consumer 는 그리지 않고 네트워크 요청도 내지 않는다.
 */

export const ASSET_REF_PREFIX = "asset:sha256-";

const ASSET_REF_PATTERN = /^asset:sha256-([0-9a-f]{64})$/;
const ASSET_REF_GLOBAL = /asset:sha256-[0-9a-f]{64}/g;

export type AssetRef = `asset:sha256-${string}`;

export function isAssetRef(value: unknown): value is AssetRef {
  return typeof value === "string" && ASSET_REF_PATTERN.test(value);
}

export function assetRefFromHash(hash: string): AssetRef {
  return `${ASSET_REF_PREFIX}${hash}` as AssetRef;
}

export function assetHashFromRef(ref: string): string | null {
  const match = ASSET_REF_PATTERN.exec(ref);
  return match ? match[1] : null;
}

/**
 * 값 (문서 · 레지스트리 · history payload) 안의 모든 `asset:` 참조를 모은다.
 * 필드 목록이 아니라 문자열 전수 순회 — 같은 참조가 `fills` 와
 * `metadata.legacyProps` 처럼 예상 밖 위치에도 복제된다 (ADR-235 G0 실측).
 */
export function collectAssetRefs(
  value: unknown,
  into: Set<AssetRef> = new Set(),
): Set<AssetRef> {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      if (current.includes(ASSET_REF_PREFIX)) {
        for (const match of current.matchAll(ASSET_REF_GLOBAL)) {
          into.add(match[0] as AssetRef);
        }
      }
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current && typeof current === "object") {
      for (const item of Object.values(current)) stack.push(item);
    }
  }
  return into;
}

/**
 * 값 안의 `asset:` 참조를 `replace(ref)` 결과로 바꾼 사본을 만든다 (원본 불변).
 * 문자열 안의 부분 참조 (CSS `url(asset:…)`) 도 바꾼다 — `collectAssetRefs` 와 같은 범위라야
 * 내보낸 파일에 참조가 남지 않는다 (HC7).
 */
export function mapAssetRefs<T>(
  value: T,
  replace: (ref: AssetRef) => string,
): T {
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") {
      if (!current.includes(ASSET_REF_PREFIX)) return current;
      return current.replace(ASSET_REF_GLOBAL, (ref) =>
        replace(ref as AssetRef),
      );
    }
    if (Array.isArray(current)) {
      let changed = false;
      const next = current.map((item) => {
        const mapped = visit(item);
        if (mapped !== item) changed = true;
        return mapped;
      });
      return changed ? next : current;
    }
    if (current && typeof current === "object") {
      let changed = false;
      const next: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(current)) {
        const mapped = visit(item);
        if (mapped !== item) changed = true;
        next[key] = mapped;
      }
      return changed ? next : current;
    }
    return current;
  };
  return visit(value) as T;
}

// ============================================
// 해석기 registry (실행 문맥당 1개)
// ============================================

export interface AssetUrlResolver {
  /** 준비된 참조의 실행 시점 URL. 준비 전이면 `null`. */
  resolveSync(ref: AssetRef): string | null;
  /** 참조 바이트를 준비한다. 없는 자산은 조용히 건너뛴다 (결과는 `resolveSync`). */
  ensure(refs: Iterable<AssetRef>): Promise<void>;
  /** 새 참조가 준비될 때 호출. 반환값은 구독 해제. */
  subscribe(listener: () => void): () => void;
}

let activeResolver: AssetUrlResolver | null = null;

export function setAssetUrlResolver(resolver: AssetUrlResolver | null): void {
  activeResolver = resolver;
}

export function getAssetUrlResolver(): AssetUrlResolver | null {
  return activeResolver;
}

/**
 * consumer 단일 해석 함수. `asset:` 이 아니면 그대로, 준비된 `asset:` 은 실행 시점 URL,
 * 준비 전이거나 해석기가 없으면 `null`.
 */
export function resolveAssetUrl(url: string): string | null;
export function resolveAssetUrl(url: string | undefined | null): string | null;
export function resolveAssetUrl(url: string | undefined | null): string | null {
  if (typeof url !== "string") return null;
  if (!url.startsWith(ASSET_REF_PREFIX)) return url;
  if (!isAssetRef(url)) return null;
  return activeResolver?.resolveSync(url) ?? null;
}

/** 비동기 consumer (Canvas fetch · Skia 폰트) 용 — 준비를 기다린 뒤 해석한다. */
export async function resolveAssetUrlAsync(
  url: string | undefined | null,
): Promise<string | null> {
  if (typeof url !== "string") return null;
  if (!url.startsWith(ASSET_REF_PREFIX)) return url;
  if (!isAssetRef(url) || !activeResolver) return null;
  const ready = activeResolver.resolveSync(url);
  if (ready) return ready;
  await activeResolver.ensure([url]);
  return activeResolver.resolveSync(url);
}

/** 값 안의 참조를 모두 준비한다. 해석기가 없거나 참조가 없으면 즉시 끝난다. */
export async function ensureAssetRefs(value: unknown): Promise<void> {
  if (!activeResolver) return;
  const refs = collectAssetRefs(value);
  if (refs.size === 0) return;
  const missing = [...refs].filter((ref) => !activeResolver?.resolveSync(ref));
  if (missing.length === 0) return;
  await activeResolver.ensure(missing);
}

export function subscribeAssetUrls(listener: () => void): () => void {
  return activeResolver?.subscribe(listener) ?? (() => {});
}

// ============================================
// 바이트 · 확장자
// ============================================

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/font-woff2": "woff2",
  "application/font-woff": "woff",
  "application/x-font-ttf": "ttf",
  "application/x-font-opentype": "otf",
};

export function extensionForMime(mime: string, fallbackName?: string): string {
  const known = EXTENSION_BY_MIME[mime.toLowerCase()];
  if (known) return known;
  const fromName = fallbackName?.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : "bin";
}

/** 내용 SHA-256 (hex). `crypto.subtle` — 신규 의존 0 (R8). */
export async function sha256Hex(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const buffer =
    bytes instanceof Uint8Array
      ? bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        )
      : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** dataURL → 바이트 + mime (이관 · 가져오기 · 자립 내보내기 공용). */
export function decodeDataUrl(
  dataUrl: string,
): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = /;base64/i.test(match[2]);
  const payload = match[3];
  try {
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
      return { mime, bytes };
    }
    return {
      mime,
      bytes: new TextEncoder().encode(decodeURIComponent(payload)),
    };
  } catch {
    return null;
  }
}

export function encodeDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

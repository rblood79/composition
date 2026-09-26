/**
 * 자산 바이트 유틸 (ADR-235) — writer · 내보내기 · 형식 v2 전용 (lazy 경로).
 *
 * `@composition/shared/assets` 서브경로로만 노출하고 이 파일은 값 import 가 없다 (타입만).
 * lazy chunk 가 shared barrel 이나 initial 모듈 (`utils/assetRef`) 을 값으로 import 하면
 * rolldown 이 initial 공용 chunk 를 쪼개 initial 이 커진다 (HC2 — 2026-09-26 실측).
 */
import type { AssetRef } from "../utils/assetRef";

const ASSET_REF_PREFIX = "asset:sha256-";
const HEX64 = /^[0-9a-f]{64}$/;

export function refFromHash(hash: string): AssetRef {
  return `${ASSET_REF_PREFIX}${hash}` as AssetRef;
}

export function hashFromRef(ref: string): string | null {
  if (!ref.startsWith(ASSET_REF_PREFIX)) return null;
  const hash = ref.slice(ASSET_REF_PREFIX.length);
  return HEX64.test(hash) ? hash : null;
}

/** 값 안의 모든 `asset:` 참조 (문자열 전수 순회 — `utils/assetRef.collectAssetRefs` 와 같은 규칙) */
export function findAssetRefs(value: unknown): Set<AssetRef> {
  const found = new Set<AssetRef>();
  const pattern = /asset:sha256-[0-9a-f]{64}/g;
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      if (current.includes(ASSET_REF_PREFIX)) {
        for (const match of current.matchAll(pattern))
          found.add(match[0] as AssetRef);
      }
    } else if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (current && typeof current === "object") {
      for (const item of Object.values(current)) stack.push(item);
    }
  }
  return found;
}

const ASSET_REF_GLOBAL = /asset:sha256-[0-9a-f]{64}/g;

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

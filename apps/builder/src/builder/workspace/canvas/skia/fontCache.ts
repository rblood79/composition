/**
 * 폰트 바이너리 IndexedDB 캐시의 이름 · 키 · hit 판정 — `fontManager.ts` 와 미리 받기
 * (`dashboard/canvasWarmup.ts`, ADR-244) 가 같은 규칙으로 읽는다. 미리 받기는 IndexedDB 에 이미 있는
 * 폰트를 받지 않는다. CanvasKit 에 닿지 않는 순수 모듈이라 미리 받기 chunk 가 import 해도 된다.
 */

const FONT_CACHE_DB = "composition-fonts";
const FONT_CACHE_VERSION = 2; // v2: 이전 잘못된 서브셋 캐시 무효화
export const FONT_CACHE_STORE = "fonts";

export interface FontCacheEntry {
  /** IDB keyPath — 복합키 "family::weight::style" */
  family: string;
  /** 원본 URL — URL 변경 시 캐시 무효화에 사용 */
  url?: string;
  buffer: ArrayBuffer;
  timestamp: number;
}

/**
 * 복합키 생성: "family::weight::style"
 * Pretendard 등 단일 로드 시 weight/style 미지정 → "family::400::normal"
 */
export function fontCacheKey(
  family: string,
  weight?: string,
  style?: string,
): string {
  return `${family}::${weight ?? "400"}::${style ?? "normal"}`;
}

/** 캐시 DB 를 연다 — 처음이면 store 를 만든다 (누가 먼저 열든 같은 모양). */
export function openFontCacheDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(FONT_CACHE_DB, FONT_CACHE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FONT_CACHE_STORE)) {
        db.createObjectStore(FONT_CACHE_STORE, { keyPath: "family" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 저장된 항목이 `expectedUrl` 의 폰트로 쓸 수 있는가 — URL 이 바뀌었으면 miss. */
export function isFontCacheHit(
  entry: FontCacheEntry | undefined,
  expectedUrl?: string,
): entry is FontCacheEntry {
  if (!entry?.buffer) return false;
  return !(expectedUrl && entry.url && entry.url !== expectedUrl);
}

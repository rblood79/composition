/**
 * ADR-235 Phase 2 — 인라인 dataURL → 자산 이관 (G2).
 *
 * 규칙 (R1):
 * - 자산 저장이 **성공한 dataURL 만** 참조로 바꾼다. 저장이 실패한 것은 인라인 그대로 둔다.
 * - 문서는 치환 **전에** 백업 ring 에 현재 저장본을 강제로 남긴다. 백업을 못 남기면 치환하지 않는다.
 * - 멱등 — 이관된 문서에는 인라인 dataURL 이 없어 두 번째 실행은 아무것도 바꾸지 않는다.
 * - 치환은 비동기 저장이 끝난 뒤 **그 시점의 최신 문서**에 적용한다 (저장 중 편집을 덮지 않는다).
 *
 * lazy 전용 모듈 — builder store · DB 는 호출부가 주입한다 (이 chunk 가 builder/shared 공용
 * 모듈을 값으로 import 하면 initial chunk 가 쪼개진다, HC2).
 */
import type { AssetRef } from "@composition/shared";
import { decodeDataUrl } from "@composition/shared/assets";
import { storeAssetBytes } from "./assetStore";
import { installIndexedDbAssetUrlResolver } from "./assetUrlResolver";

/** 자산으로 옮길 dataURL — 이미지 · 폰트만 (그 밖의 data: 는 문서 규약 밖) */
const ASSET_MIME = /^data:(?:image\/|font\/|application\/(?:x-)?font)/i;
/** 문자열 안의 `url(data:…)` — CSS 값에 박힌 dataURL */
const CSS_DATA_URL = /url\(\s*(['"]?)(data:[^'")\s]+)\1\s*\)/gi;

function visitStrings(value: unknown, visit: (text: string) => void): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") visit(current);
    else if (Array.isArray(current))
      for (const item of current) stack.push(item);
    else if (current && typeof current === "object")
      for (const item of Object.values(current)) stack.push(item);
  }
}

/** 값 안의 이관 대상 dataURL (문자열 전체 값 + CSS `url(data:…)`) */
export function findInlineAssetDataUrls(value: unknown): Set<string> {
  const found = new Set<string>();
  visitStrings(value, (text) => {
    if (!text.includes("data:")) return;
    if (ASSET_MIME.test(text)) {
      found.add(text);
      return;
    }
    for (const match of text.matchAll(CSS_DATA_URL)) {
      if (ASSET_MIME.test(match[2])) found.add(match[2]);
    }
  });
  return found;
}

/** dataURL → 참조 치환 사본 (원본 불변 · 바뀐 것이 없으면 같은 참조) */
export function replaceInlineAssetDataUrls<T>(
  value: T,
  map: ReadonlyMap<string, AssetRef>,
): T {
  if (map.size === 0) return value;
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") {
      if (!current.includes("data:")) return current;
      const whole = map.get(current);
      if (whole) return whole;
      return current.replace(
        CSS_DATA_URL,
        (all, quote: string, url: string) => {
          const ref = map.get(url);
          return ref ? `url(${quote}${ref}${quote})` : all;
        },
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

export interface StoreInlineResult {
  map: Map<string, AssetRef>;
  /** 저장 실패 — 인라인으로 남는다 */
  failed: string[];
}

export type StoreBytes = typeof storeAssetBytes;

/** dataURL 을 하나씩 저장한다. 실패한 것은 `failed` 로 — 인라인 유지 (R1). */
export async function storeInlineAssets(
  dataUrls: Iterable<string>,
  store: StoreBytes = storeAssetBytes,
): Promise<StoreInlineResult> {
  const map = new Map<string, AssetRef>();
  const failed: string[] = [];
  const resolver = installIndexedDbAssetUrlResolver();
  for (const dataUrl of dataUrls) {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) {
      failed.push(dataUrl);
      continue;
    }
    try {
      const stored = await store({ bytes: decoded.bytes, mime: decoded.mime });
      resolver.register(stored.ref, stored.blob);
      map.set(dataUrl, stored.ref);
    } catch (error) {
      console.warn("[assets] 이관 저장 실패 — 인라인 유지", error);
      failed.push(dataUrl);
    }
  }
  return { map, failed };
}

/** 값 (가져온 파일 envelope · 폰트 레지스트리) 의 인라인 자산을 이관한 사본 */
export async function migrateValueInlineAssets<T>(
  value: T,
  store?: StoreBytes,
): Promise<{ value: T; migrated: number; failed: number }> {
  const urls = findInlineAssetDataUrls(value);
  if (urls.size === 0) return { value, migrated: 0, failed: 0 };
  const { map, failed } = await storeInlineAssets(urls, store);
  return {
    value: replaceInlineAssetDataUrls(value, map),
    migrated: map.size,
    failed: failed.length,
  };
}

export interface ProjectMigrationDeps<Doc> {
  getDocument(): Doc | null | undefined;
  /** 저장된 현재 문서를 백업 ring 에 강제 기록 — 백업이 존재하면 true */
  backupNow(): Promise<boolean>;
  /** 치환된 문서 적용 (canonical 1차 → 파생 · 영속은 기존 파이프라인) */
  apply(next: Doc, previous: Doc): void;
  store?: StoreBytes;
}

export interface ProjectMigrationResult {
  status: "none" | "migrated" | "backup-failed" | "store-failed" | "stale";
  migrated: number;
  failed: number;
}

/** 프로젝트 문서의 인라인 dataURL → 자산 (로드 뒤 백그라운드). */
export async function migrateProjectInlineAssets<Doc>(
  deps: ProjectMigrationDeps<Doc>,
): Promise<ProjectMigrationResult> {
  const initial = deps.getDocument();
  if (!initial) return { status: "stale", migrated: 0, failed: 0 };
  const urls = findInlineAssetDataUrls(initial);
  if (urls.size === 0) return { status: "none", migrated: 0, failed: 0 };

  const { map, failed } = await storeInlineAssets(urls, deps.store);
  if (map.size === 0) {
    return { status: "store-failed", migrated: 0, failed: failed.length };
  }
  // 치환 전 백업 강제 — 못 남기면 치환하지 않는다 (자산은 남아도 참조가 없어 GC 대상).
  const backedUp = await deps.backupNow().catch(() => false);
  if (!backedUp) {
    return { status: "backup-failed", migrated: 0, failed: failed.length };
  }
  const latest = deps.getDocument();
  if (!latest) return { status: "stale", migrated: 0, failed: failed.length };
  const next = replaceInlineAssetDataUrls(latest, map);
  if (next === latest) {
    return { status: "none", migrated: 0, failed: failed.length };
  }
  deps.apply(next, latest);
  return { status: "migrated", migrated: map.size, failed: failed.length };
}

interface FontFaceLike {
  source: { type: string; url: string };
}

export interface FontRegistryMigrationDeps<
  R extends { faces: FontFaceLike[] },
> {
  load(): R;
  save(next: R): void;
  /** 저장소의 원본 레지스트리 문자열 (백업용) */
  readRaw(): string | null;
  /** 원본 레지스트리 백업 참조 기록 — R7 (이관 확인 후 1 릴리스 보존) */
  writeBackupRef(ref: AssetRef): void;
  store?: StoreBytes;
}

/**
 * 폰트 레지스트리 (localStorage) 의 base64 폰트 → 자산. 레지스트리 메타데이터는 localStorage 에
 * 남고 (참조만 들어 수 KB) 바이트만 자산 저장소로 옮긴다. 원본 레지스트리 문자열은 먼저 자산으로
 * 백업하고, 백업을 못 남기면 이관하지 않는다.
 */
export async function migrateFontRegistry<R extends { faces: FontFaceLike[] }>(
  deps: FontRegistryMigrationDeps<R>,
): Promise<{ migrated: number; failed: number }> {
  const registry = deps.load();
  const urls = findInlineAssetDataUrls(
    registry.faces.map((face) => face.source.url),
  );
  if (urls.size === 0) return { migrated: 0, failed: 0 };
  const store = deps.store ?? storeAssetBytes;
  const raw = deps.readRaw();
  if (raw) {
    try {
      const backup = await store({
        bytes: new TextEncoder().encode(raw),
        mime: "application/json",
        name: "font-registry-backup.json",
      });
      deps.writeBackupRef(backup.ref);
    } catch (error) {
      console.warn("[assets] 폰트 레지스트리 백업 실패 — 이관 보류", error);
      return { migrated: 0, failed: urls.size };
    }
  }
  const { map, failed } = await storeInlineAssets(urls, store);
  if (map.size === 0) return { migrated: 0, failed: failed.length };
  const latest = deps.load();
  deps.save({
    ...latest,
    faces: latest.faces.map((face) => {
      const ref = map.get(face.source.url);
      return ref
        ? {
            ...face,
            source: { ...face.source, type: "project-asset", url: ref },
          }
        : face;
    }),
  });
  return { migrated: map.size, failed: failed.length };
}

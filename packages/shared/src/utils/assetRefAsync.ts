/**
 * 자산 참조의 비동기 준비 · 전수 수집 (ADR-235). 비동기 consumer (Canvas fetch · Skia 폰트) 와
 * 첫 렌더 전에 모두 준비해야 하는 경로 (publish 로더) 가 쓴다. 동기 해석 핵심 (`assetRef.ts`) 과
 * 파일을 나눈 이유: 이 함수들이 builder · Preview 공용 initial chunk 에 실리지 않게 (HC2).
 */
import {
  ASSET_REF_PREFIX,
  loadAssetUrlResolver,
  type AssetRef,
} from "./assetRef";

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
        for (const match of current.matchAll(/asset:sha256-[0-9a-f]{64}/g)) {
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

/** 비동기 consumer (Canvas fetch · Skia 폰트) 용 — 준비를 기다린 뒤 해석한다. */
export async function resolveAssetUrlAsync(
  url: string | undefined | null,
): Promise<string | null> {
  if (typeof url !== "string") return null;
  if (!url.startsWith(ASSET_REF_PREFIX)) return url;
  const resolver = await loadAssetUrlResolver();
  if (!resolver) return null;
  const ref = url as AssetRef;
  const ready = resolver.resolveSync(ref);
  if (ready) return ready;
  await resolver.ensure([ref]);
  return resolver.resolveSync(ref);
}

/** 값 안의 참조를 모두 준비한다. 해석기가 없거나 참조가 없으면 즉시 끝난다. */
export async function ensureAssetRefs(value: unknown): Promise<void> {
  const refs = collectAssetRefs(value);
  if (refs.size === 0) return;
  const resolver = await loadAssetUrlResolver();
  if (!resolver) return;
  const missing = [...refs].filter((ref) => !resolver.resolveSync(ref));
  if (missing.length > 0) await resolver.ensure(missing);
}

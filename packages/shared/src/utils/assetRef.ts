/**
 * 자산 참조 규약 + 실행 문맥별 해석기 (ADR-235 Decision 2).
 *
 * 문서·폰트 레지스트리는 이미지·폰트 바이트 대신 `asset:sha256-<64 hex>` 를 든다.
 * consumer (Canvas `imageCache` · DOM `fillToCssLayer` · `<img>` 렌더러 · 폰트 CSS ·
 * Skia 폰트 로더) 는 `resolveAssetUrl` 하나로 실행 시점 URL 을 얻는다 — consumer 가 각자
 * 해석하지 않는다 (HC6).
 *
 * 실행 문맥 (builder · Preview iframe · publish · 정적 내보내기) 마다 해석기를 하나 둔다.
 * 구현은 `setAssetUrlResolverLoader` 로 넘긴 loader 가 첫 필요 시점에 불러온다 (initial 밖).
 * 소비 지점이 동기 함수라 해석기는 동기 조회 (`resolveSync`) · 비동기 준비 (`ensure`) ·
 * 재렌더 알림 (`subscribe`) 셋으로 나뉜다.
 *
 * dual-read: `asset:` 이 아닌 값 (dataURL · http · 상대 경로) 은 그대로 통과한다.
 * 해석되지 않은 `asset:` 은 `null` — consumer 는 그리지 않고 네트워크 요청도 내지 않는다.
 *
 * 이 파일은 builder · Preview 공용 initial chunk 에 실린다 (HC2) — 동기 해석 핵심만 둔다.
 * 비동기 준비 · 문서 전수 순회는 `assetRefAsync.ts`, 바이트 유틸은 `@composition/shared/assets`.
 */

export const ASSET_REF_PREFIX = "asset:sha256-";

export type AssetRef = `asset:sha256-${string}`;

export function isAssetRef(value: unknown): value is AssetRef {
  return typeof value === "string" && /^asset:sha256-[0-9a-f]{64}$/.test(value);
}

export interface AssetUrlResolver {
  /** 준비된 참조의 실행 시점 URL. 준비 전이면 `null`. */
  resolveSync(ref: AssetRef): string | null;
  /** 참조 바이트를 준비한다. 없는 자산은 조용히 건너뛴다 (결과는 `resolveSync`). */
  ensure(refs: Iterable<AssetRef>): Promise<void>;
  /** 새 참조가 준비될 때 호출. 반환값은 구독 해제. */
  subscribe(listener: () => void): () => void;
}

let activeResolver: AssetUrlResolver | null = null;
let resolverLoader: (() => Promise<AssetUrlResolver>) | null = null;
let resolverLoading: Promise<AssetUrlResolver | null> | null = null;
let unsubscribeActive: (() => void) | undefined;
const listeners = new Set<() => void>();
/** 렌더 중 miss 난 참조 — 한 번만 요청한다 (참조 공개 전 바이트 저장 계약 §3.1 — 문서에
 *  보인 참조의 바이트가 없으면 계속 없다). */
const requested = new Set<string>();
let requestBatch: AssetRef[] = [];

export function setAssetUrlResolver(resolver: AssetUrlResolver | null): void {
  unsubscribeActive?.();
  activeResolver = resolver;
  resolverLoading = null;
  unsubscribeActive = resolver?.subscribe(() => {
    for (const listener of [...listeners]) listener();
  });
}

export function setAssetUrlResolverLoader(
  loader: (() => Promise<AssetUrlResolver>) | null,
): void {
  resolverLoader = loader;
}

export function loadAssetUrlResolver(): Promise<AssetUrlResolver | null> {
  if (activeResolver || !resolverLoader) return Promise.resolve(activeResolver);
  resolverLoading ??= resolverLoader().then(
    (resolver) => {
      if (activeResolver !== resolver) setAssetUrlResolver(resolver);
      return resolver;
    },
    () => null,
  );
  return resolverLoading;
}

/**
 * consumer 단일 해석 함수. `asset:` 이 아니면 그대로, 준비된 `asset:` 은 실행 시점 URL,
 * 준비 전이거나 해석기가 없으면 `null`. 준비 전이면 준비를 요청하고 (microtask 로 묶어 한 번),
 * 준비되면 `subscribeAssetUrls` 구독자에게 알린다 — 동기 consumer 는 구독해서 다시 그린다.
 */
export function resolveAssetUrl(url: string | undefined | null): string | null {
  if (typeof url !== "string") return null;
  if (!url.startsWith(ASSET_REF_PREFIX)) return url;
  const ready = activeResolver?.resolveSync(url as AssetRef);
  if (ready) return ready;
  if (
    (activeResolver || resolverLoader) &&
    !requested.has(url) &&
    isAssetRef(url)
  ) {
    requested.add(url);
    if (requestBatch.push(url) === 1) {
      queueMicrotask(() => {
        const batch = requestBatch;
        requestBatch = [];
        void loadAssetUrlResolver().then((resolver) => resolver?.ensure(batch));
      });
    }
  }
  return null;
}

/** 해석기 설치 전에도 구독할 수 있다 — 설치되면 그 해석기의 알림을 전달한다. */
export function subscribeAssetUrls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

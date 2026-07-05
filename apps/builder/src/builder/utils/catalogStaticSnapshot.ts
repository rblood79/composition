/**
 * ADR-916 P2-CAT ① — catalog 정적 참조 계약 (strict resolve 파이프라인 + 스냅샷).
 *
 * 조상 체인 propagation(`buildSpecNodeData` getPropagationAncestors +
 * applyParentPropagationProps)의 Rust tree.rs 이관 선결 계약. 이 계층은
 * catalog(`resolveComponentRule`, shared) + token(`resolveToken`, specs)을 **동시
 * import 가능한 유일 계층**(builder)이라 여기에 둔다. JS 가 theme-static 층을 미리
 * 숫자로 해석한 스냅샷을 만들고, P2-PROP 에서 `initCompositionEngineWasm()` 이
 * 이 스냅샷을 WASM 에 1회 주입한다(본 파일은 배선 없음 — dormant 회피).
 *
 * **계약 조항** (breakdown §2-CAT):
 *  1. 사영 = key allowlist (fontSize/lineHeight/iconSize). 서브트리 사영 금지 →
 *     height:"auto" / nested indicator{} / sizes 내 borderRadius TokenRef 를
 *     범위에서 제거(C1·H5 구조적 봉합).
 *  2. defaultSize fallback 1급: lookup(type,size)=sizes[size] ?? sizes[defaultSize].
 *     fallback 을 스냅샷에 사전 전개하지 않음(L2 검증 불가) — defaultSize 를 값으로
 *     보존하고 resolve 시점에 처리. Negative="미존재 type→None"만.
 *  C3. strict resolve = resolveToken → parsePxValue → isFinite assert.
 *      `Number()` 금지(NaN 침묵 통과 차단). "auto"/미정의 토큰/nested → throw.
 *
 * TokenRef 문자열이 WASM 경계를 넘지 않음 → 값 사본 repo 미보관(값 이중화 0).
 */
import { resolveToken, parsePxValue } from "@composition/specs";
import { getComponentRulesTable } from "@composition/shared";
import type { ComponentRuleSize } from "@composition/shared";

type Theme = "light" | "dark";

/**
 * 조항 1 — 사영 대상 key allowlist. 이 3개 key **만** 스냅샷에 이관한다.
 * height/borderRadius/indicator/minHeight/... 는 명시적 범위 밖.
 */
const METRIC_KEYS = ["fontSize", "lineHeight", "iconSize"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

/** (type×size) 사영 결과 — allowlist key 만, 값은 유한 숫자. */
export type CatalogMetric = Partial<Record<MetricKey, number>>;

/**
 * 단일 컴포넌트 type 의 스냅샷 — defaultSize(값 보존) + size별 metric.
 * defaultSize 는 catalog 상 optional(`ComponentRule.defaultSize?`) — 미정의 시
 * fallback 대상이 없음(조항 2: sizes[size] 만, fallback leg 없음).
 */
export interface CatalogTypeEntry {
  defaultSize: string | undefined;
  sizes: Map<string, CatalogMetric>;
}

/** type → { defaultSize, sizes: size → CatalogMetric }. */
export type CatalogStaticSnapshot = Map<string, CatalogTypeEntry>;

/**
 * 조항 C3 — strict resolve. TokenRef 를 숫자로 강제하되 `Number()` 를 쓰지 않고
 * `parsePxValue` 경유 + isFinite assert 로 비수치 침묵 통과를 차단한다.
 *
 * - raw number → 그대로.
 * - TokenRef(`{...}`) → resolveToken → parsePxValue. resolveToken 은 미정의 시
 *   원문 문자열을 반환하므로(throw 안 함), 그 비수치를 아래 assert 가 잡는다.
 * - "auto" / 임의 문자열 → parsePxValue fallback(NaN) → assert throw.
 *
 * @throws 숫자로 해석 불가능한 값(사영 밖 값이 allowlist 로 새어든 경우).
 */
export function resolveStaticMetric(value: unknown, theme: Theme): number {
  const raw =
    typeof value === "string" && value.startsWith("{")
      ? resolveToken(value as `{${string}}`, theme)
      : value;
  // parsePxValue 는 number|F 반환 — fallback 을 NaN 으로 두어 비수치를 sentinel 화.
  const num = parsePxValue(raw, Number.NaN);
  if (!Number.isFinite(num)) {
    throw new Error(
      `[catalogStaticSnapshot] strict resolve 실패 — 숫자로 해석 불가: ${JSON.stringify(
        value,
      )} (resolved: ${JSON.stringify(raw)}). allowlist key 는 숫자/typography TokenRef 만 허용.`,
    );
  }
  return num;
}

/**
 * 조항 1 — 단일 size 규칙에서 allowlist key 만 사영. 서브트리 통째 복사 금지.
 * 각 값은 strict resolve(C3) 로 숫자 강제.
 */
function projectMetric(size: ComponentRuleSize, theme: Theme): CatalogMetric {
  const metric: CatalogMetric = {};
  for (const key of METRIC_KEYS) {
    const v = size[key];
    if (v !== undefined) {
      metric[key] = resolveStaticMetric(v, theme);
    }
  }
  return metric;
}

/**
 * catalog SSOT(componentRulesTable) → (type×size) 숫자 metrics 스냅샷.
 * doc override 미소비 — theme rule base 만(조항 4 는 resolveStaticComponentRule 이 강제).
 * defaultSize 는 값으로 보존(사전 전개 금지, 조항 2).
 */
export function buildCatalogStaticSnapshot(
  theme: Theme,
): CatalogStaticSnapshot {
  const table = getComponentRulesTable();
  const snapshot: CatalogStaticSnapshot = new Map();
  for (const [type, rule] of Object.entries(table)) {
    const sizes = new Map<string, CatalogMetric>();
    for (const [sizeName, size] of Object.entries(rule.sizes)) {
      sizes.set(sizeName, projectMetric(size, theme));
    }
    snapshot.set(type, { defaultSize: rule.defaultSize, sizes });
  }
  return snapshot;
}

/**
 * 조항 2 — defaultSize fallback lookup. sizes[size] ?? sizes[defaultSize].
 * live 소비자 3경로(buildSpecNodeData:1124 / implicitStyles:212 / StoreRenderBridge:553)
 * 의 `sizes[size] ?? sizes[defaultSize]` 와 동형. 미존재 type → undefined(Negative).
 */
export function lookupCatalogMetric(
  snapshot: CatalogStaticSnapshot,
  type: string,
  size: string,
): CatalogMetric | undefined {
  const entry = snapshot.get(type);
  if (!entry) return undefined;
  const direct = entry.sizes.get(size);
  if (direct) return direct;
  // defaultSize 미정의 컴포넌트는 fallback leg 없음(조항 2).
  return entry.defaultSize ? entry.sizes.get(entry.defaultSize) : undefined;
}

/**
 * P2-CAT ② L1 — 스냅샷 `Map` → JSON string (WASM 경계 계약).
 *
 * wasm.rs 관습(`nodes_json: &str`)과 동형 — 스냅샷은 JSON string 으로 경계를 넘고,
 * Rust `catalog.rs::inject_catalog_snapshot` 이 역직렬화해 `thread_local` static 에
 * 저장한다. `Map` 은 `JSON.stringify` 불가라 plain object 로 변환한다.
 *
 * - `defaultSize` 미정의(optional) 시 **키 생략** → Rust 는 `Option<String>` = None 수신.
 * - fallback 사전 전개 금지(조항 2) — defaultSize 는 값으로만 담고, resolve 시점
 *   fallback 은 Rust `lookup_catalog_metric` 이 JS `lookupCatalogMetric` 과 동형 처리.
 */
export function serializeCatalogSnapshot(
  snapshot: CatalogStaticSnapshot,
): string {
  const obj: Record<
    string,
    { defaultSize?: string; sizes: Record<string, CatalogMetric> }
  > = {};
  for (const [type, entry] of snapshot) {
    const sizes: Record<string, CatalogMetric> = {};
    for (const [sizeName, metric] of entry.sizes) {
      sizes[sizeName] = metric;
    }
    obj[type] = entry.defaultSize
      ? { defaultSize: entry.defaultSize, sizes }
      : { sizes };
  }
  return JSON.stringify(obj);
}

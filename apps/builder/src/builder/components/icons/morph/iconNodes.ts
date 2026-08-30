/**
 * 이름 ↔ IconNode 해석 (ADR-197 Phase 1)
 *
 * morph 파이프라인의 유일한 입구다. 두 가지를 한다:
 *
 * 1. **참조 고정** — 같은 이름은 항상 같은 `IconNode` 객체를 돌려준다. driver 의
 *    plan 캐시가 `WeakMap<src, WeakMap<dst, Plan>>` 이라 참조가 매번 바뀌면
 *    전환마다 `buildPlan` 이 다시 돈다 (R2).
 * 2. **입력 검증** — upstream core 는 지원하지 않는 태그를 만나면 `throw` 하고
 *    (`core/normalize.ts` 의 default) driver 에는 catch 가 없다. React render 중
 *    올라오면 error boundary 없는 패널이 통째로 죽으므로, 여기서 걸러 `null` 을
 *    돌려준다 (R9).
 *
 * 주의 — upstream 계약에서 `string` 은 **원시 `d` 문자열**이지만, 빌더 크롬의
 * 계약에서 `string` 은 **lucide 레지스트리 이름**이다 (`getIconData`). 그래서
 * 이름은 반드시 이 함수를 거쳐 `IconNode` 로 바뀐 뒤 driver 로 간다.
 */

import { getIconData } from "@composition/specs";
import { canonicalD } from "./dom/index";
import type { IconNode } from "./core/types";

/** 빌더 크롬의 아이콘 입력 — 레지스트리 이름 또는 IconNode 직접 전달. */
export type MorphIconInput = string | IconNode;

/** upstream `core/normalize.ts` 가 그리는 태그. 그 밖은 throw 대상이다. */
const SUPPORTED_TAGS: ReadonlySet<string> = new Set([
  "path",
  "line",
  "circle",
  "ellipse",
  "rect",
  "polyline",
  "polygon",
]);

/** 이름 → IconNode. `null` 도 캐시한다 (없는 이름을 매 render 조회하지 않도록). */
const byName = new Map<string, IconNode | null>();

const warn = (message: string): void => {
  if (import.meta.env.DEV) console.warn(`[MorphIcon] ${message}`);
};

/** `LucideIconData` (paths + circles) → `IconNode` 무손실 변환. */
function toIconNode(name: string): IconNode | null {
  const data = getIconData(name);
  if (!data) return null;
  const node: IconNode = [
    ...data.paths.map((d) => ["path", { d }] as const),
    ...(data.circles ?? []).map(
      (c) => ["circle", { cx: c.cx, cy: c.cy, r: c.r }] as const,
    ),
  ];
  return node.length > 0 ? node : null;
}

/** 지원 태그만 들어 있는지 — 하나라도 아니면 그리기 전에 거른다. */
function hasOnlySupportedTags(node: IconNode): boolean {
  for (const [tag] of node) {
    if (!SUPPORTED_TAGS.has(tag)) {
      warn(`unsupported tag <${tag}> — 렌더하지 않는다`);
      return false;
    }
  }
  return node.length > 0;
}

/**
 * 이름이면 레지스트리 조회 (모듈 캐시로 참조 고정), IconNode 면 태그 검증 후 통과.
 * 그릴 수 없는 입력은 예외 대신 `null` — 호출부는 렌더 0 으로 처리한다.
 */
export function resolveIconInput(input: MorphIconInput): IconNode | null {
  if (typeof input === "string") {
    const cached = byName.get(input);
    if (cached !== undefined) return cached;
    const node = toIconNode(input);
    if (!node) warn(`알 수 없는 아이콘 이름: ${input}`);
    byName.set(input, node);
    return node;
  }
  return hasOnlySupportedTags(input) ? input : null;
}

/**
 * 정지 상태의 `d`. 태그 검증을 통과해도 `d` 문자열 자체가 깨져 있으면
 * parse 가 throw 하므로 여기서 한 번 더 막는다 (R9).
 */
export function safeCanonicalD(node: IconNode): string | null {
  try {
    return canonicalD(node);
  } catch (error) {
    warn(`canonical d 계산 실패 — ${String(error)}`);
    return null;
  }
}

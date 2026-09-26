/**
 * tablet · mobile override 를 켤 때 seed 로 쓸 **catalog 기본값** (ADR-236 후속, 2026-09-26).
 *
 * "켜기 = 현재 값 복사" 의 현재 값은 인라인 → catalog 기본값 → Canvas 기본 순으로 정해진다. store 액션
 * (`setResponsiveStyleOverrideEnabled`) 은 인라인과 자기 tier 만 읽고, catalog 해석
 * (`resolveContainerStylesFallback` — Canvas 엔진과 같은 함수) 은 canvas layout 모듈이라 store 가
 * import 하지 않는다. 그래서 메뉴가 이 값을 계산해 액션에 넘긴다. 없던 CSS 초기값 (row · stretch · 0 ·
 * flex) 을 넣으면 catalog 가 기본값을 주는 타입에서 켜는 순간 모양이 바뀌었다.
 */
import { resolveContainerStylesFallback } from "../../../workspace/canvas/layout/engines/implicitStyles";
import { resolveDefaultDisplay } from "../../../workspace/canvas/layout/engines/defaultDisplay";

type Seed = Partial<Record<string, string>>;

function toSeedValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  // 토큰 참조 (`{spacing.md}`) 는 seed 로 옮길 수 있는 값이 아니다 — 초기값 경로로 둔다.
  if (trimmed.length === 0 || trimmed.startsWith("{")) return undefined;
  return trimmed;
}

/** CSS 한 줄 shorthand (`4px 12px`) → 4 변 */
function expandBox(value: string): [string, string, string, string] | null {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return null;
  const [top, right = top, bottom = top, left = right] = parts;
  return [top, right, bottom, left];
}

export function resolveTierSeedDefaults(
  type: string | undefined,
  size: string | undefined,
): Seed {
  if (!type) return {};
  const seed: Seed = {};
  const fallback = resolveContainerStylesFallback(type.toLowerCase(), {}, size);
  for (const [key, raw] of Object.entries(fallback)) {
    const value = toSeedValue(raw);
    if (value !== undefined) seed[key] = value;
  }
  if (seed.gap !== undefined) {
    seed.rowGap ??= seed.gap;
    seed.columnGap ??= seed.gap;
  }
  if (seed.padding !== undefined) {
    const box = expandBox(seed.padding);
    if (box) {
      seed.paddingTop ??= box[0];
      seed.paddingRight ??= box[1];
      seed.paddingBottom ??= box[2];
      seed.paddingLeft ??= box[3];
    }
  }
  seed.display ??= resolveDefaultDisplay(type);
  return seed;
}

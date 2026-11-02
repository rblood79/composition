/**
 * ADR-297 — rule variant 의 칠 (배경 · 글자 · 테두리) 을 조건 트리로 (Decision 1). 우선순위 = 키 순서 — Canvas 는
 * `evaluatePaint` 로 평가하고 생성 CSS 는 같은 트리를 `compileConditionTree` 로 compile 한다 (`generate-css.ts`
 * `variantPaintCssFor`). 옛 `fill` · `colors` 형식과 그 변환은 Phase 3i 에서 지웠다 (변환 codemod 는
 * `apps/builder/scripts/adr297-rule-to-tree.ts` 에 기록으로 남는다).
 *
 * leaf `null` = 「catalog 값 없음」 을 명시한 가지 — 앞 값을 덮어 값 없음으로 만든다 (현행 Canvas 의 「선택됐는데
 * selected 칠이 없으면 배경 없음」).
 */
import {
  evaluateConditionTree,
  isConditionNode,
  type ConditionSet,
  type ConditionalValue,
} from "./conditionTree";

/** 칠 값 — TokenRef · CSS 값 문자열, 또는 「값 없음」 `null`. */
export type PaintValue = string | null;
export type PaintTree = ConditionalValue<PaintValue>;

/**
 * 바탕 위 그라데이션 한 장 (ADR-297 후속 ⑥ — S2 `Button.tsx` 의 `gradient` 요소 `backgroundImage`). 방향은 CSS
 * 모서리 키워드 — 각도가 상자 비율로 정해진다 (`to bottom right`). 정지점 = [색, 위치 %].
 */
export interface PaintLinearGradient {
  readonly to: "bottom right";
  readonly stops: readonly (readonly [color: string, percent: number])[];
}
/**
 * 그림 칠 leaf — S2 `linearGradient` macro 의 반환처럼 배열 한 칸. 배열은 조건 노드가 아니라 (`isConditionNode`)
 * 트리의 leaf 로 읽힌다. `null` = 그림 없음 (S2 `isDisabled: 'none'`).
 */
export type PaintImage = readonly [PaintLinearGradient];
export type PaintImageTree = ConditionalValue<PaintImage | null>;

/** variant 의 상태 의존 칠 (트리 형식). */
export interface ComponentRulePaint {
  readonly backgroundColor?: PaintTree;
  /** 바탕색 위에 얹는 그림 (그라데이션) — 같은 조건 집합으로 평가한다. */
  readonly backgroundImage?: PaintImageTree;
  readonly color?: PaintTree;
  readonly borderColor?: PaintTree;
}

/** 트리의 그림 칠 — 조건 집합에 맞는 그라데이션 (없으면 undefined). */
export function evaluatePaintImage(
  tree: PaintImageTree | undefined,
  conditions: ConditionSet,
): PaintLinearGradient | undefined {
  return evaluateConditionTree(tree, conditions)?.[0];
}

/** rule 의 variant 가운데 그림 칠을 가진 것이 있다 — 작성한 바탕이 그 그림을 끈다 (두 consumer). */
export function ruleHasPaintImage(
  variants:
    | Readonly<Record<string, { readonly paint?: ComponentRulePaint }>>
    | undefined,
): boolean {
  return Object.values(variants ?? {}).some(
    (variant) => variant.paint?.backgroundImage !== undefined,
  );
}

/**
 * CSS `linear-gradient(to bottom right, …)` 의 선 — 상자 (w × h) 안 시작 · 끝 점 (CSS Images 3 §3.1.1: 모서리 키워드의
 * 각도는 다른 두 모서리를 잇는 대각선에 수직, 길이 = |w sin θ| + |h cos θ|). Canvas 가 같은 선으로 칠한다.
 */
export function cssCornerGradientLine(
  w: number,
  h: number,
): { start: [number, number]; end: [number, number] } {
  const n2 = w * w + h * h;
  if (n2 === 0) return { start: [0, 0], end: [0, 0] };
  // (방향 (h, w)/√n2 · 반 길이 wh/√n2 → 중심에서 ±(h, w)·wh/n2)
  const k = (w * h) / n2;
  return {
    start: [w / 2 - h * k, h / 2 - w * k],
    end: [w / 2 + h * k, h / 2 + w * k],
  };
}

/** 그라데이션의 CSS 값 — 색은 TokenRef 면 `toCss` 로 (생성 CSS 는 변수). */
export function paintGradientCss(
  gradient: PaintLinearGradient,
  toCss: (color: string) => string = (color) => color,
): string {
  return `linear-gradient(to ${gradient.to}, ${gradient.stops
    .map(([color, percent]) => `${toCss(color)} ${percent}%`)
    .join(", ")})`;
}

/** 한 rule 의 칠이 Canvas 에서 닿는 축 (`paintReach.ts` `rulePaintReach`). */
export interface PaintReach {
  /** 선택될 수 있다 — 선택이면 selected 칸만 칠한다 (없으면 값 없음 `null`). */
  readonly selectable?: boolean;
  /** 받는 fillStyle 값 — outline · subtle 값이면 그 칸만 칠한다 (없으면 값 없음 `null`). */
  readonly fillStyles?: readonly string[];
  /** staticColor (black · white) 가 닿는다 — 칠 트리에 `staticColor` 가지가 있다 (ADR-297 Phase 3). */
  readonly staticColor?: boolean;
}

const leafOf = (tree: unknown): string | undefined =>
  tree === undefined || tree === null
    ? undefined
    : isConditionNode(tree)
      ? leafOf(tree.default)
      : (tree as string);

/** evaluator 결과의 `null` (값 없음) 을 `undefined` 로. */
export function evaluatePaint(
  tree: PaintTree | undefined,
  conditions: ConditionSet,
): string | undefined {
  return evaluateConditionTree(tree, conditions) ?? undefined;
}

/**
 * 트리의 한 가지에 **적힌** 값 — 경로의 키 (`"isHovered"` · `"fillStyle", "outline"` …) 를 따라 내려간 노드의
 * `default` (leaf 면 그 값). 평가가 아니라 그 자리를 읽는다: 투영기 (library · 정의) 가 「hover 값이 따로 적혔나」
 * 를 가른다. `null` (값 없음) 은 `undefined`.
 */
export function paintAt(
  tree: PaintTree | undefined,
  ...path: readonly string[]
): string | undefined {
  let node: unknown = tree;
  for (const key of path) {
    if (!isConditionNode(node)) return undefined;
    node = node[key];
  }
  return leafOf(node);
}

/**
 * `paintGradientCss` 의 역 — 정의가 record visual (`backgroundImage`) 에 굳힌 그라데이션을 Canvas 가 다시 읽는다
 * (`authoredPaintCanvas.ts`). 이 모양이 아닌 CSS (url · 각도 그라데이션) 는 undefined.
 */
export function parsePaintGradientCss(
  css: string,
): PaintLinearGradient | undefined {
  const body = /^linear-gradient\(to bottom right,\s*(.+)\)$/.exec(css.trim());
  if (!body) return undefined;
  const stops = body[1]!
    .split(/,(?![^(]*\))/)
    .map((stop) => /^(.+?)\s+(-?\d+(?:\.\d+)?)%$/.exec(stop.trim()));
  if (stops.length < 2 || stops.some((stop) => !stop)) return undefined;
  return {
    to: "bottom right",
    stops: stops.map((stop) => [stop![1]!, Number(stop![2])] as const),
  };
}

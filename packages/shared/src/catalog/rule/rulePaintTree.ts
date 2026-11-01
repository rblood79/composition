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

/** variant 의 상태 의존 칠 (트리 형식). */
export interface ComponentRulePaint {
  readonly backgroundColor?: PaintTree;
  readonly color?: PaintTree;
  readonly borderColor?: PaintTree;
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

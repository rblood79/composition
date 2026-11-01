/**
 * ADR-297 — rule variant 의 칠 (배경 · 글자 · 테두리) 을 조건 트리로 (Decision 1). 우선순위 = 키 순서.
 *
 * 전환 단계 (Phase 1 · 2): 트리는 Canvas 의 현행 순서 (Decision 4 — 옛 `resolveCatalogPaint` 삼항 사슬) 를 그대로
 * 담는다 — 기본 → hover · pressed → fillStyle (outline · subtle) → quiet → selected (→ emphasized). 생성 CSS 는
 * Phase 3 에서 `compileConditionTree` 로 옮길 때까지 옛 블록 순서 (`legacyVariantPaint` — breakdown §3
 * `legacyOrder`) 로 같은 트리를 읽는다.
 *
 * leaf `null` = 「catalog 값 없음」 을 명시한 가지 — 앞 값을 덮어 값 없음으로 만든다 (현행 Canvas 의 「선택됐는데
 * selected 칠이 없으면 배경 없음」).
 */
import type { CatalogFillStyleValues } from "../../types/catalog-style.types";
import {
  evaluateConditionTree,
  isConditionNode,
  type ConditionSet,
  type ConditionalValue,
} from "./conditionTree";

// ── 옛 형식 (전환 단계 — 생성 CSS 의 옛 블록 순서 입력 · codemod 입력, Phase 3 에서 삭제) ──

/** 옛 `fill.<style>` 의 상태 칸 (ADR-908 `FillStateTokens` 투영). */
export interface LegacyFillState {
  base: string;
  hover?: string;
  pressed?: string;
  selected?: string;
  selectedHover?: string;
  selectedPressed?: string;
  emphasizedSelected?: string;
}
/** 옛 `fill` — fillStyle (default · outline · subtle) × 상태 + quiet + 투명도. */
export interface LegacyFill {
  default: LegacyFillState;
  outline?: Partial<LegacyFillState>;
  subtle?: Partial<LegacyFillState>;
  quiet?: Partial<LegacyFillState>;
  alpha?: number;
}
/** 옛 `colors` — 글자 · 테두리와 그 상태 접미사 키. */
export interface LegacyColors {
  text?: string;
  textHover?: string;
  border?: string;
  borderHover?: string;
  outlineText?: string;
  outlineBorder?: string;
  subtleText?: string;
  selectedText?: string;
  selectedBorder?: string;
  emphasizedSelectedText?: string;
  emphasizedSelectedBorder?: string;
}
/** 옛 형식의 variant 칠 (`fill` · `colors`). */
export interface LegacyVariantPaint {
  fill: LegacyFill;
  colors?: LegacyColors;
}

/** 칠 값 — TokenRef · CSS 값 문자열, 또는 「값 없음」 `null`. */
export type PaintValue = string | null;
export type PaintTree = ConditionalValue<PaintValue>;

/** variant 의 상태 의존 칠 (트리 형식). */
export interface ComponentRulePaint {
  readonly backgroundColor?: PaintTree;
  readonly color?: PaintTree;
  readonly borderColor?: PaintTree;
}

type Node = Record<
  string,
  PaintTree | Readonly<Record<string, PaintTree | undefined>> | undefined
>;

const compact = (node: Node): Node | undefined => {
  for (const key of Object.keys(node))
    if (node[key] === undefined) delete node[key];
  return Object.keys(node).length > 0 ? node : undefined;
};

/** `{ default: base, isHovered, isPressed }` — 한 fillStyle 의 상태 칠 (`S.hover ?? S.base`). */
function stateNode(
  states: Partial<LegacyFillState> | undefined,
): PaintTree | undefined {
  if (!states) return undefined;
  const node = compact({
    default: states.base,
    isHovered: states.hover,
    isPressed: states.pressed,
  });
  // 상태 하나뿐이면 leaf 로 (`fillStyle: { outline: "{color.transparent}" }`).
  return node && Object.keys(node).length === 1 && "default" in node
    ? (node.default as PaintTree)
    : node;
}

/** 한 rule 의 칠이 Canvas 에서 닿는 축 (`paintReach.ts` `rulePaintReach`). */
export interface PaintReach {
  /** 선택될 수 있다 — 선택이면 selected 칸만 칠한다 (없으면 값 없음 `null`). */
  readonly selectable?: boolean;
  /** 받는 fillStyle 값 — outline · subtle 값이면 그 칸만 칠한다 (없으면 값 없음 `null`). */
  readonly fillStyles?: readonly string[];
}

/**
 * 옛 `fill.<style>` · `colors` 접미사 키 → 트리 (전환 codemod 와 같은 변환). 트리는 현행 Canvas 사슬
 * (`resolveCatalogPaint`) 의 뜻을 그대로 담는다 — 선택 · outline · subtle 은 그 칸만 칠하는 배타 가지라, 닿는 축
 * (`reach`) 에서 칸이 비면 `null` 가지를 둔다.
 */
export function variantPaintTree(
  variant: LegacyVariantPaint,
  fillStyleValues?: CatalogFillStyleValues,
  reach: PaintReach = {},
): ComponentRulePaint {
  const fill = variant.fill;
  const c: LegacyColors = variant.colors ?? {};
  const outline = fillStyleValues?.outline ?? "outline";
  const subtle = fillStyleValues?.subtle ?? "subtle";
  const reaches = (value: string) => reach.fillStyles?.includes(value) === true;
  const selectable = reach.selectable === true;
  const d = fill.default;
  // 옛 사슬: outline · subtle 에서는 hover 글자 · 테두리를 읽지 않는다. 그 칸이 비고 hover 값이 있으면 트리로
  //   담을 수 없다 (「hover 아님」 조건이 없다) — 닿는 축에서는 표에 0 건이라 멈춘다.
  const exclusive = (
    value: string,
    slot: string | undefined,
    hover: string | undefined,
    key: string,
  ) => {
    if (slot === undefined && hover !== undefined && reaches(value))
      throw new Error(`ADR297_UNREPRESENTABLE_HOVER:${key}:${value}`);
    return slot;
  };
  const fillSlot = (
    states: Partial<LegacyFillState> | undefined,
    value: string,
  ) => stateNode(states) ?? (reaches(value) ? null : undefined);

  const backgroundColor = compact({
    default: d.base,
    isHovered: d.hover,
    isPressed: d.pressed,
    fillStyle: compact({
      [outline]: fillSlot(fill.outline, outline),
      [subtle]: fillSlot(fill.subtle, subtle),
    }) as Record<string, PaintTree> | undefined,
    isQuiet: stateNode(fill.quiet),
    isSelected:
      selectable ||
      d.selected !== undefined ||
      d.emphasizedSelected !== undefined ||
      d.selectedHover !== undefined ||
      d.selectedPressed !== undefined
        ? compact({
            default: d.selected ?? null,
            isHovered: d.selectedHover,
            isPressed: d.selectedPressed,
            isEmphasized: d.emphasizedSelected,
          })
        : undefined,
  });

  const color = compact({
    default: c.text,
    isHovered: c.textHover,
    fillStyle: compact({
      [outline]: exclusive(outline, c.outlineText, c.textHover, "color"),
      [subtle]: exclusive(subtle, c.subtleText, c.textHover, "color"),
    }) as Record<string, PaintTree> | undefined,
    isSelected:
      selectable ||
      c.selectedText !== undefined ||
      c.emphasizedSelectedText !== undefined
        ? compact({
            default: c.selectedText ?? null,
            isEmphasized: c.emphasizedSelectedText,
          })
        : undefined,
  });

  const borderColor = compact({
    default: c.border,
    isHovered: c.borderHover,
    fillStyle: compact({
      [outline]: exclusive(outline, c.outlineBorder, c.borderHover, "border"),
    }) as Record<string, PaintTree> | undefined,
    isSelected:
      selectable ||
      c.selectedBorder !== undefined ||
      c.emphasizedSelectedBorder !== undefined
        ? compact({
            default: c.selectedBorder ?? null,
            isEmphasized: c.emphasizedSelectedBorder,
          })
        : undefined,
  });

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(color ? { color } : {}),
    ...(borderColor ? { borderColor } : {}),
  };
}

// ── 트리 → 옛 모양 (전환 단계의 옛 소비자용) ──

const branch = (tree: PaintTree | undefined, key: string): unknown =>
  isConditionNode(tree) ? (tree as Record<string, unknown>)[key] : undefined;
const leafOf = (tree: unknown): string | undefined =>
  tree === undefined || tree === null
    ? undefined
    : isConditionNode(tree)
      ? leafOf(tree.default)
      : (tree as string);
const statesOf = (
  tree: unknown,
): Partial<LegacyFillState> | undefined => {
  if (tree === undefined || tree === null) return undefined;
  if (!isConditionNode(tree)) return { base: tree as string };
  const out: Partial<LegacyFillState> = {};
  if (tree.default !== undefined) out.base = leafOf(tree.default);
  if (tree.isHovered !== undefined) out.hover = leafOf(tree.isHovered);
  if (tree.isPressed !== undefined) out.pressed = leafOf(tree.isPressed);
  return out;
};

/**
 * 트리 → 옛 `fill` · `colors` (`variantPaintTree` 의 역). 전환 단계에서 옛 형식을 읽는 소비자 (CSS 생성기 · 투영기 ·
 * Skia primitive) 가 트리로 옮긴 rule 도 그대로 읽게 한다 — `defineRulePaintTrees`.
 */
export function legacyVariantPaint(
  paint: ComponentRulePaint,
  fillStyleValues?: CatalogFillStyleValues,
): {
  fill: Omit<LegacyFill, "alpha">;
  colors?: LegacyColors;
} {
  const outline = fillStyleValues?.outline ?? "outline";
  const subtle = fillStyleValues?.subtle ?? "subtle";
  const bg = paint.backgroundColor;
  const bgStyles = branch(bg, "fillStyle") as
    Record<string, unknown> | undefined;
  const bgSelected = branch(bg, "isSelected");
  const def: LegacyFillState = {
    base: leafOf(bg) as string,
  };
  const set = <K extends keyof LegacyFillState>(
    key: K,
    value: unknown,
  ) => {
    const leaf = leafOf(value);
    if (value !== undefined && leaf !== undefined) def[key] = leaf;
  };
  set("hover", branch(bg, "isHovered"));
  set("pressed", branch(bg, "isPressed"));
  if (bgSelected !== undefined) {
    set(
      "selected",
      isConditionNode(bgSelected) ? bgSelected.default : bgSelected,
    );
    set("selectedHover", branch(bgSelected as PaintTree, "isHovered"));
    set("selectedPressed", branch(bgSelected as PaintTree, "isPressed"));
    set("emphasizedSelected", branch(bgSelected as PaintTree, "isEmphasized"));
  }
  const fill: Omit<LegacyFill, "alpha"> = { default: def };
  const outlineStates = statesOf(bgStyles?.[outline]);
  const subtleStates = statesOf(bgStyles?.[subtle]);
  const quietStates = statesOf(branch(bg, "isQuiet"));
  if (outlineStates) fill.outline = outlineStates;
  if (subtleStates) fill.subtle = subtleStates;
  if (quietStates) fill.quiet = quietStates;

  const colors: LegacyColors = {};
  const put = (key: keyof LegacyColors, value: unknown) => {
    const leaf = leafOf(value);
    if (value !== undefined && leaf !== undefined) colors[key] = leaf;
  };
  const text = paint.color;
  const textStyles = branch(text, "fillStyle") as
    Record<string, unknown> | undefined;
  const textSelected = branch(text, "isSelected");
  put("text", isConditionNode(text) ? text.default : text);
  put("textHover", branch(text, "isHovered"));
  put("outlineText", textStyles?.[outline]);
  put("subtleText", textStyles?.[subtle]);
  put(
    "selectedText",
    isConditionNode(textSelected) ? textSelected.default : textSelected,
  );
  put(
    "emphasizedSelectedText",
    branch(textSelected as PaintTree, "isEmphasized"),
  );
  const border = paint.borderColor;
  const borderStyles = branch(border, "fillStyle") as
    Record<string, unknown> | undefined;
  const borderSelected = branch(border, "isSelected");
  put("border", isConditionNode(border) ? border.default : border);
  put("borderHover", branch(border, "isHovered"));
  put("outlineBorder", borderStyles?.[outline]);
  put(
    "selectedBorder",
    isConditionNode(borderSelected) ? borderSelected.default : borderSelected,
  );
  put(
    "emphasizedSelectedBorder",
    branch(borderSelected as PaintTree, "isEmphasized"),
  );
  return Object.keys(colors).length > 0 ? { fill, colors } : { fill };
}

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

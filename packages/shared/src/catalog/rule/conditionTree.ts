/**
 * ADR-297 — catalog rule 의 상태 값 형식: 속성마다 조건을 중첩한 트리 하나 (S2 style macro 의 **형식** 만 —
 * `@react-spectrum/s2` 1.8.1 `style/style-macro.ts:558`). 같은 깊이에서는 **나중 키가 이기고**, 부모의 나중 조건이
 * 앞 가지의 자식 조건을 덮는다 — 우선순위 = 키 순서.
 *
 * 같은 트리를 두 소비자가 읽는다: Canvas · Styles 패널은 `evaluateConditionTree` (조건 집합 → 값 하나),
 * 생성 CSS 는 `compileConditionTree` (선택자 블록 — 조건 선택자를 전부 `:where()` 안에 넣어 블록마다 specificity
 * 가 컴포넌트 클래스 하나로 같고, cascade 가 source order = 트리 순회 순서로만 갈린다. 리뷰 round 1 h1).
 * 두 함수는 순회 `walk` 하나를 공유한다 — 순서 규칙이 한 곳에 있다.
 */

/** Canvas 가 그릴 수 있는 boolean 조건 (RAC render prop 이름 · ADR-295 `touch`). */
export const CONDITIONS = [
  "isHovered",
  "isPressed",
  "isFocusVisible",
  "isDisabled",
  "isSelected",
  "isEmphasized",
  "isStaticColor",
  "isQuiet",
  "isInvalid",
  "touch",
  // ADR-297 Phase 3c — 그룹 안의 마지막이 아닌 항목 (S2 `isInGroup` 의 구분선 — DisclosureGroup). Canvas 도 노드
  //   트리에서 안다 (`catalogDisclosureBorders`).
  "inGroup",
  // ADR-300 — S2 SideNav: the row is the current route (RAC `data-current`, or a closed current
  //   ancestor — S2 `isDescendantSelected`), and the nearest SideNavPanel is collapsed (S2
  //   `[data-side-panel-collapsed]` ancestor). Canvas: `presence.ts` `catalogSideNavState`.
  "isCurrent",
  "isCollapsed",
] as const;
export type Condition = (typeof CONDITIONS)[number];

/**
 * DOM 만 지원하는 상태 (리뷰 round 2 h3) — 트리 안 보통 조건과 같은 자리에 적고, Canvas 조건 집합에는 절대
 * 들어가지 않는다 (그래서 evaluator 는 거짓 가지로 지나간다).
 */
export const DOM_CONDITIONS = [
  "isFocused",
  "isFocusWithin",
  "isDropTarget",
  "isEmpty",
  "inPopover",
  "forcedColors",
  // ADR-297 Phase 3c (사용자 결정 「어휘 확장」 2026-11-01) — `&` 대상 rootSelectors 의 어휘 밖 상태:
  "isAutofilled", // 브라우저 자동 완성 (`:-webkit-autofill` — Input)
  "isDialogTrigger", // DialogTrigger 가 연 Modal (`[data-dialog-trigger]`)
  "isCatalogNode", // 문서 노드 — Builder 자체 위젯이 아님 (`[data-catalog-id]` — ListBox 팝오버)
  "isLink", // 링크로 그려진 항목 (`[href]` — RAC MenuItem · Tab 의 `<a>`)
  // ADR-297 Phase 3g — 수동 sheet 의 부품 상태:
  "isIndeterminate", // RAC Checkbox 의 반쯤 선택 (`[data-indeterminate]` — Canvas 는 selected 로 그린다)
  "isToday", // RAC CalendarCell 의 오늘 (`[data-today]`)
  "isSelectionStart", // RAC RangeCalendar 셀의 기간 시작 · 끝 (`[data-selection-start]` · `-end`)
  "isSelectionEnd",
] as const;
export type DomCondition = (typeof DOM_CONDITIONS)[number];

/**
 * 값으로 가지를 고르는 조건 — `{ variant: { accent: …, primary: … } }`. `staticColor` (ADR-297 Phase 3) 는 S2
 * `staticColor` 의 고정 흑백 (`black` · `white` — `auto` 는 가지가 없다): 유색 바탕 위 칠이 테마 대신 그 색을 쓴다.
 * `fieldButton` (Phase 3c) 은 field 가 소유한 Button 의 크기 (파생 — `presence.ts` `catalogFieldButtonSize`, DOM
 * `data-field-button`): S2 field 버튼은 Button 이 아니라 자기 크기의 모서리를 쓴다.
 */
export const VALUE_CONDITIONS = [
  "variant",
  "size",
  "fillStyle",
  "staticColor",
  "fieldButton",
] as const;
export type ValueCondition = (typeof VALUE_CONDITIONS)[number];

export type ConditionalValue<T> =
  | T
  | ({ default?: ConditionalValue<T> } & {
      [K in Condition | DomCondition]?: ConditionalValue<T>;
    } & {
      [K in ValueCondition]?: Readonly<Record<string, ConditionalValue<T>>>;
    } & {
      /** 다른 대상 (자손 · 형제 · pseudo) 전용 raw 선택자 — `&` 자신의 상태 분기 금지 (G3 (e)). */
      domOnly?: Readonly<Record<string, ConditionalValue<T>>>;
    });

/** 평가 입력 — 참인 boolean 조건과 값 조건의 값. 없는 키 = 거짓. */
export type ConditionSet = {
  readonly [K in Condition | DomCondition]?: boolean;
} & { readonly [K in ValueCondition]?: string };

const BOOLEAN_KEYS: ReadonlySet<string> = new Set([
  ...CONDITIONS,
  ...DOM_CONDITIONS,
]);
const VALUE_KEYS: ReadonlySet<string> = new Set(VALUE_CONDITIONS);

/** 트리 노드인가 (값 leaf 가 아니라 조건 객체). 값 leaf 는 문자열 · 숫자 · boolean · 배열. */
export function isConditionNode(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 한 단계의 조건 — boolean 키 하나, 또는 값 조건 하나와 그 값. */
export type TreeStep =
  | { readonly kind: "flag"; readonly key: Condition | DomCondition }
  | {
      readonly kind: "value";
      readonly key: ValueCondition;
      readonly value: string;
    };

/**
 * 트리를 평가 순서로 돈다 — 각 leaf 를 그 경로 (조건 사슬) 와 함께 낸다. 순서: 노드의 `default` 먼저, 그 뒤 키 순서대로
 * (같은 깊이의 나중 키가 뒤 = 이긴다), 가지 안은 깊이 우선. `domOnly` 는 돌지 않는다 (`domOnlyEntries`).
 */
function walk<T>(
  tree: ConditionalValue<T>,
  path: readonly TreeStep[],
  visit: (leaf: T, path: readonly TreeStep[]) => void,
): void {
  if (!isConditionNode(tree)) {
    if (tree !== undefined) visit(tree as T, path);
    return;
  }
  const node = tree as Record<string, unknown>;
  for (const [key, child] of Object.entries(node)) {
    if (key === "domOnly" || child === undefined) continue;
    if (key === "default") walk(child as ConditionalValue<T>, path, visit);
    else if (BOOLEAN_KEYS.has(key))
      walk(
        child as ConditionalValue<T>,
        [...path, { kind: "flag", key: key as Condition | DomCondition }],
        visit,
      );
    else if (VALUE_KEYS.has(key)) {
      if (!isConditionNode(child))
        throw new Error(`CONDITION_TREE_VALUE_BRANCH:${key}`);
      for (const [value, branch] of Object.entries(child))
        walk(
          branch as ConditionalValue<T>,
          [...path, { kind: "value", key: key as ValueCondition, value }],
          visit,
        );
    } else throw new Error(`CONDITION_TREE_UNKNOWN_KEY:${key}`);
  }
}

function stepHolds(step: TreeStep, conditions: ConditionSet): boolean {
  return step.kind === "flag"
    ? conditions[step.key] === true
    : conditions[step.key] === step.value;
}

interface FlatLeaf<T> {
  readonly path: readonly TreeStep[];
  readonly leaf: T;
}
/** 트리 객체 → 평가 순서의 leaf 목록 (트리는 표 상수라 한 번 펼쳐 둔다 — Canvas 프레임 경로, R2). */
const FLATTENED = new WeakMap<object, readonly FlatLeaf<unknown>[]>();
function flatten<T>(tree: Record<string, unknown>): readonly FlatLeaf<T>[] {
  let flat = FLATTENED.get(tree) as readonly FlatLeaf<T>[] | undefined;
  if (!flat) {
    const leaves: FlatLeaf<T>[] = [];
    walk(tree as ConditionalValue<T>, [], (leaf, path) =>
      leaves.push({ path, leaf }),
    );
    flat = leaves;
    FLATTENED.set(tree, flat);
  }
  return flat;
}

/**
 * 조건 집합에서 트리의 값 — 경로가 전부 참인 leaf 중 평가 순서의 마지막. 맞는 leaf 가 없으면 `undefined`.
 * `default` 는 「다른 가지가 안 맞을 때」 가 아니라 순서의 첫 leaf 라, 같은 규칙 하나로 S2 의 뜻이 나온다.
 */
export function evaluateConditionTree<T>(
  tree: ConditionalValue<T> | undefined,
  conditions: ConditionSet,
): T | undefined {
  if (tree === undefined) return undefined;
  if (!isConditionNode(tree)) return tree as T;
  const flat = flatten<T>(tree);
  // (The last leaf whose path holds wins — scanned from the end, the first hit is the answer.)
  for (let i = flat.length - 1; i >= 0; i -= 1) {
    const { path, leaf } = flat[i];
    if (path.every((step) => stepHolds(step, conditions))) return leaf;
  }
  return undefined;
}

/** compiler 의 조건 → 선택자 · 미디어 (breakdown §3 선택자 맵). */
const FLAG_SELECTORS: Readonly<Record<Condition | DomCondition, string>> = {
  isHovered: "[data-hovered]",
  isPressed: "[data-pressed]",
  isFocusVisible: "[data-focus-visible]",
  isDisabled: "[data-disabled]",
  isSelected: "[data-selected]",
  isEmphasized: "[data-emphasized]",
  isStaticColor: "[data-static-color]",
  isQuiet: "[data-quiet]",
  isInvalid: "[data-invalid]",
  touch: "",
  isFocused: ":is([data-focused],[data-focus-within])",
  isFocusWithin: "[data-focus-within]",
  isDropTarget: "[data-drop-target]",
  isEmpty: "[data-empty]",
  inPopover: ":is(.react-aria-Popover *)",
  forcedColors: "",
  isAutofilled:
    ":is(:-webkit-autofill, :-webkit-autofill:hover, :-webkit-autofill:focus)",
  inGroup: "[data-in-group]:not(:last-child)",
  isCurrent: ":is([data-current], [data-current-ancestor]:not([data-expanded]))",
  isCollapsed: ":is([data-side-panel-collapsed], [data-side-panel-collapsed] *)",
  isDialogTrigger: "[data-dialog-trigger]",
  isCatalogNode: "[data-catalog-id]",
  isLink: "[href]",
  isIndeterminate: "[data-indeterminate]",
  isToday: "[data-today]",
  isSelectionStart: "[data-selection-start]",
  isSelectionEnd: "[data-selection-end]",
};
const VALUE_ATTRIBUTES: Readonly<Record<ValueCondition, string>> = {
  variant: "data-variant",
  size: "data-size",
  fillStyle: "data-fill-style",
  staticColor: "data-static-color",
  fieldButton: "data-field-button",
};

export interface CompiledBlock<T> {
  /** 블록 선택자 — 조건이 없으면 root 그대로, 있으면 `root:where(…)`. */
  readonly selector: string;
  /** 감싸는 `@media` (forced-colors · touch). */
  readonly media?: string;
  readonly property: string;
  readonly value: T;
}

export interface CompileOptions {
  /** `touch` 조건의 미디어 (ADR-295 `S2_TOUCH_MEDIA`) — 트리가 `touch` 를 쓰면 필수. */
  readonly touchMedia?: string;
}

/**
 * 트리 → CSS 블록 (평가 순서 = source order). 조건 선택자는 전부 `:where()` 안이라 모든 블록의 specificity 가
 * root 와 같고, 그래서 cascade 의 승자 = 순서의 마지막 맞는 블록 = `evaluateConditionTree` 의 값.
 * `domOnly` raw 선택자는 트리 블록 뒤에 선언한 specificity 그대로 (대상이 `&` 자신이 아니라 겹치지 않는다).
 */
export function compileConditionTree<T>(
  tree: ConditionalValue<T> | undefined,
  root: string,
  property: string,
  options: CompileOptions = {},
): CompiledBlock<T>[] {
  if (tree === undefined) return [];
  const blocks: CompiledBlock<T>[] = [];
  const media: string[] = [];
  walk(tree, [], (value, path) => {
    let condition = "";
    media.length = 0;
    for (const step of path) {
      if (step.kind === "value")
        condition += `[${VALUE_ATTRIBUTES[step.key]}="${step.value}"]`;
      else if (step.key === "forcedColors")
        media.push("(forced-colors: active)");
      else if (step.key === "touch") {
        if (!options.touchMedia)
          throw new Error("CONDITION_TREE_TOUCH_MEDIA_REQUIRED");
        media.push(options.touchMedia);
      } else condition += FLAG_SELECTORS[step.key];
    }
    blocks.push({
      selector: condition ? `${root}:where(${condition})` : root,
      ...(media.length > 0 ? { media: `@media ${media.join(" and ")}` } : {}),
      property,
      value,
    });
  });
  for (const [selector, branch] of domOnlyEntries(tree))
    walk(branch, [], (value, path) => {
      if (path.length > 0)
        throw new Error(`CONDITION_TREE_DOM_ONLY_NESTED:${selector}`);
      blocks.push({
        selector: selector.replaceAll("&", root),
        property,
        value,
      });
    });
  return blocks;
}

/** 트리의 `domOnly` raw 선택자 가지 (어느 깊이든 — 지금은 루트에서만 읽는다). */
export function domOnlyEntries<T>(
  tree: ConditionalValue<T>,
): [string, ConditionalValue<T>][] {
  if (!isConditionNode(tree)) return [];
  const raw = (tree as { domOnly?: Record<string, ConditionalValue<T>> })
    .domOnly;
  return raw ? Object.entries(raw) : [];
}

/** 트리가 쓰는 조건 키 (boolean · 값 조건) — G3 (b) 정적 게이트 · Canvas 조건 빌더 검사. */
export function conditionTreeKeys(
  tree: ConditionalValue<unknown>,
): Set<string> {
  const keys = new Set<string>();
  walk(tree, [], (_leaf, path) => {
    for (const step of path) keys.add(step.key);
  });
  return keys;
}

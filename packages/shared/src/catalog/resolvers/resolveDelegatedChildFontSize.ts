/**
 * ADR-923 Phase 5 후속 (2026-09-03) — parent rule 의 `structure.composition.delegation[]` 가 자식
 * selector 에 size 별로 선언한 **font-size 변수** 를 px 로 돌려주는 단일 진입점.
 *
 * generated CSS (CSSGenerator Tier 2) 는 같은 항목에서
 *   `.react-aria-{Parent}[data-size="md"] .react-aria-FieldError { --tf-hint-size: var(--text-sm); }`
 *   `.react-aria-{Parent} .react-aria-FieldError { --error-font-size: var(--tf-hint-size); }`
 * 를 emit 하고 base.css 의 `.react-aria-FieldError { font-size: var(--error-font-size, var(--text-xs)) }`
 * 가 그것을 읽는다 — DOM 의 computed font-size 원천이 이 delegation 이다. Skia (buildSpecNodeData) 와
 * layout (fullTreeLayout) 이 같은 항목을 읽어야 FieldError 글자 크기·줄 높이가 세 표면에서 같다
 * (실측: TextField md = 14 · NumberField/DateField/TimeField md = 12, FieldError 자체 rule md 는 12 라
 * 자체 rule 만 읽으면 TextField 가 갈린다).
 *
 * 값은 `var(--text-*)` CSS 변수 참조만 해석한다 (typography 토큰 → px). 항목·size·변수가 없으면
 * undefined — 호출자가 자기 기본 (FieldError 자체 rule size) 으로 돌아간다.
 */
import { typography } from "@composition/specs";

import { resolveComponentRuleByTag } from "./resolveComponentRule";

export const FIELD_ERROR_CHILD_SELECTOR = ".react-aria-FieldError";

/**
 * `:root { line-height: 1.5 }` (`components/styles/theme/shared-tokens.css`) — 활성 CSS bundle 에
 * `.react-aria-FieldError` 줄 높이 규칙이 없어 (base.css 는 font-size·color 만; catalog 파생
 * `generated/FieldError.css` 는 `styles/index.css` 의 import 66개에 **미포함**) DOM 은 이 root 비율을
 * 상속한다 — 실측 14px→21 · 12px→18 (2026-09-03 browser gate).
 *
 * 그래서 catalog FieldError rule 의 `lineHeight`(md = text-xs--line-height 16) 는 **DOM 이 소비하지 않는
 * 값**이다. Skia 가 그 16 을 그대로 쓰면 같은 상자 안 글자의 줄 상자만 5px 좁아진다 (r2 feh3).
 */
export const ROOT_INHERITED_LINE_HEIGHT_RATIO = 1.5;

/** 상속 줄 높이 (px) — 위 root 비율 × 글자 크기. 자식 rule 의 lineHeight 토큰을 대체한다. */
export function resolveInheritedLineHeight(fontSize: number): number {
  return fontSize * ROOT_INHERITED_LINE_HEIGHT_RATIO;
}

/**
 * DOM root 클래스를 다른 rule 의 것으로 쓰는 컴포넌트 — generated CSS 가 그 rule 의 것이므로 delegation
 * 도 그 rule 을 읽어야 DOM 과 같다. TextArea 는 root `react-aria-TextField` 를 D1 권위로 그대로 두고
 * (`TextArea.tsx` 머리말) 자기 CSS 파일이 없다 — TextField.css 의 FieldError hint 규칙이 적용된다.
 * 직접 항목이 있으면 직접 항목이 우선이고, 없을 때만 alias 로 내려간다.
 */
const DOM_ROOT_RULE_ALIAS: Readonly<Record<string, string>> = {
  textarea: "TextField",
};

interface DelegationLike {
  childSelector?: unknown;
  variables?: unknown;
  bridges?: unknown;
}

function cssTextVarToPx(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^var\(--(text-[a-z0-9-]+)\)$/.exec(value.trim());
  if (!m) return undefined;
  const px = (typography as unknown as Record<string, number | undefined>)[
    m[1]
  ];
  return typeof px === "number" ? px : undefined;
}

/** `var(--tf-hint-size)` → `--tf-hint-size` */
function cssVarName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^var\((--[a-z0-9-]+)\)$/i.exec(value.trim());
  return m ? m[1] : undefined;
}

function findDelegation(
  parentType: string,
  childSelector: string,
): { entry: DelegationLike; defaultSize: string | undefined } | undefined {
  const rule = resolveComponentRuleByTag(parentType);
  const list = rule?.structure?.composition?.delegation;
  if (!Array.isArray(list)) return undefined;
  const entry = (list as DelegationLike[]).find(
    (d) => d?.childSelector === childSelector,
  );
  return entry ? { entry, defaultSize: rule?.defaultSize } : undefined;
}

/**
 * parent rule 이 이 자식 selector 에 delegation 항목을 갖는가 — 즉 DOM 이 이 자식을 **parent 가 self-compose
 * 하는 sub-part** 로 그리는가. ADR-923 Phase 5 후속 잔여 1 (2026-09-03, 사용자 판정 A): 그런 자식
 * (field 5 가족의 FieldError) 은 canonical 에 남되 **read-only sub-part** 다 — Preview/publish 가 canonical
 * 자식을 읽지 않으므로 (`renderTextField` 등은 parent props 만 self-compose) 자식의 인라인 style 은 DOM 에
 * 닿을 채널이 없다. Canvas read 경로 (layout · Skia) 는 자식 인라인을 무시하고 delegation + 투영 display 만
 * 소비하며, Properties · Styles 패널은 편집을 parent 로 귀속시킨다. 한 술어를 세 곳이 같이 읽는다.
 */
export function hasDelegatedChild(
  parentType: string,
  childSelector: string,
): boolean {
  if (findDelegation(parentType, childSelector)) return true;
  const alias = DOM_ROOT_RULE_ALIAS[parentType.toLowerCase()];
  return alias ? findDelegation(alias, childSelector) != null : false;
}

/**
 * canonical 자식 type → DOM sub-part class 토큰. parent rule 의 delegation `childSelector` 가 이 토큰을
 * **포함**하면 (정확히 같거나 `:is(.react-aria-Input, .react-aria-TextArea)` 처럼 묶여 있어도) 그 자식은
 * DOM 이 parent 로 self-compose 하는 read-only sub-part 다 (2026-09-03 판정 A — FieldError 잔여 1, Label ·
 * Input · DateInput 확장). Preview/publish 는 canonical 자식을 읽지 않으므로 자식 인라인 style 은 DOM 에
 * 닿을 채널이 없다: Canvas read 경로는 인라인을 무시하고, 패널은 편집을 parent 로 귀속한다.
 */
export const DELEGATED_SUBPART_CHILD_TOKENS: Readonly<
  Record<string, readonly string[]>
> = {
  FieldError: [".react-aria-FieldError"],
  Label: [".react-aria-Label"],
  Input: [".react-aria-Input"],
  DateInput: [".react-aria-DateInput"],
  // 입력 상자 래퍼 (2026-09-03 판정 A — SelectTrigger 확장). DOM 렌더러 (`FormRenderers` · `SelectionRenderers`
  //   · `DateRenderers`) 는 canonical SelectTrigger 를 SelectValue 손자를 찾는 경로로만 쓰고 그 style·props 는
  //   읽지 않는다 — 래퍼 상자는 parent rule delegation 이 그린다: NumberField · DatePicker · DateRangePicker
  //   `.react-aria-Group`, ComboBox `.combobox-container`, SearchField `.searchfield-container`, Select 은 RAC
  //   Select 의 trigger 가 Button 자체 (`.react-aria-Button` 안에 SelectValue + chevron).
  SelectTrigger: [
    ".react-aria-Group",
    ".combobox-container",
    ".searchfield-container",
    ".react-aria-Button",
  ],
};

/**
 * delegation 항목 없이도 DOM 이 parent `label` prop 으로 RAC Label 을 self-compose 하는 parent (2026-09-03 판정
 * A — 그룹 Label 확장). 자식 Label 은 parent `label` 이 undefined 일 때 **텍스트만** legacy 폴백으로 읽히고
 * (`resolvePropagatedText`, ADR-923 r17m1 — Slider 는 그것도 없이 parent prop 만) style 은 어떤 채널로도 DOM 에
 * 닿지 않는다. 이 parent 들은 delegation 이 없어 DOM Label 이 Label rule 로 직접 스타일되므로 Canvas Label rule
 * 과 이미 같다 — 갈리는 것은 자식 인라인뿐이라 같은 read-only sub-part 다. factory 는 Meter · ProgressBar ·
 * Slider 에만 Label 자식을 만들고 CheckboxGroup · RadioGroup 은 옛 문서만 해당한다.
 */
export const SELF_COMPOSED_LABEL_PARENTS: ReadonlySet<string> = new Set([
  "CheckboxGroup",
  "RadioGroup",
  "Meter",
  "ProgressBar",
  "Slider",
]);

/**
 * sub-part 래퍼 — 이 type 이 직계 parent 면 자식의 판정은 **조부모** (field) 에 대해 한다. DatePicker ·
 * DateRangePicker 의 canonical 은 `field > SelectTrigger > DateInput` 이라 DateInput 의 직계는 SelectTrigger 인데,
 * DOM 은 field rule delegation `.react-aria-DateInput` 으로 그린다 (DateField · TimeField 와 같은 판정).
 */
export const SUBPART_HOP_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  "SelectTrigger",
]);

/** 래퍼 안에서 DOM 이 실제로 호스트하는 sub-part 만 hop — `.react-aria-Group > .react-aria-DateInput`. */
export const SUBPART_HOP_CHILD_TYPES: ReadonlySet<string> = new Set([
  "DateInput",
]);

function delegationSelectors(parentType: string): string[] {
  const rule = resolveComponentRuleByTag(parentType);
  const list = rule?.structure?.composition?.delegation;
  if (!Array.isArray(list)) return [];
  return (list as DelegationLike[])
    .map((d) => d?.childSelector)
    .filter((s): s is string => typeof s === "string");
}

function selectorHasToken(selector: string, token: string): boolean {
  const i = selector.indexOf(token);
  if (i < 0) return false;
  const next = selector.charAt(i + token.length);
  return next === "" || !/[A-Za-z0-9_-]/.test(next);
}

function ownsSubpartDirect(childType: string, parentType: string): boolean {
  if (childType === "Label" && SELF_COMPOSED_LABEL_PARENTS.has(parentType))
    return true;
  const tokens = DELEGATED_SUBPART_CHILD_TOKENS[childType];
  if (!tokens) return false;
  const has = (p: string) =>
    delegationSelectors(p).some((sel) =>
      tokens.some((token) => selectorHasToken(sel, token)),
    );
  if (has(parentType)) return true;
  const alias = DOM_ROOT_RULE_ALIAS[parentType.toLowerCase()];
  return alias ? has(alias) : false;
}

/**
 * 이 자식이 read-only sub-part 면 그것을 **소유한 DOM parent type** (직계 parent, 또는 직계가 sub-part 래퍼면
 * 조부모) 을, 아니면 null 을 돌려준다. 패널 안내의 `{parent}` 와 FieldError delegation 글자 크기 조회가 이
 * owner 를 쓴다.
 */
export function resolveDelegatedSubpartOwnerType(
  childType: string | null | undefined,
  parentType: string | null | undefined,
  grandparentType?: string | null,
): string | null {
  if (!childType || !parentType) return null;
  if (ownsSubpartDirect(childType, parentType)) return parentType;
  if (
    grandparentType &&
    SUBPART_HOP_WRAPPER_TYPES.has(parentType) &&
    SUBPART_HOP_CHILD_TYPES.has(childType) &&
    ownsSubpartDirect(childType, grandparentType)
  )
    return grandparentType;
  return null;
}

/**
 * parent rule (또는 DOM root alias) 의 delegation 이 이 자식 type 의 class 토큰을 갖는가 — 또는 parent 가 Label 을
 * self-compose 하는 그룹인가. `grandparentType` 을 주면 직계가 sub-part 래퍼 (SelectTrigger) 일 때 조부모로 판정.
 */
export function isDelegatedSubpartChild(
  childType: string | null | undefined,
  parentType: string | null | undefined,
  grandparentType?: string | null,
): boolean {
  return (
    resolveDelegatedSubpartOwnerType(childType, parentType, grandparentType) !=
    null
  );
}

export function resolveDelegatedChildFontSize(
  parentType: string,
  childSelector: string,
  size?: string | null,
): number | undefined {
  const found =
    findDelegation(parentType, childSelector) ??
    (() => {
      const alias = DOM_ROOT_RULE_ALIAS[parentType.toLowerCase()];
      return alias ? findDelegation(alias, childSelector) : undefined;
    })();
  if (!found) return undefined;
  const { entry, defaultSize } = found;
  const variables = entry.variables;
  if (!variables || typeof variables !== "object") return undefined; // "auto" 는 미지원
  const bySize = variables as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const sizeVars =
    (size ? bySize[size] : undefined) ??
    (defaultSize ? bySize[defaultSize] : undefined) ??
    bySize.md;
  if (!sizeVars) return undefined;

  // font-size 변수 이름: bridges 가 `--error-font-size`/`font-size` 로 재노출하는 변수가 있으면 그것,
  // 없으면 `-size` 로 끝나는 첫 변수 (line-height 변수 제외).
  const bridges = entry.bridges as Record<string, unknown> | undefined;
  const bridged =
    cssVarName(bridges?.["--error-font-size"]) ??
    cssVarName(bridges?.["font-size"]) ??
    cssVarName(bridges?.["--label-font-size"]);
  const key =
    bridged && bridged in sizeVars
      ? bridged
      : Object.keys(sizeVars).find(
          (k) => k.endsWith("-size") && !k.includes("line-height"),
        );
  return key ? cssTextVarToPx(sizeVars[key]) : undefined;
}

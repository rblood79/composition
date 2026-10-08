/**
 * ADR-923 Phase 5 후속 (2026-09-03) — parent rule 의 `structure.composition.delegation[]` 가 자식
 * selector 에 size 별로 선언한 **font-size 변수** 를 px 로 돌려주는 단일 진입점.
 *
 * generated CSS (CSSGenerator Tier 2) 는 같은 항목에서
 *   `.react-aria-{Parent}[data-size="md"] .react-aria-FieldError { --tf-hint-size: var(--text-sm); }`
 *   `.react-aria-{Parent} .react-aria-FieldError { --error-font-size: var(--tf-hint-size); }`
 * 를 emit 하고 base.css 의 `.react-aria-FieldError { font-size: var(--error-font-size, var(--text-xs)) }`
 * 가 그것을 읽는다 — DOM 의 computed font-size 원천이 이 delegation 이다. Canvas 도 같은 항목을
 * 읽어야 (당시 consumer buildSpecNodeData · fullTreeLayout 는 삭제됨) FieldError 글자 크기·줄 높이가 세 표면에서 같다
 * (실측: TextField md = 14 · NumberField/DateField/TimeField md = 12, FieldError 자체 rule md 는 12 라
 * 자체 rule 만 읽으면 TextField 가 갈린다).
 *
 * 값은 `var(--text-*)` CSS 변수 참조만 해석한다 (typography 토큰 → px). 항목·size·변수가 없으면
 * undefined — 호출자가 자기 기본 (FieldError 자체 rule size) 으로 돌아간다.
 */
import { isFieldControlGroup } from "../../domain/componentTraits";
import { typography } from "@composition/rendering";

import { resolveComponentRuleByTag } from "./resolveComponentRule";

export const FIELD_ERROR_CHILD_SELECTOR = ".react-aria-FieldError";

/**
 * description 줄의 자식 selector — DOM 은 `<Text slot="description">` 를 parent props 로 self-compose 한다
 * (`TextField.tsx` 외 13 컴포넌트 동형). 시각은 parent rule 의 이 delegation 이 정한다 (ADR-923 착수 10).
 */
export const DESCRIPTION_CHILD_SELECTOR = '[slot="description"]';

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
  // (DateInput 은 ADR-253 부터 DateInput 원본의 instance 다 — DOM 이 그 노드를 직접 그리고 style 은 노드
  //   자신이 정본이라 sub-part 가 아니다.)
  // (입력 상자 래퍼 — field 의 control `Group` — 는 아래 `ownsSubpartDirect` 가 field type 으로 판정한다
  //   (ADR-256 Phase 6b): 상자의 모양 · 배치는 field rule delegation 이 준다 — NumberField · DatePicker ·
  //   DateRangePicker `.react-aria-Group`, ComboBox `.combobox-container`, SearchField
  //   `.searchfield-container`. DOM 은 Group 노드의 style 을 읽지 않는다.)
};

/**
 * **텍스트 축만** parent 소유인 sub-part (ADR-253) — child type → 그 글자를 소유하는 parent.
 *
 * field · 그룹의 Label · Description · FieldError 는 부품 원본의 instance 이고 DOM 이 그 노드를 직접 그린다
 * (RAC 컴포넌트, parent 의 context 안). 그래서 style 은 부품 노드 자신이 정본이고 — Styles 패널이 그대로 편집하며 Canvas 와 DOM 이
 * 같은 record 를 읽는다 — 글자는 parent 의 `label` prop 이 정본이다 (D2: template 의 `{label}` 자리).
 * 2026-09-03 판정 (Label 을 parent 가 self-compose — delegation 토큰 · 그룹 목록) 을 이 표가 대신한다.
 */
const FIELD_HINT_PARENTS = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  // ADR-256 Phase 3: the reference Checkbox's · Switch's Description · FieldError.
  "Checkbox",
  "Switch",
  "Radio",
] as const;
export const TEXT_ONLY_SUBPART_PARENTS: Readonly<
  Record<string, readonly string[]>
> = {
  // 도움말 · 오류 문구: Description · FieldError 원본의 instance. 글자는 parent 의 `description` ·
  //   `errorMessage` 가 정본이다.
  Description: FIELD_HINT_PARENTS,
  FieldError: FIELD_HINT_PARENTS,
  // Select 의 값 (trigger Button 안의 RAC `SelectValue`): 글자는 Select 의 `placeholder` · 선택 항목이
  //   정본이다. style 은 노드 자신이 정본이다 — DOM 이 그 노드를 직접 그린다 (ADR-253).
  SelectValue: ["Select"],
  // 입력칸: Input 원본의 instance. `placeholder` · `type` 은 parent 의 prop 이 정본이다.
  //   NumberField · ComboBox · SearchField 의 입력칸은 래퍼 (Group · container) 안에 있다 — 래퍼를 건너 field 로 판정한다.
  Input: [
    "TextField",
    "TextArea",
    "ColorField",
    "NumberField",
    "ComboBox",
    "SearchField",
  ],
  Label: [
    "TextField",
    "TextArea",
    "NumberField",
    "SearchField",
    "ColorField",
    "Select",
    "ComboBox",
    "DateField",
    "TimeField",
    "DatePicker",
    "DateRangePicker",
    "CheckboxGroup",
    "RadioGroup",
    "Meter",
    "ProgressBar",
    "Slider",
    "TagGroup",
  ],
};

/**
 * 부모가 그리는 part 노드 → 그것을 그리는 부모 (2026-10-04). DOM 은 부모 RAC 컴포넌트가 그 요소를 직접
 * 만들고 노드를 읽지 않는다 — toggle 의 indicator (`div.checkbox` · `::before` · `div.indicator`),
 * Disclosure trigger 의 chevron (`svg.disclosure-chevron`). (TreeItem 의 chevron 은 ADR-256 Phase 5h 부터
 * 작성자 Button 노드다.) 크기 · 색은 부모 rule 과 부모의 prop · style 이 정한다. 그래서
 * 편집 surface 는 부모로 귀속하고 (FieldError 와 같은 판정) 위치는 지울 수 없다.
 */
export const OWNER_DRAWN_PART_OWNERS: Readonly<Record<string, string>> = {
  CheckboxIndicator: "Checkbox",
  RadioIndicator: "Radio",
  SwitchIndicator: "Switch",
  DisclosureChevron: "DisclosureHeader",
};

/**
 * ADR-256 Phase 3 — 부모가 그리는 part 가 owner 안의 RAC 버튼 안에 있는 경우 (레퍼런스
 * `CheckboxField > CheckboxButton > indicator`): 그 버튼 type → owner type. part 의 owner 는 이 버튼을 건너
 * 찾는다 (Canvas 칠 · 편집 surface · 삭제 금지가 같은 판정).
 */
export const OWNER_DRAWN_PART_HOSTS: Readonly<Record<string, string>> = {
  CheckboxButton: "Checkbox",
  SwitchButton: "Switch",
  RadioButton: "Radio",
};

/**
 * part type 의 owner 가 이 부모 사슬인가 — 직계 parent 가 owner, 또는 직계가 owner 의 버튼 (`OWNER_DRAWN_PART_HOSTS`)
 * 이고 조부모가 owner.
 */
export function catalogOwnerDrawnPartOwnedBy(
  childType: string,
  parentType: string | null | undefined,
  grandparentType?: string | null,
): string | undefined {
  const owner = OWNER_DRAWN_PART_OWNERS[childType];
  if (!owner) return undefined;
  if (parentType === owner) return owner;
  return parentType &&
    OWNER_DRAWN_PART_HOSTS[parentType] === owner &&
    grandparentType === owner
    ? owner
    : undefined;
}

/**
 * sub-part 래퍼 — 이 type 이 직계 parent 면 자식의 판정은 **조부모** (field) 에 대해 한다. DatePicker ·
 * DateRangePicker 의 canonical 은 `field > Group > DateInput` 이라 DateInput 의 직계는 Group 인데 (Group 은
 * field 의 control Group 일 때만 — `hopsWrapper`),
 * DOM 은 field rule delegation `.react-aria-DateInput` 으로 그린다 (DateField · TimeField 와 같은 판정).
 */
export const SUBPART_HOP_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  "Group",
  // Select 의 trigger 는 Button 원본의 instance 다 (ADR-253) — 그 안의 SelectValue 는 Select 로 판정한다.
  "Button",
]);

/**
 * 래퍼 안에서 부모가 두 축을 모두 소유하는 sub-part 만 hop. 지금은 없다 — picker 의 DateInput 은 ADR-253 부터
 * DateInput 원본의 instance 다 (종전: `.react-aria-Group > .react-aria-DateInput`).
 */
export const SUBPART_HOP_CHILD_TYPES: ReadonlySet<string> = new Set([]);

/**
 * **style 축만** parent 소유인 sub-part — child type → 그 style 을 소유하는 field parent. 지금은 없다.
 *
 * 2026-09-04 판정 A 의 대상이던 SelectValue (Select · ComboBox · SearchField — DOM 이 자식의 글자는 읽고 style 은
 * 읽지 않았다) 는 ADR-253 에서 사라졌다: ComboBox · SearchField 의 입력칸은 Input 원본의 instance 이고, Select 의
 * SelectValue 는 DOM 이 노드를 직접 그려 style 이 노드 자신의 것이다 (글자 축만 Select — `TEXT_ONLY_SUBPART_PARENTS`).
 */
export const STYLE_ONLY_SUBPART_PARENTS: Readonly<
  Record<string, readonly string[]>
> = {};

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
  if (OWNER_DRAWN_PART_OWNERS[childType] === parentType) return true;
  // A field's control Group (ADR-256 Phase 6b): the field's rule draws and places it.
  if (isFieldControlGroup(childType, parentType)) return true;
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

/** 직계 parent 가 sub-part 래퍼인가 — Group 은 field 의 control Group 일 때만 (ADR-256 Phase 6b). */
function hopsWrapper(
  parentType: string,
  grandparentType: string | null | undefined,
): boolean {
  return (
    SUBPART_HOP_WRAPPER_TYPES.has(parentType) &&
    (parentType !== "Group" ||
      isFieldControlGroup(parentType, grandparentType ?? undefined))
  );
}

/** 텍스트 · style 두 축이 모두 parent 소유인 sub-part 의 owner (직계 parent, 또는 직계가 래퍼면 조부모). */
function resolveFullSubpartOwnerType(
  childType: string,
  parentType: string,
  grandparentType?: string | null,
): string | null {
  if (ownsSubpartDirect(childType, parentType)) return parentType;
  const drawnBy = catalogOwnerDrawnPartOwnedBy(
    childType,
    parentType,
    grandparentType,
  );
  if (drawnBy) return drawnBy;
  if (
    grandparentType &&
    hopsWrapper(parentType, grandparentType) &&
    SUBPART_HOP_CHILD_TYPES.has(childType) &&
    ownsSubpartDirect(childType, grandparentType)
  )
    return grandparentType;
  return null;
}

/**
 * 이 자식의 **텍스트 축** (글자 · prop) 을 소유한 DOM parent type — 두 축 모두 parent 소유인 sub-part 면 그
 * owner (직계 parent, 또는 직계가 sub-part 래퍼면 조부모), 텍스트 축만 parent 소유인 자식 (Label — ADR-253)
 * 이면 그 parent, 아니면 null. Properties 패널 안내의 `{parent}` 가 이 owner 를 쓴다.
 */
export function resolveDelegatedSubpartOwnerType(
  childType: string | null | undefined,
  parentType: string | null | undefined,
  grandparentType?: string | null,
): string | null {
  if (!childType || !parentType) return null;
  const full = resolveFullSubpartOwnerType(
    childType,
    parentType,
    grandparentType,
  );
  if (full) return full;
  const owners = TEXT_ONLY_SUBPART_PARENTS[childType];
  if (owners?.includes(parentType)) return parentType;
  // 래퍼 (field 의 Group) 안의 부품: 글자는 조부모 field 의 prop 이 정본이다.
  return grandparentType &&
    hopsWrapper(parentType, grandparentType) &&
    owners?.includes(grandparentType)
    ? grandparentType
    : null;
}

/**
 * 이 자식의 **style 축** 을 소유한 DOM parent type — 두 축 모두 parent 소유인 sub-part 면 그 owner, style 축만
 * parent 소유인 자식 (SelectValue) 이면 그 field parent, 아니면 null (텍스트 축만 parent 소유인 Label 은 style 을
 * 자기가 갖는다). Styles 패널 · AI style 편집이 이것을 쓴다.
 */
export function resolveSubpartStyleOwnerType(
  childType: string | null | undefined,
  parentType: string | null | undefined,
  grandparentType?: string | null,
): string | null {
  if (!childType || !parentType) return null;
  const full = resolveFullSubpartOwnerType(
    childType,
    parentType,
    grandparentType,
  );
  if (full) return full;
  const owners = STYLE_ONLY_SUBPART_PARENTS[childType];
  if (!owners) return null;
  if (owners.includes(parentType)) return parentType;
  if (
    grandparentType &&
    hopsWrapper(parentType, grandparentType) &&
    owners.includes(grandparentType)
  )
    return grandparentType;
  return null;
}

/**
 * parent rule (또는 DOM root alias) 의 delegation 이 이 자식 type 의 class 토큰을 갖는가 — 또는 parent 가 Label 을
 * self-compose 하는 그룹인가. `grandparentType` 을 주면 직계가 sub-part 래퍼 (field 의 control Group) 일 때 조부모로 판정.
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

/** 이 entry 의 bridge 가 읽는 변수를 선언한 **같은 rule 안의 다른 entry** 의 variables. */
function findDeclaringEntryVariables(
  parentType: string,
  entry: DelegationLike,
): unknown {
  const bridges = entry.bridges as Record<string, unknown> | undefined;
  const wanted =
    cssVarName(bridges?.["font-size"]) ??
    cssVarName(bridges?.["--error-font-size"]) ??
    cssVarName(bridges?.["--label-font-size"]);
  if (!wanted) return undefined;
  // TextArea 처럼 DOM root 클래스를 다른 rule 에서 빌려오는 타입은 그 rule 의 delegation 이 선언한다.
  const alias = DOM_ROOT_RULE_ALIAS[parentType.toLowerCase()];
  const entriesOf = (type: string): DelegationLike[] => {
    const d =
      resolveComponentRuleByTag(type)?.structure?.composition?.delegation;
    return Array.isArray(d) ? (d as DelegationLike[]) : [];
  };
  const list = [...entriesOf(parentType), ...(alias ? entriesOf(alias) : [])];
  if (list.length === 0) return undefined;
  for (const d of list) {
    const vars = d?.variables;
    if (!vars || typeof vars !== "object") continue;
    const bySize = vars as Record<string, Record<string, unknown> | undefined>;
    const declares = Object.values(bySize).some(
      (sizeVars) => sizeVars != null && wanted in sizeVars,
    );
    if (declares) return vars;
  }
  return undefined;
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
  // bridge 가 읽는 변수를 **다른 entry 가 선언**하는 경우 (field 의 `[slot="description"]` 이
  //   `.react-aria-FieldError` 의 `--{prefix}-hint-size` 를 읽는다) — 생성 CSS 는 그 변수를 parent scope
  //   에 emit 하므로 (착수 10) DOM 은 상속으로 읽는다. 여기서도 같은 rule 안의 선언 entry 를 찾아간다.
  const variables =
    entry.variables ?? findDeclaringEntryVariables(parentType, entry);
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

/** delegation bridge 가 자식에 거는 `max-width` — 단위를 보존해 돌려준다 (ch 는 글꼴 의존이라 소비처가 푼다). */
export interface DelegatedChildMaxWidth {
  amount: number;
  unit: "ch" | "px";
  /** 그 자식의 글자 크기 (px) — `ch` 를 "0" 글자 폭으로 풀 때 쓴다 */
  fontSize?: number;
}

/**
 * parent rule delegation 이 자식 selector 에 bridge 로 거는 `max-width: var(--x)` 를 size 별 변수값으로 푼다
 * (2026-09-26, ADR-236 후속). 예: ColorField `.react-aria-Input` 의 `--cf-input-max-width` (md `12ch`) — DOM 은
 * 이 값으로 입력칸을 좁히는데 Canvas read-only 투영은 font-size 만 운반해 입력칸이 전폭 (1842 vs 106) 이었다.
 * 없으면 undefined.
 */
export function resolveDelegatedChildMaxWidth(
  parentType: string,
  childSelector: string,
  size?: string | null,
): DelegatedChildMaxWidth | undefined {
  const found =
    findDelegation(parentType, childSelector) ??
    (() => {
      const alias = DOM_ROOT_RULE_ALIAS[parentType.toLowerCase()];
      return alias ? findDelegation(alias, childSelector) : undefined;
    })();
  if (!found) return undefined;
  const { entry, defaultSize } = found;
  const bridges = entry.bridges as Record<string, unknown> | undefined;
  const maxVar = cssVarName(bridges?.["max-width"]);
  if (!maxVar) return undefined;
  const variables = entry.variables;
  if (!variables || typeof variables !== "object") return undefined;
  const bySize = variables as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const sizeVars =
    (size ? bySize[size] : undefined) ??
    (defaultSize ? bySize[defaultSize] : undefined) ??
    bySize.md;
  const raw = sizeVars?.[maxVar];
  if (typeof raw !== "string") return undefined;
  const m = /^(\d+(?:\.\d+)?)(ch|px)$/.exec(raw.trim());
  if (!m) return undefined;
  const fontVar =
    cssVarName(bridges?.["font-size"]) ??
    cssVarName(bridges?.["--input-font-size"]);
  const fontSize = fontVar ? cssTextVarToPx(sizeVars?.[fontVar]) : undefined;
  return {
    amount: Number(m[1]),
    unit: m[2] as "ch" | "px",
    ...(fontSize != null ? { fontSize } : {}),
  };
}

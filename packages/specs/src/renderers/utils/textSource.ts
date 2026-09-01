/**
 * ADR-923 Phase 3 r15m1 — 노드 텍스트 원천 계약 (Preview DOM · Skia · 레이아웃 공용 단일 지점).
 *
 * **왜 단일 지점인가**: round 14 까지 텍스트 원천 순서를 consumer 마다 따로 들고 있었다 — Skia
 * `buildCatalogShapes` 는 모든 타입에 `label → children → text → placeholder`, 레이아웃
 * `extractTextContent` 는 `label → text → children → title → placeholder → value`, Preview 는
 * 렌더러마다 (generic `children → text`, ListBoxItem `label || children`, Column `children || label`,
 * TreeItem `title || label || value || children`, FieldError `text`). writer 인벤토리를
 * inspector/factory/overlay/Pencil 로 닫았지만 **AI `create_element`/`update_element` 는 열린 props
 * 객체를 검증 없이 병합·저장**한다 (`createElement.ts` `{...defaultProps, ...aiProps}`,
 * `updateElement.ts` `updateElementProps(id, {...newProps})`). 그래서 AI 가 Text 에 `label` 을 쓰면
 * 저장 props 는 `{children: "Text", label: "AI Label"}` — Preview/레이아웃은 "Text", Skia 는
 * "AI Label" 을 그렸다 (Codex round 15 r15m1). consumer 별 순서가 하나라도 다르면 열린 writer 가
 * 그 차이에 도달한다. 순서를 여기 한 곳에 두고 세 consumer 가 전부 위임하면 어떤 props 조합이
 * 저장돼도 세 표면이 같은 텍스트를 읽는다.
 *
 * **순서는 writer 인벤토리 (production 이 실제로 쓰는 키) 로 도출한다** — binding `accepts` 는 편집
 * surface 지 렌더 소비 집합이 아니다 (round 14 r14m2):
 *
 * | 타입 군 | 순서 | writer |
 * | --- | --- | --- |
 * | 기본 (Button/Badge/Link/Tag/MenuItem/Column/TreeItem/DisclosureHeader …) | `children` | inspector · factory · overlay 편집 · 데이터 Column (`label`+`children` 동시 기록) |
 * | 텍스트 leaf (Text/Heading/Paragraph/Label/Description/Kbd/Code) + FieldError | `children → text` | + Pencil import (`collectPencilProps` → canonical Text `text`) · legacy 문서 `text` |
 * | label 우선 (ListBoxItem/GridListItem/Menu) | `label → children` | Menu factory `label`+`children` · collection item 데이터 `label` (Preview `label \|\| children`) |
 * | field leaf (Input/TextArea/SelectValue/TextField/SearchField/NumberField/ColorField/Select/ComboBox) | `placeholder` | factory `placeholder` — 값이 비었을 때 DOM 이 placeholder 를 보이듯 Skia 도 같은 텍스트 |
 *
 * 순서 밖의 키 (`label`/`title`/`value` 가 기본 군에 있을 때 등) 는 **세 표면 모두** 읽지 않는다 —
 * AI 가 Text 에 `label` 을 써도 Preview·Skia·레이아웃이 함께 `children` 을 읽는다. 종전 Preview 의
 * TreeItem `title`/`label`/`value`, Column `label`, DisclosureHeader `title` 폴백은 production writer
 * 가 없는 (AI 만 도달하는) 키라 계약에서 뺐다.
 *
 * `children` 이 `text` 보다 앞: import 뒤 inspector 편집이 `children` 을 쓰면 stale `text` 가 아니라
 * `children` 을 읽어야 한다. `label` 이 `children` 보다 앞 (item 군): collection 데이터 SSOT 가
 * `label` 이고 Preview 가 그 순서로 그린다.
 *
 * 문자열화는 React renderable 규칙 (`textFromValue`): string/number 그대로, 배열은 string/number 항목만
 * 이어붙임 (React 가 `["a","b"]` 를 "ab" 로 그린다), object/boolean/null 은 내용 없음 — 세 표면이
 * 같은 규칙을 써야 `["a","b"]` 가 Preview 에선 "ab", Skia 에선 내용 없음이 되지 않는다.
 * 빈 문자열은 "내용 없음" 이라 다음 키로 넘어간다 (`children: ""` + `text: "t"` → "t").
 */

export type TextSourceKey = "label" | "children" | "text" | "placeholder";

const ORDER_CHILDREN: readonly TextSourceKey[] = ["children"];
const ORDER_CHILDREN_TEXT: readonly TextSourceKey[] = ["children", "text"];
const ORDER_LABEL_CHILDREN: readonly TextSourceKey[] = ["label", "children"];
const ORDER_PLACEHOLDER: readonly TextSourceKey[] = ["placeholder"];

/** 텍스트 leaf 7종 (레이아웃 `TEXT_LEAF_TAGS` 와 동일 집합) + FieldError — `children → text`. */
const CHILDREN_TEXT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "heading",
  "paragraph",
  "label",
  "description",
  "kbd",
  "code",
  "fielderror",
]);

/** Preview 가 `label` 을 먼저 읽고 production writer 가 `label` 을 쓰는 타입 — `label → children`. */
const LABEL_FIRST_TYPES: ReadonlySet<string> = new Set([
  "listboxitem",
  "gridlistitem",
  "menu",
]);

/** 값이 비었을 때 placeholder 를 보이는 field leaf — factory `placeholder` writer. */
const PLACEHOLDER_TYPES: ReadonlySet<string> = new Set([
  "input",
  "textarea",
  "textfield",
  "searchfield",
  "numberfield",
  "colorfield",
  "select",
  "selectvalue",
  "combobox",
]);

/** 타입별 텍스트 원천 순서. 타입은 대소문자 무관 (레이아웃은 소문자 tag, Preview/Skia 는 canonical type). */
export function textSourceOrder(
  type: string | undefined,
): readonly TextSourceKey[] {
  const key = (type ?? "").toLowerCase();
  if (CHILDREN_TEXT_TYPES.has(key)) return ORDER_CHILDREN_TEXT;
  if (LABEL_FIRST_TYPES.has(key)) return ORDER_LABEL_CHILDREN;
  if (PLACEHOLDER_TYPES.has(key)) return ORDER_PLACEHOLDER;
  return ORDER_CHILDREN;
}

/**
 * prop 값 → 텍스트 (React renderable 규칙). string/number 그대로, 배열은 string/number 항목만
 * 이어붙임, 그 외 (object/boolean/null/undefined) 는 "".
 */
export function textFromValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    let out = "";
    for (const item of value) {
      if (typeof item === "string") out += item;
      else if (typeof item === "number") out += String(item);
    }
    return out;
  }
  return "";
}

/** 타입 순서에서 내용이 있는 첫 키. 없으면 undefined. */
export function resolveTextSourceKey(
  type: string | undefined,
  props: Record<string, unknown> | undefined,
): TextSourceKey | undefined {
  if (!props) return undefined;
  for (const key of textSourceOrder(type)) {
    if (textFromValue(props[key]) !== "") return key;
  }
  return undefined;
}

/** 타입 순서에서 내용이 있는 첫 키의 텍스트. 없으면 "". */
export function resolveTextSourceText(
  type: string | undefined,
  props: Record<string, unknown> | undefined,
): string {
  if (!props) return "";
  for (const key of textSourceOrder(type)) {
    const text = textFromValue(props[key]);
    if (text !== "") return text;
  }
  return "";
}

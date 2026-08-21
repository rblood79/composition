/**
 * ADR-142 family ④(collections) — GridList primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`GridList.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC GridList + GridListItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4 C1).
 */

import type { PrimitiveBinding } from "../types";

export const gridListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "gridlist",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 5: 정적 items[](StoredGridListItem[]).
      //   toRacProps 가 props.items pass-through 를 보장(미선언 시 정적 카드 소실).
      //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
      //   Inspector 정적 items 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
      items: {
        kind: "items-manager",
        label: "Items",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "GridListItem",
          defaultItem: { id: "", label: "Item", isDisabled: false },
          itemSchema: [
            { key: "label", type: "string", label: "Label" },
            { key: "textValue", type: "string", label: "Text Value" },
            { key: "description", type: "string", label: "Description" },
            { key: "isDisabled", type: "boolean", label: "Disabled" },
          ],
          labelKey: "label",
          allowSections: true,
        },
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // RAC 공식 prop(react-aria.adobe.com/GridList) — 항목 배치 방식(수직 stack ↔ 카드 grid).
      //   GridList.tsx 가 `layout={layout}` 소비 → RAC GridList `data-layout` 방출 →
      //   GridList.css `[data-layout=grid|stack]` 스타일. RAC 소비 prop 이라 DOM raw attr
      //   누출 없음(selectionMode 동형).
      // 2026-07-29 사용자 결정: 기본값 stack → **grid**. GridList 의 카드 배치가 이 컴포넌트를
      //   ListBox 와 구분 짓는 지점인데 기본이 stack 이면 둘이 같은 모양으로 시작한다.
      //   기본값은 한 곳에 없다 — 아래 9곳이 같이 움직여야 한다(§commit 참조).
      layout: {
        kind: "enum",
        label: "Layout",
        section: "appearance",
        default: "grid",
        options: [
          { value: "stack", label: "Stack" },
          { value: "grid", label: "Grid" },
        ],
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "single",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RSP ListView `selectionStyle` (design-data 감사 §1-2 축②, 2026-08-21).
      //   선택을 무엇으로 표시하는가 — checkbox(행 체크박스) | highlight(배경 강조만).
      //   RAC 는 같은 축을 `selectionBehavior`("toggle"|"replace") 로 부르고, 변환은
      //   `resolveSelectionBehavior` 단일 helper 가 한다(컴포넌트 + 렌더러 공유).
      //   기본 checkbox = 이 컴포넌트가 종전에 넘기던 selectionBehavior:"toggle" 과 동일 시각.
      selectionStyle: {
        kind: "enum",
        label: "Selection Style",
        section: "state",
        default: "checkbox",
        options: [
          { value: "checkbox", label: "Checkbox" },
          { value: "highlight", label: "Highlight" },
        ],
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — renderGridList 기소비.
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

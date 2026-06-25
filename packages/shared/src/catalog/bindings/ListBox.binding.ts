/**
 * ADR-142 family ④(collections) — ListBox primitive 의 `PrimitiveBinding`.
 *
 * collection 컴포넌트는 RAC raw 가 아닌 **composition wrapper**(`ListBox.tsx`)가 D1 담당 —
 * wrapper 가 `useCollectionData`(dataBinding → items, ADR-132)로 데이터를 채우고 RAC ListBox +
 * ListBoxItem 을 합성한다. 따라서 `source.kind: "internal"`(RAC raw 우회, wrapper 직접 렌더).
 *
 * **Skia generic 발효 (skiaLegacy 미설정, ADR-912 선행 2026-06-03)**: DOM(Preview)/Inspector 는
 * catalog generic(wrapper 렌더 + useCollectionData), Skia 도 generic 발효 — ListBox render.shapes 는
 * container shell(bg+border)만 반환(ADR-146)하고 data row 는 row projection
 * (canvasSceneNode.appendListBoxRowProjection)이 독립 Skia 노드로 그린다. buildCatalogShapes 가
 * 동일 정본 table(componentRulesTable ListBox rule)의 variant fill + border 로 같은 shell 을 그려
 * 시각 동등. items 배열 순회가 render.shapes 안에 없어 generic 발효. ListBox proof 검증 후
 * 나머지 collection 6 + Table 도 동형 projection 으로 발효 완료(ADR-912 단계 4, skiaLegacy 0건).
 */

import type { PrimitiveBinding } from "../types";

export const listBoxBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "listbox",
  },
  props: {
    accepts: {
      // collection items 데이터 — canonical 아닌 collections root(useCollectionData) 소유.
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 4: 정적 items[](StoredListBoxItem[]).
      //   collection cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로
      //   items 선언이 props.items pass-through 를 보장한다(미선언 시 wrapper 가
      //   items=undefined → useResolvedCollectionItems 정적 source 소실). kind:"items-manager"
      //   는 toRacProps 비-DATA_ATTR_KIND → out[key]=value 통과 유지(binding 과 동일) +
      //   Inspector 에 정적 items 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
      items: {
        kind: "items-manager",
        label: "Items",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "ListBoxItem",
          defaultItem: {
            id: "",
            label: "New Item",
            value: "",
            isDisabled: false,
          },
          itemSchema: [
            { key: "label", type: "string", label: "Label" },
            { key: "value", type: "string", label: "Value" },
            { key: "textValue", type: "string", label: "Text Value" },
            { key: "description", type: "string", label: "Description" },
            { key: "isDisabled", type: "boolean", label: "Disabled" },
            { key: "href", type: "string", label: "URL" },
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
    },
    toRacProps: "default",
  },
  // shell 은 Skia generic(buildCatalogShapes), data row 는 row projection 별도 경로(ADR-912 선행).
};

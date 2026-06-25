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
export declare const listBoxBinding: PrimitiveBinding;
//# sourceMappingURL=ListBox.binding.d.ts.map
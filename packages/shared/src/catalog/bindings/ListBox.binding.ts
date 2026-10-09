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
      // 항목은 slot (자식 노드 — RAC 정적 collection) 또는 dataBinding (collection 행 + 항목 노드
      //   template — RAC 동적 collection) 이다. 옛 items-manager (`props.items` 인라인 배열) 는
      //   2026-10-09 삭제 — ADR-256 노드 트리 전환 뒤 어느 renderer 도 읽지 않았다 (contract 32).
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
      // ADR-923 r24m1 — 기본값 "single" 은 어느 표면에도 없던 값이었다. RAC 기본은 "none",
      //   `renderListBox` 도 `props.selectionMode || "none"` 로 렌더한다 (delegating 렌더러라
      //   toRacProps 를 거치지 않아 이 default 가 Preview 에 도달하지 않았다). Inspector 만
      //   contract.default 를 "현재값" 으로 보여 주어 패널 "Single" ↔ DOM none 이 갈렸다.
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      // 컬렉션 전체 isDisabled 는 2026-09-10 제거 — RAC/RSP 컬렉션은 `disabledKeys`·항목별
      //   isDisabled 만 두고(D2), 이 값은 DOM(wrapper 미소비)·Skia(항목 투영에 부모 상태 없음)
      //   어느 쪽도 읽지 않던 dead surface 였다. 항목별 Disabled 는 항목 노드 자신의 isDisabled 다.
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — renderListBox 기소비.
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
  // shell 은 Skia generic(buildCatalogShapes), data row 는 row projection 별도 경로(ADR-912 선행).
};

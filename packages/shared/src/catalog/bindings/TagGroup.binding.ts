/**
 * ADR-142 family ④(collections) — TagGroup primitive 의 `PrimitiveBinding`.
 *
 * DOM 은 `delegatedDom.tsx` `taggroup` (`TagGroupRun`) 이 RAC TagGroup 안에 작성 자식 (Label ·
 * TagList > Tag… · Description · FieldError) 을 순서대로 그린다. 바인딩된 TagList 는 Tag 자리를 행마다
 * 반복한다 (resolver `CATALOG_ROW_ITEM_TYPES`). Canvas 시각은 catalog rule (`COMPONENT_RULES_TABLE.TagGroup`).
 */

import type { PrimitiveBinding } from "../types";

export const tagGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "taggroup",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // 항목은 slot (자식 노드 — RAC 정적 collection) 또는 dataBinding (collection 행 + 항목 노드
      //   template — RAC 동적 collection) 이다. 옛 items-manager (`props.items` 인라인 배열) 는
      //   2026-10-09 삭제 — ADR-256 노드 트리 전환 뒤 어느 renderer 도 읽지 않았다 (contract 32).
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // RSP TagGroup maxRows — 지정 행 수를 넘는 tag 는 접고 "Show all" 로 펼침. 0 또는 미설정 시 전체.
      //   DOM: `delegatedDom.tsx` TagListRun — 측정 거울 (`useTagMaxRows`) + Show all / Show less.
      //   Canvas: `compositionRoot.ts` `settleTagRows` — 같은 규칙 (tag 전부 배치한 행 수) 으로 넘친 tag 를
      //   흐름에서 빼고 "Show all (N)" 상자를 세운다 (2026-10-09 — 옛 TS 레이아웃 Step 4.5b 의 이식).
      maxRows: {
        kind: "number",
        label: "Max Rows",
        section: "appearance",
        min: 0,
      },
      // orientation accepts 제거 (2026-07-01): RAC/RSP TagGroup 어디에도 없는 non-standard prop.
      //   DOM(RAC)은 무시하고 Skia 만 vertical 반영해 CSS↔Skia 비대칭 + Property 패널에 dead
      //   편집 UI 노출 → D2 위반. 그룹↔라벨 배치는 RSP 표준 labelPosition(top/side)이 담당.
      // labelPosition(그룹↔라벨 top/side): 렌더 인프라 이미 갖춰짐 —
      //   `delegatedDom.tsx` `TagGroupRun` 이 data-label-position emit / 수동 TagGroup.css
      //   [data-label-position="side"]{flex-direction:row} / catalog rule
      //   containerVariants["label-position"].side(Skia). (다른 field 와 표기 정합.)
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
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
      allowsRemoving: {
        kind: "boolean",
        label: "Allows Removing",
        section: "state",
      },
      // 컬렉션 전체 isDisabled 는 2026-09-10 제거 — RAC/RSP 컬렉션은 `disabledKeys`·항목별
      //   isDisabled 만 두고(D2), 이 값은 DOM(wrapper 미소비)·Skia(항목 투영에 부모 상태 없음)
      //   어느 쪽도 읽지 않던 dead surface 였다. 항목별 Disabled 는 항목 노드 자신의 isDisabled 다.
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — `delegatedDom.tsx` `TagGroupRun` 이 전달.
      disallowEmptySelection: {
        kind: "boolean",
        label: "Disallow Empty Selection",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

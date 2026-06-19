/**
 * ADR-142 family ④(collections) — TagGroup primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`TagGroup.tsx`)가 useCollectionData(dataBinding → tag items)로 채우고
 * RAC TagGroup + Label/TagList/Tag 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
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
      // ADR-912 영역 B (A 후속, 2026-06-05): 정적 items[] SSOT(ADR-097 P2) pass-through.
      //   collection cutover DOM 경로(toRacProps)는 accepts 선언 prop 만 통과시키므로,
      //   items 미선언 시 props.items(4개)가 drop → TagGroup wrapper 가 items=undefined 로
      //   받아 빈 TagList placeholder(2개) 렌더. dataBinding 과 동일한 collection data source 라
      //   kind:"binding"(Inspector no-op, toRacProps 통과 전용) 로 선언 — D2 의미 props 오염 없음.
      //   Skia 경로는 appendTagRowProjection 이 canonical props.items 를 직접 읽어 무관.
      items: { kind: "binding", label: "Items", section: "content" },
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
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      // labelPosition(그룹↔라벨 top/side)은 orientation(태그 칩 가로/세로 배치)과 직교한다
      //   — CheckboxGroup/RadioGroup 과 동일 구조. 렌더 인프라는 이미 갖춰짐:
      //   TagGroup.tsx wrapper 가 data-label-position emit / 수동 TagGroup.css
      //   [data-label-position="side"]{flex-direction:row} / catalog rule
      //   containerVariants["label-position"].side(Skia). binding accepts 만 누락돼
      //   Property 패널 편집 surface 가 없던 것을 노출(다른 field 와 표기 정합).
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
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

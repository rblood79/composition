import type { PrimitiveBinding } from "../types";

/**
 * Section — 시맨틱 영역 컨테이너 leaf (internal renderer `section`).
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   시각은 rule(`COMPONENT_RULES_TABLE.Section`, 기본 변형 하나 — 투명) 이 정본이다.
 *   Section 은 `rulePaint.ts` `SHELL_ONLY_TYPES` 멤버 → 자식 수와 무관하게 `_hasChildren=true` →
 *   Canvas 는 rule 의 상자 (배경 + 테두리) 만 그린다.
 *
 * **alpha:0 default variant (실측 2026-06-04, 사용자 결정 "시각 대칭 기준 그대로")**:
 *   default variant 는 투명 (2026-10-12 부터 `{color.transparent}` — DOM 에 data-variant 가 없어 base
 *   블록이 투명을 싣는다) — Canvas · DOM 모두 투명이다 (D3 원칙: 시각 결과 동일성).
 *
 * **DOM**: `INTERNAL_RENDERERS` 미등록 → `domBinding.tsx` `ruleDom` 의 fallback
 *   (`div.react-aria-Section` + data-size/data-variant) → generated CSS(Section.css) 가 상자를 소유.
 *
 * D1: composition 내부 상자 (RAC 대응 없음 — fallback `div`, role 없음).
 * D2: size(S/M/L) 편집 surface (data-size 라우팅 — variant 없음 — S2 · RAC · v3 어디에도 없는 축 (2026-10-12)).
 * D3: 시각(배경/패딩)은 theme rule(COMPONENT_RULES_TABLE.Section).
 */
export const sectionBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "section",
  },
  props: {
    accepts: {
      // kind:"size" 는 options 를 두지 않는다(types.ts:139-142) — size 값 집합은 theme
      //   rule(COMPONENT_RULES_TABLE.Section.sizes)이 동적 제공.
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};

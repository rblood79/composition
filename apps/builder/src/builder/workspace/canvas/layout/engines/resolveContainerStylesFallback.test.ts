/**
 * ADR-080 Gate G1: `resolveContainerStylesFallback` unit test.
 *
 * Spec SSOT(ListBoxSpec.containerStyles) ↔ layout fallback 간 drift 감지 경로.
 * primitives(spacing.xs=4, spacing.2xs=2) 값이 변경되면 여기서 failure 발생 → Spec 과
 * layout 의 이원화 방지 (ADR-079 P3.2 drift test 의 구조적 계승).
 *
 * ADR-081 G2 C3 진입점: tokenConsumerDrift.test.ts 는 본 함수 반환값을 primitives 와
 * cross-reference 한다. 본 test 는 함수 자체 계약 (drift 감지) 검증.
 */

import { describe, expect, it } from "vitest";
import { resolveToken } from "@composition/specs";
import { resolveContainerStylesFallback } from "./implicitStyles";

describe("resolveContainerStylesFallback (ADR-080 G1 + ADR-083 Phase 0)", () => {
  describe("listbox — ListBoxSpec.containerStyles SSOT", () => {
    it("empty parentStyle → ListBoxSpec.containerStyles layout primitive 8 필드 반환", () => {
      const fb = resolveContainerStylesFallback("listbox", {});
      // ADR-083 Phase 0: 10 필드 lookup (display/flexDirection/alignItems/
      // justifyContent/width/maxHeight/overflow/outline/gap/padding) 중
      // ListBoxSpec.containerStyles 에 선언된 8 필드 (alignItems/justifyContent 미선언).
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 2, // {spacing.2xs}
        padding: 4, // {spacing.xs}
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });

    it("parentStyle.display 명시 → display 는 반환값에서 제외 (사용자 편집 우선)", () => {
      const fb = resolveContainerStylesFallback("listbox", {
        display: "block",
      });
      expect(fb).not.toHaveProperty("display");
      expect(fb).toEqual({
        flexDirection: "column",
        gap: 2,
        padding: 4,
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });

    it("parentStyle.gap/padding 명시 → 해당 key 제외, 나머지 Spec fallback 반환", () => {
      const fb = resolveContainerStylesFallback("listbox", {
        gap: 8,
        padding: 16,
      });
      expect(fb).not.toHaveProperty("gap");
      expect(fb).not.toHaveProperty("padding");
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });

    it("parentStyle 8속성 모두 명시 → 빈 객체 반환 (ListBoxSpec 선언 필드 전부 override)", () => {
      const fb = resolveContainerStylesFallback("listbox", {
        display: "block",
        flexDirection: "row",
        gap: 8,
        padding: 16,
        width: "50%",
        maxHeight: "100px",
        overflow: "hidden",
        outline: "1px solid red",
      });
      expect(fb).toEqual({});
    });
  });

  describe("unknown tag — containerStyles 보유 Spec 아님", () => {
    it("미지원 tag → 빈 객체", () => {
      expect(resolveContainerStylesFallback("unknown", {})).toEqual({});
      // ADR-083 Phase 8 이후: Button containerStyles 리프팅됨 → 빈 객체 아님.
      // TAG_SPEC_MAP 미등록 태그 (예: "nonexistent") 만 빈 객체.
      expect(resolveContainerStylesFallback("nonexistent-tag", {})).toEqual({});
    });
  });

  // ADR-912 collection sub-part cutover (2026-06-14): ListBoxItem/GridListItem.spec 물리 삭제됨.
  //   spec 미선언 태그 → resolveContainerStylesFallback 이 `{}` 반환(선주입 layer 영향 없음).
  //   layout(display:flex/column)은 이제 spec.containerStyles 가 아니라:
  //     - Skia: listbox_item / gridlist_card escape(replace 모드)가 row/card 전체 자체 paint
  //     - DOM: virtual ListBoxItem.css(generate-css TEXT_LEAF) + 수동 GridList.css 가 emit
  //   가 담당 → fallback `{}` 이 정답(회귀 없음, layout 축 escape/CSS 로 이전 완료).
  describe("listboxitem — ADR-912 cutover (spec 삭제 → escape/CSS 가 layout 담당)", () => {
    it("empty parentStyle → spec 삭제로 {} 반환 (layout 은 listbox_item escape + virtual CSS)", () => {
      expect(resolveContainerStylesFallback("listboxitem", {})).toEqual({});
    });
  });

  describe("gridlistitem — ADR-912 cutover (spec 삭제 → escape/CSS 가 layout 담당)", () => {
    it("empty parentStyle → spec 삭제로 {} 반환 (layout 은 gridlist_card escape + 수동 CSS)", () => {
      expect(resolveContainerStylesFallback("gridlistitem", {})).toEqual({});
    });
  });

  describe("menu — Menu.spec.containerStyles (Phase 0 일반화 + Phase 6 merge — 8 필드)", () => {
    it("empty parentStyle → display/flexDirection/padding/gap/width/maxHeight/overflow/outline 반환", () => {
      const fb = resolveContainerStylesFallback("menu", {});
      // Phase 6: Menu containerStyles 에 display/flexDirection 2 필드 추가 → 8 필드 반환.
      // Menu 분기는 filteredChildren=[] 로 early return 하므로 effectiveParent 에
      // parentStyle 전파는 발생하지 않음. 본 test 는 단순히 lookup 계약 확증.
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        padding: 4, // {spacing.xs}
        gap: 2, // {spacing.2xs}
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });
  });

  // ADR-913 slice 4 (2026-06-19): Tree containerStyles — ListBox/Menu/TagGroup 동형
  //   cutover 멤버인데 ADR-912 단계5 step4 배치에서 containerStyles 이관 누락
  //   (ToggleButtonGroup slice 0 / ListBox 선례 동형 — spec 삭제 시 Skia layout fallback
  //   빈 객체 → TreeItem 세로 배치 안 됨, DOM 은 starter Tree.css flex column 적용 → 비대칭).
  describe("tree — Tree.containerStyles (ADR-913 slice 4, ListBox/Menu 동형)", () => {
    it("empty parentStyle → display:flex/column + 8 필드 반환 (starter Tree.css 정합)", () => {
      const fb = resolveContainerStylesFallback("tree", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 2, // {spacing.2xs}
        padding: 4, // {spacing.xs} = starter --spacing-1
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });
  });

  describe("primitives 정합 (drift 감지 기반)", () => {
    it("resolveToken('{spacing.xs}') === 4 (padding fallback 근거)", () => {
      expect(resolveToken("{spacing.xs}")).toBe(4);
    });

    it("resolveToken('{spacing.2xs}') === 2 (gap fallback 근거)", () => {
      expect(resolveToken("{spacing.2xs}")).toBe(2);
    });
  });
});

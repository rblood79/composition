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

  // 2026-07-02 전수조사 fix: TabPanel 은 spec 삭제(ADR-912 cutover) + structure.composition
  //   부재(archetype "collection") 인데, 사용자 자식을 담는 실제 layout 컨테이너다(listboxitem
  //   과 달리 escape 가 자체 paint 하지 않음). layout(display:flex/column)이
  //   structure.containerStyles 에만 있으면 경로 A(top-level rule.containerStyles)·경로
  //   B(structure.composition) 둘 다 미도달 → {} 반환 → getElementDisplay block 라우팅 → 자식
  //   flex 속성 유실(DOM=flex-column 비대칭). top-level rule.containerStyles 승격으로 경로 A 도달.
  describe("tabpanel — top-level containerStyles 승격 (자식 flex-column layout Skia 도달)", () => {
    it("empty parentStyle → top-level rule.containerStyles 의 display/flexDirection 반환", () => {
      const fb = resolveContainerStylesFallback("tabpanel", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
      });
    });

    it("parentStyle.display 명시 → display 제외 (사용자/factory 편집 우선)", () => {
      const fb = resolveContainerStylesFallback("tabpanel", {
        display: "grid",
      });
      expect(fb).not.toHaveProperty("display");
      expect(fb).toEqual({ flexDirection: "column" });
    });
  });

  // 2026-07-07 전수조사 fix: Calendar/RangeCalendar 는 spec 삭제(ADR-912 cutover) +
  //   structure.composition 부재(archetype "calendar") 인데, CSS(CalendarCommon.css
  //   .react-aria-Calendar { width: fit-content }) 는 콘텐츠 폭(md 256px)으로 렌더된다.
  //   layout(display:flex/column/width:fit-content)이 structure.containerStyles 에만 있으면
  //   경로 A(top-level rule.containerStyles)·경로 B(structure.composition) 둘 다 미도달 →
  //   {} 반환 → 부모 flex-column 에서 align-items:stretch 로 Calendar 가 부모 폭 전체로
  //   stretch(Skia 350px vs CSS 256px 발산). top-level rule.containerStyles 승격으로 경로 A
  //   도달(TabPanel 선례 동형).
  describe("calendar — top-level containerStyles 승격 (width:fit-content Skia 도달)", () => {
    it("empty parentStyle → top-level rule.containerStyles 의 display/flexDirection/width 반환", () => {
      const fb = resolveContainerStylesFallback("calendar", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
      });
    });

    it("parentStyle.width 명시 → width 제외 (사용자/factory 편집 우선)", () => {
      const fb = resolveContainerStylesFallback("calendar", {
        width: "300px",
      });
      expect(fb).not.toHaveProperty("width");
      expect(fb).toEqual({ display: "flex", flexDirection: "column" });
    });
  });

  describe("rangecalendar — top-level containerStyles 승격 (Calendar 동형)", () => {
    it("empty parentStyle → display/flexDirection/width:fit-content 반환", () => {
      const fb = resolveContainerStylesFallback("rangecalendar", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
      });
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
        gap: 0, // starter Tree.css @supports :has 블록이 gap:0 재선언 — 실효값 (2026-07-14)
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

  // ADR-912 Phase 3-A-3a (2026-06-20): field류 base layout 을 catalog structure.composition
  //   단일 source 에서 wrapper 가 도달하도록 재배선. 재배선 전: top-level containerStyles 부재로
  //   early-return → {} (인라인 `?? "flex"/"column"/4` 가 실제 active). 재배선 후: catalog
  //   structure.composition.layout='flex-column' base + gap('var(--spacing-xs)' → 숫자 4 정규화)
  //   를 담아 field 분기 인라인 fallback 이 redundant.
  //
  // 핵심 trap 3종 (모두 wrapper 정규화로 해소):
  //   1. type casing: wrapper 는 lowercase("textfield"), resolveCatalogContainerBase 는 PascalCase 필요
  //   2. kebab→camel: resolveCatalogContainerBase 출력은 kebab(flex-direction), wrapper 는 camelCase
  //   3. gap CSS-var: catalog gap='var(--spacing-xs)' (isValidTokenRef reject) → cssVarToTokenRef
  describe("field류 — catalog structure.composition base 재배선 (Phase 3-A-3a)", () => {
    it("textfield → flex-column base (camelCase) + gap 숫자 4 + width:100%", () => {
      const fb = resolveContainerStylesFallback("textfield", {});
      expect(fb.display).toBe("flex");
      expect(fb.flexDirection).toBe("column");
      expect(fb.alignItems).toBe("flex-start");
      // gap: 'var(--spacing-xs)' → cssVarToTokenRef → {spacing.xs} → 4 (number)
      expect(fb.gap).toBe(4);
      expect(fb.width).toBe("100%");
      // kebab key 가 누출되면 안 됨 (camelCase 정규화 필수)
      expect(fb).not.toHaveProperty("flex-direction");
      expect(fb).not.toHaveProperty("align-items");
    });

    it("textarea → flex-column base, **gap 키 부재** (composition.gap 없음 → 분기 fallback 4)", () => {
      const fb = resolveContainerStylesFallback("textarea", {});
      expect(fb.display).toBe("flex");
      expect(fb.flexDirection).toBe("column");
      // TextArea 는 composition.gap 부재 → wrapper 출력에 gap 없음(분기에서 ?? 4 로 보강).
      expect(fb).not.toHaveProperty("gap");
      expect(fb.width).toBe("100%");
    });

    it.each([
      ["searchfield"],
      ["numberfield"],
      ["datefield"],
      ["timefield"],
      ["datepicker"],
      ["daterangepicker"],
      ["combobox"],
      ["select"],
    ])("%s → flex-column base + gap 숫자 4 (camelCase 정규화)", (tag) => {
      const fb = resolveContainerStylesFallback(tag, {});
      expect(fb.display).toBe("flex");
      expect(fb.flexDirection).toBe("column");
      expect(fb.gap).toBe(4);
      expect(fb).not.toHaveProperty("flex-direction");
    });

    it("parentStyle 우선 — 사용자 flexDirection:row 명시 시 catalog base override", () => {
      const fb = resolveContainerStylesFallback("textfield", {
        flexDirection: "row",
      });
      // 사용자 편집 우선: flexDirection 은 반환에서 제외 (parentStyle 이 이미 보유).
      expect(fb).not.toHaveProperty("flexDirection");
      // 나머지 base 는 유지.
      expect(fb.display).toBe("flex");
    });

    it("listbox/menu/tree byte 불변 — 재배선이 top-level containerStyles 경로 미오염", () => {
      // 재배선은 field류(top-level containerStyles 부재) 만 structure.composition 경유.
      //   top-level containerStyles 보유 type 은 기존 경로 그대로 → byte-lock.
      expect(resolveContainerStylesFallback("listbox", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: 4,
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });
  });

  // ADR-912 Phase 3-A-3c (2026-06-20): LOWERCASE_COMPONENT_RULE_CONTAINER map 삭제.
  //   경로 A(top-level rule.containerStyles 보유 type)의 map 조회를 LOWERCASE_TO_PASCAL_RULE_KEY
  //   역매핑 + resolveComponentRule(pascalKey).containerStyles 직접 조회로 대체 → map dead → 삭제.
  //   경로 A 로직/출력은 byte 불변(top-level containerStyles 만 읽는 동일 동작).
  //
  //   **byte-lock 강화 (verify agent witfvnqp4 경고 해소)**: ToggleButtonGroup/Slider/InlineAlert/
  //   TagGroup 은 기존 byte-lock test 부재 → map 삭제 회귀를 못 잡음. 7개 경로 A type 전부 toEqual lock.
  //   특히 ToggleButtonGroup 은 통합 시 structure.composition.layout='flex-row' 의 flexDirection:row
  //   leak 위험이 있으나, map 조회만 역매핑으로 대체(resolveCatalogContainerBase 흡수 아님)하므로
  //   top-level containerStyles({display/alignItems/width}, flexDirection 의도적 생략)가 그대로 유지됨.
  describe("경로 A 7 type byte-lock — map 삭제 후 산출값 불변 (Phase 3-A-3c)", () => {
    it("inlinealert → top-level containerStyles 4필드 (camelCase, TokenRef 없음)", () => {
      expect(resolveContainerStylesFallback("inlinealert", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      });
    });

    it("menu → 8필드 (Phase 6 merge, listbox 동형)", () => {
      expect(resolveContainerStylesFallback("menu", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: 4,
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });

    it("tree → 8필드 (ADR-913 slice 4, listbox 동형)", () => {
      expect(resolveContainerStylesFallback("tree", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 0, // starter Tree.css @supports :has 블록이 gap:0 재선언 — 실효값 (2026-07-14)
        padding: 4,
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      });
    });

    it("slider → display:grid + gridTemplateAreas/Columns (grid 경로)", () => {
      expect(resolveContainerStylesFallback("slider", {})).toEqual({
        display: "grid",
        gridTemplateAreas: '"label output" "track track"',
        gridTemplateColumns: "1fr auto",
      });
    });

    it("taggroup → flex-column + gap 4 ({spacing.xs} 정규화)", () => {
      expect(resolveContainerStylesFallback("taggroup", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: 4,
      });
    });

    it("togglebuttongroup → display:flex/alignItems/width (flexDirection 의도적 생략 — orientation 분기 담당)", () => {
      // CRITICAL byte-lock: top-level containerStyles 가 flexDirection 을 생략하므로 wrapper 출력에도
      //   flexDirection 이 없어야 함. structure.composition.layout='flex-row' leak 시 이 test FAIL.
      //   flexDirection 은 applyImplicitStyles togglebuttongroup 분기(:982)가 orientation 으로 결정.
      const fb = resolveContainerStylesFallback("togglebuttongroup", {});
      expect(fb).toEqual({
        display: "flex",
        alignItems: "center",
        width: "fit-content",
      });
      expect(fb).not.toHaveProperty("flexDirection");
    });

    it("tableview 자식 layout 은 catalog rule fallback 으로 공급", () => {
      expect(resolveContainerStylesFallback("tableview", {})).toMatchObject({
        display: "flex",
        flexDirection: "column",
        width: "100%",
      });
      expect(resolveContainerStylesFallback("tableheader", {})).toMatchObject({
        display: "flex",
        flexDirection: "row",
      });
      expect(resolveContainerStylesFallback("tablebody", {})).toMatchObject({
        display: "flex",
        flexDirection: "column",
      });
      expect(resolveContainerStylesFallback("row", {})).toMatchObject({
        display: "flex",
        flexDirection: "row",
      });
      expect(resolveContainerStylesFallback("column", {})).toMatchObject({
        flex: "1",
        padding: 8,
      });
      expect(resolveContainerStylesFallback("cell", {})).toMatchObject({
        flex: "1",
        padding: 8,
      });
    });
  });
});

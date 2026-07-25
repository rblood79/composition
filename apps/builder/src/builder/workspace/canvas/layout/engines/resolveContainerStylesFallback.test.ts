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
import { resolveToken, lightShadows, darkShadows } from "@composition/specs";
import {
  resolveContainerStylesFallback,
  resolveEffectiveOverflow,
  resolveEffectiveBoxShadow,
} from "./implicitStyles";

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
    it("empty parentStyle → top-level rule.containerStyles 의 display/flexDirection/width/borderWidth 반환", () => {
      const fb = resolveContainerStylesFallback("calendar", {});
      // ADR-151 B1 (2026-07-16): borderWidth "1px" 추가 — generated CSS border 1px 의
      //   layout 미반영 2px 발산 보정 (fallback allowlist 에 borderWidth 편입).
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
        borderWidth: "1px",
      });
    });

    it("parentStyle.width 명시 → width 제외 (사용자/factory 편집 우선)", () => {
      const fb = resolveContainerStylesFallback("calendar", {
        width: "300px",
      });
      expect(fb).not.toHaveProperty("width");
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        borderWidth: "1px",
      });
    });
  });

  describe("rangecalendar — top-level containerStyles 승격 (Calendar 동형)", () => {
    it("empty parentStyle → display/flexDirection/width:fit-content/borderWidth 반환", () => {
      const fb = resolveContainerStylesFallback("rangecalendar", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
        borderWidth: "1px",
      });
    });
  });

  describe("menu — 트리거 박스 containerStyles (ADR-151 B7, 2026-07-16 사용자 결정)", () => {
    it("empty parentStyle → display/alignItems/width(fit-content) 반환 — 목록 panel 메트릭 아님", () => {
      const fb = resolveContainerStylesFallback("menu", {});
      // ADR-151 B7: 캔버스 Menu 표현 = 트리거 버튼 통일. 구 목록 panel 8필드(flex/column/
      // gap/padding/width:100%/maxH/overflow/outline)는 Skia 만 소비해 390px 전폭 바 발산.
      // DOM 목록 panel 규칙은 structure 채널(generated Menu.css) 유지.
      expect(fb).toEqual({
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
      });
    });
  });

  // ADR-913 slice 4 (2026-06-19): Tree containerStyles — ListBox/Menu/TagGroup 동형
  //   cutover 멤버인데 ADR-912 단계5 step4 배치에서 containerStyles 이관 누락
  //   (ToggleButtonGroup slice 0 / ListBox 선례 동형 — spec 삭제 시 Skia layout fallback
  //   빈 객체 → TreeItem 세로 배치 안 됨, DOM 은 starter Tree.css flex column 적용 → 비대칭).
  describe("tree — Tree.containerStyles (ADR-913 slice 4, ListBox/Menu 동형)", () => {
    it("empty parentStyle → display:flex/column + 9 필드 반환 (starter Tree.css 정합)", () => {
      const fb = resolveContainerStylesFallback("tree", {});
      expect(fb).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: "0px", // starter Tree.css @supports :has 블록이 gap:0 재선언 — 실효값 (2026-07-14)
        padding: 4, // {spacing.xs} = starter --spacing-1
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
        borderWidth: "1px", // ADR-151 B5 (2026-07-16) — Tree.css border 1px layout 반영
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

    it("menu → 트리거 박스 3필드 (ADR-151 B7 — 목록 panel 메트릭에서 전환)", () => {
      expect(resolveContainerStylesFallback("menu", {})).toEqual({
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
      });
    });

    it("tree → 9필드 (ADR-913 slice 4, listbox 동형 + ADR-151 B5 borderWidth)", () => {
      expect(resolveContainerStylesFallback("tree", {})).toEqual({
        display: "flex",
        flexDirection: "column",
        gap: "0px", // starter Tree.css @supports :has 블록이 gap:0 재선언 — 실효값 (2026-07-14)
        padding: 4,
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
        borderWidth: "1px", // ADR-151 B5 (2026-07-16)
      });
    });

    it("text/table → width:100% (ADR-151 B22 — generated/수동 CSS 폭 채널 배선)", () => {
      // DOM 폭 원천 = CSS `width:100%` (Text generated archetype base / Table 수동 CSS).
      //   flex 부모에서 Skia 만 fit-content 붕괴하던 발산의 배선.
      for (const t of ["text", "table"]) {
        expect(resolveContainerStylesFallback(t, {})).toEqual({
          width: "100%",
        });
      }
      // 사용자 명시 width 우선 — fallback 미주입
      expect(resolveContainerStylesFallback("text", { width: 120 })).toEqual(
        {},
      );
    });

    it("disclosure/disclosuregroup → width fallback 없음 (ADR-151 Phase 6 정정 — B22 전제 착오 철회)", () => {
      // generated Disclosure(Group).css 에 base width 규칙 없음 (width:100% 는
      //   DisclosureHeader 의 것). DOM 정본 = flex 부모 fit-content (실측 168.2/106.9)
      //   — 강제 width:100% 는 역방향 발산. block 부모 정합은 §5.5 IFC 주입 담당.
      expect(
        resolveContainerStylesFallback("disclosure", {}),
      ).not.toHaveProperty("width");
      expect(
        resolveContainerStylesFallback("disclosuregroup", {}),
      ).not.toHaveProperty("width");
    });

    it("heading/paragraph/description → width:100% (ADR-151 Phase 6 — B22 잔여 flex battery 판정)", () => {
      // 2026-07-16 flex 부모 battery 실측: Heading Skia 80(fit-content) vs CSS 350 —
      //   Text 동형 발산 (Paragraph/Description 도 같은 generated CSS width:100% 계열).
      for (const t of ["heading", "paragraph", "description"]) {
        expect(resolveContainerStylesFallback(t, {})).toEqual({
          width: "100%",
        });
        // 사용자/factory 명시 width 우선 — fallback 미주입
        expect(resolveContainerStylesFallback(t, { width: 120 })).toEqual({});
      }
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

    it("body 페이지 기본 overflow=auto 를 catalog rule fallback 으로 공급 (2026-07-21)", () => {
      // 시스템 페이지(Components / fallback Home)는 systemComponentsPage.ts 가 props:{} 로 생성해
      //   factory createDefaultBodyProps(overflow:auto)를 우회 → catalog body.containerStyles.overflow
      //   가 단일 기본값 source 여야 한다. 미설정 시 CSS 기본 visible 로 떨어지던 회귀 가드
      //   (사용자 보고: Components 페이지 overflow=visible → auto).
      expect(resolveContainerStylesFallback("body", {})).toMatchObject({
        overflow: "auto",
      });
      // 사용자/factory 명시 overflow 는 fallback 보다 우선 — 명시 시 fallback 이 주입 안 함.
      expect(
        resolveContainerStylesFallback("body", { overflow: "hidden" }),
      ).not.toHaveProperty("overflow");
    });
  });
});

// 2026-07-22: overflow 가 catalog containerStyles 에만 있고 raw props.style 에 없는 컨테이너의
//   스크롤/클립이 Skia 4 소비자(GAP4 maxScroll / 가상화 / 휠 / clip·scrollbar)에서 발화하도록
//   catalog fallback 을 포괄하는 공용 resolver. (구조적 근본 원인 — 사용자 보고)
describe("resolveEffectiveOverflow — catalog containerStyles overflow 포괄", () => {
  it("raw props.style.overflow 가 있으면 그대로(catalog 조회 skip)", () => {
    expect(resolveEffectiveOverflow("listbox", { overflow: "visible" })).toBe(
      "visible",
    );
    expect(resolveEffectiveOverflow("card", { overflowY: "scroll" })).toBe(
      "scroll",
    );
  });

  it("raw 부재 시 root overflow — 3 위치(top-level/structure/structure.composition) 포괄", () => {
    // top-level containerStyles.overflow
    expect(resolveEffectiveOverflow("listbox", {})).toBe("auto");
    expect(resolveEffectiveOverflow("tree", {})).toBe("auto");
    // structure.containerStyles.overflow (Card root clip)
    expect(resolveEffectiveOverflow("card", {})).toBe("hidden");
    // structure.composition.containerStyles.overflow (DisclosureGroup)
    expect(resolveEffectiveOverflow("disclosuregroup", {})).toBe("hidden");
  });

  it("sub-part(.bar staticSelectors)의 overflow 는 root clip 이 아니므로 제외 — ProgressBar/Meter undefined", () => {
    // ProgressBar/Meter 의 overflow:hidden 은 `.bar` 셀렉터(sub-part)라 root clipChildren 대상 아님.
    expect(resolveEffectiveOverflow("progressbar", {})).toBeUndefined();
    expect(resolveEffectiveOverflow("meter", {})).toBeUndefined();
  });

  it("catalog overflow 없는 type(GridList) 또는 type 미지정 → undefined", () => {
    expect(resolveEffectiveOverflow("gridlist", {})).toBeUndefined();
    expect(resolveEffectiveOverflow(undefined, {})).toBeUndefined();
  });

  it("ref instance resolved type(PascalCase componentName)도 lowercasing 으로 해석", () => {
    expect(resolveEffectiveOverflow("ListBox", {})).toBe("auto");
  });
});

// ADR-166 Phase 3: elevation 을 catalog containerStyles 에만 둔 overlay(Popover/Tooltip/Modal)가
//   Skia 에서 그림자를 얻도록 하는 resolver. overflow 와 동형이되 **theme 분기**가 추가된다 —
//   `{shadow.md}` 는 light/dark 가 다른 값이므로 해석 시점 theme 이 결과를 바꾼다.
describe("resolveEffectiveBoxShadow — catalog containerStyles elevation 포괄", () => {
  it("raw props.style.boxShadow 가 있으면 catalog 조회를 skip한다", () => {
    expect(
      resolveEffectiveBoxShadow("popover", { boxShadow: "0 1px 2px red" }),
    ).toBe("0 1px 2px red");
    // 사용자가 명시한 "none" 도 raw 다 — catalog 로 되돌아가면 안 된다
    expect(resolveEffectiveBoxShadow("popover", { boxShadow: "none" })).toBe(
      "none",
    );
  });

  it("raw 부재 시 catalog TokenRef 를 theme 별 rgba 로 전개", () => {
    expect(resolveEffectiveBoxShadow("popover", {}, "light")).toBe(
      lightShadows.md,
    );
    expect(resolveEffectiveBoxShadow("popover", {}, "dark")).toBe(
      darkShadows.md,
    );
    expect(resolveEffectiveBoxShadow("tooltip", {}, "light")).toBe(
      lightShadows.sm,
    );
    expect(resolveEffectiveBoxShadow("modal", {}, "dark")).toBe(darkShadows.lg);
  });

  it("theme 기본값은 light", () => {
    expect(resolveEffectiveBoxShadow("popover", {})).toBe(lightShadows.md);
  });

  it("전개 결과가 Skia 파서 계약을 만족 — var( / color-mix( 미포함", () => {
    for (const type of ["popover", "tooltip", "modal"]) {
      for (const theme of ["light", "dark"] as const) {
        const v = resolveEffectiveBoxShadow(type, {}, theme);
        expect(v, `${type}/${theme}`).toBeDefined();
        expect(v, `${type}/${theme}`).not.toMatch(/var\(|color-mix\(/);
      }
    }
  });

  it("catalog 에 boxShadow 가 없는 타입 / type 부재는 undefined", () => {
    expect(resolveEffectiveBoxShadow("listbox", {})).toBeUndefined();
    expect(resolveEffectiveBoxShadow(undefined, {})).toBeUndefined();
  });

  // 메모이즈가 **해석 결과가 아니라 원문**을 캐시하는지 — 결과를 캐시하면 최초 조회 theme 이
  //   고착돼 테마 전환이 무반응이 된다.
  it("메모이즈가 theme 을 고착시키지 않는다 (light 선조회 → dark 정상)", () => {
    expect(resolveEffectiveBoxShadow("modal", {}, "light")).toBe(
      lightShadows.lg,
    );
    expect(resolveEffectiveBoxShadow("modal", {}, "dark")).toBe(darkShadows.lg);
    expect(resolveEffectiveBoxShadow("modal", {}, "light")).toBe(
      lightShadows.lg,
    );
  });

  // ADR-166 후속: 스타일 패널이 기록하는 inline 값은 **리터럴**이라 저장 시점 theme 이 굳는다.
  //   catalog 축은 TokenRef 라 이미 theme 을 따라가는데 사용자 편집 축만 뒤처지던 비대칭 해소.
  describe("raw inline 리터럴의 theme 추종", () => {
    it("light 로 저장된 프리셋이 dark 캔버스에서 dark 값이 된다", () => {
      for (const [key, css] of [
        ["sm", lightShadows.sm],
        ["md", lightShadows.md],
        ["lg", lightShadows.lg],
      ] as const) {
        expect(
          resolveEffectiveBoxShadow("box", { boxShadow: css }, "dark"),
          key,
        ).toBe(darkShadows[key]);
      }
    });

    it("dark 로 저장된 프리셋도 light 캔버스에서 light 값이 된다 (양방향)", () => {
      expect(
        resolveEffectiveBoxShadow(
          "box",
          { boxShadow: darkShadows.md },
          "light",
        ),
      ).toBe(lightShadows.md);
    });

    it("catalog 기본값이 있는 타입도 raw 가 우선한다 (정규화만 거침)", () => {
      // popover catalog 는 {shadow.md} — raw 로 lg 를 고르면 lg 가 이겨야 한다.
      expect(
        resolveEffectiveBoxShadow(
          "popover",
          { boxShadow: lightShadows.lg },
          "dark",
        ),
      ).toBe(darkShadows.lg);
    });

    it("프리셋이 아닌 임의 CSS 는 원문 보존", () => {
      const custom = "0 1px 2px rgba(255, 0, 0, 0.5)";
      expect(
        resolveEffectiveBoxShadow("box", { boxShadow: custom }, "dark"),
      ).toBe(custom);
    });

    it("적용 범위 밖(none / inset 토글)은 손대지 않는다 — DOM 이 var 로 낼 수 없어 대칭 유지", () => {
      const insetToggled = lightShadows.md
        .split(/,(?![^(]*\))/)
        .map((layer) => `inset ${layer.trim()}`)
        .join(", ");
      expect(
        resolveEffectiveBoxShadow("box", { boxShadow: "none" }, "dark"),
      ).toBe("none");
      expect(
        resolveEffectiveBoxShadow("box", { boxShadow: insetToggled }, "dark"),
      ).toBe(insetToggled);
    });
  });
});

/**
 * ADR-912 Phase 3-A-3a — `resolveCatalogContainerBase` 출력 snapshot lock.
 *
 * breakdown(`docs/adr/design/912-catalog-ssot-collapse-breakdown.md`) §Phase 3-A-3 (4) 잔존 불명점:
 *   "resolveCatalogContainerBase 출력 snapshot test 부재 → 재배선 후 break 가 회귀인지 format(kebab)
 *    변경인지 판별 불가 → 3-A-3a 진입 전 snapshot test 선작성 권장."
 *
 * 본 test 는 catalog structure.composition 단일 source 가 base container layout 을 어떤 raw 출력으로
 * 내는지(kebab-case CSS-style key, gap 은 CSS-var 문자열)를 못박는다. 이 출력을 implicitStyles wrapper
 * 가 camelCase + 숫자(gap) 로 정규화하여 소비한다. resolver 출력 자체는 변환 책임 없음(resolver.ts:16-17).
 *
 * **kill 기준**: field 9 type 모두 base layout(display:flex / flex-direction:column)을 catalog 에서
 *   파생함이 여기서 lock 됨 → wrapper 재배선 후 인라인 `?? "flex"/"column"/4` 제거가 회귀 0 임을 증명.
 */

import { describe, expect, it } from "vitest";
import {
  resolveCatalogContainerBase,
  resolveCatalogContainerVariants,
} from "../resolvers/resolveCatalogContainer";

describe("resolveCatalogContainerBase — field류 base layout (kebab raw, gap=CSS-var)", () => {
  // field 9 type: structure.composition.layout='flex-column' → LAYOUT_TOKEN_STYLES base.
  //   gap 은 composition.gap='var(--spacing-xs)' (CSS-var 문자열) — wrapper 가 숫자 4 로 정규화.
  //   TextArea 만 composition.gap 부재 → 출력에 gap 키 없음(wrapper fallback 4).

  // 2026-06-24: field 패밀리 width 정본 정정 — 기존 stale "fit-content" → "100%"
  //   (TextField/TextArea/SearchField). factory inline(width:100%) ↔ CSS Preview(fit-content)
  //   시각 비대칭 + Style Panel false dirty 해소.
  //
  // 2026-07-15: **나머지 7 type 도 catalog 로 승격** — 위 정정이 3 type 만 올리고 나머지는
  //   "factory inline 100% 가 baseline 이라 정합" 으로 남겼는데, factory 조차 root width 를
  //   안 주던 **DatePicker/DateRangePicker** 는 어느 쪽에서도 못 받아 Style 패널이 `auto` 로
  //   떨어졌다 (사용자 적발). catalog 를 패밀리 단일 정본으로 채워 split 자체를 제거.
  //   전수 계약: `fieldFamilyWidthContract.test.ts`.
  it("TextField → flex-column base + gap CSS-var + width:100%", () => {
    expect(resolveCatalogContainerBase("TextField")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      gap: "var(--spacing-xs)",
    });
  });

  it("TextArea → flex-column base + width:100%, **gap 키 부재** (composition.gap 없음)", () => {
    const base = resolveCatalogContainerBase("TextArea");
    expect(base).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
    });
    // 재배선 후 wrapper 가 gap 부재를 4 로 fallback 해야 함을 lock.
    expect(base).not.toHaveProperty("gap");
  });

  it("SearchField → flex-column base + gap CSS-var + width:100%", () => {
    expect(resolveCatalogContainerBase("SearchField")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      gap: "var(--spacing-xs)",
    });
  });

  it("NumberField → flex-column base + gap CSS-var + color + width:100%", () => {
    expect(resolveCatalogContainerBase("NumberField")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      color: "var(--fg)",
      gap: "var(--spacing-xs)",
    });
  });

  it("DateField → flex-column base + gap CSS-var + width:100% (color 없음)", () => {
    expect(resolveCatalogContainerBase("DateField")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      gap: "var(--spacing-xs)",
    });
  });

  it("TimeField → flex-column base + gap CSS-var + width:100%", () => {
    expect(resolveCatalogContainerBase("TimeField")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      gap: "var(--spacing-xs)",
    });
  });

  // DatePicker/DateRangePicker 가 2026-07-15 적발 지점 — factory 도 catalog 도 root width 를
  //   안 줘서 Style 패널이 `auto` fallback 을 표시했다. 나머지 5 는 factory inline 이 가려
  //   증상이 없었을 뿐 catalog 는 똑같이 비어 있었다.
  it("DatePicker → flex-column base + gap CSS-var + color + width:100%", () => {
    expect(resolveCatalogContainerBase("DatePicker")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      color: "var(--fg)",
      gap: "var(--spacing-xs)",
    });
  });

  it("DateRangePicker → flex-column base + gap CSS-var + color + width:100%", () => {
    expect(resolveCatalogContainerBase("DateRangePicker")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      color: "var(--fg)",
      gap: "var(--spacing-xs)",
    });
  });

  it("ComboBox → flex-column base + gap CSS-var + color + width:100%", () => {
    expect(resolveCatalogContainerBase("ComboBox")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      color: "var(--fg)",
      gap: "var(--spacing-xs)",
    });
  });

  it("Select → flex-column base + gap CSS-var + color + width:100%", () => {
    expect(resolveCatalogContainerBase("Select")).toEqual({
      display: "flex",
      "flex-direction": "column",
      "align-items": "flex-start",
      "box-sizing": "border-box",
      width: "100%",
      color: "var(--fg)",
      gap: "var(--spacing-xs)",
    });
  });
});

describe("resolveCatalogContainerBase — collection-item base-axis (3-A-3b 재배선 source)", () => {
  // ADR-912 Phase 3-A-3b (2026-06-20): GridListItem 에 structure.containerStyles 추가
  //   (권위 source = starter GridList.css:112 display:flex/flex-direction:column/min-width:0).
  //   collection 분기가 resolveCatalogContainerBase 경유로 base-axis 도달 → 인라인 자족화 제거.
  it("GridListItem → base-axis 3개 (3-A-3b structure 추가, camelCase)", () => {
    expect(resolveCatalogContainerBase("GridListItem")).toEqual({
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    });
  });

  it("ListBoxItem → structure.containerStyles 4개 camelCase (composition 부재)", () => {
    expect(resolveCatalogContainerBase("ListBoxItem")).toEqual({
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "center",
    });
  });
});

describe("resolveCatalogContainerVariants — labelPosition=side (kebab styles)", () => {
  // side-mode 판정용 flex-direction:row. hasResolvedSideLabelVariant 가 styles["flex-direction"] 으로 판정.
  // ADR-912 Phase 4: Select 는 nested(`structure.composition.containerVariants`) 에 label-position
  //   variant 를 보유 → nested fallback 으로 top-level field 류와 동일하게 side→row 복원.
  it.each([
    ["TextField"],
    ["TextArea"],
    ["SearchField"],
    ["NumberField"],
    ["DateField"],
    ["TimeField"],
    ["DatePicker"],
    ["ComboBox"],
    ["Select"],
  ])("%s side → flex-direction:row + align-items:flex-start", (type) => {
    const v = resolveCatalogContainerVariants(type, { labelPosition: "side" });
    expect(v.styles).toEqual({
      "flex-direction": "row",
      "align-items": "flex-start",
    });
  });

  // ADR-912 Phase 4 nested variant fallback 가드 — variant 를 nested(structure.composition.
  //   containerVariants)에만 보유한 컴포넌트가 top-level 부재로 silent 누락되지 않음을 회귀 차단.
  it("Form side → --form-label-width (nested composition variant)", () => {
    const v = resolveCatalogContainerVariants("Form", {
      labelPosition: "side",
    });
    expect(v.styles).toEqual({ "--form-label-width": "11rem" });
  });

  it("Toolbar vertical → flex-direction:column (nested orientation variant)", () => {
    const v = resolveCatalogContainerVariants("Toolbar", {
      orientation: "vertical",
    });
    expect(v.styles).toEqual({
      "flex-direction": "column",
      "align-items": "start",
    });
  });
});

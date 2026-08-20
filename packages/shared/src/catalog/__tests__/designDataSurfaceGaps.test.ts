import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * design-data 대조 감사 (2026-08-20, `docs/reference/audits/2026-08-20-design-data-
 * component-props-audit.md`) §1-1 "표면 단절" 회귀 가드.
 *
 * 표면 단절 = D3(rules table/CSS)와 렌더러는 이미 채널을 갖췄는데 binding `accepts`
 * 선언만 없어 프로퍼티 패널에서 편집이 불가능한 상태. 구현 신설이 아니라 **선언
 * 누락**이므로, 같은 유형이 재발하면 이 테스트가 먼저 깨지도록 고정한다.
 *
 * 주의 — 본 파일은 "accepts 에 선언만 하면 실제로 동작하는 것"만 다룬다. 감사에서
 * 같은 후보로 보고됐으나 실측 결과 소비 경로가 없거나 uncontrolled 인 3건
 * (Toast.position / Select·ComboBox.selectedKey / DatePicker.hourCycle)은 선언만으로
 * dead prop 이 되므로 제외했다. 상세는 감사 문서 §1-1 정정 주석 참조.
 */

describe("design-data 감사 §1-1 — 표면 단절 회귀 가드", () => {
  it("Tooltip: D3 variants 가 있으면 binding accepts 에도 variant 가 선언돼 있다", () => {
    const rule = COMPONENT_RULES_TABLE.Tooltip;
    const variantKeys = Object.keys(rule?.variants ?? {});

    // D3 측 전제: rules table 이 variant 를 갖는다 (없으면 이 가드 자체가 무의미).
    expect(variantKeys.length).toBeGreaterThan(1);

    const accepts = getPrimitiveBinding("Tooltip")?.props?.accepts;
    expect(accepts?.variant, "Tooltip binding accepts.variant").toBeDefined();
    expect(accepts?.variant?.kind).toBe("variant");

    // accepts default 는 rules table 의 defaultVariant 와 일치해야 한다 —
    // 불일치 시 DOM `data-variant` 가 존재하지 않는 variant 를 가리킨다.
    expect(accepts?.variant?.default).toBe(rule?.defaultVariant);
    expect(variantKeys).toContain(rule?.defaultVariant);
  });

  it("DatePicker/DateRangePicker: placeholder 편집 표면이 형제 대칭이다", () => {
    for (const type of ["DatePicker", "DateRangePicker"] as const) {
      const accepts = getPrimitiveBinding(type)?.props?.accepts;
      expect(accepts?.placeholder, `${type} accepts.placeholder`).toBeDefined();
      expect(accepts?.placeholder?.kind).toBe("string");
    }
  });
});

describe("design-data 감사 §1-2 — staticColor 축 전개", () => {
  /**
   * Skia 의 static 블록(`buildCatalogShapes`)은 컴포넌트를 식별하지 않고
   * `staticColor` prop + fill 채널 유무로만 분기한다. 따라서 D2 표면이 있고
   * fill 이 opaque 이면 별도 Skia 작업 없이 bg=static + text=역상이 성립한다.
   * 이 전제가 깨지면(예: fill 이 transparent 로 바뀌면) CSS 만 static 이 되어
   * 비대칭이 나므로, 표면과 전제를 함께 고정한다.
   */
  it("ToggleButton: staticColor D2 표면이 Button/Link 와 같은 3값으로 열려 있다", () => {
    const accepts = getPrimitiveBinding("ToggleButton")?.props?.accepts;
    const staticColor = accepts?.staticColor;

    expect(staticColor, "ToggleButton accepts.staticColor").toBeDefined();
    expect(staticColor?.default).toBe("auto");
    expect((staticColor?.options ?? []).map((o) => o.value).sort()).toEqual([
      "auto",
      "black",
      "white",
    ]);
  });

  it("ToggleButton: default variant fill 이 opaque — Skia static 분기 전제", () => {
    const rule = COMPONENT_RULES_TABLE.ToggleButton;
    const defaultVariant = rule?.variants?.[rule?.defaultVariant ?? ""];
    const base = defaultVariant?.fill?.default?.base;

    expect(base, "ToggleButton default fill base").toBeDefined();
    expect(base).not.toBe("{color.transparent}");
  });
});

describe("design-data 감사 §1-3 — 형제 비대칭 회복", () => {
  /**
   * Calendar 만 노출하고 RangeCalendar 는 빠져 있던 RSP 규정 prop 3종. 렌더러
   * 전달까지 함께 보강했으므로 표면과 형제 동등성을 같이 고정한다.
   */
  it("Calendar/RangeCalendar: isInvalid·autoFocus·pageBehavior 표면이 동등하다", () => {
    const calendar = getPrimitiveBinding("Calendar")?.props?.accepts;
    const range = getPrimitiveBinding("RangeCalendar")?.props?.accepts;

    for (const key of ["isInvalid", "autoFocus", "pageBehavior"] as const) {
      expect(calendar?.[key], `Calendar.${key}`).toBeDefined();
      expect(range?.[key], `RangeCalendar.${key}`).toBeDefined();
      expect(range?.[key]?.kind).toBe(calendar?.[key]?.kind);
    }

    const rangePageBehavior = (range?.pageBehavior?.options ?? []).map(
      (o) => o.value,
    );
    expect(rangePageBehavior.sort()).toEqual(["single", "visible"]);
  });
});

describe("design-data 감사 §1-1 — 시맨틱 variant 미배선 회귀 가드", () => {
  /**
   * 시맨틱 variant(info/positive/negative)는 각자의 의미색을 가져야 한다.
   * Toast.info 가 neutral 과 완전 동일값이라 informative(blue) 가 죽어 있던
   * 회귀를 고정한다 — 값이 같아지면 "variant 를 골라도 아무 일이 없다".
   */
  it("Toast: info 가 neutral 과 다른 fill/border 를 갖는다", () => {
    const variants = COMPONENT_RULES_TABLE.Toast?.variants;
    const info = variants?.info;
    const neutral = variants?.neutral;

    expect(info, "Toast.variants.info").toBeDefined();
    expect(neutral, "Toast.variants.neutral").toBeDefined();

    const infoBase = info?.fill?.default?.base;
    const neutralBase = neutral?.fill?.default?.base;
    expect(infoBase).not.toBe(neutralBase);
    expect(infoBase).toContain("informative");
    expect(info?.colors?.border).toContain("informative");
  });

  it("Toast: 시맨틱 variant 3종이 각각 고유한 fill 을 갖는다", () => {
    const variants = COMPONENT_RULES_TABLE.Toast?.variants ?? {};
    const bases = (["info", "positive", "negative"] as const).map(
      (key) => variants[key]?.fill?.default?.base,
    );

    expect(bases.every(Boolean), "3종 fill base 존재").toBe(true);
    expect(new Set(bases).size, "3종이 서로 다른 fill").toBe(3);
  });

  /**
   * 수동 `Toast.css` 는 imperative 런타임(ToastProvider/ToastRegion) 전용인데
   * canonical Toast element 와 `.react-aria-Toast` 클래스를 공유한다. 이 파일은
   * unlayered, generated CSS 는 `@layer components` 안이라 스코프 없이 두면
   * cascade layer 규칙상 수동이 항상 이겨 canonical 이 catalog 대신 런타임 값을
   * 받는다 (Skia 는 catalog 직접 read → 시각 비대칭). 스코프 이탈을 고정한다.
   */
  /**
   * 2026-07-29 사용자 결정 — "컨테이너 높이는 내용이 정하고, 잘라야 하면 요소별로
   * 저작한다. catalog 가 전 인스턴스에 300 을 강제할 근거가 없다." ListBox 에만
   * 적용되고 동형 collection 인 Tree 에는 누락돼 있었다 (게다가 수동 Tree.css 는
   * `max-height:100%` 라 DOM↔Skia 상한이 서로 달랐다). 재유입을 막는다.
   */
  it("collection 컨테이너: catalog 가 고정 maxHeight 를 강제하지 않는다", () => {
    for (const type of ["ListBox", "Tree"] as const) {
      const container = COMPONENT_RULES_TABLE[type]?.containerStyles as
        | Record<string, unknown>
        | undefined;
      expect(container, `${type} containerStyles`).toBeDefined();
      expect(container?.maxHeight, `${type} 고정 maxHeight`).toBeUndefined();
      // overflow 는 남아야 한다 — 높이를 저작했을 때 스크롤이 살아나는 채널.
      expect(container?.overflow).toBe("auto");
    }
  });

  it("Toast: 수동 CSS 의 .react-aria-Toast 규칙이 런타임 region 스코프를 벗어나지 않는다", () => {
    const cssPath = fileURLToPath(
      new URL("../../components/styles/Toast.css", import.meta.url),
    );
    const css = readFileSync(cssPath, "utf8");

    // 주석을 걷어낸 뒤 셀렉터 줄만 본다 (주석 안의 클래스명은 설명 텍스트).
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const unscoped = withoutComments
      .split("\n")
      .filter((line) => line.includes(".react-aria-Toast"))
      .filter((line) => !line.includes(".react-aria-ToastRegion"));

    expect(unscoped, "런타임 스코프를 벗어난 셀렉터").toEqual([]);
  });
});

/**
 * S2 press 효과 (2026-11-04) — catalog 식 (`rule/pressScale.ts`) · 측정 runtime (`pressScale.runtime.ts`) · 생성 CSS.
 *
 * (a) catalog 식이 설치된 `@react-spectrum/s2` 1.8.1 `pressScale.ts` 의 식과 같다 (oracle = 설치본 소스).
 * (b) runtime 은 누른 요소 (와 `CATALOG_PRESS_PARTS` 부품) 의 layout 크기를 두 변수에 쓰고, 놓으면 지운다.
 * (c) 생성 CSS 에 옛 `scale(0.95)` 가 없고, S2 가 press 를 두지 않는 RAC Button slot 은 제외된다.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CATALOG_PRESS_HEIGHT_VAR,
  CATALOG_PRESS_PROPERTY_CSS,
  CATALOG_PRESS_WIDTH_VAR,
  CATALOG_PRESS_WILL_CHANGE,
  S2_PRESS_DEPTH_PX,
  S2_PRESS_MIN_PERSPECTIVE_PX,
  S2_PRESS_WIDTH_DIVISOR,
  catalogPressTransform,
} from "../../../../../../packages/shared/src/catalog/rule/pressScale";
import { registerCatalogPressScale } from "../../../../../../packages/shared/src/catalog/runtime/pressScale.runtime";
import { catalogStateStylesheet } from "../../../../../../packages/shared/src/catalog/runtime/stateStyles";
import { SLIDER_THUMB_RAC_TRANSFORM } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";

const require = createRequire(import.meta.url);
const GENERATED = path.resolve(
  __dirname,
  "../../../../../../packages/shared/src/components/styles/generated",
);
const sheet = (name: string) =>
  fs.readFileSync(path.join(GENERATED, `${name}.css`), "utf8");

describe("S2 press — catalog 식 = 설치된 S2 pressScale", () => {
  it("(a) perspective(max(높이, 너비 / 3, 24)) translate3d(0, 0, -2px) · will-change transform", () => {
    const pkg = fs.realpathSync(
      require.resolve("@react-spectrum/s2/package.json"),
    );
    expect(JSON.parse(fs.readFileSync(pkg, "utf8")).version).toBe("1.8.1");
    const source = fs.readFileSync(
      path.join(path.dirname(pkg), "src/pressScale.ts"),
      "utf8",
    );
    expect(source).toContain(
      `perspective(\${Math.max(height, width / ${S2_PRESS_WIDTH_DIVISOR}, ${S2_PRESS_MIN_PERSPECTIVE_PX})}px) translate3d(0, 0, -${S2_PRESS_DEPTH_PX}px)`,
    );
    expect(source).toContain(
      `willChange: \`\${style?.willChange ?? ''} ${CATALOG_PRESS_WILL_CHANGE}\``,
    );
    expect(catalogPressTransform()).toBe(
      `perspective(max(var(${CATALOG_PRESS_HEIGHT_VAR}, 0px), calc(var(${CATALOG_PRESS_WIDTH_VAR}, 0px) / 3), 24px)) translate3d(0, 0, -2px)`,
    );
    // S2 prepends the element's own transform.
    expect(catalogPressTransform("translate(-50%, -50%)")).toMatch(
      /^translate\(-50%, -50%\) perspective\(/,
    );
  });

  it("(a3) Slider thumb 의 앞붙임 = 설치된 RAC useSliderThumb 의 inline transform", () => {
    const rac = path.dirname(
      fs.realpathSync(require.resolve("react-aria-components/package.json")),
    );
    const ariaRequire = createRequire(path.join(rac, "package.json"));
    const aria = path.dirname(
      fs.realpathSync(ariaRequire.resolve("react-aria/package.json")),
    );
    const thumb = fs.readFileSync(
      path.join(aria, "dist/private/slider/useSliderThumb.mjs"),
      "utf8",
    );
    expect(thumb).toContain(`transform: '${SLIDER_THUMB_RAC_TRANSFORM}'`);
  });

  it("(a2) 크기 변수는 상속되지 않는 0px 로 등록된다 (CatalogStates.css)", () => {
    for (const name of [CATALOG_PRESS_WIDTH_VAR, CATALOG_PRESS_HEIGHT_VAR])
      expect(CATALOG_PRESS_PROPERTY_CSS).toContain(
        `@property ${name} { syntax: "<length>"; inherits: false; initial-value: 0px; }`,
      );
    expect(catalogStateStylesheet()).toContain(CATALOG_PRESS_PROPERTY_CSS);
    expect(sheet("CatalogStates")).toBe(catalogStateStylesheet());
  });
});

describe("S2 press — 크기 측정 runtime", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });
  const sized = <T extends HTMLElement>(
    el: T,
    width: number,
    height: number,
  ) => {
    Object.defineProperty(el, "offsetWidth", { value: width });
    Object.defineProperty(el, "offsetHeight", { value: height });
    return el;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("(b) data-pressed 가 붙으면 그 요소의 layout 크기, 떨어지면 제거 — 자손은 건드리지 않는다", async () => {
    dispose = registerCatalogPressScale(document);
    const button = sized(document.createElement("button"), 120, 32);
    const icon = sized(document.createElement("span"), 16, 16);
    button.append(icon);
    document.body.append(button);

    button.setAttribute("data-pressed", "true");
    await flush();
    expect(button.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe(
      "120px",
    );
    expect(button.style.getPropertyValue(CATALOG_PRESS_HEIGHT_VAR)).toBe(
      "32px",
    );
    expect(icon.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("");

    button.removeAttribute("data-pressed");
    await flush();
    expect(button.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("");
    expect(button.style.getPropertyValue(CATALOG_PRESS_HEIGHT_VAR)).toBe("");
  });

  it("(b2) Slider thumb 의 data-dragging 도 press 다 (S2 Slider `isPressed: isDragging`)", async () => {
    dispose = registerCatalogPressScale(document);
    const thumb = sized(document.createElement("div"), 18, 18);
    document.body.append(thumb);
    thumb.setAttribute("data-dragging", "true");
    await flush();
    expect(thumb.style.getPropertyValue(CATALOG_PRESS_HEIGHT_VAR)).toBe("18px");
  });

  it("(b3) ToggleButtonGroup 멤버를 누르면 안쪽 span 을 잰다 (S2 SegmentedControl 안쪽 div)", async () => {
    dispose = registerCatalogPressScale(document);
    const group = document.createElement("div");
    group.className = "react-aria-ToggleButtonGroup";
    const member = sized(document.createElement("button"), 90, 32);
    member.className = "react-aria-ToggleButton";
    const span = sized(document.createElement("span"), 60, 20);
    member.append(span);
    group.append(member);
    document.body.append(group);

    member.setAttribute("data-pressed", "true");
    await flush();
    expect(span.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("60px");
    expect(span.style.getPropertyValue(CATALOG_PRESS_HEIGHT_VAR)).toBe("20px");
    member.removeAttribute("data-pressed");
    await flush();
    expect(span.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("");
  });

  it("(b5) SideNav 링크를 누르면 행을, quiet Card 를 누르면 preview 를 잰다", async () => {
    dispose = registerCatalogPressScale(document);
    const row = sized(document.createElement("div"), 240, 32);
    row.className = "react-aria-SideNavItem";
    const cell = document.createElement("div");
    const link = sized(document.createElement("a"), 200, 20);
    link.className = "react-aria-SideNavItemLink";
    cell.append(link);
    row.append(cell);
    const card = sized(document.createElement("div"), 300, 400);
    card.className = "react-aria-Card";
    card.setAttribute("data-variant", "quiet");
    const preview = sized(document.createElement("div"), 300, 200);
    preview.className = "react-aria-CardPreview";
    card.append(preview);
    document.body.append(row, card);

    link.setAttribute("data-pressed", "true");
    card.setAttribute("data-pressed", "true");
    await flush();
    expect(row.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("240px");
    expect(preview.style.getPropertyValue(CATALOG_PRESS_HEIGHT_VAR)).toBe(
      "200px",
    );
    link.removeAttribute("data-pressed");
    await flush();
    expect(row.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("");
  });

  it("(b4) 해제 뒤에는 쓰지 않는다", async () => {
    registerCatalogPressScale(document)();
    const button = sized(document.createElement("button"), 50, 30);
    document.body.append(button);
    button.setAttribute("data-pressed", "true");
    await flush();
    expect(button.style.getPropertyValue(CATALOG_PRESS_WIDTH_VAR)).toBe("");
  });
});

describe("S2 press — 생성 CSS", () => {
  it("(c) 옛 scale(0.95) 0 · Button 은 chevron · drag · trigger slot 제외 · Disclosure 예외 삭제", () => {
    for (const name of ["Button", "ToggleButton", "ToggleButtonGroup"])
      expect(sheet(name)).not.toMatch(/scale\(0\.95\)|scale: 0\.9/);
    const button = sheet("Button");
    const exclude =
      ".react-aria-Button.react-aria-Button:not([slot='chevron'], [slot='drag'], [slot='trigger'])";
    expect(button).toContain(
      `${exclude}:where([data-pressed]) {\n  transform: ${catalogPressTransform()};`,
    );
    expect(button).toContain(`${exclude} {\n  will-change: transform;`);
    expect(sheet("ToggleButton")).toContain(
      `transform: ${catalogPressTransform()};`,
    );
    expect(sheet("Disclosure")).not.toMatch(/transform: none|scale: none/);
  });

  it("(c2) 부품 press — Checkbox 상자 · Radio 고리 · Switch 손잡이 · Calendar 셀 · Slider thumb (끄는 중)", () => {
    const press = `transform: ${catalogPressTransform()};`;
    expect(sheet("Checkbox")).toContain(
      `.react-aria-CheckboxButton:where([data-pressed]) .checkbox {\n  ${press}`,
    );
    expect(sheet("Radio")).toContain(press);
    const switchCss = sheet("Switch");
    expect(switchCss).toContain(press);
    expect(switchCss).not.toMatch(/scale: 1\.2 1|transform-origin: right center/);
    for (const name of ["Calendar", "RangeCalendar"])
      expect(sheet(name)).toContain(
        `.react-aria-CalendarCell:where([data-pressed]) {\n  ${press}`,
      );
    expect(sheet("Slider")).toContain(
      `.react-aria-SliderThumb:where([data-dragging]) {\n  transform: ${catalogPressTransform(SLIDER_THUMB_RAC_TRANSFORM)} !important;`,
    );
    const manual = fs.readFileSync(
      path.join(GENERATED, "../CalendarCommon.css"),
      "utf8",
    );
    expect(manual).not.toMatch(/scale: 0\.9|transition: scale/);
  });

  it("(c3) 행 · 항목 press — MenuItem · picker 안 ListBoxItem · Tag · Card · SideNavItem · Toast 닫기", () => {
    const press = `transform: ${catalogPressTransform()};`;
    expect(sheet("MenuItem")).toContain(
      `.react-aria-MenuItem.react-aria-MenuItem:where([data-pressed]) {\n  ${press}`,
    );
    // (S2 presses a picker's option only — a standalone ListBox's does not.)
    expect(sheet("ListBoxItem")).toContain(
      `.react-aria-ListBoxItem.react-aria-ListBoxItem:where([data-pressed]:is(.react-aria-Popover *)) {\n  ${press}`,
    );
    expect(sheet("ListBoxItem")).not.toContain(
      `.react-aria-ListBoxItem.react-aria-ListBoxItem:where([data-pressed]) {`,
    );
    const tags = sheet("TagGroup");
    expect(tags).toContain(
      `.react-aria-Tag:where([data-pressed]) {\n  scale: none;\n  ${press}`,
    );
    expect(tags).toContain(
      `.tag-remove-btn:where([data-pressed]) {\n  scale: none;\n  ${press}`,
    );
    const card = sheet("Card");
    expect(card).toContain(
      `.react-aria-Card.react-aria-Card:where([data-pressed]) {\n  ${press}`,
    );
    expect(card).toContain(
      `.react-aria-Card.react-aria-Card:where([data-pressed][data-variant="quiet"]) {\n  transform: none;`,
    );
    expect(card).toContain(
      `:where([data-variant="quiet"][data-pressed]) .react-aria-CardPreview {\n  ${press}`,
    );
    expect(sheet("SideNavItem")).toContain(
      `.react-aria-SideNavItem.react-aria-SideNavItem:has(.react-aria-SideNavItemLink:where([data-pressed])) {\n  ${press}`,
    );
    expect(sheet("Toast")).toContain(
      `> .toast-close-button[data-pressed] {\n    transform: ${catalogPressTransform("translateY(-50%)")};`,
    );
  });
});

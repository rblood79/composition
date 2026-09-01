import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuButton } from "../Menu";

/**
 * ADR-923 r19m1 — 렌더러 (`renderMenu`, r18m1) 가 텍스트 원천 계약으로 낸 빈 label 을 컴포넌트의
 * `label || "Menu"` 가 다시 "Menu" 로 되살렸다 (Skia 는 기본 글자 없음). 계약 결과 그대로 — 부재도 "".
 */
describe("ADR-923 r19m1 — Menu trigger label 기본 글자 없음", () => {
  it("label '' → trigger 글자 없음 (종전 'Menu')", () => {
    const markup = renderToStaticMarkup(<MenuButton label="" items={[]} />);
    expect(markup).not.toContain(">Menu<");
  });
  it("label 부재 → 글자 없음 (계약: Menu 는 label → children, 둘 다 없으면 '')", () => {
    const markup = renderToStaticMarkup(<MenuButton items={[]} />);
    expect(markup).not.toContain(">Menu<");
  });
  it("label 있음 → 그대로", () => {
    const markup = renderToStaticMarkup(
      <MenuButton label="Actions" items={[]} />,
    );
    expect(markup).toContain("Actions");
  });
});

/**
 * ADR-923 r20m2 — 보이는 글자 계약과 D1 접근성 이름은 다른 경로다. r19m1 이 `label || "Menu"` 를
 * 지우자 직접 사용한 빈 `<MenuButton>` 의 RAC Button 은 이름이 없어졌고, 호출자가 준 `aria-label`
 * 은 `{...props}` 로 `MenuTrigger` (context provider — `BaseMenuTriggerProps` 에 aria 없음) 에
 * 가서 버려졌다. 이름 경로: 보이는 글자 → 호출자 `aria-label`/`aria-labelledby` → 컴포넌트 기본
 * (i18n "Menu", 속성이라 화면·Skia 에는 없다).
 */
const triggerOf = (markup: string): string =>
  markup.match(/<button[^>]*>/)?.[0] ?? "";

describe("ADR-923 r20m2 — Menu trigger 접근성 이름 경로", () => {
  it("label '' + aria 없음 → trigger 에 기본 aria-label (보이는 글자는 없음)", () => {
    const markup = renderToStaticMarkup(<MenuButton label="" items={[]} />);
    const trigger = triggerOf(markup);
    expect(trigger).toContain('aria-label="Menu"');
    expect(markup).not.toContain(">Menu<");
  });
  it("label '' + aria-label → 호출자 값이 trigger 에 도달 (MenuTrigger 로 버려지지 않는다)", () => {
    const markup = renderToStaticMarkup(
      <MenuButton label="" aria-label="Actions" items={[]} />,
    );
    expect(triggerOf(markup)).toContain('aria-label="Actions"');
  });
  it("label '' + aria-labelledby → 기본 aria-label 을 덧붙이지 않는다", () => {
    const markup = renderToStaticMarkup(
      <MenuButton label="" aria-labelledby="heading-1" items={[]} />,
    );
    const trigger = triggerOf(markup);
    expect(trigger).toContain('aria-labelledby="heading-1"');
    expect(trigger).not.toContain("aria-label=");
  });
  it("label 있음 + aria 없음 → 보이는 글자가 이름 (aria-label 없음)", () => {
    const markup = renderToStaticMarkup(
      <MenuButton label="Actions" items={[]} />,
    );
    expect(triggerOf(markup)).not.toContain("aria-label=");
  });
  it("dataBinding 분기 (loading) 도 같은 trigger — 이름 경로 동일", () => {
    const markup = renderToStaticMarkup(
      <MenuButton
        label=""
        items={[]}
        dataBinding={{ type: "collection", source: "api", name: "x" } as never}
        columnMapping={{ label: "name" } as never}
      />,
    );
    expect(triggerOf(markup)).toContain('aria-label="Menu"');
  });
});

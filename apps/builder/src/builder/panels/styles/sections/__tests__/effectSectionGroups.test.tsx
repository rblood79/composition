// @vitest-environment jsdom
/**
 * 2026-10-28 사용자 결정 — Effect 절의 Opacity · Box Shadows · Filters 는 기본 「없음」 이고
 * 절 머리줄 「+」 메뉴로 추가한다. 값이 있는 효과만 `fieldset` (legend + 내용) 으로 그린다.
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import {
  openStylesFixture,
  type StylesFixtureNode,
} from "../../__tests__/support/catalogStylesFixture";
import { EffectSection } from "../EffectSection";

afterEach(cleanup);

/** 절 본문의 fieldset legend 글자 (Slider 도 이름이 같은 group 이라 role 로는 둘이 잡힌다) */
const legendsOf = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll(".section-content fieldset > legend"),
    (legend) => legend.textContent,
  );

async function renderEffect(nodes: StylesFixtureNode[]) {
  const fixture = await openStylesFixture(nodes, { select: "box" });
  const Wrapper = fixture.wrapper;
  const view = render(
    <I18nProvider initialLocale="en-US">
      <Wrapper>
        <EffectSection />
      </Wrapper>
    </I18nProvider>,
  );
  return { fixture, view };
}

describe("EffectSection groups", () => {
  it("draws no group when the element has no opacity, shadow or filter", async () => {
    const { view } = await renderEffect([{ id: "box" }]);
    expect(legendsOf(view.container)).toEqual([]);
    expect(view.getByRole("button", { name: "Add effect" })).toBeTruthy();
  });

  it("draws each authored effect as a fieldset with its legend — Opacity · Blur · Box Shadows", async () => {
    const { view } = await renderEffect([
      {
        id: "box",
        style: {
          opacity: "0.5",
          boxShadow: "0px 4px 12px 0px rgba(0, 0, 0, 0.2)",
          filter: "blur(4px)",
        },
      },
    ]);
    expect(legendsOf(view.container)).toEqual([
      "Opacity",
      "Filters",
      "Box Shadows",
    ]);
  });

  it("adds opacity from the header menu and removes it from its row", async () => {
    const { fixture, view } = await renderEffect([{ id: "box" }]);
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Add effect" }));
    });
    await act(async () => {
      fireEvent.click(await view.findByRole("menuitem", { name: "Opacity" }));
    });
    expect(Number(fixture.styleOf("box").opacity)).toBe(1);
    expect(legendsOf(view.container)).toEqual(["Opacity"]);

    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Remove opacity" }));
    });
    expect(fixture.styleOf("box").opacity).toBeUndefined();
    expect(legendsOf(view.container)).toEqual([]);
  });
});

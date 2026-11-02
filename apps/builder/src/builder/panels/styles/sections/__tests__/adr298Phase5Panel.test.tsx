// @vitest-environment jsdom
/**
 * ADR-298 Phase 5 — the three token-model mocks (`docs/design/styles-token-model/`, 사용자 결정
 * 2026-11-02 「4건 모두 298 에서」): ① Border rows Width | Color · Style | Sides ② Line Height
 * auto shows the paired px ③ Font shows a 「Theme」 chip when no family is authored (the theme base
 * family) ④ a shadow token is one row (chip + 「x y blur · alpha%」); − removes it whole.
 */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import {
  openStylesFixture,
  type StylesFixtureNode,
} from "../../__tests__/support/catalogStylesFixture";
import { BorderSection } from "../BorderSection";
import { EffectSection } from "../EffectSection";
import { TypographySection } from "../TypographySection";
import { FONT_SIZE_PRESET_OPTIONS } from "../../../../components/property/propertyUnitPresets";

afterEach(cleanup);

async function renderWith(Section: React.ComponentType, nodes: StylesFixtureNode[]) {
  const fixture = await openStylesFixture(nodes, { select: nodes[0]!.id });
  const Wrapper = fixture.wrapper;
  const view = render(
    <I18nProvider initialLocale="en-US">
      <Wrapper>
        <Section />
      </Wrapper>
    </I18nProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { fixture, view };
}

const token = (tokenId: string) => ({ kind: "set", value: { kind: "token", tokenId } });

describe("ADR-298 Phase 5 — mock rows", () => {
  it("① Border: Width | Color on one row, Style | Sides on the next", async () => {
    const { view } = await renderWith(BorderSection, [{ id: "box" }]);
    const first = view.container.querySelector(".style-border-width")!;
    expect(first.querySelector("fieldset.border-width")).not.toBeNull();
    expect(first.querySelector("fieldset.border-color, .border-color")).not.toBeNull();
    const second = view.container.querySelector(".style-border")!;
    expect(second.querySelector("fieldset.border-style")).not.toBeNull();
    expect(second.querySelector("fieldset.border-sides")).not.toBeNull();
    expect(view.container.querySelector(".style-border-sides")).toBeNull();
  });

  it("② Line Height auto: 「auto」 chip + the font-size token's paired line height", async () => {
    const { view } = await renderWith(TypographySection, [
      {
        id: "t",
        type: "Text",
        props: { children: "Hello" },
        // the panel's token text (`panelTokens` writes the TokenUse)
        style: {
          fontSize: FONT_SIZE_PRESET_OPTIONS.find((p) => p.id === "heading-lg")!.value,
        },
      },
    ]);
    const line = view.container.querySelector("fieldset.line-height") as HTMLElement;
    expect(line.querySelector('[data-keyword="auto"]')?.textContent).toBe("auto");
    // heading lg = 28 / 32 (ADR-295 S2 식)
    expect(within(line).getByRole("combobox").getAttribute("placeholder")).toBe("32");
  });

  it("③ Font: no authored family = 「Theme」 chip + the family in use; an authored family has no chip", async () => {
    const { view } = await renderWith(TypographySection, [
      { id: "t", type: "Text", props: { children: "Hello" } },
    ]);
    const trigger = view.getAllByRole("button", { name: "Font Family" })[0]!;
    expect(trigger.querySelector(".font-picker-theme-chip")?.textContent).toBe("Theme");
    expect(trigger.querySelector(".font-picker-value")?.textContent).not.toBe("");
    cleanup();
    const authored = await renderWith(TypographySection, [
      { id: "t2", type: "Text", props: { children: "Hi" }, style: { fontFamily: "Inter" } },
    ]);
    const t2 = authored.view.getAllByRole("button", { name: "Font Family" })[0]!;
    expect(t2.querySelector(".font-picker-theme-chip")).toBeNull();
    expect(t2.querySelector(".font-picker-value")?.textContent).toBe("Inter");
  });

  it("④ a shadow token is one row (chip + 「0 2 8 · 8%」); − removes the shadow, a literal keeps a row per layer", async () => {
    const { fixture, view } = await renderWith(EffectSection, [
      { id: "box", style: { boxShadow: "var(--shadow-sm)" } },
    ]);
    expect((fixture.nodeOf("box").visual as Record<string, unknown>).boxShadow).toEqual(
      token("lib:token:shadow_sm"),
    );
    const rows = view.container.querySelectorAll(".style-shadow .effect-layer-row");
    expect(rows.length).toBe(1);
    expect(rows[0]!.querySelector(".property-unit-input__token")?.textContent).toBe("S");
    expect(rows[0]!.querySelector(".effect-layer-row__value")?.textContent).toBe("0 2 8 · 8%");
    await act(async () => {
      fireEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Remove shadow" }));
    });
    expect((fixture.nodeOf("box").visual as Record<string, unknown>).boxShadow).toBeUndefined();
    cleanup();
    const literal = await renderWith(EffectSection, [
      { id: "b2", style: { boxShadow: "0 1px 2px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)" } },
    ]);
    expect(literal.view.container.querySelectorAll(".style-shadow .effect-layer-row").length).toBe(2);
    expect(literal.view.container.querySelector(".style-shadow .property-unit-input__token")).toBeNull();
  });
});

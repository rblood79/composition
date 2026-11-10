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
    // 칸 글자 「auto」 · 따르는 행간은 풍선 — heading lg = 28 / 32 (ADR-295 S2 식)
    const lineInput = within(line).getByRole("combobox") as HTMLInputElement;
    expect(lineInput.value).toBe("auto");
    expect(lineInput.title).toBe("auto · 32");
    expect(line.querySelector(".property-unit-input__token")).toBeNull();
  });

  it("③ Font: no authored family = 「Theme」 chip + the family in use; an authored family has no chip", async () => {
    const { view } = await renderWith(TypographySection, [
      { id: "t", type: "Text", props: { children: "Hello" } },
    ]);
    const trigger = view.getAllByRole("button", { name: "Font family" })[0]!;
    // legend 는 다른 Select 칸과 같다 (2026-11-10 사용자 지적 — 이 칸만 legend 가 없었다)
    expect(trigger.closest("fieldset")?.querySelector("legend")?.textContent).toBe(
      "Font family",
    );
    expect(trigger.querySelector(".font-picker-theme-chip")?.textContent).toBe("Theme");
    expect(trigger.querySelector(".font-picker-value")?.textContent).not.toBe("");
    cleanup();
    const authored = await renderWith(TypographySection, [
      { id: "t2", type: "Text", props: { children: "Hi" }, style: { fontFamily: "Inter" } },
    ]);
    const t2 = authored.view.getAllByRole("button", { name: "Font family" })[0]!;
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
    expect(rows[0]!.querySelector(".property-unit-input__token")?.textContent).toBe("Emphasized");
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

  // 2026-11-10 사용자 보고: Library Popover 는 3행, 토큰을 적용한 Button 은 1행 — rule 의 `{shadow.md}`
  //   가 light 리터럴로 풀려 패널이 토큰인 줄 몰랐다. rule 의 토큰도 한 행 + 용도 칩이다.
  //   fixture 의 Popover 원본은 뿌리가 DialogTrigger 라 (Popover 는 그 안 부품) 뿌리가 같은 토큰을 가진 Toast 로 잰다.
  it("⑤ a rule's shadow token (Toast `{shadow.md}`) is one row with the Spectrum purpose chip; − writes `none`", async () => {
    const { fixture, view } = await renderWith(EffectSection, [{ id: "toast", type: "Toast" }]);
    const rows = view.container.querySelectorAll(".style-shadow .effect-layer-row");
    expect(rows.length).toBe(1);
    expect(rows[0]!.querySelector(".property-unit-input__token")?.textContent).toBe("Elevated");
    expect((fixture.nodeOf("toast").visual as Record<string, unknown>).boxShadow).toBeUndefined();
    await act(async () => {
      fireEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Remove shadow" }));
    });
    // the node had nothing to clear — removing the rule's shadow is an authored `none`
    expect((fixture.nodeOf("toast").visual as Record<string, unknown>).boxShadow).toEqual({
      kind: "set",
      value: "none",
    });
    expect(view.container.querySelectorAll(".style-shadow .effect-layer-row").length).toBe(0);
  });
});

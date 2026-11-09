// @vitest-environment jsdom
/**
 * ADR-298 Phase 2 — the Design panel writes theme tokens (D3 · D4): a preset is the node's
 * `TokenUse`, the field shows the step's chip + the active value, a typed number is a literal
 * (D9), Border Width is a token field (사용자 결정 3), Blur is a unit input and the Size ·
 * Position status text sits in its field (결정 6 — 감사 C4 · E2). Oracle = the document field.
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
import { LayoutSection } from "../LayoutSection";
import { PositionSection } from "../TransformSection";
import { TypographySection } from "../TypographySection";

afterEach(cleanup);

async function renderWith(
  Section: React.ComponentType,
  nodes: StylesFixtureNode[] = [{ id: "box" }],
) {
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

const visualOf = (
  fixture: Awaited<ReturnType<typeof openStylesFixture>>,
  id: string,
) => fixture.nodeOf(id).visual as Record<string, unknown>;
const tokenSet = (tokenId: string) => ({
  kind: "set",
  value: { kind: "token", tokenId },
});
const field = (container: HTMLElement, className: string) =>
  container.querySelector(`fieldset.${className}`) as HTMLElement;

/** Opens a field's ▾ preset menu and picks an option by its accessible name. */
async function pick(fieldset: HTMLElement, option: string) {
  const buttons = within(fieldset).getAllByRole("button");
  await act(async () => {
    fireEvent.click(buttons[buttons.length - 1]!);
  });
  await act(async () => {
    fireEvent.click(document.querySelector(`[role="option"][aria-label="${option}"]`)!);
  });
}

describe("ADR-298 Phase 2 — Border", () => {
  it("Width is a token field (none · thin · thick) and Radius M stores the token with its chip", async () => {
    const { fixture, view } = await renderWith(BorderSection);
    await pick(field(view.container, "border-width"), "thin");
    expect(visualOf(fixture, "box").borderWidth).toEqual(
      tokenSet("lib:token:border_width_thin"),
    );
    await pick(field(view.container, "border-radius"), "M");
    expect(visualOf(fixture, "box").radius).toEqual(
      tokenSet("lib:token:radius_md"),
    );
    const radius = field(view.container, "border-radius");
    // 칸은 단계 이름 · px 는 title (2026-11-10 — 칩 + 해석값 대신)
    const radiusInput = within(radius).getByRole("combobox") as HTMLInputElement;
    expect(radiusInput.value).toBe("M");
    expect(radiusInput.title).toBe("M · 8px");
    expect(radius.querySelector(".property-unit-input__token")).toBeNull();
    const width = field(view.container, "border-width");
    const widthInput = within(width).getByRole("combobox") as HTMLInputElement;
    expect(widthInput.value).toBe("thin");
    expect(widthInput.title).toBe("thin · 1px");
  });

  it("focus + blur keeps the token; a typed number is a literal (D9)", async () => {
    const { fixture, view } = await renderWith(BorderSection, [
      { id: "box", style: { borderRadius: "var(--radius-md)" } },
    ]);
    const input = within(field(view.container, "border-radius")).getByRole(
      "combobox",
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.blur(input);
    });
    expect(visualOf(fixture, "box").radius).toEqual(tokenSet("lib:token:radius_md"));
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "12" } });
      fireEvent.blur(input);
    });
    expect(visualOf(fixture, "box").radius).toEqual({ kind: "set", value: 12 });
  });
});

describe("ADR-298 Phase 2 — Effect", () => {
  it("a shadow preset is the `{shadow.*}` token — one row carries the step (Phase 5 시안)", async () => {
    const { fixture, view } = await renderWith(EffectSection);
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: "Add effect" }));
    });
    await act(async () => {
      fireEvent.click(await view.findByRole("menuitem", { name: "Box Shadows · M" }));
    });
    expect(visualOf(fixture, "box").boxShadow).toEqual(tokenSet("lib:token:shadow_md"));
    // Phase 5 (시안): the step chip sits in the token's one row (was the legend)
    const rows = view.container.querySelectorAll(".style-shadow .effect-layer-row");
    expect(rows.length).toBe(1);
    expect(rows[0]!.querySelector(".property-unit-input__token")?.textContent).toBe("M");
  });

  it("Blur is a unit input (감사 C4) — typing commits the filter", async () => {
    const { fixture, view } = await renderWith(EffectSection, [
      { id: "box", style: { filter: "blur(4px)" } },
    ]);
    expect(view.container.querySelector(".scrub-input")).toBeNull();
    const input = within(field(view.container, "effect-blur")).getByRole(
      "combobox",
    ) as HTMLInputElement;
    expect(input.value).toBe("4");
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "10" } });
      fireEvent.blur(input);
    });
    expect(fixture.styleOf("box").filter).toBe("blur(10px)");
  });
});

describe("ADR-298 Phase 2 — Text", () => {
  it("Font Size offers Body and Heading groups; Heading M stores the token and Line Height is auto", async () => {
    const { fixture, view } = await renderWith(TypographySection, [
      { id: "t", type: "Text", props: { children: "Hello" } },
    ]);
    const size = field(view.container, "font-size");
    const buttons = within(size).getAllByRole("button");
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    const groups = Array.from(
      document.querySelectorAll(".property-unit-input-popover [role='group']"),
      (group) => group.getAttribute("aria-label"),
    );
    expect(groups).toEqual(["Body", "Heading"]);
    await act(async () => {
      fireEvent.click(document.querySelector('[role="option"][aria-label="Heading M"]')!);
    });
    expect(visualOf(fixture, "t").fontSize).toEqual(
      tokenSet("lib:token:typography_text-heading-md"),
    );
    expect((within(size).getByRole("combobox") as HTMLInputElement).value).toBe("H M");
    // Phase 5: the field reads 「auto」 and the step's paired line height is its title
    const line = field(view.container, "line-height");
    const lineInput = within(line).getByRole("combobox") as HTMLInputElement;
    expect(lineInput.value).toBe("auto");
    expect(lineInput.title).toBe("auto · 26");
  });
});

describe("ADR-298 Phase 2 — Layout Gap", () => {
  it("one-line flex: a Gap token is the main-axis longhand's token (Phase 3 — layout token fields)", async () => {
    const { fixture, view } = await renderWith(LayoutSection, [
      {
        id: "box",
        style: { display: "flex", flexDirection: "row", columnGap: "6px" },
      },
    ]);
    await pick(view.container.querySelector("fieldset.displayGap") as HTMLElement, "M");
    expect(
      (fixture.nodeOf("box") as unknown as { layout?: Record<string, unknown> })
        .layout?.columnGap,
    ).toEqual(tokenSet("lib:token:spacing_md"));
    expect(visualOf(fixture, "box").gap).toBeUndefined();
    const gap = view.container.querySelector("fieldset.displayGap")!;
    expect((within(gap as HTMLElement).getByRole("combobox") as HTMLInputElement).value).toBe("M");
  });
});

describe("ADR-298 Phase 2 — Position status in its field (감사 E2)", () => {
  it("the summary is the Position field's description, not a paragraph under the section", async () => {
    const { view } = await renderWith(PositionSection);
    // The Position section starts folded (static element) — open it.
    const header = view.getAllByRole("button").find((button) =>
      button.getAttribute("aria-expanded") === "false",
    );
    if (header)
      await act(async () => {
        fireEvent.click(header);
      });
    expect(view.container.querySelector("p.position-summary")).toBeNull();
    const status = view.container.querySelector(
      "fieldset.position-mode > [slot='description']",
    );
    expect(status?.textContent).toContain("In the flow");
  });
});

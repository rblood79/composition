// @vitest-environment jsdom
/**
 * ADR-298 Phase 3 — the Design panel writes color and layout tokens (사용자 결정 2 · 4): the color
 * picker's Theme palette comes first and its swatch is the token (a fill layer's `TokenUse`, the row
 * shows the token's name), grid Gap X · Y store the longhand's token, a Position side written as a
 * token shows its chip. Oracle = the document field.
 */
import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import {
  openStylesFixture,
  type StylesFixtureNode,
} from "../../__tests__/support/catalogStylesFixture";
import { FillSection } from "../FillSection";
import { LayoutSection } from "../LayoutSection";
import { PositionSection } from "../TransformSection";

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

const tokenUse = (tokenId: string) => ({ kind: "token", tokenId });
const layoutOf = (
  fixture: Awaited<ReturnType<typeof openStylesFixture>>,
  id: string,
) =>
  ((fixture.nodeOf(id) as unknown as { layout?: Record<string, unknown> })
    .layout ?? {}) as Record<string, unknown>;

describe("ADR-298 Phase 3 — Fill color token", () => {
  it("the Theme palette is first; its swatch writes the token and the row shows its name", async () => {
    const { fixture, view } = await renderWith(FillSection, [
      {
        id: "box",
        fills: [
          {
            id: "f1",
            type: "color",
            enabled: true,
            opacity: 1,
            blendMode: "normal",
            color: "#FF0000FF",
          } as never,
        ],
      },
    ]);
    await act(async () => {
      fireEvent.click(view.getAllByLabelText("Edit fill")[0]!);
    });
    const palettes = [
      ...document.querySelectorAll<HTMLElement>("[data-palette]"),
    ].map((section) => section.dataset.palette);
    expect(palettes).toEqual(["theme", "document"]);
    const swatch = document.querySelector<HTMLElement>(
      '[data-palette="theme"] [data-token="neutral-subtle"]',
    )!;
    await act(async () => {
      fireEvent.click(swatch);
    });
    const layer = fixture.nodeOf("box").fills![0] as { color: unknown };
    // (the token's variable is `var(--bg-muted)` — not its name)
    expect(layer.color).toEqual(tokenUse("lib:token:color_neutral-subtle"));
    expect(
      view.container
        .querySelector(".fill-layer-row__hex")
        ?.getAttribute("data-token"),
    ).toBe("neutral-subtle");
    expect(
      view.container.querySelector(".fill-layer-row__hex")?.textContent,
    ).toBe("neutral-subtle");
  });
});

describe("ADR-298 Phase 3 — layout tokens", () => {
  it("grid Gap X stores the longhand's token and shows its chip", async () => {
    const { fixture, view } = await renderWith(LayoutSection, [
      { id: "box", style: { display: "grid" } },
    ]);
    const gapX = view.container.querySelector(
      "fieldset.flex-wrap",
    ) as HTMLElement;
    const buttons = within(gapX).getAllByRole("button");
    await act(async () => {
      fireEvent.click(buttons[buttons.length - 1]!);
    });
    await act(async () => {
      fireEvent.click(
        document.querySelector('[role="option"][aria-label="M"]')!,
      );
    });
    expect(layoutOf(fixture, "box").columnGap).toEqual({
      kind: "set",
      value: tokenUse("lib:token:spacing_md"),
    });
    expect(
      view.container.querySelector<HTMLInputElement>(
        "fieldset.flex-wrap .react-aria-Input",
      )?.value,
    ).toBe("M");
  });

  it("a Position side written as a token shows its chip and px", async () => {
    const { view } = await renderWith(PositionSection, [
      {
        id: "box",
        style: { position: "absolute", left: "var(--spacing-lg)", top: "0px" },
      },
    ]);
    const header = view.container.querySelector<HTMLElement>(
      '[aria-expanded="false"]',
    );
    if (header)
      await act(async () => {
        fireEvent.click(header);
      });
    const left = view.getByRole("group", { name: "Left" });
    const leftInput = within(left).getByRole("combobox") as HTMLInputElement;
    expect(leftInput.value).toBe("L");
    expect(leftInput.title).toBe("L · 16px");
  });
});

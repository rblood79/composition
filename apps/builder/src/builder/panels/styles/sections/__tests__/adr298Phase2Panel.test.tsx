// @vitest-environment jsdom
/**
 * ADR-298 Phase 2 — the Design panel writes theme tokens (D3 · D4): a preset is the node's
 * `TokenUse`, the field shows the step's chip + the active value, a typed number is a literal
 * (D9), Border Width is a token field (사용자 결정 3), Blur is a unit input and the Size ·
 * Position status text sits in its field (결정 6 — 감사 C4 · E2). Oracle = the document field.
 */
import "fake-indexeddb/auto";
import { resolveToken } from "@composition/rendering";
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
import { BorderSection } from "../BorderSection";
import { EffectSection } from "../EffectSection";
import { LayoutSection } from "../LayoutSection";
import { PositionSection } from "../TransformSection";
import { TypographySection } from "../TypographySection";

(Element.prototype as { getAnimations?: () => Animation[] }).getAnimations ??=
  () => [];

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
    fireEvent.click(
      document.querySelector(`[role="option"][aria-label="${option}"]`)!,
    );
  });
}

describe("ADR-298 Phase 2 — Border", () => {
  it("Sides 전체 액션은 개별 변 선택과 동기화하고 전체 선택·해제를 저장한다", async () => {
    const { fixture, view } = await renderWith(BorderSection, [
      { id: "box", style: { borderStyle: "solid", borderWidth: "3px" } },
    ]);
    const sides = field(view.container, "border-sides");
    expect(within(sides).getAllByRole("button")).toHaveLength(4);
    const all = view.getByRole("button", { name: "All" });
    expect(all.closest(".fieldset-actions.actions-icon")).not.toBeNull();
    expect(sides.contains(all)).toBe(false);
    expect(all.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      fireEvent.click(within(sides).getByRole("button", { name: "Left" }));
    });
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(fixture.styleOf("box")).toMatchObject({
      borderLeftWidth: "0px",
      borderRightWidth: "3px",
      borderTopWidth: "3px",
      borderBottomWidth: "3px",
    });

    await act(async () => {
      fireEvent.click(all);
    });
    expect(fixture.styleOf("box").borderWidth).toBe("3px");
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(fixture.styleOf("box").borderLeftWidth).toBeUndefined();
    await act(async () => {
      fireEvent.click(all);
    });
    expect(fixture.styleOf("box").borderWidth).toBe("0px");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    await act(async () => {
      fireEvent.click(all);
    });
    expect(fixture.styleOf("box").borderWidth).toBe("1px");
    expect(all.getAttribute("aria-pressed")).toBe("true");
  });

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
    const radiusInput = within(radius).getByRole(
      "combobox",
    ) as HTMLInputElement;
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
    expect(visualOf(fixture, "box").radius).toEqual(
      tokenSet("lib:token:radius_md"),
    );
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
      fireEvent.click(
        await view.findByRole("menuitem", { name: "Box shadows · Elevated" }),
      );
    });
    expect(visualOf(fixture, "box").boxShadow).toEqual(
      tokenSet("lib:token:shadow_md"),
    );
    // Phase 5 (시안): the step chip sits in the token's one row (was the legend)
    const rows = view.container.querySelectorAll(
      ".style-shadow .effect-layer-row",
    );
    expect(rows.length).toBe(1);
    expect(
      rows[0]!.querySelector(".property-unit-input__token")?.textContent,
    ).toBe("Elevated");
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

/** Opens the Font Size preset menu and reads its group names. */
async function fontSizeGroups(container: HTMLElement): Promise<string[]> {
  const size = field(container, "font-size");
  const buttons = within(size).getAllByRole("button");
  await act(async () => {
    fireEvent.click(buttons[buttons.length - 1]!);
  });
  return Array.from(
    document.querySelectorAll(".property-unit-input-popover [role='group']"),
    (group) => group.getAttribute("aria-label") ?? "",
  );
}

describe("ADR-298 Phase 2 — Text", () => {
  // 2026-11-25 사용자 결정: a heading is the Heading component's `<h1>`~`<h6>` (its Level) — a
  //   Heading size on a Text would look like a heading and stay a `span` in Publish.
  it("Font Size on a Text offers the Body group only", async () => {
    const { view } = await renderWith(TypographySection, [
      { id: "t", type: "Text", props: { children: "Hello" } },
    ]);
    expect(await fontSizeGroups(view.container)).toEqual(["Body"]);
    expect(
      document.querySelector('[role="option"][aria-label="Heading M"]'),
    ).toBeNull();
  });

  // (2026-11-25 「Text 에 Tag 옵션」 → 「1번으로 진행」: a heading element's Heading steps are h1 ~ h6 at
  //  its parent's font — 16 on the page — and picking one changes its tag, dropping a written size.)
  const headingOptions = () =>
    Array.from(
      document.querySelectorAll(
        ".property-unit-input-popover [role='group'][aria-label='Heading'] [role='option']",
      ),
      (option) => option.textContent,
    );

  it("Font Size on a Text tagged h2: the Heading steps are h1 ~ h6 at the parent's 16", async () => {
    const { view } = await renderWith(TypographySection, [
      {
        id: "t",
        type: "Text",
        props: { children: "Hello", elementType: "h2" },
      },
    ]);
    expect(await fontSizeGroups(view.container)).toEqual(["Body", "Heading"]);
    expect(headingOptions()).toEqual([
      "h1 · 32",
      "h2 · 24",
      "h3 · 18.72",
      "h4 · 16",
      "h5 · 13.28",
      "h6 · 10.72",
    ]);
  });

  it("Font Size 아이콘은 XL 토큰과 다음 1px 값을 오가며 제목 태그를 유지한다", async () => {
    const aboveXL = Number(resolveToken("{typography.text-xl}")) + 1;
    const { fixture, view } = await renderWith(TypographySection, [
      {
        id: "t",
        type: "Text",
        props: { elementType: "h2", children: "Hello" },
        style: { fontSize: `${aboveXL}px` },
      },
    ]);
    const icon = field(view.container, "font-size").querySelector("label")!;
    const drag = (dx: number) => {
      fireEvent.pointerDown(icon, { button: 0, clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(icon, { clientX: 100 + dx, pointerId: 1 });
      fireEvent.pointerUp(icon, { clientX: 100 + dx, pointerId: 1 });
    };
    drag(-3);
    expect(visualOf(fixture, "t").fontSize).toEqual(
      tokenSet("lib:token:typography_text-xl"),
    );
    drag(3);
    expect(visualOf(fixture, "t").fontSize).toEqual({
      kind: "set",
      value: aboveXL,
    });
    expect(fixture.nodeOf("t").props.elementType).toEqual({
      kind: "set",
      value: "h2",
    });
  });

  it("picking h1 changes the Text's HTML tag and drops its written font size, one step", async () => {
    const { fixture, view } = await renderWith(TypographySection, [
      {
        id: "t",
        type: "Text",
        props: { children: "Hello", elementType: "h2" },
        style: { fontSize: "12px" },
      },
    ]);
    await fontSizeGroups(view.container);
    await act(async () => {
      fireEvent.click(
        document.querySelector('[role="option"][aria-label="Heading h1"]')!,
      );
    });
    expect(fixture.nodeOf("t").props.elementType).toEqual({
      kind: "set",
      value: "h1",
    });
    expect(visualOf(fixture, "t").fontSize).toBeUndefined();
    expect(
      (
        within(field(view.container, "font-size")).getByRole(
          "combobox",
        ) as HTMLInputElement
      ).value,
    ).toBe("32");
  });

  it("on a Heading, picking h4 changes its level", async () => {
    const { fixture, view } = await renderWith(TypographySection, [
      { id: "t", type: "Heading", props: { children: "Hello" } },
    ]);
    // (RAC's h3 by default — 16 × 1.17.)
    expect(await fontSizeGroups(view.container)).toEqual(["Body", "Heading"]);
    await act(async () => {
      fireEvent.click(
        document.querySelector('[role="option"][aria-label="Heading h4"]')!,
      );
    });
    expect(fixture.nodeOf("t").props.level).toEqual({ kind: "set", value: 4 });
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
    await pick(
      view.container.querySelector("fieldset.displayGap") as HTMLElement,
      "M",
    );
    expect(
      (fixture.nodeOf("box") as unknown as { layout?: Record<string, unknown> })
        .layout?.columnGap,
    ).toEqual(tokenSet("lib:token:spacing_md"));
    expect(visualOf(fixture, "box").gap).toBeUndefined();
    const gap = view.container.querySelector("fieldset.displayGap")!;
    expect(
      (within(gap as HTMLElement).getByRole("combobox") as HTMLInputElement)
        .value,
    ).toBe("M");
  });
});

describe("ADR-298 Phase 2 — Position status in its field (감사 E2)", () => {
  it("the summary is the Position field's description, not a paragraph under the section", async () => {
    const { view } = await renderWith(PositionSection);
    // The Position section starts folded (static element) — open it.
    const header = view
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-expanded") === "false");
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

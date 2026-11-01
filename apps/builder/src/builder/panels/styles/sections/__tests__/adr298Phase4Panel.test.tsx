// @vitest-environment jsdom
/**
 * ADR-298 Phase 4 — pointer edits walk the token steps (D6) and the field marks a literal off the
 * scale (D4 · D9): the ladder (`propertyUnitSteps` — the field's token presets at the active px),
 * the label scrub (one step per stride, ⌥ free), the off-scale dot, empty = inherit, and Position's
 * one menu of steps + units (`%` kept). Oracle = the committed value / the document field.
 */
import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react";
import { create } from "zustand";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";

import { I18nProvider } from "@/i18n";
import { PropertyUnitInput } from "../../../../components/property/PropertyUnitInput";
import {
  PropertySelectionContext,
  type PropertySelectionSource,
} from "../../../../components/property/propertySelection";
import { SPACING_PRESET_OPTIONS } from "../../../../components/property/propertyUnitPresets";
import {
  nearestPropertyUnitStep,
  propertyUnitStepFrom,
  propertyUnitSteps,
} from "../../../../components/property/propertyUnitSteps";
import {
  openStylesFixture,
  type StylesFixtureNode,
} from "../../__tests__/support/catalogStylesFixture";
import { PositionSection } from "../TransformSection";

afterEach(cleanup);

const px = (ref: string) => Number(resolveToken(ref as TokenRef));
const varOf = (step: string) =>
  SPACING_PRESET_OPTIONS.find((preset) => preset.id === step)!.value;

describe("ADR-298 Phase 4 — the step ladder", () => {
  const steps = propertyUnitSteps(SPACING_PRESET_OPTIONS);
  it("is 0 then XS ~ XL at the active theme's px (no hand-written numbers)", () => {
    expect(steps.map((step) => step.px)).toEqual([
      0,
      ...["xs", "sm", "md", "lg", "xl"].map((step) => px(`{spacing.${step}}`)),
    ]);
    expect(steps[0]!.value).toBe("0px");
    expect(steps[3]!.value).toBe(varOf("md"));
  });
  it("nearest snaps (ties down, clamps at the ends); a stride walks from an off-scale literal", () => {
    expect(nearestPropertyUnitStep(steps, 13)?.value).toBe(varOf("md"));
    expect(nearestPropertyUnitStep(steps, 10)?.value).toBe(varOf("sm"));
    expect(nearestPropertyUnitStep(steps, 500)?.value).toBe(varOf("xl"));
    expect(propertyUnitStepFrom(steps, 10, 1)?.value).toBe(varOf("md"));
    expect(propertyUnitStepFrom(steps, 10, -1)?.value).toBe(varOf("sm"));
    expect(propertyUnitStepFrom(steps, 8, 2)?.value).toBe(varOf("lg"));
    expect(propertyUnitStepFrom(steps, 8, 99)?.value).toBe(varOf("xl"));
    expect(propertyUnitStepFrom(steps, 8, -99)?.value).toBe("0px");
  });
});

const useStore = create<{ selectedElementId: string | null }>(() => ({
  selectedElementId: "a",
}));
const selection: PropertySelectionSource = {
  useSelectedId: () => useStore((state) => state.selectedElementId),
  readSelectedId: () => useStore.getState().selectedElementId,
};
const wrap = ({ children }: { children: ReactNode }) => (
  <PropertySelectionContext.Provider value={selection}>
    {children}
  </PropertySelectionContext.Provider>
);

function spacingField(value: string) {
  const onChange = vi.fn();
  const onDrag = vi.fn();
  const view = render(
    <PropertyUnitInput
      label="Gap"
      value={value}
      onChange={onChange}
      onDrag={onDrag}
      presets={SPACING_PRESET_OPTIONS}
    />,
    { wrapper: wrap },
  );
  const fieldset = view.container.querySelector("fieldset")!;
  const legend = fieldset.querySelector("legend")!;
  return { onChange, onDrag, fieldset, legend, view };
}

describe("ADR-298 Phase 4 — label scrub", () => {
  it("walks one step per stride and commits once on release", () => {
    const { onChange, onDrag, legend } = spacingField("8px");
    fireEvent.pointerDown(legend, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 108, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith(varOf("md"));
    fireEvent.pointerMove(legend, { clientX: 116, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith(varOf("lg"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(legend, { clientX: 116, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(varOf("lg"));
  });
  it("⌥ held is the free value (1 per px) — a literal", () => {
    const { onChange, legend } = spacingField("8px");
    fireEvent.pointerDown(legend, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 105, altKey: true, pointerId: 1 });
    fireEvent.pointerUp(legend, { clientX: 105, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith("13px");
  });
  it("a field without a preview commits once, on release (one History step)", () => {
    const onChange = vi.fn();
    const view = render(
      <PropertyUnitInput
        label="Top"
        value="8px"
        onChange={onChange}
        presets={SPACING_PRESET_OPTIONS}
      />,
      { wrapper: wrap },
    );
    const legend = view.container.querySelector("legend")!;
    fireEvent.pointerDown(legend, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 108, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 116, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(view.container.querySelector("input")?.value).toBe(
      String(px("{spacing.lg}")),
    );
    fireEvent.pointerUp(legend, { clientX: 116, pointerId: 1 });
    expect(onChange.mock.calls).toEqual([[varOf("lg")]]);
  });
  it("a press without travel is no edit", () => {
    const { onChange, onDrag, legend } = spacingField("8px");
    fireEvent.pointerDown(legend, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 101, pointerId: 1 });
    fireEvent.pointerUp(legend, { clientX: 101, pointerId: 1 });
    expect(onDrag).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ADR-298 Phase 4 — off-scale · empty", () => {
  it("a literal off the ladder shows the dot (and says so); on the ladder or a token does not", () => {
    const off = spacingField("10px");
    expect(off.fieldset.dataset.offScale).toBe("true");
    expect(
      off.fieldset.querySelector(".property-unit-input__off-scale"),
    ).not.toBeNull();
    expect(
      off.fieldset.querySelector("input")?.getAttribute("aria-description"),
    ).toBeTruthy();
    cleanup();
    expect(
      spacingField(`${px("{spacing.md}")}px`).fieldset.dataset.offScale,
    ).toBe(undefined);
    cleanup();
    expect(spacingField(varOf("md")).fieldset.dataset.offScale).toBe(undefined);
    cleanup();
    expect(spacingField("0px").fieldset.dataset.offScale).toBe(undefined);
  });
  it("empty is the inherited value — a dim 「—」", () => {
    const { fieldset } = spacingField("");
    expect(fieldset.dataset.empty).toBe("true");
    expect(fieldset.querySelector("input")?.placeholder).toBe("—");
  });
});

describe("ADR-298 Phase 4 — steps beside units keep the unit", () => {
  it("a % value with the step menu: a typed number and ↑ stay %", () => {
    const onChange = vi.fn();
    const view = render(
      <PropertyUnitInput
        label="Left"
        labelMode="icon"
        value="50%"
        units={["px", "%"]}
        presets={SPACING_PRESET_OPTIONS.filter((preset) => preset.value !== "")}
        presetUnits
        onChange={onChange}
      />,
      { wrapper: wrap },
    );
    const input = view.container.querySelector("input")!;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("40%");
    // ↑ steps the shown number in the value's unit (not px).
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("41%");
  });
});

async function renderPosition(nodes: StylesFixtureNode[]) {
  const fixture = await openStylesFixture(nodes, { select: nodes[0]!.id });
  const Wrapper = fixture.wrapper;
  const view = render(
    <I18nProvider initialLocale="en-US">
      <Wrapper>
        <PositionSection />
      </Wrapper>
    </I18nProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  const header = view.container.querySelector<HTMLElement>(
    '[aria-expanded="false"]',
  );
  if (header)
    await act(async () => {
      fireEvent.click(header);
    });
  return { fixture, view };
}

describe("ADR-298 Phase 4 — Position: steps + units in one menu", () => {
  it("lists the Spacing steps and the units; a step writes the token, % switches the unit", async () => {
    const { fixture, view } = await renderPosition([
      {
        id: "box",
        style: { position: "absolute", left: "16px", top: "0px" },
      },
    ]);
    const left = view.getByRole("group", { name: "Left" });
    const trigger = within(left).getAllByRole("button").at(-1)!;
    // the trigger is still the unit (PX), not a ▾
    expect(trigger.textContent?.toLowerCase()).toBe("px");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const options = [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.getAttribute("aria-label") ?? option.textContent,
    );
    expect(options).toEqual(
      expect.arrayContaining(["XS", "M", "XL", "px", "%"]),
    );
    await act(async () => {
      fireEvent.click(
        document.querySelector('[role="option"][aria-label="M"]')!,
      );
    });
    const layout = () =>
      ((
        fixture.nodeOf("box") as unknown as { layout?: Record<string, unknown> }
      ).layout ?? {}) as Record<string, unknown>;
    expect(layout().insetLeft).toEqual({
      kind: "set",
      value: { kind: "token", tokenId: "lib:token:spacing_md" },
    });
    expect(left.querySelector(".property-unit-input__token")?.textContent).toBe(
      "M",
    );
    await act(async () => {
      fireEvent.click(within(left).getAllByRole("button").at(-1)!);
    });
    const percent = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === "%",
    )!;
    await act(async () => {
      fireEvent.click(percent);
    });
    expect(String((layout().insetLeft as { value: unknown }).value)).toMatch(
      /%$/,
    );
  });
});

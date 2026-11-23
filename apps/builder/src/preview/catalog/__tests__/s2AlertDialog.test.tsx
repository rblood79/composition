import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaletteItems } from "../../../builder/panels/components/paletteItems";
import { REUSABLE_PROPS_SCHEMAS } from "../../../builder/components/reusablePropsSchemas";
import { validateLibraryDefinition } from "../../../../../../packages/shared/src/catalog/document/validation";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (사용자 결정 2026-11-23 「노드 + 2 필드」) — S2 AlertDialog (`AlertDialog.tsx`):
 * a Dialog `role="alertdialog"` whose primary button's variant (confirmation → accent ·
 * destructive → negative · otherwise primary) and title glyph (error · warning, named 「Alert」)
 * follow `variant` (`bindingMaps`), whose cancel · secondary buttons exist only with a label
 * (`presentWith`), and whose `autoFocusButton` focuses one. Measurement: jsdom, the palette
 * AlertDialog.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function openAlert(props: Record<string, unknown> = {}) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["AlertDialog"]);
  const instance = h.ids[0]!;
  if (Object.keys(props).length) {
    h.declare(instance as never, props as never);
    await settle();
  }
  const root = h.workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const of = (type: string) => records().filter((r) => root.typeOf(r) === type);
  /** The dialog's Buttons (Canvas records): their label · variant · autoFocus · disabled. */
  const actions = () => {
    const group = of("ButtonGroup")[0]!;
    return group.children.map((id) => {
      const button = root.canvasInputs.get(id)!;
      const text = button.children
        .map((child) => root.canvasInputs.get(child))
        .find((child) => child && root.typeOf(child) === "Text");
      return {
        label: String(text?.props.children ?? ""),
        variant: button.props.variant,
        autoFocus: button.props.autoFocus,
        disabled: button.props.isDisabled,
      };
    });
  };
  /** Shown title glyphs (Canvas records — not hidden, with a glyph). */
  const glyphs = () =>
    of("Icon")
      .filter(
        (icon) =>
          root.typeOf(root.canvasInputs.get(icon.parentId)!) === "Heading" &&
          icon.hidden !== true &&
          !String(icon.props.iconName ?? "").startsWith("{"),
      )
      .map((icon) => icon.props.iconName);
  const open = async () => {
    const trigger = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Publish",
    )!;
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
    );
    return document.querySelector<HTMLElement>('[role="alertdialog"]')!;
  };
  return { h, root, of, actions, glyphs, open };
}

describe("S2 §9.3 AlertDialog", () => {
  it("is a palette origin with S2's props, its maps validated", () => {
    expect(getPaletteItems().some((item) => item.type === "AlertDialog")).toBe(
      true,
    );
    expect(
      Object.keys(REUSABLE_PROPS_SCHEMAS["component-alertdialog"]!),
    ).toEqual(
      expect.arrayContaining([
        "variant",
        "title",
        "cancelLabel",
        "primaryActionLabel",
        "secondaryActionLabel",
        "isPrimaryActionDisabled",
        "autoFocusButton",
        "size",
      ]),
    );
    const definition = REUSABLE_ORIGIN_DEFINITIONS.find(
      (item) => item.id === "lib:definition:origin-component-alertdialog",
    )!;
    expect(() => validateLibraryDefinition(definition)).not.toThrow();
    // (A map must read an accepted prop.)
    expect(() =>
      validateLibraryDefinition({
        ...definition,
        bindingMaps: { x: { from: "nope", values: {} } },
      }),
    ).toThrow();
  });

  it("confirmation: alertdialog named by its title, Cancel + accent primary, no glyph; a press closes it", async () => {
    const { h, root, of, actions, glyphs, open } = await openAlert();
    expect(actions()).toEqual([
      {
        label: "Cancel",
        variant: "secondary",
        autoFocus: false,
        disabled: false,
      },
      {
        label: "Publish",
        variant: "accent",
        autoFocus: false,
        disabled: false,
      },
    ]);
    expect(glyphs()).toEqual([]);
    // (The title is the Heading's Text — it takes the Heading's type, S2 `CenterBaseline` title.)
    const titleText = of("Text").find(
      (text) => root.typeOf(root.canvasInputs.get(text.parentId)!) === "Heading",
    )!;
    expect(titleText.visual.fontWeight).toBe(600);
    const dialog = await open();
    const title = dialog.querySelector("h2, h3, [slot='title']")!;
    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    expect(title.textContent).toBe("Publish documents");
    const buttons = [...dialog.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );
    expect(buttons).toEqual(["Cancel", "Publish"]);
    fireEvent.click(
      [...dialog.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Publish",
      )!,
    );
    await waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')).toBeNull(),
    );
    h.view.unmount();
  });

  it("destructive · error · warning pick the primary variant and glyph; labels add or drop buttons; autoFocusButton · disabled reach them", async () => {
    const destructive = await openAlert({
      variant: "destructive",
      secondaryActionLabel: "Save draft",
      autoFocusButton: "cancel",
      isPrimaryActionDisabled: true,
    });
    expect(destructive.actions()).toEqual([
      {
        label: "Cancel",
        variant: "secondary",
        autoFocus: true,
        disabled: false,
      },
      {
        label: "Save draft",
        variant: "secondary",
        autoFocus: false,
        disabled: false,
      },
      {
        label: "Publish",
        variant: "negative",
        autoFocus: false,
        disabled: true,
      },
    ]);
    expect(destructive.glyphs()).toEqual([]);
    destructive.h.view.unmount();

    const error = await openAlert({ variant: "error", cancelLabel: "" });
    expect(error.actions()).toEqual([
      {
        label: "Publish",
        variant: "primary",
        autoFocus: false,
        disabled: false,
      },
    ]);
    expect(error.glyphs()).toEqual(["triangle-alert"]);
    const dialog = await error.open();
    const glyph = dialog.querySelector('[role="img"]');
    expect(glyph?.getAttribute("aria-label")).toBe("Alert");
    error.h.view.unmount();

    const warning = await openAlert({ variant: "warning" });
    expect(warning.glyphs()).toEqual(["octagon-alert"]);
    warning.h.view.unmount();
  });
});

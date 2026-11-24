import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaletteItems } from "../../../builder/panels/components/paletteItems";
import { REUSABLE_PROPS_SCHEMAS } from "../../../builder/components/reusablePropsSchemas";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (6-5) — S2 `Modal` `size` (`Modal.tsx` — S 400 · M 480 · L 640 · XL 960, `fullscreen`
 * 20 in from the viewport, `fullscreenTakeover` the viewport, square), the Dialog in a sized Modal
 * filling it (S2 dialog `size: full`), S2 CustomDialog `padding: none`, and the CustomDialog ·
 * FullscreenDialog palette origins. Measurement: jsdom + the node layout engine (viewport 1000 ×
 * 800), the Canvas records and the Preview DOM.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function openDialog(type: string, props: Record<string, unknown> = {}) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  const instance = h.ids[0]!;
  // (Open — the DialogTrigger's own `isOpen`, as the Canvas shows an opened overlay.)
  h.declare(instance as never, { isOpen: true, ...props } as never);
  await settle();
  const root = h.workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const one = (type: string) =>
    records().find((record) => root.typeOf(record) === type)!;
  /** The Canvas boxes of the Modal and its Dialog (the open overlay, laid out). */
  const boxes = () => {
    const modal = one("Modal");
    const dialog = one("Dialog");
    const geometry = root.getGeometry([modal.id, dialog.id]);
    return {
      modal: geometry.get(modal.id),
      dialog: geometry.get(dialog.id),
      modalRadius: modal.visual.radius,
      dialogRadius: dialog.visual.radius,
      dialogPadding: dialog.visual.paddingTop ?? dialog.visual.paddingY,
    };
  };
  const open = async () => {
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"]')).not.toBeNull(),
    );
    return {
      modal: document.querySelector<HTMLElement>(".react-aria-Modal")!,
      dialog: document.querySelector<HTMLElement>('[role="dialog"]')!,
    };
  };
  return { h, root, one, boxes, open };
}

describe("S2 §9.3 Modal size · CustomDialog · FullscreenDialog", () => {
  it("are palette origins with S2's props", () => {
    const types = getPaletteItems().map((item) => item.type);
    expect(types).toEqual(
      expect.arrayContaining(["CustomDialog", "FullscreenDialog"]),
    );
    expect(
      Object.keys(REUSABLE_PROPS_SCHEMAS["component-customdialog"]!),
    ).toEqual(
      expect.arrayContaining([
        "size",
        "padding",
        "isDismissible",
        "isKeyboardDismissDisabled",
      ]),
    );
    expect(
      Object.keys(REUSABLE_PROPS_SCHEMAS["component-fullscreendialog"]!),
    ).toEqual(expect.arrayContaining(["variant", "isKeyboardDismissDisabled"]));
  });

  it("CustomDialog: the Modal is S2's size box on the Canvas and in the DOM, its Dialog fills it; padding none", async () => {
    const custom = await openDialog("CustomDialog");
    const m = custom.boxes();
    expect(m.modal?.width).toBe(480);
    expect(m.dialog?.width).toBe(480);
    // (S2's 90% cap is the viewport's height — not the trigger's: the Modal is as tall as its Dialog.)
    expect(m.modal?.height).toBe(m.dialog?.height);
    expect(custom.one("Modal").props.size).toBe("M");
    // (The Modal's size blocks only override: the Dialog keeps its own padding — S2 `CustomDialog` 32.)
    expect(m.dialogPadding).toBe(32);
    const dom = await custom.open();
    expect(dom.modal.getAttribute("data-size")).toBe("M");
    expect(dom.dialog.getAttribute("data-padding")).toBeNull();
    custom.h.view.unmount();

    const small = await openDialog("CustomDialog", {
      size: "S",
      padding: "none",
    });
    const s = small.boxes();
    expect(s.modal?.width).toBe(400);
    expect(s.dialog?.width).toBe(400);
    expect(s.dialogPadding).toBe(0);
    const smallDom = await small.open();
    expect(smallDom.modal.getAttribute("data-size")).toBe("S");
    expect(smallDom.dialog.getAttribute("data-padding")).toBe("none");
    small.h.view.unmount();
  });

  it("FullscreenDialog: fullscreen is the viewport less 20 a side, takeover the whole viewport, square", async () => {
    const full = await openDialog("FullscreenDialog");
    const f = full.boxes();
    expect(f.modal).toMatchObject({ x: 20, y: 20, width: 960, height: 760 });
    expect(f.dialog).toMatchObject({ width: 960, height: 760 });
    const dom = await full.open();
    expect(dom.modal.getAttribute("data-size")).toBe("fullscreen");
    full.h.view.unmount();

    const takeover = await openDialog("FullscreenDialog", {
      variant: "fullscreenTakeover",
    });
    const t = takeover.boxes();
    expect(t.modal).toMatchObject({ x: 0, y: 0, width: 1000, height: 800 });
    expect(t.modalRadius).toBe(0);
    expect(t.dialogRadius).toBe(0);
    takeover.h.view.unmount();
  });

  it("the palette Dialog is S2's Dialog: `size` M — its Modal 480, the Dialog fills it (2026-11-24)", async () => {
    expect(Object.keys(REUSABLE_PROPS_SCHEMAS["component-dialog"]!)).toContain(
      "size",
    );
    const plain = await openDialog("Dialog");
    const p = plain.boxes();
    expect(plain.one("Modal").props.size).toBe("M");
    expect(p.modal?.width).toBe(480);
    expect(p.dialog?.width).toBe(480);
    const dom = await plain.open();
    expect(dom.modal.getAttribute("data-size")).toBe("M");
    plain.h.view.unmount();
  });
});

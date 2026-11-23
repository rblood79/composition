import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { getPaletteItems } from "../../../builder/panels/components/paletteItems";
import { REUSABLE_PROPS_SCHEMAS } from "../../../builder/components/reusablePropsSchemas";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 §9.3 (2026-11-23) — S2 ActionMenu (`ActionMenu.tsx`): `MenuTrigger > ActionButton
 * (More glyph, icon-only) + Menu`, the button named 「More actions」 (S2 `menu.moreActions`) when the
 * author gives no name; `size` · `isQuiet` reach the button, `menuSize` the Menu. Measurement:
 * jsdom, the palette ActionMenu (S2 docs example — Copy · Cut · Paste).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function openActionMenu() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["ActionMenu"]);
  const root = h.workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const button = () =>
    document.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]')!;
  return { h, root, of, button, instance: h.ids[0]! };
}

describe("S2 §9.3 ActionMenu", () => {
  it("is a palette origin with S2's props (size · isQuiet · menuSize)", () => {
    expect(getPaletteItems().some((item) => item.type === "ActionMenu")).toBe(
      true,
    );
    const schema = REUSABLE_PROPS_SCHEMAS["component-actionmenu"]!;
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining(["size", "isQuiet", "menuSize", "direction"]),
    );
    // (The root is a MenuTrigger — no size scale of its own: the button's S2 sizes are listed.)
    expect(
      (schema.size as { options?: { value: string }[] }).options?.map(
        (option) => option.value,
      ),
    ).toEqual(["XS", "S", "M", "L", "XL"]);
  });

  it("an icon-only More button named 「More actions」 opening the menu (Copy · Cut · Paste)", async () => {
    const { h, of, button } = await openActionMenu();
    // (The Canvas: the trigger is an icon-only ActionButton with the More glyph.)
    const trigger = of("ActionButton")[0]!;
    expect(trigger.derivedProps?._actionIconOnly).toBe(true);
    expect(
      of("Icon").some(
        (icon) =>
          icon.parentId === trigger.id && icon.props.iconName === "ellipsis",
      ),
    ).toBe(true);
    expect(button().getAttribute("aria-label")).toBe("More actions");
    expect(button().textContent?.trim()).toBe("");
    fireEvent.click(button());
    await waitFor(() =>
      expect(document.querySelector('[role="menu"]')).not.toBeNull(),
    );
    const items = [...document.querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent,
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("Copy");
    expect(items[0]).toContain("Copy the selected text");
    expect(items[0]).toContain("⌘C");
    expect(items[2]).toContain("Paste");
    h.view.unmount();
  });

  it("the author's name wins; size · isQuiet reach the button and menuSize the Menu", async () => {
    const { h, of, button, instance } = await openActionMenu();
    h.declare(
      instance as never,
      {
        size: "S",
        isQuiet: true,
        menuSize: "L",
      } as never,
    );
    await settle();
    const trigger = of("ActionButton")[0]!;
    expect(trigger.props.size).toBe("S");
    expect(trigger.props.isQuiet).toBe(true);
    expect(of("Menu")[0]!.props.size).toBe("L");
    const actionButton = of("ActionButton")[0]!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(actionButton.id)!.target],
        props: { "aria-label": { kind: "set", value: "Row actions" } },
        label: "Name",
      }),
    );
    h.flush();
    await settle();
    expect(button().getAttribute("aria-label")).toBe("Row actions");
    h.view.unmount();
  });
});

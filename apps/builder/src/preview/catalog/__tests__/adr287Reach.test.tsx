import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-287 G2 — a reference API Do reaches the Preview DOM: a Button's press runs the rule, and the
 * rendered element (not the binding) is the oracle. A composite's template-bound prop (Meter
 * `label` → its Label) reaches the part (R1). The Canvas draws the authored value (ADR-281 — a
 * runtime override is the Preview's), so the document is unchanged.
 */
afterEach(() => vi.restoreAllMocks());

const warnings = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

const press = (element: Element | null | undefined) =>
  act(() => {
    fireEvent.click(element!);
  });

const disabled = (element: Element | null) =>
  element?.hasAttribute("disabled") ||
  element?.hasAttribute("data-disabled") ||
  element?.getAttribute("aria-disabled") === "true";

/** A Button whose press runs `capabilityId` (with `value`) on an instance of `type`. */
async function pressRule(type: string, capabilityId: string, value?: unknown) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Button", type]);
  const [button, target] = h.ids as [NodeId, NodeId];
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: target },
    capabilityId,
    ...(value !== undefined ? { value } : {}),
  } as never);
  const before = JSON.stringify(h.workspace.runtime.graph.getEntry(target));
  return {
    ...h,
    target,
    press: () => press(h.element(button)),
    documentUnchanged: () =>
      JSON.stringify(h.workspace.runtime.graph.getEntry(target)) === before,
  };
}

describe("ADR-287 G2 — reference API Do reach the Preview", () => {
  it("Button → Meter 「값 설정」 (the user's report): aria-valuenow follows", async () => {
    const h = await pressRule("Meter", "setValue", 50);
    expect(h.element(h.target)?.getAttribute("aria-valuenow")).not.toBe("50");
    h.press();
    expect(h.element(h.target)?.getAttribute("aria-valuenow")).toBe("50");
    expect(h.documentUnchanged()).toBe(true);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("Button → Meter `label`: the Label part's text changes (R1 — template-bound)", async () => {
    const h = await pressRule("Meter", "setLabel", "Disk");
    expect(h.element(h.target)?.textContent).toContain("Storage");
    h.press();
    expect(h.element(h.target)?.textContent).toContain("Disk");
    expect(h.element(h.target)?.textContent).not.toContain("Storage");
    expect(h.documentUnchanged()).toBe(true);
    h.view.unmount();
  });

  it("Button → ProgressBar `isIndeterminate` on: RAC drops aria-valuenow", async () => {
    const h = await pressRule("ProgressBar", "isIndeterminateOn");
    expect(h.element(h.target)?.hasAttribute("aria-valuenow")).toBe(true);
    h.press();
    expect(h.element(h.target)?.hasAttribute("aria-valuenow")).toBe(false);
    h.view.unmount();
  });

  it("Button → ProgressCircle 「값 설정」", async () => {
    const h = await pressRule("ProgressCircle", "setValue", 20);
    h.press();
    expect(h.element(h.target)?.getAttribute("aria-valuenow")).toBe("20");
    h.view.unmount();
  });

  it("Button → Badge `variant` (a rule variant — the choice list)", async () => {
    const h = await pressRule("Badge", "setVariant", "negative");
    h.press();
    expect(h.element(h.target)?.getAttribute("data-variant")).toBe("negative");
    h.view.unmount();
  });

  it.each(["Button", "ToggleButton"])(
    "Button → %s `children`: the template's Text part (ADR-276 `label`), nothing appended",
    async (type) => {
      const h = await pressRule(type, "setChildren", "Changed");
      h.press();
      expect(h.element(h.target)?.textContent).toBe("Changed");
      h.view.unmount();
    },
  );

  it("Button → Text `children`", async () => {
    const h = await pressRule("Text", "setChildren", "Hello");
    h.press();
    expect(h.element(h.target)?.textContent).toBe("Hello");
    h.view.unmount();
  });
});

describe("ADR-287 G2 — a node's own isDisabled (user decision 1 · M4)", () => {
  it("Button → another Button: on, then off — the own release passes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Button", "Button", "Button"]);
    const [on, off, target] = h.ids as [NodeId, NodeId, NodeId];
    h.rule(on, "onPress", {
      opcode: "capability",
      target: { nodeId: target },
      capabilityId: "isDisabledOn",
    } as never);
    h.rule(off, "onPress", {
      opcode: "capability",
      target: { nodeId: target },
      capabilityId: "isDisabledOff",
    } as never);
    press(h.element(on));
    expect(disabled(h.element(target))).toBe(true);
    press(h.element(off));
    expect(disabled(h.element(target))).toBe(false);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });

  it("a Button inside a disabled frame: the release is refused (the frame wins)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const library = await buildCodeCatalogLibrary();
    const h = await openAdr280Preview(["frame", "Button"]);
    const [frame, off] = h.ids as [NodeId, NodeId];
    const inside = "project:node:inside" as NodeId;
    act(() => {
      h.workspace.execute(
        insertNodes({
          parent: { kind: "node", id: frame },
          entries: [
            {
              kind: "node",
              id: inside,
              definitionId: catalogPaletteDefinitionId(library, "Button"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as unknown as NodeEntry,
          ],
          rootIds: [inside],
          newId: h.workspace.newId,
        }),
      );
    });
    h.flush();
    h.declare(frame, { isDisabled: true });
    h.rule(off, "onPress", {
      opcode: "capability",
      target: { nodeId: inside },
      capabilityId: "isDisabledOff",
    } as never);
    press(h.element(off));
    expect(disabled(h.element(inside))).toBe(true);
    expect(warnings().join("\n")).toContain("isDisabled");
    h.view.unmount();
  });
});

describe("ADR-287 R1 — forwarding walks only when a part binds the written key", () => {
  /** `domInputs.get` calls one `setRuntimeProps` makes (outside render — the walk's own cost). */
  async function lookups(type: string, patch: Record<string, unknown>) {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await openAdr280Preview([type]);
    const recordId = h
      .element(h.ids[0]! as NodeId)!
      .getAttribute("data-catalog-id")!;
    const inputs = h.session.root!.domInputs as Map<string, unknown>;
    const descendants = (id: string): number =>
      (
        (inputs.get(id) as { children?: readonly string[] } | undefined)
          ?.children ?? []
      ).reduce((sum, child) => sum + 1 + descendants(child), 0);
    const size = descendants(recordId);
    const get = vi.spyOn(inputs, "get");
    h.runtime.setRuntimeProps(recordId, patch);
    const calls = get.mock.calls.length;
    get.mockRestore();
    h.view.unmount();
    return { calls, size };
  }

  it("a ListBox selection (no part binds `selectedKeys`) does not visit its items", async () => {
    const { calls, size } = await lookups("ListBox", { selectedKeys: ["x"] });
    expect(size).toBeGreaterThan(3);
    // (The receiver's own lookups only — its override, the forward check, its touch: not one per
    //  item. Before the template-first check it was one per descendant and more — 8 here.)
    expect(calls).toBeLessThanOrEqual(3);
  });

  it("control: a Meter `label` (its Label binds `{label}`) still walks to the part", async () => {
    const { calls, size } = await lookups("Meter", { label: "Disk" });
    expect(calls).toBeGreaterThan(size);
  });
});

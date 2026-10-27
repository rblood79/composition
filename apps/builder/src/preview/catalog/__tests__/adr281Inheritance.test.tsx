import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertNodes,
  setSiteSettings,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { bodyBinding } from "../../../../../../packages/shared/src/catalog/bindings/Body.binding";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-281 G2 — a page root (`body`) and a frame pass `isDisabled` · `isReadOnly` · `isRequired` ·
 * `locale` down through RAC's own `Provider` · `I18nProvider` (user decision 1), the dispatcher's
 * guard gives the same answer, the Canvas record shows the inherited disabled state, and a rule's
 * `colorScheme` re-applies the theme in that mode (user decision 4).
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("ADR-281 G2 — a page root's isDisabled", () => {
  it("disables a descendant Button: RAC renders it disabled and its onPress rule does not run", async () => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", { opcode: "toast", message: "pressed" });
    press(h.element(button));
    expect(h.toasts).toEqual(["pressed"]);
    h.declare(BODY, { isDisabled: true });
    expect(disabled(h.element(button))).toBe(true);
    press(h.element(button));
    expect(h.toasts).toEqual(["pressed"]);
    h.view.unmount();
  });

  it("an ancestor's isDisabled wins over the Button's own false (a record cannot tell it from the origin's default)", async () => {
    // (RAC alone lets an own `false` win — probe P4; the palette Button declares `isDisabled:
    // false` as its origin default, so composition ORs the inherited `true` in — the Canvas and
    // the guard read the same.)
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", { opcode: "toast", message: "pressed" });
    h.declare(BODY, { isDisabled: true });
    h.declare(button, { isDisabled: false });
    press(h.element(button));
    expect(h.toasts).toEqual([]);
    h.view.unmount();
  });

  it("the Canvas record of the Button shows the inherited disabled state (derived)", async () => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    const record = () =>
      [...h.workspace.root.domInputs.values()].find((node) =>
        node.id.endsWith(`::${button}`),
      );
    expect(record()?.derivedProps?.isDisabled).toBeUndefined();
    h.declare(BODY, { isDisabled: true });
    expect(record()?.derivedProps?.isDisabled).toBe(true);
    // (Turning it back off re-derives the descendants — the dirty expansion.)
    h.declare(BODY, { isDisabled: false });
    expect(record()?.derivedProps?.isDisabled).toBeUndefined();
    h.view.unmount();
  });

  it("a rule's disableAll on the page root disables the Button at runtime", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Button", "Button"]);
    const [trigger, target] = h.ids as [NodeId, NodeId];
    h.rule(trigger, "onPress", {
      opcode: "capability",
      target: { nodeId: BODY },
      capabilityId: "disableAll",
    });
    h.rule(target, "onPress", { opcode: "toast", message: "target" });
    press(h.element(trigger));
    expect(disabled(h.element(target))).toBe(true);
    press(h.element(target));
    expect(h.toasts).toEqual([]);
    expect(warnings()).toEqual([]);
    h.view.unmount();
  });
});

describe("ADR-281 G2 — a rule's read-only on the page root at runtime", () => {
  it.each(["readOnlyAll", "toggleReadOnlyAll"])(
    "%s makes a descendant TextField's input read-only",
    async (capabilityId) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const h = await openAdr280Preview(["TextField", "Button"]);
      const [field, button] = h.ids as [NodeId, NodeId];
      h.rule(button, "onPress", {
        opcode: "capability",
        target: { nodeId: BODY },
        capabilityId,
      });
      const input = () =>
        h.element(field)?.querySelector("input") as HTMLInputElement;
      expect(input().readOnly).toBe(false);
      press(h.element(button));
      expect(warnings()).toEqual([]);
      expect(input().readOnly).toBe(true);
      h.view.unmount();
    },
  );
});

describe("ADR-281 G2 — a page root's isReadOnly and the dispatcher's guard", () => {
  it("a TextField under a read-only page root refuses setValue (report) — the same answer as RAC", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["TextField", "Button"]);
    const [field, button] = h.ids as [NodeId, NodeId];
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: field },
      capabilityId: "setValue",
      value: "written",
    });
    h.declare(BODY, { isReadOnly: true });
    const input = () =>
      h.element(field)?.querySelector("input") as HTMLInputElement;
    expect(input().readOnly).toBe(true);
    press(h.element(button));
    expect(input().value).not.toBe("written");
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain("isReadOnly");
    h.view.unmount();
  });
});

describe("ADR-281 G2 — a frame passes its props down (user decision 1)", () => {
  it("a Button inside a disabled frame is disabled; one outside is not", async () => {
    const library = await buildCodeCatalogLibrary();
    const h = await openAdr280Preview(["frame", "Button"]);
    const [frame, outside] = h.ids as [NodeId, NodeId];
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
    expect(disabled(h.element(inside))).toBe(true);
    expect(disabled(h.element(outside))).toBe(false);
    h.view.unmount();
  });
});

describe("ADR-286 — the site's language is the page root's locale (user 2026-10-28)", () => {
  it("a descendant DateField orders its segments by the site's language; a page sets none of its own", async () => {
    const h = await openAdr280Preview(["DateField"]);
    const [field] = h.ids as [NodeId];
    const order = () =>
      [
        ...(h.element(field)?.querySelectorAll<HTMLElement>("[data-type]") ??
          []),
      ]
        .map((segment) => segment.dataset.type)
        .filter((type) => type !== "literal");
    const site = (lang: string | undefined) => {
      act(() => {
        h.workspace.execute(setSiteSettings({ patch: { lang } }));
      });
      h.flush();
    };
    site("ko-KR");
    expect(order()).toEqual(["year", "month", "day"]);
    site("en-US");
    expect(order()).toEqual(["month", "day", "year"]);
    // The page root takes no locale of its own (the Body binding does not accept it).
    expect("locale" in bodyBinding.props.accepts).toBe(false);
    h.view.unmount();
  });

  it("a frame still sets its own part's locale over the site's", async () => {
    const library = await buildCodeCatalogLibrary();
    const h = await openAdr280Preview(["frame"]);
    const [frame] = h.ids as [NodeId];
    const inside = "project:node:inside-date" as NodeId;
    act(() => {
      h.workspace.execute(
        insertNodes({
          parent: { kind: "node", id: frame },
          entries: [
            {
              kind: "node",
              id: inside,
              definitionId: catalogPaletteDefinitionId(library, "DateField"),
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
      h.workspace.execute(setSiteSettings({ patch: { lang: "en-US" } }));
    });
    h.flush();
    h.declare(frame, { locale: "ko-KR" });
    const order = [
      ...(h.element(inside)?.querySelectorAll<HTMLElement>("[data-type]") ??
        []),
    ]
      .map((segment) => segment.dataset.type)
      .filter((type) => type !== "literal");
    expect(order).toEqual(["year", "month", "day"]);
    h.view.unmount();
  });
});

describe("ADR-281 G2 — colorScheme (user decision 4)", () => {
  it("a rule's darkScheme on the page root re-applies the theme in dark mode", async () => {
    const applied: string[] = [];
    const h = await openAdr280Preview(["Button"], {
      applyTheme: (state) => applied.push(state.colorMode),
    });
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: BODY },
      capabilityId: "darkScheme",
    });
    const before = applied.length;
    press(h.element(button));
    expect(applied.slice(before)).toEqual(["dark"]);
    h.view.unmount();
  });
});

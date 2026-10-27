import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addRecord } from "../../../../../../packages/shared/src/catalog/commands/project";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import {
  catalogPropFollowCommand,
  catalogPropFollowMoved,
} from "../../../builder/catalogRuntime/propFollow";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-287 G3 — 「변수로 정하기」 on a D2 prop: a number variable drives a Meter's `value`, a text
 * variable its `variant` (R7 — the document takes the reference, the run time checks the value: one
 * outside the choices draws the definition's value with one warning). The code view writes the
 * RAC pattern (`value={progress}`).
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "project:page:home";

async function meterWith(
  name: string,
  valueType: "number" | "string",
  defaultValue: unknown,
) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Meter"]);
  const meter = h.ids[0]! as NodeId;
  const variableId = `project:stateVariable:${name}`;
  act(() => {
    h.workspace.execute(
      addRecord({
        entry: {
          kind: "stateVariable",
          id: variableId as EntryId<"stateVariable">,
          ownerId: HOME as EntryId<"page">,
          name,
          valueType,
          defaultValue,
        } as never,
      }),
    );
  });
  h.flush();
  return { ...h, meter, variableId, warn };
}

describe("ADR-287 G3 — 「변수로 정하기」 on a D2 prop", () => {
  it("a number variable drives a Meter's value (Preview) — the code view writes value={progress}", async () => {
    const h = await meterWith("progress", "number", 30);
    act(() => {
      h.workspace.execute(
        catalogPropFollowCommand(h.workspace.runtime.graph, h.meter, "value", {
          prop: "value",
          kind: "variable",
          variableId: h.variableId,
        }),
      );
    });
    h.flush();
    expect(h.element(h.meter)?.getAttribute("aria-valuenow")).toBe("30");
    const { code } = generateCodeView({
      reader: h.workspace.runtime.graph,
      pageId: HOME as EntryId<"page">,
      collections: [],
    });
    expect(code).toMatch(/<Meter[^>]*value=\{progress\}/);
    h.view.unmount();
  });

  it("R7: a text variable on a Meter's variant is stored (no PROP_CHOICE_MISMATCH) and drawn", async () => {
    const h = await meterWith("tone", "string", "positive");
    expect(() =>
      act(() => {
        h.workspace.execute(
          catalogPropFollowCommand(
            h.workspace.runtime.graph,
            h.meter,
            "variant",
            { prop: "variant", kind: "variable", variableId: h.variableId },
          ),
        );
      }),
    ).not.toThrow();
    h.flush();
    expect(
      h
        .element(h.meter)
        ?.closest("[data-variant]")
        ?.getAttribute("data-variant") ??
        h.element(h.meter)?.getAttribute("data-variant"),
    ).toBe("positive");
    h.view.unmount();
  });

  it("R7: a value outside the choices draws the definition's variant, with one warning", async () => {
    const h = await meterWith("tone", "string", "bogus");
    act(() => {
      h.workspace.execute(
        catalogPropFollowCommand(
          h.workspace.runtime.graph,
          h.meter,
          "variant",
          {
            prop: "variant",
            kind: "variable",
            variableId: h.variableId,
          },
        ),
      );
    });
    h.flush();
    const variant =
      h
        .element(h.meter)
        ?.closest("[data-variant]")
        ?.getAttribute("data-variant") ??
      h.element(h.meter)?.getAttribute("data-variant");
    expect(variant).not.toBe("bogus");
    expect(
      h.warn.mock.calls.filter((call) =>
        String(call[0]).includes("is not one of"),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    h.view.unmount();
  });

  it("R7: a number variable on a choice prop is still refused (PROP_CHOICE_MISMATCH)", async () => {
    const h = await meterWith("level", "number", 1);
    let refusal: { code?: string } | undefined;
    try {
      h.workspace.execute(
        catalogPropFollowCommand(
          h.workspace.runtime.graph,
          h.meter,
          "variant",
          {
            prop: "variant",
            kind: "variable",
            variableId: h.variableId,
          },
        ),
      );
    } catch (error) {
      refusal = error as { code?: string };
    }
    expect(refusal?.code).toBe("PROP_CHOICE_MISMATCH");
    h.view.unmount();
  });
});

describe("ADR-287 — a follow row moved to another prop", () => {
  it("keeps its variable and takes the new prop's shape", () => {
    const when = {
      prop: "showValueLabel",
      kind: "when" as const,
      variableId: "v",
      path: "",
      op: "exists" as const,
    };
    expect(catalogPropFollowMoved(when, "variant", "choice")).toEqual({
      prop: "variant",
      kind: "variable",
      variableId: "v",
    });
    expect(
      catalogPropFollowMoved(
        { prop: "variant", kind: "variable", variableId: "v" },
        "isQuiet",
        "boolean",
      ),
    ).toEqual({ ...when, prop: "isQuiet" });
    expect(catalogPropFollowMoved(when, "isQuiet", "boolean")).toEqual({
      ...when,
      prop: "isQuiet",
    });
  });
});

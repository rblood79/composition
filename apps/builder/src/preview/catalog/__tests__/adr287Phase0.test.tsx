import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import { exposedCapabilities } from "../../../../../../packages/shared/src/interactions/exposure";
import { catalogPropFollowProps } from "../../../builder/catalogRuntime/propFollow";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-287 Phase 0 (G0) — the RED set before the derivation layer: a Meter has no Do of its own, a
 * runtime `label` on a composite does not reach the child its template binds, the code view has no
 * number state for a rule's value, and 「변수로 정하기」 does not offer the Meter's `value`. Each
 * `it.fails` turns into an `it` in the phase that closes it.
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "project:page:home" as EntryId<"page">;

async function open(types: readonly string[]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr280Preview(types);
}

describe("ADR-287 G0 — ①a the registry (GREEN in Phase 1)", () => {
  it("a Meter offers 「값 정하기」 (the reference's `value`)", () => {
    expect(Object.keys(exposedCapabilities("Meter", { props: {} }))).toContain(
      "setValue",
    );
  });
});

describe("ADR-287 G0 — ①b a runtime override on the Preview", () => {
  it("(control) a Meter's own `value` override reaches the DOM (`withOverride`)", async () => {
    const h = await open(["Meter"]);
    const element = h.element(h.ids[0]!)!;
    expect(element.getAttribute("aria-valuenow")).not.toBe("50");
    act(() =>
      h.runtime.setRuntimeProps(element.dataset.catalogId!, { value: 50 }),
    );
    expect(h.element(h.ids[0]!)!.getAttribute("aria-valuenow")).toBe("50");
    h.view.unmount();
  });

  it(
    "a Meter's `label` override reaches its Label (`{label}` template binding)",
    async () => {
      const h = await open(["Meter"]);
      const element = h.element(h.ids[0]!)!;
      expect(element.textContent).toContain("Storage");
      act(() =>
        h.runtime.setRuntimeProps(element.dataset.catalogId!, {
          label: "Updated meter label",
        }),
      );
      expect(h.element(h.ids[0]!)!.textContent).toContain(
        "Updated meter label",
      );
      h.view.unmount();
    },
  );
});

describe("ADR-287 G0 — ② the code view", () => {
  it(
    "a rule writing a Meter's value is a number state (`useState(<authored>)`)",
    async () => {
      const h = await open(["Button", "Meter"]);
      const [button, meter] = h.ids as [NodeId, NodeId];
      h.declare(meter, { value: 40 });
      h.rule(button, "onPress", {
        opcode: "capability",
        target: { nodeId: meter },
        capabilityId: "setValue",
        value: 50,
      } as never);
      const { code } = generateCodeView({
        reader: h.workspace.runtime.graph,
        pageId: HOME,
        collections: [],
      });
      expect(code).toMatch(/useState\(40\)/);
      expect(code).toMatch(/<Meter[^>]*value=\{meterValue\}/);
      expect(code).toMatch(/setMeterValue\(50\)/);
      h.view.unmount();
    },
  );
});

describe("ADR-287 G0 — ③ 「변수로 정하기」", () => {
  it("a Meter's `value` is a candidate (GREEN in Phase 3)", async () => {
    const h = await open(["Meter"]);
    const props = catalogPropFollowProps(
      h.workspace.runtime.graph,
      h.ids[0]! as NodeId,
    ).map((entry) => entry.prop);
    expect(props).toContain("value");
    h.view.unmount();
  });

  it("the candidates carry the D2 kinds: number · choice · text (Phase 3)", async () => {
    const h = await open(["Meter"]);
    const props = Object.fromEntries(
      catalogPropFollowProps(
        h.workspace.runtime.graph,
        h.ids[0]! as NodeId,
      ).map((entry) => [entry.prop, entry.type]),
    );
    expect(props).toMatchObject({
      value: "number",
      minValue: "number",
      variant: "choice",
      label: "string",
      showValueLabel: "boolean",
    });
    expect(props.formatOptions).toBeUndefined();
    h.view.unmount();
  });
});


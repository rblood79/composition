import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { openAdr280Preview } from "./support/adr280Harness";
import { HOME, openAdr296 } from "./support/adr296Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — RAC ComboBox `defaultFilter` as data (S2 omits it and
 * keeps RAC's language-aware `contains`): `startsWith` keeps the items the typed text begins.
 * Measurement: jsdom, the palette ComboBox (Aardvark · Cat · Dog · Kangaroo).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

describe("S2 D.3 ComboBox filter (RAC defaultFilter as data)", () => {
  it.each([
    [undefined, ["Aardvark", "Cat", "Kangaroo"]],
    ["startsWith", ["Aardvark"]],
  ] as const)(
    "defaultFilter %s: typing 「a」 keeps %j",
    async (mode, shown) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const h = await openAdr280Preview(["ComboBox"]);
      const [comboBox] = h.ids as [NodeId];
      if (mode) h.declare(comboBox, { defaultFilter: mode });
      await settle();
      const input = h.element(comboBox)!.querySelector("input")!;
      act(() => {
        input.focus();
      });
      act(() => {
        fireEvent.change(input, { target: { value: "a" } });
      });
      await settle();
      expect(
        [...document.querySelectorAll('[role="option"]')].map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual(shown);
      h.view.unmount();
    },
  );

  it('the code view writes filter("startsWith") and reads it back (strict)', async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const comboBox = h.add("ComboBox") as NodeId;
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: comboBox }],
        props: { defaultFilter: { kind: "set", value: "startsWith" } } as never,
        label: "Filter",
      }),
    );
    const code = h.code();
    expect(code).toContain("defaultFilter={filter('startsWith')}");
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    expect(
      catalogCodeViewPlan({
        reader: h.workspace.runtime.graph.commandReader,
        session,
        edited: session.baseline.code,
        changes: [],
        data,
        newId: h.workspace.newId,
        strict: true,
      }).rejected,
    ).toEqual([]);
  });
});

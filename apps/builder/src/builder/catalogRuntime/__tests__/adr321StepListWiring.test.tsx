// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { render } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogStepChromeShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { V3StepList } from "./support/adr321V3StepList";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-321 G1 — StepList through the real composition root: the palette origin (three Steps — one
 * completed, the current one, one remaining), each Step's derived state · place, its Texts' colors,
 * the Canvas chrome shapes and the DOM's static RAC `Group > ol > li` — after an edit of the list, a step added by
 * the Design "+", a step removed, and undo. Expected values are written out by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr321-g1" as EntryId<"project">,
        name: "ADR-321 G1",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr321-g1-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          // (The palette's definition — the origin, as a placed StepList is.)
          definitionId: catalogPaletteDefinitionId(library, "StepList"),
          children: [],
          props: {},
          visual: { width: { kind: "set", value: 600 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const list = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
  const steps = () => list().children.map((id) => root.canvasInputs.get(id)!);
  const texts = (step: { children: readonly string[] }) =>
    step.children.map((id) => root.canvasInputs.get(id)!);
  const states = () =>
    steps().map((step) => [
      step.derivedProps?._stepState,
      step.derivedProps?._stepNumber,
      step.derivedProps?._stepLast,
    ]);
  const write = (target: "list" | number, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [
          workspace.itemOfRecord(
            target === "list" ? list().id : steps()[target]!.id,
          )!.target,
        ],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  return { workspace, root, list, steps, texts, states, write };
}

const color = (ref: string) => String(resolveToken(ref as TokenRef, "light"));

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function dom(t: Awaited<ReturnType<typeof place>>) {
  await unmount?.();
  const host = document.createElement("div");
  document.body.append(host);
  const react = createRoot(host);
  await act(async () => react.render(renderCatalogDom(t.root, t.list().id)));
  unmount = async () => act(async () => react.unmount());
  return host;
}

describe("ADR-321 G1 — StepList registration · static shape (Canvas records · DOM)", () => {
  it("the palette places the origin: StepList > three Steps, each a label Text (the description absent)", async () => {
    expect(getPaletteItems().some((item) => item.type === "StepList")).toBe(
      true,
    );
    // (A Step is placed inside a StepList only — not a palette item.)
    expect(getPaletteItems().some((item) => item.type === "Step")).toBe(false);
    const t = await place();
    expect(t.root.typeOf(t.list())).toBe("StepList");
    expect(t.steps().map((step) => t.root.typeOf(step))).toEqual([
      "Step",
      "Step",
      "Step",
    ]);
    const labels = t.steps().map((step) =>
      t
        .texts(step)
        .filter((text) => !text.hidden)
        .map((text) => text.props.children),
    );
    expect(labels).toEqual([["Step 1"], ["Step 2"], ["Step 3"]]);
    t.workspace.dispose();
  });

  it("the start state: completed · current · remaining — numbers and the last step, the label colors", async () => {
    const t = await place();
    expect(t.states()).toEqual([
      ["completed", 1, false],
      ["current", 2, false],
      ["incomplete", 3, true],
    ]);
    expect(
      t.steps().map((step) => t.texts(step)[0]!.derivedProps?.color),
    ).toEqual([
      color("{color.neutral-subdued}"),
      color("{color.neutral-content}"),
      color("{color.neutral-subdued}"),
    ]);
    t.workspace.dispose();
  });

  it("the list's keys · emphasis · orientation reach its steps and their texts; undo brings them back", async () => {
    const t = await place();
    t.write("list", { defaultSelectedKey: "step-3", isEmphasized: true });
    // (The current step is two past the last completed one — the step before it completes too.)
    expect(t.states().map(([state]) => state)).toEqual([
      "completed",
      "completed",
      "current",
    ]);
    expect(t.texts(t.steps()[2]!)[0]!.derivedProps?.color).toBe(
      color("{color.accent-content}"),
    );
    expect(t.steps().every((s) => s.derivedProps?._stepEmphasized)).toBe(true);
    t.write("list", { orientation: "vertical" });
    expect(t.list().derivedProps?._stepListOrientation).toBe("vertical");
    expect(t.steps().map((s) => s.derivedProps?._stepOrientation)).toEqual([
      "vertical",
      "vertical",
      "vertical",
    ]);
    // (Vertical M: room on the left for the visual 16 + gap 6, none under.)
    expect(
      t
        .steps()
        .map((s) => [
          s.derivedProps?._stepPadLeft,
          s.derivedProps?._stepPadBottom,
        ]),
    ).toEqual([
      [22, 8],
      [22, 8],
      [22, 8],
    ]);
    t.workspace.undo();
    t.workspace.undo();
    expect(t.states().map(([state]) => state)).toEqual([
      "completed",
      "current",
      "incomplete",
    ]);
    expect(t.steps()[0]!.derivedProps?._stepOrientation).toBe("horizontal");
    expect(t.steps()[0]!.derivedProps?._stepPadBottom).toBe(22);
    t.workspace.dispose();
  });

  it("a step's own Disabled and the list's disabledKeys · isDisabled draw it disabled", async () => {
    const t = await place();
    const disabled = () => t.steps().map((s) => s.derivedProps?._stepDisabled);
    t.write(0, { isDisabled: true });
    expect(disabled()).toEqual([true, false, false]);
    expect(t.texts(t.steps()[0]!)[0]!.derivedProps?.color).toBe(
      color("{color.disabled-content}"),
    );
    t.write("list", { disabledKeys: ["step-3"] });
    expect(disabled()).toEqual([true, false, true]);
    t.write("list", { isDisabled: true });
    expect(disabled()).toEqual([true, true, true]);
    t.workspace.dispose();
  });

  it("the Design 「+」 adds a Step: the old last step gets its track, the new one is the last", async () => {
    const t = await place();
    const choices = catalogItemInsertChoices(
      {
        graph: t.workspace.runtime.graph,
        readModel: t.workspace.readModel,
        newId: t.workspace.newId,
      },
      t.workspace.positionOfRecord(t.list().id)!,
    );
    expect(choices.map((choice) => choice.type)).toEqual(["Step"]);
    t.workspace.execute(choices[0]!.build());
    expect(t.states()).toEqual([
      ["completed", 1, false],
      ["current", 2, false],
      ["incomplete", 3, false],
      ["incomplete", 4, true],
    ]);
    // (The new step is an instance of the Step origin, with a label and a key of its own.)
    const added = t.steps()[3]!;
    expect(
      t
        .texts(added)
        .filter((text) => !text.hidden)
        .map((text) => text.props.children),
    ).toEqual(["Item 4"]);
    expect(typeof added.props.id).toBe("string");
    t.workspace.undo();
    expect(t.states()).toEqual([
      ["completed", 1, false],
      ["current", 2, false],
      ["incomplete", 3, true],
    ]);
    t.workspace.dispose();
  });

  it("removing a step renumbers the ones after it", async () => {
    const t = await place();
    t.workspace.execute(
      removeTargets({
        targets: [t.workspace.itemOfRecord(t.steps()[0]!.id)!.target],
      } as never),
    );
    // (step-1 is gone: nothing is completed any more — step-2 stays current, now number 1.)
    expect(t.states()).toEqual([
      ["current", 1, false],
      ["incomplete", 2, true],
    ]);
    t.workspace.dispose();
  });

  it("a description shows its Text (and hides it again when emptied)", async () => {
    const t = await place();
    const shown = () =>
      t
        .texts(t.steps()[1]!)
        .filter((text) => !text.hidden)
        .map((text) => [text.props.slot ?? "", text.props.children]);
    expect(shown()).toEqual([["", "Step 2"]]);
    t.write(1, { description: "Pay by card" });
    expect(shown()).toEqual([
      ["", "Step 2"],
      ["description", "Pay by card"],
    ]);
    const description = t
      .texts(t.steps()[1]!)
      .find((text) => text.props.slot === "description")!;
    expect(description.derivedProps?.color).toBe(
      color("{color.neutral-subdued}"),
    );
    t.write(1, { description: "" });
    expect(shown()).toEqual([["", "Step 2"]]);
    t.workspace.dispose();
  });

  it("the Canvas draws each step's visual (check · number) and a track on all but the last", async () => {
    const t = await place();
    const shapes = t.steps().map((step) =>
      catalogStepChromeShapes({
        type: "Step",
        node: step,
        rect: { x: 0, y: 0, width: 200, height: 40 },
        theme: "light",
      } as never).map((shape) => {
        const s = shape as unknown as Record<string, unknown>;
        return [
          s.type,
          s.text ?? s.iconName ?? "",
          s.fill ?? "",
          s.stroke ?? "",
        ];
      }),
    );
    expect(shapes).toEqual([
      [
        ["circle", "", color("{color.gray}"), ""],
        ["icon_font", "check", color("{color.on-neutral}"), ""],
        ["rect", "", color("{color.gray}"), ""],
      ],
      [
        ["circle", "", color("{color.neutral-fill}"), ""],
        ["text", "2", color("{color.on-neutral}"), ""],
        ["rect", "", color("{color.field-placeholder}"), ""],
      ],
      [
        ["circle", "", "", color("{color.field-placeholder}")],
        ["text", "3", color("{color.neutral-subdued}"), ""],
      ],
    ]);
    // (S: a dot only — no number, no check.)
    t.write("list", { size: "S" });
    expect(
      catalogStepChromeShapes({
        type: "Step",
        node: t.steps()[0]!,
        rect: { x: 0, y: 0, width: 200, height: 28 },
        theme: "light",
      } as never).map((shape) => (shape as { type: string }).type),
    ).toEqual(["circle", "rect"]);
    t.workspace.dispose();
  });

  it("the DOM is RAC `Group > ol > li > Link` with the step's state · visual · track — the roles · names · aria are RAC's, none of ours (HC2)", async () => {
    const t = await place();
    const host = await dom(t);
    // The record's box is RAC Group (user answer 2026-11-27 — the list's name), the `ol` its one child.
    const group = host.querySelector(".react-aria-StepList") as HTMLElement;
    expect(group).not.toBeNull();
    expect(group.tagName).toBe("DIV");
    expect(group.getAttribute("data-catalog-id")).toBe(t.list().id);
    expect(group.getAttribute("data-orientation")).toBe("horizontal");
    // (RAC Group's own output — the answer table is what the installed Group renders for these props.)
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Steps");
    expect([...group.children].map((child) => child.tagName)).toEqual(["OL"]);
    const list = group.firstElementChild as HTMLElement;
    expect(list.className).toBe("step-list-items");
    const items = [...list.children] as HTMLElement[];
    expect(items.map((item) => item.tagName)).toEqual(["LI", "LI", "LI"]);
    expect(
      items.map((item) => [
        item.className,
        item.getAttribute("data-size"),
        item.getAttribute("data-step-state"),
      ]),
    ).toEqual([
      ["react-aria-Step", "M", "completed"],
      ["react-aria-Step", "M", "current"],
      ["react-aria-Step", "M", "incomplete"],
    ]);
    // Each step: its RAC Link (the Texts · the state word · the visual in it), then its track.
    const links = items.map(
      (item) => item.querySelector(":scope > .step-link") as HTMLElement,
    );
    expect(items.map((item) => item.firstElementChild)).toEqual(links);
    expect(
      items.map((item, index) => {
        const visual = links[index]!.querySelector(":scope > .step-visual")!;
        return [
          visual.querySelector("svg") ? "check" : visual.textContent,
          item.querySelectorAll(":scope > .step-track").length,
        ];
      }),
    ).toEqual([
      ["check", 1],
      ["2", 1],
      ["3", 0],
    ]);
    // What RAC Link gives for the state rule's answer (v3 `useStepListItem.mjs:26-32` — the same
    // four attributes; written out by hand: the placed list is 「완료 · 현재 · 남음」 and the third
    // step cannot be gone to — its previous step is not completed).
    expect(
      links.map((link) =>
        ["role", "aria-current", "aria-disabled", "tabindex"].map((name) =>
          link.getAttribute(name),
        ),
      ),
    ).toEqual([
      ["link", null, null, "0"],
      ["link", "step", null, "0"],
      ["link", null, "true", null],
    ]);
    // HC2 — the `ol` · `li` and the drawn parts carry no role and no aria attribute (the check
    // glyph's own `aria-hidden` is the shared icon's; the Group's · Links' are RAC's — above).
    for (const element of [list, ...items])
      expect(
        element
          .getAttributeNames()
          .filter((name) => name === "role" || name.startsWith("aria-")),
      ).toEqual([]);
    for (const item of items)
      for (const part of item.querySelectorAll(
        ".step-visual, :scope > .step-track, .step-glyph",
      ))
        expect(
          part
            .getAttributeNames()
            .filter((name) => name === "role" || name.startsWith("aria-")),
        ).toEqual([]);
    // The link's text: the label, the state word a screen reader reads, the visual's number.
    expect(links.map((link) => link.textContent)).toEqual([
      "Step 1Completed",
      "Step 2Current2",
      "Step 3Not completed3",
    ]);
    // The label takes the step element's color (a press moves the current step — a resting color
    // inline on the Text would stay).
    for (const item of items) {
      expect(item.style.color).not.toBe("");
      expect(
        (item.querySelector(".react-aria-Text") as HTMLElement).style.color,
      ).toBe("inherit");
    }
  });

  it("G2 — 조립이 낸 속성 = v3 hook 의 속성 (role · aria-current · aria-disabled · tabindex), 시작 값 여섯에서", async () => {
    const fixtures: Record<string, unknown>[] = [
      {},
      { defaultSelectedKey: "step-1", defaultLastCompletedStep: "" },
      { defaultSelectedKey: "step-3", defaultLastCompletedStep: "step-3" },
      { disabledKeys: ["step-1"] },
      { isDisabled: true },
      { isReadOnly: true },
    ];
    const NAMES = ["role", "aria-current", "aria-disabled", "tabindex"];
    const attributes = (elements: Iterable<Element>) =>
      [...elements].map((element) =>
        NAMES.map((name) => element.getAttribute(name)),
      );
    const seen: string[] = [];
    for (const fixture of fixtures) {
      const t = await place();
      if (Object.keys(fixture).length) t.write("list", fixture);
      const host = await dom(t);
      const product = attributes(host.querySelectorAll(".step-link"));
      const props = { ...t.list().props, ...fixture } as Record<
        string,
        unknown
      >;
      // v3's own list for the same start values (the installed private hooks — the reference).
      const reference = render(
        <V3StepList
          input={{
            keys: ["step-1", "step-2", "step-3"],
            selectedKey: (props.defaultSelectedKey as string) || null,
            lastCompletedStep:
              (props.defaultLastCompletedStep as string) || null,
            disabledKeys: (props.disabledKeys as string[]) ?? [],
            isDisabled: props.isDisabled === true,
            isReadOnly: props.isReadOnly === true,
          }}
          onState={() => {}}
        />,
      );
      const v3 = attributes(
        reference.container.querySelectorAll("a[data-step]"),
      );
      reference.unmount();
      expect(product, JSON.stringify(fixture)).toEqual(v3);
      expect(product).toHaveLength(3);
      seen.push(product.map((step) => step.slice(1).join("/")).join(" "));
      t.workspace.dispose();
    }
    // (Vacuity guard: the fixtures differ — the comparison is not of one constant list.)
    expect(new Set(seen).size).toBeGreaterThanOrEqual(5);
  });
});

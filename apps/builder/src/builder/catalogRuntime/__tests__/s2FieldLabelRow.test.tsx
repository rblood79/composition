// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 1.8.2 `FieldLabel` (`Field.tsx`) — every labelled field (and Meter · ProgressBar · Slider ·
 * LabeledValue) puts its Label in a row `div`, and draws no row without label text (`if
 * (!props.children) return null`). 2026-11-18 사용자 결정 「노드로 늘 둠」: the origins hold a
 * FieldLabel node around their Label.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(origin: string, props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:field-label" as EntryId<"project">,
        name: "FieldLabel",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `field-label-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
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
          definitionId:
            `lib:definition:origin-component-${origin}` as LibraryDefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value: value as never },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    );
  const owner = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === PLACED)!;
  const setLabel = (value: string) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(owner().id)!.target],
        props: { label: { kind: "set", value } },
      }),
    );
  const html = () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, owner().id));
    return host;
  };
  return { root, part, setLabel, html };
}

describe("S2 FieldLabel — the label row is a node of every labelled origin", () => {
  it.each([
    "textfield",
    "select",
    "combobox",
    "numberfield",
    "datepicker",
    "checkboxgroup",
    "slider",
    "meter",
    "progressbar",
  ])(
    "%s: div.react-aria-FieldLabel > label, gone without label text (both consumers)",
    async (origin) => {
      const { part, setLabel, html } = await place(origin);
      const row = part("FieldLabel")!;
      const label = part("Label")!;
      expect(label.parentId).toBe(row.id);
      const element = html().querySelector(".react-aria-FieldLabel");
      expect(element?.tagName).toBe("DIV");
      expect(element?.querySelector(".react-aria-Label")).not.toBeNull();

      setLabel("");
      expect(part("FieldLabel")!.hidden).toBe(true);
      expect(html().querySelector(".react-aria-FieldLabel")).toBeNull();

      setLabel("Back");
      expect(part("FieldLabel")!.hidden).toBeFalsy();
      expect(
        html().querySelector(".react-aria-FieldLabel")?.textContent,
      ).toContain("Back");
    },
  );

  it('LabeledValue: FieldLabel > span label (S2 `elementType="span"`) + the value', async () => {
    const { part, html } = await place("labeledvalue");
    expect(part("Label")!.parentId).toBe(part("FieldLabel")!.id);
    const host = html();
    const label = host.querySelector(
      ".react-aria-FieldLabel > .react-aria-Label",
    );
    expect(label?.tagName).toBe("SPAN");
    expect(host.querySelector("label")).toBeNull();
  });

  // S2 `fieldLabel()` color: `neutral-subdued` — the row's Label anywhere (a field's, Meter ·
  // ProgressBar · LabeledValue's), and Meter · ProgressBar's value text (`valueStyles`).
  it.each(["meter", "progressbar", "labeledvalue"])(
    "%s: the row's Label is neutral-subdued on both consumers",
    async (origin) => {
      const { part, html } = await place(origin);
      const record = part("Label")!;
      expect(record.derivedProps?.color ?? record.visual.color).toBe("#505050");
      const label = html().querySelector<HTMLElement>(
        ".react-aria-FieldLabel > .react-aria-Label",
      )!;
      expect(label.style.color).toBe("rgb(80, 80, 80)");
    },
  );

  // (S2 `isStaticColor: 'transparent-overlay-1000'` — the static color beats the row's subdued.)
  it.each(["meter", "progressbar"])(
    "%s staticColor white: the row's Label is white on both consumers",
    async (origin) => {
      const { part, html } = await place(origin, { staticColor: "white" });
      expect(part("Label")!.derivedProps?.color).toBe("#ffffff");
      const label = html().querySelector<HTMLElement>(
        ".react-aria-FieldLabel > .react-aria-Label",
      )!;
      expect(label.style.color).toBe("rgb(255, 255, 255)");
    },
  );

  it.each([
    ["meter", "MeterValue"],
    ["progressbar", "ProgressBarValue"],
  ])(
    "%s: the value text's rule paints neutral-subdued",
    async (origin, type) => {
      const { root } = await place(origin);
      const rule = root.runtime.graph.library.rules.get(type)!;
      for (const variant of Object.values(rule.variants ?? {}))
        expect(
          (variant as { paint?: { color?: { default?: string } } }).paint?.color
            ?.default,
        ).toBe("{color.neutral-subdued}");
    },
  );

  // S2 `FieldLabel`: `{label}<span style="white-space: nowrap">&nbsp;<Asterisk/></span>` — the NBSP
  // and the mark in one span, none without a mark.
  it.each([
    ["icon", '[slot="necessity-icon"]'],
    ["label", '[slot="necessity-label"]'],
  ])("necessity %s: NBSP + mark in one nowrap span", async (mode, mark) => {
    const { html } = await place("textfield", {
      isRequired: true,
      necessityIndicator: mode,
    });
    const label = html().querySelector(".react-aria-Label")!;
    const span = label.querySelector<HTMLElement>(":scope > span:last-child")!;
    expect(span.style.whiteSpace).toBe("nowrap");
    expect(span.querySelector('[slot="necessity-space"]')).not.toBeNull();
    expect(span.querySelector(mark)).not.toBeNull();
    expect(label.querySelector(':scope > [slot="necessity-space"]')).toBeNull();
  });

  it("no mark: no necessity span", async () => {
    const { html } = await place("textfield");
    const label = html().querySelector(".react-aria-Label")!;
    expect(
      [...label.querySelectorAll(":scope > span")].filter(
        (span) => (span as HTMLElement).style.whiteSpace === "nowrap",
      ),
    ).toEqual([]);
  });
});

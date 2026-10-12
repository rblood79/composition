// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Input,
  Meter,
  NumberField,
  ProgressBar,
  Slider,
  SliderOutput,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogNumberFormatFits } from "../../../../../../packages/shared/src/catalog/document/numberFormatValue";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { editContractFixture } from "./support/editContractFixture";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 1.8.0 · RAC `formatOptions` (사용자 결정 2026-10-12 「S2 · RAC 가 객체면 객체 값 타입」):
 * NumberField · Meter · ProgressBar · Slider take one `numberFormat` object. The DOM passes it to
 * RAC; the Canvas writes the same text (RAC's `NumberFormatter` rules — percent style formats the
 * fraction on a Meter · ProgressBar). The oracle is the installed RAC's own output.
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:formatted" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(origin: string, props: Record<string, unknown>) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-format" as EntryId<"project">,
        name: "Format",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `s2-format-${Math.random()}`),
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
          id: NODE,
          definitionId:
            `lib:definition:origin-component-${origin}` as LibraryDefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const owner = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === NODE)!;
  const part = (type: string) =>
    [...root.domInputs.values()].find((record) => root.typeOf(record) === type);
  const draw = () => {
    const view = render(renderCatalogDom(root, owner().id));
    cleanups.push(() => view.unmount());
    return view.container.firstElementChild as HTMLElement;
  };
  const edit = (patch: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: NODE }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  return { workspace, root, owner, part, draw, edit };
}

/** RAC's own value text for a Meter · ProgressBar with these props (the oracle). */
function racProgressText(
  component: typeof Meter | typeof ProgressBar,
  props: Record<string, unknown>,
): string {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    createElement(component as never, {
      ...props,
      "aria-label": "x",
      children: ({ valueText }: { valueText?: string }) =>
        createElement("span", { className: "value" }, valueText),
    }),
  );
  return host.querySelector(".value")?.textContent ?? "";
}

const FORMATS: ReadonlyArray<Record<string, unknown> | undefined> = [
  undefined,
  { style: "currency", currency: "USD" },
  { style: "currency", currency: "EUR", currencyDisplay: "code" },
  { style: "unit", unit: "kilometer", unitDisplay: "long" },
  { style: "percent", minimumFractionDigits: 1 },
  { style: "decimal", maximumFractionDigits: 0, useGrouping: false },
  { signDisplay: "always", minimumIntegerDigits: 3 },
];

describe("S2 formatOptions — the numberFormat value type", () => {
  it("the value check takes the authored keys, each its own type, one style's keys with that style", () => {
    for (const value of [
      { style: "percent" },
      { style: "currency", currency: "KRW" },
      {
        style: "currency",
        currency: "USD",
        currencyDisplay: "name",
        currencySign: "accounting",
      },
      { style: "unit", unit: "kilometer-per-hour", unitDisplay: "narrow" },
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      { useGrouping: false },
      { signDisplay: "exceptZero" },
      { minimumIntegerDigits: 21 },
    ])
      expect(catalogNumberFormatFits(value), JSON.stringify(value)).toBe(true);
    for (const value of [
      {},
      { style: "currency" },
      { style: "currency", currency: "usd" },
      { style: "unit" },
      { style: "unit", unit: "furlong-fortnight" },
      { currency: "USD" },
      { style: "percent", unit: "meter" },
      { style: "decimal", currencyDisplay: "code" },
      { minimumFractionDigits: 3, maximumFractionDigits: 1 },
      { minimumFractionDigits: 1.5 },
      { minimumIntegerDigits: 0 },
      { notation: "compact" },
      { style: "scientific" },
      { useGrouping: "always" },
      { kind: "token", tokenId: "lib:token:x" },
      [{ style: "percent" }],
      "percent",
      2,
      null,
    ])
      expect(catalogNumberFormatFits(value), JSON.stringify(value)).toBe(false);
  });

  it("binding → typed definition: the four types accept numberFormat with no default (RAC's own)", async () => {
    const library = await buildCodeCatalogLibrary();
    for (const type of ["NumberField", "Meter", "ProgressBar", "Slider"]) {
      const definition = library.definitions.get(
        `lib:definition:type-${type}` as LibraryDefinitionId,
      )!;
      expect(definition.accepts.formatOptions, type).toBe("numberFormat");
      expect(definition.defaults.formatOptions, type).toBeUndefined();
      expect(
        editContractFixture(type).fields.find(
          (field) => field.key === "formatOptions",
        )?.kind,
        type,
      ).toBe("number-format");
    }
  });

  it("a wrong shape is refused — revision, history and save queue stay", async () => {
    const { workspace, edit } = await open("meter", { value: 30 });
    edit({ formatOptions: { style: "currency", currency: "USD" } });
    const before = {
      revision: workspace.runtime.graph.revision,
      history: workspace.runtime.historyDepth,
      pending: workspace.runtime.pendingCount,
    };
    for (const value of [
      {},
      { style: "currency" },
      { style: "unit", unit: "furlong-fortnight" },
      { notation: "compact" },
      "percent",
    ])
      expect(
        () => edit({ formatOptions: value }),
        JSON.stringify(value),
      ).toThrow();
    // Nor in another field.
    expect(() => edit({ label: { style: "percent" } })).toThrow();
    expect({
      revision: workspace.runtime.graph.revision,
      history: workspace.runtime.historyDepth,
      pending: workspace.runtime.pendingCount,
    }).toEqual(before);
  });

  for (const [origin, component, valuePart] of [
    ["meter", Meter, "MeterValue"],
    ["progressbar", ProgressBar, "ProgressBarValue"],
  ] as const)
    it(`${origin}: the value text is RAC's on both consumers, for each format`, async () => {
      const { part, draw, edit } = await open(origin, {
        label: "Storage",
        value: 1234.5,
        minValue: 0,
        maxValue: 5000,
        showValueLabel: true,
      });
      for (const format of FORMATS) {
        if (format) edit({ formatOptions: format });
        const expected = racProgressText(component, {
          value: 1234.5,
          minValue: 0,
          maxValue: 5000,
          formatOptions: format,
        });
        const label = JSON.stringify(format);
        expect(draw().querySelector(".value")?.textContent, label).toBe(
          expected,
        );
        expect(part(valuePart)!.props.children, label).toBe(expected);
      }
    });

  it("slider: the output is RAC's on both consumers, for each format", async () => {
    const { part, draw, edit } = await open("slider", {
      label: "Distance",
      value: 40,
      minValue: 0,
      maxValue: 100,
    });
    const output = () =>
      part("SliderOutput")!.derivedProps?.children ??
      part("SliderOutput")!.props.children;
    for (const format of FORMATS) {
      if (format) edit({ formatOptions: format });
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        createElement(Slider, {
          defaultValue: 40,
          formatOptions: format as Intl.NumberFormatOptions | undefined,
          "aria-label": "x",
          children: createElement(SliderOutput),
        }),
      );
      const expected = host.querySelector("output")?.textContent ?? "";
      const label = JSON.stringify(format);
      expect(draw().querySelector("output")?.textContent, label).toBe(expected);
      expect(output(), label).toBe(expected);
    }
  });

  it("numberfield: the input text is RAC's on both consumers, for each format", async () => {
    const { owner, part, draw, edit } = await open("numberfield", {
      label: "Amount",
      value: "1234.5",
      minValue: 0,
      maxValue: 100000,
    });
    for (const format of FORMATS) {
      if (format) edit({ formatOptions: format });
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        createElement(NumberField, {
          defaultValue: 1234.5,
          minValue: 0,
          maxValue: 100000,
          // (The origin's own step — RAC snaps the value to it.)
          step: owner().props.step as number | undefined,
          formatOptions: format as Intl.NumberFormatOptions | undefined,
          "aria-label": "x",
          children: createElement(Input),
        }),
      );
      const expected =
        (host.querySelector("input") as HTMLInputElement | null)?.value ?? "";
      const label = JSON.stringify(format);
      expect(
        (draw().querySelector("input") as HTMLInputElement).value,
        label,
      ).toBe(expected);
      expect(part("Input")!.derivedProps?.placeholder, label).toBe(expected);
    }
  });

  it("clearing the format (unset) is RAC's default again", async () => {
    const { workspace, part, edit } = await open("meter", {
      value: 30,
      showValueLabel: true,
    });
    edit({ formatOptions: { style: "currency", currency: "USD" } });
    expect(part("MeterValue")!.props.children).toBe("$30.00");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: NODE }],
        props: { formatOptions: { kind: "remove" } } as never,
      }),
    );
    expect(part("MeterValue")!.props.children).toBe(
      racProgressText(Meter, { value: 30 }),
    );
  });
});

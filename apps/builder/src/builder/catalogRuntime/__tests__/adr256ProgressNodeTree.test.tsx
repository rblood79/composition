// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Label, Meter, ProgressBar } from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 7a (G2) — a ProgressBar draws its node tree, the reference
 * `ProgressBar > Label + span.value {valueText} + div.track > div.fill {width: percentage%}`
 * (react-aria.adobe.com ProgressBar — G0 example 14). The value text and the fill width are template
 * bindings to RAC's render props values (Decision 12): the Preview reads RAC's, the Canvas the
 * owner's record — the same value, and a value change reaches both.
 */
const BODY = "project:node:home-body" as NodeId;
const BAR = "project:node:bar" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(props: Record<string, unknown>, origin = "progressbar") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-progress" as EntryId<"project">,
        name: "Progress",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-progress-${Math.random()}`),
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
          id: BAR,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [BAR],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const bar = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === BAR)!;
  const part = (type: string) =>
    [...root.domInputs.values()].find((record) => root.typeOf(record) === type);
  const draw = () => {
    const view = render(renderCatalogDom(root, bar().id));
    cleanups.push(() => view.unmount());
    return view.container.firstElementChild as HTMLElement;
  };
  const edit = (patch: Record<string, string | number | boolean>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BAR }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { workspace, root, bar, part, draw, edit };
}

/** Decision 11 structure: tag · role · aria (links as positions) · slot · text. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const all = [...host.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? `missing:${id}` : `#${index}`;
  };
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => /^(role|slot|aria-.*)$/.test(attribute.name))
      .map((attribute) =>
        attribute.name === "aria-labelledby"
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...host.children].map(walk).join("\n");
}

describe("ADR-256 Phase 7a — ProgressBar draws its node tree", () => {
  it("has the reference example's structure (Decision 11)", async () => {
    const { root, bar } = await open({ label: "Loading", value: 30 });
    const actual = renderToStaticMarkup(renderCatalogDom(root, bar().id));
    // react-aria.adobe.com ProgressBar (G0 example 14).
    const reference = renderToStaticMarkup(
      createElement(ProgressBar, {
        value: 30,
        children: ({ percentage, valueText }) => [
          createElement(Label, { key: "l" }, "Loading"),
          createElement("span", { key: "v", className: "value" }, valueText),
          createElement(
            "div",
            { key: "t", className: "track inset" },
            createElement("div", {
              className: "fill",
              style: { width: `${percentage}%` },
            }),
          ),
        ],
      }),
    );
    expect(structure(actual)).toBe(structure(reference));
  });

  it("the value text and the fill width are RAC's values, on both consumers", async () => {
    const { root, part, draw, edit } = await open({
      label: "Loading",
      value: 30,
      minValue: 0,
      maxValue: 60,
    });
    let element = draw();
    // RAC: (30 − 0) / 60 → 50 %.
    expect(element.querySelector(".value")?.textContent).toBe("50%");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "50%",
    );
    expect(part("ProgressBarValue")!.props.children).toBe("50%");
    expect(part("ProgressBarFill")!.visual.width).toBe("50%");
    edit({ value: 45 });
    element = draw();
    expect(element.querySelector(".value")?.textContent).toBe("75%");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "75%",
    );
    expect(part("ProgressBarValue")!.props.children).toBe("75%");
    expect(part("ProgressBarFill")!.visual.width).toBe("75%");
    // (The Canvas lays the fill out at that width of its track.)
    const geometry = root.getGeometry([
      part("ProgressBarTrack")!.id,
      part("ProgressBarFill")!.id,
    ]);
    const track = geometry.get(part("ProgressBarTrack")!.id)!;
    const fill = geometry.get(part("ProgressBarFill")!.id)!;
    expect(fill.width).toBeCloseTo(track.width * 0.75, 1);
    expect(fill.height).toBe(track.height);
  });

  it("the Preview's run value (a runtime override of the ProgressBar only) reaches the bound parts — RAC's render props", async () => {
    const { root, bar } = await open({ label: "Loading", value: 30 });
    const owner = bar().id;
    // (A capability or rule writes the bar's value at run time — never its parts, never the document.)
    const runtime = {
      revisionOf: () => 0,
      handlersOf: () => ({}),
      overrideOf: (id: string) => (id === owner ? { value: 80 } : undefined),
      subscribe: () => () => {},
    };
    const view = render(renderCatalogDom(root, owner, { runtime }));
    cleanups.push(() => view.unmount());
    const element = view.container.firstElementChild as HTMLElement;
    expect(element.getAttribute("aria-valuenow")).toBe("80");
    expect(element.querySelector(".value")?.textContent).toBe("80%");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "80%",
    );
  });

  it("valueLabel is RAC's value text; showValueLabel false hides it on both", async () => {
    const { part, draw, edit } = await open({
      label: "Upload",
      value: 60,
      valueLabel: "2.4 MB · 60%",
    });
    expect(draw().querySelector(".value")?.textContent).toBe("2.4 MB · 60%");
    expect(part("ProgressBarValue")!.props.children).toBe("2.4 MB · 60%");
    edit({ showValueLabel: false });
    expect(draw().querySelector(".value")).toBeNull();
    expect(part("ProgressBarValue")!.hidden).toBe(true);
  });

  it("indeterminate: no value text, no fill width — the sheet's moving bar · the Canvas still bar", async () => {
    const { root, part, draw } = await open({
      label: "Loading",
      value: 30,
      isIndeterminate: true,
    });
    const element = draw();
    expect(element.getAttribute("data-indeterminate")).toBe("true");
    expect(element.querySelector(".value")?.textContent).toBe("");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "",
    );
    expect(part("ProgressBarFill")!.visual.width).toBeUndefined();
    const geometry = root.getGeometry([
      part("ProgressBarTrack")!.id,
      part("ProgressBarFill")!.id,
    ]);
    const track = geometry.get(part("ProgressBarTrack")!.id)!;
    const fill = geometry.get(part("ProgressBarFill")!.id)!;
    expect(fill.x - track.x).toBeCloseTo(track.width * 0.2, 1);
    expect(fill.width).toBeCloseTo(track.width * 0.3, 1);
  });

  it("the fill paints the ProgressBar's variant (Canvas) — the sheet's --fill-color (DOM)", async () => {
    const { root, part, draw } = await open({
      label: "Loading",
      value: 50,
      variant: "neutral",
    });
    expect(draw().getAttribute("data-variant")).toBe("neutral");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const fill = getSkiaNode(part("ProgressBarFill")!.id)?.box?.fillColor;
    const track = getSkiaNode(part("ProgressBarTrack")!.id)?.box?.fillColor;
    expect(fill).toBeDefined();
    expect(track).toBeDefined();
    // neutral: the fill is the subdued text color, the track the subtle wash — not the accent.
    expect(Array.from(fill!)).not.toEqual(Array.from(track!));
    const accent = await open({ label: "Loading", value: 50 });
    const accentCanvas = bindCatalogCanvas(
      accent.root,
      accent.root.pageRootRecords(),
    );
    cleanups.push(() => accentCanvas.dispose());
    const accentFill = getSkiaNode(accent.part("ProgressBarFill")!.id)?.box
      ?.fillColor;
    expect(Array.from(accentFill!)).not.toEqual(Array.from(fill!));
  });

  it("a free child the author puts in is drawn in its place", async () => {
    const { workspace, root, bar, draw } = await open({
      label: "Loading",
      value: 50,
    });
    const text = "project:node:note" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BAR },
        entries: [
          {
            kind: "node",
            id: text,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: set("of 4 files") },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [text],
        newId: workspace.newId,
      }),
    );
    expect(draw().textContent).toContain("of 4 files");
    const note = [...root.domInputs.values()].find(
      (record) => record.sourceId === text,
    )!;
    expect(note.parentId).toBe(bar().id);
    expect(root.getGeometry([note.id]).get(note.id)!.width).toBeGreaterThan(0);
  });
});

describe("ADR-256 Phase 7b — Meter draws its node tree", () => {
  it("has the reference structure: Meter > Label + span.value {valueText} + div.track > div.fill (Decision 11)", async () => {
    const { root, bar } = await open({ label: "Storage", value: 75 }, "meter");
    const actual = renderToStaticMarkup(renderCatalogDom(root, bar().id));
    // react-aria.adobe.com Meter (the ProgressBar example's anatomy — Meter gives the same values).
    const reference = renderToStaticMarkup(
      createElement(Meter, {
        value: 75,
        children: ({ percentage, valueText }) => [
          createElement(Label, { key: "l" }, "Storage"),
          createElement("span", { key: "v", className: "value" }, valueText),
          createElement(
            "div",
            { key: "t", className: "track inset" },
            createElement("div", {
              className: "fill",
              style: { width: `${percentage}%` },
            }),
          ),
        ],
      }),
    );
    expect(structure(actual)).toBe(structure(reference));
  });

  it("the value text and the fill width follow the value on both consumers", async () => {
    const { root, part, draw, edit } = await open(
      { label: "Storage", value: 75 },
      "meter",
    );
    expect(draw().querySelector(".value")?.textContent).toBe("75%");
    expect(part("MeterValue")!.props.children).toBe("75%");
    edit({ value: 20, maxValue: 40 });
    const element = draw();
    expect(element.querySelector(".value")?.textContent).toBe("50%");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "50%",
    );
    expect(part("MeterValue")!.props.children).toBe("50%");
    const geometry = root.getGeometry([
      part("MeterTrack")!.id,
      part("MeterFill")!.id,
    ]);
    expect(geometry.get(part("MeterFill")!.id)!.width).toBeCloseTo(
      geometry.get(part("MeterTrack")!.id)!.width * 0.5,
      1,
    );
  });

  it("the Preview's run value (a runtime override of the Meter only) reaches the bound parts", async () => {
    const { root, bar } = await open({ label: "Storage", value: 75 }, "meter");
    const owner = bar().id;
    const runtime = {
      revisionOf: () => 0,
      handlersOf: () => ({}),
      overrideOf: (id: string) => (id === owner ? { value: 10 } : undefined),
      subscribe: () => () => {},
    };
    const view = render(renderCatalogDom(root, owner, { runtime }));
    cleanups.push(() => view.unmount());
    const element = view.container.firstElementChild as HTMLElement;
    expect(element.querySelector(".value")?.textContent).toBe("10%");
    expect((element.querySelector(".fill") as HTMLElement).style.width).toBe(
      "10%",
    );
  });

  it("the fill paints the Meter's variant: four colors, none the track's", async () => {
    const colors: string[] = [];
    // (S2 값 정렬 2026-10-10: warning → notice, critical → negative.)
    for (const variant of ["informative", "positive", "notice", "negative"]) {
      const { root, part, draw } = await open(
        { label: "Storage", value: 50, variant },
        "meter",
      );
      expect(draw().getAttribute("data-variant")).toBe(variant);
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      cleanups.push(() => canvas.dispose());
      const fill = getSkiaNode(part("MeterFill")!.id)?.box?.fillColor;
      const track = getSkiaNode(part("MeterTrack")!.id)?.box?.fillColor;
      expect(Array.from(fill!)).not.toEqual(Array.from(track!));
      colors.push(Array.from(fill!).join(","));
    }
    expect(new Set(colors).size).toBe(4);
  });
});

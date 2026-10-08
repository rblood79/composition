// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Label,
  Slider,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
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
 * ADR-256 Phase 7c (G2) — a Slider draws its node tree, the reference `Slider > Label + SliderOutput +
 * SliderTrack > SliderFill + SliderThumb` (react-aria.adobe.com Slider — G0 example 12; the
 * example's styling wrapper `div.track` around the fill is the author's frame to add — collapsed in
 * the comparison, as G0 ⑨ fixed the anatomy). RAC places the fill and the thumb from the Slider's
 * value and writes the output's text; the Canvas places · writes them from the Slider's record.
 */
const BODY = "project:node:home-body" as NodeId;
const BAR = "project:node:bar" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(props: Record<string, unknown>, origin = "slider") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-slider" as EntryId<"project">,
        name: "Slider",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-slider-${Math.random()}`),
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
  for (const track of [...host.querySelectorAll("div.track")])
    track.replaceWith(...track.childNodes);
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


const fillOf = (element: HTMLElement) =>
  element.querySelector(".react-aria-SliderFill") as HTMLElement;
const thumbOf = (element: HTMLElement) =>
  element.querySelector(".react-aria-SliderThumb") as HTMLElement;

describe("ADR-256 Phase 7c — Slider draws its node tree", () => {
  it("has the reference example's structure (Decision 11)", async () => {
    const { root, bar } = await open({ label: "Volume", value: 30 });
    const actual = renderToStaticMarkup(renderCatalogDom(root, bar().id));
    // react-aria.adobe.com Slider (G0 example 12).
    const reference = renderToStaticMarkup(
      createElement(
        Slider,
        { defaultValue: 30, minValue: 0, maxValue: 100, step: 1 },
        createElement(Label, null, "Volume"),
        createElement(SliderOutput),
        createElement(SliderTrack, {
          children: () => [
            createElement(
              "div",
              { key: "t", className: "track inset" },
              createElement(SliderFill),
            ),
            createElement(SliderThumb, { key: "0", index: 0 }),
          ],
        }),
      ),
    );
    expect(structure(actual)).toBe(structure(reference));
  });

  it("RAC places the fill and the thumb and writes the value; the Canvas the same from the record", async () => {
    const { root, part, draw, edit } = await open({ label: "Volume", value: 30 });
    let element = draw();
    expect(element.querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "30",
    );
    expect(fillOf(element).style.width).toBe("30%");
    expect(thumbOf(element).style.left).toBe("30%");
    expect(part("SliderOutput")!.props.children).toBe("30");
    const box = () => {
      const ids = ["SliderTrack", "SliderFill", "SliderThumb"].map(
        (type) => part(type)!.id,
      );
      const geometry = root.getGeometry(ids);
      return ids.map((id) => geometry.get(id)!);
    };
    let [track, fill, thumb] = box();
    expect(fill.width).toBeCloseTo(track.width * 0.3, 1);
    expect(fill.height).toBe(track.height);
    expect(thumb.x + thumb.width / 2).toBeCloseTo(track.x + track.width * 0.3, 1);
    edit({ value: 70 });
    element = draw();
    expect(element.querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "70",
    );
    expect(fillOf(element).style.width).toBe("70%");
    expect(part("SliderOutput")!.props.children).toBe("70");
    [track, fill, thumb] = box();
    expect(fill.width).toBeCloseTo(track.width * 0.7, 1);
    expect(thumb.x + thumb.width / 2).toBeCloseTo(track.x + track.width * 0.7, 1);
  });

  it("a mounted Preview follows a document value edit (RAC's value is its run state — it starts again)", async () => {
    const { root, bar, edit } = await open({ label: "Volume", value: 30 });
    const view = render(renderCatalogDom(root, bar().id));
    cleanups.push(() => view.unmount());
    act(() => {
      edit({ value: 60 });
    });
    const element = view.container.firstElementChild as HTMLElement;
    expect(element.querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "60",
    );
    expect(fillOf(element).style.width).toBe("60%");
  });

  it("the Canvas draws the track bar, the fill and the thumb from their own rules", async () => {
    const { root, part } = await open({ label: "Volume", value: 50 });
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const color = (type: string) =>
      Array.from(getSkiaNode(part(type)!.id)?.box?.fillColor ?? []).join(",");
    expect(color("SliderTrack")).not.toBe("");
    expect(color("SliderFill")).not.toBe(color("SliderTrack"));
    // The thumb draws its handle in its own box: the fill's accent circle with the 2px ring.
    const handle = getSkiaNode(part("SliderThumb")!.id)?.children?.[0]?.box;
    expect(Array.from(handle?.fillColor ?? []).join(",")).toBe(
      color("SliderFill"),
    );
    expect(handle?.strokeWidth).toBe(2);
  });

  it("the Preview's run value (a runtime override of the Slider only) reaches RAC's parts", async () => {
    const { root, bar } = await open({ label: "Volume", value: 30 });
    const owner = bar().id;
    const runtime = {
      revisionOf: () => 0,
      handlersOf: () => ({}),
      overrideOf: (id: string) => (id === owner ? { value: 80 } : undefined),
      subscribe: () => () => {},
    };
    const view = render(renderCatalogDom(root, owner, { runtime }));
    cleanups.push(() => view.unmount());
    const element = view.container.firstElementChild as HTMLElement;
    expect(element.querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "80",
    );
    expect(fillOf(element).style.width).toBe("80%");
  });

  it("an output text of the author's own stands; showValueLabel false hides the output on both", async () => {
    const { workspace, root, part, draw, edit } = await open({
      label: "Volume",
      value: 30,
    });
    const output = part("SliderOutput")!;
    const address = workspace.positionOfRecord(output.id)!.target;
    workspace.execute(
      setFields({
        targets: [address],
        props: { children: set("loud") },
      } as Parameters<typeof setFields>[0]),
    );
    expect(draw().querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "loud",
    );
    expect(part("SliderOutput")!.props.children).toBe("loud");
    edit({ showValueLabel: false });
    expect(draw().querySelector(".react-aria-SliderOutput")).toBeNull();
    expect(part("SliderOutput")!.hidden).toBe(true);
    void root;
  });
});

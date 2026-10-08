// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  detachInstances,
  groupNodes,
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
import { CatalogCompositionRoot } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 7 판독 (Round 16) — 값 바인딩 노드 트리의 편집 4건:
 * H1 편집한 노드가 옛 `valueTemplate` 을 들고 있어 작성한 글자를 덮음 · M1 frame 안 SliderFill /
 * SliderTrack 의 Canvas 배치 · M2 변수 갱신이 값 바인딩 자식에 닿지 않음 · M3 값이 채운 글자의
 * `presentWhen` 을 다시 판정하지 않음.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:owner" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as NodeEntry;

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(
  type: string,
  props: Record<string, unknown>,
  options: { detach?: boolean } = {},
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p7-review" as EntryId<"project">,
        name: "Phase 7 review",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p7-review-${Math.random()}`),
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
        node(OWNER, `lib:definition:origin-component-${type}`, {
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ) as never,
        }),
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  if (options.detach)
    workspace.execute(
      detachInstances({ ids: [OWNER], newId: workspace.newId }),
    );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const owner = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === OWNER)!;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    )!;
  const edit = (target: NodeId, patch: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: target }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  const draw = () => {
    const view = render(renderCatalogDom(root, owner().id));
    cleanups.push(() => view.unmount());
    return view.container.firstElementChild as HTMLElement;
  };
  const frame = (name: string) =>
    workspace.execute(
      groupNodes({
        ids: [part(name).sourceId as NodeId],
        group: node(
          workspace.newId("node") as string,
          "lib:definition:type-frame",
        ),
        newId: workspace.newId,
      }),
    );
  return { workspace, root, owner, part, edit, draw, frame };
}

describe("ADR-256 Phase 7 판독 — 값 바인딩 노드 트리 편집", () => {
  it.each([
    ["progressbar", "ProgressBarValue", ".value", "30%", "70%"],
    ["meter", "MeterValue", ".value", "30%", "70%"],
  ])(
    "H1 %s: an authored text replacing the value binding stands on both consumers, through an owner edit",
    async (type, valueType, selector) => {
      const { part, edit, draw } = await open(
        type,
        { label: "Load", value: 30 },
        { detach: true },
      );
      edit(part(valueType).sourceId as NodeId, { children: "custom" });
      expect(part(valueType).props.children).toBe("custom");
      expect(draw().querySelector(selector)?.textContent).toBe("custom");
      edit(OWNER, { value: 70 });
      expect(part(valueType).props.children).toBe("custom");
      expect(draw().querySelector(selector)?.textContent).toBe("custom");
    },
  );

  it("H1 slider: an authored output text stands on both consumers, through a value edit", async () => {
    const { part, edit, draw } = await open(
      "slider",
      { label: "Volume", value: 30 },
      { detach: true },
    );
    edit(part("SliderOutput").sourceId as NodeId, { children: "custom" });
    expect(part("SliderOutput").props.children).toBe("custom");
    expect(draw().querySelector(".react-aria-SliderOutput")?.textContent).toBe(
      "custom",
    );
    edit(OWNER, { value: 70 });
    expect(part("SliderOutput").props.children).toBe("custom");
  });

  it("H1: a binding newly written on a detached part reads the owner's value", async () => {
    const { part, edit, draw } = await open(
      "progressbar",
      { label: "Load", value: 30 },
      { detach: true },
    );
    edit(part("Label").sourceId as NodeId, { children: "Now {valueText}" });
    expect(part("Label").props.children).toBe("Now 30%");
    expect(draw().querySelector(".react-aria-Label")?.textContent).toBe(
      "Now 30%",
    );
    edit(OWNER, { value: 70 });
    expect(part("Label").props.children).toBe("Now 70%");
  });

  it("M1: a SliderFill in the reference example's track frame (absolute, the track's size) is placed from the Slider's value", async () => {
    const { workspace, root, part, frame, edit } = await open(
      "slider",
      { label: "Volume", value: 30 },
      { detach: true },
    );
    frame("SliderFill");
    // (react-aria.adobe.com Slider example: `.track { position: absolute }` around the fill — the
    // fill's containing block, here stretched over the track by its insets; a static frame is not
    // one, and the engine places an absolute box in its parent — ADR-164.)
    const track = part("SliderTrack");
    const wrapper = root.canvasInputs.get(track.children[0]!)!;
    expect(root.typeOf(wrapper)).toBe("frame");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: wrapper.sourceId as NodeId }],
        layout: {
          position: set("absolute"),
          insetLeft: set("0px"),
          insetTop: set("0px"),
          insetRight: set("0px"),
          insetBottom: set("0px"),
        },
      }),
    );
    const box = (name: string) =>
      root.getGeometry([part(name).id]).get(part(name).id)!;
    expect(box("SliderFill").width).toBeCloseTo(
      box("SliderTrack").width * 0.3,
      1,
    );
    edit(OWNER, { value: 70 });
    expect(box("SliderFill").width).toBeCloseTo(
      box("SliderTrack").width * 0.7,
      1,
    );
  });

  it("M1: a SliderTrack in a frame keeps its fill and thumb on the Slider's value", async () => {
    const { root, part, frame, edit } = await open(
      "slider",
      { label: "Volume", value: 30 },
      { detach: true },
    );
    frame("SliderTrack");
    const box = (name: string) =>
      root.getGeometry([part(name).id]).get(part(name).id)!;
    expect(box("SliderFill").width).toBeCloseTo(
      box("SliderTrack").width * 0.3,
      1,
    );
    const thumb = box("SliderThumb");
    const track = box("SliderTrack");
    expect(thumb.x + thumb.width / 2).toBeCloseTo(
      track.x + track.width * 0.3,
      1,
    );
    edit(OWNER, { value: 70 });
    expect(box("SliderFill").width).toBeCloseTo(
      box("SliderTrack").width * 0.7,
      1,
    );
  });

  it.each([
    ["progressbar", "ProgressBarValue"],
    ["meter", "MeterValue"],
  ])(
    "M2 %s: a variable refresh of the owner's valueLabel reaches its bound value text",
    async (type, valueType) => {
      const { workspace } = await open(type, {
        label: "Load",
        value: 30,
        valueLabel: "{{ caption }}",
      });
      let caption = "Before";
      const root = new CatalogCompositionRoot(
        workspace.runtime,
        await nodeLayoutEngine(),
        { width: 1200, height: 800 },
        undefined,
        undefined,
        undefined,
        undefined,
        {
          state: {
            projectVariables: () => [
              {
                id: "v1",
                name: "caption",
                type: "string",
                defaultValue: caption,
              },
            ],
          },
        },
      );
      const value = () =>
        [...root.canvasInputs.values()].find(
          (record) => root.typeOf(record) === valueType,
        )!;
      expect(value().props.children).toBe("Before");
      caption = "After";
      root.refreshState(new Set(["caption"]));
      expect(value().props.children).toBe("After");
    },
  );

  it("M2: a part writing both a variable and a value binding keeps the value through a variable refresh", async () => {
    const { workspace, part, edit } = await open(
      "progressbar",
      { label: "Load", value: 30 },
      { detach: true },
    );
    edit(part("Label").sourceId as NodeId, {
      children: "{{ caption }} {valueText}",
    });
    let caption = "Before";
    const root = new CatalogCompositionRoot(
      workspace.runtime,
      await nodeLayoutEngine(),
      { width: 1200, height: 800 },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        state: {
          projectVariables: () => [
            { id: "v1", name: "caption", type: "string", defaultValue: caption },
          ],
        },
      },
    );
    const label = () =>
      [...root.canvasInputs.values()].find(
        (record) => root.typeOf(record) === "Label",
      )!;
    expect(label().props.children).toBe("Before 30%");
    caption = "After";
    root.refreshState(new Set(["caption"]));
    expect(label().props.children).toBe("After 30%");
  });

  it("M3: a Label whose text the owner's value fills shows again when the value comes back", async () => {
    const { part, edit, draw } = await open("progressbar", {
      label: "{valueText}",
      value: 30,
      isIndeterminate: true,
    });
    expect(part("Label").hidden).toBe(true);
    edit(OWNER, { isIndeterminate: false });
    expect(part("Label").props.children).toBe("30%");
    expect(part("Label").hidden).toBeUndefined();
    expect(draw().querySelector(".react-aria-Label")?.textContent).toBe("30%");
  });
});

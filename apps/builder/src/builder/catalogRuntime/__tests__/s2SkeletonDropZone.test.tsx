// @vitest-environment jsdom
/**
 * S2 1.8.0 (2026-10-10 — 조사 §6.1 ③ 개별):
 * - Skeleton (ADR-314 Phase 1, 2026-11-18 — 2026-10-10 의 placeholder leaf 를 대체): S2 처럼
 *   요소 없는 래퍼다. DOM 은 감싼 내용만 내고 (Skeleton 요소 0), Canvas 는 `display: contents` 로
 *   내용을 부모 흐름에 세운다. `isLoading: false` 는 노드를 숨기지 않는다 — 내용이 보통 모양으로
 *   남는다. 놓은 Skeleton 은 비어 있고 (사용자 결정 2 갱신 2026-11-19 — 표본 내용 삭제), 빈
 *   Skeleton 은 Canvas 만 점선 자리 (결정 3) 를 갖는다.
 * - DropZone `isFilled` · `replaceMessage`: 채워진 영역 위로 끌 때 교체 배너
 *   (S2 `renderProps.isDropTarget && props.isFilled`). 배너는 DOM 에 상주하고 RAC 의
 *   `data-drop-target` 시트가 보인다 — Canvas 는 끄는 중 상태를 그리지 않는다.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import {
  catalogPaletteDefinitionId,
  catalogPaletteInsertPlan,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(
  type: string,
  props: Record<string, unknown>,
  definition?: string,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:skeleton-dropzone" as const,
        name: "Skeleton DropZone",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `skeleton-dropzone-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = (definition ??
    catalogPaletteDefinitionId(library, type)) as NodeEntry["definitionId"];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  const skeleton = () =>
    [...root.domInputs.values()].find((item) => item.sourceId === OWNER)!;
  return {
    workspace,
    root,
    record,
    html,
    definitionId,
    skeleton,
    render: () => renderToStaticMarkup(renderCatalogDom(root, skeleton().id)),
  };
}

/** The palette puts `type` inside the selected Skeleton (its origin root is a slot). */
function insideSkeleton(
  opened: Awaited<ReturnType<typeof open>>,
  type: string,
) {
  const { workspace } = opened;
  workspace.selectRecords([opened.skeleton().id]);
  const plan = catalogPaletteInsertPlan(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => workspace.session.getSnapshot().selection,
      itemOfRecord: (identity) => workspace.itemOfRecord(identity),
      pageContent: () => ({
        kind: "node",
        id: "project:node:home-body" as NodeId,
      }),
      newId: workspace.newId,
    },
    type,
  );
  if (!plan.command || plan.relocated) throw new Error(`${type} not inside`);
  workspace.execute(plan.command);
}

describe("S2 Skeleton — an element-less wrapper (ADR-314 Phase 1)", () => {
  it("the Design panel offers Loading (true by default) — no Size, no Data", async () => {
    const { definitionId } = await open("Skeleton", {});
    const contracts = catalogSemanticContracts(definitionId, "Skeleton");
    expect(contracts.isLoading).toMatchObject({ kind: "boolean", default: true });
    expect(contracts.size).toBeUndefined();
    // (2026-11-19 사용자 결정: it follows the load of the content bound inside it.)
    expect(contracts.dataBinding).toBeUndefined();
  });

  it("placed: empty — no element and no content in the DOM, the Canvas's 48px spot (결정 2 · 3)", async () => {
    // (2026-11-19 사용자 결정 — the S2 example sample (frame > Image + title · body Text) is gone: a
    //  Skeleton wraps the author's real content, and the sample had to be deleted every time.)
    const { root, record, html } = await open("Skeleton", {});
    expect(record.hidden).not.toBe(true);
    expect(record.children).toEqual([]);
    expect(html).toBe("");
    expect(root.getGeometry([record.id]).get(record.id)!.height).toBe(48);
  });

  it("no element of its own — the DOM is the content put inside", async () => {
    const opened = await open("Skeleton", {});
    insideSkeleton(opened, "Text");
    const html = opened.render();
    expect(html).not.toContain("react-aria-Skeleton");
    expect(html).not.toContain('role="status"');
    expect(html).toContain(">Text<");
  });

  it("isLoading false keeps the content (the content is not a hidden box)", async () => {
    const opened = await open("Skeleton", { isLoading: false });
    insideSkeleton(opened, "Text");
    expect(opened.skeleton().hidden).not.toBe(true);
    expect(opened.render()).toContain(">Text<");
  });

  it("the Canvas lays its content out in its parent's flow (its box = the content's)", async () => {
    const opened = await open("Skeleton", {});
    insideSkeleton(opened, "Image");
    const record = opened.skeleton();
    const [contentId] = record.children;
    const geometry = opened.root.getGeometry([record.id, contentId]);
    expect(geometry.get(record.id)).toEqual(geometry.get(contentId));
    expect(geometry.get(contentId)!.height).toBeGreaterThan(0);
  });

  it("toggling isLoading after insert keeps the record drawn (live path)", async () => {
    const { workspace, root } = await open("Skeleton", {});
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { isLoading: { kind: "set", value: false } },
      }),
    );
    const record = [...root.domInputs.values()].find(
      (item) => item.sourceId === OWNER,
    )!;
    expect(record.hidden).not.toBe(true);
  });

  it("the palette puts content inside a selected Skeleton (its origin root is a slot — no relocation)", async () => {
    const { workspace, root, record } = await open("Skeleton", {});
    workspace.selectRecords([record.id]);
    const plan = catalogPaletteInsertPlan(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => workspace.session.getSnapshot().selection,
        itemOfRecord: (identity) => workspace.itemOfRecord(identity),
        pageContent: () => ({
          kind: "node",
          id: "project:node:home-body" as NodeId,
        }),
        newId: workspace.newId,
      },
      "Badge",
    );
    if (!plan.command) throw new Error("the insert was refused everywhere");
    expect(plan.relocated).toBeUndefined();
    workspace.execute(plan.command);
    const skeleton = [...root.domInputs.values()].find(
      (item) => item.sourceId === OWNER,
    )!;
    expect(
      skeleton.children.some(
        (child) => root.typeOf(root.domInputs.get(child)!) === "Badge",
      ),
    ).toBe(true);
  });

  it("empty: nothing in the DOM, an edit-only 48px placeholder on the Canvas (결정 3)", async () => {
    const { root, record, html } = await open(
      "Skeleton",
      {},
      "lib:definition:type-Skeleton",
    );
    expect(record.children).toEqual([]);
    expect(html).toBe("");
    const rect = root.getGeometry([record.id]).get(record.id)!;
    expect(rect.height).toBe(48);
    expect(rect.width).toBeGreaterThan(0);
  });
});

describe("S2 DropZone isFilled · replaceMessage", () => {
  it("the Design panel offers Filled and Replace Message", async () => {
    const { definitionId } = await open("DropZone", {});
    const contracts = catalogSemanticContracts(definitionId, "DropZone");
    expect(contracts.isFilled).toMatchObject({ kind: "boolean" });
    expect(contracts.replaceMessage).toMatchObject({ kind: "string" });
  });

  it("isFilled: the replace banner is in the DOM (its own message)", async () => {
    const { html } = await open("DropZone", {
      label: "Drop files here",
      isFilled: true,
      replaceMessage: "Drop to swap",
    });
    expect(html).toContain("dropzone-replace");
    expect(html).toContain("Drop to swap");
  });

  it("isFilled without a message: the default replace text", async () => {
    const { html } = await open("DropZone", { isFilled: true });
    expect(html).toContain("dropzone-replace");
    expect(html).toContain("Drop file to replace");
  });

  it("the generated sheet shows the banner only while a drag is over the zone", () => {
    const sheet = readFileSync(
      join(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/generated/DropZone.css",
      ),
      "utf8",
    );
    expect(sheet).toMatch(
      /\.react-aria-DropZone\[data-drop-target\] \.dropzone-replace \{/,
    );
    expect(sheet).toMatch(
      /\.react-aria-DropZone \.dropzone-replace \{\s*display: none;/,
    );
  });

  it("default: no banner element", async () => {
    const { html } = await open("DropZone", {});
    expect(html).not.toContain("dropzone-replace");
  });
});

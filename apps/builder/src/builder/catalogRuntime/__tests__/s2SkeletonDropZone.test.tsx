// @vitest-environment jsdom
/**
 * S2 1.8.0 (2026-10-10 — 조사 §6.1 ③ 개별):
 * - Skeleton `isLoading`: 로딩이 끝나면 (false) placeholder 가 양 consumer 에서 사라진다
 *   (S2 Skeleton 은 isLoading 일 때만 children 을 skeleton 으로 그린다; 우리 Skeleton 은
 *   placeholder leaf — false = 그릴 것이 없음). 기본 true (지금까지의 모양).
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
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(type: string, props: Record<string, unknown>) {
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
  const definitionId = catalogPaletteDefinitionId(library, type);
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
  return { workspace, root, record, html, definitionId };
}

describe("S2 Skeleton isLoading", () => {
  it("the Design panel offers Loading (true by default — the placeholder before)", async () => {
    const { definitionId } = await open("Skeleton", {});
    expect(
      catalogSemanticContracts(definitionId, "Skeleton").isLoading,
    ).toMatchObject({ kind: "boolean", default: true });
  });

  it("default: the placeholder is there in both consumers", async () => {
    const { record, html } = await open("Skeleton", {});
    expect(record.hidden).not.toBe(true);
    expect(html).toContain("react-aria-Skeleton");
  });

  it("isLoading false: the placeholder is not there in both consumers", async () => {
    const { record, html } = await open("Skeleton", { isLoading: false });
    expect(record.hidden).toBe(true);
    expect(html).not.toContain("react-aria-Skeleton");
  });

  it("toggling isLoading after insert re-judges the record (live path)", async () => {
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
    expect(record.hidden).toBe(true);
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

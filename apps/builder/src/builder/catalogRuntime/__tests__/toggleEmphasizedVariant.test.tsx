// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「Checkbox · Switch variant ↔ isEmphasized 진행해」): DOM 의 `data-emphasized`
 * 가 받지 않는 prop 을 읽어 Canvas(accent) ↔ Preview(neutral) 로 갈리던 결함의 회귀 가드.
 * 2026-10-10 S2 강조 축 전환 뒤 공개 prop 은 `isEmphasized` 이고 `variant` 는 resolver 가
 * 파생하는 내부 운반 값 — 저장된 옛 `variant` 는 로드 시 1회 전환되므로, 이 가드는 새 표면이
 * 두 consumer 에 같은 축으로 닿는지를 지킨다 (`s2EmphasisToggle.test.tsx` 가 전환 자체를 본다).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function rootHtml(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toggle-emph" as EntryId<"project">,
        name: "Toggle emphasized",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toggle-emph-${Math.random()}`),
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
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
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
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const node = [...root.domInputs.values()].find(
    (r) => root.typeOf(r) === type,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, node.id));
  return /^<[a-z]+[^>]*>/.exec(html)![0];
}

describe("Checkbox · Switch — the DOM's emphasis is the `isEmphasized` they accept", () => {
  it.each(["Checkbox", "Switch"])(
    "%s isEmphasized → data-emphasized; off → none",
    async (type) => {
      expect(await rootHtml(type, { isEmphasized: true })).toContain(
        "data-emphasized",
      );
      expect(await rootHtml(type, { isEmphasized: false })).not.toContain(
        "data-emphasized",
      );
      expect(await rootHtml(type, {})).not.toContain("data-emphasized");
    },
  );
});

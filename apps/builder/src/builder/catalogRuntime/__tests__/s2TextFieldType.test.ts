import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { textFieldBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  CatalogGraph,
  createCatalogGraph,
} from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 1.8.0 TextField `type` (사용자 결정 2026-10-13 「1번」): S2 의 값은 `@react-types/shared`
 * `type?: 'text' | 'search' | 'url' | 'tel' | 'email' | 'password'` — 숫자 입력은 NumberField 가
 * 맡는다 (지역 표기 · 증감 · 형식). `number` 는 선택지에서 빠지고, 옛 문서의 `type: "number"` 는
 * 로드할 때 한 번 지워진다 (기본 `text`).
 */
const OWNER = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-textfield-type" as const,
        name: "TextField type",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-textfield-type-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return { library, workspace };
}

describe("S2 TextField type", () => {
  it("the options are S2's — no number", () => {
    const type = textFieldBinding.props.accepts.type;
    expect(
      type?.kind === "enum" ? type.options?.map((o) => o.value) : [],
    ).toEqual(["text", "email", "password", "search", "tel", "url"]);
  });

  it("load migration: an old TextField's type number is dropped once, the other values stay", async () => {
    const { library, workspace } = await open("TextField");
    const entries = JSON.parse(
      JSON.stringify(workspace.root.runtime.graph.exportDocument().entries),
    ) as Record<string, CatalogEntry>;
    type Writes = Record<string, { kind: string; value?: unknown }>;
    const owner = entries[OWNER] as NodeEntry & { props: Writes };
    owner.props.type = set("number");
    owner.props.placeholder = set("Age");
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    expect(owner.props.type).toBeUndefined();
    expect(owner.props.placeholder).toEqual(set("Age"));

    owner.props.type = set("email");
    migrateCatalogEntriesS2(entries, library);
    expect(owner.props.type).toEqual(set("email"));
  });

  it("a document already in S2 form is not touched — a frozen export reopens (Publish)", async () => {
    // (Publish opens the exported document — its entries are the graph's frozen records. The
    //  migration deleted and rewrote an unchanged `type: "email"`, and the reopen threw.)
    const { library, workspace } = await open("TextField");
    const graph = workspace.root.runtime.graph;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { type: set("email") },
      }),
    );
    const exported = graph.exportDocument();
    expect(Object.isFrozen(exported.entries[OWNER])).toBe(true);
    const plain = JSON.parse(JSON.stringify(exported.entries)) as Record<
      string,
      CatalogEntry
    >;
    expect(migrateCatalogEntriesS2(plain, library)).toBe(false);
    const reopened = createCatalogGraph(exported, library);
    expect(
      (reopened.getEntry(OWNER) as NodeEntry).props.type,
    ).toEqual(set("email"));
  });
});

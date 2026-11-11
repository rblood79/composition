import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as contracts from "../../../../../../packages/shared/src/catalog/document/library";
import * as validation from "../../../../../../packages/shared/src/catalog/document/validation";
import { createCatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  EntryKind,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogRuntime } from "../controller";
import { createCatalogProject } from "../project";
import { CatalogStorage } from "../storage";

vi.mock(
  "../../../../../../packages/shared/src/catalog/document/validation",
  async (importOriginal) => {
    const actual = await importOriginal<typeof validation>();
    return {
      ...actual,
      validateCatalogDocument: vi.fn(actual.validateCatalogDocument),
      validateCatalogEntry: vi.fn(actual.validateCatalogEntry),
    };
  },
);

vi.mock(
  "../../../../../../packages/shared/src/catalog/document/library",
  async (importOriginal) => {
    const actual = await importOriginal<typeof contracts>();
    return { ...actual, instanceContract: vi.fn(actual.instanceContract) };
  },
);

/**
 * ADR-307 후속 — 문서 읽기의 page 당 비용. 저장소에서 연 문서는 entry 마다 형식 검사를 한 번,
 * 복제는 0 번 한다 (읽은 entry 는 graph 만 쥐므로 제자리에서 굳힌다).
 */
const HOME = "project:page:home" as EntryId<"page">;
const text = (name: string) =>
  ({
    kind: "node",
    id: `project:node:${name}`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value: name } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

let library: CatalogLibrary | undefined;
async function storedProject() {
  library ??= await buildCodeCatalogLibrary();
  const name = `adr307-open-checks-${Math.random()}`;
  const storage = new CatalogStorage(indexedDB, name);
  const graph = await createCatalogProject(storage, library, {
    projectId: "project:project:alpha" as EntryId<"project">,
    name: "Alpha",
  });
  const runtime = new CatalogRuntime(graph, storage);
  let next = 0;
  const newId = <K extends EntryKind>(kind: K) =>
    `project:${kind}:s${++next}` as EntryId<K>;
  for (const id of ["a", "b", "c"]) {
    const plan = insertNodes({
      parent: { kind: "page", id: HOME },
      entries: [text(id)],
      rootIds: [`project:node:${id}` as NodeEntry["id"]],
      newId,
    })(runtime.graph);
    runtime.dispatch(plan.label, plan.ops);
  }
  await runtime.save();
  return { name, runtime };
}

/** Entries checked = each whole-document check × entry count + each single-entry check. */
function entryChecks(entryCount: number): number {
  return (
    vi.mocked(validation.validateCatalogDocument).mock.calls.length *
      entryCount +
    vi.mocked(validation.validateCatalogEntry).mock.calls.length
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ADR-307 후속 — 저장소에서 연 문서의 검사 · 복제 수", () => {
  it("entry 마다 형식 검사 1 번 · 복제 0 번, 열린 graph 는 저장한 문서와 같다", async () => {
    const { name, runtime } = await storedProject();
    const saved = runtime.graph.exportDocument();
    const entryCount = Object.keys(saved.entries).length;
    vi.mocked(validation.validateCatalogDocument).mockClear();
    vi.mocked(validation.validateCatalogEntry).mockClear();
    const clone = vi.spyOn(globalThis, "structuredClone");

    const opened = await new CatalogStorage(indexedDB, name).loadGraph(
      saved.projectId,
      library!,
    );

    expect(entryChecks(entryCount)).toBe(entryCount);
    // (fake-indexeddb clones its stored rows on read — count the catalog entries' copies only.)
    const entryCopies = clone.mock.calls.filter(
      ([value]) => !!value && typeof value === "object" && "kind" in value,
    );
    expect(entryCopies).toHaveLength(0);
    expect(opened.exportDocument()).toEqual(saved);
    for (const entry of Object.values(opened.exportDocument().entries)) {
      expect(Object.isFrozen(entry)).toBe(true);
      if (entry.kind === "node")
        expect(Object.isFrozen(entry.props)).toBe(true);
    }
  });

  it("같은 정의의 계약은 한 번 계산하며 뒤 instance의 잘못된 값도 거부한다", async () => {
    const { name, runtime } = await storedProject();
    vi.mocked(contracts.instanceContract).mockClear();
    await new CatalogStorage(indexedDB, name).loadGraph(
      runtime.graph.projectId,
      library!,
    );
    const textContracts = vi
      .mocked(contracts.instanceContract)
      .mock.calls.filter(
        ([definition]) =>
          definition === library!.definitions.get("lib:definition:text"),
      );
    expect(textContracts).toHaveLength(1);

    vi.mocked(contracts.instanceContract).mockClear();
    await new CatalogStorage(indexedDB, name).loadGraph(
      runtime.graph.projectId,
      library!,
    );
    expect(
      vi.mocked(contracts.instanceContract).mock.calls.length,
    ).toBeGreaterThan(0);

    const document = structuredClone(runtime.graph.exportDocument());
    (document.entries["project:node:c"] as NodeEntry).props = {
      children: { kind: "set", value: false },
    };
    expect(() => createCatalogGraph(document, library!)).toThrow(
      expect.objectContaining({ code: "PROP_TYPE_MISMATCH" }),
    );
  });

  it("다른 길 (import · preview) 은 넘긴 문서를 복제하고 굳히지 않으며 검사는 entry 마다 1 번", async () => {
    const { runtime } = await storedProject();
    const document = JSON.parse(
      JSON.stringify(runtime.graph.exportDocument()),
    ) as ReturnType<typeof runtime.graph.exportDocument>;
    const entryCount = Object.keys(document.entries).length;
    vi.mocked(validation.validateCatalogDocument).mockClear();
    vi.mocked(validation.validateCatalogEntry).mockClear();

    const graph = createCatalogGraph(document, library!);

    expect(entryChecks(entryCount)).toBe(entryCount);
    for (const entry of Object.values(document.entries))
      expect(Object.isFrozen(entry)).toBe(false);
    expect(graph.exportDocument()).toEqual(document);
  });

  it("형식이 틀린 entry 는 여전히 거부한다", async () => {
    const { runtime } = await storedProject();
    const document = JSON.parse(
      JSON.stringify(runtime.graph.exportDocument()),
    ) as { entries: Record<string, Record<string, unknown>> };
    document.entries["project:node:a"]!.children = "not-a-list";
    expect(() => createCatalogGraph(document, library!)).toThrow(
      validation.CatalogValidationError,
    );
  });
});

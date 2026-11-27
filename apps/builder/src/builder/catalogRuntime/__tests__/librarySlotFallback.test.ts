import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { preloadChartFamilies } from "./support/chartFamilies";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogSlotMarks } from "../../workspace/canvas/catalog/catalogChrome";
import { COMPONENTS_VIEW, originSampleId } from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

beforeAll(preloadChartFamilies);

const lib = (name: string) =>
  `lib:definition:origin-component-${name}` as LibraryDefinitionId;

/**
 * A Library ◆ card shows its declared slots empty and hatched (pen.dev: a master's slots) — but a
 * slot that draws its own content when it holds nothing is not an empty place (user 2026-11-27
 * 「1번으로 진행」): a Select's value slot (S2 `renderValue`, `a581078d3`) shows the placeholder
 * when no value shape is written. **Why**: it was hatched and boxed 160 × 40 over the placeholder.
 */
describe("Library card — a slot with fallback content is not hatched", () => {
  it("draws a Select origin's placeholder without a slot box or hatch; a Tabs origin stays hatched", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:slot-fallback" as EntryId<"project">,
          name: "Slot fallback",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `slot-fallback-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    workspace.showDefinition(COMPONENTS_VIEW);
    const root = workspace.root;
    const inputOf = (record: string) => root.canvasInputs.get(record)!;
    const subtree = (record: string): string[] => [
      record,
      ...inputOf(record).children.flatMap(subtree),
    ];
    const sampleRecord = (name: string) =>
      root.recordsOfSource(originSampleId(lib(name)))[0]!;
    const bounds = new Map(
      [...root.canvasInputs.keys()].flatMap((record) => {
        const rect = root.getGeometry([record]).get(record);
        return rect ? [[record, rect] as const] : [];
      }),
    );
    const marked = new Set(
      catalogSlotMarks(workspace, bounds, bounds).map((mark) => mark.identity),
    );

    const select = subtree(sampleRecord("select"));
    const value = select.find(
      (record) => inputOf(record).slot?.name === "value",
    )!;
    expect(value).toBeDefined();
    // (It draws its placeholder: its own text, no slot contents.)
    expect(inputOf(value).props.children).toEqual(expect.any(String));
    expect(inputOf(value).children).toEqual([]);
    expect(select.filter((record) => marked.has(record))).toEqual([]);
    // (No 160 × 40 slot box: the box is the placeholder's.)
    expect(inputOf(value).visual.width).toBeUndefined();
    expect(inputOf(value).visual.minHeight).toBeUndefined();
    // (A slot with no content of its own is still hatched — the control.)
    expect(marked.has(sampleRecord("tabs"))).toBe(true);
    workspace.dispose();
  }, 60_000);
});

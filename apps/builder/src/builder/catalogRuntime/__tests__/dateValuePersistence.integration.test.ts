import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  dateValueFromNativeInput,
  nativeDateInputOf,
} from "../../../../../../packages/shared/src/state/dateValueEditing";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { newCatalogProjectDocument } from "../project";
import { catalogVariableCommands } from "../stateVariables";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

describe("date edit command → undo → autosave → IndexedDB reload", () => {
  it("keeps the zone and fractional precision in the document and loaded read model", async () => {
    const library = await buildCodeCatalogLibrary();
    const document = newCatalogProjectDocument({
      projectId: "project:project:date-precision" as EntryId<"project">,
      name: "Dates",
    });
    const storage = new CatalogStorage(
      indexedDB,
      `date-precision-${Math.random()}`,
    );
    await storage.create(document, library);
    const workspace = new CatalogWorkspace(
      new CatalogGraph(document, library),
      storage,
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const graph = workspace.runtime.graph;
    const owner = "project:page:home" as EntryId<"page">;
    const read = () =>
      Object.values(graph.exportDocument().entries).find(
        (e) => e.kind === "stateVariable" && e.name === "due",
      ) as StateVariableEntry;
    try {
      workspace.execute(
        catalogVariableCommands.add(owner, "due", workspace.newId),
      );
      workspace.execute(catalogVariableCommands.setType(read(), "date"));
      const original = "2026-10-29T10:30:15.500+09:00[Asia/Seoul]";
      workspace.execute(catalogVariableCommands.setDefault(read(), original));
      await workspace.autosave.retry();
      const depth = workspace.runtime.historyDepth.undo;
      const projection = nativeDateInputOf(original);
      const edited = dateValueFromNativeInput(
        original,
        projection.value.replace("10:30", "10:31"),
      );
      workspace.execute(catalogVariableCommands.setDefault(read(), edited));
      expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
      expect(read().defaultValue).toBe(
        "2026-10-29T10:31:15.500+09:00[Asia/Seoul]",
      );
      workspace.undo();
      expect(read().defaultValue).toBe(original);
      workspace.redo();
      expect(read().defaultValue).toBe(edited);
      await workspace.autosave.retry();
      expect(workspace.autosave.getSnapshot().state).toBe("saved");
      const loaded = new CatalogGraph(
        await storage.load(document.projectId, library),
        library,
      );
      const variable = loaded.getEntry(read().id) as StateVariableEntry;
      expect(variable.valueType).toBe("date");
      expect(variable.defaultValue).toBe(edited);
    } finally {
      workspace.dispose();
    }
  });
});

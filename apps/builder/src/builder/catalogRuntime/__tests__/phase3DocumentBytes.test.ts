// @vitest-environment node
import { execFileSync } from "node:child_process";
import { baselineCompatibleHead } from "./support/baselineHead";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  NodeEntry,
  PageEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { G0_BASELINE_ABSENT } from "./support/g0Baseline";
import { writeEvidence } from "./support/evidence";

const repoRoot = resolve(process.cwd(), "../..");
const counts = [0, 1, 60, 600, 5_000] as const;
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

function mixedDocument(count: number): CatalogDocument {
  const { document } = createG1Fixture();
  const project = document.entries[document.projectId] as ProjectEntry;
  const main = document.entries["project:page:main"] as PageEntry;
  const children: NodeEntry["id"][] = [];
  const entries: Record<string, CatalogDocument["entries"][string]> = {};
  for (let index = 0; index < count; index++) {
    const id = `project:node:perf-seed-${index}` as NodeEntry["id"];
    const text = index % 2 === 0;
    children.push(id);
    entries[id] = {
      kind: "node",
      id,
      definitionId: text ? "lib:definition:text" : "lib:definition:frame",
      children: [],
      props: text ? { children: { kind: "set", value: `Seed ${index}` } } : {},
      visual: text ? {} : { fill: { kind: "set", value: "#dbe7ff" } },
      sizing: {
        width: { kind: "set", value: 160 },
        height: { kind: "set", value: 60 },
      },
      placement: {
        kind: "absolute",
        x: 20 + (index % 6) * 200,
        y: 20 + Math.floor(index / 6) * 90,
      },
      descendantOverrides: [],
    };
  }
  const secondPageId = "project:page:second" as PageEntry["id"];
  return {
    ...document,
    entries: {
      [project.id]: { ...project, pageIds: [main.id, secondPageId] },
      [main.id]: { ...main, children },
      [secondPageId]: {
        kind: "page",
        id: secondPageId,
        name: "Perf Page 2",
        route: "/perf-page-2",
        children: [],
      },
      ...entries,
    },
  };
}

describe("ADR-248 G5 independent document byte subgate", () => {
  it.skipIf(G0_BASELINE_ABSENT)(
    "measures paired mixed Text/Frame seed counts with the same JSON serializer",
    () => {
      const old = JSON.parse(
        readFileSync(
          resolve(repoRoot, "docs/adr/design/248-baseline/storage.json"),
          "utf8",
        ),
      ) as {
        head: string;
        serializer: string;
        samples: Array<{ count: number; byteLength: number }>;
      };
      const head = baselineCompatibleHead(repoRoot, old.head);
      expect(old.serializer).toBe("TextEncoder(JSON.stringify(document))");
      expect(old.samples.map((sample) => sample.count)).toEqual(counts);
      const library = createPencilFixtureLibrary();
      const samples = counts.map((count) => {
        const exportDocument = new CatalogGraph(
          mixedDocument(count),
          library,
        ).exportDocument();
        const librarySnapshotEntries = Object.values(
          exportDocument.entries,
        ).filter(
          (entry) =>
            entry.kind === "definition" || entry.kind === "definitionOverride",
        );
        expect(librarySnapshotEntries).toHaveLength(0);
        const projectBytes = bytes(exportDocument);
        const oldBytes = old.samples.find(
          (sample) => sample.count === count,
        )!.byteLength;
        return { count, oldBytes, projectBytes, librarySnapshotBytes: 0 };
      });
      const b0 = samples[0].oldBytes;
      const p0 = samples[0].projectBytes;
      const verdicts = samples.map((sample) => ({
        count: sample.count,
        measuredProjectBytes: sample.projectBytes,
        allowedProjectBytes:
          sample.count === 0
            ? b0 + 4096
            : p0 + 1.2 * (sample.oldBytes - b0) + 4096,
        pass:
          sample.count === 0
            ? sample.projectBytes <= b0 + 4096
            : sample.projectBytes - p0 <= 1.2 * (sample.oldBytes - b0) + 4096,
      }));
      writeEvidence(
        resolve(
          repoRoot,
          "docs/adr/design/248-phase3-document-byte-budget.json",
        ),
        `${JSON.stringify(
          {
            head,
            scope: "INDEPENDENT_DOCUMENT_BYTE_SUBGATE_ONLY",
            serializer: old.serializer,
            fixture:
              "two-page mixed Text/Frame absolute 160x60 seed; source G0 old perf-baseline mixed; new typed graph",
            excluded: [
              "collections",
              "api_endpoints",
              "project variables",
              "asset binary",
            ],
            librarySnapshotBytes: 0,
            libraryBundleCacheBytes: "UNVERIFIED",
            formula: "P0 <= B0 + 4096; Pn-P0 <= 1.20*(Bn-B0)+4096",
            samples,
            verdicts,
            wholeG5:
              "UNVERIFIED_PAIRED_P95_HEAP_BUNDLE_AND_ACTUAL_SAME_CONSUMER",
          },
          null,
          2,
        )}\n`,
      );
      expect(verdicts.every((verdict) => verdict.pass)).toBe(true);
    },
  );
});

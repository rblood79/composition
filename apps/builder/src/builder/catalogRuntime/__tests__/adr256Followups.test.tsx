// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { runCatalogShortcut } from "../shortcuts";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 후속 (사용자 2026-10-09 「8~19번 묶어서 수정해」) — 착수 중 범위 밖으로 남긴 항목의 수리.
 * A 날짜: 8 DateRangePicker 시작 칸 폭 (Canvas 가 literal 조각의 끝 공백까지 쟀다) · 9 열린 달력의
 * 이중 틀 (지우는 선택자가 없는 Dialog 를 찾았다) · 10 DateRangePicker 구분자 (레퍼런스 `aria-hidden`).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});
const STYLES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles",
);

async function place(type: string, locale = "en-US") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-followups" as EntryId<"project">,
        name: "ADR-256 followups",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-followups-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale,
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const all = (name: string) =>
    [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === name,
    );
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(PLACED)[0]!),
    );
  return { workspace, root, all, html };
}

describe("ADR-256 후속 A — 날짜", () => {
  it("8: a literal date segment drops its collapsible end spaces on the Canvas, as the DOM's flex item does", async () => {
    const { root, all } = await place("daterangepicker", "ko-KR");
    const start = all("DateInput")[0]!;
    root.getGeometry([start.id]);
    const runs = root.dateSegmentPaint(start.id)?.runs ?? [];
    expect(runs.map((run) => run.text)).toEqual([
      "연도",
      ".",
      "월",
      ".",
      "일",
      ".",
    ]);
  });

  it("9: the picker's Popover clears its calendar's own frame (no Dialog in between)", () => {
    for (const [file, owner, calendar] of [
      ["DatePicker", "DatePicker", "Calendar"],
      ["DateRangePicker", "DateRangePicker", "RangeCalendar"],
    ] as const) {
      const css = readFileSync(`${STYLES}/generated/${file}.css`, "utf8");
      const block = new RegExp(
        `\\.react-aria-Popover\\[data-trigger="${owner}"\\] \\.react-aria-${calendar} \\{([^}]*)\\}`,
      ).exec(css);
      expect(block?.[1]).toMatch(/border:\s*none/);
    }
  });

  it("10: a DateRangePicker's dash is decorative in the DOM (the reference's aria-hidden)", async () => {
    const { html } = await place("daterangepicker");
    expect(html()).toMatch(/<span[^>]*aria-hidden="true"[^>]*>–<\/span>/);
    // (Other Text keeps its name: the label is not hidden.)
    expect(html()).not.toMatch(/aria-hidden="true"[^>]*>Date range/i);
  });
});

describe("ADR-256 후속 D — 편집", () => {
  it("17: Delete on a node inside an instance (a palette Tree's item) removes it, as the Layers panel does", async () => {
    const { workspace, root, all } = await place("tree");
    const items = () => all("TreeItem").filter((record) => !record.hidden);
    const count = all("TreeItem").length;
    const target = all("TreeItem").at(-1)!;
    expect(target.sourceId!.startsWith("lib:")).toBe(true);
    workspace.selectRecords([target.id]);
    const errors: unknown[] = [];
    expect(runCatalogShortcut(workspace, "delete", (error) => errors.push(error))).toBe(true);
    expect(errors).toEqual([]);
    expect(all("TreeItem").length).toBeLessThan(count);
    expect(items().some((record) => record.id === target.id)).toBe(false);
    void root;
  });
});

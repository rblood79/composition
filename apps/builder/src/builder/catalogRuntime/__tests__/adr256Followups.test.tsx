// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  insertTableColumns,
  insertTableRow,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
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

async function place(
  type: string,
  locale = "en-US",
  props: Record<string, unknown> = {},
) {
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
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
          ) as never,
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

describe("ADR-256 후속 B — 진행 막대 · Slider · Swatch", () => {
  const edit = (
    workspace: CatalogWorkspace,
    props: Record<string, unknown>,
  ) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
        ) as never,
      }),
    );

  it("11: the Canvas track · fill radius per size is the sheet's `.bar` · `.fill` (Meter fill: its track's)", () => {
    const rules = COMPONENT_RULES_TABLE as unknown as Record<
      string,
      {
        sizes: Record<string, { borderRadius?: string }>;
        structure?: {
          composition?: {
            sizeSelectors?: Record<string, Record<string, Record<string, string>>>;
          };
        };
      }
    >;
    // `var(--radius-sm)` (the sheet) ↔ `{radius.sm}` (the rule's token).
    const token = (css: string | undefined) =>
      css?.replace(/^var\(--radius-([a-z0-9]+)\)$/, "{radius.$1}");
    for (const [owner, part, selector] of [
      ["ProgressBar", "ProgressBarTrack", ".bar"],
      ["ProgressBar", "ProgressBarFill", ".fill"],
      ["Meter", "MeterTrack", ".bar"],
    ] as const) {
      const sheet = rules[owner]!.structure!.composition!.sizeSelectors!;
      for (const size of ["sm", "md", "lg", "xl"])
        expect([owner, part, size, rules[part]!.sizes[size]?.borderRadius]).toEqual([
          owner,
          part,
          size,
          token(sheet[size]?.[selector]?.["border-radius"]),
        ]);
    }
    for (const size of ["sm", "md", "lg", "xl"])
      expect(rules.MeterFill!.sizes[size]?.borderRadius).toBe(
        rules.MeterTrack!.sizes[size]?.borderRadius,
      );
  });

  it("11: a static ProgressBar paints its fill and its track in the static color (S2 overlay 0.94 · 0.17)", async () => {
    const { workspace, all } = await place("progressbar");
    edit(workspace, { staticColor: "white" });
    const paint = (name: "ProgressBarTrack" | "ProgressBarFill") => {
      const record = all(name)[0]!;
      const rule = (COMPONENT_RULES_TABLE as Record<string, { variants: Record<string, unknown>; defaultVariant: string }>)[name]!;
      return resolveCatalogPaint({
        variant: rule.variants[String(record.derivedProps?.variant ?? rule.defaultVariant)] as never,
        size: undefined as never,
        props: { ...record.props, ...record.derivedProps } as never,
      } as never);
    };
    expect(all("ProgressBarFill")[0]!.derivedProps?.staticColor).toBe("white");
    const fill = paint("ProgressBarFill");
    expect(fill.backgroundColor).toBe("#ffffff");
    expect(fill.backgroundAlpha).toBeCloseTo(0.94);
    const track = paint("ProgressBarTrack");
    expect(track.backgroundColor).toBe("#ffffff");
    expect(track.backgroundAlpha).toBeCloseTo(0.17);
  });

  it("12: the Canvas Slider value snaps to its step as RAC's does (fill · thumb · output)", async () => {
    const { workspace, root, all } = await place("slider");
    const at = () => {
      const fill = all("SliderFill")[0]!;
      const thumb = all("SliderThumb")[0]!;
      const track = all("SliderTrack")[0]!;
      const g = root.getGeometry([fill.id, thumb.id, track.id]);
      return {
        fill: Math.round((g.get(fill.id)!.width / g.get(track.id)!.width) * 100),
        output: all("SliderOutput")[0]?.derivedProps?.children ?? all("SliderOutput")[0]?.props.children,
      };
    };
    edit(workspace, { minValue: 0, maxValue: 100, value: 26, step: 10 });
    expect(at().fill).toBe(30);
    edit(workspace, { value: 99, maxValue: 95 });
    expect(at().fill).toBe(Math.round((90 / 95) * 100));
  });

  it("12 (live): a value edit notices the Slider fill · thumb — their style moved with an unchanged record, so the Canvas compares their rects", async () => {
    const { workspace, root, all } = await place("slider");
    const noticed = new Set<string>();
    for (const type of ["SliderFill", "SliderThumb"])
      root.subscribeCanvas(all(type)[0]!.id, () => noticed.add(type));
    edit(workspace, { value: 26, step: 10 });
    expect([...noticed].sort()).toEqual(["SliderFill", "SliderThumb"]);
  });

  it("13: the ColorSwatchPicker's Canvas box has no border (its DOM sheet draws none)", async () => {
    const { root, all, placed } = await (async () => {
      const opened = await place("colorswatchpicker");
      return { ...opened, placed: opened.all("ColorSwatchPicker")[0]! };
    })();
    const first = root.canvasInputs.get(placed.children[0]!)!;
    const g = root.getGeometry([placed.id, first.id]);
    expect(Number(placed.visual.borderWidth ?? 0)).toBe(0);
    expect(g.get(first.id)!.x - g.get(placed.id)!.x).toBe(0);
    void all;
  });
});

describe("ADR-256 후속 C — Tree · Table", () => {
  it("14: an expanded item's child item is the next row on the Canvas (below its row, at its x), as RAC draws it", async () => {
    const { root, all } = await place("tree", "en-US", { expandedKeys: ["item-1"] });
    const parent = all("TreeItem").find((record) =>
      record.children.some((id) => root.typeOf(root.canvasInputs.get(id)!) === "TreeItem"),
    )!;
    const content = root.canvasInputs.get(parent.children[0]!)!;
    const child = parent.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((record) => root.typeOf(record) === "TreeItem" && !record.hidden)!;
    const g = root.getGeometry([parent.id, content.id, child.id]);
    const row = g.get(content.id)!;
    expect(root.typeOf(content)).toBe("TreeItemContent");
    expect(row.height).toBe(32);
    expect(g.get(child.id)!.y).toBe(row.y + row.height);
    // (Geometry is relative to the parent item: the child row starts where the row does.)
    expect(g.get(child.id)!.x).toBe(row.x);
    expect(g.get(child.id)!.width).toBe(row.width);
  });

  it("15: a node tree Table paints its header and row separators — the same values on the Canvas record and the DOM", async () => {
    const { workspace, root, all, html } = await place("table");
    const entry = (type: string) =>
      ({
        kind: "node",
        id: workspace.newId("node"),
        definitionId: `lib:definition:type-${type}`,
        children: [],
        props: type === "Cell" ? { children: { kind: "set", value: "" } } : {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as unknown as NodeEntry;
    workspace.execute(
      insertTableColumns({
        header: workspace.positionOfRecord(all("TableHeader")[0]!.id)!.target,
        buildColumn: () => {
          const column = entry("Column");
          return { entries: [column], rootId: column.id };
        },
        buildCell: () => {
          const cell = entry("Cell");
          return { entries: [cell], rootId: cell.id };
        },
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      insertTableRow({
        body: workspace.positionOfRecord(all("TableBody")[0]!.id)!.target,
        buildRow: (count) => {
          const cells = Array.from({ length: count }, () => entry("Cell"));
          const row = { ...entry("Row"), children: cells.map((cell) => cell.id) };
          return { entries: [row, ...cells], rootId: row.id };
        },
        newId: workspace.newId,
      }),
    );
    const header = all("TableHeader")[0]!;
    const column = all("Column")[0]!;
    const row = all("Row")[0]!;
    expect(header.visual.fill).toBe("var(--bg-raised)");
    expect([column.visual.borderBottomWidth, column.visual.borderColor]).toEqual([1, "var(--border-hover)"]);
    expect([row.visual.borderBottomWidth, row.visual.borderColor, row.visual.borderTopWidth]).toEqual([1, "var(--border)", 0]);
    const dom = html();
    expect(dom).toMatch(/class="react-aria-TableHeader"[^>]*style="[^"]*background-color:var\(--bg-raised\)/);
    expect(dom).toMatch(/class="react-aria-Row"[^>]*style="[^"]*border-bottom-width:1px/);
    void root;
  });

  it("16: a checkbox-style Tree draws no automatic selection checkbox in an item without a content node (the Canvas draws none)", async () => {
    const { workspace, all, html } = await place("tree", "en-US", {
      selectionStyle: "checkbox",
      selectionMode: "multiple",
    });
    // (A bare TreeItem — no TreeItemContent: the DOM composes its row through the shared one.)
    const bare = workspace.newId("node") as NodeId;
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(all("Tree")[0]!.id)!.target,
        entries: [
          {
            kind: "node",
            id: bare,
            definitionId: "lib:definition:type-TreeItem",
            children: [],
            props: { children: { kind: "set", value: "Bare" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [bare],
        newId: workspace.newId,
      }),
    );
    expect(html()).toContain("Bare");
    expect(html()).not.toMatch(/slot="selection"/);
  });
});

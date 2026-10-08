/**
 * ADR-248 Phase 3 G3 — pre-cutover evidence: old/new Canvas for the frozen G0
 * palette-production-base scenario (64 palette types, one insert each at page (30,30) 220×130).
 *
 * Old leg (oracle, not regenerated here):
 *   - frozen G0 PNGs `248-baseline/palette-production-base/canvas/<type>.png`;
 *   - the replay supplement `248-phase3-palette-old-replay.json` (G0 baseline commit, dirty 0):
 *     camera and old layout rects, valid only where the replay PNG is byte-identical to the frozen
 *     PNG (`frozenPngMatch`).
 * New leg: the typed code library → product composition root (Rust layout, product text measure)
 *   → product Canvas binding → shared renderCommands on a CanvasKit WebGL surface in headless
 *   Chrome, with the same camera and capture clip.
 *
 * Verdict per type (HC6, ADR-198 L3 regions — no budget changed):
 *   - geometry: every structurally paired node Δx/Δy/Δw/Δh ≤ 1 CSS px and no unpaired node;
 *   - L3 non-text: pixelmatch 0.1 on the clip minus the text region minus the L3e band; blocked
 *     when ratio > 0.001 AND maxByte > 2. The text region is every text leaf's box plus the new
 *     leg's glyph ink (the pixels a second render without fonts changes) grown by the geometry
 *     tolerance (1 CSS px × zoom + 1); a text node that also paints a box (a Button) contributes
 *     only its ink — its fill stays L3 (ADR-198 §6/§7);
 *   - L3e (3px band at every painted box edge): recorded only — not a completion condition
 *     (user decision 2026-09-29); it stays a diagnostic read beside L3 (a thin box is all band);
 *   - text boxes (L4): recorded only — HC6 names no text budget.
 * A type whose geometry, Canvas↔DOM contract and L3 legs all clear is PASS.
 *
 * `ADR248_SCENARIO=axis` runs the frozen palette-variant-size scenario instead: each of the 386
 * single variant/size axes is one case (the old replay `248-phase3-palette-axis-old-replay.json`
 * edits that prop on the palette insert; the new node authors the same prop value).
 *
 * `ADR248_SCENARIO=state` runs the frozen state-origins-production scenario: each of the 75
 * Components-page state origins (the old app zooms to it with ⇧2) is one case, replayed by
 * `248-phase3-state-origin-old-replay.json`. The new leg places the origin's typed composite alone
 * with the old root's screen position; neighbors of the old capture are not part of the fixture,
 * so the pixel regions are limited to the old ∪ new root box plus a margin (recorded, not a budget).
 *
 * `ADR248_SCENARIO=child` runs the frozen system child scene (`248-baseline/system-child-scene.json`:
 * 34 origin instances, the 33 parent-owned child types' old parent-relative layout). Children pair
 * by their typed template ID (`lib:template:<old origin node ID>`); geometry and the Canvas↔DOM
 * contract are measured. The baseline froze no child PNG, so no pixel leg runs (best UNVERIFIED:
 * the L3 leg is unmeasured, not cleared).
 */
// Same face files as the Builder entry (`main.tsx`): the production text measurer is Canvas 2D.
import pixelmatch from "pixelmatch";
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  catalogDomRendersNode,
  renderCatalogDom,
} from "@/builder/catalogRuntime/domBinding";
import type { CanvasKit } from "canvaskit-wasm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";

import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  typography,
} from "@composition/rendering";
import {
  createThemesCollection,
  getActiveTheme,
  OWNER_DRAWN_PART_OWNERS,
} from "@composition/shared";
import { DEFAULT_BASE_TYPOGRAPHY } from "@/builder/fonts/customFonts";
import { resolveThemeSnapshot } from "@/utils/theme/resolveThemeSnapshot";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { skiaFontManager } from "@/builder/workspace/canvas/skia/fontManager";
import { executeRenderCommands } from "@/builder/workspace/canvas/skia/renderCommands";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import * as spatialIndex from "@/builder/workspace/canvas/wasm-bindings/spatialIndex";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import {
  approvedDifference,
  switchIndicatorPaintPair,
  approvedSectionDifference,
  SECTION_SUPPLEMENT_HASH,
  approvedStatePaint,
  approvedUnpaired,
  SUBPIXEL_INTRINSIC_WIDTH_CEIL,
  subpixelIntrinsicWidthCeil,
} from "./approvedDifferences";
import { instanceContract } from "../../../../packages/shared/src/catalog/document/library";
import { createPencilFixtureLibrary } from "../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import {
  catalogSubpartDomSelectors,
  catalogSubpartDomUnion,
} from "../../../../packages/shared/src/catalog/document/rulePartRules";
import type {
  CatalogDocument,
  CatalogLibrary,
  DefinitionId,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";

declare const __ADR248_DUMP_DOM__: string;
declare const __ADR248_DUMP_DIR__: string;
declare const __ADR248_SCENARIO__: string;
/**
 * Phase 4 live leg (`ADR248_LIVE_DIR=<abs dir>`): the cases the real Builder authored and captured
 * (`<caseKey>.json` subject entry · `<caseKey>.png` clip, written by the live driver). The new leg's
 * document is the live subject entry and the compared pixels are the live capture; the harness's
 * own render stays the glyph-ink source and is recorded against the live capture (`liveIdentity`).
 */
declare const __ADR248_LIVE_DIR__: string;
declare const __ADR248_CASES__: string;
declare const __ADR248_REPORT__: string;
declare const __ADR248_REPLAY__: string;
declare const __ADR248_OLD_PNG_DIR__: string;
const ONLY = new Set(__ADR248_CASES__.split(",").filter(Boolean));
const LIVE = __ADR248_LIVE_DIR__;
const AXIS = __ADR248_SCENARIO__ === "axis";
const STATE = __ADR248_SCENARIO__ === "state";
const CHILD = __ADR248_SCENARIO__ === "child";
const DESIGN = "../../docs/adr/design"; // Vitest root = apps/builder
const REPLAY =
  __ADR248_REPLAY__ ||
  (CHILD
    ? `${DESIGN}/248-baseline/system-child-scene.json`
    : STATE
      ? `${DESIGN}/248-phase3-state-origin-old-replay.json`
      : AXIS
        ? `${DESIGN}/248-phase3-palette-axis-old-replay.json`
        : `${DESIGN}/248-phase3-palette-old-replay.json`);
const FROZEN = STATE
  ? `${DESIGN}/248-baseline/state-origins-production`
  : AXIS
    ? `${DESIGN}/248-baseline/palette-variant-size`
    : `${DESIGN}/248-baseline/palette-production-base`;
const OUTPUT =
  __ADR248_REPORT__ ||
  (ONLY.size || __ADR248_REPLAY__
    ? `test-results/adr248-g3-selected-${__ADR248_SCENARIO__}.json`
    : LIVE
      ? `${DESIGN}/248-phase4-g3-live-${__ADR248_SCENARIO__}.json`
      : CHILD
        ? `${DESIGN}/248-phase3-system-child-canvas.json`
        : STATE
          ? `${DESIGN}/248-phase3-state-origin-canvas.json`
          : AXIS
            ? `${DESIGN}/248-phase3-palette-axis-canvas.json`
            : `${DESIGN}/248-phase3-palette-base-canvas.json`);
const PNG_DIR = __ADR248_REPLAY__
  ? `test-results/adr248-g3-supplement/${__ADR248_SCENARIO__}`
  : LIVE
    ? `${LIVE}/harness`
    : STATE
      ? `${DESIGN}/248-phase3-state-origin-canvas`
      : AXIS
        ? `${DESIGN}/248-phase3-palette-axis-canvas`
        : `${DESIGN}/248-phase3-palette-base-canvas`;
/** State scenario: compared pixels are the old ∪ new root box grown by this many CSS px. */
const STATE_REGION_MARGIN = 6;
const PAGE = { width: 1920, height: 1080 };
/**
 * Rendering locale of both new legs, fixed like the font: the Canvas date placeholder is `en-US`
 * (`buildDateInputDisplayText`) and RAC would otherwise follow the browser locale. The product
 * Preview's locale asymmetry is recorded separately, not measured by this contract leg.
 */
// Live leg: the Builder's locale (the G0 capture's — its calendar header reads "2026년 9월"), so
// date text measures the same in the harness root as in the captured Builder.
const FIXTURE_LOCALE = LIVE ? "ko-KR" : "en-US";
const NON_TEXT = { maxDiffRatio: 0.001, maxByte: 2 } as const;
/**
 * Types whose old capture drew an input the G0 scenario did not record, so L3 compares two
 * different drawings (recorded, not gated → UNVERIFIED): the old palette inserts an Icon with a
 * random `POPULAR_ICONS` name (`unified.types.ts` Icon defaults); the typed insertion has none
 * (the DOM/Preview Icon draws its no-name fallback, as the new Canvas does).
 */
const OLD_UNRECORDED_INPUT: Readonly<Record<string, string>> = {
  Icon: "old palette insertion picks a random POPULAR_ICONS iconName; G0 did not record it",
};
/** Leaves whose drawing (a glyph) moves and scales with their box: L3 attribution owns the box. */
const GLYPH_BINDINGS: ReadonlySet<string> = new Set([
  "icon",
  "selecticon",
  "avatar",
  "image",
]);
/**
 * Text leaves: their approved box change moves glyph ink, but the box also shows its parent's
 * paint. Only pixels that are ink in either leg (off the box's most frequent colour) are
 * attributed; a background that changes colour under the text still blocks.
 */
const TEXT_BINDINGS: ReadonlySet<string> = new Set([
  "text",
  "heading",
  "label",
  "description",
  "paragraph",
  "fielderror",
  "selectvalue",
]);
/** Max channel distance from a box's most frequent colour past which a pixel is ink. */
const INK_DISTANCE = 24;
const EDGE_BAND = 3;
/** Date of the frozen capture (G0 README 2026-09-28): Calendar "today" paints from the clock. */
const CAPTURE_DATE = new Date(2026, 8, 28, 12, 0, 0);

type Rect = { x: number; y: number; width: number; height: number };
type ReplayRow = {
  type: string;
  recordedInput?: { iconName?: string };
  host?: string;
  pngSha256?: string;
  /** State scenario: the Components-page origin ID and its `metadata.variant`. */
  id?: string;
  state?: string;
  /** Child scenario: the old app's authoring status and the children's parent-relative layout. */
  status?: string;
  childLayouts?: Array<{ type: string; originId: string; layout: Rect | null }>;
  /** Axis scenario: `variant:<v>` / `size:<s>` authored on the insert. */
  axis?: string;
  frozenPngMatch: boolean;
  ref: string | null;
  camera: {
    zoom: number;
    pan: { x: number; y: number };
    canvasRect?: Rect;
  };
  nodes: Array<{
    path: string;
    parent: string | null;
    rect: Rect | null;
    engineInput?: Record<string, unknown> | null;
  }>;
};
type Replay = {
  head: string;
  scenarioId: string;
  scenarioHash: string;
  captureClip: Rect;
  rows: ReplayRow[];
};
type AxisReplay = Omit<Replay, "rows"> & {
  rows: Array<{ type: string; axes: Array<Omit<ReplayRow, "type">> }>;
};
/** One case per replay row (base, state) or per replayed axis (axis scenario). */
const casesOf = (source: Replay | AxisReplay): ReplayRow[] =>
  AXIS
    ? (source as AxisReplay).rows.flatMap((row) =>
        row.axes.map((axis) => ({ ...axis, type: row.type })),
      )
    : (source as Replay).rows;
/** Case key: the type, or `<type>-<prop>-<value>` (the frozen axis PNG name). */
const caseKey = (row: ReplayRow) =>
  row.id ?? (row.axis ? `${row.type}-${row.axis.replace(":", "-")}` : row.type);

let ck: CanvasKit;
let code: CatalogLibrary;
let fixture: CatalogLibrary;
let replay: Replay;
/** Axis scenario: frozen palette-production-base PNG hash per type (the unedited insert). */
let basePngSha: Map<string, string> = new Map();
/** Axis scenario: frozen axis PNG hash per case key. */
let axisPngSha: Map<string, string> = new Map();
const results: unknown[] = [];

/** Part nodes the owner draws (2026-10-04): no old node held them. */
const OWNER_DRAWN_PART_TYPES = Object.keys(OWNER_DRAWN_PART_OWNERS);
/** New row hosts between a toggle and its parts (ADR-256 Phase 3 — RAC `CheckboxButton`). */
const NEW_ROW_HOST_TYPES = ["CheckboxButton", "SwitchButton", "RadioButton"];

/** Set when the local G0 baseline is absent (a fresh clone). */
let baselineAbsent = false;
beforeAll(async () => {
  // The frozen G0 outputs are kept local only (user decision 2026-09-30): without them the
  // harness has no old leg to compare, so it skips instead of failing on a missing file.
  try {
    await commands.readFile(`${DESIGN}/248-baseline/g0-gate.json`);
  } catch {
    baselineAbsent = true;
    return;
  }
  if (Boolean(__ADR248_REPLAY__) !== Boolean(__ADR248_OLD_PNG_DIR__))
    throw new Error(
      "Supplemental oracle requires both replay and old PNG directory",
    );
  vi.useFakeTimers({ toFake: ["Date"], now: CAPTURE_DATE });
  // Font environment fixed for both legs (G3 §6.1): the DOM reads the same Pretendard file the
  // Canvas (`loadBuiltinFontsToSkia`) draws with. The product Preview loads the static Pretendard
  // CSS instead — that file asymmetry is recorded separately, not measured by this contract leg.
  const face = document.createElement("style");
  face.textContent = `@font-face { font-family: "Pretendard"; src: url("/fonts/PretendardVariable.ttf") format("truetype"); font-weight: 45 920; font-display: block; }`;
  document.head.append(face);
  await Promise.all(
    [400, 500, 600, 700].map((weight) =>
      document.fonts.load(`${weight} 16px "Pretendard"`),
    ),
  );
  await document.fonts.ready;
  // Isolated RAC DOM leg: shared bundle CSS + the Preview global reset (production DOM context).
  const css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  // Theme environment of the old capture: a new project's default theme (Builder load:
  // `applyActiveThemeToRuntime` → `resolveThemeSnapshot` → `installThemeSnapshot`). Both legs get
  // it the way the product does — the Canvas token maps (read when the code library resolves its
  // tokens below) and the Preview `THEME_VARS` `:root` block for the DOM leg.
  const theme = resolveThemeSnapshot(
    getActiveTheme({ themes: createThemesCollection() })!,
    {
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    },
  );
  const install = (target: object, source: object) =>
    Object.assign(target, source);
  install(lightColors, theme.colors.light);
  install(darkColors, theme.colors.dark);
  install(typography, theme.typography);
  install(radius, theme.radius);
  install(borderWidth, theme.border);
  install(lightShadows, theme.shadows.light);
  install(darkShadows, theme.shadows.dark);
  const vars = document.createElement("style");
  vars.textContent = `:root {\n${theme.cssVars
    .filter((entry) => !entry.isDark)
    .map((entry) => `  ${entry.name}: ${entry.value};`)
    .join("\n")}\n}`;
  document.head.append(vars);
  await initEngineWasm();
  spatialIndex.initSpatialIndex();
  ck = await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
  fixture = createPencilFixtureLibrary();
  const source = JSON.parse(await commands.readFile(REPLAY)) as Replay;
  if (__ADR248_REPLAY__)
    expect(source.head, "supplement must use the frozen G0 commit").toBe(
      "2a5c970994cb9de2f824a729b29c08cdcd647d7b",
    );
  replay = CHILD
    ? (() => {
        const scene = source as unknown as {
          head: string;
          scenario: { id: string };
          scenarioHash: string;
          rows: Array<{
            rootId: string;
            rootType: string;
            status: string;
            children: Array<{
              type: string;
              originId: string;
              layout: Rect | null;
            }>;
          }>;
        };
        return {
          head: scene.head,
          scenarioId: scene.scenario.id,
          scenarioHash: scene.scenarioHash,
          captureClip: { x: 0, y: 0, width: 1, height: 1 },
          rows: scene.rows.map((row) => ({
            type: row.rootType,
            id: row.rootId,
            status: row.status,
            childLayouts: row.children,
            frozenPngMatch: true,
            ref: null,
            camera: { zoom: 1, pan: { x: 0, y: 0 } },
            nodes: [],
          })),
        };
      })()
    : { ...source, rows: casesOf(source) };
  if (STATE) {
    // State rows carry the origin ID; the type is the base origin's registered type.
    const frozen = JSON.parse(
      await commands.readFile(`${FROZEN}/baseline.json`),
    ) as {
      origins: Array<{ id: string; type: string; variantOf: string | null }>;
    };
    const byId = new Map(frozen.origins.map((origin) => [origin.id, origin]));
    replay.rows = replay.rows.map((row) => {
      const origin = byId.get(row.id!)!;
      // A base outside the 75 (IconButton, Link, Button, Disclosure) is named by its typed origin.
      const base = origin.variantOf ? byId.get(origin.variantOf) : origin;
      const type =
        base?.type ??
        code.definitions.get(
          `lib:definition:origin-${origin.variantOf}` as never,
        )?.name ??
        origin.type;
      return { ...row, type, ref: null };
    });
  }
  if (AXIS) {
    const base = JSON.parse(
      await commands.readFile(
        `${DESIGN}/248-baseline/palette-production-base/baseline.json`,
      ),
    ) as { rows: Array<{ type: string; pngSha256?: string }> };
    basePngSha = new Map(
      base.rows.flatMap((row) =>
        row.pngSha256 ? [[row.type, row.pngSha256]] : [],
      ),
    );
    const frozen = JSON.parse(
      await commands.readFile(`${FROZEN}/baseline.json`),
    ) as {
      rows: Array<{
        type: string;
        captures: Array<{ axis: string; pngSha256: string }>;
      }>;
    };
    axisPngSha = new Map(
      frozen.rows.flatMap((row) =>
        row.captures.map((capture) => [
          `${row.type}-${capture.axis.replace(":", "-")}`,
          capture.pngSha256,
        ]),
      ),
    );
  }
});

afterAll(async () => {
  vi.useRealTimers();
  // A skipped run (no local baseline) keeps the recorded verdicts.
  if (baselineAbsent || !replay) return;
  const rows = results as Array<{ verdict: string }>;
  const count = (verdict: string) =>
    rows.filter((row) => row.verdict === verdict).length;
  await commands.writeFile(
    OUTPUT,
    `${JSON.stringify(
      {
        adr: 248,
        scope: {
          selected: [...ONLY],
          totalCases: replay.rows.length,
          measuredCases: rows.length,
        },
        phase: LIVE ? 4 : 3,
        check: AXIS
          ? "G3 pre-cutover old/new Canvas — palette-variant-size (single axes)"
          : CHILD
            ? "G3 pre-cutover old/new Canvas — system child scene (parent-owned child layout; no frozen PNG)"
            : STATE
              ? "G3 pre-cutover old/new Canvas — state-origins-production (Components page, ⇧2 camera)"
              : "G3 pre-cutover old/new Canvas — palette-production-base",
        oldOracle: {
          frozenPngs: __ADR248_OLD_PNG_DIR__ || `${FROZEN}/canvas`,
          replay: REPLAY,
          replayHead: replay?.head,
          scenarioId: replay?.scenarioId,
          scenarioHash: replay?.scenarioHash,
        },
        newLeg: LIVE
          ? "real Builder (dev server, catalog workspace) authors each case through the public command API and its Canvas is captured with the replay camera (headless Chrome); the harness renders the same live subject entry (code library → CatalogCompositionRoot → bindCatalogCanvas → renderCommands) for glyph ink and records it against the capture (liveIdentity)"
          : "code library → CatalogCompositionRoot (Rust layout, catalogTextMeasure) → bindCatalogCanvas → renderCommands → CanvasKit WebGL, headless Chrome",
        ...(LIVE ? { liveCaptures: LIVE } : {}),
        camera: STATE
          ? "replay zoom; new root top-left at the old root's screen position (zoom-to-selection centers the old root in the canvas rect) − capture clip origin"
          : "replay camera (zoom, pan) − capture clip origin",
        ...(STATE
          ? {
              fixtureRegion: `pixels inside the old ∪ new root box grown by ${STATE_REGION_MARGIN} CSS px; the rest of the capture is neighboring origins (not rendered by the new leg, not compared)`,
            }
          : {}),
        fontEnvironment:
          "Canvas and isolated DOM both use public/fonts/PretendardVariable.ttf (product Preview loads pretendard static CSS: separate asymmetry)",
        themeEnvironment:
          "new project's default theme (tint blue · neutral · radius md · light) installed like the Builder load: token maps before the code library resolves its tokens, THEME_VARS :root for the DOM leg",
        captureDate: CAPTURE_DATE.toISOString(),
        budgets: {
          geometry: "≤1 CSS px per paired node",
          L3: NON_TEXT,
          L3e: `${EDGE_BAND}px band — recorded only, not a completion condition (user decision 2026-09-29)`,
          approvedDifferences:
            "old/new pairs approved per owner × node type × differing axes (user decision 2026-09-30, approvedDifferences.ts); the Canvas↔DOM leg still arbitrates; L3 differences an approved box change sweeps are attributed to it — old ∪ new outside the other box plus an edge band (tolerance + 0.3 × radius); a glyph leaf (icon · avatar · image), a one-sided node or a rule marked `paint` (a sized control drawing its own indicator, 4e-11) owns its whole box; a text leaf owns the pixels that are ink in either leg (off its box's most frequent colour); a moved box is compared shifted; the interior both boxes cover still blocks paint changes (2026-09-30)",
          text: "recorded only (HC6 names no text budget)",
        },
        summary: {
          ...(AXIS || STATE || CHILD
            ? {
                cases: rows.length,
                types: new Set(
                  (results as Array<{ type: string }>).map((row) => row.type),
                ).size,
              }
            : { types: rows.length }),
          PASS: count("PASS"),
          PASS_withApprovedDifferences: (
            results as Array<{
              verdict: string;
              approvedDifferences?: unknown[];
            }>
          ).filter(
            (row) => row.verdict === "PASS" && row.approvedDifferences?.length,
          ).length,
          previewDefectFollowed: (
            results as Array<{ previewDefectFollowed?: boolean }>
          ).filter((row) => row.previewDefectFollowed).length,
          FAIL: count("FAIL"),
          UNVERIFIED: count("UNVERIFIED"),
          NOT_RUN: count("NOT_RUN"),
          canvasDomGeometryPass: (
            results as Array<{ canvasDom?: { pass: boolean } }>
          ).filter((row) => row.canvasDom?.pass).length,
          failedLegs: Object.fromEntries(
            ["geometry", "canvasDom", "L3"].map((leg) => [
              leg,
              (results as Array<{ failedLegs?: string[] }>).filter((row) =>
                row.failedLegs?.includes(leg),
              ).length,
            ]),
          ),
        },
        inputDiffKeys: (() => {
          const counts: Record<string, { nodes: number; types: Set<string> }> =
            {};
          for (const row of results as Array<{
            type: string;
            inputDiffs?: Array<{ key: string }>;
          }>)
            for (const diff of row.inputDiffs ?? []) {
              counts[diff.key] ??= { nodes: 0, types: new Set() };
              counts[diff.key].nodes++;
              counts[diff.key].types.add(row.type);
            }
          return Object.fromEntries(
            Object.entries(counts)
              .sort((a, b) => b[1].types.size - a[1].types.size)
              .map(([key, value]) => [
                key,
                { nodes: value.nodes, types: value.types.size },
              ]),
          );
        })(),
        types: results,
      },
      null,
      2,
    )}\n`,
  );
});

/**
 * Palette inserts (and child-scene roots) are authored 220×130 at page (30,30); a state origin
 * keeps its own size.
 */
const nodeEntry = (
  definitionId: DefinitionId,
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: "project:node:subject" as NodeEntry["id"],
  definitionId,
  children: [],
  props,
  visual: {},
  sizing: STATE
    ? {}
    : {
        width: { kind: "set", value: 220 },
        height: { kind: "set", value: 130 },
      },
  placement: { kind: "absolute", x: 30, y: 30 },
  descendantOverrides: [],
});

/** Child scene: section roots were inserted (unsized, in flow) into a 220×130 host at (30,30). */
const SECTION_HOSTS: Readonly<Record<string, string>> = {
  "component-listbox-section": "ListBox",
  "component-menu-section": "Menu",
  "component-gridlist-section": "GridList",
};

function documentFor(
  definitionId: DefinitionId,
  props?: NodeEntry["props"],
  host?: string,
  live?: NodeEntry,
): CatalogDocument {
  const projectId = "project:project:g3" as const;
  const pageId = "project:page:main" as const;
  // The live subject keeps its authored fields under the fixture's node ID.
  const subject: NodeEntry = live
    ? { ...live, id: "project:node:subject" as NodeEntry["id"] }
    : nodeEntry(definitionId, props);
  const hostNode: NodeEntry | undefined = host
    ? {
        ...nodeEntry(`lib:definition:type-${host}` as DefinitionId),
        id: "project:node:host" as NodeEntry["id"],
        children: [subject.id],
      }
    : undefined;
  const { placement: _placement, ...unplaced } = subject;
  const node: NodeEntry = hostNode ? { ...unplaced, sizing: {} } : subject;
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 17,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "g3",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [hostNode?.id ?? node.id],
      },
      [node.id]: node,
      ...(hostNode ? { [hostNode.id]: hostNode } : {}),
    },
  };
}

/** Old palette route: a reusable-origin ref → its typed composite; a plain type → its definition. */
function route(
  row: ReplayRow,
):
  | { library: CatalogLibrary; definitionId: DefinitionId; source: string }
  | undefined {
  if (row.id) {
    const id = `lib:definition:origin-${row.id}` as DefinitionId;
    return code.definitions.has(id as never)
      ? { library: code, definitionId: id, source: "code-composite" }
      : undefined;
  }
  if (row.ref) {
    const id = `lib:definition:origin-${row.ref}` as DefinitionId;
    return code.definitions.has(id as never)
      ? { library: code, definitionId: id, source: "code-composite" }
      : undefined;
  }
  for (const id of [
    `lib:definition:${row.type.toLowerCase()}`,
    `lib:definition:type-${row.type}`,
  ] as DefinitionId[])
    if (code.definitions.has(id as never))
      return { library: code, definitionId: id, source: "code-direct" };
  const fixtureId = `lib:definition:${row.type.toLowerCase()}` as DefinitionId;
  return fixture.definitions.has(fixtureId as never)
    ? { library: fixture, definitionId: fixtureId, source: "test-fixture" }
    : undefined;
}

function decodePng(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error("G3_PNG_DECODE_FAILED");
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array | null;
  image.delete();
  if (!pixels) throw new Error("G3_PNG_PIXELS_MISSING");
  return { width, height, pixels: new Uint8Array(pixels) };
}

const toBase64 = (bytes: Uint8Array) => {
  let text = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(text);
};

type PaintedBox = Rect & { text: boolean };

/**
 * Rust `NodeStyle` fields (packages/engine/src/tree.rs, camelCase serde). Other keys of the old
 * input (`whiteSpace`, `gridArea`, …) are dropped by serde and cannot move geometry. The baseline
 * channels (`lineHeight`, `leafBaseline`, `strutBaseline`) are compared separately later.
 */
const NODE_STYLE_KEYS = new Set([
  "display",
  "position",
  "overflowX",
  "overflowY",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "justifyItems",
  "alignItems",
  "alignContent",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "gridAutoColumns",
  "gridAutoRows",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
  "insetLeft",
  "columnGap",
  "rowGap",
  "aspectRatio",
  "contentMinWidth",
  "contentMaxWidth",
  "contentMinHeight",
  "contentHeight",
  "verticalAlign",
]);
const IGNORED_INPUT_KEYS = { has: (key: string) => !NODE_STYLE_KEYS.has(key) };
/** "0px"/0/absent compare equal; numbers compare at 0.5 px. */
function normalizeInput(value: unknown): string {
  if (value === undefined || value === null || value === "0px" || value === 0)
    return "";
  if (typeof value === "number") return String(Math.round(value * 2) / 2);
  const px =
    typeof value === "string" ? /^(-?\d+(?:\.\d+)?)px$/.exec(value) : null;
  return px ? String(Math.round(Number(px[1]) * 2) / 2) : String(value);
}

/** Typed consumer input of a node and its parent (diagnostic for geometry deltas). */
function inputSummary(root: CatalogCompositionRoot, id: string) {
  const summary = (nodeId: string) => {
    const node = root.canvasInputs.get(nodeId);
    if (!node) return null;
    const definition = root.runtime.graph.getDefinition(
      node.definitionId as never,
    );
    return {
      type: node.ruleId ?? definition?.name ?? null,
      props: node.props,
      layout: node.layout ?? null,
      sizing: node.sizing ?? null,
      visual: node.visual,
      placement: node.placement ?? null,
      engineInput: root.getLayoutInput(nodeId) ?? null,
    };
  };
  const node = root.canvasInputs.get(id);
  return { self: summary(id), parent: node ? summary(node.parentId) : null };
}

/** Painted boxes of the command stream in page coordinates (ELEMENT_BEGIN nesting). */
function paintedBoxes(
  stream: ReturnType<typeof bindCatalogCanvas>["stream"],
): PaintedBox[] {
  const boxes: PaintedBox[] = [];
  const stack: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let skip = 0;
  for (const cmd of stream.commands as unknown as Array<
    Record<string, unknown>
  >) {
    const type = cmd.type as number;
    if (skip > 0) {
      if (type === 0) skip++;
      else if (type === 4) skip--;
      continue;
    }
    if (type === 0) {
      if (!cmd.visible) {
        skip = 1;
        continue;
      }
      const parent = stack[stack.length - 1];
      const origin = {
        x: parent.x + (cmd.x as number),
        y: parent.y + (cmd.y as number),
      };
      stack.push(origin);
      if ((cmd.width as number) > 0 && (cmd.height as number) > 0)
        boxes.push({
          ...origin,
          width: cmd.width as number,
          height: cmd.height as number,
          text: false,
        });
    } else if (
      type === 1 &&
      cmd.nodeType === "text" &&
      // A text node that also paints a box (a Button's fill/border) is not a text region: its
      // glyphs are covered by the ink region, its fill stays L3.
      !(cmd.skiaData as { box?: unknown } | undefined)?.box
    ) {
      const origin = stack[stack.length - 1];
      boxes.push({
        ...origin,
        width: cmd.width as number,
        height: cmd.height as number,
        text: true,
      });
    } else if (type === 4) stack.pop();
  }
  return boxes;
}

describe("ADR-248 G3 palette-production-base old/new Canvas", () => {
  it("measures every frozen palette capture against the new Canvas leg", async (ctx) => {
    if (baselineAbsent) ctx.skip();
    const clip = replay.captureClip;
    if (!CHILD)
      expect(clip).toEqual(
        STATE
          ? { x: 320, y: 180, width: 800, height: 600 }
          : { x: 85, y: 95, width: 600, height: 400 },
      );
    const element = document.createElement("canvas");
    element.width = clip.width;
    element.height = clip.height;
    document.body.append(element);
    for (const row of replay.rows) {
      if (ONLY.size && !ONLY.has(caseKey(row))) continue;
      const entry: Record<string, unknown> = {
        ...(row.id ? { id: row.id, state: row.state } : {}),
        type: row.type,
        ...(row.axis ? { axis: row.axis } : {}),
        oldRef: row.ref,
        frozenPngMatch: row.frozenPngMatch,
      };
      results.push(entry);
      if (CHILD && row.status !== "AUTHORED") {
        Object.assign(entry, {
          verdict: "NOT_RUN",
          reason: `OLD_${row.status}`,
        });
        continue;
      }
      const target = route(row);
      if (!target) {
        Object.assign(entry, { verdict: "NOT_RUN", reason: "NO_TYPED_ROUTE" });
        continue;
      }
      entry.route = {
        source: target.source,
        definitionId: target.definitionId,
      };
      // Axis authoring: the axis prop is authored when the instance contract accepts it. The G0
      // axis list is the rule's D3 axes; a type whose contract has no such prop is run unedited
      // only when the old authoring was a no-op (frozen axis PNG = frozen base PNG) — otherwise
      // the old app consumed a prop the new contract lacks, and the case is not run.
      let axisProps: NodeEntry["props"] | undefined =
        __ADR248_REPLAY__ && row.type === "Icon" && row.recordedInput?.iconName
          ? { iconName: { kind: "set", value: row.recordedInput.iconName } }
          : undefined;
      if (row.axis) {
        const [prop, value] = row.axis.split(":");
        const definition = target.library.definitions.get(
          target.definitionId as never,
        );
        const contract = definition
          ? instanceContract(
              definition,
              (id) => target.library.definitions.get(id as never),
              (id) => target.library.templates.get(id as never),
            )
          : undefined;
        if (contract && prop in contract.accepts) {
          axisProps = { ...axisProps, [prop]: { kind: "set", value } };
          entry.axisAuthoring = "authored";
        } else if (axisPngSha.get(caseKey(row)) === basePngSha.get(row.type)) {
          entry.axisAuthoring =
            "prop not in contract; old authoring no-op (axis PNG = base PNG) — run unedited";
        } else {
          Object.assign(entry, {
            verdict: "NOT_RUN",
            reason: "AXIS_PROP_NOT_IN_CONTRACT_OLD_CONSUMED",
          });
          continue;
        }
      }
      // Live leg: the subject entry the real Builder authored for this case.
      let live:
        | {
            entry?: NodeEntry;
            definitionId: string;
            surface?: string;
            subtree?: Array<{ type: string; rect: Rect | null }>;
          }
        | undefined;
      if (LIVE) {
        try {
          live = JSON.parse(
            await commands.readFile(`${LIVE}/${caseKey(row)}.json`),
          ) as {
            entry?: NodeEntry;
            definitionId: string;
            surface?: string;
            subtree?: Array<{ type: string; rect: Rect | null }>;
          };
        } catch {
          Object.assign(entry, {
            verdict: "NOT_RUN",
            reason: "LIVE_NOT_CAPTURED",
          });
          continue;
        }
        entry.live = {
          definitionId: live.definitionId,
          routeMatches: live.definitionId === target.definitionId,
          // An item origin cannot stand in a page body (RAC content model): the live surface is
          // the origin view, whose surroundings are the workspace, not a page.
          surface: live.surface ?? "page",
          ...(live.entry ? { props: live.entry.props } : {}),
        };
      }
      let root: CatalogCompositionRoot;
      try {
        const runtime = new CatalogRuntime(
          new CatalogGraph(
            documentFor(
              target.definitionId,
              axisProps,
              row.host ?? (CHILD ? SECTION_HOSTS[row.id ?? ""] : undefined),
              live?.entry,
            ),
            target.library,
          ),
          new CatalogStorage(indexedDB, `adr248-g3-palette-${caseKey(row)}`),
        );
        root = new CatalogCompositionRoot(
          runtime,
          createLayoutEngine(),
          PAGE,
          undefined,
          undefined,
          catalogTextMeasure,
          FIXTURE_LOCALE,
        );
      } catch (error) {
        Object.assign(entry, {
          verdict: "NOT_RUN",
          reason: `ROOT_FAILED:${error instanceof Error ? error.message : error}`,
        });
        continue;
      }
      const rootInput = [...root.canvasInputs.values()].find(
        (input) => input.parentId === "catalog:root",
      )!;

      // ── geometry: page-absolute rects, structural pairing by child order ─────
      const relative = root.getGeometry(root.canvasInputs.keys());
      const absolute = new Map<string, Rect>();
      const place = (id: string, parentX: number, parentY: number) => {
        const rect = relative.get(id);
        if (!rect) return;
        const x = parentX + rect.x;
        const y = parentY + rect.y;
        absolute.set(id, { x, y, width: rect.width, height: rect.height });
        for (const child of root.canvasInputs.get(id)?.children ?? [])
          place(child, x, y);
      };
      place(rootInput.id, 0, 0);
      // Live leg: the real Builder's geometry of the same subject (depth-first from the subject
      // record) against this harness root — both are the product composition root.
      const liveSubtree = live?.subtree;
      if (liveSubtree) {
        const subjectId =
          CHILD && SECTION_HOSTS[row.id ?? ""]
            ? (root.canvasInputs.get(rootInput.id)?.children[0] ?? rootInput.id)
            : rootInput.id;
        const order: string[] = [];
        const walk = (id: string) => {
          order.push(id);
          for (const child of root.canvasInputs.get(id)?.children ?? [])
            walk(child);
        };
        walk(subjectId);
        let maxDelta = 0;
        const typeMismatch: string[] = [];
        order.forEach((id, index) => {
          const other = liveSubtree[index];
          const mine = absolute.get(id);
          if (
            !other ||
            root.typeOf(root.canvasInputs.get(id)!) !== other.type
          ) {
            typeMismatch.push(id);
            return;
          }
          if (mine && other.rect)
            maxDelta = Math.max(
              maxDelta,
              Math.abs(mine.x - other.rect.x),
              Math.abs(mine.y - other.rect.y),
              Math.abs(mine.width - other.rect.width),
              Math.abs(mine.height - other.rect.height),
            );
        });
        entry.liveGeometry = {
          harnessNodes: order.length,
          liveNodes: liveSubtree.length,
          typeMismatch: typeMismatch.slice(0, 8),
          maxDelta,
        };
      }
      const oldByPath = new Map(row.nodes.map((node) => [node.path, node]));
      // State origins sit in the Components page flow: old rects are compared with the old root
      // moved onto the new root's page position (relative geometry is what the fixture fixes).
      const newRootRect = absolute.get(rootInput.id);
      const oldRootRect = oldByPath.get("")?.rect;
      const oldShift =
        STATE && newRootRect && oldRootRect
          ? {
              x: newRootRect.x - oldRootRect.x,
              y: newRootRect.y - oldRootRect.y,
            }
          : { x: 0, y: 0 };
      const oldRectOf = (path: string): Rect | null => {
        if (CHILD)
          return (
            row.childLayouts?.find((child) => child.originId === path)
              ?.layout ?? null
          );
        const rect = oldByPath.get(path)?.rect;
        return rect
          ? { ...rect, x: rect.x + oldShift.x, y: rect.y + oldShift.y }
          : null;
      };
      // Old synthetic layout wrappers (`${id}__items`, implicitStyles) have no authored node: their
      // children pair with the new parent's children directly (the wrapper's effect stays in the
      // rects). Only that key is synthetic — an origin's own children (`${id}__label`) also
      // relativize to a `_`-prefixed path.
      // ADR-251: RadioGroup · CheckboxGroup now hold their items in a typed wrapper node
      // (RadioItems · CheckboxItems) — the old `_items` wrapper pairs with it instead.
      const oldSynthetic: string[] = [];
      const oldChildren = (path: string, keepItems = false): string[] =>
        row.nodes
          .filter((node) => node.parent === path)
          .flatMap((node) => {
            const segment = path ? node.path.slice(path.length + 1) : node.path;
            if (segment !== "_items" || keepItems) return [node.path];
            oldSynthetic.push(node.path);
            return oldChildren(node.path);
          });
      const pairs: Array<{ newId: string; oldPath: string; delta: number }> =
        [];
      const unpaired: string[] = [];
      const pair = (newId: string, oldPath: string) => {
        const next = absolute.get(newId);
        const old = oldRectOf(oldPath);
        const delta =
          next && old
            ? Math.max(
                Math.abs(next.x - old.x),
                Math.abs(next.y - old.y),
                Math.abs(next.width - old.width),
                Math.abs(next.height - old.height),
              )
            : Number.POSITIVE_INFINITY;
        pairs.push({ newId, oldPath, delta });
        // Nodes hidden at rest have no box, as in the old filtered layout tree.
        const shownOf = (id: string) =>
          (root.canvasInputs.get(id)?.children ?? []).filter(
            (child) => !root.canvasInputs.get(child)?.hidden,
          );
        // ADR-256 Phase 3: a toggle's RAC button (CheckboxButton) is a new node between the toggle
        // and its row (old: the toggle held the row) — its children pair with the old toggle's; the
        // button itself stays unpaired (APPROVED_UNPAIRED `toggle-button-node`).
        const shownKids = shownOf(newId).flatMap((child) => {
          if (
            !NEW_ROW_HOST_TYPES.includes(
              root.typeOf(root.canvasInputs.get(child)!),
            )
          )
            return [child];
          unpaired.push(`new:${child}`);
          return shownOf(child);
        });
        // A part node the owner draws (2026-10-04 — a toggle's indicator, a TreeItem's chevron)
        // has no old node: the old owner painted it in its own box. It stays out of the order
        // pairing (APPROVED_UNPAIRED).
        const newKids = shownKids.filter(
          (child) =>
            !OWNER_DRAWN_PART_TYPES.includes(
              root.typeOf(root.canvasInputs.get(child)!),
            ),
        );
        for (const child of shownKids)
          if (!newKids.includes(child)) unpaired.push(`new:${child}`);
        const oldKids = oldChildren(
          oldPath,
          newKids.some((child) =>
            ["RadioItems", "CheckboxItems"].includes(
              root.typeOf(root.canvasInputs.get(child)!),
            ),
          ),
        );
        // State origins: the typed template node keeps the old origin node ID
        // (`lib:template:<id>`), so children pair by that identity — a child the new consumers
        // hide (an unfilled `{icon}`) leaves its old box unpaired instead of shifting the order.
        const named = oldKids.some((path) => {
          const segment = path.split("/").pop()!;
          return !segment.startsWith("_") && !segment.includes("__");
        });
        if (
          STATE &&
          (!named ||
            replay.rows.some(
              (candidate) =>
                candidate.id ===
                (row as { variantOf?: string | null }).variantOf,
            ))
        ) {
          // A ref origin's old children are keyed by name (`Label`); they follow the base origin's
          // children order, whose keys are the node IDs (`<base>__label`). Without the base row in
          // the replay (IconButton, Link, Button refs) the children pair by order below.
          const baseRow = replay.rows.find(
            (candidate) =>
              candidate.id === (row as { variantOf?: string | null }).variantOf,
          );
          const baseKids = baseRow
            ? baseRow.nodes
                .filter((node) => node.parent === "")
                .map((node) => node.path)
            : [];
          const oldId = (path: string): string => {
            const segment = path.split("/").pop()!;
            if (segment.startsWith("_")) return `${row.id}_${segment}`;
            if (segment.includes("__")) return segment;
            const index = oldKids.indexOf(path);
            const base = baseKids[index];
            return base ? `${baseRow!.id}_${base}` : segment;
          };
          const newId = (id: string) =>
            id
              .split("::")
              .pop()!
              .replace(/^lib:template:/, "");
          const left = [...oldKids];
          for (const kid of newKids) {
            const match = left.findIndex((path) => oldId(path) === newId(kid));
            if (match < 0) {
              unpaired.push(`new:${kid}`);
              continue;
            }
            pair(kid, left[match]);
            left.splice(match, 1);
          }
          // An old zero-size box (the old layout's collapsed panel) is no box, like a hidden node.
          for (const path of left) {
            const rect = oldByPath.get(path)?.rect;
            if (rect && rect.width === 0 && rect.height === 0) continue;
            unpaired.push(`old:${path}`);
          }
          return;
        }
        for (
          let index = 0;
          index < Math.max(newKids.length, oldKids.length);
          index++
        ) {
          if (newKids[index] && oldKids[index])
            pair(newKids[index], oldKids[index]);
          else if (newKids[index]) unpaired.push(`new:${newKids[index]}`);
          else unpaired.push(`old:${oldKids[index]}`);
        }
      };
      // Child scene: each old child (parent-relative layout) with the typed node of the same origin
      // node ID; a child the old app laid out without a box and the new consumers hide agree.
      const noOldLayout: string[] = [];
      if (CHILD)
        for (const child of row.childLayouts ?? []) {
          if (!child.layout) {
            noOldLayout.push(child.originId);
            continue;
          }
          const newId = [...root.canvasInputs.keys()].find(
            (id) => id.split("::").pop() === `lib:template:${child.originId}`,
          );
          const zero = child.layout.width === 0 && child.layout.height === 0;
          if (!newId || root.canvasInputs.get(newId)?.hidden) {
            if (!zero) unpaired.push(`old:${child.originId}`);
            continue;
          }
          const next = relative.get(newId);
          const old = child.layout;
          pairs.push({
            newId,
            oldPath: child.originId,
            delta: next
              ? Math.max(
                  Math.abs(next.x - old.x),
                  Math.abs(next.y - old.y),
                  Math.abs(next.width - old.width),
                  Math.abs(next.height - old.height),
                )
              : Number.POSITIVE_INFINITY,
          });
        }
      else pair(rootInput.id, "");
      if (noOldLayout.length) entry.noOldLayout = noOldLayout;
      const worst = pairs.reduce((max, item) => Math.max(max, item.delta), 0);
      // Layout-input field differences (old engine input vs new) over every paired node.
      const inputDiffs: Array<{
        old: string;
        key: string;
        oldValue: unknown;
        newValue: unknown;
      }> = [];
      for (const item of pairs) {
        const oldInput = oldByPath.get(item.oldPath)?.engineInput;
        const newInput = root.getLayoutInput(item.newId);
        if (!oldInput || !newInput) continue;
        for (const key of new Set([
          ...Object.keys(oldInput),
          ...Object.keys(newInput),
        ])) {
          if (IGNORED_INPUT_KEYS.has(key)) continue;
          const a = normalizeInput(oldInput[key]);
          const b = normalizeInput(newInput[key]);
          if (a !== b)
            inputDiffs.push({
              old: item.oldPath,
              key,
              oldValue: oldInput[key] ?? null,
              newValue: newInput[key] ?? null,
            });
        }
      }
      entry.inputDiffs = inputDiffs;
      const geometry = {
        pairedNodes: pairs.length,
        maxDelta: worst,
        overOnePx: pairs
          .filter((item) => item.delta > 1)
          .slice(0, 12)
          .map((item) => ({
            new: item.newId,
            old: item.oldPath,
            newRect: (CHILD ? relative : absolute).get(item.newId) ?? null,
            oldRect: oldRectOf(item.oldPath),
            newInput: inputSummary(root, item.newId),
            oldEngineInput: oldByPath.get(item.oldPath)?.engineInput ?? null,
          })),
        unpaired: unpaired.slice(0, 12),
        unpairedCount: unpaired.length,
        oldSyntheticWrappers: oldSynthetic,
        pass: unpaired.length === 0 && worst <= 1,
      };
      entry.geometry = geometry;

      // ── new Canvas layout ↔ isolated RAC DOM geometry (same resolved values) ─────
      const domBoxIds = new Set<string>();
      /** Isolated DOM box of each marked node (page coordinates of the new leg). */
      const domBoxes = new Map<string, Rect>();
      try {
        const host = document.createElement("div");
        host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
        document.body.append(host);
        const reactRoot = createRoot(host);
        // Locale fixed for both legs like the font (`FIXTURE_LOCALE`): the DOM leg's surrounding
        // provider, the composition root's environment locale.
        flushSync(() =>
          reactRoot.render(
            createElement(I18nProvider, {
              locale: FIXTURE_LOCALE,
              children: renderCatalogDom(root, rootInput.id),
            }),
          ),
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const origin = host.getBoundingClientRect();
        const domOver: unknown[] = [];
        const domRects = new Map<string, Rect>();
        const domMissing: string[] = [];
        let domPairs = 0;
        let domWorst = 0;
        // Sub-parts a parent RAC component renders itself carry no marker: locate them by the
        // RAC default class (`react-aria-<Type>`) inside the nearest marked owner, by order
        // among the same-type records under that owner.
        const ownedSeen = new Map<string, number>();
        let ownedPairs = 0;
        const locate = (id: string): Element | null => {
          const node = root.canvasInputs.get(id)!;
          let owner = root.canvasInputs.get(node.parentId);
          while (owner && !catalogDomRendersNode(root, owner.id))
            owner = root.canvasInputs.get(owner.parentId);
          const ownerElement = owner
            ? host.querySelector(`[data-catalog-id="${CSS.escape(owner.id)}"]`)
            : null;
          if (!owner || !ownerElement) return null;
          const type = root.typeOf(node);
          const key = `${owner.id}|${type}`;
          const index = ownedSeen.get(key) ?? 0;
          ownedSeen.set(key, index + 1);
          // The typed child's DOM part in the owner's self-composed DOM (shared sub-part table).
          const candidates = [
            ...ownerElement.querySelectorAll(
              catalogSubpartDomSelectors(root.typeOf(owner), type).join(", "),
            ),
          ].filter((candidate) => !candidate.closest("[hidden]"));
          if (catalogSubpartDomUnion(root.typeOf(owner), type)) {
            unionOf.set(id, candidates);
            return candidates[0] ?? null;
          }
          return candidates[index] ?? null;
        };
        // Typed children standing for several DOM parts (range picker's start/end inputs).
        const unionOf = new Map<string, Element[]>();
        const boxOf = (id: string, element: Element) => {
          const parts = unionOf.get(id);
          if (!parts?.length) return element.getBoundingClientRect();
          const rects = parts.map((part) => part.getBoundingClientRect());
          const left = Math.min(...rects.map((rect) => rect.left));
          const top = Math.min(...rects.map((rect) => rect.top));
          const right = Math.max(...rects.map((rect) => rect.right));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));
          return { x: left, y: top, width: right - left, height: bottom - top };
        };
        // A node under a hidden-at-rest ancestor has no box in either consumer.
        const underHidden = (id: string): boolean => {
          for (
            let cursor = root.canvasInputs.get(id);
            cursor;
            cursor = root.canvasInputs.get(cursor.parentId)
          )
            if (cursor.hidden) return true;
          return false;
        };
        for (const [id, rect] of absolute) {
          if (underHidden(id)) continue;
          const marked = catalogDomRendersNode(root, id);
          let element = marked
            ? host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
            : locate(id);
          // The subject's box is the renderer's outermost element, which carries the authored
          // style (TagGroup renders RAC TagGroup inside a styled wrapper `div`). A `display:
          // contents` host (an orphan item's ListBox/TagList/Breadcrumbs) has no box of its own.
          if (element && id === rootInput.id)
            while (
              element.parentElement &&
              element.parentElement !== host &&
              getComputedStyle(element.parentElement).display !== "contents"
            )
              element = element.parentElement;
          if (id === rootInput.id && rootInput.bindingId === "menu")
            element = host.querySelector("button[aria-haspopup]");
          if (!element) {
            if (marked) domMissing.push(id);
            continue;
          }
          if (!marked) ownedPairs++;
          const box = boxOf(id, element);
          const dom = {
            x: box.x - origin.x,
            y: box.y - origin.y,
            width: box.width,
            height: box.height,
          };
          // display: contents markers have no box of their own.
          if (getComputedStyle(element).display === "contents") continue;
          domPairs++;
          const delta = Math.max(
            Math.abs(dom.x - rect.x),
            Math.abs(dom.y - rect.y),
            Math.abs(dom.width - rect.width),
            Math.abs(dom.height - rect.height),
          );
          domWorst = Math.max(domWorst, delta);
          domRects.set(id, dom);
          domBoxIds.add(id);
          domBoxes.set(id, dom);
          if (delta > 1 && domOver.length < 20)
            domOver.push({
              id,
              canvas: rect,
              dom,
              ...(marked ? {} : { owned: true }),
            });
        }
        // Diagnostic: `ADR248_DUMP_DOM=<Type>` writes the isolated DOM box tree of that type.
        if (__ADR248_DUMP_DOM__.split(",").includes(row.type)) {
          const lines: string[] = [];
          const walk = (element: Element, depth: number) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            lines.push(
              `${"  ".repeat(depth)}<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}" id="${element.getAttribute("data-catalog-id")?.split("::").pop() ?? ""}"> ${Math.round((box.x - origin.x) * 10) / 10},${Math.round((box.y - origin.y) * 10) / 10} ${Math.round(box.width * 10) / 10}x${Math.round(box.height * 10) / 10} display=${style.display} pad=${style.padding} border=${style.borderWidth} gap=${style.gap} flex=${style.flex} font=${style.fontSize}/${style.lineHeight}/${style.fontWeight} bg=${style.backgroundColor} fg=${style.color} before=${getComputedStyle(element, "::before").backgroundColor}${element.children.length ? "" : ` text="${(element.textContent ?? "").slice(0, 60)}"`} inline="${(element.getAttribute("style") ?? "").slice(0, 120)}" data="${[
                ...element.attributes,
              ]
                .filter(
                  (attribute) =>
                    attribute.name.startsWith("data-") &&
                    attribute.name !== "data-catalog-id",
                )
                .map((attribute) => `${attribute.name}=${attribute.value}`)
                .join(" ")}"`,
            );
            for (const child of element.children) walk(child, depth + 1);
          };
          walk(host, 0);
          await commands.writeFile(
            `${__ADR248_DUMP_DIR__}/dom-dump-${caseKey(row)}.txt`,
            lines.join("\n"),
          );
          await commands.writeFile(
            `${__ADR248_DUMP_DIR__}/canvas-dump-${caseKey(row)}.json`,
            JSON.stringify(
              [...root.canvasInputs.entries()].map(([id, input]) => ({
                id: id.split("::").pop(),
                rect: absolute.get(id),
                input,
              })),
              null,
              1,
            ),
          );
        }
        if (row.type === "Icon") {
          const icon = host.querySelector(".react-aria-Icon");
          const svg = icon?.querySelector("svg");
          if (icon && svg) {
            const box = icon.getBoundingClientRect();
            const glyph = svg.getBoundingClientRect();
            entry.iconDomGlyph = {
              x: glyph.x - box.x,
              y: glyph.y - box.y,
              width: glyph.width,
              height: glyph.height,
              box: { width: box.width, height: box.height },
              alignItems: getComputedStyle(icon).alignItems,
              justifyContent: getComputedStyle(icon).justifyContent,
            };
          }
        }
        if (
          replay.scenarioHash === SECTION_SUPPLEMENT_HASH &&
          row.type === "MenuSection" &&
          row.host === "Menu"
        ) {
          const trigger = host.querySelector<HTMLButtonElement>(
            "button[aria-haspopup]",
          );
          const hiddenSections = [...root.canvasInputs.values()].filter(
            (node) => root.typeOf(node) === "MenuSection",
          );
          const closed =
            !document.querySelector('[role="menu"]') &&
            hiddenSections.length === 1 &&
            hiddenSections.every((node) => node.hidden);
          trigger?.click();
          const deadline = performance.now() + 2000;
          while (
            document.querySelectorAll('[role="menuitem"]').length !== 2 &&
            performance.now() < deadline
          )
            await new Promise(requestAnimationFrame);
          const menu = document.querySelector('[role="menu"]');
          const labels = [
            ...document.querySelectorAll('[role="menuitem"]'),
          ].map((item) => item.textContent);
          const opened =
            labels.join("|") === "Item 1|Item 2" &&
            !!menu?.textContent?.includes("Section");
          menu?.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              bubbles: true,
            }),
          );
          const closeDeadline = performance.now() + 2000;
          while (
            document.querySelector('[role="menu"]') &&
            performance.now() < closeDeadline
          )
            await new Promise(requestAnimationFrame);
          entry.menuPresence = {
            closed,
            opened,
            labels,
            closedAgain: !document.querySelector('[role="menu"]'),
            triggerPaired: domBoxIds.has(rootInput.id),
          };
        }
        reactRoot.unmount();
        host.remove();
        entry.canvasDom = {
          pairedNodes: domPairs,
          ownedPairs,
          maxDelta: domWorst,
          overOnePx: domOver,
          // Old/new pairs over 1px, with the isolated DOM box of the same new node (the arbiter
          // when old and new disagree — breakdown §6.1 records the old side's asymmetry).
          geometryArbiter: geometry.overOnePx.map((item) => {
            const dom = domRects.get(item.new);
            if (!CHILD || !dom) return { new: item.new, dom: dom ?? null };
            // Child scene rects are parent-relative: the DOM box minus the parent's (the parent's
            // DOM box, else its Canvas box — the DOM contract holds it within 1px).
            const parentId = root.canvasInputs.get(item.new)?.parentId ?? "";
            const parent = domRects.get(parentId) ?? absolute.get(parentId);
            return {
              new: item.new,
              dom: parent
                ? { ...dom, x: dom.x - parent.x, y: dom.y - parent.y }
                : null,
            };
          }),
          missing: domMissing.slice(0, 12),
          missingCount: domMissing.length,
          pass: domMissing.length === 0 && domWorst <= 1,
        };
      } catch (error) {
        entry.canvasDom = {
          error: error instanceof Error ? error.message : String(error),
          pass: false,
        };
      }

      // Approved old/new differences (user 2026-09-30, `approvedDifferences.ts`): every over-1px
      // pair must match a rule of its owner and node type on the axes that differ; the Canvas ↔ DOM
      // leg still arbitrates the new side. One-sided nodes need their own structural rule.
      const approved: Array<{
        new: string;
        /** undefined means absent; the empty string is the real old root path. */
        old?: string;
        /** A primitive painted by the old owner before it became a child node. */
        oldPaintRect?: Rect;
        rule: string;
        class: string;
        /** Only the moved vertical edges changed (sub-pixel intrinsic width). */
        edges?: true;
        /** The whole old ∪ new box (an approved paint difference of the node). */
        whole?: true;
      }> = [];
      const unapproved: string[] = [];
      for (const item of pairs) {
        if (item.delta <= 1) {
          // Within the geometry tolerance, but its edge still paints differently (L3): the old
          // Canvas' rounded-up intrinsic width, where the new box is the DOM box.
          const newRect = absolute.get(item.newId);
          const oldRect = oldRectOf(item.oldPath);
          const dom = domBoxes.get(item.newId);
          if (
            newRect &&
            oldRect &&
            dom &&
            subpixelIntrinsicWidthCeil(oldRect, newRect, dom)
          )
            approved.push({
              new: item.newId,
              old: item.oldPath,
              rule: SUBPIXEL_INTRINSIC_WIDTH_CEIL.id,
              class: SUBPIXEL_INTRINSIC_WIDTH_CEIL.class,
              edges: true,
            });
          continue;
        }
        const newRect = (CHILD ? relative : absolute).get(item.newId);
        const oldRect = oldRectOf(item.oldPath);
        const node = inputSummary(root, item.newId).self?.type ?? "";
        const rule =
          newRect && oldRect
            ? (approvedDifference(
                row.type,
                node,
                oldRect,
                newRect,
                domBoxIds.has(item.newId),
              ) ??
              approvedSectionDifference(
                replay.scenarioHash,
                row.type,
                node,
                oldRect,
                newRect,
                domBoxIds.has(item.newId),
              ))
            : undefined;
        if (rule)
          approved.push({
            new: item.newId,
            old: item.oldPath,
            rule: rule.id,
            class: rule.class,
            ...(rule.paint ? { whole: true as const } : {}),
          });
        else unapproved.push(item.newId);
      }
      for (const item of unpaired) {
        const newId = item.startsWith("new:") ? item.slice(4) : undefined;
        const paintPair =
          STATE &&
          row.type === "Switch" &&
          newId &&
          root.canvasInputs.get(newId)?.bindingId === "switchindicator"
            ? switchIndicatorPaintPair(
                replay.scenarioHash,
                String(row.state ?? ""),
                oldRectOf(""),
                newRootRect,
                absolute.get(newId),
                domBoxes.get(newId),
              )
            : undefined;
        if (paintPair) {
          approved.push({
            new: newId!,
            oldPaintRect: paintPair.oldRect,
            rule: "switch-indicator-padding-translation",
            class: "oldDefect",
          });
          entry.switchIndicatorPaintPair = paintPair;
          continue;
        }
        if (
          STATE &&
          row.type === "Switch" &&
          newId &&
          root.canvasInputs.get(newId)?.bindingId === "switchindicator"
        ) {
          unapproved.push("switch-indicator-paint-pair");
          continue;
        }
        const rule = approvedUnpaired(
          row.type,
          item,
          (id) => inputSummary(root, id).self?.type ?? "",
        );
        if (rule)
          approved.push({
            new: item.startsWith("new:") ? item.slice(4) : "",
            old: item.startsWith("old:") ? item.slice(4) : undefined,
            rule: rule.id,
            class: rule.class,
          });
        else unapproved.push(item);
      }
      // A state origin whose old paint follows an old input the new model does not carry: the
      // root box's paint is that approved difference (geometry still arbitrates).
      const statePaint = STATE
        ? approvedStatePaint(row.type, String(row.state ?? ""))
        : undefined;
      if (statePaint)
        approved.push({
          new: rootInput.id,
          old: "",
          rule: statePaint.id,
          class: statePaint.class,
          whole: true,
        });
      const menuPresence = entry.menuPresence as
        | {
            closed?: boolean;
            opened?: boolean;
            closedAgain?: boolean;
            triggerPaired?: boolean;
          }
        | undefined;
      if (
        replay.scenarioHash === SECTION_SUPPLEMENT_HASH &&
        row.type === "MenuSection" &&
        !(
          menuPresence?.closed &&
          menuPresence.opened &&
          menuPresence.closedAgain &&
          menuPresence.triggerPaired
        )
      )
        unapproved.push("menu-presence-probe");
      const geometryPass = unapproved.length === 0;
      if (approved.length) {
        entry.approvedDifferences = approved;
        entry.approvedClasses = [
          ...new Set(approved.map((item) => item.class)),
        ];
        if (
          approved.some(
            (item) =>
              item.class === "previewFollow" || item.class === "bothDeviate",
          )
        )
          entry.previewDefectFollowed = true;
      }
      Object.assign(geometry, {
        strictPass: geometry.pass,
        pass: geometryPass,
        unapprovedCount: unapproved.length,
      });

      // Child scene: no frozen child PNG — geometry and the Canvas↔DOM contract decide.
      if (CHILD) {
        const failedLegs = [
          ...(!geometry.pass ? ["geometry"] : []),
          ...((entry.canvasDom as { pass?: boolean } | undefined)?.pass
            ? []
            : ["canvasDom"]),
        ];
        Object.assign(entry, {
          failedLegs,
          L3: { measured: false, reason: "NO_FROZEN_CHILD_PNG" },
          verdict: failedLegs.length ? "FAIL" : "UNVERIFIED",
        });
        continue;
      }

      // ── new Canvas leg: product binding → renderCommands on WebGL ────────────
      let bound: ReturnType<typeof bindCatalogCanvas>;
      try {
        bound = bindCatalogCanvas(root, [rootInput.id]);
      } catch (error) {
        Object.assign(entry, {
          verdict: "NOT_RUN",
          reason: `CANVAS_BIND_FAILED:${error instanceof Error ? error.message : error}`,
        });
        continue;
      }
      if (row.type === "Icon") {
        const dom = entry.iconDomGlyph as
          { x: number; y: number; width: number; height: number } | undefined;
        const icon = bound.stream.commands
          .map(
            (command) =>
              (
                command as unknown as {
                  skiaData?: {
                    iconPath?: { cx: number; cy: number; size: number };
                  };
                }
              ).skiaData?.iconPath,
          )
          .find(Boolean);
        if (dom && icon) {
          const canvas = {
            x: icon.cx - icon.size / 2,
            y: icon.cy - icon.size / 2,
            width: icon.size,
            height: icon.size,
          };
          const delta = Math.max(
            ...(["x", "y", "width", "height"] as const).map((key) =>
              Math.abs(dom[key] - canvas[key]),
            ),
          );
          entry.iconGlyphParity = {
            dom,
            canvas,
            maxDelta: delta,
            pass: delta <= 1,
          };
        } else
          entry.iconGlyphParity = { pass: false, reason: "MISSING_GLYPH_BOX" };
      }
      const surface = ck.MakeWebGLCanvasSurface(element);
      if (!surface) throw new Error("G3_WEBGL_SURFACE_UNAVAILABLE");
      let pixels: Uint8Array;
      let png: Uint8Array;
      let glyphless: Uint8Array;
      const { zoom, pan } = row.camera;
      // State: zoom-to-selection centered the old root in the canvas rect; the new root's
      // top-left is drawn where the old root's top-left was.
      const stateAnchor =
        STATE && oldRootRect && newRootRect && row.camera.canvasRect
          ? {
              x:
                row.camera.canvasRect.x +
                row.camera.canvasRect.width / 2 -
                (oldRootRect.width * zoom) / 2,
              y:
                row.camera.canvasRect.y +
                row.camera.canvasRect.height / 2 -
                (oldRootRect.height * zoom) / 2,
            }
          : null;
      const offset = stateAnchor
        ? {
            x: stateAnchor.x - newRootRect!.x * zoom - clip.x,
            y: stateAnchor.y - newRootRect!.y * zoom - clip.y,
          }
        : { x: pan.x - clip.x, y: pan.y - clip.y };
      try {
        // Pass 1 draws the leg; pass 2 draws it without a font manager (every text DRAW is
        // skipped, boxes stay): the pixels that differ are the leg's glyph ink.
        const draw = (fonts: boolean) => {
          const canvas = surface.getCanvas();
          canvas.clear(ck.WHITE);
          canvas.save();
          canvas.translate(offset.x, offset.y);
          canvas.scale(zoom, zoom);
          executeRenderCommands(
            ck,
            canvas,
            bound.stream.commands,
            new DOMRect(0, 0, PAGE.width, PAGE.height),
            fonts ? skiaFontManager.getFontMgr() : undefined,
          );
          canvas.restore();
          surface.flush();
          return surface.makeImageSnapshot();
        };
        const read = (image: ReturnType<typeof draw>) =>
          new Uint8Array(
            image.readPixels(0, 0, {
              width: clip.width,
              height: clip.height,
              colorType: ck.ColorType.RGBA_8888,
              alphaType: ck.AlphaType.Unpremul,
              colorSpace: ck.ColorSpace.SRGB,
            }) as Uint8Array,
          );
        const image = draw(true);
        pixels = read(image);
        png = image.encodeToBytes()!;
        image.delete();
        const bare = draw(false);
        glyphless = read(bare);
        bare.delete();
      } finally {
        surface.delete();
      }
      const boxes = paintedBoxes(bound.stream);
      bound.dispose();
      // Live leg: the compared pixels are the real Builder's capture; glyph ink stays the harness
      // render's (the same document), and the two renders are recorded against each other.
      const harnessPixels = pixels;
      if (LIVE) {
        const capture = decodePng(
          await commands.readFile(`${LIVE}/${caseKey(row)}.png`, "base64"),
        );
        expect([capture.width, capture.height]).toEqual([
          clip.width,
          clip.height,
        ]);
        const livePixels = capture.pixels;
        for (let index = 3; index < livePixels.length; index += 4)
          livePixels[index] = 255;
        const opaque = new Uint8Array(harnessPixels);
        for (let index = 3; index < opaque.length; index += 4)
          opaque[index] = 255;
        // Origin view: only the component's own box is the same surface in both renders; its
        // surroundings are the workspace, so the verdict keeps the harness render (as Phase 3).
        const definitionView = live?.surface === "definition-view";
        // State: only the fixture region is compared, so the identity reads the root box too.
        const box =
          (definitionView || STATE) && newRootRect
            ? {
                x0: Math.max(0, Math.floor(offset.x + newRootRect.x * zoom)),
                y0: Math.max(0, Math.floor(offset.y + newRootRect.y * zoom)),
                x1: Math.min(
                  clip.width,
                  Math.ceil(
                    offset.x + (newRootRect.x + newRootRect.width) * zoom,
                  ),
                ),
                y1: Math.min(
                  clip.height,
                  Math.ceil(
                    offset.y + (newRootRect.y + newRootRect.height) * zoom,
                  ),
                ),
              }
            : { x0: 0, y0: 0, x1: clip.width, y1: clip.height };
        const width = box.x1 - box.x0;
        const height = box.y1 - box.y0;
        const crop = (source: Uint8Array) => {
          const out = new Uint8Array(width * height * 4);
          for (let y = 0; y < height; y++)
            out.set(
              source.subarray(
                ((box.y0 + y) * clip.width + box.x0) * 4,
                ((box.y0 + y) * clip.width + box.x1) * 4,
              ),
              y * width * 4,
            );
          return out;
        };
        const a = crop(opaque);
        const b = crop(livePixels);
        let identityMaxByte = 0;
        for (let index = 0; index < a.length; index++)
          if ((index & 3) !== 3)
            identityMaxByte = Math.max(
              identityMaxByte,
              Math.abs(a[index] - b[index]),
            );
        const identityDifferent =
          width && height
            ? pixelmatch(a, b, undefined, width, height, { threshold: 0.1 })
            : 0;
        entry.liveIdentity = {
          region: definitionView || STATE ? "root box" : "capture clip",
          pixels: width * height,
          different: identityDifferent,
          ratio: width * height ? identityDifferent / (width * height) : 0,
          maxByte: identityMaxByte,
        };
        if (!definitionView) pixels = livePixels;
      }
      await commands.writeFile(
        `${PNG_DIR}/${caseKey(row)}.png`,
        toBase64(png),
        "base64",
      );

      // ── regions: text boxes (L4) > L3e band > L3 non-text ─────────────────
      const oldBase64 = await commands.readFile(
        `${__ADR248_OLD_PNG_DIR__ || `${FROZEN}/canvas`}/${caseKey(row)}.png`,
        "base64",
      );
      if (__ADR248_REPLAY__) {
        const bytes = Uint8Array.from(atob(oldBase64), (char) =>
          char.charCodeAt(0),
        );
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const sha = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        expect(sha, "supplement PNG must match its recorded observation").toBe(
          row.pngSha256,
        );
      }
      const old = decodePng(oldBase64);
      expect([old.width, old.height]).toEqual([clip.width, clip.height]);
      for (let index = 3; index < old.pixels.length; index += 4)
        old.pixels[index] = 255;
      for (let index = 3; index < pixels.length; index += 4)
        pixels[index] = 255;
      const toClip = (box: Rect): Rect => ({
        x: offset.x + box.x * zoom,
        y: offset.y + box.y * zoom,
        width: box.width * zoom,
        height: box.height * zoom,
      });
      const kind = new Uint8Array(clip.width * clip.height); // 0 L3, 1 L3e, 2 text, 3 context
      // Text region: glyph ink grown by the geometry tolerance (1 CSS px at this zoom, +1 AA).
      const grow = Math.ceil(zoom) + 1;
      const ink: number[] = [];
      for (let index = 0; index < clip.width * clip.height; index++)
        if (
          harnessPixels[index * 4] !== glyphless[index * 4] ||
          harnessPixels[index * 4 + 1] !== glyphless[index * 4 + 1] ||
          harnessPixels[index * 4 + 2] !== glyphless[index * 4 + 2]
        )
          ink.push(index);
      for (const index of ink) {
        const cx = index % clip.width;
        const cy = Math.floor(index / clip.width);
        for (
          let y = Math.max(0, cy - grow);
          y <= Math.min(clip.height - 1, cy + grow);
          y++
        )
          for (
            let x = Math.max(0, cx - grow);
            x <= Math.min(clip.width - 1, cx + grow);
            x++
          )
            kind[y * clip.width + x] = 2;
      }
      for (const box of boxes) {
        const r = toClip(box);
        if (box.text) {
          const x0 = Math.max(0, Math.floor(r.x));
          const y0 = Math.max(0, Math.floor(r.y));
          const x1 = Math.min(clip.width, Math.ceil(r.x + r.width));
          const y1 = Math.min(clip.height, Math.ceil(r.y + r.height));
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) kind[y * clip.width + x] = 2;
          continue;
        }
        const x0 = Math.max(0, Math.floor(r.x - EDGE_BAND));
        const y0 = Math.max(0, Math.floor(r.y - EDGE_BAND));
        const x1 = Math.min(clip.width, Math.ceil(r.x + r.width + EDGE_BAND));
        const y1 = Math.min(clip.height, Math.ceil(r.y + r.height + EDGE_BAND));
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const inner =
              x >= r.x + EDGE_BAND &&
              x + 1 <= r.x + r.width - EDGE_BAND &&
              y >= r.y + EDGE_BAND &&
              y + 1 <= r.y + r.height - EDGE_BAND;
            const index = y * clip.width + x;
            if (!inner && kind[index] === 0) kind[index] = 1;
          }
      }
      // State: pixels outside the fixture (old ∪ new root box + margin) are neighboring origins.
      let fixtureRegion: Rect | null = null;
      if (STATE && oldRootRect && newRootRect) {
        const margin = STATE_REGION_MARGIN;
        const oldBox = toClip({
          ...oldRectOf("")!,
          x: oldRectOf("")!.x - margin,
          y: oldRectOf("")!.y - margin,
          width: oldRootRect.width + margin * 2,
          height: oldRootRect.height + margin * 2,
        });
        const newBox = toClip({
          x: newRootRect.x - margin,
          y: newRootRect.y - margin,
          width: newRootRect.width + margin * 2,
          height: newRootRect.height + margin * 2,
        });
        const x0 = Math.max(0, Math.floor(Math.min(oldBox.x, newBox.x)));
        const y0 = Math.max(0, Math.floor(Math.min(oldBox.y, newBox.y)));
        const x1 = Math.min(
          clip.width,
          Math.ceil(Math.max(oldBox.x + oldBox.width, newBox.x + newBox.width)),
        );
        const y1 = Math.min(
          clip.height,
          Math.ceil(
            Math.max(oldBox.y + oldBox.height, newBox.y + newBox.height),
          ),
        );
        fixtureRegion = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
        for (let y = 0; y < clip.height; y++)
          for (let x = 0; x < clip.width; x++)
            if (x < x0 || x >= x1 || y < y0 || y >= y1)
              kind[y * clip.width + x] = 3;
      }
      const diff = new Uint8ClampedArray(clip.width * clip.height * 4);
      pixelmatch(old.pixels, pixels, diff, clip.width, clip.height, {
        threshold: 0.1,
        diffMask: true,
      });
      const regions = [0, 1, 2, 3].map(() => ({
        pixels: 0,
        different: 0,
        maxByte: 0,
        bounds: null as null | [number, number, number, number],
      }));
      for (let index = 0; index < clip.width * clip.height; index++) {
        const region = regions[kind[index]];
        region.pixels++;
        for (let channel = 0; channel < 3; channel++)
          region.maxByte = Math.max(
            region.maxByte,
            Math.abs(
              old.pixels[index * 4 + channel] - pixels[index * 4 + channel],
            ),
          );
        if (diff[index * 4 + 3]) {
          region.different++;
          const x = index % clip.width;
          const y = Math.floor(index / clip.width);
          region.bounds = region.bounds
            ? [
                Math.min(region.bounds[0], x),
                Math.min(region.bounds[1], y),
                Math.max(region.bounds[2], x),
                Math.max(region.bounds[3], y),
              ]
            : [x, y, x, y];
        }
      }
      const metric = (region: (typeof regions)[number]) => ({
        pixels: region.pixels,
        different: region.different,
        ratio: region.pixels ? region.different / region.pixels : 0,
        maxByte: region.maxByte,
        diffBounds: region.bounds,
      });
      const l3 = metric(regions[0]);
      // Non-text differences an approved geometry difference explains are attributed to it; the
      // rest of L3 still blocks. A box change explains the pixels its edges and corners sweep:
      // the part of the old ∪ new box outside the other box, plus a band along each box edge
      // (geometry tolerance + the corner arc depth, 0.3 × radius). The interior both boxes cover
      // keeps its paint (fill/border colour) — a paint change there is not a geometry difference.
      // A glyph leaf (its drawing scales with its box) or a node on one side only owns all of its
      // pixels; any other box keeps its fill/border paint inside.
      let attributed = 0;
      let outsideMaxByte = 0;
      /** Boxes an approved paint difference owns whole (the moved-paint compare skips them). */
      const wholeBoxes: Rect[] = [];
      if (approved.length) {
        const inside = new Uint8Array(clip.width * clip.height);
        wholeBoxes.length = 0;
        const fill = (x0: number, y0: number, x1: number, y1: number) => {
          for (
            let y = Math.max(0, Math.floor(y0));
            y < Math.min(clip.height, Math.ceil(y1));
            y++
          )
            for (
              let x = Math.max(0, Math.floor(x0));
              x < Math.min(clip.width, Math.ceil(x1));
              x++
            )
              inside[y * clip.width + x] = 1;
        };
        for (const item of approved) {
          const rects = [
            item.oldPaintRect ??
              (item.old === undefined ? undefined : oldRectOf(item.old)),
            item.new ? absolute.get(item.new) : undefined,
          ]
            .filter((rect): rect is Rect => !!rect)
            .map(toClip);
          const node = item.new ? root.canvasInputs.get(item.new) : undefined;
          if (item.oldPaintRect) {
            // A translated primitive changes the overlap too (e.g. the Switch thumb).
            // Attribute the footprint, but do NOT add it to wholeBoxes: the translated
            // old/new paint below must still match and can fail this row.
            for (const r of rects)
              fill(
                r.x - grow,
                r.y - grow,
                r.x + r.width + grow,
                r.y + r.height + grow,
              );
            continue;
          }
          if (item.whole) {
            for (const r of rects) {
              fill(
                r.x - grow,
                r.y - grow,
                r.x + r.width + grow,
                r.y + r.height + grow,
              );
              wholeBoxes.push(r);
            }
            continue;
          }
          if (item.edges && rects.length === 2) {
            const [a, b] = rects;
            const radius = node?.visual.radius;
            const band =
              grow +
              Math.ceil(
                0.3 *
                  Math.min(
                    typeof radius === "number" ? radius * zoom : Infinity,
                    Math.min(b.width, b.height) / 2,
                  ),
              );
            for (const edge of [
              ...(Math.abs(a.x - b.x) > 0.01 ? [a.x, b.x] : []),
              ...(Math.abs(a.x + a.width - (b.x + b.width)) > 0.01
                ? [a.x + a.width, b.x + b.width]
                : []),
            ])
              fill(
                edge - band,
                Math.min(a.y, b.y) - grow,
                edge + band,
                Math.max(a.y + a.height, b.y + b.height) + grow,
              );
            continue;
          }
          if (
            rects.length === 2 &&
            node &&
            TEXT_BINDINGS.has(node.bindingId ?? "")
          ) {
            const clamp = (r: Rect) => ({
              x0: Math.max(0, Math.floor(r.x - grow)),
              y0: Math.max(0, Math.floor(r.y - grow)),
              x1: Math.min(clip.width, Math.ceil(r.x + r.width + grow)),
              y1: Math.min(clip.height, Math.ceil(r.y + r.height + grow)),
            });
            const mode = (image: Uint8Array, r: Rect) => {
              const b = clamp(r);
              const counts = new Map<number, number>();
              for (let y = b.y0; y < b.y1; y++)
                for (let x = b.x0; x < b.x1; x++) {
                  const i = (y * clip.width + x) * 4;
                  const key =
                    (image[i] << 16) | (image[i + 1] << 8) | image[i + 2];
                  counts.set(key, (counts.get(key) ?? 0) + 1);
                }
              let best = 0;
              let bestCount = -1;
              for (const [key, count] of counts)
                if (count > bestCount) [best, bestCount] = [key, count];
              return [(best >> 16) & 255, (best >> 8) & 255, best & 255];
            };
            const [a, b] = rects;
            const oldMode = mode(old.pixels, a);
            const newMode = mode(pixels, b);
            const ink = (image: Uint8Array, index: number, colour: number[]) =>
              Math.max(
                Math.abs(image[index * 4] - colour[0]),
                Math.abs(image[index * 4 + 1] - colour[1]),
                Math.abs(image[index * 4 + 2] - colour[2]),
              ) > INK_DISTANCE;
            for (const r of rects) {
              const box = clamp(r);
              for (let y = box.y0; y < box.y1; y++)
                for (let x = box.x0; x < box.x1; x++) {
                  const index = y * clip.width + x;
                  if (
                    ink(old.pixels, index, oldMode) ||
                    ink(pixels, index, newMode)
                  )
                    inside[index] = 1;
                }
            }
            continue;
          }
          // A glyph leaf (icon, avatar/image) scales its drawing with its box: all its pixels.
          if (
            rects.length < 2 ||
            !node ||
            GLYPH_BINDINGS.has(node.bindingId ?? "")
          ) {
            for (const r of rects)
              fill(
                r.x - grow,
                r.y - grow,
                r.x + r.width + grow,
                r.y + r.height + grow,
              );
            continue;
          }
          const radius = node.visual.radius;
          const [a, b] = rects;
          const arc =
            typeof radius === "number"
              ? 0.3 * Math.min(radius * zoom, Math.min(b.width, b.height) / 2)
              : (0.3 * Math.min(b.width, b.height)) / 2;
          const band = grow + Math.ceil(arc);
          for (const r of rects) {
            fill(r.x - band, r.y - band, r.x + r.width + band, r.y + band);
            fill(
              r.x - band,
              r.y + r.height - band,
              r.x + r.width + band,
              r.y + r.height + band,
            );
            fill(r.x - band, r.y - band, r.x + band, r.y + r.height + band);
            fill(
              r.x + r.width - band,
              r.y - band,
              r.x + r.width + band,
              r.y + r.height + band,
            );
          }
          // Old ∪ new minus old ∩ new.
          for (const [r, other] of [
            [a, b],
            [b, a],
          ] as const) {
            fill(r.x, r.y, Math.min(r.x + r.width, other.x), r.y + r.height);
            fill(
              Math.max(r.x, other.x + other.width),
              r.y,
              r.x + r.width,
              r.y + r.height,
            );
            fill(r.x, r.y, r.x + r.width, Math.min(r.y + r.height, other.y));
            fill(
              r.x,
              Math.max(r.y, other.y + other.height),
              r.x + r.width,
              r.y + r.height,
            );
          }
        }
        for (let index = 0; index < clip.width * clip.height; index++) {
          if (kind[index] !== 0) continue;
          if (inside[index]) {
            if (diff[index * 4 + 3]) attributed++;
          } else
            for (let channel = 0; channel < 3; channel++)
              outsideMaxByte = Math.max(
                outsideMaxByte,
                Math.abs(
                  old.pixels[index * 4 + channel] - pixels[index * 4 + channel],
                ),
              );
        }
      }
      // A moved (not resized) approved node keeps its paint: its new box is compared with its old
      // box shifted by the move (pixelmatch 0.1, the box edge band excluded — geometry). A paint
      // change there is not the approved difference and blocks like any other L3 difference.
      let movedPixels = 0;
      let movedDifferent = 0;
      let movedMaxByte = 0;
      for (const item of approved) {
        if (item.edges || item.whole || !item.new) continue;
        const oldCss =
          item.oldPaintRect ??
          (item.old === undefined ? undefined : oldRectOf(item.old));
        const newCss = absolute.get(item.new);
        if (!oldCss || !newCss) continue;
        if (
          Math.abs(oldCss.width - newCss.width) > 1 ||
          Math.abs(oldCss.height - newCss.height) > 1
        )
          continue;
        const a = toClip(oldCss);
        const b = toClip(newCss);
        const dx = Math.round(b.x - a.x);
        const dy = Math.round(b.y - a.y);
        if (dx === 0 && dy === 0) continue;
        const inset = grow + 1;
        const x0 = Math.max(0, Math.ceil(b.x) + inset, inset + dx);
        const y0 = Math.max(0, Math.ceil(b.y) + inset, inset + dy);
        const x1 = Math.min(
          clip.width,
          Math.floor(b.x + Math.min(a.width, b.width)) - inset,
          clip.width + dx,
        );
        const y1 = Math.min(
          clip.height,
          Math.floor(b.y + Math.min(a.height, b.height)) - inset,
          clip.height + dy,
        );
        if (x1 <= x0 || y1 <= y0) continue;
        const width = x1 - x0;
        const height = y1 - y0;
        const before = new Uint8Array(width * height * 4);
        const after = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const target = ((y0 + y) * clip.width + (x0 + x)) * 4;
            const source = ((y0 + y - dy) * clip.width + (x0 + x - dx)) * 4;
            const local = (y * width + x) * 4;
            for (let channel = 0; channel < 4; channel++) {
              before[local + channel] = old.pixels[source + channel];
              after[local + channel] = pixels[target + channel];
            }
          }
        const movedDiff = new Uint8ClampedArray(width * height * 4);
        pixelmatch(before, after, movedDiff, width, height, {
          threshold: 0.1,
          diffMask: true,
        });
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const index = (y0 + y) * clip.width + (x0 + x);
            // Text and the other legs' pixels, and pixels another approved pair's sweep owns.
            if (kind[index] !== 0 || kind[index - dy * clip.width - dx] !== 0)
              continue;
            const px = x0 + x;
            const py = y0 + y;
            if (
              wholeBoxes.some(
                (r) =>
                  px >= r.x &&
                  px < r.x + r.width &&
                  py >= r.y &&
                  py < r.y + r.height,
              )
            )
              continue;
            movedPixels++;
            const local = (y * width + x) * 4;
            if (!movedDiff[local + 3]) continue;
            movedDifferent++;
            for (let channel = 0; channel < 3; channel++)
              movedMaxByte = Math.max(
                movedMaxByte,
                Math.abs(before[local + channel] - after[local + channel]),
              );
          }
      }
      const outsideRatio = l3.pixels
        ? (l3.different - attributed + movedDifferent) / l3.pixels
        : 0;
      outsideMaxByte = Math.max(outsideMaxByte, movedMaxByte);
      const l3Blocked = approved.length
        ? outsideRatio > NON_TEXT.maxDiffRatio &&
          outsideMaxByte > NON_TEXT.maxByte
        : l3.ratio > NON_TEXT.maxDiffRatio && l3.maxByte > NON_TEXT.maxByte;
      entry.L3 = {
        ...l3,
        ...(approved.length
          ? {
              approvedAttributed: attributed,
              movedPaint: {
                pixels: movedPixels,
                different: movedDifferent,
                maxByte: movedMaxByte,
              },
              outsideRatio,
              outsideMaxByte,
            }
          : {}),
        blocked: l3Blocked,
      };
      entry.L3e = { ...metric(regions[1]), gated: false };
      entry.text = { ...metric(regions[2]), gated: false };
      if (fixtureRegion)
        entry.fixtureRegion = {
          clip: fixtureRegion,
          context: { ...metric(regions[3]), compared: false },
        };
      // G3: old/new geometry, the new Canvas ↔ isolated DOM contract and non-text L3 each block;
      // with all three clear the type is PASS (L3e is recorded, not a completion condition).
      // An old input the G0 capture did not record makes L3 compare two different drawings.
      const l3InputMismatch =
        __ADR248_REPLAY__ && row.type === "Icon" && row.recordedInput?.iconName
          ? undefined
          : OLD_UNRECORDED_INPUT[row.type];
      if (row.recordedInput) entry.recordedInput = row.recordedInput;
      if (l3InputMismatch)
        entry.L3 = {
          ...(entry.L3 as object),
          gated: false,
          inputMismatch: l3InputMismatch,
        };
      const failedLegs = [
        ...(!geometry.pass ? ["geometry"] : []),
        ...((entry.canvasDom as { pass?: boolean } | undefined)?.pass
          ? []
          : ["canvasDom"]),
        ...(l3Blocked && !l3InputMismatch ? ["L3"] : []),
        ...(row.type === "Icon" &&
        !(entry.iconGlyphParity as { pass?: boolean })?.pass
          ? ["iconGlyph"]
          : []),
      ];
      entry.failedLegs = failedLegs;
      entry.verdict = failedLegs.length
        ? "FAIL"
        : l3InputMismatch
          ? "UNVERIFIED"
          : "PASS";
      if (!row.frozenPngMatch)
        entry.oldOracleNote =
          "replay PNG differs from the frozen PNG (old nondeterminism); geometry oracle is the replay state";
    }
    element.remove();
    const requested = replay.rows.filter(
      (row) => !ONLY.size || ONLY.has(caseKey(row)),
    );
    expect(results.length).toBe(requested.length);
    if (ONLY.size)
      expect(requested.length, "unknown G3 case key").toBe(ONLY.size);
    expect(
      (results as Array<{ verdict: string }>).filter(
        (row) => row.verdict === "FAIL",
      ),
      "G3 failed legs",
    ).toEqual([]);
  }, 600_000);
});

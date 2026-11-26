// @vitest-environment node
import "fake-indexeddb/auto";
import type { CanvasKit } from "canvaskit-wasm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { skiaFontManager } from "../../workspace/canvas/skia/fontManager";
import { initCanvasKit } from "../../workspace/canvas/skia/initCanvasKit";
import { CatalogCanvasScene } from "../canvasScene";
import type { CatalogTextFont, CatalogTextRunFont } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import {
  catalogMeasureParagraphHoldStats,
  catalogTextMeasure,
  resetCatalogMeasureParagraphHoldStats,
} from "../textMeasure";
import { createCatalogTextMeasureCache } from "../textMeasureCache";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-319 Phase 3 (Decision 3 · G3) — a size preview keeps one shaped paragraph per text leaf and
 * lays it out again per width. The real CanvasKit 0.42 + Pretendard measure:
 * - the held measure = a new paragraph's measure, narrow → wide → narrow, for the same · distinct ·
 *   RichText runs · token chip · letter spacing · Hangul fixtures (through the numeric cache too);
 * - the hold's owners: a text edit's previews hold nothing, a drag holds ≤ its measured leaves,
 *   every close (commit · cancel · new root · font change · dispose) holds 0 with made = deleted;
 * - a leaf whose text changes deletes its old paragraph in place.
 */
const require = createRequire(import.meta.url);
async function canvasKit(): Promise<CanvasKit> {
  const bin = dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
  const initialize = require(join(bin, "canvaskit.js")) as (options: {
    locateFile(file: string): string;
  }) => Promise<CanvasKit>;
  return initialize({ locateFile: (file) => join(bin, file) });
}
beforeAll(async () => {
  const ck = await canvasKit();
  Object.assign(globalThis, {
    window: { __composition_CANVASKIT_INSTANCE__: ck },
  });
  await initCanvasKit();
  const bytes = readFileSync(
    resolve(process.cwd(), "public/fonts/PretendardVariable.ttf"),
  );
  skiaFontManager.loadFontFromBuffer(
    "Pretendard",
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  expect(skiaFontManager.hasFont("Pretendard")).toBe(true);
}, 60_000);
afterEach(() => resetCatalogMeasureParagraphHoldStats());

const font = (extra: Partial<CatalogTextFont> = {}): CatalogTextFont => ({
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.5,
  fontFamily: "Pretendard",
  locale: "ko-KR",
  ...extra,
});
const FIXTURES: {
  name: string;
  text: string;
  font: CatalogTextFont;
  runs?: CatalogTextRunFont[];
}[] = [
  {
    name: "mixed",
    text: "같은 문단을 서로 다른 폭에서 줄바꿈합니다. Weekly revenue increased in every region.",
    font: font({ fontSize: 16, lineHeight: 1.2 }),
  },
  {
    name: "hangul",
    text: "대량 데이터 화면의 목록과 표와 상세를 만드는 고객은 글자 수백에서 천 개를 담은 상자를 흔히 쓴다",
    font: font(),
  },
  {
    name: "letterSpacing",
    text: "Weekly revenue increased in every region order status shipped 주간 매출",
    font: font({ letterSpacing: 1.5 }),
  },
  {
    name: "bold",
    text: "주간 매출은 모든 지역에서 증가했다 Weekly revenue increased in every region",
    font: font({ fontWeight: 700 }),
  },
  {
    name: "runs",
    text: "앞 글자 굵고 큰 구간 그리고 뒤 글자가 이어져서 여러 줄로 나뉜다 Weekly revenue",
    font: font(),
    runs: [
      { start: 5, end: 13, fontSize: 28, fontWeight: 700 },
      { start: 30, end: 36, fontWeight: 600 },
    ],
  },
  {
    name: "chip",
    text: "필터 status pending 그리고 region 서울 조건으로 검색한 결과 목록",
    font: font(),
    runs: [
      { start: 3, end: 9, inset: 6 },
      { start: 23, end: 29, inset: 6 },
    ],
  },
  ...Array.from({ length: 20 }, (_, i) => ({
    name: `distinct-${i}`,
    text: `${i}번 ${"주간 매출은 Weekly revenue 모든 지역에서 increased 데이터 목록 검색 결과"
      .split(" ")
      .slice(i % 5)
      .join(" ")} 끝 ${i * 37}`,
    font: font(),
  })),
];
const WIDTHS = [95, 400, 95, 250, 600, 120, 95, 333.3, 47, 1000, 95];

describe("ADR-319 G3 — the held measure = a new paragraph's", () => {
  it("every fixture, narrow → wide → narrow, at the source", () => {
    const release = catalogTextMeasure.hold!();
    try {
      for (const fixture of FIXTURES)
        for (const width of [undefined, ...WIDTHS]) {
          const held = catalogTextMeasure(
            fixture.text,
            fixture.font,
            width,
            fixture.runs,
            fixture.name,
          );
          const fresh = catalogTextMeasure(
            fixture.text,
            fixture.font,
            width,
            fixture.runs,
          );
          expect([fixture.name, width, held]).toEqual([
            fixture.name,
            width,
            fresh,
          ]);
        }
      // (One paragraph per leaf, shaped once.)
      expect(catalogMeasureParagraphHoldStats()).toMatchObject({
        held: FIXTURES.length,
        made: FIXTURES.length,
        deleted: 0,
      });
    } finally {
      release();
    }
    expect(catalogMeasureParagraphHoldStats()).toMatchObject({
      held: 0,
      made: FIXTURES.length,
      deleted: FIXTURES.length,
    });
  });
  it("through the numeric cache (its key keeps the width)", () => {
    const fresh = FIXTURES.map((fixture) =>
      WIDTHS.map((width) =>
        catalogTextMeasure(fixture.text, fixture.font, width, fixture.runs),
      ),
    );
    const cache = createCatalogTextMeasureCache(catalogTextMeasure);
    const release = cache.measure.hold!();
    try {
      const held = FIXTURES.map((fixture) =>
        WIDTHS.map((width) =>
          cache.measure(
            fixture.text,
            fixture.font,
            width,
            fixture.runs,
            fixture.name,
          ),
        ),
      );
      expect(held).toEqual(fresh);
      // (The widths differ: a narrow and a wide width do not give one height.)
      expect(
        new Set(held[0]!.map((value) => value.height)).size,
      ).toBeGreaterThan(1);
    } finally {
      release();
    }
  });
  it("a leaf whose text changes deletes its old paragraph in place", () => {
    const release = catalogTextMeasure.hold!();
    try {
      // (One font object per leaf, as the re-wrap's leaf memo keeps it — `rewrapLeaf`.)
      const first = font();
      const second = font();
      catalogTextMeasure("첫 글자 first", first, 80, undefined, "leaf");
      catalogTextMeasure("둘째 글자 second", second, 80, undefined, "leaf");
      catalogTextMeasure("둘째 글자 second", second, 120, undefined, "leaf");
      expect(catalogMeasureParagraphHoldStats()).toMatchObject({
        held: 1,
        made: 2,
        deleted: 1,
      });
    } finally {
      release();
    }
    expect(catalogMeasureParagraphHoldStats()).toMatchObject({
      held: 0,
      deleted: 2,
    });
  });
  it("holds nest: the last release deletes; a second call of a release does nothing", () => {
    const outer = catalogTextMeasure.hold!();
    const inner = catalogTextMeasure.hold!();
    catalogTextMeasure("글자 text", font(), 60, undefined, "a");
    inner();
    inner();
    expect(catalogMeasureParagraphHoldStats().held).toBe(1);
    outer();
    expect(catalogMeasureParagraphHoldStats()).toMatchObject({
      held: 0,
      made: 1,
      deleted: 1,
    });
  });
  it("without a hold nothing is kept (a measure outside a size preview)", () => {
    catalogTextMeasure("글자 text", font(), 60, undefined, "a");
    expect(catalogMeasureParagraphHoldStats()).toMatchObject({
      held: 0,
      made: 0,
    });
  });
});

describe("ADR-319 G3 — the hold's owners and closes", () => {
  const BODY = "project:node:home-body" as NodeId;
  const WRAP = "project:node:wrap" as NodeId;
  const set = <T>(value: T) => ({ kind: "set" as const, value });
  const N = 24;
  async function open() {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:adr319-hold" as EntryId<"project">,
          name: "Hold",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr319-hold-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1600, height: 1200 },
        autosaveSchedule: () => {},
        textMeasure: catalogTextMeasure,
        locale: "ko-KR",
      },
    );
    const texts = Array.from(
      { length: N },
      (_, i) =>
        ({
          kind: "node",
          id: `project:node:t${i}`,
          definitionId: "lib:definition:text",
          children: [],
          props: {
            children: set(
              `${i}번 주간 매출은 모든 지역에서 증가했다 Weekly revenue increased in every region ${i * 13}`,
            ),
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        }) as unknown as NodeEntry,
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: WRAP,
            definitionId: "lib:definition:type-frame",
            children: texts.map((text) => text.id),
            props: {},
            visual: {},
            sizing: { width: set(600) },
            descendantOverrides: [],
          } as unknown as NodeEntry,
          ...texts,
        ],
        rootIds: [WRAP],
        newId: workspace.newId,
      }),
    );
    const scene = new CatalogCanvasScene(workspace.root);
    scene.sync();
    resetCatalogMeasureParagraphHoldStats();
    const frame = () => workspace.root.recordsOfSource(WRAP)[0]!;
    const drag = (widths = [560, 480, 400, 480, 560]) => {
      for (const width of widths) {
        workspace.root.previewRecord(frame(), { sizing: { width } });
        scene.sync();
      }
    };
    return { workspace, scene, frame, drag };
  }
  const closed = () => {
    const stats = catalogMeasureParagraphHoldStats();
    expect(stats.held).toBe(0);
    expect(stats.made).toBe(stats.deleted);
    expect(stats.made).toBeGreaterThan(0);
    expect(stats.peak).toBeLessThanOrEqual(N);
  };

  it("a text edit's 512 previews hold nothing", async () => {
    const { workspace, scene } = await open();
    const text = workspace.root.recordsOfSource(
      "project:node:t0" as NodeId,
    )[0]!;
    for (let i = 0; i < 512; i++) {
      workspace.root.previewRecord(text, {
        props: { children: `편집 중 글자 ${"가".repeat(i % 40)} ${i}` },
      });
      scene.sync();
    }
    workspace.root.previewRecord(text);
    expect(catalogMeasureParagraphHoldStats()).toMatchObject({
      held: 0,
      made: 0,
      peak: 0,
    });
    scene.dispose();
    workspace.dispose();
  });
  it("commit: a drag holds ≤ its leaves, the release deletes them all", async () => {
    const { workspace, scene, drag, frame } = await open();
    const release = workspace.holdMeasureParagraphs();
    drag();
    const during = catalogMeasureParagraphHoldStats();
    expect(during.held).toBeGreaterThan(0);
    expect(during.peak).toBeLessThanOrEqual(N);
    workspace.root.previewRecord(frame());
    release();
    release();
    closed();
    scene.dispose();
    workspace.dispose();
  });
  for (const [name, close] of [
    [
      "a new root (device pixel ratio)",
      (workspace: CatalogWorkspace) => workspace.setDevicePixelRatio(3),
    ],
    [
      "a font change",
      (workspace: CatalogWorkspace) => workspace.refreshFonts(),
    ],
    [
      "dispose (a route left mid-drag)",
      (workspace: CatalogWorkspace) => workspace.dispose(),
    ],
  ] as const)
    it(`${name} ends an open hold with no next frame`, async () => {
      const { workspace, scene, drag } = await open();
      const release = workspace.holdMeasureParagraphs();
      drag();
      expect(catalogMeasureParagraphHoldStats().held).toBeGreaterThan(0);
      close(workspace);
      closed();
      // (The owner's own release later does nothing.)
      release();
      closed();
      scene.dispose();
      workspace.dispose();
    });
});

describe("ADR-319 G3 — a held paragraph never leaves the measure module (static)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/builder/catalogRuntime/textMeasure.ts"),
    "utf8",
  );
  it("no draw call, no export of the held table or its paragraphs", () => {
    expect(source).not.toMatch(/drawParagraph/);
    for (const line of source
      .split("\n")
      .filter((line) => line.startsWith("export")))
      expect(line).not.toMatch(/heldParagraphs|HeldParagraph|Paragraph\b/);
    // (The hold is reached only through the measure's `hold` and the stats.)
    expect(source).toMatch(/catalogTextMeasure\.hold = holdMeasureParagraphs;/);
  });
  it("the Canvas teardown cancels a drag in progress (its hold ends with it)", () => {
    const canvas = readFileSync(
      resolve(
        process.cwd(),
        "src/builder/workspace/canvas/catalog/CatalogCanvas.tsx",
      ),
      "utf8",
    );
    const cleanup = canvas.slice(
      canvas.indexOf("return () => {\n      running = false;"),
    );
    expect(cleanup.slice(0, 400)).toMatch(/gestures\.cancel\(\);/);
    expect(canvas).toMatch(
      /holdMeasure: \(\) => workspace\.holdMeasureParagraphs\(\)/,
    );
  });
});

// @vitest-environment jsdom
/**
 * S2 1.8.0 InlineAlert `fillStyle` — S2 값 이름 그대로 (2026-10-13): border (기본 — 바탕 배경 +
 * variant 색 테두리) · subtleFill (variant-subtle 배경, 테두리 없음) · boldFill (variant 본색
 * 배경, 흰 글자 — notice 는 검정). rule `fillStyleValues` 가 값 → fill 을 잇고 Canvas paint ·
 * 생성 CSS 가 같이 읽는다. boldFill 의 제목 · 설명 글자색은 파생 color 로 양 consumer 에 닿는다
 * (derivedProps.color — 작성한 색이 이김). 옛 house 값 (outline · subtle · bold) 은 로드 시 1회
 * S2 이름으로 바뀐다.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:alert" as NodeId;

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:inline-alert-fill" as const,
        name: "InlineAlert fill",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `inline-alert-fill-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "InlineAlert");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
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
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const heading = [...root.domInputs.values()].find(
    (item) => item.bindingId === "heading" && item.parentId === record.id,
  );
  const html = renderToStaticMarkup(renderCatalogDom(root, record.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const painted = getSkiaNode(record.id) as unknown as {
    box?: { fillColor?: Float32Array | number[] };
  };
  const headingText = heading
    ? (getSkiaNode(heading.id) as unknown as {
        text?: { color?: Float32Array | number[] };
      })
    : undefined;
  canvas.dispose();
  return { record, heading, html, painted, headingText, definitionId };
}

const rgb = (color: Float32Array | number[] | undefined) =>
  color ? [...color].slice(0, 3).map((value) => Math.round(value * 255)) : [];

describe("S2 InlineAlert fillStyle", () => {
  it("the Design panel offers Fill Style — S2 border · subtleFill · boldFill, border by default", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "InlineAlert").fillStyle,
    ).toMatchObject({
      kind: "fillStyle",
      default: "border",
      options: [
        { value: "border" },
        { value: "subtleFill" },
        { value: "boldFill" },
      ],
    });
  });

  it("default (border): base background, the variant border, dark text", async () => {
    const { html, painted } = await open({ variant: "info" });
    expect(html).toContain('data-fill-style="border"');
    // {color.base} — white in light mode.
    expect(rgb(painted.box?.fillColor)).toEqual([255, 255, 255]);
  });

  it("subtleFill: the variant subtle background", async () => {
    const { html, painted } = await open({
      variant: "info",
      fillStyle: "subtleFill",
    });
    expect(html).toContain('data-fill-style="subtleFill"');
    // informative-subtle differs from both the base white and the bold blue.
    const fill = rgb(painted.box?.fillColor);
    expect(fill).not.toEqual([255, 255, 255]);
    expect(fill[2]).toBeGreaterThan(200);
  });

  it("boldFill: the variant color fills and the Heading goes white in both consumers", async () => {
    const { html, painted, heading, headingText } = await open({
      variant: "negative",
      fillStyle: "boldFill",
    });
    expect(html).toContain('data-fill-style="boldFill"');
    const fill = rgb(painted.box?.fillColor);
    expect(fill[0]).toBeGreaterThan(150);
    expect(fill[1]).toBeLessThan(120);
    expect(heading?.derivedProps?.color).toBe("#ffffff");
    expect(rgb(headingText?.text?.color)).toEqual([255, 255, 255]);
    // The DOM Heading carries the derived color inline (over its own dark default).
    expect(html).toMatch(/<h3[^>]*color:#ffffff/);
  });

  it("boldFill notice: black text (S2)", async () => {
    const { heading } = await open({
      variant: "notice",
      fillStyle: "boldFill",
    });
    expect(heading?.derivedProps?.color).toBe("#000000");
  });

  it("the generated sheet styles the values the DOM writes (border · subtleFill)", () => {
    const css = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../../../packages/shared/src/components/styles/generated/InlineAlert.css",
      ),
      "utf8",
    );
    for (const variant of [
      "neutral",
      "informative",
      "positive",
      "notice",
      "negative",
    ])
      for (const value of ["border", "subtleFill"])
        expect(css).toContain(
          `[data-variant="${variant}"][data-fill-style="${value}"]`,
        );
    expect(css).not.toMatch(/data-fill-style="(outline|subtle|bold)"/);
  });

  it("an old document's house values load as the S2 names (once)", async () => {
    const library = await buildCodeCatalogLibrary();
    const definitionId = catalogPaletteDefinitionId(library, "InlineAlert");
    const entries: Record<string, CatalogEntry> = {};
    for (const [index, value] of ["outline", "subtle", "bold"].entries())
      entries[`n${index}`] = {
        kind: "node",
        id: `project:node:old-${index}` as NodeId,
        definitionId,
        children: [],
        props: { fillStyle: { kind: "set", value } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      } as NodeEntry;
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    expect(
      Object.values(entries).map(
        (entry) => (entry as NodeEntry).props.fillStyle,
      ),
    ).toEqual([
      { kind: "set", value: "border" },
      { kind: "set", value: "subtleFill" },
      { kind: "set", value: "boldFill" },
    ]);
  });
});

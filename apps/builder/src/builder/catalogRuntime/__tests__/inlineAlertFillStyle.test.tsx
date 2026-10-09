// @vitest-environment jsdom
/**
 * S2 1.8.0 InlineAlert `fillStyle` (2026-10-10 — S2 border · subtleFill · boldFill 를 house 값
 * outline · subtle · bold 로, 라벨은 S2 이름): outline (기본 — S2 자체 기본 'border': 바탕 배경
 * + variant 색 테두리) · subtle (variant-subtle 배경, 테두리 없음) · bold (variant 본색 배경,
 * 흰 글자 — notice 는 검정). bold 의 제목 · 설명 글자색은 파생 color 로 양 consumer 에 닿는다
 * (derivedProps.color — 작성한 색이 이김).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
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
  it("the Design panel offers Fill Style — Border (outline) by default", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "InlineAlert").fillStyle,
    ).toMatchObject({ kind: "fillStyle", default: "outline" });
  });

  it("default (outline): base background, the variant border, dark text", async () => {
    const { html, painted } = await open({ variant: "info" });
    expect(html).toContain('data-fill-style="outline"');
    // {color.base} — white in light mode.
    expect(rgb(painted.box?.fillColor)).toEqual([255, 255, 255]);
  });

  it("subtle: the variant subtle background", async () => {
    const { html, painted } = await open({
      variant: "info",
      fillStyle: "subtle",
    });
    expect(html).toContain('data-fill-style="subtle"');
    // informative-subtle differs from both the base white and the bold blue.
    const fill = rgb(painted.box?.fillColor);
    expect(fill).not.toEqual([255, 255, 255]);
    expect(fill[2]).toBeGreaterThan(200);
  });

  it("bold: the variant color fills and the Heading goes white in both consumers", async () => {
    const { html, painted, heading, headingText } = await open({
      variant: "negative",
      fillStyle: "bold",
    });
    expect(html).toContain('data-fill-style="bold"');
    const fill = rgb(painted.box?.fillColor);
    expect(fill[0]).toBeGreaterThan(150);
    expect(fill[1]).toBeLessThan(120);
    expect(heading?.derivedProps?.color).toBe("#ffffff");
    expect(rgb(headingText?.text?.color)).toEqual([255, 255, 255]);
    // The DOM Heading carries the derived color inline (over its own dark default).
    expect(html).toMatch(/<h3[^>]*color:#ffffff/);
  });

  it("bold notice: black text (S2)", async () => {
    const { heading } = await open({ variant: "notice", fillStyle: "bold" });
    expect(heading?.derivedProps?.color).toBe("#000000");
  });
});

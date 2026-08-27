import type { CompositionDocument } from "@composition/shared";
import type { Page } from "../../types/core/store.types";
import type { SettingsState } from "../stores/canvasSettings";
import type { ElementsState } from "../stores/elements";
import { getCanonicalDocumentElementsView } from "../stores/canonical/canonicalElementsView";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";

const BENCHMARK_PARAM = "benchmark";
const EDGE_PARAM = "edge";
const SCENARIO = "path-heavy-117";
const SOURCE_PAGE_ID = "path-heavy-117-source-page";
const SOURCE_BODY_ID = "path-heavy-117-source-body";
const TARGET_PAGE_ID = "path-heavy-117-target-page";
const TARGET_BODY_ID = "path-heavy-117-target-body";
const SLOT_FRAME_ID = "path-heavy-117-slot-frame";
const SLOT_RECOMMENDATION_ID = "path-heavy-117-slot-recommendation";
const SOURCE_BUTTON_ID = "path-heavy-117-source-button";

type CanonicalNode = CompositionDocument["children"][number];

export interface PathHeavy117RasterSources {
  jpeg: string;
  png: string;
  webp: string;
}

const BASE_BOX_STYLE = {
  boxSizing: "border-box",
  flex: "0 0 auto",
  height: 120,
  width: 180,
} as const;

function frameNode(
  id: string,
  style: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): CanonicalNode {
  return {
    id,
    type: "frame",
    props: { style: { ...BASE_BOX_STYLE, ...style } },
    ...extra,
  } as CanonicalNode;
}

function repeatNodes(
  count: number,
  createNode: (index: number) => CanonicalNode,
): CanonicalNode[] {
  return Array.from({ length: count }, (_, index) => createNode(index));
}

export function createPathHeavy117Document(
  rasters: PathHeavy117RasterSources,
): CompositionDocument {
  const roundedClipNodes = repeatNodes(8, (index) =>
    frameNode(
      `path-heavy-117-rounded-${index}`,
      {
        backgroundColor: index % 2 === 0 ? "#dbeafe" : "#ede9fe",
        borderRadius: 28,
        overflow: "hidden",
      },
      {
        clip: true,
        children: [
          {
            id: `path-heavy-117-rounded-image-${index}`,
            type: "Image",
            props: {
              alt: `Rounded clip ${index + 1}`,
              objectFit: "cover",
              src: index % 2 === 0 ? rasters.png : "",
              style: { height: 160, width: 220 },
            },
          },
        ],
      },
    ),
  );

  const partialBorderNodes = repeatNodes(8, (index) =>
    frameNode(`path-heavy-117-partial-border-${index}`, {
      backgroundColor: "#fff7ed",
      borderBottomColor: "#7c3aed",
      borderBottomStyle: "dashed",
      borderBottomWidth: 10,
      borderLeftColor: "#0891b2",
      borderLeftStyle: "dotted",
      borderLeftWidth: 6,
      borderRadius: 24,
      borderRightColor: "#ea580c",
      borderRightStyle: "solid",
      borderRightWidth: 8,
      borderTopColor: "#2563eb",
      borderTopStyle: index % 2 === 0 ? "dashed" : "dotted",
      borderTopWidth: 12,
    }),
  );

  const insetNodes = repeatNodes(8, (index) =>
    frameNode(`path-heavy-117-inset-${index}`, {
      backgroundColor: "#dcfce7",
      borderColor: index % 2 === 0 ? "#16a34a" : "#0f766e",
      borderRadius: 18,
      borderStyle: "inset",
      borderWidth: 12,
    }),
  );

  const outsetNodes = repeatNodes(8, (index) =>
    frameNode(`path-heavy-117-outset-${index}`, {
      backgroundColor: "#fef3c7",
      borderColor: index % 2 === 0 ? "#d97706" : "#b45309",
      borderRadius: 18,
      borderStyle: "outset",
      borderWidth: 12,
    }),
  );

  const innerShadowNodes = repeatNodes(8, (index) =>
    frameNode(`path-heavy-117-inner-shadow-${index}`, {
      backgroundColor: "#f8fafc",
      borderRadius: 22,
      boxShadow: `inset ${index % 3}px 6px 14px 4px rgba(15, 23, 42, 0.38)`,
    }),
  );

  const iconNodes = repeatNodes(8, (index) => ({
    id: `path-heavy-117-icon-${index}`,
    type: "Icon",
    props: {
      iconName: index % 2 === 0 ? "star" : "home",
      style: {
        ...BASE_BOX_STYLE,
        color: index % 2 === 0 ? "#7c3aed" : "#2563eb",
        height: 120,
        padding: 36,
        width: 180,
      },
    },
  })) as CanonicalNode[];

  const rasterNodes = [
    { id: "placeholder", src: "" },
    { id: "png", src: rasters.png },
    { id: "jpeg", src: rasters.jpeg },
    { id: "webp", src: rasters.webp },
  ].map(({ id, src }): CanonicalNode => ({
    id: `path-heavy-117-image-${id}`,
    type: "Image",
    props: {
      alt: `Path heavy ${id}`,
      objectFit: "cover",
      src,
      style: { ...BASE_BOX_STYLE, borderRadius: 16 },
    },
  }));

  const slotRecommendation: CanonicalNode = {
    id: SLOT_RECOMMENDATION_ID,
    type: "Button",
    reusable: true,
    props: {
      children: "Slot target",
      style: { ...BASE_BOX_STYLE },
      variant: "secondary",
    },
  };

  const slotFrame = frameNode(
    SLOT_FRAME_ID,
    {
      backgroundColor: "#f3e8ff",
      borderColor: "#9333ea",
      borderRadius: 20,
      borderStyle: "dashed",
      borderWidth: 4,
      overflow: "hidden",
    },
    {
      clip: true,
      reusable: true,
      slot: [SLOT_RECOMMENDATION_ID],
      children: [
        frameNode("path-heavy-117-overflow-child", {
          backgroundColor: "#c4b5fd",
          height: 180,
          width: 240,
        }),
      ],
    },
  );

  const slotRef: CanonicalNode = {
    id: "path-heavy-117-slot-ref",
    type: "ref",
    ref: SLOT_FRAME_ID,
    props: { style: { ...BASE_BOX_STYLE } },
  } as CanonicalNode;

  const sourceButton: CanonicalNode = {
    id: SOURCE_BUTTON_ID,
    type: "Button",
    props: {
      children: "Navigate",
      style: { ...BASE_BOX_STYLE },
      variant: "primary",
    },
  };

  return {
    version: "composition-1.0",
    pagePositions: {
      [SOURCE_PAGE_ID]: { desktop: { x: 0, y: 0 } },
      [TARGET_PAGE_ID]: { desktop: { x: 2200, y: 0 } },
    },
    events: [
      {
        id: "path-heavy-117-navigation-rule",
        type: "interaction",
        elementId: SOURCE_BUTTON_ID,
        trigger: "onPress",
        action: { kind: "navigate", params: { path: "/target" } },
      },
    ],
    children: [
      {
        id: SOURCE_PAGE_ID,
        type: "frame",
        name: "Path Heavy 117",
        metadata: {
          type: "legacy-page",
          pageId: SOURCE_PAGE_ID,
          slug: "/",
          parent_id: null,
        },
        children: [
          {
            id: SOURCE_BODY_ID,
            type: "Body",
            props: {
              style: {
                alignContent: "flex-start",
                backgroundColor: "#ffffff",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 16,
                height: "100%",
                overflow: "hidden",
                padding: 32,
                width: "100%",
              },
            },
            children: [
              ...roundedClipNodes,
              ...partialBorderNodes,
              ...insetNodes,
              ...outsetNodes,
              ...innerShadowNodes,
              ...iconNodes,
              ...rasterNodes,
              slotRecommendation,
              slotFrame,
              slotRef,
              sourceButton,
            ],
          },
        ],
      },
      {
        id: TARGET_PAGE_ID,
        type: "frame",
        name: "Target",
        metadata: {
          type: "legacy-page",
          pageId: TARGET_PAGE_ID,
          slug: "/target",
          parent_id: null,
        },
        children: [
          {
            id: TARGET_BODY_ID,
            type: "Body",
            props: {
              style: {
                alignItems: "center",
                backgroundColor: "#eff6ff",
                display: "flex",
                height: "100%",
                justifyContent: "center",
                width: "100%",
              },
            },
            children: [
              frameNode("path-heavy-117-target-marker", {
                backgroundColor: "#2563eb",
                borderRadius: 48,
                boxShadow: "0 20px 40px 0 rgba(37, 99, 235, 0.35)",
                height: 320,
                width: 320,
              }),
            ],
          },
        ],
      },
    ],
  };
}

function createRasterDataUrl(
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  color: string,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = color;
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = "#ffffff";
  context.fillRect(8, 8, 16, 16);
  return canvas.toDataURL(mimeType, 0.85);
}

function createPages(projectId: string): Page[] {
  const now = new Date().toISOString();
  return [
    {
      id: SOURCE_PAGE_ID,
      title: "Path Heavy 117",
      project_id: projectId,
      slug: "/",
      created_at: now,
      updated_at: now,
    },
    {
      id: TARGET_PAGE_ID,
      title: "Target",
      project_id: projectId,
      slug: "/target",
      created_at: now,
      updated_at: now,
    },
  ];
}

export function shouldApplyPathHeavy117Fixture(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get(BENCHMARK_PARAM) ===
    SCENARIO
  );
}

export function applyPathHeavy117Fixture(
  projectId: string,
  store: ElementsState & Pick<SettingsState, "setWorkflowStraightEdges">,
): void {
  const document = createPathHeavy117Document({
    jpeg: createRasterDataUrl("image/jpeg", "#ea580c"),
    png: createRasterDataUrl("image/png", "#2563eb"),
    webp: createRasterDataUrl("image/webp", "#7c3aed"),
  });
  const pages = createPages(projectId);
  const canonicalStore = useCanonicalDocumentStore.getState();

  canonicalStore.setDocument(projectId, document);
  canonicalStore.setCurrentProject(projectId);
  store.setPages(pages);
  store.setElements([...getCanonicalDocumentElementsView(document).elements]);
  store.initializePagePositions(
    pages,
    1920,
    1080,
    200,
    "horizontal",
    document.pagePositions,
  );
  store.setCurrentPageId(SOURCE_PAGE_ID);
  store.selectElementWithPageTransition(SLOT_FRAME_ID, SOURCE_PAGE_ID);
  store.setWorkflowStraightEdges(
    new URLSearchParams(window.location.search).get(EDGE_PARAM) !== "bezier",
  );

  console.info("[ADR-117] path-heavy-117 canonical benchmark fixture loaded.");
}

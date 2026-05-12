// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  buildCanvasSceneGraph,
  buildCanvasScenePageIndex,
} from "./canvasSceneNode";

/**
 * page + reusable frame 적용 시나리오 회귀 차단 test.
 *
 * ADR-116 canonical format 전환 후 legacy 경로 제거 중 발견된 회귀:
 * - page Properties 패널에서 Frame 등록 → page 투명 / Frame slot 사라짐 / Layers body 중복
 * - root cause: scene graph ↔ canonical document SSOT 정합 gap 3-layer
 *   (isPagePlaceholderNode / getNodeScope / includeReusableFrames option)
 *
 * 동일 회귀 재발 차단을 위한 fixture.
 */
describe("buildCanvasSceneGraph — page + reusable frame 시나리오", () => {
  function makeBoundPageDocument(): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body-1",
              type: "Body",
              props: {},
              children: [
                {
                  id: "frame-slot-1",
                  type: "Text",
                  props: { children: "frame slot" },
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          name: "Page 1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
        },
      ],
    } as unknown as CompositionDocument;
  }

  it("includeReusableFrames=true: master frame 이 nodesMap 에 등록되어 ref resolution lookup 이 가능하다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    // master 가 nodesMap 에 있어야 resolveCanonicalRefMaster 가 lookup 가능
    expect(graph.nodesMap.has("layout-frame-1")).toBe(true);
    // page-bound ref 도 scene 에 포함 (isPagePlaceholderNode 에서 제외됨)
    expect(graph.nodesMap.has("page-1")).toBe(true);
  });

  it("includeReusableFrames=false (default): master frame 이 nodesMap 에서 제외되어 Layers 중복을 차단한다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc);

    // master 는 일반 view 에서 보이면 안 됨 (Layers body 중복 차단)
    expect(graph.nodesMap.has("layout-frame-1")).toBe(false);
  });

  it("getNodeScope: frame-bound page ref 가 page scope 를 유지한다 (descendants 의 pageId 상속)", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });

    const pageRef = graph.nodesMap.get("page-1");
    // page ref 자체는 pageId scope = "page-1"
    expect(pageRef?.pageId).toBe("page-1");
    expect(pageRef?.layoutId).toBeNull();
  });

  it("buildCanvasScenePageIndex: master frame children 은 layoutId scope 이므로 pageIndex 에서 제외된다", () => {
    const doc = makeBoundPageDocument();
    const graph = buildCanvasSceneGraph(doc, { includeReusableFrames: true });
    const pageIndex = buildCanvasScenePageIndex(graph);

    // master children (layoutId scope, pageId=null) 은 pageIndex 진입 금지
    // (Skia 가 master 를 직접 렌더하지 않고 synthetic 경로만 사용)
    const page1Elements = pageIndex.elementsByPage.get("page-1") ?? new Set();
    expect(page1Elements.has("frame-body-1")).toBe(false);
    expect(page1Elements.has("frame-slot-1")).toBe(false);
  });

  it("일반 page (frame 미적용) 는 includeReusableFrames 옵션 영향 없이 정상 scene 등록된다", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body-1",
              type: "Body",
              props: {},
              children: [
                { id: "text-1", type: "Text", props: { children: "Hi" } },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const graphDefault = buildCanvasSceneGraph(doc);
    const graphWithFrames = buildCanvasSceneGraph(doc, {
      includeReusableFrames: true,
    });

    // page (non-reusable frame) 는 두 모드 모두에서 동일하게 등록
    expect(graphDefault.nodesMap.has("body-1")).toBe(true);
    expect(graphDefault.nodesMap.has("text-1")).toBe(true);
    expect(graphWithFrames.nodesMap.has("body-1")).toBe(true);
    expect(graphWithFrames.nodesMap.has("text-1")).toBe(true);
  });
});

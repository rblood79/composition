import { describe, expect, it } from "vitest";

import type { PageTitleBounds } from "../skia/skiaOverlayHelpers";
import {
  isPointInPageTitleBounds,
  resolvePageTitleEditorRect,
} from "./pageTitleEditing";

describe("page title editing interaction", () => {
  it("title bounds 안의 point만 edit hit로 판정한다", () => {
    const bounds: PageTitleBounds = {
      pageId: "page-1",
      sceneX: 40,
      sceneY: 20,
      sceneWidth: 80,
      sceneHeight: 20,
      textSceneX: 46,
      textSceneY: 24,
      textSceneWidth: 68,
      textSceneHeight: 12,
    };

    expect(isPointInPageTitleBounds({ x: 60, y: 30 }, bounds)).toBe(true);
    expect(isPointInPageTitleBounds({ x: 121, y: 30 }, bounds)).toBe(false);
  });

  it("drag hit padding을 제외한 text rect만 DOM editor rect로 변환한다", () => {
    const bounds: PageTitleBounds = {
      pageId: "page-1",
      sceneX: 40,
      sceneY: 20,
      sceneWidth: 80,
      sceneHeight: 10,
      textSceneX: 43,
      textSceneY: 22,
      textSceneWidth: 74,
      textSceneHeight: 6,
    };

    expect(resolvePageTitleEditorRect(bounds, 2, { x: 10, y: 30 })).toEqual({
      left: 96,
      top: 74,
      width: 148,
      height: 12,
    });
  });
});

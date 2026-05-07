import { beforeEach, describe, expect, it } from "vitest";

import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../../adapters/canonical/frameMirror";
import type { Page } from "../../../types/builder/unified.types";
import { useStore } from "../elements";

function makePage(id: string, opts: Partial<Page> = {}): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
    ...opts,
  };
}

describe("setPages layout invalidation", () => {
  beforeEach(() => {
    useStore.setState({
      pages: [],
      layoutVersion: 0,
    });
  });

  it("page frame binding 변경은 Skia layout 재계산을 트리거한다", () => {
    const page = withPageFrameBinding(makePage("page-1"), "frame-1");
    useStore.setState({
      pages: [page],
      layoutVersion: 10,
    });

    useStore.getState().setPages([withPageFrameBinding(page, null)]);

    expect(
      getNullablePageFrameBindingId(useStore.getState().pages[0]),
    ).toBeNull();
    expect(useStore.getState().layoutVersion).toBe(11);
  });

  it("canvas layout 에 영향 없는 page metadata 변경은 layoutVersion 을 유지한다", () => {
    const page = makePage("page-1", { title: "Before" });
    useStore.setState({
      pages: [page],
      layoutVersion: 7,
    });

    useStore.getState().setPages([{ ...page, title: "After" }]);

    expect(useStore.getState().pages[0].title).toBe("After");
    expect(useStore.getState().layoutVersion).toBe(7);
  });

  it("initializePagePositions 는 order_num 대신 입력된 canonical page 순서를 따른다", () => {
    useStore
      .getState()
      .initializePagePositions(
        [
          makePage("page-three", { order_num: 2 }),
          makePage("page-home", { order_num: 0 }),
          makePage("page-two", { order_num: 1 }),
        ],
        100,
        200,
        10,
        "horizontal",
      );

    expect(useStore.getState().pagePositions).toMatchObject({
      "page-three": { x: 0, y: 0 },
      "page-home": { x: 110, y: 0 },
      "page-two": { x: 220, y: 0 },
    });
  });
});

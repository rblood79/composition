import { beforeEach, describe, expect, it } from "vitest";

import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../../adapters/canonical/frameMirror";
import type { Page } from "../../../types/builder/unified.types";
import { useStore } from "../elements";

type LegacyPageOverrides = Partial<Page> & { order_num?: number };

function makePage(id: string, opts: LegacyPageOverrides = {}): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
    ...opts,
  } as Page;
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

  // ADR-232 — `initializePagePositions` 는 삭제됐다 (페이지 위치는 컨테이너 레이아웃 파생값).
  //   "canonical 순서를 따른다" 는 계약은 파생 자체가 `pages` 배열 순서로 흐름을 만들며
  //   `scene/pagePlacement.test.ts` 가 본다.
});

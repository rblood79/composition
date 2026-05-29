import { afterEach, describe, expect, it, vi } from "vitest";

import type { Page } from "../../../types/builder/unified.types";
import type { ElementsState } from "../elements";
import { getLiveElementsState } from "../rootStoreAccess";

function makePage(id: string): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
  } as Page;
}

describe("getLiveElementsState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unified Builder store 가 있으면 standalone elements store 대신 live state 를 반환한다", () => {
    const liveState = {
      pages: [makePage("live-page")],
    } as ElementsState;

    vi.stubGlobal("window", {
      __composition_STORE__: {
        getState: () => liveState,
      },
    });

    expect(getLiveElementsState()).toBe(liveState);
  });
});

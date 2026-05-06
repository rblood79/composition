// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../types/core/store.types";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import { reorderElements } from "../stores/utils/elementReorder";
import { useValidation } from "./useValidation";

vi.mock("../stores/utils/elementReorder", () => ({
  reorderElements: vi.fn(),
}));

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    ...overrides,
  } as Element;
}

function Harness({ elements }: { elements: Element[] }) {
  const { validateOrderNumbers } = useValidation();
  useEffect(() => {
    validateOrderNumbers(elements);
  }, [elements, validateOrderNumbers]);
  return null;
}

describe("useValidation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.useFakeTimers();
    vi.mocked(reorderElements).mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("does not auto-fix duplicate order_num for page-frame projection elements", () => {
    const pageBody = makeElement("page-body", { type: "body" });
    const projectedFrameBody = withFrameElementMirrorId(
      makeElement("page-1::page-frame::frame-body", {
        type: "body",
        page_id: "page-1",
        order_num: 0,
      }),
      "frame-1",
    );

    render(<Harness elements={[pageBody, projectedFrameBody]} />);
    act(() => {
      vi.runAllTimers();
    });

    expect(reorderElements).not.toHaveBeenCalled();
  });
});

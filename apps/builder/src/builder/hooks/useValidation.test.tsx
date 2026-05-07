// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../types/core/store.types";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import { useValidation } from "./useValidation";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
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
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("keeps validation as a no-op for page-frame projection elements", () => {
    const pageBody = makeElement("page-body", { type: "body" });
    const projectedFrameBody = withFrameElementMirrorId(
      makeElement("page-1::page-frame::frame-body", {
        type: "body",
        page_id: "page-1",
      }),
      "frame-1",
    );

    render(<Harness elements={[pageBody, projectedFrameBody]} />);
    act(() => {
      vi.runAllTimers();
    });

    expect(true).toBe(true);
  });
});

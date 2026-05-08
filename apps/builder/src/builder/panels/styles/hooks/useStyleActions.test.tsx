// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../../stores";
import { useStyleActions } from "./useStyleActions";

vi.mock("@/builder/hooks", () => ({
  useCopyPaste: () => ({
    copy: vi.fn(),
    paste: vi.fn(),
  }),
}));

describe("useStyleActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes explicit row flexDirection when applying container alignment", () => {
    const updateSelectedStyles = vi.fn();
    useStore.setState({ updateSelectedStyles });

    const { result } = renderHook(() => useStyleActions());

    act(() => {
      result.current.handleFlexAlignment("leftTop", "row");
    });

    expect(updateSelectedStyles).toHaveBeenCalledWith({
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-start",
      alignItems: "flex-start",
    });
  });
});

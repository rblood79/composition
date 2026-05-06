// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../env/supabase.client", () => ({
  supabase: {},
}));

import { useStore } from "../../../stores";
import { useFillActions } from "./useFillActions";
import { useFillValues, useFillUIStore } from "./useFillValues";

describe("useFillActions", () => {
  beforeEach(() => {
    useFillUIStore.setState({
      activeFillIndex: 0,
      colorInputMode: "hex",
    });

    useStore.setState({
      selectedElementId: "legacy-1",
      selectedElementProps: {
        style: { backgroundColor: "#112233" },
      },
      currentPageId: null,
      elements: [
        {
          id: "legacy-1",
          type: "Box",
          props: {
            style: { backgroundColor: "#112233" },
          },
        },
      ],
      elementsMap: new Map([
        [
          "legacy-1",
          {
            id: "legacy-1",
            type: "Box",
            props: {
              style: { backgroundColor: "#112233" },
            },
          },
        ],
      ]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });
  });

  it("legacy backgroundColor-only 요소도 synthetic fill 로 canonicalize 해서 편집할 수 있다", () => {
    const { result: values } = renderHook(() => useFillValues());
    const { result: actions } = renderHook(() => useFillActions());

    expect(values.current.fills).toHaveLength(1);

    act(() => {
      actions.current.updateFill(values.current.fills[0]!.id, {
        color: "#445566FF",
      });
    });

    const element = useStore.getState().elementsMap.get("legacy-1");
    expect(element?.fills).toHaveLength(1);
    expect(element?.fills?.[0]).toMatchObject({
      type: "color",
      color: "#445566FF",
    });
    expect(
      (element?.props?.style as { backgroundColor?: string } | undefined)
        ?.backgroundColor,
    ).toBeUndefined();
  });
});

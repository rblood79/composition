// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useHeightSizeMode,
  useWidthSizeMode,
  useParentDisplay,
  useParentFlexDirection,
} from "./useTransformAuxiliary";
import { useStore } from "../../../stores";
import type { Element } from "../../../../types/core/store.types";

function setTestElements(elements: Element[]): void {
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((element) => [element.id, element])),
  } as never);
}

describe("useTransformAuxiliary", () => {
  beforeEach(() => {
    setTestElements([
      {
        id: "el-1",
        type: "Button",
        parent_id: "p-1",
        props: {
          style: {
            width: "180px",
            height: "120px",
            alignSelf: "center",
            justifySelf: "center",
          },
        },
      } as Element,
      {
        id: "p-1",
        type: "Frame",
        props: { style: { display: "flex", flexDirection: "row" } },
      } as Element,
    ]);
  });

  it("useParentDisplay returns parent display", () => {
    const { result } = renderHook(() => useParentDisplay("el-1"));
    expect(result.current).toBe("flex");
  });

  it("useParentFlexDirection returns parent flex-direction", () => {
    const { result } = renderHook(() => useParentFlexDirection("el-1"));
    expect(result.current).toBe("row");
  });

  it("useParentDisplay returns 'block' when no parent", () => {
    const { result } = renderHook(() => useParentDisplay("p-1"));
    expect(result.current).toBe("block");
  });

  it("useWidthSizeMode infers from style + parent context", () => {
    const { result } = renderHook(() => useWidthSizeMode("el-1"));
    // 180px 명시 값 → "fixed"
    expect(result.current).toBe("fixed");
  });

  it("useWidthSizeMode reads the active breakpoint override", () => {
    useStore.setState((state) => {
      const responsiveElement = {
        ...(state.elementsMap.get("el-1") as Element),
        responsive: { styles: { width: { mobile: "100%" } } },
      } as Element;
      const elements = state.elements.map((element) =>
        element.id === "el-1" ? responsiveElement : element,
      );
      return {
        elements,
        elementsMap: new Map(elements.map((element) => [element.id, element])),
        activeBreakpoint: "mobile",
      };
    });

    const { result } = renderHook(() => useWidthSizeMode("el-1"));
    expect(result.current).toBe("fill");
  });

  it("useHeightSizeMode reads the active breakpoint override", () => {
    useStore.setState((state) => {
      const responsiveElement = {
        ...(state.elementsMap.get("el-1") as Element),
        responsive: { styles: { height: { mobile: "100%" } } },
      } as Element;
      const elements = state.elements.map((element) =>
        element.id === "el-1" ? responsiveElement : element,
      );
      return {
        elements,
        elementsMap: new Map(elements.map((element) => [element.id, element])),
        activeBreakpoint: "mobile",
      };
    });

    const { result } = renderHook(() => useHeightSizeMode("el-1"));
    expect(result.current).toBe("fill");
  });
});

// ADR-082 A1: 부모 Spec containerStyles fallback — inline display 미설정 시 Spec SSOT 조회.
// ListBoxSpec.containerStyles.display="flex" / flexDirection="column" 을 자식 Panel 이
// 소비해야 Fill/Hug 판정이 실제 container layout 과 일치함.
describe("useTransformAuxiliary — ADR-082 A1 부모 Spec fallback", () => {
  beforeEach(() => {
    setTestElements([
      {
        id: "item-1",
        type: "ListBoxItem",
        parent_id: "lb-1",
        props: { style: { alignSelf: "center", justifySelf: "center" } },
      } as Element,
      {
        id: "lb-1",
        type: "ListBox",
        // inline style 없음 — ListBoxSpec.containerStyles.display="flex" 가 유일 source
        props: {},
      } as Element,
    ]);
  });

  it("useParentDisplay reads ListBoxSpec.containerStyles.display='flex' when parent lacks inline", () => {
    const { result } = renderHook(() => useParentDisplay("item-1"));
    expect(result.current).toBe("flex");
  });

  it("useParentFlexDirection reads ListBoxSpec.containerStyles.flexDirection='column' when parent lacks inline", () => {
    const { result } = renderHook(() => useParentFlexDirection("item-1"));
    expect(result.current).toBe("column");
  });

  it("inline style.display overrides Spec containerStyles fallback (inline 우선)", () => {
    useStore.setState((s) => {
      const map = new Map<string, Element>(s.elementsMap);
      const existing = map.get("lb-1") ?? {};
      const parent = {
        ...existing,
        props: { style: { display: "block" } },
      } as unknown as Element;
      map.set("lb-1", parent);
      return {
        elements: (s.elements ?? []).map((element) =>
          element.id === "lb-1" ? parent : element,
        ),
        elementsMap: map,
      };
    });
    const { result } = renderHook(() => useParentDisplay("item-1"));
    expect(result.current).toBe("block");
  });

  it("parent display and direction read the active breakpoint overrides", () => {
    useStore.setState((state) => {
      const responsiveParent = {
        ...(state.elementsMap.get("lb-1") as Element),
        props: { style: { display: "block", flexDirection: "row" } },
        responsive: {
          styles: {
            display: { mobile: "flex" },
            flexDirection: { mobile: "column" },
          },
        },
      } as Element;
      const elements = state.elements.map((element) =>
        element.id === "lb-1" ? responsiveParent : element,
      );
      return {
        elements,
        elementsMap: new Map(elements.map((element) => [element.id, element])),
        activeBreakpoint: "mobile",
      };
    });

    const { result } = renderHook(() => ({
      display: useParentDisplay("item-1"),
      direction: useParentFlexDirection("item-1"),
    }));

    expect(result.current).toEqual({
      display: "flex",
      direction: "column",
    });
  });

  it("부모 tag 가 containerStyles 미보유 Spec 이면 기본값 'block'/'row' 반환", () => {
    setTestElements([
      {
        id: "child-x",
        type: "Button",
        parent_id: "dlg-1",
        props: {},
      } as Element,
      {
        id: "dlg-1",
        type: "Dialog", // Dialog 는 containerStyles 미보유 (overlay archetype)
        props: {},
      } as Element,
    ]);
    const { result: display } = renderHook(() => useParentDisplay("child-x"));
    expect(display.current).toBe("block");
    const { result: dir } = renderHook(() => useParentFlexDirection("child-x"));
    expect(dir.current).toBe("row");
  });
});

describe("useTransformAuxiliary — Transform Spec default inference", () => {
  it("infers ListBox width 100% Spec default as Fill without an inline width", () => {
    setTestElements([
      {
        id: "listbox-1",
        type: "ListBox",
        props: {},
      } as Element,
    ]);

    const { result } = renderHook(() => useWidthSizeMode("listbox-1"));
    expect(result.current).toBe("fill");
  });

  it("infers Avatar height Spec default as Fixed without an inline height", () => {
    setTestElements([
      {
        id: "avatar-1",
        type: "Avatar",
        props: { size: "md" },
      } as Element,
    ]);

    const { result } = renderHook(() => useHeightSizeMode("avatar-1"));
    expect(result.current).toBe("fixed");
  });
});

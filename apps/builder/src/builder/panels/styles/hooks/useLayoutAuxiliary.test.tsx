// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// ADR-082 P4 / ADR-108 P3: Panel 의 layout fallback 경로 검증.
//   fallback source 는 ADR-912 Phase 4 로 builder-local TAG_SPEC_MAP 에서 catalog
//   (`resolveComponentRule` / `resolveCatalogContainerBase` / `resolveCatalogContainerVariants`)
//   로 전환됐다. 실제 catalog entry 중 alignItems/justifyContent 를 containerStyles 로
//   공급하며 variant override 까지 가진 조합이 없어, 합성 catalog rule 로 분기를 검증한다.
//   (base/variants resolver 는 resolveComponentRule 을 모듈 내부에서 호출하므로 barrel
//    mock 으로 가로채지지 않는다 → 3개를 함께 mock 해야 한다.)
type CatalogTestRule = {
  structure?: { containerStyles?: Record<string, string> };
  containerVariants?: Record<
    string,
    Record<string, { styles: Record<string, string> }>
  >;
};

const CATALOG_RULES = vi.hoisted(
  () =>
    ({
      TestAlignSpec: {
        structure: {
          containerStyles: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "center",
          },
        },
      },
      VariantGridSpec: {
        structure: {
          containerStyles: { display: "flex", flexDirection: "column" },
        },
        containerVariants: {
          "label-position": { side: { styles: { display: "grid" } } },
        },
      },
      VariantFlexSpec: {
        structure: {
          containerStyles: { display: "flex", flexDirection: "column" },
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
                "justify-content": "flex-end",
              },
            },
          },
        },
      },
    }) satisfies Record<string, CatalogTestRule>,
);

vi.mock("@composition/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@composition/shared")>();
  const rules: Record<string, CatalogTestRule | undefined> = CATALOG_RULES;
  return {
    ...actual,
    resolveComponentRule: (type: string) => rules[type],
    resolveCatalogContainerBase: (type: string) =>
      rules[type]?.structure?.containerStyles ?? {},
    resolveCatalogContainerVariants: (
      type: string,
      props: Record<string, unknown>,
    ) => {
      const value = props?.labelPosition;
      const match =
        typeof value === "string"
          ? rules[type]?.containerVariants?.["label-position"]?.[value]
          : undefined;
      return { styles: match ? { ...match.styles } : {} };
    },
  };
});

import {
  useFlexDirectionKeys,
  useFlexAlignmentKeys,
  useJustifyContentSpacingKeys,
  useFlexWrapKeys,
} from "./useLayoutAuxiliary";
import { useStore } from "../../../stores";
import type { Element } from "../../../../types/core/store.types";

function makeElement(
  id: string,
  type: string,
  props: Record<string, unknown>,
): Element {
  return { id, type, props };
}

function setElement(
  id: string,
  style: Record<string, unknown>,
  tag = "Div",
  extraProps: Record<string, unknown> = {},
) {
  const element = makeElement(id, tag, { ...extraProps, style });
  useStore.setState({
    elements: [element],
    elementsMap: new Map([[id, element]]),
  } as never);
}

describe("useFlexDirectionKeys", () => {
  beforeEach(() => setElement("e", {}));

  it("returns ['block'] when display is not flex", () => {
    setElement("e", { display: "block" });
    const { result } = renderHook(() => useFlexDirectionKeys("e"));
    expect(result.current).toEqual(["block"]);
  });

  it("returns ['row'] when flex + row", () => {
    setElement("e", { display: "flex", flexDirection: "row" });
    const { result } = renderHook(() => useFlexDirectionKeys("e"));
    expect(result.current).toEqual(["row"]);
  });

  it("returns ['column'] when flex + column", () => {
    setElement("e", { display: "flex", flexDirection: "column" });
    const { result } = renderHook(() => useFlexDirectionKeys("e"));
    expect(result.current).toEqual(["column"]);
  });
});

describe("useFlexAlignmentKeys", () => {
  it("returns [] when not flex", () => {
    setElement("e", { display: "block" });
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual([]);
  });

  it("row + alignItems=center + justifyContent=flex-start → 'leftCenter'", () => {
    setElement("e", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
    });
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual(["leftCenter"]);
  });

  it("column + justifyContent=center + alignItems=flex-end → 'rightCenter'", () => {
    setElement("e", {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "flex-end",
    });
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual(["rightCenter"]);
  });
});

describe("useJustifyContentSpacingKeys", () => {
  it("returns space-between when set", () => {
    setElement("e", { justifyContent: "space-between" });
    const { result } = renderHook(() => useJustifyContentSpacingKeys("e"));
    expect(result.current).toEqual(["space-between"]);
  });

  it("returns [] for non-spacing value", () => {
    setElement("e", { justifyContent: "center" });
    const { result } = renderHook(() => useJustifyContentSpacingKeys("e"));
    expect(result.current).toEqual([]);
  });
});

describe("useFlexWrapKeys", () => {
  it("defaults to nowrap", () => {
    setElement("e", {});
    const { result } = renderHook(() => useFlexWrapKeys("e"));
    expect(result.current).toEqual(["nowrap"]);
  });

  it("returns wrap when set", () => {
    setElement("e", { flexWrap: "wrap" });
    const { result } = renderHook(() => useFlexWrapKeys("e"));
    expect(result.current).toEqual(["wrap"]);
  });
});

describe("useFlexAlignmentKeys — ADR-082 P4 Spec fallback (ADR-079 P2 완결)", () => {
  it("alignItems/justifyContent inline 없으면 Spec containerStyles fallback 공급", () => {
    // TestAlignSpec.containerStyles = {
    //   display: "flex", flexDirection: "row",
    //   alignItems: "flex-start", justifyContent: "center"
    // }
    // → row 축: V=alignItems=flex-start=Top / H=justifyContent=center=center → "centerTop"
    setElement("e", {}, "TestAlignSpec");
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual(["centerTop"]);
  });

  it("inline 값이 Spec fallback 보다 우선 (회귀 0)", () => {
    // inline alignItems=center 가 Spec 의 flex-start 를 override
    setElement(
      "e",
      { alignItems: "center", justifyContent: "flex-end" },
      "TestAlignSpec",
    );
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    // row 축: V=center=Center / H=flex-end=right → "rightCenter"
    expect(result.current).toEqual(["rightCenter"]);
  });

  it("부분 override — alignItems 만 inline, justifyContent 는 Spec fallback", () => {
    setElement("e", { alignItems: "flex-end" }, "TestAlignSpec");
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    // row 축: V=flex-end=Bottom / H=center(Spec)=center → "centerBottom"
    expect(result.current).toEqual(["centerBottom"]);
  });

  it("Spec 미등록 tag 는 기존 동작 유지 (inline only, 회귀 0)", () => {
    setElement(
      "e",
      { display: "flex", flexDirection: "row", alignItems: "center" },
      "Div",
    );
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    // Div 는 mock 에 없음 → spec fallback "" → inline 만 사용
    expect(result.current).toEqual(["Center"]);
  });
});

describe("useLayoutAuxiliary — ADR-108 P3 variant-aware fallback", () => {
  it("variant display=grid 이면 Direction 토글은 block 상태", () => {
    setElement("e", {}, "VariantGridSpec", { labelPosition: "side" });
    const { result } = renderHook(() => useFlexDirectionKeys("e"));
    expect(result.current).toEqual(["block"]);
  });

  it("variant flex-direction/align/justify 를 Alignment 토글에 반영", () => {
    setElement("e", {}, "VariantFlexSpec", { labelPosition: "side" });
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual(["rightTop"]);
  });

  it("inline 값은 variant fallback 보다 우선", () => {
    setElement("e", { alignItems: "center" }, "VariantFlexSpec", {
      labelPosition: "side",
    });
    const { result } = renderHook(() => useFlexAlignmentKeys("e"));
    expect(result.current).toEqual(["rightCenter"]);
  });
});

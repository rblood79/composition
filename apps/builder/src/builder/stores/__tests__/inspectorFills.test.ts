// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../env/supabase.client", () => ({
  supabase: {},
}));

vi.mock("../../../utils/featureFlags", () => ({
  isFillV2Enabled: () => true,
}));

import { FillType } from "../../../types/builder/fill.types";
import type { Element } from "../../../types/core/store.types";
import { saveService } from "../../../services/save";
import { useStore } from "../index";

describe("inspectorActions fill write-through", () => {
  beforeEach(() => {
    useStore.setState({
      selectedElementId: "fill-target",
      selectedElementProps: {
        style: { backgroundColor: "#ffffff" },
      },
      currentPageId: null,
      elements: [
        {
          id: "fill-target",
          type: "Box",
          props: {
            style: { backgroundColor: "#ffffff" },
          },
        },
      ],
      elementsMap: new Map([
        [
          "fill-target",
          {
            id: "fill-target",
            type: "Box",
            props: {
              style: { backgroundColor: "#ffffff" },
            },
          },
        ],
      ]),
      childrenMap: new Map(),
      dirtyElementIds: new Set(),
      layoutVersion: 0,
    });
  });

  it("commit 경로는 fills 만 저장하고 derived background style 은 제거한다", async () => {
    useStore.getState().updateSelectedFills([
      {
        id: "lg-1",
        type: FillType.LinearGradient,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        rotation: 90,
        stops: [
          { color: "#FF0000FF", position: 0 },
          { color: "#00FF00FF", position: 1 },
        ],
      },
    ]);

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | { backgroundColor?: string; backgroundImage?: string }
      | undefined;

    expect(element?.fills).toHaveLength(1);
    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.backgroundImage).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const mockedSave = vi.mocked(saveService.savePropertyChange);
    expect(mockedSave).toHaveBeenCalled();
    const lastCall = mockedSave.mock.calls.at(-1);
    expect(lastCall?.[0]?.data).toMatchObject({
      fills: expect.any(Array),
      props: { style: {} },
    });
  });

  it("lightweight preview 경로는 CSS background 는 건드리지 않고 fills 만 바꾼다", () => {
    useStore.getState().updateSelectedFillsPreviewLightweight([
      {
        id: "fill-1",
        type: FillType.Color,
        color: "#ABCDEFff".toUpperCase(),
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      },
    ]);

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | { backgroundColor?: string }
      | undefined;

    expect(element?.fills).toHaveLength(1);
    expect(style?.backgroundColor).toBe("#ffffff");
  });

  it("preview 경로도 derived background style 을 다시 쓰지 않고 fills 만 반영한다", () => {
    useStore.getState().updateSelectedFillsPreview([
      {
        id: "preview-fill-1",
        type: FillType.LinearGradient,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        rotation: 90,
        stops: [
          { color: "#FF0000FF", position: 0 },
          { color: "#00FF00FF", position: 1 },
        ],
      },
    ]);

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | { backgroundColor?: string; backgroundImage?: string }
      | undefined;

    expect(element?.fills).toHaveLength(1);
    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.backgroundImage).toBeUndefined();
  });

  it("generic property update 경로는 Fill V2 에서 derived background style patch 를 제거한다", () => {
    useStore.getState().updateSelectedProperties({
      style: {
        backgroundColor: "#123456",
        backgroundImage: "linear-gradient(red, blue)",
        backgroundSize: "cover",
        paddingTop: "8px",
      },
    });

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | {
          backgroundColor?: string;
          backgroundImage?: string;
          backgroundSize?: string;
          paddingTop?: string;
        }
      | undefined;

    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.backgroundImage).toBeUndefined();
    expect(style?.backgroundSize).toBeUndefined();
    expect(style?.paddingTop).toBe("8px");
  });

  it("store updateElementProps 경로도 Fill V2 에서 derived background style patch 를 제거한다", async () => {
    await useStore.getState().updateElementProps("fill-target", {
      style: {
        backgroundColor: "#654321",
        backgroundImage: "linear-gradient(black, white)",
        backgroundSize: "contain",
        marginTop: "4px",
      },
    });

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | {
          backgroundColor?: string;
          backgroundImage?: string;
          backgroundSize?: string;
          marginTop?: string;
        }
      | undefined;

    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.backgroundImage).toBeUndefined();
    expect(style?.backgroundSize).toBeUndefined();
    expect(style?.marginTop).toBe("4px");
  });

  it("batch update 경로도 Fill V2 에서 derived background style patch 를 제거한다", async () => {
    await useStore.getState().batchUpdateElementProps([
      {
        elementId: "fill-target",
        props: {
          style: {
            backgroundColor: "#222222",
            backgroundImage: "linear-gradient(red, blue)",
            backgroundSize: "cover",
            paddingLeft: "12px",
          },
        },
      },
    ]);

    const element = useStore.getState().elementsMap.get("fill-target");
    const style = element?.props?.style as
      | {
          backgroundColor?: string;
          backgroundImage?: string;
          backgroundSize?: string;
          paddingLeft?: string;
        }
      | undefined;

    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.backgroundImage).toBeUndefined();
    expect(style?.backgroundSize).toBeUndefined();
    expect(style?.paddingLeft).toBe("12px");
  });

  it("addElement 경로는 legacy backgroundImage 를 fills 로 canonicalize 한다", async () => {
    await useStore.getState().addElement({
      id: "added-fill-target",
      type: "Box",
      props: {
        style: {
          backgroundImage: "linear-gradient(90deg, #FF0000 0%, #00FF00 100%)",
          backgroundSize: "cover",
        },
      },
      parent_id: null,
      page_id: null,
      order_num: 0,
    } as Element);

    const element = useStore.getState().elementsMap.get("added-fill-target");
    expect(element?.fills).toHaveLength(1);
    expect(element?.fills?.[0]?.type).toBe(FillType.LinearGradient);
    expect(
      (element?.props?.style as { backgroundImage?: string } | undefined)
        ?.backgroundImage,
    ).toBeUndefined();
  });

  it("mergeElements 경로도 legacy image background 를 fills 로 canonicalize 한다", () => {
    useStore.getState().mergeElements([
      {
        id: "merged-fill-target",
        type: "Box",
        props: {
          style: {
            backgroundImage: "url(https://example.com/hero.png)",
            backgroundSize: "contain",
          },
        },
        parent_id: null,
        page_id: null,
        order_num: 0,
      } as Element,
    ]);

    const element = useStore.getState().elementsMap.get("merged-fill-target");
    expect(element?.fills).toHaveLength(1);
    expect(element?.fills?.[0]?.type).toBe(FillType.Image);
    expect(
      (element?.props?.style as { backgroundImage?: string } | undefined)
        ?.backgroundImage,
    ).toBeUndefined();
  });

  it("addComplexElement 경로도 parent/child legacy background 를 canonicalize 한다", async () => {
    await useStore.getState().addComplexElement(
      {
        id: "complex-parent",
        type: "Box",
        props: {
          style: {
            backgroundColor: "#112233",
          },
        },
        parent_id: null,
        page_id: null,
        order_num: 1,
      } as Element,
      [
        {
          id: "complex-child",
          type: "Box",
          props: {
            style: {
              backgroundImage: "url(https://example.com/detail.png)",
              backgroundSize: "contain",
            },
          },
          parent_id: "complex-parent",
          page_id: null,
          order_num: 0,
        } as Element,
      ],
    );

    const parent = useStore.getState().elementsMap.get("complex-parent");
    const child = useStore.getState().elementsMap.get("complex-child");

    expect(parent?.fills?.[0]?.type).toBe(FillType.Color);
    expect(
      (parent?.props?.style as { backgroundColor?: string } | undefined)
        ?.backgroundColor,
    ).toBeUndefined();
    expect(child?.fills?.[0]?.type).toBe(FillType.Image);
    expect(
      (child?.props?.style as { backgroundImage?: string } | undefined)
        ?.backgroundImage,
    ).toBeUndefined();
  });

  it("hydrateProjectSnapshot 경로도 legacy background payload 를 canonicalize 한다", () => {
    useStore.getState().hydrateProjectSnapshot([
      {
        id: "snapshot-fill-target",
        type: "Box",
        props: {
          style: {
            backgroundImage:
              "radial-gradient(circle at 25% 75%, #FF0000 0%, #0000FF 100%)",
            backgroundSize: "cover",
          },
        },
        parent_id: null,
        page_id: null,
        order_num: 0,
      } as Element,
    ]);

    const element = useStore.getState().elementsMap.get("snapshot-fill-target");
    expect(element?.fills?.[0]?.type).toBe(FillType.RadialGradient);
    expect(
      (element?.props?.style as { backgroundImage?: string } | undefined)
        ?.backgroundImage,
    ).toBeUndefined();
  });
});

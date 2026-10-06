import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CatalogSelectionItem } from "../../../catalogRuntime/session";
import {
  catalogAiEffectBounds,
  catalogMeasureGuides,
  catalogOverlayNode,
  catalogSelectionBox,
  type CatalogOverlayInputs,
} from "./catalogOverlay";
import { renderHoverHighlight, strokeBoundsRect } from "../skia/hoverRenderer";
import { renderSelectionBox } from "../skia/selectionRenderer";

vi.mock("../skia/hoverRenderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../skia/hoverRenderer")>()),
  renderHoverHighlight: vi.fn(),
  strokeBoundsRect: vi.fn(),
}));
vi.mock("../skia/selectionRenderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../skia/selectionRenderer")>()),
  renderSelectionBox: vi.fn(),
  renderTransformHandles: vi.fn(),
  renderDimensionLabels: vi.fn(),
}));

/** ADR-248 Phase 4e: the multi-selection box and Alt-measure of the Canvas overlay. */
const item = (identity: string) =>
  ({ identity }) as unknown as CatalogSelectionItem;
const bounds = new Map([
  ["a", { x: 0, y: 0, width: 10, height: 10 }],
  ["b", { x: 30, y: 20, width: 10, height: 10 }],
  ["c", { x: 60, y: 0, width: 10, height: 10 }],
]);

describe("catalogSelectionBox", () => {
  it("spans every selected box; nothing drawn selects no box", () => {
    expect(
      catalogSelectionBox({ selection: [item("a"), item("b")] }, bounds),
    ).toEqual({ x: 0, y: 0, width: 40, height: 30 });
    expect(catalogSelectionBox({ selection: [item("a")] }, bounds)).toEqual(
      bounds.get("a"),
    );
    expect(catalogSelectionBox({ selection: [item("x")] }, bounds)).toBeNull();
  });
});

describe("catalogMeasureGuides", () => {
  const hover = { identity: "c" } as never;
  it("measures from the selection's box to the hovered record while Alt is held", () => {
    const guides = catalogMeasureGuides(
      { selection: [item("a"), item("b")], hover },
      bounds,
      true,
    );
    expect(guides).toEqual([
      expect.objectContaining({ axis: "x", start: 40, end: 60, value: 20 }),
    ]);
  });
  it("shows nothing without Alt, a selection, or with the hovered record selected", () => {
    const state = { selection: [item("a")], hover };
    expect(catalogMeasureGuides(state, bounds, false)).toEqual([]);
    expect(
      catalogMeasureGuides({ selection: [], hover }, bounds, true),
    ).toEqual([]);
    expect(
      catalogMeasureGuides(
        { selection: [item("a"), item("c")], hover },
        bounds,
        true,
      ),
    ).toEqual([]);
  });
});

describe("catalog AI effect targets", () => {
  it("gives each drawn target its scene box and corner radius, and leaves out the undrawn", () => {
    const targets = catalogAiEffectBounds(["a", "b", "gone"], bounds, (id) =>
      id === "b" ? 6 : 0,
    );
    expect([...targets.values()]).toEqual([
      { elementId: "a", x: 0, y: 0, width: 10, height: 10, borderRadius: 0 },
      { elementId: "b", x: 30, y: 20, width: 10, height: 10, borderRadius: 6 },
    ]);
  });
});

describe("Builder 전용 Page 기본 테두리", () => {
  beforeEach(() => vi.clearAllMocks());

  const color = Float32Array.of(0.4, 0.5, 0.6, 1);
  const inputs = (): CatalogOverlayInputs => ({
    session: () => ({
      pageId: undefined,
      selection: [],
      hover: undefined,
      editingContext: undefined,
      textEditing: undefined,
      breakpoint: "desktop",
    }),
    bounds: () => bounds,
    pageBorders: () => ({ roots: ["a", "b", "missing"], color }),
    recordsOf: () => [],
    zoom: () => 2,
    fontMgr: () => undefined,
  });

  it("그려진 Page에만 1px 선을 추가하고 일반 자식·없는 Page는 제외한다", () => {
    const input = inputs();
    const ck = {} as CanvasKit;
    const canvas = {} as Canvas;
    catalogOverlayNode(ck, input).renderSkia(
      canvas,
      new DOMRect(0, 0, 800, 600),
    );

    expect(strokeBoundsRect).toHaveBeenCalledTimes(2);
    for (const id of ["a", "b"])
      expect(strokeBoundsRect).toHaveBeenCalledWith(
        ck,
        canvas,
        bounds.get(id),
        color,
        0.5,
        null,
      );

    vi.clearAllMocks();
    // Definition/Components view 또는 Page가 없는 화면은 기본 선을 추가하지 않는다.
    input.pageBorders = () => ({ roots: [], color });
    catalogOverlayNode(ck, input).renderSkia(
      canvas,
      new DOMRect(0, 0, 800, 600),
    );
    expect(strokeBoundsRect).not.toHaveBeenCalled();
  });

  it("hover·선택이 기본 테두리를 대체하고 해제하면 기본 색으로 돌아온다", () => {
    const input = inputs();
    const base = input.session();
    const node = catalogOverlayNode({} as CanvasKit, input);
    const canvas = {} as Canvas;
    input.session = () => ({
      ...base,
      hover: item("a"),
      selection: [item("b")],
    });
    node.renderSkia(canvas, new DOMRect(0, 0, 800, 600));
    expect(strokeBoundsRect).not.toHaveBeenCalled();
    expect(renderHoverHighlight).toHaveBeenCalledTimes(1);
    expect(renderSelectionBox).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    input.session = () => ({
      ...base,
      hover: item("a"),
      selection: [item("a")],
    });
    node.renderSkia(canvas, new DOMRect(0, 0, 800, 600));
    expect(renderHoverHighlight).not.toHaveBeenCalled();
    expect(renderSelectionBox).toHaveBeenCalledTimes(1);
    expect(strokeBoundsRect).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    input.session = () => base;
    node.renderSkia(canvas, new DOMRect(0, 0, 800, 600));
    expect(strokeBoundsRect).toHaveBeenCalledTimes(2);
  });

  it("뒤 Page의 기본 선은 앞 Page에 가려지고 새 테마 색을 소비한다", () => {
    const input = inputs();
    const ck = {
      XYWHRect: vi.fn((...rect) => rect),
      ClipOp: { Difference: 0 },
    } as unknown as CanvasKit;
    const canvas = {
      save: vi.fn(),
      clipRect: vi.fn(),
      restore: vi.fn(),
    } as unknown as Canvas;
    input.occluders = (id) => (id === "a" ? [bounds.get("b")!] : []);
    const node = catalogOverlayNode(ck, input);
    node.renderSkia(canvas, new DOMRect(0, 0, 800, 600));
    expect(canvas.clipRect).toHaveBeenCalledWith([30, 20, 10, 10], 0, true);
    expect(vi.mocked(canvas.save).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(strokeBoundsRect).mock.invocationCallOrder[0],
    );
    expect(
      vi.mocked(canvas.restore).mock.invocationCallOrder[0],
    ).toBeGreaterThan(vi.mocked(strokeBoundsRect).mock.invocationCallOrder[0]);
    const nextColor = Float32Array.of(0.7, 0.8, 0.9, 1);
    input.pageBorders = () => ({ roots: ["b"], color: nextColor });
    node.renderSkia(canvas, new DOMRect(0, 0, 800, 600));
    expect(strokeBoundsRect).toHaveBeenLastCalledWith(
      ck,
      canvas,
      bounds.get("b"),
      nextColor,
      0.5,
      null,
    );
  });
});

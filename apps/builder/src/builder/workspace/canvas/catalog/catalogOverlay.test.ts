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
import { renderHoverHighlight } from "../skia/hoverRenderer";
import { renderSelectionBox } from "../skia/selectionRenderer";

vi.mock("../skia/hoverRenderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../skia/hoverRenderer")>()),
  renderHoverHighlight: vi.fn(),
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
  const viewport = new DOMRect(0, 0, 800, 600);
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
  const surface = () => {
    const paint = {
      setAntiAlias: vi.fn(),
      setStyle: vi.fn(),
      setColor: vi.fn(),
      setStrokeWidth: vi.fn(),
      delete: vi.fn(),
    };
    const Paint = vi.fn(function () {
      return paint;
    });
    const ck = {
      Paint,
      PaintStyle: { Stroke: 1 },
      ClipOp: { Difference: 0 },
      XYWHRect: (...rect: number[]) => rect,
    } as unknown as CanvasKit;
    const canvas = {
      drawRect: vi.fn(),
      save: vi.fn(),
      clipRect: vi.fn(),
      restore: vi.fn(),
    } as unknown as Canvas;
    return { ck, canvas, paint, Paint };
  };

  it("그려진 Page에만 1px 선을 추가하고 일반 자식·없는 Page는 제외한다", () => {
    const input = inputs();
    const { ck, canvas, paint } = surface();
    const node = catalogOverlayNode(ck, input);
    node.renderSkia(canvas, viewport);
    expect(canvas.drawRect).toHaveBeenCalledTimes(2);
    expect(canvas.drawRect).toHaveBeenCalledWith([0, 0, 10, 10], paint);
    expect(canvas.drawRect).toHaveBeenCalledWith([30, 20, 10, 10], paint);
    expect(paint.setStrokeWidth).toHaveBeenLastCalledWith(0.5);
    expect(paint.setColor).toHaveBeenLastCalledWith(color);

    vi.clearAllMocks();
    input.session = () => ({
      ...inputs().session(),
      definitionView: "project:definition:test" as never,
    });
    node.renderSkia(canvas, viewport);
    expect(canvas.drawRect).not.toHaveBeenCalled();
    node.dispose();
  });

  it("hover·선택이 기본 테두리를 대체하고 해제하면 기본 색으로 돌아온다", () => {
    const input = inputs();
    const base = input.session();
    const { ck, canvas } = surface();
    const node = catalogOverlayNode(ck, input);
    input.session = () => ({
      ...base,
      hover: item("a"),
      selection: [item("b")],
    });
    node.renderSkia(canvas, viewport);
    expect(canvas.drawRect).not.toHaveBeenCalled();
    expect(renderHoverHighlight).toHaveBeenCalledTimes(1);
    expect(renderSelectionBox).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    input.session = () => ({
      ...base,
      hover: item("a"),
      selection: [item("a")],
    });
    node.renderSkia(canvas, viewport);
    expect(renderHoverHighlight).not.toHaveBeenCalled();
    expect(renderSelectionBox).toHaveBeenCalledTimes(1);
    expect(canvas.drawRect).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    input.session = () => base;
    node.renderSkia(canvas, viewport);
    expect(canvas.drawRect).toHaveBeenCalledTimes(2);
    node.dispose();
  });

  it("뒤 Page의 기본 선은 앞 Page에 가려진다", () => {
    const input = inputs();
    const { ck, canvas } = surface();
    input.occluders = (id) => (id === "a" ? [bounds.get("b")!] : []);
    const node = catalogOverlayNode(ck, input);
    node.renderSkia(canvas, viewport);
    expect(canvas.clipRect).toHaveBeenCalledWith([30, 20, 10, 10], 0, true);
    expect(vi.mocked(canvas.save).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(canvas.drawRect).mock.invocationCallOrder[0],
    );
    expect(
      vi.mocked(canvas.restore).mock.invocationCallOrder[0],
    ).toBeGreaterThan(vi.mocked(canvas.drawRect).mock.invocationCallOrder[0]);
    node.dispose();
  });

  it("테마·줌이 바뀌어도 Paint 1개를 재사용하고 Canvas 종료 때 해제한다", () => {
    const input = inputs();
    const { ck, canvas, paint, Paint } = surface();
    const node = catalogOverlayNode(ck, input);
    node.renderSkia(canvas, viewport);
    const nextColor = Float32Array.of(0.7, 0.8, 0.9, 1);
    input.pageBorders = () => ({ roots: ["b"], color: nextColor });
    input.zoom = () => 0.5;
    node.renderSkia(canvas, viewport);
    expect(Paint).toHaveBeenCalledTimes(1);
    expect(paint.setColor).toHaveBeenLastCalledWith(nextColor);
    expect(paint.setStrokeWidth).toHaveBeenLastCalledWith(2);
    expect(paint.delete).not.toHaveBeenCalled();
    node.dispose();
    expect(paint.delete).toHaveBeenCalledTimes(1);
  });
});

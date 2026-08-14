import { describe, expect, it } from "vitest";
import { buildImageNodeData } from "./buildImageNodeData";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

/**
 * Image box.fillColor — 사용자 배경 vs placeholder 토큰 (2026-08-14 fix)
 *
 * DOM oracle: Preview 는 `.react-aria-Image` 가 `background: var(--bg-muted)` 를 항상
 * 깔고, 사용자 inline `style.background(-Color)` 가 이를 override 한다 (LayoutRenderers
 * renderImage — `...element.props.style` spread). 즉 배경 = 사용자 지정 우선, 없으면
 * muted 기본, 이미지 **뒤** 레이어.
 *
 * 구 Skia builder 는 `converted.fill`(convertStyle 이 변환한 사용자 배경)을 버리고
 * catalog placeholder 토큰만 box.fillColor 에 넣어 사용자 배경이 무시됐다 (D3 발산).
 */

function makeElement(
  style: Record<string, unknown>,
  fills?: unknown[],
): CanvasSceneNode {
  return {
    id: "img-1",
    type: "Image",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: { style },
    ...(fills ? { fills } : {}),
  } as unknown as CanvasSceneNode;
}

function makeLayout(): ComputedLayout {
  return { x: 0, y: 0, width: 200, height: 100 } as ComputedLayout;
}

function fillOf(style: Record<string, unknown>): Float32Array {
  const node = buildImageNodeData({
    element: makeElement(style),
    layout: makeLayout(),
    skImage: null,
    theme: "light",
  });
  expect(node?.box).toBeDefined();
  return node!.box!.fillColor;
}

describe("buildImageNodeData — box.fillColor 사용자 배경 우선", () => {
  it("canonical fills (V2 — 현행 Style 패널 경로) 가 최우선", () => {
    // Style 패널 Background 커밋은 sanitize 가 style.backgroundColor 를 비우고
    // canonical fills 에 기록한다 — 라이브 저작의 주 채널.
    const node = buildImageNodeData({
      element: makeElement({}, [
        {
          id: "f1",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          type: "color",
          color: "#ff0000ff",
        },
      ]),
      layout: makeLayout(),
      skImage: null,
      theme: "light",
    });
    expect(Array.from(node!.box!.fillColor)).toEqual([1, 0, 0, 1]);
  });

  it("fills 가 style 배경보다 우선 (buildBoxNodeData 동일 우선순위)", () => {
    const node = buildImageNodeData({
      element: makeElement({ backgroundColor: "rgb(0, 255, 0)" }, [
        {
          id: "f1",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          type: "color",
          color: "#0000ffff",
        },
      ]),
      layout: makeLayout(),
      skImage: null,
      theme: "light",
    });
    expect(Array.from(node!.box!.fillColor)).toEqual([0, 0, 1, 1]);
  });

  it("backgroundColor 지정 시 그 색이 fillColor (placeholder 토큰 아님)", () => {
    const fill = fillOf({ backgroundColor: "rgb(255, 0, 0)" });
    expect(Array.from(fill)).toEqual([1, 0, 0, 1]);
  });

  it("background shorthand (hex) 도 동일 적용", () => {
    const fill = fillOf({ background: "#00ff00" });
    expect(Array.from(fill)).toEqual([0, 1, 0, 1]);
  });

  it("rgba 알파는 fillColor alpha 로 보존", () => {
    const fill = fillOf({ backgroundColor: "rgba(0, 0, 255, 0.5)" });
    expect(fill[0]).toBe(0);
    expect(fill[1]).toBe(0);
    expect(fill[2]).toBe(1);
    expect(fill[3]).toBeCloseTo(0.5, 5);
  });

  it("배경 미지정 시 placeholder 토큰 유지 (기존 동작 — alpha 1 회색 계열)", () => {
    const fill = fillOf({});
    expect(fill[3]).toBe(1);
    // placeholder = {color.neutral-subtle} 계열 무채색 — 사용자 색과의 구분만 잠근다
    expect(Array.from(fill)).not.toEqual([1, 0, 0, 1]);
  });

  it("opacity 만 지정(배경 없음)이면 placeholder 유지 — 흰 배경 오염 금지", () => {
    // convertToFillStyle 은 bg 없이 opacity 만 있으면 color=white/alpha=opacity 를
    // 내므로, alpha>0 게이트로 판정하면 흰 배경이 그려진다. 판정은 raw style 의
    // 배경 지정 여부여야 한다.
    const withOpacity = fillOf({ opacity: 0.5 });
    const baseline = fillOf({});
    expect(Array.from(withOpacity)).toEqual(Array.from(baseline));
  });

  it("opacity + 배경 동시 지정 시 fill alpha 는 bg 자체 alpha (opacity 는 effect 로 별도)", () => {
    const node = buildImageNodeData({
      element: makeElement({ backgroundColor: "rgb(255, 0, 0)", opacity: 0.5 }),
      layout: makeLayout(),
      skImage: null,
      theme: "light",
    });
    // opacity 는 OpacityEffect 로 노드 전체에 걸린다 — fill 에 이중 적용 금지
    expect(node?.effects?.some((e) => e.type === "opacity")).toBe(true);
    expect(node!.box!.fillColor[3]).toBe(1);
    expect(Array.from(node!.box!.fillColor.slice(0, 3))).toEqual([1, 0, 0]);
  });

  it("transparent 배경은 alpha 0 — DOM 의 muted 기본 override 와 대칭", () => {
    const fill = fillOf({ background: "transparent" });
    expect(fill[3]).toBe(0);
  });

  it("gradient/url 배경 문자열은 solid 아님 — placeholder 토큰 fallback (흰색 오염 금지)", () => {
    const gradient = fillOf({
      background: "linear-gradient(90deg, #ff0000, #0000ff)",
    });
    const baseline = fillOf({});
    expect(Array.from(gradient)).toEqual(Array.from(baseline));
  });
});

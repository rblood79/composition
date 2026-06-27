/**
 * ToggleButtonGroup segmented border-radius — Skia four-corner radius 시각 로직 oracle 테스트.
 *
 * reference react-aria-starter ToggleButtonGroup.css:32-67 동형 — 그룹 안 ToggleButton 은 양끝만
 * 바깥쪽 코너가 둥글고 중간은 0. `resolveSegmentedRadius` 가 `_groupPosition`(orientation/isFirst/
 * isLast/isOnly) 데이터 키로 위치별 [tl,tr,br,bl] four-corner 를 산출하고, buildCatalogShapes 의
 * roundRect/border shape radius 에 배열로 전달된다(specShapeConverter.resolveRadius → box.borderRadius
 * → createRoundRectPath per-corner 렌더).
 *
 * Skia 스크린샷 도구 제약(WebGL canvas CDP 타임아웃)으로 시각 픽셀 직접 검증이 막혀 있어, 본 oracle
 * 테스트가 시각 로직의 회귀 가드 역할을 한다(treeIndent.test 동형 — live: CSS preview getComputedStyle
 * segmented 확인 + Skia dist serve 확인으로 보완). CSS 경로(generated ToggleButtonGroup.css
 * [data-orientation] segmented)와 동일 공식이라 양 경로 시각 대칭(D3).
 */

import { describe, it, expect } from "vitest";
import {
  buildCatalogShapes,
  resolveSegmentedRadius,
} from "../buildCatalogShapes";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { SizeSpec } from "../../types";

const pos = (
  orientation: string,
  isFirst: boolean,
  isLast: boolean,
  isOnly = false,
) => ({ _groupPosition: { orientation, isFirst, isLast, isOnly } });

describe("resolveSegmentedRadius — reference 공식 oracle", () => {
  const R = 6;

  it("horizontal first = [r,0,0,r] (좌측 두 코너만)", () => {
    expect(resolveSegmentedRadius(pos("horizontal", true, false), R)).toEqual([
      R,
      0,
      0,
      R,
    ]);
  });

  it("horizontal last = [0,r,r,0] (우측 두 코너만)", () => {
    expect(resolveSegmentedRadius(pos("horizontal", false, true), R)).toEqual([
      0,
      R,
      R,
      0,
    ]);
  });

  it("horizontal middle = [0,0,0,0] (전부 직각)", () => {
    expect(resolveSegmentedRadius(pos("horizontal", false, false), R)).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("vertical first = [r,r,0,0] (상단 두 코너만)", () => {
    expect(resolveSegmentedRadius(pos("vertical", true, false), R)).toEqual([
      R,
      R,
      0,
      0,
    ]);
  });

  it("vertical last = [0,0,r,r] (하단 두 코너만)", () => {
    expect(resolveSegmentedRadius(pos("vertical", false, true), R)).toEqual([
      0,
      0,
      R,
      R,
    ]);
  });

  it("isOnly = null (단독 버튼 — caller 가 균등 radius 유지)", () => {
    expect(resolveSegmentedRadius(pos("horizontal", true, true, true), R)).toBe(
      null,
    );
  });

  it("_groupPosition 미주입 = null (group 밖 / 타 컴포넌트)", () => {
    expect(resolveSegmentedRadius({}, R)).toBe(null);
  });
});

describe("buildCatalogShapes — segmented four-corner 전달", () => {
  const VISUAL: ComponentVisualRule = {
    fill: { default: { base: "#e5e5e5" } },
    text: "#171717",
  } as unknown as ComponentVisualRule;
  const SIZE_MD: SizeSpec = {
    height: 30,
    paddingX: 12,
    paddingY: 6,
    fontSize: 14,
    borderRadius: 6,
    borderWidth: 1,
  } as unknown as SizeSpec;

  const bgRadius = (shapes: ReturnType<typeof buildCatalogShapes>) => {
    const bg = shapes.find((s) => s.type === "roundRect");
    return (bg as { radius?: unknown } | undefined)?.radius;
  };

  it("group 안 first ToggleButton → roundRect radius = [r,0,0,r]", () => {
    const shapes = buildCatalogShapes(
      VISUAL,
      pos("horizontal", true, false),
      SIZE_MD,
    );
    expect(bgRadius(shapes)).toEqual([6, 0, 0, 6]);
  });

  it("group 안 last ToggleButton → roundRect radius = [0,r,r,0]", () => {
    const shapes = buildCatalogShapes(
      VISUAL,
      pos("horizontal", false, true),
      SIZE_MD,
    );
    expect(bgRadius(shapes)).toEqual([0, 6, 6, 0]);
  });

  it("단독 ToggleButton(_groupPosition 없음) → roundRect radius = 균등 scalar 6", () => {
    const shapes = buildCatalogShapes(VISUAL, {}, SIZE_MD);
    expect(bgRadius(shapes)).toBe(6);
  });

  // ── TokenRef borderRadius (실제 catalog 형태) ──
  //   ToggleButton catalog sizes[*].borderRadius 는 "{radius.md}" 같은 TokenRef 다
  //   (ruleSizeToSizeSpec 가 값 변환 없이 cast). number fixture 만 검증하던 위 테스트는
  //   typeof === "number" 게이트 회귀를 못 잡았다(2026-06-27). TokenRef 도 segmented 배열로
  //   분배되어야 하며, TokenRef 요소는 specShapeConverter.resolveRadius 가 런타임 해소한다.
  const SIZE_MD_TOKEN: SizeSpec = {
    height: 30,
    paddingX: 12,
    paddingY: 6,
    fontSize: 14,
    borderRadius: "{radius.md}",
    borderWidth: 1,
  } as unknown as SizeSpec;

  it("TokenRef radius + group 안 first → roundRect radius = [{radius.md},0,0,{radius.md}]", () => {
    const shapes = buildCatalogShapes(
      VISUAL,
      pos("horizontal", true, false),
      SIZE_MD_TOKEN,
    );
    expect(bgRadius(shapes)).toEqual(["{radius.md}", 0, 0, "{radius.md}"]);
  });

  it("TokenRef radius + group 안 last → roundRect radius = [0,{radius.md},{radius.md},0]", () => {
    const shapes = buildCatalogShapes(
      VISUAL,
      pos("horizontal", false, true),
      SIZE_MD_TOKEN,
    );
    expect(bgRadius(shapes)).toEqual([0, "{radius.md}", "{radius.md}", 0]);
  });

  it("TokenRef radius + middle → roundRect radius = [0,0,0,0]", () => {
    const shapes = buildCatalogShapes(
      VISUAL,
      pos("horizontal", false, false),
      SIZE_MD_TOKEN,
    );
    expect(bgRadius(shapes)).toEqual([0, 0, 0, 0]);
  });

  it("TokenRef radius + 단독 → 균등 TokenRef passthrough", () => {
    const shapes = buildCatalogShapes(VISUAL, {}, SIZE_MD_TOKEN);
    expect(bgRadius(shapes)).toBe("{radius.md}");
  });
});

describe("resolveSegmentedRadius — TokenRef radius 분배", () => {
  it("TokenRef first = [tok,0,0,tok] (number 게이트 없이 분배)", () => {
    expect(
      resolveSegmentedRadius(pos("horizontal", true, false), "{radius.md}"),
    ).toEqual(["{radius.md}", 0, 0, "{radius.md}"]);
  });

  it("TokenRef vertical last = [0,0,tok,tok]", () => {
    expect(
      resolveSegmentedRadius(pos("vertical", false, true), "{radius.lg}"),
    ).toEqual([0, 0, "{radius.lg}", "{radius.lg}"]);
  });
});

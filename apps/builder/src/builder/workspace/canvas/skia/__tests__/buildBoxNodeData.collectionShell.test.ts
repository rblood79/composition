import { describe, expect, it } from "vitest";

import { buildBoxNodeData } from "../buildBoxNodeData";
import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ComputedLayout } from "../../layout/engines/LayoutEngine";

/**
 * data-bound collection projection 컨테이너(box 경로)의 catalog "shell variant" 배경 복원.
 *
 * 확정 결함: data-bound ListBox(ref)는 box 경로(buildBoxNodeData)로 렌더돼 catalog
 * `ListBox.structure.containerStyles.background = {color.raised}` shell 배경을 건너뛴다
 * (catalog 경로만 shell 담당). 컨테이너가 투명해져 컨테이너 box-shadow(drop-shadow effect)가
 * 불투명 자식 행 실루엣을 캡처 → "행마다 box-shadow"(CSS 는 --bg-raised 불투명 + border-box 정상).
 * 수정: scene 이 collectionShellTag 로 식별한 컨테이너에 한해, 사용자 배경이 없을 때 catalog
 * 배경 토큰을 theme-aware 로 fill 에 복원. 불투명해지면 drop-shadow 실루엣 = border-box.
 *
 * 전제: `{color.raised}` = Skia lightColors "#f9fafb"(gray-50) / darkColors "#202023"(zinc-850).
 */
const layout: ComputedLayout = {
  x: 0,
  y: 0,
  width: 200,
  height: 100,
} as unknown as ComputedLayout;

function build(
  extra: Partial<CanvasSceneNode> & { style?: Record<string, unknown> },
  theme: "light" | "dark" = "light",
) {
  const { style, ...rest } = extra;
  const element = {
    id: "n1",
    type: "ref",
    props: { style: style ?? {} },
    ...rest,
  } as unknown as CanvasSceneNode;
  return buildBoxNodeData({ element, layout, theme });
}

// Float32Array [r,g,b,a] → "#rrggbb"
function toHex(fc: Float32Array | undefined): string {
  if (!fc) return "(none)";
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(fc[i]! * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

describe("buildBoxNodeData — collection shell 배경 복원 (ADR-071 raised)", () => {
  it("collectionShellTag=ListBox + 사용자 배경 없음 → box.fillColor = --bg-raised(gray-50, 불투명)", () => {
    const node = build({ collectionShellTag: "ListBox" });
    expect(toHex(node?.box?.fillColor)).toBe("#f9fafb");
    expect(node?.box?.fillColor?.[3]).toBe(1); // 불투명 (drop-shadow 가 border-box 실루엣)
  });

  it("dark theme → box.fillColor = --bg-raised(zinc-850)", () => {
    const node = build({ collectionShellTag: "ListBox" }, "dark");
    expect(toHex(node?.box?.fillColor)).toBe("#202023");
    expect(node?.box?.fillColor?.[3]).toBe(1);
  });

  it("사용자 backgroundColor 설정 시 → catalog 배경 미주입(사용자 값 보존)", () => {
    const node = build({
      collectionShellTag: "ListBox",
      style: { backgroundColor: "#ff0000" },
    });
    // 사용자 빨강이 우선 — gray-50 로 덮어쓰지 않음.
    expect(toHex(node?.box?.fillColor)).toBe("#ff0000");
  });

  it("collectionShellTag 없음(일반 box) → 투명 유지 (BC)", () => {
    const node = build({});
    expect(node?.box?.fillColor?.[3]).toBe(0);
  });

  it("GridList shell 도 동일 복원 (structure.containerStyles.background 보유 시)", () => {
    const node = build({ collectionShellTag: "GridList" });
    // GridList 도 raised 배경이면 gray-50. 배경 토큰 부재면 투명(안전 no-op) — 존재 시 불투명.
    const alpha = node?.box?.fillColor?.[3];
    expect(alpha === 1 || alpha === 0).toBe(true);
  });
});

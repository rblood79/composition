/**
 * 캔버스 "선택·포커스" 파랑 단일화 계약 (2026-09-17).
 *
 * Figma (`#0D99FF`) · Framer (`#0099FF`) 는 선택 테두리 · 치수 배지 · 포커스 링 · 호버
 * 외곽선에 **같은 파랑 하나**를 쓰고 색이 아니라 채움/두께로 구분한다. 우리도 정본을
 * `semanticOverlayColors.OVERLAY_BLUE` 하나로 두고, 값은 외부 리터럴이 아니라 우리
 * 팔레트 토큰 (blue-400) 에서 파생한다 — CSS `--focus-ring` 과 같은 값이라 DOM 층
 * (페이지 헤더) 과 Skia 오버레이가 한 색으로 맞는다.
 *
 * 이 게이트가 막는 것: 오버레이 파랑을 파일마다 hex 로 다시 적어 값이 갈리는 것
 * (실제로 선택 `#2b7fff` / 치수 배지 `#51a2ff` / 가이드 `#6dc1ff` 3갈래였다).
 */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TAILWIND_PALETTE } from "@composition/specs";
import { OVERLAY_BLUE_RGB, hexToRgb01 } from "./semanticOverlayColors";

const read = (file: string) => readFile(resolve(__dirname, file), "utf-8");

describe("캔버스 오버레이 파랑 단일화", () => {
  it("정본 OVERLAY_BLUE 는 팔레트 blue-400 파생 — CSS --focus-ring 과 같은 값", async () => {
    expect(OVERLAY_BLUE_RGB).toEqual(hexToRgb01(TAILWIND_PALETTE.blue[400]));
    expect(TAILWIND_PALETTE.blue[400]).toBe("#51a2ff");

    // builder 테마의 --focus-ring 이 같은 팔레트 단계를 가리킨다
    const theme = await read(
      "../../../../../../../packages/shared/src/components/styles/theme/builder-system.css",
    );
    expect(theme).toMatch(/--focus-ring:\s*var\(--color-blue-400\)/);
  });

  it("치수 배지 · 선택 가이드는 파랑을 다시 적지 않고 정본/팔레트에서 파생한다", async () => {
    const selection = await read("./selectionRenderer.ts");
    const guide = await read("./guideRenderer.ts");

    // 종전 하드코딩이 부활하지 않는다
    expect(selection).not.toMatch(/DIMENSION_LABEL_BG_[RGB]\s*=/);
    expect(selection.toLowerCase()).not.toContain("0x51 / 255");
    expect(guide.toLowerCase()).not.toContain("0x6dc1ff");

    // 배지는 정본 파랑, 선택 가이드는 같은 팔레트 단계
    expect(selection).toContain(
      "ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, 1)",
    );
    expect(guide).toContain("TAILWIND_PALETTE.blue[400]");
  });

  it("프레임 타이틀 회색도 팔레트 파생 (하드코딩 #64748b 제거)", async () => {
    const selection = await read("./selectionRenderer.ts");
    expect(selection).toContain("TAILWIND_PALETTE.slate[500]");
    expect(selection.toLowerCase()).not.toContain("0x64 / 255");
  });

  it("의미 축이 다른 hue 는 파랑에 흡수하지 않는다 (컴포넌트 보라 · 가이드 빨강)", async () => {
    const semantic = await read("./semanticOverlayColors.ts");
    // Figma 도 컴포넌트=보라 · 위험/가이드=빨강 으로 hue 를 분리한다
    expect(semantic).toContain("OVERLAY_WARM_RED_HEX = 0xf24822");
    expect(semantic).toMatch(/ORIGIN_R|INSTANCE_R/);
  });
});

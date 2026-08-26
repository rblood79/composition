/**
 * ADR-191 Phase 3 — Skia 가 DOM 에서 읽는 토큰 파서가 tailwindcss/theme.css 파생 oklch 를 실제로 해석한다.
 *
 * 과거: `cssColorToHex` 는 colord 단독이라 `--border: oklch(87% 0 0)` (App.css 시절) 부터 항상 fallback 색으로
 * 떨어졌다 — Skia ↔ DOM 대칭이 Skia 쪽에서 조용히 깨져 있던 기존 결함. 팔레트 원천 단일화로 모든 neutral 토큰이
 * `oklch(L% 0 none)` 로 오므로 여기서 회귀 고정.
 */
import { describe, expect, it } from "vitest";
import { cssColorToHex } from "../cssVariableCore";

const FALLBACK = 0xff00ff;

describe("cssVariableCore.cssColorToHex — oklch", () => {
  it("무채색 `oklch(L% 0 none)` (theme.css neutral) 을 sRGB 로 내린다", () => {
    expect(cssColorToHex("oklch(87% 0 none)", FALLBACK)).toBe(0xd4d4d4); // neutral-300
    expect(cssColorToHex("oklch(37.1% 0 none)", FALLBACK)).toBe(0x404040); // neutral-700
    expect(cssColorToHex("oklch(20.5% 0 none)", FALLBACK)).toBe(0x171717); // neutral-900
  });

  it("유채색 oklch — Phase 0 canvas 실측과 일치 (gray-500 106,114,130 / blue-500 43,127,255)", () => {
    expect(cssColorToHex("oklch(55.1% 0.027 264.364)", FALLBACK)).toBe(
      0x6a7282,
    );
    expect(cssColorToHex("oklch(62.3% 0.214 259.815)", FALLBACK)).toBe(
      0x2b7fff,
    );
  });

  it("알파 성분과 공백 변형을 허용한다", () => {
    expect(cssColorToHex("oklch(87% 0 none / 0.5)", FALLBACK)).toBe(0xd4d4d4);
    expect(cssColorToHex("  oklch( 0.87 0 0 )  ", FALLBACK)).toBe(0xd4d4d4);
  });

  it("hex / rgb 는 기존 colord 경로 그대로, 파싱 불가는 fallback", () => {
    expect(cssColorToHex("#3b82f6", FALLBACK)).toBe(0x3b82f6);
    expect(cssColorToHex("rgb(59, 130, 246)", FALLBACK)).toBe(0x3b82f6);
    expect(cssColorToHex("oklch(garbage)", FALLBACK)).toBe(FALLBACK);
    expect(cssColorToHex("", FALLBACK)).toBe(FALLBACK);
  });
});

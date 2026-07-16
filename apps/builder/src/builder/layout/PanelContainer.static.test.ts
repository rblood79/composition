import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-155: 숨은 패널 selection fan-out 차단 — 패널 활성 gating 정적 가드.
 *
 * 1. PanelWrapper 는 PanelContent 를 <Activity mode> 로 감싼다 (전 패널 gating).
 * 2. PanelContent 의 isActive={true} 하드코딩은 유지 — 실값 전달로 바꾸면
 *    left/right 패널의 `if (!isActive) return null` 가드가 즉시 unmount 로
 *    전환되어 기각된 대안 C 동작 (패널 로컬 상태 소실, HC3 위반) 이 된다.
 */
describe("PanelContainer Activity gating contract (ADR-155)", () => {
  const readSource = () =>
    readFile(resolve(__dirname, "PanelContainer.tsx"), "utf-8");

  it("PanelWrapper 가 PanelContent 를 Activity mode 로 감싼다", async () => {
    const source = await readSource();
    expect(source).toMatch(/import \{ Activity, /);
    expect(source).toMatch(
      /<Activity mode=\{isActive \? "visible" : "hidden"\}>\{content\}<\/Activity>/,
    );
  });

  it("PanelContent 는 isActive={true} 하드코딩 유지 (실값 전달 재도입 차단)", async () => {
    const source = await readSource();
    expect(source).toMatch(/<PanelComponent isActive=\{true\}/);
    expect(source).not.toMatch(/<PanelComponent isActive=\{isActive\}/);
  });

  it("data-active CSS 채널 유지 (슬라이드 애니메이션·레이아웃 공간 담당)", async () => {
    const source = await readSource();
    expect(source).toMatch(/data-active=\{isActive\}/);
  });
});

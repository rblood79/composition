import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("performanceMonitor canonical count contract", () => {
  it("uses canonical elements for monitoring counts before store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "performanceMonitor.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalElementCount()");
    expect(source).toContain("getCanonicalFirstElementCount(state)");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain(["state", "elementsMap?.size"].join("."));
  });
});

describe("요소 수 실측 — 단일 출처 계약", () => {
  /**
   * **Why (2026-08-15 실측)**: 요소 수 출처가 둘이었고 한쪽이 죽어 있었다.
   * `gpuMetrics.elementCount` 는 writer(`updateElementCount`) 호출부가 ADR-900
   * 이후 0건이라 **상시 0** 이었는데, dev 프로파일러가 그 값을 읽어
   * "요소 수: 0" 을 출력했다 (실측: 배선 후 445). canonical 실측을 하는
   * `getDocumentElementCount` 로 단일화한다.
   */
  it("공용 실측 helper 를 export 한다", async () => {
    const source = await readFile(
      resolve(__dirname, "performanceMonitor.ts"),
      "utf-8",
    );

    expect(source).toContain("export function getDocumentElementCount()");
  });

  it("dev 프로파일러가 store 지표가 아니라 실측 helper 를 읽는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../workspace/canvas/benchmarks/devProfiler.ts"),
      "utf-8",
    );

    expect(source).toContain("getDocumentElementCount()");
    // 죽은 store 채널 재도입 금지 (주석 인용은 제외하고 코드 줄만 검사)
    const codeLines = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"));
    expect(codeLines.filter((l) => l.includes("m.elementCount"))).toEqual([]);
  });

  it("path-heavy-117 자동 run 이 완료 p95를 report 계약과 DOM evidence에 보존한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../workspace/canvas/benchmarks/devProfiler.ts"),
      "utf-8",
    );

    expect(source).toContain('const AUTO_PROFILE_SCENARIO = "path-heavy-117"');
    expect(source).toContain("lastCompletedProfile = completed");
    expect(source).toContain("lastCompletedProfile ?? takeSnapshot()");
    expect(source).toContain("dataset.compositionProfilerReport");
    expect(source).toContain('dataset.compositionProfilerStatus = "complete"');
    expect(source).toContain('supportedEntryTypes.includes("longtask")');
    expect(source).toContain("longTaskObserver.takeRecords()");
  });
});

describe("performanceMonitor FPS 버스트 계약", () => {
  // ADR-167 D1 — 유휴 rAF wake 제거. 상시 루프는 30초에 1회 읽히는
  // 0.5초 버퍼를 위해 초당 100+ 회 깨어났다 (2026-07-26 실측 118 wake/s).
  it("상시 rAF 루프 없이 유한 버스트로만 FPS 를 측정한다", async () => {
    const source = await readFile(
      resolve(__dirname, "performanceMonitor.ts"),
      "utf-8",
    );

    // 구 상시 루프 심볼 부활 금지
    expect(source).not.toContain("startFPSMeasurement");
    expect(source).not.toContain("stopFPSMeasurement");

    // 버스트 경로 존재
    expect(source).toContain("sampleFPSBurst");
    expect(source).toContain("FPS_BURST_FRAMES");
    expect(source).toContain("FPS_BURST_TIMEOUT_MS");

    // rAF 는 버스트 진입 1 + 남은 프레임 재예약 1 = 2회만 등장
    const rafCalls = source.match(/requestAnimationFrame\(/g) ?? [];
    expect(rafCalls).toHaveLength(2);
    expect(source).toContain("if (remaining > 0)");

    // 자동 수집은 "버스트 → collect" 순서 (수집 직전 측정)
    expect(source).toContain("this.sampleFPSBurst(() => this.collect())");
  });
});

describe("performanceMonitor FPS 측정 기준", () => {
  it("미측정 상태를 60fps로 가장하거나 관측값을 60으로 clamp하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "performanceMonitor.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "샘플이 없으면 성능이 60fps라는 뜻이 아니라 아직 측정하지 않은 상태다.",
    );
    expect(source).not.toContain("Math.min(60, 1000 / avgFrameTime)");
  });
});

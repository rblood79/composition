/**
 * ADR-198 Phase 2 — G1 entry half: 프로덕션 경로 정적 증명
 *
 * R3 은 "테스트 전용 렌더 경로가 통과하는 동안 프로덕션은 발산한다" 는 위험이다.
 * 그 위험은 런타임 수치로는 안 잡힌다 — 자체 렌더러도 얼마든지 결정적이고 예쁜
 * PNG 을 낸다. 그래서 **소스 자체를 읽어서** 두 가지를 못박는다:
 *
 * 1. Skia leg 이 프로덕션 진입점을 실제로 import 하는가.
 * 2. parity leg / 케이스 안에 **직접 그리는 코드가 0 인가.**
 *
 * ## 허용 예외 (명시 — 침묵 허용 금지)
 *
 * `skia/doctor.browser.test.ts` 와 `skia/rasterDelta.browser.test.ts` 는 직접
 * 그린다. 둘은 parity leg 이 아니라 **환경 probe** 다 — "이 host 에서 CanvasKit 이
 * 살아 있는가", "SW 와 GL 래스터가 얼마나 다른가" 를 재려면 씬이 아니라 도형이
 * 필요하다. 이 둘의 산출물은 어떤 parity 판정에도 입력되지 않는다.
 */

import { describe, it, expect } from "vitest";

/** 소스를 원문 그대로 읽는다 (Vite raw import). */
const sources = import.meta.glob("./**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** 환경 probe — 직접 draw 가 목적이라 금지 규칙에서 제외한다. */
const DRAW_ALLOWLIST = [
  "./skia/doctor.browser.test.ts",
  "./skia/rasterDelta.browser.test.ts",
];

/** Skia leg 이 반드시 거쳐야 하는 프로덕션 진입점. */
const REQUIRED_PRODUCTION_ENTRIES = [
  "buildCanonicalSceneModel",
  "buildSceneSnapshot",
  "buildPageLayoutPublisherInput",
  "useLayoutPublisher",
  "StoreRenderBridge",
  "createSkiaRendererInput",
  "buildSkiaFrameContent",
  "exportToImage",
];

/** 직접 그리기 신호 — 씬을 우회해 캔버스에 손을 대는 호출. */
const DIRECT_DRAW_PATTERNS = [
  /\bnew\s+ck\.Paint\s*\(/,
  /\bcanvas\.draw[A-Z]/,
  /\bck\.LTRBRect\s*\(/,
  /\bck\.RRectXY\s*\(/,
  /\bck\.Shader\.Make/,
  /\bck\.MaskFilter\.Make/,
];

describe("ADR-198 Phase 2 / G1 entry half — 프로덕션 경로 정적 증명", () => {
  it("소스를 실제로 읽어왔다 (glob 이 비면 이 검사 전체가 vacuous)", () => {
    const keys = Object.keys(sources);
    expect(keys.length).toBeGreaterThan(5);
    expect(keys).toContain("./harness/skiaRunner.ts");
  });

  it("Skia leg 이 프로덕션 진입점을 전부 import 한다 (R3)", () => {
    const runner = sources["./harness/skiaRunner.ts"];
    expect(runner, "skiaRunner.ts 를 읽지 못했다").toBeTruthy();

    const missing = REQUIRED_PRODUCTION_ENTRIES.filter(
      (sym) => !new RegExp(`\\b${sym}\\b`).test(runner),
    );
    expect(missing, `프로덕션 진입점 누락: ${missing.join(", ")}`).toEqual([]);
  });

  it("Skia leg 이 프로덕션 export 경로로만 import 한다 (상대경로 우회 0)", () => {
    const runner = sources["./harness/skiaRunner.ts"];
    // `@/` alias 로만 프로덕션 코드를 참조해야 한다. `../../src` 류의 상대 경로는
    // alias 를 우회해 별도 모듈 인스턴스를 만들 수 있다.
    const relativeIntoSrc = runner.match(/from\s+"(\.\.\/)+src\//g) ?? [];
    expect(
      relativeIntoSrc,
      `상대경로 src 참조: ${relativeIntoSrc.join(", ")}`,
    ).toEqual([]);
  });

  it("parity leg / 케이스에 직접 그리는 코드가 0 이다 (R3)", () => {
    const offenders: string[] = [];

    for (const [path, src] of Object.entries(sources)) {
      if (DRAW_ALLOWLIST.includes(path)) continue;
      if (path === "./productionPath.browser.test.ts") continue; // 패턴 정의 자신
      for (const pattern of DIRECT_DRAW_PATTERNS) {
        const m = src.match(pattern);
        if (m) offenders.push(`${path} → ${m[0]}`);
      }
    }

    expect(
      offenders,
      `parity 경로에서 직접 draw 발견:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("허용 예외가 실제로 존재하고, 그 이유가 소스에 적혀 있다", () => {
    for (const path of DRAW_ALLOWLIST) {
      const src = sources[path];
      expect(
        src,
        `허용 예외로 적힌 ${path} 가 없다 — 목록이 stale`,
      ).toBeTruthy();
      // 예외는 "왜 예외인지" 를 스스로 설명해야 한다. 침묵 예외 금지 (HC8 정신).
      expect(
        /환경 probe|environment probe|parity leg 이 아니/.test(src),
        `${path} 가 예외 사유를 소스에 적지 않았다`,
      ).toBe(true);
    }
  });

  it("케이스가 leg 별 문서 필드를 갖지 않는다 (HC2 one fixture authority)", () => {
    // 산문 속 언급이 아니라 **프로퍼티 선언** 을 찾는다 — types.ts 의 HC2 주석이
    // 이 이름들을 금지 예시로 적고 있어서, 단어 매칭이면 규칙이 자기 문서를 잡는다.
    const forbidden =
      /\b(skiaDocument|previewDocument|skiaFixture|previewFixture)\s*[?]?\s*:/;
    const offenders = Object.entries(sources)
      .filter(([p]) => p !== "./productionPath.browser.test.ts")
      .filter(([, s]) => forbidden.test(s))
      .map(([p]) => p);
    expect(offenders, `leg 별 문서 필드 발견: ${offenders.join(", ")}`).toEqual(
      [],
    );
  });
});

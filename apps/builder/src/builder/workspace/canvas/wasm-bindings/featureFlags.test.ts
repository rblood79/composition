// @vitest-environment node
/**
 * Feature flag 표의 정직성 계약.
 *
 * **Why (2026-08-15 실측)**: `isUnifiedFlag` 가 `UNIFIED_ENGINE` 을 먼저 보고
 * true 면 즉시 true 를 돌려줬다. `UNIFIED_ENGINE: true` 인 지금 **모든 플래그가
 * true** 로 읽혀, 당시 표에 `false` 로 적혀 있던 6개가 거짓말이었다. 소비자가
 * 0건이라 무증상이었을 뿐 — 새 소비자가 붙으면 표를 읽고 판단한 쪽과 동작이 갈린다.
 *
 * 같은 날 소비자 0건 플래그 8개를 삭제해 표에 `false` 항목이 남지 않았다.
 * 그래서 **값 비교만으로는 이 회귀를 잡을 수 없다** (전부 true 면 단락 평가를
 * 되살려도 결과가 같다). 아래 두 가드가 그 공백을 나눠 맡는다:
 *   1. 소스 텍스트 — 단락 평가 부재 (지금 유일하게 물리는 가드)
 *   2. 값 비교 — `false` 플래그가 다시 도입되면 자동으로 다시 물린다
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import * as registry from "./featureFlags";
import {
  UNIFIED_ENGINE_FLAGS,
  WASM_FLAGS,
  isUnifiedFlag,
  type UnifiedEngineFlag,
} from "./featureFlags";

const keys = Object.keys(UNIFIED_ENGINE_FLAGS) as UnifiedEngineFlag[];

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "featureFlags.ts"),
  "utf8",
);

/** 주석(구 구현을 인용하는 Why 블록)을 걷어낸 실제 코드. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("isUnifiedFlag — 선언값 그대로", () => {
  it("다른 플래그 값으로 분기하지 않는다 (단락 평가 부재)", () => {
    const body = code.match(/function isUnifiedFlag[\s\S]*?\n\}/)?.[0] ?? "";

    expect(body).toContain("return UNIFIED_ENGINE_FLAGS[flag]");
    // 구 회귀 형태: `if (UNIFIED_ENGINE_FLAGS.UNIFIED_ENGINE) return true;`
    expect(body).not.toMatch(/UNIFIED_ENGINE_FLAGS\.\w+/);
    expect(body).not.toMatch(/\breturn true\b/);
  });

  it.each(keys)("%s 는 선언된 값을 돌려준다", (key) => {
    expect(isUnifiedFlag(key)).toBe(UNIFIED_ENGINE_FLAGS[key]);
  });

  it("false 로 선언된 플래그가 있다면 실제로도 false 다", () => {
    const declaredFalse = keys.filter((k) => !UNIFIED_ENGINE_FLAGS[k]);

    // 지금은 전부 true 라 공집합이다 — 그 경우 이 계약은 공허하게 통과하고,
    //   회귀 감시는 위 소스 텍스트 가드가 단독으로 맡는다.
    expect(declaredFalse.filter((k) => isUnifiedFlag(k))).toEqual([]);
  });
});

// ============================================================
// Registry 계약 — 게이트 단일 정의처 + 소비자 0건 금지
// ============================================================
//
// **Why (2026-08-15 스윕)**: ADR-900 잔재 게이트 9개(`REMOVE_PIXI` 등)가
// 소비자 0건인 채 수개월 남아 "토글할 수 있는 것" 으로 잘못 읽혔고,
// 발견 수단이 수동 전수 스윕뿐이었다. 아래 두 계약이 그 발견을 커밋
// 시점으로 앞당긴다:
//   1. 소비자 존재 — registry 의 모든 게이트는 정의부/테스트 밖 코드
//      소비처가 1곳 이상이어야 한다 (0건이면 삭제하거나 allowlist 등재)
//   2. 단일 정의처 — registry 밖 파일에 boolean 게이트 상수를 두지 않는다
//      (`USE_CANVAS2D_MEASURE` 가 canvas2dSegmentCache.ts 에 산재해 있다가
//       2026-08-15 registry 로 이동한 사례의 재발 차단)

/** 의도적으로 보존하는 0-소비자 게이트 — 값에 보존 사유를 적는다. */
const INTENT_PRESERVED: Record<string, string> = {
  // (현재 없음)
};

const SRC_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
); // apps/builder/src

const SKIP_DIRS = new Set(["node_modules", "dist", "__snapshots__"]);

function walkSources(dir: string, out: { path: string; code: string }[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walkSources(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const code = readFileSync(full, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    out.push({ path: full, code });
  }
}

describe("게이트 registry 계약", () => {
  const sources: { path: string; code: string }[] = [];
  walkSources(SRC_ROOT, sources);

  /** 정의부·테스트·벤치를 제외한 소비자 후보 파일들. */
  const consumerFiles = sources.filter(
    ({ path }) =>
      !path.endsWith("featureFlags.ts") &&
      !/\.(test|bench)\.(ts|tsx)$/.test(basename(path)),
  );

  const gateNames = [
    ...Object.keys(WASM_FLAGS),
    ...Object.keys(UNIFIED_ENGINE_FLAGS),
    // bare export 게이트 (USE_CANVAS2D_MEASURE 등) 는 boolean export 로 수집
    ...Object.entries(registry)
      .filter(([, v]) => typeof v === "boolean")
      .map(([k]) => k),
  ];

  it.each(gateNames)("%s 는 코드 소비처가 1곳 이상이다", (name) => {
    if (name in INTENT_PRESERVED) return; // 사유 명시된 의도-보존

    const pattern = new RegExp(`\\b${name}\\b`);
    const consumers = consumerFiles.filter(({ code }) => pattern.test(code));

    // 0건이면: 게이트를 삭제하고 전환 사실은 ADR/CHANGELOG 에 남기거나,
    // 보존 의도가 있으면 INTENT_PRESERVED 에 사유와 함께 등재할 것.
    expect(
      consumers.map(({ path }) => path),
      `게이트 ${name} 의 코드 소비처가 0건 — 삭제하거나 INTENT_PRESERVED 에 사유를 등재하라`,
    ).not.toEqual([]);
  });

  it("registry 밖에 boolean 게이트 상수가 없다 (단일 정의처)", () => {
    const adHocGate =
      /const (USE_|ENABLE_|DISABLE_|SHOULD_|REMOVE_|FEATURE_|IS_)[A-Z0-9_]+\s*=\s*(true|false)\s*[;,]/;

    const offenders = sources
      .filter(({ path }) => !path.endsWith("featureFlags.ts"))
      .filter(({ code }) => adHocGate.test(code))
      .map(({ path }) => path);

    // 게이트가 필요하면 wasm-bindings/featureFlags.ts 에 등재할 것.
    expect(offenders).toEqual([]);
  });
});

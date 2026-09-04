/**
 * 정적 게이트 — 삭제된 의존성 이름이 "엔진 제약" 처럼 다시 읽히지 않게 한다.
 *
 * Taffy 는 ADR-916 (2026-07-06) 에서 완전히 제거됐다. 그런데 비테스트 소스 35 파일의 주석에
 * "Taffy 가 자동 계산" · "Taffy 트리" 같은 **현재형 서술**이 남아, 없는 라이브러리의 능력이
 * 엔진 제약으로 잘못 읽힌 오판이 2회 있었다 (메모리 `feedback-stale-dependency-comment-is-not-engine-constraint`).
 *
 * 규칙: 이름을 아예 금지하지 않는다 — 제거·개명·계보를 **명시적으로 말하는 문장**은 남는 편이 낫다.
 * 그 표식 (`완전 제거` · `구 \`Taffy…\`` · `0.9 계보` · `개명` …) 없이 이름만 쓰는 줄을 막는다.
 *
 * @see docs/explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md §A4-5
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 이 표식이 줄에 있으면 역사 서술 — 허용 */
const HISTORICAL_MARKERS = [
  "완전 제거",
  "0.9 계보",
  "구 `Taffy",
  "구 Taffy",
  "구 taffy",
  "개명",
  "Taffy pkg",
  "composition_wasm(Taffy)",
  "Taffy(composition_wasm)",
  "taffy-free",
  "TaffyLayout",
  "endgame Taffy",
];

const BUILDER_SRC = resolve(__dirname, "../../../../..");

function nonTestSourceFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "*.ts", "*.tsx"],
    { cwd: BUILDER_SRC, encoding: "utf-8" },
  );
  return out
    .split("\n")
    .filter((f) => f.length > 0)
    .filter((f) => !f.includes(".test.") && !f.includes("/__tests__/"));
}

describe("stale dependency naming — Taffy", () => {
  it("비테스트 소스에 역사 표식 없는 Taffy 현재형 서술이 없다", () => {
    const offenders: string[] = [];
    for (const file of nonTestSourceFiles()) {
      const source = readFileSync(resolve(BUILDER_SRC, file), "utf-8");
      if (!source.includes("Taffy")) continue;
      source.split("\n").forEach((line, i) => {
        if (!line.includes("Taffy")) return;
        if (HISTORICAL_MARKERS.some((marker) => line.includes(marker))) return;
        offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

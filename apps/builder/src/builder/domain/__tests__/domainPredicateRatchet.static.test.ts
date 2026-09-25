/**
 * @fileoverview ADR-236 Phase 1 — 도메인 술어 재구현 ratchet (G1).
 *
 * 같은 판정 (body · synthetic id · Components 페이지) 을 파일마다 다시 쓰면 대소문자 · 제외
 * 조건이 갈린다 (Phase 0 인벤토리 — breakdown §8). 판정은 술어 하나를 부르고, 직접 구현은
 * 아래 상한을 넘지 못한다. 술어를 하나 옮길 때마다 그 행의 상한을 0 으로 내린다.
 *
 * 한계 (의도): 문자열 패턴 가드라 별칭 변수를 거친 비교는 못 잡는다. 목적은 재도입을 리뷰
 * 신호로 올리는 것이다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER_SRC = resolve(__dirname, "../../..");
const SHARED_SRC = resolve(__dirname, "../../../../../../packages/shared/src");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "__tests__",
  "__fixtures__",
]);
const SKIP_FILE = /\.(test|spec|bench)\.tsx?$/;

function collectSources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
        continue;
      }
      if (/\.tsx?$/.test(name) && !SKIP_FILE.test(name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

function findHits(
  roots: readonly string[],
  pattern: RegExp,
  allow: ReadonlySet<string> = new Set(),
): Hit[] {
  const hits: Hit[] = [];
  for (const root of roots) {
    for (const file of collectSources(root)) {
      const rel = relative(resolve(root, ".."), file);
      if (allow.has(rel)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((text, index) => {
        if (pattern.test(text)) {
          hits.push({ file: rel, line: index + 1, text: text.trim() });
        }
      });
    }
  }
  return hits;
}

const format = (hits: readonly Hit[]) =>
  hits.map((hit) => `${hit.file}:${hit.line}  ${hit.text}`).join("\n");

describe("ADR-236 도메인 술어 ratchet", () => {
  it("body — 타입 문자열 직접 비교 0 (isBodyType 경유)", () => {
    const hits = findHits(
      [BUILDER_SRC, SHARED_SRC],
      /(===|!==)\s*["'][Bb]ody["']|["'][Bb]ody["']\s*(===|!==)/,
      new Set(["src/domain/predicates.ts"]),
    );
    expect(format(hits)).toBe("");
  });

  it("body — 파일 로컬 판정 헬퍼 0 (합성 술어만 허용)", () => {
    const hits = findHits(
      [BUILDER_SRC, SHARED_SRC],
      /function is\w*Body\w*\s*[<(]/,
      new Set([
        // body AND frame mirror id — body 판정 자체는 isBodyType 을 부른다.
        "src/builder/panels/properties/ComponentSemanticsSection.tsx",
        "src/domain/predicates.ts",
      ]),
    );
    expect(format(hits)).toBe("");
  });

  it("synthetic id — `/` 직접 파싱은 Phase 0 상한 이하", () => {
    const hits = findHits(
      [BUILDER_SRC],
      /(\.id|Id)\.(includes|indexOf|split|lastIndexOf)\(\s*["']\/["']\s*\)/,
    );
    expect(hits.length, format(hits)).toBeLessThanOrEqual(9);
  });

  it("Components 페이지 — 판정 헬퍼 · pageRole 직접 비교는 Phase 0 상한 이하", () => {
    const helpers = findHits(
      [BUILDER_SRC, SHARED_SRC],
      /function isComponentsPage\w*\s*\(/,
    );
    const direct = findHits([BUILDER_SRC, SHARED_SRC], /pageRole\s*(===|!==)/);
    expect(helpers.length, format(helpers)).toBeLessThanOrEqual(4);
    expect(direct.length, format(direct)).toBeLessThanOrEqual(3);
  });
});

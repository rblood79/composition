/**
 * @fileoverview ADR-236 Phase 1 — 도메인 술어 재구현 ratchet (G1) · Phase 2 — 타입 특성 표 파생 (G2).
 *
 * 같은 판정 (body · synthetic id · Components 페이지) 을 파일마다 다시 쓰면 대소문자 · 제외
 * 조건이 갈린다 (Phase 0 인벤토리 — breakdown §8). 판정은 술어 하나를 부르고, 직접 구현은
 * 0 이다 (허용 목록은 사유와 함께 둔다).
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

  it("synthetic id — `/` 직접 파싱 0 (shared syntheticId 경유)", () => {
    const hits = findHits(
      [BUILDER_SRC],
      /(\.id|Id)\.(includes|indexOf|split|lastIndexOf)\(\s*["']\/["']\s*\)/,
    );
    expect(format(hits)).toBe("");
  });

  it("Components 페이지 — 판정은 shared isComponentsPage 하나", () => {
    const allow = new Set([
      "src/domain/componentsPage.ts",
      // export HTML 에 박히는 인라인 런타임 스크립트 문자열 — import 불가.
      "src/utils/export.utils.ts",
    ]);
    const helpers = findHits(
      [BUILDER_SRC, SHARED_SRC],
      /function is\w*ComponentsPage\w*\s*\(/,
      new Set(["src/domain/componentsPage.ts"]),
    );
    const direct = findHits(
      [BUILDER_SRC, SHARED_SRC],
      /pageRole\s*(===|!==)|(===|!==)\s*(COMPONENTS_SYSTEM_PAGE_ID|COMPONENTS_PAGE_SLUG|COMPONENTS_PAGE_ROLE)\b/,
      allow,
    );
    expect(format(helpers)).toBe("");
    expect(format(direct)).toBe("");
  });
  it("타입 특성 표 — 파생한 멤버십 집합을 리터럴로 다시 적지 않는다 (Phase 2)", () => {
    // 표 (`packages/shared/src/domain/componentTraits.ts`) 에서 파생한 집합. 새 멤버는 표의 행에 적는다.
    const derived = [
      "STRUCTURAL_CONTAINER_TYPES",
      "PADDING_CONTAINER_TYPES",
      "FRAME_SLOT_HOST_TYPES",
      "TEXT_EDITABLE_TAGS",
      "TEXT_ELEMENT_TAGS",
      "INPUT_VALUE_EDIT_TAGS",
      "BUTTON_CHILD_HOST_TAGS",
      "LABEL_EDIT_HOST_TAGS",
      "ACTION_TAGS",
      "DISABLING_GROUP_TYPES",
      "SELECTION_FLAG_ITEM_TYPES",
      "STATIC_ITEM_TYPES",
      "ITEM_SLOT_COLLECTIONS",
      "FORM_INHERITING_FIELD_TAGS",
      "DATE_INPUT_PARENT_TAGS",
      "IMAGE_TAGS",
      "IMAGE_INTRINSIC_TAGS",
    ];
    const literalDecl = new RegExp(
      `const (${derived.join("|")})\\b[^=]*=\\s*new Set(?:<[^>]*>)?\\(\\s*\\[\\s*["']`,
      "g",
    );
    const hits: string[] = [];
    for (const root of [BUILDER_SRC, SHARED_SRC]) {
      for (const file of collectSources(root)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(literalDecl)) {
          hits.push(`${relative(resolve(root, ".."), file)}  ${match[1]}`);
        }
      }
    }
    expect(hits.join("\n")).toBe("");
  });
});

/**
 * @fileoverview ADR-113 Phase 5-E — legacy Element.descendants quarantine gate.
 *
 * `descendants` is a canonical field on RefNode, so a raw grep cannot be zero.
 * This gate keeps the remaining non-adapter runtime access limited to canonical
 * resolver/store/type validation files. Legacy `Element.descendants` access must
 * stay inside canonical adapters.
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");

const SCAN_DIRS = [
  "apps/builder/src",
  "apps/publish/src",
  "packages/shared/src",
] as const;

const EXCLUDE_PATH_PATTERNS: readonly RegExp[] = [
  /\/__tests__\//,
  /\.test\.tsx?$/,
  /\/apps\/builder\/src\/adapters\/canonical\//,
  /\/apps\/builder\/src\/adapters\/pencil\//,
  /\/packages\/shared\/src\/schemas\//,
  /\/packages\/shared\/src\/types\/composition-document\.types\.ts$/,
  /\/packages\/shared\/src\/types\/canonical-resolver\.types\.ts$/,
  /\/packages\/shared\/src\/types\/pencil-adapter\.types\.ts$/,
];

/**
 * canonical `RefNode.descendants` 를 읽는 것이 정당한 파일들.
 *
 * gate 가 막으려는 것은 **legacy `Element.descendants`** 접근이지, canonical RefNode 의
 * 필드 접근이 아니다 (파일 상단 주석 참조 — "raw grep 은 0 이 될 수 없다"). 아래 목록은
 * canonical 문서를 직접 소비하는 resolver / store / 파생 뷰 모델 경계다.
 */
const CANONICAL_DESCENDANTS_ALLOWLIST = new Set([
  "apps/builder/src/lib/db/indexedDB/adapter.ts",
  "apps/builder/src/resolvers/canonical/index.ts",
  "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
  "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
  // canonical 파생 뷰 모델 — RefNode.descendants 를 scene / panel 노드로 투영한다.
  // (ADR-126/135 이후 신설. gate 작성 시점에는 없던 canonical 경계 파일.)
  "apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts",
  "apps/builder/src/builder/panels/panelNode.ts",
  "packages/shared/src/utils/export.utils.ts",
  "packages/shared/src/utils/compositionDocumentOrder.ts",
  "packages/shared/src/types/composition-vocabulary.ts",
]);

const COMMENT_LINE_PATTERN = /^\s*(\/\/|\*|\/\*|\*\/)/;

interface DescendantsReference {
  file: string;
  line: number;
  text: string;
}

function listFilesRecursive(rootAbs: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(rootAbs)) return out;

  const stack: string[] = [rootAbs];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (
        entry.isFile() &&
        (full.endsWith(".ts") || full.endsWith(".tsx"))
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

function isPathExcluded(filePath: string): boolean {
  return EXCLUDE_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

function scanDescendantsReferences(): DescendantsReference[] {
  const refs: DescendantsReference[] = [];

  for (const relDir of SCAN_DIRS) {
    const dirAbs = path.join(REPO_ROOT, relDir);
    for (const file of listFilesRecursive(dirAbs)) {
      if (isPathExcluded(file)) continue;

      let content: string;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }

      const relPath = path.relative(REPO_ROOT, file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (COMMENT_LINE_PATTERN.test(lines[i])) continue;
        if (!/\.descendants\b|\bdescendants\??\s*:/.test(lines[i])) continue;
        refs.push({
          file: relPath,
          line: i + 1,
          text: lines[i].trim(),
        });
      }
    }
  }

  return refs;
}

describe("ADR-113 Phase 5-E descendants quarantine gate", () => {
  it("keeps non-adapter descendants runtime access canonical-only", () => {
    const refs = scanDescendantsReferences();
    const violations = refs.filter(
      (ref) => !CANONICAL_DESCENDANTS_ALLOWLIST.has(ref.file),
    );

    if (violations.length > 0) {
      const summary = violations
        .map((ref) => `  ${ref.file}:${ref.line} -> ${ref.text}`)
        .join("\n");
      throw new Error(
        `ADR-113 descendants quarantine regression: ${violations.length} forbidden references\n${summary}`,
      );
    }

    expect(violations).toEqual([]);
  });
});

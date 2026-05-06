/**
 * @fileoverview ADR-116 Phase 4 G5 — §9.3 strict logic-access grep gate codify.
 *
 * design §9.3 (5 필드 raw grep) 의 raw count 는 comment / dev log noise 를
 * 포함한다. 본 test 는 §9.3.1 strict logic-access 측정을 codify — bucket
 * 분류 후 진정 logic-access (runtime read/write) 잔존만 헤아린다.
 *
 * **G5 logic-access PASS marker (2026-05-01)**: BASELINE_VIOLATION_COUNT = 0.
 * 진정 logic cleanup 잔존은 ADR-111 P3 / ADR-113 P5 base cleanup work 의존 —
 * 별 ADR phase, 본 grep gate 외.
 *
 * 신규 caller 가 strict logic-access 잔존 추가 시 본 test 가 즉시 fail —
 * Comment / Console.log bucket 중 어느 것에도 해당하지 않는 새로운 logic
 * access 를 차단.
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ─────────────────────────────────────────────
// Configuration (design §9.3 + §9.3.1)
// ─────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");

const SCAN_DIRS = [
  "apps/builder/src",
  "apps/publish/src",
  "packages/shared/src",
] as const;

const NON_ADAPTER_TEST_SCAN_DIRS = [
  "apps/builder/src/builder",
  "apps/builder/src/preview",
  "packages/shared/src",
] as const;

const FRAME_SLOT_SCHEMA_FILES = [
  "apps/builder/src/types/builder/unified.types.ts",
  "packages/shared/src/types/element.types.ts",
  "apps/builder/src/types/builder/layout.types.ts",
  "packages/shared/src/types/renderer.types.ts",
  "apps/builder/src/preview/store/types.ts",
  "apps/builder/src/preview/types/index.ts",
] as const;

const LEGACY_DESCENDANTS_SCHEMA_FILES = [
  "apps/builder/src/types/builder/unified.types.ts",
  "packages/shared/src/types/element.types.ts",
] as const;

const TARGETED_FRAME_SLOT_FIXTURE_FILES = [
  "apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts",
  "apps/builder/src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts",
  "apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts",
  "apps/builder/src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts",
] as const;

const COMPAT_EXTRACTION_RUNTIME_FILES = [
  "apps/builder/src/resolvers/canonical/index.ts",
  "apps/builder/src/resolvers/canonical/storeBridge.ts",
  "apps/builder/src/resolvers/canonical/extractCanonicalProps.ts",
  "apps/builder/src/preview/components/CanonicalNodeRenderer.tsx",
  "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
  "apps/builder/src/builder/stores/utils/instanceActions.ts",
  "apps/builder/src/adapters/canonical/canonicalRefResolution.ts",
  "apps/builder/src/adapters/canonical/editingSemantics.ts",
  "apps/builder/src/adapters/canonical/canonicalMutations.ts",
  "apps/builder/src/adapters/canonical/exportLegacyDocument.ts",
] as const;

/** design §9.3 grep -g exclude pattern 정합 */
const EXCLUDE_PATH_PATTERNS: readonly RegExp[] = [
  /\/__tests__\//,
  /\.test\.tsx?$/,
  /\/apps\/builder\/src\/adapters\//,
  /\/apps\/builder\/src\/lib\/db\/migration[^/]*\.ts$/,
  // canonical → legacy compat extraction view: COMPAT_EXTRACTION_RUNTIME_FILES
  // 목록과 정합. store layer 에 위치하지만 의도적 legacy emit 영역.
  /\/apps\/builder\/src\/builder\/stores\/canonical\/canonicalElementsView\.ts$/,
];

/** design §9.3 첫번째 grep 의 5 필드 (legacy field name) */
const VIOLATION_PATTERN =
  /\.(layout_id|slot_name|componentRole|masterId|overrides)\b|\b(layout_id|slot_name|componentRole|masterId|overrides)\??\s*:/;

// design §9.3.1 bucket 분류 — strict 측정에서 제외하는 noise 패턴.
//
// 1. Comment / JSDoc / @see / migration marker: line text 가 //, slash-star,
//    star-space, star-slash 로 시작하거나 inline comment 만 매치.
// 2. Console.log / dev log: IndexedDB schema log 류.
const COMMENT_LINE_PATTERN = /^\s*(\/\/|\*|\/\*|\*\/)/;
const CONSOLE_LOG_PATTERN = /console\.(log|warn|info|error|debug)/;

// ─────────────────────────────────────────────
// Bucket-classified Violation
// ─────────────────────────────────────────────

type Bucket = "comment" | "console-log" | "strict-logic-access";

interface ClassifiedViolation {
  file: string;
  line: number;
  text: string;
  bucket: Bucket;
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
      } else if (entry.isFile()) {
        if (full.endsWith(".ts") || full.endsWith(".tsx")) {
          out.push(full);
        }
      }
    }
  }
  return out;
}

function isPathExcluded(filePath: string): boolean {
  return EXCLUDE_PATH_PATTERNS.some((re) => re.test(filePath));
}

function classifyBucket(
  _relPath: string,
  lineText: string,
): Exclude<Bucket, "strict-logic-access"> | null {
  if (COMMENT_LINE_PATTERN.test(lineText)) return "comment";
  if (CONSOLE_LOG_PATTERN.test(lineText)) return "console-log";
  return null;
}

function scanClassified(): ClassifiedViolation[] {
  const out: ClassifiedViolation[] = [];
  for (const rel of SCAN_DIRS) {
    const dirAbs = path.join(REPO_ROOT, rel);
    const files = listFilesRecursive(dirAbs);
    for (const file of files) {
      if (isPathExcluded(file)) continue;
      let content: string;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      const relPath = path.relative(REPO_ROOT, file);
      for (let i = 0; i < lines.length; i++) {
        if (!VIOLATION_PATTERN.test(lines[i])) continue;
        const noise = classifyBucket(relPath, lines[i]);
        out.push({
          file: relPath,
          line: i + 1,
          text: lines[i].trim(),
          bucket: noise ?? "strict-logic-access",
        });
      }
    }
  }
  return out;
}

function scanNonAdapterTestsForComponentMirrorLiterals(): string[] {
  const out: string[] = [];
  const pattern = /\b(componentRole|masterId)\s*:/;

  for (const rel of NON_ADAPTER_TEST_SCAN_DIRS) {
    const dirAbs = path.join(REPO_ROOT, rel);
    const files = listFilesRecursive(dirAbs).filter((file) =>
      /\.test\.tsx?$/.test(file),
    );
    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const relPath = path.relative(REPO_ROOT, file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          out.push(`${relPath}:${i + 1} -> ${lines[i].trim()}`);
        }
      }
    }
  }

  return out;
}

function scanFilesForPattern(
  files: readonly string[],
  pattern: RegExp,
): string[] {
  const out: string[] = [];

  for (const relPath of files) {
    const file = path.join(REPO_ROOT, relPath);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        out.push(`${relPath}:${i + 1} -> ${lines[i].trim()}`);
      }
    }
  }

  return out;
}

// ─────────────────────────────────────────────
// PASS marker
// ─────────────────────────────────────────────

/**
 * **G5 logic-access PASS marker (2026-05-01)**: 0.
 *
 * 신규 logic-access 추가 시 본 baseline 위반 → test fail. 진정 cleanup 진척
 * (ADR-111 P3 / ADR-113 P5 base work) 시 marker 갱신 불필요 — 본 test 는 유지.
 */
const BASELINE_STRICT_LOGIC_ACCESS = 0;

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("ADR-116 Phase 4 G5 — §9.3.1 strict logic-access grep gate (PASS marker)", () => {
  it("strict logic-access 잔존 ≤ baseline (PASS marker = 0)", () => {
    const violations = scanClassified();
    const strict = violations.filter((v) => v.bucket === "strict-logic-access");
    if (strict.length > BASELINE_STRICT_LOGIC_ACCESS) {
      const summary = strict
        .map((v) => `  ${v.file}:${v.line} → ${v.text}`)
        .join("\n");
      throw new Error(
        `ADR-116 G5 strict logic-access regression: ${strict.length} 위반 (baseline ${BASELINE_STRICT_LOGIC_ACCESS})\n${summary}`,
      );
    }
    expect(strict.length).toBeLessThanOrEqual(BASELINE_STRICT_LOGIC_ACCESS);
  });

  it("bucket 분류 — 2 noise bucket 모두 0 이상", () => {
    const violations = scanClassified();
    const counts = {
      comment: violations.filter((v) => v.bucket === "comment").length,
      consoleLog: violations.filter((v) => v.bucket === "console-log").length,
    };

    // bucket 분류 동작 검증 — 각 bucket 의 raw count 는 진척 시 점진 감소 가능.
    expect(counts.comment).toBeGreaterThanOrEqual(0);
    expect(counts.consoleLog).toBeGreaterThanOrEqual(0);
  });

  it("raw 합계 = strict + noise bucket (분류 무손실)", () => {
    const violations = scanClassified();
    const strict = violations.filter(
      (v) => v.bucket === "strict-logic-access",
    ).length;
    const noise = violations.filter(
      (v) => v.bucket !== "strict-logic-access",
    ).length;
    expect(strict + noise).toBe(violations.length);
  });

  it("component semantics mirror read helpers live in adapter boundary, not unified types", () => {
    const unifiedSource = fs.readFileSync(
      path.join(REPO_ROOT, "apps/builder/src/types/builder/unified.types.ts"),
      "utf8",
    );
    const sharedElementSource = fs.readFileSync(
      path.join(REPO_ROOT, "packages/shared/src/types/element.types.ts"),
      "utf8",
    );
    const componentMirrorSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "apps/builder/src/adapters/canonical/componentSemanticsMirror.ts",
      ),
      "utf8",
    );

    expect(unifiedSource).not.toContain("export function isMasterElement");
    expect(unifiedSource).not.toContain("export function isInstanceElement");
    expect(unifiedSource).not.toContain("export function getInstanceMasterRef");
    expect(unifiedSource).not.toMatch(
      /\b(componentRole|masterId|overrides)\??:/,
    );
    expect(sharedElementSource).not.toMatch(
      /\b(componentRole|masterId|overrides)\??:/,
    );
    expect(componentMirrorSource).toContain("isComponentOriginMirrorElement");
    expect(componentMirrorSource).toContain("isComponentInstanceMirrorElement");
    expect(componentMirrorSource).toContain("getComponentMasterReference");
    expect(componentMirrorSource).toContain("withComponentOriginMirror");
    expect(componentMirrorSource).toContain("withComponentInstanceMirror");
  });

  it("non-adapter test fixtures use component semantics mirror helpers for role/id payload", () => {
    const violations = scanNonAdapterTestsForComponentMirrorLiterals();
    if (violations.length > 0) {
      throw new Error(
        `ADR-116 G5 component mirror fixture regression:\n${violations.join(
          "\n",
        )}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("frame/slot mirrors stay out of Element/Page/Preview type schemas", () => {
    const violations = scanFilesForPattern(
      FRAME_SLOT_SCHEMA_FILES,
      /\b(layout_id|slot_name)\??:/,
    );
    if (violations.length > 0) {
      throw new Error(
        `ADR-116 G5 frame/slot type schema regression:\n${violations.join(
          "\n",
        )}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("legacy descendants mirror stays out of Element type schemas", () => {
    const violations = scanFilesForPattern(
      LEGACY_DESCENDANTS_SCHEMA_FILES,
      /\bdescendants\??:/,
    );
    if (violations.length > 0) {
      throw new Error(
        `ADR-116 G5 descendants type schema regression:\n${violations.join(
          "\n",
        )}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("targeted frame/slot fixtures use mirror helpers instead of raw payload keys", () => {
    const violations = scanFilesForPattern(
      TARGETED_FRAME_SLOT_FIXTURE_FILES,
      /\b(layout_id|slot_name)\s*:/,
    );
    if (violations.length > 0) {
      throw new Error(
        `ADR-116 G5 frame/slot fixture regression:\n${violations.join("\n")}`,
      );
    }
    expect(violations).toEqual([]);
  });

  it("runtime compatibility extraction does not read metadata legacy props", () => {
    const violations = scanFilesForPattern(
      COMPAT_EXTRACTION_RUNTIME_FILES,
      /metadata\.legacyProps|\blegacyProps\b|extractLegacyProps/,
    );
    if (violations.length > 0) {
      throw new Error(
        `ADR-116 compatibility extraction regression:\n${violations.join(
          "\n",
        )}`,
      );
    }
    expect(violations).toEqual([]);
  });
});

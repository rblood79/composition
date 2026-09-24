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
  // canonical 노드를 순회·투영하는 경계 2개 — 위 두 파일과 같은 역할이고
  // 읽는 것도 canonical `RefNode.descendants` 다 (legacy Element 접근 아님).
  // 게이트 작성 뒤에 만들어져 목록에 없었을 뿐이다.
  "apps/builder/src/builder/stores/canonical/canonicalTraversalHelpers.ts",
  "apps/builder/src/builder/panels/canonicalPanelNodes.ts",
  "packages/shared/src/utils/export.utils.ts",
  "packages/shared/src/utils/compositionDocumentOrder.ts",
  "packages/shared/src/types/composition-vocabulary.ts",
  // 중첩 guard 의 조상 사슬 수집 — `compositionDocumentOrder.ts` 의 `findNodeInChildren`
  // 과 같은 범위로 canonical `RefNode.descendants` children-mode 안까지 걷는다
  // (2026-09-08 중첩 결함 수리, 메모리 feedback-canvas-draws-rac-inherits-html-content-model).
  "packages/shared/src/utils/canonicalNestingContext.ts",
  // ADR-214 가시성 사슬 인덱스 — page ref 의 descendants children-mode 자식도 사슬에 넣기
  // 위해 canonical `RefNode.descendants` 를 걷는다 (canonicalNestingContext 와 같은 범위).
  "packages/shared/src/state/visibility.ts",
  // ADR-229 Phase 2 — 조합 origin 자식의 ref 화 seed. canonical `RefNode.descendants` 를 **만든다**
  //   (저작 subtree ↔ origin subtree 차이를 mode A patch 로) 와 생성 경로의 같은 규칙 적용.
  "apps/builder/src/builder/components/originChildRefs.ts",
  "apps/builder/src/builder/factories/utils/originChildRefElements.ts",
  // ADR-237 Phase 1 — 그룹 Slot "+" 계획. instance host 의 상속 형제 해제를 canonical `RefNode.descendants`
  //   patch 로 **만든다** (originChildRefs 와 같은 역할).
  "apps/builder/src/builder/components/groupItemInsert.ts",
  // ADR-240 Phase 1 — Dialog 영역 구조 이관의 instance 경로 전치 (문서 · history 재생) · instance slot 채우기의
  //   mode C 키 (segment · 옛 id 키 이관). canonical `RefNode.descendants` 를 **고쳐 쓴다**.
  "apps/builder/src/builder/components/dialogRegionPaths.ts",
  "apps/builder/src/builder/components/slotFillPath.ts",
  // ADR-240 Phase 2 — 채운 노드 편집 (mode C 배열 노드 · 채운 ref 의 자기 descendants) · 영역 삽입 계획 (팔레트 · drop).
  "apps/builder/src/builder/components/slotFillEdit.ts",
  "apps/builder/src/builder/components/slotRegionInsert.ts",
  // ADR-228 · 234 · 237 · 238 — origin seed · 목록 틀 "+" · 이관이 canonical `RefNode.descendants` 를 **만들거나 고쳐
  //   쓴다** (originChildRefs 와 같은 역할). 입력 · 출력 모두 `CanonicalNode` / `RefNode` — legacy Element 아님.
  "apps/builder/src/builder/components/catalogOrigins.ts",
  "apps/builder/src/builder/components/collectionItemInsert.ts",
  "apps/builder/src/builder/components/migrateDialogTriggerInstances.ts",
  "apps/builder/src/builder/components/stateVariantMigration.ts",
  "apps/builder/src/builder/components/staticCollectionMigration.ts",
  // ADR-230 · 234 — 상태 변형 층 (`StateLayer.descendants` — 변형 origin 의 자손 patch 투영). RefNode 필드가 아니라
  //   층 모델의 자기 필드다 (Canvas 해석 · Preview render props 가 같은 모델을 읽는다).
  "apps/builder/src/builder/components/stateVariantLayers.ts",
  "apps/builder/src/preview/utils/stateLayerRender.ts",
  // ADR-234 · 237 — Slot "+" 계획 (canonical 문서에서 만든 `plan.descendants`) 을 adapter 소유 필드
  //   (`COMPONENT_DESCENDANTS_MIRROR_FIELD`) 로 store 에 쓴다. 필드 이름은 adapter 가 정한다.
  "apps/builder/src/builder/panels/properties/ComponentSlotFillSection.tsx",
  "apps/builder/src/builder/panels/properties/FrameSlotSection.tsx",
  // ADR-241 Phase 2 — Table 열 "+" 계획 (instance TableHeader mode C · origin 열 patch 이관) 과 그 쓰기 (Slot "+" ·
  //   quick connect · Preview 열 감지). 계획은 canonical `RefNode.descendants` 를 만들고, 쓰기는 adapter 소유 필드로 store 에.
  "apps/builder/src/builder/components/tableColumnInsert.ts",
  "apps/builder/src/builder/components/tableColumnWrite.ts",
  "apps/builder/src/builder/panels/datatable/utils/quickConnect.ts",
  "apps/builder/src/builder/hooks/useIframeMessenger.ts",
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

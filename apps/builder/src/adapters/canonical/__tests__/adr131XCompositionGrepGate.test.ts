/**
 * @fileoverview ADR-131 Phase 6 G4 — `x-composition.events|actions|dataBinding`
 * direct runtime consumer grep gate.
 *
 * **gate 의미**: ADR-131 가 ADR-116 §3 partial supersede 후, runtime 영역의
 * `x-composition.events` / `actions` / `dataBinding` direct property access 는
 * **0건** 유지. (docstring / 주석 / type 정의 영역은 boundary 외 허용.)
 *
 * **PASS 조건**: `(node|extension|ext|x)["x-composition"]\.(events|actions|dataBinding)`
 * 또는 `\.\["x-composition"\]\.\b(events|actions|dataBinding)\b` 패턴의 runtime
 * direct read/write 가 production 코드 (apps/builder/src + packages/shared/src,
 * 단 __tests__ + boundary allowlist 제외) 에 0건.
 *
 * **boundary allowlist** (의도된 architectural boundary — 본 gate 의 적용 외):
 * - `adapters/canonical/index.ts` — buildCompositionExtensionField (legacy →
 *   canonical export)
 * - `adapters/canonical/canonicalMutations.ts` — buildCompositionExtensionField
 * - `adapters/canonical/slotAndLayoutAdapter.ts` — buildCompositionExtensionField
 * - `adapters/canonical/exportLegacyDocument.ts` — canonical → legacy export
 * - `stores/canonical/canonicalDocumentStore.ts` — updateNodeExtension (G7
 *   Extension Boundary 의 단일 mutation 진입점)
 * - `stores/canonical/canonicalElementsView.ts` — extension snapshot bridge
 * - `types/builder/unified.types.ts` — docstring 만 (Element.events / dataBinding
 *   @deprecated 마커)
 * - `types/composition-document.types.ts` — schema 정의 자체
 * - `adapters/canonical/compositionExtensionFields.ts` — read-through helper
 *   docstring (Phase 6 cleanup 후속에서 정리 대상)
 * - `packages/shared/src/utils/compositionExtensionFields.ts` — packages/shared
 *   영역 동명 helper
 *
 * 본 gate 는 향후 신규 production code 가 `x-composition.events|actions|dataBinding`
 * direct access 를 도입하지 못하도록 차단한다. 신규 access 가 필요하면 root
 * collection (`useDocumentEvents` / `useDocumentData` / `useDocumentActions` /
 * `useEventsForTarget`) 또는 store action 을 사용.
 */

import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../../../");

const BOUNDARY_ALLOWLIST: ReadonlyArray<string> = [
  "apps/builder/src/adapters/canonical/index.ts",
  "apps/builder/src/adapters/canonical/canonicalMutations.ts",
  "apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts",
  "apps/builder/src/adapters/canonical/exportLegacyDocument.ts",
  "apps/builder/src/adapters/canonical/compositionExtensionFields.ts",
  "apps/builder/src/adapters/canonical/legacyMetadata.ts",
  "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
  "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
  "apps/builder/src/types/builder/unified.types.ts",
  "packages/shared/src/types/composition-document.types.ts",
  "packages/shared/src/types/composition-document-actions.types.ts",
  "packages/shared/src/utils/compositionExtensionFields.ts",
];

describe("ADR-131 Phase 6 G4 — x-composition direct consumer grep gate", () => {
  it("no production runtime direct access to x-composition.{events|actions|dataBinding} (boundary 외 0)", () => {
    // grep pattern: `x-composition\.(events|actions|dataBinding)` 또는
    // `['"]x-composition['"]\]\.(events|actions|dataBinding)` 형식
    const pattern =
      "(x-composition\\.\\(events\\|actions\\|dataBinding\\)\\|\\[['\"]x-composition['\"]\\]\\.\\(events\\|actions\\|dataBinding\\))";

    let output: string;
    try {
      output = execSync(
        `grep -rn -E "${pattern.replace(/"/g, '\\"')}" --include='*.ts' --include='*.tsx' apps/builder/src packages/shared/src || true`,
        {
          cwd: REPO_ROOT,
          encoding: "utf-8",
        },
      );
    } catch (err: unknown) {
      // exit code 1 = grep no match (정상 0건). 그 외 throw.
      const e = err as { status?: number; stdout?: string };
      if (e.status === 1) {
        output = e.stdout ?? "";
      } else {
        throw err;
      }
    }

    const hits = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.includes("__tests__/"))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes(".spec.ts"));

    const violations: string[] = [];
    for (const hit of hits) {
      const [pathPart] = hit.split(":");
      const isAllowed = BOUNDARY_ALLOWLIST.some((allowed) =>
        pathPart.endsWith(allowed),
      );
      if (!isAllowed) violations.push(hit);
    }

    if (violations.length > 0) {
      // 친절한 fail 메시지
      const message = [
        `ADR-131 Phase 6 G4 grep gate FAIL — ${violations.length} new violation(s):`,
        ...violations.map((v) => `  ${v}`),
        "",
        "Production runtime code must not directly read/write x-composition.",
        "Use root collection hooks instead:",
        "  - useDocumentEvents() / useEventsForTarget(nodeId)",
        "  - useDocumentData()",
        "  - useDocumentActions()",
        "Or boundary allowlist 추가 (의도된 architectural boundary 인 경우).",
      ].join("\n");
      expect.fail(message);
    }

    expect(violations).toEqual([]);
  });
});

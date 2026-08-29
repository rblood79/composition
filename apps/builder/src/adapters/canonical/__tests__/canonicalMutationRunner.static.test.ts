/**
 * @fileoverview ADR-184 Phase 3 — 러너 우회 차단 정적 가드 (G3).
 *
 * canonical mutation wrapper (`mergeElementsCanonicalPrimary` 등 6종) 의 직호출은
 * **기존 경로 allowlist (Phase 0 인벤토리 freeze — breakdown §4-3, 추가 금지)**
 * 에서만 허용된다. 신규 파일이 wrapper 를 참조하면 `runCanonicalMutation(`
 * (canonicalMutationRunner.ts) 경유가 유일 경로 — canonical 스테이지 closure
 * 안에서 wrapper 를 부르는 형태다.
 *
 * 한계 (의도): source-level 가드라 "runCanonicalMutation 을 import 하면서 bare
 * 직호출도 하는" 혼합 형태는 못 가른다. 목적은 완전 차단이 아니라 **우회
 * 시도를 리뷰 신호로 승격**하는 것이다 (ADR-184 R2/R4 — allowlist 추가 시도
 * 자체가 리뷰 대상).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(__dirname, "../../..");

const WRAPPER_NAMES = [
  "mergeElementsCanonicalPrimary",
  "setElementsCanonicalPrimary",
  "moveElementCanonicalPrimary",
  "moveElementToCanonicalTarget",
  "moveElementsToCanonicalTarget",
  "applyElementOrderCanonicalPrimary",
] as const;

/**
 * 기존 경로 고정 목록 (ADR-184 Phase 0 §4-3 — 2026-08-15 freeze).
 *
 * **추가 금지** — 신규 mutation 은 runCanonicalMutation 경유가 유일 경로다.
 * 이 목록에 항목을 추가하는 diff 자체가 ADR-184 위반 리뷰 대상 (R4).
 * (파일럿 `factories/utils/elementCreation.ts` 는 러너 경유로 전환됐으나
 * canonical 스테이지 안에서 wrapper 를 부르므로 참조 자체는 잔존 — 러너
 * 동반 규칙으로도 통과하지만 원 인벤토리 보존을 위해 목록에 유지.)
 */
const EXISTING_PATH_ALLOWLIST = new Set([
  "adapters/canonical/canonicalMutations.ts",
  "builder/factories/utils/elementCreation.ts",
  "builder/hooks/useIframeMessenger.ts",
  "builder/main/BuilderCore.tsx",
  "builder/panels/navigator/FramesTab/FramesTab.tsx",
  "builder/panels/navigator/PagesSection.tsx",
  "builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts",
  "builder/stores/elements.ts",
  "builder/stores/history/historyActions.ts",
  "builder/stores/inspectorActions.ts",
  "builder/stores/utils/elementCreation.ts",
  "builder/stores/utils/elementRemoval.ts",
  "builder/stores/utils/elementUpdate.ts",
  "builder/stores/utils/instanceActions.ts",
  "builder/workspace/canvas/hooks/useDragBridge.ts",
  "builder/workspace/overlay/useTextEdit.ts",
]);

const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);

function walkSources(dir: string, out: { path: string; code: string }[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walkSources(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.test\.(ts|tsx)$/.test(name)) continue;
    const code = readFileSync(full, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    out.push({ path: relative(SRC_ROOT, full), code });
  }
}

describe("canonical mutation 러너 우회 차단 (ADR-184 G3)", () => {
  const sources: { path: string; code: string }[] = [];
  walkSources(SRC_ROOT, sources);

  it("allowlist 밖 파일의 wrapper 참조는 runCanonicalMutation 동반 필수", () => {
    const offenders = sources
      .filter((s) => !EXISTING_PATH_ALLOWLIST.has(s.path))
      .filter((s) => WRAPPER_NAMES.some((name) => s.code.includes(name)))
      .filter((s) => !s.code.includes("runCanonicalMutation("))
      .map((s) => s.path);

    expect(
      offenders,
      `wrapper 직호출 발견 — 신규 mutation 은 runCanonicalMutation 경유가 유일 경로 (ADR-184). ` +
        `allowlist 추가는 금지 (Phase 0 freeze — 추가 시도 자체가 리뷰 대상): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("allowlist 경로가 실제 파일로 존재한다 (경로 부패 감시)", () => {
    const missing = [...EXISTING_PATH_ALLOWLIST].filter((p) => {
      try {
        statSync(join(SRC_ROOT, p));
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});

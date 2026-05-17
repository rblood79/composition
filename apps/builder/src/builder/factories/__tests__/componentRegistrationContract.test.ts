/**
 * ADR-139 Phase 1·3 — 컴포넌트 등록·대칭 contract test
 *
 * composition 컴포넌트는 정상 동작하려면 여러 독립 레지스트리에 각각 등록되어야
 * 한다. 한 곳이라도 누락되면 해당 경로만 조용히 깨진다. 본 test 는 등록 누락을
 * build/CI 시점에 차단한다.
 *
 * 모델 (breakdown §2.5-2 — 레지스트리별 expected set):
 *  - 불변식 A: 모든 spec 파일(universe) ⟹ TAG_SPEC_MAP (확장) 등록
 *  - 불변식 B: 모든 placeable(ComponentFactory.creators) ⟹ rendererMap +
 *             TAG_SPEC_MAP + getDefaultProps 등록
 *
 * 미등록 쌍은 baseline(known debt) 또는 exception(intended) 에 있을 때만 허용.
 * 신규 컴포넌트는 baseline 진입 불가 — 전 레지스트리 등록 후 병합해야 PASS.
 *
 * Phase 3 ratchet: baseline 항목 수를 BASELINE_RATCHET 로 freeze — baseline.json
 *                  에 항목을 추가(append)하면 FAIL, 누락이 해소됐는데 const 를
 *                  미갱신하면 FAIL (재측정 강제). baseline 은 줄어들 수만 있다.
 *
 * 참조:
 * - docs/adr/139-component-registration-symmetry-gate.md
 * - docs/adr/design/139-component-registration-symmetry-gate-breakdown.md §2.5 §3 §5
 *
 * 실행: pnpm test:registration-contract
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { rendererMap } from "@composition/shared/renderers";
import { TAG_SPEC_MAP } from "@composition/specs";
import { TAG_SPEC_MAP as BUILDER_TAG_SPEC_MAP } from "@/builder/workspace/canvas/sprites/tagSpecMap";
import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import { DEFAULT_PROPS_MAP } from "@/types/builder/unified.types";

// ── repo root + universe (spec 파일 glob) ──
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root (pnpm-workspace.yaml) not found");
}

const REPO_ROOT = findRepoRoot(TEST_DIR);
const SPEC_COMPONENTS_DIR = path.join(
  REPO_ROOT,
  "packages/specs/src/components",
);

const universe: string[] = fs
  .readdirSync(SPEC_COMPONENTS_DIR)
  .filter((f) => f.endsWith(".spec.ts"))
  .map((f) => f.replace(/\.spec\.ts$/, ""))
  .sort();

// ── baseline / exception (fs read — resolveJsonModule 의존 회피) ──
type RegistryMap = Record<string, Record<string, string>>;
const readJson = (name: string): RegistryMap =>
  JSON.parse(fs.readFileSync(path.join(TEST_DIR, name), "utf8")) as RegistryMap;

const baseline = readJson("componentRegistrationBaseline.json");
const exceptions = readJson("componentRegistrationException.json");

// ── 레지스트리 키 집합 ──
const rendererKeys = new Set(Object.keys(rendererMap));
const tagSpecKeys = new Set(Object.keys(TAG_SPEC_MAP));
const builderTagSpecKeys = new Set(Object.keys(BUILDER_TAG_SPEC_MAP));
const placeable = ComponentFactory.getRegisteredTypes();
const defaultPropsKeys = new Set(Object.keys(DEFAULT_PROPS_MAP));

type RegistryName = "rendererMap" | "TAG_SPEC_MAP" | "getDefaultProps";

// ── helpers ──
/** 대소문자 무시 lookup — `Frame` spec ↔ `frame` canonical 키 정합 */
function hasCI(set: Set<string>, name: string): boolean {
  if (set.has(name)) return true;
  const lower = name.toLowerCase();
  for (const k of set) if (k.toLowerCase() === lower) return true;
  return false;
}

/** 미등록이 baseline(debt) 또는 exception(intended) 으로 허용되는가 */
function allowed(reg: RegistryName, comp: string): boolean {
  return comp in (exceptions[reg] ?? {}) || comp in (baseline[reg] ?? {});
}

/** candidates 중 keys 에 없고 baseline/exception 으로도 허용되지 않는 항목 */
function unexpectedMissing(
  candidates: string[],
  keys: Set<string>,
  reg: RegistryName,
): string[] {
  return candidates
    .filter((c) => !hasCI(keys, c))
    .filter((c) => !allowed(reg, c))
    .sort();
}

// ── Phase 3: baseline ratchet (breakdown §5) ──
// baseline 의 레지스트리별 항목 수를 freeze 한다. 이 const 는 줄어들 수만 있다
// (ratchet). baseline.json 항목 수가 이 값과 어긋나면 ratchet 테스트 FAIL:
//  - append (현재 > frozen): 신규 누락이 baseline 으로 우회 시도 — 금지
//  - shrink (현재 < frozen): 누락 해소됐으나 const 미갱신 — 재측정 필요
// baseline.json 은 데이터 파일이라 단독 편집이 쉽다. 이 const 를 test 코드(리뷰
// 대상)에 두어, baseline 변경이 반드시 리뷰되는 코드 편집을 동반하게 한다.
const BASELINE_RATCHET: Record<RegistryName, number> = {
  rendererMap: 5,
  TAG_SPEC_MAP: 1,
  getDefaultProps: 0,
};

type RatchetVerdict = "ok" | "append" | "shrink";

/** baseline 항목 수 vs frozen ratchet 비교 */
function ratchetVerdict(current: number, frozen: number): RatchetVerdict {
  if (current > frozen) return "append";
  if (current < frozen) return "shrink";
  return "ok";
}

describe("ADR-139 컴포넌트 등록·대칭 gate", () => {
  it("inventory sanity — universe / placeable enumerate", () => {
    expect(universe.length).toBeGreaterThanOrEqual(115);
    expect(placeable.length).toBeGreaterThan(40);
    expect(tagSpecKeys.size).toBeGreaterThan(90);
  });

  // ── 불변식 A: spec 파일 ⟹ TAG_SPEC_MAP ──
  it("불변식 A — 모든 spec 파일은 TAG_SPEC_MAP 에 등록", () => {
    const missing = unexpectedMissing(universe, tagSpecKeys, "TAG_SPEC_MAP");
    expect(
      missing,
      `spec 파일이나 TAG_SPEC_MAP 미등록 (baseline/exception 외): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // ── 불변식 B: placeable ⟹ rendererMap / TAG_SPEC_MAP / getDefaultProps ──
  it("불변식 B — placeable 컴포넌트는 rendererMap 에 등록", () => {
    const missing = unexpectedMissing(placeable, rendererKeys, "rendererMap");
    expect(
      missing,
      `placeable 이나 rendererMap 미등록: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("불변식 B — placeable 컴포넌트는 TAG_SPEC_MAP 에 등록", () => {
    const missing = unexpectedMissing(placeable, tagSpecKeys, "TAG_SPEC_MAP");
    expect(
      missing,
      `placeable 이나 TAG_SPEC_MAP 미등록: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("불변식 B — placeable 컴포넌트는 getDefaultProps 에 등록", () => {
    const missing = unexpectedMissing(
      placeable,
      defaultPropsKeys,
      "getDefaultProps",
    );
    expect(
      missing,
      `placeable 이나 getDefaultProps 미등록: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // ── builder merged TAG_SPEC_MAP 정합 (codex round 2 HIGH-1) ──
  it("builder merged TAG_SPEC_MAP 은 정본 TAG_SPEC_MAP 을 전부 포함", () => {
    const missing = [...tagSpecKeys]
      .filter((k) => !builderTagSpecKeys.has(k))
      .sort();
    expect(
      missing,
      `정본 TAG_SPEC_MAP 키가 builder merged 에 누락: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // ── negative fixture: 주입된 가짜 미등록이 FAIL 로 감지되는가 ──
  it("negative fixture — 주입된 가짜 미등록을 diff 가 감지", () => {
    const injected = [...placeable, "__Adr139FakeUnregistered__"];
    const missing = unexpectedMissing(injected, rendererKeys, "rendererMap");
    expect(missing).toContain("__Adr139FakeUnregistered__");
  });

  // ── staleness: baseline/exception 에 이미 해소된 항목이 없는가 (Phase 3 ratchet 기반) ──
  it("baseline/exception staleness — 이미 등록된 항목이 목록에 남아있지 않음", () => {
    const keysByReg: Record<RegistryName, Set<string>> = {
      rendererMap: rendererKeys,
      TAG_SPEC_MAP: tagSpecKeys,
      getDefaultProps: defaultPropsKeys,
    };
    const stale: string[] = [];
    for (const src of [baseline, exceptions]) {
      for (const [reg, entries] of Object.entries(src)) {
        if (reg.startsWith("_")) continue;
        const keys = keysByReg[reg as RegistryName];
        if (!keys) continue;
        for (const comp of Object.keys(entries)) {
          if (hasCI(keys, comp)) stale.push(`${reg}/${comp}`);
        }
      }
    }
    expect(
      stale,
      `이미 등록되어 baseline/exception 에서 제거해야 할 항목: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  // ── Phase 3 ratchet: baseline append 금지 / 감소 시 재측정 강제 ──
  it("baseline ratchet — 항목 수가 BASELINE_RATCHET 와 정확히 일치", () => {
    const violations: string[] = [];
    for (const reg of Object.keys(BASELINE_RATCHET) as RegistryName[]) {
      const count = Object.keys(baseline[reg] ?? {}).length;
      const frozen = BASELINE_RATCHET[reg];
      const verdict = ratchetVerdict(count, frozen);
      if (verdict === "append") {
        violations.push(
          `${reg}: baseline ${count}건 > ratchet ${frozen}건 — 신규 누락은 ` +
            `baseline 진입 불가. 컴포넌트를 전 레지스트리에 등록 후 병합하거나, ` +
            `정당한 known debt 면 BASELINE_RATCHET.${reg} 를 ${count} 로 올린 뒤 ` +
            `리뷰를 받으세요.`,
        );
      } else if (verdict === "shrink") {
        violations.push(
          `${reg}: baseline ${count}건 < ratchet ${frozen}건 — 누락 ` +
            `${frozen - count}건 해소됨. BASELINE_RATCHET.${reg} 를 ${count} 로 ` +
            `낮춰 재측정하세요.`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("ratchet negative fixture — append / 감소 verdict 가 감지됨", () => {
    expect(ratchetVerdict(6, 5)).toBe("append");
    expect(ratchetVerdict(4, 5)).toBe("shrink");
    expect(ratchetVerdict(5, 5)).toBe("ok");
  });
});

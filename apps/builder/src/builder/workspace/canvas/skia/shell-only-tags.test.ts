/**
 * ADR-072 Phase 1 + 2-A + 2-B: Shell-only container tags 검증
 *
 * `_hasChildren` 컨벤션 SSOT — factory 자식 자동 생성이 확인된 태그들이
 * SHELL_ONLY_CONTAINER_TAGS로 이동되었음을 보장한다.
 *
 * 검증 범위:
 *   1. Set membership: Shell-only Set 포함 + Synthetic-merge Set 미포함
 *   2. shapes invariant: `_hasChildren=true` 시 standalone container 미생성
 *   3. standalone 회귀 금지: `_hasChildren=false` 시 placeholder 존재
 *      (Phase 2-B는 text/gradient 등 다양한 실렌더 shape이므로 container 대신
 *       "shell 수 < standalone 수" 검증으로 일반화)
 *
 * 자식 수와 무관한 `_hasChildren=true` 주입은 Calendar/RangeCalendar
 * 대칭 테스트(`calendar-symmetry.test.ts`)에서 이미 증명됨.
 */

import { describe, expect, it } from "vitest";
import type { ComponentSpec } from "@composition/specs";
import {
  SHELL_ONLY_CONTAINER_TAGS,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
} from "./buildSpecNodeData";

type AnySpec = ComponentSpec<Record<string, unknown>>;

// Phase 1 (Empty-placeholder Case A)
// ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → spec 삭제로 이 테스트 대상에서 제외.
//   Card 의 SHELL_ONLY 멤버십(SHELL_ONLY_CONTAINER_TAGS)은 유지(자식 독립 렌더), 시각 검증은
//   catalog rule + buildCatalogShapes shell 경로.
// ADR-912 Disclosure 군 catalog cutover (2026-06-10) — spec 삭제로 제외 (시각 = catalog rule + buildCatalogShapes 경로)
// ADR-912 단계5 step4 small-B (2026-06-16): Section catalog cutover spec 삭제로 제외.
// ADR-912 단계5 step4 Dialog 단건 (2026-06-16): Dialog catalog cutover spec 삭제로 제외 (마지막
//   phase1 항목 — 빈 배열). SHELL_ONLY 멤버십은 buildSpecNodeData.ts 에서 유지(자식 독립 렌더).
const phase1Candidates: Array<{ type: string; spec: AnySpec }> = [];

// Phase 2-A (Group 컨테이너 — factory items 자동 생성)
// ADR-912 R7 G1-c (2026-06-15): ButtonGroup catalog cutover spec 삭제로 제외 (시각 = catalog rule + buildCatalogShapes)
// ADR-912 단계5 step4 small-B (2026-06-16): CheckboxGroup/RadioGroup catalog cutover spec 삭제로 제외
//   (시각 = catalog rule + buildCatalogShapes shell, propagation = createPropagationOnlySpec 인라인).
// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroup catalog cutover spec 삭제로 제외
//   (시각 = catalog rule + generate-css virtual indicatorMode/delegation carry, propagation = createPropagationOnlySpec 인라인).
//   SHELL_ONLY 멤버십(SHELL_ONLY_CONTAINER_TAGS)은 유지(자식 ToggleButton 독립 렌더).
const phase2ACandidates: Array<{ type: string; spec: AnySpec }> = [];

// Phase 2-B (standalone 실렌더 — factory 자식 CanvasSceneNode가 대체 커버)
const phase2BCandidates: Array<{ type: string; spec: AnySpec }> = [
  // ADR-912 Disclosure 군 catalog cutover (2026-06-10) — spec 삭제로 이 테스트 대상에서 제외 (시각 검증은 catalog rule + buildCatalogShapes 경로)
  // ADR-912 단계5 step4 small-B (2026-06-16): Form catalog cutover spec 삭제로 제외.
  // ADR-912 단계5 step4 Popover 단건 (2026-06-16): Popover 후보 제거 — spec 삭제로 render.shapes
  //   기반 _hasChildren 분기 검증 대상 소멸. SHELL_ONLY 멤버십은 buildSpecNodeData.ts 에서 유지.
  // ADR-912 단계5 step4 Tooltip 단건 (2026-06-16): Tooltip 후보 제거 — spec 삭제로 render.shapes
  //   기반 _hasChildren 분기 검증 대상 소멸. SHELL_ONLY 멤버십은 buildSpecNodeData.ts 에서 유지.
  // ADR-912 Color container cutover (2026-06-17): ColorPicker spec 삭제로 phase2B 검증 대상에서 제외.
  //   SHELL_ONLY 멤버십은 colorContainerCutover.test.ts 가 정적 회귀로 잠근다.
];

// Phase 3 (TabPanel/TabPanels): ADR-912 catalog 발효 + spec 파일 삭제(2026-06-11)로
// 제거 — shapes=[] 단언 대상 spec 자체가 소멸(generated CSS = virtual 재생성).

const containerPlaceholderCandidates = [
  ...phase1Candidates,
  ...phase2ACandidates,
];

const candidates = [
  ...phase1Candidates,
  ...phase2ACandidates,
  ...phase2BCandidates,
];

function callShapes(spec: AnySpec, hasChildren: boolean) {
  const defaultSize = spec.defaultSize ?? "md";
  const size = spec.sizes![defaultSize]!;
  const props = hasChildren ? { _hasChildren: true } : {};
  return spec.render.shapes!(props, size, "default");
}

describe("ADR-072 Phase 1 + 2-A + 2-B: SHELL_ONLY_CONTAINER_TAGS 재분류", () => {
  describe("Set membership", () => {
    if (candidates.length === 0) {
      it.skip("placeholder — 모든 shell-only spec 후보 catalog cutover 됨", () => {});
    }
    for (const { type } of candidates) {
      it(`${type}: SHELL_ONLY_CONTAINER_TAGS 포함`, () => {
        expect(SHELL_ONLY_CONTAINER_TAGS.has(type)).toBe(true);
      });

      it(`${type}: SYNTHETIC_CHILD_PROP_MERGE_TAGS 제외`, () => {
        expect(SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type)).toBe(false);
      });
    }
  });

  describe("_hasChildren=true → shell만 반환 (container placeholder 없음)", () => {
    // ADR-912 단계5 step4 Dialog 단건 (2026-06-16): containerPlaceholderCandidates 가 빈 배열
    //   (phase1/2-A 전 항목 catalog cutover spec 삭제). vitest "No test found in suite" 회피용
    //   placeholder — 미래 컨테이너 spec(미cutover) 추가 시 for 루프가 실 케이스 생성.
    if (containerPlaceholderCandidates.length === 0) {
      it.skip("placeholder — 모든 phase1/2-A 후보 catalog cutover 됨", () => {});
    }
    for (const { type, spec } of containerPlaceholderCandidates) {
      it(`${type}: standalone container 미생성`, () => {
        const shapes = callShapes(spec, true);
        const containers = shapes.filter((s) => s.type === "container");
        expect(containers).toHaveLength(0);
      });
    }
  });

  describe("_hasChildren=false → standalone placeholder 존재 (회귀 방지)", () => {
    if (containerPlaceholderCandidates.length === 0) {
      it.skip("placeholder — 모든 phase1/2-A 후보 catalog cutover 됨", () => {});
    }
    for (const { type, spec } of containerPlaceholderCandidates) {
      it(`${type}: standalone container 최소 1개 존재`, () => {
        const shapes = callShapes(spec, false);
        const containers = shapes.filter((s) => s.type === "container");
        expect(containers.length).toBeGreaterThan(0);
      });
    }
  });

  describe("Phase 2-B: _hasChildren 분기 invariant (factory 자식이 실렌더 대체)", () => {
    // Phase 2-B 태그들은 standalone 분기에 text/gradient/arrow 등 다양한 실렌더
    // shape이 존재. Shell-only 이동 후에도 _hasChildren=true 시에는 이들이
    // 생성되지 않고 shell(bg/border 등)만 유지됨을 검증.
    if (phase2BCandidates.length === 0) {
      it.skip("placeholder — 모든 phase2B 후보 catalog cutover 됨", () => {});
    }
    for (const { type, spec } of phase2BCandidates) {
      it(`${type}: shell shapes < standalone shapes`, () => {
        const shellShapes = callShapes(spec, true);
        const standaloneShapes = callShapes(spec, false);
        expect(shellShapes.length).toBeLessThan(standaloneShapes.length);
      });
    }
  });

  // Phase 3 (TabPanel/TabPanels shapes=[] 단언): ADR-912 catalog 발효 + spec 파일
  // 삭제(2026-06-11)로 제거 — 단언 대상 spec 자체가 소멸.
});

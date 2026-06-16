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
import {
  DialogSpec,
  // ADR-912 Disclosure 군 catalog cutover (2026-06-10) + Card 본체 R6 + ButtonGroup R7 G1-c (2026-06-15) — spec 삭제로 이 테스트 대상에서 제외 (시각 검증은 catalog rule + buildCatalogShapes 경로)
  // ADR-912 단계5 step4 small-B (2026-06-16): Section/CheckboxGroup/RadioGroup/Form spec import 제거 —
  //   catalog cutover spec 삭제로 _hasChildren 검증 대상에서 제외 (시각 = catalog rule + buildCatalogShapes shell 경로).
  // ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec import 제거 —
  //   catalog cutover spec 삭제로 제외 (시각 = catalog rule + generate-css virtual indicatorMode/delegation carry).
  PopoverSpec,
  TooltipSpec,
  ColorPickerSpec,
} from "@composition/specs";
import type { ComponentSpec } from "@composition/specs";
import {
  SHELL_ONLY_CONTAINER_TAGS,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
} from "./buildSpecNodeData";

type AnySpec = ComponentSpec<Record<string, unknown>>;

// Phase 1 (Empty-placeholder Case A)
const phase1Candidates: Array<{ type: string; spec: AnySpec }> = [
  // ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → spec 삭제로 이 테스트 대상에서 제외.
  //   Card 의 SHELL_ONLY 멤버십(SHELL_ONLY_CONTAINER_TAGS)은 유지(자식 독립 렌더), 시각 검증은
  //   catalog rule + buildCatalogShapes shell 경로.
  { type: "Dialog", spec: DialogSpec as unknown as AnySpec },
  // ADR-912 Disclosure 군 catalog cutover (2026-06-10) — spec 삭제로 이 테스트 대상에서 제외 (시각 검증은 catalog rule + buildCatalogShapes 경로)
  // ADR-912 단계5 step4 small-B (2026-06-16): Section catalog cutover spec 삭제로 제외.
];

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
  { type: "Popover", spec: PopoverSpec as unknown as AnySpec },
  { type: "Tooltip", spec: TooltipSpec as unknown as AnySpec },
  { type: "ColorPicker", spec: ColorPickerSpec as unknown as AnySpec },
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
    for (const { type, spec } of containerPlaceholderCandidates) {
      it(`${type}: standalone container 미생성`, () => {
        const shapes = callShapes(spec, true);
        const containers = shapes.filter((s) => s.type === "container");
        expect(containers).toHaveLength(0);
      });
    }
  });

  describe("_hasChildren=false → standalone placeholder 존재 (회귀 방지)", () => {
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

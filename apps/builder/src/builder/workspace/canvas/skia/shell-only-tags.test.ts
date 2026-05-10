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
  CardSpec,
  DialogSpec,
  SectionSpec,
  DisclosureGroupSpec,
  ButtonGroupSpec,
  CheckboxGroupSpec,
  RadioGroupSpec,
  ToggleButtonGroupSpec,
  DisclosureSpec,
  FormSpec,
  PopoverSpec,
  TooltipSpec,
  ColorPickerSpec,
  TabPanelSpec,
  TabPanelsSpec,
} from "@composition/specs";
import type { ComponentSpec } from "@composition/specs";
import {
  SHELL_ONLY_CONTAINER_TAGS,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
} from "./buildSpecNodeData";

type AnySpec = ComponentSpec<Record<string, unknown>>;

// Phase 1 (Empty-placeholder Case A)
const phase1Candidates: Array<{ type: string; spec: AnySpec }> = [
  { type: "Card", spec: CardSpec as unknown as AnySpec },
  { type: "Dialog", spec: DialogSpec as unknown as AnySpec },
  { type: "Section", spec: SectionSpec as unknown as AnySpec },
  { type: "DisclosureGroup", spec: DisclosureGroupSpec as unknown as AnySpec },
];

// Phase 2-A (Group 컨테이너 — factory items 자동 생성)
const phase2ACandidates: Array<{ type: string; spec: AnySpec }> = [
  { type: "ButtonGroup", spec: ButtonGroupSpec as unknown as AnySpec },
  { type: "CheckboxGroup", spec: CheckboxGroupSpec as unknown as AnySpec },
  { type: "RadioGroup", spec: RadioGroupSpec as unknown as AnySpec },
  {
    type: "ToggleButtonGroup",
    spec: ToggleButtonGroupSpec as unknown as AnySpec,
  },
];

// Phase 2-B (standalone 실렌더 — factory 자식 CanvasSceneNode가 대체 커버)
const phase2BCandidates: Array<{ type: string; spec: AnySpec }> = [
  { type: "Disclosure", spec: DisclosureSpec as unknown as AnySpec },
  { type: "Form", spec: FormSpec as unknown as AnySpec },
  { type: "Popover", spec: PopoverSpec as unknown as AnySpec },
  { type: "Tooltip", spec: TooltipSpec as unknown as AnySpec },
  { type: "ColorPicker", spec: ColorPickerSpec as unknown as AnySpec },
];

// Phase 3 (shapes=[] — _hasChildren 분기 부재, SYNTHETIC에서도 제외)
// Shell-only 이동 안 함 (shapes 자체가 비어있어 의미 없음).
const phase3Candidates: Array<{ type: string; spec: AnySpec }> = [
  { type: "TabPanel", spec: TabPanelSpec as unknown as AnySpec },
  { type: "TabPanels", spec: TabPanelsSpec as unknown as AnySpec },
];

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

  describe("Phase 3: shapes=[] 태그 — 두 Set 모두 제외", () => {
    // TabPanel/TabPanels는 `shapes: () => []`로 자식 props를 사용하지 않음.
    // SYNTHETIC 멤버십의 두 효과(incrementalSync rebuild expansion + stale-ref
    // 교체)가 무효이므로 제거. Shell-only 이동도 의미 없음.
    for (const { type, spec } of phase3Candidates) {
      it(`${type}: shapes 빈 배열`, () => {
        expect(callShapes(spec, false)).toEqual([]);
        expect(callShapes(spec, true)).toEqual([]);
      });

      it(`${type}: SHELL_ONLY_CONTAINER_TAGS 미포함`, () => {
        expect(SHELL_ONLY_CONTAINER_TAGS.has(type)).toBe(false);
      });

      it(`${type}: SYNTHETIC_CHILD_PROP_MERGE_TAGS 미포함`, () => {
        expect(SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type)).toBe(false);
      });
    }
  });
});

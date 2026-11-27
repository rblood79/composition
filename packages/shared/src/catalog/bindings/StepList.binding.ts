import type { PrimitiveBinding } from "../types";
import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";
import { DISABLED_KEYS_PROP } from "./disabledKeysProp";

/**
 * ADR-321 — StepList · Step: Spectrum 의 단계 표시 (design-data `steplist`). RAC 1.22.1 · S2 1.8.2 에
 * 없어 RAC 부품으로 조립한다 — `ol > li` 안의 RAC `Link` (D1 예외 0, Phase 2). prop 이름은 v3 StepList
 * 의 것 (사용자 결정 1, 2026-11-27 — `selectedKey` · `lastCompletedStep` · `isEmphasized`), 치수 · 색은
 * design-data 의 값이다 (`rule/stepList.ts`, `d2Provenance.ts`).
 *
 * Node tree: `StepList > Step*`, 단계 = Step 원본 (`component-step`) 의 instance — 라벨 Text `{label}` 과
 * 설명 Text `{description}` (비면 없음 — 사용자 결정 4). 표식 · 선은 노드가 아니라 단계가 그린다.
 *
 * 상태 (Canvas 는 시작 값의 정지 모양 — Decision 10): 지금 단계 = `selectedKey` → `defaultSelectedKey` →
 * 완료 · 비활성이 아닌 첫 단계, 마친 단계 = `lastCompletedStep` → `defaultLastCompletedStep`
 * (`runtime/stepListState.ts`). 실행 중에는 단계의 RAC `Link` 를 눌러 옮기고 (`isReadOnly` 는 누르기만
 * 막는다), 규칙의 When 2 · Do 4 는 `interactions/concepts/stepList.ts` 다.
 */
export const stepListBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "steplist" },
  props: {
    accepts: {
      // (The controlled twins — a value binding · a rule's write; the panel edits the start values.)
      selectedKey: {
        editorHidden: true,
        kind: "string",
        label: "Current step",
        section: "value",
      },
      lastCompletedStep: {
        editorHidden: true,
        kind: "string",
        label: "Last completed step",
        section: "value",
      },
      defaultSelectedKey: {
        kind: "string",
        label: "Current step",
        section: "value",
      },
      defaultLastCompletedStep: {
        kind: "string",
        label: "Last completed step",
        section: "value",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      disabledKeys: DISABLED_KEYS_PROP,
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // 사용자 결정 3 (2026-11-27): 순서와 무관하게 비활성이 아닌 단계를 누를 수 있다. 기본은 선형
      // (Spectrum 지침 — 남은 단계는 누를 수 없다). v3 에 없는 스위치다 (`d2Provenance.ts`).
      allowsFreeNavigation: {
        kind: "boolean",
        label: "Free navigation",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

export const stepBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "step" },
  props: {
    accepts: {
      // Its key — the name the list's `selectedKey` · `lastCompletedStep` · `disabledKeys` use.
      id: ITEM_KEY_PROP_CONTRACT,
      // (The texts the Step origin's Text nodes show — `{label}` · `{description}`.)
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
      },
      // (The list's size, carried by the resolver — `CATALOG_SIZE_PROPAGATION`.)
      size: {
        editorHidden: true,
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

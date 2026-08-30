/**
 * ADR-199 Phase 1 — 컴포넌트 시맨틱 액션의 **표면 노출 축** SSOT.
 *
 * 명령 축은 이미 하나씩 서 있다 — 정의 `SHORTCUT_DEFINITIONS`(72) · 표기
 * `formatShortcut` · 실행 `commandRegistry`(ADR-195) · precondition
 * `COMMAND_META`(72, ADR-196) · 아이콘 `ACTION_ICONS`. 비어 있던 축은 **어떤
 * 액션이 어느 표면에 어떤 라벨과 순서로 서는가** 하나였고, 그 축만 표면마다
 * 다시 쓰였다 (라벨 2계열 · 순서 2벌 · 가용성 판정 3곳 — Phase 0 freeze
 * `docs/adr/evidence/199-surface-inventory.md`).
 *
 * 이 모듈은 그 축의 정본이다. 표면(패널 · 컨텍스트 메뉴 · 액션 바)은 배열을
 * 읽어 **렌더/필터만** 하고 항목을 새로 정의하지 않는다.
 *
 * ## 두 축은 직교다
 *
 * `commandId` 로 명령 축과 같은 id 를 가리키되 필드는 겹치지 않는다 — 키 조합은
 * `SHORTCUT_DEFINITIONS`, precondition/undo 는 `COMMAND_META`, 노출은 여기.
 * specialization 이 아니라 옆에 선 축이다 (ADR-199 breakdown §1-2).
 *
 * ## 술어 입력은 사영 불변 필드만
 *
 * `EditingSemanticsTarget` 은 `type` 을 갖지 않는다. 캔버스 상호작용 map 은 Skia
 * `interactionNodesMap` 파생이라 `type` 이 렌더 컴포넌트(`"Button"`)로 해소되고
 * `ref` 만 보존된다 (`BuilderCanvas.tsx:769`). 술어가 `type` 을 읽으면 같은
 * 함수가 캔버스 표면에서만 다르게 답한다 — 2026-08-30 에 "인스턴스 분리" 가
 * 캔버스에서만 통째로 사라진 회귀의 원인 (ADR-199 HC3).
 */
import { Diamond } from "lucide-react";
import {
  canDetachInstance,
  isEditingSemanticsInstance,
  isEditingSemanticsOrigin,
  toEditingSemanticsTarget,
  type EditingSemanticsTarget,
} from "../../adapters/canonical/editingSemantics";

// 좁히기와 타입은 어댑터가 소유한다 — legacy mirror 필드(`componentRole` /
// `masterId`)를 이름으로 다루는 자리는 `adapters/canonical/**` 뿐이다
// (ADR-116 G5). 표면은 레지스트리에서 함께 가져다 쓴다.
export { toEditingSemanticsTarget };
export type { EditingSemanticsTarget };
import { ACTION_ICONS, type ActionIcon } from "./actionIcons";
import type { ShortcutId } from "./keyboardShortcuts";

/** ADR-182 item id 계약과 같은 문자열 (`select-instances` 만 패널 전용). */
export type ComponentSemanticsActionId =
  | "go-to-origin"
  | "detach-instance"
  | "select-instances"
  | "toggle-component-origin";

/** 노출 표면. 단축키·agent 는 명령 축(`commandId`)이라 여기 세지 않는다. */
export type ActionSurface =
  | "properties-panel"
  | "context-menu"
  | "action-bar";

/**
 * 노드 하나로는 알 수 없는 맥락. 전부 표면이 계산해 넘긴다.
 *
 * - `hasResolvedOrigin` — 원본 노드를 실제로 찾았는가. 패널은 못 찾으면 버튼을
 *   비활성으로 세우고 메뉴는 항목을 아예 빼는데, **둘 다 유지한다** (Phase 0
 *   발산 D3 — 보존 대상). 그래서 노출(`isAvailable`)과 활성(`isEnabled`)을
 *   나눠 두고 어느 쪽으로 표현할지는 표면이 정한다.
 * - `instanceCount` — 이 원본을 참조하는 인스턴스 수. 0 이면 누를 것이 없어
 *   `select-instances` 를 세우지 않는다.
 * - `selectionSize` — 선택 기수. 메뉴만 다중 선택에서 첫 detachable 하나를
 *   집는다 (발산 D4). descriptor 는 단일 노드 계약을 유지하고, 다중 경로는
 *   표면이 대상 노드를 골라 넘기는 방식으로 남는다.
 */
export interface ActionAvailabilityContext {
  hasResolvedOrigin: boolean;
  instanceCount: number;
  selectionSize: number;
}

export interface ActionLabel {
  en: string;
  ko: string;
}

export interface ComponentSemanticsActionDescriptor {
  id: ComponentSemanticsActionId;
  /** 명령 축 연결 — 있으면 단축키/agent 가 같은 id 로 실행한다. */
  commandId?: ShortcutId;
  /** 노출 표면. 순서는 이 배열이 아니라 `COMPONENT_SEMANTICS_ACTIONS` 순서다. */
  surfaces: readonly ActionSurface[];
  /** 라벨 원본은 여기 한 곳 — 메뉴는 `ko / en` 병기, 패널은 `en` 을 고른다. */
  label(
    target: EditingSemanticsTarget,
    context: ActionAvailabilityContext,
  ): ActionLabel;
  icon(target: EditingSemanticsTarget): ActionIcon;
  isAvailable(
    target: EditingSemanticsTarget,
    context: ActionAvailabilityContext,
  ): boolean;
  /** 생략 = 항상 활성. 노출됐지만 지금은 누를 수 없는 경우만 정의한다. */
  isEnabled?(
    target: EditingSemanticsTarget,
    context: ActionAvailabilityContext,
  ): boolean;
}

const ALL_SURFACES: readonly ActionSurface[] = [
  "properties-panel",
  "context-menu",
  "action-bar",
];

/**
 * **배열 순서가 노출 순서의 정본**이다 (좌→우 / 위→아래).
 *
 * Phase 0 freeze 기준 패널·바는 이 순서였고 메뉴만 컴포넌트 축이 선두였다
 * (발산 D1). 같은 묶음이 표면마다 다른 순서로 서면 위치를 매번 다시 찾으므로
 * 메뉴를 이 순서로 맞춘다 — ADR-199 HC5 의 명시 예외 1건.
 */
export const COMPONENT_SEMANTICS_ACTIONS: readonly ComponentSemanticsActionDescriptor[] =
  [
    {
      id: "go-to-origin",
      surfaces: ALL_SURFACES,
      label: () => ({ en: "Go to component", ko: "원본으로 이동" }),
      icon: () => ACTION_ICONS.goToOrigin,
      isAvailable: (target) => isEditingSemanticsInstance(target),
      isEnabled: (_target, context) => context.hasResolvedOrigin,
    },
    {
      id: "detach-instance",
      commandId: "detachInstance",
      surfaces: ALL_SURFACES,
      label: () => ({ en: "Detach instance", ko: "인스턴스 분리" }),
      icon: () => ACTION_ICONS.detach,
      isAvailable: (target) => canDetachInstance(target),
    },
    {
      id: "select-instances",
      // 패널 전용 — ADR-182 항목 id 계약에도 바 allowlist 계약에도 없다.
      // 메뉴/바에 실으려면 그 계약부터 넓혀야 하므로 여기서 조용히 늘리지
      // 않는다 (Phase 0 freeze §5).
      surfaces: ["properties-panel"],
      label: (_target, context) => ({
        en: `Select instances (${context.instanceCount})`,
        ko: `인스턴스 선택 (${context.instanceCount})`,
      }),
      icon: () => Diamond,
      isAvailable: (target, context) =>
        isEditingSemanticsOrigin(target) && context.instanceCount > 0,
    },
    {
      id: "toggle-component-origin",
      commandId: "toggleComponentOrigin",
      surfaces: ALL_SURFACES,
      // 생성/해제 양방향 토글이라 그림도 함께 뒤집는다 — 라벨만 바뀌고 그림이
      // 고정이면 어느 방향인지 아이콘이 말해 주지 않는다.
      label: (target) =>
        isEditingSemanticsOrigin(target)
          ? { en: "Detach component", ko: "컴포넌트 분리" }
          : { en: "Create component", ko: "컴포넌트 만들기" },
      icon: (target) =>
        isEditingSemanticsOrigin(target)
          ? ACTION_ICONS.detach
          : ACTION_ICONS.createComponent,
      // 두 축은 독립이라 인스턴스에도 함께 선다. 어느 노드가 이 섹션/블록을
      // 여는지는 표면 규칙이다 (메뉴는 단일 && non-body).
      isAvailable: () => true,
    },
  ];

export const DEFAULT_AVAILABILITY_CONTEXT: ActionAvailabilityContext = {
  hasResolvedOrigin: false,
  instanceCount: 0,
  selectionSize: 1,
};

/**
 * 표면이 부르는 유일한 진입점 — 배열 순서 그대로, 그 표면에 실리고 지금
 * 가용한 항목만.
 */
export function resolveComponentSemanticsActions(
  surface: ActionSurface,
  target: EditingSemanticsTarget,
  context: ActionAvailabilityContext = DEFAULT_AVAILABILITY_CONTEXT,
): readonly ComponentSemanticsActionDescriptor[] {
  return COMPONENT_SEMANTICS_ACTIONS.filter(
    (action) =>
      action.surfaces.includes(surface) && action.isAvailable(target, context),
  );
}

/** 메뉴 어법 (`한국어 / English`). 문자열 조립도 한 곳에 둔다. */
export function formatBilingualLabel(label: ActionLabel): string {
  return `${label.ko} / ${label.en}`;
}

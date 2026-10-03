/**
 * ADR-199 — 컴포넌트 축 액션의 노출 순서 · 표면 (ADR-248 4e-7: 동작 판정과 분리 — 액션 바는 이것만 읽는다,
 * 동작은 `componentSemanticsActions.ts`).
 *
 * **배열 순서가 노출 순서의 정본**이다 (좌→우 / 위→아래). Phase 0 freeze 기준 패널·바는 이 순서였고 메뉴만
 * 컴포넌트 축이 선두였다 (발산 D1). 같은 묶음이 표면마다 다른 순서로 서면 위치를 매번 다시 찾으므로 메뉴를
 * 이 순서로 맞춘다 — ADR-199 HC5 의 명시 예외 1건.
 */

/** ADR-182 item id 계약과 같은 문자열 (`select-instances` 만 패널 전용). */
export type ComponentSemanticsActionId =
  | "go-to-origin"
  | "detach-instance"
  | "select-instances"
  | "toggle-component-origin";

/** 노출 표면. 단축키·agent 는 명령 축(`commandId`)이라 여기 세지 않는다. */
export type ActionSurface = "properties-panel" | "context-menu" | "action-bar";

const ALL_SURFACES: readonly ActionSurface[] = [
  "properties-panel",
  "context-menu",
  "action-bar",
];

export const COMPONENT_SEMANTICS_ACTION_ORDER: readonly {
  id: ComponentSemanticsActionId;
  surfaces: readonly ActionSurface[];
}[] = [
  { id: "go-to-origin", surfaces: ALL_SURFACES },
  { id: "detach-instance", surfaces: ALL_SURFACES },
  // 패널 전용 — ADR-182 항목 id 계약에도 바 allowlist 계약에도 없다. 메뉴/바에 실으려면 그 계약부터
  // 넓혀야 하므로 여기서 조용히 늘리지 않는다 (Phase 0 freeze §5).
  { id: "select-instances", surfaces: ["properties-panel"] },
  { id: "toggle-component-origin", surfaces: ALL_SURFACES },
];

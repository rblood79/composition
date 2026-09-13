/**
 * ADR-214 Phase 4 — 암묵 상태 (RAC 가 이미 가진 상태 prop) 의 관찰 표 (Phase 0 evidence §6 —
 * capability 가 **쓰는** controlled prop = 이름을 붙여 **읽을** 후보).
 *
 * R6: 읽기는 관찰 이벤트 (`onChange` / `onSelectionChange` / `onExpandedChange`) 뿐 — prop 주입
 * 0 (controlled/uncontrolled 전환 없음, D1 무변경). 값 형식은 변수 타입으로 정규화한다
 * (`Selection` Set → 배열, `"all"` 은 문자열 그대로).
 */
import type { VariableDefType } from "./variable.types";

export interface ImplicitStateSource {
  /** RAC 상태 prop */
  prop: string;
  /** 관찰 이벤트 (RAC callback 이름) */
  event: string;
  /** 변수 타입 (이름 붙일 때 기본) */
  type: VariableDefType;
}

export const IMPLICIT_STATE_SOURCES: Readonly<
  Record<string, readonly ImplicitStateSource[]>
> = {
  Tree: [
    { prop: "selectedKeys", event: "onSelectionChange", type: "array" },
    { prop: "expandedKeys", event: "onExpandedChange", type: "array" },
  ],
  TagGroup: [{ prop: "selectedKeys", event: "onSelectionChange", type: "array" }],
  ListBox: [{ prop: "selectedKeys", event: "onSelectionChange", type: "array" }],
  GridList: [{ prop: "selectedKeys", event: "onSelectionChange", type: "array" }],
  Checkbox: [{ prop: "isSelected", event: "onChange", type: "boolean" }],
  ToggleButton: [{ prop: "isSelected", event: "onChange", type: "boolean" }],
  Switch: [{ prop: "isSelected", event: "onChange", type: "boolean" }],
  RadioGroup: [{ prop: "value", event: "onChange", type: "string" }],
  Slider: [{ prop: "value", event: "onChange", type: "number" }],
  Tabs: [{ prop: "selectedKey", event: "onSelectionChange", type: "string" }],
  Disclosure: [{ prop: "isExpanded", event: "onExpandedChange", type: "boolean" }],
};

export function resolveImplicitStateSources(
  componentType: string,
): readonly ImplicitStateSource[] {
  return IMPLICIT_STATE_SOURCES[componentType] ?? [];
}

/** 관찰 이벤트 인자 → 저장 값 (타입별) */
export function normalizeImplicitStateValue(
  type: VariableDefType,
  raw: unknown,
): unknown {
  if (raw instanceof Set) return [...raw];
  if (type === "number") {
    if (Array.isArray(raw)) return typeof raw[0] === "number" ? raw[0] : 0;
    return typeof raw === "number" ? raw : Number(raw) || 0;
  }
  if (type === "boolean") return Boolean(raw);
  if (type === "string")
    return raw === null || raw === undefined ? "" : String(raw);
  return raw;
}

type Handler = (...args: unknown[]) => void;

/**
 * 같은 이벤트에 규칙 핸들러와 미러 핸들러가 둘 다 있으면 둘 다 부른다 (미러가 먼저 — 규칙이
 * 읽는 값이 최신이도록). 결과 객체는 새로 만든다 (동결된 빈 핸들러 맵과 충돌 0).
 */
export function composeEventHandlers(
  base: Readonly<Record<string, Handler>>,
  extra: Readonly<Record<string, Handler>>,
): Record<string, Handler> {
  const out: Record<string, Handler> = { ...base };
  for (const [event, handler] of Object.entries(extra)) {
    const existing = out[event];
    out[event] = existing
      ? (...args) => {
          handler(...args);
          existing(...args);
        }
      : handler;
  }
  return out;
}

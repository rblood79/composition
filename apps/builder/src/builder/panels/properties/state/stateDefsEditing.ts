/**
 * ADR-214 Phase 5 — 상태 정의 편집의 순수 규칙 (Properties 상태 절 · Navigator 페이지 설정이
 * 같은 함수를 쓴다): 자동 이름 · 기본값 입력 파싱 · 타입 변경 시 기본값 리셋.
 */
import type { VariableDef, VariableDefType } from "@composition/shared";

/** 사슬 안에서 겹치지 않는 자동 이름 — `state1`, `state2`, … */
export function nextAutoStateName(
  taken: ReadonlySet<string>,
  base = "state",
): string {
  let n = 1;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/** 타입별 기본값 (정의에 defaultValue 가 없을 때 런타임이 쓰는 값과 같다 — template.ts) */
export function emptyDefaultFor(type: VariableDefType): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "";
  }
}

/** 기본값 → 입력 문자열 */
export function formatDefaultInput(def: Pick<VariableDef, "type" | "defaultValue">): string {
  const value = def.defaultValue ?? emptyDefaultFor(def.type);
  if (def.type === "object" || def.type === "array") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return value === null || value === undefined ? "" : String(value);
}

/**
 * 입력 문자열 → 기본값. object/array 는 JSON — 파싱 실패면 `null` (호출자가 거부 문구를 띄운다).
 * number 는 숫자가 아니면 0 대신 `null` (조용한 0 치환 금지).
 */
export function parseDefaultInput(
  type: VariableDefType,
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  const text = raw.trim();
  switch (type) {
    case "string":
      return { ok: true, value: raw };
    case "number": {
      if (text === "") return { ok: true, value: 0 };
      const n = Number(text);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    case "boolean":
      return { ok: true, value: text === "true" };
    case "object":
    case "array": {
      if (text === "") return { ok: true, value: emptyDefaultFor(type) };
      try {
        const parsed: unknown = JSON.parse(text);
        const shapeOk =
          type === "array"
            ? Array.isArray(parsed)
            : typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
        return shapeOk ? { ok: true, value: parsed } : { ok: false };
      } catch {
        return { ok: false };
      }
    }
  }
}

/** 타입 변경 — 기본값은 새 타입의 빈 값으로 (런타임도 타입 변경 시 리셋 — runtimeState) */
export function withType(def: VariableDef, type: VariableDefType): VariableDef {
  if (def.type === type) return def;
  return { ...def, type, defaultValue: emptyDefaultFor(type) };
}

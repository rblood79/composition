/**
 * ADR-214 Phase 1 — Variables 소유자 모델 (builder · preview · publish 공용).
 *
 * **모델 하나** (HC1): `VariableDef` 는 소유자가 project / page / element 어느 쪽이든
 * 같은 형상이다. 읽기 문법 (`{{ name }}`) · 쓰기 액션 (`setState`) · 가시성 규칙
 * (소유자 서브트리) 도 소유자와 무관하게 같다.
 *
 * **저장 위치는 소유자별** (대안 B):
 * - project → builder `useDataStore.variables` (IndexedDB `variables`) — 기존 `Variable`
 *   에 `owner` additive (`apps/builder/src/types/builder/data.types.ts`)
 * - page    → canonical 페이지 노드 `state?: VariableDef[]` (페이지는 `metadata.type:"page"`
 *   FrameNode/RefNode 라 별도 페이지 객체가 없다 — 노드 필드 하나로 페이지·요소를 같이 덮는다)
 * - element → `CanonicalNode.state?: VariableDef[]`
 *
 * 환경값 · secret (`{{env.NAME}}`) 은 변수가 아니다 (HC7 — ADR-212 vault).
 */
import { z } from "zod";

/** 기존 `VariableType` (data.types.ts) 과 같은 5종 — 문서·envelope·op 가 한 enum 을 본다. */
export const VARIABLE_DEF_TYPES = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
] as const;

export type VariableDefType = (typeof VARIABLE_DEF_TYPES)[number];

export interface VariableDef {
  /** 안정 id — `setState.variableId` · 의존 인덱스 · 런타임 값 키가 참조한다 */
  id: string;
  /** 가시성 사슬 안 고유 (HC5 — shadowing 금지, 생성 시 거부) */
  name: string;
  type: VariableDefType;
  defaultValue?: unknown;
  /** project 소유자만 의미 (localStorage persist — Phase 2 `composition:runtime-state:v1:${projectId}`) */
  persist?: boolean;
}

export type VariableOwner =
  | { kind: "project" }
  | { kind: "page"; pageId: string }
  | { kind: "element"; elementId: string };

/**
 * HC3 — 기존 `scope:"component"` (및 `page` without `page_id`) 를 project 로 승격한 항목의
 * 표식. 조용한 변환 0 원칙: 인덱스 배지 · 로그가 이 값을 읽는다.
 */
export const OWNER_UNRESOLVED = "owner-unresolved" as const;
export type VariableMigrationStatus = typeof OWNER_UNRESOLVED;

const VariableDefTypeSchema = z.enum(VARIABLE_DEF_TYPES);

/** zod 정본 — export envelope (`CanonicalNodeSchema.state`) 와 `define_variable` op 가 공유 */
export const VariableDefSchema: z.ZodType<VariableDef> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: VariableDefTypeSchema,
  defaultValue: z.unknown().optional(),
  persist: z.boolean().optional(),
});

export const VariableOwnerSchema: z.ZodType<VariableOwner> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("project") }),
    z.object({ kind: z.literal("page"), pageId: z.string().min(1) }),
    z.object({ kind: z.literal("element"), elementId: z.string().min(1) }),
  ]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 런타임 가드 — 문서 로드 · 클립보드 역직렬화 · 패널 입력 경계에서 쓴다 (zod 없이 싸게) */
export function isVariableDef(value: unknown): value is VariableDef {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.type === "string" &&
    (VARIABLE_DEF_TYPES as readonly string[]).includes(value.type)
  );
}

export function isVariableDefList(value: unknown): value is VariableDef[] {
  return Array.isArray(value) && value.every(isVariableDef);
}

/** 소유자 → 안정 문자열 키 (Map 키 · 로그 · 인덱스 그룹) */
export function resolveVariableOwnerKey(owner: VariableOwner): string {
  switch (owner.kind) {
    case "project":
      return "project";
    case "page":
      return `page:${owner.pageId}`;
    case "element":
      return `element:${owner.elementId}`;
  }
}

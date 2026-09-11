/**
 * ADR-214 Phase 1 — 상태 템플릿 참조 스캐너 + 소비 정의 digest (R8 · HC4 · R5).
 *
 * Canvas 는 기본값 환경으로 `{{ name }}` 을 해석해 보여 준다 (Phase 3). 그러려면 **소비 중인
 * 정의** 의 `defaultValue` · `name` · `type` 변경이 scene signature 에 보여야 하고 (편집 뒤
 * 이전 문자열이 남지 않게), **미사용 정의** 편집은 보이지 않아야 한다 (sceneVersion +0).
 * 정의 자체를 signature 에 넣지 않고, 노드가 참조하는 이름을 가시성 사슬로 해석한 결과
 * (`StateDependency[]`) 만 scene node 에 실어 그 둘을 가른다 — 이것이 variableId 의존 인덱스의
 * 첫 형태이기도 하다 (R5: 변경 노드만 갱신).
 *
 * 토큰 규약 (Phase 3 `template.ts` 해석기와 공유):
 * - `{{ name }}` — 공백 허용, 이름은 식별자 (`[A-Za-z_$][\w$]*`)
 * - `{{ a.b.c }}` — 경로 접근, 변수 이름은 첫 세그먼트
 * - `\{{` — 리터럴 (참조 아님)
 * - `{{ env.X }}` — 환경값 (ADR-212 vault), 변수 아님 (HC7)
 * - ADR-159 `{field}` (단일 중괄호 · collection 행 문맥) 은 별개 문법 — 여기서 건드리지 않는다
 */
import type { VariableDefType } from "./variable.types";
import type { VisibleVariable } from "./visibility";

const TEMPLATE_REF_PATTERN =
  /(?<!\\)\{\{\s*([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*\s*\}\}/g;

/** 변수가 아닌 예약 루트 — `{{env.NAME}}` (ADR-212) */
const RESERVED_ROOTS: ReadonlySet<string> = new Set(["env"]);

/** 문자열 안 `{{ name }}` 참조 이름 (첫 세그먼트) — 중복 제거, 등장 순서 */
export function collectStateTemplateRefs(text: string): string[] {
  if (!text.includes("{{")) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(TEMPLATE_REF_PATTERN)) {
    const name = match[1];
    if (RESERVED_ROOTS.has(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

const MAX_SCAN_DEPTH = 6;

function scanValue(
  value: unknown,
  depth: number,
  seen: Set<string>,
  out: string[],
): void {
  if (typeof value === "string") {
    if (!value.includes("{{")) return;
    for (const name of collectStateTemplateRefs(value)) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return;
  }
  if (depth >= MAX_SCAN_DEPTH || value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanValue(item, depth + 1, seen, out);
    return;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    scanValue(entry, depth + 1, seen, out);
  }
}

/** 노드 props 의 string 값 (중첩 포함) 에서 참조 이름을 모은다 — string prop 한정 (R1) */
export function collectPropsStateRefs(
  props: Record<string, unknown> | undefined,
): string[] {
  if (!props) return [];
  const out: string[] = [];
  scanValue(props, 0, new Set(), out);
  return out;
}

/**
 * scene node 에 실리는 소비 정의 digest 항목. `id: null` 은 미해결 (정의가 아직 없음) —
 * 나중에 같은 이름이 정의되면 digest 가 바뀌어 Canvas 가 다시 그린다.
 */
export interface StateDependency {
  name: string;
  id: string | null;
  type: VariableDefType | null;
  defaultValue: unknown;
}

/**
 * 참조 이름 → 가시 목록 (가까운 소유자가 앞) 으로 해석. 참조가 없으면 `undefined`
 * (scene node 필드 생략 — 비소비 노드 signature 무변경).
 */
export function resolveStateDependencies(
  refs: readonly string[],
  visible: readonly VisibleVariable[],
): StateDependency[] | undefined {
  if (refs.length === 0) return undefined;
  return refs.map((name) => {
    const found = visible.find((entry) => entry.def.name === name);
    return found
      ? {
          name,
          id: found.def.id,
          type: found.def.type,
          defaultValue: found.def.defaultValue,
        }
      : { name, id: null, type: null, defaultValue: undefined };
  });
}

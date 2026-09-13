/**
 * ADR-214 Phase 3 — `{{ name }}` 상태 템플릿 해석기 (builder Canvas · preview · publish 공용).
 *
 * 문법 (`stateDependencies.ts` 의 참조 스캐너와 같은 토큰 규약):
 * - `{{ name }}` — 공백 허용, 이름은 식별자. `{{ a.b.c }}` 경로 접근 (변수 이름은 첫 세그먼트)
 * - `\{{` — 리터럴 `{{` (참조 아님, R1 — 코드 예시 텍스트)
 * - `{{ env.X }}` — 환경값 (ADR-212 vault) 은 변수가 아니라 **원문 유지** (HC7)
 * - 미해결 이름 (가시성 사슬에 정의 없음) 은 **원문 유지** — 빈 문자열 금지 (R1). 오타를 화면에서
 *   보게 하고, 나중에 같은 이름이 정의되면 그때 값이 들어간다
 * - ADR-159 `{field}` (단일 중괄호 · collection 행 문맥) 은 별개 문법 — 이 해석기는 건드리지 않는다.
 *   한 문자열에 둘이 있으면 노드 prop 단계에서 `{{ }}` 가 먼저 값으로 바뀌고, 행 투영 단계의
 *   `{field}` 보간이 그 결과를 받는다 (`{field}` 토큰은 그대로 통과한다 — unit 고정)
 *
 * 값 형식 함수 하나 (`formatStateValue`) — 캔버스 (기본값 env) 와 preview/publish (런타임 env) 가
 * 같은 문자열을 만든다 (R2 설계된 비대칭은 **값** 만 다르고 형식은 같다).
 *
 * 적용 범위: **string prop 만** (R1). `resolveStateTemplateProps` 가 props 객체의 문자열을
 * 중첩 포함 (깊이 6 — 스캐너와 같은 상한) 치환하고, 바뀐 것이 없으면 같은 참조를 돌려준다.
 */

const TEMPLATE_TOKEN_PATTERN =
  /\\\{\{|\{\{\s*([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)\s*\}\}/g;

/** 변수가 아닌 예약 루트 — `{{env.NAME}}` (ADR-212) */
const RESERVED_ROOTS: ReadonlySet<string> = new Set(["env"]);

const MAX_DEPTH = 6;

export interface StateTemplateEnv {
  /** 이름 → 값. 정의가 없으면 `undefined` (원문 유지) */
  get(name: string): unknown;
}

/** 상태 값 → 표시 문자열 (Canvas · DOM 공용 형식 함수) */
export function formatStateValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return String(value);
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function readPath(root: unknown, path: string): unknown {
  if (path === "") return root;
  let current = root;
  for (const segment of path.slice(1).split(".")) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    )
      return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 문자열 안 `{{ }}` 를 env 값으로 치환. 참조가 없으면 같은 문자열 (참조 동일) */
export function resolveStateTemplate(
  value: string,
  env: StateTemplateEnv,
): string {
  if (!value.includes("{{")) return value;
  let changed = false;
  const out = value.replace(
    TEMPLATE_TOKEN_PATTERN,
    (whole: string, name: string | undefined, path: string | undefined) => {
      if (whole === "\\{{") {
        changed = true;
        return "{{";
      }
      if (!name || RESERVED_ROOTS.has(name)) return whole;
      const root = env.get(name);
      if (root === undefined) return whole;
      const resolved = readPath(root, path ?? "");
      changed = true;
      return formatStateValue(resolved);
    },
  );
  return changed ? out : value;
}

function resolveValue(
  value: unknown,
  env: StateTemplateEnv,
  depth: number,
): unknown {
  if (typeof value === "string") return resolveStateTemplate(value, env);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object")
    return value;
  if (Array.isArray(value)) {
    let next: unknown[] | null = null;
    value.forEach((item, index) => {
      const resolved = resolveValue(item, env, depth + 1);
      if (resolved !== item) {
        if (!next) next = [...value];
        next[index] = resolved;
      }
    });
    return next ?? value;
  }
  let nextRecord: Record<string, unknown> | null = null;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const resolved = resolveValue(item, env, depth + 1);
    if (resolved !== item) {
      if (!nextRecord) nextRecord = { ...(value as Record<string, unknown>) };
      nextRecord[key] = resolved;
    }
  }
  return nextRecord ?? value;
}

/**
 * props 의 문자열 (중첩 포함) 에서 `{{ }}` 를 해석한다. 바뀐 것이 없으면 **같은 참조** —
 * 하위 `===` 비교 (scene signature · React memo) 가 종전대로 동작한다.
 */
export function resolveStateTemplateProps<T extends Record<string, unknown>>(
  props: T,
  env: StateTemplateEnv,
): T {
  return resolveValue(props, env, 0) as T;
}

/** 정의 목록 (기본값) 만으로 만든 env — Canvas (Skia) 가 쓰는 기본값 환경 */
export function createDefaultValueEnv(
  visible: ReadonlyArray<{
    def: { name: string; defaultValue?: unknown; type: string };
  }>,
): StateTemplateEnv {
  const byName = new Map<string, unknown>();
  for (const entry of visible) {
    if (byName.has(entry.def.name)) continue; // 가까운 소유자가 앞 (가시성 순서)
    byName.set(entry.def.name, defaultValueOf(entry.def));
  }
  return { get: (name) => byName.get(name) };
}

function defaultValueOf(def: {
  defaultValue?: unknown;
  type: string;
}): unknown {
  if (def.defaultValue !== undefined) return def.defaultValue;
  switch (def.type) {
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

const MAX_SYNTAX_SCAN_DEPTH = 6;

/**
 * props 어딘가의 문자열에 `{{` 가 있는가 — 참조 스캐너는 `\{{` 리터럴을 참조로 세지 않으므로
 * (unescape 만 필요한 노드) 해석기 실행 여부는 이 검사로 판정한다.
 */
export function hasStateTemplateSyntax(
  value: unknown,
  depth = 0,
): boolean {
  if (typeof value === "string") return value.includes("{{");
  if (depth >= MAX_SYNTAX_SCAN_DEPTH || value === null || typeof value !== "object")
    return false;
  if (Array.isArray(value))
    return value.some((item) => hasStateTemplateSyntax(item, depth + 1));
  return Object.values(value as Record<string, unknown>).some((item) =>
    hasStateTemplateSyntax(item, depth + 1),
  );
}

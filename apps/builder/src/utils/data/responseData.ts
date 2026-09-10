/**
 * API 응답에서 행 배열을 꺼내는 순수 함수.
 *
 * Why (2026-09-11, 리서치 D1): 종전에는 새 엔드포인트가 `dataPath: "data"` 로 만들어지고
 * 실행기가 그 경로를 그대로 축소해 반환했다. jsonplaceholder 처럼 최상위가 배열인 응답은
 * `undefined` 가 되어 "Success" 인데 본문이 비고 컬럼 감지도 되지 않았다.
 *
 * 규칙: 빈 경로 = 응답 전체. 경로가 있으면 그 경로. 그 결과가 배열이 아니면
 * (a) 응답 자체가 배열이면 응답, (b) 객체면 관례 키 (results · data · items …) 중
 * 첫 번째 배열 — 감지된 경로를 같이 돌려 호출자가 dataPath 를 채울 수 있게 한다.
 */

export const COMMON_ARRAY_FIELDS = [
  "results",
  "data",
  "items",
  "records",
  "list",
  "rows",
  "entries",
] as const;

export interface ResolvedResponseData {
  /** 행 배열이면 배열, 아니면 축소 결과 그대로 (객체 응답 등) */
  data: unknown;
  /** 실제로 행을 찾은 경로 ("" = 응답 전체). 못 찾았으면 요청한 경로 */
  resolvedPath: string;
  /** 요청한 경로와 다른 경로에서 행을 찾았는지 */
  autoDetected: boolean;
}

export function readPath(source: unknown, path: string): unknown {
  if (!path) return source;
  return path.split(".").reduce<unknown>((obj, key) => {
    if (obj === null || typeof obj !== "object") return undefined;
    return (obj as Record<string, unknown>)[key];
  }, source);
}

function findArrayField(source: unknown): string | null {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }
  for (const field of COMMON_ARRAY_FIELDS) {
    const value = (source as Record<string, unknown>)[field];
    if (Array.isArray(value) && value.length > 0) return field;
  }
  return null;
}

export function resolveResponseData(
  result: unknown,
  dataPath: string | undefined,
): ResolvedResponseData {
  const path = dataPath?.trim() ?? "";
  const direct = readPath(result, path);
  if (Array.isArray(direct)) {
    return { data: direct, resolvedPath: path, autoDetected: false };
  }
  if (Array.isArray(result)) {
    return { data: result, resolvedPath: "", autoDetected: path !== "" };
  }
  const field = findArrayField(result);
  if (field) {
    return {
      data: (result as Record<string, unknown>)[field],
      resolvedPath: field,
      autoDetected: field !== path,
    };
  }
  return { data: direct, resolvedPath: path, autoDetected: false };
}

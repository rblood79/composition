/**
 * 응답 스키마 추천 — ADR-212 Phase 4 P7.
 *
 * `resolveResponseData` 는 관례 키에서 배열 하나를 찾지만, 응답 안에 배열 후보가 여럿일 수 있다
 * (`data.items` vs `data.related` 등). 여기서는 JSON 을 전수 탐색해 배열 후보를 모아 추천한다 —
 * 행 수 내림차순, 같으면 객체 배열 우선. 호출자는 고른 경로의 행을 `detectColumns` 로 넘긴다.
 * 순수 함수.
 */
export interface ArrayPathCandidate {
  /** dot 경로 ("" = 응답 전체) */
  path: string;
  count: number;
  /** 첫 객체 행의 키 (원시 배열이면 빈 배열) */
  keys: string[];
}

const MAX_DEPTH = 5;

function keysOf(arr: unknown[]): string[] {
  const first = arr.find(
    (v) => v && typeof v === "object" && !Array.isArray(v),
  );
  return first ? Object.keys(first as Record<string, unknown>) : [];
}

export function recommendArrayPaths(json: unknown): ArrayPathCandidate[] {
  const out: ArrayPathCandidate[] = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      out.push({ path, count: value.length, keys: keysOf(value) });
      return; // 배열 안의 배열은 파고들지 않는다 (행 안 필드는 columnDetector 몫)
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      )) {
        visit(child, path ? `${path}.${key}` : key, depth + 1);
      }
    }
  };
  visit(json, "", 0);
  return out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const objA = a.keys.length > 0 ? 1 : 0;
    const objB = b.keys.length > 0 ? 1 : 0;
    return objB - objA;
  });
}

/**
 * API URL → baseUrl · path · 표시 이름.
 *
 * Why (2026-09-11, 리서치 U2 · UI-4): 목록의 `window.prompt` 가 URL 한 줄을 받아 그 자리에서
 * 갈랐다. 생성 패널로 옮기면서 순수 함수로 뺀다. 이름은 host 의 두 번째 레벨 라벨과
 * path 의 마지막 세그먼트 (`typicode · users`) — 사용자가 고칠 수 있는 기본값이다.
 */
export interface SplitApiUrl {
  baseUrl: string;
  path: string;
  /** URL 이 파싱되지 않아 전체를 path 로 넣었는지 */
  fallback: boolean;
}

export function splitApiUrl(input: string): SplitApiUrl {
  const url = input.trim();
  try {
    const parsed = new URL(url);
    return {
      baseUrl: `${parsed.protocol}//${parsed.host}`,
      path: `${parsed.pathname || "/"}${parsed.search}`,
      fallback: false,
    };
  } catch {
    return {
      baseUrl: "https://api.example.com",
      path: url.startsWith("/") ? url : `/${url}`,
      fallback: true,
    };
  }
}

export function suggestApiName(input: string): string {
  const url = input.trim();
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split(".").filter(Boolean);
    const host =
      hostParts.length >= 2 ? hostParts[hostParts.length - 2] : parsed.hostname;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? `${host} · ${last}` : host;
  } catch {
    return url;
  }
}

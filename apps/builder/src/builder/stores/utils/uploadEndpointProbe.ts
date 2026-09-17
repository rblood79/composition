/**
 * ADR-201 후속 — API 편집기의 자동 Send (GET 프로브) 가 TUS 업로드 endpoint 를 두드리면 서버는
 * `405` (tusd · 참조 서버) 또는 `412` (Tus-Resumable 헤더 요구) 로 답하고, 두 경우 모두
 * `Tus-Resumable` 응답 헤더를 단다 (서버 계약 §3). 이것은 오류가 아니라 "데이터 endpoint 가
 * 아니다" 라는 신호다 — 실행기는 console.error 대신 info 로 남기고 편집기 Response 탭은
 * 업로드 endpoint 안내를 그린다.
 */
export interface ProbeResponse {
  status: number;
  headers: Record<string, string>;
}

const TUS_PROBE_STATUSES = new Set([405, 412]);

export function tusResumableVersion(
  headers: Record<string, string>,
): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "tus-resumable") return value;
  }
  return null;
}

export function isUploadEndpointProbe(
  response: ProbeResponse | null | undefined,
): boolean {
  if (!response) return false;
  return (
    TUS_PROBE_STATUSES.has(response.status) &&
    tusResumableVersion(response.headers) !== null
  );
}

/**
 * Auth 프리셋 ↔ 헤더·쿼리 항목 — ADR-212 Phase 4 P4.
 *
 * 프리셋 (None / Bearer / API Key(header|query) / Basic) 을 요청 헤더·쿼리 항목으로 펼친다.
 * 값은 항상 vault 참조 `{{secret.NAME}}` — 문서·export·AI payload 에 원문 secret 이 실리지
 * 않는다 (HC6, 공유 redactor 의 placeholder 문법과 같다). 기존 항목에서 프리셋을 역판정한다.
 * 순수 함수 — 실제 secret 값은 vault (별도 저장) 가 갖는다.
 */
export type AuthPreset =
  | { type: "none" }
  | { type: "bearer"; secretName: string }
  | { type: "basic"; secretName: string }
  | {
      type: "apiKey";
      in: "header" | "query";
      name: string;
      secretName: string;
    };

export interface ApiHeaderEntry {
  key: string;
  value: string;
  enabled: boolean;
}
export interface ApiQueryEntry {
  key: string;
  value: string;
  type: "string" | "number" | "boolean";
  required: boolean;
}

const PLACEHOLDER = (name: string) => `{{secret.${name}}}`;

export function authToEntries(auth: AuthPreset): {
  headers: ApiHeaderEntry[];
  queryParams: ApiQueryEntry[];
} {
  switch (auth.type) {
    case "none":
      return { headers: [], queryParams: [] };
    case "bearer":
      return {
        headers: [
          {
            key: "Authorization",
            value: `Bearer ${PLACEHOLDER(auth.secretName)}`,
            enabled: true,
          },
        ],
        queryParams: [],
      };
    case "basic":
      return {
        headers: [
          {
            key: "Authorization",
            value: `Basic ${PLACEHOLDER(auth.secretName)}`,
            enabled: true,
          },
        ],
        queryParams: [],
      };
    case "apiKey":
      return auth.in === "header"
        ? {
            headers: [
              {
                key: auth.name,
                value: PLACEHOLDER(auth.secretName),
                enabled: true,
              },
            ],
            queryParams: [],
          }
        : {
            headers: [],
            queryParams: [
              {
                key: auth.name,
                value: PLACEHOLDER(auth.secretName),
                type: "string",
                required: true,
              },
            ],
          };
  }
}

const AUTH_HEADER = "authorization";
const API_KEY_HEADERS = new Set([
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
]);
const API_KEY_QUERIES = new Set([
  "api_key",
  "apikey",
  "api-key",
  "key",
  "token",
  "access_token",
]);

export function detectAuthPreset(
  headers: readonly ApiHeaderEntry[],
  queryParams: readonly ApiQueryEntry[],
): AuthPreset {
  for (const h of headers) {
    const key = h.key.trim().toLowerCase();
    if (key === AUTH_HEADER) {
      if (/^\s*basic\s+/i.test(h.value))
        return { type: "basic", secretName: "" };
      return { type: "bearer", secretName: "" };
    }
    if (API_KEY_HEADERS.has(key))
      return { type: "apiKey", in: "header", name: h.key, secretName: "" };
  }
  for (const q of queryParams) {
    if (API_KEY_QUERIES.has(q.key.trim().toLowerCase()))
      return { type: "apiKey", in: "query", name: q.key, secretName: "" };
  }
  return { type: "none" };
}

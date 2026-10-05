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

/** The vault name in a `{{secret.NAME}}` reference ("" when the value holds none). */
const secretNameIn = (value: string) =>
  /\{\{secret\.([^}]+)\}\}/.exec(value)?.[1] ?? "";
/** A value that is only a vault reference — what an API Key preset writes. */
const isSecretRef = (value: string) =>
  /^\s*\{\{secret\.[^}]+\}\}\s*$/.test(value);

export function detectAuthPreset(
  headers: readonly ApiHeaderEntry[],
  queryParams: readonly ApiQueryEntry[],
): AuthPreset {
  for (const h of headers) {
    if (h.key.trim().toLowerCase() !== AUTH_HEADER) continue;
    const secretName = secretNameIn(h.value);
    return /^\s*basic\s+/i.test(h.value)
      ? { type: "basic", secretName }
      : { type: "bearer", secretName };
  }
  // An API Key header / query: a vault reference under any name (the user names the key), else a
  // well-known key name.
  const header =
    headers.find((h) => isSecretRef(h.value)) ??
    headers.find((h) => API_KEY_HEADERS.has(h.key.trim().toLowerCase()));
  if (header)
    return {
      type: "apiKey",
      in: "header",
      name: header.key,
      secretName: secretNameIn(header.value),
    };
  const query =
    queryParams.find((q) => isSecretRef(q.value)) ??
    queryParams.find((q) => API_KEY_QUERIES.has(q.key.trim().toLowerCase()));
  if (query)
    return {
      type: "apiKey",
      in: "query",
      name: query.key,
      secretName: secretNameIn(query.value),
    };
  return { type: "none" };
}

/**
 * The request's headers and query with `auth` applied: the current preset's entries (the
 * Authorization header, the detected API Key entry — a user-named key too) give way to the new
 * ones; every other entry stays.
 */
export function withAuthPreset(
  headers: readonly ApiHeaderEntry[],
  queryParams: readonly ApiQueryEntry[],
  auth: AuthPreset,
): { headers: ApiHeaderEntry[]; queryParams: ApiQueryEntry[] } {
  const current = detectAuthPreset(headers, queryParams);
  const owned = (key: string, where: "header" | "query") => {
    const lower = key.trim().toLowerCase();
    if (where === "header" && lower === AUTH_HEADER) return true;
    if (
      current.type === "apiKey" &&
      current.in === where &&
      current.name.trim().toLowerCase() === lower
    )
      return true;
    return where === "header"
      ? API_KEY_HEADERS.has(lower)
      : API_KEY_QUERIES.has(lower);
  };
  const entries = authToEntries(auth);
  return {
    headers: [
      ...headers.filter((h) => !owned(h.key, "header")),
      ...entries.headers,
    ],
    queryParams: [
      ...queryParams.filter((q) => !owned(q.key, "query")),
      ...entries.queryParams,
    ],
  };
}

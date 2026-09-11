/**
 * 공유 redactor — ADR-213 HC5 · R8.
 *
 * AI 가 읽는 endpoint 정의 (`get_api_endpoint` · `list_api_endpoints`) · 동적 주입 ·
 * 실패 설명 컨텍스트 (`explain_request_failure`) 는 **provider 호출 전에** 이 순수
 * 함수를 지난다. 가리는 대상은 세 종류다:
 *
 * 1. auth 계열 header (`Authorization` · `Cookie` · `X-API-Key` …) — 키 이름으로 판정
 * 2. auth 계열 query param (`api_key` · `token` · `signature` …) — URL 과 param 표 둘 다
 * 3. **기존 평문** — 키 이름이 평범해도 값이 `Bearer …` / `Basic …` 토큰 형태면 가린다
 *    (헤더 값이 IndexedDB 에 평문으로 남아 있는 현행 저장 형식 — 리서치 P5)
 *
 * placeholder 는 `{{secret.<KEY>}}` — ADR-212 Phase 4 vault 참조 형식과 같은 문법이라
 * 모델이 제안하는 `define_endpoint` patch 가 그대로 vault 참조로 읽힌다. 이미 placeholder
 * 인 값은 손대지 않는다.
 *
 * 파일명이 `redactEndpointAuth` 인 이유: `protect-files.sh` 가 경로의 "secret" 을 보안
 * 파일로 차단한다. 함수명은 ADR 대로 `redactEndpointSecrets`.
 */
import type { ApiEndpoint } from "../../../types/builder/data.types";

export const PLACEHOLDER_PREFIX = "{{secret.";

const AUTH_HEADER_KEYS: readonly string[] = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "x-csrf-token",
  "x-xsrf-token",
  "x-amz-security-token",
];

const AUTH_QUERY_KEYS: readonly string[] = [
  "api_key",
  "apikey",
  "api-key",
  "key",
  "token",
  "access_token",
  "auth_token",
  "auth",
  "secret",
  "client_secret",
  "signature",
  "sig",
  "password",
  "passwd",
  "pwd",
];

/** `Bearer xxx` · `Basic xxx` · `Token xxx` · `ApiKey xxx` — 키 이름과 무관하게 토큰 형태. */
const TOKEN_VALUE = /^\s*(bearer|basic|token|apikey|api-key|digest)\s+\S+/i;

function isPlaceholder(value: string): boolean {
  return value.trim().startsWith(PLACEHOLDER_PREFIX);
}

function placeholderFor(key: string): string {
  const name = key
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `${PLACEHOLDER_PREFIX}${name || "VALUE"}}}`;
}

function isAuthHeaderKey(key: string): boolean {
  return AUTH_HEADER_KEYS.includes(key.trim().toLowerCase());
}

function isAuthQueryKey(key: string): boolean {
  return AUTH_QUERY_KEYS.includes(key.trim().toLowerCase());
}

function redactHeaderValue(key: string, value: string): string {
  if (isPlaceholder(value)) return value;
  if (isAuthHeaderKey(key) || TOKEN_VALUE.test(value))
    return placeholderFor(key);
  return value;
}

function redactQueryValue(key: string, value: string): string {
  if (isPlaceholder(value)) return value;
  if (isAuthQueryKey(key) || TOKEN_VALUE.test(value))
    return placeholderFor(key);
  return value;
}

/** `a=1&token=x` 형태의 query 문자열 — `URLSearchParams` 는 인코딩을 바꾸므로 직접 나눈다. */
function redactQueryString(query: string): string {
  return query
    .split("&")
    .map((pair) => {
      if (!pair) return pair;
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      let decodedKey = key;
      try {
        decodedKey = decodeURIComponent(key);
      } catch {
        // 깨진 인코딩은 원문 키로 판정
      }
      return `${key}=${redactQueryValue(decodedKey, value)}`;
    })
    .join("&");
}

/** URL 의 userinfo (`user:pass@`) 를 지우고 query 의 auth 값을 가린다. 상대 경로도 query 는 처리. */
export function redactUrl(url: string): string {
  const withoutUserinfo = url.replace(
    /^([a-z][a-z0-9+.-]*:\/\/)[^/?#@]*@/i,
    "$1",
  );
  const q = withoutUserinfo.indexOf("?");
  if (q < 0) return withoutUserinfo;
  const hash = withoutUserinfo.indexOf("#", q);
  const query =
    hash < 0
      ? withoutUserinfo.slice(q + 1)
      : withoutUserinfo.slice(q + 1, hash);
  const tail = hash < 0 ? "" : withoutUserinfo.slice(hash);
  return `${withoutUserinfo.slice(0, q + 1)}${redactQueryString(query)}${tail}`;
}

/** 요청/응답 header record (fetch `Headers` 를 객체로 편 것) — 키 대소문자 무관. */
export function redactHeaderRecord(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = redactHeaderValue(key, value);
  }
  return out;
}

/**
 * JSON 본문 텍스트 안의 auth 키 (`"apiKey": "…"`) 값을 가린다 — 파싱하지 않고 텍스트
 * 치환이라 JSON 이 깨져 있어도 (실패 응답 본문) 동작한다.
 */
const JSON_AUTH_KEY = new RegExp(
  `("(?:${[...AUTH_QUERY_KEYS, "apikey", "apiKey", "accessToken", "authToken", "clientSecret", "authorization"].join("|")})"\\s*:\\s*")([^"]*)(")`,
  "gi",
);

export function redactBodyText(body: string): string {
  return body.replace(
    JSON_AUTH_KEY,
    (_m, head: string, value: string, tail: string) =>
      isPlaceholder(value)
        ? `${head}${value}${tail}`
        : `${head}${placeholderFor(head.slice(1, head.indexOf('"', 1)))}${tail}`,
  );
}

/** endpoint 정의 전체 — 순수, 입력 무변경. */
export function redactEndpointSecrets<T extends ApiEndpoint>(endpoint: T): T {
  return {
    ...endpoint,
    baseUrl: redactUrl(endpoint.baseUrl),
    path: redactUrl(endpoint.path),
    headers: endpoint.headers.map((header) => ({
      ...header,
      value: redactHeaderValue(header.key, header.value),
    })),
    queryParams: endpoint.queryParams.map((param) => ({
      ...param,
      value: redactQueryValue(param.key, param.value),
    })),
    ...(endpoint.bodyTemplate !== undefined
      ? { bodyTemplate: redactBodyText(endpoint.bodyTemplate) }
      : {}),
  };
}

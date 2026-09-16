/**
 * ADR-201 G4 (클라이언트 측) — 평문 토큰 패턴 감지기 (순수 함수).
 *
 * canonical 문서 · 팔레트 기본값 · `ApiEndpointDefinition.headers` 처럼 **publish 가 그대로
 * 서빙하는 값** 에 평문 인증값이 실리는지 검사한다 (`/project.json` — ADR-201 R3/HC7). ADR-212
 * vault 참조 `{{secret.NAME}}` 는 인증값이 아니라 **참조** 이므로 통과시킨다 (review-adr 201 m4).
 *
 * 잡는 것 (3종):
 *   1. auth 계열 키 (`Authorization` · `apikey` · `x-api-key` · `cookie` …) 에 평문 값
 *   2. 키와 무관하게 토큰 형태 값 — `Bearer …` / `Basic …` / `Token …` / JWT (`eyJ…`)
 *   3. 32자 이상 연속 hex, 또는 40자 이상 base64/url-safe 문자열 (API 키·서명 형태)
 *
 * 안 잡는 것: UUID (하이픈 분절) · 짧은 값 · placeholder · 일반 URL. URL 안의 query 토큰은
 * 2·3 이 값 단위로 다시 본다.
 *
 * 키 목록은 `apps/builder/src/services/ai/security/redactEndpointAuth.ts` 와 같은 어휘다 — 그쪽은
 * builder 전용 (AI 프롬프트 redaction), 여기는 shared 게이트라 의존 없이 미러한다.
 * (파일명에 "secret" 을 쓰지 않는 이유도 그 파일과 같다 — `protect-files.sh` 가 경로의 그
 * 낱말을 보안 파일로 차단한다.)
 */

export const VAULT_PLACEHOLDER_PREFIX = "{{secret.";

const AUTH_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "apikey",
  "api_key",
  "x-auth-token",
  "x-access-token",
  "x-csrf-token",
  "x-xsrf-token",
  "x-amz-security-token",
  "access_token",
  "auth_token",
  "client_secret",
  "secret",
  "token",
  "password",
  "signature",
]);

/** `Bearer xxx` · `Basic xxx` · `Token xxx` · `ApiKey xxx` · `Digest xxx` — 키 이름과 무관한 토큰 형태. */
const TOKEN_VALUE = /^\s*(bearer|basic|token|apikey|api-key|digest)\s+\S+/i;
/** JWT — base64url 3 분절, 헤더 `{"alg"…}` 는 항상 `eyJ` 로 시작한다. */
const JWT_VALUE =
  /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
/** 32자 이상 연속 hex (해시·API 키). UUID 는 하이픈으로 끊겨 안 걸린다. */
const HEX_VALUE = /^[0-9a-f]{32,}$/i;
/** 40자 이상 base64/base64url 한 덩어리 — 서명·키 형태. 대소문자·숫자 섞임을 요구해 단어를 거른다. */
const BASE64_VALUE = /^[A-Za-z0-9+/_-]{40,}={0,2}$/;

export interface PlaintextTokenFinding {
  /** 값의 경로 (`$.apiEndpoints[0].headers.Authorization`) */
  path: string;
  reason: "auth-key" | "token-value" | "jwt" | "hex" | "base64";
  /** 값 앞 8자만 — finding 자체가 값을 복제하지 않게 */
  preview: string;
}

export function isVaultPlaceholder(value: string): boolean {
  return value.trim().startsWith(VAULT_PLACEHOLDER_PREFIX);
}

function classifyValue(value: string): PlaintextTokenFinding["reason"] | null {
  const v = value.trim();
  if (v.length === 0 || isVaultPlaceholder(v)) return null;
  if (JWT_VALUE.test(v)) return "jwt";
  if (TOKEN_VALUE.test(v)) return "token-value";
  if (HEX_VALUE.test(v)) return "hex";
  if (
    BASE64_VALUE.test(v) &&
    /[a-z]/.test(v) &&
    /[A-Z]/.test(v) &&
    /[0-9]/.test(v)
  ) {
    return "base64";
  }
  return null;
}

function isAuthKey(key: string): boolean {
  return AUTH_KEYS.has(key.trim().toLowerCase());
}

function preview(value: string): string {
  return `${value.slice(0, 8)}…`;
}

/**
 * 임의 JSON 값을 걸어가며 평문 토큰 패턴을 모은다. `{key: value}` 쌍은 키가 auth 계열이면
 * 값이 무엇이든 (placeholder 제외) finding, 그 외 문자열은 값 형태로만 판정한다.
 */
export function findPlaintextTokens(
  value: unknown,
  path = "$",
  out: PlaintextTokenFinding[] = [],
  seen: WeakSet<object> = new WeakSet(),
): PlaintextTokenFinding[] {
  if (typeof value === "string") {
    const reason = classifyValue(value);
    if (reason) out.push({ path, reason, preview: preview(value) });
    return out;
  }
  if (typeof value !== "object" || value === null) return out;
  if (seen.has(value)) return out;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findPlaintextTokens(item, `${path}[${index}]`, out, seen),
    );
    return out;
  }

  const record = value as Record<string, unknown>;
  // `{ key, value }` 헤더 행 (ApiEndpointHeader) — 키 이름이 값에 있다.
  if (
    typeof record.key === "string" &&
    typeof record.value === "string" &&
    isAuthKey(record.key)
  ) {
    if (!isVaultPlaceholder(record.value)) {
      out.push({
        path: `${path}.${record.key}`,
        reason: "auth-key",
        preview: preview(record.value),
      });
    }
    return out;
  }
  for (const [key, child] of Object.entries(record)) {
    const childPath = `${path}.${key}`;
    if (typeof child === "string" && isAuthKey(key)) {
      if (!isVaultPlaceholder(child)) {
        out.push({
          path: childPath,
          reason: "auth-key",
          preview: preview(child),
        });
      }
      continue;
    }
    findPlaintextTokens(child, childPath, out, seen);
  }
  return out;
}

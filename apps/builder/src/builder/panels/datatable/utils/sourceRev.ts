/**
 * ADR-218 — collection runtimeData 캐시 유효성 지문 (`sourceRev`).
 *
 * 저장된 캐시(`collection_runtime`)가 **지금의 요청 정의로 재현 가능한 응답인가**를
 * 판정하는 결정적 문자열. hydration 시 저장 지문과 현재 지문이 다르면 캐시를 폐기한다
 * (오프라인이라 재실행 못 해도 옛 인증/옛 소스의 응답을 유효한 것처럼 복원하지 않는다).
 *
 * 담는 것 (h1/HC4):
 * - `baseUrl` · `path` · `method`
 * - query · header 의 enabled·정규화 key·**비민감 값** (Accept-Language·X-Tenant 등 —
 *   요청 결과를 바꾸므로. 실제 소비 `dataActions.ts:625-635`)
 * - body(bodyType·bodyTemplate) · `responseMapping.dataPath`
 * - schema 는 **field.id + type** (key 아님) — key rename 은 값 보존 변환이라 지문이
 *   갈리지 않고, 필드 추가/삭제·타입 변경만 갈린다.
 *
 * 담지 않는 것 (HC6):
 * - secret **원문**. `{{secret.NAME}}` 참조는 `secret:NAME@<vault revision>` 으로만
 *   치환한다 — 같은 이름의 값이 바뀌면(vault revision bump) 지문이 갈리되 원문은 절대
 *   지문에 실리지 않는다. URL/query/body/header 어디의 참조든 동일.
 */
import type {
  ApiEndpointDefinition,
  ApiEndpointHeader,
  SchemaField,
} from "@composition/shared";

const SECRET_REF = /\{\{secret\.([A-Za-z0-9_]+)\}\}/g;

/** secret 참조를 `secret:NAME@rev` 로 치환 (원문 미포함). 미등록 참조는 rev 0. */
function maskSecretRefs(
  text: string,
  secretRevisions: ReadonlyMap<string, number>,
): string {
  if (typeof text !== "string" || !text.includes("{{secret.")) return text;
  return text.replace(SECRET_REF, (_whole, name: string) => {
    const rev = secretRevisions.get(name) ?? 0;
    return `secret:${name}@${rev}`;
  });
}

/** headers 를 [key, value, enabled] 정규화 배열로 (array·record 두 형태 모두). */
function normalizeHeaders(
  headers: ApiEndpointDefinition["headers"],
  secretRevisions: ReadonlyMap<string, number>,
): Array<[string, string, boolean]> {
  if (!headers) return [];
  const rows: Array<[string, string, boolean]> = Array.isArray(headers)
    ? (headers as ApiEndpointHeader[]).map((h) => [
        h.key,
        maskSecretRefs(h.value ?? "", secretRevisions),
        h.enabled !== false,
      ])
    : Object.entries(headers).map(([k, v]) => [
        k,
        maskSecretRefs(String(v ?? ""), secretRevisions),
        true,
      ]);
  return rows
    .filter(([key, , enabled]) => enabled && key.trim() !== "")
    .map(([key, value, enabled]): [string, string, boolean] => [
      key.trim(),
      value,
      enabled,
    ])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** queryParams 를 [key, value] 정규화 배열로. */
function normalizeQuery(
  query: ApiEndpointDefinition["queryParams"],
  secretRevisions: ReadonlyMap<string, number>,
): Array<[string, string]> {
  if (!query) return [];
  return query
    .filter((q) => q.key.trim() !== "")
    .map(
      (q) =>
        [q.key.trim(), maskSecretRefs(q.value ?? "", secretRevisions)] as [
          string,
          string,
        ],
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** schema 를 [id, type] 정규화 배열로 (rename 안정 — key 미포함). */
function normalizeSchema(
  schema: readonly SchemaField[] | undefined,
): Array<[string, string]> {
  if (!schema) return [];
  return schema
    .map(
      (f) =>
        [String((f as { id?: string }).id ?? f.key ?? ""), f.type ?? ""] as [
          string,
          string,
        ],
    )
    .filter(([id]) => id !== "")
    .sort((a, b) => a[0].localeCompare(b[0]));
}

export interface SourceRevInput {
  endpoint: Pick<
    ApiEndpointDefinition,
    | "baseUrl"
    | "path"
    | "method"
    | "headers"
    | "queryParams"
    | "bodyType"
    | "bodyTemplate"
    | "responseMapping"
  >;
  schema?: readonly SchemaField[];
  /** name → vault revision. 값은 담지 않는다 (HC6). */
  secretRevisions: ReadonlyMap<string, number>;
}

/**
 * 결정적 지문 문자열. 같은 입력 → 같은 문자열, 순서·형태 차이에 안정.
 * secret 은 이름+revision 만, 원문 0.
 */
export function computeSourceRev(input: SourceRevInput): string {
  const { endpoint, schema, secretRevisions } = input;
  const fingerprint = {
    baseUrl: maskSecretRefs(endpoint.baseUrl ?? "", secretRevisions),
    path: maskSecretRefs(endpoint.path ?? "", secretRevisions),
    method: (endpoint.method ?? "GET").toUpperCase(),
    query: normalizeQuery(endpoint.queryParams, secretRevisions),
    headers: normalizeHeaders(endpoint.headers, secretRevisions),
    bodyType: endpoint.bodyType ?? "",
    body: maskSecretRefs(endpoint.bodyTemplate ?? "", secretRevisions),
    dataPath: endpoint.responseMapping?.dataPath ?? "",
    schema: normalizeSchema(schema),
  };
  return JSON.stringify(fingerprint);
}

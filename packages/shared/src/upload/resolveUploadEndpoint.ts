/**
 * ADR-201 — `FileUpload.endpoint` (= `ApiEndpointDefinition.id` 참조) → 전송 대상 해석.
 *
 * 문서에는 endpoint **id 만** 실린다 (HC7 정적 비밀 0). URL·헤더는 Data 패널의 endpoint 정의가
 * 가지며, 여기서 런타임에 합친다. ADR-212 vault 참조 (`{{secret.NAME}}`) 가 헤더에 있으면
 * preview/publish 런타임은 vault 가 없으므로 **그 헤더를 보내지 않고** `E_UNAUTHORIZED` 안전
 * 경로로 떨어진다 (review-adr 201 m4) — 잘못된 헤더로 서버를 두드리지 않는다.
 *
 * 에러 코드는 ADR-201 R1 코드 표의 클라이언트 측 분류다 (`E_NO_ENDPOINT` · `E_UNAUTHORIZED`).
 */
import type { ApiEndpointDefinition } from "../types/collection.types";
import { isVaultPlaceholder } from "./plaintextTokenGate";

export type UploadEndpointResolution =
  | {
      ok: true;
      id: string;
      url: string;
      headers: Record<string, string>;
      /** endpoint 정의의 preview dry-run 토글 (ADR-201 Phase 4) — 미지정 = true */
      uploadDryRun: boolean;
    }
  | {
      ok: false;
      code: "E_NO_ENDPOINT" | "E_UNAUTHORIZED";
      message: string;
      /** vault 참조로 남은 헤더 키 (E_UNAUTHORIZED 일 때) */
      unresolvedHeaders?: string[];
    };

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const rest = path.replace(/^\/+/, "");
  if (!rest) return base;
  return `${base}/${rest}`;
}

function normalizeHeaders(
  headers: ApiEndpointDefinition["headers"],
): Array<[string, string]> {
  if (!headers) return [];
  if (Array.isArray(headers)) {
    return headers
      .filter((h) => h.enabled !== false && h.key.trim().length > 0)
      .map((h) => [h.key.trim(), h.value] as [string, string]);
  }
  return Object.entries(headers).filter(([key]) => key.trim().length > 0);
}

export function resolveUploadEndpoint(
  endpointId: unknown,
  endpoints: readonly ApiEndpointDefinition[],
): UploadEndpointResolution {
  const id = typeof endpointId === "string" ? endpointId.trim() : "";
  if (!id) {
    return {
      ok: false,
      code: "E_NO_ENDPOINT",
      message:
        "endpoint 가 지정되지 않았다 — Data 패널의 API endpoint id 를 넣는다.",
    };
  }
  const def = endpoints.find((e) => e.id === id || e.name === id);
  if (!def) {
    return {
      ok: false,
      code: "E_NO_ENDPOINT",
      message: `endpoint "${id}" 를 프로젝트 API endpoint 목록에서 찾지 못했다.`,
    };
  }
  const resolved: Record<string, string> = {};
  const unresolved: string[] = [];
  for (const [key, value] of normalizeHeaders(def.headers)) {
    if (isVaultPlaceholder(value)) unresolved.push(key);
    else resolved[key] = value;
  }
  if (unresolved.length > 0) {
    return {
      ok: false,
      code: "E_UNAUTHORIZED",
      message:
        "endpoint 헤더가 vault 참조 ({{secret.*}}) 를 담고 있다 — preview/publish 런타임은 vault 가 없어 전송하지 않는다.",
      unresolvedHeaders: unresolved,
    };
  }
  return {
    ok: true,
    id: def.id,
    url: joinUrl(def.baseUrl ?? "", def.path ?? ""),
    headers: resolved,
    uploadDryRun: def.uploadDryRun !== false,
  };
}

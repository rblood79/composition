/**
 * 붙여넣기 → 데이터 proposal (순수) — ADR-213 Phase 5 `data.importPaste` 와 Phase 6 AI-2
 * `understand_paste` 가 같이 쓴다. 규칙 파서만 (모델 0):
 *
 * - cURL → `define_endpoint` (ADR-212 Phase 4 가 같은 파서 `utils/data/curlCommand`)
 * - JSON 배열/객체 · 탭/쉼표 표 → `create_collection` (스키마는 `detectColumns` 추론) 또는
 *   기존 collection 에 `insert_rows`
 *
 * 실패는 reason 코드 — 호출자가 문구를 붙이거나 (AI-2) 모델 폴백으로 넘긴다.
 */
import type { DataOp } from "@composition/shared";
import {
  columnsToSchema,
  detectColumns,
} from "../../../builder/panels/datatable/utils/columnDetector";
import {
  parsePastedRows,
  type PastedRowsParseReason,
} from "../../../builder/panels/datatable/utils/pasteRows";
import {
  curlToEndpointDraft,
  looksLikeCurl,
  parseCurlCommand,
} from "../../../utils/data/curlCommand";

export interface PasteProposalOptions {
  /** 새 테이블/endpoint 이름 — rows 는 `collectionId` 가 없으면 필수 */
  name?: string;
  /** 있으면 기존 collection 에 행 추가 */
  collectionId?: string;
  collections: readonly { id: string; name: string }[];
}

export type PasteProposal =
  | {
      kind: "rows";
      format: "json" | "table";
      ops: DataOp[];
      rows: Record<string, unknown>[];
      /** 새 테이블이면 추론 스키마, 기존이면 null */
      schema: { key: string; type: string }[] | null;
      target: { id: string; name: string } | null;
    }
  | {
      kind: "endpoint";
      ops: DataOp[];
      draft: ReturnType<typeof curlToEndpointDraft>;
    }
  | {
      kind: "error";
      reason:
        | `paste-${PastedRowsParseReason}`
        | "curl-unparsable"
        | "name-required"
        | "collection-not-found";
    };

function resolveCollection(
  ref: string,
  collections: PasteProposalOptions["collections"],
) {
  return (
    collections.find((c) => c.id === ref) ??
    collections.find((c) => c.name.toLowerCase() === ref.toLowerCase()) ??
    null
  );
}

export function buildPasteProposal(
  text: string,
  options: PasteProposalOptions,
): PasteProposal {
  if (looksLikeCurl(text)) {
    const parsed = parseCurlCommand(text);
    if (!parsed) return { kind: "error", reason: "curl-unparsable" };
    const draft = curlToEndpointDraft(parsed, options.name?.trim() || undefined);
    return {
      kind: "endpoint",
      draft,
      ops: [{ op: "define_endpoint", endpoint: draft }],
    };
  }

  const parsed = parsePastedRows(text);
  if (!parsed.ok) return { kind: "error", reason: `paste-${parsed.reason}` };

  if (options.collectionId) {
    const target = resolveCollection(options.collectionId, options.collections);
    if (!target) return { kind: "error", reason: "collection-not-found" };
    return {
      kind: "rows",
      format: parsed.format,
      rows: parsed.rows,
      schema: null,
      target,
      ops: [{ op: "insert_rows", collectionId: target.id, rows: parsed.rows }],
    };
  }

  const name = options.name?.trim() ?? "";
  if (!name) return { kind: "error", reason: "name-required" };
  const schema = columnsToSchema(detectColumns(parsed.rows));
  return {
    kind: "rows",
    format: parsed.format,
    rows: parsed.rows,
    schema: schema.map((f) => ({ key: f.key, type: f.type })),
    target: null,
    ops: [
      {
        op: "create_collection",
        name,
        schema,
        rows: parsed.rows,
        source: "manual",
      },
    ],
  };
}

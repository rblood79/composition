import type { CompositionDocument } from "@composition/shared";

import { BaseApiService } from "./BaseApiService";

/**
 * `DocumentsApiService` — canonical primary storage cloud API.
 *
 * **ADR-123 Phase 1 신규**:
 * - 1 project = 1 `CompositionDocument` row 의 CRUD.
 * - `pages` / `elements` row 는 ADR-123 migration window 동안 fallback 유지.
 *   본 service 는 canonical primary path. legacy `legacyElementsApiService` /
 *   `PagesApiService` 는 ADR-123 Phase 4 에서 boundary-only 로 quarantine.
 *
 * @see docs/adr/123-cloud-document-row-schema.md
 * @see docs/adr/design/123-cloud-document-row-schema-breakdown.md §Phase 1
 * @see docs/migrations/002_create_documents_table.sql
 */
export class DocumentsApiService extends BaseApiService {
  /**
   * project_id 로 documents row 조회.
   *
   * row 가 없으면 `null` 반환 — caller (`projectSync.ts`) 는 `null` 수신 시
   * legacy `pages`/`elements` fallback 으로 진입한다 (ADR-123 Phase 2).
   *
   * 5분 캐싱 적용 (PagesApiService 와 동일 stale time).
   */
  async getDocumentByProjectId(
    projectId: string,
  ): Promise<CompositionDocument | null> {
    this.validateInput(
      projectId,
      (id) => typeof id === "string" && id.length > 0,
      "getDocumentByProjectId",
    );

    const queryKey = `documents:project:${projectId}`;

    const rows = await this.handleCachedApiCall<Array<{ content: unknown }>>(
      queryKey,
      "getDocumentByProjectId",
      async () => {
        return await this.supabase
          .from("documents")
          .select("content")
          .eq("project_id", projectId)
          .limit(1);
      },
      { staleTime: 5 * 60 * 1000 },
    );

    if (!rows || rows.length === 0) return null;
    const content = rows[0]?.content;
    if (!content || typeof content !== "object") return null;
    return content as CompositionDocument;
  }

  /**
   * project_id 기준 upsert. 1 project = 1 document 보장 (unique index).
   *
   * 호출 후 `documents:project:<projectId>` 캐시 무효화.
   */
  async upsertDocument(
    projectId: string,
    document: CompositionDocument,
  ): Promise<void> {
    this.validateInput(
      projectId,
      (id) => typeof id === "string" && id.length > 0,
      "upsertDocument",
    );
    this.validateInput(
      document,
      (doc) =>
        doc !== null &&
        typeof doc === "object" &&
        Array.isArray((doc as { children?: unknown }).children),
      "upsertDocument:document",
    );

    await this.handleApiCall("upsertDocument", async () => {
      return await this.supabase
        .from("documents")
        .upsert(
          {
            project_id: projectId,
            content: document as unknown as Record<string, unknown>,
          },
          { onConflict: "project_id" },
        )
        .select()
        .single();
    });

    this.invalidateCache(`documents:project:${projectId}`);
  }

  /**
   * project 삭제 시 cascade 가 자동 처리하므로 명시 호출 미필요.
   * 단, 명시적 cleanup 이 필요한 케이스 (테스트 / 수동 정리) 용도.
   */
  async deleteDocumentByProjectId(projectId: string): Promise<void> {
    this.validateInput(
      projectId,
      (id) => typeof id === "string" && id.length > 0,
      "deleteDocumentByProjectId",
    );

    await this.handleApiCall("deleteDocumentByProjectId", async () => {
      return await this.supabase
        .from("documents")
        .delete()
        .eq("project_id", projectId);
    });

    this.invalidateCache(`documents:project:${projectId}`);
  }
}

// DocumentsApiService 싱글톤 인스턴스
export const documentsApi = new DocumentsApiService();

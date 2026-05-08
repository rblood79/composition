import { BaseApiService } from "./BaseApiService";

export interface Page {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  order_num?: number;
  created_at?: string;
  updated_at?: string;
  parent_id?: string | null;
}

export interface CreatePageData {
  project_id: string;
  title: string;
  slug: string;
}

export class PagesApiService extends BaseApiService {
  /**
   * 프로젝트 ID로 페이지들을 가져옵니다 (캐싱 적용)
   *
   * ✅ 최적화:
   * - 5분 캐싱
   * - 중복 요청 자동 방지
   * - 성능 모니터링
   */
  async getPagesByProjectId(projectId: string): Promise<Page[]> {
    this.validateInput(
      projectId,
      (id) => typeof id === "string" && id.length > 0,
      "getPagesByProjectId",
    );

    const queryKey = `pages:project:${projectId}`;

    return this.handleCachedApiCall<Page[]>(
      queryKey,
      "getPagesByProjectId",
      async () => {
        return await this.supabase
          .from("pages")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });
      },
      { staleTime: 5 * 60 * 1000 }, // 5분 캐싱
    );
  }

  /**
   * 새 페이지를 생성합니다 (캐시 무효화)
   */
  async createPage(pageData: Partial<Page>): Promise<Page> {
    this.validateInput(
      pageData,
      (data) => typeof data === "object" && data !== null,
      "createPage",
    );

    const result = await this.handleApiCall<Page>("createPage", async () => {
      const res = await this.supabase
        .from("pages")
        .insert([pageData])
        .select()
        .single();

      return res;
    });

    // ✅ 캐시 무효화 (해당 프로젝트의 pages 캐시 삭제)
    if (pageData.project_id) {
      this.invalidateCache(`pages:project:${pageData.project_id}`);
    }

    return result;
  }

  /**
   * 프로젝트의 페이지 목록 조회 (캐싱 적용)
   */
  async fetchPages(projectId: string): Promise<Page[]> {
    this.validateInput(
      projectId,
      (id) => typeof id === "string" && id.length > 0,
      "fetchPages",
    );

    const queryKey = `pages:project:${projectId}`;

    return this.handleCachedApiCall<Page[]>(
      queryKey,
      "fetchPages",
      async () => {
        return await this.supabase
          .from("pages")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });
      },
      { staleTime: 5 * 60 * 1000 },
    );
  }

  /**
   * 페이지 업데이트 (캐시 무효화)
   */
  async updatePage(pageId: string, updates: Partial<Page>): Promise<Page> {
    this.validateInput(
      pageId,
      (id) => typeof id === "string" && id.length > 0,
      "updatePage",
    );
    this.validateInput(
      updates,
      (u) => u && typeof u === "object",
      "updatePage",
    );

    const result = await this.handleApiCall<Page>("updatePage", async () => {
      return await this.supabase
        .from("pages")
        .update(updates)
        .eq("id", pageId)
        .select("*")
        .single();
    });

    // ✅ 캐시 무효화
    if (result.project_id) {
      this.invalidateCache(`pages:project:${result.project_id}`);
    }

    return result;
  }

  /**
   * 페이지 삭제 (캐시 무효화)
   */
  async deletePage(pageId: string): Promise<void> {
    this.validateInput(
      pageId,
      (id) => typeof id === "string" && id.length > 0,
      "deletePage",
    );

    // 삭제 전에 project_id 조회 (캐시 무효화용)
    // .single() 대신 .maybeSingle()을 사용하여 페이지가 없어도 에러가 발생하지 않도록 함
    const { data: page } = await this.supabase
      .from("pages")
      .select("project_id")
      .eq("id", pageId)
      .maybeSingle();

    // 페이지가 Supabase에 존재하는 경우에만 삭제 시도
    if (page) {
      await this.handleDeleteCall("deletePage", async () => {
        return await this.supabase.from("pages").delete().eq("id", pageId);
      });
    }

    // ✅ 캐시 무효화 (페이지가 있었든 없었든 캐시는 무효화)
    if (page?.project_id) {
      this.invalidateCache(`pages:project:${page.project_id}`);
    }
  }
}

// PagesApiService 싱글톤 인스턴스
export const pagesApi = new PagesApiService();

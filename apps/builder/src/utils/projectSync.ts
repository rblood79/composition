/**
 * Project Sync Utility
 *
 * 로컬(IndexedDB)과 클라우드(Supabase) 간 프로젝트 동기화
 */

import { getDB } from "../lib/db";
import { projectsApi } from "../services/api/ProjectsApiService";
import { pagesApi } from "../services/api/PagesApiService";
import { elementsApi } from "../adapters/canonical/legacyElementsApiService";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../adapters/canonical/frameMirror";

/**
 * 로컬 프로젝트를 클라우드에 동기화
 *
 * @param projectId - 동기화할 프로젝트 ID
 * @returns 동기화 성공 여부
 *
 * @example
 * ```typescript
 * await syncProjectToCloud('project-123');
 * ```
 */
export async function syncProjectToCloud(projectId: string): Promise<void> {
  console.log("[ProjectSync] 동기화 시작:", projectId);

  try {
    const db = await getDB();

    // 1. 로컬 프로젝트 읽기
    const localProject = await db.projects.getById(projectId);
    if (!localProject) {
      throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    console.log("[ProjectSync] 로컬 프로젝트 로드:", localProject.name);

    // 2. 프로젝트 메타데이터를 Supabase에 업데이트 (이미 존재한다고 가정)
    try {
      await projectsApi.updateProject(localProject.id, {
        name: localProject.name,
        updated_at: new Date().toISOString(),
      });
      console.log("[ProjectSync] 프로젝트 메타데이터 동기화 완료");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_updateError) {
      // 프로젝트가 없으면 생성 (IndexedDB ID 보존)
      console.log("[ProjectSync] 프로젝트가 클라우드에 없음, 새로 생성");
      await projectsApi.createProject({
        id: localProject.id, // ✅ IndexedDB ID 보존하여 FK 제약조건 충족
        name: localProject.name,
        created_by: localProject.created_by || "", // undefined 방지
      });
    }

    // 3. 페이지 읽기
    const localPages = await db.pages.getByProject(projectId);
    console.log("[ProjectSync] 로컬 페이지:", localPages.length);

    // 4. 페이지를 Supabase에 업로드
    for (const [pageIndex, page] of localPages.entries()) {
      // Page 타입은 title 필드를 사용
      const apiPage = withPageFrameBinding(
        {
          id: page.id,
          project_id: page.project_id,
          title: page.title,
          slug: page.slug,
          parent_id: page.parent_id,
          order_num: pageIndex,
          created_at: page.created_at,
          updated_at: new Date().toISOString(),
        },
        getNullablePageFrameBindingId(page),
      );

      try {
        await pagesApi.updatePage(page.id, apiPage);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_updateError) {
        // 페이지가 없으면 생성
        await pagesApi.createPage(apiPage);
      }

      // 5. 페이지의 요소들 읽기
      const localElements = await db.elements.getByPage(page.id);
      console.log(
        `[ProjectSync] 페이지 "${page.title}" 요소:`,
        localElements.length,
      );

      // 6. 요소들을 Supabase에 업로드 (배치)
      if (localElements.length > 0) {
        // 기존 요소 삭제 후 재생성 (간단한 방법)
        const cloudElements = await elementsApi.getElementsByPageId(page.id);
        if (cloudElements.length > 0) {
          await elementsApi.deleteMultipleElements(
            cloudElements.map((el) => el.id),
          );
        }

        // 새로 생성
        await elementsApi.createMultipleElements(
          localElements.map((el) => ({
            ...el,
            updated_at: new Date().toISOString(),
          })),
        );
      }
    }

    // 7. IndexedDB의 updated_at 업데이트 (동기화 시간 기록)
    await db.projects.update(projectId, {
      updated_at: new Date().toISOString(),
    });

    console.log("✅ [ProjectSync] 동기화 완료:", projectId);
  } catch (error) {
    console.error("❌ [ProjectSync] 동기화 실패:", error);
    throw error;
  }
}

/**
 * 클라우드 프로젝트를 로컬에 다운로드
 *
 * @param projectId - 다운로드할 프로젝트 ID
 * @returns 다운로드 성공 여부
 *
 * @example
 * ```typescript
 * await downloadProjectFromCloud('project-123');
 * ```
 */
export async function downloadProjectFromCloud(
  projectId: string,
): Promise<void> {
  console.log("[ProjectSync] 다운로드 시작:", projectId);

  try {
    const db = await getDB();

    // 1. 클라우드 프로젝트 읽기
    const cloudProject = await projectsApi.getProjectById(projectId);
    if (!cloudProject) {
      throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    console.log("[ProjectSync] 클라우드 프로젝트 로드:", cloudProject.name);

    // 2. IndexedDB에 프로젝트 저장
    await db.projects.insert(cloudProject);
    console.log("[ProjectSync] 프로젝트 메타데이터 다운로드 완료");

    // 3. 페이지 읽기
    const cloudPages = await pagesApi.getPagesByProjectId(projectId);
    console.log("[ProjectSync] 클라우드 페이지:", cloudPages.length);

    // 4. 페이지를 IndexedDB에 저장
    for (const page of cloudPages) {
      // API Page → Store Page 변환
      const storePage = withPageFrameBinding(
        {
          id: page.id,
          project_id: page.project_id,
          title: page.title,
          slug: page.slug,
          parent_id: page.parent_id ?? null,
          created_at: page.created_at,
          updated_at: page.updated_at,
        },
        getNullablePageFrameBindingId(page),
      );

      await db.pages.insert(storePage);

      // 5. 페이지의 요소들 읽기
      const cloudElements = await elementsApi.getElementsByPageId(page.id);
      console.log(
        `[ProjectSync] 페이지 "${page.title}" 요소:`,
        cloudElements.length,
      );

      // 6. 요소들을 IndexedDB에 저장
      if (cloudElements.length > 0) {
        await db.elements.insertMany(cloudElements);
      }
    }

    console.log("✅ [ProjectSync] 다운로드 완료:", projectId);
  } catch (error) {
    console.error("❌ [ProjectSync] 다운로드 실패:", error);
    throw error;
  }
}

/**
 * 프로젝트 삭제 (로컬 또는 클라우드)
 *
 * @param projectId - 삭제할 프로젝트 ID
 * @param location - 삭제 위치 ('local' | 'cloud' | 'both')
 *
 * @example
 * ```typescript
 * await deleteProject('project-123', 'local');  // 로컬에서만 삭제
 * await deleteProject('project-123', 'both');   // 양쪽 모두 삭제
 * ```
 */
export async function deleteProject(
  projectId: string,
  location: "local" | "cloud" | "both",
): Promise<void> {
  console.log("[ProjectSync] 프로젝트 삭제:", { projectId, location });

  try {
    if (location === "local" || location === "both") {
      const db = await getDB();

      // 1. 프로젝트의 모든 페이지 삭제
      const pages = await db.pages.getByProject(projectId);
      for (const page of pages) {
        // 페이지의 모든 요소 삭제
        const elements = await db.elements.getByPage(page.id);
        if (elements.length > 0) {
          await db.elements.deleteMany(elements.map((el) => el.id));
        }
        // 페이지 삭제
        await db.pages.delete(page.id);
      }
      console.log(`[ProjectSync] 페이지 ${pages.length}개 삭제 완료`);

      // 2. 프로젝트의 레이아웃 삭제
      const layouts = await db.layouts.getByProject(projectId);
      for (const layout of layouts) {
        // 레이아웃의 모든 요소 삭제
        const layoutElements = await db.elements.getDescendants(layout.id);
        if (layoutElements.length > 0) {
          await db.elements.deleteMany(layoutElements.map((el) => el.id));
        }
        // 레이아웃 삭제
        await db.layouts.delete(layout.id);
      }
      console.log(`[ProjectSync] 레이아웃 ${layouts.length}개 삭제 완료`);

      // 3. 프로젝트의 디자인 토큰 삭제
      const tokens = await db.designTokens.getByProject(projectId);
      for (const token of tokens) {
        await db.designTokens.delete(token.id);
      }
      console.log(`[ProjectSync] 디자인 토큰 ${tokens.length}개 삭제 완료`);

      // 4. 프로젝트의 테마 삭제
      const themes = await db.themes.getByProject(projectId);
      for (const theme of themes) {
        await db.themes.delete(theme.id);
      }
      console.log(`[ProjectSync] 테마 ${themes.length}개 삭제 완료`);

      // 5. Data Panel 테이블들 삭제 (data_tables, api_endpoints, variables, transformers)
      const dataTables = await db.data_tables.getByProject(projectId);
      for (const dataTable of dataTables) {
        await db.data_tables.delete(dataTable.id);
      }
      console.log(`[ProjectSync] DataTables ${dataTables.length}개 삭제 완료`);

      const apiEndpoints = await db.api_endpoints.getByProject(projectId);
      for (const endpoint of apiEndpoints) {
        await db.api_endpoints.delete(endpoint.id);
      }
      console.log(
        `[ProjectSync] API Endpoints ${apiEndpoints.length}개 삭제 완료`,
      );

      const variables = await db.variables.getByProject(projectId);
      for (const variable of variables) {
        await db.variables.delete(variable.id);
      }
      console.log(`[ProjectSync] Variables ${variables.length}개 삭제 완료`);

      const transformers = await db.transformers.getByProject(projectId);
      for (const transformer of transformers) {
        await db.transformers.delete(transformer.id);
      }
      console.log(
        `[ProjectSync] Transformers ${transformers.length}개 삭제 완료`,
      );

      // 6. 프로젝트 삭제
      await db.projects.delete(projectId);
      console.log("✅ [ProjectSync] 로컬 프로젝트 삭제 완료");
    }

    if (location === "cloud" || location === "both") {
      await projectsApi.deleteProject(projectId);
      console.log("✅ [ProjectSync] 클라우드 프로젝트 삭제 완료");
    }
  } catch (error) {
    console.error("❌ [ProjectSync] 프로젝트 삭제 실패:", error);
    throw error;
  }
}

/**
 * Export Utilities
 *
 * 🚀 Phase 10: 프로젝트 Export/Import 유틸리티
 *
 * Builder에서 생성된 프로젝트를 JSON으로 내보내고,
 * Publish 앱에서 로드할 수 있는 기능을 제공합니다.
 *
 * @since 2026-01-02
 * @updated 2026-01-02 Phase 1 - Zod 검증 추가
 */
import type { Element, Page } from "../types/element.types";
import type { CanonicalNode, CompositionDocument } from "../types/composition-document.types";
import { type ExportError, type ImportResult, type ProjectMetadata } from "../types/export.types";
import type { FontRegistryV2 } from "../types/font.types";
export declare const PAGE_FRAME_ELEMENT_ID_SEPARATOR = "::page-frame::";
export declare function toPageFrameElementId(pageId: string, frameElementId: string): string;
export interface ProjectExportData {
    version: string;
    exportedAt: string;
    project: {
        id: string;
        name: string;
    };
    document: CompositionDocument;
    currentPageId?: string | null;
    fontRegistry?: FontRegistryV2;
    metadata?: ProjectMetadata;
}
export interface ProjectImportResultSuccess {
    success: true;
    data: ProjectExportData;
    warnings?: ExportError[];
}
export type ProjectImportResult = ProjectImportResultSuccess | Extract<ImportResult, {
    success: false;
}>;
export interface ProjectRenderModel {
    pages: Page[];
    elements: Element[];
    currentPageId: string | null;
}
export declare const COMPONENTS_PAGE_ROLE = "components";
export declare const COMPONENTS_PAGE_SLUG = "/__components";
export type ProjectRenderAudience = "editor" | "runtime";
export interface DeriveProjectRenderModelOptions {
    audience?: ProjectRenderAudience;
}
export declare function isComponentsPageMetadata(metadata: CanonicalNode["metadata"] | undefined): boolean;
export declare function isEditorPageNode(node: CanonicalNode): boolean;
export declare function isRuntimePageNode(node: CanonicalNode): boolean;
export declare function deriveProjectRenderModelFromDocument(document: CompositionDocument, projectId: string, currentPageId?: string | null, options?: DeriveProjectRenderModelOptions): ProjectRenderModel;
export declare function deriveProjectEditorPageModelFromDocument(document: CompositionDocument, projectId: string, currentPageId?: string | null): ProjectRenderModel;
/**
 * 프로젝트 데이터를 JSON 문자열로 변환
 */
export declare function serializeProjectData(projectId: string, projectName: string, document: CompositionDocument, currentPageId?: string | null, fontRegistry?: FontRegistryV2, metadata?: ProjectMetadata): string;
/**
 * 프로젝트 데이터를 JSON 파일로 다운로드
 */
export declare function downloadProjectAsJson(projectId: string, projectName: string, canonicalDocument: CompositionDocument, currentPageId?: string | null, fontRegistry?: FontRegistryV2, metadata?: ProjectMetadata): void;
/**
 * JSON 문자열에서 프로젝트 데이터 파싱 및 검증
 */
export declare function parseProjectData(jsonString: string): ProjectImportResult;
/**
 * URL에서 프로젝트 데이터 로드
 */
export declare function loadProjectFromUrl(url: string): Promise<ProjectImportResult>;
/**
 * File 객체에서 프로젝트 데이터 로드
 */
export declare function loadProjectFromFile(file: File): Promise<ProjectImportResult>;
/**
 * 정적 HTML 파일 생성
 *
 * 프로젝트 데이터를 인라인으로 포함한 standalone HTML 파일을 생성합니다.
 */
export declare function generateStaticHtml(projectId: string, projectName: string, document: CompositionDocument, currentPageId?: string | null, fontRegistry?: FontRegistryV2, themeCSS?: string): string;
/**
 * 정적 HTML 파일 다운로드 (단일 파일)
 */
export declare function downloadStaticHtml(projectId: string, projectName: string, document: CompositionDocument, currentPageId?: string | null, fontRegistry?: FontRegistryV2, themeCSS?: string): void;
interface ExportProjectOptions {
    projectId: string;
    projectName: string;
    document: CompositionDocument;
    currentPageId?: string | null;
    fontRegistry?: FontRegistryV2;
    themeCSS?: string;
}
/**
 * 멀티파일 프로젝트 Export
 *
 * showDirectoryPicker (Chrome) 또는 ZIP fallback (Firefox/Safari)
 */
export declare function exportProject(options: ExportProjectOptions): Promise<void>;
export type { ImportResult, ExportError } from "../types/export.types";
export { ExportErrorCode, EXPORT_LIMITS } from "../types/export.types";
//# sourceMappingURL=export.utils.d.ts.map
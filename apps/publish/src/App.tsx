/**
 * Publish App
 *
 * 🚀 Phase 10 B2.3: Publish 앱 메인 컴포넌트
 *
 * Builder에서 생성된 프로젝트를 렌더링하는 앱입니다.
 *
 * @since 2025-12-11 Phase 10 B2.3
 * @updated 2026-01-02 JSON 로드 기능 추가
 * @updated 2026-01-02 Phase 1 - 검증 강화, Phase 2 - 멀티 페이지 네비게이션
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Element, Page } from "@composition/shared";
import {
  deriveProjectRenderModelFromDocument,
  loadProjectFromUrl,
  loadProjectFromFile,
  type ProjectExportData,
  type ExportError,
  ExportErrorCode,
} from "@composition/shared/utils";
import {
  loadFontRegistry,
  buildRegistryFontFaceCss,
} from "@composition/shared";
import type { FontRegistryV2 } from "@composition/shared";
import { PageRenderer } from "./renderer";
import { InteractionRuntimeProvider } from "./renderer/InteractionRuntime";
import { ToastProvider } from "@composition/shared/components";
import { PageNav } from "./components/PageNav";
import { usePageRouting } from "./hooks/usePageRouting";
import {
  PUBLISH_STRINGS,
  usePublishDocumentLanguage,
  usePublishStrings,
} from "./i18n";
import type { PublishStringKey } from "./i18n";
import "./styles/index.css";

// ============================================
// Types
// ============================================

interface ProjectData {
  pages: Page[];
  elements: Element[];
  currentPageId: string | null;
  projectName: string;
  version: string;
  /** canonical document.events — 인터랙션 규칙 (ADR-158). 구 entry 는 색인이 걸러낸다 */
  events: readonly unknown[];
}

type LoadingState = "idle" | "loading" | "loaded" | "error";

// ============================================
// Error Display Component
// ============================================

/**
 * publish 자신이 만든 오류는 문구 대신 **키**를 싣는다 — 오류 객체는 상태에 남아 있다가
 * 나중에 그려지므로, 만들 때 문구로 굳히면 그 사이 언어가 바뀌어도 예전 언어가 남는다
 * (브라우저 `languagechange` 로 실제 일어난다). 로더가 만든 오류는 문구가 그대로 온다.
 */
type PublishLoadError = ExportError & { messageKey?: PublishStringKey };

interface ErrorDisplayProps {
  error: PublishLoadError;
  errors?: ExportError[];
  onRetry: () => void;
}

function ErrorDisplay({ error, errors, onRetry }: ErrorDisplayProps) {
  const t = usePublishStrings();
  return (
    <div className="publish-error" role="alert" aria-live="assertive">
      <div className="error-icon">⚠️</div>
      <h1>{t("loadTitle")}</h1>
      <div className="error-details">
        <p className="error-message">
            {error.messageKey ? t(error.messageKey) : error.message}
          </p>
        {error.field && (
          <p className="error-field">
            <strong>{t("loadFieldLabel")}</strong> {error.field}
          </p>
        )}
        {error.detail && (
          <p className="error-detail">
            <strong>{t("loadDetailLabel")}</strong> {error.detail}
          </p>
        )}
        <p className="error-code">
          <code>{error.code}</code>
        </p>
      </div>

      {errors && errors.length > 1 && (
        <details className="error-list">
          <summary>{t("showAllErrors", { count: errors.length })}</summary>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>
                <code>{err.code}</code>: {err.message}
                {err.field && (
                  <span className="error-field"> ({err.field})</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <button className="retry-button" onClick={onRetry}>
        {t("retry")}
      </button>
    </div>
  );
}

// ============================================
// Loading Component
// ============================================

function LoadingScreen() {
  const t = usePublishStrings();
  return (
    <div className="publish-loading" aria-busy="true" aria-live="polite">
      <div className="loading-spinner" />
      <p>{t("loadingProject")}</p>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="publish-empty">
      <p>{message}</p>
    </div>
  );
}

// ============================================
// Theme Config Helper (ADR-021 Phase C)
// ============================================

const NEUTRAL_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const RADIUS_MAP: Record<string, string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

function applyThemeConfig(themeConfig?: {
  tint?: string;
  neutral?: string;
  radiusScale?: string;
}) {
  if (!themeConfig) return;

  const lines: string[] = [];

  if (themeConfig.tint) {
    lines.push(`--tint: var(--${themeConfig.tint});`);
  }

  // neutral 프리셋 — 팔레트 var alias. 프리셋이 팔레트 기본값 `neutral` 자체면 emit 하지 않는다:
  // `--color-neutral-N: var(--color-neutral-N)` 은 자기 참조 순환이라 CSS 가 변수 전체를 무효화해
  // neutral 을 소비하는 모든 CSS (Badge gray 등) 가 transparent 로 떨어졌다 (2026-08-27 ADR-193 Phase 2 실측).
  if (themeConfig.neutral && themeConfig.neutral !== "neutral") {
    for (const step of NEUTRAL_STEPS) {
      lines.push(
        `--color-neutral-${step}: var(--color-${themeConfig.neutral}-${step});`,
      );
    }
  }

  if (themeConfig.radiusScale && RADIUS_MAP[themeConfig.radiusScale]) {
    lines.push(`--radius-base: ${RADIUS_MAP[themeConfig.radiusScale]};`);
  }

  if (lines.length === 0) return;

  // 기존 스타일 태그 제거 (중복 방지)
  const existing = document.getElementById("composition-theme-config");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.id = "composition-theme-config";
  style.textContent = `:root {\n  ${lines.join("\n  ")}\n}`;
  document.head.appendChild(style);
}

// ============================================
// Font Registry Helper (ADR-014 Phase D)
// ============================================

const GOOGLE_FONTS_CSS_ID = "composition-publish-google-fonts";

function injectGoogleFontsCss() {
  if (document.getElementById(GOOGLE_FONTS_CSS_ID)) return;

  const families = [
    "Inter:wght@100;200;300;400;500;600;700;800;900",
    "Roboto:wght@100;300;400;500;700;900",
    "Open+Sans:wght@300;400;500;600;700;800",
    "Lora:wght@400;500;600;700",
    "Roboto+Mono:wght@100;200;300;400;500;600;700",
  ];

  const url = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;

  const link = document.createElement("link");
  link.id = GOOGLE_FONTS_CSS_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function injectFontRegistryFromData(fontRegistry?: FontRegistryV2) {
  if (!fontRegistry || !fontRegistry.faces?.length) return;

  const css = buildRegistryFontFaceCss(fontRegistry);
  if (!css) return;

  // 기존 스타일 태그 제거 (중복 방지)
  const existing = document.getElementById("composition-publish-custom-fonts");
  if (existing) existing.remove();

  const styleEl = document.createElement("style");
  styleEl.id = "composition-publish-custom-fonts";
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// ============================================
// App Component
// ============================================

export function App() {
  const t = usePublishStrings();
  usePublishDocumentLanguage();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<PublishLoadError | null>(null);
  const [errors, setErrors] = useState<ExportError[] | undefined>(undefined);
  const [warnings, setWarnings] = useState<ExportError[] | undefined>(
    undefined,
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Google Fonts CSS 주입
    injectGoogleFontsCss();

    try {
      // FontRegistryV2 기반 폰트 로드 (ADR-014 Phase D)
      const registry = loadFontRegistry();
      const css = buildRegistryFontFaceCss(registry);
      if (!css) return;

      const styleEl = document.createElement("style");
      styleEl.id = "composition-publish-custom-fonts";
      styleEl.textContent = css;
      document.head.appendChild(styleEl);

      return () => {
        styleEl.remove();
      };
    } catch {
      return;
    }
  }, []);

  // 페이지 라우팅
  const { currentPageId, currentPage, setCurrentPageId } = usePageRouting({
    pages: projectData?.pages || [],
    defaultPageId: projectData?.currentPageId,
  });

  // 현재 페이지의 요소들
  const currentElements =
    projectData?.elements.filter((el) => el.page_id === currentPageId) || [];

  // 프로젝트 데이터 설정
  const setProject = useCallback(
    (data: ProjectExportData, loadWarnings?: ExportError[]) => {
      const renderModel = deriveProjectRenderModelFromDocument(
        data.document,
        data.project.id,
        data.currentPageId,
      );
      const projectData: ProjectData = {
        pages: renderModel.pages,
        elements: renderModel.elements,
        currentPageId: renderModel.currentPageId,
        projectName: data.project.name,
        version: data.version,
        events: data.document.events ?? [],
      };

      // ADR-014 Phase D: fontRegistry → @font-face 주입
      injectFontRegistryFromData(data.fontRegistry);

      setProjectData(projectData);
      setWarnings(loadWarnings);
      setLoadingState("loaded");
      setError(null);
      setErrors(undefined);
    },
    [],
  );

  // 에러 설정
  const setLoadError = useCallback(
    (err: PublishLoadError, allErrors?: ExportError[]) => {
      setError(err);
      setErrors(allErrors);
      setLoadingState("error");
    },
    [],
  );

  // URL 파라미터에서 프로젝트 로드
  useEffect(() => {
    async function loadFromUrlParam() {
      const urlParams = new URLSearchParams(window.location.search);
      const projectUrl = urlParams.get("project");

      if (projectUrl) {
        setLoadingState("loading");
        const result = await loadProjectFromUrl(projectUrl);

        if (result.success) {
          setProject(result.data, result.warnings);
        } else {
          setLoadError(result.error, result.errors);
        }
        return true;
      }
      return false;
    }

    async function loadFromDefaultPath() {
      setLoadingState("loading");
      const result = await loadProjectFromUrl("/project.json");

      if (result.success) {
        setProject(result.data, result.warnings);
        return true;
      }
      return false;
    }

    function loadFromSessionStorage(): boolean {
      const previewData = sessionStorage.getItem("composition-preview-data");
      if (previewData) {
        try {
          const parsed = JSON.parse(previewData);
          if (!parsed.document) {
            throw new Error("CompositionDocument payload is required");
          }
          const renderModel = deriveProjectRenderModelFromDocument(
            parsed.document,
            parsed.project?.id || "preview",
            parsed.currentPageId,
          );
          const projectData: ProjectData = {
            pages: renderModel.pages,
            elements: renderModel.elements,
            currentPageId: renderModel.currentPageId,
            projectName: parsed.project?.name || "Preview",
            version: parsed.version,
            events: parsed.document.events ?? [],
          };
          setProjectData(projectData);
          setLoadingState("loaded");

          // ADR-021 Phase C: themeConfig → CSS 변수 주입
          applyThemeConfig(parsed.themeConfig);

          // ADR-014 Phase D: fontRegistry → @font-face 주입
          injectFontRegistryFromData(parsed.fontRegistry);

          // 사용 후 삭제 (새로고침 시 다시 로드하지 않음)
          // sessionStorage.removeItem('composition-preview-data');
          return true;
        } catch (error) {
          console.warn("[Publish] Failed to parse sessionStorage data:", error);
        }
      }
      return false;
    }

    async function init() {
      // 1. sessionStorage에서 로드 시도 (Builder Preview 모드)
      const loadedFromSession = loadFromSessionStorage();
      if (loadedFromSession) return;

      // 2. URL 파라미터에서 로드 시도
      const loadedFromUrl = await loadFromUrlParam();
      if (loadedFromUrl) return;

      // 3. /project.json에서 로드 시도
      const loadedFromDefault = await loadFromDefaultPath();
      if (loadedFromDefault) return;

      // 4. 프로젝트 없음 - 파일 드롭 대기
      setLoadingState("idle");
    }

    init();
  }, [setProject, setLoadError]);

  // 파일 드롭 핸들러
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith(".json")) {
        setLoadError({
          code: ExportErrorCode.VALIDATION_ERROR,
          message: PUBLISH_STRINGS["en-US"].jsonOnly,
          messageKey: "jsonOnly",
          severity: "error",
        });
        return;
      }

      setLoadingState("loading");
      const result = await loadProjectFromFile(file);

      if (result.success) {
        setProject(result.data, result.warnings);
      } else {
        setLoadError(result.error, result.errors);
      }
    },
    [setProject, setLoadError],
  );

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoadingState("loading");
      const result = await loadProjectFromFile(file);

      if (result.success) {
        setProject(result.data, result.warnings);
      } else {
        setLoadError(result.error, result.errors);
      }
    },
    [setProject, setLoadError],
  );

  // 드래그 이벤트 핸들러
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    setError(null);
    setErrors(undefined);
    setLoadingState("idle");
  }, []);

  // 에러 상태
  if (loadingState === "error" && error) {
    return <ErrorDisplay error={error} errors={errors} onRetry={handleRetry} />;
  }

  // 로딩 상태
  if (loadingState === "loading") {
    return <LoadingScreen />;
  }

  // 프로젝트 없음 - 파일 드롭 UI
  if (loadingState === "idle" || !projectData) {
    return (
      <div
        className={`publish-dropzone ${isDragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label={t("uploadLabel")}
        aria-describedby="dropzone-instructions"
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <div className="dropzone-content">
          <h1>composition Publish</h1>
          <p id="dropzone-instructions">{t("dropInstructions")}</p>
          <p className="or">{t("or")}</p>
          <button onClick={() => fileInputRef.current?.click()}>
            {t("chooseFile")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>
      </div>
    );
  }

  // 페이지 없음
  if (projectData.pages.length === 0) {
    return <EmptyState message={t("noPages")} />;
  }

  // 현재 페이지가 없음
  if (!currentPage) {
    return <EmptyState message={t("pageNotFound")} />;
  }

  // 프로젝트 렌더링 — 인터랙션 규칙은 preview 와 같은 shared dispatcher 로 실행
  // (toast capability 를 위해 ToastProvider 가 바깥).
  return (
    <ToastProvider>
      <InteractionRuntimeProvider
        rules={projectData.events}
        elements={projectData.elements}
        pages={projectData.pages}
        onNavigatePage={setCurrentPageId}
      >
        <div className="publish-app">
          {/* 경고 표시 */}
          {warnings && warnings.length > 0 && (
            <div className="publish-warnings" role="status">
              {warnings.map((w, i) => (
                <div key={i} className="warning-item">
                  ⚠️ {w.message}
                </div>
              ))}
            </div>
          )}

          <div className="publish-layout">
            {/* 페이지 네비게이션 */}
            <PageNav
              pages={projectData.pages}
              currentPageId={currentPageId}
              onPageChange={setCurrentPageId}
            />

            {/* 메인 콘텐츠 */}
            <main className="publish-content">
              {currentElements.length === 0 ? (
                <EmptyState message={t("emptyPage")} />
              ) : (
                <PageRenderer
                  page={currentPage}
                  elements={projectData.elements}
                  className="publish-page"
                />
              )}
            </main>
          </div>
        </div>
      </InteractionRuntimeProvider>
    </ToastProvider>
  );
}

export default App;

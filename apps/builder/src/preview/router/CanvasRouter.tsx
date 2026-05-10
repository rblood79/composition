/**
 * Canvas Router - MemoryRouter 기반 내부 라우팅
 *
 * Canvas Runtime 내에서 독립적인 라우팅을 처리합니다.
 * Builder의 BrowserRouter와 완전히 분리되어 동작합니다.
 */

import React, { useEffect, useState, useMemo } from "react";
import {
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  type NavigateFunction,
} from "react-router-dom";
import { RouterContext } from "./canvasRouterContext";
import { useCanvasParams } from "./canvasRouterHooks";
import { useRuntimeStore } from "../store";
import type { RuntimeLayout } from "../store/types";
import {
  generatePageUrl,
  hasDynamicParams,
  type UrlPage,
} from "../../utils/urlGenerator";
import {
  getNullablePageFrameBindingId,
  withPageFrameBinding,
} from "../../adapters/canonical/frameMirror";

// ============================================
// Page Renderer Component
// ============================================

interface PageRendererProps {
  pageId: string;
  renderElements: () => React.ReactNode;
}

function PageRenderer({ pageId, renderElements }: PageRendererProps) {
  const setCurrentPageId = useRuntimeStore((s) => s.setCurrentPageId);
  const setRouteParams = useRuntimeStore((s) => s.setRouteParams);
  const params = useCanvasParams();

  useEffect(() => {
    setCurrentPageId(pageId);
  }, [pageId, setCurrentPageId]);

  // 동적 라우트 파라미터 저장
  useEffect(() => {
    if (setRouteParams) {
      setRouteParams(params as Record<string, string>);
    }
  }, [params, setRouteParams]);

  return <>{renderElements()}</>;
}

// ============================================
// Not Found Component
// ============================================

interface NotFoundProps {
  layoutId?: string | null;
  originalUrl?: string;
  renderElements?: () => React.ReactNode;
}

/**
 * 기본 404 컴포넌트
 */
function DefaultNotFound({ originalUrl }: { originalUrl?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>404</h1>
      <p style={{ color: "#666" }}>Page not found</p>
      {originalUrl && (
        <p style={{ color: "#999", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          {originalUrl}
        </p>
      )}
    </div>
  );
}

/**
 * Layout별 404 페이지 렌더러
 * (Hook 규칙을 준수하기 위해 별도 컴포넌트로 분리)
 */
function LayoutNotFoundPage({
  pageId,
  renderElements,
}: {
  pageId: string;
  renderElements?: () => React.ReactNode;
}) {
  const setCurrentPageId = useRuntimeStore((s) => s.setCurrentPageId);

  useEffect(() => {
    setCurrentPageId(pageId);
  }, [pageId, setCurrentPageId]);

  return <>{renderElements?.()}</>;
}

/**
 * Layout별 404 페이지 또는 기본 404 렌더링
 *
 * 404 처리 계층:
 * 1. Layout.notFoundPageId가 있으면 해당 페이지 렌더링 (Layout 유지)
 * 2. Layout.inheritNotFound !== false면 프로젝트 기본 404 사용
 * 3. 설정된 404 페이지가 없으면 DefaultNotFound 컴포넌트
 */
function NotFound({ layoutId, originalUrl, renderElements }: NotFoundProps) {
  const layouts = useRuntimeStore((s) => s.layouts);
  const pages = useRuntimeStore((s) => s.pages);

  // Layout별 404 페이지 찾기
  const layout = layoutId ? layouts.find((l) => l.id === layoutId) : null;
  const notFoundPageId = (layout as RuntimeLayout & { notFoundPageId?: string })
    ?.notFoundPageId;

  // 프로젝트 기본 404은 아직 미구현 (TODO: Project 타입에 defaultNotFoundPageId 추가 후)
  // const projectDefaultNotFoundPageId = project?.defaultNotFoundPageId;

  // Layout에 notFoundPageId가 있으면 해당 페이지 사용
  if (notFoundPageId) {
    const notFoundPage = pages.find((p) => p.id === notFoundPageId);
    if (notFoundPage) {
      return (
        <LayoutNotFoundPage
          pageId={notFoundPageId}
          renderElements={renderElements}
        />
      );
    }
  }

  // 기본 404 컴포넌트
  return <DefaultNotFound originalUrl={originalUrl} />;
}

// ============================================
// Router Navigator (navigate 함수 추출용)
// ============================================

interface RouterNavigatorProps {
  onNavigateReady: (navigate: NavigateFunction) => void;
}

function RouterNavigator({ onNavigateReady }: RouterNavigatorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const setCurrentPath = useRuntimeStore((s) => s.setCurrentPath);

  useEffect(() => {
    onNavigateReady(navigate);
  }, [navigate, onNavigateReady]);

  // 경로 변경 시 스토어 업데이트
  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname, setCurrentPath]);

  return null;
}

// ============================================
// Canvas Router Component
// ============================================

interface CanvasRouterProps {
  renderElements: () => React.ReactNode;
  children?: React.ReactNode;
}

export function CanvasRouter({ renderElements, children }: CanvasRouterProps) {
  const pages = useRuntimeStore((s) => s.pages);
  const layouts = useRuntimeStore((s) => s.layouts);
  const currentPath = useRuntimeStore((s) => s.currentPath);
  const [navigate, setNavigate] = useState<NavigateFunction | null>(null);

  const handleNavigateReady = React.useCallback((nav: NavigateFunction) => {
    setNavigate(() => nav);
  }, []);

  // 초기 경로 설정
  const initialEntries = [currentPath || "/"];

  // ⭐ Nested Routes & Slug System: 각 페이지의 최종 URL 계산
  const routeConfigs = useMemo(() => {
    // RuntimePage를 URL generator 입력 shape 로 변환
    const pagesAsPage: UrlPage[] = pages.map((p) =>
      withPageFrameBinding(
        {
          id: p.id,
          title: p.title,
          slug: p.slug,
          project_id: "", // Canvas에서는 사용하지 않음
          parent_id: p.parent_id,
        },
        getNullablePageFrameBindingId(p),
      ),
    );

    const configs = pages.map((page) => {
      // Layout 찾기
      const pageLayoutId = getNullablePageFrameBindingId(page);
      const layout = pageLayoutId
        ? layouts.find((l: RuntimeLayout) => l.id === pageLayoutId)
        : null;

      // 최종 URL 계산
      const finalUrl = generatePageUrl({
        page: withPageFrameBinding(
          {
            id: page.id,
            title: page.title,
            slug: page.slug,
            project_id: "",
            parent_id: page.parent_id,
          },
          pageLayoutId,
        ),
        layout: layout
          ? {
              id: layout.id,
              name: layout.name,
              project_id: "",
              slug: layout.slug || undefined,
            }
          : null,
        allPages: pagesAsPage,
      });

      return {
        pageId: page.id,
        path: finalUrl,
        layoutId: pageLayoutId,
        isDynamic: hasDynamicParams(finalUrl),
      };
    });

    // 정적 라우트가 동적 라우트보다 먼저 매칭되도록 정렬
    // React Router는 순서대로 매칭하므로 /products/new가 /products/:id 보다 먼저 와야 함
    return configs.sort((a, b) => {
      // 정적 라우트가 먼저
      if (a.isDynamic && !b.isDynamic) return 1;
      if (!a.isDynamic && b.isDynamic) return -1;
      // 더 구체적인 경로가 먼저 (세그먼트 수가 많은 것)
      const aSegments = a.path.split("/").length;
      const bSegments = b.path.split("/").length;
      return bSegments - aSegments;
    });
  }, [pages, layouts]);

  return (
    <RouterContext.Provider value={{ navigate }}>
      <MemoryRouter initialEntries={initialEntries}>
        <RouterNavigator onNavigateReady={handleNavigateReady} />
        <Routes>
          {/* ⭐ Nested Routes: 동적으로 계산된 URL로 페이지 라우트 생성 */}
          {routeConfigs.map(({ pageId, path }) => (
            <Route
              key={pageId}
              path={path}
              element={
                <PageRenderer pageId={pageId} renderElements={renderElements} />
              }
            />
          ))}

          {/* 페이지가 없을 때 기본 라우트 */}
          {pages.length === 0 && (
            <Route path="/" element={<>{renderElements()}</>} />
          )}

          {/* 404 페이지 - Layout별 404 또는 기본 404 */}
          <Route
            path="*"
            element={<NotFound renderElements={renderElements} />}
          />
        </Routes>
        {children}
      </MemoryRouter>
    </RouterContext.Provider>
  );
}

// Legacy alias
export const PreviewRouter = CanvasRouter;
export type PreviewRouterProps = CanvasRouterProps;

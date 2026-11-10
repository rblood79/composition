import { JSX, useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { LucideProvider } from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router";
import { initPerformanceDiagnostics } from "./utils/performance/diagnostics";
import { cleanupLegacyStorage } from "./lib/legacyStorageCleanup";
import { setAssetUrlResolverLoader } from "@composition/shared/utils";
import { startRuntimeErrorLog } from "./builder/performance/runtimeErrorLog";
import { notifyRouteCommitted } from "./utils/ui/viewTransition";
import { releaseStaticShellOutsideBuilder } from "./staticShell/staticShellRelease";

// 잡히지 않은 오류를 페이지 안에 모은다 — dev 는 __composition_RUNTIME_ERRORS__ 로 읽힌다.
startRuntimeErrorLog();

// Phase 9: Performance monitors are opt-in diagnostics in dev mode.
initPerformanceDiagnostics();

// 제거된 기능이 사용자 브라우저에 남긴 localStorage 키 정리 (idempotent).
cleanupLegacyStorage();
// ADR-235 — 이 실행 문맥 (builder 문서) 의 자산 해석기. Publish 는 별도 문서 (`publish/index.html`,
//   ADR-305) 라 자기 프로젝트 파일의 해석기를 쓴다.
//   구현은 첫 `asset:` 참조를 만났을 때 불러온다 (initial 밖 — HC2).
setAssetUrlResolverLoader(() =>
  import("./lib/assets/assetUrlResolver").then((m) =>
    m.installIndexedDbAssetUrlResolver(),
  ),
);
import "./fonts/initBuiltinFonts";
import "./builder/fonts/initCustomFonts";

// Pretendard @font-face — JS import 라야 Vite 가 woff/woff2 를 해시 자산 URL 로 고친다 (index.css
// 머리말 참조, Preview 와 같은 경로).
import "pretendard/dist/web/static/pretendard.css";
// Single CSS entry point - all imports handled in index.css via @import
import "./index.css";
import App from "./App.tsx";
// ADR-305 — 빌더 chrome 위젯 시트. 사용자 컴포넌트 시트 (생성 · 공유 수동) 는 싣지 않는다 — 빌더 위젯에
// 맞던 규칙의 사본을 원래 시트 순서로 둔다 (App.css 뒤 · dashboard/builder CSS 앞 — 빌더가 사용자 컴포넌트 묶음을 싣던 자리).
import "./builder/styles/widgets/index.css";
import Dashboard from "./dashboard";
import Builder from "./builder";
import Signin from "./auth/Signin";
import { I18nProvider, getStoredLocale, loadLocaleMessages } from "./i18n";

import { readValidAuth } from "./auth/license/localAuth";
import {
  ParticleBackground,
  ParticleBackgroundProvider,
} from "./components/ParticleBackground";

/**
 * 로컬 라이선스 인증 게이트 — 서버 세션 없음 (폐쇄망).
 * 기록이 있고 만료 전이면 즉시 통과, 아니면 /signin. 동기라 Loading 상태가 없다.
 */
export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  if (!readValidAuth()) {
    return (
      <Navigate to="/signin" replace state={{ from: location.pathname }} />
    );
  }
  return children;
};

function AppLayout() {
  const location = useLocation();
  // 화면 전환 View Transition 이 새 경로 commit 을 기다린다 (utils/ui/viewTransition)
  useLayoutEffect(() => notifyRouteCommitted(), [location.key]);
  // ADR-247 — builder 깊은 링크가 다른 경로로 끝나면 (인증 없음 → /signin) 정적 셸을 치운다.
  useLayoutEffect(() => {
    if (!location.pathname.startsWith("/builder/")) {
      releaseStaticShellOutsideBuilder();
    }
  }, [location.pathname]);
  const shouldShowBackground =
    location.pathname === "/" ||
    location.pathname === "/signin" ||
    location.pathname === "/dashboard";

  return (
    <>
      {shouldShowBackground && <ParticleBackground />}
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/signin" element={<Signin />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/builder/:projectId"
          element={
            <ProtectedRoute>
              <Builder />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

const root = document.getElementById("root");

// GitHub Pages 배포 시 /composition/ 경로 사용
const basename = import.meta.env.PROD ? "/composition" : "/";

// ADR-152 Phase 5 후속: React Query 소비처 0 (useDataQueries 삭제) — QueryClientProvider 제거.
// Only the stored locale's messages ship (one chunk per language) — load it before the first
// render so every string is there synchronously. A failed load still renders: the provider then
// waits for the chunk itself.
void loadLocaleMessages(getStoredLocale())
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(root!).render(
      // 빌더 chrome 의 lucide 아이콘은 선 굵기를 화면 px 그대로 그린다 (`vector-effect:
      //   non-scaling-stroke`) — 24 기준 그림을 16 · 14 로 줄여도 `strokeWidth` 가 정확한 값이다
      //   (사용자 결정 2026-11-11 — 굵기 1px, 종전 16px 아이콘의 2 는 1.33px 로 보였다). Preview · Publish 는
      //   다른 React root (preview.html) 라 사용자 컴포넌트 아이콘은 영향이 없다.
      <LucideProvider nonScalingStroke strokeWidth={1}>
        <I18nProvider>
          <BrowserRouter basename={basename}>
            <ParticleBackgroundProvider>
              <AppLayout />
            </ParticleBackgroundProvider>
          </BrowserRouter>
        </I18nProvider>
      </LucideProvider>,
    );
  });

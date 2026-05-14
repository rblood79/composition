import { useEffect, useState, JSX, lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { isReactQueryDevtoolsEnabled } from "./utils/featureFlags";
import { initPerformanceDiagnostics } from "./utils/performance/diagnostics";

// Phase 9: Performance monitors are opt-in diagnostics in dev mode.
initPerformanceDiagnostics();
import "./builder/utils/migrateGlobal";
import "./fonts/initBuiltinFonts";
import "./builder/fonts/initCustomFonts";

// Single CSS entry point - all imports handled in index.css via @import
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./dashboard";
import Builder from "./builder";
import Signin from "./auth/Signin";

// Lazy load PublishApp to prevent CSS conflicts (CSS loads only when route is accessed)
const PublishApp = lazy(() => import("@composition/publish"));
import { supabase } from "./env/supabase.client";
import { Session } from "@supabase/supabase-js";
import { isDevAutoLoginEnabled, tryDevAutoSignIn } from "./auth/devAutoLogin";
import {
  ParticleBackground,
  ParticleBackgroundProvider,
} from "./components/ParticleBackground";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      let current = (await supabase.auth.getSession()).data.session;
      if (!current && isDevAutoLoginEnabled()) {
        const ok = await tryDevAutoSignIn();
        if (ok) {
          current = (await supabase.auth.getSession()).data.session;
        }
      }
      setSession(current);
      setLoading(false);
    };
    fetchSession();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!session) return <Navigate to="/signin" />;
  return children;
};

function AppLayout() {
  const location = useLocation();
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

        <Route
          path="/publish/*"
          element={
            <Suspense
              fallback={
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  Loading...
                </div>
              }
            >
              <PublishApp />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}

/**
 * React Query Client 설정
 *
 * 🚀 Phase 6: 서버 상태 관리 및 API 캐싱
 *
 * - staleTime: 5분 (데이터가 stale로 간주되기까지의 시간)
 * - gcTime: 30분 (캐시에서 제거되기까지의 시간, 구 cacheTime)
 * - retry: 2회 (실패 시 재시도)
 * - refetchOnWindowFocus: false (창 포커스 시 자동 refetch 비활성화)
 *
 * @since 2025-12-10 Phase 6 React Query
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 30 * 60 * 1000, // 30분 (구 cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById("root");

// GitHub Pages 배포 시 /composition/ 경로 사용
const basename = import.meta.env.PROD ? "/composition" : "/";

ReactDOM.createRoot(root!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename={basename}>
      <ParticleBackgroundProvider>
        <AppLayout />
      </ParticleBackgroundProvider>
    </BrowserRouter>
    {import.meta.env.DEV && isReactQueryDevtoolsEnabled() && (
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition="top-right"
        position="right"
      />
    )}
  </QueryClientProvider>,
);

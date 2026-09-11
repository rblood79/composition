import { useEffect, useState, JSX, lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router";
import { initPerformanceDiagnostics } from "./utils/performance/diagnostics";
import { cleanupLegacyStorage } from "./lib/legacyStorageCleanup";

// Phase 9: Performance monitors are opt-in diagnostics in dev mode.
initPerformanceDiagnostics();

// 제거된 기능이 사용자 브라우저에 남긴 localStorage 키 정리 (idempotent).
cleanupLegacyStorage();
import "./fonts/initBuiltinFonts";
import "./builder/fonts/initCustomFonts";

// Single CSS entry point - all imports handled in index.css via @import
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./dashboard";
import Builder from "./builder";
import Signin from "./auth/Signin";
import { I18nProvider } from "./i18n";

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

const root = document.getElementById("root");

// GitHub Pages 배포 시 /composition/ 경로 사용
const basename = import.meta.env.PROD ? "/composition" : "/";

// ADR-152 Phase 5 후속: React Query 소비처 0 (useDataQueries 삭제) — QueryClientProvider 제거.
ReactDOM.createRoot(root!).render(
  <I18nProvider>
    <BrowserRouter basename={basename}>
      <ParticleBackgroundProvider>
        <AppLayout />
      </ParticleBackgroundProvider>
    </BrowserRouter>
  </I18nProvider>,
);

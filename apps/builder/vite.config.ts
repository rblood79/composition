import { copyFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import type {
  Connect,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  ResolvedConfig,
  ViteDevServer,
} from "vite";
import react from "@vitejs/plugin-react";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import wasm from "vite-plugin-wasm";
import type { IncomingMessage, ServerResponse } from "http";
import {
  SHELL_BUILD_META,
  STATIC_SHELL_ATTRS,
  STATIC_SHELL_MARKUP,
  renderStaticShellScript,
} from "./src/staticShell/staticShell";

/** Builder UI i18n (`SupportedLocale`) 과 같은 en-US / ko-KR 만 RAC 문자열에 남긴다. */
function racLocalesPlugin() {
  return {
    ...optimizeLocales.vite({ locales: ["en-US", "ko-KR"] }),
    enforce: "pre" as const,
  };
}

/**
 * 범용 API 프록시 미들웨어
 * 사용법: /api/proxy?url=https://pokeapi.co/api/v2/pokemon
 */
function createProxyMiddleware(): Connect.NextHandleFunction {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) => {
    // 모든 /api 요청 로깅
    if (req.url?.startsWith("/api")) {
      console.log(`\n📥 [Proxy] Request received: ${req.method} ${req.url}`);
    }

    if (!req.url?.startsWith("/api/proxy")) {
      return next();
    }

    console.log(`🔄 [Proxy] Processing: ${req.url}`);
    const urlObj = new URL(req.url, "http://localhost");
    const targetUrl = urlObj.searchParams.get("url");

    if (!targetUrl) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing url parameter" }));
      return;
    }

    try {
      // 요청 헤더 복사 (호스트 관련 헤더 제외)
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (
          !["host", "connection", "origin", "referer"].includes(
            key.toLowerCase(),
          ) &&
          value
        ) {
          headers[key] = Array.isArray(value) ? value[0] : value;
        }
      }

      // Body 읽기 (POST/PUT 등)
      let body: string | undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        body = await new Promise<string>((resolve) => {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        });
      }

      // 외부 API 호출
      const response = await fetch(targetUrl, {
        method: req.method || "GET",
        headers,
        body,
      });

      // CORS 헤더 추가
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );

      // OPTIONS 요청 처리
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      // 응답 전달
      res.statusCode = response.status;

      // 문제를 일으킬 수 있는 헤더 제외
      const skipHeaders = [
        "access-control",
        "content-encoding",
        "transfer-encoding",
        "content-length",
        "connection",
      ];

      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!skipHeaders.some((skip) => lowerKey.includes(skip))) {
          res.setHeader(key, value);
        }
      });

      const responseBody = await response.text();
      console.log(
        `✅ [Proxy] Response: ${response.status}, ${responseBody.length} bytes`,
      );
      res.end(responseBody);
    } catch (error) {
      console.error("[Proxy Error]", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
  };
}

/**
 * API 프록시 플러그인
 */
function apiProxyPlugin() {
  return {
    name: "api-proxy-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(createProxyMiddleware());
    },
  };
}

/**
 * ADR-246 — dev 서버 정체성. 성능 ratchet 게이트가 이 서버가 어느 워킹트리를 서빙하는지
 * (`root`) 확인하고 준비 완료를 판정한다 (`logLevel: "warn"` 이라 URL 로그가 없다). dev 전용.
 */
function devIdentityPlugin() {
  return {
    name: "composition-dev-identity",
    apply: "serve" as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/__composition_dev_root",
        (_req: IncomingMessage, res: ServerResponse) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              root: resolve(import.meta.dirname, "../.."),
              port: server.config.server.port,
            }),
          );
        },
      );
    },
  };
}

/**
 * GitHub Pages 깊은 링크 — Pages 는 없는 경로에 `404.html` 을 준다. `index.html` 을 그대로
 * 복사해 두면 `/composition/builder/<id>` · `/composition/dashboard` 로 바로 들어와도 SPA 가
 * 부팅하고 `BrowserRouter` 가 경로를 처리한다 (응답 상태는 404). 자산 경로는 base 절대 경로라
 * 깊이와 무관하다.
 */
function spaFallbackPlugin() {
  return {
    name: "spa-fallback-404",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      const dir = options.dir ?? resolve(import.meta.dirname, "dist");
      copyFileSync(resolve(dir, "index.html"), resolve(dir, "404.html"));
    },
  };
}

/**
 * ADR-247 — cold entry 정적 셸. 빌더 `index.html` (빌드는 `404.html` 복사본도) 의 body 맨 앞에
 * 셸 노드와 인라인 script 를 넣는다. 셸은 앱과 같은 class 로 그려 색 · 크기를 main CSS 가 준다
 * (`src/staticShell/staticShell.ts`). preview.html 에는 넣지 않는다.
 * `COMPOSITION_STATIC_SHELL=off` 는 측정 대조군 (셸 없는 같은 빌드) 전용 스위치.
 */
function staticShellPlugin() {
  let base = "/";
  // 빌드마다 새 id — 배포가 바뀌면 CSS 가 바뀌었을 수 있으므로 지난 스냅샷을 쓰지 않는다 (R1).
  let build = "dev";
  return {
    name: "composition-static-shell",
    configResolved(config: ResolvedConfig) {
      base = config.base;
      if (config.command === "build") build = Date.now().toString(36);
    },
    transformIndexHtml(
      _html: string,
      ctx: IndexHtmlTransformContext,
    ): HtmlTagDescriptor[] {
      if (process.env.COMPOSITION_STATIC_SHELL === "off") return [];
      if (!/(^|[\\/])index\.html$/.test(ctx.filename)) return [];
      return [
        {
          tag: "meta",
          attrs: { name: SHELL_BUILD_META, content: build },
          injectTo: "head",
        },
        {
          tag: "div",
          attrs: STATIC_SHELL_ATTRS,
          children: STATIC_SHELL_MARKUP,
          injectTo: "body-prepend",
        },
        {
          tag: "script",
          children: renderStaticShellScript(base, build),
          injectTo: "body-prepend",
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  return {
    logLevel: "warn", // HMR 로그 및 불필요한 콘솔 로그 최소화
    clearScreen: false, // 화면 클리어 비활성화
    plugins: [
      racLocalesPlugin(),
      wasm(),
      apiProxyPlugin(),
      devIdentityPlugin(),
      react(),
      staticShellPlugin(),
      spaFallbackPlugin(),
    ],
    worker: {
      format: "es",
      plugins: () => [wasm()],
    },
    base: command === "build" ? "/composition/" : "/",
    build: {
      // 브라우저 호환성 — Vite 8 baseline-widely-available 기본(Chrome/Edge 111+)
      target: "baseline-widely-available",
      // Vite 8 기본 Lightning CSS는 Tailwind v4 @utility 등을 미지원 → esbuild 유지
      cssMinify: "esbuild",
      // 동적 import 의 JS 는 `<link rel=modulepreload>` 로 미리 받지 않는다 (CSS 는 유지).
      // WebKit 은 실패한 modulepreload 를 메모리 캐시에 남겨, 이후 같은 URL 의 `import()` 가
      // 요청 없이 실패한다 — 새로고침 뒤에도 (ADR-242 후속, Playwright WebKit 실측). 그러면
      // lazy chunk 로드가 한 번 실패한 탭은 다시 시도 · 새로고침으로 복구되지 않는다. 링크 없이
      // `import()` 만 쓰면 실패가 남지 않는다. 대가는 lazy chunk 의 하위 의존 JS 가 병렬이 아닌
      // 순차로 받아지는 것 — initial 공유 chunk 는 이미 실려 있고, 초기 화면 밖 패널은 idle 에
      // 미리 받으므로 체감이 없다.
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter((dep) => dep.endsWith(".css")),
      },
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                // AI lazy 전환이 공통 RAC 코드를 쪼개 Preview gzip을 늘리지 않게 한다.
                // 2개 이상 entry가 이미 정적으로 쓰는 모듈만 묶는다.
                name: "aria-runtime",
                minShareCount: 2,
                tags: ["$initial"],
                test: /node_modules[\\/](?:@react-aria|@react-stately|@react-spectrum|react-aria-components|react-aria|react-stately)[\\/]/,
              },
            ],
          },
        },
        input: {
          main: resolve(import.meta.dirname, "index.html"),
          preview: resolve(import.meta.dirname, "preview.html"),
        },
      },
    },
    resolve: {
      alias: [
        { find: "@", replacement: `${import.meta.dirname}/src` },
        // @composition/shared aliases - must be ordered from most specific to least specific
        {
          find: /^@composition\/shared\/components\/styles\/(.*)$/,
          replacement: `${import.meta.dirname}/../../packages/shared/src/components/styles/$1`,
        },
        {
          find: /^@composition\/shared\/components\/(.*)$/,
          replacement: `${import.meta.dirname}/../../packages/shared/src/components/$1`,
        },
        {
          find: "@composition/shared/components",
          replacement: `${import.meta.dirname}/../../packages/shared/src/components/index.ts`,
        },
        {
          find: "@composition/shared/assets",
          replacement: `${import.meta.dirname}/../../packages/shared/src/assets/index.ts`,
        },
        {
          find: "@composition/shared/utils",
          replacement: `${import.meta.dirname}/../../packages/shared/src/utils/index.ts`,
        },
        {
          find: "@composition/shared/types",
          replacement: `${import.meta.dirname}/../../packages/shared/src/types/index.ts`,
        },
        {
          find: "@composition/shared/renderers",
          replacement: `${import.meta.dirname}/../../packages/shared/src/renderers/index.ts`,
        },
        {
          find: "@composition/shared/hooks",
          replacement: `${import.meta.dirname}/../../packages/shared/src/hooks/index.ts`,
        },
        {
          find: "@composition/shared",
          replacement: `${import.meta.dirname}/../../packages/shared/src/index.ts`,
        },
      ],
    },
    optimizeDeps: {
      // Rust WASM 모듈은 Vite 사전 번들링에서 제외
      exclude: ["composition-wasm"],
      // 주요 의존성의 사전 번들링 강제 (의존성 스캔 오류 방지)
      include: [
        "react",
        "react-dom",
        "react-router",
        "react-aria-components",
        "zustand",
        "three",
        "three/examples/jsm/postprocessing/EffectComposer.js",
        "three/examples/jsm/postprocessing/RenderPass.js",
        "three/examples/jsm/postprocessing/AfterimagePass.js",
        "three/examples/jsm/postprocessing/UnrealBloomPass.js",
        "three/examples/jsm/postprocessing/OutputPass.js",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true, // 포트가 사용 중이면 에러 발생 (자동 증가 방지)
      headers: {
        // Development CORS headers (느슨한 설정)
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        // COEP/COOP 없음 — 외부 API는 /api/proxy 를 통해 호출하므로 불필요
        // JS Self-Profiling API (new Profiler) 허용 — dev 성능 진단용
        "Document-Policy": "js-profiling",
      },
      hmr: {
        overlay: true,
      },
    },
    css: {
      modules: {
        // CSS Modules 설정
        localsConvention: "camelCaseOnly", // 클래스 이름을 camelCase로 변환
        generateScopedName: "[name]__[local]__[hash:base64:5]", // 고유 클래스 이름 생성 규칙
      },
    },
  };
});

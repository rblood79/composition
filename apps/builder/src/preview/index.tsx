/**
 * Preview Runtime Entry Point
 *
 * preview.html에서 로드되는 독립 React 앱입니다.
 * Builder의 main.tsx와 완전히 분리됩니다.
 */

import { createRoot } from "react-dom/client";
import { App } from "./App";
import { injectPreviewBaseStyles } from "./baseStyles";
import { PreviewLocale } from "./PreviewLocale";

// 컴포넌트 CSS 번들 (preview 순서 — 파일 머리말 참조). 컴포넌트 .tsx 는 CSS 를 싣지 않는다.
import "@composition/shared/components/styles/index.css";

// Pretendard 폰트 (Preview iframe은 별도 컨텍스트이므로 독립 로드 필요)
import "pretendard/dist/web/static/pretendard.css";

// 폰트 유틸리티
import {
  loadFontRegistry,
  buildRegistryFontFaceCss,
  ensureAssetRefs,
} from "@composition/shared";
import { installIndexedDbAssetUrlResolver } from "../lib/assets/assetUrlResolver";
import { injectBuiltinFontStyle } from "../fonts/builtinFonts";

// ============================================
// Styles
// ============================================

/**
 * 커스텀 폰트 @font-face CSS를 DOM에 주입합니다.
 * localStorage의 FontRegistry에서 읽어옵니다.
 */
const injectCustomFonts = () => {
  try {
    const registry = loadFontRegistry();
    const apply = () => {
      const css = buildRegistryFontFaceCss(registry);
      let style = document.getElementById("preview-custom-fonts");
      if (!css) {
        style?.remove();
        return;
      }
      if (!style) {
        style = document.createElement("style");
        style.id = "preview-custom-fonts";
        document.head.appendChild(style);
      }
      style.textContent = css;
    };
    apply();
    // ADR-235 — `asset:` 폰트는 준비 뒤 다시 주입 (준비 전 face 는 건너뛴다)
    void ensureAssetRefs(registry).then(apply);
  } catch {
    // FontRegistry 없으면 무시
  }
};

// ============================================
// Initialize Preview Runtime
// ============================================

function initPreviewRuntime() {
  // ADR-235 — 이 실행 문맥의 자산 해석기 (같은 origin IndexedDB → blob:)
  installIndexedDbAssetUrlResolver();
  injectBuiltinFontStyle();
  injectPreviewBaseStyles();
  injectCustomFonts();

  // Canvas 마커 설정
  document.body.setAttribute("data-canvas", "true");
  document.body.setAttribute("data-preview", "true");

  // React를 document.body에 직접 마운트
  // - DOM 트리와 데이터 트리가 완벽히 일치
  // - body element가 실제 <body> 태그와 1:1 매핑
  const reactRoot = createRoot(document.body);
  reactRoot.render(
    <PreviewLocale>
      <App />
    </PreviewLocale>,
  );
}

// ============================================
// Auto-initialize when DOM is ready
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPreviewRuntime);
} else {
  initPreviewRuntime();
}

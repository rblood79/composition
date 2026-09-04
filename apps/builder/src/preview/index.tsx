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

// React Aria 컴포넌트 스타일
import "@composition/shared/components/styles/index.css";

// Pretendard 폰트 (Preview iframe은 별도 컨텍스트이므로 독립 로드 필요)
import "pretendard/dist/web/static/pretendard.css";

// 폰트 유틸리티
import {
  loadFontRegistry,
  buildRegistryFontFaceCss,
} from "@composition/shared";
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
    const css = buildRegistryFontFaceCss(registry);
    if (!css) return;

    const style = document.createElement("style");
    style.id = "preview-custom-fonts";
    style.textContent = css;
    document.head.appendChild(style);
  } catch {
    // FontRegistry 없으면 무시
  }
};

// ============================================
// Initialize Preview Runtime
// ============================================

function initPreviewRuntime() {
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

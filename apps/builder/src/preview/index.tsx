/**
 * Preview Runtime Entry Point
 *
 * preview.html에서 로드되는 독립 React 앱입니다.
 * Builder의 main.tsx와 완전히 분리됩니다.
 */

import { injectPreviewBaseStyles } from "./baseStyles";

// 컴포넌트 CSS 번들 (preview 순서 — 파일 머리말 참조). 컴포넌트 .tsx 는 CSS 를 싣지 않는다.
import "@composition/shared/components/styles/index.css";

// Pretendard 폰트 (Preview iframe은 별도 컨텍스트이므로 독립 로드 필요)
import "pretendard/dist/web/static/pretendard.css";

// 폰트 유틸리티
import { setAssetUrlResolverLoader } from "@composition/shared";
import { injectBuiltinFontStyle } from "../fonts/builtinFonts";
import { injectPreviewCustomFonts } from "./customFontStyle";

// ============================================
// Initialize Preview Runtime
// ============================================

function initPreviewRuntime() {
  // ADR-235 — 이 실행 문맥의 자산 해석기 (같은 origin IndexedDB → blob:). 구현은 첫
  //   `asset:` 참조를 만났을 때 불러온다 (initial 밖 — HC2).
  setAssetUrlResolverLoader(() =>
    import("../lib/assets/assetUrlResolver").then((m) =>
      m.installIndexedDbAssetUrlResolver(),
    ),
  );
  injectBuiltinFontStyle();
  injectPreviewBaseStyles();
  injectPreviewCustomFonts();

  // Canvas 마커 설정
  document.body.setAttribute("data-canvas", "true");
  document.body.setAttribute("data-preview", "true");

  // ADR-248 4e-6/4e-7 — the catalog project's Preview: receiver · replica root · DOM binding (lazy).
  // The Builder opens `preview.html?catalog=1`; the old element-store Preview app is gone from this
  // entry (4e-7), so any query starts the catalog Preview.
  void import("./catalog/catalogPreviewApp").then((m) =>
    m.startCatalogPreview(),
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

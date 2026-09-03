/**
 * Preview Runtime Entry Point
 *
 * preview.html에서 로드되는 독립 React 앱입니다.
 * Builder의 main.tsx와 완전히 분리됩니다.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider as AriaI18nProvider } from "@react-aria/i18n";
import { App } from "./App";
import { getLocaleConfig, getStoredLocale, LOCALE_STORAGE_KEY } from "../i18n";
import { injectPreviewBaseStyles } from "./baseStyles";

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
// Locale
// ============================================

/**
 * Preview 는 별도 문서(iframe)라 빌더의 I18nProvider 아래에 있지 않다. 공유 컴포넌트가
 * 스스로 그리는 상태 문구(로딩/오류/빈 상태)는 주변 locale 을 읽으므로, 여기서 세우지
 * 않으면 작성자가 English 로 두어도 방문자 브라우저 언어가 나온다.
 *
 * 값의 출처는 빌더와 같은 localStorage 키다. 같은 문서에서는 `storage` 가 발생하지 않지만
 * iframe 은 다른 문서라 빌더 쪽 저장이 그대로 여기로 온다 — 언어를 바꾸면 새로고침 없이
 * 따라온다.
 */
function PreviewLocale({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(getStoredLocale);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY) setLocale(getStoredLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // preview.html 은 `lang="ko"` 로 고정돼 있었다 — 문서가 실제 언어를 잘못 말하면
  // 스크린리더 발음과 브라우저 번역 제안이 어긋난다. 빌더 문서와 같은 규칙으로 맞춘다.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocaleConfig(locale).direction;
  }, [locale]);

  return <AriaI18nProvider locale={locale}>{children}</AriaI18nProvider>;
}

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

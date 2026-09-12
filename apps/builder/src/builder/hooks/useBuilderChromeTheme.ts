import { useEffect } from "react";
import { useUiStore } from "../../stores/uiStore";

/**
 * 빌더 chrome 테마 — `data-builder-theme` 를 `<html>` 에 세운다.
 *
 * 이 속성은 색 선택 외에 **"빌더 chrome 이 mount 중"** 이라는 뜻도 겸한다 —
 * builder-system.css 의 portal fallback(`#root` 밖 body 자식)이 이걸 게이트로 쓴다.
 * 대시보드 · 라이선스 활성화 화면이 같이 쓴다 (BuilderCore 와 동형). unmount 시 지운다.
 */
export function useBuilderChromeTheme(): void {
  const themeMode = useUiStore((state) => state.themeMode);

  useEffect(() => {
    const apply = (theme: "light" | "dark") => {
      document.documentElement.setAttribute("data-builder-theme", theme);
    };
    const clear = () => {
      document.documentElement.removeAttribute("data-builder-theme");
    };

    if (themeMode !== "auto") {
      apply(themeMode);
      return clear;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      apply(e.matches ? "dark" : "light");
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      clear();
    };
  }, [themeMode]);
}

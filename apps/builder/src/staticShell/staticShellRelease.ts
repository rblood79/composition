/// <reference lib="dom" />
/**
 * ADR-247 — 정적 셸 교체 · 정리. 앱 initial 번들이 싣는 셸 코드는 이 파일뿐이다 (HC5) — 인라인
 * boot (`staticShell.ts`) 는 initial 밖이다.
 */

export const STATIC_SHELL_ID = "composition-shell";

/**
 * BuilderCore 첫 commit — React 부팅 화면이 같은 자리에 그려진 commit 의 layout effect (paint 전)
 * 에서 셸을 지운다. 테마 속성은 BuilderCore 가 이어받는다 (같은 값).
 */
export function releaseStaticShell(): void {
  document.getElementById(STATIC_SHELL_ID)?.remove();
}

/**
 * builder 가 아닌 경로가 commit 됐는데 셸이 남아 있으면 (builder 깊은 링크 → 인증 없음 → /signin)
 * 셸과 셸이 붙인 테마 속성을 지운다. 셸이 이미 없으면 BuilderCore 가 이어받았으므로 속성은 건드리지
 * 않는다 (속성은 "빌더 mount 중" 게이트 — builder-system.css portal fallback).
 */
export function releaseStaticShellOutsideBuilder(): void {
  const shell = document.getElementById(STATIC_SHELL_ID);
  if (!shell) return;
  shell.remove();
  document.documentElement.removeAttribute("data-builder-theme");
}

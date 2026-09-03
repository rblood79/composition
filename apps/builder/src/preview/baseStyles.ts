/**
 * Preview iframe 전체 CSS reset + canvas 전용 스타일의 단일 소스.
 *
 * 문자열을 모듈로 둔 이유 (2026-09-03): browser parity gate 의 DOM leg 이 shared CSS 만 싣고
 * 이 reset 을 빠뜨리면 `.react-aria-Input { width: 100% }` 가 content-box 로 잡혀 426 > 400 이
 * 나온다 — production Preview 에는 없는 격차가 "DOM 컨트롤 content-box overflow" 로 3 라운드
 * 문서에 남았다. gate 는 반드시 `injectPreviewBaseStyles(document)` 로 같은 문자열을 싣는다.
 */
export const PREVIEW_BASE_STYLES_ID = "canvas-base-styles";

export const PREVIEW_BASE_STYLES = `
    /* ── CSS Reset ── */
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    p { margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    button, input, select, textarea { font-family: inherit; font-feature-settings: inherit; }

    :root {
      font-size: 16px;
    }

    /* font-feature-settings: Pretendard cv 변형 — body 잔존 유지 필수 (한글 타이포 품질) */
    body {
      font-feature-settings: "cv02", "cv03", "cv04", "cv11";
      color: var(--fg, #1a1a1a);
      background: var(--bg, #ffffff);
    }

    /* ── Canvas 전용 스타일 ── */
    .canvas-empty, .preview-empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: #999; font-size: 14px;
    }
    .canvas-loading, .preview-loading {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: #666; font-size: 14px;
    }
    .lasso-selection-box {
      position: fixed;
      border: 2px dashed var(--action-primary-bg, #3b82f6);
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
      z-index: 9999;
    }
    .slot-container { min-height: 40px; }
  `;

export function injectPreviewBaseStyles(doc: Document = document): void {
  if (doc.getElementById(PREVIEW_BASE_STYLES_ID)) return;
  const style = doc.createElement("style");
  style.id = PREVIEW_BASE_STYLES_ID;
  style.textContent = PREVIEW_BASE_STYLES;
  doc.head.appendChild(style);
}

import{t as e}from"./pretendard-BV89QC0O.js";import{t}from"./preload-helper-D_-c9_WX.js";import{Nt as n,Pt as r,jt as i}from"./src-CnHF4A2b.js";import{i as a,r as o}from"./fontRegistry-ChSjt7Gx.js";var s=`canvas-base-styles`,c=`
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
    .preview-not-found {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; gap: 4px; color: #666; font-size: 14px;
    }
    .preview-not-found h1 { font-size: 2rem; margin: 0 0 8px; color: #333; }
    .preview-not-found p { margin: 0; }
    .preview-not-found__path { font-family: ui-monospace, monospace; color: #999; }
    .lasso-selection-box {
      position: fixed;
      border: 2px dashed var(--action-primary-bg, #3b82f6);
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
      z-index: 9999;
    }
    .slot-container { min-height: 40px; }
  `;function l(e=document){if(e.getElementById(`canvas-base-styles`))return;let t=e.createElement(`style`);t.id=s,t.textContent=c,e.head.appendChild(t)}var u=()=>{try{let e=a(),t=document.createElement(`style`);t.id=`preview-custom-fonts`,document.head.appendChild(t);let n=()=>{t.textContent=o(e,i)};n(),r(n)}catch{}};function d(){n(()=>t(()=>import(`./assetUrlResolver-BwNSPRfp.js`).then(e=>e.installIndexedDbAssetUrlResolver()),[])),e(),l(),u(),document.body.setAttribute(`data-canvas`,`true`),document.body.setAttribute(`data-preview`,`true`),t(()=>import(`./catalogPreviewApp-BRyjfojZ.js`).then(e=>e.startCatalogPreview()),[])}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,d):d();
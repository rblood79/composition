import"./modulepreload-polyfill-P2Xu9kJm.js";import{i as e,r as t}from"./fontDefaults-BEEVsTcg.js";import{i as n,r}from"./fontRegistry-cR4D8dng.js";import{i,o as a,s as o}from"./assetRef-BpHGz4iR.js";/* empty css                   */import"./src-DKl3o23o.js";import{t as s}from"./builtinFonts-BbDCXszE.js";import{t as c}from"./preload-helper-CeZ6Hhes.js";var l=`canvas-base-styles`,u=`
    /* ── CSS Reset ── */
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    p { margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    button, input, select, textarea { font-family: inherit; font-feature-settings: inherit; }

    :root {
      font-size: 16px;
      font-family: ${e.fontFamily};
    }

    /* 문서 서체 기능 — Canvas paragraph 와 같은 목록 (CATALOG_FONT_FEATURES) */
    body {
      font-feature-settings: ${t};
      -webkit-font-smoothing: antialiased;
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
  `;function d(e=document){if(e.getElementById(`canvas-base-styles`))return;let t=e.createElement(`style`);t.id=l,t.textContent=u,e.head.appendChild(t)}function f(){try{let e=document.createElement(`style`);e.id=`preview-custom-fonts`,document.head.appendChild(e);let t=()=>{e.textContent=r(n(),i)};t(),o(t),window.addEventListener(`storage`,e=>{(e.key===`composition.font-registry`||e.key===null)&&t()})}catch{}}function p(){a(()=>c(()=>import(`./assetUrlResolver-DrXgX80d.js`).then(e=>e.installIndexedDbAssetUrlResolver()),[])),s(),d(),f(),document.body.setAttribute(`data-canvas`,`true`),document.body.setAttribute(`data-preview`,`true`),c(()=>import(`./catalogPreviewApp-CAvImTj4.js`).then(e=>e.startCatalogPreview()),[])}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,p):p();
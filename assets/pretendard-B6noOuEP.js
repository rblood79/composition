(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`composition-builtin-fonts`;function t(e){let t=`/composition/`;return`${t.endsWith(`/`)?t:`${t}/`}${e.replace(/^\/+/,``)}`}function n(){let e=t(`fonts/PretendardVariable.woff2`),n=t(`fonts/InterVariable.woff2`);return`
    @font-face {
      font-family: "Pretendard";
      src: url("${e}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter";
      src: url("${n}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter Variable";
      src: url("${n}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
  `}function r(t=document){let r=t.getElementById(e),i=n();if(r){r.textContent=i;return}let a=t.createElement(`style`);a.id=e,a.textContent=i,t.head.appendChild(a)}export{r as t};
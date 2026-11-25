import{Yt as e}from"./authoring-BP_lZjn-.js";import"./src-BSZslqft.js";var t=`composition-builtin-fonts`;function n(e){let t=`/composition/`;return`${t.endsWith(`/`)?t:`${t}/`}${e.replace(/^\/+/,``)}`}function r(){let t=n(`fonts/PretendardVariable.woff2`),r=n(`fonts/InterVariable.woff2`);return`
    ${e}
    @font-face {
      font-family: "Pretendard";
      src: url("${t}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter";
      src: url("${r}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter Variable";
      src: url("${r}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
  `}function i(e=document){let n=e.getElementById(t),i=r();if(n){n.textContent=i;return}let a=e.createElement(`style`);a.id=t,a.textContent=i,e.head.appendChild(a)}export{i as t};
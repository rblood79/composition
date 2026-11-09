/**
 * ADR-305 Decision 6 — Publish 별도 진입 (`publish/index.html`). 빌더 문서 (`index.html`) 의 route 가 아니라
 * 자기 문서라서 빌더 CSS (Tailwind · 빌더 chrome · `builder-components.css`) 를 싣지 않는다 — Publish 앱이
 * 직접 싣는 `pretendard.css` 와 `styles/index.css` (사용자 컴포넌트 시트) 만 실린다.
 *
 * 앱은 스스로 선다: 자산 해석기는 불러온 프로젝트 파일의 것 (`App.tsx` `setAssetUrlResolver`), 문구는 방문자
 * 브라우저 locale (`i18n/publishStrings.ts` — provider 없음).
 *
 * 앱은 `import()` 로 싣는다 — 정적으로 싣으면 이 진입의 RAC 가 빌드의 `aria-runtime` 공유 그룹 (`$initial`,
 * 2개 이상 진입 — vite.config.ts) 에 들어가 Preview 첫 로드가 그 묶음을 받는다 (실측 Preview initial JS
 * 151,257 → 527,789 B gz). 옛 빌더 route 도 lazy 였다.
 */
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
void import("@composition/publish").then(({ default: PublishApp }) => {
  createRoot(root).render(<PublishApp />);
});

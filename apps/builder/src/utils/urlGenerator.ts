/**
 * URL Generator — shared 로 이동 (2026-09-20).
 *
 * 정본은 `@composition/shared` `utils/pageUrl.ts` — preview 라우트 표와 publish navigate
 * 해석이 같은 함수를 읽어야 해서 옮겼다. 이 파일은 기존 import 경로 호환용 re-export.
 */
export {
  generatePageUrl,
  hasCircularReference,
  getNestingDepth,
  extractDynamicParams,
  convertToRouterPath,
  fillDynamicParams,
  hasDynamicParams,
  matchDynamicUrl,
  resolvePageIdByPath,
  type UrlPage,
  type UrlLayout,
} from "@composition/shared";

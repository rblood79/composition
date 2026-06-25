/**
 * CSS / 정적 에셋 side-effect import 용 ambient 모듈 선언.
 *
 * **Why (ADR-915, 2026-06-25)**: shared 컴포넌트는 `import "./styles/X.css"` 형태의
 * side-effect import 를 쓴다. 과거에는 tsc 가 src 옆에 emit 한 개별 `X.css.d.ts` shim 이
 * 이 타입을 제공했으나, 그 산출물(.js/.d.ts/.map)이 Vite 의 `.ts` 대신 `.js` 우선 로드를
 * 유발해 HMR 을 오염시켜(커밋 367fe7b3b) 전수 제거했다. shared 는 `vite/client` 를 직접
 * 의존하지 않으므로(builder 와 달리), CSS 모듈 타입을 이 글로벌 ambient 선언 1개로 대체한다.
 * 개별 `*.css.d.ts` 653개를 재생성하지 않는 정석 경로.
 */

declare module "*.css";
declare module "*.scss";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.webp";

/**
 * ADR-244 — builder 부팅이 받는 wasm · 내장 폰트의 URL. 로더 (`initCanvasKit.ts` · `engineWasm.ts`) 와 미리 받기
 * (`dashboard/canvasWarmup.ts`) 가 같은 값을 읽어, 미리 받은 응답과 로더의 요청이 같은 HTTP 캐시
 * 항목이 된다. 로더 모듈을 미리 받기 chunk 가 import 하지 않도록 (정적 가드) URL 만 여기에 둔다.
 */
import canvaskitWasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";

/** CanvasKit wasm — 빌드 산출물 `assets/canvaskit-<hash>.wasm` (ADR-244 D). */
export const CANVASKIT_WASM_URL: string = canvaskitWasmUrl;

/**
 * engine wasm — `vite-plugin-wasm` 이 `engine-pkg/engine.js` 를 위해 내보내는 파일과 같은 자산
 * (`assets/engine_bg-<hash>.wasm`). glob 이라 `engine-pkg` 를 아직 빌드하지 않은 checkout 에서도
 * 변환이 실패하지 않는다 (그때는 undefined — 미리 받기 · 대기 대상에서 빠진다).
 */
export const ENGINE_WASM_URL: string | undefined = Object.values(
  import.meta.glob<string>(
    "../builder/workspace/canvas/wasm-bindings/engine-pkg/engine_bg.wasm",
    { query: "?url", import: "default", eager: true },
  ),
)[0];

/**
 * builder 부팅이 CanvasKit 에 싣는 내장 폰트 (압축 해제 TTF — `loadBuiltinFontsToSkia`). 브라우저
 * (document.fonts · Preview) 는 WOFF2 를 쓴다 (`browserUrl`, `fonts/builtinFonts.ts`). URL 은
 * `resolveFontUrl` 과 같은 값 (Vite 의 `BASE_URL` 은 `/` 로 끝난다) — 그 모듈을 import 하면 Preview 와
 * 공유하는 chunk 가 쪼개져 두 initial 이 늘어난다.
 */
const fontUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function builtinSkiaFonts(): ReadonlyArray<{
  family: string;
  url: string;
  browserUrl?: string;
}> {
  return [
    {
      family: "Pretendard",
      url: fontUrl("fonts/PretendardVariable.ttf"),
    },
    {
      family: "Inter",
      url: fontUrl("fonts/InterVariable.ttf"),
      browserUrl: fontUrl("fonts/InterVariable.woff2"),
    },
  ];
}

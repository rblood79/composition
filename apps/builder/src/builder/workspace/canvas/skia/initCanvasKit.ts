/**
 * CanvasKit/Skia WASM 초기화
 *
 * canvaskit-wasm npm 패키지를 로드하고 싱글톤 인스턴스를 관리한다.
 * initYoga.ts의 HMR 안전 패턴(window 전역 캐시)을 적용한다.
 *
 * ADR-244 D: .wasm 은 빌드 산출물 (`assets/canvaskit-<hash>.wasm`) 이다 — glue chunk 와 같은 빌드의
 * 쌍으로만 쓰인다. 재배포 뒤 옛 탭은 옛 해시가 404 로 실패하고 (조용한 불일치 대신), 부팅 실패
 * 처리 (`staleDeployRecovery.ts`) 가 새로고침으로 새 쌍을 받는다.
 */

import type { CanvasKit } from "canvaskit-wasm";
import canvaskitWasmUrl from "canvaskit-wasm/bin/canvaskit.wasm?url";

const CK_GLOBAL_KEY = "__composition_CANVASKIT_INSTANCE__";
const CK_PROMISE_KEY = "__composition_CANVASKIT_PROMISE__";

declare global {
  interface Window {
    [CK_GLOBAL_KEY]?: CanvasKit;
    [CK_PROMISE_KEY]?: Promise<CanvasKit>;
  }
}

let canvasKit: CanvasKit | null = null;

/**
 * CanvasKit WASM을 비동기 초기화한다.
 *
 * - HMR 시 기존 인스턴스를 재사용하여 중복 초기화를 방지한다.
 * - .wasm 은 `canvaskit-wasm/bin/canvaskit.wasm?url` — Vite 가 해시 경로로 내보낸다.
 */
export async function initCanvasKit(): Promise<CanvasKit> {
  // 1. 모듈 레벨 캐시 확인
  if (canvasKit) return canvasKit;

  // 2. HMR 후 전역에 저장된 인스턴스 복원
  const globalCK = window[CK_GLOBAL_KEY];
  if (globalCK) {
    canvasKit = globalCK;
    return canvasKit;
  }

  // 3. 초기화 중인 Promise 대기 (중복 초기화 방지)
  const existingPromise = window[CK_PROMISE_KEY];
  if (existingPromise) {
    canvasKit = await existingPromise;
    return canvasKit;
  }

  // 4. 새로 초기화
  const promise = (async () => {
    const CanvasKitInit = (await import("canvaskit-wasm")).default;

    const ck = await CanvasKitInit({
      locateFile: (file: string) => {
        // glue 가 다른 파일을 찾으면 (canvaskit-wasm 갱신으로 이름이 바뀜) 조용히 엉뚱한 경로를
        // 주지 않고 실패한다.
        if (file !== "canvaskit.wasm")
          throw new Error(`CanvasKit 이 예상 밖 파일을 요청했다: ${file}`);
        return canvaskitWasmUrl;
      },
    });

    return ck;
  })();

  window[CK_PROMISE_KEY] = promise;

  try {
    canvasKit = await promise;
    window[CK_GLOBAL_KEY] = canvasKit;

    return canvasKit;
  } catch (error) {
    // Promise 캐시 제거하여 재시도 가능하게 함
    delete window[CK_PROMISE_KEY];
    throw new Error(
      `CanvasKit 초기화 실패: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * 초기화된 CanvasKit 인스턴스를 동기적으로 반환한다.
 *
 * @throws initCanvasKit()이 먼저 호출되지 않았으면 에러
 */
export function getCanvasKit(): CanvasKit {
  if (!canvasKit) {
    throw new Error(
      "CanvasKit이 초기화되지 않았습니다. initCanvasKit()을 먼저 호출하세요.",
    );
  }
  return canvasKit;
}

/**
 * CanvasKit이 초기화되었는지 확인
 */
export function isCanvasKitInitialized(): boolean {
  return canvasKit !== null;
}

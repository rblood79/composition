/**
 * ADR-198 Phase 3 — leg 산출물 파일로 내보내기 (test-only)
 *
 * "emit" 이 콘솔 출력이면 안 된다. browser mode 러너는 **통과한 테스트의 로그를
 * 보여주지 않으므로**, 콘솔로만 내면 초록일 때 아무것도 남지 않는다 — 실패했을
 * 때만 보이는 증거는 증거가 아니다.
 *
 * Vitest 의 내장 `writeFile` 커맨드로 러너 프로세스 쪽 파일시스템에 쓴다. 경로는
 * 프로젝트 root(`apps/builder`) 기준이며, 산출물 디렉터리는 자체 `.gitignore` 로
 * 커밋 대상에서 빠진다. Phase 4 의 actual/expected/diff 이미지도 같은 자리를 쓴다.
 */

import type { LegResult } from "./types";

const ARTIFACT_DIR = "tests/visual-parity/.artifacts";

export interface CaptureSummary {
  width: number;
  height: number;
  /** 캡처 배율 = PNG 픽셀 / CSS 픽셀. 1 이 아니면 L3 가 다른 해상도를 비교한다 */
  captureScale: number;
  rgbaHash: string;
  variance: number;
  pngBytes: number;
}

export async function writeLegArtifacts(
  caseId: string,
  leg: LegResult,
  png: Uint8Array,
  summary: CaptureSummary,
  /** leg 별 부가 관측값 (핸드셰이크·에러 훅 시점·ack 로그 등) */
  extra?: Record<string, unknown>,
): Promise<void> {
  const { server } = await import("vitest/browser");

  const manifest = {
    case: caseId,
    leg: leg.legId,
    fixtureChecksum: leg.fixtureChecksum,
    environmentChecksum: leg.environmentChecksum,
    resourceChecksum: leg.resourceChecksum,
    capture: summary,
    nodeOrder: leg.nodeOrder,
    geometry: leg.geometry,
    styles: leg.styles,
    externalRequests: leg.externalRequests,
    consoleErrors: leg.consoleErrors,
    ...extra,
  };

  await server.commands.writeFile(
    `${ARTIFACT_DIR}/${caseId}.${leg.legId}.json`,
    JSON.stringify(manifest, null, 2),
  );

  let binary = "";
  for (let i = 0; i < png.length; i++) binary += String.fromCharCode(png[i]);
  await server.commands.writeFile(
    `${ARTIFACT_DIR}/${caseId}.${leg.legId}.png`,
    btoa(binary),
    "base64",
  );
}

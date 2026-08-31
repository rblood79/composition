/**
 * ADR-198 Phase 1 — L0 identity gate + 환경 매니페스트 (test-only)
 *
 * **픽셀 비교보다 먼저 실행된다.** 두 leg 이 같은 문서·같은 환경·같은 노드 순서를
 * 보지 않았다면 그 뒤의 diff 수치는 무의미하다 — 그런 케이스는 "발산" 이 아니라
 * harness error 로 떨어져야 한다 (breakdown §3.1, R1).
 */

import type {
  EnvironmentManifest,
  LegResult,
  ParityFailure,
  ParityVerdict,
} from "./types";

/** 객체 키 순서를 정규화한 FNV-1a 32bit. 암호학적 용도 아님. */
export function stableChecksum(value: unknown): string {
  const canonicalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonicalize);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) out[k] = canonicalize(o[k]);
      return out;
    }
    return v;
  };
  const json = JSON.stringify(canonicalize(value));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function captureEnvironment(overrides: {
  canvasKitVersion: string;
  surfaceBackend: EnvironmentManifest["surfaceBackend"];
  viewport: { width: number; height: number };
  theme: "light" | "dark";
}): EnvironmentManifest {
  return {
    canvasKitVersion: overrides.canvasKitVersion,
    surfaceBackend: overrides.surfaceBackend,
    userAgent: navigator.userAgent,
    viewport: overrides.viewport,
    // 파일럿은 DPR 1 로 고정한다 — 기기별 DPR 이 섞이면 결정성이 깨진다 (HC4).
    devicePixelRatio: 1,
    theme: overrides.theme,
    locale: "en-US",
    colorScheme: overrides.theme,
    reducedMotion: true,
  };
}

/**
 * 환경 체크섬에서 **의도적으로 제외**하는 필드가 있다: `surfaceBackend` 와
 * `userAgent`. 두 leg 은 설계상 서로 다른 backend 를 쓰고(SW vs DOM), UA 는 leg
 * 별로 같지만 러너 버전에 따라 흔들린다. 체크섬은 "두 leg 이 같은 **입력 조건**을
 * 봤는가" 를 묻는 것이지 "같은 렌더러인가" 를 묻는 게 아니다. backend 자체는
 * 별도로 `PARITY-ENV` 가 검사한다.
 */
export function environmentChecksum(env: EnvironmentManifest): string {
  const { surfaceBackend: _b, userAgent: _u, ...comparable } = env;
  return stableChecksum(comparable);
}

/**
 * L0 — 두 leg 이 같은 입력을 봤는가. 픽셀을 보기 전에 통과해야 한다.
 *
 * `expectedNodeIds` 는 **아티보드 컨테이너를 뺀 콘텐츠 노드**다. 아티보드는
 * 비교 대상이 아니라 비교의 기준틀이라 두 leg 이 서로 다르게 표현한다 —
 * Skia 는 surface 자체라 노드가 없고, Preview 는 DOM 컨테이너가 필요해 div 를 낸다.
 * (`VisualParityCase.artboardNodeId` 주석 참조.)
 *
 * 이 제외가 **진짜 발산을 가리지 않는다**는 것은 아래 두 장치가 보장한다:
 * 콘텐츠 노드가 하나라도 빠지면 여전히 `PARITY-L0-IDENTITY` 이고 (negative (c)),
 * 아티보드의 시각 속성은 §3.6 normalization 의 crop + 배경 처리가 덮는다.
 */
export function checkIdentity(
  a: LegResult,
  b: LegResult,
  expectedNodeIds: readonly string[],
): ParityVerdict {
  const failures: ParityFailure[] = [];

  if (a.fixtureChecksum !== b.fixtureChecksum) {
    failures.push({
      code: "PARITY-L0-IDENTITY",
      layer: "L0",
      first: "fixtureChecksum",
      detail: `${a.legId}=${a.fixtureChecksum} vs ${b.legId}=${b.fixtureChecksum} — 두 leg 이 다른 문서를 봤다`,
    });
  }

  if (a.environmentChecksum !== b.environmentChecksum) {
    failures.push({
      code: "PARITY-ENV",
      layer: "env",
      first: "environmentChecksum",
      detail: `${a.legId}=${a.environmentChecksum} vs ${b.legId}=${b.environmentChecksum}`,
    });
  }

  for (const leg of [a, b]) {
    const missing = expectedNodeIds.filter((id) => !leg.nodeOrder.includes(id));
    if (missing.length > 0) {
      failures.push({
        code: "PARITY-L0-IDENTITY",
        layer: "L0",
        first: missing[0],
        detail: `${leg.legId} 에 기대 노드 ${missing.length}개 없음: ${missing.join(", ")}`,
      });
    }
  }

  // 순서 — 기대 노드만 뽑아 비교한다. leg 별 부수 노드(래퍼 등)는 순서 판정에서 제외.
  const orderOf = (leg: LegResult) =>
    leg.nodeOrder.filter((id) => expectedNodeIds.includes(id));
  const [oa, ob] = [orderOf(a), orderOf(b)];
  if (oa.join(">") !== ob.join(">")) {
    failures.push({
      code: "PARITY-L0-IDENTITY",
      layer: "L0",
      first: oa.find((id, i) => ob[i] !== id) ?? "(길이 불일치)",
      detail: `노드 순서 불일치 — ${a.legId}=[${oa.join(",")}] vs ${b.legId}=[${ob.join(",")}]`,
    });
  }

  for (const leg of [a, b]) {
    if (leg.consoleErrors.length > 0) {
      failures.push({
        code: "PARITY-ENV",
        layer: "env",
        first: leg.consoleErrors[0],
        detail: `${leg.legId} console/page 에러 ${leg.consoleErrors.length}건`,
      });
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/**
 * liveness — L0 통과 뒤, 픽셀 비교 **전**. 두 leg 이 나란히 비어 있으면 그건
 * parity 가 아니라 harness error 다 (HC11 / R11).
 */
export function checkLiveness(leg: LegResult): ParityVerdict {
  if (leg.paintedNodeCount < 1) {
    return {
      ok: false,
      failures: [
        {
          code: "PARITY-LIVE",
          layer: "live",
          first: leg.legId,
          detail: `${leg.legId} 가 노드를 하나도 칠하지 않았다 — 빈 프레임은 일치가 아니다`,
        },
      ],
    };
  }
  return { ok: true };
}

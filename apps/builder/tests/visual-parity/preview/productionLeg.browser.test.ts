/**
 * ADR-198 Phase 3 — 프로덕션 Preview DOM/CSS leg
 *
 * Skia leg (Phase 2) 의 짝. 같은 fixture 를 **실제 `preview.html` 번들**에
 * canonical postMessage 로 밀어넣고, 픽셀·기하·스타일·리소스·에러를 낸다.
 *
 * ## 여기서 통과시키는 게이트
 *
 * - **G1 entry half (런타임 절반)** — 핸드셰이크 + canonical 경로 생존.
 *   정적 절반(import 증명)은 `../productionPath.browser.test.ts`, 이 단언이
 *   실제로 무언가를 막는다는 증명은 `./simplifiedDomProbe.browser.test.ts`.
 * - **G2 Preview** — 10-run 동일 해시 · 외부 요청 0 · 콘솔/페이지 에러 0.
 *
 * ## 결정성을 PNG 바이트가 아니라 RGBA 로 판정하는 이유
 *
 * PNG 은 인코더 메타데이터를 실을 수 있어 픽셀이 같아도 바이트가 갈릴 수 있다.
 * 디코드한 RGBA 로 해시하면 Skia leg (`rgbaHash`) 과 **같은 기준**이 된다 —
 * 두 leg 의 결정성 주장이 같은 뜻을 갖는다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PILOT_CASES } from "../cases";
import { CASE_PROJECT_ID } from "../cases/scaffold";
import { captureEnvironment } from "../harness/identity";
import { checkLiveness } from "../harness/identity";
import {
  assertProductionEntry,
  PreviewDriver,
} from "../harness/previewDriver";
import { byteDiff, pixelVariance, rgbaHash } from "../harness/pixels";
import { NORMALIZED_STYLE_KEYS } from "../harness/domCapture";
import { writeLegArtifacts } from "../harness/artifacts";
import {
  knownDefectHits,
  unexplainedErrors,
} from "../harness/knownDefects";
import type { LegResult } from "../harness/types";

function envFor(c: (typeof PILOT_CASES)[number]) {
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    // Preview 는 CanvasKit 을 안 쓴다. backend 는 환경 체크섬에서 제외되는
    // 필드라 두 leg 이 서로 다른 값을 보고해도 identity 는 갈리지 않는다
    // (`identity.ts::environmentChecksum` 주석).
    surfaceBackend: "gl",
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

describe("ADR-198 Phase 3 — 프로덕션 Preview leg", () => {
  for (const c of PILOT_CASES) {
    describe(c.id, () => {
      let driver: PreviewDriver;
      let leg: LegResult;
      let shot: {
        png: Uint8Array;
        pixels: Uint8Array;
        width: number;
        height: number;
      };

      beforeAll(async () => {
        driver = new PreviewDriver();
        await driver.start(c.viewport);
        leg = await driver.render(c.document, CASE_PROJECT_ID, envFor(c));
        shot = await driver.capture();
      }, 180_000);

      // 산출물은 **통과했을 때도** 남아야 한다 — browser mode 러너는 통과한
      // 테스트의 콘솔을 보여주지 않는다. 파일로 내야 증거가 된다.
      afterAll(async () => {
        try {
          await writeLegArtifacts(c.id, leg, shot.png, {
            width: shot.width,
            height: shot.height,
            captureScale:
              shot.width / driver.element.getBoundingClientRect().width,
            rgbaHash: rgbaHash(shot.pixels),
            variance: Number(pixelVariance(shot.pixels).toFixed(3)),
            pngBytes: shot.png.length,
          },
          {
            handshakeReceived: driver.handshakeReceived,
            // 에러 훅이 붙은 시점. `complete` 면 부트 구간 콘솔 에러를 못 본
            // 것이므로 "에러 0" 주장의 범위가 좁아진다.
            errorHookReadyState: driver.patchReadyState,
            ackLog: driver.ackLog,
          });
        } finally {
          driver?.stop();
        }
      }, 60_000);

      it("G1 entry half (런타임): 핸드셰이크 + canonical 경로 생존", async () => {
        // 서로 다른 문서 3개를 보내 DOM 이 실제로 따라오는지 본다. 이 단언이
        // 간이 DOM 을 막는다는 증명은 simplifiedDomProbe 가 따로 한다.
        const verdict = await assertProductionEntry(
          driver,
          PILOT_CASES.map((x) => x.document),
        );
        console.log(
          `[ADR-198 P3-G1] ${c.id}: handshake=${driver.handshakeReceived} ` +
            `hookAt=${driver.patchReadyState} ok=${verdict.ok}`,
        );
        expect(verdict.ok, JSON.stringify(verdict)).toBe(true);

        // 에러 훅이 **파싱 중**에 붙었는가. `complete` 에 붙었다면 부트 구간
        // 콘솔 에러를 못 봤다는 뜻이고, 그러면 아래 "에러 0" 주장의 범위가 좁아진다.
        expect(driver.patchReadyState).not.toBe("complete");
      }, 180_000);

      it("G1 identity: 기대 노드가 선언 순서대로 전부 렌더된다", () => {
        const seen = leg.nodeOrder.filter((id) =>
          c.expectedNodeIds.includes(id),
        );
        console.log(
          `[ADR-198 P3-leg] ${c.id}: nodes=${leg.nodeOrder.length} ` +
            `expected=[${c.expectedNodeIds.join(",")}] seen=[${seen.join(",")}]`,
        );
        expect(seen).toEqual(c.expectedNodeIds);
        expect(checkLiveness(leg).ok).toBe(true);
      });

      it("산출물: PNG · bounds · 정규화 style · 리소스 체크섬", () => {
        const rect = driver.element.getBoundingClientRect();
        console.log(
          `[ADR-198 P3-dpr] ${c.id}: attr=${c.viewport.width}x${c.viewport.height} ` +
            `rect=${rect.width.toFixed(2)}x${rect.height.toFixed(2)} ` +
            `shot=${shot.width}x${shot.height} outerDPR=${window.devicePixelRatio} ` +
            `innerDPR=${driver.element.contentWindow?.devicePixelRatio} ` +
            `win=${window.innerWidth}x${window.innerHeight}`,
        );
        // PNG magic — 존재가 아니라 내용을 본다
        expect(Array.from(shot.png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

        // 캡처 배율 1:1. Vitest 는 tester iframe 을 창에 맞게 CSS 로 축소하므로
        // viewport 를 창보다 크게 잡으면 PNG 이 조용히 작아진다 (실측 0.80 배).
        // 그 상태로 L3 를 재면 리샘플링 오차가 예산 안에 숨는다 —
        // `vitest.visual-parity.config.ts` 의 뷰포트 핀이 지키는 값이 이것이다.
        expect(rect.width).toBe(c.viewport.width);
        expect(rect.height).toBe(c.viewport.height);
        expect(shot.width, "캡처 배율이 1 이 아니다").toBe(rect.width);
        expect(shot.height, "캡처 배율이 1 이 아니다").toBe(rect.height);
        expect(shot.pixels.length).toBe(shot.width * shot.height * 4);

        // bounds — 모든 기대 노드가 실제 상자를 갖는다 (display:contents 래퍼를
        // 잘못 집으면 0 이 나오므로 이건 vacuous 하지 않다)
        for (const id of c.expectedNodeIds) {
          const box = leg.geometry[id];
          expect(box, `${id} 의 geometry 없음`).toBeTruthy();
          expect(box.width, `${id} 의 폭 0`).toBeGreaterThan(0);
          expect(box.height, `${id} 의 높이 0`).toBeGreaterThan(0);
        }

        // 정규화 style — L2 입력. 키가 전부 채워져야 한다
        for (const id of c.expectedNodeIds) {
          const s = leg.styles?.[id];
          expect(s, `${id} 의 style 없음`).toBeTruthy();
          expect(Object.keys(s!).sort()).toEqual(
            [...NORMALIZED_STYLE_KEYS].sort(),
          );
        }

        expect(leg.resourceChecksum).toBeTruthy();
        // HC11 variance floor — 단색 프레임은 "일치" 가 아니라 harness error 다.
        expect(
          pixelVariance(shot.pixels),
          "Preview 프레임이 단색이다 (PARITY-LIVE)",
        ).toBeGreaterThan(0);
        console.log(
          `[ADR-198 P3-leg] ${c.id}: png=${shot.png.length}B ${shot.width}x${shot.height} ` +
            `variance=${pixelVariance(shot.pixels).toFixed(1)} ` +
            `resourceChecksum=${leg.resourceChecksum} ` +
            `bg(body)=${leg.styles?.[c.expectedNodeIds[0]]?.["background-color"]}`,
        );
      });

      it("G2 Preview: 외부 요청 0 · 설명되지 않은 콘솔/페이지 에러 0", () => {
        const unexplained = unexplainedErrors(c.id, leg.consoleErrors);
        const ratchets = knownDefectHits(c.id, leg.consoleErrors);

        console.log(
          `[ADR-198 P3-G2] ${c.id}: external=${leg.externalRequests?.length ?? -1} ` +
            `errors=${leg.consoleErrors.length} known=${ratchets.length} ` +
            `unexplained=${unexplained.length}` +
            (unexplained.length > 0 ? ` first="${unexplained[0]}"` : ""),
        );

        expect(leg.externalRequests ?? []).toEqual([]);
        expect(unexplained).toEqual([]);

        // ratchet — 정확히 이 횟수여야 한다. 고쳐지면 여기서 깨지고, 그때
        // knownDefects.ts 에서 지우는 것이 올바른 대응이다.
        for (const { defect, hits } of ratchets) {
          expect(hits, `ratchet 불일치 — ${defect.note}`).toBe(defect.count);
        }
      });

      it("checksum 키 ack: 같은 문서는 같은 지문, 다른 문서는 다른 지문", async () => {
        const other = PILOT_CASES.find((x) => x.id !== c.id)!;
        const before = driver.ackLog.length;

        await driver.render(c.document, CASE_PROJECT_ID, envFor(c));
        await driver.render(other.document, CASE_PROJECT_ID, envFor(c));
        await driver.render(c.document, CASE_PROJECT_ID, envFor(c));

        const [a, b, d] = driver.ackLog.slice(before);
        console.log(
          `[ADR-198 P3-ack] ${c.id}: same=${a.fixtureChecksum}/${a.domFingerprint} ` +
            `other=${b.fixtureChecksum}/${b.domFingerprint} back=${d.domFingerprint}`,
        );
        // 같은 문서 → 같은 지문 (왕복 뒤에도 복귀한다 = stale DOM 이 아니다)
        expect(a.fixtureChecksum).toBe(d.fixtureChecksum);
        expect(a.domFingerprint).toBe(d.domFingerprint);
        // 다른 문서 → 다른 지문 (이 방향이 load-bearing)
        expect(b.fixtureChecksum).not.toBe(a.fixtureChecksum);
        expect(b.domFingerprint).not.toBe(a.domFingerprint);
      }, 180_000);

      it("G2 Preview: 10회 연속 RGBA 해시 동일 + 서로 간 maxByte 0", async () => {
        // 앞 테스트가 다른 문서를 보냈을 수 있으니 이 케이스로 되돌린 뒤 시작한다.
        await driver.render(c.document, CASE_PROJECT_ID, envFor(c));
        const first = await driver.capture();
        const hashes = new Set([rgbaHash(first.pixels)]);
        let worst = 0;

        for (let i = 1; i < 10; i++) {
          await driver.render(c.document, CASE_PROJECT_ID, envFor(c));
          const next = await driver.capture();
          hashes.add(rgbaHash(next.pixels));
          worst = Math.max(worst, byteDiff(first.pixels, next.pixels).maxByte);
        }

        console.log(
          `[ADR-198 P3-G2] ${c.id}: distinct=${hashes.size} ` +
            `hash=${rgbaHash(first.pixels)} worstMaxByte=${worst}`,
        );
        expect(hashes.size).toBe(1);
        expect(worst).toBe(0);
      }, 300_000);
    });
  }
});

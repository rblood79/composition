/**
 * ADR-198 Phase 0 — G0 Skia leg 파일럿 (프로덕션 경로)
 *
 * doctor.browser.test.ts 가 "CanvasKit 이 이 host 에서 살아 있다" 를 증명했다면,
 * 이 파일은 **canonical `CompositionDocument` 하나가 프로덕션 함수 체인만 거쳐
 * `ck.MakeSurface` PNG 에 도달하는가** 를 증명한다. HC2(one fixture authority) +
 * HC3(production consumer paths) 의 Skia 쪽 절반이다.
 *
 * ## 체인
 *
 * Phase 1 에서 체인 자체는 `../harness/skiaRunner.ts` 로 옮겼다 — identity 테스트가
 * 같은 체인을 케이스 3개에 돌려야 하는데, 테스트 파일에 갇혀 있으면 두 번째 소비자가
 * 체인을 복제하게 되고 그 순간 "테스트 전용 Skia 경로" 가 생겨 HC3 가 깨진다.
 * 단계별 프로덕션 export 목록은 그 모듈 헤더에 있다.
 *
 * ## Phase 0 에서 실측으로 드러난 계약 3개 (Phase 1 fixture 작성 전 필독)
 *
 * 1. **Skia node registry 없이는 아무것도 안 그려진다.** `renderCommands.visitElement`
 *    (renderCommands.ts:1392) 가 `getSkiaNode(id)` 부재 시 즉시 return 하므로,
 *    layout 발행만으로는 `buildSkiaFrameContent` 가 빈 boundsMap → null 을 준다.
 *    `StoreRenderBridge.sync` 가 필수 단계다.
 * 2. **catalog 배경 채널은 hex6 전용.** `#2F6FEDFF`(hex8) 을 넣으면
 *    `hexStringToNumber` 채널이 밀려 `0.435,0.929,1,0` 으로 읽힌다
 *    (buildSpecNodeData.ts:1720 주석의 실측 계약).
 * 3. **컨테이너 타입마다 배경 도달 여부가 다르다.** 같은 `props.style.backgroundColor`
 *    에 대해 `Card`/`Toolbar` 는 alpha 1 로 칠해지고, `frame`/`Group` 은
 *    `fill=0,0,0,0` 으로 남는다 (Frame.spec 이 layout 컨테이너라 배경 shape 을
 *    만들지 않음). Phase 6 매트릭스는 이 차이를 타입별로 명시해야 하며, 그전까지
 *    파일럿은 배경이 실제로 도달하는 타입을 쓴다.
 *
 * ## fixture 계약
 *
 * 텍스트 0 (폰트 의존 배제), transition/animation 0 (wall-clock 미독출 — HC5),
 * 중첩 컨테이너 + border/radius + 단색 fill 만.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";

import {
  createPilotDocument,
  FIXTURE_ARTBOARD,
  FIXTURE_PAGE_ID,
} from "../harness/fixture";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { runSkiaLeg } from "../harness/skiaRunner";
import { byteDiff, pixelVariance, pixelAt, rgbaHash } from "../harness/pixels";

// ── fixture 상수 ─────────────────────────────────────────────────────────

const PAGE_ID = FIXTURE_PAGE_ID;
const PAGE_W = FIXTURE_ARTBOARD.width;
const PAGE_H = FIXTURE_ARTBOARD.height;

/** body 배경 — 흰색. */
const BG: [number, number, number, number] = [0xff, 0xff, 0xff, 0xff];
/** 바깥 box fill — 파랑. */
const OUTER: [number, number, number, number] = [0x2f, 0x6f, 0xed, 0xff];
/** 안쪽 box fill — 자홍. */
const INNER: [number, number, number, number] = [0xd9, 0x26, 0x4f, 0xff];

/** 파일럿 문서를 러너에 태우는 얇은 래퍼 — 체인은 `harness/skiaRunner.ts` 소유. */
function runPilot(ck: CanvasKit) {
  return runSkiaLeg(ck, createPilotDocument(), {
    pageId: PAGE_ID,
    width: PAGE_W,
    height: PAGE_H,
  });
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

// ── 테스트 ───────────────────────────────────────────────────────────────

describe("ADR-198 Phase 0 — G0 Skia leg (프로덕션 경로)", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    await initCompositionEngineWasm();
    ck = await initCanvasKit();
  }, 120_000);

  it("canonical fixture 1개가 프로덕션 체인만 거쳐 PNG 에 도달한다 (HC2/HC3)", () => {
    const { png, pixels, layoutNodeCount } = runPilot(ck);

    // PNG 실체
    expect(png.length).toBeGreaterThan(0);
    expect(Array.from(png.slice(0, 4))).toEqual(PNG_MAGIC);

    const variance = pixelVariance(pixels);

    console.log(
      `[ADR-198 P0-skia] png=${png.length}B layoutNodes=${layoutNodeCount} ` +
        `hash=${rgbaHash(pixels)} variance=${variance.toFixed(1)} ` +
        `bg(4,4)=${pixelAt(pixels, PAGE_W, 4, 4).join(",")} ` +
        `outer(30,30)=${pixelAt(pixels, PAGE_W, 30, 30).join(",")} ` +
        `inner(60,60)=${pixelAt(pixels, PAGE_W, 60, 60).join(",")}`,
    );
  });

  /**
   * **현재 이 leg 은 백색 프레임을 낸다.** 통합 fixture(`harness/fixture.ts`)로
   * 프로덕션 체인을 다 태워도 `variance = 0`, `outer(30,30) = 255,255,255,255`.
   *
   * `it.fails` 로 두는 이유: 통과시키려고 입력을 바꾸면(컨테이너를 `Card` 로, 색을
   * hex6 로) 게이트가 유리한 입력만 재는 도구가 된다 (measurement-validity §1 Q2).
   * 반대로 red 로 두면 스위트를 commit 할 수 없다. `it.fails` 는 **ratchet** 이다 —
   * 칠해지기 시작하는 순간 이 테스트가 실패해서 기록 갱신을 강제한다.
   *
   * **이건 fixture 문제가 아니라 실제 발산이다.** 같은 fixture(같은 checksum)를
   * Preview leg 은 세 노드 전부 칠한다 — `previewLeg.browser.test.ts` 실측으로
   * `body/outer/inner` 3/3, geometry 도 선언값과 일치, PNG 1251B. Skia 만 비어 있다.
   * 즉 하니스가 한 fixture 에서 두 PNG 을 내고 **D3 발산을 실제로 잡아냈다.**
   *
   * **원인은 미규명**: 후보는 (a) `frame` 이 layout 컨테이너라 배경 shape 미생성,
   * (b) catalog 배경 채널 hex6 전용이라 hex8 alpha 밀림 — 둘 다 백색을 만든다.
   * 이를 가르려던 축약 probe 는 네 조합 모두 `none` 을 반환해 **계측기가 무효**였고
   * 폐기했다. 원인 규명과 수정은 breakdown §7 (Out of Scope) 에 따라 별도 작업이며,
   * 근거 없는 원인 주장을 여기 남기지 않는다.
   */
  it.fails(
    "[미해결 기록] fixture 의 fill 색이 Skia 좌표에 찍힌다 — 현재 실패",
    () => {
      const { pixels } = runPilot(ck);

      expect(pixelAt(pixels, PAGE_W, 4, 4)).toEqual(BG);
      expect(pixelAt(pixels, PAGE_W, 30, 30)).toEqual(OUTER);
      expect(pixelAt(pixels, PAGE_W, 60, 60)).toEqual(INNER);
    },
  );

  it("[미해결 기록] Skia leg 의 현재 liveness 를 0 으로 명시 고정", () => {
    const { pixels } = runPilot(ck);
    const variance = pixelVariance(pixels);

    console.log(
      `[ADR-198 P0-skia] 미해결: variance=${variance.toFixed(1)} ` +
        `outer(30,30)=${pixelAt(pixels, PAGE_W, 30, 30).join(",")}`,
    );

    // 결정성 테스트는 백색 프레임에서도 통과한다 — HC11 liveness 가 없으면
    // 이 leg 은 "건강하고 결정적" 으로 보인다. R11 이 겨냥한 바로 그 상태.
    expect(variance).toBe(0);
  });

  it("결정성: 10회 연속 해시 동일 + 서로 간 maxByte 0 (HC5/G2)", () => {
    const first = runPilot(ck).pixels;
    const baseHash = rgbaHash(first);
    const hashes = new Set<string>([baseHash]);
    let worstMaxByte = 0;

    for (let i = 1; i < 10; i++) {
      const next = runPilot(ck).pixels;
      hashes.add(rgbaHash(next));
      worstMaxByte = Math.max(worstMaxByte, byteDiff(first, next).maxByte);
    }

    console.log(
      `[ADR-198 P0-skia] 10-run: distinct=${hashes.size} hash=${baseHash} worstMaxByte=${worstMaxByte}`,
    );
    expect(hashes.size).toBe(1);
    expect(worstMaxByte).toBe(0);
  });
});

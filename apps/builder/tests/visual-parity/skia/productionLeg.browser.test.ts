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
 * 2. ~~**catalog 배경 채널은 hex6 전용.**~~ (2026-08-31 수리) `#RRGGBBAA` 는
 *    `hexStringToNumber` 가 알파를 잘라내고 `colorValueToFloat32` 가 합성
 *    alpha 로 곱한다. 그전에는 채널이 한 바이트 밀려 `#2F6FEDFF` 가
 *    `111,237,255` 로 그려졌다. `buildSpecNodeData` 의 fills→hex6 분해는
 *    그대로 두었다 — 우회가 아니라 alpha 를 별도 채널로 나르는 설계다.
 * 3. ~~**컨테이너 타입마다 배경 도달 여부가 다르다.**~~ (2026-08-31 수리)
 *    `frame` 이 배경을 안 냈던 것은 타입의 성질이 아니라 `FrameSpec.render.shapes()`
 *    가 `props.style` 을 읽지 않았기 때문이다. 이제 `frame` 도 `Card`/`Toolbar`
 *    와 같이 배경이 도달한다. Phase 6 매트릭스는 타입별 차이를 여전히 명시하되,
 *    "배경이 도달하는 타입만 고른다" 는 제약은 사라졌다 — 그 제약 자체가
 *    유리한 입력만 재는 경로였다.
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
  FIXTURE_COLORS,
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

/**
 * 기대 픽셀은 **fixture 가 authoring 한 색에서 직접 유도한다.**
 *
 * 손으로 적어 두면 fixture 와 조용히 갈린다 — 실제로 갈려 있었다: `INNER` 가
 * `#D9264F` 로 박혀 있었는데 fixture 의 inner 는 `#E8443F` 다. 이 테스트가
 * `it.fails` 인 동안에는 어차피 실패할 예정이라 아무도 눈치채지 못했고, Skia 가
 * 칠하기 시작한 뒤에야 드러났다 (ADR-198, 2026-08-31). 유도해 두면 이 부류의
 * 드리프트가 아예 생기지 않는다.
 */
function rgbaOf(hex8: string): [number, number, number, number] {
  const b = hex8.replace("#", "");
  return [
    parseInt(b.slice(0, 2), 16),
    parseInt(b.slice(2, 4), 16),
    parseInt(b.slice(4, 6), 16),
    b.length === 8 ? parseInt(b.slice(6, 8), 16) : 0xff,
  ];
}

/** body 배경 — 흰색. */
const BG = rgbaOf(FIXTURE_COLORS.body);
/** 바깥 box fill — 파랑. */
const OUTER = rgbaOf(FIXTURE_COLORS.outer);
/** 안쪽 box fill — 붉은색. */
const INNER = rgbaOf(FIXTURE_COLORS.inner);

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
   * **2026-08-31 이 leg 이 칠하기 시작했다** — 이 테스트는 오래도록 `it.fails`
   * ratchet 이었다. Skia 는 `variance 0`, `outer(30,30) = 255,255,255,255` 인
   * 백색 프레임을 냈고, 같은 fixture(같은 checksum)를 Preview 는 세 노드 전부
   * 칠했다. 하니스가 한 fixture 에서 두 PNG 을 내고 D3 발산을 실제로 잡아낸
   * 자리다.
   *
   * 원인은 두 겹이었고 (ADR-198 §7 별도 작업으로 규명), 둘 다 고쳐졌다:
   *
   * 1. `FrameSpec.render.shapes()` 가 `props.style` 을 한 번도 읽지 않았다 —
   *    frame 은 catalog 미등록이라 이 함수가 Skia 가 그릴 것을 정하는 유일한
   *    자리인데, 배경 shape 을 아예 만들지 않았다. → 배경 box 방출.
   * 2. `hexStringToNumber` 가 `#RRGGBBAA` 를 그대로 parse 해 채널이 한 바이트씩
   *    밀렸다 (`#2F6FEDFF` → `111,237,255`). DOM 은 hex8 을 그대로 이해하므로
   *    이것도 D3 발산이었다. → 알파 절단 + `colorValueToFloat32` 가 합성.
   *
   * 이제 세 좌표 모두 fixture 가 authoring 한 색과 정확히 일치한다. 통과가
   * 정상이며, 다시 실패하면 위 두 경로 중 하나가 회귀한 것이다.
   */
  it(
    "fixture 의 fill 색이 Skia 좌표에 그대로 찍힌다 (2026-08-31 수리 완료)",
    () => {
      const { pixels } = runPilot(ck);

      expect(pixelAt(pixels, PAGE_W, 4, 4)).toEqual(BG);
      expect(pixelAt(pixels, PAGE_W, 30, 30)).toEqual(OUTER);
      expect(pixelAt(pixels, PAGE_W, 60, 60)).toEqual(INNER);
    },
  );

  it("Skia leg 이 살아 있는 프레임을 낸다 (HC11 liveness)", () => {
    const { pixels } = runPilot(ck);
    const variance = pixelVariance(pixels);

    console.log(
      `[ADR-198 P0-skia] liveness: variance=${variance.toFixed(1)} ` +
        `outer(30,30)=${pixelAt(pixels, PAGE_W, 30, 30).join(",")}`,
    );

    // 결정성 테스트는 백색 프레임에서도 통과한다 — HC11 liveness 가 없으면
    // 이 leg 은 "건강하고 결정적" 으로 보인다. R11 이 겨냥한 바로 그 상태.
    expect(variance).toBeGreaterThan(0);
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

/**
 * 수동 가이드 렌더러 — ADR-181 Phase 4
 *
 * 사용자가 눈금자에서 끌어낸 **상시 표시** 기준선. 스냅 정렬선
 * (`snapGuideRenderer.ts`) 과 같은 1 screen px 선이지만 성격이 다르다:
 *
 * | 축                | 스냅 정렬선           | 수동 가이드                        |
 * | ----------------- | --------------------- | ---------------------------------- |
 * | 수명              | 드래그 중 순간 피드백 | 문서 데이터 (persist + undo)       |
 * | §8.5 분류         | 조작 표식             | **콘텐츠성 chrome**                |
 * | occlusion / 클립  | 미적용                | `withPageOcclusionClip` + 페이지 rect |
 *
 * **세 상태를 색과 알파가 나눠 진다** (2026-08-14 사용자의 Figma 직접 확인):
 *
 * | 상태            | 색              | 알파 | 연장 | 뜻                  |
 * | --------------- | --------------- | ---- | :--: | ------------------- |
 * | default         | #F24822 웜 레드 | 0.7  |  —   | 계속 떠 있는 기준선 |
 * | hover / 드래그  | #F24822 웜 레드 | 1.0  |  ✅  | **잡을 수 있다**    |
 * | selected        | #6DC1FF 하늘색  | 1.0  |  ✅  | 조작 대상           |
 *
 * **연장은 선택 전용이 아니다** — 만지는 모든 순간(hover·드래그·선택)에 선의
 * 방향 끝까지 이어진다. 연장이 답하는 질문이 "이 선이 어디까지 가는가" 라,
 * 그게 필요한 때는 선택했을 때가 아니라 그 선을 다루는 때이기 때문이다.
 *
 * 두 축이 서로 다른 것을 말한다: **알파는 잡을 수 있는지**(hover), **색은
 * 선택 여부**. 한때 알파로 선택을 표현했는데, 같은 빨강의 명도 차이는 1px 선에서
 * 구분되지 않았다 — 알파 축 자체가 틀린 게 아니라 **붙은 상태가 틀렸다**.
 *
 * 기본색이 스냅 정렬선과 겹치는 것은 Figma 어법 그대로다 — 도입 때는
 * "동시에 보이면 구분이 안 된다" 며 시안(#59A8D7)으로 갈랐는데, 둘의 구분은
 * 색이 아니라 **수명**이 진다: 스냅 정렬선은 드래그 중에만 잠깐 서고 가이드는
 * 계속 남아 있다.
 *
 * 선택색 #6DC1FF 는 요소 선택 파랑(#3B82F6)과 가깝지만 **형태**로 갈린다 —
 * 가이드는 페이지를 가로지르는 가는 선이고 핸들이 없다.
 *
 * 좌표는 scene 이다. 가이드 position 은 페이지-로컬 px 이므로 페이지 위치를
 * 더해 변환하며(빌더 `buildPageGuideTargets`), 그 덕에 페이지를 옮기면
 * (ADR-177) 가이드가 따라온다.
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";

import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { hexToColor4fChannels } from "./themeWatcher";
import type { PageGuideRenderTarget } from "./skiaOverlayHelpers";
import {
  resolveGuideEmphasis,
  type GuideEmphasis,
  type GuideEmphasisIds,
} from "../interaction/guideEmphasis";
import { isGuideWithinPage } from "../interaction/guidePresentation";

/**
 * 한 축을 고정하고 나머지 축으로 뻗는 선 1개.
 *
 * axis "x" = x 좌표를 고정하는 **세로선** (snapGuides 와 같은 어법).
 * 좌표 전치는 이 파일이 실제로 겪은 회귀(커밋 7582f78e6 — 눈금자↔가이드 축
 * 매핑 반전)라, 어법을 한 곳에 가둬 호출부가 좌표 순서를 다시 쓰지 않게 한다.
 */
function drawAxisLine(
  canvas: Canvas,
  axis: "x" | "y",
  position: number,
  from: number,
  to: number,
  paint: Parameters<Canvas["drawLine"]>[4],
): void {
  if (axis === "x") {
    canvas.drawLine(position, from, position, to, paint);
  } else {
    canvas.drawLine(from, position, to, position, paint);
  }
}

/** 강조 없음 — 호출부가 생략했을 때의 기본값 (전부 default 로 그린다) */
const NO_GUIDE_EMPHASIS: GuideEmphasisIds = {
  selectedGuideId: null,
  hoveredGuideId: null,
};

/** 기본·hover — 웜 레드 (#F24822, Figma 실측값. 스냅 표식과 공용) */
const PAGE_GUIDE_HEX = 0xf24822;
/** 선택 — 하늘색 (#6DC1FF, Figma 실측값). 연장 점선도 같은 색 */
const PAGE_GUIDE_SELECTED_HEX = 0x6dc1ff;
/** 기본 — 계속 떠 있는 선이라 콘텐츠를 덮지 않을 만큼만 */
const PAGE_GUIDE_ALPHA = 0.7;
/** hover — 불투명해지는 것이 곧 "잡을 수 있다" 는 신호 (커서 변화와 같은 뜻) */
const PAGE_GUIDE_HOVER_ALPHA = 1;
/** 선택 — 불투명. 연장 점선도 같은 값이라 경계에서 한 선으로 읽힌다 */
const PAGE_GUIDE_SELECTED_ALPHA = 1;
/** 소속 미정 미리보기 — 같은 색·같은 두께, 알파만 낮춰 "아직 잠정" 을 표현 */
const PAGE_GUIDE_PREVIEW_ALPHA = 0.45;

/**
 * 강조 상태 → 색. 본체(`renderPageGuides`)와 연장선(`renderGuideExtension`)이
 * **같은 함수**를 쓴다 — 둘이 갈리면 같은 가이드의 안쪽과 바깥쪽이 다른 색이
 * 되고, 페이지 경계에서 한 선으로 읽히지 않는다.
 */
function guideEmphasisColor(
  ck: CanvasKit,
  emphasis: GuideEmphasis,
): Float32Array {
  if (emphasis === "selected") {
    const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_SELECTED_HEX);
    return ck.Color4f(r, g, b, PAGE_GUIDE_SELECTED_ALPHA);
  }
  const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_HEX);
  return ck.Color4f(
    r,
    g,
    b,
    emphasis === "hover" ? PAGE_GUIDE_HOVER_ALPHA : PAGE_GUIDE_ALPHA,
  );
}

/**
 * 한 페이지의 가이드 전부를 그린다.
 *
 * 클립은 페이지 rect **1회** — 가이드마다 save/restore 하면 선 개수만큼
 * 상태 전환이 늘어난다. 클립이 필요한 이유는 선 길이가 페이지 rect 와 같아
 * 보이지만 실제로는 stroke 가 양쪽으로 반폭씩 번지고, breakpoint 크기를
 * 줄인 뒤 남은 가이드가 페이지 밖 좌표를 가질 수 있기 때문이다.
 */
export function renderPageGuides(
  ck: CanvasKit,
  canvas: Canvas,
  target: PageGuideRenderTarget,
  zoom: number,
  emphasisIds: GuideEmphasisIds = NO_GUIDE_EMPHASIS,
): void {
  if (target.lines.length === 0) {
    return;
  }

  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  // 세 색은 루프 밖에서 한 번만 만든다 — setColor 는 값을 복사해 가므로
  // 선이 몇 개든 할당은 3개로 고정이다
  const colorOf: Record<GuideEmphasis, Float32Array> = {
    default: guideEmphasisColor(ck, "default"),
    hover: guideEmphasisColor(ck, "hover"),
    selected: guideEmphasisColor(ck, "selected"),
  };

  const paint = acquirePooledPaint(ck);
  paint.setColor(colorOf.default);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);

  const { x, y, width, height } = target.pageRect;
  canvas.save();
  canvas.clipRect(ck.XYWHRect(x, y, width, height), ck.ClipOp.Intersect, true);
  try {
    for (const line of target.lines) {
      // 선택 > hover 우선순위는 `resolveGuideEmphasis` 한 곳이 정한다
      paint.setColor(colorOf[resolveGuideEmphasis(line.id, emphasisIds)]);
      drawAxisLine(
        canvas,
        line.axis,
        line.position,
        line.axis === "x" ? y : x,
        line.axis === "x" ? y + height : x + width,
        paint,
      );
    }
  } finally {
    canvas.restore();
    releasePooledPaint(paint);
  }
}

/**
 * 드래그 중 **소속 미정** 미리보기 — 뷰포트를 가로지르는 선 1개.
 *
 * 확정 가이드와 성격이 갈린다. 이건 순간 피드백이라 §8.5 의 **조작 표식**
 * 열이고, 그래서 `withPageOcclusionClip` 도 페이지 rect 클립도 걸지 않는다
 * (스냅 정렬선과 같은 취급). 소속 페이지가 없으니 클립할 rect 자체가 없다.
 *
 * 소속이 정해지면 이 함수는 호출되지 않는다 — `resolveGuideDragPreview` 가
 * null 을 주고, 대신 `renderPageGuides` 가 그 페이지에 클립된 선을 그린다.
 * 선이 잘리기 시작하는 순간이 곧 "여기 놓으면 붙는다" 는 신호다.
 */
export function renderGuideDragPreview(
  ck: CanvasKit,
  canvas: Canvas,
  preview: { axis: "x" | "y"; scenePosition: number },
  viewport: { x: number; y: number; width: number; height: number },
  zoom: number,
): void {
  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_HEX);
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(r, g, b, PAGE_GUIDE_PREVIEW_ALPHA));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);

  try {
    drawAxisLine(
      canvas,
      preview.axis,
      preview.scenePosition,
      preview.axis === "x" ? viewport.y : viewport.x,
      preview.axis === "x"
        ? viewport.y + viewport.height
        : viewport.x + viewport.width,
      paint,
    );
  } finally {
    releasePooledPaint(paint);
  }
}

/** 연장선의 점선 주기 (screen px) */
const GUIDE_EXTENSION_DASH_ON_PX = 4;
const GUIDE_EXTENSION_DASH_OFF_PX = 3;

/**
 * 강조된 가이드를 **선의 방향 끝까지** 연장한다 (Figma 어법).
 *
 * 대상은 선택된 가이드만이 아니다 — **마우스를 올리거나 끌고 있을 때도**
 * 연장된다 (2026-08-14 사용자의 Figma 확인). 연장은 "이 선이 어디까지
 * 이어지는가" 를 보여 주는 것이라, 그게 필요한 순간은 선택했을 때가 아니라
 * **그 선을 만지는 모든 순간**이다. 색만 강조 상태를 따라간다: hover·드래그는
 * 웜 레드, 선택은 하늘색.
 *
 * 페이지 안 구간은 `renderPageGuides` 가 이미 실선으로 그렸다. 여기서는 그
 * 바깥, 즉 **뷰포트 경계까지의 두 세그먼트**만 점선으로 잇는다. 실선/점선의
 * 갈림이 곧 **소속 표시**다 — 실선 구간이 이 가이드가 속한 페이지고, 점선은
 * "여기까지 이어지지만 이 페이지 것은 아니다" 를 말한다.
 *
 * §8.5 분류는 **조작 표식**이다 (선택 박스와 같은 열): 무엇을 만지고 있는지
 * 알리는 순간 표시이므로, 페이지 클립도 occlusion 도 걸지 않는다. 확정 가이드
 * 본체가 콘텐츠성 chrome 인 것과 갈린다.
 */
export function renderGuideExtension(
  ck: CanvasKit,
  canvas: Canvas,
  line: { axis: "x" | "y"; position: number },
  pageRect: { x: number; y: number; width: number; height: number },
  viewport: { x: number; y: number; width: number; height: number },
  zoom: number,
  emphasis: Exclude<GuideEmphasis, "default">,
): void {
  // 페이지를 지나지 않는 선은 **연장할 본체가 없다**. 본체는 페이지 rect 로
  // 클립돼 안 보이는데 연장선만 클립 밖이라 남으면, 지워진 줄 알았던 가이드의
  // 점선이 캔버스에 떠 있게 된다 (2026-08-14 사용자 보고). 드래그로 밖에 나간
  // 경우는 이제 삭제로 처리하지만(useGuideDrag), breakpoint 크기를 줄여 남은
  // 범위 밖 가이드도 같은 상태가 되므로 그리는 쪽에서도 막는다 — 판정은
  // 드래그 쪽과 **같은 함수**다.
  const axisStart = line.axis === "x" ? pageRect.x : pageRect.y;
  if (
    !isGuideWithinPage(line.axis, line.position - axisStart, {
      width: pageRect.width,
      height: pageRect.height,
    })
  ) {
    return;
  }

  const invZoom = 1 / (zoom === 0 ? 1 : zoom);

  const paint = acquirePooledPaint(ck);
  let dash: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  try {
    // 본체와 **같은 색** — 페이지 경계에서 색은 이어지고 형태만 갈린다
    paint.setColor(guideEmphasisColor(ck, emphasis));
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(invZoom);
    dash = ck.PathEffect.MakeDash([
      GUIDE_EXTENSION_DASH_ON_PX * invZoom,
      GUIDE_EXTENSION_DASH_OFF_PX * invZoom,
    ]);
    paint.setPathEffect(dash);

    // 페이지 앞뒤로 남는 구간만 그린다. 페이지가 뷰포트를 넘어가면 한쪽 또는
    // 양쪽이 음수 길이가 되므로 그 세그먼트는 건너뛴다.
    const isVertical = line.axis === "x";
    const viewStart = isVertical ? viewport.y : viewport.x;
    const viewEnd = isVertical
      ? viewport.y + viewport.height
      : viewport.x + viewport.width;
    const pageStart = isVertical ? pageRect.y : pageRect.x;
    const pageEnd = isVertical
      ? pageRect.y + pageRect.height
      : pageRect.x + pageRect.width;

    if (pageStart > viewStart) {
      drawAxisLine(
        canvas,
        line.axis,
        line.position,
        viewStart,
        pageStart,
        paint,
      );
    }
    if (pageEnd < viewEnd) {
      drawAxisLine(canvas, line.axis, line.position, pageEnd, viewEnd, paint);
    }
  } finally {
    // PathEffect 는 WASM 객체 — paint 를 풀에 돌려주기 전에 떼고 지운다
    paint.setPathEffect(null);
    dash?.delete();
    releasePooledPaint(paint);
  }
}

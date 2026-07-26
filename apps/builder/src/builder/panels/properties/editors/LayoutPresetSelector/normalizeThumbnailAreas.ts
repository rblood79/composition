/**
 * 썸네일 가독성 정규화 — **위상은 보존하고 비율만 바꾼다** (2026-07-26).
 *
 * `derivePreviewAreas` 는 실제 프레임 픽셀 비율을 그대로 낸다 (ADR-168 G3 — 썸네일 비율이
 * 실제 렌더 비율과 일치해야 파생이 검증 가능하다). 그 계약은 그대로 두되, **그 비율을 80×60
 * 박스에 그리면 식별이 불가능**하다는 것이 문제였다. 실측:
 *
 * | 항목                        | 원래 비율 | 80×60 렌더 |
 * | --------------------------- | --------- | ---------- |
 * | 밴드 슬롯 60px / 1080 (desktop) | 5.6%      | **3.3px**  |
 * | 밴드 슬롯 60px / 844 (mobile)   | 7.1%      | **4.3px**  |
 * | 사이드바 250px / 1920           | 13.0%     | 10.4px     |
 * | 목록 320px / 1920               | 16.7%     | 13.3px     |
 *
 * 1px 테두리를 빼면 밴드의 내부는 1~2px — 선 한 줄로 읽힌다. 그래서 mobile 에서
 * `전체화면 / 수직 2단 / 수직 3단 / 좌측·우측 사이드바 / 목록-상세` **6개가 사실상 동일한
 * 회색 사각형**이었고, 프리셋을 구분하는 특징(어떤 밴드·열이 있는가)의 차이가 1~3px 안에
 * 몰려 있었다.
 *
 * 썸네일의 용도는 **식별**이지 계측이 아니다. 그래서 여기서는 축별로 슬롯 경계가 만드는
 * 구간(band)에 최소 두께를 보장하고 남은 공간을 원래 비율대로 재배분한다 — piecewise-linear
 * 좌표 remap 이라 다음이 성립한다:
 *
 * - **위상 보존**: 인접·포함·순서가 그대로다. 어느 슬롯이 어느 구간을 점유하는지 바뀌지 않는다.
 * - **단조성**: 원래 큰 구간이 정규화 후에도 크거나 같다 → `content` 가 밴드보다 크다는 위계가
 *   유지된다.
 * - **중첩 셀 자동 추종**: 격자 셀은 슬롯 경계를 만들지 않고 같은 map 을 통과하므로 부모 슬롯
 *   안에 그대로 남는다.
 *
 * 늘린 만큼은 최소 두께를 넘는 구간에서만 회수하므로(`raiseBands` 참조) 최소 두께가 실제로
 * 보장되고 `content` 가 밴드보다 크다는 위계도 남는다. 예외는 `구간 수 × 최소 두께` 가 렌더
 * 크기를 다 쓰는 경우뿐이다.
 */

import type { PreviewArea } from "./types";

/**
 * 구간 최소 두께(px).
 *
 * 1px 테두리 2개 + 블록 분리용 inset 을 빼고도 덩어리로 읽히는 하한. 12px 미만에서는
 * `수직 2단`(밴드 1개)과 `수직 3단`(밴드 2개)의 차이가 다시 눈에 안 들어온다.
 */
export const MIN_BAND_PX = 12;

/** 경계 좌표 묶음용 양자화 단위 — 부동소수 오차로 같은 경계가 둘로 갈라지는 것을 막는다. */
const EDGE_QUANTUM = 1e4;

interface NormalizeOptions {
  /** 실제 렌더 폭(px) — 최소 두께를 % 로 환산하는 기준. */
  width: number;
  /** 실제 렌더 높이(px). */
  height: number;
  /** 구간 최소 두께(px). 기본 {@link MIN_BAND_PX}. */
  minBandPx?: number;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function toPercent(px: number, size: number): number {
  return size > 0 ? (px / size) * 100 : 0;
}

/**
 * 축 방향 구간 경계.
 *
 * **슬롯 경계만** 모은다 — 격자 셀까지 넣으면 셀 간 여백마다 최소 두께가 걸려 셀이 부모
 * 슬롯을 넘치도록 부풀려진다. 셀은 map 을 통과해 부모와 함께 스케일되면 된다.
 */
function slotEdges(
  areas: readonly PreviewArea[],
  axis: "x" | "y",
  sizeKey: "width" | "height",
): number[] {
  const raw: number[] = [0, 100];
  for (const area of areas) {
    if (!area.isSlot) continue;
    raw.push(
      clampPercent(area[axis]),
      clampPercent(area[axis] + area[sizeKey]),
    );
  }

  const unique = new Set(
    raw.map((value) => Math.round(value * EDGE_QUANTUM) / EDGE_QUANTUM),
  );
  return [...unique].sort((a, b) => a - b);
}

/**
 * 구간별 최소 두께를 보장한 새 경계.
 *
 * 늘린 만큼(`excess`)은 **최소 두께를 넘는 구간에서만** 그 여유(`slack`)에 비례해 회수한다.
 * 전체 합으로 나눠 재정규화하면 방금 올린 구간이 다시 최소치 아래로 내려가므로(실측:
 * `수직 3단` desktop 밴드가 12px 목표에서 9.3px 로 복귀) 그 방식은 쓰지 않는다.
 *
 * 구간이 많아 `구간 수 × 최소 두께 > 100%` 가 되면 최소치를 `100 / 구간 수` 로 낮춘다. 이
 * 보정이 회수 가능성을 보장한다 — `slack 합 − excess = 100 − 구간 수 × 최소치 ≥ 0` 이므로
 * 언제나 정확히 100% 로 맞춰진다. 다만 등호가 되는 경우(mobile holy-grail 5밴드 × 12px = 60px)
 * 는 모든 구간이 같아져 위계가 사라진다 — 60px 안에 12px 짜리 5개를 넣으면 산술적으로 그
 * 결과밖에 없다.
 */
function raiseBands(edges: readonly number[], minPercent: number): number[] {
  const bands = edges.slice(1).map((edge, index) => edge - edges[index]);
  if (bands.length === 0) return [...edges];

  const floor = Math.min(minPercent, 100 / bands.length);
  const raised = bands.map((band) => Math.max(band, floor));

  const excess = raised.reduce((sum, band) => sum + band, 0) - 100;
  const slack = raised.map((band) => band - floor);
  const slackTotal = slack.reduce((sum, value) => sum + value, 0);

  const settled =
    excess > 0 && slackTotal > 0
      ? raised.map((band, index) => band - (excess * slack[index]) / slackTotal)
      : raised;

  const next: number[] = [0];
  for (const band of settled) {
    next.push(next[next.length - 1] + band);
  }
  // 누적 오차가 남지 않게 마지막 경계는 100 으로 고정한다.
  next[next.length - 1] = 100;
  return next;
}

/** 원 경계 → 새 경계 piecewise-linear 사상. 구간 내부는 선형 보간이다. */
function makeAxisMap(
  from: readonly number[],
  to: readonly number[],
): (value: number) => number {
  return (value) => {
    const v = clampPercent(value);
    for (let i = 1; i < from.length; i += 1) {
      if (v > from[i] && i < from.length - 1) continue;

      const span = from[i] - from[i - 1];
      const ratio = span > 0 ? (v - from[i - 1]) / span : 0;
      return to[i - 1] + ratio * (to[i] - to[i - 1]);
    }
    return v;
  };
}

/**
 * 식별 가능한 비율로 다시 배분한 썸네일 사각형.
 *
 * 순수 함수 — 같은 입력이면 같은 출력이다. `derivePreviewAreas` 결과를 그리기 직전에 통과시키고,
 * 파생 쪽 계약(G3)에는 손대지 않는다.
 */
export function normalizeThumbnailAreas(
  areas: readonly PreviewArea[],
  { width, height, minBandPx = MIN_BAND_PX }: NormalizeOptions,
): PreviewArea[] {
  if (areas.length === 0) return [];

  const xEdges = slotEdges(areas, "x", "width");
  const yEdges = slotEdges(areas, "y", "height");

  const mapX = makeAxisMap(
    xEdges,
    raiseBands(xEdges, toPercent(minBandPx, width)),
  );
  const mapY = makeAxisMap(
    yEdges,
    raiseBands(yEdges, toPercent(minBandPx, height)),
  );

  return areas.map((area) => {
    const x = mapX(area.x);
    const right = mapX(area.x + area.width);
    const y = mapY(area.y);
    const bottom = mapY(area.y + area.height);

    return {
      ...area,
      x,
      y,
      width: Math.max(0, right - x),
      height: Math.max(0, bottom - y),
    };
  });
}

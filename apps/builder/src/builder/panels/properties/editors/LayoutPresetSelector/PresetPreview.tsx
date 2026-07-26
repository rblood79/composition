/**
 * PresetPreview - SVG 기반 레이아웃 썸네일
 *
 * 영역 배열은 `derivePreviewAreas` 가 breakpoint 별로 파생하고(ADR-168 P-1),
 * `normalizeThumbnailAreas` 가 식별 가능한 비율로 재배분한다 — 이 컴포넌트는 그리기만 담당한다.
 *
 * 색상은 전부 시맨틱 토큰이다 (ADR-168 P-2). 원시 토큰(`--color-gray-*` / `--color-white`)은
 * dark mode 재정의가 없어서, 다크 테마에서 흰 배경 위에 연회색 사각형이 그려지고 이름표가
 * 배경에 묻혔다.
 *
 * **선화다 — 컴포넌트 패널 `.list-item-icon` 과 같은 색 패턴** (2026-07-26). 채워진 회색 블록
 * 이었을 때는 이 패널 안에서만 쓰는 별개 표현이었다: 컴포넌트 패널 항목 아이콘도, 바로 위
 * 카테고리 헤더의 lucide 레이아웃 아이콘(`Layout` / `Columns2` / `LayoutGrid` / `Rows3`)도
 * `fill: none` + `--fg-muted` 선 + inset 표면이라 "레이아웃을 그린 도형" 의 어법이 하나 있는데,
 * 썸네일만 벗어나 있었다. 부수 효과로 채우기 위계에 쓰던 `--accent-subtle` 의존이 사라졌다
 * ({@link strokeOf} 참조 — 그 토큰은 강조로 쓸 수 없었다).
 *
 * 선 색은 `currentColor` 로 받는다. CSS 가 `.preset-preview-svg { color: … }` 로 주므로,
 * 아이콘이 컨테이너 `color` 에서 색을 받는 방식과 같다.
 *
 * 단 **바깥 테두리는 두지 않는다** (2026-07-27). 아이콘 박스는 16px 글리프를 담느라 경계를
 * 그려주지만, 여기 도형은 상자를 거의 채우므로 슬롯 선 자체가 이미 경계다 — 한 겹 더 두르면
 * 첫 슬롯 선과 2px 간격으로 나란히 놓여 이중선이 된다. 덕분에 아래 좌표 계약도 정확해진다:
 * `box-sizing: border-box` 라 1px 테두리가 80×60 뷰포트를 78×58 로 줄여 viewBox 가 x 0.975 /
 * y 0.967 로 미세하게 비균등 축소되고 있었다.
 *
 * **좌표는 px 다 (2026-07-26)**. 이전에는 `viewBox="0 0 100 100"` + `preserveAspectRatio="none"`
 * 으로 정사각 좌표계를 80×60 에 눌러 담았다. 그러면 x·y 배율이 0.8 / 0.6 로 갈려 모든 것이
 * 비균등 왜곡된다 — `strokeWidth={1}` 이 가로 0.8px / 세로 0.6px, `rx={2}` 가 1.6×1.2 타원,
 * `fontSize={8}` 이 **높이 4.8px + 가로 75% 압축**이었다. 슬롯 이름표가 "너무 작아서 안 보인다"
 * 던 것의 절반은 이 왜곡이다.
 *
 * **이름표는 없다**. 밴드 슬롯은 최소 두께가 12px 이고 5슬롯 프리셋(holy-grail)에서는 그보다
 * 얇아지므로, 어떤 폰트 크기로도 5개 슬롯 이름을 이 안에 읽히게 넣을 수 없다. 슬롯 구성은
 * `<title>` 로 옮겼다 — 호버 툴팁 + 스크린 리더 양쪽에 걸리고 레이아웃 비용이 0 이다.
 * 프리셋 식별은 카드의 이름 텍스트와 **모양** 이 담당한다.
 */

import { memo, useMemo } from "react";

import { normalizeThumbnailAreas } from "./normalizeThumbnailAreas";
import type { PreviewArea } from "./types";

interface PresetPreviewProps {
  /** 미리보기 영역 배열 (`derivePreviewAreas` 결과) */
  areas: PreviewArea[];
  /** SVG 너비 */
  width?: number;
  /** SVG 높이 */
  height?: number;
}

/**
 * 사각형 안쪽 여백(px).
 *
 * 인접 슬롯은 경계를 공유하므로 각자의 선이 같은 자리에 겹쳐 **한 덩어리에 칸막이가 있는
 * 모양**으로 읽힌다. 안쪽으로 물러나면 사이에 틈이 생겨 별개 블록으로 보인다. 선이 경로
 * 중심에 그려지는 SVG 특성상 뷰포트 경계에서 절반이 잘리는 것도 같이 해결된다.
 *
 * 값이 선 두께를 넘어야 한다 — 1.5px 선을 1px 여백으로 띄우면 두 선 사이가 0.5px 로 붙어
 * 다시 한 줄로 보인다. 1.5 면 마주보는 두 선이 3px 간격이라 1.5px 빈틈이 남는다.
 */
const RECT_INSET = 1.5;

/** 사각형 모서리 반경(px). */
const RECT_RADIUS = 2;

/**
 * 영역 테두리 — 선화의 색.
 *
 * 기본은 `currentColor` — CSS 가 `.preset-preview-svg { color: var(--fg-muted) }` 로 준다
 * (컴포넌트 패널 `.list-item-icon` 이 항목 아이콘에 색을 주는 방식과 동일). required 슬롯만
 * 한 단계 진한 `--accent` 로 올려 "이 프리셋의 본체" 를 표시한다.
 *
 * **채우기로 강조하려던 시도는 실패했다** (2026-07-26 실측). builder 테마의 `--accent-subtle`
 * 은 이름과 달리 회색 wash 라(light `rgba(107,114,128,.15)` / dark `rgba(161,161,170,.2)`)
 * 일반 슬롯의 `--bg-muted` 보다 밝아, 강조하려던 슬롯이 오히려 뒤로 물러나 보였다. 지금은
 * 채우기 자체가 없다.
 *
 * `--accent` 는 builder 에서 유채색이 아니라 `--color-gray-700`(dark 는 `--color-zinc-200`)
 * 이지만, 그래서 두 테마 모두에서 표면과 명도 대비가 확실하다 — 패널 chrome 이 무채색인
 * 이 빌더에서 강조는 채도가 아니라 명도로 준다.
 */
function strokeOf(area: PreviewArea): string {
  return area.required ? "var(--accent)" : "currentColor";
}

/**
 * 선 두께(px).
 *
 * 슬롯은 컴포넌트 패널 아이콘과 같은 1.5, 격자 슬롯 내부의 카드 셀은 한 단계 얇은 1 —
 * 채우기가 없으니 위계는 두께로 준다.
 */
function strokeWidthOf(area: PreviewArea): number {
  return area.isSlot ? 1.5 : 1;
}

export const PresetPreview = memo(function PresetPreview({
  areas,
  width = 80,
  height = 60,
}: PresetPreviewProps) {
  const normalized = useMemo(
    () => normalizeThumbnailAreas(areas, { width, height }),
    [areas, width, height],
  );

  const rectElements = useMemo(
    () =>
      normalized.map((area) => {
        const x = (area.x * width) / 100 + RECT_INSET;
        const y = (area.y * height) / 100 + RECT_INSET;
        // 두 변에서 물러나므로 inset 의 2배를 뺀다. 최소 1px 은 남겨 사라지지 않게 한다.
        const rectWidth = Math.max(
          1,
          (area.width * width) / 100 - RECT_INSET * 2,
        );
        const rectHeight = Math.max(
          1,
          (area.height * height) / 100 - RECT_INSET * 2,
        );

        return (
          <rect
            key={area.name}
            x={x}
            y={y}
            width={rectWidth}
            height={rectHeight}
            fill="none"
            stroke={strokeOf(area)}
            strokeWidth={strokeWidthOf(area)}
            rx={RECT_RADIUS}
          />
        );
      }),
    [normalized, width, height],
  );

  // 슬롯 구성 — 셀은 내부 id(`feed#0`)라 제외한다
  const slotNames = normalized
    .filter((area) => area.isSlot)
    .map((area) => area.name)
    .join(" · ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className="preset-preview-svg"
    >
      <title>{slotNames}</title>
      {rectElements}
    </svg>
  );
});

export default PresetPreview;

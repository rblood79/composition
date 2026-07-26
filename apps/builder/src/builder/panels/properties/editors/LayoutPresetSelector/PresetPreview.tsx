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
 * **모든 도형이 면이다** (2026-07-27 사용자 지정). 표면은 컴포넌트 패널 `.list-item-icon` 과
 * 같은 패턴을 유지하지만(`--bg-inset` + 바깥 테두리 없음), 도형 채널은 그 패널의 `fill: none`
 * 선화와 갈린다 — 배치를 읽는 단위라 덩어리로 보이는 편이 낫다는 판단이다. 위계는 elevation
 * 토큰 3단으로 준다 ({@link fillOf} 참조).
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
 * 마주보는 두 변이 각자 물러나므로 실제 틈은 이 값의 2배(3px)다. 표면(`--bg-inset`)이 그
 * 틈으로 비쳐 슬롯 면이 서로 분리돼 보인다.
 */
const RECT_INSET = 1.5;

/** 사각형 모서리 반경(px). */
const RECT_RADIUS = 2;

/**
 * 영역 채우기 — **모든 도형이 면이다** (2026-07-27 사용자 지정, 선 잔존분까지 정리).
 *
 * 표면에서 멀어지는 3단 elevation 으로 읽는다. 두 테마 모두 방향이 같다 (light 는 점점 어둡게,
 * dark 는 점점 밝게 — 실측 lightness):
 *
 * | 단계                       | 토큰              | light | dark  |
 * | -------------------------- | ----------------- | ----- | ----- |
 * | 표면 (SVG 배경)            | `--bg-inset`      | 0.985 | 0.210 |
 * | 슬롯 / 카드를 담는 판      | `--bg-muted`      | 0.928 | 0.370 |
 * | required 슬롯 / 격자 카드  | `--bg-emphasis`   | 0.872 | 0.442 |
 *
 * 격자 셀을 품은 슬롯은 required 여도 판 단계로 내린다 — 카드와 같은 색이면 카드가 사라진다.
 * 그 슬롯의 required 는 카드가 대신 표시한다.
 *
 * `--border` 대신 `--bg-muted` 를 쓴다. 두 토큰은 light(gray-200)·dark(zinc-700) 모두 **값이
 * 완전히 같아** 픽셀 차이가 0 이면서, "테두리 변수를 배경·채우기에 사용 금지" (rules/css-tokens.md)
 * 를 지킨다. 과거 `--accent-subtle` 로 강조하려던 시도는 그 토큰이 회색 wash 라
 * (`--bg-muted` 보다 밝음) 강조가 뒤집혀 실패했다 — 채우기 강조는 반드시 표면 대비가 커지는
 * 방향으로만 준다.
 */
function fillOf(area: PreviewArea, holdsCells: boolean): string {
  if (!area.isSlot) return "var(--bg-emphasis)";
  if (holdsCells) return "var(--bg-muted)";
  return area.required ? "var(--bg-emphasis)" : "var(--bg-muted)";
}

/**
 * 격자 셀을 품은 슬롯 이름.
 *
 * 셀 이름이 `${슬롯}#${index}` 규약(`derivePreviewAreas.nestedGridCells`)이라 여기서 되짚는다.
 * 슬롯 이름에는 `#` 이 들어가지 않으므로 마지막 `#` 앞이 곧 부모 이름이다.
 */
function collectCellHolders(areas: readonly PreviewArea[]): Set<string> {
  const holders = new Set<string>();
  for (const area of areas) {
    if (area.isSlot) continue;
    const separator = area.name.lastIndexOf("#");
    if (separator > 0) holders.add(area.name.slice(0, separator));
  }
  return holders;
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

  const rectElements = useMemo(() => {
    const cellHolders = collectCellHolders(normalized);

    return normalized.map((area) => {
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
          fill={fillOf(area, cellHolders.has(area.name))}
          rx={RECT_RADIUS}
        />
      );
    });
  }, [normalized, width, height]);

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

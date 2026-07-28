/**
 * Page ↔ Frame 합성 **정책** — 노드 표현에 독립적인 규칙만 모은다.
 *
 * 프레임을 페이지에 적용하면 두 소비자가 같은 화면을 내야 한다:
 *  - Skia(canvas): `resolvePageWithFrame` (flat `CanvasSceneNode` 모델)
 *  - Preview/Publish(DOM): `projectPageFrameNode` (canonical resolved 트리)
 *
 * 두 경로는 **노드 표현이 다르다** (flat + `parent_id` ↔ 중첩 트리). 그래서 표현에 얽힌
 * 순회는 각자 하되, "무엇을 어떻게 합칠지" 는 여기 한 곳에서만 정한다 — 규칙이 두 벌이 되면
 * 그 순간 시각 발산이 시작된다 (ADR-063 D3 symmetric consumer 계약).
 *
 * 입력은 전부 plain style/props 맵이라 어느 노드 타입에도 매이지 않는다.
 */

export type StyleMap = Record<string, unknown>;

export interface ResponsiveBag {
  styles?: Record<string, unknown>;
  visibility?: unknown;
}

/**
 * 프레임이 레이아웃 문법을 주더라도 **뷰포트 권한은 페이지가 갖는다**.
 * 이 키들은 page 선언이 있으면 page 값이 이긴다.
 */
export const PAGE_BODY_STYLE_PRESERVE_KEYS = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "background",
  "backgroundColor",
  "backgroundImage",
] as const;

/** page body base style ← frame body layout 병합 (frame 우선, viewport 키는 page 우선). */
export function mergePageBodyStyle(
  pageStyle: StyleMap | undefined,
  frameStyle: StyleMap | undefined,
): StyleMap {
  const page = pageStyle ?? {};
  const frame = frameStyle ?? {};
  const merged: StyleMap = { ...page, ...frame };
  for (const key of PAGE_BODY_STYLE_PRESERVE_KEYS) {
    if (page[key] !== undefined) merged[key] = page[key];
  }
  return merged;
}

/**
 * frame body 의 breakpoint override 를 page body 로 옮긴다 (2026-07-27).
 *
 * base style 은 {@link mergePageBodyStyle} 이 합치는데 `responsive` 는 최상위 canonical
 * 필드라 노드 스프레드가 **page body 것만** 실어 온다. page body 는 자기 override 가 없는
 * 게 보통이라(실측: 3개 페이지 전부 `responsive: null`) 프리셋이 심은 컨테이너 override 가
 * 통째로 사라졌다 — 프레임을 적용하면 breakpoint 를 바꿔도 트랙과 `display` 가 desktop
 * 값 그대로였다.
 *
 * 병합 규칙은 base style 과 **같은 정책**이다: frame 이 이기되 page 가 선언한 viewport 키는
 * page 가 되찾는다. `visibility` 는 page 것만 쓴다 — 합쳐진 노드는 page body 이고, frame
 * body 를 mobile 에서 숨기라는 선언을 그대로 적용하면 page 소유 콘텐츠까지 사라진다.
 */
export function mergePageBodyResponsive(
  pageResponsive: ResponsiveBag | null | undefined,
  frameResponsive: ResponsiveBag | null | undefined,
): ResponsiveBag | null | undefined {
  const frameStyles = frameResponsive?.styles;
  if (!frameStyles || Object.keys(frameStyles).length === 0) {
    return pageResponsive;
  }

  const pageStyles = pageResponsive?.styles ?? {};
  const styles: Record<string, unknown> = { ...pageStyles, ...frameStyles };
  for (const key of PAGE_BODY_STYLE_PRESERVE_KEYS) {
    if (pageStyles[key] !== undefined) styles[key] = pageStyles[key];
  }

  const next: ResponsiveBag = { styles };
  if (pageResponsive?.visibility) next.visibility = pageResponsive.visibility;
  return next;
}

/**
 * 슬롯이 page 맥락에서 가질 style — frame body 의 배치 문법에 맞춘 **보완**만 한다.
 *
 * flex: 교차축은 **인라인 축일 때만** `100%` 를 보완하고(블록 축은 `stretch` 에 맡긴다 —
 * 아래 참조), `content` 슬롯이 주축 여유를 먹는다(나머지는 shrink 금지).
 *
 * grid: **배치만** 보완하고 **크기는 주입하지 않는다** (2026-07-27). grid item 은 기본
 * stretch 라 자기 area 를 이미 채운다 — 같은 슬롯이 프레임 편집 맥락에서는 주입 없이
 * 정확히 채운다(실측 desktop dashboard: sidebar 240×968 / content 1628×968).
 * `height:100%` 를 주입하면 `auto` 행이 컨테이너 높이로 부풀어 **행마다 페이지 한 장**이
 * 된다(실측: navigation 60 → 1048, 둘째 행이 y=1084 로 페이지 밖). CSS 에서 grid item 의
 * 백분율 높이는 자기 grid area 기준이고 `auto` 행은 불확정이라 auto 로 접히는데, 엔진은
 * 컨테이너 높이로 해석해 발산한다. 주입이 없으면 이 발산 경로 자체가 사라진다.
 */
export function resolvePageSlotStyle(input: {
  slotStyle: StyleMap | undefined;
  slotName: string;
  frameBodyStyle: StyleMap | undefined;
}): StyleMap {
  const { slotName } = input;
  const frameStyle = input.frameBodyStyle ?? {};
  const display = String(frameStyle.display ?? "").toLowerCase();
  const flexDirection = String(frameStyle.flexDirection ?? "row").toLowerCase();
  const nextStyle: StyleMap = { ...(input.slotStyle ?? {}) };

  if (display === "flex" || display === "inline-flex") {
    const isColumn =
      flexDirection === "column" || flexDirection === "column-reverse";
    const crossKey = isColumn ? "width" : "height";
    const mainKey = isColumn ? "height" : "width";
    const minMainKey = isColumn ? "minHeight" : "minWidth";

    // **교차축 크기는 블록 축에 주입하지 않는다** (2026-07-28). 인라인 축(`width`)은
    // 부모 폭이 확정이라 `100%` 가 풀리지만, 블록 축(`height`)은 body 가 `min-height` 로
    // 서는 순간 미결정이라 `100%` 가 **해소되지 않는다** — 그런데 크기를 *명시*한 것은
    // 맞아서 `align-items:stretch` 까지 꺼진다. 결과가 0 이다(Chrome 실측 동일).
    // 주입을 빼면 `stretch` 가 슬롯을 라인 cross(=컨테이너 inner cross)로 채운다
    // (실측 80x400 / 310x400, DOM 동형). grid 분기가 "크기는 주입하지 않는다" 로 이미
    // 같은 결론에 와 있다.
    if (crossKey === "width") {
      nextStyle[crossKey] ??= "100%";
    }
    if (
      slotName === "content" &&
      nextStyle[mainKey] == null &&
      nextStyle.flex == null
    ) {
      nextStyle.flex = "1 1 auto";
      nextStyle[minMainKey] ??= 0;
    } else {
      nextStyle.flexShrink ??= 0;
    }
  }

  if (display === "grid" || display === "inline-grid") {
    nextStyle.gridArea ??= slotName;
  }

  return nextStyle;
}

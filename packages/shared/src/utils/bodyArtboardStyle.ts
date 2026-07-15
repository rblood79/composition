import type { CSSProperties } from "react";

/**
 * canonical `body` 노드의 DOM 스타일을 Skia 아트보드 높이에 정합한다.
 *
 * D3 대칭(2026-07-15): canonical DOM 렌더 경로(builder Preview `CanonicalNodeRenderer`,
 * publish `ElementRenderer`)는 body 노드를 중첩 `<div>` 로 렌더하며 `element.props.style`
 * (height 無)만 얹어 content-fit 로 collapse 한다. 반면 Skia(builder canvas)는 layout map 의
 * body 높이(페이지 프레임/아트보드 높이)를 그대로 그린다 → body 박스가 비대칭.
 * 콘텐츠 좌표는 layout map 공유로 일치하나, body 배경/테두리·세로 중앙정렬·자식 height:100% 등
 * body 박스 높이에 의존하는 시각/레이아웃이 Builder ↔ DOM 사이에서 갈린다(대칭 위반).
 *
 * viewport(=preview iframe / publish 페이지 = Skia artboard) 기준 `min-height:100vh` 로
 * body 박스를 아트보드에 채운다. `%`-height 는 상위 frame 이 auto height 라 cascade 가 0 으로
 * 처리되어 무효(라이브 실측: %=collapse, vh=fill) → `100vh` 필수. 사용자가 height/minHeight 를
 * 명시하면 그 의도를 보존(주입 skip).
 *
 * D3 symmetric consumer(preview·publish DOM) 가 반드시 **동일 로직**을 쓰도록 단일 소스로 둔다 —
 * 이 정합 자체가 대칭을 위한 코드이므로 렌더러별 복제는 재발산의 씨앗이 된다.
 */
export function resolveBodyArtboardStyle(
  type: string,
  style: CSSProperties | undefined,
): CSSProperties | undefined {
  if (type !== "body" || style?.height != null || style?.minHeight != null) {
    return style;
  }
  return { ...style, minHeight: "100vh" };
}

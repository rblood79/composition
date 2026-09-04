/**
 * PanelContents — 패널 본문 스크롤 층 (ADR-163 패널 표준)
 *
 * 표준 구조 `.panel > PanelHeader + .panel-contents > .section` 에서 가운데 층을
 * 담당한다. `overflow-y: auto` 와 스크롤 힌트 (하단 페이드) 가 이 클래스에 걸려
 * 있으므로, 패널 본문은 반드시 이 층을 거쳐야 스크롤된다.
 *
 * **왜 컴포넌트인가**: 종전에는 12개 파일이 `className="panel-contents"` 를 손으로
 * 붙였고, 그 결과 Settings 패널은 정의 0건인 `panel-settings` 를, Themes 패널은
 * 아예 아무 층도 두지 않아 **두 패널 모두 스크롤이 되지 않았다**. 이름을 손으로
 * 적는 구조에서는 새 패널이 조용히 빠진다.
 *
 * RAC `TabPanel` 처럼 자기 엘리먼트를 소유하는 컴포넌트가 이 층을 겸할 때는
 * 래핑 대신 `panelContents()` 로 클래스만 합성한다 — div 를 한 겹 더 두면
 * `.panel-contents` 의 flex 자식 계약이 깨진다.
 */

import type { ReactNode } from "react";

/**
 * `.panel-contents` 클래스 문자열을 합성한다.
 *
 * @example
 * ```tsx
 * <TabPanel id="memory" className={panelContents("monitor-panel-contents")}>
 * ```
 */
export function panelContents(...extra: (string | false | undefined)[]) {
  return ["panel-contents", ...extra.filter(Boolean)].join(" ");
}

export interface PanelContentsProps {
  children?: ReactNode;
  /** 패널별 추가 CSS 클래스 */
  className?: string;
  /** 테스트·질의용 훅 */
  "data-testid"?: string;
}

export function PanelContents({
  children,
  className,
  "data-testid": testId,
}: PanelContentsProps) {
  return (
    <div className={panelContents(className)} data-testid={testId}>
      {children}
    </div>
  );
}

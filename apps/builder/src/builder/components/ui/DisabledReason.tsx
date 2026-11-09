/**
 * DisabledReason — 비활성 버튼이 왜 막혔는지 마우스를 올리면 보이는 이유 (2026-11-10).
 *
 * RAC `Button` 은 `title` 을 DOM 에 넘기지 않고 (`filterDOMProps` — id · data-* · 이벤트만), RAC Tooltip 은
 * 비활성 트리거에서 hover 를 받지 않는다. 그래서 감싼 span 의 `title` 로 브라우저 기본 풍선을 띄운다 —
 * span 은 `display: contents` 라 배치에 끼지 않는다. 이유가 없으면 감싸지 않는다.
 */
import type { ReactElement } from "react";
import "./DisabledReason.css";

export function DisabledReason({
  reason,
  children,
}: {
  reason: string | undefined;
  children: ReactElement;
}) {
  return reason ? (
    <span className="disabled-reason" title={reason}>
      {children}
    </span>
  ) : (
    children
  );
}

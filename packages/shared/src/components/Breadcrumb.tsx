import type { ReactNode } from "react";
import {
  Breadcrumb as RACBreadcrumb,
  BreadcrumbProps,
} from "react-aria-components/Breadcrumbs";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { Link } from "react-aria-components/Link";

export interface BreadcrumbItemProps extends BreadcrumbProps {
  href?: string;
  /**
   * 조각 뒤 구분자 (편집 가능한 Icon 자식 — 2026-09-29). S2 가 Chevron 을 그리는 자리 (링크 뒤) 에 두고, 현재
   * 조각 (RAC `isCurrent` — 마지막) 에서는 그리지 않는다.
   */
  separator?: ReactNode;
}

/**
 * Breadcrumbs 의 항목 — S2 `Breadcrumb` 구조 (2026-11-13): 현재가 아니면 내용을 RAC `Link` (`.breadcrumb-link`) 로
 * 감싸고 구분자를 잇는다, 현재 조각 (RAC 위치 규칙: 마지막) 은 링크 없이 `div.breadcrumb-current`.
 */
export function Breadcrumb({
  href,
  children,
  separator,
  ...props
}: BreadcrumbItemProps) {
  return (
    <RACBreadcrumb {...props}>
      {composeRenderProps(children, (content, { isCurrent }) =>
        isCurrent ? (
          <div className="breadcrumb-current">{content}</div>
        ) : (
          <>
            {/* 빈 문자열 href 는 React 경고("empty string passed to href") 유발 → undefined 로 정규화 */}
            <Link className="breadcrumb-link" href={href || undefined}>
              {content}
            </Link>
            {separator}
          </>
        ),
      )}
    </RACBreadcrumb>
  );
}

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
   * 조각 뒤 구분자 (편집 가능한 Icon 자식 — 2026-09-29). RAC 구조 `li[Link, Icon]` 로 Link 뒤에 두고, 현재 조각
   * (RAC `isCurrent` — 마지막) 에서는 그리지 않는다.
   */
  separator?: ReactNode;
}

/**
 * Breadcrumbs 의 항목 — RAC `Breadcrumb` + `Link` (현재 항목 판정 · `aria-current` 는 RAC 위치 규칙: 마지막 = current).
 *
 * ADR-237 Phase 3 — 정적 항목 instance (Canvas 와 같은 canonical 자식) 의 internal renderer 이기도 하다. render
 * props (`isCurrent` · `isDisabled`) 로 상태 변형 층을 받도록 `style` · `children` 함수를 그대로 RAC 에 넘긴다.
 */
export function Breadcrumb({
  href,
  children,
  separator,
  ...props
}: BreadcrumbItemProps) {
  return (
    <RACBreadcrumb {...props}>
      {composeRenderProps(children, (content, { isCurrent }) => (
        <>
          {/* 빈 문자열 href 는 React 경고("empty string passed to href") 유발 → undefined 로 정규화 */}
          <Link href={href || undefined}>{content}</Link>
          {isCurrent ? null : separator}
        </>
      ))}
    </RACBreadcrumb>
  );
}

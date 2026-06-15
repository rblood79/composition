import {
  Breadcrumb as RACBreadcrumb,
  BreadcrumbProps,
  Link,
} from "react-aria-components";
import "./styles/Breadcrumbs.css";

export interface BreadcrumbItemProps extends BreadcrumbProps {
  href?: string;
  children?: React.ReactNode;
}

export function Breadcrumb({ href, children, ...props }: BreadcrumbItemProps) {
  return (
    <RACBreadcrumb {...props}>
      {/* 빈 문자열 href 는 React 경고("empty string passed to href") 유발 → undefined 로 정규화 */}
      <Link href={href || undefined}>{children}</Link>
    </RACBreadcrumb>
  );
}

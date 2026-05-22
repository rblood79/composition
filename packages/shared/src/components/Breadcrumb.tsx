import { Breadcrumb as RACBreadcrumb, BreadcrumbProps, Link } from 'react-aria-components';
import './styles/Breadcrumbs.css';

export interface BreadcrumbItemProps extends BreadcrumbProps {
  href?: string;
  children?: React.ReactNode;
}

export function Breadcrumb({ href, children, ...props }: BreadcrumbItemProps) {
  return (
    <RACBreadcrumb {...props}>
      <Link href={href}>{children}</Link>
    </RACBreadcrumb>
  );
}

import {
  Breadcrumb as RACBreadcrumb,
  BreadcrumbProps,
  Link,
} from "react-aria-components";
import {
  toBreadcrumbRacProps,
  type BreadcrumbCanonicalProps,
} from "../catalog/outputs/toRacProps";
import "./styles/Breadcrumbs.css";

export interface BreadcrumbItemProps extends BreadcrumbProps {
  href?: string;
  isDisabled?: boolean;
  children?: React.ReactNode;
}

export function Breadcrumb({
  href,
  children,
  isDisabled,
  className,
  style,
  ...props
}: BreadcrumbItemProps) {
  const projectedProps = toBreadcrumbRacProps({
    ...props,
    children,
    href,
    isDisabled,
    className,
    style,
  } as BreadcrumbCanonicalProps);

  return (
    <RACBreadcrumb
      {...props}
      className={projectedProps.className}
      style={projectedProps.style as React.CSSProperties | undefined}
    >
      <Link href={projectedProps.href} isDisabled={projectedProps.isDisabled}>
        {children ?? projectedProps.children}
      </Link>
    </RACBreadcrumb>
  );
}

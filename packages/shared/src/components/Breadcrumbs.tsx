import {
  Breadcrumbs as RACBreadcrumbs,
  BreadcrumbsProps,
  Breadcrumb,
  Link,
} from "react-aria-components";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { useCollectionData } from "../hooks";
import { Skeleton } from "./Skeleton";
import "./styles/Breadcrumbs.css";

/**
 * RSP API: https://react-spectrum.adobe.com/react-spectrum/Breadcrumbs.html
 * size: 'S' | 'M' | 'L' (default 'M')
 */

export interface BreadcrumbsExtendedProps<
  T extends object,
> extends BreadcrumbsProps<T> {
  /**
   * Controls spacing and layout size. RSP API: 'S' | 'M' | 'L'
   * @default 'M'
   */
  size?: "S" | "M" | "L";
  /**
   * Data binding for dynamic breadcrumb items
   */
  dataBinding?: DataBinding | DataBindingValue;
  /**
   * Column mapping for data binding
   */
  columnMapping?: ColumnMapping;
  /**
   * Show loading skeleton instead of breadcrumbs
   * @default false
   */
  isLoading?: boolean;
  /**
   * Number of skeleton items to show when loading
   * @default 3
   */
  skeletonCount?: number;
}

/**
 * Breadcrumbs — React Spectrum S2 API 기반
 *
 * @example
 * <Breadcrumbs size="M">
 *   <Breadcrumb><Link href="/">Home</Link></Breadcrumb>
 *   <Breadcrumb><Link href="/products">Products</Link></Breadcrumb>
 *   <Breadcrumb><Link>Current Page</Link></Breadcrumb>
 * </Breadcrumbs>
 */
export function Breadcrumbs<T extends object>({
  size = "M",
  dataBinding,
  columnMapping,
  isLoading: externalLoading,
  skeletonCount = 3,
  children,
  ...props
}: BreadcrumbsExtendedProps<T>) {
  // useCollectionData Hook - 항상 최상단에서 호출 (Rules of Hooks)
  const {
    data: boundData,
    loading,
    error,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "Breadcrumbs",
    fallbackData: [
      { id: 1, name: "Home", href: "/" },
      { id: 2, name: "Products", href: "/products" },
      { id: 3, name: "Current", href: "" },
    ],
  });

  // External loading state - show skeleton breadcrumbs
  if (externalLoading) {
    return (
      <nav
        className={
          props.className
            ? `react-aria-Breadcrumbs ${props.className}`
            : "react-aria-Breadcrumbs"
        }
        data-size={size}
        aria-busy="true"
        aria-label="Loading breadcrumbs..."
      >
        <ol
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <li
              key={i}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Skeleton componentVariant="breadcrumb" size="md" index={i} />
              {i < skeletonCount - 1 && (
                <span style={{ color: "var(--color-gray-400)" }}>/</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  // PropertyDataBinding 형식 감지
  const isPropertyBinding =
    dataBinding &&
    "source" in dataBinding &&
    "name" in dataBinding &&
    !("type" in dataBinding);
  const hasDataBinding =
    (!isPropertyBinding &&
      dataBinding &&
      "type" in dataBinding &&
      dataBinding.type === "collection") ||
    isPropertyBinding;

  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const breadcrumbsClassName = baseClassName
    ? `react-aria-Breadcrumbs ${baseClassName}`
    : "react-aria-Breadcrumbs";

  // DataBinding이 있고 columnMapping이 있으면 children 템플릿 사용
  if (hasDataBinding && columnMapping) {
    if (loading) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          <Breadcrumb>
            <Link>⏳ 로딩 중...</Link>
          </Breadcrumb>
        </RACBreadcrumbs>
      );
    }

    if (error) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          <Breadcrumb>
            <Link>❌ 오류</Link>
          </Breadcrumb>
        </RACBreadcrumbs>
      );
    }

    if (boundData.length > 0) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          {children}
        </RACBreadcrumbs>
      );
    }
  }

  // DataBinding이 있고 columnMapping이 없으면 동적 Breadcrumb 생성
  if (hasDataBinding && !columnMapping) {
    if (loading) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          <Breadcrumb>
            <Link>⏳ 로딩 중...</Link>
          </Breadcrumb>
        </RACBreadcrumbs>
      );
    }

    if (error) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          <Breadcrumb>
            <Link>❌ 오류</Link>
          </Breadcrumb>
        </RACBreadcrumbs>
      );
    }

    if (boundData.length > 0) {
      return (
        <RACBreadcrumbs
          {...props}
          className={breadcrumbsClassName}
          data-size={size}
        >
          {boundData.map((item, index) => (
            <Breadcrumb key={String(item.id || index)}>
              <Link href={String(item.href || item.url || "")}>
                {String(
                  item.name || item.title || item.label || `Item ${index + 1}`,
                )}
              </Link>
            </Breadcrumb>
          ))}
        </RACBreadcrumbs>
      );
    }
  }

  // Static children (기존 방식)
  return (
    <RACBreadcrumbs
      {...props}
      className={breadcrumbsClassName}
      data-size={size}
    >
      {children}
    </RACBreadcrumbs>
  );
}

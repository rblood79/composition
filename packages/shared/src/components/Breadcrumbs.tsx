import {
  Breadcrumbs as RACBreadcrumbs,
  BreadcrumbsProps,
  Breadcrumb,
  Link,
} from "react-aria-components";
import type { DataBinding, ColumnMapping, DataBindingValue } from "../types";

import { useResolvedCollectionItems } from "../hooks";
import { Skeleton } from "./Skeleton";
import "./styles/Breadcrumbs.css";
import { useComponentStrings } from "../i18n";

/**
 * RSP API: https://react-spectrum.adobe.com/react-spectrum/Breadcrumbs.html
 * size: 'S' | 'M' | 'L' (default 'M')
 */

export interface BreadcrumbsExtendedProps<
  T extends object,
  // ADR-912 영역 B (A): RAC items(Iterable<T>) 를 Omit 하고 StoredBreadcrumbItem[](unknown[])
  //   로 재선언 — collection items 단일 계약(useResolvedCollectionItems) 이 정규화 source.
> extends Omit<BreadcrumbsProps<T>, "items"> {
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
  /**
   * 정적 items SSOT (ADR-912 영역 B (A): StoredBreadcrumbItem[]).
   * dataBinding 없을 때 source. useResolvedCollectionItems 가 dataBinding 과 동일 normalizer 로 흡수.
   */
  items?: unknown[];
  /** Separator character (composition extension) */
  separator?: string;
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
  columnMapping: _columnMapping,
  isLoading: externalLoading,
  skeletonCount = 3,
  items,
  separator: _separator,
  children,
  ...props
}: BreadcrumbsExtendedProps<T>) {
  const t = useComponentStrings();
  // ADR-912 영역 B (A): collection items 단일 계약 — dataBinding(async/dataTable) 과 정적
  //   props.items(StoredBreadcrumbItem[])를 같은 toItemProjectionRow normalizer 로 흡수.
  //   Skia appendBreadcrumbRowProjection(getFlatProjectionRows) 와 동일 row 형태 = 시각 대칭 SSOT.
  //   row.item 에 raw 보존 → href 접근. label 은 휴리스틱(label/name/title) 추출.
  const { rows, loading, error } = useResolvedCollectionItems({
    dataBinding: dataBinding as DataBinding | undefined,
    items,
    componentName: "Breadcrumbs",
    fallbackData: [
      { id: "bc-home", label: "Home", href: "/" },
      { id: "bc-products", label: "Products", href: "/products" },
      { id: "bc-current", label: "Current" },
    ],
  });

  // 🚀 ClassNameOrFunction 타입 지원 - 문자열로 단순화
  const baseClassName =
    typeof props.className === "string" ? props.className : undefined;
  const breadcrumbsClassName = baseClassName
    ? `react-aria-Breadcrumbs ${baseClassName}`
    : "react-aria-Breadcrumbs";

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

  // dataBinding async 로딩/에러 — 단일 placeholder crumb.
  if (loading) {
    return (
      <RACBreadcrumbs
        {...props}
        className={breadcrumbsClassName}
        data-size={size}
      >
        <Breadcrumb>
          <Link>{t("loading")}</Link>
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
          <Link>{t("error")}</Link>
        </Breadcrumb>
      </RACBreadcrumbs>
    );
  }

  // rows(정규화된 items/dataBinding) 가 있으면 crumb 렌더. RAC <Breadcrumbs> 는 static children
  //   이 있으면 우선하므로, rows 가 있으면 children 대신 rows 기반 Breadcrumb/Link 를 그린다.
  //   rows 가 비면 외부 static JSX children = RAC static collection (직접 사용 호환).
  if (rows.length > 0) {
    return (
      <RACBreadcrumbs
        {...props}
        className={breadcrumbsClassName}
        data-size={size}
      >
        {rows.map((row) => {
          const raw =
            row.item && typeof row.item === "object"
              ? (row.item as Record<string, unknown>)
              : null;
          const href =
            raw && typeof raw.href === "string"
              ? raw.href
              : raw && typeof raw.url === "string"
                ? raw.url
                : undefined;
          return (
            <Breadcrumb key={row.itemKey}>
              <Link href={href}>{row.label}</Link>
            </Breadcrumb>
          );
        })}
      </RACBreadcrumbs>
    );
  }

  // Static children (직접 사용 `<Breadcrumbs><Breadcrumb>...` 호환)
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

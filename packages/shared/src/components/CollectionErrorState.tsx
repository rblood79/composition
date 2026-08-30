/**
 * CollectionErrorState Component
 *
 * Collection 컴포넌트(ListBox, Select, Menu 등)에서 사용하는
 * 에러 상태 및 로딩 상태 표시 컴포넌트
 *
 * Features:
 * - 로딩 스피너
 * - 에러 메시지 + 재시도 버튼
 * - 빈 상태 표시
 */

import React from "react";
import { CircleAlert, RefreshCw, LoaderCircle, Inbox } from "lucide-react";
import { useComponentStrings } from "../i18n";
import "./CollectionErrorState.css";

interface CollectionErrorStateProps {
  /** 로딩 중 여부 */
  loading?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 재시도 콜백 */
  onRetry?: () => void;
  /** 빈 상태 표시 여부 */
  isEmpty?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 컴포넌트 크기 */
  size?: "sm" | "md" | "lg";
  /** 커스텀 높이 */
  height?: number | string;
}

/**
 * 로딩 상태 컴포넌트
 */
export function CollectionLoadingState({
  size = "md",
  height,
}: Pick<CollectionErrorStateProps, "size" | "height">) {
  const t = useComponentStrings();
  return (
    <div
      className={`collection-state collection-loading ${size}`}
      style={height ? { height } : undefined}
    >
      <LoaderCircle
        className="collection-state-spinner"
        size={size === "sm" ? 16 : size === "lg" ? 24 : 20}
      />
      <span className="collection-state-text">{t("loadingDataPlain")}</span>
    </div>
  );
}

/**
 * 에러 상태 컴포넌트 (재시도 버튼 포함)
 */
export function CollectionErrorDisplay({
  error,
  onRetry,
  size = "md",
  height,
}: Pick<CollectionErrorStateProps, "error" | "onRetry" | "size" | "height">) {
  const t = useComponentStrings();
  return (
    <div
      className={`collection-state collection-error ${size}`}
      style={height ? { height } : undefined}
    >
      <div className="collection-error-icon">
        <CircleAlert size={size === "sm" ? 16 : size === "lg" ? 24 : 20} />
      </div>
      <div className="collection-error-content">
        <span className="collection-error-message">
          {error || t("loadFailed")}
        </span>
        {onRetry && (
          <button
            type="button"
            className="collection-error-retry"
            onClick={onRetry}
          >
            <RefreshCw size={14} />
            <span>{t("retry")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
export function CollectionEmptyState({
  message,
  size = "md",
  height,
}: {
  message?: string;
  size?: "sm" | "md" | "lg";
  height?: number | string;
}) {
  const t = useComponentStrings();
  return (
    <div
      className={`collection-state collection-empty ${size}`}
      style={height ? { height } : undefined}
    >
      <Inbox size={size === "sm" ? 16 : size === "lg" ? 24 : 20} />
      <span className="collection-state-text">{message ?? t("emptyData")}</span>
    </div>
  );
}

/**
 * 통합 상태 컴포넌트
 *
 * loading, error, isEmpty 순서로 상태를 체크하고
 * 해당 상태의 UI를 렌더링합니다.
 * 모든 상태가 false이면 null을 반환합니다.
 */
export function CollectionState({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  size = "md",
  height,
}: CollectionErrorStateProps) {
  if (loading) {
    return <CollectionLoadingState size={size} height={height} />;
  }

  if (error) {
    return (
      <CollectionErrorDisplay
        error={error}
        onRetry={onRetry}
        size={size}
        height={height}
      />
    );
  }

  if (isEmpty) {
    return (
      <CollectionEmptyState
        message={emptyMessage}
        size={size}
        height={height}
      />
    );
  }

  return null;
}

export default CollectionState;

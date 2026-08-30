import React from "react";
import { Button } from "./Button";
import { useComponentStrings } from "../i18n";
import "./styles/generated/Pagination.css";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
  showPageInfo?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  hasNextPage,
  isLoading = false,
  onPageChange,
  totalItems,
  showPageInfo = true,
  className = "",
}) => {
  const t = useComponentStrings();
  const handlePrevious = () => {
    if (currentPage > 1 && !isLoading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (hasNextPage && !isLoading) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (!isLoading && page !== currentPage) {
      onPageChange(page);
    }
  };

  // 페이지 번호 배열 생성 (최대 5개)
  const getPageNumbers = () => {
    const maxVisible = 5;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxVisible - 1);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`react-aria-Pagination ${className}`}>
      {/* 페이지네이션 버튼들 */}
      <div className="pagination-controls">
        {/* 이전 페이지 버튼 */}
        <Button
          onPress={handlePrevious}
          isDisabled={currentPage <= 1 || isLoading}
          children={t("previousPage")}
        />

        {/* 페이지 번호들 */}
        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            onPress={() => handlePageClick(pageNum)}
            isDisabled={isLoading}
            data-current={pageNum === currentPage}
            aria-label={t("goToPage", { page: pageNum })}
            aria-current={pageNum === currentPage ? "page" : undefined}
            children={pageNum}
          />
        ))}

        {/* 생략 표시 */}
        {totalPages > 5 && currentPage < totalPages - 2 && (
          <span className="pagination-ellipsis">...</span>
        )}

        {/* 마지막 페이지 */}
        {totalPages > 5 && currentPage < totalPages - 2 && (
          <Button
            onPress={() => handlePageClick(totalPages)}
            isDisabled={isLoading}
            aria-label={t("goToPage", { page: totalPages })}
            children={totalPages}
          />
        )}

        {/* 다음 페이지 버튼 */}
        <Button
          onPress={handleNext}
          isDisabled={!hasNextPage || isLoading}
          aria-label={t("nextPageLabel")}
          children={t("nextPage")}
        />
      </div>

      {/* 페이지 정보 */}
      {showPageInfo && (
        <div className="pagination-info">
          {totalItems ? (
            <>
              {t("pageOfTotal", { current: currentPage, total: totalPages })}
              <span className="mx-1">•</span>
              {t("totalItems", { count: totalItems })}
            </>
          ) : (
            t("pageOfTotal", { current: currentPage, total: totalPages })
          )}
        </div>
      )}
    </div>
  );
};

export default Pagination;

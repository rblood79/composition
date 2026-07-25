/**
 * SelectionFilter - 선택 필터 컴포넌트
 *
 * Phase 3: Advanced Selection - Selection Filters
 * 타입, 태그, 속성으로 요소 필터링
 */

import { useState, useMemo } from "react";
import type { Element } from "../../../types/core/store.types";
import { PropertyInput, PropertySelect } from "../property";
import { Filter, X } from "lucide-react";
import { Button } from "@composition/shared/components";
import { iconProps } from "../../../utils/ui/uiConstants";

import "./SelectionFilter.css";
export interface SelectionFilterProps {
  /** 전체 요소 목록 */
  allElements: Element[];
  /** 필터링 결과 콜백 */
  onFilteredElements: (elementIds: string[]) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 선택 필터 컴포넌트
 *
 * @example
 * ```tsx
 * <SelectionFilter
 *   allElements={elements}
 *   onFilteredElements={(ids) => setSelectedElements(ids)}
 * />
 * ```
 */
export function SelectionFilter({
  allElements,
  onFilteredElements,
  className = "",
}: SelectionFilterProps) {
  const [filterType, setFilterType] = useState<
    "all" | "type" | "tag" | "property"
  >("all");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [propertyKey, setPropertyKey] = useState<string>("");
  const [propertyValue, setPropertyValue] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Get unique tags
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();

    allElements.forEach((el) => {
      tags.add(el.type);
    });

    return Array.from(tags).sort();
  }, [allElements]);

  // Apply filter
  const handleApplyFilter = () => {
    let filtered: Element[] = [];

    switch (filterType) {
      case "all":
        filtered = allElements;
        break;

      case "type":
      case "tag":
        if (selectedTag) {
          filtered = allElements.filter((el) => el.type === selectedTag);
        }
        break;

      case "property":
        if (propertyKey) {
          filtered = allElements.filter((el) => {
            const props = el.props || {};
            if (!(propertyKey in props)) return false;

            if (propertyValue) {
              // Match property value
              const value = String(props[propertyKey] || "");
              return value.toLowerCase().includes(propertyValue.toLowerCase());
            }

            // Just check if property exists
            return propertyKey in props;
          });
        }
        break;
    }

    const filteredIds = filtered.map((el) => el.id);
    onFilteredElements(filteredIds);

    console.log(
      `✅ [Filter] Applied ${filterType} filter, found ${filteredIds.length} elements`,
    );
  };

  // Clear filter
  const handleClearFilter = () => {
    setFilterType("all");
    setSelectedTag("");
    setPropertyKey("");
    setPropertyValue("");
    onFilteredElements(allElements.map((el) => el.id));
    console.log("✅ [Filter] Cleared filter");
  };

  if (!isExpanded) {
    return (
      <div className={`selection-filter collapsed ${className}`.trim()}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setIsExpanded(true)}
          aria-label="Show filter options"
        >
          <Filter
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
          <span>필터</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`selection-filter ${className}`.trim()}>
      <div className="filter-header">
        <div className="filter-title">
          <Filter size={iconProps.size} />
          <span>선택 필터</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setIsExpanded(false)}
          aria-label="Hide filter options"
        >
          <X size={iconProps.size} />
        </Button>
      </div>

      <div className="filter-content">
        <PropertySelect
          label="필터 타입"
          value={filterType}
          onChange={(value) => setFilterType(value as typeof filterType)}
          options={[
            { value: "all", label: "전체" },
            { value: "type", label: "타입으로" },
            { value: "tag", label: "태그로" },
            { value: "property", label: "속성으로" },
          ]}
        />

        {(filterType === "type" || filterType === "tag") && (
          <PropertySelect
            label="태그"
            value={selectedTag}
            onChange={setSelectedTag}
            options={[
              { value: "", label: "선택하세요" },
              ...uniqueTags.map((type) => ({ value: type, label: type })),
            ]}
          />
        )}

        {filterType === "property" && (
          <>
            <PropertyInput
              label="속성 키"
              value={propertyKey}
              onChange={setPropertyKey}
              placeholder="예: className, id, style"
            />
            <PropertyInput
              label="속성 값 (선택)"
              value={propertyValue}
              onChange={setPropertyValue}
              placeholder="값 검색 (비워두면 존재 여부만 확인)"
            />
          </>
        )}

        <div className="filter-actions">
          <Button
            variant="primary"
            size="sm"
            onPress={handleApplyFilter}
            isDisabled={
              ((filterType === "type" || filterType === "tag") &&
                !selectedTag) ||
              (filterType === "property" && !propertyKey)
            }
          >
            필터 적용
          </Button>
          <Button variant="ghost" size="sm" onPress={handleClearFilter}>
            초기화
          </Button>
        </div>
      </div>
    </div>
  );
}

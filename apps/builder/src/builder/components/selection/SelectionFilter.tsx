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
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
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
          <span>{t("selection.filter")}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`selection-filter ${className}`.trim()}>
      <div className="filter-header">
        <div className="filter-title">
          <Filter size={iconProps.size} />
          <span>{t("selection.filterTitle")}</span>
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
          label={t("selection.filterType")}
          value={filterType}
          onChange={(value) => setFilterType(value as typeof filterType)}
          options={[
            { value: "all", label: t("selection.filterAll") },
            { value: "type", label: t("selection.filterByType") },
            { value: "tag", label: t("selection.filterByTag") },
            { value: "property", label: t("selection.filterByProperty") },
          ]}
        />

        {(filterType === "type" || filterType === "tag") && (
          <PropertySelect
            label={t("selection.tag")}
            value={selectedTag}
            onChange={setSelectedTag}
            options={[
              { value: "", label: t("selection.choose") },
              ...uniqueTags.map((type) => ({ value: type, label: type })),
            ]}
          />
        )}

        {filterType === "property" && (
          <>
            <PropertyInput
              label={t("selection.propertyKey")}
              value={propertyKey}
              onChange={setPropertyKey}
              placeholder={t("selection.propertyKeyPlaceholder")}
            />
            <PropertyInput
              label={t("selection.propertyValue")}
              value={propertyValue}
              onChange={setPropertyValue}
              placeholder={t("selection.propertyValuePlaceholder")}
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
            {t("selection.applyFilter")}
          </Button>
          <Button variant="ghost" size="sm" onPress={handleClearFilter}>
            {t("selection.reset")}
          </Button>
        </div>
      </div>
    </div>
  );
}

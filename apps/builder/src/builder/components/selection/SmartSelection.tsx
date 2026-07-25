/**
 * SmartSelection - AI 기반 스마트 선택 컴포넌트
 *
 * Phase 9: Advanced Features - Smart Selection
 * 요소 관계 및 패턴 기반 선택 제안
 */

import { useMemo } from "react";
import type { Element } from "../../../types/core/store.types";
import { Button } from "@composition/shared/components";
import { Sparkles, Users, GitBranch, Box, Tag, Palette, Type } from "lucide-react";
import { iconProps, iconLarge } from "../../../utils/ui/uiConstants";
import { getAllSuggestions, type SuggestionResult } from "../../utils/smartSelection";

import "./SmartSelection.css";
export interface SmartSelectionProps {
  /** Reference element (primary selected element) */
  referenceElement: Element;
  /** All elements in the page */
  allElements: Element[];
  /** Selection callback */
  onSelect: (elementIds: string[]) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Icon mapping for suggestion types
 */
const SUGGESTION_ICONS = {
  similar: Sparkles,
  siblings: Users,
  children: GitBranch,
  parent: Box,
  sameType: Tag,
  sameClass: Palette,
  sameStyle: Type,
};

/**
 * Smart Selection 컴포넌트
 *
 * @example
 * ```tsx
 * <SmartSelection
 *   referenceElement={selectedElement}
 *   allElements={elements}
 *   onSelect={(ids) => setSelectedElements(ids)}
 * />
 * ```
 */
export function SmartSelection({
  referenceElement,
  allElements,
  onSelect,
  className = "",
}: SmartSelectionProps) {
  // Get all suggestions
  const suggestions = useMemo(() => {
    return getAllSuggestions(referenceElement.id, allElements);
  }, [referenceElement.id, allElements]);

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SuggestionResult) => {
    console.log(`[SmartSelection] Applying suggestion: ${suggestion.type}, count: ${suggestion.count}`);
    onSelect(suggestion.elementIds);
  };

  if (suggestions.length === 0) {
    return (
      <div className={`smart-selection empty ${className}`.trim()}>
        <div className="empty-state">
          <Sparkles size={iconLarge.size} color="var(--fg-disabled)" />
          <p className="empty-text">No smart selection suggestions available</p>
          <p className="empty-hint">
            Select an element with siblings, children, or similar elements to see suggestions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`smart-selection ${className}`.trim()}>
      <div className="smart-selection-header">
        <Sparkles
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
        <h3>Smart Select</h3>
        <span className="suggestion-count">{suggestions.length} suggestions</span>
      </div>

      <div className="suggestions-list">
        {suggestions.map((suggestion) => {
          const Icon = SUGGESTION_ICONS[suggestion.type];

          return (
            <Button
              key={suggestion.type}
              variant="ghost"
              size="sm"
              onPress={() => handleSuggestionClick(suggestion)}
              className="suggestion-item"
            >
              <Icon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
              <div className="suggestion-info">
                <span className="suggestion-description">{suggestion.description}</span>
                <span className="suggestion-count-badge">{suggestion.count} found</span>
              </div>
            </Button>
          );
        })}
      </div>

      <div className="smart-selection-footer">
        <p className="footer-hint">
          💡 Click a suggestion to select matching elements
        </p>
      </div>
    </div>
  );
}

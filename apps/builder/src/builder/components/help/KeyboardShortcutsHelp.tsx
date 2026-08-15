/**
 * KeyboardShortcutsHelp - 키보드 단축키 도움말 패널
 *
 * 모든 단축키를 카테고리별로 정리하여 표시
 * - 설정 파일(keyboardShortcuts.ts)에서 자동 로드
 * - 검색 기능
 * - 카테고리 탭 필터링
 *
 * @since Sprint 3: Keyboard Shortcuts Enhancement
 * @updated Phase 5 - 설정 파일 연동 및 검색/탭 추가 (2025-12-28)
 */

import { useState, useMemo } from "react";
import { Button } from "@composition/shared/components";
import { Keyboard, X, ChevronDown, ChevronRight, Search } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  SHORTCUT_DEFINITIONS,
  getShortcutsByCategory,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import { formatShortcut, type ShortcutCategory } from "@/builder/hooks";

// ============================================
// Types
// ============================================

export interface KeyboardShortcutsHelpProps {
  /** Whether help panel is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Additional CSS class */
  className?: string;
}

interface DisplayShortcut {
  id: ShortcutId;
  key: string;
  display: string;
  description: string;
  category: ShortcutCategory;
  i18nDescription?: string;
}

// ============================================
// Constants
// ============================================

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  system: "System",
  navigation: "Navigation",
  panels: "Panels",
  canvas: "Canvas",
  tools: "Tools",
  properties: "Properties",
  events: "Events",
  nodes: "Nodes",
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  "system",
  "navigation",
  "canvas",
  "panels",
  "properties",
  "events",
  "nodes",
  "tools",
];

// ============================================
// Helper Functions
// ============================================

/**
 * 설정 파일에서 표시용 단축키 목록 생성
 */
function getDisplayShortcuts(): DisplayShortcut[] {
  return Object.entries(SHORTCUT_DEFINITIONS).map(([id, def]) => ({
    id: id as ShortcutId,
    key: def.key,
    display: formatShortcut({ key: def.key, modifier: def.modifier }),
    description: def.description,
    category: def.category,
    i18nDescription: def.i18n?.ko,
  }));
}

/**
 * 검색어로 단축키 필터링
 */
function filterBySearch(
  shortcuts: DisplayShortcut[],
  search: string,
): DisplayShortcut[] {
  if (!search.trim()) return shortcuts;

  const query = search.toLowerCase();
  return shortcuts.filter(
    (s) =>
      s.description.toLowerCase().includes(query) ||
      s.i18nDescription?.toLowerCase().includes(query) ||
      s.key.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query),
  );
}

/**
 * 카테고리로 단축키 필터링
 */
function filterByCategory(
  shortcuts: DisplayShortcut[],
  category: ShortcutCategory | "all",
): DisplayShortcut[] {
  if (category === "all") return shortcuts;
  return shortcuts.filter((s) => s.category === category);
}

/**
 * 카테고리별 그룹화
 */
function groupByCategory(
  shortcuts: DisplayShortcut[],
): Record<ShortcutCategory, DisplayShortcut[]> {
  const grouped: Partial<Record<ShortcutCategory, DisplayShortcut[]>> = {};

  for (const shortcut of shortcuts) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category]!.push(shortcut);
  }

  return grouped as Record<ShortcutCategory, DisplayShortcut[]>;
}

// ============================================
// Component
// ============================================

/**
 * Keyboard Shortcuts Help Panel
 *
 * @example
 * ```tsx
 * const [showHelp, setShowHelp] = useState(false);
 *
 * <KeyboardShortcutsHelp
 *   isOpen={showHelp}
 *   onClose={() => setShowHelp(false)}
 * />
 * ```
 */
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  className = "",
}: KeyboardShortcutsHelpProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ShortcutCategory | "all">("all");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<ShortcutCategory>
  >(new Set());

  // 모든 단축키 로드 (설정 파일에서)
  const allShortcuts = useMemo(() => getDisplayShortcuts(), []);

  // 필터링된 단축키
  const filteredShortcuts = useMemo(() => {
    let result = allShortcuts;
    result = filterBySearch(result, search);
    result = filterByCategory(result, activeTab);
    return result;
  }, [allShortcuts, search, activeTab]);

  // 카테고리별 그룹화
  const groupedShortcuts = useMemo(
    () => groupByCategory(filteredShortcuts),
    [filteredShortcuts],
  );

  // 카테고리별 개수
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ShortcutCategory | "all", number>> = {
      all: allShortcuts.length,
    };
    const byCategory = getShortcutsByCategory();
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = byCategory[cat]?.length || 0;
    }
    return counts;
  }, [allShortcuts]);

  if (!isOpen) return null;

  const toggleCategory = (category: ShortcutCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // 검색 시 모든 카테고리 펼치기
    if (value.trim()) {
      setCollapsedCategories(new Set());
    }
  };

  return (
    <div className={`keyboard-shortcuts-help ${className}`.trim()}>
      <div className="shortcuts-overlay" onClick={onClose} />

      <div className="shortcuts-panel">
        {/* Header */}
        <div className="shortcuts-header">
          <div className="shortcuts-title">
            <Keyboard
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onPress={onClose}
            aria-label="Close keyboard shortcuts help"
          >
            <X
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </Button>
        </div>

        {/* Search */}
        <div className="shortcuts-search">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search shortcuts..."
              aria-label="Search keyboard shortcuts"
              className="search-input"
            />
            {search && (
              <button
                className="search-clear"
                onClick={() => handleSearchChange("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="shortcuts-tabs">
          <button
            className={`shortcuts-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({categoryCounts.all})
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              className={`shortcuts-tab ${activeTab === cat ? "active" : ""}`}
              onClick={() => setActiveTab(cat)}
            >
              {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="shortcuts-content">
          {filteredShortcuts.length === 0 ? (
            <div className="shortcuts-empty">
              <p>No shortcuts found for "{search}"</p>
            </div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const shortcuts = groupedShortcuts[category];
              if (!shortcuts || shortcuts.length === 0) return null;

              const isCollapsed = collapsedCategories.has(category);

              return (
                <div key={category} className="shortcuts-category">
                  <button
                    className="category-header"
                    onClick={() => toggleCategory(category)}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRight size={iconProps.size} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={iconProps.size} strokeWidth={2} />
                    )}
                    <h3>{CATEGORY_LABELS[category]}</h3>
                    <span className="category-count">({shortcuts.length})</span>
                  </button>

                  {!isCollapsed && (
                    <div className="shortcuts-list">
                      {shortcuts.map((shortcut) => (
                        <div key={shortcut.id} className="shortcut-item">
                          <span className="shortcut-description">
                            {shortcut.i18nDescription || shortcut.description}
                          </span>
                          <kbd className="shortcut-keys">
                            {shortcut.display}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="shortcuts-footer">
          <p className="shortcuts-hint">
            Press{" "}
            <kbd>
              {formatShortcut({
                key: SHORTCUT_DEFINITIONS.toggleHelp.key,
                modifier: SHORTCUT_DEFINITIONS.toggleHelp.modifier,
              })}
            </kbd>{" "}
            anytime to toggle this help panel
          </p>
          <p className="shortcuts-count">
            {filteredShortcuts.length} of {allShortcuts.length} shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}

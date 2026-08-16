/**
 * CommandPalette - 커맨드 팔레트 컴포넌트
 *
 * Cmd+K로 열리는 검색 가능한 명령어 팔레트
 * 모든 단축키를 검색하고 실행할 수 있음
 *
 * @since Phase 7 구현 (2025-12-29)
 *
 * @example
 * ```tsx
 * // BuilderCore에서 사용
 * <CommandPalette />
 * ```
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  Dialog,
  ListBox,
  ListBoxItem,
  ModalOverlay,
} from "react-aria-components";
import { Search } from "lucide-react";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import {
  formatShortcut,
  useKeyboardShortcutsRegistry,
  usePanelLayout,
  type ShortcutCategory,
} from "@/builder/hooks";
import { iconProps } from "../../../utils/ui/uiConstants";
import "./CommandPalette.css";

// ============================================
// Types
// ============================================

interface CommandItem {
  id: ShortcutId;
  label: string;
  category: ShortcutCategory;
  shortcut: string;
}

export interface CommandPaletteProps {
  /** 외부에서 상태 제어 시 사용 */
  isOpen?: boolean;
  /** 외부에서 상태 제어 시 사용 */
  onOpenChange?: (isOpen: boolean) => void;
}

// ============================================
// Constants
// ============================================

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  system: "시스템",
  navigation: "탐색",
  panels: "패널",
  canvas: "캔버스",
  tools: "도구",
  properties: "속성",
  events: "이벤트",
  nodes: "노드",
};

// ============================================
// Component
// ============================================

export function CommandPalette({
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CommandPaletteProps = {}) {
  // State
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Controlled vs Uncontrolled
  const isOpen = controlledOpen ?? internalOpen;

  // 열림 상태 변경 핸들러 (검색어 초기화 포함)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setSearch(""); // 열릴 때 검색어 초기화
      }
      if (controlledOnOpenChange) {
        controlledOnOpenChange(open);
      } else {
        setInternalOpen(open);
      }
    },
    [controlledOnOpenChange],
  );

  // 모든 명령어 목록 생성
  const allCommands: CommandItem[] = useMemo(() => {
    return Object.entries(SHORTCUT_DEFINITIONS).map(([id, def]) => ({
      id: id as ShortcutId,
      label: def.i18n?.ko || def.description,
      category: def.category,
      shortcut: formatShortcut({ key: def.key, modifier: def.modifier }),
    }));
  }, []);

  // 검색 결과 필터링
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return allCommands;

    const query = search.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query) ||
        cmd.shortcut.toLowerCase().includes(query),
    );
  }, [allCommands, search]);

  // 커스텀 이벤트로 외부에서 열기
  useEffect(() => {
    const handler = () => handleOpenChange(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, [handleOpenChange]);

  // Cmd+K로 열기
  useKeyboardShortcutsRegistry(
    [
      {
        key: "k",
        modifier: "cmd",
        handler: () => {
          handleOpenChange(true);
        },
        preventDefault: true,
        priority: 95,
        category: "system",
        description: "Open command palette",
      },
    ],
    [handleOpenChange],
    { capture: true },
  );

  // 열릴 때 입력창에 포커스
  useEffect(() => {
    if (isOpen) {
      // 약간의 지연 후 포커스 (모달 애니메이션 완료 후)
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 패널 토글 액션을 위한 훅
  const { togglePanel, toggleBottomPanel } = usePanelLayout();

  // 명령 실행
  const executeCommand = useCallback(
    (commandId: ShortcutId) => {
      // 팔레트 닫기
      handleOpenChange(false);

      // 패널 토글 명령 처리
      //
      // 종전에 여기 `openSettingsModal` / `openHistoryModal` / `openAIModal`
      // 세 case 가 `openPanelAsModal(...)` 을 불렀는데, 그 id 들은
      // `SHORTCUT_DEFINITIONS` 에 **존재하지 않아** 한 번도 실행되지 않는
      // 죽은 분기였다 (실제 정의는 `openSettings` 하나이고 아래에서 패널
      // 토글로 처리된다). `ShortcutId` 가 `string` 으로 무너져 있어서
      // 컴파일러가 잡지 못했다 — 2026-08-17 리터럴 union 복원으로 드러남.
      // 팔레트에서 모달로 여는 동선이 필요하면 단축키 정의부터 추가할 것
      // (`openPanelAsModal` 자체는 BuilderHeader 설정 버튼에서 살아 있다).
      switch (commandId) {
        case "toggleNodes":
          togglePanel("left", "nodes");
          return;
        case "toggleComponents":
          togglePanel("left", "components");
          return;
        case "toggleProperties":
          togglePanel("right", "properties");
          return;
        case "toggleStyles":
          togglePanel("right", "styles");
          return;
        case "toggleEvents":
          togglePanel("right", "events");
          return;
        case "toggleHistory":
          togglePanel("right", "history");
          return;
        case "toggleMonitor":
          toggleBottomPanel("monitor");
          return;
        case "openSettings":
          togglePanel("left", "settings");
          return;
        default:
          // 다른 명령은 키보드 이벤트로 시뮬레이션
          // (향후 command registry 통합 시 개선 가능)
          break;
      }
    },
    [handleOpenChange, togglePanel, toggleBottomPanel],
  );

  // 키보드 내비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleOpenChange(false);
      }
    },
    [handleOpenChange],
  );

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      className="command-palette-overlay"
    >
      <Modal className="command-palette-modal">
        <Dialog aria-label="Command Palette">
          <div onKeyDown={handleKeyDown}>
            {/* Search Input */}
            <div className="command-palette-search">
              <Search
                size={iconProps.size}
                className="command-palette-search-icon"
              />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="명령어 검색..."
                className="command-palette-input"
                aria-label="Search commands"
              />
            </div>

            {/* Command List */}
            {filteredCommands.length > 0 ? (
              <ListBox
                aria-label="Commands"
                className="command-palette-list"
                selectionMode="single"
                onAction={(key) => executeCommand(key as ShortcutId)}
              >
                {filteredCommands.map((cmd) => (
                  <ListBoxItem
                    key={cmd.id}
                    id={cmd.id}
                    textValue={cmd.label}
                    className="command-palette-item"
                  >
                    <div className="command-palette-item-content">
                      <span className="command-palette-item-label">
                        {cmd.label}
                      </span>
                      <span className="command-palette-item-category">
                        {CATEGORY_LABELS[cmd.category]}
                      </span>
                    </div>
                    <kbd className="command-palette-kbd">{cmd.shortcut}</kbd>
                  </ListBoxItem>
                ))}
              </ListBox>
            ) : (
              <div className="command-palette-empty">
                "{search}"에 대한 결과가 없습니다
              </div>
            )}

            {/* Footer */}
            <div className="command-palette-footer">
              <div className="command-palette-hints">
                <span className="command-palette-hint">
                  <kbd>↑↓</kbd> 이동
                </span>
                <span className="command-palette-hint">
                  <kbd>↵</kbd> 실행
                </span>
                <span className="command-palette-hint">
                  <kbd>esc</kbd> 닫기
                </span>
              </div>
              <span>{filteredCommands.length}개 명령어</span>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export default CommandPalette;

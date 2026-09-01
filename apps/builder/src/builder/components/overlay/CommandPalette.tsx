/**
 * CommandPalette - 커맨드 팔레트 컴포넌트
 *
 * ⌘/ 로 열리는 검색 가능한 명령어 팔레트. 정의(`SHORTCUT_DEFINITIONS`)를 나열하고
 * **실행은 `commandRegistry` 조회로** 한다 (ADR-195) — 팔레트 자체 핸들러 0.
 *
 * 종전에는 `executeCommand` 의 switch 12 case (패널 토글 11 + 프로젝트 열기) 만
 * 실행되고 나머지 59개는 골라도 팔레트만 닫혔다. 핸들러가 등록 hook 의 effect
 * 클로저에 갇혀 조회할 길이 없었기 때문이다. 이제 등록 hook 이 `(id → handler,
 * scope)` 를 게시하므로 팔레트는 그것을 읽어 실행 가능 여부까지 표시한다.
 *
 * @since Phase 7 구현 (2025-12-29)
 * @updated ADR-195 — command registry 소비 (2026-08-27)
 */

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  Modal,
  Dialog,
  ListBox,
  ListBoxItem,
  ModalOverlay,
} from "react-aria-components";
import { Command, SearchX, X } from "lucide-react";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import {
  bindHandlersToDefinitions,
  formatShortcut,
  useActiveScope,
  useKeyboardShortcutsRegistry,
  type ShortcutCategory,
} from "@/builder/hooks";
import { matchesScope } from "../../hooks/useActiveScope";
import { useI18n } from "@/i18n";
import {
  getCommandRegistrySnapshot,
  resolveCommand,
  subscribeCommandRegistry,
} from "../../stores/commandRegistry";
import type { ShortcutDefinition, ShortcutScope } from "../../types/keyboard";
import { iconProps } from "../../../utils/ui/uiConstants";
import { PanelHeader } from "../panel/PanelHeader";
import { ActionIconButton } from "../ui/ActionIconButton";
import { SearchField as BuilderSearchField } from "../ui/SearchField";
import { EmptyState } from "../feedback/EmptyState";
import "./CommandPalette.css";

// ============================================
// Types
// ============================================

/** 실행 불가 사유 3종 — 흐림 표시의 힌트가 여기서 나온다. */
type CommandAvailability = "executable" | "scope-mismatch" | "unregistered";

interface CommandItem {
  id: ShortcutId;
  label: string;
  category: ShortcutCategory;
  shortcut: string;
  scope: ShortcutScope | readonly ShortcutScope[];
  availability: CommandAvailability;
  /** 힌트 **키** — 표시 시점에 해소한다 (ADR-200). 실행 가능하면 null. */
  hint: string | null;
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

const CATEGORY_LABEL_KEYS: Record<ShortcutCategory, string> = {
  system: "commandPalette.categorySystem",
  navigation: "commandPalette.categoryNavigation",
  panels: "commandPalette.categoryPanels",
  canvas: "commandPalette.categoryCanvas",
  tools: "commandPalette.categoryTools",
  properties: "commandPalette.categoryProperties",
  events: "commandPalette.categoryEvents",
  navigator: "commandPalette.categoryNavigator",
};

/** scope 불일치 힌트 — "무엇을 해야 실행되는가" 를 말한다. */
const SCOPE_HINT_KEYS: Record<ShortcutScope, string> = {
  global: "commandPalette.scopeGlobal",
  "canvas-focused": "commandPalette.scopeCanvasFocused",
  "panel:properties": "commandPalette.scopePanelProperties",
  "panel:styles": "commandPalette.scopePanelStyles",
  "panel:events": "commandPalette.scopePanelEvents",
  "panel:navigator": "commandPalette.scopePanelNavigator",
  modal: "commandPalette.scopeModal",
  "text-editing": "commandPalette.scopeTextEditing",
};

/** 라벨이 아니라 **키**를 돌려준다 — 해소는 표시 시점에 한다 (ADR-200). */
function scopeHintKey(
  scope: ShortcutScope | readonly ShortcutScope[],
): string | null {
  // 배열이면 첫 scope 를 대표로 삼는다 — 정의의 첫 항목이 주 컨텍스트다
  // (`copy` = ["canvas-focused", "panel:events"] → "캔버스에서").
  const first: ShortcutScope = Array.isArray(scope)
    ? (scope as readonly ShortcutScope[])[0]
    : (scope as ShortcutScope);
  return SCOPE_HINT_KEYS[first] ?? null;
}

/** 실행 불가 사유 → 힌트 키. 등록 자체가 없는 항목은 global 과 같은 문장이다. */
function hintKeyFor(
  availability: CommandAvailability,
  scope: ShortcutScope | readonly ShortcutScope[],
): string | null {
  if (availability === "executable") return null;
  if (availability === "scope-mismatch") return scopeHintKey(scope);
  return SCOPE_HINT_KEYS.global;
}

/**
 * `scopeAtOpen` 갱신을 건너뛸 상태인지 — 팔레트가 열려 있는 동안(modal)과,
 * 포커스가 오버레이 안이거나 입력창일 때.
 *
 * 헤더 메뉴 "Shortcuts" 경유 열기가 이것을 필요로 한다 (2026-08-27 실측):
 * 메뉴를 열면 포커스가 `div.header-menu[role=menu] < div.header-menu-popover
 * [role=dialog]` 로 옮겨 가는데, popover 는 `aria-modal` 이 없어 modal 로 잡히지
 * 않으면서 캔버스 판정도 빗나가 scope 가 활성 패널/global 로 밀린다. 그 값을
 * 잡으면 캔버스 명령이 전부 흐려진다. `text-editing` 도 같은 이유로 뺀다 —
 * 어느 정의도 그 scope 를 갖지 않아 캔버스 명령이 전부 실행 불가가 된다.
 */
function isTransientScope(scope: ShortcutScope): boolean {
  if (scope === "modal" || scope === "text-editing") return true;
  return Boolean(
    document.activeElement?.closest(
      '[role="dialog"],[role="menu"],[role="alertdialog"]',
    ),
  );
}

interface ScopeCaptureState {
  observedScope: ShortcutScope;
  observedOpen: boolean;
  stableScope: ShortcutScope;
  scopeAtOpen: ShortcutScope;
}

function createScopeCaptureState(
  activeScope: ShortcutScope,
  isOpen: boolean,
): ScopeCaptureState {
  const stableScope = isTransientScope(activeScope) ? "global" : activeScope;
  return {
    observedScope: activeScope,
    observedOpen: isOpen,
    stableScope,
    scopeAtOpen: stableScope,
  };
}

function deriveScopeCaptureState(
  previous: ScopeCaptureState,
  activeScope: ShortcutScope,
  isOpen: boolean,
): ScopeCaptureState {
  const stableScope = isTransientScope(activeScope)
    ? previous.stableScope
    : activeScope;
  const justOpened = isOpen && !previous.observedOpen;
  const scopeAtOpen = justOpened
    ? stableScope
    : isOpen
      ? previous.scopeAtOpen
      : stableScope;

  return {
    observedScope: activeScope,
    observedOpen: isOpen,
    stableScope,
    scopeAtOpen,
  };
}

// ============================================
// Component
// ============================================

export function CommandPalette({
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CommandPaletteProps = {}) {
  const { t } = useI18n();

  // State
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Controlled vs Uncontrolled
  const isOpen = controlledOpen ?? internalOpen;

  // 열기 전 컨텍스트 — 팔레트가 열리면 scope 는 `modal` 이라 원래 컨텍스트를
  // 알 수 없다. 닫힌 동안 마지막 "안정" scope 를 따라가고, 열리는 전이에서
  // `scopeAtOpen` 으로 굳힌다. controlled open 첫 렌더도 같은 상태 전이를 거친다.
  const activeScope = useActiveScope();
  const [scopeCapture, setScopeCapture] = useState<ScopeCaptureState>(() =>
    createScopeCaptureState(activeScope, isOpen),
  );
  if (
    scopeCapture.observedScope !== activeScope ||
    scopeCapture.observedOpen !== isOpen
  ) {
    setScopeCapture(deriveScopeCaptureState(scopeCapture, activeScope, isOpen));
  }
  const scopeAtOpen = scopeCapture.scopeAtOpen;

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

  // registry 구독은 **열린 동안만** — global 등록부는 deps 에 `activeScope` 가
  // 있어 focusin 마다 42건을 재게시한다. 닫힌 팔레트가 포커스 이동마다
  // 재렌더되지 않게 한다 (ADR-195 R4).
  const registrySnapshot = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        isOpen ? subscribeCommandRegistry(onStoreChange) : () => {},
      [isOpen],
    ),
    getCommandRegistrySnapshot,
    getCommandRegistrySnapshot,
  );

  // 모든 명령어 목록 — `palette: false` 는 뺀다 (팔레트 자신 + 레이어 트리 8종)
  const allCommands: CommandItem[] = useMemo(() => {
    // `SHORTCUT_DEFINITIONS` 는 `as const satisfies` 라 인덱싱 결과가 71개 리터럴
    // 객체의 union 이다 — `palette` 처럼 일부 항목에만 있는 optional 필드는 union
    // 상태로 읽을 수 없다. 공통 형태로 한 번 넓혀서 읽는다 (`satisfies` 가 대입
    // 가능성을 보증) — `bindHandlersToDefinitions` 와 같은 어법.
    return (
      Object.entries(SHORTCUT_DEFINITIONS) as [ShortcutId, ShortcutDefinition][]
    )
      .filter(([, def]) => def.palette !== false)
      .map(([id, def]) => {
        const entry = registrySnapshot.get(id);
        const availability: CommandAvailability = !entry
          ? "unregistered"
          : matchesScope(def.scope, scopeAtOpen)
            ? "executable"
            : "scope-mismatch";

        return {
          id,
          label: t(`command.${id}`),
          category: def.category,
          shortcut: formatShortcut({ key: def.key, modifier: def.modifier }),
          scope: def.scope,
          availability,
          hint: hintKeyFor(availability, def.scope),
        };
      });
  }, [registrySnapshot, scopeAtOpen, t]);

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

  const executableCount = useMemo(
    () =>
      filteredCommands.filter((cmd) => cmd.availability === "executable")
        .length,
    [filteredCommands],
  );

  // 커스텀 이벤트로 외부에서 열기
  useEffect(() => {
    const handler = () => handleOpenChange(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, [handleOpenChange]);

  // ⌘/ 로 열기 — ⌘K 는 AI 패널에 내줬다 (Pencil 이 ⌘K 를 AI 채팅에 쓴다).
  // 조합은 `commandPalette` 정의가 정본이다. 종전에는 여기서 손으로 적어
  // 정의가 아예 없었고, 그래서 팔레트 자기 목록에도 나오지 않았다.
  const paletteShortcuts = useMemo(
    () =>
      bindHandlersToDefinitions(["commandPalette"], {
        commandPalette: () => handleOpenChange(true),
      }),
    [handleOpenChange],
  );
  useKeyboardShortcutsRegistry(paletteShortcuts, [paletteShortcuts], {
    capture: true,
  });

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

  /**
   * 명령 실행 — 팔레트는 registry 를 조회할 뿐 자체 핸들러를 갖지 않는다.
   *
   * 닫고 나서 RAC `ModalOverlay` 가 트리거로 포커스를 복원한 **뒤** 부른다.
   * 핸들러 대부분은 store 를 읽지만 `handleEscape` 류는 DOM 포커스를 읽는다.
   * scope 판정은 `scopeAtOpen` 으로 이미 끝났으므로 복원 위치는 실행 여부에
   * 영향을 주지 않는다.
   */
  const executeCommand = useCallback(
    (commandId: ShortcutId) => {
      const entry = resolveCommand(commandId);
      handleOpenChange(false);
      if (!entry || entry.disabled) return;
      if (!matchesScope(entry.scope ?? "global", scopeAtOpen)) return;

      requestAnimationFrame(() => {
        entry.handler();
      });
    },
    [handleOpenChange, scopeAtOpen],
  );

  const handleAction = useCallback(
    (key: React.Key) => {
      const id = key as ShortcutId;
      const target = allCommands.find((cmd) => cmd.id === id);
      // 실행 불가 항목은 목록에 남기되(단축키를 배우는 자리다) 실행하지 않는다.
      // `disabledKeys` 대신 여기서 거르는 이유는 ↑↓ 가 건너뛰지 않게 하기 위함.
      if (!target || target.availability !== "executable") return;
      executeCommand(id);
    },
    [allCommands, executeCommand],
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
        <Dialog
          aria-label={t("commandPalette.dialogLabel")}
          className="panel command-palette-panel"
        >
          <PanelHeader
            icon={<Command size={iconProps.size} />}
            title={t("commandPalette.title")}
            actions={
              <ActionIconButton
                onPress={() => handleOpenChange(false)}
                aria-label={t("common.close")}
                tooltip={t("common.close")}
              >
                <X size={iconProps.size} />
              </ActionIconButton>
            }
          />
          <div
            className="panel-contents command-palette-contents"
            onKeyDown={handleKeyDown}
          >
            <BuilderSearchField
              ref={inputRef}
              appearance="control"
              value={search}
              onChange={setSearch}
              placeholder={t("commandPalette.searchPlaceholder")}
              aria-label={t("commandPalette.searchLabel")}
            />

            {/* Command List */}
            {filteredCommands.length > 0 ? (
              <ListBox
                aria-label={t("commandPalette.listLabel")}
                className="command-palette-list"
                selectionMode="single"
                onAction={handleAction}
              >
                {filteredCommands.map((cmd) => (
                  <ListBoxItem
                    key={cmd.id}
                    id={cmd.id}
                    textValue={cmd.label}
                    className="command-palette-item"
                    data-executable={cmd.availability === "executable"}
                    data-availability={cmd.availability}
                    aria-disabled={
                      cmd.availability === "executable" ? undefined : true
                    }
                  >
                    <div className="command-palette-item-content">
                      <span className="command-palette-item-label">
                        {cmd.label}
                      </span>
                      <span className="command-palette-item-category">
                        {cmd.hint
                          ? t(cmd.hint)
                          : t(CATEGORY_LABEL_KEYS[cmd.category])}
                      </span>
                    </div>
                    <kbd className="command-palette-kbd">{cmd.shortcut}</kbd>
                  </ListBoxItem>
                ))}
              </ListBox>
            ) : (
              <EmptyState
                icon={<SearchX size={32} />}
                message={t("commandPalette.noResults", { query: search })}
              />
            )}

            {/* Footer */}
            <div className="command-palette-footer">
              <div className="command-palette-hints">
                <span className="command-palette-hint">
                  <kbd>↑↓</kbd> {t("commandPalette.hintMove")}
                </span>
                <span className="command-palette-hint">
                  <kbd>↵</kbd> {t("commandPalette.hintRun")}
                </span>
                <span className="command-palette-hint">
                  <kbd>esc</kbd> {t("commandPalette.hintClose")}
                </span>
              </div>
              <span>
                {t("commandPalette.executableCount", {
                  count: executableCount,
                  total: filteredCommands.length,
                })}
              </span>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export default CommandPalette;

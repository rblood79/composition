/**
 * ShortcutDebugger - 개발용 단축키 디버거
 *
 * 현재 활성 스코프, 눌린 키, 매칭된 단축키를 실시간으로 표시
 * 개발 환경에서만 렌더링됨
 *
 * @since Phase 5 구현 (2025-12-28)
 */

import { useState, useEffect, useCallback } from "react";
import { useActiveScopeState, formatShortcut } from "@/builder/hooks";
import {
  SHORTCUT_DEFINITIONS,
  getShortcutsForScope,
  type ShortcutId,
} from "../config/keyboardShortcuts";
import type { ShortcutScope } from "../types/keyboard";
import { translateKey, useOptionalI18n } from "../../i18n";

// ============================================
// Types
// ============================================

interface KeyEventInfo {
  key: string;
  code: string;
  modifiers: string[];
  timestamp: number;
}

interface MatchedShortcut {
  id: ShortcutId;
  description: string;
  display: string;
}

// ============================================
// Styles (inline for isolation)
// ============================================

const styles = {
  container: {
    position: "fixed" as const,
    bottom: "16px",
    right: "16px",
    width: "320px",
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    color: "#fff",
    borderRadius: "8px",
    padding: "12px",
    fontFamily: "monospace",
    fontSize: "12px",
    zIndex: 99999,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "#4ade80",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px 8px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  label: {
    color: "#888",
  },
  value: {
    color: "#fff",
    fontWeight: 500,
  },
  scopeBadge: {
    backgroundColor: "#3b82f6",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
  },
  keyEvent: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: "8px",
    borderRadius: "4px",
    marginTop: "8px",
  },
  keyDisplay: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap" as const,
  },
  keyBadge: {
    backgroundColor: "#4b5563",
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "11px",
  },
  matchedShortcut: {
    marginTop: "8px",
    padding: "8px",
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    borderRadius: "4px",
    border: "1px solid rgba(74, 222, 128, 0.3)",
  },
  noMatch: {
    color: "#888",
    fontStyle: "italic" as const,
  },
  footer: {
    marginTop: "12px",
    paddingTop: "8px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    fontSize: "10px",
    color: "#666",
    textAlign: "center" as const,
  },
  minimized: {
    position: "fixed" as const,
    bottom: "16px",
    right: "16px",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "#4ade80",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 99999,
    fontSize: "18px",
    border: "1px solid rgba(74, 222, 128, 0.3)",
  },
};

// ============================================
// Helper Functions
// ============================================

function getModifiers(event: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (event.metaKey) mods.push("Cmd");
  if (event.ctrlKey) mods.push("Ctrl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");
  return mods;
}

function findMatchingShortcut(
  event: KeyboardEvent,
  scope: ShortcutScope,
): MatchedShortcut | null {
  const activeShortcuts = getShortcutsForScope(scope);
  const isMac = navigator.platform.includes("Mac");
  const cmdKey = isMac ? event.metaKey : event.ctrlKey;

  for (const def of activeShortcuts) {
    // Key match
    const keyMatch =
      event.key.toLowerCase() === def.key.toLowerCase() ||
      (def.code && event.code === def.code);

    if (!keyMatch) continue;

    // Modifier match
    let modMatch = false;
    switch (def.modifier) {
      case "cmd":
        modMatch = cmdKey && !event.shiftKey && !event.altKey;
        break;
      case "cmdShift":
        modMatch = cmdKey && event.shiftKey && !event.altKey;
        break;
      case "cmdAlt":
        modMatch = cmdKey && !event.shiftKey && event.altKey;
        break;
      case "ctrl":
        modMatch =
          event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
        break;
      case "ctrlShift":
        modMatch =
          event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
        break;
      case "alt":
        modMatch =
          event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
        break;
      case "altShift":
        modMatch =
          event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
        break;
      case "shift":
        modMatch =
          event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
        break;
      case "none":
        modMatch =
          !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
        break;
    }

    if (modMatch) {
      // Find the ID for this definition
      const id = Object.entries(SHORTCUT_DEFINITIONS).find(
        ([, d]) => d === def,
      )?.[0] as ShortcutId | undefined;

      if (id) {
        return {
          id,
          description: def.description,
          display: formatShortcut({ key: def.key, modifier: def.modifier }),
        };
      }
    }
  }

  return null;
}

// ============================================
// Component
// ============================================

export function ShortcutDebugger() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `debugger.${key}`, fallback) : fallback;
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastEvent, setLastEvent] = useState<KeyEventInfo | null>(null);
  const [matchedShortcut, setMatchedShortcut] =
    useState<MatchedShortcut | null>(null);

  const scopeState = useActiveScopeState();

  // Handle key events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const eventInfo: KeyEventInfo = {
        key: event.key,
        code: event.code,
        modifiers: getModifiers(event),
        timestamp: Date.now(),
      };
      setLastEvent(eventInfo);

      const matched = findMatchingShortcut(event, scopeState.scope);
      setMatchedShortcut(matched);
    },
    [scopeState.scope],
  );

  // 디버거는 모든 키 이벤트를 캡처해야 하므로 useKeyboardShortcutsRegistry 부적합
  useEffect(() => {
    // eslint-disable-next-line local/prefer-keyboard-shortcuts-registry
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);

  // Only render in development
  if (import.meta.env.PROD) {
    return null;
  }

  // Hidden state
  if (!isVisible) {
    return null;
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div
        style={styles.minimized}
        onClick={() => setIsMinimized(false)}
        title={localize("expand", "Expand Shortcut Debugger")}
      >
        ⌨️
      </div>
    );
  }

  const activeCount = getShortcutsForScope(scopeState.scope).length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>
          {localize("title", "⌨️ Shortcut Debugger")}
        </h3>
        <div>
          <button
            style={styles.closeButton}
            onClick={() => setIsMinimized(true)}
            title={localize("minimize", "Minimize")}
          >
            −
          </button>
          <button
            style={styles.closeButton}
            onClick={() => setIsVisible(false)}
            title={localize("close", "Close")}
          >
            ×
          </button>
        </div>
      </div>

      {/* Scope Info */}
      <div style={styles.row}>
        <span style={styles.label}>
          {localize("activeScope", "Active Scope:")}
        </span>
        <span style={{ ...styles.value, ...styles.scopeBadge }}>
          {scopeState.scope}
        </span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>
          {localize("activeShortcuts", "Active Shortcuts:")}
        </span>
        <span style={styles.value}>{activeCount}</span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>
          {localize("textEditing", "Text Editing:")}
        </span>
        <span style={styles.value}>
          {scopeState.isTextEditing
            ? localize("yes", "✓ Yes")
            : localize("no", "✗ No")}
        </span>
      </div>

      <div style={styles.row}>
        <span style={styles.label}>{localize("modalOpen", "Modal Open:")}</span>
        <span style={styles.value}>
          {scopeState.isModalOpen
            ? localize("yes", "✓ Yes")
            : localize("no", "✗ No")}
        </span>
      </div>

      {/* Last Key Event */}
      {lastEvent && (
        <div style={styles.keyEvent}>
          <div style={styles.row}>
            <span style={styles.label}>{localize("lastKey", "Last Key:")}</span>
            <div style={styles.keyDisplay}>
              {lastEvent.modifiers.map((mod) => (
                <span key={mod} style={styles.keyBadge}>
                  {mod}
                </span>
              ))}
              <span style={styles.keyBadge}>{lastEvent.key}</span>
            </div>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>{localize("code", "Code:")}</span>
            <span style={styles.value}>{lastEvent.code}</span>
          </div>
        </div>
      )}

      {/* Matched Shortcut */}
      {lastEvent && (
        <div>
          {matchedShortcut ? (
            <div style={styles.matchedShortcut}>
              <div style={styles.row}>
                <span style={styles.label}>
                  {localize("matched", "Matched:")}
                </span>
                <span style={styles.value}>{matchedShortcut.id}</span>
              </div>
              <div style={styles.row}>
                <span style={styles.label}>
                  {localize("action", "Action:")}
                </span>
                <span style={styles.value}>{matchedShortcut.description}</span>
              </div>
            </div>
          ) : (
            <div style={{ ...styles.keyEvent, ...styles.noMatch }}>
              {localize("noMatch", "No matching shortcut")}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        {localize("devOnly", "Development only - Not visible in production")}
      </div>
    </div>
  );
}

export default ShortcutDebugger;

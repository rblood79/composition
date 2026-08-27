/**
 * Action tooltip — 라벨 + 단축키 표기를 붙이는 단일 진입점.
 *
 * 단축키 문자열은 **여기서만** 만든다: `shortcutId` → `SHORTCUT_DEFINITIONS` →
 * `formatShortcut`. 호출부는 id 만 넘기므로 정의가 바뀌면 표기가 따라온다.
 *
 * 종전에는 같은 마크업이 `ActionIconButton` 과 `PanelToggleGroup` 에 두 벌 있었고,
 * 후자는 단축키를 `PanelConfig.shortcut` 문자열로 따로 적어 두 군데가 실제로
 * 어긋나 있었다 (settings `"Ctrl+,"` / monitor `"Ctrl+Alt+M"` — 정의는 `⌘,` /
 * `⌃⌥M`, 게다가 Mac 표기가 아니었다). 헤더 토글 그룹은 세 번째 사본을 만드는
 * 대신 아예 툴팁이 없었다.
 */

import {
  Tooltip,
  TooltipTrigger,
  OverlayArrow,
} from "react-aria-components";
import type { ReactElement, ReactNode } from "react";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import { formatShortcut } from "@/builder/hooks";
import "./ActionTooltip.css";

export type ActionTooltipPlacement = "top" | "bottom" | "left" | "right";

export interface ActionTooltipOptions {
  /** 툴팁 라벨. 생략하면 정의의 i18n.ko → description 순으로 채운다. */
  tooltip?: string;
  /** 단축키 id — 표기는 정의에서 파생한다 (문자열 직접 전달 금지). */
  shortcutId?: ShortcutId;
  /** 툴팁 위치 (기본: bottom) */
  tooltipPlacement?: ActionTooltipPlacement;
  /** 툴팁 지연 (기본: 700ms) */
  delay?: number;
}

/** 정의에서 파생한 표기 — 정의가 없으면 undefined. */
export function shortcutDisplayFor(
  shortcutId: ShortcutId | undefined,
): string | undefined {
  const def = shortcutId ? SHORTCUT_DEFINITIONS[shortcutId] : undefined;
  return def
    ? formatShortcut({ key: def.key, modifier: def.modifier })
    : undefined;
}

/**
 * 트리거 요소에 툴팁을 붙인다. 라벨을 만들 수 없으면 요소를 그대로 돌려준다.
 */
export function withActionTooltip(
  trigger: ReactElement,
  {
    tooltip,
    shortcutId,
    tooltipPlacement = "bottom",
    delay = 700,
  }: ActionTooltipOptions,
): ReactElement {
  const shortcutDef = shortcutId ? SHORTCUT_DEFINITIONS[shortcutId] : undefined;
  const tooltipLabel =
    tooltip || shortcutDef?.i18n?.ko || shortcutDef?.description;
  const shortcutDisplay = shortcutDisplayFor(shortcutId);

  if (!tooltipLabel) {
    return trigger;
  }

  return (
    <TooltipTrigger delay={delay}>
      {trigger}
      <Tooltip placement={tooltipPlacement} className="action-tooltip">
        <OverlayArrow>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        <span className="action-tooltip-label">{tooltipLabel}</span>
        {shortcutDisplay && (
          <kbd className="action-tooltip-kbd">{shortcutDisplay}</kbd>
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}

export interface ActionTooltipTriggerProps extends ActionTooltipOptions {
  children: ReactElement;
}

/**
 * 목록 안에서 `key` 를 붙여야 할 때 쓰는 컴포넌트 형태.
 * (`withActionTooltip` 은 반환 요소에 key 를 얹을 자리가 없다.)
 */
export function ActionTooltipTrigger({
  children,
  ...options
}: ActionTooltipTriggerProps): ReactNode {
  return withActionTooltip(children, options);
}

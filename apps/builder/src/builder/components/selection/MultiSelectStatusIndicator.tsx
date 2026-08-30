/**
 * MultiSelectStatusIndicator - 다중 선택 상태 표시 컴포넌트
 *
 * 다중 요소 선택 시 선택된 요소 개수와 빠른 작업 버튼을 표시
 * Phase 2: Multi-Element Editing - Status Indicator
 */

import { Button } from "@composition/shared/components";
import { X } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import { formatShortcut } from "../../hooks";
import { useI18n } from "@/i18n";

import "./MultiSelectStatusIndicator.css";

/**
 * 아이콘은 컨텍스트 메뉴와 **같은 정본**을 읽는다 — 여기 있는 액션은 전부
 * 우클릭 메뉴에도 있어서, 낱개 lucide 심볼을 직접 집으면 두 진입점이 갈린다
 * (`config/actionIcons.ts`). 치수·색은 이 화면 밀도에 맞춰 호출부가 정한다.
 */
const {
  copy: CopyIcon,
  paste: PasteIcon,
  delete: DeleteIcon,
  group: GroupIcon,
  alignLeft: AlignLeftIcon,
  alignCenter: AlignCenterIcon,
  alignRight: AlignRightIcon,
  alignTop: AlignTopIcon,
  alignMiddle: AlignMiddleIcon,
  alignBottom: AlignBottomIcon,
  distributeHorizontal: DistributeHIcon,
  distributeVertical: DistributeVIcon,
} = ACTION_ICONS;

/**
 * 단축키 표기는 `SHORTCUT_DEFINITIONS` 파생 (ADR-182 HC5).
 *
 * 하드코딩이던 시절 "모두 복사"/"붙여넣기" 가 `⌘⇧C`/`⌘⇧V` 로 적혀 있었는데,
 * 그 조합은 `copyStyles`/`copyProperties` 의 것이다. 이 버튼들은 선택 요소
 * 전체를 복사/붙여넣는 `copy`/`paste`(⌘C/⌘V) 와 같은 구현을 부른다
 * (`canvasActions` 공유 계층).
 */
function shortcutLabel(id: ShortcutId): string {
  const definition = SHORTCUT_DEFINITIONS[id];
  return formatShortcut({
    key: definition.key,
    modifier: definition.modifier,
  });
}
export interface MultiSelectStatusIndicatorProps {
  /** 선택된 요소 개수 */
  count: number;
  /** Primary 요소 ID (첫 번째 선택) */
  primaryElementId?: string;
  /** Primary 요소 타입 (예: "Button", "Card") */
  primaryElementType?: string;
  /** Copy All 핸들러 */
  onCopyAll?: () => void;
  /** Paste All 핸들러 */
  onPasteAll?: () => void;
  /** Delete All 핸들러 */
  onDeleteAll?: () => void;
  /** Clear Selection 핸들러 */
  onClearSelection?: () => void;
  /** Group Selection 핸들러 (Phase 4) */
  onGroupSelection?: () => void;
  /** Alignment 핸들러 (Phase 5.1) */
  onAlign?: (type: AlignmentType) => void;
  /** Distribution 핸들러 (Phase 5.2) */
  onDistribute?: (type: DistributionType) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 다중 선택 상태 표시 컴포넌트
 *
 * @example
 * ```tsx
 * <MultiSelectStatusIndicator
 *   count={5}
 *   onCopyAll={handleCopyAll}
 *   onDeleteAll={handleDeleteAll}
 *   onClearSelection={handleClearSelection}
 * />
 * ```
 */
export function MultiSelectStatusIndicator({
  count,
  primaryElementType,
  onCopyAll,
  onPasteAll,
  onDeleteAll,
  onClearSelection,
  onGroupSelection,
  onAlign,
  onDistribute,
  className = "",
}: MultiSelectStatusIndicatorProps) {
  const { t } = useI18n();

  return (
    <div className={`multi-select-status ${className}`.trim()}>
      <div className="status-header">
        <div className="status-count">
          <span className="count-number">{count}</span>
          <span className="count-label">{t("selection.countLabel")}</span>
        </div>
        {primaryElementType && (
          <div className="primary-element-badge">
            <span className="badge-label">Primary:</span>
            <span className="badge-type">{primaryElementType}</span>
          </div>
        )}
      </div>

      <div className="status-actions">
        <div className="action-group">
          <span className="group-label">{t("selection.groupEdit")}</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={onCopyAll}
            aria-label={`Copy all selected elements (${shortcutLabel("copy")})`}
            isDisabled={count === 0}
          >
            <CopyIcon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <span>{t("selection.copyAll")}</span>
            <span className="shortcut-hint">{shortcutLabel("copy")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={onPasteAll}
            aria-label={`Paste copied elements (${shortcutLabel("paste")})`}
          >
            <PasteIcon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <span>{t("selection.paste")}</span>
            <span className="shortcut-hint">{shortcutLabel("paste")}</span>
          </Button>
        </div>

        <div className="action-group">
          <span className="group-label">{t("selection.groupArrange")}</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={onGroupSelection}
            aria-label={`Group selected elements (${shortcutLabel("group")})`}
            isDisabled={count < 2}
          >
            <GroupIcon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <span>{t("selection.group")}</span>
            <span className="shortcut-hint">{shortcutLabel("group")}</span>
          </Button>
        </div>

        {/* Phase 5: Alignment buttons */}
        {onAlign && (
          <div className="action-group">
            <span className="group-label">{t("selection.groupAlign")}</span>
            <div className="button-row">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("left")}
                aria-label={`Align left (${shortcutLabel("alignLeft")})`}
                isDisabled={count < 2}
              >
                <AlignLeftIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("center")}
                aria-label={`Align horizontal center (${shortcutLabel("alignHCenter")})`}
                isDisabled={count < 2}
              >
                <AlignCenterIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("right")}
                aria-label={`Align right (${shortcutLabel("alignRight")})`}
                isDisabled={count < 2}
              >
                <AlignRightIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("top")}
                aria-label={`Align top (${shortcutLabel("alignTop")})`}
                isDisabled={count < 2}
              >
                <AlignTopIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("middle")}
                aria-label={`Align vertical middle (${shortcutLabel("alignVCenter")})`}
                isDisabled={count < 2}
              >
                <AlignMiddleIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onAlign("bottom")}
                aria-label={`Align bottom (${shortcutLabel("alignBottom")})`}
                isDisabled={count < 2}
              >
                <AlignBottomIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>
            </div>
          </div>
        )}

        {/* Phase 5.2: Distribution buttons */}
        {onDistribute && (
          <div className="action-group">
            <span className="group-label">
              {t("selection.groupDistribute")}
            </span>
            <div className="button-row">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => onDistribute("horizontal")}
                aria-label={`Distribute horizontally (${shortcutLabel("distributeH")})`}
                isDisabled={count < 3}
              >
                <DistributeHIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onPress={() => onDistribute("vertical")}
                aria-label={`Distribute vertically (${shortcutLabel("distributeV")})`}
                isDisabled={count < 3}
              >
                <DistributeVIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>
            </div>
          </div>
        )}

        <div className="action-group">
          <span className="group-label">{t("selection.groupManage")}</span>
          <Button
            variant="ghost"
            size="sm"
            onPress={onDeleteAll}
            aria-label="Delete all selected elements (Delete)"
            isDisabled={count === 0}
          >
            <DeleteIcon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <span>{t("selection.deleteAll")}</span>
            <span className="shortcut-hint">⌦</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={onClearSelection}
            aria-label="Clear selection (Esc)"
            isDisabled={count === 0}
          >
            <X
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            <span>{t("selection.clear")}</span>
            <span className="shortcut-hint">Esc</span>
          </Button>
        </div>
      </div>

      <div className="status-info">
        <p className="info-text">{t("selection.multiSelectNotice")}</p>
        <p className="info-hint">💡 {t("selection.multiSelectHint")}</p>
      </div>
    </div>
  );
}

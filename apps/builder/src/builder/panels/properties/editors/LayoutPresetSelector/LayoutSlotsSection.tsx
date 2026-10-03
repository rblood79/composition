/**
 * LayoutSlotsSection — Layout 편집 (layout 모드) Properties 의 "Slots" 절.
 *
 * preset 을 적용한 결과가 보이는 자리다: 슬롯 행 28 (이름 · 놓인 요소 수 mono 10). 행을 누르면
 * 그 Slot 요소를 캔버스에서 선택한다. `element.slot: string[]` 에는 이름만 있고 크기 데이터가
 * 없으므로 (preset areas 는 정의 파일에만) 여기서도 이름 · 수만 보여준다 (panel-ui 18, 2026-09-14).
 */

import { memo } from "react";
import { Button } from "react-aria-components/Button";
import { Section as PropertySection } from "../../../../components/panel/Section";
import { useOptionalI18n } from "@/i18n";

/**
 * The Slots rows over any document (ADR-248 4e-6-37): the old store and the catalog layout pass
 * their slots (`elementId` = what `onSelect` selects).
 */
export const LayoutSlotsList = memo(function LayoutSlotsList({
  slots,
  onSelect,
}: {
  slots: readonly { slotName: string; elementId: string; childCount: number }[];
  onSelect: (elementId: string) => void;
}) {
  // 편집기 테스트가 provider 없이 마운트한다 — 접근 이름은 provider 없으면 영문 기본.
  const i18n = useOptionalI18n();
  if (slots.length === 0) return null;

  return (
    <PropertySection
      id="frame-slots"
      title="Slots"
      badge={<span className="frame-slots-count">{slots.length}</span>}
    >
      <div className="frame-slots-list" role="list">
        {slots.map((slot) => (
          <Button
            key={slot.elementId}
            className="frame-slot-row"
            onPress={() => onSelect(slot.elementId)}
            aria-label={
              i18n
                ? i18n.t("propertiesPanel.slotSelectOnCanvas", {
                    name: slot.slotName,
                  })
                : `Select slot ${slot.slotName} on canvas`
            }
          >
            <span className="frame-slot-row__name">{slot.slotName}</span>
            <span className="frame-slot-row__count">{slot.childCount}</span>
          </Button>
        ))}
      </div>
    </PropertySection>
  );
});

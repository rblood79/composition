/**
 * PropertyChipGroup — 같은 섹션의 boolean 을 한 묶음으로 (Properties 패널 컨트롤 어법 2026-09-15).
 *
 * 스위치 N 개는 「이 하나가 켜졌나」 를 N 번 묻는다; 칩 묶음은 「이 요소에 지금 무엇이 걸려 있나」
 * 를 한 줄로 답한다 (켜진 칩만 진하다). RAC `ToggleButtonGroup selectionMode="multiple"` 이라
 * 각 칩이 `aria-pressed` 를 갖는다 (D1 그대로). 하나뿐이어도 칩 — 스위치 어법을 남기지 않는다.
 *
 * legend 는 묶음 이름 (Options / Show / Fill). 칩 글자는 접두를 뺀 짧은 이름 (「Axis」 · 「Time Zone」).
 */
import { memo, useCallback } from "react";
import type { Key } from "react-aria-components/Collection";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import "./PropertyChipGroup.css";

export interface PropertyChip {
  key: string;
  label: string;
  selected: boolean;
}

interface PropertyChipGroupProps {
  label: string;
  chips: readonly PropertyChip[];
  /** 칩 하나의 켜짐/꺼짐 — 각 칩은 자기 prop 하나를 쓴다. */
  onToggle: (key: string, selected: boolean) => void;
  className?: string;
}

export const PropertyChipGroup = memo(function PropertyChipGroup({
  label,
  chips,
  onToggle,
  className,
}: PropertyChipGroupProps) {
  const i18n = useOptionalI18n();
  const localize = (text: string) =>
    i18n ? translateKey(i18n.t, semanticLabelKeys[text] ?? text, text) : text;
  const displayLabel = localize(label);
  const selectedKeys = chips.filter((c) => c.selected).map((c) => c.key);

  const handleChange = useCallback(
    (keys: Set<Key>) => {
      // 바뀐 칩 하나만 쓴다 — 묶음 전체를 다시 쓰면 다른 prop 까지 patch 에 실린다.
      for (const chip of chips) {
        const next = keys.has(chip.key);
        if (next !== chip.selected) onToggle(chip.key, next);
      }
    },
    [chips, onToggle],
  );

  return (
    <fieldset className={`properties-aria property-chips ${className ?? ""}`}>
      <legend className="fieldset-legend">{displayLabel}</legend>
      <ToggleButtonGroup
        aria-label={displayLabel}
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={handleChange}
      >
        {chips.map((chip) => (
          <ToggleButton key={chip.key} id={chip.key} size="sm">
            {localize(chip.label)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
});

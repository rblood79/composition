import { ColorSwatch } from "@composition/shared/components/ColorSwatch";

import { Popover } from "@composition/shared/components/Popover";

import { memo, useCallback } from "react";

import { Button as AriaButton } from "react-aria-components/Button";

import { DialogTrigger } from "react-aria-components/Dialog";

import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

import { ColorPickerPanel } from "../../panels/styles/components/ColorPickerPanel";

import {
  parseRacColorOrBlack,
  toDisplayHex,
} from "../../panels/styles/utils/colorUtils";

import { useLatestCallbacks } from "./latestCallbacks";

import {
  normalizeHexForStyle,
  PropertyColorProps,
} from "./PropertyColor.runtime";
import { usePropertySelection } from "./propertySelection";

/**
 * PropertyColor — 색상 스와치 + 풀 컬러 피커 popover.
 *
 * 내부 피커는 fill popover 와 동일한 공용 `ColorPickerPanel` (HSB ColorArea +
 * Hue/Alpha 슬라이더 + EyeDropper + HEX/RGBA/CSS 포맷 입력) 을 소비한다 —
 * 종전 자체 구현(ColorArea+Hue+맨 hex input, 미스타일)을 대체 (2026-08-14).
 *
 * 드래그/커밋 계약은 ColorPickerPanel 이 소유한다. `livePreview` 인 대상만 onChange를
 * preview (`onPreview`) 로 전달하고, 아니면 commit-only로 닫는다. onChangeEnd는 dedup commit으로 연결한다. 외부 value 재동기화는 resetKey
 * 변경 시에만 일어나므로 preview가 value prop을 선반영해도 commit 판정 기준이
 * 오염되지 않는다 (구 isPreviewSessionRef 수동 가드 대체 — style-ssot.md
 * commit-skip 함정의 설계 차단).
 */
export const PropertyColorControl = memo(
  function PropertyColor({
    label,
    value,
    onChange,
    onPreview,
    livePreview = false,
    onPresentationCancel,
    className,
    placeholder,
    showValue = false,
  }: PropertyColorProps) {
    // 값이 없으면 placeholder 색을 흐린 글자로 보인다 (값이 비면 견본이 검정으로 보여 「설정됨」 처럼 읽혔다)
    const shown = value || placeholder || "";
    const i18n = useOptionalI18n();
    const displayLabel =
      label && i18n
        ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
        : label;
    const selection = usePropertySelection();
    const selectedElementId = selection.useSelectedId();

    const handlePreview = useCallback(
      (hexa: string) => {
        if (!livePreview) return;
        onPreview?.(normalizeHexForStyle(hexa));
      },
      [onPreview, livePreview],
    );
    const handleCommit = useCallback(
      (hexa: string) => {
        onChange(normalizeHexForStyle(hexa));
      },
      [onChange],
    );

    return (
      <fieldset
        className={`properties-aria property-color-input ${className || ""}`}
      >
        {displayLabel && (
          <legend className="fieldset-legend">{displayLabel}</legend>
        )}
        <DialogTrigger>
          <AriaButton
            className="react-aria-Group color-swatch-button"
            data-show-value={showValue || undefined}
            aria-label={
              displayLabel ||
              (i18n
                ? translateKey(
                    i18n.t,
                    semanticLabelKeys.Color ?? "Color",
                    "Color",
                  )
                : "Color")
            }
          >
            <ColorSwatch color={parseRacColorOrBlack(shown)} />
            {showValue && (
              <span
                className="color-swatch-value"
                data-placeholder={(!value && placeholder) || undefined}
              >
                {toDisplayHex(shown)}
              </span>
            )}
          </AriaButton>
          {/* 전용 클래스 — 공용 Popover/타 popover 무영향으로 inset 을 이 popover 만 소유.
              (구 color-picker-popover 는 shared ColorPicker.css 의 dead Dialog 규칙과 이름 충돌) */}
          <Popover placement="bottom start" className="property-color-popover">
            <ColorPickerPanel
              // 요소 전환 시에만 외부 value 로 재동기화 (편집 세션 보존)
              key={selectedElementId ?? "none"}
              value={shown}
              resetKey={selectedElementId ?? "none"}
              onChange={handlePreview}
              onChangeEnd={handleCommit}
              livePreview={livePreview}
              onPresentationCancel={onPresentationCancel}
            />
          </Popover>
        </DialogTrigger>
      </fieldset>
    );
  },
  (prevProps, nextProps) => {
    // 커스텀 비교: onChange/onPreview 함수 참조는 무시하고 실제 값만 비교
    return (
      prevProps.label === nextProps.label &&
      prevProps.value === nextProps.value &&
      prevProps.className === nextProps.className &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.showValue === nextProps.showValue &&
      prevProps.livePreview === nextProps.livePreview
    );
  },
);
const CALLBACK_KEYS: readonly (keyof PropertyColorProps)[] = [
  "onChange",
  "onPreview",
  "onPresentationCancel",
];
export function PropertyColor(props: PropertyColorProps) {
  const current = useLatestCallbacks(props, CALLBACK_KEYS);
  return <PropertyColorControl {...current} />;
}

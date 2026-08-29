import React, { memo, useCallback } from "react";
import {
  DialogTrigger,
  Button as AriaButton,
  parseColor,
  type Color,
} from "react-aria-components";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { Popover } from "@composition/shared/components/Popover";
import { ColorPickerPanel } from "../../panels/styles/components/ColorPickerPanel";
import { useStore } from "../../stores";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertyColorProps {
  label?: string;
  value: string; // Hex color string (e.g., "#FF0000") 또는 CSS 색상 표현
  onChange: (value: string) => void;
  /**
   * 드래그 중 연속 호출 — 캔버스 preview 채널 (updateStylePreview) 배선용.
   * 생략 시 커밋-only 동작 (드롭 시점에만 캔버스 반영).
   */
  onPreview?: (value: string) => void;
  /** ADR-187: migrated owner가 frame scheduling을 직접 소유하는지 여부. */
  presentationOwnsFrameScheduling?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  placeholder?: string;
  className?: string;
}

function safeSwatchColor(value: string): Color {
  try {
    return parseColor(value);
  } catch {
    // var(--token) 등 파싱 불가 표현 — 종전 RAC 동작과 동일하게 검정 표시
    return parseColor("#000000");
  }
}

/**
 * hex8 (#RRGGBBAA) → 저장 포맷 정규화 — 불투명이면 종전 저장 포맷(#RRGGBB) 유지,
 * 알파 사용 시에만 hex8 그대로 기록한다.
 */
function normalizeHexForStyle(hexa: string): string {
  return /^#[0-9a-fA-F]{8}$/.test(hexa) && hexa.slice(7).toLowerCase() === "ff"
    ? hexa.slice(0, 7)
    : hexa;
}

/**
 * PropertyColor — 색상 스와치 + 풀 컬러 피커 popover.
 *
 * 내부 피커는 fill popover 와 동일한 공용 `ColorPickerPanel` (HSB ColorArea +
 * Hue/Alpha 슬라이더 + EyeDropper + HEX/RGBA/CSS 포맷 입력) 을 소비한다 —
 * 종전 자체 구현(ColorArea+Hue+맨 hex input, 미스타일)을 대체 (2026-08-14).
 *
 * 드래그/커밋 계약은 ColorPickerPanel 이 소유한다. ADR-187 presentation owner가
 * 있는 대상만 onChange를 preview 채널로 전달하고, 미지원 대상은 commit-only로
 * 닫는다. onChangeEnd는 dedup commit으로 연결한다. 외부 value 재동기화는 resetKey
 * 변경 시에만 일어나므로 preview가 value prop을 선반영해도 commit 판정 기준이
 * 오염되지 않는다 (구 isPreviewSessionRef 수동 가드 대체 — style-ssot.md
 * commit-skip 함정의 설계 차단).
 */
export const PropertyColor = memo(
  function PropertyColor({
    label,
    value,
    onChange,
    onPreview,
    presentationOwnsFrameScheduling = false,
    onPresentationCancel,
    className,
  }: PropertyColorProps) {
    const i18n = useOptionalI18n();
    const displayLabel =
      label && i18n
        ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
        : label;
    const selectedElementId = useStore((state) => state.selectedElementId);

    const handlePreview = useCallback(
      (hexa: string) => {
        if (!presentationOwnsFrameScheduling) return;
        onPreview?.(normalizeHexForStyle(hexa));
      },
      [onPreview, presentationOwnsFrameScheduling],
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
            <ColorSwatch color={safeSwatchColor(value)} />
          </AriaButton>
          {/* 전용 클래스 — 공용 Popover/타 popover 무영향으로 inset 을 이 popover 만 소유.
              (구 color-picker-popover 는 shared ColorPicker.css 의 dead Dialog 규칙과 이름 충돌) */}
          <Popover placement="bottom start" className="property-color-popover">
            <ColorPickerPanel
              // 요소 전환 시에만 외부 value 로 재동기화 (편집 세션 보존)
              key={selectedElementId ?? "none"}
              value={value}
              resetKey={selectedElementId ?? "none"}
              onChange={handlePreview}
              onChangeEnd={handleCommit}
              presentationOwnsFrameScheduling={presentationOwnsFrameScheduling}
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
      prevProps.presentationOwnsFrameScheduling ===
        nextProps.presentationOwnsFrameScheduling
    );
  },
);

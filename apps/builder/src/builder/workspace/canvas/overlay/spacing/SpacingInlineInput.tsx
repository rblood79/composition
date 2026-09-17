/**
 * ADR-222 — padding·gap 핸들/띠 클릭으로 열리는 인라인 숫자 입력 (breakdown §4.1).
 *
 * Skia 배지 자리에 뜨는 DOM 층 — RAC NumberField 재사용 (D1: 포커스·키보드·IME 는 RAC 소유).
 * Enter/정상 blur = 값이 바뀌었을 때만 세션 finish (commit 1) · Escape = cancel ·
 * 열려 있는 동안 캔버스 핸들은 남고 (mode "input") 패널의 같은 필드가 강조된다.
 * 세션이 밖에서 닫히면 (선택 변경 · 문서 교체 · 카메라 이동) 입력도 닫힌다.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { NumberField } from "react-aria-components/NumberField";
import { Input } from "react-aria-components/Input";
import type { SpacingPresentationSession } from "../../../../presentation/editorPresentationSpacingSession";
import type { SpacingBand } from "../../interaction/spacingGeometry";
import { useSemanticLabel } from "../../../../../i18n";
import "./SpacingInlineInput.css";

export interface SpacingInlineInputState {
  readonly session: SpacingPresentationSession;
  readonly band: SpacingBand;
  /** 컨테이너 기준 화면 px (핸들 중심) */
  readonly x: number;
  readonly y: number;
}

interface SpacingInlineInputProps {
  readonly state: SpacingInlineInputState;
  /** 입력이 닫힐 때 (commit/cancel 어느 쪽이든) — 호출부가 active/registry 를 정리 */
  readonly onClose: () => void;
}

/** 접근 이름 — 예: "상단 padding", "가로 gap" (breakdown §4.1) */
function accessibleName(
  band: SpacingBand,
  localize: (key: string) => string,
): string {
  if (band.kind === "gap") {
    return `${localize(band.axis === "x" ? "Horizontal" : "Vertical")} gap`;
  }
  const side = band.side ?? "top";
  return `${localize(side.charAt(0).toUpperCase() + side.slice(1))} padding`;
}

export const SpacingInlineInput = memo(function SpacingInlineInput({
  state,
  onClose,
}: SpacingInlineInputProps) {
  const localize = useSemanticLabel();
  const { session, band } = state;
  const startValue = session.getSnapshot().startValues[band.property] ?? 0;
  const [value, setValue] = useState<number>(startValue);
  const closedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  const commit = useCallback(
    (next: number) => {
      if (closedRef.current) return;
      if (!Number.isFinite(next) || next < 0) {
        session.cancel("escape");
        close();
        return;
      }
      // 여러 변 (Option/Alt 클릭) 은 한 입력으로 같은 값
      const values = Object.fromEntries(
        session.properties.map((property) => [property, next]),
      );
      session.setValues(values);
      void session.finish().finally(close);
    },
    [close, session],
  );

  const cancel = useCallback(() => {
    if (closedRef.current) return;
    session.cancel("escape");
    close();
  }, [close, session]);

  // 세션이 밖에서 닫히면 (선택 변경·문서 교체·conflict) 입력도 닫는다
  useEffect(() => {
    if (session.phase === "closed") {
      close();
      return;
    }
    return session.subscribe(() => {
      if (session.phase === "closed") close();
    });
  }, [close, session]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  return (
    <div
      className="spacing-inline-input"
      data-kind={band.kind}
      style={{ left: state.x, top: state.y }}
      // 캔버스 pointerdown capture 가 이 층을 요소 클릭으로 읽지 않게
      onPointerDown={(event) => event.stopPropagation()}
    >
      <NumberField
        aria-label={accessibleName(band, localize)}
        value={value}
        minValue={0}
        step={1}
        formatOptions={{ maximumFractionDigits: 2 }}
        onChange={(next) => {
          if (Number.isNaN(next)) return;
          setValue(next);
          // RAC NumberField onChange 는 commit 시점 (Enter/blur) 에만 호출된다
          commit(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
          if (event.key === "Enter" && event.nativeEvent.isComposing) {
            event.preventDefault();
          }
        }}
      >
        <Input
          ref={inputRef}
          className="spacing-inline-input__field"
          inputMode="decimal"
          onBlur={() => {
            // Enter 는 onChange 가 먼저 commit 한다. 값이 그대로면 blur 는 취소 (no-op).
            if (closedRef.current) return;
            const current = Number(inputRef.current?.value ?? NaN);
            if (Number.isFinite(current) && current !== startValue) {
              commit(current);
            } else {
              cancel();
            }
          }}
        />
      </NumberField>
      <span className="spacing-inline-input__unit" aria-hidden="true">
        px
      </span>
    </div>
  );
});

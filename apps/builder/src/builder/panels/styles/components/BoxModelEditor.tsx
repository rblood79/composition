/**
 * BoxModelEditor — Spacing 절의 박스 모델 다이어그램 (panel-ui 01, 2026-09-14).
 *
 * 217 × 140 = 28 띠 × 5 (margin · padding · 중심 · padding · margin), 가로도 28 띠. 4방향
 * margin/padding 값이 제자리에 놓이고 가운데 link 가 4값을 연동한다 — 종전 「Padding 16 ▾ ·
 * Margin 0 ▾」 축약값 둘로는 상하/좌우가 다른 경우를 펼쳐야 알 수 있었다. 값 입력·커밋 계약은
 * FourWayGrid 와 같다 (local draft → blur/Enter 커밋, 빈 값은 "" = 키 삭제).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Unlink } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { useStore } from "../../../stores";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import "./BoxModelEditor.css";

export type BoxSide = "Top" | "Right" | "Bottom" | "Left";
export type BoxRing = "padding" | "margin";

export interface BoxSideValues {
  readonly top: string;
  readonly right: string;
  readonly bottom: string;
  readonly left: string;
}

interface BoxModelEditorProps {
  readonly padding: BoxSideValues;
  readonly margin: BoxSideValues;
  readonly onPaddingChange: (side: BoxSide, value: string) => void;
  readonly onMarginChange: (side: BoxSide, value: string) => void;
}

const SIDES: readonly BoxSide[] = ["Top", "Right", "Bottom", "Left"];

function toDisplay(value: string): string {
  return value.replace("px", "");
}

function toCss(input: string, allowNegative: boolean): string {
  const numeric = input.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, "");
  if (numeric === "" || numeric === "-") return "";
  return `${numeric}px`;
}

type Draft = Record<BoxRing, Record<BoxSide, string>>;

function toDraft(padding: BoxSideValues, margin: BoxSideValues): Draft {
  return {
    padding: {
      Top: toDisplay(padding.top),
      Right: toDisplay(padding.right),
      Bottom: toDisplay(padding.bottom),
      Left: toDisplay(padding.left),
    },
    margin: {
      Top: toDisplay(margin.top),
      Right: toDisplay(margin.right),
      Bottom: toDisplay(margin.bottom),
      Left: toDisplay(margin.left),
    },
  };
}

export const BoxModelEditor = memo(function BoxModelEditor({
  padding,
  margin,
  onPaddingChange,
  onMarginChange,
}: BoxModelEditorProps) {
  const localize = useSemanticLabel();
  const selectedElementId = useStore((state) => state.selectedElementId);
  const derived = useMemo(() => toDraft(padding, margin), [padding, margin]);
  const [draft, setDraft] = useState<Draft>(derived);
  const [linked, setLinked] = useState(false);
  const focusedElementIdRef = useRef<string | null>(null);
  const justSavedViaEnterRef = useRef(false);

  // 선택 요소나 외부 값이 바뀌면 로컬 편집 세션을 새 대상 기준으로 리셋 (FourWayGrid 와 동일)
  useEffect(() => {
    justSavedViaEnterRef.current = false;
    focusedElementIdRef.current = null;
    queueMicrotask(() => setDraft(derived));
  }, [derived, selectedElementId]);

  const commit = useCallback(
    (ring: BoxRing, side: BoxSide) => {
      if (
        focusedElementIdRef.current !== null &&
        selectedElementId !== focusedElementIdRef.current
      ) {
        return;
      }
      const css = toCss(draft[ring][side], ring === "margin");
      const write = ring === "padding" ? onPaddingChange : onMarginChange;
      if (linked) {
        // link 는 같은 고리 4값 연동
        for (const target of SIDES) write(target, css);
        setDraft((prev) => ({
          ...prev,
          [ring]: {
            Top: draft[ring][side],
            Right: draft[ring][side],
            Bottom: draft[ring][side],
            Left: draft[ring][side],
          },
        }));
        return;
      }
      write(side, css);
    },
    [draft, linked, onMarginChange, onPaddingChange, selectedElementId],
  );

  const renderInput = (ring: BoxRing, side: BoxSide) => (
    <input
      key={`${ring}-${side}`}
      className={`box-model__input box-model__input--${ring} box-model__input--${side.toLowerCase()}`}
      value={draft[ring][side]}
      placeholder={ring === "margin" ? "auto" : "0"}
      inputMode="decimal"
      aria-label={`${localize(ring === "padding" ? "Padding" : "Margin")} ${side}`}
      onChange={(event) => {
        const next = event.target.value;
        setDraft((prev) => ({
          ...prev,
          [ring]: { ...prev[ring], [side]: next },
        }));
      }}
      onFocus={() => {
        justSavedViaEnterRef.current = false;
        focusedElementIdRef.current = selectedElementId ?? null;
      }}
      onBlur={() => {
        if (justSavedViaEnterRef.current) {
          justSavedViaEnterRef.current = false;
          return;
        }
        commit(ring, side);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(ring, side);
          justSavedViaEnterRef.current = true;
          (event.target as HTMLInputElement).blur();
        }
      }}
    />
  );

  return (
    <div className="box-model" data-linked={linked || undefined}>
      <span className="box-model__label box-model__label--margin">margin</span>
      <span className="box-model__label box-model__label--padding">
        padding
      </span>
      <div className="box-model__padding" />
      <div className="box-model__center">
        <Button
          className="box-model__link"
          aria-label={localize(linked ? "Unlink sides" : "Link sides")}
          aria-pressed={linked}
          onPress={() => setLinked((value) => !value)}
        >
          {linked ? (
            <Link size={iconSmall.size} strokeWidth={iconSmall.strokeWidth} />
          ) : (
            <Unlink size={iconSmall.size} strokeWidth={iconSmall.strokeWidth} />
          )}
        </Button>
      </div>
      {SIDES.map((side) => renderInput("margin", side))}
      {SIDES.map((side) => renderInput("padding", side))}
    </div>
  );
});

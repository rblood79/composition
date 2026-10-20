/**
 * BoxModelEditor — Spacing 절 (panel-ui 01, 2026-09-14 · ADR-275 사용자 결정 8 · 9, 2026-10-20).
 *
 * Layout 의 「Display · Space + Alignment」 짜임: 왼쪽 열에 Padding · Margin 칸 (네 변 한 값,
 * 다르면 비워 두고 Mixed — 입력하면 네 변에 한 번에), 오른쪽 열에 padding 도식, 아이콘 칸에 link.
 * 도식은 Alignment 판과 같은 3 × 3 격자 (칸 · 간격 · 여백 동일) 에 padding 네 변만 놓는다 —
 * 바깥 margin 고리는 없다 (Figma · Framer 처럼 도식은 안쪽 여백만, 사용자 결정 9). 변 값 입력·커밋
 * 계약은 FourWayGrid 와 같다 (local draft → blur/Enter 커밋, 빈 값은 "" = 키 삭제). link 는
 * `boxModelLink` 모듈 상태 — 캔버스 padding 드래그 (ADR-222) 도 같은 link 를 읽어 4변에
 * 같은 값을 준다.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Unlink } from "lucide-react";
import { SwatchIconToggleButton } from "../../../components/ui/SwatchIconButton";
import { iconSmall } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { setPaddingLinked, usePaddingLinked } from "./boxModelLink";
import "./BoxModelEditor.css";
import { useStylesSelectedId } from "../stylesHost";

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
  /** A linked commit: the ring's four sides as one edit (one history step). */
  readonly onRingChange?: (ring: BoxRing, value: string) => void;
  /**
   * ADR-222: 캔버스 spacing 세션이 소유 중인 padding 변 — 강조 표시 + 잠시 read-only
   * (외부 드래그 중 local draft 가 이전 값을 다시 덮지 않도록, breakdown §4.1).
   */
  readonly activePaddingSides?: ReadonlySet<BoxSide>;
  /**
   * ADR-275 사용자 결정 2 — margin sides an absolute box's Center axis owns: the Margin field
   * neither reads nor writes them (a positioned box moves by its Position offset, as in Figma ·
   * Framer).
   */
  readonly lockedMarginSides?: ReadonlySet<BoxSide>;
}

const SIDES: readonly BoxSide[] = ["Top", "Right", "Bottom", "Left"];

function toDisplay(value: string): string {
  return value.replace("px", "");
}

function toCss(input: string): string {
  const numeric = input.replace(/[^0-9.]/g, "");
  if (numeric === "") return "";
  return `${numeric}px`;
}

type Draft = Record<BoxSide, string>;

function toDraft(padding: BoxSideValues): Draft {
  return {
    Top: toDisplay(padding.top),
    Right: toDisplay(padding.right),
    Bottom: toDisplay(padding.bottom),
    Left: toDisplay(padding.left),
  };
}

export const BoxModelEditor = memo(function BoxModelEditor({
  padding,
  margin,
  onPaddingChange,
  onMarginChange,
  onRingChange,
  activePaddingSides,
  lockedMarginSides,
}: BoxModelEditorProps) {
  const localize = useSemanticLabel();
  const selectedElementId = useStylesSelectedId();
  const derived = useMemo(() => toDraft(padding), [padding]);
  const [draft, setDraft] = useState<Draft>(derived);
  // link 는 캔버스 spacing 드래그도 읽는다 (4변 동일 값) — 모듈 상태 공유
  const linked = usePaddingLinked();
  const focusedElementIdRef = useRef<string | null>(null);
  const justSavedViaEnterRef = useRef(false);

  // 선택 요소나 외부 값이 바뀌면 로컬 편집 세션을 새 대상 기준으로 리셋 (FourWayGrid 와 동일)
  useEffect(() => {
    justSavedViaEnterRef.current = false;
    focusedElementIdRef.current = null;
    queueMicrotask(() => setDraft(derived));
  }, [derived, selectedElementId]);

  const commit = useCallback(
    (side: BoxSide) => {
      if (
        focusedElementIdRef.current !== null &&
        selectedElementId !== focusedElementIdRef.current
      ) {
        return;
      }
      const typed = draft[side];
      // A blur without a change writes nothing: the shown value may be the catalog default.
      if (
        linked
          ? SIDES.every((target) => derived[target] === typed)
          : derived[side] === typed
      )
        return;
      const css = toCss(typed);
      if (linked) {
        // link 는 네 변 연동 — 한 편집 (한 step)
        if (onRingChange) onRingChange("padding", css);
        else for (const target of SIDES) onPaddingChange(target, css);
        setDraft({ Top: typed, Right: typed, Bottom: typed, Left: typed });
        return;
      }
      onPaddingChange(side, css);
    },
    [derived, draft, linked, onPaddingChange, onRingChange, selectedElementId],
  );

  const renderInput = (side: BoxSide) => {
    const active = !!activePaddingSides?.has(side);
    return (
      <input
        key={side}
        className={`box-model__input box-model__input--${side.toLowerCase()}`}
        data-active={active || undefined}
        readOnly={active}
        value={draft[side]}
        placeholder="0"
        inputMode="decimal"
        aria-label={`${localize("Padding")} ${side}`}
        onChange={(event) => {
          const next = event.target.value;
          setDraft((prev) => ({ ...prev, [side]: next }));
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
          commit(side);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(side);
            justSavedViaEnterRef.current = true;
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  };

  // 네 변 한 값 — 같으면 그 값, 다르면 비워 두고 Mixed. 잠긴 margin 변 (Center 축) 은 보지 않는다.
  const ringValue = (ring: BoxRing): string => {
    const values = ring === "padding" ? padding : margin;
    const shown = SIDES.filter(
      (side) => ring !== "margin" || !lockedMarginSides?.has(side),
    ).map((side) => values[side.toLowerCase() as keyof BoxSideValues]);
    return shown.length > 0 && shown.every((value) => value === shown[0])
      ? shown[0]
      : "";
  };
  const renderRingField = (ring: BoxRing) => {
    const value = ringValue(ring);
    return (
      <PropertyUnitInput
        label={ring === "padding" ? "Padding" : "Margin"}
        unitSuffix
        className={`spacing-${ring}`}
        key={`${ring}:${selectedElementId}`}
        value={value}
        placeholder={value === "" ? localize("Mixed") : undefined}
        units={["px"]}
        defaultUnit="px"
        // 빈 값 (Mixed) 을 0 으로 그리지 않는다 — 입력할 때까지 placeholder
        preserveEmptyValueOnUnitChange
        min={ring === "margin" ? -9999 : 0}
        max={9999}
        isDisabled={
          ring === "margin" && lockedMarginSides?.size === SIDES.length
        }
        onChange={(next) => {
          if (onRingChange) onRingChange(ring, next);
          else
            for (const side of SIDES)
              (ring === "padding" ? onPaddingChange : onMarginChange)(
                side,
                next,
              );
        }}
      />
    );
  };

  return (
    <div className="spacing-controls">
      {renderRingField("padding")}
      {renderRingField("margin")}
      <fieldset className="properties-aria spacing-box-model">
        <legend className="fieldset-legend">{localize("Sides")}</legend>
        <div className="box-model" data-linked={linked || undefined}>
          <span className="box-model__center" aria-hidden="true" />
          {SIDES.map(renderInput)}
        </div>
      </fieldset>
      <div className="fieldset-actions actions-spacing">
        <SwatchIconToggleButton
          aria-label={localize(linked ? "Unlink sides" : "Link sides")}
          isSelected={linked}
          onChange={setPaddingLinked}
        >
          {linked ? (
            <Link size={iconSmall.size} strokeWidth={iconSmall.strokeWidth} />
          ) : (
            <Unlink size={iconSmall.size} strokeWidth={iconSmall.strokeWidth} />
          )}
        </SwatchIconToggleButton>
      </div>
    </div>
  );
});

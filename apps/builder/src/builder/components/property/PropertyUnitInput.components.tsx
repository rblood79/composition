import { ChevronDown, Hash } from "lucide-react";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "react-aria-components/Button";

import { ComboBox as AriaComboBox } from "react-aria-components/ComboBox";

import { Header } from "react-aria-components/Header";
import { Input } from "react-aria-components/Input";

import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";

import { Popover } from "react-aria-components/Popover";

import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

import { iconProps } from "../../../utils/ui/uiConstants";

import { useLatestCallbacks } from "./latestCallbacks";

import { usePropertySelection } from "./propertySelection";

import {
  DEFAULT_UNITS,
  findMatchingPreset,
  getInputDisplayValue,
  getPresetCommitValue,
  getPresetDisplayValue,
  INPUT_LABEL_TO_KEYWORD,
  isTokenValue,
  KEYWORDS,
  parseUnitValue,
  presetsUseCssUnits,
  PropertyUnitInputProps,
  tokenChipLabel,
  UNIT_GATED_KEYWORDS,
} from "./PropertyUnitInput.runtime";
import type { PropertyUnitPreset } from "./propertyUnitPresets";
import { propertyUnitStepFrom, propertyUnitSteps } from "./propertyUnitSteps";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";
import { BUILDER_POPUP_LIST_CLASS } from "../../styles/modules/builderPopupList";

/** ADR-298 D6 — scrub: px of pointer travel before a drag starts, and per ladder step. */
const SCRUB_THRESHOLD_PX = 3;
const SCRUB_STRIDE_PX = 8;
/** A unit row's key in the combined step + unit menu (a preset id never starts with it). */
const UNIT_KEY = "unit:";

/** Consecutive presets of one `group` (ungrouped ones — Reset — stand alone). */
function presetGroups(presets: readonly PropertyUnitPreset[]) {
  const out: { group?: string; items: PropertyUnitPreset[] }[] = [];
  for (const preset of presets) {
    const last = out[out.length - 1];
    if (last && preset.group && last.group === preset.group)
      last.items.push(preset);
    else out.push({ group: preset.group, items: [preset] });
  }
  return out;
}

/** A preset's accessible name — the group joins it (「Heading M」) so two groups' 「M」 differ. */
const presetName = (preset: PropertyUnitPreset) =>
  preset.group ? `${preset.group} ${preset.label}` : preset.label;

export const PropertyUnitInputControl = memo(
  function PropertyUnitInput({
    label,
    value,
    onChange,
    onDrag,
    onDragCancel,
    icon: iconProp,
    className,
    units = DEFAULT_UNITS,
    defaultUnit = "",
    allowKeywords = true,
    preserveEmptyValueOnUnitChange = false,
    allowEmptyReset = false,
    isDisabled: isDisabledProp = false,
    placeholder = "reset",
    min = 0,
    max = 9999,
    presets,
    presetAriaLabel,

    labelMode = "legend",
    suffixLabel,
    unitSuffix = false,
    sizeControl,
    afterControl,
    presetUnits = false,
    autoValue,
  }: PropertyUnitInputProps) {
    // 숫자 칸은 늘 칸 안 앞 표시를 둔다 — 축은 글자 (LetterX …), 그 밖은 값 아이콘, 지정이 없으면
    //   `#` (Figma · Pen 방식, 사용자 결정 2026-11-10). 표시는 끌어서 값 바꾸는 손잡이도 겸한다.
    //   legend 없이 아이콘이 이름인 칸 (labelMode icon) 은 호출부가 준 아이콘만.
    const Icon =
      iconProp === null
        ? undefined
        : (iconProp ?? (labelMode === "legend" ? Hash : undefined));
    // 비율을 고른 요소의 종속 축 (Ratio 선택 시 Height) 은 입력 · 끌기 · 단위 메뉴 전부 막는다 —
    //   값은 비율이 정한다 (사용자 지정 2026-11-10, 종전 readOnly 는 focus · 끌기가 됐다).
    const isDisabled = isDisabledProp || sizeControl?.kind === "ratio";
    const i18n = useOptionalI18n();
    const displayLabel =
      label && i18n
        ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
        : label;
    const selection = usePropertySelection();
    const selectedElementId = selection.useSelectedId();
    const isPreservedEmptyValue =
      preserveEmptyValueOnUnitChange && value.trim() === "";
    // useMemo로 value prop에서 파생값 계산 (useLayoutEffect + setState 대체)
    const parsed = useMemo(() => parseUnitValue(value), [value]);
    const numericValue = parsed.numericValue;
    // 단위 해석: parsed.unit이 비어있고 숫자가 있으면 units 목록에서 첫 번째 비키워드 단위로 폴백
    // (e.g., borderWidth: "1" → unit="" → "px" 폴백). 목록에 `""` 가 있으면 빈 단위도 고를 수 있는
    // 단위다 — 폴백하지 않는다 (ADR-274 Settings 열 수: `""` = 개수, `%` = 기준 배율. 폴백하면
    // 개수 `10` 이 `10%` 로 보이고 다음 입력이 배율로 commit 된다).
    const resolvedUnit =
      parsed.unit ||
      (parsed.numericValue !== null && !units.includes("")
        ? defaultUnit ||
          units.find((u) => u !== "" && !KEYWORDS.includes(u)) ||
          ""
        : parsed.unit);
    const [draftUnit, setDraftUnit] = useState<string | null>(null);
    const unit = draftUnit ?? resolvedUnit;
    const hasPresets = Boolean(presets?.length);
    // ADR-298 Phase 4: the step menu and the unit menu in one list (Position — `%` stays a unit).
    const unitsWithPresets = hasPresets && presetUnits;
    const isTypedKeyword = (keyword: string) =>
      KEYWORDS.includes(keyword) &&
      (!UNIT_GATED_KEYWORDS.includes(keyword) || units.includes(keyword));
    const hasUnitPresets = presetsUseCssUnits(presets);
    const inputUnit =
      hasPresets && hasUnitPresets && !unitsWithPresets ? "px" : unit;
    // ADR-298 D4: a token value (`var(--spacing-md)`) — chip + the active value, not a keyword.
    const valueIsToken = isTokenValue(value);
    const tokenChip = tokenChipLabel(value, presets);
    // ADR-298 Phase 5: `auto` with a resolved value (Line Height) — the field reads 「auto」, the value
    //   it follows is the hover title (2026-11-10 — chip removed with the token chips).
    const autoChip =
      !tokenChip && autoValue !== undefined && value.trim() === "auto";
    const isKeyword = parsed.numericValue === null && !valueIsToken;
    const [inputValue, setInputValue] = useState(() =>
      getInputDisplayValue(value, parsed, isPreservedEmptyValue, presets),
    );
    // suffix 모드의 키워드 값 ("normal" 등) 은 87 열에서 "nor…" 로 잘린다 — 포커스 전에는 빈
    //   입력 + placeholder (muted) 로 보이고, 포커스하면 키워드 글자가 편집 대상으로 들어온다.
    const [isInputFocused, setIsInputFocused] = useState(false);
    // legend + unitSuffix (「fill —」) 도 같다 — 값 칸에 키워드, 단위 트리거는 — (키워드는 단위가 없다).
    const showKeywordAsPlaceholder =
      (labelMode === "suffix" || (labelMode !== "icon" && unitSuffix)) &&
      isKeyword &&
      !isInputFocused;
    const numericInputValue = Number(inputValue.trim());
    const matchingPreset = findMatchingPreset(inputValue, presets);
    const selectedPreset =
      (valueIsToken
        ? presets?.find((preset) => preset.value.trim() === value.trim())
        : undefined) ??
      (matchingPreset?.value.trim() !== "" ? matchingPreset : undefined) ??
      (inputValue.trim() !== "" && Number.isFinite(numericInputValue)
        ? presets?.find((preset) => {
            if (preset.value.trim() === "") return false;
            const presetParsed = parseUnitValue(preset.value);
            return (
              presetParsed.numericValue !== null &&
              presetParsed.numericValue === numericInputValue
            );
          })
        : undefined);
    // ⭐ useRef로 변경: Enter 키로 저장했는지 추적 (useState는 비동기!)
    const justSavedViaEnterRef = useRef(false);
    // ⭐ 마지막으로 저장한 값 추적 - 중복 호출 방지
    const lastSavedValueRef = useRef<string>(value);
    const focusedElementIdRef = useRef<string | null>(null);
    const syncAfterPresetRef = useRef(false);
    const sizeModeSelectionRef = useRef<string | null>(null);
    /** 단위 메뉴가 열려 있는가 — 닫힌 채 오는 onSelectionChange (input Enter 의 재방출) 를 거른다. */
    const menuOpenRef = useRef(false);
    const inputElementRef = useRef<HTMLInputElement>(null);

    // preview 경로가 elementsMap 을 mutate 하면서 value prop 이 편집값으로 바뀌어도
    // focus 중인 input 은 편집 세션을 유지해야 한다 (DOM activeElement 기준).
    useEffect(() => {
      const isInputFocused =
        inputElementRef.current !== null &&
        document.activeElement === inputElementRef.current;
      const isEditingCurrentElement =
        focusedElementIdRef.current === selectedElementId;
      if (
        isInputFocused &&
        isEditingCurrentElement &&
        !syncAfterPresetRef.current
      ) {
        return;
      }

      syncAfterPresetRef.current = false;
      justSavedViaEnterRef.current = false;
      lastSavedValueRef.current = value;
      focusedElementIdRef.current = null;
      const nextDisplay = getInputDisplayValue(
        value,
        parsed,
        isPreservedEmptyValue,
        presets,
      );
      queueMicrotask(() => {
        setInputValue(nextDisplay);
        setDraftUnit(null);
      });
    }, [value, selectedElementId, parsed, isPreservedEmptyValue, presets]);

    const tokenDisplay = () =>
      getInputDisplayValue(value, parsed, isPreservedEmptyValue, presets);
    /**
     * The number the field shows — every reader of it (▲▼ · label scrub · unit change) goes
     * through here: a token shows its step name (「M」), so it reads as the token's resolved px
     * (D9 — the literal escape); otherwise the typed text. (style-ssot.md §5)
     */
    const shownNumber = () =>
      parseFloat(
        valueIsToken && inputValue.trim() === tokenDisplay()
          ? getPresetDisplayValue(value.trim())
          : inputValue,
      );

    const handleInputChange = (newValue: string) => {
      setInputValue(newValue);
    };
    const handleComboBoxTriggerPress = () => {
      if (sizeControl) sizeModeSelectionRef.current = null;
    };

    // ⭐ ComboBox 컨테이너 ref - 내부 포커스 이동 감지용
    const comboBoxContainerRef = useRef<HTMLDivElement>(null);
    // 팝오버 폭·좌측 정렬 계산은 useControlPopoverMetrics 단일 소스 (패널 공통 규약)
    const {
      anchorRef: groupRef,
      controlRef: comboBoxRef,
      popoverStyle,
    } = useControlPopoverMetrics({ widthMode: "fit-content" });

    // 숫자 commit 의 단위 (Enter · blur 공통). 친 글자에 단위가 붙어 있고 (「2fr」· 「50%」) 그
    //   단위가 메뉴에 있으면 그 단위 — 키워드 상태 (「fill」) 에서 「2fr」 을 쳐도 px 로 떨어지지
    //   않는다 (2026-09-17). 아니면 현재 단위, 키워드 단위(auto, fit-content 등)에서 숫자로
    //   전환 시 px.
    const resolveTypedUnit = (typed: string): string => {
      if (hasPresets && !unitsWithPresets) return hasUnitPresets ? "px" : "";
      const typedUnit = parseUnitValue(typed).unit;
      if (
        typedUnit !== "" &&
        !KEYWORDS.includes(typedUnit) &&
        units.includes(typedUnit)
      ) {
        return typedUnit;
      }
      if (sizeControl?.kind === "fill" && sizeControl.fraction) return "fill";
      return KEYWORDS.includes(unit) ? "px" : unit;
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsInputFocused(false);
      // ⭐ Skip save if we just saved via Enter key (useRef는 즉시 반영됨!)
      if (justSavedViaEnterRef.current) {
        justSavedViaEnterRef.current = false;
        return;
      }

      // ⭐ 요소 전환 감지: focus 시점과 blur 시점의 selectedElementId가 다르면
      // 이전 요소의 값이 새 요소에 적용되는 것을 방지
      const currentElementId = selection.readSelectedId();
      if (
        focusedElementIdRef.current !== null &&
        currentElementId !== focusedElementIdRef.current
      ) {
        return;
      }

      // ⭐ ComboBox 내부로 포커스 이동 시 blur 처리 스킵
      // Input → Button 이동 시 불필요한 onChange 방지
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (
        relatedTarget &&
        comboBoxContainerRef.current?.contains(relatedTarget)
      ) {
        return;
      }

      const trimmed = inputValue.trim();
      const resolved =
        INPUT_LABEL_TO_KEYWORD[trimmed.toLowerCase()] ?? trimmed.toLowerCase();
      // A token value left as shown stays the token (its shown number is not a literal edit).
      if (valueIsToken && trimmed === tokenDisplay()) {
        focusedElementIdRef.current = null;
        return;
      }

      const matchingPreset = findMatchingPreset(trimmed, presets);
      if (hasPresets && matchingPreset) {
        const newValue = getPresetCommitValue(matchingPreset);
        if (newValue !== value && newValue !== lastSavedValueRef.current) {
          lastSavedValueRef.current = newValue;
          onChange(newValue);
        }
        focusedElementIdRef.current = null;
        return;
      }

      if (allowEmptyReset && trimmed === "") {
        if (lastSavedValueRef.current !== "") {
          lastSavedValueRef.current = "";
          onChange("");
        }
        focusedElementIdRef.current = null;
        return;
      }

      if (allowKeywords && isTypedKeyword(resolved)) {
        const keyword = resolved;
        // "reset" 선택 시 inline style 제거 (빈 문자열 전달)
        const newValue = keyword === "reset" ? "" : keyword;
        // ⭐ 값이 변경된 경우에만 onChange 호출 + 중복 호출 방지
        if (newValue !== value && newValue !== lastSavedValueRef.current) {
          lastSavedValueRef.current = newValue;
          onChange(newValue);
        }
        return;
      }

      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        // Invalid input, revert to previous value
        setInputValue(
          getInputDisplayValue(value, parsed, isPreservedEmptyValue, presets),
        );
        return;
      }

      if (num < min || num > max) {
        // Out of range, revert to previous value
        setInputValue(
          getInputDisplayValue(value, parsed, isPreservedEmptyValue, presets),
        );
        return;
      }

      const effectiveUnit = resolveTypedUnit(trimmed);

      // commit 판정은 lastSavedValueRef 기준 — preview 가 value prop 을 편집값으로
      // 먼저 반영할 수 있어 `parseUnitValue(value)` 비교는 "변경 없음" 오판 가능.
      const newValue = `${num}${effectiveUnit}`;
      if (newValue !== lastSavedValueRef.current) {
        lastSavedValueRef.current = newValue;
        onChange(newValue);
      }
      focusedElementIdRef.current = null;
    };

    const handleUnitChange = (selectedUnit: string) => {
      if (isPreservedEmptyValue && selectedUnit === "reset") {
        setDraftUnit(null);
        setInputValue("");
        return;
      }

      if (isPreservedEmptyValue && !KEYWORDS.includes(selectedUnit)) {
        setDraftUnit(selectedUnit);
        setInputValue("");
        return;
      }

      if (KEYWORDS.includes(selectedUnit)) {
        // "reset" 선택 시 inline style 제거 (빈 문자열 전달)
        const newValue = selectedUnit === "reset" ? "" : selectedUnit;
        // 메뉴를 닫으면 RAC ComboBox 가 input 에 focus 를 돌려준다 — 그 상태로 value prop 동기화가
        //   skip 되면 blur 가 옛 숫자/키워드 (「fit」) 를 다시 commit 해 방금 고른 키워드 (fill) 를
        //   덮는다 (2026-09-15 live). preset 경로처럼 표시값을 바로 바꾸고 다음 동기화를 강제한다.
        setInputValue(
          getInputDisplayValue(
            newValue,
            parseUnitValue(newValue),
            isPreservedEmptyValue,
            presets,
          ),
        );
        syncAfterPresetRef.current = true;
        // ⭐ 중복 호출 방지
        if (newValue !== value && newValue !== lastSavedValueRef.current) {
          lastSavedValueRef.current = newValue;
          onChange(newValue);
        }
        return;
      }

      // Use the shown number, not the state numericValue
      const currentNum = shownNumber();
      let newValue: string;
      if (!isNaN(currentNum) && currentNum !== 0) {
        // 현재 값이 유효한 숫자이고 0이 아니면 유지
        newValue = `${currentNum}${selectedUnit}`;
      } else if (numericValue !== null && numericValue !== 0) {
        // state에 저장된 값이 있고 0이 아니면 사용
        newValue = `${numericValue}${selectedUnit}`;
      } else {
        // ⭐ %, vh, vw 단위는 100을 기본값으로, fr 는 1 (= fill), 나머지는 0
        const defaultValue = ["%", "vh", "vw"].includes(selectedUnit)
          ? 100
          : selectedUnit === "fr"
            ? 1
            : 0;
        newValue = `${defaultValue}${selectedUnit}`;
      }

      // ⭐ 중복 호출 방지
      if (newValue !== value && newValue !== lastSavedValueRef.current) {
        lastSavedValueRef.current = newValue;
        onChange(newValue);
      }
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsInputFocused(true);
      // Select all text on focus for easier editing
      e.target.select();
      // Reset flag on focus (new editing session)
      justSavedViaEnterRef.current = false;
      // ⭐ focus 시점의 selectedElementId 캡처 — blur 시 요소 전환 감지
      focusedElementIdRef.current = selection.readSelectedId();
    };

    /** ▲▼ — 화살표 키 (repeat 라 onDrag 스로틀) 와 stepper 클릭 (commit) 이 같은 계산 */
    const stepValue = (
      direction: 1 | -1,
      coarse: boolean,
      mode: "drag" | "commit",
    ) => {
      if (
        isKeyword ||
        (sizeControl && !sizeControl.fraction && sizeControl.kind !== "css")
      )
        return;
      const step = coarse ? 10 : 1;
      // The shown edit value: a host whose preview does not write the document (catalog) keeps
      // the `value` prop at the committed value, so successive arrows step from what is shown.
      const typed = shownNumber();
      const base = Number.isFinite(typed)
        ? typed
        : sizeControl
          ? 0
          : numericValue || 0;
      const next =
        direction > 0 ? Math.min(base + step, max) : Math.max(base - step, min);
      setInputValue(String(next));
      const nextValue = `${next}${inputUnit}`;
      if (sizeControl && mode === "drag") return;
      if (mode === "drag") {
        (onDrag || onChange)(nextValue);
        return;
      }
      if (nextValue !== lastSavedValueRef.current) {
        lastSavedValueRef.current = nextValue;
        onChange(nextValue);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (sizeControl && e.key === "Escape") {
        e.preventDefault();
        setInputValue(
          getInputDisplayValue(value, parsed, isPreservedEmptyValue, presets),
        );
        justSavedViaEnterRef.current = true;
        (e.target as HTMLInputElement).blur();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // ⭐ Enter로 저장하기 전에 값이 변경되었는지 확인
        const trimmed = inputValue.trim();
        const resolved =
          INPUT_LABEL_TO_KEYWORD[trimmed.toLowerCase()] ??
          trimmed.toLowerCase();
        const matchingPreset = findMatchingPreset(trimmed, presets);
        let shouldSave = false;

        if (valueIsToken && trimmed === tokenDisplay()) {
          // unchanged token — nothing to commit
        } else if (hasPresets && matchingPreset) {
          const newVal = getPresetCommitValue(matchingPreset);
          if (newVal !== value && newVal !== lastSavedValueRef.current) {
            lastSavedValueRef.current = newVal;
            onChange(newVal);
            shouldSave = true;
          }
        } else if (allowEmptyReset && trimmed === "") {
          if (lastSavedValueRef.current !== "") {
            lastSavedValueRef.current = "";
            onChange("");
            shouldSave = true;
          }
        } else if (allowKeywords && isTypedKeyword(resolved)) {
          const keyword = resolved;
          const newVal = keyword === "reset" ? "" : keyword;
          if (newVal !== value) {
            onChange(newVal);
            shouldSave = true;
          }
        } else {
          const num = parseFloat(trimmed);
          if (!isNaN(num) && num >= min && num <= max) {
            const effectiveUnit = resolveTypedUnit(trimmed);

            // preview 경로가 value prop 을 먼저 편집값으로 반영할 수 있으므로
            // commit 판정은 lastSavedValueRef (이전 commit 결과) 기준.
            const newVal = `${num}${effectiveUnit}`;
            if (newVal !== lastSavedValueRef.current) {
              lastSavedValueRef.current = newVal;
              onChange(newVal);
              shouldSave = true;
            }
          }
        }

        if (shouldSave) {
          // ⭐ useRef로 즉시 플래그 설정 (setState와 달리 동기적!)
          justSavedViaEnterRef.current = true;
        }
        // Blur the input to confirm the change
        (e.target as HTMLInputElement).blur();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // 목록이 열려 있으면 ↑/↓ 는 RAC 의 항목 이동이다 (숫자를 바꾸지 않는다).
        if (menuOpenRef.current) return;
        // 닫힌 칸의 ↑/↓ 는 숫자 stepper 하나 — RAC ComboBox 로 보내지 않는다. 보내면 RAC 가 닫힌
        //   목록을 열고 (`state.open('last')`) 가상 포커스를 옮겨, 이어진 Tab 이 그 항목을 commit 한다
        //   (/fix 2026-11-02 — Gap 0 에서 ↑×3 Tab = M 토큰, ↑×30 Tab = Reset 으로 값 삭제).
        e.preventDefault();
        e.stopPropagation();
        stepValue(e.key === "ArrowUp" ? 1 : -1, e.shiftKey, "drag");
      }
    };

    const isSuffix = labelMode === "suffix";
    const isIconMode = labelMode === "icon";
    const unitLabel = i18n
      ? translateKey(i18n.t, semanticLabelKeys.Unit ?? "Unit", "Unit")
      : "Unit";
    // suffix 모드 (preset 없음): 단위 메뉴 트리거는 suffix 글자 자체 (「8 PX」 의 PX) — 종전
    //   ▾ 20 상자가 86 열을 먹어 「au… LEFT」 로 잘렸다 (panel-ui 05 #3 · 06). ▲▼ stepper 는
    //   2026-09-15 사용자 판정으로 전부 제거 — 숫자 조정은 화살표 키 (⇧ 10) 뿐.
    const suffixIsTrigger = isSuffix && !hasPresets && Boolean(displayLabel);
    // legend 모드 + unitSuffix: 트리거 글자가 현재 단위 (「8 PX」, 단위 없음은 —)
    const unitIsTrigger =
      !isSuffix &&
      (unitSuffix || isIconMode) &&
      (!hasPresets || unitsWithPresets);
    const sizeReadOnly =
      sizeControl &&
      sizeControl.kind !== "css" &&
      !(sizeControl.kind === "fill" && sizeControl.fraction);
    // ADR-224 Size 메뉴 항목 — ko/en 은 translations `styles.transform.sizeMode.*` (i18n 없는 테스트는 en).
    const sizeModeText = (key: string, fallback: string) =>
      i18n ? translateKey(i18n.t, key, fallback) : fallback;
    const modeLabel = (u: string) =>
      ({
        px: sizeModeText("styles.transform.sizeMode.fixed", "Fixed"),
        fill: sizeModeText("styles.transform.sizeMode.fill", "Fill"),
        "fit-content": sizeModeText(
          "styles.transform.sizeMode.fitContent",
          "Fit content",
        ),
        "%": sizeModeText("styles.transform.sizeMode.parent", "Parent"),
        vw: sizeModeText("styles.transform.sizeMode.vw", "Viewport"),
        vh: sizeModeText("styles.transform.sizeMode.vh", "Viewport"),
        reset: sizeModeText("styles.transform.sizeMode.reset", "Reset"),
      })[u] ?? u;
    const sizeTrigger =
      sizeControl?.kind === "fill"
        ? "fr"
        : sizeControl?.kind === "fit"
          ? "fit"
          : // 비율이 정한 축은 값 대신 「Auto」 를 쓰지 않는다 — 칸은 비율로 계산된 px 를 보이고
            //   단위도 px (사용자 지정 2026-11-10). 칸은 비활성이라 편집되지 않는다.
            sizeControl?.kind === "ratio"
            ? "px"
            : undefined;
    /** The menu key of the value as it is (an empty value with Reset = Reset). */
    const currentKey =
      value === "" && units.includes("reset")
        ? "reset"
        : unit === ""
          ? "—"
          : unit;
    const unitSuffixText = valueIsToken
      ? "px"
      : unit === "" ||
          unit === "reset" ||
          isKeyword ||
          (value === "" && units.includes("reset"))
        ? "—"
        : unit;

    // ADR-298 D4 · D6 — the field's step ladder (its token presets at the active px, + 0).
    const steps = useMemo(() => propertyUnitSteps(presets), [presets]);
    const pxValued = valueIsToken || inputUnit === "px";
    /** A literal not on the ladder (an old document's 10 — D9): shown with a dot, kept as it is. */
    const offScale =
      steps.length > 0 &&
      !valueIsToken &&
      pxValued &&
      numericValue !== null &&
      numericValue !== 0 &&
      !steps.some((step) => step.px === numericValue);
    /** Empty = the rule's value shows through (inherit) — a dim 「—」, not 「reset」. */
    const emptyInherits =
      steps.length > 0 && value.trim() === "" && placeholder === "reset";
    const offScaleText = i18n
      ? translateKey(
          i18n.t,
          "styles.token.offScale",
          "Not a theme step — pick one from the menu",
        )
      : "Not a theme step — pick one from the menu";
    const scrubbable =
      !isDisabled &&
      !isKeyword &&
      !(sizeControl && !(sizeControl.kind === "css"));
    const scrubRef = useRef<{
      x: number;
      start: number;
      original: string;
      next: string;
      moved: boolean;
    } | null>(null);
    /**
     * Pointer scrub on the field's label (icon · legend — Figma's label drag): a token field walks
     * its ladder one step per {@link SCRUB_STRIDE_PX} (D6 — the same steps the Canvas handle snaps
     * to), ⌥ is the free value (1 per px, ⇧ ×10), a field without steps is always free. The drag
     * previews through `onDrag` (a field without one only shows the value); release commits once.
     */
    const scrubHandlers = scrubbable
      ? {
          onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
            if (event.button !== 0) return;
            const typed = shownNumber();
            const start = Number.isFinite(typed) ? typed : (numericValue ?? 0);
            scrubRef.current = {
              x: event.clientX,
              start,
              original: value,
              next: value,
              moved: false,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          },
          onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
            const scrub = scrubRef.current;
            if (!scrub) return;
            const dx = event.clientX - scrub.x;
            if (!scrub.moved && Math.abs(dx) < SCRUB_THRESHOLD_PX) return;
            scrub.moved = true;
            let next: string;
            if (steps.length && pxValued && !event.altKey) {
              const count = Math.trunc(dx / SCRUB_STRIDE_PX);
              next =
                count === 0
                  ? scrub.original
                  : (propertyUnitStepFrom(steps, scrub.start, count)?.value ??
                    scrub.original);
            } else {
              const delta = Math.round(dx) * (event.shiftKey ? 10 : 1);
              const n = Math.min(max, Math.max(min, scrub.start + delta));
              next = `${Number(n.toFixed(4))}${inputUnit}`;
            }
            if (next === scrub.next) return;
            scrub.next = next;
            setInputValue(
              getInputDisplayValue(next, parseUnitValue(next), false, presets),
            );
            // A field without a preview shows the step and commits once on release (one History).
            onDrag?.(next);
          },
          onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
            const scrub = scrubRef.current;
            scrubRef.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            if (!scrub?.moved) return;
            syncAfterPresetRef.current = true;
            if (
              scrub.next !== scrub.original &&
              scrub.next !== lastSavedValueRef.current
            ) {
              lastSavedValueRef.current = scrub.next;
              onChange(scrub.next);
            } else {
              onDragCancel?.();
            }
          },
          onLostPointerCapture: () => {
            if (!scrubRef.current) return;
            scrubRef.current = null;
            setInputValue(
              getInputDisplayValue(
                value,
                parsed,
                isPreservedEmptyValue,
                presets,
              ),
            );
            if (onDragCancel) onDragCancel();
            else onDrag?.(value);
          },
          onPointerCancel: () => {
            const scrub = scrubRef.current;
            scrubRef.current = null;
            if (!scrub?.moved) return;
            setInputValue(
              getInputDisplayValue(
                value,
                parsed,
                isPreservedEmptyValue,
                presets,
              ),
            );
            if (onDragCancel) onDragCancel();
            else onDrag?.(scrub.original);
          },
        }
      : undefined;
    return (
      <fieldset
        className={`properties-aria property-unit-input ${className || ""}`}
        title={sizeControl?.description}
        data-size-control={sizeControl ? "true" : undefined}
        data-token-value={valueIsToken ? "true" : undefined}
        data-off-scale={offScale ? "true" : undefined}
        data-empty={emptyInherits ? "true" : undefined}
        data-scrub={scrubHandlers ? "true" : undefined}
        data-label-mode={
          labelMode === "suffix" ? "suffix" : unitIsTrigger ? "unit" : undefined
        }
        aria-label={
          labelMode !== "legend" && displayLabel ? displayLabel : undefined
        }
      >
        {displayLabel && labelMode === "legend" && (
          <legend className="fieldset-legend" {...scrubHandlers}>
            {displayLabel}
          </legend>
        )}
        <div className="react-aria-control react-aria-Group" ref={groupRef}>
          {Icon && (labelMode === "legend" || isIconMode) && (
            <label className="control-label" {...scrubHandlers}>
              <Icon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </label>
          )}
          <AriaComboBox
            className="react-aria-ComboBox react-aria-UnitComboBox"
            ref={comboBoxRef}
            isDisabled={isDisabled}
            // "reset" 단위 (값 없음) 는 글자 대신 placeholder — 필드에 "reset" 이 차던 것
            //   (suffix 모드 86px 열에서 "r…" 로 잘렸다, 2026-09-14)
            inputValue={
              hasPresets ? "" : unit === "" ? "—" : unit === "reset" ? "" : unit
            }
            onOpenChange={(open) => {
              menuOpenRef.current = open;
            }}
            onSelectionChange={(key) => {
              if (key === null) return;
              // 닫힌 메뉴에서 온 선택은 무시 — RAC ComboBox 는 숫자 input 의 Enter 에서도 같은 key 로
              //   onSelectionChange 를 다시 낸다 (allowDuplicateSelectionEvents). 그게 sizeControl.onModeChange
              //   ("px") 로 가면 stale 측정값 (`bundle.effective`) 을 다시 commit 해 방금 친 값을 덮는다 —
              //   요소를 바꾼 뒤 첫 Enter 마다 (사용자 live 2026-09-20: 200 → 250 Enter 가 200 으로 남음,
              //   Tab 은 정상). 사용자가 고른 선택은 항상 열린 메뉴에서 온다.
              if (!menuOpenRef.current) return;
              if (sizeControl) {
                const selectedMode = String(key);
                // RAC는 option 선택 뒤 input Enter에서 같은 mode를 다시 방출할 수 있다. 한 번 연
                // 메뉴 안의 중복만 막고, trigger를 다시 누른 명시적 재선택은 허용한다.
                if (sizeModeSelectionRef.current === selectedMode) return;
                // The mode it already has is no edit — RAC re-announces the selected key when
                // Escape closes the menu (a page body's Height wrote an empty "Edit size" step,
                // live 2026-11-13).
                if (selectedMode === currentKey) return;
                sizeModeSelectionRef.current = selectedMode;
                syncAfterPresetRef.current = true;
                sizeControl.onModeChange(selectedMode);
                return;
              }

              if (unitsWithPresets && String(key).startsWith(UNIT_KEY)) {
                handleUnitChange(String(key).slice(UNIT_KEY.length));
                return;
              }
              if (hasPresets) {
                const preset = presets?.find(
                  (candidate) => candidate.id === String(key),
                );
                if (!preset) return;

                syncAfterPresetRef.current = true;
                const newValue = getPresetCommitValue(preset);
                setInputValue(
                  getInputDisplayValue(
                    newValue,
                    parseUnitValue(newValue),
                    false,
                    presets,
                  ),
                );
                setDraftUnit(null);
                if (newValue !== lastSavedValueRef.current) {
                  lastSavedValueRef.current = newValue;
                  onChange(newValue);
                }
                return;
              }

              const selectedUnit = key === "—" ? "" : (key as string);
              handleUnitChange(selectedUnit);
            }}
            selectedKey={
              unitsWithPresets
                ? valueIsToken
                  ? (selectedPreset?.id ?? null)
                  : `${UNIT_KEY}${unit}`
                : hasPresets
                  ? (selectedPreset?.id ?? null)
                  : (draftUnit ?? currentKey)
            }
            aria-label={
              hasPresets
                ? (presetAriaLabel ?? displayLabel ?? "Preset")
                : i18n
                  ? translateKey(
                      i18n.t,
                      semanticLabelKeys.Unit ?? "Unit",
                      "Unit",
                    )
                  : "Unit"
            }
          >
            <div className="combobox-container" ref={comboBoxContainerRef}>
              {offScale && (
                <span
                  className="property-unit-input__off-scale"
                  aria-hidden="true"
                  title={offScaleText}
                />
              )}
              <Input
                ref={inputElementRef}
                className="react-aria-Input"
                type="text"
                value={
                  sizeReadOnly
                    ? ""
                    : autoChip
                      ? inputValue
                      : showKeywordAsPlaceholder
                        ? ""
                        : inputValue
                }
                readOnly={!!sizeReadOnly}
                // 칸은 단계 이름 (XS) — 지금 테마의 px 는 hover 풍선 (메뉴의 「XS · 4」 와 같은 짝)
                //   (Line Height 「auto」 도 칸 글자 auto + 풍선에 따르는 행간)
                title={
                  tokenChip
                    ? `${tokenChip} · ${getPresetDisplayValue(value.trim())}px`
                    : autoChip
                      ? `auto · ${autoValue}`
                      : undefined
                }
                aria-description={
                  sizeControl?.description ??
                  (offScale ? offScaleText : undefined)
                }
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                // React Aria ComboBox의 option 선택 key handler보다 먼저 숫자 commit을 확정한다.
                // bubble 단계만 쓰면 열린 목록의 현재 option(Fixed 등)이 Enter를 선점한다.
                onKeyDownCapture={handleKeyDown}
                aria-label={
                  (sizeControl?.kind === "fill" && sizeControl.fraction
                    ? `${displayLabel} 채우기 가중치`
                    : sizeControl?.kind === "ratio"
                      ? `${displayLabel} 자동(비율)`
                      : displayLabel) ||
                  (i18n
                    ? translateKey(
                        i18n.t,
                        semanticLabelKeys.Value ?? "Value",
                        "Value",
                      )
                    : "Value")
                }
                placeholder={
                  sizeReadOnly
                    ? sizeControl.computed == null
                      ? "—"
                      : String(Math.round(sizeControl.computed))
                    : showKeywordAsPlaceholder && inputValue.trim() !== ""
                      ? inputValue
                      : emptyInherits
                        ? "—"
                        : placeholder
                }
              />
              {suffixIsTrigger || unitIsTrigger ? (
                <Button
                  className="react-aria-Button property-unit-input__suffix property-unit-input__suffix--trigger"
                  isDisabled={sizeControl?.kind === "ratio"}
                  onPress={handleComboBoxTriggerPress}
                  aria-label={
                    sizeControl
                      ? `${displayLabel} ${sizeModeText("styles.transform.sizeMode.groupBasic", "Size mode")}`
                      : `${displayLabel ?? ""} ${unitLabel}`.trim()
                  }
                >
                  {sizeTrigger ??
                    (unitIsTrigger
                      ? unitSuffixText
                      : (suffixLabel ?? displayLabel))}
                </Button>
              ) : (
                <>
                  {displayLabel && isSuffix && (
                    <span
                      className="property-unit-input__suffix"
                      aria-hidden="true"
                    >
                      {suffixLabel ?? displayLabel}
                    </span>
                  )}
                  <Button
                    className="react-aria-Button"
                    onPress={handleComboBoxTriggerPress}
                    aria-label={hasPresets ? presetAriaLabel : undefined}
                  >
                    <ChevronDown size={iconProps.size} />
                  </Button>
                </>
              )}
            </div>
            <Popover
              className={`react-aria-Popover property-unit-input-popover ${BUILDER_POPUP_LIST_CLASS}`}
              style={popoverStyle}
            >
              <ListBox className="react-aria-ListBox">
                {sizeControl
                  ? [
                      // Reset first — as in every other value menu (사용자 지정 2026-11-13).
                      ...(units.includes("reset")
                        ? [
                            <ListBoxItem
                              key="reset"
                              id="reset"
                              textValue={modeLabel("reset")}
                              className="react-aria-ListBoxItem"
                            >
                              {modeLabel("reset")}
                            </ListBoxItem>,
                          ]
                        : []),
                      <ListBoxSection
                        key="basic"
                        aria-label={sizeModeText(
                          "styles.transform.sizeMode.groupBasic",
                          "Size mode",
                        )}
                      >
                        {["px", "fill", "fit-content"]
                          .filter((u) => units.includes(u))
                          .map((u) => (
                            <ListBoxItem
                              key={u}
                              id={u}
                              textValue={modeLabel(u)}
                              isDisabled={sizeControl.disabledModes?.includes(
                                u,
                              )}
                              className="react-aria-ListBoxItem"
                            >
                              {modeLabel(u)}
                            </ListBoxItem>
                          ))}
                      </ListBoxSection>,
                      <ListBoxSection
                        key="relative"
                        aria-label={sizeModeText(
                          "styles.transform.sizeMode.groupRelative",
                          "Relative size",
                        )}
                      >
                        {units
                          .filter(
                            (u) =>
                              !["reset", "px", "fill", "fit-content"].includes(
                                u,
                              ),
                          )
                          .map((u) => (
                            <ListBoxItem
                              key={u}
                              id={u}
                              textValue={modeLabel(u)}
                              isDisabled={sizeControl.disabledModes?.includes(
                                u,
                              )}
                              className="react-aria-ListBoxItem"
                            >
                              {modeLabel(u)}
                            </ListBoxItem>
                          ))}
                      </ListBoxSection>,
                    ]
                  : hasPresets
                    ? [
                        ...presetGroups(presets ?? []).map(
                          ({ group, items }) => {
                            const rows = items.map((preset) => (
                              <ListBoxItem
                                key={preset.id}
                                id={preset.id}
                                className="react-aria-ListBoxItem"
                                textValue={presetName(preset)}
                                aria-label={presetName(preset)}
                              >
                                {/* 「XS · 4」 — 토큰 이름 + 풀린 px (Border 프리셋 메뉴와 같은 표기).
                              이름이 곧 값이면 (Grid Columns 「3」) 하나만 — 「3 · 3」 금지 */}
                                {preset.value.trim() === "" ||
                                preset.label ===
                                  getPresetDisplayValue(preset.value)
                                  ? preset.label
                                  : `${preset.label} · ${getPresetDisplayValue(preset.value)}`}
                              </ListBoxItem>
                            ));
                            // ADR-298 D3: 묶음 (Font Size 본문 · 제목) 은 ListBox section 하나씩.
                            return group ? (
                              <ListBoxSection key={group} aria-label={group}>
                                <Header>{group}</Header>
                                {rows}
                              </ListBoxSection>
                            ) : (
                              rows
                            );
                          },
                        ),
                        // ADR-298 Phase 4 — the unit rows after the steps (Position keeps `%`).
                        ...(unitsWithPresets
                          ? [
                              <ListBoxSection
                                key={UNIT_KEY}
                                aria-label={unitLabel}
                              >
                                <Header>{unitLabel}</Header>
                                {units
                                  .filter(
                                    (u) => u !== "" && !KEYWORDS.includes(u),
                                  )
                                  .map((u) => (
                                    <ListBoxItem
                                      key={`${UNIT_KEY}${u}`}
                                      id={`${UNIT_KEY}${u}`}
                                      className="react-aria-ListBoxItem"
                                      textValue={u}
                                    >
                                      {u}
                                    </ListBoxItem>
                                  ))}
                              </ListBoxSection>,
                            ]
                          : []),
                      ]
                    : units.map((u) => (
                        <ListBoxItem
                          key={u === "" ? "—" : u}
                          id={u === "" ? "—" : u}
                          className="react-aria-ListBoxItem"
                          textValue={u === "" ? "—" : u}
                        >
                          {u === "" ? "—" : u}
                        </ListBoxItem>
                      ))}
              </ListBox>
            </Popover>
          </AriaComboBox>
        </div>
        {afterControl}
      </fieldset>
    );
  },
  (prevProps, nextProps) => {
    // ⭐ 커스텀 비교: onChange 함수 참조는 무시하고 실제 값만 비교
    return (
      prevProps.label === nextProps.label &&
      prevProps.value === nextProps.value &&
      prevProps.className === nextProps.className &&
      prevProps.icon === nextProps.icon &&
      prevProps.min === nextProps.min &&
      prevProps.max === nextProps.max &&
      prevProps.allowKeywords === nextProps.allowKeywords &&
      prevProps.allowEmptyReset === nextProps.allowEmptyReset &&
      prevProps.isDisabled === nextProps.isDisabled &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.presets === nextProps.presets &&
      prevProps.presetAriaLabel === nextProps.presetAriaLabel &&
      prevProps.labelMode === nextProps.labelMode &&
      prevProps.suffixLabel === nextProps.suffixLabel &&
      prevProps.sizeControl === nextProps.sizeControl &&
      prevProps.unitSuffix === nextProps.unitSuffix &&
      prevProps.presetUnits === nextProps.presetUnits &&
      prevProps.autoValue === nextProps.autoValue &&
      prevProps.afterControl === nextProps.afterControl &&
      prevProps.preserveEmptyValueOnUnitChange ===
        nextProps.preserveEmptyValueOnUnitChange &&
      JSON.stringify(prevProps.units) === JSON.stringify(nextProps.units)
    );
  },
);
const CALLBACK_KEYS: readonly (keyof PropertyUnitInputProps)[] = [
  "onChange",
  "onDrag",
];
export function PropertyUnitInput(props: PropertyUnitInputProps) {
  const current = useLatestCallbacks(props, CALLBACK_KEYS);
  return <PropertyUnitInputControl {...current} />;
}

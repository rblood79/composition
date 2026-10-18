import { ChevronDown } from "lucide-react";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "react-aria-components/Button";

import { ComboBox as AriaComboBox } from "react-aria-components/ComboBox";

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
  KEYWORDS,
  parseUnitValue,
  presetsUseCssUnits,
  PropertyUnitInputProps,
  UNIT_GATED_KEYWORDS,
} from "./PropertyUnitInput.runtime";
import { useControlPopoverMetrics } from "./useControlPopoverMetrics";

export const PropertyUnitInputControl = memo(
  function PropertyUnitInput({
    label,
    value,
    onChange,
    onDrag,
    icon: Icon,
    className,
    units = DEFAULT_UNITS,
    defaultUnit = "",
    allowKeywords = true,
    preserveEmptyValueOnUnitChange = false,
    allowEmptyReset = false,
    isDisabled = false,
    placeholder = "reset",
    min = 0,
    max = 9999,
    presets,
    presetAriaLabel,

    labelMode = "legend",
    suffixLabel,
    unitSuffix = false,
    sizeControl,
  }: PropertyUnitInputProps) {
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
    const isTypedKeyword = (keyword: string) =>
      KEYWORDS.includes(keyword) &&
      (!UNIT_GATED_KEYWORDS.includes(keyword) || units.includes(keyword));
    const hasUnitPresets = presetsUseCssUnits(presets);
    const inputUnit = hasPresets && hasUnitPresets ? "px" : unit;
    const isKeyword = parsed.numericValue === null;
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
      if (hasPresets) return hasUnitPresets ? "px" : "";
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

      // Use the current input value, not the state numericValue
      const currentNum = parseFloat(inputValue);
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
      const typed = parseFloat(inputValue);
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

        if (hasPresets && matchingPreset) {
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

      if (e.key === "ArrowUp") {
        e.preventDefault();
        stepValue(1, e.shiftKey, "drag");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        stepValue(-1, e.shiftKey, "drag");
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
      !isSuffix && (unitSuffix || isIconMode) && !hasPresets;
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
          : sizeControl?.kind === "ratio"
            ? sizeModeText(
                "styles.transform.sizeMode.ratioTrigger",
                "Auto (ratio)",
              )
            : undefined;
    const unitSuffixText =
      unit === "" ||
      unit === "reset" ||
      isKeyword ||
      (value === "" && units.includes("reset"))
        ? "—"
        : unit;
    return (
      <fieldset
        className={`properties-aria property-unit-input ${className || ""}`}
        title={sizeControl?.description}
        data-size-control={sizeControl ? "true" : undefined}
        data-label-mode={
          labelMode === "suffix" ? "suffix" : unitIsTrigger ? "unit" : undefined
        }
        aria-label={
          labelMode !== "legend" && displayLabel ? displayLabel : undefined
        }
      >
        {displayLabel && labelMode === "legend" && (
          <legend className="fieldset-legend">{displayLabel}</legend>
        )}
        <div className="react-aria-control react-aria-Group" ref={groupRef}>
          {Icon && (labelMode === "legend" || isIconMode) && (
            <label className="control-label">
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
                sizeModeSelectionRef.current = selectedMode;
                syncAfterPresetRef.current = true;
                sizeControl.onModeChange(selectedMode);
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
              hasPresets
                ? (selectedPreset?.id ?? null)
                : (draftUnit ??
                  (value === "" && units.includes("reset")
                    ? "reset"
                    : unit === ""
                      ? "—"
                      : unit))
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
              <Input
                ref={inputElementRef}
                className="react-aria-Input"
                type="text"
                value={
                  sizeReadOnly ? "" : showKeywordAsPlaceholder ? "" : inputValue
                }
                readOnly={!!sizeReadOnly}
                aria-description={sizeControl?.description}
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
              className="react-aria-Popover property-unit-input-popover"
              style={popoverStyle}
            >
              <ListBox className="react-aria-ListBox">
                {sizeControl
                  ? [
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
                            (u) => !["px", "fill", "fit-content"].includes(u),
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
                    ? presets?.map((preset) => (
                        <ListBoxItem
                          key={preset.id}
                          id={preset.id}
                          className="react-aria-ListBoxItem"
                          textValue={preset.label}
                          aria-label={preset.label}
                        >
                          {/* 「XS · 4」 — 토큰 이름 + 풀린 px (Border 프리셋 메뉴와 같은 표기).
                              이름이 곧 값이면 (Grid Columns 「3」) 하나만 — 「3 · 3」 금지 */}
                          {preset.value.trim() === "" ||
                          preset.label === getPresetDisplayValue(preset.value)
                            ? preset.label
                            : `${preset.label} · ${getPresetDisplayValue(preset.value)}`}
                        </ListBoxItem>
                      ))
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

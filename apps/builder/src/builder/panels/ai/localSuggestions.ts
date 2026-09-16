/** 추천은 실행 능력의 새 정본이 아니다. 현재 계약으로 후보를 만들고 실제 compiler로 거른다. */
import type { ResolvedField } from "@composition/shared";
import type { CompilerProposal } from "../../../services/ai/compiler/contracts";
import { compileRequest } from "../../../services/ai/compiler/compile";
import {
  validateProgram,
  type CommandContext,
  type CommandManifest,
} from "../../../services/ai/compiler/manifest";
import { racSuggestionFeatures } from "./racSuggestionFeatures";

export interface LocalSuggestion {
  label: string;
  execution?: CompilerProposal;
  request: string;
  group: "component" | "common" | "create";
}

// UI 문구만 가진다. 지원 여부와 boolean/enum 타입은 현재 편집 계약을 따른다.
const booleanActions: Record<
  string,
  readonly [string, string, string, string]
> = {
  isPending: [
    "처리 중 상태로 표시",
    "처리 중 상태 해제",
    "Show pending state",
    "Clear pending state",
  ],
  isSelected: [
    "선택 상태로 표시",
    "선택 상태 해제",
    "Select this control",
    "Deselect this control",
  ],
  isIndeterminate: [
    "미확정 상태로 표시",
    "미확정 상태 해제",
    "Show indeterminate state",
    "Clear indeterminate state",
  ],
  isRequired: [
    "필수 입력으로 변경",
    "선택 입력으로 변경",
    "Require a value",
    "Make the value optional",
  ],
  isReadOnly: [
    "읽기 전용으로 변경",
    "편집 허용",
    "Make read-only",
    "Allow editing",
  ],
  isInvalid: [
    "입력 오류 상태로 표시",
    "입력 오류 상태 해제",
    "Show invalid state",
    "Clear invalid state",
  ],
  allowsCustomValue: [
    "목록에 없는 값도 입력 허용",
    "목록의 값만 입력 허용",
    "Allow custom input values",
    "Require a listed value",
  ],
  disallowEmptySelection: [
    "최소 한 항목 선택 유지",
    "모든 항목 선택 해제 허용",
    "Require at least one selection",
    "Allow clearing the selection",
  ],
  isExpanded: [
    "내용 펼치기",
    "내용 접기",
    "Expand the content",
    "Collapse the content",
  ],
  allowsMultipleExpanded: [
    "여러 섹션 동시 펼침 허용",
    "한 섹션만 펼치기",
    "Allow multiple expanded sections",
    "Expand one section at a time",
  ],
  isWheelDisabled: [
    "스크롤로 숫자 변경 방지",
    "스크롤로 숫자 변경 허용",
    "Prevent scroll wheel changes",
    "Allow scroll wheel changes",
  ],
  allowsMultiple: [
    "여러 파일 선택 허용",
    "파일 하나만 선택",
    "Allow multiple files",
    "Select one file at a time",
  ],
  acceptDirectory: [
    "폴더 선택 허용",
    "파일 선택으로 변경",
    "Allow directory selection",
    "Switch to file selection",
  ],
  hideTimeZone: [
    "시간대 숨기기",
    "시간대 표시",
    "Hide the time zone",
    "Show the time zone",
  ],
  shouldForceLeadingZeros: [
    "날짜·시간 앞자리 0 표시",
    "앞자리 0 자동 표시",
    "Always show leading zeros",
    "Use locale leading zeros",
  ],
  isOpen: [
    "열린 상태로 표시",
    "닫힌 상태로 표시",
    "Show the open state",
    "Show the closed state",
  ],
};
const commonKeys = [
  "variant",
  "size",
  "fillStyle",
  "staticColor",
  "isDisabled",
];

export function getLocalSuggestions({
  manifest,
  context,
  identity = "unbound",
  fields,
  korean,
  label = (value) => value,
}: {
  identity?: string;
  manifest: CommandManifest;
  context: CommandContext;
  fields: readonly ResolvedField[];
  korean: boolean;
  label?: (value: string) => string;
}): LocalSuggestion[] {
  const candidates: LocalSuggestion[] = [];
  const target = context.nodes.find((node) => node.id === context.selectedId);
  const type = target?.componentType ?? target?.type ?? "";
  const eligible = fields.filter(
    (field) => !field.editorHidden && !field.visibleWhen,
  );
  const addField = (key: string, group: LocalSuggestion["group"]) => {
    const field = eligible.find(
      (field) => field.key === key && field.origin === "semantic",
    );
    if (!field) return;
    const preferred =
      key === "selectionMode"
        ? "multiple"
        : key === "type"
          ? type === "Button"
            ? "submit"
            : "email"
          : undefined;
    const alternatives = field.options?.filter(
      (option) => option.value !== String(field.currentValue),
    );
    const option =
      alternatives?.find((option) => option.value === preferred) ??
      alternatives?.[0];
    let value: string | number | boolean | undefined =
      option?.value ??
      (field.kind === "boolean" ? !field.currentValue : undefined);
    if (field.kind === "number" && (key === "step" || key === "value")) {
      const min = Number(
        fields.find((f) => f.key === "minValue")?.currentValue ?? 0,
      );
      const max = Number(
        fields.find((f) => f.key === "maxValue")?.currentValue ?? 100,
      );
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
      if (key === "step") {
        value = Number(field.currentValue) === 5 || max - min < 5 ? 1 : 5;
        if (value > max - min) return;
      } else {
        const step = Number(
          fields.find((f) => f.key === "step")?.currentValue ?? 1,
        );
        if (!Number.isFinite(step) || step <= 0) return;
        value = Math.min(max, min + Math.floor((max - min) / step / 2) * step);
        if (value === field.currentValue) value = min;
      }
    }
    if (value === undefined || value === field.currentValue) return;
    const action = field.kind === "boolean" ? booleanActions[key] : undefined;
    const valueLabel = option
      ? label(option.label ?? String(value))
      : typeof value === "boolean"
        ? value
          ? korean
            ? "켜기"
            : "On"
          : korean
            ? "끄기"
            : "Off"
        : String(value);
    candidates.push({
      group,
      label: action
        ? action[(korean ? 0 : 2) + (value ? 0 : 1)]
        : `${label(field.label)} · ${valueLabel}`,
      request: `set ${field.key} to ${value}`,
    });
  };
  if (context.selectedId) {
    for (const key of racSuggestionFeatures[type]?.fields ?? [])
      addField(key, "component");
    for (const key of commonKeys) addField(key, "common");
    for (const [key, value] of [
      ["borderRadius", "12px"],
      ["opacity", "0.8"],
    ]) {
      if (
        String(
          fields.find((field) => field.key === key && field.origin === "style")
            ?.currentValue,
        ) === value
      )
        continue;
      candidates.push({
        group: "common",
        label:
          key === "opacity"
            ? korean
              ? "불투명도 80%로 변경"
              : "Set opacity to 80%"
            : korean
              ? "모서리를 12px로 둥글게"
              : "Round corners to 12px",
        request: `set ${key} to ${value}`,
      });
    }
  } else {
    for (const type of ["Button", "Select", "Card"]) {
      const component = manifest.components.find(
        (component) => component.type === type && component.placeable,
      );
      if (component)
        candidates.push({
          group: "create",
          label: korean
            ? `${label(component.label)} 추가`
            : `Add ${component.label}`,
          request: `Add ${component.type}`,
        });
    }
  }
  const counts = { component: 0, common: 0, create: 0 };
  return candidates.filter((candidate) => {
    const { request, group } = candidate;
    if (counts[group] >= (group === "common" ? 2 : 3)) return false;
    const result = compileRequest(request, manifest, context);
    if (
      result.route !== "direct" ||
      !validateProgram(result.program, manifest, context).ok
    )
      return false;
    const operation = result.program.operations[0];
    if (operation.op === "update_element" && operation.args.props) {
      const props = operation.args.props;
      // 목표가 입력/선택을 받는 것이라면 이를 막는 상태도 같은 history entry에서 해제한다.
      const acceptsInput =
        props.isRequired === true ||
        props.allowsCustomValue === true ||
        (props.selectionMode !== undefined && props.selectionMode !== "none") ||
        props.step !== undefined;
      if (acceptsInput) {
        for (const key of ["isDisabled", "isReadOnly"]) {
          if (
            eligible.some(
              (field) =>
                field.key === key &&
                field.origin === "semantic" &&
                field.kind === "boolean",
            )
          )
            props[key] = false;
        }
      }
      if (!validateProgram(result.program, manifest, context).ok) return false;
    }
    candidate.execution = { identity, program: result.program };
    counts[group]++;
    return true;
  });
}

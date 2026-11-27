/**
 * ADR-321 — StepList 의 상태 규칙 (breakdown §5.2). 순수 함수이고 import 가 없다 — 두 consumer 의 파생
 * 값 (`stepList.ts`) · DOM 의 조립 (`stepList.components.tsx`) · 규칙 실행 (`interactions/dispatcher.ts`)
 * 이 같이 읽는다. 규칙은 v3 `useStepListState` 의 것이다 (대조 기준으로만 읽는다 — HC2, 대조 테스트
 * `adr321StepListV3.test.tsx`):
 *
 * - 완료 = 순서가 `lastCompletedStep` 이하.
 * - 지금 단계가 비면 완료 · 비활성이 아닌 첫 단계 (없으면 마지막 단계).
 * - 지금 단계가 마지막 완료 단계보다 둘 이상 앞이면 그 앞 단계까지 완료다 (지나온 단계 완료).
 * - 갈 수 있음 (누르기) = 완료된 단계 · 바로 앞이 완료된 단계 · 첫 단계. 「자유 이동」
 *   (`allowsFreeNavigation` — 사용자 결정 3, v3 에 없다) 이면 비활성이 아닌 모든 단계. 목록이 비활성 ·
 *   읽기 전용이거나 단계가 비활성이면 없다.
 * - 단계로 갈 때 그 앞 단계가 완료가 아니면 앞 단계까지 완료로 올린다 (v3 `setSelectedKey`). 완료는
 *   줄지 않는다.
 *
 * 규칙 (Do) 이 쓰는 이동은 순서를 따지지 않는다 — v3 의 `setSelectedKey` · `setLastCompletedStep` 처럼
 * 앱이 정하는 이동이다. 막는 것은 비활성 목록 · 비활성 단계뿐이고, 읽기 전용은 누르기만 막는다.
 */

export type StepListStepKind = "current" | "completed" | "incomplete";

export interface StepListStateInput {
  readonly keys: readonly string[];
  readonly selectedKey?: string | null;
  readonly lastCompletedStep?: string | null;
  readonly disabledKeys?: readonly string[];
  readonly isDisabled?: boolean;
  readonly isReadOnly?: boolean;
  /** 「자유 이동」 — 순서와 무관하게 비활성이 아닌 단계를 누를 수 있다. */
  readonly allowsFreeNavigation?: boolean;
}

export interface StepListStepState {
  readonly key: string;
  readonly index: number;
  readonly state: StepListStepKind;
  readonly completed: boolean;
  /** 비활성으로 그린다 — 목록의 `isDisabled` 또는 `disabledKeys` 에 든 단계. */
  readonly disabled: boolean;
  /** 눌러 갈 수 있다 (DOM 의 Link 가 이것으로 `isDisabled` 를 정한다). */
  readonly selectable: boolean;
}

export interface StepListStates {
  /** 지금 단계 — 준 값, 없으면 규칙이 고른 단계 (단계가 없으면 `null`). */
  readonly selectedKey: string | null;
  /** 마지막 완료 단계 — 지나온 단계 완료까지 넣은 값 (없으면 `null`). */
  readonly lastCompletedStep: string | null;
  readonly steps: readonly StepListStepState[];
}

export function catalogStepListStates(
  input: StepListStateInput,
): StepListStates {
  const { keys } = input;
  const disabledKeys = new Set(input.disabledKeys ?? []);
  const given =
    input.lastCompletedStep == null
      ? -1
      : keys.indexOf(input.lastCompletedStep);
  const selectedKey =
    input.selectedKey != null && keys.includes(input.selectedKey)
      ? input.selectedKey
      : (keys.find(
          (key, index) =>
            index === keys.length - 1 ||
            (!disabledKeys.has(key) && index > given),
        ) ?? null);
  // (v3: a current step more than one past the last completed one completes the steps before it.)
  const selectedAt = selectedKey === null ? -1 : keys.indexOf(selectedKey);
  const last = selectedAt > given + 1 ? selectedAt - 1 : given;
  const completedAt = (index: number) => last >= 0 && index <= last;
  return {
    selectedKey,
    lastCompletedStep: keys[last] ?? null,
    steps: keys.map((key, index) => {
      const completed = completedAt(index);
      const disabled = !!input.isDisabled || disabledKeys.has(key);
      return {
        key,
        index,
        completed,
        state:
          key === selectedKey
            ? "current"
            : completed
              ? "completed"
              : "incomplete",
        disabled,
        selectable:
          !disabled &&
          !input.isReadOnly &&
          (!!input.allowsFreeNavigation ||
            completed ||
            index === 0 ||
            completedAt(index - 1)),
      };
    }),
  };
}

/** A list's start keys — the controlled value, else the start value (`null` = none). */
export function catalogStepListKeys(props: Readonly<Record<string, unknown>>): {
  selectedKey: string | null;
  lastCompletedStep: string | null;
} {
  const key = (value: unknown, fallback: unknown): string | null => {
    for (const each of [value, fallback])
      if (typeof each === "string" && each !== "") return each;
    return null;
  };
  return {
    selectedKey: key(props.selectedKey, props.defaultSelectedKey),
    lastCompletedStep: key(
      props.lastCompletedStep,
      props.defaultLastCompletedStep,
    ),
  };
}

/** The two state props a move writes — only the ones it changes. */
export interface StepListPatch {
  selectedKey?: string;
  lastCompletedStep?: string | null;
}

export type StepListOutcome =
  { ok: true; patch: StepListPatch } | { ok: false; reason: string };

/** 단계 `at` 으로 간다: 그 앞 단계까지 완료로 올리고 (줄이지 않는다) 바뀐 값만 낸다. */
function moveTo(
  input: StepListStateInput,
  now: StepListStates,
  at: number,
): StepListOutcome {
  const { keys } = input;
  const key = keys[at]!;
  const last = now.lastCompletedStep ? keys.indexOf(now.lastCompletedStep) : -1;
  const next = Math.max(last, at - 1);
  return {
    ok: true,
    patch: {
      ...(key !== now.selectedKey ? { selectedKey: key } : {}),
      ...(next !== last ? { lastCompletedStep: keys[next] ?? null } : {}),
    },
  };
}

/** 사용자가 단계를 누른다 — 갈 수 있는 단계만 받는다. */
export function catalogStepListPress(
  input: StepListStateInput,
  key: string,
): StepListOutcome {
  const now = catalogStepListStates(input);
  const step = now.steps.find((each) => each.key === key);
  if (!step?.selectable)
    return { ok: false, reason: `갈 수 없는 단계: ${key}` };
  return moveTo(input, now, step.index);
}

/** 규칙의 Do: 「다음 단계」 · 「이전 단계」 · 「단계로 이동」 (`key`) · 「단계 완료」. */
export type StepListDo = "next" | "previous" | "to" | "complete";

export function catalogStepListDo(
  input: StepListStateInput,
  kind: StepListDo,
  key?: string,
): StepListOutcome {
  if (input.isDisabled) return { ok: false, reason: "isDisabled" };
  const now = catalogStepListStates(input);
  const { keys } = input;
  const current = now.selectedKey === null ? -1 : keys.indexOf(now.selectedKey);
  if (kind === "complete") {
    const last = now.lastCompletedStep
      ? keys.indexOf(now.lastCompletedStep)
      : -1;
    if (current <= last) return { ok: true, patch: {} };
    return {
      ok: true,
      patch: {
        // (A step the rule chose stays the current one — else the next unfinished step would take
        //  its place the moment this one completes. v3 keeps its first choice as state.)
        ...(input.selectedKey !== now.selectedKey && now.selectedKey !== null
          ? { selectedKey: now.selectedKey }
          : {}),
        lastCompletedStep: keys[current]!,
      },
    };
  }
  if (kind === "to" && (key === undefined || !keys.includes(key)))
    return { ok: false, reason: `단계 없음: ${key ?? ""}` };
  const target =
    kind === "to"
      ? keys.indexOf(key!)
      : kind === "next"
        ? current + 1
        : current - 1;
  // (The ends: 「다음」 on the last step and 「이전」 on the first stay — a range's end, not a failure.)
  if (target < 0 || target >= keys.length) return { ok: true, patch: {} };
  if (now.steps[target]!.disabled) return { ok: false, reason: "disabledKeys" };
  return moveTo(input, now, target);
}

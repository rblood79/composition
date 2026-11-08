/**
 * ADR-302 G3 — catalog rule paint 에서 「글자 · 아이콘 × 그 면」 쌍을 뽑는다 (손 목록 아님).
 *
 * variant 의 `paint.color` 와 `paint.backgroundColor` 조건 트리를 같은 조건 조합으로 평가해 (ADR-297 —
 * Canvas `resolveCatalogPaint` · 생성 CSS 와 같은 `evaluateConditionTree`), 두 값이 모두 `{color.*}` 이면 쌍이다.
 * disabled (WCAG 1.4.3 예외) · staticColor (이미지 위 — 바탕이 테마 밖) · 투명 면 (글자는 부모 바탕 위 — 층 검사가
 * 잰다) 은 뺀다.
 */
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { CATALOG_LAYER_ROLES } from "../runtime/containerLayer";
import {
  evaluateConditionTree,
  isConditionNode,
  VALUE_CONDITIONS,
  type ConditionSet,
} from "../rule/conditionTree";

/**
 * rule 의 `color` 가 그 면 위에 놓이지 않는 type — 면은 점 · 막대 · 손잡이 · 선이고 `color` 는 옆 글자다
 * (S2 StatusLight 의 점과 라벨, Meter · ProgressBar 의 채움, Slider 의 손잡이 · 채움, 구분선 · 자리 표시).
 */
export const TEXTLESS_FACE_TYPES: ReadonlySet<string> = new Set([
  "StatusLight",
  "MeterFill",
  "ProgressBarFill",
  "ProgressBarTrack",
  "SliderFill",
  "SliderThumb",
  "Separator",
  "Skeleton",
  "Image",
  // indicator 상자 (`backgroundColor`) 옆의 라벨 (`color`) — 체크 표시는 indicator 의 별도 그래픽
  "Checkbox",
  "Radio",
  "Switch",
]);

const SKIP_FLAGS = new Set(["isDisabled", "isStaticColor", "forcedColors"]);
const SKIP_VALUES = new Set(["staticColor"]);

export interface RulePair {
  fg: string;
  bg: string;
  /** `Type.variant` + 조건 — 실패 보고용. */
  where: string;
}

function collect(
  tree: unknown,
  flags: Set<string>,
  values: Map<string, Set<string>>,
): void {
  if (!isConditionNode(tree)) return;
  for (const [key, child] of Object.entries(tree)) {
    if (key === "default" || key === "domOnly") {
      if (key === "default") collect(child, flags, values);
      continue;
    }
    if ((VALUE_CONDITIONS as readonly string[]).includes(key)) {
      if (SKIP_VALUES.has(key) || !isConditionNode(child)) continue;
      const set = values.get(key) ?? new Set<string>();
      for (const [value, sub] of Object.entries(child)) {
        set.add(value);
        collect(sub, flags, values);
      }
      values.set(key, set);
      continue;
    }
    if (!SKIP_FLAGS.has(key)) flags.add(key);
    collect(child, flags, values);
  }
}

function combos(
  flags: readonly string[],
  values: ReadonlyMap<string, ReadonlySet<string>>,
): ConditionSet[] {
  let out: Record<string, boolean | string>[] = [{}];
  for (const flag of flags)
    out = out.flatMap((c) => [c, { ...c, [flag]: true }]);
  for (const [key, options] of values)
    out = out.flatMap((c) => [c, ...[...options].map((v) => ({ ...c, [key]: v }))]);
  return out as ConditionSet[];
}

const TOKEN = /^\{color\.([a-z0-9-]+)\}$/;

/** ADR-303 — the layers a `{color.container}` face can be (pasteboard holds no components — Hub). */
const CONTAINER_LAYERS = CATALOG_LAYER_ROLES.filter((role) => role !== "pasteboard");

export function rulePaintPairs(): RulePair[] {
  const out = new Map<string, RulePair>();
  for (const [type, rule] of Object.entries(
    COMPONENT_RULES_TABLE as unknown as Record<
      string,
      { variants?: Record<string, { paint?: Record<string, unknown> }> }
    >,
  )) {
    if (TEXTLESS_FACE_TYPES.has(type)) continue;
    for (const [variant, spec] of Object.entries(rule.variants ?? {})) {
      const color = spec.paint?.color;
      const background = spec.paint?.backgroundColor;
      // 그림 칠 (premium · genai 그라데이션) 이 보이는 면이면 바탕 색은 보이지 않는다
      if (!color || !background || spec.paint?.backgroundImage) continue;
      const flags = new Set<string>();
      const values = new Map<string, Set<string>>();
      collect(color, flags, values);
      collect(background, flags, values);
      for (const conditions of combos([...flags], values)) {
        const fg = TOKEN.exec(
          String(evaluateConditionTree(color as never, conditions) ?? ""),
        )?.[1];
        const bg = TOKEN.exec(
          String(evaluateConditionTree(background as never, conditions) ?? ""),
        )?.[1];
        if (!fg || !bg || bg === "transparent") continue;
        // ADR-303: `{color.container}` is whichever layer holds it — the pair stands on each layer.
        for (const face of bg === "container" ? CONTAINER_LAYERS : [bg]) {
          const key = `${fg}|${face}`;
          if (!out.has(key))
            out.set(key, {
              fg,
              bg: face,
              where: `${type}.${variant} ${JSON.stringify(conditions)}`,
            });
        }
      }
    }
  }
  return [...out.values()];
}

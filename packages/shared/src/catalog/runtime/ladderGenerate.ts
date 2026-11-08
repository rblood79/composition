/**
 * ADR-302 Decision 1 (사용자 결정 1 (a)) — 비기본 preset 의 사다리 생성 + 역할 값.
 *
 * **lazy chunk 전용** (사용자 결정 8): 사다리 표 (`SPECTRUM_LADDERS`) 와 이 생성식은 initial 번들에 싣지 않는다.
 * initial 은 `themeLadders.ts` 의 로더만 들고, resolver 는 로드된 모듈을 동기로 읽는다 (로드 전 = seed).
 *
 * 생성식 (breakdown §3):
 *   1. 단 i 마다 기준 사다리 R (accent = blue 16단 · tone = gray 13단, design-data 값) 의 oklch 명도 L_i 를 쓰고
 *      hue 는 preset 의 h, chroma 는 preset 의 c × Spectrum blue 사다리의 그 명도 chroma 비 (가장 진한 단 = 1 —
 *      Spectrum 사다리는 양 끝으로 갈수록 무채색에 가깝다. 고정 c 면 Tone 의 밝은 층이 색을 띤다) — sRGB gamut
 *      밖이면 hue 를 유지한 채 chroma 만 줄인다.
 *   2. 목표 대비 T_i = R[i] 와 기준 바탕 (gray-25) 의 WCAG 대비. 후보가 실제 바탕 (생성된 Tone 의 25 단) 에
 *      대해 T_i ± 5 % 밖이면 L 을 이분 탐색으로 맞춘다.
 *   3. 단조성 — 단 순서대로 L 이 기준 사다리와 같은 방향. 어긋난 단은 이웃의 중앙으로.
 *   4. 역할 검사 (alias 표 적용 뒤) — 실패한 역할만 사다리 안에서 최대 2단 옮긴다 (hover · pressed 는 같이).
 *      그래도 실패면 `failures` — G3 (`adr302HubRules.test.ts`) 가 FAIL 로 잡는다.
 *
 * 기본 축 (tint blue · 사용자 hex 없음 / Tone neutral) 은 1 ~ 4 를 거치지 않고 R 그대로다 (G1).
 */
import {
  COLOR_ALIASES,
  SPECTRUM_LADDERS,
  TAILWIND_PALETTE,
  type ColorAliasEntry,
  type SpectrumLadderFamily,
} from "@composition/rendering";
import { contrastRatio, relativeLuminance } from "./accentContrast";
import { hexToOklch, oklchToHexInGamut } from "./oklchToHex";

export type LadderMode = "light" | "dark";
export type Ladder = Readonly<Record<number, string>>;

/** 생성 입력 — 축 하나의 (chroma, hue). 없으면 그 축은 기준 사다리 그대로. */
export interface LadderHue {
  c: number;
  h: number;
}

export interface ThemeLadderInput {
  accent?: LadderHue;
  tone?: LadderHue;
}

export interface GeneratedThemeColors {
  light: Record<string, string>;
  dark: Record<string, string>;
  ladders: Record<"accent" | "tone", Record<LadderMode, Ladder>>;
  /** 4단계 수리 뒤에도 남은 대비 실패 — `<mode> <role> vs <against> <ratio> < <min>`. */
  failures: string[];
}

/** 비기본 Tone 의 (c, h) — Tailwind 500 단의 oklch (ADR-302 §3-5 · 사용자 결정 7: 이름 유지, 값만 생성). */
export const TONE_PRESET_HUES: Readonly<
  Record<"slate" | "gray" | "zinc" | "stone", LadderHue>
> = Object.fromEntries(
  (["slate", "gray", "zinc", "stone"] as const).map((tone) => {
    const o = hexToOklch(TAILWIND_PALETTE[tone][500])!;
    return [tone, { c: o.c, h: o.h }];
  }),
) as Record<"slate" | "gray" | "zinc" | "stone", LadderHue>;

const CONTRAST_TOLERANCE = 0.05;
const SEARCH_STEPS = 24;

function sortedSteps(ladder: Ladder): number[] {
  return Object.keys(ladder)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * 기준 사다리 `ref` 의 모양 (단별 L · 기준 바탕 대비) 을 (c, h) 로 옮긴다 — §3 의 1 ~ 3.
 * `refBg` = 기준 바탕 (그 모드의 gray-25), `bg` = 실제 바탕 (생성된 Tone 의 25 단).
 */
/**
 * Spectrum blue 사다리 (그 모드) 의 명도 → chroma 비 (가장 진한 단 = 1). 생성 사다리의 단별 chroma 모양.
 */
function chromaShape(mode: LadderMode): (l: number) => number {
  const points = Object.values(SPECTRUM_LADDERS.blue[mode]).map(
    (hex) => hexToOklch(hex)!,
  );
  const peak = Math.max(...points.map((p) => p.c));
  return (l) => {
    let best = points[0]!;
    for (const p of points)
      if (Math.abs(p.l - l) < Math.abs(best.l - l)) best = p;
    return best.c / peak;
  };
}

export function generateLadder(input: {
  ref: Ladder;
  refBg: string;
  bg: string;
  c: number;
  h: number;
  mode: LadderMode;
}): Record<number, string> {
  const { ref, refBg, bg, h } = input;
  const shape = chromaShape(input.mode);
  const chroma = (l: number) => input.c * shape(l);
  const steps = sortedSteps(ref);
  const bgL = hexToOklch(bg)?.l ?? 1;
  const refBgY = relativeLuminance(refBg);
  const ls: number[] = [];
  for (const step of steps) {
    const r = ref[step]!;
    let l = hexToOklch(r)?.l ?? 0.5;
    const target = contrastRatio(r, refBg);
    const c = chroma(l);
    const got = contrastRatio(oklchToHexInGamut(l, c, h), bg);
    if (Math.abs(got - target) / target > CONTRAST_TOLERANCE) {
      // 바탕보다 어두운 단은 L 이 내려갈수록, 밝은 단은 올라갈수록 대비가 커진다
      const darker = relativeLuminance(r) <= refBgY;
      let lo = darker ? 0 : bgL;
      let hi = darker ? bgL : 1;
      for (let i = 0; i < SEARCH_STEPS; i++) {
        const mid = (lo + hi) / 2;
        const ratio = contrastRatio(
          oklchToHexInGamut(mid, chroma(mid), h),
          bg,
        );
        if (darker === ratio > target) lo = mid;
        else hi = mid;
      }
      l = (lo + hi) / 2;
    }
    ls.push(l);
  }
  // 3. 단조성 — 기준 사다리의 L 방향 (light: 감소, dark: 증가) 을 지킨다
  const refFirst = hexToOklch(ref[steps[0]!]!)?.l ?? 0;
  const refLast = hexToOklch(ref[steps[steps.length - 1]!]!)?.l ?? 0;
  const dir = Math.sign(refLast - refFirst) || -1;
  for (let i = 1; i < ls.length - 1; i++)
    if ((ls[i]! - ls[i - 1]!) * dir < 0 || (ls[i + 1]! - ls[i]!) * dir < 0)
      ls[i] = (ls[i - 1]! + ls[i + 1]!) / 2;
  const out: Record<number, string> = {};
  steps.forEach((step, i) => {
    out[step] = oklchToHexInGamut(ls[i]!, chroma(ls[i]!), h);
  });
  return out;
}

// ── 4. 역할 검사 · 수리 ──

/**
 * 글자 역할이 놓이는 배경 층. `pasteboard` 는 뺀다 — 기본 preset (Spectrum 값) 의 status · accent 글자가 light
 * pasteboard (gray-100) 위에서 3.96 이라, 넣으면 비기본 preset 만 글자가 한 단 어두워진다 (기본이 지키지 않는
 * 규칙을 생성값에만 강제). G3 는 그 쌍을 기본 preset 부채로 기록한다.
 */
export const LAYER_ROLES = ["base", "layer-1", "layer-2", "elevated"] as const;
/** 바탕 위 글자 역할 — 배경 층에 4.5. */
export const TEXT_ROLES = [
  "neutral",
  "neutral-subdued",
  "neutral-content",
  "accent-content",
  "negative",
  "informative",
  "positive",
  "notice",
] as const;
/** 활성 면 (non-text) — base · layer-1 · layer-2 에 3. */
export const ACTIVE_SURFACE_ROLES = [
  "accent",
  "accent-fill",
  "selection-accent",
  "negative-fill",
  "focus-ring",
] as const;
const SURFACE_BACKDROPS = ["base", "layer-1", "layer-2"] as const;
/**
 * 전경 쌍 (글자 · 아이콘 × 면) — catalog rule paint 의 같은 가지에서 만나는 조합 중 생성 축의 면.
 * `min` 3 은 그래픽 (체크 표시) 이다. G3 가 rule 에서 쌍을 다시 뽑아 전 preset 에서 잰다.
 */
export const FOREGROUND_PAIRS: readonly {
  fg: string;
  bg: string;
  min: number;
}[] = [
  { fg: "on-accent", bg: "accent", min: 4.5 },
  { fg: "on-accent", bg: "accent-fill", min: 4.5 },
  { fg: "on-accent", bg: "accent-fill-hover", min: 4.5 },
  // 선택 체크 표시 (그래픽 3). hover (dark 1000 위 흰색 2.86) 는 기본 preset 도 미달이라 강제하지 않는다 (G3 부채).
  { fg: "on-accent", bg: "selection-accent", min: 3 },
  { fg: "on-negative", bg: "negative-fill", min: 4.5 },
  { fg: "on-negative", bg: "negative-fill-hover", min: 4.5 },
  { fg: "on-neutral", bg: "neutral-fill", min: 4.5 },
  { fg: "on-neutral", bg: "neutral-fill-hover", min: 4.5 },
];

const TEXT_CONTRAST = 4.5;
const SURFACE_CONTRAST = 3;
const MAX_REPAIR_STEPS = 2;
const L_SCAN_SAMPLES = 400;

interface Constraint {
  against: string;
  min: number;
}

function roleConstraints(): Map<string, Constraint[]> {
  const out = new Map<string, Constraint[]>();
  const add = (role: string, c: Constraint) =>
    out.set(role, [...(out.get(role) ?? []), c]);
  for (const role of TEXT_ROLES)
    for (const layer of LAYER_ROLES)
      add(role, { against: layer, min: TEXT_CONTRAST });
  for (const role of ACTIVE_SURFACE_ROLES)
    for (const layer of SURFACE_BACKDROPS)
      add(role, { against: layer, min: SURFACE_CONTRAST });
  for (const pair of FOREGROUND_PAIRS)
    add(pair.bg, { against: pair.fg, min: pair.min });
  return out;
}
const ROLE_CONSTRAINTS = roleConstraints();

function failing(
  value: string,
  constraints: readonly Constraint[],
  roles: Readonly<Record<string, string>>,
): Constraint | undefined {
  return constraints.find((k) => {
    const against = roles[k.against];
    if (!against) return false;
    const ratio = contrastRatio(value, against);
    return !Number.isNaN(ratio) && ratio < k.min;
  });
}

function ladderOf(
  entry: ColorAliasEntry,
  mode: LadderMode,
  axes: Record<"accent" | "tone", Ladder>,
): Ladder | undefined {
  if (entry.axis === "tone" || entry.axis === "accent") return axes[entry.axis];
  if (entry.axis === "status" || entry.axis === "hue")
    return SPECTRUM_LADDERS[entry.family as SpectrumLadderFamily]?.[mode];
  return undefined;
}

function roleColors(
  mode: LadderMode,
  axes: Record<"accent" | "tone", Ladder>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(COLOR_ALIASES)) {
    const step = entry[mode];
    if (typeof step === "string") {
      out[key] = step;
      continue;
    }
    const value = ladderOf(entry, mode, axes)?.[step];
    if (!value) throw new Error(`ADR-302 사다리 ${key} ${mode}-${step} 없음`);
    out[key] = value;
  }
  return out;
}

/**
 * 실패한 역할을 사다리 안에서 최대 2단 옮긴다 — 바탕에서 멀어지는 쪽 먼저, 그 역할의 hover · pressed 도 같은 폭.
 * 단 사이에만 통과 구간이 있으면 (흰 글자 4.5 와 바탕 3 의 창이 좁은 dark 면) 생성 축에 한해 그 2단 범위의
 * 명도를 연속으로 찾는다 — 원래 명도에 가장 가까운 통과 값 (G3 실패 시 대안 「L 조정 폭」).
 */
function repairRoles(
  roles: Record<string, string>,
  mode: LadderMode,
  axes: Record<"accent" | "tone", Ladder>,
  hues: Partial<Record<"accent" | "tone", LadderHue>>,
  failures: string[],
): void {
  for (const [role, constraints] of ROLE_CONSTRAINTS) {
    const entry = COLOR_ALIASES[role as keyof typeof COLOR_ALIASES] as
      ColorAliasEntry | undefined;
    const value = roles[role];
    if (!entry || !value || !failing(value, constraints, roles)) continue;
    const step = entry[mode];
    const ladder = ladderOf(entry, mode, axes);
    let moved = false;
    if (typeof step === "number" && ladder) {
      const steps = sortedSteps(ladder);
      const at = steps.indexOf(step);
      for (const delta of [1, 2, -1, -2].filter(
        (d) => Math.abs(d) <= MAX_REPAIR_STEPS,
      )) {
        const candidate = ladder[steps[at + delta]!];
        if (!candidate || failing(candidate, constraints, roles)) continue;
        roles[role] = candidate;
        for (const state of [`${role}-hover`, `${role}-pressed`]) {
          const stateEntry = COLOR_ALIASES[
            state as keyof typeof COLOR_ALIASES
          ] as ColorAliasEntry | undefined;
          const stateStep = stateEntry?.[mode];
          if (typeof stateStep !== "number") continue;
          const shifted = ladder[steps[steps.indexOf(stateStep) + delta]!];
          if (shifted) roles[state] = shifted;
        }
        moved = true;
        break;
      }
      const hue =
        entry.axis === "accent" || entry.axis === "tone"
          ? hues[entry.axis]
          : undefined;
      if (!moved && hue && at >= 0) {
        const lOf = (i: number) =>
          hexToOklch(ladder[steps[Math.max(0, Math.min(steps.length - 1, i))]!]!)!
            .l;
        const from = lOf(at - MAX_REPAIR_STEPS);
        const to = lOf(at + MAX_REPAIR_STEPS);
        const origin = lOf(at);
        const shape = chromaShape(mode);
        let best: { l: number; hex: string } | undefined;
        for (let i = 0; i <= L_SCAN_SAMPLES; i++) {
          const l = from + ((to - from) * i) / L_SCAN_SAMPLES;
          const hex = oklchToHexInGamut(l, hue.c * shape(l), hue.h);
          if (failing(hex, constraints, roles)) continue;
          if (!best || Math.abs(l - origin) < Math.abs(best.l - origin))
            best = { l, hex };
        }
        if (best) {
          roles[role] = best.hex;
          moved = true;
        }
      }
    }
    if (!moved) {
      const k = failing(value, constraints, roles)!;
      failures.push(
        `${mode} ${role} vs ${k.against} ${contrastRatio(value, roles[k.against]!).toFixed(2)} < ${k.min}`,
      );
    }
  }
}

/** tone 축 사다리 — 입력이 없으면 Spectrum gray 그대로. */
function toneLadderOf(tone: LadderHue | undefined, mode: LadderMode): Ladder {
  const gray = SPECTRUM_LADDERS.gray[mode];
  if (!tone) return gray;
  const refBg = gray[25]!;
  const l = hexToOklch(refBg)!.l;
  const bg = oklchToHexInGamut(l, tone.c * chromaShape(mode)(l), tone.h);
  return generateLadder({ ref: gray, refBg, bg, c: tone.c, h: tone.h, mode });
}

/**
 * Tone preset 의 사다리 — Themes 패널 견본이 읽는다 (역할 색과 같은 사다리, `buildThemeColors` 의 tone 축).
 * `neutral` (기본) 은 Spectrum gray.
 */
export function toneLadder(preset: string, mode: LadderMode): Ladder {
  return toneLadderOf(
    preset === "neutral"
      ? undefined
      : TONE_PRESET_HUES[preset as keyof typeof TONE_PRESET_HUES],
    mode,
  );
}

/**
 * preset 의 두 축 → 역할 값 두 벌. 축 입력이 없으면 기준 사다리 그대로 (기본 preset 은 seed 와 같다 — G1).
 */
export function buildThemeColors(
  input: ThemeLadderInput,
): GeneratedThemeColors {
  const failures: string[] = [];
  const ladders = {
    accent: {} as Record<LadderMode, Ladder>,
    tone: {} as Record<LadderMode, Ladder>,
  };
  const out = { light: {}, dark: {} } as Record<
    LadderMode,
    Record<string, string>
  >;
  for (const mode of ["light", "dark"] as const) {
    const blue = SPECTRUM_LADDERS.blue[mode];
    const refBg = SPECTRUM_LADDERS.gray[mode][25]!;
    const tone = toneLadderOf(input.tone, mode);
    let accent: Ladder = blue;
    if (input.accent)
      accent = generateLadder({
        ref: blue,
        refBg,
        bg: tone[25]!,
        c: input.accent.c,
        h: input.accent.h,
        mode,
      });
    const axes = { accent, tone };
    ladders.accent[mode] = accent;
    ladders.tone[mode] = tone;
    const roles = roleColors(mode, axes);
    if (input.accent || input.tone) repairRoles(roles, mode, axes, input, failures);
    out[mode] = roles;
  }
  return { light: out.light, dark: out.dark, ladders, failures };
}

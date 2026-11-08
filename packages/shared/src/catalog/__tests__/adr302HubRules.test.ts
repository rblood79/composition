/**
 * ADR-302 G3 — 규칙 유지. tint 10 × Tone 5 (= 50 preset) + 사용자 hex 7, light · dark 모두에서 Spectrum Hub 의
 * 대비 · 층 규칙이 지켜진다. 값 일치 (G1) 와 따로 잰다 — 「Spectrum 과 같다」 로 통과시키지 않는다.
 *
 *   (a) resolver 경고 — 생성 사다리 대기 · 수리 뒤 대비 미달 0
 *   (b) 글자 역할 (neutral · subdued · content · accent-content · status 4) on 층 5 ≥ 4.5
 *       — (b) · (d) 도 (c) 와 같이 기본 preset (Spectrum 값 — G1 이 고정) 이 이미 어기는 항목은
 *       `DEFAULT_PRESET_RULE_DEBT` 와 같아야 하고, 그 밖의 항목은 전 preset 통과.
 *   (c) 전경 쌍 = rule paint 의 같은 조건에서 만나는 `color` × `backgroundColor` 전수 (`adr302RulePairs.ts`,
 *       손 목록 아님) ≥ 4.5. 기본 preset (Spectrum 값) 에서 이미 미달인 쌍은 rule 데이터의 부채 — 아래
 *       `DEFAULT_PRESET_PAIR_DEBT` 와 실제 목록이 같아야 한다 (새 미달이 생기면 RED, 고치면 목록에서 뺀다).
 *   (d) 활성 면 (accent · accent-fill · selection-accent · negative-fill · focus-ring) on base · layer-1 · layer-2 ≥ 3,
 *       선택 체크 표시 (on-accent × selection-accent) ≥ 3 (그래픽 — non-text)
 *   (e) 배경 층 순서 — light: pasteboard < layer-1 < base = layer-2 = elevated (밝기) /
 *       dark: base = pasteboard < layer-1 < layer-2 = elevated
 *   (f) 상수가 아닌 역할은 light ≠ dark
 */
import { beforeAll, describe, expect, it } from "vitest";
import { COLOR_ALIASES } from "@composition/rendering";
import { createThemeDefinition } from "../../theme/themesCollection";
import { contrastRatio, relativeLuminance } from "../runtime/accentContrast";
import { DEFAULT_BASE_TYPOGRAPHY } from "../runtime/fontDefaults";
import { resolveThemeSnapshot } from "../runtime/resolveThemeSnapshot";
import { loadThemeLadders } from "../runtime/themeLadders";
import { TINT_PRESETS } from "../runtime/tintToSkiaColors";
import { rulePaintPairs } from "./adr302RulePairs";

const MODES = ["light", "dark"] as const;
const TONES = ["neutral", "slate", "gray", "zinc", "stone"] as const;
/** 사용자 hex 7 — 밝은 노랑 · 주황 · 초록 · 거의 검정 · 회색 · 보라 · 청록 (명도 · 채도 극단 포함). */
const HEX_SAMPLES = [
  "#ffd400",
  "#ff6600",
  "#00c853",
  "#111111",
  "#cccccc",
  "#6200ee",
  "#00bcd4",
];

const LAYERS = ["base", "layer-1", "layer-2", "elevated", "pasteboard"];
const TEXT_ROLES = [
  "neutral",
  "neutral-subdued",
  "neutral-content",
  "accent-content",
  "negative",
  "informative",
  "positive",
  "notice",
];
const ACTIVE_SURFACES = [
  "accent",
  "accent-fill",
  "selection-accent",
  "negative-fill",
  "focus-ring",
];

/**
 * 기본 preset (Spectrum 값) 에서 이미 4.5 미만인 rule 쌍 — 생성식이 아니라 rule 의 역할 선택 문제.
 * InlineAlert neutral bold (S2 `neutral-subdued` 면 + 흰 글자 — S2 자신의 값, ADR-302 전에도 미달).
 * Badge 의 subtle · hover · pressed · silver 쌍 33 은 S2 Badge 로 맞춰 닫았다 (codex round 4 h1 — subtle · outline
 * 글자 `gray-1000` · 상태 가지 없음 · subtle 면 = 자기 family · silver bold 글자 흰색). 새 미달은 여기 넣지 않는다.
 */
const DEFAULT_PRESET_PAIR_DEBT = ["white|neutral-subdued"];

/**
 * 기본 preset (Spectrum 값) 이 이미 어기는 (b) · (d) 항목 — Spectrum design-data 자체의 값이다 (G1 이 이 값을 고정).
 * light pasteboard (gray-100) 위 status · accent 글자 3.96 · dark `selection-accent-hover` (blue-1000) 위 흰 체크 2.86.
 */
const DEFAULT_PRESET_RULE_DEBT = [
  "light accent-content on pasteboard",
  "light informative on pasteboard",
  "light negative on pasteboard",
  "light notice on pasteboard",
  "light positive on pasteboard",
  "dark on-accent × selection-accent-hover",
];

interface Preset {
  name: string;
  tint: string;
  neutral: string;
  accentHex?: string;
}

const PRESETS: Preset[] = [
  ...Object.keys(TINT_PRESETS).flatMap((tint) =>
    TONES.map((neutral) => ({ name: `${tint}/${neutral}`, tint, neutral })),
  ),
  ...HEX_SAMPLES.map((hex) => ({
    name: hex,
    tint: "blue",
    neutral: "neutral",
    accentHex: hex,
  })),
];

function resolve(preset: Preset) {
  const theme = createThemeDefinition("adr302-g3", "G3");
  theme.preset = {
    ...theme.preset,
    tint: preset.tint,
    neutral: preset.neutral,
  };
  if (preset.accentHex)
    theme.tokens = {
      "color.accent": {
        type: "color",
        value: preset.accentHex,
        source: "user-defined",
      },
    } as never;
  return resolveThemeSnapshot(theme, {
    baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
  });
}

let snapshots: { preset: Preset; s: ReturnType<typeof resolve> }[] = [];

beforeAll(async () => {
  await loadThemeLadders();
  snapshots = PRESETS.map((preset) => ({ preset, s: resolve(preset) }));
});

const ratio = (a: string | undefined, b: string | undefined) =>
  a && b ? contrastRatio(a, b) : Number.NaN;

describe("ADR-302 G3 — Hub 규칙 (50 preset + hex 7 × 2 mode)", () => {
  it("(a) 생성 사다리 대기 · 수리 뒤 대비 미달 경고 0", () => {
    expect(snapshots).toHaveLength(57);
    const out = snapshots.flatMap(({ preset, s }) =>
      s.warnings.map((w) => `${preset.name}: ${w}`),
    );
    expect(out).toEqual([]);
  });

  it("(b) · (d) 글자 역할 on 층 5 ≥ 4.5 · 활성 면 on base · layer-1 · layer-2 ≥ 3 · 선택 체크 표시 ≥ 3 — 기본 preset 미달 = 부채 표", () => {
    const failures = (c: Record<string, string>, mode: string) => {
      const out: string[] = [];
      for (const role of TEXT_ROLES)
        for (const layer of LAYERS)
          if (!(ratio(c[role], c[layer]) >= 4.5))
            out.push(`${mode} ${role} on ${layer}`);
      for (const role of ACTIVE_SURFACES)
        for (const layer of ["base", "layer-1", "layer-2"])
          if (!(ratio(c[role], c[layer]) >= 3))
            out.push(`${mode} ${role} on ${layer}`);
      for (const face of ["selection-accent", "selection-accent-hover"])
        if (!(ratio(c["on-accent"], c[face]) >= 3))
          out.push(`${mode} on-accent × ${face}`);
      return out;
    };
    const base = snapshots.find((x) => x.preset.name === "blue/neutral")!.s;
    expect(
      MODES.flatMap((mode) => failures(base.colors[mode], mode)).sort(),
    ).toEqual([...DEFAULT_PRESET_RULE_DEBT].sort());
    const out: string[] = [];
    for (const { preset, s } of snapshots)
      for (const mode of MODES)
        for (const f of failures(s.colors[mode], mode))
          if (!DEFAULT_PRESET_RULE_DEBT.includes(f))
            out.push(`${preset.name} ${f}`);
    expect(out).toEqual([]);
  });

  it("(c) rule 전경 쌍 — 기본 preset 미달 목록 = 부채 표 · 그 밖의 쌍은 전 preset · 두 모드 ≥ 4.5", () => {
    const pairs = rulePaintPairs();
    expect(pairs.length).toBeGreaterThan(50);
    const base = snapshots.find((x) => x.preset.name === "blue/neutral")!.s;
    const debt = pairs
      .filter((p) =>
        MODES.some(
          (mode) =>
            !(ratio(base.colors[mode][p.fg], base.colors[mode][p.bg]) >= 4.5),
        ),
      )
      .map((p) => `${p.fg}|${p.bg}`)
      .sort();
    expect(debt).toEqual([...DEFAULT_PRESET_PAIR_DEBT].sort());
    const out: string[] = [];
    for (const p of pairs) {
      if (debt.includes(`${p.fg}|${p.bg}`)) continue;
      for (const { preset, s } of snapshots)
        for (const mode of MODES) {
          const r = ratio(s.colors[mode][p.fg], s.colors[mode][p.bg]);
          if (!(r >= 4.5))
            out.push(
              `${preset.name} ${mode} ${p.fg} × ${p.bg} ${r.toFixed(2)} (${p.where})`,
            );
        }
    }
    expect(out).toEqual([]);
  });

  it("(e) 배경 층 = 모드별 역할 → 단 매핑과 순서", () => {
    const out: string[] = [];
    const y = (hex: string | undefined) => relativeLuminance(hex ?? "");
    for (const { preset, s } of snapshots) {
      const l = s.colors.light;
      const d = s.colors.dark;
      if (!(
        y(l.pasteboard) < y(l["layer-1"]) &&
        y(l["layer-1"]) < y(l.base) &&
        l.base === l["layer-2"] &&
        l.base === l.elevated
      ))
        out.push(`${preset.name} light`);
      if (!(
        d.base === d.pasteboard &&
        y(d.base) < y(d["layer-1"]) &&
        y(d["layer-1"]) < y(d["layer-2"]) &&
        d["layer-2"] === d.elevated
      ))
        out.push(`${preset.name} dark`);
    }
    expect(out).toEqual([]);
  });

  it("(f) 상수가 아닌 역할은 light ≠ dark", () => {
    const out: string[] = [];
    for (const { preset, s } of snapshots)
      for (const [key, entry] of Object.entries(COLOR_ALIASES)) {
        if (entry.axis === "constant") continue;
        if (s.colors.light[key] === s.colors.dark[key])
          out.push(`${preset.name} ${key} ${s.colors.light[key]}`);
      }
    expect(out).toEqual([]);
  });
});

/**
 * ADR-220 고정 컨텍스트 스냅샷 하니스 — G0 baseline · G3 candidate 오라클
 * (`docs/adr/design/220-sample-data-package-and-rename-breakdown.md` §5).
 *
 * 생성 결과는 seed 만이 아니라 시계 (`startOfTodayUtc()` → birthDate · cardExpiry,
 * `now` 규칙) · TZ · locale · `t` 에 의존한다. 하니스가 다섯을 전부 고정하고 결과의
 * `context` 에 남긴다. 실행 출처 (`provenance`) 는 별도 보존하고 비교에서 제외한다.
 *
 *   ADR220_SNAPSHOT_ARM=baseline  TZ=UTC pnpm -F @composition/builder exec vitest run --config vitest.adr220.config.ts
 *   ADR220_SNAPSHOT_ARM=candidate TZ=UTC pnpm -F @composition/builder exec vitest run --config vitest.adr220.config.ts
 *
 * baseline 은 `docs/adr/evidence/220-p0-seed-snapshot.json` — 파일이 있으면 실패한다
 * (덮어쓰기 금지). candidate 는 `220-p2-seed-snapshot.json` 에 쓰고 baseline 과
 * `{ context, presets, rules }` 만 정규 직렬화해 byte-identical 을 검사한다. 비교 결과와
 * 양쪽 provenance 는 `220-g3-compare.json`.
 *
 * `harnessVersion` 은 생성·비교 **의미**의 버전이다 — 이동 전후 import 경로 / rename
 * 대응만으로 바꾸지 않는다 (하니스 파일 자체의 해시는 `provenance.harnessRevision`).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getAllPresets } from "../src/builder/panels/datatable/presets/dataTablePresets";
import {
  PRESET_STRINGS,
  resolvePresetTranslate,
} from "../src/builder/panels/datatable/presets/presetStrings";
import { GENERATE_RULE_TYPES } from "../src/services/ai/data/tableSpec";
import {
  createGenerators,
  generateRows,
  resolveSampleLocale,
  type SampleColumn,
} from "@composition/sample-data";

const HARNESS_VERSION = "1";
const CLOCK = "2026-09-16T00:00:00.000Z";
const SEED = "adr220";
const LOCALES = ["ko-KR", "en-US"] as const;
const PRESET_ROWS = 5;
const RULE_ROWS = 3;

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const EVIDENCE_DIR = resolve(REPO_ROOT, "docs/adr/evidence");
const BASELINE_PATH = resolve(EVIDENCE_DIR, "220-p0-seed-snapshot.json");
const CANDIDATE_PATH = resolve(EVIDENCE_DIR, "220-p2-seed-snapshot.json");
const COMPARE_PATH = resolve(EVIDENCE_DIR, "220-g3-compare.json");

const ARM = process.env.ADR220_SNAPSHOT_ARM;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 객체 키 재귀 정렬 · 배열 순서 유지 · Date → ISO · undefined 생략 (JSON 과 동일) */
function canonical(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value as object).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) continue;
      out[key] = canonical(item);
    }
    return out;
  }
  if (typeof value === "function") return `[function ${value.name}]`;
  return value as Json;
}

const serialize = (value: unknown) => JSON.stringify(canonical(value), null, 2);
const sha256 = (input: string | Buffer) =>
  createHash("sha256").update(input).digest("hex");

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** `t` 고정 — 번역 표 (문자열 + formatted 함수 소스) 의 해시. 바뀌면 context 가 달라 비교 무효. */
function translationFixtureVersion(): string {
  const table: Record<string, Record<string, string>> = {};
  for (const [locale, entries] of Object.entries(PRESET_STRINGS)) {
    table[locale] = {};
    for (const [key, value] of Object.entries(entries)) {
      table[locale][key] =
        typeof value === "function" ? `fn:${value.toString()}` : value;
    }
  }
  return sha256(serialize(table)).slice(0, 16);
}

function provenance() {
  const sourceHead = git("rev-parse", "HEAD");
  const dirty = git("status", "--porcelain");
  const diff = git("diff", "HEAD");
  return {
    sourceHead,
    sourceDirtyFiles: dirty ? dirty.split("\n").length : 0,
    sourceDiffSha256: sha256(diff),
    harnessRevision: sha256(readFileSync(import.meta.filename)).slice(0, 16),
    generatedAt: new Date().toISOString(),
  };
}

function buildSnapshot() {
  const presets: Record<string, Record<string, unknown[]>> = {};
  const rules: Record<string, Record<string, unknown[]>> = {};
  const ruleKinds = [...GENERATE_RULE_TYPES, "now"] as const;
  const allPresets = getAllPresets();

  for (const locale of LOCALES) {
    const t = resolvePresetTranslate(locale);
    const sampleLocale = resolveSampleLocale(t);
    for (const preset of allPresets) {
      // preset 경로는 제품 그대로 — refDate 는 가짜 시계의 `startOfTodayUtc()` 가 준다
      (presets[preset.id] ??= {})[locale] = preset.generateSampleData(
        PRESET_ROWS,
        t,
        { seed: SEED },
      );
    }
    for (const kind of ruleKinds) {
      const columns: SampleColumn[] = [{ key: "v", rule: { kind } }];
      const generated = generateRows(columns, {
        count: RULE_ROWS,
        seed: SEED,
        locale: sampleLocale,
        t,
        generators: createGenerators({
          seed: SEED,
          locale: sampleLocale,
          refDate: CLOCK,
        }),
      });
      (rules[kind] ??= {})[locale] = generated.rows.map((row) => row.v);
    }
  }

  return {
    context: {
      clock: CLOCK,
      refDate: CLOCK,
      tz: process.env.TZ ?? null,
      locales: [...LOCALES],
      seed: SEED,
      presetRows: PRESET_ROWS,
      ruleRows: RULE_ROWS,
      presetCount: allPresets.length,
      ruleKindCount: ruleKinds.length,
      translationFixtureVersion: translationFixtureVersion(),
      harnessVersion: HARNESS_VERSION,
    },
    presets,
    rules,
  };
}

type Snapshot = ReturnType<typeof buildSnapshot> & {
  provenance: ReturnType<typeof provenance>;
};

const comparable = (snapshot: Snapshot) =>
  serialize({
    context: snapshot.context,
    presets: snapshot.presets,
    rules: snapshot.rules,
  });

describe.runIf(ARM === "baseline" || ARM === "candidate")(
  `ADR-220 고정 컨텍스트 스냅샷 (${ARM})`,
  () => {
    beforeAll(() => {
      vi.useFakeTimers({ now: new Date(CLOCK) });
      vi.setSystemTime(new Date(CLOCK));
    });
    afterAll(() => {
      vi.useRealTimers();
    });

    it("TZ=UTC · 가짜 시계가 startOfTodayUtc 와 now 규칙을 잡는다", () => {
      expect(process.env.TZ).toBe("UTC");
      expect(new Date().toISOString()).toBe(CLOCK);
      expect(new Date().getTimezoneOffset()).toBe(0);
    });

    it("preset 28 · 규칙 54 + now 를 두 locale 로 생성한다", () => {
      const snapshot = buildSnapshot();
      expect(snapshot.context.presetCount).toBe(28);
      expect(snapshot.context.ruleKindCount).toBe(55);
      for (const preset of getAllPresets()) {
        for (const locale of LOCALES) {
          expect(snapshot.presets[preset.id][locale]).toHaveLength(PRESET_ROWS);
        }
      }
    });

    it("같은 context 로 두 번 만들면 byte-identical (하니스 자체 결정성)", () => {
      expect(serialize(buildSnapshot())).toBe(serialize(buildSnapshot()));
    });

    it.runIf(ARM === "baseline")(
      "baseline 기록 — 파일이 이미 있으면 실패 (덮어쓰기 금지)",
      () => {
        expect(
          existsSync(BASELINE_PATH),
          `baseline 이 이미 있다: ${BASELINE_PATH} — G0 baseline 은 보존한다`,
        ).toBe(false);
        const snapshot: Snapshot = {
          ...buildSnapshot(),
          provenance: provenance(),
        };
        mkdirSync(dirname(BASELINE_PATH), { recursive: true });
        writeFileSync(BASELINE_PATH, serialize(snapshot) + "\n");
      },
    );

    it.runIf(ARM === "candidate")(
      "candidate 기록 + baseline 과 { context, presets, rules } byte-identical",
      () => {
        expect(
          existsSync(BASELINE_PATH),
          `baseline 없음: ${BASELINE_PATH}`,
        ).toBe(true);
        const baseline = JSON.parse(
          readFileSync(BASELINE_PATH, "utf8"),
        ) as Snapshot;
        const candidate: Snapshot = {
          ...buildSnapshot(),
          provenance: provenance(),
        };
        writeFileSync(CANDIDATE_PATH, serialize(candidate) + "\n");

        const left = comparable(baseline);
        const right = comparable(candidate);
        const contextSame =
          serialize(baseline.context) === serialize(candidate.context);
        const result = {
          verdict: !contextSame
            ? "INVALID (context differs)"
            : left === right
              ? "PASS"
              : "FAIL (rows differ)",
          contextSame,
          identical: left === right,
          baselineSha256: sha256(left),
          candidateSha256: sha256(right),
          baselineProvenance: baseline.provenance,
          candidateProvenance: candidate.provenance,
          comparedAt: new Date().toISOString(),
        };
        writeFileSync(COMPARE_PATH, JSON.stringify(result, null, 2) + "\n");

        expect(contextSame, "context 가 다르면 비교 무효").toBe(true);
        expect(right).toBe(left);
      },
    );
  },
);

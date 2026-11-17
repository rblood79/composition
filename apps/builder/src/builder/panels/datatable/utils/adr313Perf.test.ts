/**
 * ADR-313 HC6 — 행 진입 시간 (Phase 0 기준선 · Phase 2 전후 비교). 기본 실행에서는 건너뛴다:
 *
 *   ADR313_PERF=<결과 json 경로> pnpm -F @composition/builder exec vitest run src/builder/panels/datatable/utils/adr313Perf.test.ts
 *
 * 1 만 행 × 20 열 응답 원문 (생성물 — 규모 전용, measurement-validity Q1). 두 응답을 잰다:
 * - `plain` — 값 표현이 필요 없는 응답 (변환 0 이 정답 — HC6 의 유리한 경우).
 * - `encoded` — 20 열 전부가 값 표현을 가진 응답 + 행마다 큰 정수 (불리한 경우 — breakdown §6.1 Q2).
 *
 * 지금 (Phase 0) 의 진입은 (c) · (d) 가 `JSON.parse` 만, (b) 가 `importPlanToOps` 다. Phase 2 는 같은 원문을
 * 큰 정수 보존 파싱 + 변환기로 재고, 판정은 카운트 (새 행 객체 수) 로 한다 — 시간은 방향만 (Q3).
 * 같은 기계에서 변경 전 · 후 빌드를 교대로 3 쌍 잰다. 수치는 커밋하지 않는다 — 기록은 breakdown §8.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { importPlanToOps, planImport } from "./importPlan";
import { normalizeRows } from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import { parseJsonLossless } from "../../../../../../../packages/shared/src/collections/intake/parseJsonLossless";
import type { FieldEncoding } from "../../../../../../../packages/shared/src/collections/intake/encoding";

const OUT = process.env.ADR313_PERF;
const ROWS = 10_000;
const RUNS = 15;

function plainRow(i: number): string {
  const cells: string[] = [];
  for (let c = 0; c < 20; c++) {
    if (c % 4 === 0) cells.push(`"n${c}": ${i * 7 + c}`);
    else if (c % 4 === 1) cells.push(`"s${c}": "name ${i % 97}"`);
    else if (c % 4 === 2) cells.push(`"b${c}": ${i % 2 === 0}`);
    else
      cells.push(`"d${c}": "2026-11-${String((i % 28) + 1).padStart(2, "0")}"`);
  }
  return `{${cells.join(", ")}}`;
}

function encodedRow(i: number): string {
  const cells: string[] = [`"ID": ${9007199254740993n + BigInt(i * 2)}`];
  for (let c = 1; c < 20; c++) {
    if (c % 4 === 0) cells.push(`"AMT${c}": "${i * 10 + c}.50"`);
    else if (c % 4 === 1) cells.push(`"YN${c}": "${i % 2 === 0 ? "Y" : "N"}"`);
    else if (c % 4 === 2)
      cells.push(`"DT${c}": "202611${String((i % 28) + 1).padStart(2, "0")}"`);
    else cells.push(`"TS${c}": ${1793928600000 + i * 1000}`);
  }
  return `{${cells.join(", ")}}`;
}

const text = (row: (i: number) => string) =>
  `[${Array.from({ length: ROWS }, (_, i) => row(i)).join(",\n")}]`;

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function time(run: () => unknown): number {
  run(); // (warm-up)
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return median(times);
}

/** The column's type and notation (the `plain` rows need none; the `encoded` rows' prefix names it). */
function fieldOf(name: string, key: string): { type: string; encoding?: FieldEncoding } {
  if (name === "plain")
    return { type: key.startsWith("n") ? "number" : key.startsWith("b") ? "boolean" : key.startsWith("d") ? "date" : "string" };
  if (key === "ID") return { type: "string", encoding: { kind: "bigInt" } };
  if (key.startsWith("AMT")) return { type: "number", encoding: { kind: "numberText" } };
  if (key.startsWith("YN")) return { type: "boolean", encoding: { kind: "flag", true: "Y", false: "N" } };
  if (key.startsWith("DT")) return { type: "date", encoding: { kind: "compactDate", wire: "string" } };
  return { type: "date", encoding: { kind: "epochMs", wire: "number" } };
}

describe.skipIf(!OUT)("ADR-313 HC6 — 진입 시간 기준선", () => {
  it("1 만 행 × 20 열 — JSON 파싱 (c · d) · 기존 표로 가져오기 (b)", () => {
    const result: Record<string, number> = {};
    for (const [name, row] of [
      ["plain", plainRow],
      ["encoded", encodedRow],
    ] as const) {
      const raw = text(row);
      const rows = JSON.parse(raw) as Record<string, unknown>[];
      expect(rows).toHaveLength(ROWS);
      result[`${name}.parse`] = time(() => JSON.parse(raw));
      const schema: DataField[] = Object.keys(rows[0]).map((key) => ({
        id: `f-${key}`,
        key,
        type: "string",
      }));
      const plan = planImport(rows, schema);
      result[`${name}.import`] = time(() =>
        importPlanToOps(plan, { collectionId: "c1", mode: "replace" }),
      );
      // ADR-313 Phase 2 — the standard entry: lossless parse + intake with the column schema
      // (plain = declared types only · encoded = every column declares its notation).
      const intakeSchema = Object.keys(rows[0]).map((key) => ({
        id: `f-${key}`,
        key,
        ...fieldOf(name, key),
      }));
      result[`${name}.losslessParse`] = time(() => parseJsonLossless(raw));
      const parsed = parseJsonLossless(raw) as Record<string, unknown>[];
      result[`${name}.intake`] = time(() => normalizeRows(parsed, intakeSchema, "json"));
      const { rows: out, report } = normalizeRows(parsed, intakeSchema, "json");
      result[`${name}.newRowObjects`] = out === parsed ? 0 : out.filter((row, i) => row !== parsed[i]).length;
      result[`${name}.changedCells`] = report.changedCells;
    }
    writeFileSync(
      OUT!,
      JSON.stringify({ rows: ROWS, runs: RUNS, medianMs: result }, null, 2),
    );
  });
});

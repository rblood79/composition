/**
 * 붙여넣은 텍스트 → 행 배열 — 규칙 파서 (ADR-213 Phase 5 `data.importPaste` · Phase 6 AI-2 의
 * 1차 경로). 모델을 부르지 않는다. 결과 행은 `detectColumns` → `columnsToSchema` 로
 * 스키마가 되고 `create_collection` / `insert_rows` proposal 로 승인 경로를 지난다.
 *
 * - JSON: 배열이면 그대로, 객체면 관례 키 안의 배열 (`resolveResponseData` — Track 0 과 같은 규칙)
 * - 표: 첫 줄 헤더. 탭이 있으면 탭, 없으면 쉼표 (따옴표 감싼 값 안의 쉼표 보존).
 *   숫자 · true/false 는 형변환, 빈 칸은 null — `detectColumns` 가 타입을 추론한다.
 */
import { resolveResponseData } from "../../../../utils/data/responseData";

export type PastedRowsParseReason =
  | "empty"
  | "not-tabular"
  | "no-rows"
  | "rows-not-objects";

export type PastedRowsParseResult =
  | { ok: true; format: "json" | "table"; rows: Record<string, unknown>[] }
  | { ok: false; reason: PastedRowsParseReason };

function isRowObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsResult(
  format: "json" | "table",
  rows: unknown[],
): PastedRowsParseResult {
  if (rows.length === 0) return { ok: false, reason: "no-rows" };
  if (!rows.every(isRowObject))
    return { ok: false, reason: "rows-not-objects" };
  return { ok: true, format, rows };
}

function parseJson(text: string): PastedRowsParseResult | null {
  const head = text[0];
  if (head !== "[" && head !== "{") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const { data } = resolveResponseData(parsed, "");
  if (!Array.isArray(data)) return { ok: false, reason: "no-rows" };
  return rowsResult("json", data);
}

/** 쉼표 구분 한 줄 — 큰따옴표로 감싼 값 안의 쉼표 · `""` 이스케이프 보존 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else quoted = false;
      } else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells;
}

function coerceCell(raw: string): unknown {
  const value = raw.trim();
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseTable(text: string): PastedRowsParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { ok: false, reason: "empty" };
  const tab = lines[0].includes("\t");
  const split = tab
    ? (line: string) => line.split("\t")
    : (line: string) => splitCsvLine(line);
  const header = split(lines[0]).map((h) => h.trim());
  if (header.length < 2 || header.some((h) => h === ""))
    return { ok: false, reason: "not-tabular" };
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, unknown> = {};
    header.forEach((key, i) => {
      row[key] = coerceCell(cells[i] ?? "");
    });
    return row;
  });
  return rowsResult("table", rows);
}

export function parsePastedRows(text: string): PastedRowsParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  return parseJson(trimmed) ?? parseTable(trimmed);
}

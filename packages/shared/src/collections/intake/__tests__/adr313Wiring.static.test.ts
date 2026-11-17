/**
 * ADR-313 G2 (R2 · HC4 · Q4) — 진입 · 출구 연결의 정적 검사. 진입 경로가 응답 · 붙여넣기 원문을 직접
 * `JSON.parse` · `response.json()` 하지 않고 (큰 정수 보존 파싱 → 변환기), 출구 목록 전부가 되돌리기를 지난다.
 * 새 진입 · 출구를 만들면 이 목록에 넣는다 — 목록 밖에서 서버로 값을 보내는 길은 리뷰가 막는다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../../../..");
const read = (path: string) =>
  readFileSync(resolve(ROOT, path), "utf8")
    // (주석은 세지 않는다.)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** 진입 — 원문 → 행. 각 파일이 부르는 큰 정수 보존 파싱 · 변환기. */
const ENTRIES: Array<{ path: string; calls: string[]; allowParse?: RegExp[] }> =
  [
    {
      path: "apps/builder/src/builder/panels/datatable/utils/pasteRows.ts",
      calls: ["parseJsonLossless("],
    },
    {
      path: "apps/builder/src/builder/panels/datatable/editors/DataTableCreator.tsx",
      calls: ["intakeRows(", "detectColumns(importedSource.rows, importedSource.source)"],
    },
    {
      path: "apps/builder/src/builder/panels/datatable/utils/importPlan.ts",
      calls: ["intakeRows("],
    },
    {
      path: "apps/builder/src/builder/stores/utils/dataActions.ts",
      calls: ["parseJsonLossless(", "intakeQueryItems("],
    },
    {
      path: "packages/shared/src/collections/executeCollectionEndpoint.ts",
      calls: ["parseJsonLossless(", "intakeQueryItems("],
      // (endpoint 의 body 템플릿 — 작성자가 쓴 글자, 응답이 아니다.)
      allowParse: [/JSON\.parse\(endpoint\.bodyTemplate\)/],
    },
    {
      path: "packages/shared/src/catalog/runtime/catalogPreviewSession.ts",
      calls: ["intakeQueryItems(", "normalizeRows("],
    },
    {
      path: "apps/builder/src/builder/panels/datatable/editors/ApiEndpointEditor.tsx",
      calls: ["parseJsonLossless("],
    },
    {
      path: "apps/builder/src/services/ai/data/pasteProposal.ts",
      calls: ["intakeRows("],
    },
    {
      path: "apps/builder/src/builder/panels/datatable/grid/cellValue.ts",
      calls: ["readTextCell(", "readEncodedText("],
    },
  ];

/** 출구 — 저장 값 → 서버. 각 파일이 부르는 되돌리기. */
const EXITS: Array<{ path: string; calls: string[]; forbid: RegExp[] }> = [
  {
    path: "packages/shared/src/collections/view/serialize.ts",
    calls: ["fieldText(read.fields[0]", "fieldJson(read.fields[0]"],
    // (조건 값을 되돌리기 없이 쿼리에 싣는 옛 모양.)
    forbid: [/params\.push\(\[[^\]]*,\s*text\(/],
  },
  {
    path: "packages/shared/src/collections/executeCollectionEndpoint.ts",
    calls: ["stringifyJsonLossless(", "outgoingRecord("],
    // (body 를 큰 정수 보존 없이 쓰는 옛 모양.)
    forbid: [/JSON\.stringify\(body\)/, /JSON\.stringify\(base/],
  },
];

describe("ADR-313 G2 — 진입 · 출구 연결 (정적)", () => {
  for (const { path, calls, allowParse = [] } of ENTRIES)
    it(`진입 ${path.split("/").pop()}`, () => {
      const source = read(path);
      for (const call of calls) expect(source, call).toContain(call);
      expect(source).not.toMatch(/\.json\(\)/);
      const parses = source.match(/JSON\.parse\([^)]*\)/g) ?? [];
      for (const parse of parses)
        expect(
          allowParse.some((allowed) => allowed.test(parse)),
          parse,
        ).toBe(true);
    });

  for (const { path, calls, forbid } of EXITS)
    it(`출구 ${path.split("/").pop()}`, () => {
      const source = read(path);
      for (const call of calls) expect(source, call).toContain(call);
      for (const pattern of forbid) expect(source).not.toMatch(pattern);
    });

  it("intake 모듈은 collections barrel 로 내보내지 않는다 (Preview initial — ADR-284 Phase 2 선례)", () => {
    expect(read("packages/shared/src/collections/index.ts")).not.toMatch(
      /intake/,
    );
  });

  it("intake 모듈은 네트워크를 쓰지 않는다 (HC1)", () => {
    for (const file of [
      "encoding.ts",
      "normalizeRows.ts",
      "parseJsonLossless.ts",
      "outgoing.ts",
    ]) {
      const source = read(`packages/shared/src/collections/intake/${file}`);
      expect(source, file).not.toMatch(
        /\bfetch\(|XMLHttpRequest|WebSocket|import\(/,
      );
    }
  });
});

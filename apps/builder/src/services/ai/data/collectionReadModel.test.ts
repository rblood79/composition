/**
 * ADR-213 Phase 1 — collection 요약 read model + 프롬프트 주입 예산 (HC3 · R5 · G1).
 *
 * 50×80 worst-case (Phase 0 before arm): ASCII 5,699 B 는 절단 없이 들어가고, 한글
 * 13,699 B 는 8,192 B 안에 29개만 들어간다 — byte 상한은 절단 + "더 있음 N" 으로 집행.
 */
import { describe, expect, it } from "vitest";
import { localizedStrings } from "@/i18n/translations";
import type { DataTable } from "../../../types/builder/data.types";
import type { PromptTranslate } from "../promptTranslate";
import {
  buildCollectionsSection,
  COLLECTION_INJECTION_MAX_BYTES,
  COLLECTION_INJECTION_MAX_ITEMS,
  COLLECTION_INJECTION_MAX_TOKENS,
  COLLECTION_NAME_MAX_CODE_POINTS,
  estimatePromptTokens,
  resolveCollectionUsage,
  summarizeCollections,
  truncateCodePoints,
} from "./collectionReadModel";

const t: PromptTranslate = (key, params) => {
  if (key === "aiPrompt.collectionsHeading") return "## 사용 가능한 collection";
  if (key === "aiPrompt.collectionsLine")
    return `- ${params?.name} (${params?.fieldCount} 필드 · ${params?.rowCount} 행 · ${params?.source})`;
  if (key === "aiPrompt.collectionsMore") return `… 더 있음 ${params?.count}`;
  if (key === "aiPrompt.collectionsNone") return "(없음)";
  return key;
};

function table(
  i: number,
  name: string,
  extra: Partial<DataTable> = {},
): DataTable {
  return {
    id: `c${i}`,
    name,
    project_id: "p1",
    schema: Array.from({ length: 12 }, (_, k) => ({
      id: `f${k}`,
      key: `k${k}`,
      type: "string",
    })),
    mockData: Array.from({ length: 1200 }, () => ({})),
    useMockData: true,
    ...extra,
  };
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("summarizeCollections · resolveCollectionUsage", () => {
  it("행 수는 useMockData 에 따라 mockData / runtimeData 를 따르고 source 는 manual/api 다", () => {
    const manual = table(1, "users");
    const api = table(2, "orders", {
      useMockData: false,
      runtimeData: [{}, {}, {}],
    });
    const out = summarizeCollections([manual, api], new Map());
    expect(out).toEqual([
      {
        id: "c1",
        name: "users",
        fieldCount: 12,
        rowCount: 1200,
        source: "manual",
        usedBy: 0,
      },
      {
        id: "c2",
        name: "orders",
        fieldCount: 12,
        rowCount: 3,
        source: "api",
        usedBy: 0,
      },
    ]);
  });

  it("usedBy 는 요소의 dataBinding (props 또는 extension) 이 id 우선 · name fallback 으로 잇는 수다", () => {
    const users = table(1, "users");
    const usage = resolveCollectionUsage(
      [
        {
          id: "e1",
          props: { dataBinding: { source: "dataTable", collectionId: "c1" } },
        },
        {
          id: "e2",
          props: { dataBinding: { source: "dataTable", name: "users" } },
        },
        {
          id: "e3",
          dataBinding: { type: "collection", source: "static", config: {} },
        },
        { id: "e4", props: {} },
      ],
      [users],
    );
    expect(usage.get("c1")).toBe(2);
  });
});

describe("truncateCodePoints", () => {
  it("code point 단위로 자른다 (서로게이트 쌍을 반으로 가르지 않는다)", () => {
    expect(truncateCodePoints("😀".repeat(100), 80)).toBe("😀".repeat(80));
    expect(truncateCodePoints("abc", 80)).toBe("abc");
  });
});

describe("buildCollectionsSection — 예산", () => {
  it("ASCII 50×80 은 절단 없이 50개 전부, UTF-8 ≤ 8,192 bytes", () => {
    const summaries = summarizeCollections(
      Array.from({ length: 50 }, (_, i) => table(i, "a".repeat(80))),
      new Map(),
    );
    const section = buildCollectionsSection(summaries, t);
    expect(
      section.text.split("\n").filter((l) => l.startsWith("- ")).length,
    ).toBe(50);
    expect(section.omitted).toBe(0);
    expect(bytes(section.text)).toBeLessThanOrEqual(
      COLLECTION_INJECTION_MAX_BYTES,
    );
  });

  it("한글 50×80 은 8,192 bytes 안에서 절단되고 '더 있음 N' 을 붙인다", () => {
    const summaries = summarizeCollections(
      Array.from({ length: 50 }, (_, i) => table(i, "가".repeat(80))),
      new Map(),
    );
    const section = buildCollectionsSection(summaries, t);
    const listed = section.text
      .split("\n")
      .filter((l) => l.startsWith("- ")).length;
    expect(listed).toBeLessThan(50);
    expect(listed).toBeGreaterThan(0);
    expect(section.omitted).toBe(50 - listed);
    expect(section.text).toContain(`더 있음 ${50 - listed}`);
    expect(bytes(section.text)).toBeLessThanOrEqual(
      COLLECTION_INJECTION_MAX_BYTES,
    );
  });

  it("51개 이상은 목록 상한 50 에서 자르고, 이름은 80 code point 로 자른다", () => {
    const summaries = summarizeCollections(
      Array.from({ length: 60 }, (_, i) =>
        table(i, `t${i}-${"x".repeat(120)}`),
      ),
      new Map(),
    );
    const section = buildCollectionsSection(summaries, t);
    const lines = section.text.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBe(COLLECTION_INJECTION_MAX_ITEMS);
    expect(section.omitted).toBe(10);
    for (const line of lines) {
      const name = line.slice(2, line.indexOf(" ("));
      expect([...name].length).toBeLessThanOrEqual(
        COLLECTION_NAME_MAX_CODE_POINTS,
      );
    }
  });

  it("token 추정 상한 — 한글 50×80 은 byte 보다 token 이 먼저 걸려 더 줄어든다 (qwen3 실측 8,013 B = 2,750 tok)", () => {
    const summaries = summarizeCollections(
      Array.from({ length: 50 }, (_, i) => table(i, "가".repeat(80))),
      new Map(),
    );
    const byteOnly = buildCollectionsSection(summaries, t, {
      maxTokens: Number.POSITIVE_INFINITY,
    });
    const both = buildCollectionsSection(summaries, t);
    expect(estimatePromptTokens(byteOnly.text)).toBeGreaterThan(
      COLLECTION_INJECTION_MAX_TOKENS,
    );
    expect(estimatePromptTokens(both.text)).toBeLessThanOrEqual(
      COLLECTION_INJECTION_MAX_TOKENS,
    );
    expect(both.omitted).toBeGreaterThan(byteOnly.omitted);
  });

  it("estimatePromptTokens 는 qwen3 실측을 밑돌지 않는다 (calibration 고정)", () => {
    // 2026-09-11 Ollama qwen3:14b prompt_eval_count 차분
    expect(estimatePromptTokens("a".repeat(80))).toBeGreaterThanOrEqual(10);
    expect(estimatePromptTokens("가".repeat(80))).toBeGreaterThanOrEqual(80);
    expect(estimatePromptTokens("😀".repeat(80))).toBeGreaterThanOrEqual(80);
    expect(
      estimatePromptTokens("(12 필드 · 1200 행 · api)\n".repeat(10)),
    ).toBeGreaterThanOrEqual(150);
    expect(
      estimatePromptTokens(
        "customer_orders_2026_q3_archive_table_with_a_very_long_snake_case_name_here_ok",
      ),
    ).toBeGreaterThanOrEqual(22);
  });

  it("실제 사전 (ko · en) 으로 렌더하면 placeholder 가 남지 않는다 — 2026-09-11 live 에서 `{name}` 이 그대로 모델에 갔다", () => {
    for (const locale of ["ko-KR", "en-US"] as const) {
      const real: PromptTranslate = (key, params) => {
        const message = localizedStrings[locale][key];
        if (typeof message === "function") return message(params);
        return message ?? key;
      };
      const section = buildCollectionsSection(
        summarizeCollections(
          Array.from({ length: 60 }, (_, i) => table(i, "가".repeat(80))),
          new Map(),
        ),
        real,
      );
      expect(section.text).not.toMatch(/\{(name|fieldCount|rowCount|source|count)\}/);
      expect(section.text).toContain("가".repeat(80));
      expect(section.text).toMatch(/\b12\b/);
    }
  });

  it("collection 이 없으면 '(없음)' 한 줄", () => {
    expect(buildCollectionsSection([], t).text).toContain("(없음)");
  });
});

/**
 * ADR-313 Phase 1 (G1 · contract 70) — 필드의 값 표현 `encoding` · collection 의 `keyField` 저장 계약.
 *
 * - 69 이하 문서는 거부된다 (변환 없음 — HC2).
 * - entry 검증이 `encoding` · `keyField` 를 받고, 모르는 종류 · 타입과 맞지 않는 종류 · 없는 key 필드를 거절한다.
 */
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import { createG1Fixture } from "../../document/fixture";
import { CatalogGraph } from "../../document/graph";
import {
  LIBRARY_CONTRACT_VERSION,
  type CatalogDocument,
  type CollectionEntry,
} from "../../document/types";
import { setDataEntries } from "../data";
import { code, graphOf, run, text } from "./fixture";

const users = (patch: Partial<CollectionEntry>): CollectionEntry => ({
  kind: "collection",
  id: "data:collection:users",
  name: "users",
  schema: [
    {
      id: "f-id",
      key: "USER_ID",
      type: "string",
      encoding: { kind: "bigInt" },
    },
    {
      id: "f-use",
      key: "USE_YN",
      type: "boolean",
      encoding: { kind: "flag", true: "Y", false: "N" },
    },
    {
      id: "f-join",
      key: "JOIN_DT",
      type: "date",
      encoding: { kind: "compactDate", wire: "string" },
    },
    { id: "f-total", key: "total", type: "number", formula: "1" },
  ],
  mockData: [
    { USER_ID: "9007199254740993", USE_YN: true, JOIN_DT: "2026-11-06" },
  ],
  useMockData: true,
  ...patch,
});

const put = (entry: CollectionEntry) => {
  const graph = graphOf([text("a", "A")], ["a"]);
  return code(() => run(graph, setDataEntries({ puts: [entry] })));
};

describe("ADR-313 Phase 1 — 데이터 저장 계약 (contract 70)", () => {
  it("contract 70 — 69 문서는 거부된다", async () => {
    expect(LIBRARY_CONTRACT_VERSION).toBe(70);
    const library = await buildCodeCatalogLibrary();
    const { document } = createG1Fixture();
    let failure: unknown;
    try {
      new CatalogGraph(
        {
          ...document,
          libraryContractVersion: 69,
        } as unknown as CatalogDocument,
        library,
      );
    } catch (error) {
      failure = error;
    }
    expect((failure as { code?: string })?.code).toBe(
      "UNSUPPORTED_LIBRARY_CONTRACT",
    );
  });

  it("값 표현 · key 필드를 받는다", () => {
    expect(put(users({ keyField: "f-id" }))).toBe("ACCEPTED");
  });

  it("모르는 종류 · 모르는 인자 · 타입과 맞지 않는 종류를 거절한다", () => {
    const withEncoding = (encoding: unknown, type = "date") =>
      users({
        schema: [
          {
            id: "f-x",
            key: "x",
            type,
            encoding,
          } as CollectionEntry["schema"][number],
        ],
        mockData: [],
      });
    expect(put(withEncoding({ kind: "yyyyMMdd" }))).toBe(
      "INVALID_FIELD_ENCODING",
    );
    expect(
      put(
        withEncoding({ kind: "compactDate", wire: "string", pattern: "yyyy" }),
      ),
    ).toBe("INVALID_FIELD_ENCODING");
    expect(
      put(withEncoding({ kind: "flag", true: "Y", false: "N" }, "number")),
    ).toBe("FIELD_ENCODING_TYPE_MISMATCH");
  });

  it("key 필드는 그 collection 의 작성 필드 id 다 — 없는 id · 계산 필드는 거절", () => {
    expect(put(users({ keyField: "f-missing" }))).toBe("KEY_FIELD_MISSING");
    expect(put(users({ keyField: "USER_ID" }))).toBe("KEY_FIELD_MISSING"); // (key 이름이 아니라 id)
    expect(put(users({ keyField: "f-total" }))).toBe("KEY_FIELD_MISSING");
  });
});

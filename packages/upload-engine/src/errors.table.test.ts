/**
 * 에러 코드 표 ↔ `errors.json` 동일성 (계약 문서 3자 대조용 덤프).
 * 갱신: `UPDATE_ERRORS_JSON=1 pnpm -F @composition/upload test src/errors.table.test.ts`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ERROR_DESCRIPTIONS,
  ERROR_TABLE,
  codeOfStatus,
  errorOfResponse,
  statusOf,
} from "./errors";

const JSON_PATH = join(import.meta.dirname, "..", "errors.json");

describe("R1 에러 코드 표 — 단일 소스", () => {
  it("errors.json 은 ERROR_TABLE 의 덤프와 같다", () => {
    const merged = Object.fromEntries(
      Object.entries(ERROR_TABLE).map(([code, spec]) => [
        code,
        {
          ...spec,
          description: ERROR_DESCRIPTIONS[code as keyof typeof ERROR_TABLE],
        },
      ]),
    );
    const dump = JSON.stringify(merged, null, 2) + "\n";
    if (process.env.UPDATE_ERRORS_JSON) writeFileSync(JSON_PATH, dump);
    // 포맷터가 배열을 한 줄로 접을 수 있어 문자열이 아니라 값으로 비교
    expect(JSON.parse(readFileSync(JSON_PATH, "utf8"))).toEqual(
      JSON.parse(dump),
    );
  });

  it("R1 8종 + 보조 3종이 전부 있고 status 는 코드 간 겹치지 않는다", () => {
    expect(Object.keys(ERROR_TABLE).sort()).toEqual(
      [
        "E_PATCH_BLOCKED",
        "E_PROXY_TIMEOUT",
        "E_OFFSET_MISMATCH",
        "E_TOO_LARGE",
        "E_NETWORK",
        "E_UNAUTHORIZED",
        "E_EXPIRED",
        "E_CHECKSUM",
        "E_REJECTED",
        "E_SERVER",
        "E_CANCELLED",
      ].sort(),
    );
    const seen = new Map<number, string>();
    for (const [code, spec] of Object.entries(ERROR_TABLE)) {
      for (const s of spec.status) {
        expect(
          seen.get(s),
          `status ${s} 중복 (${seen.get(s)} vs ${code})`,
        ).toBeUndefined();
        seen.set(s, code);
      }
    }
  });

  it("status → 코드 · 코드 → 대표 status 왕복", () => {
    expect(codeOfStatus(409)).toBe("E_OFFSET_MISMATCH");
    expect(codeOfStatus(405)).toBe("E_PATCH_BLOCKED");
    expect(codeOfStatus(504)).toBe("E_PROXY_TIMEOUT");
    expect(codeOfStatus(413)).toBe("E_TOO_LARGE");
    expect(codeOfStatus(403)).toBe("E_UNAUTHORIZED");
    expect(codeOfStatus(410)).toBe("E_EXPIRED");
    expect(codeOfStatus(460)).toBe("E_CHECKSUM");
    expect(codeOfStatus(0)).toBe("E_NETWORK");
    expect(codeOfStatus(418)).toBe("E_REJECTED");
    expect(codeOfStatus(599)).toBe("E_SERVER");
    expect(statusOf("E_OFFSET_MISMATCH")).toBe(409);
    expect(statusOf("E_EXPIRED")).toBe(410);
  });

  it("create (url 없음) 의 404 는 만료가 아니라 거부", () => {
    expect(errorOfResponse(404, "", false).code).toBe("E_REJECTED");
    expect(errorOfResponse(404, "", true).code).toBe("E_EXPIRED");
    expect(errorOfResponse(500, "boom", true)).toEqual({
      code: "E_SERVER",
      status: 500,
      message: "boom",
      retryable: true,
    });
  });
});

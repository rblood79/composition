/**
 * ADR-313 G5 — 내보낸 JSON Schema 를 다른 구현 (zod `fromJSONSchema`, 설치본 4.6.7 — R9: 제품 코드에는 쓰지 않고
 * 검사의 독립 구현으로만) 으로 읽어, 정답표의 저장 값 행은 통과하고 어긋난 행은 탈락하는지 본다. 기대 값은 손으로
 * 쓴 정답표 (`SPRING_ANSWERS`) 다.
 */
import { describe, expect, it } from "vitest";
import { fromJSONSchema } from "zod";
import {
  SPRING_ANSWERS,
} from "../../../../../../../packages/shared/src/collections/intake/__tests__/fixtures/springSamples";
import type { DataField } from "../../../../types/builder/data.types";
import { fieldsToJsonSchema } from "./fieldsToJsonSchema";

const schema: DataField[] = SPRING_ANSWERS.map((answer) => ({
  id: `f-${answer.key}`,
  key: answer.key,
  type: answer.type,
  ...(answer.format ? { format: answer.format } : {}),
  ...(answer.encoding ? { encoding: answer.encoding as DataField["encoding"] } : {}),
  ...(answer.key === "USER_NM" ? { required: true } : {}),
}));
const table = { name: "users", schema, keyField: "f-USER_ID" };
const rows = [0, 1, 2].map((index) =>
  Object.fromEntries(SPRING_ANSWERS.map((answer) => [answer.key, answer.stored[index]])),
);

describe("ADR-313 G5 — JSON Schema 내보내기", () => {
  const exported = fieldsToJsonSchema(table);

  it("모양 — 2020-12 · 필수 = required + key 필드 · null 허용 · date 는 format 없음 · 주석", () => {
    expect(exported.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(exported.required).toEqual(["USER_ID", "USER_NM"]);
    const props = exported.properties as Record<string, Record<string, unknown>>;
    expect(props.USER_ID).toMatchObject({ type: "string", "x-composition-encoding": { kind: "bigInt" } });
    expect(props.USE_YN).toMatchObject({ type: ["boolean", "null"], "x-composition-encoding": { kind: "flag", true: "Y", false: "N" } });
    expect(props.UPD_TS).toMatchObject({ type: ["string", "null"], "x-composition-type": "date" });
    expect(props.UPD_TS.format).toBeUndefined();
    expect(props.email.format).toBe("email");
    expect(exported["x-composition-key"]).toBe("f-USER_ID");
    expect(Object.values(props).map((p) => p["x-composition-order"])).toEqual(SPRING_ANSWERS.map((_, i) => i));
  });

  it("독립 구현이 정답표의 저장 값 행을 받는다", () => {
    const validator = fromJSONSchema(exported as never);
    for (const row of rows) expect(validator.safeParse(row).success, JSON.stringify(row)).toBe(true);
  });

  it("어긋난 행은 탈락한다 — 원본 표기 · 빈 key · 타입이 다른 값", () => {
    const validator = fromJSONSchema(exported as never);
    const bad = [
      { ...rows[0], USE_YN: "Y" }, // 원본 표기 (저장 값이 아님)
      { ...rows[0], SALARY_AMT: "4500000.00" },
      { ...rows[0], USER_ID: null }, // key 필드는 비울 수 없다
      { ...rows[0], USER_NM: undefined }, // 필수 누락
      { ...rows[0], DEPT_ID: "10" },
    ].map((row) => JSON.parse(JSON.stringify(row)));
    for (const row of bad) expect(validator.safeParse(row).success, JSON.stringify(row)).toBe(false);
  });

  it("계산 필드 = readOnly · 객체 · 배열 children", () => {
    const out = fieldsToJsonSchema({
      name: "t",
      schema: [
        { id: "f-a", key: "a", type: "number", formula: "1" },
        { id: "f-o", key: "o", type: "object", children: [{ key: "x", type: "string", required: true }] },
        { id: "f-l", key: "l", type: "array", children: [{ key: "y", type: "number" }] },
      ],
    });
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.a.readOnly).toBe(true);
    expect(props.o).toMatchObject({ properties: { x: { type: "string" } }, required: ["x"] });
    expect(props.l).toMatchObject({ type: ["array", "null"], items: { type: "object", properties: { y: { type: ["number", "null"] } } } });
  });
});

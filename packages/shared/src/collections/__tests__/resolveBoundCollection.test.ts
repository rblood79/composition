/**
 * ADR-152 Phase 1 — `resolveBoundCollection` / `resolveField` 단일 resolve 헬퍼.
 *
 * 바인딩 계약 v2 (`collectionId` 안정 참조 + `name` v1 fallback) 의 3분기와,
 * `DataField.id` (v2.1) 참조의 id 우선 · key fallback 을 고정한다. DOM wrapper
 * (`useCollectionData` / `readDataBindingRows`) 와 Skia projector 가 같은 함수를
 * 지나므로 이 계약이 양쪽 대칭의 SSOT 다.
 */
import { describe, expect, it } from "vitest";
import {
  resolveBoundCollection,
  resolveCollectionByName,
  resolveField,
} from "../resolveBoundCollection";

const users = { id: "c-users", name: "Users" };
const roles = { id: "c-roles", name: "Roles" };
const collections = [users, roles];

describe("resolveBoundCollection — id 우선 · name fallback", () => {
  it("collectionId 매치가 name 보다 우선한다 (rename 뒤에도 id 로 찾는다)", () => {
    expect(
      resolveBoundCollection(
        { source: "dataTable", collectionId: "c-roles", name: "Users" },
        collections,
      ),
    ).toBe(roles);
  });

  it("collectionId 가 없으면 name 으로 찾는다 (v1 바인딩)", () => {
    expect(
      resolveBoundCollection(
        { source: "dataTable", name: "Roles" },
        collections,
      ),
    ).toBe(roles);
  });

  it("name 에 id 가 실린 구 형식 (import envelope 재연결) 도 찾는다", () => {
    expect(
      resolveBoundCollection(
        { source: "dataTable", name: "c-users" },
        collections,
      ),
    ).toBe(users);
  });

  it("collectionId 가 stale 이면 name fallback 으로 내려간다", () => {
    expect(
      resolveBoundCollection(
        { source: "dataTable", collectionId: "gone", name: "Users" },
        collections,
      ),
    ).toBe(users);
  });

  it("둘 다 실패 → null · 비-record 입력 → null", () => {
    expect(
      resolveBoundCollection(
        { source: "dataTable", name: "Nope" },
        collections,
      ),
    ).toBeNull();
    expect(resolveBoundCollection(undefined, collections)).toBeNull();
    expect(resolveBoundCollection("Users", collections)).toBeNull();
  });

  it("resolveCollectionByName 은 이름 → 항목 (import envelope · legacy 액션용)", () => {
    expect(resolveCollectionByName("Roles", collections)).toBe(roles);
    expect(resolveCollectionByName("c-roles", collections)).toBe(roles);
    expect(resolveCollectionByName("x", collections)).toBeNull();
  });
});

describe("resolveField — id 우선 · key fallback", () => {
  const schema = [
    { id: "f1", key: "name", type: "string" },
    { id: "f2", key: "email", type: "string" },
    { key: "legacy", type: "string" },
  ];

  it("id 매치 우선", () => {
    expect(resolveField(schema, "f2")).toBe(schema[1]);
  });

  it("id 가 없거나 매치 실패면 key 매치 (v1 · id 없는 구 필드)", () => {
    expect(resolveField(schema, "name")).toBe(schema[0]);
    expect(resolveField(schema, "legacy")).toBe(schema[2]);
  });

  it("둘 다 실패 → null · 빈 ref → null", () => {
    expect(resolveField(schema, "nope")).toBeNull();
    expect(resolveField(schema, "")).toBeNull();
    expect(resolveField(undefined, "name")).toBeNull();
  });
});

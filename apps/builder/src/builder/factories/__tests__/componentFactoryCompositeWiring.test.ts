import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * ADR-144 Wave A wiring 보강 — `ComponentFactory` 가 4 family composite factory
 * 를 호출하는지 검증.
 *
 * 사용자 raise (2026-05-22): "Tabs/4 family 등록해도 변화 없다" → 조사 결과,
 * `ComponentFactory.createSelect/createComboBox/createListBox/createMenu` 가
 * 여전히 legacy `createSelectDefinition` 등 `props.items[]` factory 를 호출
 * (line 359/365/428/448). Tabs (line 395) 만 `createTabsCompositeElements` 사용.
 *
 * 기존 `collectionCompositeFactories.test.ts` 는 함수 export 와 payload shape
 * 만 검증, `ComponentFactory` 호출 wiring 미검증 → 본 test 가 그 갭을 보강.
 *
 * RED → GREEN 검증 패턴: source-string 으로 ComponentFactory body 에
 * `createXxxCompositeElements` 호출이 있는지 확인. behavior test 는 store
 * mutation side-effect 가 무거워 별도 layer 에서 cover.
 */

const FACTORY_PATH = resolve(__dirname, "..", "ComponentFactory.ts");

describe("ADR-144 ComponentFactory composite wiring contract", () => {
  it("imports composite factory helpers for all 5 families (Tabs + 4 family)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    expect(source).toContain("createTabsCompositeElements");
    expect(source).toContain("createSelectCompositeElements");
    expect(source).toContain("createComboBoxCompositeElements");
    expect(source).toContain("createListBoxCompositeElements");
    expect(source).toContain("createMenuCompositeElements");
  });

  it("`createTabs` calls `createTabsCompositeElements` (already wired pre-Wave-A-fix)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    const createTabsIndex = source.indexOf("private static async createTabs(");
    expect(createTabsIndex).toBeGreaterThan(-1);
    const createTabsBody = source.slice(
      createTabsIndex,
      createTabsIndex + 2000,
    );

    expect(createTabsBody).toContain("createTabsCompositeElements");
    expect(createTabsBody).toContain("addElementsToStore");
  });

  it("`createSelect` calls `createSelectCompositeElements` (composite, not legacy `createSelectDefinition`)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    const createSelectIndex = source.indexOf(
      "private static async createSelect(",
    );
    expect(createSelectIndex).toBeGreaterThan(-1);
    const createSelectBody = source.slice(
      createSelectIndex,
      createSelectIndex + 2000,
    );

    expect(createSelectBody).toContain("createSelectCompositeElements");
    expect(createSelectBody).toContain("addElementsToStore");
    // legacy `this.createComponent(createSelectDefinition, ...)` 단일 호출 패턴은 제거됨.
    expect(createSelectBody).not.toContain(
      "this.createComponent(createSelectDefinition",
    );
  });

  it("`createComboBox` calls `createComboBoxCompositeElements` (composite, not legacy `createComboBoxDefinition`)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    const createIndex = source.indexOf("private static async createComboBox(");
    expect(createIndex).toBeGreaterThan(-1);
    const body = source.slice(createIndex, createIndex + 2000);

    expect(body).toContain("createComboBoxCompositeElements");
    expect(body).toContain("addElementsToStore");
    expect(body).not.toContain("this.createComponent(createComboBoxDefinition");
  });

  it("`createListBox` calls `createListBoxCompositeElements` (composite, not legacy `createListBoxDefinition`)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    const createIndex = source.indexOf("private static async createListBox(");
    expect(createIndex).toBeGreaterThan(-1);
    const body = source.slice(createIndex, createIndex + 2000);

    expect(body).toContain("createListBoxCompositeElements");
    expect(body).toContain("addElementsToStore");
    expect(body).not.toContain("this.createComponent(createListBoxDefinition");
  });

  it("`createMenu` calls `createMenuCompositeElements` (composite, not legacy `createMenuDefinition`)", async () => {
    const source = await readFile(FACTORY_PATH, "utf-8");

    const createIndex = source.indexOf("private static async createMenu(");
    expect(createIndex).toBeGreaterThan(-1);
    const body = source.slice(createIndex, createIndex + 2000);

    expect(body).toContain("createMenuCompositeElements");
    expect(body).toContain("addElementsToStore");
    expect(body).not.toContain("this.createComponent(createMenuDefinition");
  });
});

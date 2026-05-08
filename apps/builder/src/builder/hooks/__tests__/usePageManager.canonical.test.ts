import { describe, expect, it } from "vitest";

async function readUsePageManagerSource(): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.resolve(__dirname, "../usePageManager.ts");
  return fs.readFile(filePath, "utf-8");
}

function extractInitializeProject(source: string): string {
  const stripped = source.replace(/\/\/.*$/gm, "");
  const initFnMatch = stripped.match(
    /const initializeProject[\s\S]+?(?=\n\n {2}const |\n\n {2}return |\n {2}\};\n)/,
  );
  expect(
    initFnMatch,
    "initializeProject 함수 추출 실패 - 시그니처 변경 시 본 test regex 동기화 필요",
  ).not.toBeNull();
  return initFnMatch![0];
}

describe("usePageManager.initializeProject canonical-only hydrate", () => {
  it("CompositionDocument primary store 만 hydrate source 로 사용한다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);

    expect(initFnSource).toMatch(/db\.documents\.get\(projectId\)/);
    expect(initFnSource).toContain("useCanonicalDocumentStore");
    expect(initFnSource).toContain("deriveProjectRenderModelFromDocument");
    expect(initFnSource).not.toMatch(/db\.pages\./);
    expect(initFnSource).not.toMatch(/db\.elements\./);
    expect(initFnSource).not.toMatch(/db\.layouts\./);
  });

  it("legacy snapshot to CompositionDocument rebuild path 를 재도입하지 않는다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);

    expect(initFnSource).not.toMatch(/selectCanonicalDocument\(/);
    expect(initFnSource).not.toMatch(/selectCanonicalReusableFrames\(/);
    expect(initFnSource).not.toMatch(/setElementsCanonicalPrimary\(/);
    expect(initFnSource).not.toMatch(/applyCollectionItemsMigration\(/);
  });

  it("page/frame mirror adapter field access 를 initializeProject 에서 제거한다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);

    expect(initFnSource).not.toContain("getNullablePageFrameBindingId");
    expect(initFnSource).not.toContain("getFrameElementMirrorId");
    expect(initFnSource).not.toContain("withPageFrameBinding");
    expect(initFnSource).not.toMatch(/\blayout_id\b/);
  });

  it("hydrate 된 page runtime mirror 필드를 storePages 에서 보존한다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);

    expect(initFnSource).toMatch(
      /const storePages = renderModel\.pages\.map\(\(page\) => \(\{\s*\.\.\.page,\s*parent_id: page\.parent_id \?\? null,\s*\}\)\);/,
    );
  });

  it("새 페이지 생성은 IndexedDB pages/elements projection 을 쓰지 않는다", async () => {
    const source = await readUsePageManagerSource();

    expect(source).not.toContain("enqueuePagePersistence");
    expect(source).not.toMatch(/pages\.insert(?:WithBody)?\(/);
    expect(source).not.toMatch(/elements\.insert\(/);
    expect(source).not.toContain("withPageFrameBinding");
  });

  it("새 페이지 생성은 page/body order_num mirror 를 계산하거나 쓰지 않는다", async () => {
    const source = await readUsePageManagerSource();

    expect(source).not.toMatch(/\bmaxOrderNum\b/);
    expect(source).not.toMatch(/\bnextOrderNum\b/);
    expect(source).not.toMatch(/order_num:\s*/);
  });

  it("runtime migration helper 를 import 하거나 호출하지 않는다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);
    const legacyMigrationName = ["run", "LegacyToCanonical", "Migration"].join(
      "",
    );
    const tagMigrationName = ["run", "TagType", "Migration"].join("");

    expect(source).not.toContain(legacyMigrationName);
    expect(source).not.toContain(tagMigrationName);
    expect(initFnSource).not.toMatch(/\bmeta\.get\(/);
    expect(initFnSource).not.toMatch(/schemaVersion/);
  });

  it("hydrate 중 page shell bridge 가 빈 elements 로 canonical body 를 덮지 않는다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);
    const setElementsIndex = initFnSource.indexOf(
      "setElements(renderModel.elements as Element[])",
    );
    const setPagesIndex = initFnSource.indexOf("setPages(storePages)");

    expect(setElementsIndex).toBeGreaterThanOrEqual(0);
    expect(setPagesIndex).toBeGreaterThanOrEqual(0);
    expect(setElementsIndex).toBeLessThan(setPagesIndex);
  });

  it("hydrate 초기 선택은 page order_num 0이 아니라 slug Home identity 를 사용한다", async () => {
    const source = await readUsePageManagerSource();
    const initFnSource = extractInitializeProject(source);

    expect(source).toContain("function selectInitialPage");
    expect(initFnSource).toContain("selectInitialPage(apiPages)");
    expect(initFnSource).not.toContain(
      "apiPages.find((p) => p.order_num === 0)",
    );
  });
});

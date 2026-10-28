import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CatalogDocument,
  CollectionEntry,
  EndpointEntry,
  EntryId,
  NodeEntry,
  PageEntry,
  ProjectEntry,
  ViewEntry,
} from "../../document/types";
import { catalogProjectContent } from "../../runtime/exchange";
import {
  redirectFor,
  resolvePageMeta,
  siteHead,
  sitemapEntries,
} from "../../runtime/siteMeta";
import { setDataEntries } from "../data";
import {
  createPage,
  removePage,
  setSiteSettings,
  updatePage,
} from "../project";
import { addView } from "../views";
import {
  code,
  graphOf,
  node,
  PAGE,
  PROJECT,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

/**
 * ADR-286 G0 → G1 — site · page settings and data definitions live in the catalog document:
 * one command, one history step, the project file's `document`.
 */
const project = (graph: ReturnType<typeof graphOf>) =>
  graph.getEntry(PROJECT) as ProjectEntry;
const page = (id: string, route: string): PageEntry => ({
  kind: "page",
  id: id as EntryId<"page">,
  route,
  name: route,
  children: [],
});
const USERS = "data:collection:users" as const;
const users: CollectionEntry = {
  kind: "collection",
  id: USERS,
  name: "users",
  schema: [{ id: "f-name", key: "name", type: "string" }],
  mockData: [{ name: "Ada" }],
  useMockData: true,
};
const endpoint: EndpointEntry = {
  kind: "endpoint",
  id: "data:endpoint:get-users",
  name: "getUsers",
  method: "GET",
  baseUrl: "https://api.example.com",
  path: "/users",
  headers: [],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "data" },
  targetCollectionId: USERS,
  executionMode: "client",
};

describe("ADR-286 site · page settings in the document", () => {
  it("RED 2: 사이트 제목 설정 → 프로젝트 파일 document 에 site.title · Undo 로 원상", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    const before = snapshot(graph);
    const step = run(graph, setSiteSettings({ patch: { title: "Acme" } }));
    const document = catalogProjectContent(graph).document as CatalogDocument;
    expect((document.entries[PROJECT] as ProjectEntry).site?.title).toBe(
      "Acme",
    );
    undo(graph, step.result.inverse);
    expect(snapshot(graph)).toBe(before);
    // A cleared setting leaves no empty `site`.
    run(graph, setSiteSettings({ patch: { title: "Acme" } }));
    run(graph, setSiteSettings({ patch: { title: undefined } }));
    expect(project(graph).site).toBeUndefined();
  });

  it("RED 4: 페이지 meta 가 없으면 사이트 값 · 있으면 덮어씀 (head · sitemap · redirect)", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    run(
      graph,
      setSiteSettings({
        patch: {
          title: "Acme",
          description: "Site",
          lang: "ko-KR",
          search: { index: true, sitemap: true, robots: "allow" },
          redirects: [
            { from: "/old/*", to: "/new", permanent: true },
            { from: "/old/a", to: "/a", permanent: false },
          ],
        },
      }),
    );
    run(graph, createPage({ page: page("project:page:about", "/about") }));
    expect(resolvePageMeta(graph, PAGE)).toEqual({
      title: "Acme",
      description: "Site",
    });
    run(
      graph,
      updatePage({
        id: "project:page:about",
        fields: { meta: { title: "About", hidden: { sitemap: true } } },
      }),
    );
    expect(siteHead(graph, "project:page:about")).toMatchObject({
      title: "About",
      description: "Site",
      lang: "ko-KR",
      robots: "index",
    });
    expect(sitemapEntries(graph)).toEqual(["/"]);
    // List order is the priority: the wildcard first wins.
    expect(redirectFor(graph, "/old/a")?.to).toBe("/new");
    expect(redirectFor(graph, "/other")).toBeUndefined();
  });

  it("앱 아이콘 · 앱 이름 · 테마 색 — head 가 싣고 (앱 이름 없으면 사이트 제목), 테마 색은 #rrggbb 만", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    const icon = `asset:sha256-${"c".repeat(64)}` as const;
    run(
      graph,
      setSiteSettings({
        patch: { title: "Acme", appIcon: icon, themeColor: "#0a0b0c" },
      }),
    );
    const page = project(graph).pageIds[0];
    expect(siteHead(graph, page)).toMatchObject({
      appIcon: icon,
      appName: "Acme",
      themeColor: "#0a0b0c",
    });
    run(graph, setSiteSettings({ patch: { appName: "Acme App" } }));
    expect(siteHead(graph, page).appName).toBe("Acme App");
    expect(
      code(() =>
        run(graph, setSiteSettings({ patch: { themeColor: "red" } })),
      ),
    ).toBe("INVALID_THEME_COLOR");
  });

  it("RED 5: ProjectEntry.site.access 에 비밀 필드 (secret · password · certificate) 가 없다 — 스키마가 거부", () => {
    const source = readFileSync(
      resolve(__dirname, "../../document/types.ts"),
      "utf8",
    );
    const access = /export type CatalogSiteAccess\s*=([\s\S]*?);\n/.exec(
      source,
    );
    expect(access).not.toBeNull();
    expect(access![1]).not.toMatch(
      /secret|password\s*[?]?:|passwordHash|certificate|privateKey/i,
    );
    const graph = graphOf([text("a", "A")], ["a"]);
    expect(
      code(() =>
        run(
          graph,
          setSiteSettings({
            patch: {
              access: {
                kind: "sso",
                protocol: "oidc",
                issuer: "https://id.example.com",
                clientSecret: "s3cret",
                protectedPageIds: "all",
              } as never,
            },
          }),
        ),
      ),
    ).toBe("UNKNOWN_FIELD");
  });

  it("RED 7: 상태 변수 · 인터랙션 없는 빈 보호 페이지 삭제 → 성공 · 목록 정리 · Undo 로 둘 다 복원", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    run(graph, createPage({ page: page("project:page:secret", "/secret") }));
    run(
      graph,
      setSiteSettings({
        patch: {
          access: {
            kind: "sso",
            protocol: "oidc",
            issuer: "https://id.example.com",
            protectedPageIds: ["project:page:secret"],
          },
        },
      }),
    );
    const before = snapshot(graph);
    const removed = run(graph, removePage({ id: "project:page:secret" }));
    expect(graph.getEntry("project:page:secret")).toBeUndefined();
    const access = project(graph).site?.access;
    expect(access?.kind === "sso" && access.protectedPageIds).toEqual([]);
    undo(graph, removed.result.inverse);
    expect(snapshot(graph)).toBe(before);
    // A protected page that does not exist is refused (the reference check is on).
    expect(
      code(() =>
        run(
          graph,
          setSiteSettings({
            patch: {
              access: {
                kind: "sso",
                protocol: "saml",
                issuer: "x",
                protectedPageIds: ["project:page:nope"],
              },
            },
          }),
        ),
      ),
    ).toBe("DANGLING_PAGE");
  });
});

describe("ADR-286 G1 — data entries", () => {
  it("collection · endpoint 는 project 목록에 들고, 삭제는 바인딩 · 보기 · endpoint 대상을 같은 step 에서 정리하고 Undo 가 전부 복원", () => {
    const list = node("list", "lib:definition:listbox", {
      binding: { collectionId: USERS, fieldMap: {} },
    } as Partial<NodeEntry>);
    const graph = graphOf([list], ["list"]);
    run(graph, setDataEntries({ puts: [users, endpoint] }));
    expect(project(graph)).toMatchObject({
      collectionIds: [USERS],
      endpointIds: ["data:endpoint:get-users"],
    });
    const view: ViewEntry = {
      kind: "view",
      id: "project:view:adults",
      name: "Adults",
      source: { collectionId: USERS },
      where: { id: "w", op: "and", items: [] },
    } as unknown as ViewEntry;
    run(graph, addView({ entry: view }));
    const before = snapshot(graph);
    const removed = run(graph, setDataEntries({ removeIds: [USERS] }));
    expect(graph.getEntry(USERS)).toBeUndefined();
    expect(
      (graph.getEntry("project:node:list") as NodeEntry).binding,
    ).toBeUndefined();
    expect(graph.getEntry("project:view:adults")).toBeUndefined();
    expect(
      (graph.getEntry("data:endpoint:get-users") as EndpointEntry)
        .targetCollectionId,
    ).toBeUndefined();
    expect(project(graph).collectionIds).toBeUndefined();
    undo(graph, removed.result.inverse);
    expect(snapshot(graph)).toBe(before);
  });

  it("endpoint 대상이 없는 collection 이면 거부 · mock 행 1,000 초과 거부 (사용자 결정 1)", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    expect(code(() => run(graph, setDataEntries({ puts: [endpoint] })))).toBe(
      "DANGLING_COLLECTION",
    );
    expect(
      code(() =>
        run(
          graph,
          setDataEntries({
            puts: [
              {
                ...users,
                mockData: Array.from({ length: 1001 }, (_, i) => ({ i })),
              },
            ],
          }),
        ),
      ),
    ).toBe("COLLECTION_ROW_LIMIT");
  });
});

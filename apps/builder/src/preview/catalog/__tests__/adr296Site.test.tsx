import { afterEach, describe, expect, it, vi } from "vitest";
import { setSiteSettings } from "../../../../../../packages/shared/src/catalog/commands";
import type { ProjectEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 Phase 6 (G1 · G2 — 사용자 결정 2: ADR-286 Decision 8 reversed) — the site settings as
 * `index.html` (lang · title · description · icons · app name · theme color · social image) and
 * `site.config.ts` (search · redirects · access) — the Site panel's `setSiteSettings`.
 */
afterEach(() => vi.restoreAllMocks());

const HTML = "index.html";
const CONFIG = "site.config.ts";

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}
function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path: string) =>
  s.baselines.get(path)?.result.code ?? "";
function apply(
  h: Adr296Harness,
  s: CatalogCodeViewProjectSession,
  edits: Record<string, (code: string) => string>,
) {
  return catalogCodeViewProjectApply(
    h.workspace,
    s,
    Object.entries(edits).map(([path, edit]) => {
      const before = code(s, path);
      const edited = edit(before);
      return { path, edited, changes: editorChanges(before, edited) };
    }),
  );
}
const site = (h: Adr296Harness) =>
  (h.graph().getEntry(h.graph().projectId) as ProjectEntry).site;
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;

describe("ADR-296 Phase 6 — index.html · site.config.ts", () => {
  it("the files lead the tree; the settings are their lines; pasted over themselves they plan nothing", async () => {
    const h = await open();
    h.run(
      setSiteSettings({
        patch: {
          lang: "ko",
          title: "My <site>",
          description: "About us",
          themeColor: "#112233",
          favicon: { light: "asset:sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as never },
          search: { index: true, sitemap: false, robots: "allow" },
          redirects: [{ from: "/old", to: "/new", permanent: true }],
        },
      }),
    );
    const tree = codeViewFileTree(h.graph()).map((file) => file.path);
    expect(tree.slice(0, 2)).toEqual([HTML, CONFIG]);
    const s = session(h);
    expect(code(s, HTML)).toContain('<html lang="ko">');
    expect(code(s, HTML)).toContain("<title>My &lt;site&gt;</title>");
    expect(code(s, HTML)).toContain(
      '<link rel="icon" href="asset:sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" media="(prefers-color-scheme: light)" />',
    );
    expect(code(s, CONFIG)).toContain(
      "search: {index: true, sitemap: false, robots: 'allow'},",
    );
    const revision = h.graph().revision;
    expect(
      catalogCodeViewProjectApply(
        h.workspace,
        s,
        [HTML, CONFIG].map((path) => ({
          path,
          edited: code(s, path),
          changes: [],
        })),
      ).rejected,
    ).toEqual([]);
    expect(h.graph().revision).toBe(revision);
  });

  it("an edit is the Site panel's command — a setting changed · added · removed", async () => {
    const h = await open();
    h.run(setSiteSettings({ patch: { title: "A", description: "D" } }));
    const s = session(h);
    const before = history(h);
    const result = apply(h, s, {
      [HTML]: (text) =>
        text
          .replace("<title>A</title>", "<title>B</title>")
          .replace('    <meta name="description" content="D" />\n', "")
          .replace("<html>", '<html lang="en">')
          .replace(
            '<meta charset="utf-8" />',
            '<meta charset="utf-8" />\n    <meta name="theme-color" content="#000000" />',
          ),
      [CONFIG]: () =>
        "import {siteConfig} from '@composition/code';\n\nexport default siteConfig({\n  access: {kind: 'password', hint: 'ask'},\n  search: {sitemap: true, index: false, robots: 'none'},\n});\n",
    });
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    expect(site(h)).toEqual({
      title: "B",
      lang: "en",
      themeColor: "#000000",
      access: { kind: "password", hint: "ask" },
      search: { sitemap: true, index: false, robots: "none" },
    });
  });

  it("a protected page by its name (SSO); a line outside the shape is refused", async () => {
    const h = await open();
    const s = session(h);
    expect(
      apply(h, s, {
        [CONFIG]: () =>
          "import {siteConfig} from '@composition/code';\n\nexport default siteConfig({\n  access: {kind: 'sso', protocol: 'oidc', issuer: 'https://id.example.com', protectedPageIds: ['Home']},\n});\n",
      }).rejected,
    ).toEqual([]);
    expect(site(h)?.access).toEqual({
      kind: "sso",
      protocol: "oidc",
      issuer: "https://id.example.com",
      protectedPageIds: ["project:page:home"],
    });
    const refused = apply(h, session(h), {
      [HTML]: (text) =>
        text.replace("<head>", '<head>\n    <script src="x.js"></script>'),
    });
    expect(refused.rejected.map((line) => line.reason)).toContain(
      "outsideVocabulary",
    );
  });
});

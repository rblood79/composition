/**
 * ADR-305 Phase 0 — 빌더 문서 스냅샷 하니스 (G0 · G1 · G2 의 oracle).
 *
 *   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr305-builder-snapshot.mjs <outDir>
 *     ADR305_VARIANTS = light-228,dark-228,light-387,dark-387 (기본 전부) — 테마 (colorScheme · 빌더 테마 =
 *       시스템) × Design 패널 폭
 *     ADR305_SCREENS  = 쉼표 목록 (생략 = 전부)
 *     ADR305_COUNT=1  = 시트 규칙마다 선택자 계수 (G0 분류 — 느리다)
 *
 * 화면마다 `<outDir>/<variant>/<screen>.json` (adr305Snapshot.captureInPage). 단계가 실패하면 `errors` 에
 * 적고 다음 화면으로 간다 — 그 화면은 비교에서 빠진다 (비교기가 보고).
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureInPage, STATE_ATTRS, STATE_PROPS } from "./adr305Snapshot.mjs";
import {
  collectRules,
  ENTRIES,
  expandCssGraph,
  stripStateSelector,
} from "./adr305Sheets.mjs";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: adr305-builder-snapshot.mjs <outDir>");
const base = process.env.BUILDER_URL ?? "http://localhost:5173";
const variants = (
  process.env.ADR305_VARIANTS ?? "light-228,dark-228,light-387,dark-387"
).split(",");
const only = process.env.ADR305_SCREENS?.split(",");
const selectors =
  process.env.ADR305_COUNT === "1"
    ? collectRules([
        ...expandCssGraph(ENTRIES.builderComponents),
        ...expandCssGraph(ENTRIES.theme),
      ]).map((r) => [r.id, stripStateSelector(r.selector)])
    : [];

const auth = JSON.parse(
  readFileSync("apps/builder/scripts/.auth-session.json", "utf8"),
);
auth.origins = auth.origins.map((o) => ({ ...o, origin: base }));
const browser = await chromium.launch({ channel: "chrome", headless: false });
const summary = { base, variants: {}, startedAt: new Date().toISOString() };

for (const variant of variants) {
  const [scheme, width] = variant.split("-");
  const dir = join(outDir, variant);
  mkdirSync(dir, { recursive: true });
  const errors = [];
  let page_;
  const captured = [];
  const pageErrors = [];
  const run = async (storageState) => {
    const context = await browser.newContext({
      storageState,
      colorScheme: scheme,
      viewport: { width: 1800, height: 1100 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page_ = page;
    page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => pageErrors.push(e.message));
    return { context, page };
  };
  const capture = async (page, name) => {
    if (only && !only.includes(name)) return;
    await page.mouse.move(900, 1090);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    const t0 = Date.now();
    const snap = await page.evaluate(captureInPage, {
      selectors,
      statePass: process.env.ADR305_NOSTATE !== "1",
      stateAttrs: STATE_ATTRS,
      stateProps: STATE_PROPS,
      maxDesc: 24,
    });
    snap.portals = await page.evaluate(() =>
      [...document.body.children].map((el) => ({
        tag: el.localName,
        cls: String(el.className ?? ""),
        role:
          el.getAttribute("role") ?? el.firstElementChild?.getAttribute("role"),
        hasContext: Boolean(
          el.querySelector("[data-context]") || el.closest("[data-context]"),
        ),
      })),
    );
    snap.ms = Date.now() - t0;
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(snap));
    if (process.env.ADR305_SHOTS === "1")
      await page.screenshot({ path: join(dir, `${name}.png`) });
    captured.push({ name, elements: snap.elementCount, ms: snap.ms });
    console.log(`${variant} ${name} ${snap.elementCount} el ${snap.ms} ms`);
  };
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      errors.push({ name, error: String(e).split("\n")[0] });
      if (process.env.ADR305_FAILSHOT === "1")
        await page_
          ?.screenshot({ path: join(dir, `fail-${name}.png`) })
          .catch(() => {});
      // 열린 overlay 가 다음 단계를 막지 않게
      await page_?.keyboard.press("Escape").catch(() => {});
      await page_?.keyboard.press("Escape").catch(() => {});
      console.log(`${variant} ✗ ${name}: ${String(e).split("\n")[0]}`);
    }
  };

  // 1. 로그인 화면 — 인증 없는 문맥
  {
    const { context, page } = await run(undefined);
    await step("signin", async () => {
      await page.goto(`${base}/signin`);
      await page.waitForTimeout(1200);
      await capture(page, "signin");
    });
    // 랜딩 (`/`) — App.tsx 가 <html> 에 data-theme · data-builder-theme 를 단다
    await step("landing", async () => {
      await page.goto(`${base}/`);
      await page.waitForTimeout(1500);
      await capture(page, "landing");
    });
    await context.close();
  }

  const { context, page } = await run(auth);
  const rail = async (name, on = true) => {
    const b = page
      .getByRole("toolbar", { name: /panel controls$/ })
      .getByRole("button", { name, exact: true });
    if (((await b.getAttribute("aria-pressed")) === "true") !== on)
      await b.click();
    await page.waitForTimeout(250);
  };
  const panel = () => page.locator('[data-panel-id="properties"]');
  const tab = async (name) => {
    await panel().getByRole("tab", { name, exact: true }).click();
    await page.waitForTimeout(300);
  };
  const layers = () =>
    page.getByRole("treegrid", { name: "Layers", exact: true });
  const selectBody = async () => {
    await rail("Navigator");
    await layers()
      .getByRole("row", { name: "Body", exact: true })
      .press("Space");
    await page.waitForTimeout(250);
  };
  const insert = async (palette) => {
    await selectBody();
    await rail("Components");
    const comps = page.locator('[data-panel-id="components"]');
    await comps.getByRole("searchbox").fill(palette);
    await comps.getByRole("button", { name: palette, exact: true }).click();
    await comps.getByRole("searchbox").fill("");
    await page.waitForTimeout(600);
    await rail("Components", false);
    await rail("Navigator");
  };
  const overlay = async (name, open) => {
    await step(name, async () => {
      await open();
      await page.waitForTimeout(450);
      await capture(page, name);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    });
  };

  // 2. 대시보드
  await step("dashboard", async () => {
    await page.goto(`${base}/dashboard`);
    await page
      .getByRole("button", { name: "New project", exact: true })
      .first()
      .waitFor();
    await page.waitForTimeout(800);
    await capture(page, "dashboard-empty");
  });
  await overlay("dashboard-sort-menu", () =>
    page.getByRole("button", { name: "Sort projects" }).click(),
  );
  await step("dashboard-new-dialog", async () => {
    await page
      .getByRole("button", { name: "New project", exact: true })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: "Project name" })
      .fill("ADR305 snapshot");
    await page.waitForTimeout(400);
    await capture(page, "dashboard-new-dialog");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForURL(/\/builder\//);
    await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace);
    await page.waitForTimeout(1500);
  });
  await step("builder-initial", () => capture(page, "builder-initial"));

  // 패널 폭 — Design 패널 왼쪽 손잡이를 끌어 387 로
  await step("panel-width", async () => {
    await rail("Navigator");
    await rail("Design");
    if (width !== "228") {
      const handle = page.getByLabel("Resize Design panel left");
      const box = await handle.boundingBox();
      const current = await panel().evaluate(
        (e) => e.getBoundingClientRect().width,
      );
      const dx = Number(width) - current;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 - dx,
        box.y + box.height / 2,
        { steps: 8 },
      );
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    summary.variants[variant] = {
      designWidth: await panel().evaluate(
        (e) => e.getBoundingClientRect().width,
      ),
    };
  });

  // 3. Body — Design 다섯 탭
  await step("body", selectBody);
  for (const t of ["Property", "Layout", "Style", "Text", "Screen"])
    await step(`body-${t}`, async () => {
      await tab(t);
      await capture(page, `body-${t}`);
    });
  await overlay("body-property-select-open", async () => {
    await tab("Property");
    await panel().getByRole("button", { name: "— Apply Layout" }).click();
  });

  // 4. 컴포넌트마다 Design 탭 (패널 위젯이 type 마다 다르다)
  const kinds = [
    ["button", ["Property", "Layout", "Style", "Text"]],
    ["text field", ["Property", "Layout"]],
    ["select", ["Property"]],
    ["toggle button group", ["Property"]],
    ["slider", ["Property"]],
    ["checkbox", ["Property"]],
    ["table", ["Property"]],
    ["list box", ["Property"]],
    ["tabs", ["Property"]],
    ["image", ["Property", "Style"]],
  ];
  for (const [kind, tabs] of kinds) {
    const slug = kind.replace(/\s+/g, "-");
    await step(`insert-${slug}`, () => insert(kind));
    for (const t of tabs)
      await step(`${slug}-${t}`, async () => {
        await tab(t);
        await capture(page, `${slug}-${t}`);
      });
    if (kind === "button") {
      await overlay("button-size-mode-open", async () => {
        await tab("Layout");
        await panel().getByRole("button", { name: "Width Size mode" }).click();
      });
      await overlay("button-gap-suggestions", async () => {
        await tab("Layout");
        await panel()
          .getByRole("button", { name: "Show suggestions" })
          .first()
          .click();
      });
      await overlay("button-fill-popover", async () => {
        await tab("Style");
        await panel().getByRole("button", { name: "Edit fill" }).click();
      });
      await overlay("button-overflow-select", async () => {
        await tab("Layout");
        await panel()
          .getByRole("button", { name: /Overflow$/ })
          .click();
      });
      await overlay("selection-more-actions", () =>
        page
          .getByRole("toolbar", { name: "Selection actions" })
          .getByRole("button", { name: "More actions" })
          .click(),
      );
    }
  }
  // Grid 배치의 frame — Grid track 메뉴
  await step("insert-frame", () => insert("frame"));
  await step("frame-grid", async () => {
    await tab("Layout");
    await panel()
      .getByRole("radio", { name: "Grid", exact: true })
      .click({ force: true });
    await page.waitForTimeout(500);
    await capture(page, "frame-grid-Layout");
  });

  // 5. 헤더 · 패널
  await overlay("zoom-menu", () =>
    page.getByRole("button", { name: "Zoom menu" }).click(),
  );
  await overlay("header-menu", () =>
    page.getByRole("button", { name: "Menu", exact: true }).click(),
  );
  await step("components-panel", async () => {
    await rail("Navigator", false);
    await rail("Components");
    await capture(page, "components-panel");
    await rail("Components", false);
  });
  await step("navigator-tabs", async () => {
    await rail("Navigator");
    for (const t of ["Components", "Layouts"]) {
      await page
        .getByRole("tablist", { name: "Navigator tabs" })
        .getByRole("tab", { name: t, exact: true })
        .click();
      await page.waitForTimeout(300);
      await capture(page, `navigator-${t}`);
    }
    await page
      .getByRole("tablist", { name: "Navigator tabs" })
      .getByRole("tab", { name: "Pages", exact: true })
      .click();
  });
  await step("data-panel", async () => {
    await rail("Navigator", false);
    await rail("Data");
    await page.waitForTimeout(500);
    await capture(page, "data-panel");
    await rail("Data", false);
    await rail("Navigator");
  });
  for (const name of ["AI", "Interactions"])
    await step(`${name}-panel`, async () => {
      await rail(name);
      await page.waitForTimeout(500);
      await capture(page, `${name.toLowerCase()}-panel`);
      await rail("Design");
    });
  // 단축키로만 여는 패널 (rail 에 없음) · 코드 보기
  for (const [name, key] of [
    ["theme-panel", "Alt+Digit4"],
    ["history-panel", "Alt+Digit8"],
    ["settings-panel", "Meta+Comma"],
  ])
    await step(name, async () => {
      await page
        .locator("canvas")
        .first()
        .click({ position: { x: 5, y: 5 } });
      await page.keyboard.press(key);
      await page.waitForTimeout(700);
      await capture(page, name);
      await page.keyboard.press(key);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    });
  // 6. 2026-11-09 추가 — 첫 스냅샷이 지나지 않은 화면 (Data 표 선택 checkbox 회귀). 표 · 생성기 · 표의
  //    메뉴 · 행 편집 · APIs · Variables · Interactions (요소 선택) · 명령 팔레트 · Site · Workflow · 눈금자 · 메뉴 하위
  const dataPanel = () => page.locator('[data-panel-id="datatable"]');
  const dump = async (name, loc) =>
    console.log(
      `${variant} [dump ${name}]`,
      JSON.stringify(
        await loc.evaluate((el) =>
          [...el.querySelectorAll("button,[role=tab],[role=menuitem]")]
            .map((e) =>
              (e.getAttribute("aria-label") || e.textContent.trim()).slice(
                0,
                40,
              ),
            )
            .slice(0, 60),
        ),
      ),
    );
  await step("data-creator", async () => {
    await rail("Navigator", false);
    await rail("Data");
    await dataPanel()
      .getByRole("button", { name: "New table", exact: true })
      .click();
    await page.waitForTimeout(600);
    await capture(page, "data-creator-preset");
    await dataPanel().getByText("Empty table", { exact: true }).click();
    await page.waitForTimeout(400);
    await capture(page, "data-creator-empty");
    await dataPanel().getByText("Preset", { exact: true }).first().click();
    await page.waitForTimeout(400);
    await dataPanel().getByText("Users", { exact: true }).first().click();
    await dataPanel()
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await page.waitForTimeout(1200);
    await capture(page, "data-grid");
  });
  await step("data-grid-selected", async () => {
    await dataPanel()
      .locator('[role="row"] .datagrid-cell-select input')
      .nth(1)
      .click({ force: true });
    await page.waitForTimeout(300);
    await capture(page, "data-grid-selected");
    await dataPanel()
      .locator('[role="row"] .datagrid-cell-select input')
      .nth(1)
      .click({ force: true });
  });
  for (const [name, label] of [
    ["data-table-settings", "Table settings Users"],
    ["data-column-menu", "num column actions"],
    ["data-insert-menu", "Insert"],
    ["data-export-menu", "Export"],
  ])
    await overlay(name, () =>
      dataPanel()
        .getByRole("button", { name: label, exact: true })
        .first()
        .click(),
    );
  await overlay("data-rowform", () =>
    dataPanel().locator(".datagrid-row-open").first().click({ force: true }),
  );
  for (const t of ["APIs", "Variables"])
    await step(`data-${t}`, async () => {
      await dataPanel().getByRole("tab", { name: t }).click();
      await page.waitForTimeout(500);
      await capture(page, `data-${t}`);
      await dump(`data-${t}`, dataPanel());
    });
  await step("data-close", async () => {
    await dataPanel().getByRole("tab", { name: "Tables" }).click();
    await rail("Data", false);
    await rail("Navigator");
  });
  await step("interactions-button", async () => {
    await layers()
      .getByRole("row", { name: /Button/ })
      .first()
      .press("Space");
    await page.waitForTimeout(300);
    await rail("Interactions");
    await page.waitForTimeout(600);
    await capture(page, "interactions-button");
    await page
      .locator('[data-panel-id="events"]')
      .getByRole("button", { name: "Add event", exact: true })
      .click();
    await page.waitForTimeout(500);
    await capture(page, "interactions-add-event");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await rail("Interactions", false);
  });
  for (const [name, key] of [
    ["command-palette", "Meta+Slash"],
    ["workflow-overlay", "Control+Alt+KeyW"],
    ["rulers", "Shift+KeyR"],
  ])
    await step(name, async () => {
      await page
        .locator("canvas")
        .first()
        .click({ position: { x: 5, y: 5 } });
      await page.keyboard.press(key);
      await page.waitForTimeout(700);
      await capture(page, name);
      if (name !== "command-palette") await page.keyboard.press(key);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    });
  await step("site-panel", async () => {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.waitForTimeout(400);
    await page.keyboard.type("Site");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    await capture(page, "site-panel");
    await page
      .locator('[data-panel-id="site"]')
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.waitForTimeout(300);
  });
  for (const sub of ["File", "Edit", "View", "Layout", "Help"])
    await overlay(`header-menu-${sub}`, async () => {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.waitForTimeout(400);
      await page
        .getByRole("menuitem", { name: sub, exact: true })
        .first()
        .hover({ force: true });
      await page.waitForTimeout(400);
    });
  await step("tooltip", async () => {
    await page
      .getByRole("toolbar", { name: /panel controls$/ })
      .first()
      .getByRole("button")
      .first()
      .hover();
    await page.waitForTimeout(1500);
    await capture(page, "tooltip");
  });
  await step("code-view", async () => {
    await page.getByRole("button", { name: "Code Home" }).click();
    await page.waitForTimeout(1200);
    await capture(page, "code-view");
    await page.getByRole("button", { name: "Code Home" }).click();
    await page.waitForTimeout(400);
  });
  await step("compare", async () => {
    await page
      .getByRole("button", {
        name: "Compare mode (Preview + Skia)",
        exact: true,
      })
      .click();
    await page.locator("#previewFrame").waitFor();
    await page.waitForTimeout(1500);
    await capture(page, "compare");
  });

  summary.variants[variant] = {
    ...summary.variants[variant],
    captured,
    errors,
    pageErrors,
  };
  await context.close();
}
summary.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
await browser.close();
console.log(
  Object.entries(summary.variants)
    .map(
      ([v, s]) =>
        `${v}: ${s.captured?.length} screens · errors ${s.errors?.length} · pageErrors ${s.pageErrors?.length}`,
    )
    .join("\n"),
);

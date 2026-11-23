#!/usr/bin/env node
// S2 Card density · card spacing · 카드 원본 live (2026-11-24, S2 체크리스트 §9.3 6-7):
//   1. Components 패널 「card」 → Card: 폭 240 (S2 M) · 여백 16 · 미리보기가 위 · 좌우 가장자리 (테두리 안)
//   2. Design 패널 Density → Compact: Canvas 여백 12 · 미리보기 margin −12 · Content 위 12
//   3. Components 패널 「user card」 · 「product card」 · 「asset card」 · 「collection card」:
//      Canvas — UserCard Avatar 64 가 배너 아래 끝에서 32 위 · ProductCard thumbnail 40 이 20 위 ·
//      AssetCard 정사각 미리보기 · CollectionCard 첫 이미지 3 칸 폭
//   4. Publish: 같은 값 (Card 여백 · 폭, Avatar · thumbnail 겹침, Content padding) — Canvas 와 대조
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-card-density-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/s2-card-density-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

/** Every Card on the Canvas: its size · density · box and its sections' boxes. */
const cards = () =>
  page.evaluate(() => {
    const r = window.__COMPOSITION_CATALOG__.workspace.root;
    const type = (x) => r.typeOf(x);
    const g = (id) => {
      const b = r.getGeometry([id]).get(id);
      return b && { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    return [...r.canvasInputs.values()]
      .filter((x) => type(x) === "Card")
      .map((card) => {
        const kids = card.children.map((c) => r.canvasInputs.get(c));
        const of = (t, where = () => true) =>
          kids.find((k) => k && type(k) === t && where(k));
        const preview = of("CardPreview");
        const images = (parent) =>
          parent
            ? parent.children
                .map((c) => r.canvasInputs.get(c))
                .filter(Boolean)
            : [];
        const grid = images(preview).find((k) => type(k) === "frame");
        return {
          id: card.id,
          props: card.props,
          padding: card.visual.paddingX,
          box: g(card.id),
          preview: preview && g(preview.id),
          previewImage: images(preview)[0] && g(images(preview)[0].id),
          content: of("Content") && g(of("Content").id),
          avatar: of("Avatar") && g(of("Avatar").id),
          thumbnail:
            of("Image", (k) => k.props.slot === "thumbnail") &&
            g(of("Image", (k) => k.props.slot === "thumbnail").id),
          collection: grid && {
            grid: g(grid.id),
            images: images(grid).map((k) => g(k.id)),
          },
        };
      });
  });

const place = async (label) => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

const openDesign = async () => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(600);
  }
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
};

const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: label }),
    })
    .first();

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("card density live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // 1. A plain Card.
  await place(/^card$|^카드$/i);
  const [plain] = await cards();
  record(
    "1 Card: 폭 240 · 여백 16 · 미리보기 위 · 좌우 가장자리",
    plain.box.width === 240 &&
      plain.padding === 16 &&
      plain.preview.x === plain.box.x + 1 &&
      plain.preview.y === plain.box.y + 1 &&
      plain.preview.width === 238 &&
      plain.content.y === plain.preview.y + plain.preview.height,
    plain,
  );

  // 2. Design panel Density → Compact.
  await page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectItems([ws.itemOfRecord(id)]);
  }, plain.id);
  await openDesign();
  const density = field(/^Density$|^밀도$/);
  await density.waitFor({ state: "visible", timeout: 15000 });
  const radio = density.getByRole("radio", { name: /^Compact$|^조밀$/ });
  if (await radio.count()) await radio.first().click();
  else {
    await density.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: /^Compact$|^조밀$/ }).click();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/builder-card-compact.png` });
  const [compact] = await cards();
  record(
    "2 Design 패널 Density → Compact: 여백 12 · 미리보기 margin −12 · Content 는 미리보기 바로 아래 (위 여백 12)",
    compact.props.density === "compact" &&
      compact.padding === 12 &&
      compact.preview.width === 238 &&
      compact.content.x === compact.box.x + 13,
    compact,
  );

  // 3. The presets.
  for (const label of [
    /^user card$|^사용자 카드$/i,
    /^product card$|^상품 카드$/i,
    /^asset card$|^에셋 카드$/i,
    /^collection card$|^컬렉션 카드$/i,
  ])
    await place(label);
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/builder-presets.png` });
  const all = await cards();
  const user = all.find((c) => c.avatar);
  const product = all.find((c) => c.thumbnail);
  const asset = all.find(
    (c) => c.props.density === "regular" && !c.collection && c.id !== plain.id,
  );
  const collection = all.find((c) => c.collection);
  const bottom = (b) => b.y + b.height;
  record(
    "3 Canvas 원본: UserCard spacious · Avatar 64 가 배너 끝 32 위 / ProductCard thumbnail 40 이 20 위 / AssetCard 정사각 / CollectionCard 첫 이미지 3 칸",
    user.props.density === "spacious" &&
      user.avatar.width === 64 &&
      Math.abs(user.avatar.y - (bottom(user.preview) - 32)) < 0.5 &&
      product.thumbnail.width === 40 &&
      Math.abs(product.thumbnail.y - (bottom(product.preview) - 20)) < 0.5 &&
      Math.abs(asset.previewImage.width - asset.previewImage.height) < 0.5 &&
      Math.abs(
        collection.collection.images[0].width -
          collection.collection.grid.width,
      ) < 0.5,
    { user, product, asset, collection },
  );

  // 4. Publish.
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1920, height: 1100 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-Card", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  await pub.screenshot({ path: `${OUT}/publish.png`, fullPage: true });
  const dom = await pub.evaluate(() =>
    [...document.querySelectorAll(".react-aria-Card")].map((card) => {
      const box = (el) => {
        if (!el) return undefined;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      };
      const preview = card.querySelector(":scope > .react-aria-CardPreview");
      const content = card.querySelector(":scope > .react-aria-Content");
      const kids = [...card.children];
      const afterPreview = kids[kids.indexOf(preview) + 1];
      return {
        density: card.dataset.density,
        padding: getComputedStyle(card).paddingLeft,
        box: box(card),
        preview: box(preview),
        content: box(content),
        contentPadding: content && getComputedStyle(content).paddingTop,
        overlap:
          afterPreview && !afterPreview.matches(".react-aria-Content")
            ? box(afterPreview)
            : undefined,
      };
    }),
  );
  const domCompact = dom.find((c) => c.density === "compact");
  const domUser = dom.find((c) => c.overlap && c.overlap.width === 64);
  const domProduct = dom.find((c) => c.overlap && c.overlap.width === 40);
  record(
    "4 Publish: Compact Card 여백 12 · 폭 240 · 미리보기 가장자리 / Avatar 32 · thumbnail 20 겹침 — Canvas 와 같음",
    domCompact?.padding === "12px" &&
      Math.round(domCompact.box.width) === 240 &&
      Math.abs(domCompact.preview.x - domCompact.box.x - 1) < 0.5 &&
      Math.abs(domCompact.preview.width - 238) < 0.5 &&
      !!domUser &&
      Math.abs(
        domUser.overlap.y - (domUser.preview.y + domUser.preview.height - 32),
      ) < 0.5 &&
      !!domProduct &&
      Math.abs(
        domProduct.overlap.y -
          (domProduct.preview.y + domProduct.preview.height - 20),
      ) < 0.5 &&
      Math.abs(domUser.preview.height - user.preview.height) < 0.5 &&
      Math.abs(domUser.box.height - user.box.height) < 1,
    { domCompact, domUser, domProduct, canvasUserHeight: user.box.height },
  );
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("5 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);

/** 기존 headed Playwright Builder 페이지에서 실행. 전용 검증 프로젝트만 수정한다. */
export async function exerciseOverlayOpen(
  page,
  {
    outputDirectory,
    writeFile,
    captureScreenshots = false,
    types = [
      "Dialog",
      "Menu",
      "Select",
      "ComboBox",
      "DatePicker",
      "DateRangePicker",
      "Tooltip",
      "ContextualHelp",
      "PreviewTrigger",
      "Popover",
    ],
  },
) {
  if (!(await page.locator("body").innerText()).includes("Overlay Open parity"))
    throw new Error("전용 Overlay Open parity 검증 프로젝트가 필요합니다.");
  const compare = page.getByRole("button", {
    name: "Compare Mode (Preview + Skia)",
    exact: true,
  });
  if (
    !(await page
      .getByRole("separator", { name: "Resize the CSS / Canvas compare split" })
      .count())
  )
    await compare.click();
  const results = [];
  for (const type of types) {
    await page.evaluate(() => {
      const h = window.__COMPOSITION_CATALOG__;
      const ids = [
        ...h.workspace.runtime.graph.getEntry("project:node:home-body")
          .children,
      ];
      if (ids.length)
        h.workspace.execute(
          h.commands.removeTargets({
            targets: ids.map((id) => ({ kind: "node", id })),
          }),
        );
    });
    const search = page.getByRole("searchbox", { name: "Search components" });
    if (!(await search.isVisible()))
      await page
        .getByRole("button", { name: "Components", exact: true })
        .click();
    await search.fill(type);
    await page
      .locator(".list-item")
      .filter({
        hasText: new RegExp(
          "^" + type.replace(/([a-z])([A-Z])/g, "$1\\s*$2") + "$",
          "i",
        ),
      })
      .first()
      .click();
    await page.getByRole("button", { name: "Components", exact: true }).click();
    const open = page.getByRole("button", { name: "Open", exact: true });
    if (!(await open.isVisible()))
      await page.getByRole("button", { name: "Design", exact: true }).click();
    await open.click({ noWaitAfter: true });
    const frame = page.frames().find((f) => f.url().includes("preview.html"));
    const popup = frame
      .locator(".react-aria-Modal,.react-aria-Popover,.react-aria-Tooltip")
      .first();
    await popup.waitFor();
    await frame.waitForFunction(
      () => !document.querySelector("[data-entering]"),
    );
    const dom = await popup.evaluate((n) => ({
      rect: n.getBoundingClientRect().toJSON(),
      bg: getComputedStyle(n).backgroundColor,
    }));
    const canvas = await page.evaluate(() => {
      const h = window.__COMPOSITION_CATALOG__,
        root = h.workspace.root;
      const node = [...root.canvasInputs.values()].find((n) =>
        ["Modal", "Popover", "Tooltip"].includes(root.typeOf(n)),
      );
      return { rect: h.canvas.boundsOf(node.id), hidden: node.hidden === true };
    });
    if (!canvas.rect || canvas.hidden)
      throw new Error(`${type}: Canvas portal이 표시되지 않음`);
    const delta = Object.fromEntries(
      ["x", "y", "width", "height"].map((k) => [
        k,
        Math.abs(canvas.rect[k] - dom.rect[k]),
      ]),
    );
    if (Object.values(delta).some((v) => v > 1.1))
      throw new Error(`${type}: 배치 불일치 ${JSON.stringify(delta)}`);
    const split = page.getByRole("separator", {
      name: "Resize the CSS / Canvas compare split",
    });
    if (captureScreenshots)
      for (const [surface, key] of [
        ["canvas", "Home"],
        ["preview", "End"],
      ]) {
        await split.focus();
        await page.keyboard.press(key);
        await page.screenshot({
          path: `${outputDirectory}/${type}-${surface}.png`,
        });
      }
    await open.click({ noWaitAfter: true });
    await page.bringToFront();
    await popup.waitFor({ state: "hidden", timeout: 20000 });
    const closed = await page.evaluate(() =>
      [...window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.values()]
        .filter((n) => ["modal", "popover", "tooltip"].includes(n.bindingId))
        .every((n) => n.hidden),
    );
    if (!closed) throw new Error(`${type}: Open 해제 후 Canvas 본문이 남음`);
    await open.click({ noWaitAfter: true });
    await popup.waitFor();
    await frame.waitForFunction(
      () => !document.querySelector("[data-entering]"),
    );
    results.push({ type, canvas, dom, delta, closeAndReopen: "PASS" });
    await writeFile(
      `${outputDirectory}/results.json`,
      JSON.stringify(results, null, 2),
    );
  }
  await writeFile(
    `${outputDirectory}/results.json`,
    JSON.stringify(results, null, 2),
  );
  return results;
}

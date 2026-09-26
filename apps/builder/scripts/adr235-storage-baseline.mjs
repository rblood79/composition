#!/usr/bin/env node
// adr235-storage-baseline.mjs — ADR-235 G0 (e) / G2 저장 용량 A/B 하니스.
//
// 격리 프로젝트에 이미지 fill 5 장 (결정적 노이즈 PNG) · 사용자 폰트 2 개 ·
// user 스냅샷 1 개를 production 경로 (updateSelectedFills · createFontFaceFromFile ·
// snapshotManager.createSnapshot) 로 만든 뒤, 원본 문서 · 백업 ring · 스냅샷 ·
// history entry · 폰트 레지스트리 · 자산 store 의 bytes 를 잰다.
//
// 같은 스크립트를 변경 전 (detached baseline) 과 변경 후에 돌려 비교한다 (G2).
//
//   node apps/builder/scripts/adr235-storage-baseline.mjs [--base-url URL] [--out DIR] [--headed]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const baseUrl = argValue("--base-url", process.env.BUILDER_URL ?? "http://localhost:5173");
const out = argValue("--out", "/private/tmp/adr235-storage-baseline");
const headed = args.includes("--headed");
const storageStatePath = resolve("apps/builder/scripts/.auth-session.json");

const FONT_FILES = [
  resolve("apps/builder/public/fonts/InterVariable.woff2"),
  resolve("apps/builder/public/fonts/InterVariable.ttf"),
];

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  try {
    const { context, page, errors } = await createInstrumentedContext(browser, {
      storageState: JSON.parse(readFileSync(storageStatePath, "utf8")),
      frameCapture: false,
    });
    const project = await createIsolatedProject(page, baseUrl);
    process.stderr.write(`[boot] ${project.projectUrl}\n`);

    const fonts = FONT_FILES.map((path) => ({
      name: path.split("/").pop(),
      base64: readFileSync(path).toString("base64"),
    }));

    const result = await page.evaluate(
      async ({ fonts }) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const store = window.__composition_STORE__;
        const state = store.getState();
        const projectId = location.pathname.split("/").pop();
        const pageId = state.currentPageId;
        const body = state.elements.find(
          (e) => e.page_id === pageId && e.type === "body",
        );
        if (!body) throw new Error("body 없음");

        // 1) frame 5 개
        const now = new Date().toISOString();
        const frames = Array.from({ length: 5 }, (_, i) => ({
          id: `adr235-frame-${i}`,
          customId: `adr235-frame-${i}`,
          type: "frame",
          parent_id: body.id,
          page_id: pageId,
          order_num: i,
          created_at: now,
          updated_at: now,
          props: {
            style: {
              position: "absolute",
              left: `${20 + i * 220}px`,
              top: "20px",
              width: "200px",
              height: "200px",
            },
          },
        }));
        await store.getState().addComplexElement(frames[0], frames.slice(1));
        await wait(300);

        // 2) 결정적 노이즈 PNG 5 장 → image fill (ImageFillEditor 와 같은 dataURL)
        let seed = 235;
        const rand = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed & 0xff;
        };
        const imageBytes = [];
        for (let i = 0; i < frames.length; i += 1) {
          const canvas = document.createElement("canvas");
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext("2d");
          const data = ctx.createImageData(256, 256);
          for (let p = 0; p < data.data.length; p += 4) {
            data.data[p] = rand();
            data.data[p + 1] = rand();
            data.data[p + 2] = rand();
            data.data[p + 3] = 255;
          }
          ctx.putImageData(data, 0, 0);
          const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
          imageBytes.push(blob.size);
          // ADR-235 writer 가 있으면 업로드와 같은 경로 (자산 저장 → 참조), 없으면 dataURL (기준선)
          const writerUrl = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .find((name) => name.includes("/lib/assets/assetWriter.ts"));
          let writer = null;
          try {
            writer = await import(writerUrl ?? "/src/lib/assets/assetWriter.ts");
          } catch {
            writer = null;
          }
          const dataUrl = writer
            ? (
                await writer.storeUploadedFile(
                  new File([blob], `noise-${i}.png`, { type: "image/png" }),
                )
              ).ref
            : await new Promise((r) => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result);
                reader.readAsDataURL(blob);
              });
          store.getState().setSelectedElement(frames[i].id);
          await wait(50);
          store.getState().updateSelectedFills([
            {
              id: `adr235-fill-${i}`,
              type: "image",
              enabled: true,
              opacity: 1,
              blendMode: "normal",
              url: dataUrl,
              mode: "fill",
            },
          ]);
          await wait(300);
        }

        // 3) 사용자 폰트 2 개 (업로드 경로와 같은 createFontFaceFromFile)
        const fontModule = await import("/src/builder/fonts/customFonts.ts");
        let registry = fontModule.loadFontRegistry();
        const fontErrors = [];
        for (const font of fonts) {
          const bin = Uint8Array.from(atob(font.base64), (c) => c.charCodeAt(0));
          const file = new File([bin], font.name, {
            type: font.name.endsWith(".ttf") ? "font/ttf" : "font/woff2",
          });
          const face = await fontModule.createFontFaceFromFile(
            file,
            `ADR235 ${font.name}`,
          );
          registry = fontModule.addFontFace(registry, face);
          try {
            fontModule.saveRegistryAndNotify(registry);
          } catch (error) {
            fontErrors.push(`${font.name}: ${error?.name ?? error}`);
          }
        }

        // 4) user 스냅샷 1 개 — 앱과 같은 모듈 인스턴스로
        const snapshotUrl = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .find((name) => name.includes("/stores/history/snapshots.ts"));
        const snapshotModule = await import(
          snapshotUrl ?? "/src/builder/stores/history/snapshots.ts"
        );
        const canonical = window.__canonical_STORE__.getState();
        const doc =
          canonical.getDocument(projectId);
        await snapshotModule.snapshotManager.createSnapshot({
          projectId,
          doc,
          kind: "user",
        });

        // 5) persist 안정화
        await wait(2500);

        // ---- 측정 ----
        const openDb = (name) =>
          new Promise((res, rej) => {
            const req = indexedDB.open(name);
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
        const all = (db, storeName, indexName, key) =>
          new Promise((res, rej) => {
            if (!db.objectStoreNames.contains(storeName)) return res([]);
            const tx = db.transaction(storeName, "readonly");
            const s = tx.objectStore(storeName);
            const req =
              indexName && key !== undefined
                ? s.index(indexName).getAll(key)
                : s.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
        const bytesOf = (value) => {
          if (value instanceof Blob) return value.size;
          return new Blob([
            typeof value === "string" ? value : JSON.stringify(value),
          ]).size;
        };
        const sum = (rows) => rows.reduce((s, row) => s + bytesOf(row), 0);

        const main = await openDb("composition");
        const parts = await all(main, "document_parts", "project_id", projectId);
        const legacyDocs = (await all(main, "documents")).filter(
          (d) => d.project_id === projectId,
        );
        const backups = await all(
          main,
          "documents_backup",
          "project_id",
          projectId,
        );
        const assets = await all(main, "assets");
        main.close();

        const historyDb = await openDb("composition-history");
        const pageIds = new Set(store.getState().pages.map((p) => p.id));
        const entries = (await all(historyDb, "history-entries")).filter((e) =>
          pageIds.has(e.pageId),
        );
        const snapshots = await all(
          historyDb,
          "snapshots",
          "projectId",
          projectId,
        );
        historyDb.close();

        const fontRegistryRaw =
          localStorage.getItem("composition.font-registry") ?? "";
        const documentBytes = sum(parts) + sum(legacyDocs);
        return {
          projectId,
          imageBytes,
          fontBytes: fonts.map((f) => Math.round((f.base64.length * 3) / 4)),
          fontErrors,
          documentBytes,
          largestParts: parts
            .map((part) => ({ key: part.key, bytes: bytesOf(part) }))
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 6),
          // 가장 큰 node part 에서 dataURL 을 품은 JSON 경로 (이중 보관 위치 확인용)
          dataUrlPaths: (() => {
            const top = parts
              .slice()
              .sort((a, b) => bytesOf(b) - bytesOf(a))[0];
            if (!top) return [];
            const value =
              typeof top.value === "string"
                ? JSON.parse(top.value)
                : (top.json ? JSON.parse(top.json) : top);
            const found = [];
            const walk = (node, path) => {
              if (typeof node === "string") {
                if (node.includes("data:image")) found.push(`${path} (${node.length})`);
                return;
              }
              if (node && typeof node === "object")
                for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
            };
            walk(value, "$");
            return found;
          })(),
          backup: { count: backups.length, bytes: sum(backups) },
          snapshots: { count: snapshots.length, bytes: sum(snapshots) },
          historyEntries: { count: entries.length, bytes: sum(entries) },
          fontRegistryLocalStorageBytes: new Blob([fontRegistryRaw]).size,
          assets: {
            count: assets.length,
            bytes: assets.reduce(
              (s, a) => s + (a?.blob?.size ?? a?.bytes ?? 0),
              0,
            ),
          },
          persisted: await navigator.storage.persisted(),
          estimate: await navigator.storage.estimate(),
          visibilityState: document.visibilityState,
          userAgent: navigator.userAgent,
        };
      },
      { fonts },
    );

    const total =
      result.documentBytes +
      result.backup.bytes +
      result.snapshots.bytes +
      result.historyEntries.bytes +
      result.fontRegistryLocalStorageBytes +
      result.assets.bytes;
    const report = { ...result, total, errors, measuredAt: new Date().toISOString() };
    const file = resolve(out, `storage-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(report, null, 2));
    process.stdout.write(
      [
        `| 항목 | count | bytes |`,
        `| --- | ---: | ---: |`,
        `| 원본 문서 (document_parts) | – | ${result.documentBytes} |`,
        `| 백업 ring | ${result.backup.count} | ${result.backup.bytes} |`,
        `| 스냅샷 | ${result.snapshots.count} | ${result.snapshots.bytes} |`,
        `| history entry | ${result.historyEntries.count} | ${result.historyEntries.bytes} |`,
        `| 폰트 레지스트리 (localStorage) | – | ${result.fontRegistryLocalStorageBytes} |`,
        `| 자산 store | ${result.assets.count} | ${result.assets.bytes} |`,
        `| **합계** | | **${total}** |`,
        ``,
        `이미지 원본 ${result.imageBytes.join(" · ")} B · 폰트 원본 ${result.fontBytes.join(" · ")} B · 폰트 저장 오류 ${result.fontErrors.length ? result.fontErrors.join("; ") : "없음"}`,
        `persisted=${result.persisted} · visibility=${result.visibilityState} · ${file}`,
        "",
      ].join("\n"),
    );
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

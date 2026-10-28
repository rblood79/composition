import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Workspace 를 읽는 패널은 **패널 전체** 를 `CatalogWorkspaceGate` 로 감싼다 — 패널은 workspace 가
 * 열리기 전에 마운트된다. 2026-10-28 전에는 패널 전체 · 본문만 (헤더는 보임) · Gate 없이
 * `useOptional…` 분기, 세 형태가 섞여 workspace 가 없을 때 패널마다 보이는 것이 달랐다.
 * Settings · AI 는 workspace 를 읽지 않아 대상이 아니다.
 */
const PANELS = resolve(__dirname, "..");
const ROOTS: readonly [file: string, component: string][] = [
  ["navigator/catalog/CatalogNavigatorPanel.tsx", "CatalogNavigatorPanel"],
  ["components/CatalogComponentsPanel.tsx", "CatalogComponentsPanel"],
  ["datatable/DataTablePanel.tsx", "DataTablePanel"],
  ["datatable/DataTableEditorPanel.tsx", "DataTableEditorPanel"],
  ["datatable/DataTableFieldPanel.tsx", "DataTableFieldPanel"],
  ["themes/catalog/CatalogThemesPanel.tsx", "CatalogThemesPanel"],
  ["site/SitePanel.tsx", "SitePanel"],
  ["design/DesignPanel.tsx", "DesignPanel"],
  [
    "interactions/catalog/CatalogInteractionsPanel.tsx",
    "CatalogInteractionsPanel",
  ],
  ["history/CatalogHistoryPanel.tsx", "CatalogHistoryPanel"],
  ["codeView/CatalogCodeViewPanel.tsx", "CatalogCodeViewPanel"],
];

describe("패널 루트 = CatalogWorkspaceGate", () => {
  it.each(ROOTS)("%s 의 %s 는 Gate 를 바로 반환한다", (file, component) => {
    const source = readFileSync(resolve(PANELS, file), "utf8");
    expect(source).toMatch(
      new RegExp(
        `export function ${component}\\(\\)\\s*\\{[\\s\\S]*?return \\(\\s*<CatalogWorkspaceGate>`,
      ),
    );
    // 본문만 감싸는 형태 (패널 root 가 Gate 바깥) 가 아니다.
    const body = source.slice(source.indexOf(`export function ${component}(`));
    const gate = body.indexOf("<CatalogWorkspaceGate>");
    expect(body.slice(0, gate)).not.toMatch(/className="panel[\s"]/);
  });
});

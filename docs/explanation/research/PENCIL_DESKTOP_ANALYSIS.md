# Pencil Desktop (highagency `dev.pencil.desktop`) 디컴파일 분석

> **분석 일자**: 2026-05-20
> **분석 대상**: `/Users/admin/work/pencil/` (= `Pencil.app/Contents/`), version **1.1.57**
> **제품 정체**: highagency 가 만든 **AI-First 디자인 도구**. 단순 figma 클론 아님 — Claude Agent SDK + OpenAI Codex SDK + Google Gemini (pi wrapper) 셋 모두 내장 + MCP 자가-등록 hub.
> **참고**: OpenPencil 오픈소스 figma fork 분석은 [OPENPENCIL_ANALYSIS.md](OPENPENCIL_ANALYSIS.md) / [OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md](OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md) 를 보라. 둘은 **완전히 다른 제품**이다.

본 문서는 composition 프로젝트의 reference 자료로, [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) D3 (시각 스타일) consumer / ADR-134 (AI Assistant LLM 통합) / ADR-142 (canonical document model) 와 1:1 비교할 수 있도록 정리한다.

---

## 0. 분석 재현 절차

```bash
# 1. asar 추출
cd /tmp && npm install --no-save @electron/asar
mkdir -p /tmp/pencil-extracted
node /tmp/node_modules/@electron/asar/bin/asar.mjs extract \
  /Users/admin/work/pencil/Resources/app.asar /tmp/pencil-extracted
# → 641MB extracted (asar 자체는 165MB)

# 2. 디렉토리
ls /tmp/pencil-extracted/
# node_modules/ out/ package.json
```

**디컴파일 불필요**:

- `out/*.js` 는 TS compiled output **minify 안 됨**. 변수명 그대로 (`PencilApp`, `DesktopResourceDevice` 등).
- `node_modules/@ha/*` 5개 내부 패키지는 **`.ts` 소스 파일까지 그대로 포함** (`src/*.ts` + `dist/{esm,cjs}/*.js`).
- `editor/assets/index.js` (React bundle 4.9MB) 만 minified — 통계 grep 으로 키워드 빈도 추출.

---

## 1. 앱 번들 구조

### 1.1. Electron macOS 앱 메타

| 키                         | 값                                                            |
| -------------------------- | ------------------------------------------------------------- |
| CFBundleIdentifier         | `dev.pencil.desktop`                                          |
| CFBundleDisplayName        | Pencil                                                        |
| CFBundleShortVersionString | 1.1.57                                                        |
| 파일 확장자                | `.pen` (CFBundleDocumentTypes)                                |
| URL 스킴                   | `pencil://`                                                   |
| 업데이터 채널              | GitHub `highagency/pencil-desktop-releases` (private repo)    |
| Sentry                     | `o4510271844122624.ingest.us.sentry.io` (sendDefaultPii true) |

### 1.2. `Contents/Frameworks/`

- `Electron Framework.framework` — Electron 본체
- `Pencil Helper.app` + 3 변형 (`GPU`, `Plugin`, `Renderer`) — 표준 Electron multi-process
- `Squirrel.framework` + `Mantle.framework` + `ReactiveObjC.framework` — Mac 자동 업데이트 stack
- `electron-updater` (npm) 와 Squirrel 둘 다 — JS 측 + native 측 동시 업데이트 처리

### 1.3. `Contents/Resources/`

```
app.asar              165MB  ← extract 시 641MB
app.asar.unpacked/    native modules (mcp-server-darwin-arm64 등)
app-update.yml        github: highagency/pencil-desktop-releases
icon.icns
57 *.lproj/           언어팩 (af, am, ar, bg, ... zh_TW)
```

### 1.4. `app.asar` 내부 root

```
out/                  TS compiled (main + editor + native MCP binary)
node_modules/         @ha/* 내부 5개 + @anthropic-ai + @openai + @sentry/electron + chokidar + electron-{log,store,updater} + eventemitter3
package.json          1.1.57, main=out/main.js
```

### 1.5. `out/` (Electron main 영역, 27 \*.js 파일)

| 파일                               | 줄수     | 역할                                                        |
| ---------------------------------- | -------- | ----------------------------------------------------------- |
| `main.js`                          | 250      | Electron entry (single-instance, custom protocol, CLI flag) |
| `app.js`                           | 372      | `PencilApp` class (orchestrator)                            |
| `desktop-resource-device.js`       | 781      | window-per-document, chokidar watcher, backup               |
| `desktop-mcp-adapter.js`           | 71       | MCP integrations 관리 (10개 외부 AI tool)                   |
| `agent-config-manager.js`          | 69       | Claude/Codex/Gemini login + key 통합                        |
| `agent-execute-config.js`          | 103      | `--agent-config` CLI parser + multi-window batch            |
| `claude.js`                        | 38       | Claude Code SDK 경로 + env (Bedrock/Vertex/Foundry 분기)    |
| `codex.js`                         | 16       | Codex SDK 경로                                              |
| `ide.js`                           | —        | IDE extension installer                                     |
| `ipc-electron.js`                  | 28       | IPCHost over `ipcRenderer.send("ipc-message")`              |
| `preload.js`                       | 19       | `contextBridge.exposeInMainWorld("electronAPI", ...)`       |
| `constants.js`                     | 21       | `APP_PROTOCOL="pencil"`, `CONFIG_FOLDER=~/.pencil`          |
| `updater.js`                       | 167      | electron-updater 래핑                                       |
| `menu.js`                          | 507      | macOS menu + recent files + grid 윈도우 배치                |
| `config.js`                        | —        | electron-store 영속화                                       |
| `mcp-server-darwin-arm64`          | binary   | **Go 컴파일된 MCP 서버 바이너리**                           |
| `data/*.pen`                       | 10 files | 4개 design system + welcome + new template                  |
| `editor/`                          | —        | Vite-built React SPA (renderer)                             |
| `assets/font/`, `assets/icon.icon` | —        | built-in 폰트/아이콘                                        |

### 1.6. `app.asar.unpacked/` (native modules)

```
node_modules/
├── @openai/codex/, codex-sdk/, codex-darwin-arm64/       ← OpenAI Codex SDK + native binary
├── @anthropic-ai/claude-agent-sdk/, claude-agent-sdk-darwin-arm64/
├── @mariozechner/clipboard-darwin-{universal,arm64}/     ← 네이티브 클립보드
├── koffi/                                                ← FFI 라이브러리 (Pencil 자체 native binding 호출용)
└── out/mcp-server-darwin-arm64                           ← MCP 서버 Go 바이너리 (별도 unpacked)
```

→ 두 가지 함의:

1. AI 의존성이 Production 의 **first-class citizen**. Anthropic + OpenAI 두 vendor 의 SDK 가 동시 번들됨.
2. MCP 서버가 별도 Go 바이너리 → `@ha/mcp/package.json` 의 `export-schemas` 스크립트가 `go run ./servers/mcp/cmd/export-schemas` 호출. JS 는 schema/installer wrapper 만.

### 1.7. `package.json` (extracted)

```json
{
  "name": "pencil",
  "productName": "Pencil",
  "version": "1.1.57",
  "main": "out/main.js",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.128",
    "@ha/agent": "file:../../lib/agent",
    "@ha/ipc": "file:../../lib/ipc",
    "@ha/mcp": "file:../../lib/mcp",
    "@ha/schema": "file:../../lib/schema",
    "@ha/shared": "file:../../lib/shared",
    "@openai/codex-darwin-x64": "npm:@openai/codex@^0.128.0-darwin-x64",
    "@openai/codex-sdk": "^0.128.0",
    "@sentry/electron": "^7.6.0",
    "chokidar": "^5.0.0",
    "electron-log": "^5.4.3",
    "electron-store": "^11.0.2",
    "electron-updater": "^6.6.2",
    "eventemitter3": "^5.0.1"
  }
}
```

→ `file:../../lib/{agent,ipc,mcp,schema,shared}` = monorepo 내부 패키지. `lib/` 라는 sibling 디렉토리에서 install. composition 의 `packages/{shared,specs,layout-flow,config}` 와 동일 패턴 — pnpm/npm workspace.

---

## 2. `.pen` 파일 포맷 v2.11 — canonical document SSOT

> 분석 source: `node_modules/@ha/schema/{generated-schema.md, pen.schema.json, src/generated-types-{public,private}.ts}` + `out/data/*.pen` 샘플.

### 2.1. 검증

- `out/data/pencil-welcome-desktop.pen` 의 첫 200 바이트:
  ```json
  {
    "version": "2.6",
    "children": [
      { "type": "frame", "id": "frame-1761929672442", "x": 1808, "y": -35,
        "name": "lunaris: design system components", ...
  ```
- 파일은 **plain UTF-8 JSON** (with very long lines). `file(1)`: `Unicode text, UTF-8 text`.
- MCP 서버 가드 메시지가 ".pen files are encrypted" 라고 안내하는 것은 **외부 접근 차단 의도 가드**일 뿐, 실제 file format 은 평문. 사용자가 직접 텍스트 에디터로 열면 읽힘.
- 현재 schema 는 `v2.11` (`CURRENT_SCHEMA_VERSION` in `src/index.ts`), built-in welcome 은 `v2.6` → migration system 존재 (welcome 은 hydration 시 정렬).

### 2.2. 4가지 universal value type — `*OrVariable`

```ts
export type Variable = string; // "$" prefix
export type NumberOrVariable = number | Variable;
export type Color = string; // #RGB | #RRGGBB | #RRGGBBAA
export type ColorOrVariable = Color | Variable;
export type BooleanOrVariable = boolean | Variable;
export type StringOrVariable = string | Variable;
```

→ **모든 leaf value가 variable binding 가능**. 사용자는 어떤 number/color/string/boolean 위치에든 `"$varName"` 을 넣을 수 있고, theme 별로 다른 값을 resolve.

### 2.3. Document root

```ts
interface Document {
  version: "2.11";
  themes?: { [axisName: string]: string[] }; // e.g. { "device": ["phone","tablet"] }
  imports?: { [alias: string]: string }; // 다른 .pen 파일 import (relative URI)
  variables?: {
    [name: string]:
      | { type: "boolean"; value: BooleanOrVariable | { value; theme? }[] }
      | { type: "color"; value: ColorOrVariable | { value; theme? }[] }
      | { type: "number"; value: NumberOrVariable | { value; theme? }[] }
      | { type: "string"; value: StringOrVariable | { value; theme? }[] };
  };
  fonts?: {
    // ★ private schema only
    name?: string;
    url?: string;
    style?: "normal" | "italic";
    weight?: number | [number, number];
    axes?: { tag?: string; start?: number; end?: number }[]; // variable font axes (wght/wdth/opsz/slnt)
  }[];
  children: Child[];
}
```

### 2.4. Entity 공통 필드

```ts
interface Entity extends Position {
  id: string; // unique, '/' 금지 (path separator 와 충돌)
  name?: string;
  context?: string; // AI/사용자 메모
  reusable?: boolean; // ★ true 면 component origin
  theme?: Theme; // 노드별 theme override
  enabled?: BooleanOrVariable;
  opacity?: NumberOrVariable;
  flipX?: BooleanOrVariable;
  flipY?: BooleanOrVariable;
  layoutPosition?: "auto" | "absolute";
  metadata?: { type: string; [key: string]: any };
  rotation?: NumberOrVariable;
}
```

### 2.5. 13~15 노드 타입

| Type         | 공개 schema           | private schema                       | 비고                                                       |
| ------------ | --------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `frame`      | ✓                     | ✓                                    | Layout 가진 컨테이너 (Rectangleish + Layout + clip + slot) |
| `group`      | ✓ children + effect만 | ✓ + Layout + Size                    | private 에서는 group 도 layout                             |
| `rectangle`  | ✓                     | ✓                                    | + cornerRadius (uniform or 4-tuple)                        |
| `ellipse`    | ✓                     | ✓                                    | + innerRadius (ring) + startAngle + sweepAngle (arc)       |
| `polygon`    | ✓                     | ✓                                    | + polygonCount                                             |
| `path`       | ✓                     | ✓                                    | SVG path + viewBox + fillRule                              |
| `text`       | ✓ TextContent=string  | ✓ TextContent= string \| TextStyle[] | textGrowth: auto / fixed-width / fixed-width-height        |
| `note`       | ✓                     | ✓                                    | 디자인 노트 (★ AI 메타 노드)                               |
| `prompt`     | ✓ +model              | ✓ +model                             | AI 프롬프트 노드 (★)                                       |
| `context`    | ✓                     | ✓                                    | AI 컨텍스트 노드 (★)                                       |
| `icon_font`  | ✓                     | ✓                                    | iconFontFamily: lucide/feather/Material/phosphor           |
| `script`     | ✓                     | ✓                                    | JS 로 children 동적 생성 (scriptUri + inputs)              |
| `ref`        | ✓                     | ✓                                    | reusable 노드 인스턴스                                     |
| `line`       | —                     | ✓                                    | 직선 (private only)                                        |
| `connection` | —                     | ✓                                    | 다이어그램 연결선 (source/target endpoint + anchor)        |

### 2.6. Layout (frame 한정)

```ts
interface Layout {
  layout?: "none" | "vertical" | "horizontal";
  // ↑ "none" = absolutely positioned children. flex 만, grid 없음!
  gap?: NumberOrVariable;
  layoutIncludeStroke?: boolean;
  padding?:
    | NumberOrVariable // 4면 동일
    | [NumberOrVariable, NumberOrVariable] // [vert, horiz]
    | [NumberOrVariable, NumberOrVariable, NumberOrVariable, NumberOrVariable]; // [top, right, bottom, left]
  justifyContent?:
    | "start"
    | "center"
    | "end"
    | "space_between"
    | "space_around";
  alignItems?: "start" | "center" | "end";
}
```

→ **flex only, grid 없음**. composition 의 Taffy WASM (Flex + Grid + Block) 대비 단순.

### 2.7. SizingBehavior — auto/percent 의 string DSL

```ts
type SizingBehavior = string;
// "fit_content" | "fill_container" | "fit_content(100)" 등
// - fit_content     = combined size of children
// - fill_container  = parent size
// - 괄호 안은 fallback (예: parent 가 layout 없을 때)
```

→ composition 의 `width: "auto"` / `width: "100%"` / `minWidth` 매핑을 단일 string field 로 표현. 사용자 인터페이스에서 single-input UX.

### 2.8. Reusable + Ref — Component model

핵심 코드 (`generated-schema.md` 178-182):

```ts
interface Ref extends Entity {
  type: "ref";
  ref: string; // ID of referenced reusable node
  descendants?: {
    [idPath: string]: {}; /*
      - `type` 없음 = property overrides (descendant 노드의 listed props 만 update)
      - `type` 있음 = replacement (descendant 노드 트리를 통째로 교체)
    */
  };
  [key: string]: any;
}
```

**path semantics**:

- 단순 id = top-level 노드
- `"instanceId/childId"` = component instance 안의 nested 노드
- 다중 nesting: `"outerInstance/innerInstance/leaf"` (slash chain)
- composition `RefNode.descendants` 와 **완전 동일 모델**.

### 2.9. Slot (frame 의 confirm 용도)

```ts
interface Frame {
  slot?: false | string[];
  // string[] entries = 이 slot 에 권장되는 reusable child component IDs
  // 예: menubar frame 의 slot=[ "MenuItem-id-1", "MenuItem-id-2" ]
}
```

→ composition 의 `slot` 시스템 (ADR-130 frame canonical, ADR-135 frame projection) 과 정합.

### 2.10. Built-in design systems

`out/data/*.lib.pen` 형식 (= library mode `.pen` 파일):

| 라이브러리           | 추정 컨셉                                       |
| -------------------- | ----------------------------------------------- |
| `halo.lib.pen`       | Apple-ish (typography-driven minimal)           |
| `lunaris.lib.pen`    | 별 테마 / 우주                                  |
| `nitro.lib.pen`      | 자동차 / 속도                                   |
| **`shadcn.lib.pen`** | **shadcn/ui port** (OSS UI 컴포넌트 라이브러리) |

각각 대응 template (`pencil-halo.pen`, ...) 와 함께 4 starter 제공.

---

## 3. MCP 서버 — Go binary + 14 tools

> source: `node_modules/@ha/mcp/{src,dist/schemas}/*` + `out/desktop-mcp-adapter.js`.

### 3.1. 구조

```
@ha/mcp
├── package.json    "export-schemas": "go run ./servers/mcp/cmd/export-schemas"
├── src/
│   ├── installer.ts        349 lines — 10개 외부 AI tool config 자동 install
│   ├── schemas.ts          14 import { ... } from "./schemas/*.json"
│   ├── types.ts            MCPServerConfig (stdio/sse/streamable_http)
│   ├── util.ts             getMcpBinaryName() / getMcpConfiguration()
│   └── index.ts            re-export
└── dist/schemas/           14 *.json (tool schema 정본)
```

→ **JS 는 wrapper 만**. 실제 tool 구현은 `out/mcp-server-darwin-arm64` (Go 컴파일 바이너리, app.asar.unpacked).

### 3.2. 14개 MCP tools (annotations.readOnly / destructive 분류)

| Tool                              | readOnly | destructive | idempotent | 역할                                                                     |
| --------------------------------- | :------: | :---------: | :--------: | ------------------------------------------------------------------------ |
| `batch_design`                    |    —     |      ✓      |     —      | **JS DSL 을 QuickJS sandbox 에서 실행해 mutation** (★ core mutation API) |
| `batch_get`                       |    ✓     |      —      |     —      | 다중 노드 query                                                          |
| `get_editor_state`                |    ✓     |      —      |     —      | viewport/selection/theme                                                 |
| `open_document`                   |    —     |      —      |     —      | .pen 파일 로드                                                           |
| `get_guidelines`                  |    ✓     |      —      |     ✓      | guide(task instructions) + style(visual archetype)                       |
| `get_screenshot`                  |    ✓     |      —      |     —      | 노드/캔버스 캡처                                                         |
| `snapshot_layout`                 |    ✓     |      —      |     —      | 레이아웃 계산 결과                                                       |
| `find_empty_space_on_canvas`      |    ✓     |      —      |     —      | 자동 배치 위치                                                           |
| `get_variables`                   |    ✓     |      —      |     —      | 문서 variables 읽기                                                      |
| `set_variables`                   |    —     |      —      |     —      | variables 쓰기                                                           |
| `search_all_unique_properties`    |    ✓     |      —      |     —      | "모든 X 값 찾기" (정합성 audit)                                          |
| `replace_all_matching_properties` |    —     |      ✓      |     —      | 일괄 치환                                                                |
| `export_nodes`                    |    ✓     |      —      |     —      | export to file                                                           |
| **`spawn_agents`**                |    —     |      ✓      |     —      | ★ 멀티 디자이너 agent 병렬 분기                                          |

### 3.3. `batch_design` 의 JS DSL (★ 핵심)

`dist/schemas/batch_design.json` 의 description (요약):

> "The batch_design executes a small javascript snippet to modify the document."
> "Operations execute sequentially; on error, all operations in the list will be rolled back."
> "Store the returned node IDs in the global scope by not using `const` or `let` to persist them between batch_design tool calls."

**7개 mutation primitives** (한 글자 함수):

```ts
const document: string;                                    // 전역 root id

I(parent: string, nodeData: Schema.Child): string;          // Insert  (returns new id)
C(path: string, parent: string,
  copyData: Schema.Child & { positionPadding?, positionDirection? }
): string;                                                  // Copy with descendants override
U(path: string, updateData: Schema.Child): void;            // Update (no id/type/ref change)
R(path: string, nodeData: Schema.Child): string;            // Replace (swap subtree)
M(nodeId: string, parent?: string, index?: number): void;   // Move
D(nodeId: string): void;                                    // Delete
G(nodeId: string, type: "ai" | "stock", prompt: string): void; // ★ AI/stock 이미지 생성, fill 로 적용
```

**예제** (description 에서 인용):

```js
// reusable component instance + override
card = I(body, { type: "ref", ref: "CardComp" });
U(card + "/dASd2f", { content: "New Title" });
newTitle = R(card + "/vvd34d", { type: "text", content: "Custom Title" });

// loop + template
mainContent = I("29c0s", {
  type: "frame",
  layout: "vertical",
  gap: 24,
  padding: 32,
});
stats = I(mainContent, { type: "frame", layout: "vertical", gap: 16 });
for (const title of ["Revenue", "Active users", "Conversion"]) {
  const c = I(stats, {
    type: "ref",
    ref: "QMBKc",
    width: "fill_container",
    height: 120,
  });
  U(c + "/fes34s", { content: title });
}

// AI 이미지 fill
heroImg = I("parentId", {
  type: "frame",
  name: "Hero Image",
  width: 400,
  height: 300,
});
G(heroImg, "ai", "modern office workspace bright");
```

**핵심 규칙**:

- `id` 필드는 절대 설정 금지 (자동 생성 + return).
- `const`/`let` 안 쓰고 전역 변수에 저장하면 batch_design 콜 간 영속 (다음 호출에서 변수 재사용 가능).
- path 의 `"a/b/c"` 는 nested component instance 의 descendant 한정 (일반 layer hierarchy 는 단일 id).

**Transaction model**: 한 batch_design 콜 내 operations 는 sequential, 오류 시 **전체 rollback**.

### 3.4. `spawn_agents` — multi-agent prompt engineering 정수

`dist/schemas/spawn_agents.json` description (요약):

> "Use this tool to break up design tasks to multiple designer agents to work in parallel."
> "Always create one less designer agent then needed, since the existing agent session will accomplish the last remaining part of the task."
> "Create maximum 8-10 designer agents at once."
> "Designer agents do not inherit guidelines from the parent agent."
> "Make sure the designer agents prompts describe the designs consistently, so if matching styles are needed, they will all look the same based on the prompt."
> "Design agents can come up with the design layout themselves, it's important to NOT include any layout information, sizes, colors or variable names in the prompt."

**Input**:

```ts
{
  filePath: string;
  config: { prompt: string; containerNodes: string[] }[];
}
```

**핵심 통찰**:

1. **parent 도 작업의 1/N 수행** — N개 작업이면 N-1 agent 만 spawn, 마지막은 parent 가 직접. "게으른 마스터" 패턴.
2. **containerNodes 격리** — 각 agent 가 자기 placeholder frame 안에서만 mutation → 충돌 없음.
3. **guideline 자동 상속 안 함** — 각 agent prompt 에 guideline name + params 명시 의무.
4. **layout/size/color 금지** — agent 가 디자인 자유. 일관성 보장은 prompt 자체에 (예: "modern fintech mobile app" 처럼 추상 컨셉만).

→ composition 의 `Agent` 도구 (특히 `dispatching-parallel-agents` skill) prompt template 차용 후보.

### 3.5. 10개 외부 AI tool 자가-등록 (`MCP_CONFIG_MAP`)

`src/installer.ts:9-20` 에서:

```ts
const MCP_CONFIG_MAP: Record<MCPIntegration, string> = {
  claudeCodeCLI: path.join(".claude.json"),
  codexCLI: path.join(".codex", "config.toml"), // ★ TOML, key = mcp_servers
  geminiCLI: path.join(".gemini", "settings.json"),
  windsurfIDE: path.join(".codeium", "windsurf", "mcp_config.json"),
  cursorCLI: path.join(".cursor", "mcp.json"),
  antigravityIDE: path.join(".gemini", "antigravity", "mcp_config.json"),
  openCodeCLI: path.join(".config", "opencode", "opencode.json"),
  copilotIDE: path.join("mcp.json"),
  kiroCLI: path.join(".kiro", "settings", "mcp.json"),
  claudeDesktop: path.join("Claude", "claude_desktop_config.json"),
};
```

→ 사용자가 어떤 AI tool 을 쓰든 pencil MCP 가 자동 등록. composition 환경의 `mcp__pencil__*` 도구 가 이 경로로 활성화된다.

**install 동작** (`installer.ts` 의 `installMCP`):

- config file 존재하면 read → JSON.parse 또는 `toml.parse` (codexCLI 한정)
- `mcpServers` (또는 codex 의 `mcp_servers`) 키 아래 `pencil` 엔트리 추가
- stdio command = unpacked binary 절대 경로 + `--app desktop --agent <integrationName>` args

### 3.6. `getMcpConfiguration` 시그니처

`src/util.ts:39-65`:

```ts
export function getMcpConfiguration({
  folderPath,
  appName,
  conversationId,
  enableSpawnAgents,
  agentName,
}): MCPServerConfig {
  return {
    name: "pencil",
    transport: "stdio",
    command: path.join(folderPath, "out", getMcpBinaryName()),
    args: [
      "--app",
      appName,
      ...(conversationId ? ["--conversation_id", conversationId] : []),
      ...(enableSpawnAgents ? ["--enable_spawn_agents"] : []),
      ...(agentName ? ["--agent", agentName] : []),
    ],
    env: {},
  };
}
```

→ **`--enable_spawn_agents` flag** 가 명시적 — `spawn_agents` 는 default 비활성, parent agent 가 명시 활성화 시에만 노출. (보안: AI 가 무한 fan-out 못 하도록.)

---

## 4. AI 통합 — 3-backend Unified PencilAgent

> source: `node_modules/@ha/agent/src/{types,create-agent,claude/index,codex/index,pi/index}.ts`.

### 4.1. Factory pattern

`src/create-agent.ts`:

```ts
export function createAgent(type: AgentType, config: AgentConfig): PencilAgent {
  switch (type) {
    case "claude":
      return new ClaudeAgent(config);
    case "codex":
      return new CodexAgent(config);
    case "gemini":
      return new PiAgent(config, "google"); // ★ third-party wrapper
  }
}
```

| Agent         | 구현 base                                                                     |
| ------------- | ----------------------------------------------------------------------------- |
| `ClaudeAgent` | 직접 `@anthropic-ai/claude-agent-sdk` 의 `query()`                            |
| `CodexAgent`  | 직접 `@openai/codex-sdk` 의 `Codex.startThread()` (dynamic import — ESM-only) |
| `PiAgent`     | 외부 OSS `@earendil-works/pi-{ai,coding-agent,agent-core}` 경유               |

→ **Anthropic / OpenAI 는 first-class agent SDK 제공, Google 은 없음** → pi (제3자 OSS) 가 Gemini provider adapter. 향후 Google 이 공식 agent SDK 출시 시 직접 통합 가능 (composition ADR-134 도 동일 trade-off 직면).

### 4.2. 공통 인터페이스

```ts
export interface PencilAgent extends EventEmitter<PencilAgentEvents> {
  execute(prompt: string, files?: FileAttachment[]): Promise<void>;
  stop(): Promise<void>;
}

export type PencilAgentEvents = {
  "session-event": (event: AgentSessionEvent) => void;
};

export interface AgentConfig {
  logger;
  model;
  systemPrompt;
  maxTurns;
  mcpServers: MCPServerConfig[]; // ★ self-MCP injection 가능
  filePath;
  sessionId;
  packagePath;
  includePartialMessages;
  apiKey;
  cwd;
  disallowedTools;
  conversationId;
  effort;
  env;
  inProcessToolHandler; // out-of-process MCP 대신 in-process tool dispatch
  dangerouslySkipPermissions; // Claude: bypassPermissions / Codex: danger-full-access + approvalPolicy never
}
```

### 4.3. `session-event` 타입 (모든 backend 정규화)

이벤트 타입을 **3 backend 가 모두 동일 channel 로 emit** 하도록 정규화:

| Event type                   | Payload                         | Origin (Claude / Codex / Pi)                   |
| ---------------------------- | ------------------------------- | ---------------------------------------------- |
| `start`                      | `{sessionId}`                   | 모두                                           |
| `end`                        | `{sessionId, content:{reason}}` | 모두 (abort/complete/error)                    |
| `message`                    | `{source:"assistant", text}`    | Claude assistant block                         |
| `stream-message`             | `{text}`                        | text_delta / item.started "agent_message"      |
| `thinking`                   | `{text}`                        | Claude thinking block / Codex `reasoning` item |
| `tool-use-start`             | `{id, name}`                    | 모두 (도구 호출 시작)                          |
| `tool-use` (streaming:true)  | `{id, name, input}`             | partial JSON progressively                     |
| `tool-use` (streaming:false) | 동일                            | final input                                    |
| `tool-result`                | `{id, output, success}`         | 도구 결과                                      |
| `permission-request`         | `{name, input, resolve}`        | Claude canUseTool callback only                |

### 4.4. ClaudeAgent 핵심 (`claude/index.ts:36-186`)

```ts
const options: Options = {
  model: this.config.model === "custom-model" ? undefined : this.config.model,
  pathToClaudeCodeExecutable: this.getExecutablePath(),
  env: this.config.env,
  cwd: this.config.cwd,
  settingSources: ["local", "project", "user"],         // ★ Claude Code settings 우선순위
  mcpServers: mcpServers,
  maxTurns: this.config.maxTurns || 500,
  allowedTools: ["WebSearch", "WebFetch"],              // + MCP tools 자동
  disallowedTools,                                       // `mcp__pencil__<toolName>` 차단
  systemPrompt: {
    type: "preset",
    preset: "claude_code",                              // claude_code preset 사용
    append: systemPrompt,
  },
  thinking: { type: "enabled", display: "summarized" }, // extended thinking 요약 노출
  ...(this.config.dangerouslySkipPermissions
    ? { allowDangerouslySkipPermissions: true, permissionMode: "bypassPermissions" }
    : undefined),
  includePartialMessages: this.config.includePartialMessages,
  effort: this.config.effort,
  canUseTool: async (toolName, input, options) => { ... },  // permission gate
};
```

**cwd-containment auto-permission** (★ 매우 깔끔한 패턴):

```ts
canUseTool: async (toolName, input, options) => {
  // Only allow file access inside the current working directory.
  if (this.config.cwd && input.file_path
      && isPathInside(input.file_path as string, this.config.cwd)) {
    return { behavior: "allow", updatedInput: input };
  }
  if (this.config.cwd && options.blockedPath
      && isPathInside(options.blockedPath, this.config.cwd)) {
    return { behavior: "allow", updatedInput: input };
  }
  // 그 외: UI 에 permission-request emit → 사용자 응답 wait
  const result = await new Promise<"allow"|"always-allow"|"deny">((resolve) => {
    this.emit("session-event", {
      type: "permission-request", sessionId, name: toolName, input, resolve,
    });
  });
  ...
}
```

→ cwd 안 파일 접근은 자동 allow. 사용자가 prompt 마다 권한 클릭할 필요 없음. composition 차용 가치 매우 높음.

**Session resume**:

```ts
const sessionFound = (await listSessions()).find(
  (s) => s.sessionId === sessionId,
);
if (sessionFound) {
  options.resume = sessionId;
  if (sessionFound.cwd) options.cwd = sessionFound.cwd; // resume 시 cwd 복원
} else {
  // 신규 세션
}
```

**Login type 매핑** (`out/claude.js:19-37`):

```ts
function getClaudeCodeEnv() {
  const loginType = desktopConfig.get("claudeLoginType");
  const baseEnv = {
    ...process.env,
    ANTHROPIC_BETAS: "fine-grained-tool-streaming-2025-05-14",
  };
  const customFlags = {};
  switch (loginType) {
    case "api-key":
      customFlags.ANTHROPIC_API_KEY = desktopConfig.get("claudeApiKey");
      break;
    case "aws-bedrock":
      customFlags.CLAUDE_CODE_USE_BEDROCK = "1";
      break;
    case "google-vertex":
      customFlags.CLAUDE_CODE_USE_VERTEX = "1";
      break;
    case "microsoft-foundry":
      customFlags.CLAUDE_CODE_USE_FOUNDRY = "1";
      break;
  }
  return { ...baseEnv, ...customFlags };
}
```

→ 4가지 backend: API key 직접 / AWS Bedrock / Google Vertex / Microsoft Foundry.

### 4.5. ClaudeAgent — Streaming Partial JSON 라이브 미리보기 (★ 본질 UX)

`claude/index.ts:212-499` 핵심 흐름:

```ts
const batchDesignCalls = new Map<number, { filePath?; input; acc; id }>();
const spawnAgentCalls = new Map<
  number,
  { filePath?; config: object[]; acc; id; index }
>();
const assistantTextByIndex = new Map<number, { acc }>();
const extendedThinkingByIndex = new Map<number, { acc }>();

for await (const message of this.agentQuery) {
  // ... assistant text/thinking handling

  if (message.type === "stream_event") {
    if (
      message.event.type === "content_block_start" &&
      message.event.content_block.type === "tool_use" &&
      message.event.content_block.name === "mcp__pencil__batch_design"
    ) {
      batchDesignCalls.set(message.event.index, {
        input: "",
        acc: "",
        id: message.event.content_block.id,
      });
    }

    if (
      message.event.type === "content_block_delta" &&
      message.event.delta.type === "input_json_delta" &&
      batchDesignCalls.has(message.event.index)
    ) {
      const call = batchDesignCalls.get(message.event.index);
      call.acc += message.event.delta.partial_json;

      const parsed = completePartialBatchDesign(call.acc);
      if (parsed?.input && parsed.input.length > call.input.length) {
        const newInput = parsed.input.slice(call.input.length); // 새 substring 만
        call.filePath = parsed.filePath;
        call.input = parsed.input;

        this.emit("session-event", {
          type: "tool-use",
          sessionId,
          id: call.id,
          name: "mcp__pencil__batch_design",
          input: { filePath: parsed.filePath, input: newInput },
          streaming: true,
        });
      }
    }
    // spawn_agents 도 동일 패턴 (call.config 의 새 entries 만 progressively emit, 마지막 entry 보류)
  }
}
```

**핵심 helper — `extractJsonStringFieldPrefix`** (`claude/index.ts:741-782`):

```ts
function extractJsonStringFieldPrefix(
  source: string,
  key: string,
): { value: string; complete: boolean } | undefined {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"`).exec(source);
  if (!match) return undefined;

  let index = match.index + match[0].length;
  let rawValue = "";

  while (index < source.length) {
    const char = source[index++];
    if (char === '"') {
      return { value: JSON.parse(`"${rawValue}"`), complete: true };
    }
    if (char !== "\\") {
      rawValue += char;
      continue;
    }
    if (index >= source.length) break;
    const escapeStart = index - 1;
    const escaped = source[index++];
    if (escaped === "u") {
      const hex = source.slice(index, index + 4);
      if (!/^[0-9A-Fa-f]{4}$/.test(hex)) break;
      index += 4;
    }
    rawValue += source.slice(escapeStart, index);
  }
  return { value: JSON.parse(`"${rawValue}"`), complete: false };
}
```

→ 정규식으로 `"input": "...` 시작 찾고, **미완료 escape 직전 stable prefix 만** 추출. `JSON.parse(\`"${rawValue}"\`)` 로 안전 decode.

**대안 — `jsonrepair`** (`completePartialSpawnAgents`):

```ts
function completePartialSpawnAgents(str: string) {
  try {
    let res = str.slice(0);
    res = jsonrepair(res); // 불완전 JSON 복구
    const parsed = JSON.parse(res);
    if (parsed.config && !Array.isArray(parsed.config)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
```

**최종 효과**:

- AI 가 JS 코드를 token-by-token 작성하는 동안
- 새로 생긴 substring 만 progressively `tool-use` (streaming:true) 이벤트로 emit
- editor 가 streaming input 을 받아 캔버스에 노드 progressively 추가
- 사용자에게 "AI 가 디자인하는 것을 보는" UX 제공

composition 의 Skia 렌더 + ADR-134 와 직접 결합 가능. 차용 가치 매우 높음.

### 4.6. CodexAgent 차이 (`codex/index.ts`)

```ts
// Dynamic import (ESM-only SDK)
const { Codex } = await import("@openai/codex-sdk");

const codex = new Codex({
  codexPathOverride: this.getExecutablePath(),
  apiKey: this.config.apiKey,
  env: { ...env, RUST_LOG: "codex_rmcp_client=debug,..." },
  config: {
    // NOTE: systemPrompt 는 first-turn user input 에 prepend.
    // Codex SDK 가 config overrides 를 --config CLI args 로 serialize → Windows 32KB cmdline limit
    // 초과 시 spawn ENAMETOOLONG. 그래서 systemPrompt 는 안 보냄.
    mcp_servers: {
      pencil: {
        ...mcpTransport,
        default_tools_approval_mode: "approve",
        disabled_tools: this.config.disallowedTools ?? [],
        startup_timeout_sec: 30,
        tool_timeout_sec: 5 * 60,
      },
    },
  },
});

const threadOptions: ThreadOptions = {
  model: this.config.model,
  skipGitRepoCheck: true,
  workingDirectory: this.config.cwd,
  webSearchEnabled: true,
  sandboxMode: dangerouslySkipPermissions
    ? "danger-full-access"
    : "workspace-write",
  modelReasoningEffort: this.config.effort,
  approvalPolicy: "untrusted",
};

this.thread = sessionId
  ? codex.resumeThread(sessionId, threadOptions)
  : codex.startThread(threadOptions);
const { events } = await this.thread.runStreamed(promptContent, { signal });
```

**Codex event → session-event 매핑**:

```ts
// item.started
case "mcp_tool_call":      → "tool-use-start"
case "agent_message":      → "stream-message"
case "reasoning":          → "thinking"
case "todo_list":          → "tool-use-start" (name: "todo_write")
case "command_execution":  → "tool-use-start" (name: "Bash")
case "web_search":         → "tool-use-start" (name: "WebSearch")
```

→ Codex 의 vendor-specific item 타입을 Claude 와 동일 channel 로 정규화. composition AI 추상화 layer 직접 차용 가능.

### 4.7. PiAgent (Gemini wrapper, `pi/index.ts:38-66`)

```ts
async function loadPiAgentDependencies() {
  const [
    { Agent },
    { getModel },
    { AuthStorage, createAgentSession, DefaultResourceLoader, getAgentDir,
      ModelRegistry, SessionManager },
  ] = await Promise.all([
    import("@earendil-works/pi-agent-core"),
    import("@earendil-works/pi-ai"),
    import("@earendil-works/pi-coding-agent"),
  ]);
  ...
}
```

→ 외부 OSS `earendil-works/pi-*` (Tolkien 신화의 "Earendil") 의 wrapper. Pencil 의 `@ha/mcp` 의 `toolSchemas` 를 pi 의 `ToolDefinition` 으로 변환하여 in-process MCP 처럼 동작.

**`inProcessToolHandler` callback**: out-of-process MCP server 대신 host renderer 내부에서 tool 디스패치. 같은 process 라 latency 작음.

### 4.8. Headless multi-agent batch mode

`out/agent-execute-config.js:65-103`:

```ts
function parseAgentExecuteConfig(configString) {
  try {
    return JSON.parse(configString);
  } catch {
    try {
      const filePath = path.isAbsolute(configString)
        ? configString
        : path.resolve(process.cwd(), configString);
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return undefined;
    }
  }
}

async function openWithAgentExecuteConfig(ipcDeviceManager, loadFile, config) {
  for (const c of config) {
    await loadFile(c.file, /*zoomToFit*/ true);
    await ipcDeviceManager.waitForDocumentReady(filePath);
    const ipc = await ipcDeviceManager.getIPC(filePath);
    const files = resolveAttachments(c.attachments, process.cwd());
    ipc.notify("prompt-agent", {
      prompt: c.prompt,
      modelID: mapCanvasModelsToThirdParty("claude", loginType, c.model),
      files,
    });
  }
}
```

**호출 예시**:

```bash
pencil --agent-config '[
  {"file":"design1.pen","prompt":"Landing page","attachments":["./brief.md","./logo.png"]},
  {"file":"design2.pen","prompt":"Dashboard"},
  {"file":"design3.pen","prompt":"Mobile app"}
]'
```

→ 3 윈도우 동시 열림 + 각각에 자동 prompt dispatch. `--agent-config.length >= 2` 시 `organizeWindowsIntoGrid()` 호출 (`out/menu.js`). CI/CD 또는 batch design generation 모드. `spawn_agents` 와 결합 시 단일 호출 → 수십~수백 시안.

### 4.9. AgentConfigManager (3-backend 통합 관리)

`out/agent-config-manager.js`:

```ts
get() {
  return {
    claude: {
      loginType: desktopConfig.get("claudeLoginType"),    // api-key | aws-bedrock | google-vertex | microsoft-foundry
      apiKeyStored: Boolean(desktopConfig.get("claudeApiKey")),
      defaultModel: getDefaultModel("claude", claudeLogin),
      supportedModels: getSupportedModels("claude", claudeLogin),
    },
    codex: {
      loginType: desktopConfig.get("codexLoginType"),     // chatgpt | api-key
      apiKeyStored: Boolean(desktopConfig.get("codexApiKey")),
      defaultModel, supportedModels,
    },
    gemini: {
      loginType: desktopConfig.get("geminiLoginType"),    // api-key
      apiKeyStored: Boolean(desktopConfig.get("geminiApiKey")),
      defaultModel, supportedModels,
    },
    allSupportedModels: [...claudeModels, ...codexModels, ...geminiModels],
  };
}
```

→ 3 backend 별 login state + supported models 통합 dispatch. `mapCanvasModelsToThirdParty(provider, login, modelID)` 가 추상 model 이름 (예: `"sonnet-flagship"`) 을 vendor 별 실제 모델명 (예: `"claude-3-5-sonnet-20241022"`) 으로 변환.

→ composition ADR-134 가 동일 추상화 필요 — 모델 EOL/출시 와 무관하게 UI 안정.

---

## 5. Electron main process — Window-per-document

> source: `out/{main,app,desktop-resource-device}.js`.

### 5.1. PencilApp class (orchestrator, `out/app.js`)

```ts
class PencilApp {
  constructor() {
    this.mcpAdapter = new DesktopMCPAdapter(APP_FOLDER_PATH);
    this.transportServer = new TransportServerManager(
      logger,
      this.mcpAdapter.getAppName(),
    );
    this.ipcDeviceManager = new IPCDeviceManager(
      this.transportServer,
      logger,
      APP_FOLDER_PATH,
      this.mcpAdapter.getAppName(),
      undefined,
      async (filePath) => {
        await this.loadFile(filePath);
      },
    );
    this.agentConfigManager = new AgentConfigManager(this.ipcDeviceManager);
  }
}
```

4개 핵심 컴포넌트 DI:

1. **DesktopMCPAdapter** — 외부 AI tool 통합 활성화
2. **TransportServerManager** — `@ha/ipc` 의 unix socket / named pipe transport (multi-process 통신용)
3. **IPCDeviceManager** — 디바이스 (= 윈도우 = 1 .pen 파일) 추상화
4. **AgentConfigManager** — Claude/Codex/Gemini key + login 관리

### 5.2. main.js entry (`out/main.js:64-198`)

```ts
const gotTheLock = app.requestSingleInstanceLock();   // single-instance
if (!gotTheLock) { app.quit(); }
else {
  app.on("second-instance", (_event, commandLine) => {
    // 두 번째 실행: 기존 윈도우 focus + fileArg 있으면 그 파일 load
    const fileArg = commandLine.find((arg) => arg.endsWith(".pen"));
    if (fileArg && pencilApp) pencilApp.loadFile(resolveFilePath(fileArg), true);
  });
}

protocol.registerSchemesAsPrivileged([{
  scheme: APP_PROTOCOL,                       // "pencil"
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

app.whenReady().then(async () => {
  if (!IS_DEV) {
    // production 에서만 protocol.handle 등록
    protocol.handle(APP_PROTOCOL, (request) => {
      // pencil:// URL → file:// (editor/index.html 또는 assets)
    });
  }
  pencilApp = new PencilApp();
  await pencilApp.initialize(initArgs);
});

function getInitArgs() {
  for (let i = 0; i < args.length; i++) {
    if (arg === "--agent-config") { ... result.agentExecuteConfig = config; }
    else if (arg === "--file" && i + 1 < args.length) { ... result.filePath = resolvedPath; }
  }
}

app.on("open-file", async (event, filePath) => {
  // macOS dock drop / Finder double-click 진입점
  event.preventDefault();
  if (path.extname(filePath) !== ".pen") return;
  if (pencilApp) pencilApp.loadFile(filePath, true);
  else initArgs = { filePath };
});

app.on("activate", async () => {
  // dock icon 클릭 + 윈도우 없으면 새 문서
  if (pencilApp && BrowserWindow.getAllWindows().length === 0) {
    await pencilApp.loadFile("pencil-new.pen");
  }
});
```

→ 표준 macOS multi-document app pattern + CLI flag 두 가지 (`--file`, `--agent-config`).

### 5.3. PencilApp.loadFile (`out/app.js:91-298`)

핵심 flow:

```ts
async loadFile(filePath, zoomToFit = false) {
  // 1. 이미 열린 device 있으면 focus
  const existingDevice = this.ipcDeviceManager.getResourceDevice(filePath);
  if (existingDevice) { existingDevice.focusWindow(); return; }

  // 2. 파일 경로 해석
  let fileToRead = filePath.startsWith("pencil:")
    ? getFilePathForPencilURI(filePath)
    : path.isAbsolute(filePath) ? filePath
    : path.join(app.getAppPath(), "out", "data", filePath);   // out/data/*.pen 안 built-in

  // 3. 백업 비교 (backup mtime > file mtime 이면 복원)
  if (!filePath.startsWith("pencil:")) {
    const backupPath = backupFilePath(fileToRead);
    if (backupStat && fileStat.mtime < backupStat.mtime) {
      fileToRead = backupPath;
      fileIsDirty = true;
    }
  }

  // 4. fileContent read (UTF-8)
  fileContent = await fs.promises.readFile(fileToRead, "utf8");

  // 5. Device 생성 (= BrowserWindow + DesktopResourceDevice)
  const device = new DesktopResourceDevice(filePath, fileContent, fileIsDirty,
    (path) => ipc.request("save", pathToFileURL(path).toString()),
    () => this.isQuitting);
  const ipc = new IPCElectron(device.getWindow().webContents);

  // 6. IPC 명령 30+개 등록 (ipc.on/handle)
  ipc.handle("get-mcp-config", () => {
    const mcpConfig = getMcpConfiguration({ folderPath, appName: "desktop" });
    return JSON.stringify(mcpConfig);
  });
  ipc.handle("agent-set-api-key", async ({agentType, loginType, apiKey}) => {
    this.agentConfigManager.set(agentType, loginType, apiKey);
  });
  ipc.on("desktop-open-terminal", ({workspaceFolder, agentType}) => {
    openTerminal(workspaceFolder, agentType);   // claude / codex CLI 외부 실행
  });
  // ... 30+ more

  // 7. device 이벤트 forward
  device.on("prompt-agent", (prompt, modelID, files) => {
    ipc.notify("prompt-agent", {
      prompt,
      modelID: mapCanvasModelsToThirdParty("claude", loginType, modelID),
      files,
    });
  });

  // 8. URL load (pencil://editor/#/editor/<file>)
  await device.loadURL(...);
}
```

### 5.4. DesktopResourceDevice (`out/desktop-resource-device.js`)

핵심 책임:

- `BrowserWindow` 생성 + 윈도우 옵션 (vibrancy, traffic light, hiddenInset titleBar)
- `chokidar` watcher 로 외부 파일 변경 감지
- **백업 메커니즘**: `backupFilePath()` 위치에 throttled 저장 (autosave 백업)
- close 시 dirty 면 confirm dialog (saveResource → 사용자 응답 wait)
- `chokidar.watch()` 로 파일 변경 → `ipc.notify("file-changed", uri)`
- AgentPackagePath 의 `claude` / `codex` 분기 (`getAgentPackagePath(type)`)

**Login per agent type** (`out/desktop-resource-device.js:610-622`):

```ts
getAgentApiKey(type) {
  return type === "codex"
    ? (desktopConfig.get("codexLoginType") === "api-key" ? desktopConfig.get("codexApiKey") : undefined)
    : type === "gemini"
      ? desktopConfig.get("geminiApiKey")
      : (desktopConfig.get("claudeLoginType") === "api-key" ? desktopConfig.get("claudeApiKey") : undefined);
}
```

**Temporary vs persistent**:

```ts
isTemporary() {
  const resource = this.getResourcePath();
  return !path.isAbsolute(resource) && resource.startsWith("pencil-");
}

async getResourceFolderPath() {
  if (!this.isTemporary()) return path.dirname(this.getResourcePath());
  const resourcePath = path.join(CONFIG_FOLDER, "resources", this.id);
  fs.mkdirSync(resourcePath, { recursive: true });
  return resourcePath;
}
```

→ `pencil-new.pen` / `pencil-welcome-desktop.pen` 처럼 prefix + non-absolute = **휘발 폴더** `~/.pencil/resources/<uuid>/`. dispose 시 폴더 통째 rm.

### 5.5. `.lib.pen` library mode

```ts
async turnIntoLibrary() {
  if (this.isTemporary() || this.filePath.startsWith("pencil:")
      || this.filePath.toLowerCase().endsWith(".lib.pen")) {
    throw new Error(`Can't turn ${this.filePath} into a library`);
  }
  // 파일을 .lib.pen 으로 rename
}
```

→ design system 라이브러리 모드. 다른 .pen 의 `imports` 가 이 파일을 참조.

### 5.6. IPC layer (`out/ipc-electron.js`)

```ts
class IPCElectron extends shared_1.IPCHost {
  constructor(webContents) {
    const onMessage = (callback) => {
      const listener = (event, message) => {
        if (event.sender.id === webContents.id) callback(message);
      };
      ipcMain.on("ipc-message", listener);
      return () => ipcMain.off("ipc-message", listener);
    };
    const sendMessage = (message) => {
      if (!webContents.isDestroyed()) webContents.send("ipc-message", message);
    };
    super(onMessage, sendMessage, logger);
  }
}
```

→ **단일 channel** (`"ipc-message"`) 사용. `@ha/shared` 의 `IPCHost` 가 method dispatch (request/notify/handle). composition iframe ↔ Builder 의 postMessage 패턴과 동일 추상화.

### 5.7. preload.js (`out/preload.js`)

```ts
contextBridge.exposeInMainWorld("PENCIL_APP_NAME", "Electron");
contextBridge.exposeInMainWorld("PENCIL_ARCH", process.arch);
contextBridge.exposeInMainWorld(
  "IS_DEV",
  process.env.NODE_ENV === "development",
);
contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (message) => ipcRenderer.send("ipc-message", message),
  onMessageReceived: (callback) => {
    ipcRenderer.on("ipc-message", (_event, message) => callback(message));
  },
  resolveFilePath: (file) => webUtils.getPathForFile(file), // drag-and-drop 파일 경로
});
```

→ `contextIsolation: true` + 최소 surface. `webUtils.getPathForFile(file)` 가 흥미로움 — drag-drop 으로 받은 File 객체의 native 경로 추출.

### 5.8. Constants (`out/constants.js`)

```ts
exports.APP_PROTOCOL = "pencil";
exports.EDITOR_PORT = process.env.EDITOR_PORT || "3000";
exports.APP_FOLDER_PATH = app.isPackaged
  ? path.resolve(__dirname, "..", "..", "app.asar.unpacked")
  : path.resolve(__dirname, "..");
exports.CONFIG_FOLDER = path.join(os.homedir(), ".pencil");
exports.EVAL_FOLDER = process.env.INTERNAL_PENCIL_EVAL_FOLDER; // ★ 내부 eval 시스템
```

→ `~/.pencil/` config folder (composition `~/.claude/` 대응). `INTERNAL_PENCIL_EVAL_FOLDER` 는 내부 평가/벤치 환경변수 — 정합성 회귀 test.

---

## 6. Renderer — React + Skia WASM + QuickJS sandbox

> source: `out/editor/{index.html, assets/}`.

### 6.1. CSP (renderer 통신 surface)

`editor/index.html`:

```
default-src 'self';
script-src  'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com;
connect-src 'self'
  http://localhost:3001 http://api.localhost:3001
  https://api.pencil.dev
  https://api.reve.com                           ← ★ AI 이미지 생성
  https://*.vercel.app
  https://*.ingest.us.sentry.io
  https://*.posthog.com
  https://fonts.gstatic.com https://fonts.googleapis.com
  https://unpkg.com
  https://hctfc8iexhqk0x3o.public.blob.vercel-storage.com
  https://images.unsplash.com                    ← stock 이미지
  https://status.claude.com https://status.openai.com
  https://storage.googleapis.com;
img-src  'self' data: blob: https://images.unsplash.com https://*.public.blob.vercel-storage.com;
font-src 'self' data: blob: https://fonts.gstatic.com https://unpkg.com ...;
worker-src 'self' blob: data:;
child-src 'self' blob:;
```

→ backend stack 추론:

- `api.pencil.dev` — 자체 backend
- `api.reve.com` — Reve (`G("ai", prompt)` 이미지 생성)
- `images.unsplash.com` — Unsplash (`G("stock", query)`)
- Vercel hosting + blob storage
- Sentry + PostHog
- `status.claude.com` / `status.openai.com` — vendor uptime 표시
- 'unsafe-eval' 허용 — QuickJS WASM 사용 위함

### 6.2. Asset 구조

| 파일                                           | 크기      | 역할                                         |
| ---------------------------------------------- | --------- | -------------------------------------------- |
| `index.html`                                   | —         | Vite SPA entry                               |
| `assets/index.js`                              | **4.9MB** | main React bundle (unmarkable, minified)     |
| `assets/index.css`                             | —         | Tailwind compiled                            |
| `assets/pencil.wasm`                           | **9.5MB** | Skia + custom bindings (추정)                |
| `assets/browserAll.js`                         | 43KB      | browser-only shared (Sentry init 등)         |
| `assets/webworkerAll.js`                       | 183KB     | Worker bundle                                |
| `assets/index2.js`                             | 1.4KB     | QuickJS enums/flags 정의                     |
| `assets/ffi.js`                                | 7.9KB     | **QuickJS-Emscripten FFI wrapper** (`QTS_*`) |
| `assets/ffi2.js`                               | 6.9KB     | FFI variant                                  |
| `assets/module-ES6BEMUI.js`                    | 34KB      | QuickJS standard module                      |
| `assets/module-asyncify-2EFITU5U.js`           | 2.6KB     | QuickJS async variant                        |
| `assets/emscripten-module.browser-F76W5DM6.js` | 1.3MB     | QuickJS WASM loader (variant 1)              |
| `assets/emscripten-module.browser-XIKQQPVU.js` | 684KB     | QuickJS WASM loader (variant 2)              |

### 6.3. 기술 스택 grep 통계 (`assets/index.js`)

| 키워드                                                     | 빈도  | 의미                                                         |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `react`                                                    | 218   | React framework (state hooks 사용 추정)                      |
| `skia`                                                     | 95    | **Skia 렌더링 확정**                                         |
| `Paragraph`                                                | 49    | CanvasKit text shaping (★ composition 과 동일 API)           |
| `requestAnimationFrame`                                    | 34    | 렌더 루프                                                    |
| `Surface`                                                  | 30    | SkSurface                                                    |
| `webgl`                                                    | 16    | WebGL backend                                                |
| `tailwind`                                                 | 13    | Tailwind CSS                                                 |
| `ContextLost`                                              | 7     | **WebGL context loss recovery** (★ composition 도달 목표)    |
| `emscripten`                                               | 6     | Emscripten                                                   |
| `getMaxIntrinsicWidth`                                     | 6     | text intrinsic measurement (★ canvas-rendering.md §3 동일)   |
| `paragraph.layout`                                         | 6     | text layout                                                  |
| `ParagraphBuilder`                                         | 5     | text builder                                                 |
| `signals`                                                  | 4     | preact-signals 또는 자체 (★ React state 외 보조)             |
| `useReducer`                                               | 9     | React reducer                                                |
| `useMemo`                                                  | 87    | React memoize                                                |
| `useState`                                                 | 335   | React state                                                  |
| `useEffect`                                                | 219   | React effect                                                 |
| `forwardRef`                                               | 153   | React refs                                                   |
| `createContext`                                            | 27    | React context                                                |
| `OffscreenCanvas`                                          | 2     | Worker rendering                                             |
| `TypefaceFontProvider`                                     | 2     | 커스텀 폰트 로딩 (★ composition 차용 후보)                   |
| `asyncify`                                                 | 2     | Emscripten asyncify (stack switching)                        |
| `wasmExports`                                              | 2     | WASM export 접근                                             |
| **`PictureRecorder`**                                      | **1** | **★★ Skia retained backing** (composition 미사용, 도달 목표) |
| `GrDirectContext`                                          | 1     | GPU direct context                                           |
| `FontMgr`                                                  | 1     | font manager                                                 |
| `getLongestLine`                                           | 1     | text content width                                           |
| **`zustand` / `jotai` / `valtio` / `MobX` / `RecoilRoot`** | 0     | **외부 state 라이브러리 미사용**                             |

**결론**:

- 렌더링은 CanvasKit/Skia + WebGL + Emscripten (composition 의 ADR-100 Unified Skia Engine 과 같은 노선)
- 텍스트 측정 API 가 **composition canvas-rendering.md §3 의 텍스트 측정 동기화와 정확히 같은 함수 사용** (`getMaxIntrinsicWidth`, `getLongestLine`, `paragraph.layout()`)
- **`PictureRecorder` 1회 사용** — Skia Picture caching 적용 (composition 미사용 — `feedback-composition-enterprise-target.md` 의 "Picture cache 는 도달 목표")
- **`ContextLost` 7회** — WebGL context loss recovery (composition 강화 후보)
- **State 는 vanilla React** — zustand/jotai 0회. composition 의 O(1) elementsMap/childrenMap SSOT (ADR-040) 와 다른 노선 (Pencil 은 props/context drilling)
- **변수 font axes** (`TypefaceFontProvider`) — composition 의 ADR-014 Font Manager 확장 후보

### 6.4. ★ QuickJS-Emscripten sandbox (LLM JS 격리 실행)

`out/editor/assets/ffi.js` 의 시작:

```ts
var m = class {
  constructor(e) {
    this.module = e;
    this.QTS_NewRuntime = this.module.cwrap("QTS_NewRuntime", "number", []);
    this.QTS_FreeRuntime = this.module.cwrap("QTS_FreeRuntime", null, [
      "number",
    ]);
    this.QTS_NewContext = this.module.cwrap("QTS_NewContext", "number", [
      "number",
      "number",
    ]);
    this.QTS_RuntimeSetMemoryLimit = this.module.cwrap(
      "QTS_RuntimeSetMemoryLimit",
      null,
      ["number", "number"],
    );
    this.QTS_RuntimeSetMaxStackSize = this.module.cwrap(
      "QTS_RuntimeSetMaxStackSize",
      null,
      ["number", "number"],
    );
    this.QTS_Eval = r(
      this.module.cwrap("QTS_Eval", "number", [
        "number",
        "number",
        "number",
        "string",
        "number",
        "number",
      ]),
    );
    this.QTS_NewFunction = this.module.cwrap("QTS_NewFunction", "number", [
      "number",
      "string",
      "number",
      "boolean",
      "number",
    ]);
    this.QTS_NewPromiseCapability = this.module.cwrap(
      "QTS_NewPromiseCapability",
      "number",
      ["number", "number"],
    );
    this.QTS_BuildIsAsyncify = this.module.cwrap(
      "QTS_BuildIsAsyncify",
      "number",
      [],
    );
    this.QTS_bjson_encode = this.module.cwrap("QTS_bjson_encode", "number", [
      "number",
      "number",
    ]);
    this.QTS_bjson_decode = this.module.cwrap("QTS_bjson_decode", "number", [
      "number",
      "number",
    ]);
    // ... 80+ more
  }
};
export { m as QuickJSAsyncFFI };
```

→ `QTS_*` prefix = **quickjs-emscripten** library. QuickJS JS interpreter (bellard.org) 를 Emscripten 으로 WASM compile. 두 variant:

- `module-ES6BEMUI.js` — 표준 (synchronous eval)
- `module-asyncify-2EFITU5U.js` — Emscripten asyncify variant (async eval, `await` 지원)

**중요 함의**:

- `batch_design.json` description: "JavaScript snippet executed in the editor QuickJS environment"
- → AI 가 작성한 JS 는 **클라이언트의 격리된 QuickJS VM** 안에서 실행
- 7개 mutation primitive (I/C/U/R/M/D/G) 는 QuickJS sandbox 에서 host (renderer) 로 **FFI callback** 으로 호출
- 안전성: 사용자 머신에서 실행되지만 host JS 환경에 직접 노출 안 됨. memory limit / stack size / timeout 모두 QuickJS 가 강제

**composition 차용 가치**:

- ADR-134 AI Assistant 가 LLM 코드 실행을 지원할 경우 host `eval()`/`Function()` 사용 회피 필수
- QuickJS-Emscripten 라이브러리는 OSS (https://github.com/justjake/quickjs-emscripten)
- composition Skia preview 인프라와 결합 시 "AI 가 디자인하는 캔버스를 실시간으로 보는" UX 직접 차용 가능

---

## 7. composition 대조 — 차용 / 회피 / 도달 목표 / 정합

본 섹션이 본 분석의 **action item**. composition 프로젝트의 직접 적용 매핑.

### 7.1. 직접 차용 가능 (composition 즉시 적용 가능)

| Pencil 패턴                                                                                         | composition 대응                                                      | 차용 효용                                                                              | source 파일                                                        |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `extractJsonStringFieldPrefix` + `jsonrepair` partial JSON streaming                                | ADR-134 AI Assistant (Proposed)                                       | AI 가 디자인하는 모습 실시간 캔버스 반영 — composition Skia preview 인프라와 자연 결합 | `@ha/agent/src/claude/index.ts:212-499, 703-786`                   |
| `canUseTool` **cwd-containment 자동 permission**                                                    | composition AI panel permission UI                                    | 권한 prompt 빈도 대폭 감소 — 사용자 마찰 완화                                          | `@ha/agent/src/claude/index.ts:90-153`                             |
| `createAgent(type, config): PencilAgent` factory + 정규화된 `session-event` 이벤트                  | ADR-134                                                               | Claude/Codex/Gemini 3-backend 통합 청사진 — 이벤트 정규화는 1:1 차용                   | `@ha/agent/src/{create-agent, claude, codex, pi}.ts`               |
| `spawn_agents` description (multi-agent 가이드)                                                     | composition `dispatching-parallel-agents` skill, ADR-134 future phase | "one less than needed" + containerNodes 격리 패턴 — prompt template 차용               | `@ha/mcp/dist/schemas/spawn_agents.json`                           |
| `mapCanvasModelsToThirdParty(provider, login, modelID)`                                             | composition AI 모델 추상 layer                                        | 추상 model 이름 ↔ vendor 실제 모델 매핑 — 모델 출시/EOL 분리                           | `@ha/shared` (간접 인용)                                           |
| `--agent-config` headless batch mode                                                                | composition CI/CD                                                     | 디자인 회귀 테스트 / 시안 batch 생성 자동화                                            | `out/agent-execute-config.js`                                      |
| MCP installer 10개 외부 tool 자동 등록                                                              | composition 외부 AI 통합                                              | 사용자의 외부 AI tool 어디서든 composition MCP 접근 가능                               | `@ha/mcp/src/installer.ts`                                         |
| **QuickJS-Emscripten sandbox**                                                                      | composition AI mutation 안전성                                        | LLM 생성 JS 를 격리 환경 실행 — host `eval`/`Function` 회피                            | `out/editor/assets/{ffi, module-*}.js` + npm: `quickjs-emscripten` |
| **Composite event normalization** (Codex `mcp_tool_call`/`reasoning`/`todo_list` 등 → 공통 channel) | ADR-134 LLM unification                                               | vendor lock-in 방지 — UI 가 backend-agnostic                                           | `@ha/agent/src/codex/index.ts:130-200`                             |
| **`fine-grained-tool-streaming-2025-05-14` Anthropic beta header**                                  | composition Claude SDK 호출                                           | partial tool input streaming 활성화 (jsonrepair 미리보기 전제)                         | `out/claude.js:21`                                                 |

### 7.2. 의도적으로 회피 (composition product target 와 불합치)

| Pencil 패턴                                                   | 회피 이유                                                                                                                                                   | 관련 메모리/ADR                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **vanilla React state (zustand/jotai 미사용)**                | composition 의 O(1) elementsMap/childrenMap + pageIndex SSOT 가 ADR-040 핵심. props drilling + context 만으로는 엔터프라이즈급 대규모 트리에서 60fps 어려움 | `state-management.md`, ADR-040, ADR-116/122 |
| **layout = flex only (grid 없음)**                            | composition 은 Taffy WASM (Flex/Grid/Block). pencil 처럼 grid 포기 시 RAC Table/GridList/ListBox 와 정합 깨짐 (Layer 1 D1 침범)                             | `layout-engine.md`, ADR-122, ADR-907        |
| **`note`/`prompt`/`context` 노드 타입 (디자인 의도/AI 메타)** | composition 의 D3 (시각 스타일) 외 노드 도입 시 SSOT 체인 위반. AI 의도 메타는 별도 `composition.actions`/`events` root collection 에 두는 게 정합          | `ssot-hierarchy.md`, ADR-131                |
| **`script` 노드 (JS 로 children 동적 생성)**                  | composition 은 변수/data_tables/component instance 가 SSOT. script 노드 도입 시 canonical document 가 turing-complete → caching/migration 복잡도 폭증       | ADR-142                                     |
| **MCP server 별도 Go binary 분리**                            | composition 은 단일 binary 친화 (Electron 단일 main process). 별도 Go binary 는 distribution/sign/notarization 복잡도만 증가                                | —                                           |
| **Sentry sendDefaultPii true (IP/userID 포함 자동 전송)**     | composition privacy 정책 명시화 필요 — 사용자 동의 게이트 필수                                                                                              | —                                           |
| **`pencil-` prefix non-absolute = 휘발 파일**                 | composition canonical 문서는 명시적 path 만. magic prefix 의존성은 path 의미 약화                                                                           | ADR-116/122                                 |

### 7.3. 도달 목표 (memory `feedback-composition-enterprise-target.md` 직접 정합)

| Pencil 패턴                                                                               | composition 도달 목표                                                                                                                              | 우선순위 |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **`PictureRecorder` (Skia retained backing)**                                             | memory 가 "Picture cache / Paint pool / retained backing 은 도달 목표" 라고 명시. Pencil 의 1회 사용 확인 → composition Skia 렌더링 캐싱 도입 근거 | HIGH     |
| **WebGL `ContextLost` recovery (7회)**                                                    | composition 의 WebGL context loss handling 강화. ADR-100 phase 후속 작업 후보                                                                      | MEDIUM   |
| **OffscreenCanvas + worker bundle 분리**                                                  | layout/measure 를 worker 로 offload — Taffy WASM main thread 부담 분산                                                                             | MEDIUM   |
| **`TypefaceFontProvider` + 커스텀 폰트 (variable font axes `wght`/`wdth`/`opsz`/`slnt`)** | composition 의 Font Manager (ADR-014) 가 Google Fonts + IDB 캐시. variable font axes 지원 확장 후보                                                | LOW      |
| **`SizingBehavior` fallback syntax (`"fit_content(100)"`)**                               | composition Taffy 의 percent/auto 를 단일 string DSL 로 표현 — Inspector UX 단순화                                                                 | LOW      |
| **4 built-in design system (`.lib.pen`)**                                                 | composition 의 `import` + library 모델. shadcn/halo/lunaris/nitro 처럼 design system 다중화                                                        | MEDIUM   |
| **chokidar 외부 파일 변경 감지**                                                          | composition 데스크탑 모드 (미land) 도입 시 차용. 현재 web SPA 라 불필요                                                                            | DEFERRED |
| **백업 mtime 비교 + dirty 복원**                                                          | composition 의 IndexedDB autosave 회복 시 차용 가능                                                                                                | LOW      |
| **`--enable_spawn_agents` flag**                                                          | spawn_agents 류 도구는 default 비활성, parent 명시 활성화 — 안전성 패턴                                                                            | MEDIUM   |

### 7.4. 이미 정합 (composition 이 동일 노선)

| 영역                                          | Pencil                                                                           | composition                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **canonical document SSOT**                   | `.pen` v2.11 document                                                            | ADR-116/122 canonical-only-runtime + ADR-142                                                      |
| **reusable + ref 컴포넌트 모델**              | `reusable: true` origin + `ref` instance with `descendants` override/replacement | ADR-142 (PrimitiveBinding ~35 + reusable frame) + `RefNode.descendants` (ADR-130 frame canonical) |
| **slot 시스템**                               | `frame.slot: false \| string[]` (권장 reusable children)                         | ADR-130 / ADR-135 frame projection                                                                |
| **Variable + Theme**                          | `$varName` + theme 별 다른 value                                                 | composition `data_tables` + themes (ADR-110, ADR-131 root collection)                             |
| **`imports` cross-document reference**        | document.imports `{alias: relPath}`                                              | composition 의 component library import (미land, ADR-142 함의)                                    |
| **Skia 렌더링 핵심**                          | CanvasKit + WebGL + Emscripten                                                   | ADR-100 Unified Skia Engine                                                                       |
| **Text intrinsic measurement**                | `getMaxIntrinsicWidth` + `getLongestLine` + `paragraph.layout`                   | canvas-rendering.md §3 (동일 API)                                                                 |
| **path slash 체인 (`"instance/child"`)**      | descendants path semantics                                                       | `RefNode.descendants[path].children`                                                              |
| **Single instance lock**                      | `requestSingleInstanceLock`                                                      | composition Electron 모드 시 동일 패턴                                                            |
| **HashRouter SPA**                            | `pencil://editor/#/editor/<file>`                                                | composition Builder iframe 의 hash routing                                                        |
| **Context isolation + preload contextBridge** | 동일 패턴                                                                        | composition Electron 모드 시 동일                                                                 |

---

## 8. 5가지 본질 통찰

본 분석의 take-away — 미래의 composition 작업자가 본 문서를 1분 안에 이해할 수 있는 핵심.

### 1. AI-First 디자인 도구

AI integration 이 부가 기능이 아니라 **architecture 의 중심**. `batch_design` 가 mutation 의 primary entry — 사람-주도 mutation 도 동일 API 가능성 (사용자가 GUI 로 노드 추가하면 내부적으로 `I()` 호출). multi-agent (spawn_agents) + multi-vendor (Claude/Codex/Gemini) + multi-window (--agent-config) 가 **first-class**, 후행 추가 아님.

### 2. canonical document SSOT 가 단순

13~15 노드 타입, 7개 mutation primitive (I/C/U/R/M/D/G), JSON Schema 1142 lines 로 전체 표현. composition 의 더 복잡한 ADR-142 (PrimitiveBinding ~35) 대비 매우 simple. trade-off:

- pencil = 디자인 도구 (시각 결과만 중요, RAC ARIA 정합 포기)
- composition = 노코드 웹 빌더 (시각 + DOM + ARIA + RSP props 3-domain 정합 필수)

→ composition 이 더 복잡한 건 product target 차이 때문, simplification 시 정합 깨짐.

### 3. QuickJS sandbox 가 AI 안전성 핵심

LLM 이 작성한 JS 코드를 host JS 에 **직접 노출 안 함**. quickjs-emscripten 라이브러리 (OSS) 로 격리 VM. composition 이 ADR-134 추진 시 핵심 차용 패턴 — host `eval()` 사용 절대 금지.

### 4. Streaming partial JSON 라이브 미리보기가 본질 UX

`jsonrepair` + `extractJsonStringFieldPrefix` → token-by-token 진행상황을 캔버스에 반영. "AI 가 디자인하는 것을 보는" 느낌이 produce. 이게 Pencil 의 **상품성 핵심**.

기술적으로:

1. Claude SDK 의 `includePartialMessages: true` + `ANTHROPIC_BETAS: "fine-grained-tool-streaming-2025-05-14"`
2. `stream_event` 의 `input_json_delta` 누적
3. `extractJsonStringFieldPrefix` 로 stable prefix 추출 (escape 안전)
4. 새 substring 만 progressively `tool-use` (streaming:true) 이벤트 emit
5. editor 가 streaming input 받아 캔버스 progressively 변경

→ composition 차용 시 Skia preview 인프라 (현존) 와 직접 결합 가능.

### 5. 외부 AI tool 10개 자동 통합 (Hub pattern)

Pencil 은 단순 desktop app 이 아니라 **사용자의 AI ecosystem 안에 자기 자신을 endpoint 로 등록**시키는 hub. composition 도 동일 패턴 가능 — 현 환경의 `mcp__pencil__*` 도구가 이 경로로 등록됨.

→ composition 도 동일 installer 패턴 도입 시, 사용자가 Claude Code / Cursor / Windsurf 어디서든 composition 의 디자인을 query/mutate 가능.

---

## 9. 후속 작업 후보

본 분석을 바탕으로 한 composition 작업 후보 (우선순위 순):

### 9.1. Immediate (1주 이내)

- [ ] **ADR-134 (AI Assistant LLM unification) 본 분석 반영 revision**:
  - Pencil 의 `createAgent` factory + `session-event` 정규화 패턴을 Decision 섹션 참조
  - `canUseTool` cwd-containment 패턴을 permission 모델 Alternatives 에 추가
  - QuickJS-Emscripten sandbox 를 mutation 안전성 Decision 으로 채택
  - `ANTHROPIC_BETAS: "fine-grained-tool-streaming-2025-05-14"` 명시
- [ ] **memory 갱신**:
  - `pencil-component-visual-markers.md` 에 본 디컴파일 결과 cross-reference
  - 신규 `pencil-mcp-hub-pattern.md` — 10개 외부 AI tool 자동 등록 패턴
  - 신규 `pencil-streaming-partial-json.md` — `extractJsonStringFieldPrefix` + `jsonrepair` 패턴 (composition 차용 시 참조)

### 9.2. Short-term (1개월 이내)

- [ ] **Skia `PictureRecorder` 도입 PoC** (ADR-100 phase 11+ 후보):
  - 정적 노드 캐싱 → 60fps maintenance 강화
  - memory `feedback-composition-enterprise-target.md` 의 "도달 목표" 카테고리 실현
- [ ] **WebGL `ContextLost` recovery 강화** (ADR-100 phase 11+ 후보):
  - 현재 composition 의 처리 수준 측정
  - Pencil 의 7회 사용 = 풍부한 recovery path 보유 추정
- [ ] **MCP installer 패턴 PoC** (composition 자체를 외부 AI tool 에 등록):
  - 10개 외부 AI tool config 자동 install
  - 사용자가 Claude Code 등에서 composition canonical document 를 query/mutate

### 9.3. Long-term (3개월+)

- [ ] **AI multi-window grid 모드** (composition Builder):
  - `--agent-config` 류 headless batch mode 도입
  - `spawn_agents` 류 multi-agent 위임 도구
  - 사용자 single prompt → 수십 시안 자동 생성
- [ ] **`.lib.pen` 류 library mode** (composition):
  - shadcn 처럼 외부 design system import
  - 사용자 .composition 파일이 다른 .composition 의 reusable component 참조

---

## 10. 참고 자료 및 파일 경로

### 10.1. 본 분석 추출물 위치

```
/tmp/pencil-extracted/                641MB
├── package.json
├── node_modules/
│   ├── @ha/{agent,ipc,mcp,schema,shared}/   ← 내부 패키지 .ts 소스 포함
│   ├── @anthropic-ai/claude-agent-sdk/
│   └── @openai/{codex-sdk, codex-darwin-arm64}/
└── out/
    ├── *.js (27 files)                ← TS compiled, minify 안 됨
    ├── data/*.pen (10 design files)
    ├── editor/                         ← React SPA bundle
    └── mcp-server-darwin-arm64         ← Go 컴파일 바이너리
```

### 10.2. 핵심 인용 파일

| 영역                         | 핵심 파일                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| .pen 스키마                  | `/tmp/pencil-extracted/node_modules/@ha/schema/{generated-schema.md, pen.schema.json, src/generated-types-{public,private}.ts}`                                 |
| MCP tool schemas (14)        | `/tmp/pencil-extracted/node_modules/@ha/mcp/dist/schemas/*.json`                                                                                                |
| MCP installer (10 외부 tool) | `/tmp/pencil-extracted/node_modules/@ha/mcp/src/installer.ts`                                                                                                   |
| Agent 통합 (Claude/Codex/Pi) | `/tmp/pencil-extracted/node_modules/@ha/agent/src/{create-agent, claude/index, codex/index, pi/index, types}.ts`                                                |
| Electron main                | `/tmp/pencil-extracted/out/{main, app, desktop-resource-device, desktop-mcp-adapter, agent-execute-config, claude, codex, ipc-electron, preload, constants}.js` |
| Built-in 디자인 시스템       | `/tmp/pencil-extracted/out/data/{halo, lunaris, nitro, shadcn}.lib.pen`                                                                                         |
| Renderer bundle              | `/tmp/pencil-extracted/out/editor/assets/{index.js, pencil.wasm, ffi.js, module-*, emscripten-module.browser-*}.js`                                             |

### 10.3. composition 관련 참조

- `.claude/rules/ssot-hierarchy.md` — SSOT 체인 3-Domain 정본 (D1/D2/D3)
- `.claude/rules/canvas-rendering.md` — Skia 렌더링 + 텍스트 측정 동기화 (§3)
- `.claude/rules/layout-engine.md` — Taffy WASM Flex/Grid/Block
- `.claude/rules/state-management.md` — Zustand + canonical document SSOT
- `docs/adr/100-unified-skia-rendering-engine.md` — ADR-100 Unified Skia Engine
- `docs/adr/completed/116-...md` — ADR-116 canonical-only-runtime
- `docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md`
- `docs/adr/completed/131-events-actions-root-collection.md` — events/actions root collection
- `docs/adr/134-ai-assistant-llm-unification-plan.md` — ADR-134 AI Assistant (Proposed)
- `docs/adr/design/142-...breakdown.md` — ADR-142 canonical document = component SSOT
- memory `feedback-composition-enterprise-target.md` — 엔터프라이즈 product target
- memory `feedback-no-fallback-thinking.md` — fallback 사고 회피
- memory `pencil-component-visual-markers.md` — pencil 시각 마커 (origin/instance) 기존 분석
- memory `project-pencil-format-residual-framing.md` — pencil format SSOT framing

### 10.4. 외부 라이브러리

- `quickjs-emscripten` — https://github.com/justjake/quickjs-emscripten (JS sandbox)
- `@anthropic-ai/claude-agent-sdk` — https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- `@openai/codex-sdk` — https://www.npmjs.com/package/@openai/codex-sdk
- `@earendil-works/pi-*` — Gemini wrapper (third-party OSS)
- `jsonrepair` — partial JSON 복구 (npm)
- `koffi` — Node.js FFI 라이브러리
- `chokidar` — 파일 watcher
- `electron-store` / `electron-log` / `electron-updater` — Electron 표준

---

**문서 끝.** 본 분석은 Pencil 1.1.57 시점이며, 향후 버전에서 schema/agent API 변경 시 본 문서 stale 가능. 재분석 시 §0 절차로 재현 가능.

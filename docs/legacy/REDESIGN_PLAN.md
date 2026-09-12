> **⚠️ 레거시 문서**: 현재 아키텍처와 일치하지 않을 수 있습니다. 역사적 참조 목적.

# composition 아키텍처 재설계 계획

> **작성일**: 2025-11-26
> **버전**: 1.0
> **상태**: 계획 단계

---

## 1. 현재 문제점 요약

### 1.1 iframe 격리 실패

```
[현재 구조]
Builder App ─── BrowserRouter ───┐
                                 ├── /builder/:projectId
iframe ─── (같은 앱) ────────────├── /preview/:projectId  ← 문제!
                                 └── /theme/:projectId

문제점:
- Preview가 부모 Router를 공유
- Preview가 부모 Store를 폴백 참조
- 링크 클릭 시 iframe이 직접 네비게이션됨
```

### 1.2 이벤트 시스템 문제

```
[현재 흐름]
User clicks → EventEngine → navigate action
                    ↓
            isBuilderMode() ?
                    ↓
            postMessage to parent → Builder handles navigation

문제점:
- 네비게이션이 부모에게 위임됨
- Preview 내부에서 독립 실행 불가
- 퍼블리싱 시 다른 코드 경로 필요
```

### 1.3 데이터 바인딩 문제

```
[현재 구조]
- DataBinding이 Builder 컨텍스트에서 처리
- API 호출 시 인증 토큰 공유 문제
- 데이터 소스 관리 UI 부재
- 스키마 정의 기능 없음
```

---

## 2. 목표 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                         Builder App                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  BrowserRouter                                             │  │
│  │  ├── /builder/:projectId → Builder UI                      │  │
│  │  └── /theme/:projectId → Theme Studio                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                      postMessage (데이터 동기화만)                │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │  iframe (srcdoc)                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Preview Runtime (독립 앱)                           │  │  │
│  │  │  ├── MemoryRouter (내부 라우팅)                      │  │  │
│  │  │  ├── PreviewStore (독립 상태)                        │  │  │
│  │  │  ├── EventEngine (완전 독립 실행)                    │  │  │
│  │  │  ├── DataManager (API 호출 독립 처리)                │  │  │
│  │  │  └── ComponentRenderer                               │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

퍼블리싱 시:
┌─────────────────────────────────────────────────────────────────┐
│  Published App (Preview Runtime 그대로 사용)                     │
│  ├── BrowserRouter (MemoryRouter 대체)                          │
│  ├── ProductionStore                                            │
│  ├── EventEngine (동일 코드)                                    │
│  └── DataManager (동일 코드)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 postMessage 프로토콜 (최소화)

```typescript
// Builder → Preview (데이터 동기화)
interface BuilderToPreview {
  // 요소 동기화
  UPDATE_ELEMENTS: { elements: Element[] };
  UPDATE_ELEMENT_PROPS: { elementId: string; props: object };
  DELETE_ELEMENT: { elementId: string };

  // 테마 동기화
  THEME_VARS: { vars: ThemeVar[] };

  // 페이지 정보
  UPDATE_PAGE_INFO: { pageId: string; layoutId: string | null };

  // 데이터 소스 정의 동기화
  UPDATE_DATA_SOURCES: { dataSources: DataSource[] };

  // 인증 토큰 전달 (API 호출용)
  UPDATE_AUTH_CONTEXT: { token: string | null };
}

// Preview → Builder (알림/선택만)
interface PreviewToBuilder {
  PREVIEW_READY: {};
  ELEMENT_SELECTED: { elementId: string; rect: Rect; isMultiSelect: boolean };
  ELEMENT_COMPUTED_STYLE: { elementId: string; computedStyle: object };
  ELEMENTS_DRAG_SELECTED: { elementIds: string[] };

  // 상태 변경 알림 (디버깅용, 선택적)
  STATE_CHANGED: { path: string; value: unknown };
}
```

**핵심 변경: `NAVIGATE_TO_PAGE` 제거**

- Preview 내부에서 MemoryRouter로 직접 처리
- Builder에게 위임하지 않음

---

## 3. 구현 계획

### Phase 1: Preview 격리 (srcdoc + MemoryRouter)

#### 1.1 폴더 구조

```
src/
├── builder/                    # Builder 앱 (기존)
│   ├── main/
│   │   └── BuilderWorkspace.tsx  # iframe srcdoc 주입
│   └── stores/
│       └── index.ts              # 부모 폴백 제거
│
├── preview-runtime/            # Preview 독립 앱 (신규)
│   ├── index.tsx               # 진입점
│   ├── PreviewApp.tsx          # 메인 컴포넌트
│   ├── router/
│   │   ├── PreviewRouter.tsx   # MemoryRouter 래퍼
│   │   └── routes.tsx          # 동적 라우트 생성
│   ├── store/
│   │   ├── previewStore.ts     # 독립 Zustand 스토어
│   │   └── types.ts
│   ├── messaging/
│   │   ├── messageHandler.ts   # postMessage 수신
│   │   └── messageSender.ts    # postMessage 송신
│   ├── events/
│   │   └── EventEngine.ts      # 독립 실행 버전
│   ├── data/
│   │   ├── DataManager.ts      # API 호출 관리
│   │   └── BindingResolver.ts  # 바인딩 표현식 처리
│   └── renderers/              # 기존 renderers 이동
│
└── shared/                     # Builder/Preview 공유
    ├── types/
    ├── components/             # React Aria Components
    └── utils/
```

#### 1.2 Vite 빌드 설정

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "preview-runtime": resolve(__dirname, "src/preview-runtime/index.tsx"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "preview-runtime"
            ? "preview-runtime.[hash].js"
            : "[name].[hash].js";
        },
      },
    },
  },
});
```

#### 1.3 srcdoc 템플릿

```typescript
// src/builder/main/BuilderWorkspace.tsx
const generatePreviewHtml = (previewBundle: string, previewCSS: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${previewCSS}</style>
</head>
<body>
  <div id="preview-root"></div>
  <script type="module">${previewBundle}</script>
</body>
</html>
`;

// iframe 렌더링
<iframe
  srcdoc={generatePreviewHtml(previewBundle, previewCSS)}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  title="composition Preview"
/>
```

#### 1.4 Preview Runtime 진입점

```typescript
// src/preview-runtime/index.tsx
import { createRoot } from 'react-dom/client';
import { PreviewApp } from './PreviewApp';
import { createPreviewStore } from './store/previewStore';
import { MessageHandler } from './messaging/messageHandler';

const store = createPreviewStore();
const messageHandler = new MessageHandler(store);

// postMessage 리스너 등록
window.addEventListener('message', (e) => messageHandler.handle(e));

// PREVIEW_READY 전송
window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');

createRoot(document.getElementById('preview-root')!).render(
  <PreviewApp store={store} />
);
```

#### 1.5 MemoryRouter 통합

```typescript
// src/preview-runtime/router/PreviewRouter.tsx
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { usePreviewStore } from '../store/previewStore';

export function PreviewRouter() {
  const pages = usePreviewStore((s) => s.pages);
  const initialPath = usePreviewStore((s) => s.currentPath);

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {pages.map((page) => (
          <Route
            key={page.id}
            path={page.slug}
            element={<PageRenderer pageId={page.id} />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );
}
```

---

### Phase 2: 이벤트 시스템 재설계

#### 2.1 EventEngine 독립화

```typescript
// src/preview-runtime/events/EventEngine.ts
export class PreviewEventEngine {
  private store: PreviewStore;
  private router: MemoryRouterInstance;
  private dataManager: DataManager;

  constructor(deps: {
    store: PreviewStore;
    router: any;
    dataManager: DataManager;
  }) {
    this.store = deps.store;
    this.router = deps.router;
    this.dataManager = deps.dataManager;
  }

  async executeAction(
    action: EventAction,
    context: EventContext,
  ): Promise<void> {
    switch (action.type) {
      case "navigate":
        // MemoryRouter로 직접 네비게이션 (부모 위임 X)
        this.router.navigate(action.config.path);
        break;

      case "setState":
        // 독립 스토어에 상태 저장
        this.store.setState(action.config.key, action.config.value);
        break;

      case "apiCall":
        // Preview 내부에서 직접 API 호출
        await this.dataManager.fetch(action.config.dataSourceId);
        break;

      case "showModal":
      case "hideModal":
      case "toggleVisibility":
        // UI 액션은 DOM 직접 조작 또는 스토어 업데이트
        this.executeUIAction(action, context);
        break;

      // ... 기타 액션
    }
  }
}
```

#### 2.2 컴포넌트 API 노출

```typescript
// src/preview-runtime/components/ComponentRegistry.ts
export class ComponentRegistry {
  private components: Map<string, ComponentInstance> = new Map();

  register(elementId: string, instance: ComponentInstance): void {
    this.components.set(elementId, instance);
  }

  getAPI(elementId: string): ComponentAPI | null {
    const instance = this.components.get(elementId);
    if (!instance) return null;

    return {
      // 공통 API
      focus: () => instance.ref?.focus(),
      scrollIntoView: () => instance.ref?.scrollIntoView(),

      // 컴포넌트별 API
      ...(instance.type === "Table" && {
        setFilter: (filter) => instance.setFilter(filter),
        refresh: () => instance.refresh(),
      }),
      ...(instance.type === "Select" && {
        open: () => instance.open(),
        close: () => instance.close(),
        setValue: (value) => instance.setValue(value),
      }),
    };
  }
}
```

#### 2.3 Scope 기능

```typescript
// src/preview-runtime/events/ScopeResolver.ts
export class ScopeResolver {
  resolveTarget(
    scope: "self" | "parent" | "firstAncestor" | "global",
    selector: string,
    currentElementId: string,
    elements: Element[],
  ): string | null {
    switch (scope) {
      case "self":
        return currentElementId;

      case "parent":
        const current = elements.find((e) => e.id === currentElementId);
        return current?.parent_id || null;

      case "firstAncestor":
        // selector로 지정된 클래스/태그를 가진 첫 번째 조상 찾기
        return this.findAncestorBySelector(
          currentElementId,
          selector,
          elements,
        );

      case "global":
        // customId 또는 ID로 찾기
        return (
          elements.find((e) => e.customId === selector || e.id === selector)
            ?.id || null
        );
    }
  }
}
```

---

### Phase 3: 데이터 시스템 재설계

#### 3.1 Data Source Panel UI

```typescript
// src/builder/inspector/data/DataSourcePanel.tsx
export function DataSourcePanel() {
  const dataSources = useStore((s) => s.dataSources);

  return (
    <div className="data-source-panel">
      <header>
        <h3>Data Sources</h3>
        <Button onPress={() => openAddModal()}>+ Add</Button>
      </header>

      <ul className="data-source-list">
        {dataSources.map((ds) => (
          <DataSourceItem key={ds.id} dataSource={ds} />
        ))}
      </ul>
    </div>
  );
}

// Data Source 타입
interface DataSource {
  id: string;
  name: string;
  type: 'rest' | 'cloud' | 'static' | 'graphql';

  // REST API
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;

  // Cloud
  table?: string;
  filters?: Filter[];
  realtime?: boolean;

  // Static
  data?: unknown;

  // Common
  transform?: string; // JS 표현식
  autoFetch?: 'onLoad' | 'manual';
  cacheTTL?: number;
}
```

#### 3.2 DataManager 구현

```typescript
// src/preview-runtime/data/DataManager.ts
export class DataManager {
  private dataSources: Map<string, DataSource> = new Map();
  private cache: Map<string, CachedData> = new Map();
  private subscribers: Map<string, Set<Subscriber>> = new Map();

  async fetch(
    sourceId: string,
    params?: Record<string, unknown>,
  ): Promise<DataState> {
    const source = this.dataSources.get(sourceId);
    if (!source) throw new Error(`Data source not found: ${sourceId}`);

    // 캐시 확인
    const cached = this.getFromCache(sourceId);
    if (cached) return cached;

    // Loading 상태 알림
    this.notifySubscribers(sourceId, {
      loading: true,
      error: null,
      data: null,
    });

    try {
      let data: unknown;

      switch (source.type) {
        case "rest":
          data = await this.fetchRest(source, params);
          break;
        case "cloud":
          data = await this.fetchCloud(source, params);
          break;
        case "static":
          data = source.data;
          break;
      }

      // Transform 적용
      if (source.transform) {
        data = this.applyTransform(data, source.transform);
      }

      // 캐시 저장
      this.setCache(sourceId, data, source.cacheTTL);

      // Success 상태 알림
      const state = { loading: false, error: null, data };
      this.notifySubscribers(sourceId, state);
      return state;
    } catch (error) {
      // Error 상태 알림
      const state = { loading: false, error: error.message, data: null };
      this.notifySubscribers(sourceId, state);
      return state;
    }
  }

  subscribe(sourceId: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(sourceId)) {
      this.subscribers.set(sourceId, new Set());
    }
    this.subscribers.get(sourceId)!.add(callback);

    return () => {
      this.subscribers.get(sourceId)?.delete(callback);
    };
  }
}
```

#### 3.3 BindingResolver 구현

```typescript
// src/preview-runtime/data/BindingResolver.ts
export class BindingResolver {
  private dataManager: DataManager;
  private store: PreviewStore;

  resolve(expression: string, context: BindingContext): unknown {
    // {{...}} 패턴 추출
    const matches = expression.matchAll(/\{\{(.+?)\}\}/g);
    let result = expression;

    for (const match of matches) {
      const path = match[1].trim();
      const value = this.evaluatePath(path, context);
      result = result.replace(match[0], String(value ?? ""));
    }

    return result;
  }

  private evaluatePath(path: string, context: BindingContext): unknown {
    // state.xxx → 전역/페이지/컴포넌트 상태
    if (path.startsWith("state.")) {
      return this.store.getState(path.slice(6));
    }

    // data.xxx → 데이터 소스
    if (path.startsWith("data.")) {
      const [, sourceName, ...rest] = path.split(".");
      const sourceData = this.dataManager.getState(sourceName)?.data;
      return this.getNestedValue(sourceData, rest.join("."));
    }

    // item.xxx → 반복 컨텍스트
    if (path.startsWith("item.")) {
      return this.getNestedValue(context.item, path.slice(5));
    }

    // index → 반복 인덱스
    if (path === "index") {
      return context.index;
    }

    // 표현식 평가 (안전한 eval)
    return this.safeEval(path, context);
  }
}
```

#### 3.4 컴포넌트 바인딩 UI

```typescript
// src/builder/inspector/properties/common/DataBindingInput.tsx
export function DataBindingInput({
  value,
  onChange,
  label
}: DataBindingInputProps) {
  const dataSources = useStore((s) => s.dataSources);
  const [isBindingMode, setIsBindingMode] = useState(
    typeof value === 'string' && value.includes('{{')
  );

  if (isBindingMode) {
    return (
      <div className="data-binding-input">
        <label>{label}</label>
        <div className="binding-expression">
          <Input
            value={value}
            onChange={onChange}
            placeholder="{{data.users[0].name}}"
          />
          <Button onPress={() => openPathPicker()}>
            <Icon name="data" />
          </Button>
        </div>
        <Button variant="link" onPress={() => setIsBindingMode(false)}>
          Switch to static value
        </Button>
      </div>
    );
  }

  return (
    <div className="data-binding-input">
      <label>{label}</label>
      <Input value={value} onChange={onChange} />
      <Button variant="link" onPress={() => setIsBindingMode(true)}>
        Bind to data
      </Button>
    </div>
  );
}
```

---

### Phase 4: 상태 관리 체계화

#### 4.1 상태 계층 구조

```typescript
// src/preview-runtime/store/previewStore.ts
interface PreviewState {
  // App State (전역)
  appState: Record<string, unknown>;

  // Page State (페이지별)
  pageStates: Map<string, Record<string, unknown>>;

  // Component State (컴포넌트별)
  componentStates: Map<string, Record<string, unknown>>;

  // Current Context
  currentPageId: string | null;
}

export const createPreviewStore = () =>
  create<PreviewState>((set, get) => ({
    appState: {},
    pageStates: new Map(),
    componentStates: new Map(),
    currentPageId: null,

    // 상태 설정 (계층 자동 결정)
    setState: (path: string, value: unknown) => {
      const [scope, ...rest] = path.split(".");
      const key = rest.join(".");

      switch (scope) {
        case "app":
          set((s) => ({ appState: { ...s.appState, [key]: value } }));
          break;
        case "page":
          const pageId = get().currentPageId;
          if (pageId) {
            set((s) => {
              const pageStates = new Map(s.pageStates);
              const pageState = pageStates.get(pageId) || {};
              pageStates.set(pageId, { ...pageState, [key]: value });
              return { pageStates };
            });
          }
          break;
        case "component":
          // elementId.key 형식
          const [elementId, propKey] = key.split(".");
          set((s) => {
            const componentStates = new Map(s.componentStates);
            const componentState = componentStates.get(elementId) || {};
            componentStates.set(elementId, {
              ...componentState,
              [propKey]: value,
            });
            return { componentStates };
          });
          break;
      }
    },

    // 상태 조회
    getState: (path: string) => {
      const [scope, ...rest] = path.split(".");
      const key = rest.join(".");
      const state = get();

      switch (scope) {
        case "app":
          return state.appState[key];
        case "page":
          return state.pageStates.get(state.currentPageId || "")?.[key];
        case "component":
          const [elementId, propKey] = key.split(".");
          return state.componentStates.get(elementId)?.[propKey];
      }
    },
  }));
```

#### 4.2 State Inspector UI

```typescript
// src/builder/inspector/state/StateInspector.tsx
export function StateInspector() {
  const [selectedScope, setSelectedScope] = useState<'app' | 'page' | 'component'>('app');

  return (
    <div className="state-inspector">
      <Tabs selectedKey={selectedScope} onSelectionChange={setSelectedScope}>
        <TabList>
          <Tab id="app">App State</Tab>
          <Tab id="page">Page State</Tab>
          <Tab id="component">Component State</Tab>
        </TabList>

        <TabPanel id="app">
          <StateTree data={appState} onEdit={updateAppState} />
        </TabPanel>
        <TabPanel id="page">
          <StateTree data={pageState} onEdit={updatePageState} />
        </TabPanel>
        <TabPanel id="component">
          <ComponentStateList />
        </TabPanel>
      </Tabs>

      <Button onPress={() => openStateDebugger()}>
        Open State Debugger
      </Button>
    </div>
  );
}
```

---

### Phase 5: 퍼블리싱 준비

#### 5.1 빌드 분리

```typescript
// scripts/build-preview-runtime.ts
import { build } from "vite";

async function buildPreviewRuntime() {
  await build({
    configFile: "vite.preview.config.ts",
    build: {
      outDir: "dist/preview-runtime",
      lib: {
        entry: "src/preview-runtime/index.tsx",
        formats: ["es"],
        fileName: "preview-runtime",
      },
      rollupOptions: {
        external: [], // 모든 의존성 번들링
      },
    },
  });
}
```

#### 5.2 퍼블리싱 시 라우터 전환

```typescript
// src/preview-runtime/router/createRouter.ts
export function createRouter(mode: 'preview' | 'published', pages: Page[]) {
  const routes = pages.map((page) => ({
    path: page.slug,
    element: <PageRenderer pageId={page.id} />,
  }));

  if (mode === 'preview') {
    // Builder 내 Preview: MemoryRouter
    return (
      <MemoryRouter initialEntries={['/']}>
        <Routes>{routes.map(r => <Route key={r.path} {...r} />)}</Routes>
      </MemoryRouter>
    );
  } else {
    // 퍼블리싱: BrowserRouter
    return (
      <BrowserRouter>
        <Routes>{routes.map(r => <Route key={r.path} {...r} />)}</Routes>
      </BrowserRouter>
    );
  }
}
```

#### 5.3 Static Export

```typescript
// src/preview-runtime/export/staticExport.ts
export async function generateStaticSite(project: Project): Promise<ExportResult> {
  const pages = project.pages;
  const files: ExportFile[] = [];

  // HTML 생성
  for (const page of pages) {
    const html = await renderToStaticMarkup(
      <PageRenderer pageId={page.id} elements={project.elements} />
    );

    files.push({
      path: `${page.slug === '/' ? 'index' : page.slug}.html`,
      content: wrapWithHtmlTemplate(html, project.theme),
    });
  }

  // CSS 생성
  files.push({
    path: 'styles.css',
    content: generateCSS(project.theme),
  });

  // JS 번들
  files.push({
    path: 'app.js',
    content: await bundlePreviewRuntime({ mode: 'published' }),
  });

  return { files };
}
```

---

## 4. 마이그레이션 전략

### 4.1 점진적 마이그레이션

```
Week 1-2: Phase 1 (Preview 격리)
- srcdoc 방식으로 전환
- 기존 기능 모두 유지 (postMessage 프로토콜 동일)
- MemoryRouter 추가 (내부 네비게이션만)

Week 3-4: Phase 2 (이벤트 시스템)
- EventEngine 독립화
- navigate 액션 내부 처리로 전환
- 기존 이벤트 정의 마이그레이션 불필요 (호환 유지)

Week 5-7: Phase 3 (데이터 시스템)
- Data Source Panel 추가
- DataManager 구현
- 기존 DataBinding 마이그레이션 도구 제공

Week 8-9: Phase 4 (상태 관리)
- 상태 계층 구조 구현
- State Inspector 추가
- 기존 상태 마이그레이션

Week 10: Phase 5 (퍼블리싱)
- Static Export 기능
- BrowserRouter 전환 로직
```

### 4.2 호환성 보장

```typescript
// 기존 이벤트 정의 호환 레이어
function migrateEventDefinition(
  oldEvent: OldEventDefinition,
): NewEventDefinition {
  return {
    trigger: oldEvent.event,
    condition: oldEvent.condition,
    actions: oldEvent.actions.map((action) => ({
      type: action.type,
      config: action.config || action.value, // 두 형식 모두 지원
    })),
  };
}
```

---

## 5. 리스크 및 대응

| 리스크                | 영향                  | 대응                     |
| --------------------- | --------------------- | ------------------------ |
| srcdoc 번들 크기 증가 | 초기 로딩 느려짐      | 코드 스플리팅, 지연 로딩 |
| 기존 프로젝트 호환성  | 사용자 불만           | 마이그레이션 도구 제공   |
| postMessage 성능      | 대량 업데이트 시 지연 | 배치 처리, 쓰로틀링      |
| 인증 토큰 보안        | 토큰 노출 가능성      | 단기 토큰, 프록시 서버   |

---

## 6. 성공 지표

- [ ] Preview iframe에서 링크 클릭 시 부모 영향 없음
- [ ] 이벤트 액션이 Preview 내부에서 완전 독립 실행
- [ ] API 호출이 Preview 내부에서 직접 처리
- [ ] 퍼블리싱 시 Preview Runtime 코드 그대로 사용
- [ ] 기존 프로젝트 100% 호환

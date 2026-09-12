# 웹 빌더 아키텍처 분석 보고서

> **작성일**: 2025-11-26
> **목적**: composition 이벤트 시스템 및 데이터 바인딩 재설계를 위한 사전 조사

---

## 1. 이벤트 시스템 비교 분석

### 1.1 Webflow - Interactions System

**출처**: [Webflow Interactions Guide](https://university.webflow.com/lesson/intro-to-interactions), [GSAP Integration](https://help.webflow.com/hc/en-us/articles/42832301823635-Intro-to-interactions-with-GSAP)

#### 핵심 개념: Trigger + Animation

```
Trigger (언제)          →    Animation (무엇을)
─────────────────            ─────────────────
- Click                      - Transform
- Hover                      - Opacity
- Scroll into view           - Color
- Page load                  - Size
- Mouse move                 - Custom CSS
```

#### 특징

| 항목          | 설명                                       |
| ------------- | ------------------------------------------ |
| **Scope**     | 타겟 범위 제한 (First ancestor, Class, ID) |
| **Timeline**  | 드래그로 타이밍/순서 조정                  |
| **GSAP 통합** | 2024년 인수 후 IX3 개발 중                 |
| **접근성**    | WCAG 준수, motion preference 존중          |

#### composition 적용 포인트

- **Scope 개념 도입**: 이벤트 타겟을 "자기 자신", "부모", "특정 ID"로 제한
- **Timeline UI**: 시각적 타이밍 편집기 고려

---

### 1.2 Retool - Event Handlers

**출처**: [Retool Event Handlers Docs](https://docs.retool.com/apps/guides/interaction-navigation/event-handlers)

#### 핵심 개념: Component Event → Action

```
Component Event          →    Action
─────────────────             ─────────────────
- onClick                     - Trigger Query
- onChange                    - Set State
- onSubmit                    - Control Component
- onRowClick                  - Navigate
                              - Run JS
```

#### 특징

| 항목                | 설명                                        |
| ------------------- | ------------------------------------------- |
| **No-code**         | JS 없이 이벤트 핸들러 구성                  |
| **Conditional**     | "Only run when" 조건부 실행                 |
| **Component API**   | `table.setFilter()` 등 컴포넌트 메서드 호출 |
| **Temporary State** | 앱 내 임시 상태 변수 관리                   |

#### composition 적용 포인트

- **조건부 실행 강화**: 현재 EventEngine의 condition 기능 확장
- **Component API 노출**: `component.setData()`, `component.refresh()` 등

---

### 1.3 Bubble.io - Workflows

**출처**: [Bubble Workflow API](https://manual.bubble.io/core-resources/api/the-bubble-api/the-workflow-api), [Database Triggers](https://manual.bubble.io/core-resources/events/trigger-event)

#### 핵심 개념: Event → Workflow → Actions

```
Event Types              →    Actions
─────────────────             ─────────────────
- User Event (Click)          - Create/Modify Data
- Page Event (Load)           - Navigate
- Database Trigger            - Show/Hide Element
- API Workflow                - Send Email
- Scheduled                   - API Call
```

#### 특징

| 항목                  | 설명                                  |
| --------------------- | ------------------------------------- |
| **Backend Workflows** | 서버사이드 실행, 브라우저 닫아도 계속 |
| **Database Triggers** | 데이터 변경 시 자동 실행              |
| **API Workflows**     | 외부에서 POST/GET으로 트리거          |
| **Scheduling**        | 지연 실행, 반복 실행                  |

#### composition 적용 포인트

- **Database Trigger 개념**: Cloud Realtime과 연동
- **Backend vs Frontend 분리**: 서버 액션 vs 클라이언트 액션

---

### 1.4 ToolJet - Events & Queries

**출처**: [ToolJet Events Docs](https://docs.tooljet.ai/docs/3.5.0-lts/tooljet-concepts/what-are-events/), [Query Panel](https://docs.tooljet.ai/docs/app-builder/query-panel/)

#### 핵심 개념: Query + Event Handler + Binding

```
Data Source → Query → Transform → Component Binding
                ↑
         Event Handler (Trigger)
```

#### 특징

| 항목                | 설명                            |
| ------------------- | ------------------------------- |
| **Query Panel**     | SQL, API 등 쿼리 작성 전용 패널 |
| **Transformations** | JS/Python으로 결과 변환         |
| **Auto-run**        | 앱 로드 시 자동 실행 옵션       |
| **Run Only If**     | 조건부 실행                     |
| **Bindings**        | `{{query.data}}` 형식           |

#### composition 적용 포인트

- **Query Panel 개념**: 별도의 데이터 쿼리 관리 UI
- **Transformation**: 응답 데이터 가공 레이어

---

## 2. 데이터셋/API 바인딩 비교 분석

### 2.1 Framer - Fetch

**출처**: [Framer Fetch Docs](https://www.framer.com/developers/fetch-introduction), [Fetch Feature](https://www.framer.com/updates/fetch)

#### 핵심 개념: No-code API Binding

```
API URL → Fetch → Path Selection → Component Binding
                      ↓
              Variable Tokens (:city)
```

#### 특징

| 항목                     | 설명                      |
| ------------------------ | ------------------------- |
| **No-code**              | 코드 없이 API 연동        |
| **Path Selection**       | 응답에서 원하는 필드 선택 |
| **Variable Tokens**      | URL 내 `:param` 형식 변수 |
| **Loading/Error States** | 로딩/에러 상태 자동 처리  |
| **Caching**              | 자동 캐싱, 요청 중복 제거 |

#### 구현 예시

```
API: https://api.weather.com/v1/:city
     ↓
Path: response.temperature
     ↓
Binding: Text Layer → {{fetch.temperature}}
```

#### composition 적용 포인트

- **Path Selector UI**: JSON 응답에서 필드 선택 UI
- **Variable Binding**: URL 파라미터를 컴포넌트 props와 연결
- **상태 관리 자동화**: Loading, Error, Success 상태

---

### 2.2 Plasmic - Data-Fetching Components

**출처**: [Plasmic Data Components](https://docs.plasmic.app/learn/data-fetching-components/), [Backend Integrations](https://docs.plasmic.app/learn/integrations/)

#### 핵심 개념: Data Provider Component

```
┌─────────────────────────────────┐
│  Data Provider Component        │
│  ├── Data Source Config         │
│  ├── Filter/Query Params        │
│  └── Children (Consumers)       │
│      ├── Text: {{data.name}}    │
│      └── Image: {{data.image}}  │
└─────────────────────────────────┘
```

#### 특징

| 항목                 | 설명                                          |
| -------------------- | --------------------------------------------- |
| **Provider Pattern** | 데이터 제공자 컴포넌트가 자식에게 데이터 전달 |
| **Code Components**  | 개발자가 커스텀 데이터 컴포넌트 작성 가능     |
| **HTTP Integration** | 범용 HTTP API 통합                            |
| **CMS 내장**         | Plasmic CMS 기본 제공                         |

#### composition 적용 포인트

- **Provider Pattern 도입**: DataProvider 컴포넌트로 데이터 스코프 관리
- **코드 컴포넌트 확장**: 개발자가 커스텀 데이터 소스 추가 가능

---

### 2.3 Builder.io - Data Bindings & State

**출처**: [Builder.io Data Binding](https://www.builder.io/c/docs/data-binding), [Custom Actions](https://www.builder.io/c/docs/custom-actions)

#### 핵심 개념: state._ / context._

```
App Code                    →    Builder Visual Editor
─────────────────                ─────────────────
<BuilderComponent                {{state.products}}
  data={{ products }}            {{context.utils.format()}}
  context={{ utils }}
/>
```

#### 특징

| 항목              | 설명                              |
| ----------------- | --------------------------------- |
| **state.\***      | 데이터 바인딩용 (사용자에게 노출) |
| **context.\***    | 유틸리티/함수용 (개발자 전용)     |
| **Mustache 문법** | `{{state.name}}` 형식             |
| **Actions**       | 커스텀 액션 정의 및 바인딩        |

#### composition 적용 포인트

- **state/context 분리**: 데이터 vs 함수 명확한 구분
- **Mustache 문법**: 직관적인 바인딩 표현식

---

### 2.4 Bubble.io - Data Sources & Repeating Groups

**출처**: [Bubble Data Sources](https://manual.bubble.io/core-resources/data/data-sources), [API Connector](https://manual.bubble.io/help-guides/integrations/api/the-api-connector)

#### 핵심 개념: Type-based Data Binding

```
Data Type Definition      →    Repeating Group      →    Cell Template
─────────────────              ─────────────────         ─────────────────
User                           Type: User               Current cell's User
├── name (text)                Source: Search           ├── name
├── email (text)               Constraints: [...]       ├── email
└── avatar (image)                                      └── avatar
```

#### 특징

| 항목                 | 설명                                        |
| -------------------- | ------------------------------------------- |
| **Type System**      | 데이터 타입 정의 필수                       |
| **Repeating Group**  | 리스트 데이터 자동 반복 렌더링              |
| **Current cell's X** | 반복 컨텍스트 내 현재 아이템 참조           |
| **API Connector**    | 외부 API를 Data Source 또는 Action으로 사용 |
| **Privacy Rules**    | 데이터 접근 권한 설정                       |

#### composition 적용 포인트

- **Type System 도입**: 데이터 스키마 정의 UI
- **Repeating Context**: 리스트 컴포넌트 내 현재 아이템 참조 문법

---

## 3. 핵심 패턴 정리

### 3.1 이벤트 시스템 공통 패턴

```
┌─────────────────────────────────────────────────────────┐
│                    Event System                         │
├─────────────────────────────────────────────────────────┤
│  Trigger                                                │
│  ├── User Events (click, hover, input, submit)          │
│  ├── Lifecycle Events (load, mount, unmount)            │
│  ├── Data Events (change, update, delete)               │
│  └── Custom Events (broadcast, listen)                  │
├─────────────────────────────────────────────────────────┤
│  Condition (Optional)                                   │
│  └── "Only run when" expression                         │
├─────────────────────────────────────────────────────────┤
│  Actions (Sequential or Parallel)                       │
│  ├── State Actions (setState, updateState)              │
│  ├── Navigation Actions (navigate, openURL)             │
│  ├── Data Actions (query, create, update, delete)       │
│  ├── UI Actions (show, hide, focus, scroll)             │
│  └── Custom Actions (runJS, callAPI)                    │
├─────────────────────────────────────────────────────────┤
│  Scope                                                  │
│  ├── Self (현재 요소)                                    │
│  ├── Parent (부모 요소)                                  │
│  ├── Sibling (형제 요소)                                 │
│  └── Global (ID로 지정)                                  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 데이터 바인딩 공통 패턴

```
┌─────────────────────────────────────────────────────────┐
│                  Data Layer                             │
├─────────────────────────────────────────────────────────┤
│  Data Sources                                           │
│  ├── Internal Database (Cloud)                       │
│  ├── External API (REST, GraphQL)                       │
│  ├── Static Data (JSON)                                 │
│  └── User Input (Form State)                            │
├─────────────────────────────────────────────────────────┤
│  Query/Fetch Layer                                      │
│  ├── Query Definition (URL, params, headers)            │
│  ├── Transformation (map, filter, format)               │
│  ├── Caching (deduplication, TTL)                       │
│  └── State (loading, error, data)                       │
├─────────────────────────────────────────────────────────┤
│  Binding Layer                                          │
│  ├── Direct: {{data.field}}                             │
│  ├── Expression: {{data.price * 1.1}}                   │
│  ├── Conditional: {{data.active ? "Yes" : "No"}}        │
│  └── Repeating: {{#each items}}...{{/each}}             │
├─────────────────────────────────────────────────────────┤
│  Context                                                │
│  ├── Global State (app-wide)                            │
│  ├── Page State (page-scoped)                           │
│  ├── Component State (local)                            │
│  └── Repeating Context (current item)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 4. composition 권장 아키텍처

### 4.1 이벤트 시스템 재설계

#### 현재 문제점

1. EventEngine이 부모(Builder)에게 네비게이션 위임
2. 이벤트 핸들러가 Preview 컨텍스트와 분리되어 있음
3. 컴포넌트 메서드 호출 API 부재

#### 권장 구조

```
┌─────────────────────────────────────────────────────────┐
│  Event Definition (Inspector에서 설정)                   │
├─────────────────────────────────────────────────────────┤
│  {                                                      │
│    "trigger": "onClick",                                │
│    "condition": "state.isLoggedIn === true",            │
│    "actions": [                                         │
│      {                                                  │
│        "type": "setState",                              │
│        "target": "global",                              │
│        "key": "count",                                  │
│        "value": "{{state.count + 1}}"                   │
│      },                                                 │
│      {                                                  │
│        "type": "navigate",                              │
│        "path": "/dashboard"                             │
│      }                                                  │
│    ]                                                    │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Preview Runtime (독립 실행)                             │
├─────────────────────────────────────────────────────────┤
│  EventEngine                                            │
│  ├── evaluateCondition(condition, state)                │
│  ├── executeAction(action, context)                     │
│  │   ├── setState → localStore.setState()               │
│  │   ├── navigate → memoryRouter.navigate()             │
│  │   ├── apiCall → fetch() within Preview               │
│  │   └── componentAction → componentRef.method()        │
│  └── notifyBuilder(event) → postMessage (알림용만)       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 데이터 시스템 재설계

#### 현재 문제점

1. DataBinding이 Preview 외부(Builder)에서 처리됨
2. API 호출 시 인증 컨텍스트 공유 문제
3. 데이터 스키마 정의 UI 부재

#### 권장 구조

```
┌─────────────────────────────────────────────────────────┐
│  Data Source Panel (새로운 Inspector 탭)                 │
├─────────────────────────────────────────────────────────┤
│  Data Sources                                           │
│  ├── [+] REST API                                       │
│  │   ├── Name: "getUsers"                               │
│  │   ├── URL: https://api.example.com/users             │
│  │   ├── Method: GET                                    │
│  │   ├── Headers: { Authorization: "Bearer {{token}}" } │
│  │   ├── Transform: (data) => data.results              │
│  │   └── Auto-fetch: On page load                       │
│  │                                                      │
│  ├── [+] Cloud Table                                 │
│  │   ├── Name: "products"                               │
│  │   ├── Table: products                                │
│  │   ├── Filters: [{ field: "active", op: "eq", value: true }] │
│  │   └── Realtime: enabled                              │
│  │                                                      │
│  └── [+] Static JSON                                    │
│      ├── Name: "menuItems"                              │
│      └── Data: [{ "label": "Home", "path": "/" }, ...]  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Component Binding (Inspector Properties)               │
├─────────────────────────────────────────────────────────┤
│  ListBox                                                │
│  ├── Data Source: [Dropdown] → "getUsers"               │
│  ├── Item Template:                                     │
│  │   ├── Label: {{item.name}}                           │
│  │   ├── Description: {{item.email}}                    │
│  │   └── Avatar: {{item.avatar}}                        │
│  └── Loading State: [Component] → Spinner               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Preview Runtime                                        │
├─────────────────────────────────────────────────────────┤
│  DataManager                                            │
│  ├── dataSources: Map<string, DataSource>               │
│  ├── fetch(sourceName) → Promise<Data>                  │
│  ├── subscribe(sourceName, callback) → Unsubscribe      │
│  └── getState(sourceName) → { loading, error, data }    │
│                                                         │
│  BindingResolver                                        │
│  ├── resolve("{{item.name}}", context) → "John"         │
│  ├── resolveExpression("{{price * 1.1}}", ctx) → 110    │
│  └── resolveConditional("{{active ? 'Y' : 'N'}}", ctx)  │
└─────────────────────────────────────────────────────────┘
```

### 4.3 상태 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│  State Hierarchy                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  App State (전역)                            │        │
│  │  ├── user: { id, name, token }              │        │
│  │  ├── theme: "light" | "dark"                │        │
│  │  └── notifications: []                      │        │
│  └─────────────────────────────────────────────┘        │
│                    ↓                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │  Page State (페이지별)                       │        │
│  │  ├── currentTab: "overview"                 │        │
│  │  ├── filters: { status: "active" }          │        │
│  │  └── selectedId: null                       │        │
│  └─────────────────────────────────────────────┘        │
│                    ↓                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │  Component State (컴포넌트별)                │        │
│  │  ├── isOpen: false                          │        │
│  │  ├── inputValue: ""                         │        │
│  │  └── validationError: null                  │        │
│  └─────────────────────────────────────────────┘        │
│                    ↓                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │  Repeating Context (리스트 아이템별)         │        │
│  │  ├── item: { id, name, ... }                │        │
│  │  ├── index: 0                               │        │
│  │  └── isFirst / isLast                       │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 구현 우선순위

### Phase 1: Preview 격리 (1-2주)

- [ ] srcdoc + MemoryRouter 구현
- [ ] 독립 Store 구현
- [ ] postMessage 프로토콜 정리 (데이터 동기화만)

### Phase 2: 이벤트 시스템 재설계 (2-3주)

- [ ] EventEngine을 Preview 내부 완전 실행으로 변경
- [ ] 컴포넌트 메서드 API 정의 및 노출
- [ ] Scope 기능 추가 (self, parent, global)
- [ ] 조건부 실행 강화

### Phase 3: 데이터 시스템 재설계 (3-4주)

- [ ] Data Source Panel UI 구현
- [ ] DataManager 클래스 구현
- [ ] BindingResolver 구현 (Mustache 문법)
- [ ] Loading/Error 상태 자동 처리

### Phase 4: 상태 관리 체계화 (2주)

- [ ] 상태 계층 구조 구현 (App/Page/Component/Repeating)
- [ ] State Inspector UI 구현
- [ ] 상태 디버거 (DevTools 스타일)

### Phase 5: 퍼블리싱 준비 (2주)

- [ ] Preview Runtime을 독립 빌드로 분리
- [ ] BrowserRouter 전환 로직
- [ ] Static Export 기능

---

## 6. 참고 자료

### 이벤트 시스템

- [Webflow Interactions Guide](https://university.webflow.com/lesson/intro-to-interactions)
- [Retool Event Handlers](https://docs.retool.com/apps/guides/interaction-navigation/event-handlers)
- [Bubble Workflows](https://manual.bubble.io/core-resources/api/the-bubble-api/the-workflow-api)
- [ToolJet Events](https://docs.tooljet.ai/docs/3.5.0-lts/tooljet-concepts/what-are-events/)

### 데이터 바인딩

- [Framer Fetch](https://www.framer.com/developers/fetch-introduction)
- [Plasmic Data Components](https://docs.plasmic.app/learn/data-fetching-components/)
- [Builder.io Data Binding](https://www.builder.io/c/docs/data-binding)
- [Bubble Data Sources](https://manual.bubble.io/core-resources/data/data-sources)

### 아키텍처

- [Retool Event-Driven Architecture](https://retool.com/blog/event-driven-architecture-and-reactive-programming)
- [ToolJet Query Panel](https://docs.tooljet.ai/docs/app-builder/query-panel/)

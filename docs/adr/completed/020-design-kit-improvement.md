# ADR-020: Design Kit 패널 분석 및 개선 계획

> **Superseded by [ADR-115](115-remove-designkit-system.md)** (2026-04-27) — DesignKit 시스템 전수 제거 결정. 본 ADR 의 §2.1 (CRITICAL 기능 가치 부재) + §2.2 (HIGH composition 컴포넌트 시스템 미활용) 자가 분석이 ADR-115 의 제거 결정 근거로 인용되었다. 본문 historical reference 보존.

## Status

Superseded by ADR-115 — 2026-04-27

## Context

Design Kit 패널은 composition의 디자인 시스템 패키징/공유 기능이다. 디자인 변수, 테마/토큰, Master 컴포넌트를 하나의 `.kit.json` 파일로 묶어 프로젝트 간 재사용할 수 있게 한다.

현재 구현은 **기술 인프라는 견고하나 실질적 활용 가치가 부족**한 상태이다.

### Hard Constraints

| 제약         | 값              |
| ------------ | --------------- |
| Canvas FPS   | 60fps           |
| 초기 로드    | < 3초           |
| 초기 번들    | < 500KB         |
| 스타일링     | tv() + CSS 필수 |
| History 통합 | Undo/Redo 필수  |

---

## 1. 현재 구현 분석

### 1.1 아키텍처 (5-Layer)

```
┌───────────────────────────────────────────────────────┐
│  UI Layer                                             │
│  DesignKitPanel → KitBrowser / KitPreview /           │
│                   KitComponentList                    │
├───────────────────────────────────────────────────────┤
│  State Layer (Zustand)                                │
│  useDesignKitStore (8 actions)                        │
├───────────────────────────────────────────────────────┤
│  Business Logic Layer (순수 함수)                     │
│  kitLoader.ts (6-step pipeline)                       │
│  kitExporter.ts / kitValidator.ts                     │
├───────────────────────────────────────────────────────┤
│  Data Model Layer (Zod + TypeScript)                  │
│  DesignKit, KitVariable, KitToken, KitComponent       │
├───────────────────────────────────────────────────────┤
│  External Systems (인터페이스 주입)                   │
│  useUnifiedThemeStore / Element Store / AI Feedback    │
└───────────────────────────────────────────────────────┘
```

**평가: 아키텍처 설계는 우수** — 인터페이스 주입, Zod 검증, 순수 함수 분리 등 테스트 가능성과 확장성을 잘 고려함.

### 1.2 킷 적용 파이프라인 (6단계)

```
Step 1: Parse & Validate (Zod)
Step 2: Conflict Detection (variable/token/component 이름 비교)
Step 3: Apply Themes/Tokens (테마 생성 → 토큰 upsert)
Step 4: Apply Variables (DesignVariable 배열 업데이트)
Step 5: Register Master Components (localId → UUID 매핑, Element 생성)
Step 6: Return Result (KitLoadResult)
```

**평가: 파이프라인 구조 양호** — 단계별 분리, 에러 핸들링, 결과 리포트 구현됨.

### 1.3 내장 킷 콘텐츠 (Basic Kit)

| 항목     | 내용                                             |
| -------- | ------------------------------------------------ |
| 변수     | 5개 색상 (primary, secondary, bg, surface, text) |
| 테마     | 1개 (Default, dark 미지원)                       |
| 토큰     | 12개 (color 5 + radius 3 + spacing 4)            |
| 컴포넌트 | 2개 (Card: Box+2Text, Badge: Box+Text)           |

### 1.4 파일 구조

```
apps/builder/src/
├── builder/panels/designKit/
│   ├── DesignKitPanel.tsx              # 메인 패널 (Gateway + Content)
│   ├── DesignKitPanel.css              # 스타일
│   └── components/
│       ├── KitBrowser.tsx              # 킷 목록 (카드형)
│       ├── KitPreview.tsx              # 로드된 킷 미리보기 + 적용
│       └── KitComponentList.tsx        # Master 컴포넌트 인스턴스 배치
├── stores/designKitStore.ts            # Zustand 상태 관리
├── types/builder/designKit.types.ts    # 전체 타입 + Zod 스키마
└── utils/designKit/
    ├── kitLoader.ts                    # 6단계 적용 파이프라인
    ├── kitExporter.ts                  # 프로젝트 → Kit JSON
    ├── kitValidator.ts                 # JSON 파싱 + Zod 검증
    └── builtinKits/basicKit.ts         # 내장 Basic Kit
```

---

## 2. 문제점 분석

### 2.1 실질적 가치 부재 — 킷 콘텐츠 빈약 (CRITICAL)

**현상:** 내장 킷 1개, 컴포넌트 2개 (Card, Badge). Card는 `Box + 2개 Text`로 구성 — composition의 실제 Card 컴포넌트(CardHeader + CardContent Compositional Architecture)와 무관.

**영향:** 사용자가 패널을 열어도 실질적으로 쓸 것이 없다. "Basic Kit"의 Card는 `Box` 태그에 인라인 스타일을 넣은 것일 뿐, composition의 `Card` 컴포넌트가 아니다.

**근본 원인:** Kit 컴포넌트 스키마(`KitElement`)가 composition의 Compositional Architecture (factory definitions, TAG_SPEC_MAP, 46+ 컴포넌트)와 분리되어 있음. 킷은 자체 `tag: 'Box'` 기본 요소만 사용하고, `tag: 'Card'`나 `tag: 'Button'` 같은 composition 네이티브 컴포넌트를 활용하지 않는다.

### 2.2 composition 컴포넌트 시스템 미활용 (HIGH)

**현상:** Kit이 생성하는 요소는 `Box`, `Text` 기본 태그만 사용. composition가 9개 카테고리에 46+ 컴포넌트를 제공하고, 각각 Factory Definition과 Spec이 있음에도 이를 전혀 활용하지 않는다.

| Kit 현재 사용 | composition 실제 보유                     |
| ------------- | ----------------------------------------- |
| Box, Text     | Button, Input, Select, Card, Tabs, Badge, |
|               | Table, Calendar, DatePicker, Modal,       |
|               | Accordion, ToggleButtonGroup 등 46+ 종류  |

**영향:** Kit으로 만든 컴포넌트는 composition의 Spec 렌더링, Skia 캔버스 렌더링, 스타일 패널 에디터 연동이 제대로 작동하지 않는다.

### 2.3 History 기록 누락 (HIGH)

**현상:** `applyKit()` 호출 후 변수/토큰/Master 컴포넌트가 추가되지만, 전체 작업을 하나의 History 항목으로 기록하지 않는다.

**영향:** 킷 적용 후 Undo 불가능. 사용자가 잘못된 킷을 적용하면 수동으로 하나씩 삭제해야 함.

**코드 위치:** `designKitStore.ts:116-184` — `applyKit` 함수에 `pushHistory()` 호출 없음.

### 2.4 충돌 해결 전략 단순화 (MEDIUM)

**현상:** 충돌 시 `overwrite | skip` 두 가지만 지원. 사용자에게 충돌 내역을 보여주는 UI 없이 자동 적용.

**영향:**

- 기존 변수/토큰이 예고 없이 덮어씌워질 수 있음
- `rename` 전략 미지원 — 이름 충돌 시 기존 값 보존 불가

**코드 위치:**

- `kitLoader.ts:56-98` — `detectConflicts()` 감지만 하고 사용자 확인 없이 진행
- `KitPreview.tsx` — 충돌 내역 표시 UI 없음

### 2.5 Export 기능 빈약 (MEDIUM)

**현상:** Export 시 메타데이터가 하드코딩:

```typescript
exportCurrentAsKit(
  { name: "My Kit", version: "1.0.0" }, // 하드코딩
  elements,
  childrenMap,
);
```

**영향:** 사용자가 킷 이름, 설명, 작성자, 태그를 입력할 수 없다. 모든 Export는 "My Kit v1.0.0"으로 생성.

**코드 위치:** `DesignKitPanel.tsx:123-138` — `handleExport` 함수.

### 2.6 시각적 미리보기 부재 (MEDIUM)

**현상:** 킷 카드와 컴포넌트 목록에 아이콘(Package, Box)만 표시. 실제 디자인 미리보기 이미지 없음.

**영향:** 사용자가 킷의 시각적 결과물을 적용 전에 확인할 수 없다. 특히 Import한 외부 킷의 내용을 알 수 없음.

### 2.7 온라인 공유/마켓플레이스 부재 (LOW — 현 단계)

**현상:** JSON 파일 수동 교환만 가능. Supabase 저장소, 공유 킷 라이브러리 미구현.

**영향:** 팀 간 킷 공유가 파일 전송에 의존. 커뮤니티 킷 생태계 불가.

### 2.8 변수 바인딩 ($--) 불완전 (MEDIUM)

**현상:** Kit 컴포넌트의 `$--primary` 같은 변수 참조가 저장되지만, 스타일 패널에서 편집 시 완전히 해석되지 않음.

**코드 위치:** `basicKit.ts:105` — `backgroundColor: '$--surface'` 참조는 적용 시 교체되지 않고 문자열 그대로 저장.

### 2.9 테마 매핑 불안정 (MEDIUM)

**현상:** Kit → 프로젝트 테마 매핑이 테마 이름 기반 (`find(t => t.name === kitTheme.name)`). 이름 변경 시 매핑 깨짐.

**코드 위치:** `kitLoader.ts:120` — 이름 기반 검색.

### 2.10 코드 컨벤션 위반 (LOW)

- `KitPreview.tsx:31` — 인라인 `style={{ fontSize: 12, color: '#6b7280', ... }}` (tv() + CSS 필수 규칙 위반)
- `KitBrowser.tsx`, `KitComponentList.tsx` — `<div role="button">` 대신 React Aria `useButton` hook 미사용

---

## 3. 문제점 종합 평가

| #   | 문제점                             | 심각도   | 영향 범위          | 구현 난이도 |
| --- | ---------------------------------- | -------- | ------------------ | ----------- |
| 1   | 킷 콘텐츠 빈약                     | CRITICAL | 기능 가치 전체     | HIGH        |
| 2   | composition 컴포넌트 시스템 미활용 | HIGH     | 렌더링/스펙/에디터 | HIGH        |
| 3   | History 기록 누락                  | HIGH     | Undo/Redo          | LOW         |
| 4   | 충돌 해결 UI 부재                  | MEDIUM   | 데이터 안전성      | MEDIUM      |
| 5   | Export 메타데이터 UI 부재          | MEDIUM   | 사용성             | LOW         |
| 6   | 시각적 미리보기 부재               | MEDIUM   | 사용성             | MEDIUM      |
| 7   | 온라인 공유 부재                   | LOW      | 협업/생태계        | HIGH        |
| 8   | 변수 바인딩 불완전                 | MEDIUM   | 테마 연동          | MEDIUM      |
| 9   | 테마 매핑 불안정                   | MEDIUM   | 킷 적용 안정성     | LOW         |
| 10  | 코드 컨벤션 위반                   | LOW      | 코드 품질          | LOW         |

---

## 4. Alternatives Considered

### 대안 A: 점진적 개선 (Incremental Enhancement)

현재 아키텍처를 유지하면서 문제점을 우선순위별로 단계 수정.

- **설명:** 기존 5-Layer 아키텍처, Kit JSON 스키마, 6-step 파이프라인을 그대로 유지. 내장 킷 확충, History 통합, UI 개선을 순차적으로 진행.
- **장점:** 기존 코드 재활용 극대화, 단계별 검증 가능, 낮은 마이그레이션 비용
- **위험:** 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 유지보수 MEDIUM: 킷 스키마가 composition 컴포넌트와 분리된 구조적 문제가 남음

### 대안 B: Kit 스키마 v2 전면 재설계

Kit JSON 스키마를 composition의 Factory Definition + Compositional Architecture에 맞게 재설계.

- **설명:** `KitElement`를 composition의 `ChildDefinition` (factory) 포맷으로 교체. Kit 컴포넌트가 `tag: 'Card'`를 쓰면 자동으로 CardHeader + CardContent Compositional 구조가 생성되도록 Factory 시스템과 통합.
- **장점:** composition 네이티브 컴포넌트 완전 활용, Spec/렌더링/에디터 자동 연동
- **위험:** 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(H)
- 마이그레이션 HIGH: 기존 `.kit.json` 포맷과 하위 호환 깨짐, v1→v2 마이그레이션 필요

### 대안 C: Pencil-Style 디자인 시스템 통합

Pencil 앱의 디자인 시스템 접근법을 참조하여, 킷을 단순 JSON이 아닌 **프로젝트 수준 디자인 시스템**으로 격상.

- **설명:** `.pen` 파일의 `get_variables`, `set_variables`, `get_style_guide` 개념을 composition 킷에 적용. 킷이 변수/토큰/컴포넌트 묶음이 아닌, 완전한 스타일 가이드(Typography Scale, Color Palette, Spacing System, Component Library)를 포함.
- **장점:** 디자인 시스템 완성도 극대화, AI 연동 (ADR-011 Phase B)과 시너지
- **위험:** 기술(H) / 성능(M) / 유지보수(M) / 마이그레이션(H)
- 기술 HIGH: 스타일 가이드 자동 생성, 컴포넌트 라이브러리 관리 등 대규모 신규 기능 필요

---

## 5. Risk Threshold Check

- 대안 A: 위험 LOW 위주 → **통과**
- 대안 B: 마이그레이션 HIGH 1개 → 관리 가능 (v1→v2 자동 변환기 작성)
- 대안 C: HIGH 2개 → 현 단계에서 과도한 범위

---

## 6. Decision

**대안 A (점진적 개선) + 대안 B 핵심 요소 선별 적용**

대안 A를 기반으로 하되, 대안 B의 핵심인 **composition Factory 통합**을 Phase 2에서 도입한다. 이를 통해:

1. 즉시 가치를 제공할 수 있는 개선 (History, UI, 내장 킷)을 빠르게 적용
2. 구조적 문제 (Kit ↔ composition 컴포넌트 분리)를 Phase 2에서 해결
3. 대안 C의 범위는 ADR-011 Phase B AI 연동과 함께 장기 검토

### 위험 수용 근거

- 점진적 접근이므로 각 Phase를 독립 검증 가능
- Phase 1은 기존 스키마를 변경하지 않아 마이그레이션 위험 없음
- Phase 2의 스키마 v2는 `formatVersion: '2.0'` + v1 자동 변환으로 하위 호환 보장

---

## 7. Gates

| Gate   | 시점            | 통과 조건                                             | 실패 시 대안                     |
| ------ | --------------- | ----------------------------------------------------- | -------------------------------- |
| Gate 1 | Phase 1 완료 후 | History 통합 동작 확인 (적용 → Undo → 원복 검증)      | History 로직 재검토              |
| Gate 2 | Phase 2 착수 전 | Kit v2 스키마 프로토타입 → Factory 3개 이상 연동 확인 | 대안 A만으로 유지, v2 보류       |
| Gate 3 | Phase 2 완료 후 | 내장 킷 5+개, 각 킷의 컴포넌트가 Canvas/Preview 정상  | 개별 킷 디버그, 스키마 롤백 경로 |

---

## 8. 실행 로드맵

### Phase 1: 즉시 개선 (기존 스키마 유지)

```
P1-1: History 통합 — applyKit 전후 pushHistory() (HIGH, 구현 난이도 LOW)
P1-2: 충돌 해결 UI — KitPreview에 충돌 목록 표시 + 사용자 확인 (MEDIUM)
P1-3: Export 메타데이터 UI — 이름/설명/태그 입력 다이얼로그 (MEDIUM, 난이도 LOW)
P1-4: 코드 컨벤션 수정 — 인라인 스타일 → CSS, div role="button" → React Aria (LOW)
P1-5: 테마 매핑 안정화 — 이름 기반 → ID 기반 매핑 옵션 (MEDIUM, 난이도 LOW)
```

### Phase 2: composition 컴포넌트 통합 (Kit v2 스키마)

```
P2-1: Kit 스키마 v2 설계 — KitElement에 composition tag 연동, Factory ChildDefinition 호환
P2-2: v1 → v2 자동 마이그레이션 — validateKitJSON에 버전 감지 + 변환 추가
P2-3: Factory 통합 — Kit 컴포넌트가 createFromFactory() 활용
P2-4: 내장 킷 확충 — composition 네이티브 컴포넌트 활용 킷 5~10개
      - Dashboard Kit: Card + DataTable + Badge + Chart placeholder
      - Form Kit: Input + Select + Checkbox + Button + DatePicker
      - Navigation Kit: Tabs + Sidebar layout + Breadcrumb
      - Landing Kit: Hero section + Feature grid + CTA
      - E-commerce Kit: Product card + Cart + Price display
P2-5: 컴포넌트 썸네일 — Skia 스냅샷 기반 미리보기 이미지 생성
```

### Phase 3: 생태계 확장 (장기)

```
P3-1: Supabase 킷 저장소 — 프로젝트별 킷 영속화
P3-2: 킷 공유 — 퍼블릭/팀 킷 라이브러리
P3-3: 킷 버전 관리 — semver 기반 업데이트 감지
P3-4: AI 연동 — ADR-011 Phase B create_composite 도구와 킷 컴포넌트 연결
P3-5: 변수 바인딩 완성 — $-- 참조의 실시간 해석 + 에디터 연동
```

---

## 9. Phase 1 상세 설계

### 9.1 P1-1: History 통합

**현재 문제:** `applyKit()` 내부에서 `themeAccess.bulkUpsertTokens()`, `themeAccess.setDesignVariables()`, `elementAccess.addElement()`를 순차 호출하지만, 전체를 하나의 History 항목으로 감싸지 않음.

**해결:**

```typescript
// designKitStore.ts applyKit 수정
const mainStore = useStore.getState();

// 적용 전 스냅샷 기록
mainStore.pushHistory("applyDesignKit");

const result = await applyDesignKit(
  kit,
  projectId,
  themeAccess,
  elementAccess,
  options,
);

if (!result.success) {
  // 실패 시 히스토리 롤백
  mainStore.undo();
}
```

**파일 변경:** `designKitStore.ts` (1개 파일)

### 9.2 P1-2: 충돌 해결 UI

**현재:** `detectConflicts()` 결과를 사용자에게 보여주지 않고 자동 `overwrite`.

**해결:** `KitPreview`에 충돌 목록 표시 + Apply 전 확인 단계 추가.

```
[KitPreview]
  ├── 킷 정보 (이름, 버전, 통계)
  ├── [충돌 감지 시] 충돌 목록 (variable/token/component별)
  │   └── 각 항목: overwrite | skip 토글
  └── 적용 버튼 (충돌 확인 후 활성화)
```

**파일 변경:** `KitPreview.tsx`, `kitLoader.ts` (충돌 결과를 UI에 전달하는 인터페이스 추가)

### 9.3 P1-3: Export 메타데이터 UI

**현재:** `{ name: 'My Kit', version: '1.0.0' }` 하드코딩.

**해결:** Export 버튼 클릭 시 메타데이터 입력 다이얼로그 표시.

```
[ExportDialog]
  ├── 킷 이름 (TextField)
  ├── 버전 (TextField, default "1.0.0")
  ├── 설명 (TextArea, optional)
  ├── 작성자 (TextField, optional)
  ├── 태그 (TagGroup, optional)
  └── Export 버튼
```

**파일 변경:** 신규 `components/ExportDialog.tsx`, `DesignKitPanel.tsx` 수정

### 9.4 P1-4: 코드 컨벤션 수정

| 파일              | 위반              | 수정                             |
| ----------------- | ----------------- | -------------------------------- |
| KitPreview.tsx:31 | 인라인 style 사용 | CSS 클래스로 이동                |
| KitBrowser.tsx    | div role="button" | 시맨틱 요소 또는 React Aria hook |
| KitComponentList  | div role="button" | 시맨틱 요소 또는 React Aria hook |

### 9.5 P1-5: 테마 매핑 안정화

**현재:** `themeAccess.themes.find(t => t.name === kitTheme.name)` — 이름 기반.

**해결:** Kit 스키마에 `themeMapping` 옵션 필드 추가. 적용 시 사용자가 Kit 테마 → 프로젝트 테마 매핑을 선택할 수 있는 UI 제공.

```typescript
interface KitApplyOptions {
  // 기존
  conflictResolution: "overwrite" | "skip";
  // 추가
  themeMapping?: Record<string, string>; // kitThemeName → projectThemeId
}
```

---

## 10. Phase 2 상세 설계

### 10.1 P2-1: Kit 스키마 v2

**핵심 변경:** `KitElement`가 composition의 Factory `ChildDefinition`과 호환.

```typescript
// v2 KitElement
interface KitElementV2 {
  localId: string;
  tag: string; // composition 네이티브 태그 사용 ('Card', 'Button' 등)
  props: Record<string, unknown>;
  parentLocalId: string | null;
  orderNum: number;
  componentRole?: "master" | "instance";
  componentName?: string;
  variableBindings?: string[];
  // v2 추가 필드
  useFactory?: boolean; // true → createFromFactory() 사용
  factoryOverrides?: Record<string, unknown>; // Factory 기본값 오버라이드
  children?: KitElementV2[]; // 인라인 자식 정의 (Compositional)
}
```

**v1 → v2 변환 규칙:**

- `formatVersion: '1.0'` 감지 시 자동 변환
- `tag: 'Box'` → 그대로 유지 (기본 요소)
- 새 v2 킷의 `tag: 'Card'` → `useFactory: true` → Factory가 CardHeader + CardContent 자동 생성

### 10.2 P2-4: 내장 킷 예시 — Dashboard Kit

```typescript
const DASHBOARD_KIT: DesignKit = {
  formatVersion: '2.0',
  meta: { name: 'Dashboard Kit', version: '1.0.0', ... },
  variables: [
    { name: 'brand-primary', type: 'color', defaultValue: '#3B82F6' },
    { name: 'brand-secondary', type: 'color', defaultValue: '#10B981' },
    { name: 'surface', type: 'color', defaultValue: '#F8FAFC' },
    { name: 'card-radius', type: 'number', defaultValue: 12 },
  ],
  themes: [{ name: 'Dashboard Default', status: 'active', tokens: [...] }],
  components: [
    {
      master: {
        localId: 'stat-card',
        tag: 'Card',           // composition 네이티브 Card 컴포넌트
        useFactory: true,      // Factory 활용
        props: { style: { width: 280, height: 'auto' } },
        componentRole: 'master',
        componentName: 'Stat Card',
      },
      descendants: [
        // Factory가 CardHeader + CardContent를 자동 생성
        // factoryOverrides로 기본 텍스트/스타일 커스터마이즈
      ],
    },
    {
      master: {
        localId: 'data-table-card',
        tag: 'Card',
        useFactory: true,
        componentRole: 'master',
        componentName: 'Data Table Card',
        // Card 내부에 DataTable 배치
      },
      descendants: [...],
    },
  ],
};
```

### 10.3 P2-5: 컴포넌트 썸네일 생성

**접근:** Kit 적용 후 또는 Master 등록 시, Skia CanvasKit로 해당 컴포넌트를 오프스크린 렌더링하여 PNG 스냅샷 생성.

```
Master Component → Skia offscreen render → PNG → base64 → Kit thumbnailUrl
```

이 기능은 기존 Skia 렌더러 (`nodeRenderers.ts`)를 재사용할 수 있으나, 오프스크린 CanvasKit 인스턴스 관리가 필요하다.

---

## 11. 재구성 대상 파일 요약

| 파일                                               | 변경 내용                          | Phase |
| -------------------------------------------------- | ---------------------------------- | ----- |
| `stores/designKitStore.ts`                         | History 통합, 충돌 결과 UI 전달    | P1    |
| `panels/designKit/components/KitPreview.tsx`       | 충돌 목록 UI, 인라인 스타일 제거   | P1    |
| `panels/designKit/DesignKitPanel.tsx`              | Export 다이얼로그 연동             | P1    |
| `panels/designKit/DesignKitPanel.css`              | KitPreview 인라인 스타일 이전      | P1    |
| `panels/designKit/components/KitBrowser.tsx`       | React Aria 적용                    | P1    |
| `panels/designKit/components/KitComponentList.tsx` | React Aria 적용                    | P1    |
| `panels/designKit/components/ExportDialog.tsx`     | 신규: Export 메타데이터 입력 UI    | P1    |
| `utils/designKit/kitLoader.ts`                     | 충돌 결과 인터페이스, themeMapping | P1    |
| `types/builder/designKit.types.ts`                 | v2 스키마 타입, themeMapping 옵션  | P2    |
| `utils/designKit/kitValidator.ts`                  | v1 → v2 자동 변환                  | P2    |
| `utils/designKit/kitLoader.ts`                     | Factory 통합 (createFromFactory)   | P2    |
| `utils/designKit/builtinKits/`                     | 5~10개 네이티브 킷 추가            | P2    |
| `utils/designKit/kitThumbnail.ts`                  | 신규: Skia 오프스크린 썸네일       | P2    |

---

## Consequences

### Positive

- **Phase 1 즉시 가치**: History 통합으로 안전한 킷 적용, Export 메타데이터로 기본 사용성 확보
- **Phase 2 구조 개선**: composition 네이티브 컴포넌트 활용으로 킷 품질 비약적 향상
- **기존 아키텍처 유지**: 5-Layer 구조, Zod 검증, 순수 함수 파이프라인 등 좋은 설계를 보존
- **AI 연동 시너지**: Phase 2 킷이 ADR-011 Phase B의 `create_composite` 도구와 자연스럽게 연결

### Negative

- **Phase 2 마이그레이션 비용**: v1 → v2 스키마 변환 로직 필요
- **내장 킷 유지보수**: composition 컴포넌트 변경 시 내장 킷도 함께 업데이트 필요
- **번들 크기 주의**: 내장 킷 데이터 + 썸네일이 번들에 포함되므로 500KB 제약 고려 필요 (lazy load 권장)

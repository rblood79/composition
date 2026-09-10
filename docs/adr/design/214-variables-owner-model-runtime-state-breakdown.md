# ADR-214 Design Breakdown: Variables 소유자 모델 — 프로젝트 · 페이지 · 요소 상태와 소비 경로

> 본문: [214-variables-owner-model-runtime-state.md](../214-variables-owner-model-runtime-state.md) · 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §2-2 U11 · §4-2 UX-10 · 시안: artifact `f7d8327e` 아트보드 "VarsIndex" (Data · Variables 인덱스) · "ElementState" (Properties · 상태 절) · "ActionPicker" (Interactions · 상태 설정 picker)

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-10 판정 ⑤ · 2026-09-11 판정 ③ "Variables 는 셋째 ADR")

1. **base / 응용**: 본 ADR 은 **base** (변수 모델 · 가시성 · 런타임 store · 소비 경로 2종). ADR-152 (collection 참조 계약) 와 **직교** — 변수는 collection 이 아니고 (ADR-131 Phase 8 "데이터 SSOT = `data_tables`" 전제는 collections 에 관한 것), 본 ADR 은 그 전제를 건드리지 않는다. ADR-212 와는 "Data" 패널 Variables 탭 표면만 공유 (212 R5 조건부 탭 → 본 ADR 이 대체). ADR-213 은 후속으로 `list_variables` 읽기 tool 을 얹을 수 있다 (범위 밖).
2. **schema 직교**: 신설은 `VariableOwner` · `CanonicalNode.state?` · page `state?` · `SetStateAction` · 템플릿 `{{ }}` 해석기. `PropertyDataBinding` (159) · `DataChange` (152) 는 무변경. `PropertyDataBinding.source:"variable"` (159 P4b read 호환 잔존) 은 **부활시키지 않는다** — 새 읽기 경로는 prop 문자열 템플릿이다.
3. **의존 방향**: canonical 문서 (요소 · 페이지 소유 변수) ← 본 ADR → interactions (`events` root collection 의 action kind 추가) → preview/publish 런타임 (shared dispatcher). ADR-112 origin/instance 는 노드 필드가 투영되므로 별도 전파 코드 0 — 값은 런타임 store 가 인스턴스별로 갖는다.
4. codex 1차 진입 전 본 lock-in 완료. 판정 5 의 남은 세부 (shadowing) 는 §3 에서 결정: **가시성 사슬 안 이름 고유 (shadowing 금지)**.

## 2. 현행 인벤토리 (2026-09-10~11 실측 — Phase 0 에서 freeze)

| 표면               | 파일                                                                                                                                                                                                    | 현재                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 타입               | `types/builder/data.types.ts:266-305` `Variable { id, name, project_id, type 5종, defaultValue, persist, scope: global\|page\|component, page_id? }`                                                    | `component` scope 에 소유자 id 없음 — 구조가 못 선다 (U11)                                           |
| 저장               | `useDataStore.variables` (IndexedDB `variables`, project_id 키)                                                                                                                                         | 전부 프로젝트 레벨 저장                                                                              |
| 전달               | `builder/hooks/useIframeMessenger.ts:549,556,626` `UPDATE_VARIABLES`                                                                                                                                    | preview 로 정의 배열 전송                                                                            |
| 런타임             | `preview/store/runtimeStore.ts:606-640` `setVariables` → `appState` / `pageStates` 기본값 초기화 · `setState` / `getState`                                                                              | **읽는 곳 0 · 쓰는 액션 0**                                                                          |
| interactions       | `packages/shared/src/interactions/interactionRule.types.ts` `InteractionAction = Navigate \| Toast \| Capability` · `capabilityRegistry.ts` `APP_ACTIONS { navigate, toast }` · `dispatcher.ts:140,147` | 상태 액션 없음                                                                                       |
| 컴포넌트 암묵 상태 | `capabilityRegistry.ts` `CAPABILITY_REGISTRY[type]` (selectItem · expand · show/hide …)                                                                                                                 | RAC 가 가진 `value` · `isSelected` · `selectedKey` 는 capability 로만 존재, 이름 붙여 읽는 경로 없음 |
| publish            | `apps/publish/src` grep `variables` 0                                                                                                                                                                   | 소비 0                                                                                               |
| 레거시 바인딩      | `collection.types.ts:243` `source: "variable"` read 호환                                                                                                                                                | 오소링 제거됨 (159 P4b) — 소비처 0 확증 대기 (159 G4)                                                |
| 관리 UI            | `panels/datatable/components/VariableList.tsx` · `editors/VariableEditor.tsx` (478) — Basic / Validation / Transform · `VariableCreator.tsx` (Track 0)                                                  | 프로젝트 레벨 목록 + 편집기                                                                          |
| 캔버스 노드        | `packages/shared/src/types/composition-document.types.ts:791` `CanonicalNode { id, type, name?, props?, … }` · scene signature 는 `props` 만 (`buildSceneSnapshot.ts:49-66`)                            | `state` 필드를 더해도 scene rebuild 를 일으키지 않는다 (시각 아님)                                   |

## 3. 모델 (Phase 1 산출물)

```ts
// packages/shared/src/state/variable.types.ts (신규 — builder · preview · publish 공용)
type VariableOwner =
  | { kind: "project" }
  | { kind: "page"; pageId: string }
  | { kind: "element"; elementId: string };

interface VariableDef {
  id: string;
  name: string; // 가시성 사슬 안 고유 — shadowing 금지 (생성 시 거부)
  type: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: unknown;
  persist?: boolean; // project 만 (localStorage)
}
// 저장 위치 (소유자별):
//   project → 기존 `useDataStore.variables` (IndexedDB) — `Variable.owner` additive, `scope/page_id` 는 lazy 변환
//   page    → canonical page 객체 `state?: VariableDef[]`
//   element → `CanonicalNode.state?: VariableDef[]` (노드 필드 — 삭제 · 복제 · 붙여넣기 · origin/instance 투영이 자동)
```

- **가시성** `resolveVisibleVariables(doc, elementId | pageId | null)`: 요소 → 조상 요소들 → 페이지 → 프로젝트 순으로 모은 목록. 같은 이름이 사슬에 둘이면 생성 시점에 거부한다 (편집기 · Properties · AI 제안 모두 같은 검증기).
- **런타임 값** (`packages/shared/src/state/runtimeState.ts`): `projectState` (persist 는 localStorage) · `pageStates[pageId]` (페이지 진입 시 기본값 리셋) · `elementStates[instanceKey]` — `instanceKey` = 렌더된 노드의 안정 id (ref 인스턴스는 `refNodeId/childId` 경로, ADR-112 projected id 규약 재사용 — Phase 0 에서 확인, R3). 요소가 unmount 되면 값 폐기.
- **읽기 문법** — string prop 안 `{{ name }}` (공백 허용, `{{ a.b }}` 경로 접근, `\{{` 는 리터럴). ADR-159 `{field}` (단일 중괄호 · collection 행 문맥) 과 문법이 다르고 해석기도 별개 — 한 문자열에 둘이 있으면 `{field}` 먼저 (행 문맥) → `{{ }}` (상태). **캔버스 (Skia) 는 기본값 환경**으로, preview/publish 는 런타임 값으로 같은 해석기를 돈다 — 설계된 비대칭 (값 형식은 같은 함수라 동일).
- **쓰기** — `InteractionAction` 에 `SetStateAction { kind: "setState"; variableId; op: "set" | "toggle" | "increment" | "reset"; value? }` 추가. picker 는 가시성 사슬을 "프로젝트 / 이 페이지 / 이 컴포넌트와 조상" 그룹으로 보여 준다 (ActionPicker 아트보드). 암묵 상태 (RAC `value` · `isSelected` · `selectedKey`) 는 capability 와 같은 경로로 노출하되 이름을 붙여 `{{ }}` 로 읽을 수 있게 한다 (Properties 상태 절 — D1/D2 무변경, RAC prop 을 읽기만).
- **환경값 · secret** (`{{env.NAME}}`) 은 변수가 아니다 — ADR-212 Phase 4 vault. 본 ADR 범위 밖.

## 4. Phase 계획

### Phase 0 — Inventory freeze (게이트 G0)

- [ ] `runtimeStore` appState/pageStates 실제 형상 · `UPDATE_VARIABLES` payload · publish 런타임 store 유무
- [ ] ADR-112 projected instance id 규약 실측 (`canvasSceneNode.ts` · preview 렌더 노드 key) → `instanceKey` 정의 (R3)
- [ ] `CAPABILITY_REGISTRY` 에서 암묵 상태 후보 표 (컴포넌트별 RAC value/selection prop)
- [ ] Properties 패널 fieldset/legend 절 패턴 (메모리 `feedback-panel-field-group-fieldset-legend-pattern`) · Navigator 페이지 항목 설정 진입 유무
- [ ] 기존 프로젝트의 `Variable.scope` 분포 (global/page/component 건수) — lazy 변환 대상

### Phase 1 — 모델 + 가시성 + 저장 (게이트 G1)

- [ ] `packages/shared/src/state/variable.types.ts` + zod · `Variable.owner` additive (`scope:"global"` → project, `"page"+page_id` → page, `"component"` → **project 로 승격 + 경고 로그** — 소유자 id 가 없어 복원 불가, 실측 건수 G0)
- [ ] canonical `CanonicalNode.state?` · page `state?` 스키마 + adapter (export/import envelope 포함) + `isVariableDef` 가드
- [ ] `resolveVisibleVariables` + 이름 고유 검증기 (unit: 사슬 4단 · 충돌 거부 · 조상 변경 시 재검증)
- [ ] 프로젝트 변수 CRUD 는 ADR-152 적용기 op `define_variable` (History) — 152 미완이면 기존 `createVariable/updateVariable` 유지 후 나중에 wrapper
- [ ] G1: 기존 변수 로드 재직렬화 0 · scene signature 무변경 (state 편집이 sceneVersion 을 올리지 않음) test

### Phase 2 — 런타임 store (shared) + preview/publish 초기화 (게이트 G2 전반)

- [ ] `packages/shared/src/state/runtimeState.ts` — 세 스코프 · 기본값 초기화 · 페이지 진입 리셋 · persist (project 만) · 의존 인덱스 (variableId → 구독 노드) 로 변경 시 해당 노드만 갱신 (R6)
- [ ] preview `runtimeStore` 가 shared 를 감싼다 (기존 `appState/pageStates` 는 read 호환 alias) · publish 도 같은 모듈 (방침상 live 검증은 preview 까지)
- [ ] `UPDATE_VARIABLES` 가 정의 3종 (project 배열 + 문서 안 page/element 는 문서 자체로) 를 전달

### Phase 3 — 읽기: `{{ }}` 템플릿 (게이트 G2)

- [ ] 해석기 `resolveStateTemplate(value, env)` (`packages/shared/src/state/template.ts`) — string prop 만, `\{{` 리터럴, `{field}` 와 순서 규약, 타입 → 문자열 형식 함수 1개
- [ ] DOM 렌더러 (preview/publish `CanonicalNodeRenderer` 텍스트 · 문자열 prop 읽기 지점) 가 런타임 env 로 해석 · Skia 텍스트 표시 (`canvasSceneNode` 텍스트 source) 가 기본값 env 로 해석 — 같은 함수, 다른 env
- [ ] Properties 문자열 입력에 `{{` 자동완성 (가시성 사슬 목록)
- [ ] G2 live: 프로젝트 변수 `userName` 기본값 "guest" → Text `Hello {{ userName }}` → 캔버스 "Hello guest" · preview "Hello guest"

### Phase 4 — 쓰기: `setState` 액션 (게이트 G3)

- [ ] `SetStateAction` 타입 + `isInteractionRule` 확장 + shared `dispatcher.ts` 분기 (set/toggle/increment/reset, 타입 검증)
- [ ] `ActionPicker` 에 "상태 설정" 그룹 (프로젝트 / 이 페이지 / 이 컴포넌트와 조상) + 값 입력은 타입별 (boolean 토글 · number 증가)
- [ ] 암묵 상태 읽기 — capability 경로에서 RAC prop 값을 `elementStates` 에 미러 (이름 붙인 것만)
- [ ] G3 live: Button `onPress` → setState `userName = "Ana"` → preview Text 갱신 · 요소 변수 `count` increment — 같은 origin 의 인스턴스 2개가 각자 값 · 페이지 이동 후 페이지 변수 리셋 · 프로젝트 변수 유지 · `persist` 는 새로고침 후 유지

### Phase 5 — 관리 표면 3 (게이트 G4)

- [ ] Data 패널 Variables 탭 = 프로젝트 변수 편집 + **전체 인덱스** (페이지 · 요소 변수는 소유자 열 + 읽기 전용, 클릭 → 소유자로 점프: 페이지 선택 / 요소 선택 + Properties 상태 절 스크롤) (VarsIndex 아트보드). 212 R5 조건부 표시를 본 탭이 대체
- [ ] Navigator 페이지 항목 → 페이지 설정 (페이지 변수 목록 · `+ 추가`)
- [ ] Properties "상태" 절 (fieldset/legend) — 암묵 상태 목록 (이름 붙이기) + 명시 상태 `+ 추가` (ElementState 아트보드) · 삭제는 사용처 (템플릿 · setState 규칙) N 확인
- [ ] `VariableEditor` Validation / Transform 탭은 소비처 0 확인 후 숨김 (원본 삭제는 승인 후 별도 커밋)
- [ ] G4 live: 인덱스에 3 소유자 행 · 클릭 점프 · Properties 에서 `+ 추가` → 인덱스에 즉시 · 이름 충돌 거부 메시지

### Phase 6 — closure

- [ ] ADR-159 `source:"variable"` read 호환은 그대로 (부활 없음) — 문서에 명시
- [ ] ADR-213 후속 `list_variables` 읽기 tool 자리 문서화 (범위 밖)
- [ ] CHANGELOG (Features — Variables) · ADR README · `.claude/rules/state-management.md` 상태 스코프 절 · `### Live Exercise`

## 5. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                                                               | Phase | 변경                                     |
| ------------------------------------------------------------------------------------------------------------------ | :---: | ---------------------------------------- |
| `packages/shared/src/state/{variable.types,runtimeState,template,visibility}.ts` (신규)                            | 1·2·3 | 모델 · 런타임 · 해석기 · 가시성          |
| `packages/shared/src/types/composition-document.types.ts`                                                          |   1   | `CanonicalNode.state?` · page `state?`   |
| `apps/builder/src/types/builder/data.types.ts` · `stores/utils/dataActions.ts`                                     |   1   | `Variable.owner` additive · lazy 변환    |
| `apps/builder/src/adapters/canonical/*` · export/import envelope                                                   |   1   | `state` 직렬화                           |
| `apps/builder/src/preview/store/runtimeStore.ts` · `apps/publish/src/*` (런타임)                                   |   2   | shared 런타임 감싸기                     |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts`                                                             |   2   | payload                                  |
| `packages/shared/src/renderers/*` (문자열 prop 읽기) · `workspace/canvas/scene/canvasSceneNode.ts` (텍스트 source) |   3   | 해석기 호출 (env 2종)                    |
| `packages/shared/src/interactions/{interactionRule.types,dispatcher,capabilityRegistry}.ts`                        |   4   | `SetStateAction` · 분기 · 암묵 상태 미러 |
| `apps/builder/src/builder/panels/interactions/ActionPicker.tsx`                                                    |   4   | 상태 설정 그룹                           |
| `panels/datatable/components/VariableList.tsx` · `editors/VariableEditor.tsx`                                      |   5   | 인덱스 + 소유자 열 · 탭 정리             |
| `panels/properties/*` (상태 절 신규) · Navigator 페이지 설정                                                       |   5   | 관리 표면 2                              |

## 6. 검증 전략

- 정적: 가시성 · 이름 고유 · 해석기 (리터럴 escape · `{field}` 순서 · 타입 형식) · dispatcher 4 op · lazy 변환 (scope 3종) · scene signature 무변경 unit
- 대칭: 캔버스 기본값 env ↔ preview 런타임 env 가 같은 형식 함수 — `/cross-check` 는 텍스트 노드 1종 (기본값 상태에서 Skia == DOM)
- live (게이트마다 1회, Playwright headless — preview 탭 함정 메모리 `reference-preview-iframe-compare-mode-and-resend-gap` · `reference-vite-dynamic-import-separate-store-instance`: 상태 변경은 실제 UI 로): G2 읽기 · G3 쓰기 (인스턴스 2 · 페이지 리셋 · persist) · G4 표면
- 성능: 변수 변경 시 의존 노드만 갱신 — 600 요소 프로젝트에서 setState 1회 프레임 (`perf-baseline.mjs` frame lane) 이 전체 리렌더 경로가 아님을 확인 (R6)

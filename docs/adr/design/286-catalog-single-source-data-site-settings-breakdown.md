# ADR-286 design breakdown — 빌더 코드의 소스 = 단일 catalog

> 본문: [286-catalog-single-source-data-site-settings.md](../286-catalog-single-source-data-site-settings.md). 착수는 ADR-285 Implemented (G5) 뒤.

## 0. 전제 lock-in (fork 4 질문 — ADR-131 · 248 의 데이터 경계 결정을 바꾸는 새 ADR)

1. **base / 응용**: ADR-248 (통합 catalog 문서) 이 base, 이 ADR 은 그 모델에 entry 3 종과 project · page 필드를 더하는 응용. 248 이 선행. ADR-285 (코드 보기 역변환) 는 이 ADR 의 **소비자** — 285 가 먼저 닫히고 (사용자 결정 10-27 「ADR-285 먼저 닫기」) 이 ADR 이 그 입력을 바꾼다.
2. **schema 직교성**: 저장 스키마를 바꾼다 (contract 50 → 51 — entry 3 종 · `ProjectEntry.collectionIds` · `endpointIds` · `projectVariableIds` · `site`, `PageEntry.meta`). ADR-284 의 `ViewEntry` · 조건 트리 · ADR-152 의 `DataCollectionId` · `{#id}` 참조 모양은 그대로 — 정의의 **집** 이 바뀌지 참조가 바뀌지 않는다.
3. **선행 ADR 전제 reverse 검증**: ADR-131 Phase 8 (「데이터 SSOT = `data_tables`, 문서 root 격상은 잘못된 관점」) · ADR-248 H1 (「별도 data SSOT 유지」) 은 **사용자가 2026-10-27 에 바꿨다** (본문 Status 확인 항목 1). 그때의 근거 (읽기 통합 소비 · element 별 binding 참조) 는 읽는 쪽의 사실이라 유지되고, 이 ADR 이 뒤집는 것은 「정의가 어디 사는가」 뿐이다. grep: `useCollectionData` · `resolveCollectionItems` · `CollectionDataSource` 는 무변경 (본문 제약 「읽는 쪽 계약 유지」).
4. **판독 라운드에 미루지 않음**: 위 1 ~ 3 은 사용자 확인 (2026-10-27 AskUserQuestion 3회 — 범위 · 순서 · 설정 포함 · SSO 형태) 으로 확정.

## 1. Phase 0 — inventory · RED (G0)

### 1a. 쓰기 지점 전수 (R1)

| 경로 (실측 2026-10-27)                                                                                                                 | 종류                                        | 이관 뒤                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `apps/builder/src/builder/stores/utils/dataActions.ts` — `getDB()` 11 곳 (123 · 171 · 406 · 446 · 503 · 563 · 900 · 972 · 1094 · 1201) | collection · endpoint · variable CRUD + IDB | 삭제 — 명령 (`commands/data.ts`) 로                           |
| `stores/utils/dataChange.ts` — `reduceDataOps` → `set` + `persistablePatch` → `db.collections.update` …                                | `DataChange` 적용기 (ADR-213 단일 진입점)   | op → 명령 생성기 (op 어휘 유지)                               |
| `stores/data.ts:385` `getProjectVariableDefinitions` · `useCatalogProjectFiles.tsx:93 ~ 111` (내보내기 extras)                         | 읽기 · 내보내기                             | 문서에서 — extras 3 키 삭제                                   |
| `CatalogBuilderCore.tsx:568 · 583` `setDataHistoryRecorder` · `setDocumentVariableNamesReader`                                         | history · 이름 충돌 검사                    | 삭제 — 명령이 history 를 자연히 만든다                        |
| `CatalogBuilderCore.tsx:538 ~ 563` `useDataStore.subscribe` → `workspace.refreshRows` · `refreshState`                                 | Canvas 사후 갱신 (store → 화면)             | 정의 변경은 consume plan 으로 · runtimeData 만 구독 유지 (§2) |
| `panels/datatable/**` 15 파일 (DataTablePanel · Editor · Field · grid · presets · stores · usage)                                      | 패널 쓰기 (`useDataStore` 액션 호출)        | 액션 이름 유지, 구현만 `workspace.execute`                    |
| `services/ai/data` 2 · `services/ai/tools` 1 · `services/agent/{executeAgentCommand,dataAgentCommands}.ts`                             | AI · agent 의 `DataChange`                  | 무변경 (op 어휘 유지)                                         |
| Preview 채널 — `stores/data.ts` subscribe → iframe `collections` (`catalogPreviewSession.ts:565`)                                      | runtimeData + 정의                          | runtimeData 만 (`{ collectionId, runtimeData }`)              |

Phase 0 에서 위 표를 줄 번호와 함께 다시 freeze 한다 (1.5 배 이상이면 보강 커밋).

### 1b. 소비자 35 — 읽는 필드

`useCollections` · `useApiEndpoints` · `useVariables` · `useDataStore((s) => …)` 호출 35 파일의 selector 가 읽는 필드를 표로 (name · schema · mockData · runtimeData · useMockData · executionPolicy / method · baseUrl · path · headers · queryParams · bodyType · bodyTemplate · responseMapping · querySerialization · targetCollectionId · executionMode · serverConfig · timeout · retryCount · uploadDryRun / type · defaultValue · persist · owner). 이관 뒤 selector 가 **같은 모양** (`DataTable` · `ApiEndpoint` · `Variable` 타입 유지, `project_id` · `created_at` 은 빈 값 또는 제거 — Phase 1 판정) 을 돌려주면 35 파일 무변경이 목표.

### 1c. 사용자 보고 (R3)

사용자 로컬 IDB 의 프로젝트 수 · 데이터 표 · endpoint · 변수 수를 Builder 콘솔 (`getDB()` 1회) 로 세어 보고하고 착수 승인을 받는다 — contract 51 은 그 데이터를 열지 않는다.

### 1d. RED (`it.fails` → Phase 뒤 `it`)

1. collection 추가 **직후 (Undo 전)** → `runtime.graph` 에 `kind: "collection"` entry 가 있고 · 그 step 의 저장 큐 (`expectedDurableRevision` 묶음) 에 같은 entry JSON 이 있고 · `catalogProjectContent(graph).document` 안에 정의가 있다 (지금: 셋 다 0 — 정의는 `useDataStore` · IDB `collections` · `extras.collections`). 그 뒤 `workspace.undo()` 한 번 → 세 곳 모두 원상. **Undo 후 원상만 단언하면 현행 외부 history + IDB 구현에서도 통과한다** (판독 m3 — `dataHistory.ts:26 ~ 46` · `dataChange.ts:1271 ~ 1280` 로 원상 복원됨을 probe 확인) — RED 를 가르는 것은 Undo 전의 「정의가 문서 · 같은 저장 묶음 · 내보낸 document 안에」 단언이다.
2. 사이트 제목 설정 → `catalogProjectContent(graph).document` 에 `site.title` (지금: 필드 없음).
3. `catalogCodeViewData` 입력 = `reader` (지금: `DataTable[]`).
4. 페이지 설정 `meta.title` 없으면 사이트 값 (resolver 함수 — 지금 없음).
5. `ProjectEntry.site.access` 의 키 집합에 secret · password · certificate 류 0 (정적).
6. Canvas 무효화 (판독 h1): projectVariable 시작값을 **명령으로** 바꾼 step 의 consume plan 에 그 이름을 `{{ }}` 로 읽는 root 가 affected 로 들어가고, 화면 문자열이 After (지금: 명령 경로가 없어 store 쓰기 → `refreshState` 구독으로만 갱신 — 판독 probe 에서 같은 put 을 planner 에 넣으면 affected roots 0 · 문자열 Before 잔존). collection mock 행 편집도 같은 형태 (바인딩 root affected).
7. 보호 페이지 삭제 (판독 m2 · Round 2): **상태 변수 · 인터랙션이 하나도 없는 빈 페이지** 를 `site.access.protectedPageIds` 에 넣고 `removePage` → 성공 · 목록에서 그 id 제거 · Undo 한 번에 페이지와 목록 둘 다 복원 (지금: 필드 없음 — Phase 1 의 참조 존재 검증만 넣으면 이 삭제가 거부된다).

## 2. Phase 1 — entry · 명령 · selector (G1 · G2)

- `packages/shared/src/catalog/document/types.ts`: `CollectionEntry` · `EndpointEntry` · `ProjectVariableEntry` · `ProjectEntry.collectionIds | endpointIds | projectVariableIds | site` · `PageEntry.meta` · `LIBRARY_CONTRACT_VERSION = 51`. `validation.ts` · `storage.ts` 의 contract 검사 · entry 검증 (필드 타입 · 참조 존재 — `targetCollectionId` 가 있는 collection · `protectedPageIds` 가 있는 page · favicon 이 있는 asset).
- `packages/shared/src/catalog/commands/data.ts`: `addCollection` · `updateCollection` · `removeCollection` (참조 정리: 바인딩 `collectionId` · `ViewEntry.source` · 조건의 필드 참조 · endpoint `targetCollectionId` — `removeWithReferrers` 패턴) · `addEndpoint` · `updateEndpoint` · `removeEndpoint` · `addProjectVariable` · `updateProjectVariable` · `removeProjectVariable` · `dataOpsToCommands(ops)` (ADR-213 `DataOp` → 명령 — rename 은 행 key 도 옮기는 `renameRowsKey` 그대로).
- `commands/project.ts`: `setSiteSettings(patch)` · `updatePage` 에 `meta`.
- **참조 정리 — project 가 referrer 인 새 필드** (판독 m2 · Round 2): `removeWithReferrers` (`commands/structure.ts:1078`) 끝의 project 정리 (1177 ~ 1182) 는 **그대로 두지 않는다** — 바로 앞 `if (!removedRelated.length) return` (1175) 때문에 상태 변수 · 인터랙션이 없는 페이지 삭제는 그 블록에 닿지 않고, `gone = new Set(removedRelated)` 에는 page id 가 없다. 그래서 site 정리는 **조기 반환 앞의 별도 단계** 로 둔다: `removedRelated` 와 무관하게 실행하고, 필터는 `draft.removed(id)` (이 명령이 지운 page · node 전체) 로 한다 — `site.access.protectedPageIds` 에서 지운 page id 제거 (`"all"` 은 그대로), 바뀐 게 있을 때만 `draft.write({ ...project, site })`. 기존 `stateVariableIds` · `interactionIds` 정리와 조기 반환은 그대로. `removePage` (`project.ts:131 ~ 155`) 는 이 함수를 이미 같은 draft 로 부르므로 **같은 트랜잭션** — 별도 명령 신설 아님. **자산 참조** (`site.favicon.light | dark` · `site.socialImage` · `PageEntry.meta.socialImage`) 는 정리 대상이 아니다 — 문서의 자산 entry 를 지우는 명령이 없고 (`commands/` grep 0), 바이트 삭제는 GC (`apps/builder/src/lib/assets/assetGc.ts` `sweepOne`) 뿐인데 collector 가 catalog 저장 entries · 스냅샷 · 메모리 payload 의 중첩 객체 · 배열을 걷어 (`lib/assets/assetGc.ts:60 ~ 75`, root 는 `catalogRuntime/assetGc.ts:64 ~ 66 · 101 ~ 107`) 참조 중인 해시를 후보에서 뺀다 (241 ~ 248). 새 필드가 기존 `AssetRef` 모양을 그대로 쓰면 GC 가 자연히 보호한다 — G1 에 「site 에만 참조된 자산이 GC 후보에서 빠진다」 단언 1 개. 자산 entry 삭제 명령이 나중에 생기면 같은 별도 단계에 더한다. 반대 방향 (`validation.ts` 참조 존재 검증) 은 이 정리가 들어간 뒤에 켠다.
- **Canvas · Preview consumer 무효화** (판독 h1 — 정의를 문서로 옮기면 지금의 사후 갱신 구독 `CatalogBuilderCore.tsx:538 ~ 563` (`useDataStore.subscribe` → `refreshRows` · `refreshState`) 이 받을 store 변경이 사라진다): `CatalogCompositionRoot` 의 consume plan (`compositionRoot.ts:4843 ~ 4862`, stateVariable · view 무효화 옆) 에 두 갈래를 더한다 — ① `changedIds` · `removedIds` 에 `collection` entry → 그 `DataCollectionId` 를 `binding.collectionId` 로 읽는 source 의 root (`refreshRows` 1863 의 탐색을 plan 단계 함수로 꺼내 공유) · ② `projectVariable` entry → 바뀐 이름의 `stateReaders(names)` 와 keyed binding (`refreshState` 1966 ~ 1995 와 같은 범위). 명령 step 의 consumer 단계에서 처리하므로 문서와 화면이 같이 바뀌고 같이 안 바뀐다 (상태 관리 규칙 3-2) — Undo · Redo 도 step 이라 같은 경로. `endpoint` 정의 변경은 행을 바꾸지 않아 무효화 없음 (행은 실행 결과 `runtimeData` 가 바꾼다). Preview 는 같은 `compositionRoot` 를 문서 delta 로 돌리므로 대칭으로 따라온다 (`catalogPreviewSession.ts` 의 `CATALOG_DATA` → `refreshRows` 는 runtimeData 전용으로 축소). 남는 사후 갱신은 **문서 밖 값** 하나 — `collection_runtime` 캐시 store 구독 → `workspace.refreshRows(ids)` (지금 경로 유지, 입력 store 만 교체). Canvas root 가 열 때 받는 `rowsSource` (`CatalogBuilderCore.tsx:235 · 297`) 는 「graph 의 collection entry + 캐시 runtimeData」 를 합친 reader 로.
- `apps/builder/src/builder/stores/data.ts`: catalog selector 로 재작성 — `useCollections` · `useApiEndpoints` · `useVariables` · `getProjectVariableDefinitions` 이름 유지, 구현은 `useCatalogWorkspace().runtime` 구독 (`subscribeEntryField` · `selectEntryField` — `useCatalogToastPlacement.ts` 패턴). `runtimeData` 는 `collection_runtime` 캐시 (ADR-218 `hydrateRuntimeCache` · `setRuntimeData`) 를 별도 작은 store 로 남기고 selector 가 합친다. `dataActions.ts` · `dataChange.ts` 의 IDB 경로 삭제, `lib/db/types.ts` 의 3 store 와 adapter 삭제 (DB_VERSION 올림 — store 삭제만, 변환 0).
- G2 측정: `apps/builder/scripts/adr286-data-doc-size.mjs` (하니스 패턴 `BUILDER_URL`) — preset 10 collection × 100 행 문서와 1,000 행 collection 에서 저장 · Undo · Preview delta 시간 · 문서 JSON 크기, 이관 전 HEAD worktree 대조군.

## 3. Phase 2 — 소비자 전환 · 코드 보기 · 프로젝트 파일 · publish 읽기 (G3)

- `catalogRuntime/codeView.ts` `catalogCodeViewData(reader)` — 출력 타입 (`CodeViewCollection` · `CodeViewEndpoint`) 무변경. `CatalogCodeViewPanel.tsx` · `codeViewSnippets.ts` (`CatalogCodeViewTable` — mock 행은 entry 에서) 입력 교체. ADR-285 테스트 (`adr284CodeView.test.tsx` golden 5 strict · `adr285CodeViewRoundTrip.test.tsx`) 의 fixture 를 entry 로 세팅하고 **생성 코드 byte 동일** 단언 (이관 전 코드를 fixture 로 고정).
- `useCatalogProjectFiles.tsx`: extras 3 키 제거 (`fontRegistry` 유지). `exchange.ts` `CatalogProjectFileExtras` 에서 세 키 삭제. `apps/publish/src/catalogSession.ts:26 ~ 28` 문서에서 읽기 · `catalogProject.ts` 의 extras 검사 3 키 제거.
- Preview 채널: `parseCatalogPreviewData` 를 runtimeData 전용으로 (스키마 · mock 제거). `catalogPreviewSession.ts` 가 정의는 문서 reader 에서.
- datatable 패널 15 파일: 액션 호출이 selector · 명령으로 가는지 확인 (목표 무변경, 실제 변경 파일은 기록).

## 4. Phase 3 — Settings 패널 · 페이지 설정 · live (G4)

- `panels/settings/SettingsPanel.tsx`: 「사이트」 섹션 (사용자 결정 4) — 제목 · 설명 · 언어 (BCP 47 select) · favicon 밝은 · 어두운 (asset picker — ADR-235 의 자산 업로드 경로) · 소셜 이미지 · 검색 (색인 · sitemap · robots) · redirect 목록 (`PropertyRowMenu` 행 — 순서 = 우선순위) · 접근 (none · password · sso — sso 는 protocol · issuer · metadataUrl · clientId · 보호할 페이지, **비밀 입력란 없음** — 사용자 결정 2 의 자리 안내). 머리말 상태 문구 「publish 반영은 준비 중」 (R5). ADR-163 패널 표준 (`fieldset.properties-aria` · `.control-button`).
- Navigator Pages 페이지 ⋮ → 「페이지 설정」 (제목 · 설명 · 소셜 이미지 · 검색에서 숨김 · sitemap 에서 숨김). 비어 있으면 사이트 값 placeholder.
- `packages/shared/src/catalog/runtime/siteMeta.ts`: `resolvePageMeta(reader, pageId)` (사이트 ← 페이지 덮어쓰기) · `siteHead(reader, pageId)` → `{ title, description, lang, favicon: { light, dark }, socialImage, robots }` · `sitemapEntries(reader)` · `redirectFor(reader, path)` — publish 가 쓸 **순수 함수** 까지 (내보내는 phase 는 §6).
- i18n KO/EN. live (Chrome MCP · 별도 서버 5174): G4 시나리오 — 설정 → Undo → 내보내기 확인 · 페이지 덮어쓰기 · redirect · sso 저장 · Preview R7 · **Canvas ↔ Preview 데이터 갱신 (R8)**: 바인딩된 목록의 mock 행 편집 · 프로젝트 변수 시작값 변경 (`{{ }}` 텍스트) · 각각 Undo — Canvas 와 Preview 가 둘 다 After → Before 로 따라오는지 · **보호 페이지 삭제 (R9)**: sso 보호 목록에 든 페이지 삭제 → 목록에서 빠짐 · Undo 로 둘 다 복원 · 새로고침 (저장 · 재열기) 뒤 같은 상태.

## 5. Phase 4 — 번들 · 문서 (G5) → G6

- `adr209-bundle-closure.mjs` before (착수 HEAD) / after. `docs:stale-symbols`. ADR-131 · 214 · 218 · 248 본문 Status 아래 「ADR-286 (2026-10-27) 이 데이터 정의의 집을 catalog 로 바꿈 — 읽기 계약은 유지」 한 줄. 메모리 `project-data-tables-ssot-framing` (이미 바뀜 표시) · `project-catalog-single-source-of-builder-code` 갱신. README · CHANGELOG.
- G6 사용자 확인 → Implemented. publish 내보내기 (§6) 는 열림 항목.

## 6. 열림 — publish 내보내기 phase (사용자 지시로 착수)

`apps/publish` 가 `siteHead` · `sitemapEntries` · `redirectFor` · `access` 를 실제 산출물에 넣는다: `index.html` 의 `<title>` · `<meta name="description">` · `<meta property="og:*">` · `<link rel="icon" media="(prefers-color-scheme: …)">` · `<html lang>` 을 문서에서 (`document.title` 런타임 + 빌드 시 주입 둘 다) · `sitemap.xml` · `robots.txt` 생성 · redirect 는 호스팅 환경 (정적 호스트 규칙 파일 또는 런타임 라우터) · 접근 보호 = password (서버 측 비교) · sso (OIDC 는 PKCE 공개 클라이언트로 secret 없이 가능, SAML 은 서버 측 ACS 필요 — 호스팅 전제 확정 뒤). publish 방침 (메모리 `project-publish-link-only-defer-until-builder-stable`) 에 따라 이 ADR 종결과 분리.

## 7. 추정 규모

- 새 파일 ~8 (`commands/data.ts` · `runtime/siteMeta.ts` · Settings 사이트 섹션 · 페이지 설정 다이얼로그 · G2 하니스 · 테스트 3) · 수정 ~30 (types · validation · storage · project.ts · data.ts · dataActions.ts · dataChange.ts · lib/db 3 · CatalogBuilderCore · useCatalogProjectFiles · exchange.ts · publish 2 · codeView 3 · Preview 채널 2 · datatable 패널 중 실제 바뀌는 것 · i18n · ADR 4 본문 · README · CHANGELOG). **추정 ~38 파일** — Phase 0 freeze 에서 재산정 (1.5 배 이상이면 inventory 보강 커밋으로 흡수, fork 사유 아님). 삭제 ~2,000 줄 (IDB · setState 경로).

## 8. 사용자 결정 4 (본문 표) — 묻는 시점

1 (mock 행 상한) · 3 (프로젝트 변수 entry 통합 여부) = Phase 1 착수 때. 2 (비밀 저장 위치) · 4 (사이트 설정 자리) = Phase 3 착수 때.

## 9. 기록

(착수 시 Phase 별로 적는다.)

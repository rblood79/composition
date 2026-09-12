# DataTable 패널 리서치 — 외부 출처 원문 (2026-09-10)

> [DATA_PANEL_REDESIGN_RESEARCH_2026-09.md](DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §3 의 근거. 세 조사 (A 데이터 모델링·편집·연결 UX · B AI/에이전트 · C 접근성 + REST 연결 UX) 의 서브에이전트 보고를 출처 URL 과 함께 옮겼다. 공식 문서로 확인한 것만 단정하고, 2차 출처뿐이면 **(unverified)**.

---

# A. 데이터 모델링 · 테이블 편집 · 데이터 소스 연결 UX

## A0. 요약

- 열 추가는 **헤더 우측 `+` → 팝오버 (이름 + 검색 가능한 타입 목록 + 타입별 옵션)** 이 사실상 표준 (7개 제품 수렴). 다이얼로그를 쓰는 곳은 Webflow 정도.
- 외부 REST 연결은 **"요청 실행 → 응답 스키마 표 (키 · 타입 · 포함 여부 · ID 필드)"** 가 핵심 화면 — Bubble · Softr · Budibase 가 거의 같은 형태. Retool · Appsmith 는 JSON 트리 + 코드 표현식.
- **datasource (연결 · 인증 · base URL) 와 query (엔드포인트 · 파라미터) 2계층** 이 개발자향 5곳 공통.
- UI 바인딩은 두 계열 — 디자인 도구 (Webflow · Framer) 는 "요소 선택 → 필드 연결", 앱 빌더 (Retool · Appsmith · Budibase · Plasmic · WeWeb) 는 `{{ }}` / data picker 트리.
- 불만은 거의 전부 **한계치와 무증상 실패** (에러 없이 항목이 안 보임, 셀 단위 실패 메시지 없음) 에 몰려 있다.

## A1. Airtable

- 열: 마지막 필드 우측 `+` → 타입 선택 → 이름 → `Create field`. 헤더 클릭 → `Insert left/right`. 타입별 default (primary 제외), 설명은 `Edit field description`. 타입 변환 시 일부 값 소실. Primary field 는 첫 열 · 삭제/이동/숨김 불가 · 허용 타입 13종 · `Change primary field`. [field-type-overview](https://support.airtable.com/articles/2361876459-field-type-overview) · [primary field](https://support.airtable.com/articles/8978269981-the-primary-field-in-airtable)
- 행: 그리드 inline, expand 화살표 → 세로 폼. 스프레드시트 범위 붙여넣기로 레코드 생성. `+ Add or import` → CSV/Excel/Sheets/Smartsheet → `Auto-select field types` · `Use the first row as headers` + 미리보기에서 타입 조정. CSV 100MB. [importing](https://support.airtable.com/articles/9412806945-importing-third-party-data-into-airtable)
- 바인딩 (Interface Designer): 레이아웃 → 테이블 → 요소별 source. Record picker 가 있으면 필드 자동 연결, 없으면 "Unconfigured source". [guide](https://www.airtable.com/guides/collaborate/getting-started-with-interface-designer)
- 불만: 테마 조정 불가, 모바일 미지원 레이아웃. [community](https://community.airtable.com/interface-designer-12/airtable-interface-designer-ux-ui-47345)

## A2. Notion

- 열: 헤더 끝 `+` → 검색 상자 + 아이콘 타입 목록 → 설정 시트 (`Number format`, `Show as`, `Wrap`, `Hide in view`). 속성 24종, DB 당 500개. `Build with AI` (프롬프트 → 미리보기 → 수정). [create](https://www.notion.com/help/create-a-database) · [properties](https://www.notion.com/help/database-properties)
- 행 = 페이지, peek preview → full page. 뷰 7종. [intro](https://www.notion.com/help/intro-to-databases)
- Relation/Rollup: 대상 DB 검색 → **relation preview** → `Show on [DB]` 토글로 양방향. Rollup 은 relation → 속성 → 함수. [relations](https://www.notion.com/help/relations-and-rollups)
- 불만: CSV import 시 relation·formula·rollup 소실, 항상 append (같은 파일 두 번 = 전량 중복, 에러 없음). 5k 레코드 넘으면 체감 저하. [SplitForge](https://splitforge.app/blog/notion-csv-import-errors-fix) · [perf](https://www.notion.com/help/optimize-database-load-times-and-performance)

## A3. Webflow CMS

- 생성: CMS 패널 → Create Collection → **preset 또는 scratch**; 이름 · URL (생성 후 변경 불가) · 필드 (**필드마다 우측 미리보기**) · 드래그 정렬 · collection page 자동 생성. 기본 Name + Slug. 타입 16종 (reference · multi-reference 포함). [overview](https://university.webflow.com/videos/webflow-collections-overview) · [fields](https://help.webflow.com/hc/en-us/articles/33961390084499-Collection-fields)
- 행: 스프레드시트 없음 — 항목별 폼. CSV import: 헤더 행 확인 → 열마다 **기존 필드 매핑 / 새 필드 생성 / 무시** 3택; 4MB · 10,000 items. [csv](https://webflow.com/updates/csv-import)
- 바인딩: Collection List 드래그 → source → **보라색 기어 + "Get text from [Collection]"**, 바인딩 요소는 보라색; Filters/Sort/Limit · pagination · empty state · nested. [collection list](https://university.webflow.com/videos/collection-list)
- 불만: 컬렉션 20/40 · 필드 30/60 · reference 5/10 · list 당 100 item · nested 2×10 — Finsweet 우회가 표준. [wishlist](https://wishlist.webflow.com/ideas/WEBFLOW-I-3042) · [limits](https://www.rapidevelopers.com/webflow-tutorials/webflow-cms-limits)

## A4. Framer CMS

- 필드: `Edit Fields` 패널 (rename · helper text · required). 타입 13종 (enum · collectionReference · multiCollectionReference 포함). item 은 `id` + `slug` 필수. Managed Collections 플러그인 — **field `id` 가 바뀌면 캔버스 바인딩이 깨지므로 안정 ID 필수**. [academy](https://www.framer.com/academy/lessons/understanding-cms-collections-items-fields) · [developers/cms](https://www.framer.com/developers/cms)
- 행: 항목 편집기 · CSV 드래그앤드롭 → 열↔필드 매핑 · Framer Agents 로 CSV 읽어 생성/갱신. [csv](https://www.framer.com/academy/lessons/csv-import)
- 바인딩: 요소 선택 → 속성 옆 **CMS 아이콘** → `Set variable` → 필드; detail page 에서 variable 자동 생성; 타입 불일치 → "Missing". List 속성 Sorting/Filters/Pagination/Limit/offset. [collection lists](https://www.framer.com/academy/lessons/creating-cms-collection-lists) · [snippets](https://framersnippets.framer.website/articles/linking-cms-data-to-framer-components)
- Localization: 로케일별 컬렉션 숨김 · Auto Translate. [update](https://www.framer.com/updates/localization-update-collection-groups)
- 불만: 10,000 item 상한에 로케일 복사본 합산, 대규모에서 필터/정렬 불안정, **항목이 에러 없이 안 보임**. [limitations](https://letaiworkforme.com/blog/framer-limitations-complete-guide) · [4 problems](https://allaboutframer.com/before-you-touch-framer-s-cms-again-read-this)

## A5. Retool

- Resource: 이름 · `Use an API spec` / `Manual` · base URL · **OpenAPI import** · 전역 params/headers · 인증 12종 · `Test connection`. [rest](https://docs.retool.com/data-sources/guides/connect/rest)
- Query editor: method · path (`{{ table1.selectedRow.data.id }}`) · params/headers/body → `Run query` → JSON 트리. GET 자동 · 쓰기 수동. timeout · `Cache the results` (초 TTL). Transformer `.data` vs `.rawData`. [transformers](https://docs.retool.com/queries/guides/transformers) · [caching](https://docs.retool.com/queries/concepts/caching)
- 바인딩: Table `Data = {{ query.data }}` → 열 포맷 자동 추론 · `Regenerate Columns` · 열별 Editable → `changesetArray`. [table columns](https://docs.retool.com/apps/guides/data/table/columns)
- 불만: 학습 곡선, 캐시 키 의존성 없음. [G2](https://www.g2.com/products/retool/reviews) · [forum](https://community.retool.com/t/retool-query-caching-cache-key-dependencies/47442)

## A6. Bubble

- Data tab: `Data types` → `New type` → 필드 (name · type · list · default). 내장 Unique ID/Created/Modified/Slug. **다른 data type 자체를 타입으로** (참조). `Option sets`. `Privacy` — **새 타입은 기본 전체 공개**. [types](https://manual.bubble.io/help-guides/data/the-database/data-types-and-fields) · [data tab](https://manual.bubble.io/core-resources/bubbles-interface/data-tab)
- App data: 그리드 · `New entry` · inline · `Upload` CSV (열→필드 매핑) · `Modify` · `Export` · Development/Live DB.
- API Connector: 컬렉션 단위 인증 9종 → 호출별 `Use as` Data/Action · 파라미터 `Private` 체크 → **`Initialize call` 이 실제 요청을 보내 응답의 모든 키를 타입 드롭다운 + 포함 체크박스로 나열**, `Manually enter API response`. [API connector](https://manual.bubble.io/help-guides/integrations/api/the-api-connector)
- 바인딩: `Insert dynamic data` → 소스 → `:` 연산자 체인 (**좌→우 순차 평가**). `Do a search for` 팝업. [expressions](https://manual.bubble.io/help-guides/logic/dynamic-expressions)

## A7. Glide / Softr

- **Glide Data Editor**: 검색 가능한 테이블 목록 + 그리드, 헤더 타입 아이콘. `+` → 이름 · **타입 검색** · 그룹 Basic / Computed / AI / Integrations · **computed 결과 실시간 미리보기**. `⌘↩` 행 추가. `Find uses` (참조 추적). Computed (Relation/Lookup/Template/Rollup/Math/If-Then-Else/Query). AI 열은 호출당 과금. [data editor](https://www.glideapps.com/docs/getting-started/introduction-to-the-data-editor) · [computed](https://www.glideapps.com/docs/automation/computed-columns). 불만: 25k row 넘으면 동기화 정지. [scalability](https://www.lowcode.agency/blog/glide-scalability)
- **Softr**: `Connect Data Source` 16종. REST: 전역 headers → `Add Resource` → **`Execute` 성공이 저장 조건** → `Schema` 탭 (Key / Type 10종 / Enabled / **ID Field**) · Raw JSON · Transformed JSON · Pagination · JS transformer · placeholder `{LOGGED_IN_USER:x}`. [data sources](https://docs.softr.io/data-sources) · [rest](https://docs.softr.io/data-sources/rest-api). 불만: Airtable 동기화 지연. [community](https://community.softr.io/t/softr-not-pulling-updated-data-from-airtable/14607)

## A8. WeWeb / Budibase / Appsmith

- **WeWeb**: Collection 모드 **Dynamic / Static / Cached**. REST: **`Result key` 로 중첩 응답 경로** · CORS proxy (키 노출 경고 — "not meant to keep private tokens private") · 메타 `isFetching/isFetched/length/total/limit/offset`. Cloud guided/advanced · pagination 바인딩. [rest](https://docs.weweb.io/plugins/data-sources/rest-api.html) · [collections](https://docs.weweb.io/data/intro-to-collections.html) ·
- **Budibase**: 테이블 = 빈 / CSV (열 자동 감지) / **AI 생성 (관계 포함 다중 테이블 + 샘플 데이터)**. 헤더 `+` 팝오버. `Display column`. REST: datasource `Credentials` / `Authentication` / query Params·Headers·Body·**Pagination·Transformer** → `Send` → **Body / Preview / Schema 탭**. Screens `Blank` vs **autogenerated Table/Form**. bindings drawer + **실시간 평가 미리보기**. [budibasedb](https://docs.budibase.com/docs/budibasedb) · [rest](https://docs.budibase.com/docs/rest) · [screens](https://docs.budibase.com/docs/screens) · [bindings](https://docs.budibase.com/docs/bindings) · [AI tables](https://docs.budibase.com/docs/ai-powered-table-generation)
- **Appsmith**: Datasource → Query → Widget. `Authenticated API` datasource 가 root URL · auth 공유. Pagination None / Table Page No / Response URL. **datasource 설정은 `{{ }}` 불가**. `Generate new page` CRUD. [rest](https://docs.appsmith.com/connect-data/reference/rest-api) · [auth api](https://docs.appsmith.com/connect-data/reference/authenticated-api) · [CRUD](https://www.appsmith.com/blog/generate-a-crud-app-from-any-database-with-one-click)

## A9. NocoDB / Baserow

- **NocoDB**: `+` → New Field (이름 · 타입 · default 고정/동적 · description · unique). 33종. **display value** (라벨 ≠ PK). Links: relation 유형 → 대상 → **back-link 자동**; Linked Records 모달 (검색 · unlink · 생성-연결). Quick Import CSV/Excel/JSON. `Space` expand. [fields](https://nocodb.com/docs/product/tables/fields) · [links](https://nocodb.com/docs/product/tables/fields/field-types/links-based/links) · [import](https://docs.nocodb.com/tables/create-table-via-import/)
- **Baserow**: 생성 5경로 (**Paste data** · CSV · JSON · XML · Excel) + 미리보기; import 는 전부 text 로 들어와 사후 변환. **Paste**: 부족한 행 자동 생성 · 경고 없이 덮어씀 → `⌘Z` · 타입별 강제 규칙 · **셀 단위 실패 메시지 없음**. Link to table: `Create related field` (기본 양방향) · `Limit selection to a view`. [paste](https://baserow.io/user-docs/paste-data-into-baserow-table) · [import](https://baserow.io/user-docs/create-a-table-via-import) · [fields](https://baserow.io/user-docs/baserow-field-overview) · [link](https://baserow.io/user-docs/link-to-table-field)

## A11. Plasmic

- v2: 사이드바 **Page/Component `Data` 탭 → `Data queries` `+`**; HTTP/GraphQL/CMS/코드 함수; `$q.GetPosts.data` + `isLoading`. [data queries](https://docs.plasmic.app/learn/data-queries/) · [v2](https://www.plasmic.app/blog/data-queries-evolved)
- 바인딩: 속성 우클릭 → `Use dynamic value` → **data picker 트리** → `Switch to Code`; **Fallback**; `for each`. [dynamic values](https://docs.plasmic.app/learn/dynamic-values/)

## A12. 교차 패턴 (수렴 제품 수 순)

| #   | 패턴                                                                                           | 수렴 | 출처                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 붙여넣기 = 행 생성 + 타입 강제 · CSV import = 헤더행 토글 · 타입 감지 · 열별 기존/새/무시 매핑 | 8    | [Airtable](https://support.airtable.com/articles/9412806945-importing-third-party-data-into-airtable) · [Baserow](https://baserow.io/user-docs/paste-data-into-baserow-table) · [Webflow](https://webflow.com/updates/csv-import) |
| 2   | 헤더 우측 `+` → 팝오버 (이름 · 검색 가능한 타입 · 아이콘 · 옵션 · default · description)       | 7    | [Notion](https://www.notion.com/help/database-properties) · [NocoDB](https://nocodb.com/docs/product/tables/fields) · [Glide](https://www.glideapps.com/docs/getting-started/introduction-to-the-data-editor)                     |
| 3   | Primary / display field                                                                        | 6    | [Airtable](https://support.airtable.com/articles/8978269981-the-primary-field-in-airtable) · [Budibase](https://docs.budibase.com/docs/budibasedb)                                                                                |
| 4   | 테스트 요청 → 응답 스키마 표 (키 · 타입 · 포함 · ID) + raw JSON                                | 6    | [Bubble](https://manual.bubble.io/help-guides/integrations/api/the-api-connector) · [Softr](https://docs.softr.io/data-sources/rest-api) · [Budibase](https://docs.budibase.com/docs/rest)                                        |
| 5   | 관계 필드 + back-link 자동 + picker 모달                                                       | 6    | [Notion](https://www.notion.com/help/relations-and-rollups) · [NocoDB](https://nocodb.com/docs/product/tables/fields/field-types/links-based/links) · [Baserow](https://baserow.io/user-docs/link-to-table-field)                 |
| 6   | computed 열이 같은 타입 picker 안                                                              | 6    | [Glide](https://www.glideapps.com/docs/automation/computed-columns) · [Baserow](https://baserow.io/user-docs/baserow-field-overview)                                                                                              |
| 7   | `{{ }}` + data picker 트리 + 코드 토글 + 실시간 평가 / fallback                                | 6    | [Budibase](https://docs.budibase.com/docs/bindings) · [Plasmic](https://docs.plasmic.app/learn/dynamic-values/)                                                                                                                   |
| 8   | 테이블/쿼리에서 UI 자동 생성 + Regenerate                                                      | 6    | [Budibase](https://docs.budibase.com/docs/screens) · [Appsmith](https://www.appsmith.com/blog/generate-a-crud-app-from-any-database-with-one-click) · [Retool](https://docs.retool.com/apps/guides/data/table/columns)            |
| 9   | 반복 요소에 filter · sort · limit · offset · pagination                                        | 6    | [Framer](https://www.framer.com/academy/lessons/creating-cms-collection-lists) · [Webflow](https://university.webflow.com/videos/collection-list)                                                                                 |
| 10  | 설정 중 live 미리보기                                                                          | 6    | [Glide](https://www.glideapps.com/docs/getting-started/introduction-to-the-data-editor) · [Webflow](https://university.webflow.com/videos/webflow-collections-overview)                                                           |
| 11  | datasource / query 2계층                                                                       | 5    | [Retool](https://docs.retool.com/data-sources/guides/connect/rest) · [Appsmith](https://docs.appsmith.com/connect-data/reference/authenticated-api)                                                                               |
| 12  | 템플릿/프리셋 또는 AI 생성 (미리보기 → 수정 → 확정)                                            | 5    | [Notion](https://www.notion.com/help/create-a-database) · [Budibase](https://docs.budibase.com/docs/ai-powered-table-generation)                                                                                                  |
| 13  | 캔버스 위 바인딩 상태 시각 표시                                                                | 4    | [Webflow](https://university.webflow.com/videos/collection-list) · [Framer](https://framersnippets.framer.website/articles/linking-cms-data-to-framer-components)                                                                 |
| 14  | 실행 정책 (로드 시 자동 / 수동 · GET 자동 · 캐시 TTL)                                          | 4    | [Retool](https://docs.retool.com/queries/concepts/caching) · [WeWeb](https://docs.weweb.io/data/intro-to-collections.html)                                                                                                        |
| 15  | Undo + "Find uses"                                                                             | 3    | [Baserow](https://baserow.io/user-docs/paste-data-into-baserow-table) · [Glide](https://www.glideapps.com/docs/getting-started/introduction-to-the-data-editor)                                                                   |

**반복되는 실패 (피할 것)**: 하드 한계에서 graceful degradation 없음 (Glide · Framer · Webflow) · 무증상 실패 (Framer 미표시, Baserow 셀 오류 무표시, Notion CSV 중복) · 대형 테이블 `count(*)` (Cloud) · import 가 관계/수식을 잃음 (Notion · Webflow) · 새 타입 기본 공개 (Bubble) · 스키마 변경이 캔버스 바인딩을 깨는 문제 (Framer 는 안정 id 로 대응).

---

# B. AI · 에이전트 데이터 기능 (2025–2026)

## B1. AI 스키마 · 데이터 생성

- **Airtable Omni** (2025-06 GA) — 자연어로 table/field/interface/automation 생성·수정. 응답마다 **Undo icon** + **checklist icon** (수행 단계). 권한은 사용자 권한 미러링. 한계 "Cannot create or modify views". [Omni](https://support.airtable.com/docs/using-omni-ai-in-airtable) · Cobuilder (2024) 는 회사 설명으로 select 옵션을 채움 [newsroom](https://www.airtable.com/newsroom/airtables-new-cobuilder-unlocks-instant-no-code-app-creation)
- **NocoDB NocoAI** — 가장 명시적인 "제안 → 검토 → 생성": 프리셋/프롬프트 + `Additional Context` → `Suggest Tables & Views` → 제안 목록 + **Relationship Diagram** → 수정·재생성 → `Create Base`. 기존 base 는 `Auto Suggested`. [create-base](https://nocodb.com/docs/product-docs/noco-ai/create-base) · [create-table](https://nocodb.com/docs/product-docs/noco-ai/create-table) · [create-field](https://nocodb.com/docs/product/noco-ai/create-field)
- **Bubble AI** — 생성: **객관식 clarifying questions** → `Features`/`Scenarios` 카드 + live preview → `Generate`, placeholder 샘플. 편집: 선택 요소가 프롬프트 **tag** 로, **plan 제시 → approve/cancel**. data type 삭제 · 필드 삭제 · 타입 변경 불가, development DB 만. [generate](https://manual.bubble.io/help-guides/ai/bubble-ai-agent/generate-apps-with-ai.md) · [edit](https://manual.bubble.io/help-guides/ai/bubble-ai-agent/edit-apps-with-ai.md)
- **Xano Database Assistant** — 제안 목록 → "review each suggestion, apply with one click". 삭제 미수행은 **(unverified)**. [docs](https://docs.xano.com/xano-ai/building-a-backend-using-ai) · [ai-assistants](https://www.xano.com/ai-assistants/)
- **Base44** — 엔티티 = **JSON Schema** (enum · required · default · format · description) 가 AI 계약. import 는 AI chat 업로드 → 매핑 → 새 필드/타입 조정 제안 → "Approving an import" 명시 승인. 기본 **append-only**. 엔티티별 version history. [data](https://docs.base44.com/Building-your-app/Managing-your-app-data) · [schemas](https://docs.base44.com/developers/backend/resources/entities/entity-schemas)
- **Lovable** — 스키마 변경은 "reviewed migration": SQL 을 보여 주고 **승인 후** 실행, migration 파일 저장, RLS linter. · [cloud](https://docs.lovable.dev/integrations/cloud)
- **v0** — SQL 생성·실행 (확인 UI 없음). [databases](https://v0.app/docs/databases) · **Bolt** — migration + `Discard` **(unverified)**
- **Glide** — 샘플 데이터 교훈: 관계 정합 샘플 (orders 의 product ID 가 실제 products 참조), 단 "data not matching the schema" 가 잦아 **스키마 검증 필수**. AI 컬럼 `Generate Text` / `Text to Choice`. [ai-generator](https://www.glideapps.com/research/ai-generator) · [Text to Choice](https://www.glideapps.com/docs/text-to-choice)
- **Baserow AI field** — provider/model 선택 (Anthropic · Ollama …), 출력 `Text`/`Choices`, `Regenerate when referenced fields change`. [ai-field](https://baserow.io/user-docs/ai-field) · [formulas](https://baserow.io/user-docs/generate-formulas-with-baserow-ai)
- **Notion** — autofill `Basic` vs `Custom Agent` (조건 로직 · 다중 property), 실행 manual / on create / on edit / schedule. Notion 3.0 Agent (2025-09-18) DB·property·view 생성. [autofill](https://www.notion.com/help/autofill) · [releases](https://www.notion.com/releases/2025-09-18)
- **Retool Assist** — 앱·쿼리 생성, **Retool DB 스키마 + 샘플 데이터 생성**, **checkpoints** 복원. [assist](https://docs.retool.com/apps/guides/assist/)

## B2. AI API 통합

- **Xano Import cURL** — URL · method · headers · body 파싱 → 하드코딩 값을 **input 으로 승격**. [curl](https://www.xano.com/learn/xano-external-api-request-curl-commands/)
- **Retool OpenAPI-powered guidance (beta)** — spec URL → 서버 드롭다운 → endpoint 검색 · path/query/header/body 필드 자동 (타입 · required) · 수동 폴백. [community](https://community.retool.com/t/build-rest-api-queries-with-openapi-powered-guidance-beta/64720) · **Ask AI** Generate / Edit / Explain / Debug (`Run error detected. Debug?`). [ask](https://docs.retool.com/queries/guides/ask)
- **Zapier Custom Actions** — 평문 → endpoint 탐색 + 코드 → **요약 카드 Inputs / Logic / Outputs / API Endpoints Used** → `Advanced` → Test → `Publish`. hallucination 경고 명시. [custom action](https://help.zapier.com/hc/en-us/articles/16277139110157-Create-a-custom-action) · [API Request](https://help.zapier.com/hc/en-us/articles/14096700504717-Make-raw-HTTP-requests-with-API-Request-actions-Beta)
- **Postman Agent Mode** — NL 요청 · 에러 수정 · OpenAPI → collection **(승인 UX unverified)**. [agent-mode](https://learning.postman.com/docs/getting-started/basics/about-agent-mode) · **Insomnia** BYO LLM · MCP client. [ai-native](https://insomnia.rest/features/ai-native)
- **Pipedream MCP** — 앱마다 서버 1개, 계정 없으면 tool 이 **인증 URL 반환**, 실패 `isError: true`. [mcp](https://pipedream.com/docs/connect/mcp/developers) · **Make AI Agents** — 모듈 1개 = tool 1개, 필드별 `Let AI Agent decide`. [make](https://help.make.com/module-tools-for-ai-agents)

## B3. 에이전트 · MCP 로 빌더 조작

- **Airtable MCP** — base 생성 (생성 시에만 table/field) · 레코드 CRUD (10건) · automation draft 만. 권한 미러링. [mcp](https://support.airtable.com/docs/using-the-airtable-mcp-server)
- **Notion MCP** — 24 tools: `notion-create-database` · `notion-update-data-source` · `notion-create-view` (filter/sort DSL) · `notion-query-data-sources` (**SQL**) · `notion-create-pages`. delete tool 없음. [tools](https://developers.notion.com/guides/mcp/mcp-supported-tools)
- **Webflow MCP** — Data API 21 tools **operation 단위** (`collection_fields_create_static` / `_option` / `_reference`, item create draft vs live, publish 별도, destructive 표기). v2.0.1 (2026-07-21) focused tool 분리. [catalog](https://hub.docker.com/mcp/server/webflow/overview) · [changelog](https://developers.webflow.com/home/changelog/2026/7/21)
- **Figma MCP** — 읽기 `get_metadata` **sparse XML**, 쓰기 `use_figma`, 유료는 `cost_confirmation_required` 선반환. [tools](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)
- **Framer** — `npx @framer/agent setup` + `/framer` skill; CMS CRUD 는 **자동 branch**, publish 는 사용자. [agents](https://www.framer.com/agents/external/)
- **pen.dev** — `get_app_state` / `get_style` / `read_skill` / `execute` / `browser`; `.pen` 은 기본값 생략 · `ref` 중복 제거 · `$variable` 바인딩. [ai-integration](https://docs.pencil.dev/getting-started/ai-integration) · [pen format](https://docs.pencil.dev/for-developers/the-pen-format)
- **MCP spec (2025-06-18)** — annotations (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`) 는 신뢰하지 말아야 할 힌트; "SHOULD always be a human in the loop"; 호출 전 **tool inputs 표시**; `outputSchema` + `structuredContent`. [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- **Anthropic** — "Writing tools for agents": endpoint 전부 감싸지 말고 워크플로 단위 고영향 tool 소수 · `service_resource_action` namespacing · `response_format: concise|detailed` · 사람이 읽는 이름 · pagination/truncation · 다음 행동 안내 에러. [writing-tools](https://www.anthropic.com/engineering/writing-tools-for-agents) · Structured outputs: `output_config.format` vs `strict: true`, `additionalProperties: false` 필수, 재귀 · min/max 미지원, 문법 캐시 24h. [structured-outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

## B4. 자연어 → 바인딩 · 쿼리 · 차트

- Retool Ask AI (B2) · Airtable Omni — 질문 답변은 되나 **뷰 변경 불가** [multi-table](https://community.airtable.com/announcements-6/multi-table-support-for-custom-interface-elements-ai-labs-46753) · **Softr Ask AI** (2025-07) — 목록 블록 chat, **visibility/permission 규칙 그대로**. [ask-ai](https://www.softr.io/blog/introducing-ask-ai) · Notion MCP SQL/view DSL NL→SELECT + 차트.

## B5. 채택 패턴 (수렴도 순)

1. **Propose → Review → Apply** 기본 계약 (8개 제품 예외 없음)
2. 파괴 작업 기본 차단, 별도 등급 (Bubble · Base44 · Webflow · MCP)
3. Undo + 수행 단계 로그 (Airtable · Retool · Base44 · Framer · Lovable)
4. 스키마 계약 = 컴팩트 JSON Schema (Base44 · Notion · Anthropic · `.pen`)
5. `strict: true` tool + `output_config.format` (Anthropic · MCP `outputSchema`) — Ollama 는 zod 로
6. 읽기 fine-grained · 쓰기 "변경 제안" coarse 1개 (Webflow · Anthropic 결론 동일)
7. 샘플 행은 관계 정합 + 스키마 검증, FK 는 코드가 (Glide · Retool · Bubble)
8. 생성 전 객관식 1~3 문항 + 도메인 컨텍스트 (Bubble · NocoDB · Cobuilder)
9. 선택 컨텍스트 자동 첨부 반복 편집 (Bubble · Retool · NocoDB)
10. LLM 에는 스키마만 + 권한 미러링 + 결과 래핑 (Airtable · Softr)
11. cURL / OpenAPI 붙여넣기 → guided form + Test 필수 (Xano · Retool · Zapier)
12. 에러 → "Debug?" (Retool · Postman)
13. NL 질문은 답변 전용, 변경과 분리 (Airtable · Softr)
14. Human-in-the-loop: inputs 표시 + 감사 로그 (MCP spec · Framer)
15. 비용 가시화 (Airtable · NocoDB · Notion · Figma)

제외: Softr AI App Generator (docs 404) · Glide AI filter · Plasmic (구체 기능 없음) · Framer "MCP" (공식 서버 없음).

---

# C. 편집 격자 접근성 + REST 연결 UX

## C1. WAI-ARIA APG `grid` / `treegrid` / `table`

- `grid` 는 composite widget — "Only one of the focusable elements contained by the grid is included in the page tab sequence"; `table` 은 모든 focusable 이 tab 순서. → 셀 안에 편집 위젯이 있으면 `grid`, 읽기 전용 목록은 `table`. [APG grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- 키보드: Arrow 4방향 · Home/End · Ctrl+Home/End · PageUp/Down. **편집 모드**: `Enter` 진입 · `F2` 진입/복귀 · 영숫자 진입 · `Escape` 복귀 (+ 편집 취소). 속성 `aria-readonly` (셀 단위) · `aria-rowcount/colcount` + `aria-rowindex/colindex` (가상화) · `aria-sort` · `aria-selected`.
- `treegrid` 는 계층 행에만 (Right 펼침 · Left 접힘 · `aria-expanded`). [APG treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)

## C2. React Aria Components `Table`

- 지원: selection · sorting (`aria-sort` 자동) · `ResizableTableContainer` + `ColumnResizer` · DnD (키보드 · 스크린리더 포함) · `Virtualizer` + `TableLayout` · `renderEmptyState` · `TableLoadMoreItem` · `onRowAction` · expandable rows · `keyboardNavigationBehavior="arrow" | "tab"`. [Table](https://react-aria.adobe.com/Table) · [Virtualizer](https://react-aria.adobe.com/Virtualizer) · [useTable](https://react-aria.adobe.com/Table/useTable)
- **미지원**: 인라인 셀 편집 · 컬럼 헤더 메뉴. [#2328 "Grid navigation edit mode"](https://github.com/adobe/react-spectrum/issues/2328) (2021, APG 그대로 제안, PR #3258 partial) · [Discussion #6382](https://github.com/adobe/react-spectrum/discussions/6382) (2024-05): 셀 안 input 이 "behave strangely due to the keyboard navigation defaults" → 공식 권고 **"open a dialog from the cell and allow the field to be edited there"**. 현 상태 **(unverified)**.
- 함의: (a) 셀 → Popover/Dialog 편집 (권고) 또는 (b) `keyboardNavigationBehavior="tab"` + 셀 input `onKeyDown` 격리로 자체 edit mode (Enter/F2/Esc 직접 보장).

## C3. Spectrum · Cloudscape

- RSP TableView: `selectionStyle` checkbox/highlight · `onAction` · `loadingState` · `allowsResizing` · `allowsSorting`. **편집 가이드 없음**. [TableView](https://react-spectrum.adobe.com/react-spectrum/TableView.html). spectrum.adobe.com table 페이지는 회수 실패 **(unverified)**, design-data MCP 에도 table 가이드 없음.
- **Cloudscape inline edit**: 편집 가능 셀은 edit icon, 선택 시 input + dismiss/confirm, confirm 시 submit + success icon, 검증은 필드 컨텍스트. [Cloudscape](https://cloudscape.design/patterns/resource-management/edit/inline-edit/)

## C4. 상용 그리드의 스크린리더 처리

| 제품           | 확인된 사실                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid        | `grid`/`treegrid` + rowcount/colcount/rowindex/colindex/selected/expanded/sort. 가상화 경고 → `suppressRowVirtualisation` 또는 pagination. "State changes to focused elements may not trigger screen reader announcements". F2/Enter 편집 · Esc · Ctrl+Enter 범위 입력. [a11y](https://www.ag-grid.com/javascript-data-grid/accessibility/) · [keys](https://www.ag-grid.com/javascript-data-grid/keyboard-navigation/) |
| MUI X DataGrid | WAI-ARIA grid, `rowHeader`. 편집 더블클릭·Enter·Backspace/Delete·문자 진입, Esc 되돌림, Tab 저장, Enter 저장+아래. `preProcessEditCellProps` 로 저장 거부. **live announcement 문서 없음**. [a11y](https://mui.com/x/react-data-grid/accessibility/) · [editing](https://mui.com/x/react-data-grid/editing/)                                                                                                            |
| TanStack       | headless — ARIA/키보드 전무. [#2752](https://github.com/TanStack/table/discussions/2752) · [#634](https://github.com/TanStack/table/issues/634)                                                                                                                                                                                                                                                                         |
| Airtable       | 단일 tabstop · Arrow · Enter 편집 · "Focus will be trapped within the cell until you press esc" · Space 확장. [Airtable](https://support.airtable.com/docs/accessibility-in-airtable) · [DLF](https://wiki.diglib.org/AirTable_Accessibility)                                                                                                                                                                           |
| Google Sheets  | SR 모드 토글, "내용 + 주소" 공지, Ctrl/Cmd+Enter 편집. [Google](https://support.google.com/docs/answer/1632199?hl=en)                                                                                                                                                                                                                                                                                                   |
| Excel          | Narrator 공지 순서 "Value > Name > Context > Properties", 빈 셀 명시. [MS](https://techcommunity.microsoft.com/blog/excelblog/optimizing-narrator-screen-reader-announcements-in-excel-for-windows/3950028)                                                                                                                                                                                                             |
| Notion         | NVDA 편집 영역 읽기 불가 보고. [gist](https://gist.github.com/jscholes/bcecd80563791864c8bcc262bdbb668b)                                                                                                                                                                                                                                                                                                                |

결론: 붙여넣기 · 일괄 작업 · 행 추가의 live 공지는 어느 문서도 명세하지 않는다 — `role="status"` 로 직접 만든다.

## C5. 색 · 아이콘 · 모션 · 포커스 · live region

- 타입 아이콘: WCAG 1.4.11 glyph 3:1 (인접 텍스트가 같은 정보를 주면 예외) · 1.4.1 색 단독 금지. [1.4.11](https://knowbility.org/blog/2018/wcag21-1411contrast)
- 모션: 2.3.3 → `prefers-reduced-motion`. [2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- dialog: 열림 시 첫 focusable, 닫힘 시 호출 요소 복귀 "unless the invoking element no longer exists" (행 삭제 후 닫힘). [APG dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- 상태 메시지: 4.1.3 `role=status` (성공) / `role=alert` (오류). [4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). RAC Toast: landmark region · F6/Shift+F6 · 닫힘 시 포커스 복귀 · hover/focus 시 timer 정지 · 최소 5초. [Toast](https://react-aria.adobe.com/Toast)

## C6. API endpoint 편집기 폼 a11y

- 그룹: `fieldset/legend` 또는 `role=group` + `aria-labelledby`, legend 는 짧게, label 은 자립 ("Header 2 key"). [grouping](https://www.w3.org/WAI/tutorials/forms/grouping/)
- 오류: `aria-describedby` + `aria-invalid`, 상단 요약 `role=alert` + 링크, 첫 오류로 포커스. [notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
- key-value 편집기: Key/Value/Description 표 + 행별 활성 + **Bulk Edit** (Postman). 행당 3 control 순차 Tab, Add 후 새 key 포커스, `role=status` "Header row 3 added". [params](https://learning.postman.com/docs/sending-requests/create-requests/parameters/)
- code/JSON: CodeMirror 6 `.cm-content` 가 "no associated label" 위반 보고 → `contentAttributes` 로 `aria-label`/`aria-multiline`. [CodeMirror](https://codemirror.net/) · [discuss](https://discuss.codemirror.net/t/accessibility-violation-form-control-with-textbox-role-has-no-associated-label/7378) · [react-codemirror #656](https://github.com/uiwjs/react-codemirror/issues/656) · [insomnia #1436](https://github.com/Kong/insomnia/issues/1436)
- Test 결과: `role=status` "200 OK · 132 ms · 2.1 KB", 실패 `role=alert`, JSON 트리 `treegrid`/`tree`.

## C7. REST 연결 UX — 요청 편집기 수렴

| 요소                                                          | 수렴                                                                                           | 편차                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[Method ▾][URL][Send]` 바                                    | Postman · Hoppscotch · Insomnia · Bruno · Retool · Appsmith · n8n · Xano · WeWeb · FlutterFlow | Bubble 만 폼 나열                                                                                                                                                                                                                                                                                 |
| 탭 Params / Headers / Body / Auth                             | 전부                                                                                           | Retool · WeWeb 은 resource/query 2층 ("Headers configured on resource pages are automatically included") [Retool REST](https://docs.retool.com/queries/guides/api/rest) · Appsmith "turn into Authenticated API datasource" [Appsmith](https://docs.appsmith.com/connect-data/reference/rest-api) |
| Body JSON / raw / form-urlencoded / form-data / binary / none | Retool · Appsmith · n8n · Make · Postman                                                       | n8n "Using Fields Below" vs "Using JSON" 토글 [n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)                                                                                                                                                              |
| 템플릿 `{{ }}`                                                | Postman · Retool · n8n · Appsmith                                                              | Xano `$env.key`                                                                                                                                                                                                                                                                                   |

## C8. Auth 프리셋 · secret

- 수렴 5종 **None / Basic / Bearer / API Key (header|query) / OAuth2 (auth code · client credentials)** + collection 레벨 **Inherit**. [Postman](https://learning.postman.com/docs/sending-requests/authorization/authorization-types/) · [Hoppscotch](https://docs.hoppscotch.io/documentation/features/authorization) · [Appsmith](https://docs.appsmith.com/connect-data/reference/authenticated-api) · [Bruno](https://docs.usebruno.com/auth/overview) · [Insomnia](https://developer.konghq.com/insomnia/request-authentication/)
- secret 3층: ① 마스킹 (Postman secret type · Hoppscotch asterisks) [Postman](https://blog.postman.com/introducing-secret-variable-type-in-postman/) · [Hoppscotch](https://hoppscotch.com/blog/introducing-secret-variables) ② 동기화/export 제외 (Postman current value · Hoppscotch · Insomnia private env · Bruno OS 암호화 + 공유 시 strip) [variables](https://learning.postman.com/docs/sending-requests/variables/variables/) · [Kong env](https://developer.konghq.com/insomnia/environments/) · [Bruno](https://docs.usebruno.com/secrets-management/overview) ③ 서버 프록시 (Retool 백엔드 프록시 + 응답 헤더 sanitize · Bubble Private 체크 · WeWeb 은 "프록시는 CORS 용, 비밀키 보호 아님" 경고 · Xano `$env`) [Retool](https://docs.retool.com/data-sources/guides/authentication/api) · [Bubble](https://manual.bubble.io/core-resources/api/the-api-connector/adding-calls) · [WeWeb](https://docs.weweb.io/plugins/data-sources/rest-api.html) · [Xano](https://docs.xano.com/what-xano-includes/workspace/settings/environment-variables)

## C9. 응답 뷰어 · 변환 · pagination · 정책 · import

- 응답 뷰어: status (hover 의미) · time · size · Pretty/Raw/Preview · JSONPath 필터 · Headers · "save as example". [Postman](https://learning.postman.com/docs/sending-requests/response-data/responses/) · Hoppscotch code snippet · Xano 3분할 [Xano](https://docs.xano.com/the-function-stack/functions/apis-and-lambdas/external-api-request) · FlutterFlow "Response & Test" [FlutterFlow](https://docs.flutterflow.io/resources/backend-logic/create-test-api/)
- 변환: JS transformer + `.rawData` (Retool) [transformers](https://docs.retool.com/queries/guides/transformers) · 단일 "Result key" (WeWeb) · JSONPath + **Recommended** + 경로별 preview + "Is List" (FlutterFlow) [rest-api](https://docs.flutterflow.io/resources/backend-logic/rest-api/) · 응답 타입 추론 (Bubble Initialize) · **JSON 노드 클릭 → JSONPath** (Apideck WayFinder) [wayfinder](https://github.com/apideck-io/wayfinder) · drag → `{{ $json.field }}` (n8n) [mapper](https://docs.n8n.io/build/work-with-data/reference-data/use-the-ui-mapper). 다수는 **텍스트 + 즉시 preview** 로 수렴.
- pagination: Retool Limit-Offset / Cursor / Relay + "Has next page" [Retool](https://docs.retool.com/apps/guides/data/table/pagination) · Appsmith None / Page No / Response URL · n8n Update-parameter / Next-URL + 종료 조건 · WeWeb none / no-code / backend → **offset·page + cursor·next-URL 2 프리셋**.
- 정책: Retool GET 자동 · 변이 수동 · periodic · page load · watched inputs · confirm · disable [run behavior](https://docs.retool.com/queries/guides/run-behavior) · 캐시 TTL + `invalidateCache()` [caching](https://docs.retool.com/queries/concepts/caching) · 오류 "Failure conditions" · n8n "Never Error" · Make 4xx/5xx [Make](https://apps.make.com/http)
- import: cURL (Postman · Hoppscotch · n8n · Appsmith [curl](https://docs.appsmith.com/connect-data/reference/curl-import) · Xano) · OpenAPI (Postman · Bruno · Retool · Insomnia · Hoppscotch) · Postman collection (Bruno [import](https://docs.usebruno.com/get-started/import-export-data/import-collections)). Mock: Postman example 기반 [mock](https://learning.postman.com/docs/design-apis/mock-apis/overview/) · Insomnia Mockbin [mock](https://developer.konghq.com/insomnia/mock-servers/).

## C10. 체크리스트 (중요도순)

1. 편집 격자 `role=grid` 단일 tab stop + Arrow/Home/End/Ctrl+Home·End
2. Enter · F2 · 영숫자 편집 진입, Esc 취소 + grid 복귀, 편집 중 Arrow/typeahead 비활성
3. RAC Table 인라인 편집은 셀 → Popover/Dialog (권고) 또는 자체 edit mode; `aria-readonly`
4. 가상화 시 `aria-rowcount/colcount` + `aria-rowindex/colindex`
5. 행 추가/저장/삭제/붙여넣기 `role=status`, 오류 `role=alert`
6. dialog 포커스 복귀, 호출 요소 소멸 시 다음 행/추가 버튼
7. secret 마스킹 · 평문 동기화 금지 · 서버 프록시
8. Auth 프리셋 5종 + Inherit
9. 폼 오류 `aria-describedby` + `aria-invalid` + 요약 `role=alert`
10. fieldset/legend 짧게 + 자립 label
11. key-value: Remove 고유 이름 · Add 후 포커스 · Bulk Edit
12. code 편집기 `aria-label` + `aria-multiline`
13. 응답 뷰어 status/time/size + Pretty/Raw + Headers, `treegrid`, 요약 `role=status`
14. path 텍스트 + preview 기본, 클릭/드래그 보조, Recommended
15. pagination 프리셋 offset/page + cursor/next-URL
16. 타입 아이콘 텍스트 동반, 3:1, 색 단독 금지
17. cURL import 필수, OpenAPI 권장
18. 실행 정책 GET 자동 / 변이 수동 / periodic / 캐시 TTL / 실패 조건
19. `prefers-reduced-motion`
20. Toast landmark (F6) · 5초 · hover 정지 · 포커스 복귀

미검증: Spectrum table 페이지 본문 · RSP #2328 현 상태 · RAC Modal 포커스 복귀 문구 · Hoppscotch/Insomnia 변수 구문 · Retool/Appsmith/WeWeb mock 부재.

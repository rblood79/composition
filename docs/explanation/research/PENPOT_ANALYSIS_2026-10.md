# Penpot 분석 2026-10 — 아키텍처 · 변경 모델 · 렌더러 전환

> **작성일**: 2026-10-06
> **대상**: [penpot/penpot](https://github.com/penpot/penpot) (develop 브랜치 · 2.16~~2.20 시점)
> **방법**: deep-research 워크플로 (검색 5 각도 · 출처 23 · 주장 105 추출 · 25 교차 검증 · 3 표 중 2 반박이면 탈락). 확인 18 · 탈락 7.
> **범위**: §1~§7 은 1차 워크플로 검증 통과 내용. §8 은 탈락 주장 (인용 금지). §9 는 레이아웃 · 토큰 · 플러그인/MCP · 라이선스 추가 조사 (병렬 에이전트 4 + 원본 소스 직접 대조). §10 은 종합.

---

## 1. 아키텍처 · 기술 스택 (신뢰도 높음)

- frontend = ClojureScript SPA, React 를 rumext 라이브러리로 감싸 쓴다. 정적 웹 서버가 제공한다.
- backend = Clojure (JVM), 데이터는 PostgreSQL.
- 공용 `common` 모듈 (`.cljc`) 로 frontend · backend 가 코드와 데이터 구조를 함께 쓴다.
- 공식 문서의 구성요소 4개: Frontend · Backend · Exporter · Common code.
- 단서: frontend 에는 TypeScript (plugins 등) 와 Rust (render-wasm) 도 섞여 있다.
- 근거: `backend/deps.edn` 이 `penpot/common {:local/root ../common}` 선언 · `frontend/deps.edn` 이 `funcool/rumext` v2.25.

출처: [architecture](https://help.penpot.app/technical-guide/developer/architecture/) · [frontend](https://help.penpot.app/technical-guide/developer/architecture/frontend/) · [backend.md](https://github.com/penpot/penpot-docs/blob/main/technical-guide/developer/architecture/backend.md)

## 2. 실시간 협업 (신뢰도 높음)

- 사용자가 파일을 열어 WebSocket 을 연결하면 backend 가 file id 를 topic 으로 Redis 호환 broker 를 구독한다. 변경은 그 topic 의 모든 구독자에게 WebSocket 으로 간다.
- backend 를 여러 인스턴스로 띄우면 broker 가 인스턴스 사이를 잇는다.
- `msgbus.clj` docstring 「implemented using redis as underlying backend」, `websocket.clj` 의 `subscribe-file` 이 `(mbus/sub! :topic file-id ...)` 호출.
- 보정: 현재 공식 docker-compose 는 `valkey/valkey:8.1` (설정 변수는 여전히 `PENPOT_REDIS_URI`). topic 에 tenant prefix 가 붙고, file 외에 profile-id · team-id topic 도 구독한다.

출처: [msgbus.clj](https://github.com/penpot/penpot/blob/develop/backend/src/app/msgbus.clj) · [websocket.clj](https://github.com/penpot/penpot/blob/develop/backend/src/app/http/websocket.clj)

## 3. 변경 모델 — Event Sourcing (신뢰도 높음)

- 파일을 직접 고치지 않고, 수정 하나를 직렬화 가능한 change 객체로 만든다. 저장 · backend 전송 · 로그 · undo 가 모두 이 객체를 쓴다.
- 규칙 2개: 멱등 (「increment counter」 가 아니라 「set counter to value x」) · 충돌을 줄이려고 필요한 부분만 바꾼다.
- change 를 만드는 business logic (`common/src/app/common/logic/` 의 `shapes.cljc` · `libraries.cljc`, 예: `generate-instantiate-component`) 은 UI 와 무관한 공용 cljc 코드다.
- 미결: backend 가 business logic 을 직접 실행하는지, frontend 가 만든 change 를 받아 적용만 하는지는 문서로 정해지지 않는다.

**composition 대조**: `명령 → workspace.execute → 검증·commit → History` 파이프라인 (`.claude/rules/state-management.md`) 과 같은 구조다. 멱등 · 최소 범위 규칙은 composition 문서 변경 명령 (`packages/shared/src/catalog/{transactions,commands}/`) 설계와 비교할 기준이 된다.

출처: [abstraction-levels](https://help.penpot.app/technical-guide/developer/abstraction-levels/) · [libraries.cljc](https://github.com/penpot/penpot/blob/develop/common/src/app/common/logic/libraries.cljc)

## 4. 데이터 모델 — Shape (신뢰도 중간)

- 중심 엔티티는 Shape. Shape 하나 = 디자인 레이어 하나 = SVG 노드 하나 + Penpot 고유 기능.
- 작업 화면 · 뷰어 · exporter · handoff · 파일 export 가 모두 Shape 를 SVG 태그로 렌더하는 코드를 썼다. SVG import 로 Shape 를 되돌리는 코드도 있다.
- 즉 원래 설계는 SVG 렌더러 전제다. 이 문서는 render-wasm 전환을 반영하지 않았다.

출처: [data-model](https://help.penpot.app/technical-guide/developer/data-model/)

## 5. 컴포넌트 동기화 · override (신뢰도 높음)

- `common/src/app/common/types/component.cljc` 의 `sync-attrs` 맵이 shape 속성을 sync group 에 대응시킨다: `:name→:name-group` · `:fills→:fill-group` · `:hidden→:visibility-group` · `:x/:y→:geometry-group` · `:opacity→:layer-effects-group`.
- 맵에 없는 속성은 동기화에서 빠진다.
- copy 에서 속성 하나를 고치면 그 **group** 이 `:touched` 가 되고, 이후 그 group 에 대한 main 의 변경은 copy 로 전파되지 않는다.

**composition 대조**: override 단위가 속성이 아니라 group 이다. composition 의 원본/instance override 모델과 비교할 때 「한 속성을 고치면 같은 group 의 다른 속성도 동기화가 끊긴다」 는 trade-off 가 핵심이다. variants 구현은 이번 범위 밖.

출처: [data-guide](https://help.penpot.app/technical-guide/developer/data-guide/) · [component.cljc](https://github.com/penpot/penpot/blob/develop/common/src/app/common/types/component.cljc)

## 6. 파일 포맷 v3 (신뢰도 높음)

- `.penpot` = ZIP. 안에 사람이 읽을 수 있는 JSON (페이지 · shape · 색상 · 컴포넌트 · 타이포그래피 · 토큰) + 바이너리 미디어 (`objects/`).
- 옛 v1 (독자 바이너리) 은 가져오기만 된다. 현재 모든 버전이 v3 로 내보낸다.
- v3 도입 PR [#5172](https://github.com/penpot/penpot/pull/5172) (「Add binfile-v3 export/import file format」). 그 사이의 v2 (SQLite 기반) 는 출시되지 않았다.
- manifest 안의 format version `1` 은 번호 체계가 달라 v1 포맷과 헷갈리기 쉽다.

출처: [penpot-file-format](https://help.penpot.app/user-guide/export-import/penpot-file-format/)

## 7. 렌더러 전환 — SVG → Rust + Skia wasm (WebGL)

### 7-1. 이유 (신뢰도 높음)

- 크고 복잡한 파일에서 SVG 렌더러 성능이 부족했다.
- 기존 렌더러가 병목이라 background blur · 변별 stroke (per-side) · image crop · stroke-to-path 같은 기능을 몇 년 미뤘다 (2026-06-03 공식 Product updates 글).

### 7-2. 현황 (신뢰도 높음)

- 2.16 에서 beta. 「an optional, faster canvas for demanding files」, **기본값 꺼짐**, Settings 또는 Workspace → Preferences 에서 켠다. 작업 화면 캔버스에만 적용.
- 2.16 시점에는 view mode · export (PDF / SVG / PNG / WEBP) 가 SVG 렌더러였다. 2.17 에서 prototype viewer 를 WASM 으로 옮겼다 (§9-4). export 는 여전히 SVG 로 보이며, 두 렌더러가 함께 쓰이는 단계다.
- 신규 계정 기본값 전환 [#11855](https://github.com/penpot/penpot/issues/11855) (2026-09-23 등록, 목표 2.20.0, Open) — beta 라벨 제거 계획.

### 7-3. 방식 — tile 렌더 (신뢰도 높음)

- 보이는 부분 (과 주변 potentially visible tile) 만 그리고, 그린 tile 을 고정 크기 메모리 캐시에 둔다. 캐시가 차면 먼 tile 부터 버린다.
- 2026 년 [#11696](https://github.com/penpot/penpot/issues/11696) (tile 경계 텍스트 픽셀 틈) 이 이 방식이 지금도 쓰인다는 것을 보여 준다.

**composition 대조**: composition 의 Skia/CanvasKit 캔버스와 같은 계열의 선택이다. Penpot 은 SVG → wasm 이행기라 두 렌더러가 공존하고, composition 은 Skia(Builder) ↔ DOM/CSS(Preview/Publish) 를 대등 consumer 로 상시 공존시킨다 — 목표가 다르다 (이행 vs 대칭).

### 7-4. 성능 사례 (신뢰도 중간)

[PR #11980](https://github.com/penpot/penpot/pull/11980) (elenatorro, 2026-10-02 develop merge):

- shape ~1만 · boolean ~700 페이지에서 board 드롭 후 멈춤 10.8초 → 1.2초. GPU 드라이버 메모리 최대 시점 ~19% · 유휴 ~37% 감소, 시각 결과 무변경.
- 원인: boolean 재계산마다 shapes pool 전체를 두 번 복사.
- 수정 5가지: clone 대신 `mem::replace`/`take` · 이동 중 중복 boolean 계산 생략 · rigid translation 경로 분리 · offscreen surface 를 Skia 관리 render target 으로 · atlas 를 mipmap 대신 linear sampling.
- 작성자가 파일 1개로 잰 값, 제3자 재현 없음, 정식 릴리스 포함 여부 미확인.

**composition 대조**: 「편집마다 전체 pool 복사」 는 composition 의 편집마다 문서 얕은 복제 → identity 캐시 빗나감 (메모리 `feedback-doc-clone-breaks-node-identity-cache`) 과 같은 결함 유형이다.

## 8. 탈락한 주장 — 인용 금지

| 주장                                                                         | 표  | 출처                                                                                                            |
| ---------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------- |
| Page 와 Component 가 shape 트리를 공유하고 top frame 이 최상위 shape 를 담음 | 0-3 | [data-model](https://help.penpot.app/technical-guide/developer/data-model/)                                     |
| file 의 `data` 속성 하나에 Pages 와 라이브러리 자산이 함께 들어 있음         | 1-2 | [data-model](https://help.penpot.app/technical-guide/developer/data-model/)                                     |
| RPC 경로 `/api/rpc/query/xxx` · `/api/rpc/mutation/xxx`                      | 0-3 | [backend.md](https://github.com/penpot/penpot-docs/blob/main/technical-guide/developer/architecture/backend.md) |
| 파일 버전 번호 + `migrations.cljc` migration 체인                            | 0-3 | [data-guide](https://help.penpot.app/technical-guide/developer/data-guide/)                                     |
| CEO 가 DOM 관리 성능을 주된 이유로 들었음 (2024-09)                          | 0-3 | [t/6437](https://community.penpot.app/t/its-time-for-penpot-to-almost-move-away-from-the-dom/6437)              |
| wasm canvas PoC 완성 후 확정, Skia/Vello 미결                                | 0-3 | [t/6437](https://community.penpot.app/t/its-time-for-penpot-to-almost-move-away-from-the-dom/6437)              |
| beta 다음 순서 = export → 캔버스 텍스트 편집기 → view mode                   | 0-3 | [t/10627](https://community.penpot.app/t/whats-next-for-the-penpot-webgl-renderer/10627)                        |

## 9. 추가 조사 — 레이아웃 · 토큰 · 플러그인/MCP · 라이선스

> 2026-10-06 조사 에이전트 4개를 병렬로 돌렸다. 각 항목의 핵심 근거는 GitHub API · develop raw 소스 (sparse clone `0eb1e8ba9`, 2026-10-05) 로 직접 대조했다. 직접 대조한 줄은 **[대조]** 로 표시한다. 그 외는 에이전트가 1차 출처에서 인용한 내용이다.

### 9-1. 레이아웃 — CSS 와 1:1 이 아니다

**모델** (`common/src/app/common/types/shape/layout.cljc`)

- 컨테이너: `:layout #{:flex :grid}` · flex-dir 4종 · wrap · row/column gap · padding p1~p4 · justify/align-content (start · end · center · space-\* · stretch) · align/justify-items (baseline 없음).
- grid 트랙 type `#{:percent :flex :auto :fixed}` (`:flex` = `fr`). minmax · min-content · max-content 없음. cell 은 row · column · span · area-name · `position #{:auto :manual :area}`.
- 자식: margin · `h-sizing`/`v-sizing #{:fill :fix :auto}` · min/max-w/h · align-self · `layout-item-absolute` · z-index.
- **CSS 에 있는 flex-grow · flex-shrink · flex-basis · order 가 없다.** 크기 의도는 fill / fix / auto 세 값뿐이다.

**계산 위치**

- 옛 SVG 경로: cljc (`common/src/app/common/geom/shapes/flex_layout/*` · `grid_layout/*`, 진입 `geom/modifiers.cljc`).
- render-wasm: **Rust 자체 구현, Taffy 미사용**. [대조] `render-wasm/Cargo.toml` dependencies = `base bezier-rs gl glam indexmap macros skia-safe thiserror uuid`. 구현은 `render-wasm/src/shapes/modifiers/flex_layout.rs` (796줄) · `grid_layout.rs` (938줄). cljc 는 속성만 FFI 로 넘긴다 (`wasm/layouts/flex.rs` `set_flex_layout_data`).
- 같은 알고리즘이 cljc · Rust 두 곳에 있다 (이름 · 구조가 1:1 대응 — 추정, medium). 이식 중 발산 수정 사례: #9941 「Fix layout render-wasm issues」.

**알고리즘 성격 — CSS 기반 고유 모델과 지원 범위**

- fill 분배: [대조] `flex_layout.rs:280` `distribute_fill_main_space` — fill 자식은 min 크기에서 시작하고, 남은 공간을 fill 자식 수로 균등 분할하며 max 에 닿은 자식을 빼고 반복한다. shrink 단계 없음. [대조] `MIN_SIZE: f32 = 0.01` (`:14`) — CSS `min-width: auto` 개념이 없다.
- grid: fixed/percent 즉시 확정 → auto 는 span=1 자식 최대값 → multi-span 은 span 내림차순으로 auto 트랙에 균등 분배 → fr. CSS Grid intrinsic sizing 의 축약 근사다. auto-placement 도 자체 규칙 (숨긴 shape 는 absolute 취급 · auto 셀은 manual 전환 후 압축 — `.serena/memories/common/layout-grid-subtleties.md`).
- [대조] [공식 Flexible Layouts 가이드](https://help.penpot.app/user-guide/designing/flexible-layouts/) 는 웹의 최종 출력에 가까운 결과를 목표로 하고 Flexbox · CSS Grid 기반임을 명시한다. 다만 위 모델과 계산 코드의 지원 범위는 CSS 명세 전체와 다르므로, 가이드의 설명만으로 브라우저와의 완전한 동등성을 입증할 수는 없다. 지원되지 않는 명세 기능과 생성 CSS 의 불일치를 구분해 검증해야 한다.

**design-to-code (Inspect › Code, `frontend/src/app/util/code_gen/style_css_values.cljs` · `style_css_formats.cljs`)**

- 주축 fill → `flex: 1` (width 생략) · 교차축 fill → `100%` · grid fill → width 생략, stretch 에 맡김 · auto → `auto` (`fit-content` 아님) · 루트 레이아웃 board → `width: 100%` + `flex-grow: 1` · 트랙 → `Nfr` / `%` / `auto` / `px`.
- 즉 고유 모델을 근사 CSS 로 **번역**한다. 번역 층이 있어 에디터 결과와 export 결과가 갈릴 수 있다.
- [대조] 코드 결함: `get-flex-shrink` (`style_css_values.cljs:434-447`) 가 `#{:row :reverse-row}` · `#{:column :column-row}` 로 적혀 `:row-reverse` / `:column-reverse` 와 일치하지 않고, 부모가 아니라 자식 자신의 `:layout-flex-dir` 을 검사한다.
- 불일치 이슈: [#10214](https://github.com/penpot/penpot/issues/10214) (closed, Code 를 CodePen 에 붙이면 layout 어긋남 → [PR #10217](https://github.com/penpot/penpot/pull/10217)) · [대조] #8013 (open, 「Flex layout inside Grid layout does not respect width: 100% when grid container shrinks」) · #7598 (open). #10214 는 생성 HTML/CSS 가 에디터 디자인에 최대한 가깝게 렌더되어야 한다는 기대를 명시하고, #10217 은 그 불일치를 수정했다. 이는 CSS 일치를 개선하려는 근거이며, CSS 일치가 목표 밖이라는 근거는 아니다.

**검증 방식**

- cljc 단위 테스트: `geom_flex_layout_test.cljc` 2개 · `geom_grid_layout_test.cljc` ~18개. 기대값은 손으로 쓴 숫자 — 브라우저 CSS 와 비교하지 않는다.
- Rust: `flex_layout.rs` · `grid_layout.rs` 에 `#[test]` 0. `modifiers.rs` 테스트 12개는 pixel precision · group bounds 만.
- Playwright `frontend/playwright/ui/render-wasm-specs/shapes.spec.js` 「Renders a file with flex layouts and different directions」 는 wasm 렌더를 자기 이전 스냅샷과 비교한다.
- cljc ↔ Rust differential · 엔진 ↔ 브라우저 CSS differential 테스트는 조사한 `0eb1e8ba9` 트리에서 찾지 못했다 (트리 grep 기준, medium). 조사 범위에서 자동 대조군을 확인하지 못했다는 뜻이며, 모든 검증 경로에 그런 대조군이 없다고 확정한 것은 아니다.

**composition 대조**

- composition 의 Canvas 는 CSS 명세 기반 자체 Rust WASM 엔진을 사용하며 Taffy 의존은 없다 ([`packages/engine/Cargo.toml`](../../../packages/engine/Cargo.toml)). [`compositionRoot.ts`](../../../packages/shared/src/catalog/runtime/compositionRoot.ts) 가 `PersistentLayoutTree` 로 계산한 geometry 를 Skia 가 소비하고, DOM/Preview/Publish 는 catalog 선언을 CSS 로 변환해 **브라우저가 독립적으로 레이아웃을 계산**한다 ([`domBinding.tsx`](../../../packages/shared/src/catalog/runtime/domBinding.tsx)). 공용 catalog 입력을 소비하지만 두 경로가 하나의 레이아웃 계산 엔진을 공유하는 구조는 아니다.
- composition 은 자체 엔진 ↔ 브라우저 CSS 의 differential oracle 로 레이아웃 정합을 검증한다 ([레이아웃 계약](../../../.claude/rules/layout-engine.md)). Penpot 에서 동등한 자동 대조군은 이번 조사 범위에서 미확인이다. 이 차이만으로 전체 CSS 정합의 우열을 판정할 수는 없으며, 양쪽 모두 지원 범위와 실제 대조 결과를 기준으로 평가해야 한다.
- Penpot 의 고유 모델 · CSS 번역 층과 불일치 수정 사례는 composition 에도 참고할 수 있다. 특히 크기 의도를 CSS 로 옮기는 경계와 에디터 ↔ 생성 코드의 발산을 점검하는 사례다. Penpot 의 구현을 브라우저 동등성의 검증 근거로 그대로 사용할 수는 없지만, parity 조사 선례 전체를 배제할 이유도 없다.

### 9-2. 디자인 토큰 — 문법은 DTCG, 구조는 Tokens Studio 방언

**도입 · 이력** (`CHANGES.md`)

- 2.6.0 (2025-04) 「Design Tokens」 · 수식 · JSON import/export. Tokens Studio 와 공동 개발 ([Tokens Studio 블로그](https://tokens.studio/blog/tokens-studio-penpot-bringing-native-open-standard-design-tokens-to-everyone)).
- 2.8 multi-file · 2.9 zip import · fontSize · 2.10 Number · fontFamily · fontWeight · 2.11 Typography composite · 2.12 Inspect 탭 표시 · 2.13 Box Shadow · 2.14 Plugin API · 2.16 연결 라이브러리에서 import · 2.17 「Use `$` as DTCG token/group discriminator」 · 2.19 (미출시) 내부 라이브러리 · 파일 sync.
- 값 해석은 `@tokens-studio/sd-transforms` + Style Dictionary (`frontend/src/app/main/data/style_dictionary.cljs`). `:tokenscript` flag 를 켜면 TokenScript 해석기.

**DTCG 준수 범위**

- [대조] 토큰 노드는 DTCG 문법: `tokens_lib.cljc` 가 `"$value"` · `"$type"` 을 쓰고, `:1490` 주석이 「Per the DTCG Community Group Final Report (W3C, 2025-10-28)」.
- 파일 구조는 Tokens Studio multi-set envelope: 최상위 key = set 이름 + `"$themes"` + `"$metadata"` (`tokenSetOrder` · `activeThemes` · `activeSets`). multi-file 은 `<set>.json` + `$themes.json` + `$metadata.json`.
- `$type` 이름이 Tokens Studio 식: `borderRadius` · `fontFamilies` · `fontSizes` · `fontWeights` · `sizing` · `spacing` (`common/src/app/common/types/token.cljc:87-107`, [대조] 20종).
- DTCG 2025.10 구조형 값 (`colorSpace` 객체 · `{value, unit}`) 미처리 — export 는 원문 문자열 그대로 (`"#hex"` · `"16px"`) (medium-high).
- import 는 legacy (`value`/`type`) 와 DTCG 노드를 자동 판별해 둘 다 받는다.
- [포럼 t/10544](https://community.penpot.app/t/token-export-is-tokens-studio-format-not-dtcg-2025-10/10544) (2026-05-04) 「What Penpot exports is a Tokens Studio multi-set JSON file … not what DTCG 2025.10 defines」 — 스태프가 반박하지 않았다. **코드 기준으로 맞는 주장이다.**

**유형 · alias · 수식**

- 유형 20종: boolean · borderRadius · color · dimension · fontFamilies · fontSizes · fontWeights · letterSpacing · number · opacity · other · rotation · shadow · sizing · spacing · string · borderWidth · textCase · textDecoration · typography. lineHeight 는 composite 안에서만.
- alias 는 `{token.name}`, 수식은 `+ − * / % ^` + abs · ceil · floor · round · max · min · sqrt · pow ([help](https://help.penpot.app/user-guide/design-systems/design-tokens/)).

**Sets · Themes**

- [대조] 적용 순서 = 활성 set 을 **set 목록 순서**로 `merge` (뒤가 이김) — `common/src/app/common/files/tokens.cljc` `get-tokens-in-active-sets` 「Get merged tokens from all active sets, in set order」. help 도 「similar to how Cascading Style Sheets work」.
- Theme = set 이름 목록 + group (Mode · Brand 등). 여러 group 동시 활성 (multidimensional). 그래도 최종 우선순위는 set 목록 순서 하나 (medium).
- theme 없이 set 을 직접 토글하면 숨김 theme `__PENPOT__HIDDEN__TOKEN__THEME__` 가 상태를 담는다.
- 활성 상태는 lib 와 분리된 `TokensStatus [active-theme-ids active-set-ids]` → file data `:tokens-status`.

**해석 시점 — 적용 시 베이크**

- 토큰 lib 는 file data `:tokens-lib` · `:tokens-source`. 레코드 `Token [id name type value ...]` 의 value 는 해석 전 원문.
- `apply-token` (`frontend/src/app/main/data/workspace/tokens/application.cljs`) 이 shape 의 `:applied-tokens` (속성 → 토큰 이름) 를 기록하고, **해석값을 `fills` 등 실제 속성에 써넣는다.** 렌더러는 토큰을 모른다.
- 토큰 값이 바뀌면 [대조] `propagation.cljs:210` `propagate-workspace-tokens` 가 활성 set 전체를 다시 해석하고 `:applied-tokens` 를 가진 shape 속성을 undo 트랜잭션 하나로 다시 써넣는다.
- 토큰 관련 회귀는 실패 경로를 구분해야 한다. [#9892](https://github.com/penpot/penpot/issues/9892) 는 spacing 토큰 갱신 후 component copy 의 padding 은 바뀌지만 자식 위치가 reflow 되지 않는 문제다. 값 갱신과 레이아웃 재계산 사이의 회귀이며, 값 전파 자체의 누락과 동일하지 않다.
- [#9255](https://github.com/penpot/penpot/issues/9255) · [#11362](https://github.com/penpot/penpot/issues/11362) 는 새 렌더러 경로에서 텍스트 편집 중 color/typography 토큰 연결이 사라지는 회귀다. 토큰 참조 보존 문제이므로 베이크 값의 전파 누락과 별도로 다뤄야 한다.
- 생성 CSS 는 토큰을 참조하지 않는다 (`code_gen/*` 에 `var(--` 0건). CSS 변수 export 는 서드파티 플러그인 또는 JSON → Style Dictionary.

**composition 대조**

- composition 은 theme/tokens root collection 을 소비 시점에 해석해 공용 theme snapshot 과 token map 을 제공한다 ([`theme.ts`](../../../packages/shared/src/catalog/runtime/theme.ts)). 이는 토큰 변경 때 shape 마다 베이크된 속성을 다시 써넣는 전파 패스에 대한 의존을 줄인다. 그러나 이 구조만으로 텍스트 편집 중 토큰 연결 소실이나 레이아웃 갱신 누락이 발생하지 않는다고 보증할 수는 없다.
- 대칭 검증에는 편집 전후 토큰 참조 보존, 토큰 변경 후 Canvas 의 해석값 · 캐시 무효화, DOM 의 CSS 변수 갱신, 레이아웃에 영향을 주는 값의 재계산을 각각 포함해야 한다. 공용 snapshot 을 사용한다는 사실과 두 consumer 의 실제 갱신 결과가 일치한다는 검증은 구분한다.
- Penpot 은 override 순서를 「set 목록 순서」 하나로 둔다. composition theme 축 (mode · brand) 이 늘면 같은 결정을 명시해야 한다.
- 외부 교환을 열 때 「DTCG 지원」 표기의 실제 범위 (envelope · `$type` 이름 · 구조형 값) 를 Penpot 보다 정확히 정해야 한다.

### 9-3. Plugin API · MCP · AI

**Plugin API**

- [대조] 로직은 메인 스레드의 SES Compartment 에서 실행: `plugins/libs/plugins-runtime/src/lib/create-sandbox.ts:65` `ses.hardenIntrinsics()` · `:205` `ses.createCompartment(publicPluginApi)` · `compartment.evaluate(plugin.code)`. UI 는 iframe (`allow-scripts allow-same-origin`, #11271). Compartment 에 넘기는 전역은 `penpot` proxy · `credentials: 'omit'` fetch · `setTimeout` 정도.
- 타입 패키지 `@penpot/plugin-types`. 독립 저장소 `penpot/penpot-plugins` 는 archived → 본 저장소 `plugins/` 로 합쳐짐.
- 권한 enum: `content:read/write` · `library:read/write` · `user:read` · `comment:read/write` · `allow:downloads` · `allow:localstorage` · `clipboard:read/write`. 2.19 개발본 #11137 「Fix plugin API missing permission checks in tokens, shapes, variants…」 — 검사 누락이 최근까지 있었다.
- API 표면: Shape 계열 · `FlexLayout`/`GridLayout` · `Library` · `TokenCatalog` · `Export` · `HistoryContext` · `createShapeFromSvg` · `generateMarkup` (html/svg) · `generateStyle` (css). 2.18 에 `waitForLayoutUpdate` 추가.
- **문서 반영 경로 = UI 와 같은 파이프라인.** [대조] `frontend/src/app/plugins/shape.cljs` 가 `(st/emit! (dwsh/update-shapes [id] #(assoc % :fills value)))` — UI 와 같은 workspace 이벤트. [대조] `history.cljs` 의 `undoBlockBegin` / `undoBlockFinish` 가 `dwu/start-undo-transaction` / `commit-undo-transaction` 을 부르고, 앞에서 `(r/check-permission plugin-id "content:write")` 를 검사한다. 2.15.4 「Emit `create-shape-layout` … from plugins and MCP (same event as workspace)」.

**MCP 서버 — 공식, bridge 플러그인 경유**

- 2.15.0 (2026-05-12) 「Add MCP server integration for AI-assisted design workflows」 (#9174). `penpot/penpot-mcp` 는 본 저장소 `mcp/` 로 이관. 2026-01 [Smashing 기사](https://www.smashingmagazine.com/2026/01/penpot-experimenting-mcp-servers-ai-powered-design-workflows/) 시점엔 실험 단계, 현재 [help](https://help.penpot.app/mcp/) · [제품 페이지](https://penpot.app/ai/mcp-server) 에 beta 표기 없음.
- [대조] `mcp/README.md` 「communicates with Penpot via the dedicated **Penpot MCP Plugin**, which connects to the MCP server via WebSocket … The LLM is free to write and execute arbitrary code snippets within the Penpot Plugin environment」. backend API 가 아니라 **bridge 플러그인 + Plugin API** 경로다. bridge manifest 는 권한 7개 전부 요청.
- 도구 (`mcp/packages/server/src/tools/`): `execute_code` (핵심 — LLM 이 JS 작성, `penpot` · `penpotUtils` · `storage` 사용) · `high_level_overview` · `penpot_api_info` · `export_shape` · `import_image` · `import_penpot_file`.
- 전송: Streamable HTTP `localhost:4401/mcp` · WebSocket 4402. 모드 local / remote / multi-user (토큰) / Redis multi-instance. 2.16.1 에 호스팅 remote MCP key · Integrations 페이지.
- 한계: 플러그인 UI 를 닫으면 연결 끊김, 탭이 잠들면 작업 정지 (2.18 #10323 에서 일부 수정).
- 보안 이력: 2.15.0 「Fix MCP ReplServer binding to all interfaces (0.0.0.0) … allowing unauthenticated RCE」 · 2.18.0 「Fix MCP tokens being usable as API access tokens」 · 2.18.0 plugin UI iframe 의 Penpot 도메인 차단 · 2.19 plugin postMessage origin 검증 (#10968).

**AI 입장**

- 제품 안 생성형 AI 기능은 찾지 못했다 (medium). AI 는 외부 에이전트가 MCP · Plugin API 로 접근 — 「giving AI systems access to the same Plugin API available to humans」 ([Codrops 2025-12](https://tympanus.net/codrops/2025/12/16/designing-in-the-open-how-community-collaboration-is-shaping-penpots-ai-future/)).
- [AI whitepaper](https://penpot.app/blog/penpot-ai-whitepaper/) (2025-08-05): 「we build in the open, you remain in control」. 학습 데이터 · opt-in 명시 정책은 없음 (medium).

**composition 대조**

- Penpot 은 플러그인 · MCP 편집이 UI 와 같은 이벤트 + undo transaction 을 거친다. composition AI 패널도 `workspace.execute` 를 유일한 진입점으로 두는 것이 같은 원칙이다. 「AI 한 턴 = History 항목 1개」 묶음 API (`undoBlockBegin/Finish` 대응) 가 필요한지는 따져볼 지점이다.
- Penpot MCP 는 「임의 JS 실행 + API 문서 조회」 조합이고 README 가 「use the most capable model」 을 권한다. 로컬 Ollama 모델 (context · 코드 작성 능력 제한, 메모리 `reference-ollama-default-num-ctx-truncates-tool-prompt`) 에는 스키마가 있는 명령 단위 tool 이 더 맞다 (추정). 임의 코드 경로를 열면 SES 수준 격리 + 권한 검사가 필요하고, Penpot 은 2.15~2.19 내내 RCE · 권한 누락 수정을 반복했다.
- 외부 에이전트에 MCP 를 열 계획이면 서버 ↔ 브라우저 bridge 의 탭 수면 · UI 닫힘 문제를 설계 단계에서 다뤄야 한다.

### 9-4. 라이선스 · 사업 모델 · 릴리스 · 셀프호스팅

**라이선스 · 사업 모델**

- [대조] MPL-2.0 (GitHub API `spdx_id`). 소유 「KALEIDOS SUBSIDIARY SL」. CLA 없음, DCO 1.1 (`CONTRIBUTING.md`).
- 2.18 「Say hello to Penpot Enterprise, our new paid plan」. 클라우드 ([pricing](https://penpot.app/pricing)): Professional 무료 (편집자 8명 · 10GB) · Unlimited $7/editor/월 (월 $175 상한) · Enterprise $25/member/월 (SSO · IP whitelisting) · Private Server $50,000/년.
- self-host ([pricing/self-host](https://penpot.app/pricing/self-host)): Professional 무료 · 커뮤니티 지원 / Enterprise $25/user/월 (최소 $950/월) — admin console · 다중 organization · SSO · audit logs · 「Plugins Allowlist, including Agentic AI」. add-on SOC2/HIPAA · air-gapped 지원.
- 미확인: Enterprise 기능 소스 공개 여부 · license key 방식. 새 `penpotapp/admin-console` 이미지의 소스 위치 (org 의 `penpot-admin` 저장소는 2023 실험판).

**릴리스** ([대조] GitHub releases `published_at`)

| 버전   | 날짜       | 주요 내용                                                             |
| ------ | ---------- | --------------------------------------------------------------------- |
| 2.10.0 | 2025-09-29 | Number token · typography 계열 token · 기존 컴포넌트에서 variant 생성 |
| 2.11.0 | 2025-11-11 | Typography composite token · File Data storage layout refactor        |
| 2.12.0 | 2025-12-29 | board 를 PDF 로 export · Inspect 탭 토큰 표시                         |
| 2.13.0 | 2026-02-03 | Box Shadow token · 삭제 파일 dashboard                                |
| 2.14.0 | 2026-03-24 | Plugin API 토큰 접근 · 깊은 중첩 sidebar 성능                         |
| 2.15.0 | 2026-05-12 | MCP server · chunked upload (크기 제한 제거) · anonymous telemetry    |
| 2.16.0 | 2026-06-11 | WebGL 렌더 (beta) 선택 · Find & Replace                               |
| 2.17.0 | 2026-07-22 | prototype viewer 를 WASM (Skia) 로 렌더 · dashed stroke               |
| 2.18.0 | 2026-09-23 | Penpot Enterprise · outline stroke → Paths · Line/Arrow 도구          |
| 2.18.2 | 2026-10-05 | 최신 안정판 · SVG sanitizer 보안 수정                                 |

- 주기 약 6주. 2.18 은 release-notes 페이지 「September 9, 2026」 vs GitHub 태그 09-23 — 앞 날짜는 SaaS 반영일로 추정 (medium).
- **§7-2 보정**: 2.17 에서 prototype viewer 도 WASM 렌더로 옮겼다 (CHANGES.md). 「view mode 는 SVG」 는 2.16 시점 서술이다.
- 로드맵: 정식 문서 없이 커뮤니티 글 [「Not a roadmap, but… what's coming in Penpot (June 2026)」](https://community.penpot.app/t/not-a-roadmap-but-whats-coming-in-penpot-june-2026/10628). 5 트랙 — Design Experience & Reliability / Design System Operations / Agentic & AI-Native (「Design as a graph (SDG)」) / Enterprise & Self-Host / Design-to-Delivery. 후보: variable fonts · component slots · design branching · CSS 기반 breakpoint · HTML viewer · passkeys/2FA.

**커뮤니티**

- [대조] stars 60,718 · forks 4,176 · 생성 2015-12-29. contributors 약 353명.
- Kaleidos (Madrid, 2011 설립) — 투자 · 인원 수치는 dealroom 2차 집계라 low. 재단 소속 근거 없음, 회사 주도.

**셀프호스팅**

- [대조] `docker/images/docker-compose.yaml`: `penpotapp/frontend` · `backend` · `admin-console` · `mcp` · `exporter` (`${PENPOT_VERSION:-2.18}`) · `postgres:15` · `valkey/valkey:8.1` · 개발용 `mailpit`. 저장소 기본 `PENPOT_OBJECTS_STORAGE_BACKEND: fs`, S3 호환 설정 주석.
- [대조] 기본 `PENPOT_FLAGS`: `disable-email-verification enable-smtp enable-prepl-server disable-secure-session-cookies enable-mcp enable-admin-console`. 인터넷 노출 시 앞 두 disable flag 제거 권고 (compose 주석).
- 필수 설정: `PENPOT_SECRET_KEY` · `PENPOT_PUBLIC_URI` · `PENPOT_DATABASE_URI` · `PENPOT_REDIS_URI`.
- 설치 방법: docker compose · 공식 Helm Chart · OpenShift · Rancher · Elestio · TrueNAS ([getting-started](https://help.penpot.app/technical-guide/getting-started/)). 「Docker images are published shortly after the SaaS update」.
- 운영 제약: Admin Console 은 다음 버전부터 필수 예정 · 업그레이드는 작은 단계로 · 대형 프로젝트 성능 문제 ([t/8422](https://community.penpot.app/t/performance-issues-with-self-hosted-penpot-on-big-projects/8422), 2025-04, 「UI becomes laggy … browser freezes」 — 공식 답변 · 해결 근거 없음).

## 10. 종합 — composition 이 가져올 것 · 가져오지 않을 것

| 영역                | Penpot                                                                               | composition 에 주는 의미                                                                         |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 변경 모델           | change 객체 · 멱등 · 최소 범위 · 공용 cljc business logic                            | 같은 구조 — 멱등 · 최소 범위 규칙을 명령 설계 점검 기준으로 쓸 수 있다                           |
| 플러그인 · MCP 편집 | UI 와 같은 이벤트 + undo transaction                                                 | AI 패널도 `workspace.execute` 단일 진입 · 턴 단위 History 묶음 검토                              |
| 컴포넌트 override   | 속성 group 단위 `:touched`                                                           | 속성 단위 vs group 단위 trade-off 비교 자료                                                      |
| 렌더러              | SVG → Skia wasm 이행 중, tile 캐시                                                   | 같은 계열 · 목표가 다름 (이행 vs 대칭 consumer)                                                  |
| 레이아웃            | CSS 기반 fill/fix/auto 모델 + CSS 번역, 자동 브라우저 대조군은 조사 범위에서 미확인  | 자체 Rust(Canvas) ↔ 브라우저 CSS(DOM) differential 검증 유지 · 번역 경계와 불일치 수정 사례 참고 |
| 디자인 토큰         | 적용 시 베이크 + 전파 패스, Tokens Studio 방언 · reflow 누락과 토큰 연결 소실은 별개 | 소비 시점 참조 유지 · 참조 보존 및 양 consumer 갱신 검증 · 외부 교환 시 DTCG 범위 명시           |
| 라이선스 · 사업     | MPL-2.0 코어 + 유료 Enterprise (admin · SSO · audit · AI allowlist)                  | 참고만                                                                                           |

# ADR-316 breakdown — frame 의 HTML 요소 칸 · Layers 이름 · 그룹 이름 · Section 삭제

> 본문: [316-frame-element-type-section-removal.md](../completed/316-frame-element-type-section-removal.md). 이 문서는 구현 뒤에 쓴 기록이다 — §2 · §3 은 구현된 모양, §4 는 실제로 돌린 검사다. 코드는 2026-11-24 작업 트리 (HEAD `34173e06f` + 미커밋) 기준.

## 1. 선행 결정과의 관계

기존 ADR 의 분리가 아니다 (fork 4 질문의 대상 아님). 닿는 결정만 적는다.

- **ADR-130 (frame = role 없는 layout 상자 · 그룹화 = frame)**: 그대로 따른다. `elementType` 은 요소만 바꾸고 role 을 쓰지 않는다. 그룹은 여전히 frame 이고 이름만 붙는다.
- **ADR-281 (frame 의 상속 flag · `locale`)**: 같은 계약 표 (`RULE_TYPE_PROP_CONTRACTS.frame`) 에 한 항목을 더한다. 상속 동작은 손대지 않는다.
- **ADR-142 · 248 (catalog 등록 · rule SSOT)**: Section 은 그 등록 경로에서 지운다. 새 spec · 새 type 없음.
- **ADR-304 (Proposed — App frame preset · 랜드마크)**: 응용 쪽이다. 304 의 실측 문장 둘 (「노드별 덮어쓰기 필드가 없다」 · 「Frame · Section 은 `div`」) 이 이 ADR 로 낡는다. 304 결정 3 (랜드마크 방식) 에 선택지가 하나 는다 — 본문 사용자 결정 1. 의존 방향: 316 (상자의 요소 칸) → 304 (그 칸을 쓰는 preset). 304 는 316 없이도 type 신설로 갈 수 있으므로 선행 조건은 아니다.
- **2026-11-11 속성 감사 (개발자용 HTML · ARIA 속성은 패널에 내지 않는다)**: 이 칸은 사용자가 직접 정한 예외다 (메모리 `project-frame-element-type-2026-11-24`).

## 2. 설계 (구현된 모양)

### 2.1 계약

| 항목    | 값                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prop    | `elementType` — `kind: "enum"` · `label: "HTML tag"` · `section: "accessibility"` · `default: "div"`                                                                          |
| 값      | `div` · `main` · `section` · `header` · `footer` · `nav` · `article` · `aside` (`CATALOG_FRAME_ELEMENT_TYPES` — `main` 은 2026-11-24 사용자 지적으로 추가)                    |
| 읽기    | `catalogFrameElementType(props)` — 목록 밖 · 없음 = `div`                                                                                                                     |
| 이름    | `catalogFrameLayerName(props)` — `div` 면 「Frame」, 아니면 태그. 위치의 유효 값으로는 builder `catalogRuntime/frameName.ts` `catalogFrameNameAt(graph, target)`              |
| D2 출처 | `CATALOG_D2_COMPOSITION_TYPES` 에 `frame` (binding 없는 rule-only type 이라 `CATALOG_D2_PROVENANCE` 의 type · key 표에는 넣을 수 없다 — 게이트가 primitive binding 만 받는다) |
| 문서    | `LIBRARY_CONTRACT_VERSION` 77 그대로                                                                                                                                          |

### 2.2 소비처

| 소비처                | 위치                                                                                                                | 읽는 것                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Preview · Publish DOM | `runtime/domBinding.runtime.ts` `bindings.frame`                                                                    | `element(catalogFrameElementType(node.props))`                                                                                                                                                                                                                                 |
| Canvas                | —                                                                                                                   | 읽지 않는다 (상자 값은 frame 의 것)                                                                                                                                                                                                                                            |
| Design 패널 칸        | `RULE_TYPE_PROP_CONTRACTS.frame` → `catalogRuntime/editContract.ts`                                                 | 계약 (generic field renderer — 새 UI 코드 없음)                                                                                                                                                                                                                                |
| Layers 행 이름        | `catalogRuntime/layerTree.ts` `nameOf`                                                                              | frame 이면 `catalogFrameShownName` (패널 제목과 같은 함수 — 그 위치의 유효 값, instance patch 포함), 그 밖은 `catalogNamedAt` (노드 이름 → slot 이름) → EmptyState → type. instance 안 frame 행은 `frameRows` (instance · 주소의 id → 행) 로 그 id 가 바뀐 step 에 다시 읽는다 |
| Design 패널 제목      | `panels/properties/catalog/CatalogPropertiesPanel.runtime.ts`                                                       | frame 이면 `catalogFrameShownName` (Layers 와 같은 순서 — 이름 → slot → 태그 → 「Frame」, 그룹 기본 이름 「Group」 은 `div` 가 아닌 태그에 양보), `useCatalogStepReading` 으로 step 마다                                                                                       |
| Code 보기             | `codeView/generate.ts` `writeNode` · template 자리                                                                  | 태그 = 요소, `elementType` 속성 생략, HTML 요소는 import 없음 (`HTML_ELEMENT_TAGS`)                                                                                                                                                                                            |
| 페이지 본문 요소      | `runtime/domBinding.runtime.ts` `ruleDom` (page root 의 body) → `runtime/pageMain.components.tsx` `CatalogPageBody` | `layoutBody` (본문이 레이아웃 정의의 instance — `catalogPageBodyIsLayout`) · `explicitMain` (본문 아래 record 에 `main` frame — `catalogPageHasMainFrame`, 첫 render 용) · 그려진 `main` frame 의 등록 (`CatalogMainFrame` → context)                                          |
| 그룹 명령             | `catalogRuntime/canvasMenu.ts`                                                                                      | 새 frame 에 `name: CATALOG_GROUP_FRAME_NAME` (「Group」 — `frameName.ts`)                                                                                                                                                                                                      |
| 유도 Do · AI catalog  | 계약에서 유도 (`referenceCapabilities` · `services/ai/catalog`)                                                     | 추가 코드 없음 — 유도 결과는 따로 확인하지 않았다                                                                                                                                                                                                                              |

### 2.3 문구

- `i18n/labels.ts` `"HTML tag": "properties.htmlTag"` · `messages/en-US.ts` 「HTML tag」 · `ko-KR.ts` 「HTML 태그」.
- 그룹 명령: 메뉴 `contextMenu.group` 「그룹화」 (`Group`) · 단축키 목록 `group` · `ungroup` 「그룹화 / 그룹 해제」 (`Group` / `Ungroup`) · `config/keyboardShortcuts.ts` description.

## 3. 파일 변경표

| 구분             | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 신규             | `packages/shared/src/catalog/document/frameElementType.ts` · `packages/shared/src/catalog/runtime/pageMain.components.tsx` · `apps/builder/src/builder/catalogRuntime/__tests__/frameElementType.test.ts` · `apps/builder/src/preview/catalog/__tests__/frameElementType.test.tsx` · `apps/builder/scripts/frame-element-type-live.mjs`                                                                                                                                                                                                 |
| 요소 칸          | `document/itemLinks.ts` · `document/d2Provenance.ts` · `runtime/domBinding.runtime.ts` · `codeView/generate.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 이름             | `catalogRuntime/frameName.ts` (신규) · `catalogRuntime/layerTree.ts` · `panels/properties/catalog/CatalogPropertiesPanel.runtime.ts` · `catalogRuntime/canvasMenu.ts`                                                                                                                                                                                                                                                                                                                                                                   |
| 문구             | `i18n/labels.ts` · `i18n/messages/en-US.ts` · `i18n/messages/ko-KR.ts` · `i18n/types.ts` · `config/keyboardShortcuts.ts`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Section 삭제     | 파일 삭제 2 — `catalog/bindings/Section.binding.ts` · `components/styles/generated/Section.css`. 등록 제거 — `componentCatalog.ts` · `bindings/index.ts` · `generated/componentRulesTable.ts` · `runtime/rulePaint.ts` · `domain/componentTraits.ts` · `document/s2PropAlignment.ts` · `types/composition-vocabulary.ts` · `components/styles/index.css` · builder `panels/components/paletteItems.ts` · `services/ai/catalog/componentCatalog.ts` · `panels/navigator/catalog/CatalogLayerIcon.tsx` · `types/builder/unified.types.ts` |
| 게이트 · fixture | `componentCatalog.test.ts` · `componentTraits.test.ts` (리터럴 3) · `generatedCssLoadInventory.static.test.ts` (136 → 135 · 118 → 117) · rendering `catalogCss.test.ts` (130 → 129) · `phase3G3Census.test.tsx` (193 → 192) · `phase3PaletteStorageRoundtrip.test.ts` (62 → 61) · `docs/adr/design/248-phase3-palette-old-replay.json` (Section 행 삭제) · `paletteOracle.ts` · `s2VariantRemoval.test.ts` · `phase4eOriginView.test.ts` · `adr279OriginOnLocalPage.test.ts` · `phase4eLayers.test.ts` (이름 「Frame」)                 |
| 옛 스크립트      | `apps/builder/scripts/s2-variant-removal-live.mjs` (Section 단계 제거 — 고친 뒤 실행하지 않았다)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 문서             | `docs/CHANGELOG.md` · `.claude/rules/ssot-hierarchy-context.md` §9                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 4. 기록 (2026-11-24)

### 4.1 단위 · 원복 RED (G1)

- 새 테스트 5 — 정의가 `elementType` 을 받음 · 목록 밖 값 = `div` / Layers 이름 순서 (이름 → 태그 → 「Frame」, Undo 포함) / 그룹 = frame + 이름 「Group」 / DOM 요소 7 값 · role · 속성 없음 / Code 보기 태그.
- 원복 RED 4/4 (변이 스크립트 — 변이 뒤 바이트 복원 확인): DOM 요소 고정 `div` · Layers frame 분기 끔 · 그룹 이름 삭제 · Code 보기 태그 고정.
- 회귀: shared 2762 · rendering 1814 통과, type-check 통과. builder 단위 전체 실행 (9848) 은 14 파일 실패 — 2 는 Section 개수 · fixture (수리), 12 는 시간 초과 · 무관해 보이는 단정 실패 (live Chrome 을 같이 돌린 부하로 추정) — 14 파일을 따로 다시 돌려 전부 통과. 전체 스위트는 그 뒤 다시 돌리지 않았다.
- `pnpm generate:css` — Section.css 다시 생기지 않음 · 다른 생성 파일 차이 0. `pnpm docs:stale-symbols` 0.

### 4.2 live (G2)

- `apps/builder/scripts/frame-element-type-live.mjs` 처음 7/7 → 리뷰 round 1 수리 뒤 11/11 (§4.3) — 본문 `### Live Exercise` 와 같다. 조건: headed Chrome (Playwright `channel: "chrome"`) · 1920 × 1100 · 새 프로젝트 · dev 서버 5173.
- oracle: Publish 의 실제 DOM (`tagName` · `getComputedStyle` · `getBoundingClientRect`) 과 Canvas record 값 · `getGeometry`. 요소별 상자 대조는 처음에는 없었고 (리뷰가 HC2 미검증으로 지적) §4.3 에서 넣었다.
- 불리한 경우: sectioning 요소 안 `h1` (옛 UA 가 줄이던 자리). Chromium 156 · WebKit 27.2 에서 `section` · `article` · `aside` · `nav` · `header` · `footer` 안 h1 = 32px (data URL 문서 실측).

### 4.3 리뷰 round 1 · 2 수리 (2026-11-24 — codex, MEDIUM 3 · 모두 production 재현 · HIGH 0)

- **m1 — instance 안 frame 의 이름**: 반례를 단위 테스트로 재현 (Calendar instance 의 frame 에 patch `elementType: header` → Layers 행 「Frame」, RED) → `catalogFrameNameAt` (위치의 유효 값) 을 Layers · 패널 제목이 같이 읽게 하고, Layers 는 `frameRows` 색인으로 그 step 에 다시 읽는다. 원복 RED 2/2 (step 색인 끔 · 유효 값 읽기 끔), Undo 로 이름이 돌아오는 것 포함. live 8 · 8b.
- **m2 — G2 가 선택 실패를 통과시킴**: 스크립트의 「실패하면 명령으로 쓰기」 를 없앴다 — 2a 가 패널 조작만 판정하고, 실패했을 때의 명령 쓰기는 뒤 항목의 준비일 뿐 2a 를 통과시키지 않는다. 리뷰의 반례 (없는 선택지) 를 실행용 사본으로 재현: 2a FAIL · 10/11.
- **HC2 미검증 지적** (이슈 아님 — 가설 1 + 반증 1): 가설 「sectioning 요소는 `div` 와 같은 상자다」, 반증 = 같은 내용의 frame 일곱의 상자 대조 (live 9). Canvas 일곱 1920 × 48 = Publish 일곱 1920 × 48 — GREEN.
- 수리 뒤: 단위 6 (frame 테스트 2 파일) · 관련 스위트 41 파일 413 통과 · type-check 통과 · live 11/11.

- **round 2 — m3 slot frame 의 패널 제목**: 수리 검증이 m1 · m2 를 fixed 로 적고 새로 찾은 것. 반례를 단위 테스트로 재현 (Popover 의 `content` slot frame 에 `elementType: header` → Layers 「content」 · 제목 계산 「header」, RED) → 이름 순서를 `frameName.ts` 한 곳 (`catalogNamedAt` — 노드 이름 → slot 이름, `catalogFrameShownName`) 으로 옮겨 Layers `nameOf` 와 패널 제목이 같이 읽는다. 원복 RED 1/1. live 10 (패널에서 header 선택 → 값 header · Layers 행 · 제목 「content」). 수리 뒤 단위 7 (frame 테스트 2 파일) · 관련 스위트 43 파일 429 통과 · type-check 통과 · live 12/12 (종료 코드 0).
- **종결 (실행자 선언)**: 판독 1 + 수리 검증 1, 두 round HIGH 0. round 3 을 열지 않는다. builder 단위 전체 스위트는 round 1 수리 뒤 다시 돌리지 않았다 (관련 스위트만).

### 4.4 번들 (G3 — 2026-11-24)

- 절차: 별도 worktree (`.cache/adr315-bundle/wt-p0` 재사용 — lockfile 동일 · 엔진 wasm 은 main 트리 것을 복사) 를 HEAD `aa182a2ac` 로 두고 일반 `vite build --manifest` (sourcemap 없음) → `adr209-bundle-closure.mjs` (builder `index.html` · preview `preview.html`) → 이 ADR 의 변경만 patch 로 얹어 (추적 43 파일 + 신규 2 — 다른 세션의 미커밋 `boxModel.ts` · `presence.ts` 는 뺐다, main 트리와 바이트 대조) 다시 빌드 → `adr201-bundle-gate.mjs`. 같은 기계 · 같은 worktree · 빌드 1 회씩.

| 항목                     | before    | after     | Δ    |
| ------------------------ | --------- | --------- | ---- |
| Builder initial JS gzip  | 1,643,130 | 1,643,334 | +204 |
| Builder initial JS raw   | 5,869,439 | 5,869,233 | −206 |
| Builder initial CSS gzip | 57,579    | 57,579    | 0    |
| Preview initial JS gzip  | 172,215   | 172,213   | −2   |
| Preview initial CSS gzip | 66,339    | 66,246    | −93  |

- 판정기 조건: `builderDelta` (≤ +4,096) · `previewDelta` (≤ +3,584) · `previewAbsolute` · upload 엔진 · FileUploadActive · AI 패널 · runCommand lazy · 같은 revision · 승인 · 만료 = 통과. `builderAbsolute` = 실패 — before (1,643,130) 에서도 실패하므로 이 변경의 결과가 아니다 (로컬 closure 값이 상한 1,435,351 을 기준선부터 넘는 것은 ADR-314 · 315 breakdown 에도 적혀 있다). 종합 `pass: false`.
- 배포 workflow (`deploy.yml` 의 「Initial bundle ceiling」) 의 절대 상한 결과는 확인하지 못했다 (`gh` 미인증 · push 전).
- **닫힘 (사용자 결정 2026-11-24 「G3 를 「증가량 통과」 로 닫아」)**: G3 = 증가량 · lazy 조건 통과. Builder 절대 상한의 로컬 초과는 이 ADR 의 범위 밖.

- **`main` 추가 (2026-11-24, 사용자 「main 은 기본적으로 포함되어야하지 않나?」)**: 목록 8 값. 단위 7 통과 (DOM 요소 · 목록) · type-check 통과 · live 12/12 (9 번 — 여덟 태그 상자 Canvas 1920 × 48 = Publish 1920 × 48, `<main>` 포함). 번들은 다시 재지 않았다 (목록 글자 하나).

### 4.5 페이지 본문 = main (2026-11-24 — 사용자 결정, 리뷰 뒤 범위 추가)

- 설계: 본문 요소는 DOM 층에서 정한다 (Canvas · 문서 · 엔진 무변경). `main` frame 이 자기 존재를 본문에 알리는 방식 (그려진 동안 context 에 등록) 이라 compositionRoot 의 파생 값 · 의존 갱신을 건드리지 않는다. 첫 render 는 본문 아래 record 를 한 번 훑은 답 (`explicitMain`) 으로 정해 페이지를 두 번 그리지 않는다. 등록 알림은 microtask 로 모은다 — 본문 요소가 바뀌면 하위가 다시 mount 되며 frame 이 빠졌다 들어오는데, 본문은 정리된 집합을 읽는다.
- 기각한 방식: 본문 record 의 파생 값 (`presence.ts` · `compositionRoot.ts` 의 의존 갱신 — 구조 변경까지 덮어야 하고 다른 세션이 고치는 파일) · 본문에 `div role="main"` (태그가 아니다 · 수동 ARIA) · 본문에 자기 태그 칸만 두기 (frame 을 main 으로 고르면 중첩).
- 검사: 단위 `frameElementType.test.tsx` 「the page body is <main>」 — 기본 `MAIN` · frame 을 main 으로 → 본문 `DIV` · main 1 · frame 을 section 으로 → 본문 `MAIN` · 레이아웃 적용 → 본문 `DIV` · main 0. live 11 (Publish 두 번 열기 — main frame 있음: 본문 div · main 1 / 없음: 본문 main · main 1, 중첩 0). live 전체 13/13. 원복 RED 3/3 (본문을 늘 `div` · main frame 에 양보 안 함 · 레이아웃 무시). 구현 뒤 builder 단위 전체 1,173 파일 9,848 통과 · shared 통과 · type-check 통과.
- 하지 않은 것: 레이아웃 페이지의 content 자리 main (ADR-304) · Code 보기 (본문은 `<Page>` 표기 그대로). 번들은 §4.7 에서 쟀다.

### 4.6 그룹 기본 이름은 태그에 양보 (2026-11-24 — 사용자 보고 수리)

- 보고: 「button 2개를 group화 후 tag를 nav로 변경시 nav로 나타나지않고 group로 유지된다」. 원인: 그룹 명령이 붙이는 노드 이름 「Group」 이 사용자 이름과 같은 자리 (`catalogNamedAt`) 에서 읽혀 태그보다 앞섰다.
- 수리: `catalogFrameShownName` — 노드 자기 이름이 그룹 기본 이름 (`CATALOG_GROUP_FRAME_NAME`) 이고 그 위치의 태그가 `div` 가 아니면 태그를 보인다. 노드 이름은 쓰지 않는다 (문서 무변경 — `div` 로 되돌리면 다시 「Group」). Layers `nameOf` 도 frame 은 이 함수 하나를 읽는다 (패널 제목과 두 벌이던 순서를 합침). 사용자가 「Group」 을 직접 적은 경우도 같은 규칙이다 — 구분할 표시를 문서에 두지 않았다.
- 검사: 단위 `frameElementType.test.ts` 「a group set to an element is named by the element」 (수정 전 RED — `['Group']` ≠ `['nav']`, 수정 뒤 통과: nav → 「nav」 · div → 「Group」 · 직접 적은 이름은 태그보다 앞). live 12 (그룹을 패널에서 nav → Layers 행 · 패널 제목 「nav」, div → 「Group」). live 전체 14/14 · type-check 통과.

### 4.7 커밋 뒤 확인 (2026-11-24 — 사용자 「ADR-316 에서 하지 않은 것 시작해」)

- **번들 Δ**: 기준 `aa182a2ac` · 이후 `66416a794` 를 같은 worktree (의존성 차이 0 · 엔진 소스 차이 0 — 엔진 wasm 은 복사) 에서 일반 `vite build` (`VITE_USE_WEBGL_CANVAS=true` · `VITE_FEATURE_FILL_V2=true`) → `adr209-bundle-closure.mjs`. initial JS gzip — Builder 1,643,131 → 1,643,337 (**+206**) · Preview 172,215 → 172,212 (**−3**) · Publish 277,987 → 277,989 (+2). CSS Builder 0 · Preview −93. ADR-201 Δ 상한 (+4,096 · +3,584) 안.
- **배포 workflow 의 절대 상한** (2026-11-25 재측정): gh-pages 마지막 배포 = 11-03 `c826549b4` (Builder 1,411,980 ≤ 그때 상한 1,414,000 — 로컬 측정 방식이 CI 와 같다). 첫 초과 = `bbca53c78` (1,421,465) — 배포는 그때부터 멈췄다. 큰 단일 증가는 `792815efc` (+34,637, RAC 이름 글자 조회) 이고 나머지는 기능 코드에 퍼져 있다 (이분 탐색 · sourcemap 모듈 대조). 사용자 재승인으로 상한 1,650,000 + RAC 정적 조회 (−14,487) — ADR-201 재승인 절 · CHANGELOG 2026-11-25. 이 ADR 의 몫은 +206 B.
- **유도 Do · AI catalog**: AI catalog 의 `frame` 항목 = `elementType: div|main|section|header|footer|nav|article|aside` · 기본 `div` (`formatCatalogEntry` 실행) · `Section` 항목 없음. 유도 Do 층 (`deriveReferenceCapabilities`) 은 primitive binding 만 읽고 (`catalogAccepts`) `frame` 은 native 라 `setElementType` 같은 Do 가 없다 — frame 의 Do 는 개념 파일 것 (상속 flag · locale) 그대로다. 태그를 실행 중에 바꿀 이유가 없어 그대로 둔다.
- **⌘G · 한국어 문구** (`apps/builder/scripts/frame-group-shortcut-ko-live.mjs`, `composition-locale` ko-KR): 캔버스 focus 뒤 ⌘G → frame 「Group」 이 둘을 품음 · Layers 행 「Group」 · Layers 우클릭 메뉴 「그룹화 ⌘G」 · ⌘⇧G 그룹 해제 · 머리 메뉴 검색 「그룹」 → 「그룹화 ⌘G」 · 「그룹 해제 ⌘⇧G」 · page error 0. Chrome 6/6 · WebKit 6/6. (앞 스크립트의 키가 캔버스에 닿지 않았던 것은 캔버스 컨테이너에 focus 를 주지 않아서였다 — `canvas-focused` scope.)
- **WebKit 전체**: `frame-element-type-live.mjs` 에 `BROWSER=webkit` 선택을 넣어 14/14 (Chrome 과 같은 판정 — 9 번 여덟 태그 상자 · 3 번 `section` 안 h1 32 · 700 포함).
- 남은 것 없음 (ADR-304 의 레이아웃 페이지 content main · Code 보기의 `<Page>` 표기는 이 ADR 범위 밖).

## 5. 범위 밖

- 목록에 `main` 추가 · ADR-304 랜드마크 흡수 — 본문 사용자 결정 1.
- `nav` 태그 frame 에 현재 경로 표시 — Nav 컴포넌트의 기능이다.
- 팔레트 라벨 대문자화 — 팔레트는 모든 항목이 소문자다.

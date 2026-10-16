# Canvas Rust 판정 측정 (4단계) — 2026-10-16

> **작성일**: 2026-10-16
> **위상**: Canvas 성능 계획 4단계. 1 ~ 3단계 (스냅 `3384c3a3d` · [ADR-263](../../adr/completed/263-render-command-patch-execute-cost.md) · [ADR-264](../../adr/completed/264-moved-subtree-translate-page-grid-rebind.md) · [ADR-265](../../adr/completed/265-document-layer-edit-select-cost.md)) 뒤 Rust 착수 trigger 를 1만 노드 이상 · headed 환경에서 다시 판정한다. trigger 가 성립하면 새 ADR (ADR-921 은 되살리지 않는다).
> **코드**: HEAD `a6ce961a4` (측정 대상 코드 = ADR-265 후속 `45026d1d8` 까지)
> **원자료**: `.agent/runs/2026-10-16-rust-decision/` (local-only)
> **관련 메모리**: `project-canvas-rust-baseline-2026-10` · `project-adr265-document-layer-closed-2026-10`

## 1. trigger 판정

| trigger                                          | 근거 (§2 · §3)                                                                                                                                                                                                                                   | 판정                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 그리기 명령 실행 > 8 ms/frame (60Hz 예산의 절반) | 합성 1만: dev `render.skia.record.content` p95 — 평평 줌 0.9 · drag 2.0 ms, 중첩 줌 2.4 ms (미충족). **실사용 형태 문서 (§4)**: dev 줌 record p50 46.6 · **p95 193 ms**, production 줌 gap p95 213 ms · long task 13 회 — dev 만의 부담이 아니다 | **충족** (실사용 형태 줌) |
| 경계 비용 (JSON 직렬화 · 2-pass) 이 CPU 상위     | production 프로필 (이름 복원 엔진 포함) 에서 JS ↔ wasm 경계는 `rewrap` 0.5 % · 엔진의 문자열 값 해석 (`str::trim_matches`) 1.1 % 뿐. 엔진 쪽 상위는 Rust **안의** 레이아웃 계산 (§3) — 경계가 아니다                                             | 미충족                    |
| geometry 소유를 한 곳으로 모으는 기능 요구       | 열린 ADR 은 245 (AI 패널) 하나. ADR-916 2-D 는 「이관 대상 제외 — 구조적 분리 불가」 로 닫혀 있고 다시 연 요구가 없다                                                                                                                            | 미충족                    |

**결론**: trigger 1 이 실사용 형태 문서의 줌에서 성립한다 → 계획대로 새 ADR 의 몫이다 (ADR-921 은 되살리지 않는다). 다만 그 비용의 정체 (§4) 는 Rust 경계 · 엔진이 아니라 JS 그리기 층의 캐시다 — 노드 picture 캐시 상한 (1,024) 보다 많은 요소를 매 기록마다 다시 그리고, 글자 paragraph 를 매번 다시 만든다. 새 ADR 의 대안에 Rust 이관을 넣더라도, 측정은 캐시 · 후퇴 조건의 수정이 먼저임을 가리킨다. trigger 2 · 3 은 미충족. 합성 1만에서 새로 보인 엔진 비용 (§3) 은 이미 Rust 안의 알고리즘이다.

**재판정 (2026-10-17 — [ADR-266](../../adr/completed/266-draw-cache-thrash-real-document-zoom-edit.md) 종결 뒤)**: 캐시 thrash (page grid 재바인드 · picture 상한 · paragraph 재생성 · viewport 후퇴 · 처음 줌아웃의 첫 기록) 를 고친 뒤 `app-pages` 줌 — dev `record.content` p50 46.6 → 4.4 ~ 4.6 · p95 193 → **10.6 ~ 11.3 ms** (picture · 글자 기록 0, 남은 것은 줌아웃 화면의 picture 재생 1,600 개 내외), production gap p95 213 → 16 ~ 19 ms · long task 13 ~ 17 → **0** (headless · headed). trigger 1 은 dev 재생 몫으로 8 ms 경계선 위에 남지만 production 에서 long task 가 사라졌고, 남은 프로필 상위는 JS 의 작은 자리 여럿 (옮기기 검사 3.9 % · 명령 실행 2.8 % · page header 배치 3.6 %, idle 68 %) 이다. JS ↔ wasm 경계 · 엔진 · CanvasKit wasm 은 상위에 없다 (각 1 % 내외) → trigger 2 · 3 미충족 그대로, **Rust 이관 ADR 을 열 근거 없음**. 다음에 trigger 1 을 다시 볼 자리는 picture 재생 수 (요소 단위 picture → 묶음 · 타일 — ADR-266 대안 B) 이고, 그것도 Rust 와 무관한 JS 그리기 층의 선택이다.

## 2. 측정 조건 · 결과

- 하니스: `perf-baseline.mjs --lane frame`, 부류 zoom · edit · drag · select · select-spread · hover · marquee (부류당 3 초).
- 문서: 합성 시드 — 평평 (`mixed`, 요소 10,000 개가 page body 의 absolute 자식) · 중첩 (`nested-flex`, 카드 500 × 20 노드 ≈ 1만, 깊이 6). **실사용 문서 아님** (§4).
- 빌드: dev (5173) · production (`perf:build-dist`, `--serve-dist`). headless = 60Hz SwiftShader, headed = 실제 GPU · 120Hz 디스플레이. 모든 run visibility `visible`, 콘솔 · 페이지 오류 0.

production · headed (120Hz — 프레임 예산 8.3 ms) gap p95 / p99 ms · drop %:

| 부류          | 평평 1만          | 중첩 1만          |
| ------------- | ----------------- | ----------------- |
| zoom          | 9.3 / 9.3 · 0     | 9.2 / 9.4 · 0     |
| edit          | 9.4 / 43.1 · 3.9  | 12.9 / 19.3 · 0   |
| drag          | 11.8 / 13.4 · 0.8 | 11.8 / 12.1 · 0.3 |
| select        | 24.0 / 27.8 · 3.5 | 15.9 / 21.7 · 0.6 |
| select-spread | 22.6 / 27.0 · 3.1 | 17.4 / 22.3 · 0   |
| hover         | 9.7 / 15.5 · 0    | 9.7 / 10.4 · 0    |
| marquee       | 10.1 / 10.5 · 0   | 9.6 / 10.1 · 0.3  |

production · headless (60Hz) 는 같은 순위 — 평평 1만 edit p99 58.1 · drop 7.2 %, select drop 11.7 %, 나머지 부류 drop ≤ 2.2 %.

남은 끊김의 소속 (production 프로필 상위):

- **select** — RAC 컬렉션 (`BaseCollection.getItem` · `useGridListItem`) · React DOM (`propagateContextChanges`) · 메뉴 명령. JS 패널 층이라 Rust 와 무관 (ADR-265 HC3 꼬리 그대로).
- **marquee** — React commit · passive effect 정리가 25 ~ 35 % (선택 상자 집합 교체). 프레임 gap 은 예산 안.
- **평평 edit** — §3.

## 3. 새로 보인 비용 — 엔진 absolute 자식 재배치

엔진 wasm 은 이름이 지워진 빌드라 `wasm-function[9]` 로만 보인다 (production 평평 1만 edit 8.6 % 로 1 위). 같은 소스를 `CARGO_PROFILE_RELEASE_STRIP=none` 으로 빌드해 ratchet worktree 에서 dist 를 따로 만들어 (메인 작업 트리 무변경 · worktree 엔진 파일은 복원 + cmp) 다시 쟀다.

평평 편집 (production headless, 같은 빌드):

| 요소 수 | edit gap p95 / p99 | drop  | `LayoutTree::place_absolutes_in` 비중 |
| ------- | ------------------ | ----- | ------------------------------------- |
| 5,000   | 23.6 / 28.0        | 4.6 % | 2.8 %                                 |
| 10,000  | 32.1 / 45.3        | 7.2 % | 5.4 %                                 |
| 20,000  | 74.6 / 88.1        | 7.1 % | 15.0 %                                |

- `tree.rs` `place_absolutes_in` 은 부모가 다시 배치될 때 그 부모의 absolute 자식 목록 **전부** 를 돈다 — 형제 전체로 static position 을 구하고 (`children.clone` + 순회), 자식마다 `absolute_shrink_to_fit_width` · `solve_node` 를 부른다. 평평 시드는 1만 요소가 전부 body 의 absolute 자식이라 요소 하나의 편집이 body 재배치 → 1만 자식 순회가 된다. 변경 없는 자식이 `solve_node` 의 incremental skip (dirty · `last_avail`) 으로 얼마나 빠지는지는 **미확정** — 엔진 카운트로 가른다.
- 비중이 요소 수보다 빠르게 는다 (2 배마다 1.9 배 → 2.8 배). 원인 (자식당 비용이 무엇에 비례하는지) 은 미확정.
- 같은 프로필의 다른 상위 (`storage` 4 %, `compositionRoot.deliver` 3.5 %, `graph.getDefinition` 3 ~ 4.5 %) 는 JS 문서 · 저장 층이다.
- 판정 영향: 이 비용은 **이미 Rust 안** 에 있어 trigger 2 (경계) 가 아니다. 고치는 자리는 엔진의 absolute 재배치 skip (변경 없는 자식은 이전 배치 재사용) 이다.

## 4. 실사용 형태 문서 (`app-pages`)

07-30 기준선의 실문서는 사용자가 지워서 없다. 사용자 지시 (2026-10-17 「원하는 만큼의 page 와 element 를 만들어라」) 로 사용자 프로젝트 (`/builder/9168f5be-…`) 에 사람이 만드는 사이트 · 앱 모양의 문서를 만들고, 같은 생성기를 하니스 fixture `app-pages` (`apps/builder/scripts/perfAppFixture.mjs`) 로 넣어 같은 문서를 격리 프로필에서 다시 만들었다 — 두 쪽 모두 22 페이지 · 문서 노드 3,317 · Canvas record 5,116 (07-30 실문서 5,069 요소 · 23 페이지와 같은 급).

- 구성: 마케팅 (Home · Pricing · About · Help) · 블로그 (목록 · 글 3) · 쇼핑 · 문의 · 가입 · 앱 (Dashboard · Analytics · Users · Projects · 상세 · Settings · Billing · 알림) · 문서 2 · 컴포넌트 모음. flex 중첩 뼈대 + 팔레트 원본 instance 36 종 (Button · TextField · Select · TableView · Tabs · Disclosure · Calendar · TagGroup …) 을 팔레트 삽입 경로로 놓았다. 글자는 seed 고정 단어 조합 (긴 문단 포함).
- 한계: 사람이 만든 문서가 아니라 사람이 만드는 **모양** 을 흉내 낸 생성물이다 (measurement-validity Q1 — 분포 지표로 인용하지 않는다). instance 의 버튼 · 링크 글자는 기본값 그대로다.
- 드라이버 대상 (`seedIds`): Home 의 hero · feature 카드 (편집 = 카드 폭) · nav 링크 (drag = 메뉴 순서) · 인용 · 가격 카드.

gap p95 / p99 ms · drop % (부류당 3 초, 모든 run visibility `visible` · 오류 0):

| 부류                          | dev (60Hz)          | production headless | production headed (120Hz)         |
| ----------------------------- | ------------------- | ------------------- | --------------------------------- |
| zoom                          | 205 / 243 · 25 %    | 213 / 246 · 23.5 %  | 221 / 245 · 26.4 % (long task 17) |
| pan                           | 17.4 / 17.6 · 0     | 17.7 / 36 · 2.2 %   | 9.2 / 57.5 · 2.5 %                |
| edit                          | 17.4 / 20.5 · 0     | 37.5 / 40.4 · 8.7 % | 54 / 62.4 · 5.4 % (long task 15)  |
| drag                          | 18 / 40.7 · 1.6 %   | 17.7 / 25.3 · 1.6 % | 9.8 / 9.9 · 0.8 %                 |
| select                        | 30.6 / 36.8 · 9.2 % | 17.7 / 22.5 · 0.5 % | 11.7 / 19.1 · 0                   |
| select-spread                 | 36.1 / 43.4 · 12 %  | 18.9 / 22.8 · 0.5 % | 13.6 / 19.2 · 0                   |
| hover · marquee · page-switch | ≤ 19 · 0            | ≤ 18 · 0            | ≤ 10 · 0                          |

줌의 정체 (dev 카운트, 줌 64 프레임 · content 기록 21 회):

- 노드 picture 캐시 hit 344 · **miss 28,791 (전부 `cold`)** — 기록마다 ~1,370 개를 새로 그린다. 상한 `MAX_NODE_PICTURES = 1024` (`nodePictureCache.ts`) 보다 많아, 한 번 기록하는 사이에 앞에서 그린 picture 가 밀려난다 (LRU).
- paragraph 캐시 hit **0** · miss 21,312 — 글자 paragraph 를 기록마다 다시 만든다. production 줌 프로필 상위가 글자 측정 · paragraph (`canvas2dSegmentCache.getOrMeasureWidth` 7 ~ 8 % · `renderText` · `runTextStyle` · CanvasKit) 와 명령 순회 (`visitElement` · `executeCommandRange`) 다.
- ADR-263 의 viewport 공간 질의 경로는 21 회 모두 후퇴 (`viewportFallbacks 21` · `viewportSequences 0`) — 후퇴 조건 (`damageUnsafeElementIds` · 후보 × 2 > 요소 수 …) 중 어느 것인지는 미확정.
- 편집도 같은 캐시를 탄다 — production 편집 프로필 1 위가 `evictLeastRecentlyUsed` (3 ~ 7.7 %, 상한마다 1,024 entry 선형 스캔).
- 합성 1만 (§2) 에서 줌이 멀쩡했던 것은 그리는 요소 · 글자 종류가 적어 상한 안에 들었기 때문으로 보인다 — 합성 격자는 이 비용을 가렸다 (measurement-validity #6 유리한 경우만 측정).

원인 가설 (picture 상한 → 퇴거 → paragraph 재생성) 과 viewport 후퇴의 조건은 새 ADR 의 Phase 0 에서 카운트로 확정한다.

→ **[ADR-266](../../adr/completed/266-draw-cache-thrash-real-document-zoom-edit.md) (2026-10-17 Proposed)**. ADR 작성 때 같은 run 의 카운트를 다시 읽으니 위 가설 앞에 한 자리가 더 있다 — 줌의 자동 열 수 변경에서 ADR-264 의 page root 옮기기가 후퇴해 `rebind("page-grid")` 가 기록 21 회 중 15 회 (`rebindPageGrid` 15 · `pageGridMovedRoots` 292 · `pageGridResized` 0 · `translateCalls` 0), 재등록 (`registerSkiaNode`) 이 picture · paragraph 를 전부 버린다. 상한 thrash 는 재바인드가 없던 6 회에서도 성립한다 (hit 344). 두 몫은 ADR-266 Phase 0 이 가른다.

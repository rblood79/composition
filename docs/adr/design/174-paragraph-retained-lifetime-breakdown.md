# ADR-174 Design Breakdown — Paragraph 수명 retained 전환

> 본문: [174-paragraph-retained-lifetime.md](../174-paragraph-retained-lifetime.md)

## §1 전제 lock-in

- **신규 주제 ADR** (기존 ADR fork/분리 아님) — fork 4 질문 게이트 비해당.
- 사용자 confirm 기록: 2026-07-30 AskUserQuestion — "ADR 작성 후 구현 (권장)" 선택. 배경 지시: "단순한 눈가리기식 처리를 원하는게 아니다 완성도가 더 중요하다" (폐기 지연 단독안 기각, 구조 수리 채택).
- **ADR-173 재시도 선결 조건과의 관계**: §되돌림 기록의 선결 조건 3개는 전부 컬링 반경(Phase 1) 거래 대상. 본 ADR 은 반경 불변(200) 이므로 비해당. 선결 조건 3("가시 텍스트 수가 paragraph 캐시 상한을 넘는지 확인")은 본 ADR 이 상한 개념 자체를 제거해 구조적으로 해소한다.
- 문제 정의 정본: `docs/explanation/research/BUILDER_FRAME_DROP_BASELINE_5K.md` §8 (잠재 결함 — 문턱 변수/기제/실측 경계/현행 상태), Pen 대조 정본: `PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md` §3-4-1.

## Phase 0 — 메모리 축 실측 (inventory freeze, G1)

실측 항목:

1. 5,069 요소 / 23 페이지 문서의 **텍스트 draw 노드 총수** (페이지별 분포 포함) — walk 계측 또는 canonical 문서 텍스트 노드 집계.
2. **paragraph 1개당 WASM 힙 비용** — N개 생성 전후 heap delta / N. 대표 텍스트 3종 (짧은 라벨 / 문단 / 긴 목록 항목) 각각.
3. **retained 총량 프로젝션 2종**: (a) 전 페이지 보유 시 (b) 가시(walk) 페이지 한정 보유 시.
4. `nodePictureCache` 현행 수명 지도 — 동반 폐기 지연 대상 확인 (49d71dbd3 이 양쪽을 수정했던 계보).
5. **중복 계수** — 고유 paragraph 캐시 키 수 vs 텍스트 노드 수 (컬렉션 페이지 포함). 현행 캐시는 content 키 (`nodeRendererText.ts:130` — processedText+layoutMaxWidth+font 축, 노드 id 미포함) 라 동일 텍스트·스타일이 노드 간 **공유**된다 — per-node retained 는 이 dedup 을 소실하므로, 계수가 높으면 (프로젝션이 G1 상한 초과) Phase 2 에서 content-키 refcount 공유 variant 로 분기 (2026-07-31 리뷰 round 1 M1).
6. **프레임 중 delete 지점 전수** (Phase 1 큐 경유 대상 목록화, 2026-07-31 리뷰 round 1 M2): ① 퇴거 (`nodeRendererText.ts:82-86`) ② same-key 교체 시 `existing.delete()` (`nodeRendererText.ts:73-77`) ③ **fontMgr 변경 일괄 clear** — `renderText` 내부에서 즉시 delete (`nodeRendererText.ts:97-100` → `clearParagraphCache` 46-52). ③ 은 retained 전환 후에도 invalidation 축으로 남는다 (§Phase 2).

산출: G1 통과 수치 + 스코프 정책 확정 (§Phase 3). 추정 vs 실측 gap 발견 시 본 Phase 안에서 inventory 보강으로 흡수 (adr-writing M3 — fork 사유 금지).

### 실측 결과 (2026-07-31 — **G1 미통과 · 픽스처 한정**)

> **측정 대상이 대표성이 없다 (2026-07-31 사용자 확인).** 사용된 5,069 요소 문서는 "Button / Home / About / Contact" 같은 **소수 텍스트를 복제해 요소 수만 부풀린 합성물**이다. 따라서 여기서 나온 **중복 계수 21.2× 는 문서의 성질이 아니라 픽스처의 성질**이며, 이 수치로 소유 모델이나 스코프 정책을 정할 수 없다. ADR Context 가 이미 "필러 문서 경계 수치는 실문서로 일반화 불가" 라고 적어 둔 바로 그 함정에 같은 세션에서 다시 빠진 것이다 — 필러의 종류(고유 문자열 bench ↔ 복제 합성)만 바뀌었을 뿐이다.
>
> 아래는 **픽스처 무관 사실**(계측 도구 / 단가 / delete 지점 / 수명 지도 / 측정 함정)과 **픽스처 종속 수치**(노드 수 · 고유 키 수 · 중복 계수 · 프로젝션)를 구분해 남긴다. 후자는 재측정 전까지 어떤 결정의 근거로도 쓰지 않는다.

계측 도구는 본 Phase 에서 신설했다: `nodeRendererText.ts` 가 `getCacheMetrics("paragraph")` 로 hit/miss/eviction/size 를 다른 캐시와 같은 `__composition_CACHE_METRICS__` 채널에 싣고, `__composition_PARAGRAPH_DEBUG__.census` 가 walk 당 draw 수 / 고유 캐시 키 수 / 고유 노드 수를 센다 (dev 전용). paragraph 는 유일하게 계측 채널이 없던 캐시였고, 그것이 상한 스래싱이 조용히 진행된 이유이기도 하다.

측정 대상은 기준선 §1 과 같은 문서 (5,069 요소 / 23 페이지). 측정 중 `window.__composition_NODE_PICTURE_CACHE__ = false` 로 picture replay 를 껐다 — **replay 는 record 된 Picture 안에서 텍스트를 재생하므로 `renderText` 를 지나지 않는다**. 이 토글 없이는 walk 수치가 실제보다 작게 잡힌다 (측정 함정).

| #   | 항목                  | 값                                                                                                                   |   유효성    |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------- | :---------: |
| 2   | paragraph 단가        | 짧은 라벨 ≈ **20 KB** (5,000개 증분 기울기), 4문장 문단 ≈ 160 KB (600개 성장 이벤트 — allocator slack 포함 **상한**) | 픽스처 무관 |
| 4   | nodePictureCache 수명 | delete 지점 4종 — 아래 표 (3종이 프레임 중)                                                                          | 픽스처 무관 |
| 6   | 프레임 중 delete      | paragraph 3 지점 + nodePicture 3 지점 — 아래 표                                                                      | 픽스처 무관 |
| 1   | 텍스트 draw 노드 총수 | 3,372 (10% 줌 walk = 23 중 ~20 페이지)                                                                               | 픽스처 종속 |
| 5   | 고유 캐시 키          | 159 → 중복 계수 21.2×                                                                                                |  **무효**   |
| 3   | retained 프로젝션     | per-node 67 MB / content-키 3.2 MB — #5 파생이라 함께 무효                                                           |  **무효**   |

**소유 모델 — 결정 철회, ADR 본문의 채택안(per-node retained)으로 복귀**. 중복 계수 21× 를 근거로 content-키 공유를 확정했던 판정은 픽스처 산물이므로 무효다. 실문서에서 텍스트는 화면마다 달라 중복도가 1 에 가깝고, 그러면 두 모델의 **메모리는 사실상 같다** — 공유가 사는 유일한 구간이 이 합성 픽스처였다.

게다가 방향 자체가 틀렸다. 본 ADR 이 고치려는 병은 **content 키에 자연스러운 사망 시점이 없다**는 것이다. 키는 내용에서 파생되므로 "이 키가 더는 필요 없다" 를 아무도 알려주지 않고, 그래서 구현이 둘 중 하나로 몰린다 — **상한**(→ 퇴거 → 프레임 중 폐기 → 지금 이 버그) 또는 **refcount**(→ 1:N 소유 · 드래그 churn 지연 판정 · 재취득 취소 규칙). 노드 소유는 그 질문 자체를 없앤다: **paragraph 수명 = 노드 수명**, 노드가 죽을 때 같이 죽는다. Pen 이 전역 LRU/상한/퇴거를 하나도 두지 않고 노드 필드로 소유하는 이유가 이것이다 (`PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md` §3-4-1 — `dirtyParagraph` 재생성과 `destroy()` 폐기 두 경로뿐).

**1:N 문제도 소유자를 바꾸면 소멸한다** — 소유자는 element 가 아니라 **텍스트 `SkiaNodeData` 객체**다. `specShapeConverter.ts:817` 이 spec text shape 마다 별도 노드를 만들므로 (한 element 가 여러 텍스트를 그리는 경우가 여기서 갈린다) 노드 : paragraph 는 정확히 1:1 이고, invalidate 신호(`registerSkiaNode` data identity 변경)가 곧 소유자 교체 신호다. 앞서 기록한 "1:N 양방향 집합 + 해제 지연 판정" 은 content-키 공유안에서만 필요한 장치이므로 함께 철회한다.

**남은 미지 (재측정 대상)** — 절대 보유량이다. `보유 paragraph 수 × 단가` 이고, 보유 수의 상한은 **텍스트 draw 노드 수**(중복도 1 가정)다. 이 수는 문서에 달렸으므로 **대표성 있는 실문서**에서 다시 재야 한다. 계측 도구(census: draws / uniqueKeys / uniqueNodes)는 그대로 쓰고, 함께 볼 것은 ② 드래그·리사이즈 시 노드 객체 identity 가 프레임마다 바뀌는지 (바뀌면 per-node 소유가 매 프레임 재생성 — Phase 2 가 반드시 확인할 축).

**프레임 중 `.delete()` 전수** (Phase 1 큐 경유 대상):

| 자원        | 지점                                                         |   시점    |
| ----------- | ------------------------------------------------------------ | :-------: |
| paragraph   | LRU 퇴거 `nodeRendererText.ts:174`                           | 프레임 중 |
| paragraph   | same-key 교체 `nodeRendererText.ts:161`                      | 프레임 중 |
| paragraph   | fontMgr 교체 일괄 clear `nodeRendererText.ts:189` → `:85`    | 프레임 중 |
| nodePicture | volatile 노드 폐기 `renderCommands.ts:1375`                  | 프레임 중 |
| nodePicture | fontMgr 세대 전량 폐기 `renderCommands.ts:904`               | 프레임 중 |
| nodePicture | LRU 퇴거 `storeNodePicture` → `evictLeastRecentlyUsed`       | 프레임 중 |
| nodePicture | register/unregister·registry clear `useSkiaNode.ts:47/54/75` | 프레임 밖 |

**부수 관측 — nodePicture 스래싱**: 세션 누적 스냅샷에서 hit 40,125 / miss 289,667 / **eviction 281,125** (상한 1,024, 적중률 12%). 텍스트 노드만 3,372 인 문서에서 1,024 상한은 구조적으로 부족하다. 상한 조정 자체는 본 ADR scope 밖 (변경하지 않음) 이지만, **프레임 중 폐기가 paragraph 와 같은 형태로 존재**하므로 Phase 1 의 지연 폐기는 두 자원을 함께 덮는다 (G3 계약 테스트도 양쪽).

**주의 — WASM 힙은 되돌아오지 않는다**: 측정 중 emscripten 힙이 1,139 → 1,331 MB 로 늘고 `.delete()` 후에도 줄지 않았다 (emscripten 은 페이지를 OS 에 반납하지 않는다). 따라서 G4 의 "메모리 live 증가분" 판정은 힙 크기 절대값이 아니라 **동시 보유 paragraph 수 × 단가** 기준으로 한다.

**측정 함정 3종** (재측정 시 반복 주의):

1. **hidden 탭 rAF 정지** — `document.hidden === true` 면 rAF 가 멈춰 스크립트로 페이지를 바꿔도 프레임이 0 이다. 실입력(스크롤/클릭)만 프레임을 낸다. 스크립트만으로 walk 을 유도하면 전 항목이 0 으로 나온다.
2. **HMR 모듈 중복** — 편집 직후 HMR 상태에서는 debug 전역과 렌더 경로가 다른 모듈 인스턴스를 잡아 수치가 어긋난다. 계측 코드 변경 후에는 **전체 새로고침**.
3. **picture replay 우회** — 위 토글 미적용 시 텍스트 draw 가 renderText 를 지나지 않는다.

## Phase 1 — 안전 폐기 프리미티브 (deferredDisposal)

- `deferredDisposal.ts` 재작성 (`49d71dbd3` 계보): 프레임 중 발생하는 모든 paragraph / nodePicture `.delete()` 를 큐 적립 → `SkiaRenderer.render()` finally 에서 drain (**flush 후**).
- 프레임 밖 삭제 (unmount / 명시 clear) 도 동일 단일 진입점 경유 — 호출 지점이 프레임 여부를 판단하지 않게.
- **hidden 탭 rAF 정지 대비** (`reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`): render finally 외에 unregister 일괄 경로에서도 drain — flush 가 오래 없어도 큐가 무한 적체하지 않게.
- 계약 테스트: 폐기 지연 5종 (원 커밋 계보 복원) + 큐 적체 상한 1종.

## Phase 2 — retained 소유 전환 (G2 RED→GREEN, G3)

- paragraph 소유를 전역 LRU → **skia node 단위**로: 소유자 = **텍스트 `SkiaNodeData` 객체**(`specShapeConverter.ts:817` 이 spec text shape 마다 하나씩 만든다 — 노드 : paragraph 1:1), invalidate 신호 = `registerSkiaNode` 의 data identity 변경 (기존 registryVersion bump 과 동일 지점) → rebuild + 구 paragraph deferred delete. **소유자를 element id 로 잡지 말 것** — 한 element 가 여러 텍스트를 그리므로 1:N 이 되어 둘째 텍스트가 소유자를 잃는다.
- `nodeRendererText.ts` 조회 경로: 전역 cache lookup → node-owned lookup 교체. miss 시 생성 후 노드에 부착 (lazy — 현행과 동일하게 첫 draw 시 생성).
- **측정기 경로 불변**: `canvaskitTextMeasurer` 의 "WASM Paragraph 객체 캐싱 금지, 결과값 {width,height} 만 LRU" 계약 (canvas-rendering.md §3) 은 그대로 — 본 전환은 **렌더 측 paragraph 한정**.
- **invalidation 축은 둘**: ① 노드 data identity 변경 (텍스트/스타일 — `registerSkiaNode`) ② **fontMgr 변경** — retained paragraph 는 생성 시점 fontMgr 에 종속되므로 (`renderText` 의 `getLastParagraphFontMgr() !== fontMgr` 분기가 현행 전량 clear 근거), fontMgr 교체 시 전 노드 retained paragraph 를 일괄 무효화 + deferred 폐기. 프레임 중 즉시 clear (현행 `nodeRendererText.ts:97-100`) 재생산 금지 (2026-07-31 리뷰 round 1 M2).
- **소유 모델 = per-node retained (ADR 본문 채택안 · Pen 동형)**. 한때 "content-키 refcount 공유 확정" 으로 적었으나 그 근거(중복 계수 21.2×)가 합성 픽스처 산물이라 **철회**했다 (§Phase 0 실측 결과 상단 주의). 되돌아온 이유는 메모리가 아니라 **수명**이다 — content 키는 내용 파생이라 "더는 필요 없다" 를 알려 줄 주체가 없어 상한(→ 퇴거 → 프레임 중 폐기 = 본 ADR 이 고치는 병) 또는 refcount(→ 소유 집합 · 재취득 취소 규칙) 를 강제한다. 노드 소유는 그 질문을 없앤다.
- 전역 LRU 는 본 Phase 동안 fallback 플래그로 공존 — cutover 검증(G2/G3/G5) 후 Phase 3 에서 제거.

### Phase 2 가 반드시 확인할 축 — 노드 객체 identity 의 교체 빈도

per-node 소유의 유일한 실패 모드는 **소유자가 너무 자주 교체되는 것**이다. `registerSkiaNode` 의 data identity 가 이동/리사이즈처럼 텍스트와 무관한 변경에서도 프레임마다 새 객체로 바뀐다면, 텍스트가 그대로인데도 paragraph 가 매 프레임 폐기·재생성된다 (현행 content 키 캐시는 이 경우 hit 이라 비용 0 — 즉 **회귀**). 착수 시 먼저 잴 것:

- 드래그/리사이즈 1초 동안 텍스트 노드의 `registerSkiaNode` 호출 수와 그 중 **텍스트 내용·스타일이 실제로 바뀐 비율** (계측은 Phase 0 census 확장으로 충분).
- 교체가 잦다면 대응은 refcount 도입이 아니라 **소유자 판정을 노드 객체 identity 대신 텍스트 서브키(content+layout)로 좁히는 것** — 즉 "노드가 들고 있되, 텍스트 축이 안 바뀌면 기존 paragraph 를 넘겨받는다". 상한도 전역 저장소도 되살리지 않는다.
- `nodePictureCache` 가 같은 identity 키로 이미 살아 있으므로(`dataRef`), 그 캐시의 hit/miss 비율이 이 축의 1차 프록시다 — Phase 0 관측에서 nodePicture miss 가 압도적이었던 것이 "identity 가 자주 바뀐다" 의 신호일 수 있다 (다만 그 관측은 상한 1,024 퇴거와 섞여 있어 분리 측정 필요).

#### 답 (2026-07-31 구현 · live 실측) — identity 는 안정적이고, 위험은 다른 곳에 있었다

**노드 identity 는 이미 안정화돼 있다.** `StoreRenderBridge.registerBuiltNode` 가 `skiaNodeContentEqualsIgnoringPosition` 으로 내용을 deep 비교해 **같으면 기존 객체를 유지하고 x/y 만 동기화**한다 (ADR-153 Phase 3 — 노드 Picture 캐시 키를 지키려고 도입된 장치). 즉 이동·드래그는 소유자를 교체하지 않는다. 우려하던 실패 모드는 선행 ADR 이 이미 막아 둔 상태였다.

대신 **소유자를 어디에 둘 것인가**에서 함정 둘이 나왔고, 둘 다 이 안정화 장치와의 상호작용이었다:

| 함정                                                                                                                                                               | 증상                           | 처방                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------- |
| 슬롯이 **열거 가능**하면 `Object.keys` 비교에 걸린다 — "보유한 prev" 와 "미보유 new" 가 영구 불일치                                                                | 노드가 매 프레임 교체 → 재생성 | 심볼 키 + `non-enumerable` (`Object.defineProperty`)      |
| `renderCommands` 는 DRAW 커맨드마다 `{...node, x:0, y:0, children:undefined}` **파생본**을 만든다 (`emitDrawCommands` / `emitInternalChildDraw`) — 소유자가 파생본 | 커맨드 재빌드마다 소유권 증발  | `linkParagraphOwner(derived, origin)` 로 원본 노드에 고정 |

두 번째는 **live 계측이 아니었으면 못 잡았다** — 단위 테스트는 전부 GREEN 인데 실측이 `hit 0 / miss 24` 였다. 고친 뒤 같은 페이지에서 `hitRate 66.67%` = 첫 walk 만 miss(1,331), 이후 2 walk 전량 hit(2,662), eviction 0, 재생성 0.

**부수 관측 — nodePicture 가 hit 이면 텍스트 walk 자체가 없다.** replay 가 `renderText` 를 우회하므로 paragraph 재생성 압력은 nodePicture miss 구간에만 걸린다. 측정할 때는 `__composition_NODE_PICTURE_CACHE__ = false` 가 필요하다 (측정 함정 3종에 이어 4번째).

- G2 절차: 전환 **전** `VITE_PARAGRAPH_CACHE_SIZE=50` + 줌 왕복으로 소실 RED 재현 기록 → 전환 후 동일 절차 GREEN.
  - **이 문서로는 재현 불가 (2026-07-31 실측)**: 구 LRU 경로로 되돌려 같은 페이지를 walk 시키면 **고유 키 147** (1,331 draw → content 키 dedup) 로 상한 1,000 에 한참 못 미친다. 문턱 초과가 성립하지 않으므로 상한을 낮춘 별도 서버 절차가 그대로 남는다.
  - 같은 실측이 **보유 단위의 차이**를 확정한다 — retained 는 **노드** 단위(1,331), LRU 는 **키** 단위(147). 상한 1,000 은 키 수에 걸리므로 "retained 수가 상한을 넘었다" 는 스래싱 근거가 되지 않는다 (착수 직후 그렇게 잘못 읽었다가 정정).
  - 이 픽스처는 중복도가 높아(1,331 draw / 147 키 ≈ 9배) **retained 에 가장 불리한 문서**다. 실문서는 중복도가 1 에 가까워 두 모델의 보유 수가 수렴한다 — 이 9배는 상한이지 예상치가 아니다.

#### G2 실행 결과 (2026-07-31) — 문턱 초과 조건 A/B

**절차 조정**: 상한 50 으로는 문턱을 못 넘겼다 (기본 시드 문서의 고유 키 33). 절차의 본질은 숫자가 아니라 **고유 키 > 상한** 이므로 양쪽 서버를 `VITE_PARAGRAPH_CACHE_SIZE=20` 으로 띄워 33 > 20 을 만들었다. RED 는 worktree 로 `fed7e1838` 을 5175 에, GREEN 은 HEAD 를 5174 에 (사용자의 5173 은 무관하게 유지). 두 서버 모두 **같은 기본 시드 문서**(Components/Home)를 새 프로젝트로 생성해 조건을 맞췄다.

| 측정 (Components 페이지 1 walk, `__composition_NODE_PICTURE_CACHE__=false`) |            RED `fed7e1838` |       GREEN HEAD |
| --------------------------------------------------------------------------- | -------------------------: | ---------------: |
| evictions                                                                   |                     **33** |            **0** |
| hitRate                                                                     |                      5.71% |         **100%** |
| hits / misses                                                               |                     2 / 33 |           70 / 0 |
| 보유                                                                        | cacheSize 20 (상한에 갇힘) | retainedCount 35 |

RED 는 **한 walk 에서 33회 퇴거** = 프레임 중 WASM `.delete()` 33회로, 기제 ①(문턱 초과 스래싱)과 ②(프레임 중 폐기)가 동시에 성립하는 상태다. GREEN 은 상한 개념이 없어 퇴거 0 · 재사용 100%.

**시각 소실은 RED 에서 확증하지 못했다.** 소실은 퇴거된 paragraph 의 WASM 주소가 같은 프레임 안에서 재사용될 때만 나타나는 확률적 사건이고, 원 버그는 walk 텍스트 draw **1,416** 규모에서 관측됐다. 이 기본 시드 문서는 35 draw / 33 키라 주소 재사용 압력이 두 자릿수로 작다. 따라서 **G2 는 "스래싱 조건의 A/B" 로는 통과, "소실 재현" 으로는 미통과**로 남긴다 — 후자는 텍스트 draw 가 1,000 을 넘는 대표 문서가 있어야 한다 (G1 재측정과 같은 전제).

**부수 — Home 페이지 시드 실패 (기록)**: 관찰용으로 `store.addElement` 를 40회 호출해 고유 텍스트를 만들었으나 ① Skia 레지스트리에 등록되지 않고(registry 증가 0, draws 0) ② 새로고침 후 IndexedDB 에 1개만 남았다. 메모리 `reference-bulk-seeding-live-builder-via-page-context` 의 per-add persist 폭주 함정과 같은 계열이며, 대량 시드는 `mergeElementsCanonicalPrimary` 배치 커밋 경로가 필요하다. 이 시드 경로는 본 ADR scope 밖이라 우회하지 않고 실패로 기록한다.

- **절차 정정 (Phase 1 반영)**: Phase 1 이 프레임 중 폐기(기제 ②)를 이미 제거해, HEAD 에서는 상한을 낮춰도 소실이 재현되지 않을 수 있다. 그때 RED 는 **Phase 1 이전 커밋**(`fed7e1838`)에서 잡아 기록하고, HEAD 의 무재현 자체를 Phase 1 의 효과 증거로 병기한다. 무재현을 이유로 절차를 생략하지 않는다 (G2 실패 분기).
- `VITE_PARAGRAPH_CACHE_SIZE` 는 `import.meta.env` 라 서버 재시작이 필요하다. 사용자의 5173 dev 서버를 건드리지 말고 **별도 포트로 띄운다** (`VITE_PARAGRAPH_CACHE_SIZE=50 pnpm dev --port 5174`).

## Phase 3 — 스코프 정책 적용 + LRU 제거

- **스코프 확정 보류 (2026-07-31 철회)** — "≈3.2 MB 라 전 페이지 보유" 판정은 무효 픽스처 수치(고유 키 159) 파생이라 함께 철회한다. 재측정 후 결정한다.
  - 판정식은 유지: 보유 바이트 ≈ **보유 paragraph 수 × 단가(짧은 라벨 ≈20 KB)**, 보유 수의 상한은 텍스트 draw 노드 수. 대표성 있는 실문서에서 이 수를 재면 곧바로 "소/대" 가 갈린다.
  - per-node 소유에서 보유 수는 **살아 있는 텍스트 노드 수**와 같다 — 즉 스코프 정책은 "노드를 언제까지 등록해 두는가" 와 같은 질문이 되고, 이미 `clearSkiaRegistry`(페이지 전환)가 그 경계를 갖고 있다. 새 퇴거 기제를 만들기 전에 이 기존 경계로 충분한지부터 본다.
- 전역 `paragraphCache` (상한 1,000) 제거 + `VITE_PARAGRAPH_CACHE_SIZE` env 제거 (`nodeRendererState.ts:14-21`).
- **규칙 갱신**: canvas-rendering.md §3 의 "WASM Paragraph 객체 캐싱 금지 (메모리 누수)" 문구를 "측정 경로 한정. 렌더 측은 노드 소유 retained + deferred 폐기 (ADR-174)" 로 정정 — 현행 문구는 측정기 맥락인데 렌더 측 전역 LRU 존재와 이미 불일치했다.

## Phase 4 — 검증 (G4/G5) + 종결

- G4 성능 비회귀: 기준선 문서 §1 경로 전부 (유휴 / 팬 집합 불변 / 팬 집합 변경 / 스크롤 / 줌 / 편집) frame gap 재측정. **불리 경로 + 프레임 총비용 의무 포함** — 기준선 §6 게이트 설계 제약 (`feedback-perf-gate-favorable-case-only-measurement` 3실패 재생산 금지).
- G5 live exercise: 실문서에서 ① 텍스트 편집 → 즉시 반영 (stale 0) ② 페이지 전환 왕복 ③ 줌 15%↔100% 왕복 ×2 — 전 텍스트 유지 스크린샷.
- 종결: CHANGELOG (Bug Fixes — Why 포함) + 기준선 문서 §8 상태 갱신 (잔존 → 수리) + README 승격.

## 파일 변경 (예상 — Phase 0 에서 freeze)

| 영역      | 파일                                                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skia 렌더 | `nodeRendererText.ts` (조회 경로), `nodeRendererState.ts` (상한 제거), `SkiaRenderer.ts` (drain 지점), `deferredDisposal.ts` (신규), `nodePictureCache.ts` (지연 폐기), `useSkiaNode.ts` (부착·invalidate 지점) |
| 테스트    | `deferredDisposal.test.ts` (신규 5+1종), `paragraphRetained.test.ts` (신규 — dirty rebuild / unregister 폐기 / stale 방지), 기존 skia 스위트 갱신                                                               |
| 규칙      | `.claude/rules/canvas-rendering.md` §3                                                                                                                                                                          |
| 문서      | `BUILDER_FRAME_DROP_BASELINE_5K.md` §8, `docs/CHANGELOG.md`, `docs/adr/README.md`                                                                                                                               |

## 선차단 체크리스트 대응 (adr-writing seed)

- **코드 경로 3+ 인용**: `nodeRendererText.ts:80-85` (퇴거 + 즉시 delete), `nodeRendererState.ts:14-21` (고정 상한 + env), `SkiaRenderer.render()` finally (drain 지점), `useSkiaNode.ts registerSkiaNode` (data identity 변경 = invalidate 신호).
- Generator/Spec 확장 아님 — 해당 없음 (D3 스키마 불변).
- BC 없음 — 렌더 내부 자원 수명. 스키마/props/저장 포맷 불변.

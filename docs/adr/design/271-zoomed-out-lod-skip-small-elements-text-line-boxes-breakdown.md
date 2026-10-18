# ADR-271 design breakdown — 축소 개요 LOD (생략 · 줄 상자)

> 본문: [../completed/271-zoomed-out-lod-skip-small-elements-text-line-boxes.md](../completed/271-zoomed-out-lod-skip-small-elements-text-line-boxes.md). 이 문서가 Phase · 파일 · 검증의 정본이다. 실측 결론은 §기록에. 코드 인용은 HEAD `94c9a0d52`.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 분리가 아니다. ADR-153 (picture 캐시) · ADR-174 (paragraph 소유) · ADR-263 (viewport · damage 실행 · unsafe 집합) · ADR-266 (줌 중 재기록 0) 이 base 이고, 이 ADR 은 그 실행 경로에 **배율 입력과 tier 판정**을 더하는 응용이다. Pen.dev 비교 확정 4 건의 둘째 — ADR-270 (이미지) · 272 (범위 제한) · 273 (메모리) 와 파일이 겹치는 곳은 `renderCommands.ts` 실행 옵션뿐 (272 는 질의 · 미리 기록, 이 ADR 은 요소 판정 — 같은 함수의 다른 줄).
2. **schema**: 문서 · 저장 schema 변경 0. `RenderCommandExecutionOptions.lod` (`zoom` · `band`) · picture 키의 `band` (Canvas 내부). 하니스 부류 `zoom-ladder` · 옵션 `--zoom` 재사용 · `counts.render.lod*`.
3. **선행 전제 reverse 검증**: ADR-266 「줌 중 picture 재기록 0」 은 유지된다 — 생략은 키 없이 재생 지점에서 끝나고 (기록 0), 글자 band 는 이산 띠 (상한 기준 상태) 라 band 경계 통과 때만 1 회 기록. ADR-263 의 unsafe 집합 · damage 후퇴 규칙은 그대로 읽기만 한다. ADR-269 property node (scroll) 와 무관 (tier 는 명령이 아니라 실행 옵션).
4. **판독**: 사용자가 요청할 때 `/review-adr 271`. phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 투영 크기 분포 · 기준 카운트 (G0)

- **하니스** (`perf-baseline.mjs`): 기존 `--zoom` (`:25` — 0.1 = 22 페이지 전부) 으로 `app-pages` `zoom` 부류를 `--zoom 0.1` · `0.25` 에서 2 회. 새 부류 `zoom-ladder`: 0.1 → 0.15 → 0.25 → 0.5 → 1 → 0.5 → … 왕복 (tier 경계 통과 수를 안다).
- **카운터** (`renderCounters.ts`, dev 전용): `lodProjectedBuckets` (요소 투영 최대 변 ≤ 0.5 · 1 · 2 · 4 · 그 이상 — content full 기록 1 회 기준) · `lodTextBuckets` (`fontSize × zoom` 같은 구간) — 생략 · 줄 상자의 **몫**을 가설이 아니라 분포로 본다. 기존 `nodePicture.hits` · `drawCalls` · `execVisited` 가 기준선.
- **ratchet**: run 키는 `runKeyOf(options)` = `seedCount:fixtureKind` (`perf-ratchet-gate.mjs:533 ~ 540`) 라 **`--zoom` 이 키에 없다** — 기본 줌 run 과 `--zoom 0.1` run 이 같은 `60:app-pages` 로 합쳐진다. Phase 0 이 먼저 `runKeyOf` 가 `options.zoom` (기본값이 아닐 때) 을 `60:app-pages@0.1` 로 붙이게 하고, **`harnessArgsFrom` (`perf-ratchet-gate.mjs:544 ~ 558`) 이 비기본 `--zoom` 을 저장 args 에 직렬화**하게 고친다 (r1 M4 — 지금은 fixture · classes 만 넣어 pre-push `--run` 이 기본 배율로 재측정해 @0.1 기준에 대입한다). 등록 뒤 `perf-ratchet-run.mjs` 재실행 결과의 `options.zoom` 이 run 키와 같은지 unit (파일 표). 등록은 `--add-run 60:app-pages@0.1=<a.json>,<b.json>` (`parseSeedFiles` `<seed>=<frame.json>` 형식, `:515 ~ 522`) · `--add-keys … --keys caches.nodePicture.hits,render.drawCalls,render.execVisited`.
- **go/no-go**: 임계 아래 (≤ 0.5 px) 요소 + 2 px 미만 글자가 `--zoom 0.1` 에서 전체의 5 % 미만이면 레버의 몫이 없다 → 사용자 결정 3. 5-질문 답을 §기록에.

## 2. Phase 1 — 배율 입력 · 생략 (G1 · G2 · G3)

> **2026-10-18 범위 변경 (사용자 「생략 빼고 글자만」 — §6 Phase 0)**: 이 절의 **생략** · 서브트리 요약 · unit (a) ~ (c) · (g) 는 구현하지 않는다 (Phase 0 몫 0). 남는 것: 배율 전달 · `resolveLodBand` · damage 동일 band · unit (d) (e) (f).

- **배율 전달** (`SkiaRenderer.ts:762` 근처 · `canvasScene.ts` `contentNode` · `renderCommands.ts:2420`): renderer 가 프레임마다 `lod = { zoom: camera.zoom, band: resolveLodBand(camera.zoom, prevBand) }` 를 정해 content full · viewport · damage 실행 옵션에 같은 객체를 넘긴다. `resolveLodBand` 는 히스테리시스 (B, 제안 ±10 %) 를 가진 순수 함수 (unit).
- **생략** (`renderCommands.ts:2556 ~ 2561` `CMD_ELEMENT_BEGIN`, `!cmd.visible` jump 바로 뒤): `zoom < Z_full` 일 때만 — `projected = max(cmd.width, cmd.height) × zoom`; `projected < T_skip` 이고 stream 의 **서브트리 요약** `lodSubtree.get(id)` 가 `{ unsafe: false, hitUnion }` 이며 `hitUnion` 의 투영도 `< T_skip` 이면 `subtreeEndOf` 로 jump. 요약은 stream build (`visitElement` 가 자식 재귀를 끝낸 자리 — `renderCommands.ts:1803 ~ 1831`) 와 splice (`applyCommitSubtreeCommandPatch` — 조상 체인 재계산) 에서 만든다: `unsafe` = 자손 (document 자식 포함) 중 하나라도 `damageUnsafeElementIds` (`:1606 ~ 1609` 는 요소 자신만 넣는다) · `textPaintOverflowIds` · 글자 범위 미확정 (`hasTextPaintOverflow` 미판정) — damage 경로가 요소마다 검사하는 조건 (`subtreeCommandPatch.ts:593 ~ 601`) 을 조상에 전파한 것. `boundsMap` (레이아웃 상자) · `getSubtreeDamageBounds` (hit 합집합) 는 paint 범위가 아니므로 단독으로 쓰지 않는다 (r1 H2). **갱신 지점** (r2 M2): 글자 넘침은 build 때 모른다 — `textPaintOverflowIds` 는 모듈 집합 (`renderCommands.ts:2385`) 이고 기록 끝 (`:2956`) · 미리 기록 반영 `applyWarmTextPaint` (`:2398`) 에서만 바뀐다. 요약을 `{ unsafeStatic, undeterminedText, overflowText, hitUnion }` 로 두고, 그 두 지점에서 owner 의 조상 체인 (`subtreeBuildContextByElement.get(id).parentElementId` — `:810`) 을 따라 `undeterminedText` (−1) · `overflowText` (±1) 를 갱신한다. 생략은 `unsafeStatic = false ∧ undeterminedText = 0 ∧ overflowText = 0 ∧ 투영 < T_skip` 일 때만 — 갱신 없이는 글자를 가진 모든 서브트리가 영원히 미확정이라 생략 0 (HC3 의 몫이 사라진다). 카운터 `lodSkippedElements` · `lodSkipBlockedUnsafe`. drag 서브트리 · 편집 중 노드 (`editingId`) · export 호출 (`options.lod` 없음) 은 분기 자체가 없다.
- **damage 동일 tier**: `executeDamageRenderCommands` (`:2261`) 에 같은 `lod` 옵션 — renderer 가 content 와 damage 를 같은 프레임에 같은 tier 로 호출 (R2).
- **unit (G2)**: (a) 투영 0.4 px 요소 생략 · 0.6 px 유지 · (b) 작은 부모 + 큰 overflow 자식 → 부모 서브트리 유지 · (c) unsafe (그림자) 요소 유지 · (d) damage 뒤 픽셀 = 같은 tier full 재기록 (SW surface 스냅샷) · (e) zoom 1 에서 `lodSkippedElements` 0 · 분기 미진입 (호출 카운트) · (f) 히스테리시스 왕복 진동 0 · (g) 글자 서브트리: 기록 전 생략 0 → 기록 뒤 (넘침 없음) 생략 → 넘침이면 생략 0 · 미리 기록이 확정한 넘침도 첫 재생 뒤 같은 결과. 원복 RED: paint bounds → 상자 크기로 바꾸면 (b) RED · band 공유 제거 → (d) RED · 조기 탈출 제거 → (e) 호출 카운트 RED · 확정 시 조상 갱신을 빼면 (g) 「기록 뒤에도 생략 0」 RED.
- **ratchet (G3)**: `--zoom 0.1` `nodePicture.hits` · `drawCalls` 상한 ↓ · zoom 1 `edit` · `hover` · `pan` 이내 · `lodTierChanges` = 사다리 경계 통과 수.
- **live (G1)**: `apps/builder/scripts/adr271-lod-live.mjs` — LOD ↔ `setLodOff` content 스크린샷 차 (채널 delta 히스토그램 · 차이 픽셀 비율) 사다리 5 배율 + R1 배치 2 + Preview 같은 배율 1 장 (사용자 결정 1 자료).

## 3. Phase 2 — 글자 줄 상자 (G1 · G3)

- **분기** (`nodeRendererText.ts:419 ~ 448` `drawParagraphBox`): `fontSize × bandUpper(options.lod.band) < T_text` 이면 (band 가 `full` 이면 분기 없음 — 실배율 `zoom` 은 생략 판정에만 쓰고 글자 분기에는 쓰지 않는다, r1 H1 · r2 M1) paragraph 의 `getLineMetrics()` 로 줄마다 `drawRect(left, baseline − ascent × k, width, lineHeight × h)` — 색 = 글자색 (presentation color 경로 그대로), 알파 · 높이 비율은 사용자 결정 2 (B). 그림자 · 장식은 생략 (상자 하나).
- **band 와 picture 키** (`nodePictureCache.ts:173` 조회 · `:206` 저장): 요소 상태의 입력은 카메라 배율이 아니라 **band 상한** (`bandUpper`) — 글자 part 는 `fontSize × bandUpper < T_text` 면 줄 상자. 같은 band 안에서는 배율이 움직여도 상태가 같으므로 hit 가 옛 표현을 재생하지 않는다 (r1 H1 — `renderCommands.ts:3020 ~ 3039` hit 경로는 재기록이 없고, `nodeRendererText.ts:448` 분기는 miss 때만 그림에 들어간다). 키 = `getCachedNodePicture(id, dataRef, w, h, band)` — 그 band 에서 줄 상자가 되는 글자가 있는 요소만 (self span 안 내부 text 전부 검사) band 를 넣고, 나머지는 `full` 로 정규화 → 키 분기 0. **band 전환**: 옛 band 의 entry 는 해제하지 않는다 — 캐시는 id 당 entry 1 개 (`nodePictureCache.ts:191` 조회 · `:207` 저장은 기존 entry 교체) 라 band 가 다른 entry 는 miss 이고 다음 기록이 교체한다 (2 벌 공존 · 퇴거 없음 — r2 L3; ADR-266 상한 `touched × 1.25` 도 그대로). **미리 기록 차례 재시작**: `nodePictureWarmup` 의 pass 키에 band (`:81 ~ 91` 초기화 · `:140 ~ 146` 완료 판정은 stream · revision 뿐 — r1 M3) · source 에 현재 band 보관 · `warmNodePicture(ck, stream, id, fontMgr, band)` (`renderCommands.ts:3061`) 가 같은 키로 — `hasNodePicture` (`nodePictureCache.ts:283`) 도 band 를 비교해 옛 band entry 를 「없음」 으로 보고 다시 기록한다. ADR-272 의 카메라 셀 키와 같은 자리 (둘 다 pass 키의 성분). unit: (a) 같은 band 안 두 배율에서 글자 picture hit · 경계 통과에서만 재기록 · (b) 줌 왕복 뒤 `cache.size ≤ touched × 1.25` · 퇴거 0 · id 당 entry 1 개 · (c) band 전환 뒤 idle 에 새 band 로 화면 밖 글자가 다시 기록됨 (`pictureWarmRecorded > 0`) · (d) textbox band 에서 warm 뒤 content 조회 hit. 원복 RED: 키에서 band 를 빼면 (a) RED · pass 키에서 band 를 빼면 (c) RED.
- **unit**: 2 px 미만 글자가 줄 수만큼 rect · 2 px 이상은 paragraph · 글자 없는 노드의 picture 는 tier 전환에도 hit 유지 · export 는 paragraph. 원복 RED: 키에서 band 를 빼면 「band 전환 뒤 글자 picture 가 옛 band 로 재생」 unit RED.
- **G1-b**: 사다리 live 에 글자 많은 Docs 페이지 추가.

## 4. 종결 (G4 · G5)

- G4 production 짝 — `app-pages` `zoom` (기본 · `--zoom 0.1` · ladder) · `edit` 회귀 0. G5 live 사용자 판정 (축소 화면 명암 vs Preview). 문서: Status · README · CHANGELOG (사용자-가시: 전체 보기 반응성) · 메모리 (허용 오차 결정).

## 5. 파일 (예상)

| 영역   | 파일                                                                                                                                                                                                                         | 변경                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 실행   | `skia/renderCommands.ts` · `skia/SkiaRenderer.ts` · `catalogRuntime/canvasScene.ts`                                                                                                                                          | `lod` 옵션 · 생략 분기 · tier 결정 · damage 동일 tier                                                                                     |
| 글자   | `skia/nodeRendererText.ts`                                                                                                                                                                                                   | 줄 상자 분기                                                                                                                              |
| 캐시   | `skia/nodePictureCache.ts` · `skia/nodePictureWarmup.ts`                                                                                                                                                                     | 키 band (`getCachedNodePicture` · `hasNodePicture`) · pass 키 band · 미리 기록 band 전달                                                  |
| stream | `skia/renderCommands.ts` (build 1803 ~ 1831) · `subtreeCommandPatch.ts`                                                                                                                                                      | 서브트리 요약 `lodSubtree` (unsafe 전파 · 미확정 · 넘침 글자 수 · hit 합집합) — splice 와 넘침 확정 (`:2956` · `:2398`) 때 조상 체인 갱신 |
| 카운터 | `skia/renderCounters.ts`                                                                                                                                                                                                     | `lodProjectedBuckets` · `lodSkipped*` · `lodTextBoxes` · `lodTierChanges`                                                                 |
| 하니스 | `scripts/perf-baseline.mjs` · `scripts/perf-ratchet-gate.mjs` (`runKeyOf` · `harnessArgsFrom` zoom) · `scripts/perf-ratchet-run.mjs` (재실행 options 대조 unit) · `scripts/adr271-lod-live.mjs` (신규) · `perf/ratchet.json` | `zoom-ladder` · run 키 `@zoom` · args 직렬화 · oracle                                                                                     |
| 테스트 | `skia/__tests__/` · `catalogRuntime/__tests__/`                                                                                                                                                                              | G2 (a) ~ (f) · 글자 4 · 원복 RED                                                                                                          |

## 6. 기록

### Phase 0 — 투영 크기 분포 · 기준 카운트 (2026-10-18, 사용자 `/execute-adr 271` — G0 통과 · go (글자만))

**구현 (dev 전용 · 동작 변경 0)**: `renderCounters.ts` `lodProjLe0_5 · Le1 · Le2 · Le4 · Gt4` (요소 투영 최대 변 `max(w, h) × zoom`) · `lodTextLe0_5 … Gt4` (self span 안 글자 `fontSize × zoom`) — content **full** 기록이 picture 로 지나간 요소 (`drawSelfSpanViaPicture`, LOD 가 건너뛸 바로 그 단위) 에서 센다 (`countLodShare`). 배율은 `SkiaRenderer` 가 full 기록 직전 `renderScope.zoom` 에 준다. 하니스 부류 `zoom-ladder` (`setCamera` 로 0.1 → 0.15 → 0.25 → 0.5 → 1 → 0.5 → 0.25 → 0.15 왕복, 단계마다 8 tick). ratchet: `runKeyOf` 가 `--zoom` 을 `@zoom<z>` 로 (DPR 앞) · `harnessArgsFrom` 이 `--zoom` 을 직렬화 — unit 「저장 args → `parseArgs` → 같은 배율 · 같은 run 키」 (r1 M4. 계획의 `perf-ratchet-run.mjs` 대조 unit 은 게이트가 저장 args 를 하니스에 그대로 넘기므로 `parseArgs` 왕복으로 갈음). unit `adr271LodShare.test.ts` 3 (구간 경계 · 글자/요소 분리 · 배율 배선) · gate · 하니스 node 테스트 36 PASS · type-check 0.

**측정** (`--fixed-inputs`, headless 60Hz · 1440 × 900 · DPR 1 · dev 5173, 2 회 — 카운트 같음, 다른 것은 B 인 `cdp.RecalcStyleCount` 하나):

| 조건 (부류)                            | picture 재생 (`nodePicture.hits`) | `execVisited` | 요소 투영 ≤ 0.5 / ≤ 1 / ≤ 2 / ≤ 4 / > 4 | 글자 투영 ≤ 0.5 / ≤ 1 / ≤ 2 / ≤ 4 / > 4 | 2 px 이하 글자 |
| -------------------------------------- | --------------------------------- | ------------- | --------------------------------------- | --------------------------------------- | -------------- |
| `app-pages` `--zoom 0.1` `zoom`        | 52,977                            | 215,527       | 30 / 0 / 189 / 3,716 / 49,042           | 0 / 0 / 12,093 / 23,142 / 2,796         | 31.8 %         |
| `app-pages` `--zoom 0.1` `zoom-ladder` | 16,324                            | 64,999        | 6 / 0 / 180 / 1,312 / 14,826            | 0 / 0 / 3,954 / 6,535 / 1,209           | 33.8 %         |
| `app-pages` `--zoom 0.25` `zoom`       | 48,952                            | 190,303       | 14 / 0 / 222 / 3,317 / 45,399           | 0 / 0 / 12,161 / 18,802 / 4,556         | 34.2 %         |
| `app-pages` 기본 배율 `zoom`           | 44,909                            | 174,183       | 14 / 0 / 222 / 3,286 / 41,387           | 0 / 0 / 12,161 / 16,333 / 4,158         | 37.2 %         |

(`zoom` 부류는 휠 ±30 왕복이라 시작 배율에서 더 축소 · 확대한다 — 분포는 그 왕복 전체 합.)

**5-질문**: Q1 `app-pages` 는 합성 — 분포 인용 금지 (규칙) → **사용자 프로젝트 「123」 (22 페이지, Chrome MCP · DPR 2 · visible, 같은 카운터 · `forceFull` 1 회 · 카메라 (40, 80) — 측정 뒤 원래 카메라로 복원)** 로 대조: 줌 0.1 — 재생 1,589 · 요소 투영 0 / 0 / 46 / 198 / 1,345 · 글자 0 / 0 / **1,171** / 33 / 0 (2 px 이하 97 %) · 0.15 — 요소 ≤ 2 px 0 · 글자 2 px 이하 42 / 871 (5 %) · 0.25 · 0.5 · 1 — 둘 다 0. Q2 불리 = 임계 바로 위 배율 (0.15) 의 몫이 급감 — 기록. Q3 대조군 = 같은 run 의 LOD off (Phase 1 이후). Q4 배율 배선 unit (정적) · 「123」 측정의 `cam` = 요청 배율. Q5 분포의 oracle = 사용자 문서 (외부).

**go/no-go**: 0.5 px 이하 요소는 두 문서 모두 5 % 미만 (0.1 % · 0) → **생략 레버는 no-go**. 2 px 이하 글자는 줌 0.1 에서 32 % (합성) · 97 % (사용자) → **글자 레버 go** (줌 ≤ ~0.14 구간 한정 — 14 px 글자의 2 px 경계 = 0.143). 범위 변경 = 결정 지점 ④ → **사용자 답 (2026-10-18) 「생략 빼고 글자만」**: Phase 1 = 배율 · band 를 content · damage · 미리 기록에 같은 값으로 전달 (R2 · R7 · R8 유지), 생략 판정 · `lodSubtree` 요약 (r1 H2 · r2 M2) · 카운터 `lodSkipped*` 는 넣지 않는다. Phase 2 그대로.

**ratchet**: run `60:app-pages@zoom0.1` (`zoom` · `zoom-ladder` — A 184 · 183 / B 4) · `@zoom0.25` (`zoom` — A 184 / B 4) 를 `--add-run` 으로 등록 · `--judge` 초과 0. 기존 run 에는 `lodProj*` · `lodText*` 가 새 키로 들어온다 (경고만).

### Phase 1 · 2 — band 전달 · 글자 줄 상자 (2026-10-18 — 구현 · 측정 뒤 되돌림, 사용자 결정 3 「측정 기록 종결」)

**구현했던 것 (되돌림 — 커밋하지 않았다)**: `skia/lodBand.ts` — band 상한 `[0.125, 0.16, 0.2, 0.25]` · 히스테리시스 ±5 % · 줄 상자 판정 `fontSize × band 상한 < 2 px` (r1 H1 — 실배율이 아니라 band 상한). renderer 가 프레임마다 band 하나를 정하고 (`updateLodBand` → `setFrameLodBand`) scene 이 content · viewport · damage · idle 미리 기록에 같은 값을 넘겼다 (R2 · R7 · r1 M3 — 차례 키에 band). picture 키 성분은 self span 에 줄 상자 글자가 있을 때만 band, 아니면 full. `drawParagraphBox` 가 줄마다 (`getLineMetrics`) 글자색 × 알파 0.5 · 줄 높이 × 0.6 상자를 그렸다. 옵션 없는 실행 (export · drag 서브트리) = full (R5). unit 8 · 원복 RED 5/5 · canvas · catalogRuntime 413 파일 3,320 PASS · type-check 0.

**G1 live** (headless Playwright, DPR 1, `app-pages`, LOD ↔ `setLodOff` content 스크린샷):

| 배율                 | 차이 픽셀            | 비고                                                                 |
| -------------------- | -------------------- | -------------------------------------------------------------------- |
| 0.2 · 0.25 · 0.5 · 1 | 0 px                 | 줄 상자가 될 글자 없음 (0.25 는 히스테리시스로 band 4 가 남아도 0)   |
| 0.1 · 0.12 · 0.15    | 0.29 · 0.38 · 0.09 % | 대부분 채널 차 32 초과 (글리프 ↔ 상자 모양 차) · 평균 밝기 −48 ~ −67 |

알파 · 높이 후보 (줌 0.1): 0.35 / 0.6 → 밝기 −28 · 0.5 / 0.4 → −30 · 0.5 / 0.8 → −55 · 0.65 / 0.6 → −68. 기본안 0.5 는 회색 작은 글자를 진하게 만든다.

**A/B** (dev 5173, headless 60Hz · 1440 × 900 · DPR 1, `--fixed-inputs --zoom 0.1`, 하니스 `--lod-off` 로 같은 run 을 끔 — 교대):

| 부류 (쌍)            | taskMs 켬 / 끔                | content 기록 합 · p95 켬 / 끔  | flush 합 켬 / 끔  | 카운트 차 (켬)                                              |
| -------------------- | ----------------------------- | ------------------------------ | ----------------- | ----------------------------------------------------------- |
| `zoom` (3 쌍)        | 1,184 ~ 1,224 / 1,054 ~ 1,075 | 385 · 15.9 / 251 · 10.1 ms     | 76 ~ 79 / 75 ~ 77 | `lodTierChanges` 38 · lod miss 9,369 (끔 0) · 줄 상자 5,081 |
| `zoom-ladder` (3 쌍) | 354 ~ 393 / 294 ~ 337         | 115 ~ 120 · 14.9 / 67 · 6.6 ms | 25 / 25           | 경계 통과 11 · lod miss 3,515                               |
| `pan` 빠른 팬 (2 쌍) | 433 ~ 452 / 419 ~ 432         | 65 · 6.4 / 62 · 6.4 ms         | 15 ~ 16 / 16 ~ 17 | 없음                                                        |

표시 간격 p99 는 전부 16.8 ms, long task 0.

**판정**: 이득 0 · 비용만. 래스터 (flush) 는 켬 · 끔이 같다 — 글리프 그리기가 원래 싸서 줄 상자로 줄일 몫이 없다. 기록은 band 경계를 지날 때마다 화면 안 글자 요소를 다시 기록한다 — ADR-266 이 없앤 「줌 중 재기록」 이 경계 수만큼 돌아온다. band 를 하나로 줄여도 재기록 횟수만 줄 뿐 이득은 0. HC3 의 참고 목표 (재생 ↓ 30 %) 는 생략 레버의 몫이었고 생략은 Phase 0 에서 빠졌다.

**사용자 결정 3 (2026-10-18) 「측정 기록 종결」**: Phase 1 · 2 코드 (`lodBand.ts` · 줄 상자 · picture 키 · 미리 기록 band · dev `setLodOff` · `setLodTextBoxStyle` · 카운터 `lodTextBoxes` · `lodTierChanges` · `adr271-lod-live.mjs` · 하니스 `--lod-off`) 를 되돌렸다. 결정 1 (허용 오차) · 2 (줄 상자 모양) 는 대상이 없어졌다. 남긴 것: Phase 0 dev 카운터 (`countLodShare` — 처음에는 명령 reader 로 읽었으나 call-count ratchet `createCommandReader` · `segments` A 를 올려 `aaa2625e0` 에서 노드 데이터 (요소 + 내부 자식) 를 읽게 바꿨다. 2026-10-18 보완에서 삭제 — 아래 §후속) · `zoom-ladder` · ratchet `@zoom` 키. 되돌린 뒤 ratchet run `60:app-pages@zoom0.1` (`zoom` A 184 · `zoom-ladder` A 183) · `@zoom0.25` (`zoom` A 184) 를 다시 재서 등록 — 값은 Phase 0 표와 같다 · `--judge` 초과 0. type-check 0 · canvas · catalogRuntime 412 파일 3,312 PASS.

**남은 꼬리**: 줌 0.1 에서 `drawPicture` 재생 수 (`zoom` 52,977 / 기록 68 ≈ 780 / 기록) — 대안 C (페이지 · 그룹 합성 캐시) 의 몫. C 등급이라 fixture 측정 뒤 별도 ADR (사용자가 열 때).

## 후속 (2026-10-18, ADR-270 ~ 273 보완 ④) — Phase 0 dev 카운터 삭제

종결 뒤 읽는 곳이 없어 Phase 0 dev 카운터를 지웠다 (사용자 「권장순서 대로 진행해」 · 테스트 파일 삭제 승인 「삭제해도 된다 진행해」).

- 코드: `renderCommands.ts` `countLodShare` 와 호출 · `renderCounters.ts` `lodProjLe0_5 … lodProjGt4` · `lodTextLe0_5 … lodTextGt4` · `countLodProjected` · `countLodText` · `renderScope.zoom` · `SkiaRenderer.ts` 의 dev 배율 전달. ADR-272 의 `setNodePictureWarmupZoom(camera.zoom)` 은 그대로다.
- 테스트: `__tests__/adr271LodShare.test.ts` 삭제.
- ratchet: 7 run (`60` · `600` · `60:app-pages` · `@dpr2` · `@zoom0.1` · `@zoom0.25` · `60:many-pages100@zoom0.1`) 의 `render.lodProj*` · `render.lodText*` 94 키를 뺐다 — `ratchet.json` `retired` 에 기록. 남은 HEAD 측정으로 다시 판정하면 A 초과 0.
- 남는 것: 하니스 부류 `zoom-ladder` · ratchet `@zoom` 키와 두 run.
- 본문 HC3 · 대안 A · G1 의 `setLodOff` 와 위 Phase 0 · 1 · 2 기록의 카운터 이름은 되돌리거나 지운 코드의 기록이다.

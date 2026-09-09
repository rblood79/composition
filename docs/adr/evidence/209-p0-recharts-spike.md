# ADR-209 P0 — 실제 Recharts first nail

- 시작 기준: `31dff0c50`, 2026-09-09. 작업 중 별도 세션이 `b3bac71f4`를 만들었으며 ADR 상태·정정 일부도 그 커밋에 포함됐다. 이 실행은 commit/push를 수행하지 않았다.
- Recharts `3.10.1` exact pin, MIT, React 19 peer 지원. pnpm lock의 React `19.2.8` 사용. Canvas에 Recharts import/hidden DOM 추가 없음.
- 실행: `pnpm -F @composition/builder exec vitest run --config vitest.chart.config.ts` — Chromium **9/9 PASS**. `pnpm type-check` — 3 packages PASS, Builder baseline 0.
- G0의 측정은 실제 Recharts Chart/mark 컴포넌트의 브라우저 SVG 경계와 기존 `computeChartScene` 결과 대조다. 제품 전환·사용자 편집 플로우·G3 공급 완료를 의미하지 않는다.

## 입력과 독립 측정

`packages/shared/src/components/chart/rechartsSpike.browser.test.tsx`: 320×240, padding 12, fontSize 11, stroke 2. 원본 A/B/C × one/two, 값 각각 (10,40,20)/(30,10,20). Radar는 one/B를 제거해 결측 포함. 기대 기하는 기존 Canvas 함수, 실제 표본은 native Recharts SVG의 `getPointAtLength`다. 각 경계 1601점을 만들고 양방향 41점의 최근접 거리가 ≤1 CSS px인지 검사한다. 렌더 순서가 다른 Bar/Radial은 범주/시리즈 인덱스로 대응한다.

| 검사                              | 결과        |
| --------------------------------- | ----------- |
| Bar dodged                        | PASS        |
| Line monotone vertical/horizontal | PASS / PASS |
| Area monotone vertical/horizontal | PASS / PASS |
| Area expand (0~100)               | PASS        |
| Pie 2 rings + innerRadius         | PASS        |
| Radar null + innerRadius          | PASS        |
| Radial half + stacked             | PASS        |

## 확인한 매핑

- `monotone` 기본값의 접선 차이는 공개 `type` curve factory에서 기존 `monotoneTangents`를 소비해 보존한다. 기존 Canvas path는 변경하지 않았다. Recharts 내부 import 또는 SVG 추출을 제품 경로에 넣지 않는다.
- Composition horizontal은 Recharts vertical layout이다. 해당 layout의 Y numeric 축은 `reversed=false`에서 범주가 위→아래로 증가한다. 잘못된 reversed=true는 74px 차이를 만들어 게이트가 실패했다.
- Area expand는 기존 누적 구간을 range 값으로 전달한다. 이중 normalize를 하지 않는다.
- Pie는 공개 Pie 조합으로 시리즈 링을 나누고, 12시=0 시계 방향을 Recharts startAngle=90/endAngle=-270으로 대응한다.
- Radar 결측은 innerRadius에 접힌다. 최댓값을 제거한 데이터에서 domain도 다시 해소해야 하며, 잘못 고정한 domain은 17.94px 차이를 만들어 게이트가 실패했다.
- Radial은 range 값으로 누적 시작/끝을 전달한다. Canvas의 링 간격 3px는 안쪽에만 있고 Recharts는 barSize를 band 중앙에 두므로, 공개 radius 범위를 `gap - round(gap/2)`만큼 이동해 바깥 경계를 보존한다. Recharts 3.10.1 `combineAllBarPositions`의 중앙 offset 반올림이 이 대응의 근거다. 이동 전 경계 거리는 최대 1.012px로 FAIL, 대응 후 PASS. 내부 함수는 import하지 않는다.

## 공통 데이터 inventory / P3 선행 작업

- `useCollectionData`는 `CollectionDataContext`의 DI를 사용한다. Preview/Publish 앱에서 provider 장착은 없음.
- Preview는 `messageHandler.ts` → runtime store `collections` 수신 경로가 있으므로 앱 단위 provider로 연결할 수 있다.
- `useResolvedCollectionItems`도 같은 훅을 소비한다. `dataTableService` 연결 및 성공한 빈 데이터 판정 수리는 Chart뿐 아니라 기존 collection 소비자 회귀 검증이 필요하다.
- Publish의 데이터 전달·서비스 생성은 기존 export/import 경계를 따라 P3에서 닫는다. Chart 내부 fetch, 새 canonical data root 또는 DB migration은 허용하지 않는다.
- ADR-152의 2026-08-17 기록도 provider 부재를 이미 확인했다. 이번 작업에서 ADR-152 전체를 실행하거나 완료로 승격하지 않는다.

## 번들 baseline

동일 Vite production build의 manifest entry에서 **static imports만 재귀 추적**, JS 파일별 gzip bytes 합산. dynamic imports는 초기 집합에 포함하지 않았다. 재현 명령: `pnpm -F @composition/{builder,publish} exec vite build --outDir /private/tmp/adr209-baseline-{builder,publish} --manifest`.

| 진입점               | 초기 JS bytes | gzip bytes | chunk 수 |
| -------------------- | ------------: | ---------: | -------: |
| Builder index.html   |     5,044,894 |  1,364,128 |       22 |
| Builder preview.html |     2,618,818 |    685,820 |       11 |
| Publish index.html   |     1,698,865 |    425,346 |        1 |

차트 6종 mark/axis/grid/tooltip/legend/Cell named exports의 독립 production 빌드: 667,267 bytes / **153,272 gzip bytes**, 419 modules. React/ReactDOM은 external로 제외했다. 이는 P0 후보 크기이며 실제 앱 lazy 전이 그래프의 순증 G5 결과가 아니다.

**기존 전체 초기 번들 <500KB 조건은 baseline부터 초과**한다. 신규 초기 ≤10KiB/차트 lazy ≤200KiB 조건과 구분한다. 기존 초과를 별도 후속으로 둘지 이번 작업 범위를 넓힐지 사용자에게 확인 중이며, 답변 없이 예산을 완화하거나 G5 PASS를 선언하지 않는다.

원본 로컬 실행 로그: `/private/tmp/adr209-g0-spike4.log`, `/private/tmp/adr209-typecheck-p0b.log`, `/private/tmp/adr209-baseline-builder.log`, `/private/tmp/adr209-baseline-publish.log`.

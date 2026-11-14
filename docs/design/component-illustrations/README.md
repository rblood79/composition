# Components SVG 일러스트

현재 Components 패널의 **90개 항목**을 표현하는 편집 가능한 벡터 에셋입니다.
Chart의 7가지 팔레트 항목과 Layout 모드 전용 Slot을 포함합니다.
`libraryOnly: true`인 Toast와 패널에 노출하지 않는 내부 부품은 제외합니다.

- [전체 보기 · 흰 배경](./contact-sheet-light.svg)
- [전체 보기 · 검은 배경](./contact-sheet-dark.svg)
- [날짜·시간 확대 · 흰 배경](./date-time-light.svg)
- [날짜·시간 확대 · 검은 배경](./date-time-dark.svg)
- [파일·등록 항목 대응표](./manifest.json)
- [개별 SVG 폴더](./svg/)
- [전체 ZIP 다운로드](./component-illustrations.zip)

## 파일 규격

개별 SVG는 모두 `width="300" height="300" viewBox="0 0 300 300"`입니다.
배경은 완전히 투명하며 회색 도형·패스·그라데이션·그림자 필터만 사용합니다.
실제 문자를 그리지 않고 짧은 막대로 내용을 표현했습니다. 접근성용 `title`과
`desc`는 화면에 그려지지 않습니다. 전체 보기의 배경과 이름표는 검수용입니다.

밝은 패널에는 중간 회색 테두리를, 내부 요소에는 진한 회색을 사용해 밝고 어두운
배경 모두에서 경계를 구분합니다. 투명 영역에 캔버스 전체를 덮는 배경 도형은 없습니다.
그라데이션과 필터는 파일 안에 정의되어 있고, 래스터·외부 리소스·폰트 의존성이 없습니다.

`svg/컴포넌트명.svg`를 Figma, Illustrator, Inkscape 등에 가져와 편집할 수 있습니다.
SVG 코드의 `illustration` 그룹 안에서 도형을 수정하거나, 아래 생성 소스를 수정하고
재생성할 수 있습니다. ID에는 파일 이름을 접두사로 붙여 서로 다른 에셋을 한 문서에
합칠 때 그라데이션·필터가 충돌하지 않도록 했습니다.

## 날짜·시간 정렬

| 항목            | 좌표 계약                                                            |
| --------------- | -------------------------------------------------------------------- |
| DateField       | 날짜 막대 중심 x=68/150/232, `/` 중심 x=109/191, 공통 중심선 y=152   |
| TimeField       | 시간 막대와 `:` 중심을 x=68/109/150/191/232에 41px 간격으로 배치     |
| DatePicker      | 입력폼·달력 너비 128px, 좌우 끝 x=86/214                             |
| DateRangePicker | 입력폼·달력 너비 256px, 좌우 끝 x=22/278, 128px 달력 2개             |
| RangeCalendar   | 날짜 중심과 선택 범위 중심이 동일한 16px 격자 사용, 전체를 균등 확대 |

DateRangePicker는 DatePicker 달력의 정확히 두 배 너비입니다. Calendar와
RangeCalendar 단독 일러스트는 같은 달력 모듈을 1.75배 균등 확대합니다.
가로·세로 비율을 다르게 늘리는 변환은 사용하지 않습니다.

## 재생성·검증

저장소 루트에서 Python 표준 라이브러리로 실행합니다.

```sh
python3 docs/design/component-illustrations/generate.py
python3 docs/design/component-illustrations/validate.py
```

등록 목록은 `paletteItems.ts`의 `PALETTE_ORDER`, Chart 변형은
`packages/rendering/src/chart/authoring.ts`에서 읽습니다. 새 항목에 그림이 없으면
생성을 중단하므로 임의의 기본 아이콘으로 누락을 숨기지 않습니다.

생성 명령은 같은 폴더의 `component-illustrations.zip`도 갱신합니다. ZIP에는
SVG·미리보기·문서·생성 및 검증 소스 98개를 담으며, 검증 명령은 압축 파일의 목록과
내용이 현재 원본과 일치하는지도 확인합니다.

이번 결과는 독립 에셋 제작물입니다. Builder의 Components 패널 썸네일 연결이나
Catalog·Canvas·Preview 런타임 변경은 포함하지 않습니다.

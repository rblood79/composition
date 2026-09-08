# Changelog — 2026 Q3 아카이브 (07-01 ~ 08-31)

> `docs/CHANGELOG.md` 에서 옮긴 2026-07-01 ~ 2026-08-31 엔트리 346개. 본문이 아카이빙 기준
> (500KB) 을 넘겨 분리했다 (2026-09-09). **append-only** — 재편집 금지, 내용은 옮긴
> 그대로다. 현재 엔트리는 [CHANGELOG.md](./CHANGELOG.md).

## [프레임 테두리가 캔버스에 보입니다] - 2026-08-31

### Fixed

- **프레임에 테두리를 넣어도 빌더 캔버스에는 선이 보이지 않던 문제**:
  - 미리보기에는 테두리가 그려지는데 캔버스에는 그 자리에 배경색만 있었습니다.
  - **Why**: 배경과 같은 원인입니다 — 프레임의 시각 정의가 스타일 값을 읽지 않아 테두리를 그릴 도형을 만들지 않았습니다. 배경만 먼저 고쳤을 때 테두리가 남아 있었습니다.
  - 이제 두께·색·선 종류·모서리 반경을 반영해 그립니다. 한 변만 넣으면 그 변만 그립니다. 두께 0 / `none` / 색 없음은 그리지 않습니다.
  - 알려진 한계: 변마다 **두께가 다른** 테두리는 한 두께로 그립니다 (유무만 변별). 도형 표현이 변별 두께를 담지 못해서이며, 근사로 덮지 않고 남겨 둡니다.
  - 위치: `packages/specs/src/components/Frame.spec.ts`

## [프레임 배경색이 캔버스에 보입니다] - 2026-08-31

### Fixed

- **프레임에 배경색을 칠해도 빌더 캔버스에는 아무것도 보이지 않던 문제**:
  - 미리보기는 같은 색을 칠하는데 캔버스만 비어 있었습니다. 자식 요소가 있는 프레임은 더 확실히 비었습니다.
  - **Why**: 프레임의 시각 정의(`FrameSpec.render.shapes()`)가 스타일 값을 한 번도 읽지 않아 배경을 그릴 도형 자체를 만들지 않았고, 자식이 있으면 도형을 0개 냈습니다. 프레임은 카탈로그 미등록이라 이 함수가 캔버스가 무엇을 그릴지 정하는 유일한 자리입니다.
  - 이제 자식 유무와 무관하게 배경을 그리고, 모서리 반경도 함께 반영합니다.
  - 위치: `packages/specs/src/components/Frame.spec.ts`
- **`#RRGGBBAA` 로 적은 색이 캔버스에서 다른 색으로 그려지던 문제**:
  - `#2F6FED` 파랑이 하늘색으로 보였습니다 — 빨강이 사라지고 투명도가 파랑 자리에 앉았습니다.
  - **Why**: 색 문자열을 숫자로 바꾸는 자리(`hexStringToNumber`)가 8자리 표기의 투명도까지 그대로 실어 채널이 한 바이트씩 밀렸습니다. 이 숫자를 받는 쪽은 전부 `0xRRGGBB` 로 읽습니다. 브라우저는 8자리 표기를 그대로 이해하므로 같은 색이 미리보기와 캔버스에서 달랐습니다.
  - 이제 두 곳이 같은 색을 내고, 투명도도 반영됩니다 (`#00FF0080` 은 반투명 초록). `#RGB` / `#RGBA` 단축 표기도 함께 지원합니다.
  - 위치: `packages/specs/src/renderers/utils/tokenResolver.ts`, `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts`

### Tests

- 두 결함 모두 회귀 테스트를 붙였습니다 — 프레임 배경 도형 방출(자식 있는 경우 포함)과 표기별 색 채널 정합. ADR-198 시각 파리티 하니스에서 이 결함을 못박아 두었던 ratchet 3개는 통과 단언으로 전환했습니다.

## [Skia↔Preview 시각 파리티 게이트 — push 차단 지점 추가 (ADR-198 Phase 5)] - 2026-08-31

### Added

- **D3 시각 파리티 게이트가 push 를 막을 수 있습니다**: catalog/spec·생성 CSS·Canvas/Skia·Preview·폰트/wasm·하니스 중 하나라도 건드린 push 는 `pre-push` 에서 Skia↔Preview smoke (실측 7.4초) 를 먼저 돌립니다. 그 외 push (문서·통계·ADR 본문 등) 는 즉시 통과하므로 평소 흐름은 그대로입니다. 설치 `bash scripts/install-git-hooks.sh`, 우회 `SKIP_VISUAL_PARITY=1 git push origin main`. 명령은 `pnpm gate:visual-parity` (smoke) / `pnpm -F @composition/builder test:visual-parity:full`.
- 지금 이 게이트가 막는 것은 두 렌더러의 **입력 identity·죽은 프레임·재현성·계측기 민감도·예외 ledger** 입니다. **색·픽셀 발산은 아직 막지 못합니다** (ADR-198 Phase 4b 잔여) — 그 판단은 여전히 `/cross-check` 의 live 검토 소관입니다.

## [컴포넌트 원본·인스턴스 드래그 응답성] - 2026-08-31

### Fixed

- **자식이 많은 컴포넌트 원본·인스턴스를 옮길 때 포인터보다 요소가 느리게 따라오던 문제**: 드래그 위치가 바뀔 때마다 전체 command stream과 Canvas content snapshot을 다시 만들던 경로를 분리했습니다. 드래그 시작에 정적 배경과 이동 subtree를 한 번 기록하고, 이동 중에는 retained picture의 translate만 갱신합니다. Flow 재배치의 sibling animation도 registry와 분리해 command stream과 이동 subtree를 유지합니다. 일반 요소와 컴포넌트 원본·인스턴스가 같은 presentation 경로를 사용하며, 드롭할 때 canonical 위치를 한 번 커밋하는 계약은 유지됩니다.

### Tests

- 같은 drag target의 pointer delta와 sibling animation이 registry invalidation을 반복하지 않는지, 대상 subtree picture가 delta 변화 사이에 다시 record되지 않는지, image mask eviction이 `Picture → Image` 순서로 안전하게 폐기되는지 회귀 테스트를 추가했습니다.

## [빌더 전체가 언어 설정을 따릅니다 — ADR-200 후속] - 2026-08-30

### Fixed

- **English 로 두어도 한국어가 남아 있던 자리를 전부 걷어냈습니다**: 팔레트 크롬·History 항목 이름·선택 액션 바·AI 패널·폰트/인터랙션/Properties 패널이 각자 한국어를 품고 있었습니다. 이제 카탈로그 한 곳에서 나옵니다.
- **AI 가 English UI 에서도 한국어로 답하던 문제**: 시스템 프롬프트에 "항상 한국어로 응답하세요" 가 박혀 있어, 화면을 영어로 둔 사용자에게도 한국어 답이 돌아왔습니다. 이제 이 규칙이 언어 설정을 따릅니다. 도구 설명·계획/검증 문구·실행 로그·오류 메시지도 같이 따라옵니다.
- **DataTable preset 이 항상 한국어 스키마와 한국어 샘플을 만들던 문제**: preset 카드 설명, 필드 이름(조직명·산업·플랜…), 샘플 행의 사람/회사 이름이 언어와 무관하게 한국어였습니다. 이제 preset 을 고른 **그 시점의 언어**로 만들어집니다 — 만들어진 뒤에는 사용자의 데이터라 언어를 바꿔도 그대로 남습니다.
- **DataTable 패널의 개수·안내·확인 창**: 목록 배지의 `3개`, `10개 필드 · 10개 행`, 삭제 확인 창("정말 삭제하시겠습니까?"), 변수 이름·API URL 입력 창, Import 결과 알림, API 편집기의 응답 경로·필드 매핑 안내가 모두 한국어 고정이었습니다.
- **agent 명령 승인 창 · Slot 덮어쓰기 창 · Responsive 안내 · 모니터 임계값 설명**도 같은 이유로 한국어 고정이었습니다.
- **저장 실패 토스트와 그 되돌리기 버튼**: 저장·요소 생성·페이지 작업이 실패했을 때 뜨는 알림 24종이 한국어 고정이었습니다. 알림은 떠 있는 동안 언어를 바꿔도 함께 바뀝니다 — 만들 때가 아니라 그릴 때 문구를 고릅니다.
- **Interactions 패널의 기능 어휘**: 규칙 요약줄(`누를 때 → 항목 선택 @ ListBox`), Do 축 선택지(표시·숨김·체크·펼치기…), 인자 입력의 이름표(항목 키·경로·메시지)가 언어 설정과 무관하게 한국어였습니다. 이미 만들어 둔 규칙도 언어를 바꾸면 함께 바뀝니다 — 규칙에는 문구가 아니라 어휘의 키가 저장됩니다.
- **배포된 페이지에 한국어가 실려 나가던 문제**: 컴포넌트 18개가 스스로 그리는 문구가 한국어 고정이었습니다 — 컬렉션 12종(ListBox·GridList·Select·Menu·Tabs·ComboBox·CheckboxGroup·RadioGroup·TagGroup·ToggleButtonGroup·Breadcrumbs + 공용 상태 컴포넌트)의 로딩·오류·빈 상태(`⏳ 데이터 로딩 중...`, `❌ 오류: …`, `다시 시도`, `표시할 데이터가 없습니다`), Pagination 버튼과 쪽수 안내, Slot 의 "필수" 배지, DatePicker/DateRangePicker 시간 이름표, Tree 정보 버튼과 Table 태그 셀의 이름표. 이건 빌더 화면이 아니라 **사용자가 배포한 페이지에 뜨는 문구**라, 영어권 방문자에게도 한국어가 보였습니다. 이제 페이지를 **보는 사람**의 언어를 따릅니다.
- **Preview 가 항상 한국어 문서라고 주장하던 문제**: `preview.html` 이 `lang="ko"` 로 고정돼 있어, 편집 언어를 English 로 두어도 스크린리더 발음과 브라우저 번역 제안이 한국어 기준이었습니다. 이제 Preview 는 편집 중인 **작성자**가 고른 언어를 따르고, 언어를 바꾸면 새로고침 없이 따라옵니다.
- **publish 앱 자신의 화면도 한국어 고정이었습니다**: 프로젝트 로드 실패 화면(제목·필드/상세 이름표·"모든 오류 보기"·"다시 시도"), 로딩 화면, 파일 드롭존, 빈 페이지 안내, 페이지 목록 이름표 15곳. 이제 방문자 언어를 따르고, 문서의 `lang` 도 `ko` 고정에서 실제 언어로 바뀝니다.
- **같은 `Undo` 를 화면마다 다른 이름으로 부르던 문제**: 헤더 버튼·명령 팔레트·우클릭 메뉴는 "실행 취소", 저장 실패 알림의 버튼은 "되돌리기"/"실행취소", 명령 승인 창은 "실행 후 되돌리기" 였습니다. 영어는 네 자리 모두 `Undo` 라 영어만 보면 드러나지 않았습니다. 이제 전부 **실행 취소** 한 이름입니다 — 되돌릴 수 없는 명령의 안내도 "실행 취소할 수 없음" 으로 짝을 맞췄습니다.
- **패널 이름이 자리마다 달라지던 문제**: 같은 패널을 레일에서는 "히스토리", 패널 제목에서는 "작업 내역" 으로 불렀고, Interactions 도 팔레트 분류만 "이벤트" 였습니다. 이제 **작업 내역** 과 **인터랙션** 한 이름씩입니다.
- **폰트 피커 안에 "Default" 가 두 번 있던 문제**: 섹션 머리말과 그 아래 첫 항목이 둘 다 "Default"(한국어로는 "기본"/"기본값") 였습니다. 머리말은 **기본 폰트**(영어 `Built-in`), 항목은 **기본** 으로 갈랐습니다 — 하나는 분류, 하나는 값입니다.
- **패널 이름이 좁은 패널에서 두 줄로 접혀 글자가 잘리던 문제**: 헤더의 이름표가 줄바꿈될 수 있어 "작업 내역" 이 "업/내" 로 보였습니다. 이제 한 줄로 두고 넘치면 줄임표로 끊으며, 전체 이름은 마우스를 올리면 보입니다. 언어와 무관한 문제였습니다 — English 의 "History" 도 같은 폭에서 잘리고 있었습니다.

### Changed

- 한국어 리터럴 감시 게이트가 **문장 형태 네 가지**를 봅니다: prop 값, `{개수}개` 처럼 표현식과 맞닿은 텍스트, 줄바꿈으로 밀려난 텍스트 줄, `confirm`/`alert`/`prompt` 인자. 첫 판은 첫 번째만 봐서 나머지 세 형태가 조용히 통과하고 있었습니다. 타입이 ko/en 대칭을 강제하지 못하는 네임스페이스(datatable·monitor·debugger)의 키 누락도 함께 막습니다.
- 정적 게이트가 못 보는 두 자리 — API 응답이 배열도 객체도 아닐 때의 감지 결과, DataTable 생성 실패 알림 — 는 회귀 테스트로 잠갔습니다. 실제 API 로는 그 조건을 만들 수 없어 화면에서 확인할 수 없던 문구입니다. 감지 결과는 문구뿐 아니라 앞의 `✓`/`⚠`/`✗` 가 정하는 색까지 함께 봅니다.
- capability 어휘의 정의는 `packages/shared` 에 남고 문구만 빌더 카탈로그로 옮겼습니다. 두 패키지를 잇는 것이 키 문자열뿐이라 타입이 지켜 주지 못하는 자리라, 레지스트리의 키 40개가 두 언어 모두에서 실제로 풀리는지 보는 테스트를 함께 뒀습니다.
- 언어를 고르는 주체가 화면마다 다릅니다 — 배포된 페이지는 **방문자**, Preview 는 **작성자**. 두 경우를 하나로 다루려고 공유 컴포넌트는 주변 locale 을 읽고, Preview 만 작성자 언어로 그 locale 을 세웁니다. 공유 컴포넌트의 문구 사전은 빌더가 아니라 `packages/shared` 에 둡니다 — publish 는 빌더를 끌어오지 않기 때문입니다.
- publish 가 만든 오류는 문구가 아니라 **키**를 싣습니다. 오류 객체는 상태에 남았다가 나중에 그려지므로, 만들 때 문구로 굳히면 그 사이 브라우저 언어가 바뀌어도(`languagechange`) 그 줄만 예전 언어로 남습니다 — 실제로 라이브에서 그렇게 남는 것을 보고 고쳤습니다.
- publish 앱에 테스트 러너가 없어 어느 게이트의 감시 밖이었습니다. vitest 를 붙이고 같은 한국어 감시 게이트를 뒀습니다.
- **옮기지 않은 것**: AI 가 사용자 입력을 알아듣는 동의어 사전("버튼" → Button 등). 이건 사용자가 **입력한** 말을 읽는 자리라, 언어 설정을 따라 갈아 끼우면 화면을 영어로 둔 한국어 사용자의 입력이 인식되지 않습니다.

### Tests

- 같은 동작이 화면마다 다른 이름으로 갈리는 것을 막는 게이트를 뒀습니다. 판정 기준은 **영어 값** 입니다 — 영어 문구가 같으면 한국어도 같아야 합니다. 같은 영어 단어가 실제로 다른 개념인 자리(요금제 `Plan` ↔ AI 작업 계획 `Plan` 등)만 예외로 적어 두고, 예외가 해소되면 목록에서 지우라고 테스트가 알려 줍니다. 이 게이트가 잡아낸 `Interactions`·`History`·`Default` 표기 갈림은 모두 해소해 예외 목록이 비었습니다 — 남은 예외는 같은 영어 단어가 실제로 다른 개념인 5건뿐입니다.

## [메뉴·팔레트·툴팁이 언어 설정을 따릅니다 — ADR-200] - 2026-08-30

### Fixed

- **언어를 English 로 두어도 우클릭 메뉴가 한국어로 나오던 문제**: 캔버스 우클릭 메뉴가 `복사 / Copy`, `여기에 붙여넣기 / Paste here` 처럼 두 언어를 함께 적어 두고 있었습니다. 같은 화면의 다른 부분은 설정을 따르고 있어 한 화면 안에서 표기가 갈렸습니다. 이제 메뉴 항목·정렬 서브메뉴·메뉴 자체의 이름표까지 고른 언어 하나로 나옵니다.
- **선택 액션 바가 메뉴에서 물려받은 두 언어 표기를 읽어 주던 문제**: 바의 버튼 이름은 화면에 보이지 않고 스크린리더만 읽는 자리인데, 거기에 `복제 / Duplicate` 가 그대로 들어가 있었습니다.
- **명령 팔레트와 단축키 툴팁이 설정과 무관하게 한국어를 먼저 쓰던 문제**: 명령 72개의 이름이 정의 파일에 한국어 번역을 따로 달고 있었고, 팔레트·툴팁 세 곳이 그 한국어를 먼저 골랐습니다. 팔레트의 분류(시스템·탐색·패널…)와 "캔버스에서 실행할 수 있습니다" 같은 안내 문구도 한국어로 굳어 있었습니다. 이제 셋 다 고른 언어를 따릅니다.
- **Properties 패널의 컴포넌트 액션이 항상 영어로 나오던 문제**: 같은 액션이 우클릭 메뉴에서는 두 언어 병기, 패널에서는 영어 고정이라 표면마다 달랐습니다. 원본의 인스턴스 수를 세는 "인스턴스 선택 (3)" 같은 문구도 숫자와 함께 번역됩니다.

### Changed

- 라벨의 언어를 고르는 지점이 네 곳에 흩어져 있던 것을 번역 카탈로그 한 곳으로 모았습니다. 새 메뉴 항목이나 명령을 추가할 때 키 하나만 넣으면 메뉴·액션 바·팔레트·패널이 함께 따라오고, 다른 언어를 더하는 일도 카탈로그 파일 하나의 작업이 됩니다.

## [컴포넌트 액션이 세 화면에서 같게 섭니다 — ADR-199] - 2026-08-30

### Changed

- **컴포넌트 액션의 순서가 세 화면에서 같아집니다**: 캔버스 우클릭 메뉴가 "컴포넌트 만들기 → 원본으로 이동 → 인스턴스 분리" 순서였던 것을 Properties 패널·선택 액션 바와 같은 **"원본으로 이동 → 인스턴스 분리 → 컴포넌트 만들기/분리"** 로 맞췄습니다. 같은 묶음이 화면마다 다른 순서로 서면 누를 것을 매번 다시 찾게 됩니다.
- **인스턴스 분리 확인 창의 문구가 어디서 눌러도 같습니다**: 패널에서 누를 때만 원본 이름을 되짚어 "무엇을 분리하는지" 를 보여 주고 우클릭 메뉴·단축키(`⌘⌥X`)에서는 타입 이름만 나오던 차이를 없앴습니다.
- **선택 액션 바에 "컴포넌트 만들기/분리" 가 함께 섭니다**: 인스턴스를 고르면 원본 이동·인스턴스 분리만 있고 컴포넌트 액션이 빠져 있었습니다.

### Fixed

- **인스턴스를 컴포넌트로 만든 뒤 캔버스에서 되돌릴 수 없던 문제**: 그 노드를 우클릭하면 이미 컴포넌트인데도 "컴포넌트 만들기" 가 떠서, 눌러도 아무 일이 없었습니다. Properties 패널은 같은 노드를 "Detach component" 로 옳게 보여 주고 있어 두 화면이 서로 다른 말을 하던 상태였습니다. 캔버스가 인스턴스를 그릴 때 "이 노드도 원본" 이라는 표시를 잃어버린 것이 원인이었습니다.
- **인스턴스 분리가 캔버스 표면에서만 통째로 사라지던 문제**: 판정이 캔버스에서는 값이 달라지는 필드를 읽고 있었습니다. 이제 판정은 화면에 따라 변하지 않는 필드만 읽고, 그 규칙을 테스트가 지킵니다.

## [빌더 패널 크롬 일관성 — 버튼·아이콘·Component 섹션] - 2026-08-30

### Changed

- **패널 안의 라벨 액션 버튼이 하나의 디자인으로 통일됐습니다**: add / create / cancel / generate 처럼 라벨을 가진 버튼이 25개 클래스 / 47개 호출부에서 각자 모양을 정의하던 것을 공용 `.control-button` 하나로 모았습니다. 높이가 22~38px로 갈리던 것이 패널의 필드·탭과 같은 28px 격자로 맞춰지고, 키보드 포커스 표시가 없던 29개 중 24개에도 포커스 링이 생깁니다. 무게는 확정(채움) / 목록 끝 추가(점선 전폭) / 중립 세 가지로만 나뉩니다.
- **Data Table Creator를 패널 표준 구조로 다시 짰습니다**: Preset/Empty 전환이 패널 탭이 되고, 가로 스크롤 때문에 두 개가 상시 숨던 카테고리 탭은 카테고리마다 하나의 섹션이 됐습니다. 본문만 스크롤하고 Cancel/Create는 패널 하단에 고정되며, 선택한 preset의 스키마 미리보기가 스크롤 밖에 남습니다.
- **Properties 패널의 입력·선택 필드에 아이콘이 붙습니다**: 필드가 컴포넌트별로 동적으로 만들어지는 구조에 맞춰, 필드의 정체(이름·종류)에서 아이콘을 이끌어 내는 방식으로 붙였습니다. 새 컴포넌트가 추가돼도 아이콘이 빠지지 않습니다. 컨트롤 자체가 이미 그 자리를 쓰는 크기 토글·아이콘 선택기·색상 필드는 아이콘을 두지 않습니다.
- **Properties의 Component 섹션이 한 줄 칩 + 한 줄 액션 구조가 됐습니다**: 이름과 역할(Origin / Instance / Standard)을 역할 색 테두리의 칩 한 줄이 함께 보이고, 그 아래 한 줄에 액션이 섭니다. Origin의 인스턴스 수는 "Select instances (N)" 라벨이 함께 보여 줍니다. 역할 색은 캔버스·탐색기와 같은 색을 씁니다.
- **Component 섹션의 액션이 pencil과 같은 두 축으로 섭니다**: 인스턴스에서도 컴포넌트 액션을 쓸 수 있습니다 — 인스턴스는 "Go to component · Detach instance" 옆에 "Create component"가 함께 서고, 그 인스턴스를 다시 컴포넌트로 만든 노드는 "Instance · Origin"으로 읽히며 "Detach component"로 되돌릴 수 있습니다. 종전에는 원본/인스턴스를 하나의 역할로만 갈라 인스턴스에서는 컴포넌트 액션이 아예 보이지 않았고, 인스턴스를 컴포넌트로 만들면 되돌릴 진입점이 없었습니다. 원본 해제의 이름도 "Detach component" 하나로 통일했습니다 (캔버스 우클릭 메뉴 · `⌘⌥K` 포함).
- **빌더 아이콘을 전수 점검해 뜻이 맞지 않던 17건을 바꿨습니다**: Styles 패널 헤더가 왼쪽 rail과 다른 그림이던 것, 헤더 메뉴의 Monitor가 화면 크기 아이콘을 쓰던 것, Monitor 패널의 메모리 지표가 CPU 아이콘이던 것, 메모리 정리 버튼이 삭제 아이콘이던 것, Import 버튼이 내려받기 아이콘이던 것 등을 각각의 뜻에 맞는 그림으로 바꿨습니다. 한 토글 그룹이나 한 탭 줄 안에서 두 항목이 같은 그림이라 구별되지 않던 곳(타이포그래피 4개 필드, 정렬 옵션, API 탭, 그러데이션 반지름)도 서로 다른 그림으로 나눴습니다.

### Fixed

- **인스턴스를 컴포넌트로 만들면 원본 연결이 끊기던 문제**: 재사용 원본으로 승격하는 경로가 참조(`ref`)를 함께 지워, 가리키는 곳이 없는 인스턴스 노드가 남았습니다. 이제 두 성질을 함께 보존하고, 해제하면 원래 인스턴스로 정확히 되돌아갑니다.
- **크기(Size) 토글에서 선택된 버튼의 글자가 보이지 않던 문제**: 선택 표시가 흰 알약 모양인데 글자도 흰색이라 S/M/L 이 사라졌습니다. 같은 버튼의 아이콘만 어두워 아이콘과 글자가 서로 달라 보이던 것도 함께 맞췄습니다.
- **목록에서 선택한 항목의 이름이 사라지던 문제**: 밝은 배경 위에 흰 글자를 쓰던 규칙을 걷어 냈습니다. DataTable 목록 · API 목록 · 레이아웃 프리셋 선택기가 함께 영향을 받았습니다.
- **DataTable 편집기에서 빈 탭 줄이 패널 높이의 절반을 차지하던 문제**: 탭 줄만 감싸는 자리에 본문용 높이 규칙이 걸려 있었습니다. 테이블 · API · 변수 편집기에서 같이 나타나던 증상입니다.
- **스타일 패널 탭의 수정 표시 점**을 6px · 경고색으로 바꿔 눈에 띄게 했습니다.

## [Action Bar page 하단 자동 고정] - 2026-08-29

### Changed

- **Action Bar가 선택 대상이 속한 page의 하단 중앙에 나타납니다**: page의 하위 요소를 선택하면 page width 중앙, 전체 page height 아래에 배치되며, page를 직접 선택했을 때도 같은 위치에서 표시됩니다. 선택 크기 정보(size info)가 차지하는 높이 아래로 추가 간격을 두어 두 overlay가 겹치지 않습니다.
- **이동하지 않은 Action Bar는 page와 함께 움직입니다**: page drag와 canvas pan/zoom의 live 좌표를 따라가며, 사용자가 핸들로 직접 옮긴 뒤에는 기존 수동 위치를 유지합니다. 위치 초기화를 실행하면 현재 선택 page 하단으로 다시 붙습니다.

### Fixed

- **Canvas 이동 중 Action Bar가 떨리거나 한 프레임 먼저 움직이지 않습니다**: Action Bar가 React의 별도 viewport 구독으로 위치를 갱신하던 경로를 제거하고, Skia가 실제로 그리는 프레임의 camera/page snapshot을 함께 소비하도록 동기화했습니다. 자동 위치는 `translate3d`만 직접 갱신해 pan/zoom과 page drag 중 React 재렌더와 layout 이동을 만들지 않습니다.

## [탐색기 패널 명칭 및 탭 구조 표준화] - 2026-08-29

### Changed

- **Nodes 패널의 표시명을 탐색기(Navigator)로 변경했습니다**: Pages, Frames와 내부 Layers 구조를 함께 다루는 탐색 도구라는 역할을 드러냅니다.
- **탐색기의 내부 식별자를 `navigator`로 완전히 통일했습니다**: 소스 디렉터리와 React 컴포넌트, DOM/CSS, i18n, shortcut scope에 이어 `PanelId`와 저장 레이아웃을 `navigator`로 전환했습니다. 기존 v3 `nodes` 배치는 exact backup을 남기고 geometry·visibility·focus order를 보존한 v4로 자동 migration합니다. 단축키와 신규 agent descriptor는 `toggleNavigator`를 사용하며, 기존 agent의 `toggleNodes` 호출은 executor 경계의 legacy alias로 계속 동작합니다.
- **탐색기 패널을 제목 헤더와 탭 행의 2단 구조로 통일했습니다**: 공통 `PanelHeader`가 탐색기 제목과 우측 끝 닫기 버튼을 담당하고, Pages/Frames는 Styles 패널과 같은 별도 tabrow에서 전환됩니다.
- **Pages/Frames 탭을 React Aria Tabs로 전환했습니다**: 수동 `role="tab"` 버튼을 제거하고 포커스 표시, 방향키 이동, 선택 상태와 `TabPanel` 연결을 표준 컴포넌트가 담당합니다. 두 탭의 라벨은 좁은 패널에서도 항상 표시되며 Styles 탭과 같이 왼쪽 정렬됩니다.

## [프로젝트 로컬 파일 Import/Export] - 2026-08-29

### Changed

- **Header의 Publish 버튼을 제거했습니다**: 편집 화면 상단의 게시 진입점을 없애고 Preview와 보기 도구만 남겼습니다.
- **Workflow와 Monitor를 전체 메뉴로 옮겼습니다**: Header 우측 보기 토글 그룹에서는 두 버튼을 제거하고, 좌측 전체 메뉴의 Settings 위에서 동일한 메뉴 액션 패턴으로 실행할 수 있습니다. Workflow 메뉴명은 상태와 무관하게 고정되며 `⌃⌥W`로 오버레이를 토글할 수 있습니다.
- **패널 메뉴와 헤더 동작을 정리했습니다**: `Reset Panel Layout` 메뉴는 `LayoutDashboard` 아이콘을 사용하며, Monitor 패널 헤더에는 Settings 패널과 같은 닫기 버튼을 제공합니다.
- **모든 등록 패널을 헤더에서 닫을 수 있습니다**: 기존 header actions 뒤에 공통 닫기 버튼을 항상 우측 끝으로 배치했습니다. 자체 탭 헤더를 쓰는 Nodes와 전용 종료 절차가 있는 DataTable Editor도 같은 위치·접근성 패턴을 따릅니다.

### Added

- **전체 메뉴에서 프로젝트를 로컬 파일로 저장하고 다시 불러올 수 있습니다**: `내보내기`는 현재 canonical document와 활성 페이지, custom font registry를 편집 가능한 JSON으로 내려받습니다. `가져오기`는 JSON을 검증한 뒤 현재 프로젝트의 로컬 ID를 유지한 채 문서·페이지·요소 파생 상태와 IndexedDB 저장본을 함께 교체합니다.

## [Page URL 표시 중복 정리] - 2026-08-29

### Changed

- **Slug와 같은 URL을 되풀이하지 않는다**: Page Properties의 URL 보조 행은 Parent Page 또는 Layout 합성으로 최종 경로가 달라질 때만 `Resolved URL`로 표시합니다. 절대 slug처럼 계산 결과가 같은 기본 상태에서는 중복 행을 숨깁니다.

## [AI 어시스턴트가 방금 만든 요소를 이어서 다룬다] - 2026-08-29

### Fixed

- **여러 단계 요청이 중간에 헛돌지 않는다**: "버튼 만들어 줘 → 그 버튼 라벨 바꿔 줘" 처럼 이어지는 요청에서, AI 가 방금 만든 요소의 실제 ID 대신 `created-element-id` 같은 자리표시자를 넘겨 실패하던 문제를 고쳤습니다. 이제 방금 만든 요소는 `"last-created"`, 선택한 요소는 `"selected"` 로 가리킬 수 있습니다. ID 를 잘못 넘겨도 오류 메시지에 복구 방법과 실제 ID 가 함께 나와 다음 시도가 맞습니다.
- **바뀌지 않았는데 "수정함" 이라고 하지 않는다**: 요소 수정·삭제 도구가 스토어에 쓴 뒤 **다시 읽어 대조**한 다음 결과를 보고합니다. 이전에는 편집이 조용히 무시돼도 (원본 요소 영향 확인 거부 등) 항상 성공으로 보고돼, 어시스턴트가 반영됐다는 전제로 다음 단계를 쌓았습니다. 이제 반영되지 않은 항목 이름과 확인 방법을 함께 알려 줍니다.
- **어시스턴트가 선택한 요소의 최신 값을 본다**: 속성을 바꾼 직후 AI 에게 물으면 **변경 전 값**이 전달되던 문제를 고쳤습니다. 선택 요소의 상세는 레이어 트리용 구조 캐시가 아니라 최신 상태에서 읽습니다. 문서 전체 목록은 이제 식별 정보만 실어, 낡은 속성이 흘러갈 경로 자체를 없앴습니다.
- **패널을 접었다 편 뒤에도 첫 요청이 사라지지 않는다**: AI 패널이 숨겨져 있는 동안에는 어시스턴트가 문서 상태를 놓쳐, 그 상태에서 들어온 요청이 **아무 표시 없이 무시**됐습니다. 이제 문서 상태를 요청이 시작되는 순간에 읽으므로 그런 공백이 없습니다.

## [로컬 모델(Ollama)로 실제 검증 — 컨텍스트 설정 경고 추가] - 2026-08-29

### Fixed

- [로컬 endpoint 연결 가이드](how-to/development/ai-local-endpoint.md) 에 **컨텍스트 길이 경고** 추가. Ollama 기본값 `n_ctx=4096` 은 composition 이 보내는 시스템 프롬프트(약 6,500 토큰)보다 작아, 컴포넌트 목록이 잘린 채 모델에 들어간다. 그러면 어시스턴트가 오류 없이 **존재하지 않는 속성을 지어낸다** — 알아채기 어려운 실패다. `OLLAMA_CONTEXT_LENGTH=32768` 로 띄우도록 안내.

## [ADR-134 종결 — AI 어시스턴트가 어떤 모델로도 돌아간다] - 2026-08-29

ADR-134 를 **Phase 0–8 delivered scope** 로 종결했습니다. 사용자가 고른 모델·endpoint 로 빌더를 조작하는 경로가 웹에서 자립 완결됩니다.

### Changed

- **모델을 직접 고른다**: Groq 고정이 사라지고 Anthropic · OpenAI 호환 endpoint (Ollama / vLLM / LM Studio / 사내 gateway) 를 주소만으로 연결합니다. 역할별(기본 / 계획 / 실행 / 검증 / 분류)로 다른 모델을 쓸 수 있습니다.
- **키는 설정과 함께 저장되지 않습니다**: 기본은 현재 세션에서만 기억하고, 브라우저에 남기려면 명시로 켜야 합니다. 원격 상용 provider 는 프록시가 준비되기 전까지 브라우저에서 직접 호출되지 않습니다 — 로컬·사설망 endpoint 는 그대로 동작합니다.

### Known limitations

- 로컬 endpoint 실물(Ollama) 대조는 아직 1회도 돌리지 못했습니다 — 개발 환경에 Ollama 가 없습니다. [연결 가이드](how-to/development/ai-local-endpoint.md) 대로 띄우면 함께 확인되는 항목이 셋 있습니다: 실물 wire 정합, 컴포넌트 속성 정확도, 다단계 대시보드 시나리오 품질.
- 외부 코딩 에이전트(Claude Code / Codex) 를 빌더 안에 얹는 작업은 데스크톱 앱 전환이 전제라 별도 결정으로 넘겼습니다.

## [ADR-134 Phase 8 — AI 패널이 한 화면으로 정리됐다] - 2026-08-28

### Changed

- **첫 화면은 요청과 결과만 남는다**: 모델 구성·연결 상태·계획 진행 같은 설정 표면은 헤더의 **고급 모드** 한 번으로 열린다. 이전에는 프로파일 화면이 기본 화면에 그대로 매달려 있었다.
- **무엇이 실행됐는지 우리말 한 줄로 읽힌다**: `frame 생성함` · `데이터 연결함` 처럼 도구 이름 대신 한 일이 보인다. 이전에는 도구 7종만 이름이 있었고 데이터 연결·동작 규칙·빌더 명령 3종은 전부 "도구 실행 완료" 로 뭉뚱그려졌다. 실패하면 이유를 그대로 보여 준다.

### Added

- **처음 열었을 때 무엇을 해야 하는지 알려 준다**: 모델을 정하지 않은 상태에서 빈 채팅 대신 설정 안내가 뜨고, 거기서 바로 설정 화면으로 이어진다.
- **고급 모드에서 AI 가 무엇을 하고 있는지 보인다**: 계획 단계 목록, 역할별 진행(계획 / 실행 / 검증), 스스로 고친 횟수와 지적 내용.

### Fixed

- **도구를 실행한 뒤 AI 가 한 설명이 화면에서 사라지던 문제**: "만들었습니다" 같은 마무리 설명이 통째로 유실됐다. 도구 결과 다음 설명은 이제 새 말풍선으로 남는다.
- 고급 모드에서 연결 상태가 두 번 그려지던 문제, 진행 요약이 `실행 2건 실행` 처럼 역할 이름을 되풀이하던 문제, 계획 단계의 순서 번호가 보이지 않던 문제.

### Tests

- 도구 어휘 ↔ 도구 정의 전수 대조, 진행 상태 reducer, 도구 실행 뒤 텍스트 보존, 기본 표면 / 고급 모드 / 온보딩 분기 — 신규 14건, 관련 영역 합계 240건.

## [ADR-134 Phase 7 — AI 설정 화면과 로컬 endpoint 안내] - 2026-08-28

### Added

- **AI 패널에서 직접 모델을 설정한다**: 헤더 톱니 아이콘 → 프리셋(로컬 Ollama / Anthropic / OpenAI 호환) 선택, endpoint·모델 입력, 역할별(기본/계획/실행/검증/분류) 구성.
- **어느 작업이 어느 프로파일로 가는지 보여 준다**: 계획 프로파일을 비워 두면 "계획 → 기본 프로파일로 실행합니다" 처럼 내려간 사실이 그대로 표시된다. 로컬·사설망 endpoint 에는 폐쇄망 표시가 붙는다.
- [로컬 endpoint 연결 가이드](how-to/development/ai-local-endpoint.md) — Ollama 기준 설정 순서, 역할별 모델 고르는 기준, 안 될 때 원인표.

### Changed

- 키 값은 설정과 함께 저장되지 않는다. 기본은 현재 세션에서만 기억하고, 브라우저에 남기려면 명시로 켜야 하며 끄면 즉시 삭제된다.

### Fixed

- 설정 화면의 긴 선택지가 패널 밖으로 입력 칸을 밀어내던 문제, 프리셋 버튼 글자가 거의 보이지 않던 문제.

### Tests

- 작업 유형 → 프로파일 라우팅과 내림 순서, 폐쇄망 판정, 연결 상태 표시 — 신규 27건, AI 영역 합계 215건.

## [ADR-134 Phase 6 — AI 가 계획하고, 실행하고, 스스로 검토한다] - 2026-08-28

### Added

- **여러 단계가 필요한 요청을 나눠서 처리한다**: "제목이 있는 대시보드 만들어줘" 같은 요청을 계획 → 실행 → 검증 순서로 처리한다. 검증에서 빠진 것이 발견되면 **최대 두 번까지** 스스로 고치고, 그래도 남으면 무엇이 남았는지 알려 준다.
- 계획 / 실행 / 검증에 **서로 다른 모델을 쓸 수 있다** — 추론이 센 모델로 계획하고 도구 호출이 정확한 모델로 실행하는 구성이 가능하다. 설정하지 않은 역할은 기본 모델로 내려간다.
- 자주 쓰는 화면 골격 4종(대시보드 / 폼 / 목록 / 카드 그리드)을 계획 단계에서 출발점으로 쓴다.

### Fixed

- **AI 가 만든 복합 컴포넌트가 빈 껍데기이던 문제**: `Select` 를 AI 로 만들면 자식이 하나도 없어 화면에 아무것도 보이지 않았다 (팔레트로 만들면 라벨·트리거·아이콘이 함께 생긴다). AI 도 팔레트와 같은 경로로 만들도록 고쳤다. `Card` / `Form` 같은 재사용 조합 컴포넌트도 마찬가지다.

### Changed

- 단순한 요청("버튼 색 바꿔줘")은 계획·검증을 붙이지 않고 그대로 실행한다 — 나누는 것이 항상 이득은 아니다.

### Tests

- 역할별 호출 분기 · 수리 횟수 상한 · 계획 JSON 파싱(코드 펜스·깨진 출력) · 템플릿 컴포넌트 실재 여부 · 합성 판정이 팔레트와 일치하는지 — 신규 38건, AI 영역 합계 188건.

## [ADR-134 Phase 5 — AI 가 컴포넌트를 실제로 안다] - 2026-08-28

### Added

- **AI 가 composition 의 컴포넌트 118종을 안다**: 어떤 컴포넌트가 있고, 각각 어떤 props 를 받고, variant / size 에 어떤 값을 쓸 수 있는지가 대화마다 전달된다. 이 지식은 손으로 적은 목록이 아니라 컴포넌트 카탈로그에서 그대로 파생되므로, 컴포넌트가 바뀌면 AI 가 아는 것도 같이 바뀐다.
- 요청과 관련된 컴포넌트만 상세를 펼친다 — 전체 목록은 항상 보내고, "버튼 색 바꿔줘" 같은 요청에는 Button 상세만 붙인다.

### Fixed

- **AI 가 존재하지 않는 컴포넌트를 제안하던 문제**: 이전 프롬프트는 24종을 손으로 적어 두고 있었고 그중 `Div` 는 실제로 만들 수 없는 type 이었다. 목록이 카탈로그 파생으로 바뀌면서 사라졌다.
- **AI 가 값을 지어내던 문제**: variant / size 의 허용 값을 알려 주지 않아 모델이 그럴듯한 값을 만들어 냈다. 이제 실제 값 집합을 받는다.
- 사용자가 "progress bar" 처럼 띄어 써도 해당 컴포넌트를 알아본다.

### Tests

- 컴포넌트 118종 전수 대조 (props 집합 · enum · variant · size 값이 카탈로그와 정확히 일치), 15 시나리오 주입 정확도, 카탈로그 drift 감시 — 신규 44건, AI 영역 합계 150건.

## [ADR-134 Phase 3~4 — AI 가 frame·데이터·이벤트를 다룬다] - 2026-08-28

### Added

- **AI 가 canonical 1차 필드를 다룬다**: `type: "frame"` 컨테이너를 만들고 `clip` / `placeholder` / `slot` / `reusable` 을 지정할 수 있다. 잘못된 조합(예: frame 이 아닌 요소에 `clip`)은 조용히 무시되지 않고 사유와 함께 되돌아온다.
- **`bind_collection`**: ListBox / GridList / Table 같은 collection 요소에 데이터를 연결한다 (static 배열 / API / Supabase). 데이터 소스 자체를 만들지는 않는다.
- **`create_interaction_rule`**: 요소에 이벤트 규칙을 붙인다 (버튼 누르면 알림, 페이지 이동, 다른 요소 기능 구동). 컴포넌트가 실제로 노출하는 trigger·capability 만 허용하고, 틀리면 사용 가능한 목록을 돌려준다.
- `search_elements` 에 `hasSlot` / `reusable` / `clip` 필터, `get_editor_state` 에 요소별 canonical 필드와 이벤트 규칙 요약.

### Changed

- **AI 가 여러 작업을 한 번에 하면 되돌리기도 한 번**: `batch_design` 이 history 1 entry 로 묶인다 (이전에는 작업 수만큼 쌓여 ⌘Z 를 여러 번 눌러야 했다).
- AI 도구 목록이 8종 → 10종.

### Architecture

- `applyCanonicalExtensionPatch` store 액션 신설 — `dataBinding` 처럼 props 가 아닌 확장 필드를 바꿀 때 canonical 갱신 · 요소 목록 재파생 · 저장을 한 묶음으로 처리한다. 이것 없이 canonical 만 고치면 캔버스가 이전 값을 계속 그린다.
- AI 도구가 요소 저장소를 직접 만지지 않는다는 규칙을 테스트로 고정 (`elementsMap` / `childrenMap` 직접 접근 0, 은퇴 어휘 5종 0).

### Tests

- 신규 26건: canonical 필드 검증·스키마 어휘·patch 반영 · batch 1 entry + undo 복원 · 바인딩/규칙 도구 12 · **소비자 경로 4** (ListBox 가 바인딩으로 항목을 그리는지, Preview dispatcher 가 규칙으로 알림을 띄우는지).
- live: AI 패널에서 frame 생성 · 규칙 · 바인딩을 실행하고 저장까지 확인한 뒤 원복.

## [ADR-134 Phase 1~2 — AI 어시스턴트가 provider 를 고른다 + Groq 제거] - 2026-08-28

### Changed

- **AI 어시스턴트의 모델·endpoint 를 사용자가 정한다** (Breaking): Groq 고정 연결을 걷어내고 에이전트 프로파일 (`main`/`planner`/`executor`/`verifier`/`fast` + `vision` 예약) 이 provider·endpoint·모델을 정한다. 프리셋 3종 (Anthropic / OpenAI 호환 / 로컬 Ollama) 제공.
  - **모델이 정해지기 전에는 AI 패널이 동작하지 않는다** — 이전에는 만료된 모델 id 가 코드에 박혀 있어 요청이 `404 model_not_found` 로 조용히 실패했다. 이제 미구성 상태를 분명히 드러낸다.
  - 로컬/사내 endpoint (Ollama · vLLM · LM Studio · 사설망 gateway) 는 전용 어댑터 없이 base URL 만으로 연결된다 — 폐쇄망에서 그대로 쓸 수 있다.
- **API 키가 브라우저 번들에 실리지 않는다**: `VITE_GROQ_API_KEY` 환경변수 경로와 `dangerouslyAllowBrowser` 를 제거했다. 키는 기본적으로 **세션 메모리** 에만 있고, 브라우저 저장은 사용자가 명시적으로 켠 뒤에만 열리며 끄면 함께 지워진다.
- **원격 provider 직접 호출 차단**: 프록시 경로가 준비되기 전까지 브라우저는 로컬·사설망 endpoint 만 직접 부른다. 원격 주소는 요청 자체가 나가지 않는다.

### Added

- provider 어댑터 2종 — Anthropic Messages (system 최상위 · tool_result 블록 · `input_json_delta` 조립 · thinking budget) / OpenAI Chat Completions (function calling). 외부 SDK 의존 없이 `fetch` + SSE 로 구현해 초기 번들에 SDK 가 들어가지 않는다.

### Tests

- 신규 40건: wire 포맷 대조 (두 어댑터가 같은 스트림 이벤트를 돌려주는지) · 원격 차단 시 `fetch` 미호출 · 키 저장 정책 3분기 · 기존 도구 8종이 이름·스키마 그대로 실리는지 · Agent Loop 도구 전수 통과 + 중단(AbortController) 계약.
- live: 로컬 mock endpoint 를 물려 AI 패널에서 "화면 확대해줘" → `run_command(zoomIn)` 실행 → 화면 zoom 74%→84% 변경 확인.

## [ADR-196 — agent 가 빌더 명령을 이름으로 부른다] - 2026-08-28

### Added

- **AI 어시스턴트가 빌더 명령을 직접 실행한다** (`run_command` 도구): 정렬 6 · 분배 2 · 그룹/해제 · 복제 · 잘라내기/복사/붙여넣기 · z-order 4 · 삭제 · 되돌리기/다시 실행 · 줌 4 · 패널 토글 등 **40개**를 이름으로 부른다. 이전에는 요소 좌표를 스스로 계산해 `update_element` 를 여러 번 부르는 우회뿐이라, 같은 "왼쪽 정렬"이 사람 경로(`canvasActions.alignSelection`)와 다른 의미로 실행됐다.
- **파괴적 명령은 승인 다이얼로그 뒤에만 실행된다**: `삭제` · `잘라내기` · `인스턴스 분리` 등은 사용자가 승인하기 전까지 문서를 만지지 않는다. 거부하면 문서가 그대로다. 승인 UI 가 없는 호스트에서는 실행되지 않고 거부된다 (브라우저 기본 confirm 을 쓰지 않는다).
- **AI 패널에 실행 기록이 보인다**: 호출 1건 = 기록 1건 (실행 · 거부 · 조건 미충족 · 사용자 거절 · 오류 5종), 최근 8건 표시.
- 되돌리기 단위 보장: agent 호출 1건은 history **1 entry** — 사용자 ⌘Z 한 번으로 복원된다 (붙여넣기 포함).

### Architecture

- **명령의 정적 사실을 UI handler 에서 분리** (`builder/config/commandMeta.ts`): 정의 71개 전부에 `agentCallable` / `mutation`(none·view·selection·document·project·external) / `undo`(history·inverse·none·irreversible) / `confirm` / `precondition` 을 명시한다. 새 명령이 이 표를 빠뜨리면 type error.
- **기본 거부 + allowlist**: agent 에게 열린 것은 40개뿐이고, DB/publish/navigation(`external`)·연속키·패널 로컬 state 명령은 닫힌 채 남는다. 정적 게이트 5조항이 "노출됐는데 adapter 없음", "되돌릴 수 없는데 승인 없음", "external 인데 노출", "팔레트 밖인데 노출", "adapter 우회 export" 를 테스트로 막는다.
- **adapter 는 handler 가 부르는 store 심볼을 그대로 부른다** (`services/agent/agentCommands.ts`) — 실행 진입점은 `executeAgentCommand` 하나로, AI 패널 도구 · Chrome MCP DEV 진입점(`window.__compositionAgent`, DEV 빌드 한정) · 향후 MCP 가 같은 경로를 쓴다.
- 키보드 · 명령 팔레트 · `commandRegistry`(ADR-195) 는 **무변경** — 팔레트 62 항목과 단축키 동작이 그대로다. 명령 표면 · 승인 UI · 기록 UI 는 지연 로딩이라 초기 번들 증가는 +1,255B gz.

### Tests

- 정적 게이트 5조항 + 민감도 4건(위반을 넣으면 RED) · adapter 심볼 대조 20 + 금지 심볼 7 · jsdom spy 40 · executor 분기 14 · **history 1 entry 계약 12** (canonical mutation 경로를 재현해 실측 — 등록 없이 재면 z-order·붙여넣기가 조용히 0으로 잡힌다) · descriptor 4.
- live(Chrome MCP) 45 호출: 키보드 경로와 **12쌍 대조 차이 0**, 승인 거부/승인 실측, agent 복제 후 사용자 ⌘Z 1회 복원.

## [Paperthin·Polysona 병합안 — Codex lifecycle adapter 완결] - 2026-08-28

### Infrastructure

- **공용 prompt router를 Codex UserPromptSubmit에 연결**: `.codex/hooks/route-prompt.sh`를 JSON adapter로 축소하고 `scripts/codex/route-prompt.sh`를 단일 분류 정본으로 사용한다. `create-adr`·`execute-adr`·`match-target`의 user-only 경계가 수동 route와 live hook에서 동일해졌다.
- **Codex Stop gate도 공용 evidence ledger에 기록**: spec rebuild와 type-check의 pass/fail/skip, 실패 exit code를 `.agent/runs/<id>/evidence.jsonl`에 append한다. staged·unstaged·untracked TS 파일을 동일하게 감지한다.
- **worktree·nested-cwd-safe hook 경로**: `.codex/hooks.json`의 사용자 절대 경로를 git root 기반 명령으로 바꾸고 JSON의 `cwd`를 canonical repository root로 해석해 checkout/worktree/subdirectory 위치에 종속되지 않게 했다.
- **사용 통계도 현재 catalog에서 파생**: 주간 리포트의 미사용 경고 대상이 제거된 외부 workflow 고정 목록을 읽지 않고 `.claude/skills/*/SKILL.md` 정본에서 자동 파생된다.

### Tests

- **양쪽 host hook self-test**: `pnpm hooks:selftest`가 Claude와 Codex를 모두 검사한다. Codex 쪽은 hooks.json event/type/git-root 경로/실행권한과 그 등록 command 자체, router invocation 경계, SessionStart user-only/subagent 정책, protected-file deny, spec rebuild flag, Stop type-check block과 ledger append를 임시 git workspace에서 exercise한다.
- **catalog gate 확장**: `codex:agent-catalog`가 `.codex/hooks.json`의 핵심 event·등록 스크립트·실행권한, Codex live SessionStart roster와 invocation 정책, 양쪽 host self-test 집계를 함께 검증한다.

## [ADR-117 PathBuilder 전환 — 0.40.0 기준선 + CanvasKit 0.42.0] - 2026-08-28

### Bug Fixes

- **Builder Canvas의 Page title·선택 크기 label 굵기 회귀**:
  - CanvasKit 0.42 direct `Font` 경로가 Pretendard Variable의 requested weight를 glyph 굵기에 반영하지 않아, Page title과 선택 대상 하단의 `width × height`가 이전보다 가늘게 보였다.
  - 두 Skia editor overlay에만 `embolden` font entry를 분리해 적용했다. 또한 Font 크기를 `12/zoom`으로 바꾸던 size label을 Page title과 동일한 `12px Font + canvas 역스케일` 경로로 통일해, 100% 이외 zoom에서도 glyph와 label geometry를 유지한다.
  - 기존 색상·위치는 유지하며 다른 overlay font cache에는 영향을 주지 않는다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts`
- **CanvasKit 준비 전 이미지가 영구 placeholder로 남던 초기화 경합** (ADR-117 Phase 4 / G4):
  - `loadSkImage()`가 CanvasKit 초기화 전에 `null`을 반환하면 `StoreRenderBridge`가 해당 src를 이미 시도한 것으로 기록해 PNG/JPEG/WebP를 다시 로드하지 않았다.
  - **Why**: 문서 store와 WASM 초기화가 병렬로 시작되는데, image cache만 준비 완료를 기다리지 않아 정상 이미지도 mountain placeholder로 고착됐다.
  - 이미지 캐시가 `initCanvasKit()`의 공유 Promise를 기다린 뒤 최초 fetch/decode를 계속하도록 바꾸고, init 실패의 `null` 계약과 teardown generation 무효화를 회귀 테스트로 고정했다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/imageCache.ts`

### Architecture

- **ADR-117 G5 — 재현 가능한 path-heavy canonical 문서**:
  - rounded clip, partial dash/radius border, inset/outset, inner shadow, Icon, placeholder+PNG/JPEG/WebP, slot/overflow marker, 2-page workflow edge를 67 elements dev fixture로 고정했다.
  - `?benchmark=path-heavy-117&edge=orthogonal|bezier`가 동일 canonical 문서를 로드해 0.40.0 baseline과 0.42.0 target이 같은 surface를 사용한다.
  - 위치: `apps/builder/src/builder/dev/pathHeavy117Fixture.ts`
- **CanvasKit immutable Path 전환 완료**:
  - `canvaskit-wasm` 최소 버전을 `^0.42.0`으로 올리고, 20개 path construction site를 `buildPath` 내부의 `PathBuilder` 단일 경로로 구축한다.
  - 0.40.0 fallback·`PathBuilderLike` shim·Path constructor 별칭·`MockPath`를 제거해 설치된 CanvasKit 타입과 런타임이 같은 계약을 사용한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/buildPath.ts`
- **ADR-117 Implemented**:
  - Phase 0~~4 / G0~~G5를 완료했다. desktop 1280×720·mobile 390×844에서 9개 path-heavy 표면, PNG/JPEG/WebP, Orthogonal/Bezier edge·arrow·indicator와 zoom snapshot blit 누락 0을 확인했다.
  - ADR 본문을 `docs/adr/completed/117-canvaskit-pathbuilder-upgrade.md`로 아카이브했다.

### Performance

- **CanvasKit 0.40.0 p95 baseline `9.3 ms`** (ADR-117 G5):
  - 1280×720 / 120 Hz / source page fit 60% / 60→61→60% zoom pulse 조건에서 Orthogonal·Bezier 각 3회 median이 모두 9.3 ms였다.
  - 6회 long task 0, blank frame 0, console error 0. 0.42.0 통과 상한은 +10%인 10.23 ms다.
  - 위치: `docs/adr/design/117-canvaskit-pathbuilder-upgrade-breakdown.md`
- **CanvasKit 0.42.0 p95 `9.3 ms` — baseline 대비 `+0.0%`** (ADR-117 G5):
  - 동일 조건에서 Orthogonal과 Bezier가 각각 `9.3/9.3/9.3 ms`, median `9.3 ms`로 +10% 상한을 통과했다.
  - 6회 long task 0, blank frame 0, FPS 120~121이었다. builder 재사용 fallback은 필요하지 않았다.

### Infrastructure

- **완료 run report 보존 + long-task window 계측**:
  - profiler가 콘솔에만 출력하고 버리던 p95/p99를 `report()`와 DOM evidence에 보존하고, 같은 5초 구간의 long-task count/total/max를 함께 기록한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/benchmarks/devProfiler.ts`
- **CanvasKit 0.42.0 배포 artifact 고정**:
  - lockfile을 `0.42.0`으로 고정하고 `prepare:wasm`이 7,317,345-byte WASM을 배포한다.
  - fresh dev Builder, production dynamic chunk + WebGL surface, type-check, 실 WASM 통합 및 Skia 375 tests를 통과했다.

## [명령 팔레트가 실제로 실행된다 — command registry (ADR-195)] - 2026-08-27

팔레트는 단축키 정의 71개를 전부 나열하면서 그 중 12개만 실행하고 있었다. 나머지 59개는 골라도 팔레트만 닫혔다 — 핸들러가 등록 훅의 `useEffect` 클로저 안에 갇혀 있어 팔레트가 조회할 길이 없었기 때문이다. 등록 훅이 `(id → handler, scope)` 를 store 에 함께 게시하게 만들고, 팔레트는 그것을 읽어 실행한다. 키보드 경로는 한 줄도 바뀌지 않았다.

### Added

- **`commandRegistry` — 실행 축의 단일 소스**: 단축키가 등록될 때 listener 부착과 같은 자리에서 `(id → handler, scope, priority)` 를 게시하고, 컴포넌트가 사라지면 해제한다. 정의(`SHORTCUT_DEFINITIONS`)·표기(`formatShortcut`)에 이어 실행까지 세 축이 모두 한 곳에서 파생된다. 같은 id 가 두 곳에 등록된 경우(`escape`·`detachInstance`)는 우선순위 내림차순 → 나중 등록 순으로 하나를 고른다.
- **실행 가능 여부를 열기 전에 표시**: 항목은 실행 가능 / "어디서 실행되는지" 힌트(예: "캔버스에서 실행할 수 있습니다") / "지금은 실행할 수 없습니다" 세 상태로 나뉜다. 실행할 수 없는 것도 숨기지 않고 흐리게 남겨 단축키를 배우는 자리로 쓴다. 하단 카운트가 "실행 가능 N / 전체" 로 바뀌었다.

### Changed

- **팔레트 목록 71 → 62**: 팔레트 자신과 레이어 트리 8종(방향키·Home/End·Enter·Space)을 뺐다. 트리 키보드는 React Aria 가 포커스된 행에 직접 처리하는 것이라 팔레트가 실행할 대상이 없다.
- **팔레트 자체 핸들러 0**: `executeCommand` 의 switch 12 case 와 패널 레이아웃 의존이 사라졌다. 팔레트는 정의와 registry 만 안다 — 새 단축키를 정의하고 등록하면 팔레트에 자동으로 등장한다.
- **정적 게이트 재정의**: "패널 토글 정의가 팔레트 switch 에 있는가" 조항이 "팔레트에 노출되는 정의 62개가 전부 등록을 갖는가" 로 일반화됐고, 목록에서 빼는 항목이 슬며시 늘지 않도록 allowlist 조항이 추가됐다.

### 검증

라이브 빌더에서 팔레트로 23개 명령을 실제로 실행(줌 3 · 실행 취소/다시 실행 5 · 패널 10 · 눈금자 2 · 모두 선택/선택 해제 · 맨 앞으로 · 복제)했고, 문서를 바꾸는 것은 실행 취소로 원복했다. 키보드 경로 회귀 검사 26/26 · 입력창 포커스 7/7 동일. 번들 +764 B(gzip), 팔레트 목록 판정 0.88 µs.

## [단축키 동작 결함 2건 — ⌥ 문자 변환 · 입력창 차단] - 2026-08-27

깨끗한 서버·캐시로 전수 재점검하며 나온 두 건이다. 둘 다 "표기는 맞는데 눌러도 안 되는" 형태라 화면만 봐서는 드러나지 않는다.

### Fixed

- **⌃⌥M(모니터 패널)이 실물 키보드에서 동작하지 않던 결함**: macOS 는 ⌥ 가 눌리면 `event.key` 를 다른 문자로 바꾸고, 그걸 억제하는 것은 **⌘ 뿐이다 — ⌃ 는 억제하지 않는다**. 실제 key 는 `µ` 인데 정의는 `m` 으로만 맞추고 있었다. ⌥ 계열에 `code` 를 부여할 때 `alt`/`altShift` 만 훑고 `ctrlAlt` 를 빠뜨린 자리다. `cmdAlt` 6건(⌘⌥C/V/K/X)은 ⌘ 가 억제하므로 대상이 아니다.
- **입력창에 포커스가 있으면 전역 진입점이 통째로 막히던 결함**: registry 는 `input`/`textarea`/`contentEditable` 에 포커스가 있으면 `allowInInput` 없는 단축키를 전부 건너뛴다. 값 하나 입력하다가 패널을 못 옮기고 팔레트도 못 여는 상태였다 — 실측(헤더 줌 입력 포커스)에서 `⌥1`·`⌥6`·`⌘/`·`⌘,`·`⌘K`·`⌘O`·`⌃⌥M` 이 전부 무시되고 `allowInInput` 이 붙은 `undo` 만 잡혔다. 패널 토글 8 + 모니터 + 설정 + AI + 팔레트 + 프로젝트 열기 13개에 `allowInInput` 을 부여했다. `⌥`+숫자가 입력창에서 `¡™£¢` 를 만드는 것은 빌더 입력창에 쓸 일이 없고 Figma 도 같은 조합을 가로챈다. 캔버스 scope 명령(정렬 등)은 그대로 — 입력창에서 scope 가 갈리는 것이 맞다.

### Added

- **정적 게이트 조항**: `modifier` 에 `alt` 가 들어 있고 `cmd` 로 시작하지 않는 정의는 `code` 필수. synthetic 입력은 macOS 의 문자 변환을 재현하지 않아 런타임 검사로는 영영 안 잡히는 종류라 정적으로 막는다.

### 확인

- `⌘O` 는 실물 키보드에서 Chrome 「파일 열기」를 띄우지 않고 프로젝트 목록으로 이동한다 (사용자 확인).
- 재점검 전수 결과 — 툴팁 16/16(레일 10 + 헤더 6), 헤더 메뉴 표기 3/3, 팔레트 71개 표기 이상 0, 팔레트 패널 명령 실행 3/3, 단축키 동작 26/26.

## [팔레트 키 표기 · Open Project 연결] - 2026-08-27

### Fixed

- **팔레트·컨텍스트 메뉴의 이름 있는 키 표기 21건**: 표기 경로는 이미 정의 파생이었는데 `formatShortcut` 이 `key.toUpperCase()` 만 해서 `ArrowUp` 이 `ARROWUP`, `Backspace` 가 `BACKSPACE`, `Tab` 이 `TAB` 으로 나왔다. 화살표는 양쪽 플랫폼 공통 기호(`↑↓←→`), `⌫`/`⌦`/`⇥`/`↵` 는 Mac 만 기호이고 그 밖에서는 단어다 — Windows 사용자가 Mac 키캡 관례를 읽을 근거가 없다. `treeSelectSpace` 는 키가 공백 한 칸이라 아무것도 안 보이던 것을 `Space` 로.
- **팔레트에서 골라도 아무 일이 없던 패널 명령 3개**: `⌥3` DataTable · `⌥4` Theme · `⌘K` AI. 이번 재배치로 정의만 늘고 팔레트 `executeCommand` 가 안 따라와서, 목록에는 뜨는데 고르면 팔레트만 닫혔다.

### Added

- **「프로젝트 열기」 `⌘O`**: 헤더 메뉴에 표기만 있고 정의·등록·핸들러가 셋 다 없어 눌러도 아무 일이 없던 항목이다. 메뉴 클릭과 `⌘O` 가 같은 동작(프로젝트 목록으로 이동)을 부르고, 팔레트에서도 실행된다. Figma·Sketch 가 같은 자리에 둔 조합이고 Chrome 의 "파일 열기" 는 페이지가 막을 수 있다.
- **정적 게이트 조항 3**: `panels` 카테고리 정의는 전부 팔레트 `executeCommand` 에 실행 경로가 있어야 한다. 정의만 늘고 팔레트가 안 따라오는 형태를 막는다.

### 알려진 상태

- 팔레트는 정의 71개를 나열하지만 실제로 실행되는 것은 **12개**(패널 토글 11 + 프로젝트 열기)다. 나머지는 캔버스·속성·트리 명령이라 각자 포커스 컨텍스트에서만 뜻이 있고, `executeCommand` 의 `default` 가 아무것도 안 한다. 표기 축과는 별개 문제이며 이번 범위 밖.

## [단축키 표기 SSOT 통일 · 헤더 툴팁] - 2026-08-27

단축키 자체는 정의 하나로 모여 있었는데 **화면에 찍히는 문자열**은 그렇지 않았다. 패널 설정이 표기를 따로 들고 있었고 헤더 메뉴는 JSX 에 직접 적어, 정의를 옮겨도 표기가 안 따라오는 구조였다. 표기를 전부 정의에서 파생시키고 정적 게이트를 걸었다.

### Fixed

- **top header 토글 그룹에 툴팁이 없던 문제**: 좌우 레일 토글은 hover 시 툴팁이 뜨는데 헤더의 뷰포트 3종(Desktop/Tablet/Mobile) + 보기 옵션 3종(Compare/Workflow/Monitor)은 `TooltipTrigger` 자체가 없었다. 여섯 개 모두 부착했고, Monitor 는 등록돼 있던 `⌃⌥M` 이 함께 나온다 — bottom 레일이 없어 이 단축키는 화면 어디에도 표기가 없었다.
- **정의와 어긋나 있던 패널 표기 2건**: 설정 `Ctrl+,`(정의는 `⌘,`)·모니터 `Ctrl+Alt+M`(정의는 `⌃⌥M`) — Mac 표기조차 아니었다.
- **표기가 빠져 있던 5건**: AI 패널 레일 툴팁(`⌘K` 등록됨), Styles·Properties 패널의 복사·붙여넣기 4개 버튼(`⌘⌥C`/`⌘⌥V` 등록됨). 전부 라벨만 나오고 있었다.
- **`logShortcuts` 의 두 번째 심볼 표**: `ctrl` 계열이 Mac 에서도 `Ctrl` 로 굳어 `formatShortcut`(`⌃`)과 달랐다. 표기 함수 하나로 합쳤다.
- **대시보드 검색 힌트 `⌘K` 고정 표기**: 비-Mac 에서도 `⌘K` 가 나왔다. `formatShortcut` 파생으로 바꿔 `Ctrl+K` 가 된다.

### Changed

- **`PanelConfig.shortcut?: string` → `shortcutId?: ShortcutId`**: 패널 레일 툴팁의 표기가 정의에서 파생된다. 오타는 `ShortcutId` union 이 컴파일 시점에 잡는다.
- **툴팁 마크업 단일화**: 같은 마크업이 `ActionIconButton` 과 `PanelToggleGroup` 에 두 벌 있던 것을 `ActionTooltip` 하나로 모았다 (CSS 도 `ActionTooltip.css` 로 분리). 레일 툴팁에 화살표가 붙는 것이 시각 변화.

### Removed

- **헤더 메뉴의 `⌘O`**: 정의도 등록도 핸들러도 없는 표기였다 (메뉴 `onAction` 이 `open` 키를 처리하지 않는다). 같은 메뉴의 Settings 에는 실제로 등록된 `⌘,` 를 추가했다.

### Added

- **정적 게이트 `shortcutDisplay.static.test.ts`** 2조항 — ① `⌘`/`⌥`/`⇧`/`⌃` 리터럴은 `formatShortcut` 안에만 (주석·테스트 제외) ② `panels` 카테고리 정의는 전부 `PanelConfig.shortcutId` 로 이어진다. 표기가 다시 갈라지면 위반 파일·줄을 지목하고 실패한다.

## [단축키 재배치 — Figma·Pencil 규약 정합] - 2026-08-27

정의 70개를 Figma·Photoshop·Pencil 과 액션 단위로 대조해 재배치했다. 기준은 "이미 아는 손을 다시 가르치지 않는 자리" 이고, 브라우저가 먼저 가져가는 조합을 피했다. 눌러도 반응하지 않던 11개가 0개가 됐다.

### Changed

- **정렬 6종을 ⌥ 계열로**: `⌘⇧L/H/R/T/M/B` → `⌥A/H/D/W/V/S`. Figma 와 Pencil 이 완전히 같은 규약을 쓰는 자리다. 종전 조합 중 `⌘⇧R`(Chrome 강력 새로고침)·`⌘⇧T`(닫은 탭 복원)는 브라우저가 먼저 가져가던 자리였다.
- **분배 두 축을 같은 계열로**: 가로 `⌘⇧D`(모든 탭 북마크) → `⌥⇧H`. 세로 `⌥⇧V` 와 축이 맞아 "정렬 키에 ⇧ 하나 더" 규칙이 된다.
- **속성·스타일 복사를 `⌘⌥C`/`⌘⌥V` 로**: Figma 의 「속성 복사·붙여넣기」자리이고 composition 정의에도 원래 이 조합이 있었다(등록만 어긋나 있었다). 종전 `⌘⇧C` 는 Chrome DevTools 요소 검사라 페이지가 막을 수 없는 자리였다. 어느 패널에 포커스가 있느냐로 대상이 갈리는 구조(properties=D2 props / styles=D3 시각 스타일)는 그대로다.
- **패널 토글을 `⌥1`–`⌥8` 로**: 레일 순서 그대로 (좌측 Nodes·Components·DataTable·Theme → 우측 Properties·Styles·Interactions·History). Figma 가 사이드바를 `⌥1`–`⌥3` 으로 돌리는 규약의 확장이고, ⌥ 계열은 브라우저가 예약하지 않는다.
- **`⌘K` 를 AI 패널로, 명령 팔레트를 `⌘/` 로**: Pencil 이 `⌘K` 를 AI 채팅에 쓴다. 팔레트는 Figma 가 같은 성격의 actions menu 를 둔 자리로 옮겼고, 종전에는 정의 없이 등록만 있어 팔레트 자기 목록에도 나오지 않던 것을 정의로 올렸다.

### Added

- **미연결 단축키 11개 연결**: 패널 토글 6개 + 설정(`⌘,`) + `Tab`/`⇧Tab` 형제 이동. 전부 정의는 있는데 등록이 없어 눌러도 아무 일도 일어나지 않던 것들이다. `Tab` 은 방향키가 맡은 형제 "순서 재배치" 와 겹치지 않는 "선택 이동" 이다 (Figma 와 같은 용도).
- **DataTable(`⌥3`) · Theme(`⌥4`) 패널 토글** 신규.
- **선택에 맞추기 `⇧2`**: Figma·Pencil 이 같은 자리에 둔 액션. 선택 bounds 를 호출 시점에 계산해 화면 중앙에 맞춘다.

### Fixed

- **⌥ 조합이 실물 키보드에서 동작하지 않던 결함**: macOS 에서 `⌥A`→å, `⌥S`→ß, `⌥⇧V`→◊ 로 `event.key` 가 바뀌는데 `key` 로만 맞추고 있었다. 세로 분배(`⌥⇧V`)가 그 상태였고, synthetic 입력은 이 변환을 거치지 않아 검사에서 "등록됨" 으로 보였다. ⌥ 계열 전체를 `code` 매칭으로 바꿨다. `⌘`/`⌃` 가 붙은 조합은 문자 변환이 억제돼 영향이 없다.
- **StylesPanel 단축키가 모달 위에서도 동작하던 결함**: 등록부가 조합을 손으로 적으면서 scope 를 빠뜨려 registry 가 global 로 간주하고 있었다. 정의 경유로 통일했다.
- **정의와 실제가 어긋나 있던 5건**: 포커스 모드는 정의 `⌘F` ↔ 실제 `⌥⇧S`, 섹션 접기는 정의 2개(`⌘E`/`⌘W`) ↔ 실제 토글 1개였다. 정의를 실제에 맞추고 둘을 `toggleSections`(`⌥⇧E`) 하나로 합쳤다.

### Removed

- **유령 정의 4개**: `copyAllProperties`/`pasteAllProperties`(동작이 `copy`/`paste` 와 같은데 아무도 그 정의를 읽지 않았다), `eventsNavUp`/`eventsNavDown`(ADR-158 로 InteractionsPanel 이 들어오며 소비처 소멸).

## [패널 헤더 close · 단축키 도움말 정리] - 2026-08-27

### Added

- **Settings · 명령어 팔레트 헤더 우측 close 버튼**: 두 패널만 `PanelHeader` 의 `actions` 가 비어 있어, 다른 패널(History/AI/Theme/DataTable Editor)과 같은 `.panel-actions` 경로로 맞췄다. Settings 는 `hiddenFromRail: true` 라 레일 토글로 닫을 수 없어 패널 안에 닫기 수단이 없었고, 팔레트는 esc·오버레이 클릭만 있었다.

### Removed

- **`KeyboardShortcutsHelp` 치트시트 삭제 — 단축키 조회를 ⌘K 팔레트로 일원화**: 열 수 있었던 적이 없는 화면이다. 트리거 정의 `toggleHelp` 이 `key:"?" + modifier:"cmd"` 였는데 `cmd` 분기는 `!event.shiftKey` 를 요구하고 `?` 는 Shift 없이 만들어지지 않아 어떤 입력으로도 매칭되지 않았고, 그 위에 `.keyboard-shortcuts-help` 계열 클래스 25종의 CSS 가 코드베이스 어디에도 정의된 적이 없어 강제로 열어도 Properties 패널 안에 스타일 없는 2199px 블록으로 흘러 화면 밖에 그려졌다. 같은 `SHORTCUT_DEFINITIONS` 를 읽어 검색·실행까지 제공하는 ⌘K 팔레트가 이미 상위 호환이라 복구 대신 제거했다 (`components/help/` 디렉터리, `PropertiesPanel` 의 state·단축키 등록·렌더, `toggleHelp` 정의). 팔레트 명령어는 71 → 70 개.

## [선택 행동의 body 필터 — 정렬·분배·그룹] - 2026-08-27

### Bug Fixes

- **⌘A 선택에서 정렬·분배가 페이지 body 까지 대상으로 삼던 결함**: `alignSelection`/`distributeSelection` 이 `selectedElementIds` 를 그대로 넘겨, 페이지 루트에 `left`/`top` 이 기록되고 body 의 bounding box(페이지 전체)가 기준이 돼 나머지 요소의 정렬 결과까지 어긋났다. 복제·삭제가 쓰던 body 판정을 공용 헬퍼로 뽑아 세 경로에 적용한다.
- **⌘G 가 body 를 새 frame 의 자식으로 넣던 결함**: 컨텍스트 메뉴는 body 가 섞인 선택에 "그룹 만들기" 를 만들지 않지만 단축키는 그 관문을 거치지 않아, `createGroupFromSelection` 이 페이지 루트를 reparent 했다. 같은 필터를 `groupSelection` 에도 적용한다.
- **정렬·분배 노출 판정을 body 를 뺀 개수로**: body + 요소 1개 선택에서는 정렬 서브메뉴 자체가, body + 요소 2개에서는 분배 항목이 조건 미충족이라 노출되지 않는다 (조건 미충족 항목은 숨긴다는 ADR-182 노출 정책). body + 요소 1개 선택은 정렬·분배·그룹이 모두 빠져 액션 바도 뜨지 않는다 — 이전에는 떴지만 그때 노출되던 정렬이 페이지 루트에 좌표를 쓰는 쪽이었다.

## [코드리뷰 잔여 3건 — dark 팔레트 · 패널 gutter] - 2026-08-27

### Bug Fixes

- **dark 모드 빌더 chrome 에서 rename 이 되살린 raw 팔레트 9곳**: `58f5b1f08` 의 `danger→error` / `secondary→tertiary` 리네임이 어디에도 정의된 적 없던(=선언이 죽어 있던) 변수를 dark 대응이 없는 raw 팔레트의 live 참조로 바꿨다. 빌더 라우트는 `data-builder-theme` 만 세우므로 `semantic-palette.css` 의 `[data-theme="dark"]` 단계 반전이 닿지 않아, dark 에서 light 단계가 그대로 남았다 (SelectionMemory 의 삭제 아이콘은 어두운 표면 위 red-600 이라 특히 읽기 어려웠다).
  - 삭제 아이콘·invalid 테두리 → `--negative` (빌더 chrome 이 이미 파괴적 동작에 쓰는 토큰: dashboard · Interactions · AI · History · Toast).
  - 오류 칩 → `--negative` 12% color-mix 배경 + 신규 `--fg-on-negative` (light red-600 / dark red-200). `--negative-subtle` 을 빌더 범위에서 덮으면 같은 이름을 읽는 shared 컴포넌트(Table/ListBox/ActionList/EventSection/CollectionErrorState)까지 함께 바뀌므로 `--fg-on-notice` 와 같은 규약의 chrome 전용 이름을 새로 둔다.
  - DataTable 배지 `page`·`PATCH` → `--hue-purple-subtle` / `--hue-purple` (`a39220836` 의 Table tertiary 전환과 같은 경로).
- **패널 gutter 가 두 단위로 갈려 있던 결함**: CSS 는 `--panel-workspace-gap: var(--spacing-xs)`(0.25rem), 레이아웃 계산은 `PANEL_WORKSPACE_GAP = 4`(px) 였다. 기본 16px 루트에서만 값이 같고, 브라우저 기본 글꼴 크기를 키우면 chrome↔stage·rail↔surface 간격만 커져 패널 사이 간격과 어긋난다. CSS 를 `4px` 로 고정하고 두 값을 정적 테스트로 묶었다.

## [ADR-192/182 코드리뷰 수정 3묶음 — 액션 정합] - 2026-08-27

### Bug Fixes

- **⌘D·붙여넣기가 flow/flex 자식에 `left/top` 을 심던 결함**: 좌표가 없는 원본에도 offset 을 주입해, 렌더는 그대로인데 Style 패널이 그 값을 사용자 편집으로 표시하고 ⌘D 를 반복할수록 10px 씩 누적됐다 (나중에 absolute 로 바꾸면 그만큼 튄다). 같은 파일의 ref 경로가 이미 갖고 있던 판정을 공용 헬퍼로 뽑아 붙여넣기 경로에도 적용한다.
- **모달이 열린 상태에서 ⌘D 가 뒤의 캔버스 선택을 복제하던 결함**: 등록에 scope 가 없어 registry 가 global 로 간주했다. Figma/Pen 처럼 "선택을 만든 자리" — 캔버스와 레이어 트리 — 에서만 발동하고, 선언 계약(`keyboardShortcuts.ts`)도 같은 값으로 맞췄다.
- **패널 포커스 판정이 늘 폴백으로 떨어지던 결함**: `useActiveScope` 가 읽는 `data-panel-id` 를 아무도 내보내지 않아, 좌측 레이어 트리에 포커스를 둬도 "보이는 첫 우측 패널"(예: 스타일)로 scope 가 잡혔다. 패널 콘텐츠 루트가 자기 id 를 내보낸다 — 이제 포커스가 있는 패널이 우선한다.
- **2개 선택에서 분배 버튼 2개가 무반응이던 결함**: `distributeSelection` 은 3개 미만에서 즉시 return 하는데 정렬 서브메뉴는 개수와 무관하게 분배를 만들었다. 3개부터 노출한다 (조건 미충족 항목은 숨긴다는 ADR-182 노출 정책).
- **단일 선택 컨텍스트 메뉴의 "그룹 만들기" 가 아무 일도 하지 않던 결함**: `groupSelection` 은 2개 이상에서만 실행한다. 2개부터 노출한다.
- **빈 구간을 사이에 둔 구분선이 두 줄로 그려지던 결함**: 섹션이 통째로 비면 앞뒤 구분선이 맞붙었다 (body 단독 선택은 이전부터, 단일 선택은 위 group 정리로 새로 발생). 조합마다 조건을 다는 대신 메뉴 조립 지점에서 맨 앞·맨 뒤·연속 구분선을 한 번에 정리한다 — 컨텍스트 메뉴와 액션 바 ⋯ 두 표면이 같은 결과를 본다.

## [ADR-192 액션 바 코드리뷰 수정 2묶음 — 배치·포커스] - 2026-08-27

### Bug Fixes

- **저장된 바 위치가 화면 밖이면 복구할 방법이 없던 결함**: 마운트 시 clamp 가 실행된 적이 없었다 — 훅이 마운트되는 시점에는 바 DOM 이 아직 없어(선택 0 / 편집 중 / Hide → 미마운트) 측정이 null 로 끝났고, 바가 나타나도 effect 의존이 그대로라 재실행되지 않았다. 큰 창에서 우측 끝으로 옮긴 뒤 작은 창에서 열면 바가 잘려 ⋯ 옵션 메뉴(Reset 유일 경로)에도 닿을 수 없었다. 바 노드를 state 로 들어 **나타나는 시점에 clamp** 하고, 이후 크기 변화(컨텍스트 전환으로 항목 수가 바뀌거나 패널 도크 리사이즈로 overlay 가 변할 때)는 ResizeObserver 로 잡는다.
- **바를 드래그해 놓을 때마다 React DEV 오류가 나던 결함**: 드롭 commit 이 `setDragOffset` updater 안에서 store 를 써서, 그 updater 가 render phase 에 실행되는 보통의 드롭에서 "Cannot update a component while rendering a different component" 가 났다. 확정 값을 ref 에 두고 commit 은 이벤트 핸들러 본문에서 한다.
- **바의 여백을 클릭하면 캔버스 단축키가 침묵하던 결함**: 루트 padding · 툴바 gap · separator · 툴팁 wrapper 는 포커스를 받을 수 없어 클릭 시 포커스가 body 로 빠지고, `canvas-focused` 단축키(⌫ · 화살표 · ⌘G · ⌘D …) 가 캔버스를 다시 클릭할 때까지 전부 무반응이었다. 버튼이 이미 쓰던 규약(`preventFocusOnPress`) 을 바 전체로 넓혀 mousedown 의 기본 포커스 이동을 막는다 (click 은 그대로 동작).

## [ADR-192 액션 바 코드리뷰 수정 1묶음 — 문서 손상·키보드·바 소실] - 2026-08-27

### Bug Fixes

- **body 단독 선택에서 ⌘D 가 지울 수 없는 두 번째 body 를 만들던 결함**: `duplicateSelection` 의 `multiSelectMode` 게이트가 제거되면서 body 선택이 복제 경로에 처음 도달했다. 씬은 두 번째 body 를 버려 자손이 고아가 되지만 문서·IndexedDB 에는 남고, `deleteSelection` 이 body 를 거부해 undo 외엔 제거할 수 없었다. 삭제 경로와 같은 body 필터를 복제에도 적용한다 (body 가 섞인 ⌘A 선택은 나머지만 복제).
- **⌘A 선택에서 액션 바가 한 번도 뜨지 않던 결함**: 바의 "body 만 선택" 판정이 `group` 항목 부재였는데, 182 provider 는 선택에 body 가 하나라도 섞이면 `group` 을 만들지 않는다. 판정 키를 `toggle-component-origin` (단일 && non-body 에만 생성) 으로 바꿔, ⌘A·페이지 타이틀 shift 클릭에서도 정렬·복제가 노출된다. 단일 선택에서 결정적 no-op 인 `group` 항목에 컨텍스트 판정 전체가 매달려 있던 의존도 함께 해소.
- **키보드로 액션 바에 들어가면 ←/→ 가 요소 순서를 바꾸던 결함**: 바 버튼의 `data-scope="canvas"` 때문에 `canvas-focused` 형제 재배치가 툴바 탐색과 함께 동작했다. 오버레이가 자기 스코프를 선언하는 `data-shortcut-scope` 를 도입해 (`useActiveScope`), 바는 포커스가 안에 있는 동안 `global` 로 판정된다.
- **액션 바에서 Escape 가 선택을 지워 툴바를 떠날 수 없던 결함**: ADR-192 R2 의 "Tab 진입 → Escape 로 캔버스 복귀" 가 구현에 없어 전역 escape 가 선택을 해제하고 바를 언마운트시켰다. 바가 Escape 를 받아 선택을 유지한 채 캔버스 컨테이너로 포커스를 되돌린다 (캔버스에서 다시 Escape 하면 기존대로 선택 해제).
- **텍스트 편집 중 캔버스가 사라지면 액션 바가 영구히 안 뜨던 결함**: 싱글턴 `isEditing` 이 completeEdit/cancelEdit 로만 내려가 브라우저 Back·compare 모드 토글 같은 비-마우스 경로에서 true 로 남았다. `useTextEdit` 언마운트 시 플래그를 회수한다 (실시간 반영된 텍스트는 되돌리지 않는다 — 언마운트는 취소 제스처가 아니다).

### Tests

- `Workspace.mode.test.tsx` 가 액션 바의 provider 요구로 HEAD 에서 실패하던 회귀 수정 (다른 자식과 같은 방식으로 대체). `canvasActions.test.ts` 의 spy 누수 (복원 대상에 `addElement`/`setSelectedElements` 누락) 도 함께 수정 — 다음 테스트가 앞 테스트의 호출 기록을 물려받고 있었다.

## [Dashboard 프로젝트 생성 진입점 복구 — Empty-state action priority] - 2026-08-27

### Bug Fixes

- **프로젝트가 0개일 때 상단과 빈 상태의 `New project` 버튼이 모두 무반응이던 결함**:
  - **Why**: 두 버튼은 `isCreating`을 활성화했지만 이름 입력 `CreateProjectTile`이 프로젝트 목록 분기 안에만 있어, 그보다 먼저 선택되는 `No projects yet` 분기가 입력을 계속 숨겼다.
  - 수정: 생성 action state를 empty-result보다 우선 렌더해 프로젝트가 없거나 현재 필터 결과가 비어 있어도 동일한 inline 이름 입력으로 진입한다.
  - 검증: 프로젝트 0개 fixture에서 상단·empty-state 버튼 각각의 입력 노출을 UI 테스트로 고정하고, 실제 Dashboard에서 두 경로의 입력 표시와 자동 focus를 확인했다.
  - 위치: `apps/builder/src/dashboard/{index.tsx,__tests__/Dashboard.projectCreation.test.tsx}`

## [ADR-193 후속 — status `-strong` 토큰 4종] - 2026-08-27

### Added

- **`{color.negative|positive|informative|notice-strong}`** — subtle 배경 위 텍스트 역할 (light 900 / dark 200, Tailwind `bg-red-100 text-red-900` 관행). `semanticPaletteMap.ts` 표 4행 → Skia `colors.ts` + 생성 `semantic-palette.css` + 매핑 2 파일. Table `error` 선택/체크박스 텍스트와 컬렉션 에러 메시지가 color-mix 근사 대신 팔레트 단계 (light red-900 = 이전 값 그대로) 를 쓴다. Table `tertiary` 는 `--color-tertiary-100/900` → `--hue-purple-subtle` / `--hue-purple` (named hue 에는 `-strong` 행이 없어 텍스트는 base hue — light purple-900 → purple-600).

## [ADR-193 후속 — 범위 밖 발견 3건 수정] - 2026-08-27

### Bug Fixes

- **publish 에서 neutral 계열 색이 전부 투명하던 결함** (`3e1db3357`): neutral 프리셋이 팔레트 기본값 `neutral` 일 때 publish 가 `--color-neutral-N: var(--color-neutral-N)` 자기 참조를 emit → CSS 순환으로 변수 11개 무효 → Badge gray 등 neutral 소비 CSS 가 transparent. 프리셋이 기본값이면 alias 를 emit 하지 않는다.
- **Badge chartreuse/celery/seafoam/brown/cinnamon/silver 의 hover/pressed 색이 없던 결함** (`7a0cef175`): 매핑에 purple hover/pressed 만 있어 나머지가 `var(--chartreuse-hover)` 같은 미정의 var 로 나갔다. status·named hue 전 토큰의 `-hover/-pressed` 를 semantic var 기준 `color-mix` 로 파생 (tokenResolver + catalog inline 경로 동일). Meter `--fill-color` 도 catalog 표에서 `--informative/--positive/--notice` 로 (dark 추종).
- **dark 모드에서 error 상태 UI 가 light 색으로 남던 결함** (`1bed1623a`): Table `error` variant 선택/체크박스, ListBox error container, ActionList·EventSection 삭제 hover, 컬렉션 에러 상태 박스가 `--color-error-100/900`·`--color-red-*` 직접 참조 → `--negative-subtle`/`--negative`/`color-mix(var(--negative), var(--fg))` 파생으로 전환. light 는 근사 유지 (선택 텍스트 red-900 → 148,34,40, 에러 박스 bg red-50 → red-100).

## [ADR-193 — 테마별 semantic·named hue 팔레트 단계 매핑 단일 원천화] - 2026-08-27

### Changed

- **dark 모드 Preview/Publish 의 상태·named hue 색이 Builder 캔버스와 같은 단계로 이동** (ADR-193 Implemented): 지금까지 CSS 는 `{color.positive}` 류 catalog 토큰 24 종 (+subtle 22) 을 `var(--color-green-600)` 처럼 팔레트 var 에 고정해 dark 에서도 light 색을 그대로 썼고, Skia 캔버스만 한 단계 밝은 dark 값 (green-600 → 500, red-500 → 400, subtle 100 → 900) 을 그렸다. 이제 `packages/specs/src/primitives/semanticPaletteMap.ts` 표 1개 (status 4 + named hue 19, 각 +subtle, light/dark `(family, step)`) 에서 Skia `colors.ts` 와 생성 CSS `theme/generated/semantic-palette.css` (`:root` / `[data-theme="dark"]`, `pnpm generate:palette`) 가 함께 파생된다. dark 프로젝트에서 Badge/StatusLight/Meter/InlineAlert/Toast 등의 positive·informative·notice·negative 와 purple/indigo/… 17종 + subtle 배경이 캔버스와 동일 (live 11 probe Δ0). **light 는 변경 0** (변경 전후 computed 17 probe diff 0).
- catalog/tokenResolver 매핑은 semantic var 이름만 고른다 — `{color.positive}` → `var(--positive)`, named hue 는 `var(--hue-indigo)` (`--indigo` 는 tint preset 이 점유해 접두 필수). preview-system 의 손 `--negative` 정의는 생성 파일로 이관 (`--negative-pressed`·forced-colors 잔류). ThemeStudio 의 팔레트 var override 는 그대로 흘러간다 (생성 CSS 는 hex 0, 참조만).

### Bug Fixes

- **Badge `gray` variant 가 Builder 캔버스에서 보이지 않던 결함**: Skia `colors.ts` 에 `gray`/`green-named` 항목이 없어 `resolveColor("{color.gray}")` 가 undefined → 빈 선택 박스만 렌더. 표에 행을 추가해 light neutral-500 / dark neutral-400 으로 그린다 (CSS 와 동일).

### 범위 밖 발견 (기록만)

- publish 앱 `App.tsx:165` 가 neutral 프리셋이 `neutral` 일 때 `--color-neutral-N: var(--color-neutral-N)` 자기 참조를 emit → publish 문서에서 `--color-neutral-*` 전부 무효 (Badge gray 등 neutral 소비 CSS transparent). Builder → Preview 는 hex 직접 전송이라 무관. publish 는 별도 안정화 대상.
- catalog `{color.{hue}-hover/-pressed}` (purple 외) 는 tokenResolver 항목이 없어 `var(--chartreuse-hover)` 류 미정의 var 로 emit — Skia 미소비 (hover 는 Preview D1 소관), review l2 와 함께 후속.

## [ADR-192 — Contextual Action Bar] - 2026-08-27

### Added

- **선택 액션 바** (ADR-192 Implemented, Photoshop Contextual Task Bar 모델): 요소를 선택하면 캔버스 하단 중앙에
  플로팅 바가 뜨고 선택 컨텍스트별 액션을 아이콘으로 노출한다 — 단일: 복제·컴포넌트 만들기↔해제 / frame: 그룹 해제·복제·
  컴포넌트 토글 / 인스턴스: 원본으로 이동·인스턴스 분리·복제 / 다중: 정렬(8종 popover)·그룹 만들기·복제·인스턴스 분리.
  항목은 ADR-182 우클릭 메뉴 provider 의 부분집합이라 액션 논리 신규 0, `⋯` 는 같은 메뉴를 버튼 위치에서 연다.
  body 만 선택·빈 선택·텍스트 편집 중에는 사라진다 (Photoshop 자동 숨김). 좌측 핸들 드래그 이동, `⋮` 옵션 메뉴로
  위치 고정(Pin)·초기화(Reset)·숨기기(Hide), 숨긴 뒤에는 Settings 패널 "선택 액션 바 표시" 로 되돌린다. 위치·고정·숨김은
  localStorage 에 유지된다. 바 버튼 클릭 후에도 캔버스 단축키 scope 가 유지된다.

## [ADR-182 후속 — 단일 선택 복제 no-op 수정] - 2026-08-27

### Bug Fixes

- **요소 1개를 선택하고 복제 (우클릭 메뉴 "복제" / `⌘D` / ADR-192 액션 바) 하면 아무 일도 일어나지 않던 결함**:
  `canvasActions.duplicateSelection` 이 다중 선택 모드(`multiSelectMode`) 밖에서는 조용히 반환했다 — ADR-182 가
  단축키 핸들러의 다중 선택 전용 게이트를 공유 액션 계층으로 그대로 옮긴 것이 원인. 게이트를 제거해 단일 선택에서도
  +10/+10 오프셋 복제 + 새 요소 선택이 동작한다. 그룹/정렬/분배의 2+ 게이트는 그대로. (ADR-192 Phase 2 live 검증 중 발견)

## [ADR-191 잔여 정리 — named hue 17종 Skia↔CSS 동일 단계, M3 dead 경로 삭제] - 2026-08-27

### Bug Fixes

- **Badge/StatusLight 의 indigo·cyan·pink·fuchsia·magenta·celery·chartreuse 색이 Builder 캔버스와 Preview 에서
  달랐고, seafoam·cinnamon·brown·silver 는 양쪽 다 정의가 없던 결함** (`58f5b1f08`):
  - Skia `colors.ts` 는 v3 hex 리터럴, CSS 매핑(`colorTokenToCss.ts`/`tokenResolver.ts`)은 손으로 적은 oklch,
    Spectrum 전용 4종은 CSS `var(--seafoam)` 처럼 어디에도 정의 없는 var 참조 + Skia 항목 부재.
  - **Why**: named hue 층이 팔레트 SSOT 밖에서 소비자별로 따로 적혀 있었다.
  - 수정: 양쪽을 같은 `(family, step)` 팔레트 참조로 — v3 표와 6자리 정확 일치로 이름 확정 (indigo-700, cyan-600,
    pink-600/700, fuchsia-600, lime-600/500 …), Spectrum 전용 hue 는 최근접 family 로 고정 (turquoise teal-500,
    seafoam teal-700, cinnamon amber-800, brown yellow-900, silver gray-400). **사용자-가시**: 해당 variant 색이
    Builder 캔버스 = Preview 로 일치하며 v4 팔레트 값으로 이동, seafoam/cinnamon/brown/silver 가 처음으로 렌더된다.
  - 게이트: `semanticAlias.symmetry.test.ts` 43건 (named 17 + subtle 16 + status/primary/tertiary alias).
- **빌더 chrome 의 `--color-danger-*` 5 / `--color-secondary-*` 4 undefined 참조** → `--color-error-*` /
  `--color-tertiary-*` (AddPageDialog 오류 표시, SelectionMemory clear 버튼, DataTable page/PATCH 배지).

### Architecture

- `shared-tokens.css` `--color-primary-*`(v3 blue hex 11)·`--color-tertiary-*`(v3 purple hex 10) → blue/purple
  팔레트 alias. 이제 `--color-*` 손 hex 는 custom `--color-zinc-850` 하나뿐.
- M3 dead 경로 삭제 (사용자 승인): `canvas/utils/cssComponentColors.ts`(`--primary`·`--on-surface` 등 어디에도 정의
  없는 M3 var 를 읽어 항상 fallback 반환)·`canvas/hooks/useThemeColors.ts`(소비자 0)·`cssVariableCore.FALLBACK_COLORS`.
  `skiaOverlayBuilder` 의 `--border` fallback 은 팔레트 neutral-300 으로.
- `PanelWorkspace.static.test` 를 `ef3871266`(rail 폭 내용 결정) 의도에 맞게 갱신 — 기존 실패 1건 해소.

## [ADR-191 후속 — semantic alias 층 Skia↔CSS 대칭, 토큰 중복·v3 hex 리터럴 정리] - 2026-08-27

### Bug Fixes

- **status 색이 Builder 캔버스와 Preview 에서 달랐던 결함** (ADR-191 후속 A, `b785315e8`):
  - `shared-tokens.css` 의 `--color-{success,warning,error,info}-N` 40개가 손으로 적은 hsl ramp 라
    Skia(`colors.ts`)가 보는 팔레트와 값이 달랐다 — warning 은 amber 계열, negative 는 error-400 vs red-500.
  - **Why**: ADR-191 이 팔레트 정의는 단일화했지만 그 위 semantic 층은 두 소비자가 따로 정의하고 있었다.
  - 수정: success→green / warning→orange / error→red / info→blue 팔레트 alias (50~950), `preview-system.css`
    `--negative` 를 light red-500 / dark red-400 으로 `colors.ts` 와 정렬. **사용자-가시**: Preview/Publish 의
    Badge/StatusLight/Meter `negative`·`notice`·`informative` 와 warning/error/info 계열 200+ 참조 색이 Builder
    캔버스와 같은 값으로 바뀐다 (notice 는 amber → orange).
  - 게이트: `packages/specs/src/primitives/__tests__/semanticAlias.symmetry.test.ts` — catalog 매핑 → alias →
    fallback 체인을 따라가 최종 팔레트 hex 가 `lightColors/darkColors` 와 같은지 확인 (한쪽만 고치면 RED).

### Architecture

- **축 일치 리터럴 중복 18곳 → 기존 토큰 참조** (ADR-191 후속 B, `18f317b9f`): `--cb-gap`/`--radio-gap`/
  `--switch-gap` 8·12px → `--spacing-sm/md`, `--skeleton-font-size` → `--text-*`, `--link-color` #000/#fff →
  `--color-black/white`, `--panel-workspace-gap` 4px → `--spacing-xs`. computed 값 동일. generated CSS 29건은
  catalog 숫자값의 파생이라 제외, 값 0·의미 불일치 매칭 11건도 제외 (commit 본문에 사유).
- **팔레트 정의 파일 밖 v3 hex 리터럴 45곳 정리** (ADR-191 R8, 후속 C, `e685d93d0`): Preview 렌더러의
  `var(--x, #v3hex)` fallback 제거(LayoutRenderers·IllustratedMessage), ColorPicker/Swatch 기본값·TailSwatch 500 단계
  표·Table 인라인 hex·Skia 오버레이 상수(workflow 엣지·드롭 인디케이터·토글 아이콘)·tokenToCss 기본 border 를
  `TAILWIND_PALETTE` / `var(--color-*)` 파생으로. **사용자-가시**: 빌더 드롭 인디케이터·workflow 엣지 파랑이 v3
  `#3b82f6` → v4 `#2b7fff` 등 v4 값으로 이동.
  - 위치: `packages/shared/src/components/styles/theme/{shared-tokens,preview-system}.css`,
    `packages/shared/src/{renderers,components}/*`, `apps/builder/src/builder/workspace/canvas/skia/semanticOverlayColors.ts`

## [ADR-191 Implemented — Tailwind v4 theme.css 단일 원천 팔레트 파생, 손 복사 팔레트 3개 제거] - 2026-08-26

### Bug Fixes

- **Skia 가 DOM 에서 읽는 oklch 토큰이 항상 fallback 색으로 떨어지던 결함** (ADR-191 Phase 2·3):
  - `cssVariableCore.cssColorToHex` 는 colord 단독이라 `--border: oklch(87% 0 none)` 류를 파싱하지 못해
    `App.css` 시절부터 fallback 을 그렸고, `styleConverter.parseColorFuncArgs` 는 CSS Color 4 의 `none`
    성분을 `NaN` 으로 만들었다.
  - **Why**: Tailwind v4 팔레트는 무채색을 `oklch(L% 0 none)` 로 표기 — 파서가 v3 hex 시대 가정이었다.
  - 수정: oklch → sRGB 직접 변환 + `none` → 0. 회귀 테스트 7건.
  - 위치: `apps/builder/src/builder/workspace/canvas/utils/cssVariableCore.ts`, `…/styleConversion/styleConverter.ts`

### Architecture

- **ADR-191 Implemented** (Phase 0~~4 / G0~~G4 당일 종결): 팔레트 **정의 원천** 을 설치된
  `tailwindcss/theme.css` 하나로 고정하고, 손 복사본 3개를 제거했다 — `App.css :root` 387 변수 (unlayered
  v4 oklch 복사), `shared-tokens.css` Tailwind 이름 93 (v3 hex), `colors.ts` 71 + `neutralToSkiaColors.ts` 55
  (v3 hex). 생성기 `packages/specs/scripts/generate-palette.ts` 가 plain CSS (`@layer shared-tokens`, 286
  oklch) 와 TS hex (`TAILWIND_PALETTE`) 를 만들고, drift 테스트 + `validate:palette` 가 byte-diff 0 을 지킨다.
  - **사용자-가시**: Preview/Publish 팔레트가 Tailwind **v3 hex → v4 oklch** 로 이동한다 — 기존 프로젝트의
    Badge / StatusLight / Meter / TagGroup 등 팔레트 소비 27 토큰 (purple-600 Δ35, green-400 Δ69 등) 색이
    Builder 캔버스와 같은 값으로 바뀐다. Builder 는 이미 v4 를 보고 있었으므로 빌더 화면 색은 변하지 않는다.
  - 캐스케이드: `index.css` `@layer theme, dashboard, base, preview-system, components, shared-tokens,
builder-system, utilities` 로 `theme` 선두 확정 — unlayered 블록 의존 제거.
  - G2 live 실측 (Chrome MCP): Builder DOM computed = `preview.html` DOM computed = Skia hex, 토큰 6종 Δ≤1;
    요소 단위 Badge `red` (red-600) / StatusLight `purple` (purple-600) 가 Skia 캔버스 ↔ preview iframe 동일.
  - 범위 밖 잔존: semantic alias 층 (`--negative` = error-400 hsl vs Skia red-500, `--color-info-600` hsl vs
    Skia blue-600) Skia↔CSS 비대칭은 본 ADR 이전부터 존재 — 별도 정리 대상. 컴포넌트 fallback hex 리터럴
    ~45곳, 축 일치 리터럴 중복 58건도 후속.
  - 위치: `packages/specs/scripts/{paletteGenerator,generate-palette}.ts`,
    `packages/shared/src/components/styles/theme/generated/tailwind-palette.css`,
    `packages/specs/src/primitives/generated/tailwindPalette.ts`, `packages/specs/src/primitives/colors.ts`,
    `apps/builder/src/{index.css,App.css}`, `docs/adr/completed/191-tailwind-theme-single-source-palette.md`

## [ListBox ref 인스턴스가 origin 행을 이중으로 그리던 결함 수정] - 2026-08-26

### Fixed

- 팔레트에서 추가한 ListBox(`ref → component-listbox`) 인스턴스가 빌더 캔버스에서 자기 items 3행
  뒤에 origin 의 items 3행(Inbox/Starred/Archive)을 한 번 더 그리던 결함을 고쳤다 (Skia owner
  320 → 164, Preview DOM 164 와 일치). 원인은 `resolveCanonicalRefTree` 가 master 의 scene 자식을
  인스턴스로 복제할 때 master 의 **render projection**(`projection:listbox-rows:component-listbox`
  - 행)까지 `{instance}/projection:…` 로 실어 보낸 것 — projection 은 owner 파생 산출물이라 ref 로
    상속되면 안 되며, 인스턴스는 자기 resolved props 로 projection 을 따로 만든다. 복제 단계에서
    `isRenderProjectionId` 자식을 건너뛰도록 해 collection 전 family(ListBox/GridList/Table/
    TagGroup/Tabs/Breadcrumbs)에 같은 규칙을 적용했다. Components 페이지 origin 자신의 행은 그대로.

## [ADR-157 / ADR-171 Implemented — collection 샘플+hatch 표시 정책 종결, catalog 레이아웃 전달 일원화 종결] - 2026-08-26

### Changed

- **ADR-157 Implemented** (Phase 5 live 종결): data-bound collection(ListBox/GridList/Table)
  auto-height 소유자는 빌더에서 샘플 10행 + 계산 높이 hatch(`+N more`)로 표시된다. 라이브에서
  `Users` 12행 바인딩 ListBox 가 샘플 10행(32px·gap 2) + hatch 66px 로 owner 안에 clip 없이
  배치되고, items 기반 행 스타일이 Skia↔Preview DOM 에서 일치(340×50·stride 52)함을 확인했다.
  G1 의 Preview 대조 절은 preview 가 dataTable 바인딩을 소비하지 않는 ADR-152 격차 7 이 선행이라
  residual 로 남긴다.
- **ADR-171 Implemented** (Phase 6 종결): Card origin(`cardTemplateOrigins.ts`)의 Heading/
  Description `display:block` 인라인 2키를 제거했다 — catalog `structure.display` 와 생성 CSS 가
  두 채널에 같은 값을 공급하는 중복이었고, 라이브 A/B 에서 Skia·DOM 박스가 byte-identical 이었다.
  Components 페이지 잔여 인라인은 존치 확정 2키 + factory 자식 미러 + 사이즈 축뿐이다.
- ADR 대시보드 정리: Implemented 상태로 루트에 남아 있던 176/182/189 를 `completed/` 로 이동,
  README "미구현" 표의 Implemented 행 14건을 "완료" 표로 이관, stale 라벨(150 A1 철회 반영·
  910/911 비착수 표기·025 부분 완료 등재) 정정.

## [Dashboard를 빌더 chrome 어법으로 재설계] - 2026-08-26

### Changed

- 대시보드 루트에 `data-context="builder"`를 부여했다. 종전에는 이 스코프 밖이라
  builder-system 토큰이 걸리지 않고 preview-system의 tint 팔레트로 렌더돼, 빌더와
  같은 앱인데 다른 색 체계로 보였다.
- 대시보드 CSS를 `@layer dashboard`에서 `@layer builder-system`으로 옮겼다. 구
  레이어는 선언 순서상 최하위(`dashboard < base < preview-system < components < ...`)라
  `.project-card`의 `flex-direction: row`가 `components` 레이어 Card 기본값
  `column`에 져서 카드가 세로로 무너지고 푸터가 화면 중간에 뜨고 있었다.
- 화면 구조를 현행 빌더 chrome에 맞췄다. 단단한 헤더 바(배경 + 하단 border)와 테두리
  있는 좌측 패널·하단 상태바를 걷어내고, 투명 헤더 + 떠 있는 control island로 바꿨다.
  island 시각은 `builder-control-group.css`를 그대로 소비하므로 header/PanelDock과
  같은 track·padding·gap·radius·selected indicator를 공유한다.
- 좌측은 240px 스코프 패널 대신 40px 세로 island rail(Recents / All projects)이고,
  선택 상태는 rail·header와 같은 `--accent` pill + `--fg-on-accent` 아이콘이다.
- 프로젝트 목록에 검색(⌘K로 포커스), 정렬(Last edited / Created / Name), 그리드↔리스트
  전환을 붙였다. 전부 이미 있는 `ProjectListItem` 필드만 쓰며 새 파생 데이터는 없다.
- 상시 노출되던 파괴적 Delete 버튼을 카드/행 호버 시 열리는 오버플로 메뉴(Open /
  Delete)로 옮겼다. 카드 전체가 열기 액션이고 메뉴 버튼은 그 버튼 밖 형제다.
- 생성 진입점을 그리드 첫 칸 타일과 헤더 버튼으로 통일했다. 누르면 타일이 그 자리에서
  이름 입력으로 바뀐다 — rename 기능이 없어 이름 없는 생성은 되돌릴 수 없으므로 입력
  단계를 유지했다.
- 테마 토글(Light / Dark / Auto)을 헤더에 추가하고 빌더와 같은 `stores/uiStore`의
  `themeMode`에 연결했다. `data-builder-theme`는 대시보드 mount 중에만 세우고 unmount
  시 지운다 (BuilderCore와 동형) — auth 라우트는 종전대로 빌더 팔레트를 받지 않는다.
- **Why**: "빌더 스타일 패턴 유지"가 실측상 성립하지 않고 있었다. 스코프 누락으로 색
  체계가 갈렸고, 레이어 순위 때문에 대시보드 CSS 규칙 자체가 조용히 무시됐다. 두 결함을
  고치지 않으면 어떤 시안도 화면에 재현되지 않는다.
- 위치: `apps/builder/src/dashboard/{index.tsx,index.css}`

### Removed

- 대시보드 상단 설정 버튼과 설정 모달(`dashboard/SettingsPanel`)을 제거했다. 노출하던
  컨트롤 2개가 모두 소비처 0건이었다 — `projectCreation` 은 `dashboard/index.tsx` 가
  `void` 로 버렸고(생성 흐름은 분기 없이 IndexedDB 에만 쓴다), `syncMode` 는 패널
  자신 외에 읽는 곳이 없었다. `BuilderCore.tsx` 의 동명 `syncMode` 는 데이터 바인딩
  payload 의 지역 변수로 타입도 의미도 다르다.
- 함께 제거: `stores/settingsStore.ts`, `types/settings.types.ts`,
  `stores/index.ts` 의 `useSettingsStore` / `getSettings` export.
  `autoSyncInterval` / `autoDownloadOnOpen` 는 선언만 있고 소비처가 0건이었고,
  `getSettings()` 는 호출처가 0건이었다.
- **Why**: 단순 dead 가 아니라 오해를 부르는 상태였다. Project Storage 셀렉트가
  `Cloud Only (Supabase)` / `Local + Cloud` 를 계속 제시하고 Sync Mode 설명이
  "How local changes sync to cloud" 라고 쓰여 있었지만, ADR-128 Phase 2 가
  `ProjectsApiService` / `DocumentsApiService` / `projectSync` / `projectMerger` 를
  삭제해 그 경로 자체가 없다. 아무 일도 안 하는 게 아니라 사용자에게 클라우드에
  저장된다고 말하고 있었다.
- 동명 파일 주의: `builder/panels/settings/SettingsPanel.tsx` 는 별개이며
  `panelConfigs.ts` 에 등록된 정상 동작 패널이다 (눈금자/가이드 소유). 손대지 않았다.
- 사용자 브라우저에 남은 `composition-settings` localStorage 키는 앱 시작 시 1회
  정리한다 (`lib/legacyStorageCleanup.ts`, `main.tsx` 에서 호출). 코드를 지워도
  저장소는 남고, 되살아난 키를 나중에 "쓰이는 설정" 으로 잘못 읽게 된다. 목록 방식이라
  이후 죽은 키도 같은 자리에 근거와 함께 추가한다. 저장소 접근이 throw 하는 환경
  (사생활 보호 모드·저장소 차단) 에서는 조용히 넘어가 앱 시작을 막지 않는다.
- 위치: `apps/builder/src/{dashboard/SettingsPanel.tsx,dashboard/SettingsPanel.css,
stores/settingsStore.ts,types/settings.types.ts,stores/index.ts}`

### Known gaps

- 카드 썸네일은 중립 플레이스홀더다. 실제 캔버스 렌더 썸네일에는 Skia 오프스크린 캡처
  경로가 별도로 필요해, 그럴듯한 가짜 미리보기 대신 플레이스홀더로 뒀다.
- rail은 Recents / All projects 2개다. 시안의 Templates / Trash는 backing 기능이 없어
  넣지 않았다 (동작하지 않는 컨트롤 금지).
- ⌘K는 검색 입력 포커스까지만이다. 전체 커맨드 팔레트는 별도 작업.

### Verification

- `tsc -p tsconfig.app.json --noEmit` 0 error, `eslint src/dashboard/` 0 error 0 warning.
- localStorage 정리: 유닛 5건(지움/idempotent/무관 키 보존/throw 내성/제거 목록에
  살아 있는 키 없음) 통과. 라이브 빌더에서 `composition-settings` 를 심고 새로고침해
  사라지는 것과, 실측한 나머지 11개 키가 그대로 남는 것을 확인.
- 제거 후: 잔존 참조 전수 grep 0건(`settingsStore` / `settings.types` /
  `DEFAULT_SETTINGS` / `UserSettings` / `ProjectCreationMode` / `getSettings` /
  localStorage 키 `composition-settings`), `tsc --noEmit` 0 error,
  `eslint src/dashboard src/stores` 0 error 0 warning, `vitest run src/dashboard
src/stores` 2 files 2 tests 통과, 라이브 대시보드 재로드 시 콘솔 에러 0건.
- 라이브 빌더(localhost:5173/dashboard)에서 Chrome MCP로 직접 실행: 빌더 팔레트 적용,
  rail 스코프 전환(Recents ↔ All projects), ⌘K 검색 포커스 + 이름 필터, 정렬 메뉴
  선택(Name 반영), 그리드↔리스트 전환, Light/Dark 전환, 생성(인라인 폼 → 프로젝트
  생성 → 빌더 이동), 오버플로 메뉴 → 삭제(실제 IndexedDB 삭제 + 목록 갱신), 검색
  무결과 빈 상태까지 각 1회 이상 확인.

## [Builder chrome 토글 그룹 일원화 — Header / PanelDock RAC pattern] - 2026-08-26

### Changed

- 좌·우 PanelDock의 구 `PanelNav`를 `PanelToggleGroup`으로 전환했다. sidebar 시절의
  `nav > ul > li` 구조와 수동 `aria-pressed`를 제거하고, header와 동일한 RAC
  `ToggleButtonGroup` + `ToggleButton` 구조에서 vertical multiple selection을 사용한다.
- header와 좌·우 rail은 `builder-control-group`의 track, padding, gap, radius, hover,
  selected indicator 스타일을 공유한다. PanelDock의 48px rail shell, 좌우 order,
  overflow와 `hiddenFromRail` registry/placement 계약은 유지한다. 공통 toggle button은
  `--spacing-sm` padding을 사용하고, group surface는 기존 rail의 흰색톤
  `--bg-raised`를 사용한다. 선택된 toggle은 기존 rail과 같은 `--accent` 배경과
  `--fg-on-accent` 아이콘 대비를 사용한다.
- header root를 semantic `<header>`로 바꾸고 전역 배경과 하단 border를 투명하게 했다.
  Compare / Workflow / Monitor는 실제 toggle 상태만 포함하며, Preview는 같은 chrome
  어법의 순간 action으로 분리했다. Monitor 선택 상태는 workspace visibility와 동기화한다.
- 좌측 상단 전체 메뉴 버튼의 CSS가 번역된 `aria-label`과 불일치해 generic RAC 버튼으로
  보이던 문제를 stable `header-menu-button` class로 수정했다. 이동 전의 `--bg-muted`,
  border 없음, `--spacing-sm` padding과 6px radius 외형을 복원한다.
- breakpoint ToggleButtonGroup과 ZoomControls를 RAC `Group` 기반의 단일 viewport
  control surface로 묶었다. 외부 surface가 `--bg-raised`와 `--radius-lg`를 소유하고,
  Zoom trigger는 기존 `--bg-muted` 배경과 toggle button과 같은 `--radius-md`를 사용한다.
- **Why**: PanelDock rail이 더 이상 페이지 이동 navigation이 아니라 패널 표시 상태를
  제어하는 toggle surface인데도 과거 sidebar DOM과 별도 CSS를 유지해 header와 같은
  기능이 서로 다른 접근성·시각 계약으로 표현되고 있었다.
- 위치: `apps/builder/src/builder/{main/BuilderHeader.tsx,layout/PanelToggleGroup.tsx,
styles/modules/builder-control-group.css}`

### Verification

- PanelToggleGroup DOM/선택 adapter, PanelWorkspace occupancy/static, BuilderHeader
  semantic/transparent CSS, i18n, reserved-prefix focused test 6파일 26케이스 PASS.
- viewport `Group` DOM/CSS, 접근성 label, i18n, page layout focused test 3파일
  9케이스 PASS.
- 전체 메뉴 버튼 stable class와 i18n wiring focused test 2파일 5케이스 PASS. 라이브
  Builder에서 `--bg-muted`, border 없음, 8px padding, 6px radius, 32×32 크기를 확인했고
  메뉴 open/close 정상, console warning/error 0건이었다.
- `pnpm run codex:typecheck`, `pnpm run codex:preflight` PASS(등록 contract 14케이스 포함).
- 라이브 Builder(localhost:5173): header가 `<header>`이고 computed background가
  transparent, border가 없음. 상단·좌·우 4개 group의 track style이 일치하며 rail의
  computed width가 좌·우 모두 48px이고 `nav/ul/li`가 0개임을 확인했다.
  Nodes / Properties / Monitor 클릭 시
  `aria-pressed`와 실제 패널 visibility가 함께 전환되고, 깨끗한 새 탭 초기 로드의
  console warning/error는 0건이었다. Mobile / Monitor / Nodes / Properties 활성 상태의
  computed indicator는 `--accent`, icon stroke는 white로 확인했다.
- 라이브 viewport surface는 `group` 안에 이름 있는 `radiogroup`, Zoom level textbox,
  Zoom menu button이 sibling으로 유지된다. 외부 surface는 `--bg-raised`, 8px radius,
  4px padding이고 내부 track은 transparent이다. Zoom trigger는 기존 `--bg-muted`로
  계산되며 breakpoint toggle과 Zoom trigger가 모두 6px radius와 32px 높이로
  일치했다. 키보드 포커스는 breakpoint → Zoom level → Zoom menu 순서였고,
  breakpoint 변경·복원과 zoom menu 열기·닫기가 정상이며 console warning/error는
  0건이었다.

## [Undo/Redo를 History 패널 액션으로 이동] - 2026-08-26

### Changed

- 전역 `BuilderHeader`의 Undo/Redo 버튼을 제거하고 History 패널의 `PanelHeader`
  `actions`로 이동했다. 두 버튼은 스냅샷 생성 액션 바로 앞에 배치한다.
- 버튼의 기존 단축키 안내와 history store의 비동기 Undo/Redo 경로는 유지하며,
  스냅샷 복원 또는 다른 히스토리 작업 중에는 중복 실행되지 않도록 비활성화한다.
- 전역 헤더의 현재/전체 히스토리 카운터도 제거해 히스토리 UI를 History 패널로
  일원화했다.
- CSS에서 항상 숨겨져 있던 breakpoint 크기용 `.code.sizeInfo` 요소와 전용 스타일을
  제거했다.

### Verification

- 라이브 Builder(localhost:5173): 전역 chrome 내부 Undo/Redo 버튼, `history-info`,
  `.code.sizeInfo`가 모두 0개이고 Desktop/Tablet/Mobile 선택기는 유지됨을 확인. History
  패널 액션 순서는 `실행 취소 → 다시 실행 → 스냅샷 생성`이며, Undo/Redo 왕복 시 기록
  위치가 `26/26 → 25/26 → 26/26`으로 복귀했고 브라우저 error/warn 0건.
- HistoryPanel/BuilderCore 정적 회귀 테스트 13/13 PASS, `pnpm run codex:preflight` PASS
  (type-check 신규 위반 0, 기존 baseline 43건).

## [Canvas 전체 화면 overlay workspace] - 2026-08-25

### Changed

- Builder의 `Workspace` canvas가 상단 header row와 패널 점유 inset에 의해 줄어들지 않고
  viewport 전체를 사용하도록 바꿨다.
- 기존 `BuilderHeader`를 `PanelWorkspace`의 `chrome` slot으로 이동하고, host 내부에서
  canvas main과 panel overlay가 같은 `workspace` grid area를 공유하도록 재구성했다.
- `panel-dock`는 4px margin의 flow grid로 바꾸고 `panel-dock-chrome`와
  `panel-dock-stage`를 행으로 분리했다. header 높이를 제외한 stage만 panel registry/runtime과
  DataTable activation의 측정 기준으로 사용하며, frame은 `panel-dock-surface`를 단일
  containing block으로 유지한다.

### Verification

- 라이브 Builder(localhost:5173): `.app`, `.panel-workspace-host`, `.panel-workspace-main`,
  `.workspace`가 모두 viewport 전체 크기로 측정되고 header 메뉴 open/close 정상, 브라우저
  error/warn 0건.
- `pnpm run codex:typecheck` PASS(신규 위반 0, 기존 baseline 43건), focused 5개 파일
  27/27 테스트 PASS.

## [단축키·설정 진입점을 헤더 좌측 메뉴로 — 상시 노출 토글 2개 제거] - 2026-08-25

### Changed

- 헤더 우측 토글 버튼 그룹의 **단축키(Command Palette) 버튼을 제거**하고 좌측 메뉴
  팝오버의 `Shortcuts` 항목(⌘K 표기, Help 바로 위)으로 옮겼다. 여는 경로는 종전과 같은
  `open-command-palette` 이벤트라 ⌘K 단축키·팔레트 동작은 그대로다. 우측 토글 5개 → 4개
  (Compare / Workflow / Preview / Monitor).
- 좌측 레일(PanelNav)의 **설정 토글 아이콘을 제거**하고 같은 메뉴의 `Settings` 항목
  (Reset Panel Layout 아래)으로 옮겼다. 좌측 레일 아이콘 6개 → 5개.
- 설정 패널은 **등록 해제하지 않았다** — `PanelConfig.hiddenFromRail` 플래그를 추가해
  레일 아이콘만 빼고 등록·배치는 유지한다. `activatePanelWorkspacePanelV3` 가 railOrder
  파생 placement 를 요구하므로 등록을 빼면 메뉴·커맨드 팔레트에서도 열 수 없게 된다.
  도킹/floating 표시 모드와 저장된 레이아웃은 그대로다.
- **Why**: 둘 다 저빈도 진입점인데 상시 노출 칸을 하나씩 차지하고 있었다. 폰트 관리를
  피커 안 모달로 옮긴 것(같은 날 앞 엔트리)과 같은 방향 — 관리·보조 표면은 메뉴로,
  상시 칸은 편집 중 반복해서 누르는 것에만 준다.

### Verification

- 라이브 빌더(localhost:5173): 좌측 레일 aria-label 이 노드/컴포넌트/데이터테이블/
  데이터테이블 에디터/테마 5개로 설정이 빠졌고, 헤더 메뉴에서 `Settings` 클릭 시 설정
  패널이 실제로 열리는 것(제목 `Settings` + Rulers & Guides / Theme & Appearance 본문)과
  다시 클릭 시 닫히는 것까지 확인했다. 같은 세션에서 `Shortcuts` 항목이 명령어 팔레트
  (71개 명령어)를 여는 것도 확인, 콘솔 에러 0.
- `pnpm type-check` PASS(신규 위반 0). `vitest run src/builder/{layout,panels}
src/builder/hooks/usePanelLayout.test.tsx` 110 파일 / 1,083 케이스 PASS.

## [폰트 관리 진입점을 Font Family 피커 안으로 — 도킹 패널에서 모달로] - 2026-08-25

### Changed

- Typography 섹션의 **Font Family 가 팝오버 피커**가 됐다(`FontFamilyPicker`). 목록은
  "기본"(기본값 / Pretendard / Inter)과 "내 폰트"(등록된 커스텀 패밀리) 두 그룹으로 나뉘고,
  각 이름은 그 폰트로 그려진다. 패밀리가 7개 이상이면 검색창이 함께 뜬다.
- **폰트 관리 진입점이 피커 안으로 들어왔다** — 목록 아래 `폰트 추가`(등록 0개) / `폰트 관리`
  줄이 `FontManagerDialog` 모달을 연다. 업로드 존·패밀리 목록·face 삭제는 도킹 패널과 같은
  본문(`FontManagerBody`)이라 어느 쪽에서 올려도 즉시 서로 반영된다.
- Typography 속성 그리드의 **`폰트 관리` 아이콘 버튼(Line Height 옆 칸)을 제거**했다. 빈
  칸으로 자동 배치가 밀리지 않도록 `Wrap` 에 `grid-area: wrap` 을 고정해 종전 위치(Text
  Transform 옆)를 유지한다.
- **Why**: Figma 는 파일 우측 패널에 피커만 두고 업로드를 Admin → Resources → Fonts 로 보내고,
  Pen 은 피커 안 `Add`/`Manage` 가 문서 스코프 "Custom Fonts" 모달을 연다. 두 앱 다
  선택(고빈도)은 피커 안, 관리(저빈도)는 다른 표면이고 **관리 표면이 인스펙터 레일을 상주로
  차지하는 도킹 패널인 경우는 없다.** composition 은 두 축 다 어긋나 있어서 "고르다 없으면
  패널 열고 → 올리고 → 스타일 패널로 돌아오는" 왕복이 생겼다. Pen 의 "전체 / 내 폰트" 필터는
  빌트인이 2개뿐인 여기선 토글이 될 값이 없어 그룹 헤더로 대신했다.
- 레지스트리 구독·CRUD 가 소비처마다 복제돼 있던 것을 `useFontRegistry` 훅 하나로 모았다
  (패널 / 모달 / Typography 의 Font Weight 옵션 3곳).
- **`fonts` 도킹 패널을 등록 해제·삭제**했다 — `PanelId` 유니온 / `PANEL_CONFIGS` / 기본
  레이아웃 `rightPanels` 에서 빠져 우측 레일 아이콘이 6개 → 5개가 됐고, `FontManagerPanel.tsx`
  는 지웠다. 이미 저장된 레이아웃에 남아 있는 `"fonts"` 는 하이드레이션이 레지스트리에 없는
  id 를 rail·visibility·cluster 세 경로 모두에서 버리므로 그대로 사라진다(마이그레이션 불필요).
  스타일시트는 모달·본문이 계속 쓰므로 `FontManager.css` 로 이름만 바꿔 남긴다.

### Verification

- 라이브 빌더(localhost:5173): Text 탭 → Font Family 가 새 피커로 렌더되고 구
  `.actions-font` 아이콘 칸은 DOM 에서 사라졌다. 피커 열기 → `Inter` 선택 시 트리거 라벨·미리보기
  글꼴이 바뀌고 Modified 탭 개수가 1 → 2 로 올라가 store 반영을 확인, `기본값` 선택으로 2 → 1
  복원까지 확인했다.
- 같은 세션에서 `폰트 추가` → 모달이 열리고 업로드 존 + 빈 상태가 모달 안에 정렬되는 것까지
  확인했다(EmptyState 의 시각 규칙이 패널 스코프라 모달까지 닿지 않던 것을 인스턴스 한정
  규칙으로 보강). 콘솔 에러 0건.
- `pnpm type-check` PASS(신규 위반 0). RAC `Tab` 이 `title` 을 받지 않아 남아 있던 뷰 탭
  타입 위반 1건을 안쪽 요소로 옮겨 함께 해소했다. `vitest run src/builder/panels
src/builder/components/styles` 92 파일 / 852 케이스 PASS.

- 등록 해제 후 새로고침: 우측 레일에서 폰트 아이콘이 사라지고 살아 있는 패널 id 12개에
  `fonts` 가 없다. 같은 세션에서 Styles → Text → 피커 → `폰트 추가` → 모달(제목 `폰트 관리` /
  배지 `0/20` / 업로드 존)까지 다시 exercise 했고 콘솔 에러 0.
  `vitest run src/builder/{layout,stores,panels}` 178 파일 / 1,561 케이스 PASS.

## [Style 패널 뷰 탭 — 선택된 탭에만 라벨] - 2026-08-25

### Changed

- Style 패널이 섹션 5개(Responsive / Transform / Layout / Appearance / Typography)를 한 줄로
  늘어놓던 것을 **그룹 탭**으로 묶었다. 섹션은 하나도 지우지 않았다 — Layout(Transform +
  Layout) / Style(Appearance) / Text(Typography) / Screen(Responsive + Visibility) 로 그룹만
  나눴다. 실측 근거: 패널 폭 233px 에 컨트롤 91개, 전부 펼치면 콘텐츠 1,454px 가 보이는 높이
  641px 안에 들어가 2.3 화면이었다.
- **"수정된 속성만"(Modified) 도 같은 탭 줄의 5번째 탭**이다. 처음엔 타이틀 줄의 별도 토글로
  뒀는데, 그러면 콘텐츠 영역 하나를 두 컨트롤이 나눠 쥐고 "탭을 누르면 modify 가 조용히 풀리는"
  숨은 결합이 생긴다. 배타적으로 같은 영역을 차지하는 뷰는 컨트롤도 하나여야 한다.
- 탭 어법은 **선택된 탭에만 라벨**이다. 233px 최소 폭에서 라벨을 다 달면 탭 줄이 폭을 다 먹고,
  전부 아이콘만 두면 Layout·Style 이 읽히지 않는다. 선택 탭만 이름을 달고 남는 폭을 가져가므로
  패널을 넓히면 라벨 자리도 같이 넓어지고, 좁히면 라벨만 말줄임으로 줄고 아이콘은 남는다.
- 탭 트랙 치수는 이 패널의 `ToggleButtonGroup`(세그먼트 컨트롤) 실측값과 동일하다 — 28px 높이 /
  4px 안쪽 여백 / 8px 간격 / `--radius-md` / muted 트랙 + inset shadow, 버튼 20px 정사각, 선택
  pill = `--bg-overlay` + `--shadow-sm`, 라벨 12px regular. 같은 패널에서 같은 역할(배타 선택)을
  하는 컨트롤이 서로 다른 치수를 쓰면 탭만 이물질로 읽힌다.
- 패널 헤더가 두 줄이 됐다 — 타이틀 줄(요소 타입 + 스타일 복사/붙여넣기)과 탭 줄(뷰 탭 5개).
  구 "전체 스타일"(Palette) 토글은 탭이 대신하므로 제거했고 Palette 는 패널 아이콘으로 옮겼다.
  구 `modify N` 배지 텍스트는 사라졌고 개수는 Modified 탭의 tooltip/접근 이름에 남는다.
- 지금 선택되지 않은 그룹에 기본값과 다른 값이 있으면 탭 아이콘에 dot 을 띄운다. 판정은 섹션
  reset 버튼과 같은 dirty 소스(`{TRANSFORM,LAYOUT,APPEARANCE,TYPOGRAPHY}_PROPS`)를 재사용해
  "탭엔 점이 없는데 들어가 보면 reset 이 활성" 인 비대칭이 안 생기게 했다. Modified 탭에는
  dot 을 찍지 않는다 — 그 값은 그룹 dot 들의 OR 라 정의상 중복이다.

### Verification

- 라이브 빌더(localhost:5173) 233px 실측: 5개 탭 라벨이 전부 미절단(라벨 box == 텍스트 natural
  폭). 비선택 탭이 24px 로 새면서 `Modified` 가 0.09px 모자라 말줄임되던 것을 20px 고정으로
  잡았다. tablist ↔ 세그먼트 그룹의 height·padding·gap·radius·background·box-shadow 6개 값
  일치 확인.
- 탭 전환이 해당 뷰의 섹션만 마운트하고, Gap 20→24 편집이 다른 탭을 다녀와도 유지된다(store
  반영 확인 후 20 복원). `modify 1` ↔ Style 탭 dot 일치.
- `StylesPanel.test.tsx`: 뷰 탭 5개 렌더 + 선택 뷰만 표시 + Modified 탭 전환 케이스를 추가했고,
  기존 Responsive 케이스는 Screen 탭 선택 후 단언으로 갱신했다.

## [테스트 baseline 정리 — overlay fixture / obsolete snapshot / §9 매트릭스 커버리지] - 2026-08-25

### Verification

- `skiaPrimitives.overlay.test.ts` 의 arrow 기대값 24건을 ADR-187 계약에 맞췄다. arrow 선은
  툴팁/팝오버의 **배경색**으로 긋기 때문에 background-fill presentation 드래그에 본체와 함께
  따라와야 하고, 그래서 두 primitive 가 모든 line 에 `presentationRole: "background-fill"` 을
  찍는다. production 은 옳았고 `expectedLines()` fixture 만 갱신되지 않은 상태였다. 좌표
  기대값은 draw fn 1:1 미러로 두고 `asBackgroundFill()` 헬퍼로 role 만 씌운다.
- ADR-912 후속 §9 검증 매트릭스의 "Link" 행에 실제 catalog `Link` rule 기반 named test 5건을
  추가했다. `fill.alpha = 0` + border 채널 부재는 Link 고유 조합이라, staticColor 가 배경이나
  테두리를 만들지 않고 텍스트만 바꾸는지가 이 행의 계약이다.
- "Modified Styles" 행에 `hex`/`hex8`/`rgb()`/`rgba()` picker seed 케이스를 추가해 4형
  (hex/rgb/transparent/`var(--token)`)을 채웠다.
- ADR-912 cutover 로 `Image.spec` 이 삭제된 뒤 남아 있던 `CSSGenerator` obsolete snapshot
  `Image 1` 을 제거했다.
- 결과: specs 721 / shared 909 / builder 4,340 전건 GREEN, obsolete snapshot 0,
  `pnpm type-check` 신규 위반 0.

## [Canvas mesh-gradient fill 배선] - 2026-08-25

### Bug Fixes

- Style Panel 에서 고른 Mesh fill 이 Canvas 에 그라디언트가 아니라 단색으로 나오던 결함을
  수정했다. `fillToSkia` 는 mesh FillStyle 을 만들고 `fills.ts` 는 SkSL bilinear 셰이더까지
  갖췄지만, box(`buildBoxNodeData`)와 catalog/spec(`buildSpecNodeData`) 두 node builder 가
  `linear|radial|angular` 만 화이트리스트해 mesh 가 `box.fill` 에 실리지 않았다. 그래서
  Preview/Publish DOM 은 `fillAdapter` 의 SVG mesh 를 그리고 Canvas 는 첫 point 색으로
  떨어지는 D3 비대칭이 있었다. 두 경로 모두 mesh 를 `box.fill` 에 접붙인다.
- fills 가 셰이더를 만드는 경우 CSS `background-image: url(...)` 보다 우선하는 기존 규칙을
  mesh 에도 동일 적용했다. 두 채널이 같은 `box.fill` 을 쓰므로 gradient 와 같은 우선순위다.

### Architecture

- mesh 는 stop `colors/positions` 가 없어 gradient drag 의 presentation target 대상이 아니다.
  접붙임만 하고 `presentationFillTargets` 의 stop 채널은 늘리지 않는다(commit-only,
  `FillSection` 의 기존 계약과 동일). 모든 box 가 갖는 fallback `fillColor` 채널은 유지된다.

### Verification

- box 경로 신규 4건 + 기존 catalog 경로 RED 1건이 GREEN. builder 전체 4,357건 실패 0,
  `pnpm type-check` 신규 위반 0.
- `multiroot-live-gate` 에서 page body 에 Mesh fill 을 적용해 Canvas 가 4코너 bilinear
  (red/yellow/blue/green) 를 그리는 것을 확인했고, Compare Mode 에서 Preview DOM 의
  SVG mesh 와 시각 결과가 일치했다. 적용 요소의 preview computed `backgroundImage` 가
  mesh SVG data URI 임을 확인했다. 시험 후 Undo 로 원상복구했다.

## [ADR-912 후속 Phase 6 — 종결 후 전수 감사와 테스트 회귀 정정] - 2026-08-25

### Bug Fixes

- Phase 2가 Skia primitive draw fn에 root paint를 필수 주입으로 바꾸면서 `catalogPaintFixture`
  이관을 `packages/specs` 안에서만 수행했고, `@composition/specs`의 `getSkiaPrimitive`를 직접
  부르는 builder 테스트 2개(`gridListCardQuiet`, `toggleIndicatorXlCatalog`)가 `paint` 없이
  호출해 TypeError로 파손돼 있었다. 두 파일을 production 경계
  `resolveSkiaCatalogRenderInput` 1회 호출로 전환했다. production 렌더 경로는 adapter가
  paint를 주입하므로 화면 동작 결손은 없었다.
- Phase 3의 신규 `useColorStyleValues.test.tsx`가 store를 직접 seed하는 로컬 헬퍼를 쓰는데,
  ADR-116 G4 grep gate의 제외 패턴이 `__tests__/` 디렉터리만 걸러 co-located `*.test.tsx`를
  스캔해 baseline을 0에서 8로 올렸다. gate 대상은 production write site이므로 제외 패턴에
  `*.test.ts(x)`를 추가했다. production 파일은 이 확장자를 갖지 않아 D18=A 격리 강도는 불변이다.

### Verification

- builder 전체 4,353건: 이전 10 실패에서 1 실패로 감소. specs 전체 721건은 24 실패 유지.
  잔여 25건은 ADR-912와 무관한 기존 baseline이다 — arrow expected shape의 `presentationRole`
  누락 24건과 catalog 경로의 mesh-gradient attachment 미지원 1건이며, Phase 2 전후로 해당
  emit/분기가 동일함을 확인했다.
- `pnpm type-check` 신규 위반 0(baseline 43). Phase 0~~5의 종료 조건(D1~~D5 GREEN, paint owner
  1곳, `resolveCatalogColorPreset` 참조 0, Badge manual/generated selector 중복 0,
  8,244-case shadow parity)은 재실행에서 모두 유지됐다.

### Architecture

- 전환된 두 테스트는 fixture로 paint를 재조립하지 않고 실제 소비 경로를 통과한다. 그 결과
  `gridListCardQuiet`이 원래 목적("정의는 있는데 소비 경로가 안 닿음" 차단)을 catalog rule →
  paint resolver → Skia shape 전 구간에서 지킨다.

## [ADR-912 후속 Phase 5 — Resolved Visual Style 수렴 완료] - 2026-08-25

### Bug Fixes

- catalog의 `transparent` 색상이 Style Panel picker에서 검정으로 표시되던 마지막 결손을
  수정했다. catalog/raw/CSS 값은 그대로 두고 React Aria ColorPicker 입력 경계에서만 완전
  투명 hex8(`#00000000`)로 정규화해 Button outline, Badge, Card, ToggleButton의 투명
  background/border가 정확히 표시된다.

### Architecture

- 존재하지 않는 기존 Builder project ID 대신 `multiroot-live-gate`를 ADR-912 후속의 기준
  fixture로 고정하고 Button origin/instance, ToggleButton, Badge, Card 대표 요소를 hydration
  가능한 상태로 보존했다.
- Canvas, Preview, Style Panel은 계속 같은 catalog paint resolver의 대등한 consumer다.
  picker 호환 정규화는 Panel concrete 표시 경계에만 있으며 production paint owner나
  canonical write 경로를 추가하지 않는다.

### Performance

- 추가 경로는 color string 한 건의 O(1) 비교뿐이다. foreground drag에서 action/control RAF
  `0/0`, drag canonical write `0`, terminal commit `1`, frame apply p95 `0.4ms`, terminal
  projection signature `0.5ms`로 ADR-187 계약을 유지했다.

### Verification

- shared resolver 10건, Builder panel/Skia/presentation 152건, specs shape/CSS 8건 등 focused
  170건을 통과했다.
- hard reload된 Compare Mode에서 Button, Badge(bold/subtle/outline), ToggleButton(default 및
  selected+emphasized), Card의 Properties→Style Panel→Preview를 대조했고 unified Skia Canvas
  동시 렌더와 console error/warning `0/0`을 확인했다. 시험 상태는 모두 기본값으로 복구했다.

## [ADR-912 후속 Phase 4 — Badge Catalog Paint SSOT] - 2026-08-25

### Architecture

- Badge의 bold/subtle/outline 배경·텍스트·테두리 채널을 catalog로 통합하고 generated CSS,
  Canvas, Style Panel이 같은 variant 데이터를 소비하게 했다.
- 수동 Badge CSS의 variant/fillStyle/size 규칙을 제거했다. 수동 파일은 dot, pulse,
  forced-colors처럼 generator가 표현하지 않는 보조 동작만 담당한다.
- subtle generated CSS가 border를 제거하지 않고 transparent color만 적용하게 해 outline 전환과
  동일한 1px box footprint를 유지한다.

### Performance

- catalog paint 해석은 기존 pure O(1) resolver 1회를 그대로 사용한다. transparent border는
  Panel/CSS layout channel로 보존하되 Canvas border shape로 생성하지 않아 bold/subtle의 draw shape를
  늘리지 않는다.

### Verification

- Badge 전 variant의 binding↔catalog channel coverage와 semantic 6 variant × 3 fillStyle의
  generated CSS↔Canvas↔Style Panel parity를 회귀 테스트로 고정했다.
- 8,244-case resolver shadow parity, Badge shape/binding/size passthrough, generator snapshot 및
  focused Builder 테스트를 통과했다. 실제 Builder interaction과 foreground 성능 측정은 Phase 5에서
  수행한다.

## [ADR-912 후속 Phase 3 — Style Panel Resolved Paint Read Model] - 2026-08-25

### Architecture

- 선택 요소의 ref-origin/responsive/fills merge 이후 catalog paint를 default authored state로
  해석하는 read-only adapter를 추가했다. Appearance와 Typography의 background/border/text는
  이 공통 경계를 소비하며, partial authored state만 키로 삼던 동적 preset cache는 제거했다.
- own/ref-origin/ancestor `accentColor`와 현재 light/dark theme를 global token mutation 없이
  concrete picker color로 변환한다. Modified Styles는 raw canonical 값과 dirty/write/reset 의미를
  유지하고 ColorPicker 입력 경계에서만 CSS variable을 해소한다.

### Performance

- catalog paint 선택은 pure O(1) lookup이고, ancestor accent는 기존 canonical map에서 부모 chain만
  O(depth)로 따라가며 전체 scene 순회는 하지 않는다. RAF scheduling과 canonical/history/DB mutation은
  추가하지 않았고 ADR-187의 preview/terminal write 경로도 변경하지 않았다.

### Verification

- D2~D5(staticColor, selected/emphasized, own/ancestor accent, Modified Styles CSS variable),
  light/dark sibling accent 격리, 동일 catalog key 선택 왕복 회귀를 통과했다. D1 Badge catalog
  data 결손은 Phase 4 expected RED로 유지한다.
- 기준 Builder project의 Components fallback 문서에서 Button의 Primary→Accent 및
  `staticColor=Black` 변경이 Style Panel 3채널에 즉시 반영됐고, Undo와 Card↔Button 재선택 후
  원래 값이 복원됐다. 해당 project의 Compare Mode Preview iframe은 비어 있어 live DOM↔Skia
  판정은 보류하고 shared resolver shadow·renderer parity 회귀로 보완했다.

## [ADR-912 후속 Phase 2 — Skia Paint Owner Collapse] - 2026-08-25

### Architecture

- Builder가 catalog element의 resolved symbolic paint를 한 번 계산해 generic shape와
  Skia primitive에 함께 주입한다. renderer는 더 이상 fillStyle/quiet/selected/staticColor
  우선순위를 다시 해석하지 않고 background/text/border shape로만 투영한다.
- root 색상 상태 선택 production owner를 `@composition/shared/resolveCatalogPaint` 한 곳으로
  축소했다. Progress/Meter/Circle value fill과 selection/leading slot처럼 root 3채널로
  환원되지 않는 subpart 메타는 기존 계약을 유지한다.

### Performance

- element당 `resolveCatalogPaint` 호출을 1회로 구조 고정했다. resolver는 pure O(1)이며
  store/DOM read, 반복 순회, RAF scheduling을 추가하지 않는다.

### Verification

- 8,244-case legacy semantic parity, renderer/primitive focused 회귀, Builder assembly/measurement,
  type-check와 owner-collapse 구조 gate를 통과했다.
- populated Builder의 Compare Mode에서 Button/ToggleButton Preview↔Skia paint parity를 확인했고,
  Button variant/staticColor 변경이 Canvas에 즉시 반영되는 것을 확인한 뒤 원복했다.

## [ADR-912 후속 Phase 1 — Symbolic Paint Resolver] - 2026-08-25

### Architecture

- catalog variant와 authored props/style에서 root background/text/border paint를 고르는
  `resolveCatalogPaint` pure resolver를 `@composition/shared` public surface에 추가했다.
- resolver는 component type, Canvas/DOM, React/Zustand를 입력하거나 참조하지 않으며
  fillStyle/quiet/selected/staticColor와 interaction state 우선순위를 data channel만으로 계산한다.
- 이 Phase에서는 production Canvas/Style Panel 소비 경로를 전환하지 않았다. 기존 Skia와
  병렬 비교하는 8,244-case shadow matrix에서 semantic diff 0을 확인해 Phase 2 cutover 기준선을
  먼저 고정했다.

## [스타일 패널 컬러 동기화 복구] - 2026-08-24

### Bug Fixes

- **처음 여는 Background ColorArea가 드래그 종료 전까지 Canvas에 반영되지 않던 문제**:
  - canonical fill이 아직 없는 요소도 virtual fill을 presentation owner로 연결해 클릭·드래그 중
    Preview와 Skia에 즉시 반영한다. canonical document와 history는 pointer terminal에서만 한 번
    갱신하며, 기존 `style.backgroundColor`는 fill 승격과 함께 제거해 fill을 SSOT로 유지한다.
- **추가한 컴포넌트의 catalog 색상이 스타일 패널에 다르게 표시되던 문제**:
  - 선택한 `variant`와 `fillStyle`의 catalog `background`/`text`/`border` 토큰을
    Background, Text color, Border color의 baseline으로 해석한다. ColorPicker가 CSS var를
    흰색·검정 fallback으로 표시하지 않도록 현재 light/dark Skia theme 색상으로 변환하며,
    인라인 사용자가 지정한 값은 계속 우선한다.
- 위치: `apps/builder/src/builder/panels/styles/{hooks,sections,utils}`,
  `apps/builder/src/builder/presentation/`

## [레이어 트리 다중 선택] - 2026-08-24

### Bug Fixes

- **레이어 트리에서 shift-클릭이 선택을 추가하지 않고 교체하던 문제**:
  - 캔버스에서는 shift-클릭으로 여러 요소를 잡을 수 있었지만 Layers 트리는 항상
    한 개만 선택됐다. 캔버스에서 만든 다중 선택도 트리에는 대표 요소 하나만
    강조돼 어떤 요소들이 잡혀 있는지 보이지 않았다.
  - 트리를 다중 선택으로 전환하고, 선택 상태를 store 의 `selectedElementIds`
    에서 그대로 읽는다 — 캔버스 ↔ 트리 양방향으로 같은 선택이 보인다.
  - 수식어 의미는 React Aria 규칙을 따른다: **shift = 구간 선택**,
    **⌘/Ctrl = 개별 토글**, 수식어 없는 클릭 = 단일 교체. 트리는 행 순서가 있어
    구간 선택이 자연스럽고, 파일 탐색기·다른 디자인 도구의 레이어 패널과 같다.
  - 선택된 요소가 여럿이면 그 **전부**의 조상을 펼친다. 종전에는 대표 요소의
    조상만 펼쳐 나머지가 접힌 채 남았다.
  - 다중 선택은 editingContext(편집 깊이)를 옮기지 않는다 — 마지막 클릭 하나가
    나머지의 깊이 기준을 바꾸면 안 되기 때문이며, 캔버스 shift 경로도 같다.
  - 위치: `apps/builder/src/builder/panels/nodes/LayersSection.tsx`,
    `apps/builder/src/builder/panels/nodes/tree/LayerTree/LayerTree.tsx`,
    `apps/builder/src/builder/panels/nodes/tree/TreeBase/`

### Architecture

- 가상화 트리(300 노드 초과)는 react-aria Tree 대신 행을 직접 그리므로 클릭
  해석도 직접 한다. 두 경로가 갈리면 문서가 커지는 순간 선택 동작이 조용히
  바뀌므로, 수식어 해석을 `TreeBase/selectionModel.ts` 한 곳으로 모으고 RAC 의
  `selectionBehavior="replace"` 규칙을 미러했다.

## [ADR-189 후속 — 다중 선택 편집이 sparse commit lane 을 타지 못하던 결함] - 2026-08-24

### Bug Fixes

- **한 번에 여러 요소를 바꾸는 편집이 전부 전체 재기록으로 떨어지던 문제**:
  - 다중 선택 이동·정렬·다중 드래그처럼 한 commit 이 여러 요소를 건드리면,
    두 번째 요소부터 patch 가 `stale-revision` 으로 거부되고 commit 전체가
    full rebuild 로 수렴했다.
  - 원인은 미지원이 아니라 revision 부기였다. ADR-189 는 다중 dirty root 를
    설계·구현했지만(`dirtyRootIds[]`, `plans[]`, 조상-자손 중복 제거, 중첩 루프),
    `applyPendingCommitPatch` 가 commit 하나에 revision 하나를 계산해 모든 root
    에 재사용했다. 첫 root 가 성공하면 그 값이 rootKey(`page:{id}`) 별 최신
    revision 으로 기록되므로, 같은 페이지의 다음 root 가 자기 자신을 stale 로
    판정했다.
  - splice 하나가 곧 stream publication 하나이므로 루프 안에서 revision 을
    전진시킨다 — presentation lane 이 이미 쓰던 규약과 같다.
  - ADR-190 이전에는 발현할 수 없었다. 유일한 생산자였던 presentation lane 이
    항상 요소 1개짜리 commit 만 보냈기 때문이며, ADR-190 emitter 가 다중 요소
    commit 을 만들 수 있게 되면서 드러났다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`,
    `apps/builder/src/builder/presentation/storeCommitEmitter.ts`

### Performance

- 2,000 요소 문서에서 한 번에 N개 요소를 편집할 때 `render.frame` p95:

  | 동시 편집 요소 | 수정 전 |    수정 후 |
  | -------------: | ------: | ---------: |
  |              2 |  32.6ms |  **1.0ms** |
  |             25 |  31.3ms |  **1.5ms** |
  |            400 |  31.4ms |  **3.1ms** |
  |          2,000 |  31.5ms | **25.1ms** |

- 문서의 모든 요소를 한 번에 바꿔도 sparse 가 여전히 빠르다 (역전 없음). 이득이
  단조 감소할 뿐이라 "일정 규모를 넘으면 전체 재기록" 하는 임계 상수를 두지
  않는다.

### Verification

- 한 commit 이 4개 dirty root 를 splice 한 결과와 새로고침 전체 재기록 결과의
  화면 차이: `1440 × 852` differing pixels **0**, max/mean channel delta 0.
- 회귀 테스트: 같은 페이지의 형제 둘을 한 commit 으로 splice 하는 경로를
  `StoreRenderBridge.commitPatch.test.ts` 로 고정 (수정 전 FAIL 확인).
- **UI 제스처 확인 완료 (같은 날 후속)**: 레이어 트리 shift-클릭으로 두 형제를
  선택한 뒤 ① Properties 패널의 **왼쪽 정렬 버튼 클릭** ② **캔버스 다중 드래그**
  각각에서 `queue 1 / patchSuccess 1 / fallback 0 / full build 0`,
  **subtree build 2** (= 한 commit 에 dirty root 2개 splice). 두 요소가 실제로
  함께 이동했고 console error 0.
  - 앞서 드래그가 안 잡힌 것은 자동화 한계가 아니라 대상 요소가 block flow
    라 드래그 이동 대상이 아니었기 때문이다. `position:absolute` + px 좌표를
    가진 요소에서는 정상 동작한다.

## [ADR-190 Implemented — 일반 편집 경로의 sparse commit lane 진입] - 2026-08-24

### Performance

- **패널·캔버스·AI 편집이 대형 문서에서 매번 전체 재기록하던 문제**:
  - ADR-189 가 만든 sparse commit lane 의 진입점이 presentation 터미널
    descriptor 하나뿐이라, `updateElementProps` 로 들어오는 일반 편집
    (Properties 패널 / 캔버스 텍스트 편집 / AI tool / preview 역방향 동기화) 은
    patch 큐에 진입조차 못 하고 전부 full rebuild 를 탔다.
  - canonical store 경계에 descriptor emitter 를 배선해 같은 lane 을 태운다.
  - 5,000 요소 문서에서 한 요소 스타일 편집: `render.frame` p95
    **73.1ms → 2.6ms**, content 재기록 69.2ms → 0.
  - 1,000 요소 문서에서 컨테이너 자식 추가/삭제: **22.3ms → 1.2ms** /
    **19.4ms → 1.1ms**. body 직속 추가는 18.8ms → 7.4ms (dirty root 가 body 라
    이득이 작다 — 임계 판정은 후속 phase).
  - 위치: `apps/builder/src/builder/presentation/store*CommitDescriptor*.ts`,
    `apps/builder/src/builder/stores/utils/{elementUpdate,elementCreation,elementRemoval}.ts`,
    `apps/builder/src/builder/stores/elements.ts`

### Architecture

- descriptor 변환은 **fail-closed** 다 — patch 최상위가 `style` 단독이 아니거나,
  effect registry 미등재 style 키가 하나라도 섞이거나, projected id 면 descriptor
  를 내지 않고 기존 full rebuild 로 수렴한다. 최악이 종전 성능이라 안전 하한이
  유지된다.
- structure 축(추가/삭제/순서)의 dirty root 는 대상이 아니라 **부모**이며,
  삭제는 post-commit 트리에서 대상이 사라지므로 mutation 전 스냅샷의 부모
  참조를 payload 로 싣는다.
- commit lane sink 계약을 배열로 정의해 한 편집이 만든 여러 mutation 을 한 번에
  전달한다 — 개별 전달 시 `pendingCommit` 단일 슬롯이 앞선 patch 를 덮어썼다.
- `reparent`/`ref`/`slot` 은 출발지·도착지 양쪽이 dirty 라 emit 대상이 아니며
  기존 full rebuild 를 유지한다.

- 다중 선택 편집·정렬·다중 드래그처럼 한 번에 여러 요소를 바꾸는 편집은 종전
  동작(전체 재기록)을 유지한다. commit patcher 가 한 commit 에 dirty root 를
  하나만 처리하기 때문이며, 무익한 시도를 하지 않도록 막아 두었다.
  — **정정 (같은 날 후속)**: 그 제약은 patcher 의 설계가 아니라 revision 부기
  결함이었고 수정됐다. 위 "ADR-189 후속" 항목 참조.
- 새 style 키를 도입하면서 무효화 registry 등재를 빠뜨리면 그 요소는 조용히
  옛 경로로 돌아간다. 축별 거부 카운터로 그 상황을 판독할 수 있게 했다.

### Verification

- patch 경로와 full rebuild 경로의 backing buffer 비교: `1440 × 852`
  differing pixels **0**, max/mean channel delta 0.
- 신규/삭제 노드의 렌더 정합성 12/12 (추가는 store·Skia registry 양쪽 존재,
  삭제는 양쪽 소멸), console error 0.
- 실제 빌더 조작으로 확인: 컴포넌트 팔레트 클릭 추가 / Delete 키 삭제 / ⌘Z
  복원 — 각각 patch 경로 진입과 캔버스 반영을 확인했다.

## [ADR-189 Phase 5 — sparse damage Round 2 closure] - 2026-08-24

### Bug Fixes

- **dirty commit이 여전히 전체 span map과 command stream을 순회하던 문제**:
  - dirty subtree ID 수집을 해당 command span 내부로 제한하고, damage render는
    SpatialIndex 교차 후보와 조상만 포함한 balanced compact sequence를 실행한다.
  - **Why:** tail splice write만 `O(k)`여도 metadata map과 clipped full command replay가
    `O(N)`이면 ADR-189의 대형 문서 비용 분리 계약을 충족하지 못한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{renderCommands.ts,subtreeCommandPatch.ts,skiaFramePipeline.ts}`

- **첫 damage commit의 cold region clear spike**:
  - full surface sync에서 실제 damage와 같은 1px `clip + clear + blit`을 예열하고
    snapshot을 즉시 복원한다.
  - **Why:** 전체 clear 예열만으로는 region clip/clear GPU 상태가 준비되지 않아 실제
    Chrome 첫 paint commit에서 `31.3ms`가 발생했다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts`

### Architecture

- 두 ping-pong surface를 같은 content revision으로 유지하고 damage rect만
  clear/repaint/region-sync한다. commit마다 old snapshot 전면 blit하지 않는다.
- `childrenSpans`와 optional `renderDamageSkia` 계약을 추가하고 전제 불충족은 기존
  full rebuild fallback으로 수렴시킨다.
- 그림자·outline·transform처럼 hit bounds 밖 paint contributor가 있는 장면은
  `damageUnsafeElementIds`로 sparse 진입을 차단해 stale pixel 대신 full rebuild로
  수렴시킨다.

### Performance

- N=50/500/5,000 wide-sibling fixture에서 compact sequence를 조상+target 2개,
  10개 미만 command로 고정했다.
- 실제 Chrome의 `80×40` / `240×240` Button paint commit을 각 8회 측정해 모두
  duration p50/p95 `0.4/0.5ms`, sparse command `11`, fallback `0`을 확인했다.
- 258-node fixture는 전체 1,533 commands 대신 119/209 commands만 실행했고,
  patch와 reload full rebuild의 `1440×852` pixel diff는 0이었다.
- Builder-local sparse/patch/static 회귀 테스트 3 files / 39 tests가 통과했다.

### Documentation

- area ratio를 duration ratio로 대체하던 G3 판정을 정정하고, 신규 structure node
  자체의 Preview DOM↔Skia 80×40 draw/hit parity를 G5 증적으로 추가했다.
- ADR 본문의 Phase 중복을 breakdown으로 옮기고 ADR-189를 README 완료 표로 이동했다.

## ColorArea focus 접근성 경고 수정 — 2026-08-24

### Bug Fixes

- **ColorArea의 focus 중 `aria-hidden` 경고**:
  - RAC `ColorArea`의 두 native range input이 focus 전환 중 active element에 `aria-hidden="true"`로 커밋되지 않도록 보정했다.
  - **Why**: React의 `focusedInput` 상태가 브라우저의 `document.activeElement`보다 한 render 늦을 수 있어, 세로 y축 input이 아직 focus인 순간 hidden 처리될 수 있었다.
  - 수정: `react-aria@3.51.0` patch에 active input 노출 guard 추가, controlled value update 회귀 테스트와 Builder live keyboard 검증을 반영했다.
  - 위치: `patches/react-aria@3.51.0.patch`, `apps/builder/src/builder/panels/styles/components/ColorArea.ariaHidden.test.tsx`

## [Catch-up 2026-08-20 ~ 2026-08-23] - 2026-08-23

### Architecture

- **ADR-187/188/189 presentation·layout·commit lane bundle**:
  - 에디터 프레젠테이션 transaction runtime과 typed invalidation, targeted layout/Skia subtree patch,
    incremental commit record 설계를 각각 Accepted/Implemented 범위까지 단계적으로 연결했다.
  - **Why**: paint·layout·canonical commit의 전체 문서 fan-out을 분리하고, 실제 affected target만 갱신하는
    경계를 고정하기 위해서다.

### Features

- **Spectrum authoring surface parity bundle**:
  - TextArea, GridList/Tree selectionStyle, ToggleButtonGroup density/staticColor, quiet/isDisabled,
    Tag avatar/icon, Progress/TimeField min/max 등 감사에서 확인된 DOM·catalog·Skia 표면 단절을 복구했다.

### Infrastructure

- **Build/runtime maintenance bundle**:
  - Vite/Rolldown 및 React plugin 전환, lucide/react-router 업데이트, 보안 패치와 미사용 dependency 제거를
    반영했다.

## Builder 컨텍스트 메뉴 재우클릭 교체 — 2026-08-24

### Bug Fixes

- **컨텍스트 메뉴가 열린 상태에서 다른 대상·위치의 우클릭을 무시하던 문제**:
  - 메뉴가 열린 뒤 캔버스의 다른 요소·빈 영역 또는 LayerTree 행을 다시 우클릭하면 기존 메뉴가 그대로 남던 문제를 수정했다.
  - **Why**: RAC `Popover`의 modal underlay가 Builder root를 `inert`로 만들어 새 `contextmenu` 이벤트가 Canvas/LayerTree 소비자에 도달하지 않았다.
  - 수정: context-menu Popover를 non-modal로 전환하고, 메뉴가 열린 동안에만 outside `pointerdown`을 소비해 기존 닫힘 동작을 보존했다. 이어지는 `contextmenu`는 새 대상에 전달되며 메뉴 포커스와 Escape 닫힘도 유지한다.
  - 위치: `apps/builder/src/builder/components/overlay/contextMenu/{ContextMenuOverlay.tsx,useContextMenu.tsx}`

## ADR-187 Phase 6 종결 — exact-URL G8 live gate — 2026-08-24

### Bug Fixes

- **Builder Canvas context-menu provider identity 복구**:
  - `BuilderViewport` provider와 `BuilderCanvas` consumer가 같은 정본 모듈을 직접 import하도록 통일했다.
  - **Why:** Vite HMR에서 barrel 경로와 직접 경로가 서로 다른 context module identity로 materialize되어
    `useContextMenu must be used within a ContextMenuProvider`가 발생했다.
  - 위치: `apps/builder/src/builder/{main/BuilderViewport.tsx,workspace/canvas/BuilderCanvas.tsx}`

### Architecture

- ColorPicker와 fill hook/store의 외부 RAF·`updateSelectedFillsPreview*` 경로를 제거했다.
- 지원되지 않는 fill 연속 편집은 commit-only로 fail-closed하고, 지원 대상은
  presentation runtime 단일 scheduler를 계속 사용한다.
- presentation owner가 없는 공용 `PropertyColor`도 raw input legacy preview를 호출하지
  않고 pointer terminal에서만 commit한다.
- fill이 없는 virtual-fill 상태도 raw ColorArea input에서 canonical fill을 생성하지 않고
  pointer terminal에서 정확히 한 번 승격한다.
- secondary `FillLayerRow`의 optional `onUpdatePreview` seam을 삭제하고 raw color/gradient/
  opacity callback을 명시적 no-op으로 고정해 구 preview 경로 재연결을 차단했다.

### Performance

- Phase 6 정적 guard와 fill/store 회귀 테스트를 추가해 중첩 scheduler와 paint preview
  `layoutVersion` write 재도입을 차단했다.
- query 없는 정확한 Builder URL에서 DEV opt-in 계측을 활성화해 Button fill ColorArea를
  5초 이상 5회(native raw input 1,080/run) 드래그했다. drag 중 canonical/legacy/layout/
  Preview full-document/bridge full-rebuild는 전 회차 0, target patch는 573~~766회였다.
- frame apply p95는 전 회차 `0.2ms`, p99 최대 `0.3ms`, max `1.6ms`였고 8.33ms 초과
  sample은 0이다. terminal canonical write와 full-document message는 각 1회, stale callback과
  console error/warning/`requestAnimationFrame` violation은 0이다.
- exact-URL one-shot parity probe에서 drag plateau `#C94F4FFF`, terminal handoff, 원래
  `#704848FF` 복원 상태의 Preview computed color와 Skia fill target max channel delta가
  모두 `0`이어서 HC9(`≤1/255`, retirement 후 `0`)를 직접 통과했다.
- 증적: [ADR-187 Phase 6 G8 exact-URL live parity](adr/design/187-phase-6-g8-live-parity.md)

### Documentation

- Phase 0~~6/G0~~G8 완료에 따라 ADR-187을 `Accepted → Implemented`로 승격하고
  `docs/adr/completed/`로 이관했다.

## ADR-187 Phase 5 flow layout·Text metric parity 승격 gate — 2026-08-24

### Architecture

- **generic multi-sibling Skia layout handoff 종결**:
  - fixed-size flow container의 `padding`/`gap` patch가 page/body root로
    promotion되지 않도록 spacing mutation root를 자체 subtree에 고정했다.
  - visible sibling fixture로 Preview rect, Skia `bounds`/`hitBounds`,
    SpatialIndex hit, 비영향 identity, terminal canonical handoff를 같은
    presentation revision에서 검증했다.
  - **Why:** used-size parent promotion이 unrelated identity를 재생성해
    다중 형제 hit topology와 Canvas 복귀를 불안정하게 만들 수 있었다.
  - 위치: `apps/builder/src/builder/presentation/editorPresentationLayoutLane.ts`

- **fixed Text metric parity live gate 종결**:
  - `fontSize`/`fontWeight` presentation patch가 Preview CSS와 Skia
    `presentationTextMetricTargets`·paragraph cache key를 함께 갱신하고
    cancel terminal에서 exact restore하도록 populated Builder evidence를
    추가했다.
  - `fontFamily`/`lineHeight`/`letterSpacing`, resource, structure는
    affected subtree consumer가 없어 commit-only fail-closed를 유지한다.
  - 위치: `apps/builder/scripts/adr187-presentation-baseline.mjs`,
    `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`

### Performance

- **Phase 5 allowlist live evidence**:
  - width/height/padding/gap 4개 property의 runtime apply p95 `0.45–1.56ms`,
    Skia render p95 `1.02–1.18ms`, long task `0`을 확인했다.
  - Text fontSize/fontWeight는 Canvas pixel 변경·복귀, paragraph key 변경·복귀,
    bounds/hitBounds 불변과 Preview/Skia metric parity를 모두 통과했다.
  - 증적: [flow layout live parity](adr/design/187-phase-5-layout-flow-live-parity.md),
    [text metrics residual slice](adr/design/187-phase-5-text-metrics-resource-structure-fail-closed.md)

### Documentation

- ADR-187 Phase 5 구현 allowlist를 갱신했다. generic multi-sibling layout과 fixed
  Text metric은 승격 준비 상태이며, explicit opacity의 pre-fix
  `targetIncrementalPatchCount=0` 원인인 visible `renderNodesMap` projection 누락도
  보강했다. 최종 Phase 5 승격 전에는 post-fix populated Builder live counter만
  재확인한다. ADR 전체 `Implemented` 승격은 Phase 6 legacy 제거 및 G0~G8 전체
  조건 이후로 유지한다.

## ADR-187 Phase 5 Modified Styles opacity presentation slice — 2026-08-24

### Architecture

- **명시적 Modified Styles opacity owner 연결**:
  - 기존 Skia `opacity` effect slot의 값만 갱신하고 Preview에는 semantic
    `style.patch.opacity`를 전달한다. `PANEL_STYLE_PROPS`와 Appearance reset union도
    함께 갱신해 modified count/reset baseline을 일치시켰다.
  - effect materialization이 없는 `opacity: 1`, inherited/state opacity는
    fail-closed하여 기존 commit 경로를 유지한다.
  - **Why:** opacity drag가 layout/scene 재구축과 중첩 RAF로 확장되지 않도록 명시적
    paint slot만 연속 업데이트하기 위해서다.
  - 증적: [ADR-187 Phase 5 Modified Styles opacity live parity](adr/design/187-phase-5-modified-styles-opacity-live-parity.md)

### Performance

- 실제 Builder Compare Mode에서 `220×120` Button의 opacity `0.5 → 0` drag를 검증했다.
  rect 불변, action/control RAF `0/0`, legacy write `0`, console error/warning `0/0`,
  Preview delta `+1`, frame apply `+1`을 확인했다.

## ADR-187 Phase 5 box-shadow presentation slice — 2026-08-23

### Architecture

- **Box Shadow effect slot presentation owner 연결**:
  - Appearance의 `boxShadow` 변경은 기존 Skia `drop-shadow` effect slot의 offset·blur·spread·color를
    같은 layer 수와 inset topology 안에서만 in-place 갱신하고, Preview에는 semantic style delta를 보낸다.
  - layer 추가/삭제와 inset 전환은 command/effect topology가 달라져 legacy canonical commit으로 fail-closed한다.
  - **Why:** topology가 바뀐 shadow를 기존 command stream에 덮어쓰면 `effectLayerCount`가 stale해져 canvas stack이
    어긋날 수 있고, paint-only shadow를 full scene materialization으로 일반화하면 `requestAnimationFrame` 비용이 다시 문서 크기에 결합된다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererTypes.ts,StoreRenderBridge.ts,styleConversion/styleConverter.ts}`

- **Continuous BoxShadowEditor 연결 (ADR-187 Phase 5)**:
  - 다중 shadow layer selector와 offset X/Y·blur·spread·color 편집을 하나의
    `BoxShadowPresentationValue` typed model로 연결했다. same-topology 조건에서만 Skia effect slot과
    Preview CSS를 함께 갱신하고, topology 변경은 canonical 경로로 fail-closed한다.
  - **Why:** shadow field별 CSS 재파싱과 control별 RAF를 제거해 연속 편집 비용을 target paint에 고정하기 위해서다.
  - 위치: `apps/builder/src/builder/{presentation/boxShadowPresentation.ts,panels/styles/components/BoxShadowEditor.tsx}`

### Performance

- **Builder Compare Mode live gate**:
  - 3-layer `md → lg` 변경에서 Skia target patch `+60`, Preview delta `+2`, legacy write `+0`, action/control RAF `0/0`을 확인했다.
  - Preview computed shadow가 `lg` 3-layer로 수렴했고 rect `110×70, 220×120`은 유지됐다. discrete terminal commit의 기존 commit-lane fallback/full rebuild은 증적에 분리 기록했다.
  - 증적: [ADR-187 Phase 5 box-shadow live parity](adr/design/187-phase-5-box-shadow-live-parity.md)

- **Continuous shadow live gate**:
  - 실제 Builder 2-layer outer+inset shadow에서 숫자 4개와 ColorArea drag를 수행해 Preview rect 불변,
    action/control RAF `0/0`, legacy write `0`, console error/warning `0/0`을 확인했다.
  - numeric frame apply `+4`, color frame apply `+5`, Preview delta `+10/+5`, 최종 color `#CC2F2F14`가
    canonical style에 수렴했다.
  - 증적: [ADR-187 Phase 5 box-shadow live parity — continuous editor](adr/design/187-phase-5-box-shadow-live-parity.md)

## ADR-187 Phase 5 standalone Text color presentation slice — 2026-08-23

### Architecture

- **Typography Text color picker를 typed presentation owner로 연결**:
  - standalone `Text` 선택에서만 `style.patch.color`를 허용하고, drag 중 canonical
    style은 유지한 채 Skia `presentationTextTargets` color slot과 Preview semantic
    delta를 갱신한다.
  - paragraph content/metrics/cache와 geometry는 보존하며, inherited/component color,
    text metrics/resource와 structure는 기존 commit-only 경계로 fail-closed한다.
  - **Why:** text color만 바뀌는 drag가 paragraph 재생성·layout publication·canonical
    document fan-out으로 확대되지 않도록 paint-only target을 고정하기 위해서다.
  - 위치: `apps/builder/src/builder/{presentation/editorPresentationStylePilot.ts,panels/styles/sections/TypographySection.tsx,workspace/canvas/skia/{nodeRendererTypes.ts,specShapeConverter.ts,nodeRendererText.ts,StoreRenderBridge.ts}}`

### Performance

- **Builder Compare Mode live gate**:
  - standalone Text `220×80` ColorArea drag에서 Preview color가
    `rgb(17,34,51) → rgb(45,121,196)`으로 반영되고 rect는 유지됐다.
  - drag 중 canonical color 유지, target patch `+60`, Preview delta message `+8`,
    presentation frame apply `+8`, action/control RAF `0/0`, legacy write `0`이었다.
  - terminal에서 canonical color `#2D79C4`와 Preview가 수렴했고 canonical write와
    Preview full-document message는 각각 `+1`, application console error/warning은
    `0/0`이었다.
  - 증적: [ADR-187 Phase 5 standalone Text color live parity](adr/design/187-phase-5-text-color-live-parity.md)

## ADR-187 Phase 5 Button text-bearing color presentation slice — 2026-08-24

### Architecture

- **Button root Typography color를 typed presentation owner로 확장**:
  - Button과 standalone Text만 명시적 text-bearing capability로 허용하고, Button 자체
    Skia node의 text slots와 Preview root `style.patch.color`를 같은 semantic target에
    연결했다.
  - multi-child inherited subtree와 기타 component root는 descendant projection이
    materialize되지 않으면 canonical/legacy 경로로 fail-closed한다.
  - **Why:** component root의 inherited text color도 geometry·child topology를 건드리지
    않고 paint target에 한정하되, 임의 container의 partial descendant patch는 허용하지
    않기 위해서다.
  - 위치: `apps/builder/src/builder/presentation/{editorPresentationTextColor.ts,editorPresentationStylePilot.ts,editorPresentationCommitAdapter.ts}`

### Performance

- **Builder Compare Mode live gate**:
  - Button `220×120` ColorArea drag에서 Preview color가
    `rgb(17,34,51) → rgb(44,121,199)`으로 반영되고 rect는 유지됐다.
  - drag 중 canonical color 유지, target patch `+60`, Preview delta message `+8`,
    presentation frame apply `+8`, action/control RAF `0/0`, legacy write `0`이었다.
  - terminal에서 canonical color `#2C79C7`와 Preview가 수렴했고 canonical write와
    Preview full-document message는 각각 `+1`, application console error/warning은
    `0/0`이었다.
  - 증적: [ADR-187 Phase 5 Button text-bearing color live parity](adr/design/187-phase-5-text-bearing-color-live-parity.md)

## ADR-187 Phase 5 Modified Styles color presentation slice — 2026-08-24

### Architecture

- **Modified Styles 필터도 typed color owner를 사용**:
  - `borderColor`는 border presentation owner, `color`는 검증된 Text/Button root
    owner를 사용한다.
  - owner가 없는 background/다중 child/미검증 component root는 기존 fallback을
    유지한다. `backgroundColor`는 Fill V2 파생 스타일이므로 수정하지 않는다.
  - 위치: `apps/builder/src/builder/panels/styles/sections/ModifiedStylesSection.tsx`

### Performance

- **Builder Modify filter live gate**:
  - Button ColorArea drag에서 canonical color는 drag 중 유지되고 terminal에서 1회
    `#297ACC`로 handoff됐다.
  - Preview `rgb(41, 122, 204)`, rect `220×120` 불변, action/control RAF `0/0`,
    legacy write `0`, terminal event `1`, console error/warning `0/0`이었다.
  - 증적: [ADR-187 Phase 5 Modified Styles color live parity](adr/design/187-phase-5-modified-styles-color-live-parity.md)

## ADR-187 Phase 5 border color presentation slice — 2026-08-23

### Architecture

- **Border Color picker를 typed paint presentation owner로 연결**:
  - Appearance의 `borderColor` pointer drag는 canonical style을 매 event마다 쓰지 않고
    Skia mutable stroke slot과 Preview semantic delta만 갱신한다.
  - pointer-up에서 `style.patch` canonical commit으로 handoff하며, `borderWidth`·radius·style와
    shadow 등 layout/topology 축은 기존 경로에 남긴다.
  - **Why:** 색상만 바뀌는 drag가 full-store preview/layout publication과 겹치면
    `requestAnimationFrame` handler 비용이 문서 크기와 결합되기 때문이다.
  - 위치: `apps/builder/src/builder/panels/styles/{sections/AppearanceSection.tsx,hooks/useStylePresentationActions.ts}`

### Performance

- **Builder Compare Mode live gate**:
  - drag 중 typed Skia target patch `6`, Preview delta `6`, legacy write/full rebuild/layout
    publish/projection 증가 `0`, action/control RAF `0`을 확인했다.
  - canonical style은 시작값을 유지했고, terminal 후 canonical write `1회`와 Preview
    computed border color `rgb(209,209,209)`로 수렴했다.
  - 증적: [ADR-187 Phase 5 border color live parity](adr/design/187-phase-5-border-color-live-parity.md)

## ADR-187 Phase 5 단일 fill opacity presentation slice — 2026-08-23

### Architecture

- **단일 fill opacity presentation owner 연결**:
  - Style 패널 Fill detail popover의 opacity scrub을 single-fill
    `color/linear/radial/angular` paint presentation owner와 연결했다.
  - drag 중 typed Skia target patch와 Preview semantic delta만 publish하고 pointer-up에서
    canonical `fills.replace`로 handoff한다. 다중/image/mesh fill은 기존 경로를 유지한다.
  - **Why:** opacity drag가 매 pointer event마다 legacy full-store preview와 겹치면
    presentation frame 비용이 문서 크기와 RAF 중첩에 결합하기 때문이다.
  - 위치: `apps/builder/src/builder/panels/styles/{sections/FillSection.tsx,components/FillDetailPopover.tsx,hooks/useFillActions.ts}`

### Performance

- **Builder Compare Mode live gate**:
  - opacity drag 중 legacy write/full rebuild/layout publish/projection 증가 `0`, Skia
    target patch `8`, Preview delta `8`, action/control RAF `0`을 확인했다.
  - terminal canonical opacity와 Preview gradient alpha가 모두 `0.55`로 수렴하고,
    pointer-lock rejection은 dx scrub fallback으로 흡수되어 console error/warning `0/0`이었다.
  - 증적: [ADR-187 Phase 5 fill opacity live parity](adr/design/187-phase-5-fill-opacity-live-parity.md)

## ADR-187 Phase 5 gradient stop presentation slice — 2026-08-23

### Architecture

- **단일 gradient stop presentation owner 연결**:
  - Style 패널의 single-fill linear/radial/angular gradient stop 색상·position을
    typed Skia paint slot과 Preview semantic delta에 연결했다.
  - `GradientBar` 자체 RAF를 제거하고 runtime이 frame ownership을 단일화했다.
  - **Why:** stop drag가 control/action RAF와 legacy full-store preview를 겹쳐
    `requestAnimationFrame` handler 비용과 문서 N 의존성을 함께 만들지 않도록 하기 위해서다.
  - 위치: `apps/builder/src/builder/panels/styles/components/GradientBar.tsx`,
    `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`

### Performance

- **Builder Compare Mode live gate**:
  - drag 구간의 증가분은 legacy write/full rebuild/layout publish `0`, Skia target
    patch `8`, Preview delta `8`, console error/warning `0`이었다.
  - terminal 후 stop position `0.282957...`와 Preview gradient `28%`가 유지되고
    canonical finish는 1회였다.
  - 증적: [ADR-187 Phase 5 gradient stop live parity](adr/design/187-phase-5-gradient-stop-live-parity.md)

## ADR-189 Phase 0 commit lane baseline — 2026-08-23

### Performance

- **N-tier canonical commit baseline 고정**:
  - 실제 Builder에서 N=50/500/5,000 한 요소 style commit을 5회씩 측정해 full stream DFS, content record, flush+snapshot, SpatialIndex 축을 분리했다.
  - N=5,000 `record+stream` p95가 75.1ms로 확인되어, 단일 요소 commit도 문서 크기에 따라 frame budget을 초과할 수 있음을 고정했다.
  - **Why:** 기존 commit 경로가 dirty subtree patch가 아니라 full DFS + full content record를 수행해 `requestAnimationFrame` commit-after 구간을 N에 비례하게 만들기 때문이다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`, `apps/builder/scripts/adr189-commit-baseline.mjs`
  - 증적: [ADR-189 Phase 0 G0 baseline](adr/design/189-phase-0-g0-baseline.md)

## ADR-187 Phase 4 targeted layout lane — 2026-08-23

### Architecture

- **G6 scoped layout presentation 종결**:
  - ADR-188 targeted publication/Skia subtree patch를 ADR-187 layout lane의 실제
    production consumer로 검증했다. `position:absolute` 숫자형 `left/top`·`x/y`만
    affected subtree patch로 승격하고 reflow·size/intrinsic·fixed/sticky·ref descendant·
    structure는 commit-only fail-closed로 유지한다.
  - Builder 상단 Compare Mode split에서 Preview DOM과 Skia draw/hit bounds의 clipped
    geometry, revision 원자성, cancel 복원을 N=50/500/5,000에서 재현했다.
  - Why: layout overlay를 전역 `layoutVersion++` 또는 full page traversal로 승격하면
    대상 하나의 continuous edit가 문서 N에 결합하고, Preview/Skia hit-test가 서로 다른
    geometry를 소비할 수 있기 때문이다.
  - 위치: `apps/builder/src/builder/presentation/skiaEditorPresentationLayoutBridge.ts`,
    `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`,
    `apps/builder/scripts/adr187-presentation-baseline.mjs`

### Performance

- **120Hz live gate**:
  - N=5,000에서도 runtime apply p95/p99 `0.617/0.674ms`, Skia frame
    p95/p99 `3.913/4.064ms`, long task `0`이었다.
  - canonical/legacy write, global layout publish, projection signature, full rebuild,
    Preview full-document message, stale terminal callback은 모두 `0`이었다.
  - 증적: [ADR-187 Phase 4/G6 live parity](adr/design/187-phase-4-g6-live-parity.md)

## ADR-189 Phase 2 command span splice + Phase 3 damage clip + Phase 4 G4 live parity — 2026-08-23

### Architecture

- variable-length commit subtree를 위해 command stream을 Array-compatible piece-table로
  유지하고 span을 cursor 기반으로 지연 해석한다. 자식 추가·제거와 command-count 변화가
  있어도 tail 전체를 다시 쓰지 않는다.
- ADR-188 presentation lane의 고정 길이 reject 계약은 보존하고, commit lane만 별도
  patch API와 full-rebuild fallback counter를 사용한다. canonical terminal descriptor는
  `StoreRenderBridge`가 post-commit sync에서 소비하며, 성공한 stream은 새 cache key로
  승격한다.

### Verification

- 로컬 G2 fixture에서 trailing span 이동, write budget, bounds/hit/SpatialIndex/revision
  원자성 및 기존 presentation 회귀를 검증했다. type-check 신규 위반은 0개다.
- populated canonical live trace에서 201개 active node `fills.replace` commit의
  `queue/success/fallback=1/1/0`, `patchWriteCount=6`, commit 후 full build `0`,
  subtree visit `1`, command cache miss `0`, console error `0`을 확인했다.
- 동일 target selection 상태의 canvas backing buffer를 patch 결과와 reload full rebuild
  결과로 대조해 `1440 × 852`, differing pixels `0`, max/mean channel delta `0`,
  console error/warning `0/0`을 확인했다. G2 splice 구조·write budget·pixel closure가
  모두 완료됐다. [Phase 2 evidence](adr/design/189-phase-2-g2-command-splice.md)

- **G3 damage clip — 부분 재기록과 snapshot 면적 비례 검증**:
  - commit subtree의 이전·이후 `hitBounds` 합집합을 `StoreRenderBridge`에서
    `SkiaRenderer`까지 전달하고, ping-pong standby surface에 직전 snapshot을
    blit한 뒤 damage rect만 clip 재기록한다. 같은 canonical revision의
    `visibleContentVersion` 감지가 damage를 full invalidation으로 덮어쓰던 경계도
    제거했다.
  - populated Builder 258 active node의 small-80 / large-240 commit에서 patch
    visits `1`, full build `0`, `damageRender/fallback=1/0`을 각각 확인했다.
    damage ratio `0.0014546` → `0.0079577`은 hitBounds 면적 5.625배에 대해
    5.47배로 증가했다.
  - patch와 reload full rebuild의 `1440 × 852` canvas backing buffer diff는
    differing pixels `0`, max/mean channel delta `0`, console error/warning `0/0`이다.
    [Phase 3 evidence](adr/design/189-phase-3-g3-damage-clip.md)

### Phase 4 / G4

- 실제 Builder 상단 Compare Mode split에서 258 active node populated fixture의
  paint·style/layout·structure 편집을 exercise했다. paint 8회는
  `patchSuccess/fallback=1/0`, subtree visits `1`, full build `0`,
  `damageRender/fallback=1/0`을 유지했고 CSS Preview DOM과 Skia hitBounds의
  rect·색상·revision이 일치했다.
- paint `render.frame` p95/p99 `1.3/1.3ms`로 120Hz 기준 `<4/<8.33ms`를 통과했고,
  50/100ms violation 및 console error/warning은 `0/0`이었다. generic
  style/layout·structure는 descriptor 부재를 full-rebuild fallback으로 분류해
  각각 p95/p99 `2.2/2.2ms`, `1.7/1.7ms`로 stale 없이 수렴했다.
- ADR-189 Status를 `Accepted → Implemented`로 승격했다. [Phase 4 evidence](adr/design/189-phase-4-g4-live-parity.md)

## ADR-188 targeted layout input/result — 2026-08-22

### Architecture

- persistent layout에 `roots`/`parentChain`/`affectedNodeIds` typed input과 targeted result
  collection을 추가하고, input 방문·result 수집·engine compute counter를 분리했다.
- mutation registry의 `usedSizeEffect`와 layout container 규칙표를 합성해 in-flow sibling을
  포함하는 parent promotion을 runtime에서 판정한다. explicit sized ancestor와
  `position:absolute` 경계는 fail-closed로 유지한다.
- Rust layout tree는 `subtree_dirty` 요약 플래그를 사용해 clean subtree skip 판정을 O(1)로
  바꾸고, dirty 전파·intrinsic 측정 snapshot/restore·solve 완료 정리를 같은 상태 계약으로
  묶었다. [ADR-188 Phase 1 evidence](adr/design/188-phase-1-g1-targeted-input.md)
- canonical-full과 presentation-targeted layout publication을 별도 typed channel로
  분리했다. targeted lane은 canonical base map을 복사하지 않고 affected delta overlay와
  root별 revision만 보유하며, page/frame multi-root plan은 `planSequence` group으로
  원자 적용/거부한다. rootKey 파생은 publisher/cache/engine 공용 helper로 단일화했다.
  [ADR-188 Phase 2 evidence](adr/design/188-phase-2-g2-publication.md)
- Skia command stream이 단일 DFS에서 element subtree span, 조상 clip, z-order,
  scroll/sticky context와 top-layer metadata를 함께 보유한다. 고정 길이 subtree의 draw
  command·bounds·hit bounds·SpatialIndex를 같은 revision으로 원자 교체하고, span/clip/
  scroll/z-order/top-layer 또는 revision 전제가 깨지면 fail-closed로 거부한다. 실제
  publication subscription과 allowlist 연결은 다음 Phase에서 수행한다.
  [ADR-188 Phase 3 evidence](adr/design/188-phase-3-g3-g4-skia-subtree-patch.md)
- ADR-187 runtime의 layout event를 `SkiaEditorPresentationLayoutBridge`가
  production에서 소비한다. `position:absolute` 숫자형 `left/top`·`x/y`만
  rootKey별 typed publication과 local subtree draw/hit patch로 승격하고, reflow·size·
  intrinsic·fixed/sticky·ref descendant·문자열 값은 commit-only로 fail-closed 처리한다.
  cancel/no-op/failed terminal의 canonical restore와 committed revision latch를
  Store sync에 연결했다. Preview `CanonicalNodeRenderer`도 같은 allowlist를 사용해
  DOM/Skia geometry capability를 맞춘다. [ADR-188 Phase 4 evidence](adr/design/188-phase-4-g5-adr187-layout-wiring.md)

### Performance

- ADR-188을 `Implemented`로 종결했다. 실제 Builder 상단 Compare Mode split에서
  document N=50/500/5,000, 가시 target 1개 조건으로 120Hz layout presentation을
  tier당 5회 측정했다. N=5,000 runtime apply 중앙 p95/p99는
  `0.165/0.179ms`, Skia frame은 `1.487/1.548ms`이며 전체 15회 long task와
  console error/warn는 0이다.
- DOM/Skia clipped width, WASM SpatialIndex hit, draw/hit revision, command span 불변,
  canvas pixel 변화·cancel 완전 복원과 canonical store 불변을 15/15 확인했다. 초기 G6
  RED는 paint lane, `V=N` dense fixture, synthetic `Box`, 별도 Vite module instance를
  측정한 하니스 결함으로 분리하고 layout 전용 constant-visible-workload 하니스로
  교정했다. [ADR-188 Phase 5 evidence](adr/design/188-phase-5-g6-live-parity.md)

## ADR-187 색상 드래그 presentation 기반 - 2026-08-22

### Architecture

- Style Panel 색상 편집을 canonical document와 분리된 Editor Presentation Transaction으로
  옮길 수 있는 공용 runtime과 mutation classifier를 추가했다. 드래그 중 값은 session overlay로
  유지하고, 종료할 때만 canonical-first runner를 1회 실행해 history와 저장을 함께 확정한다.
- Skia는 semantic target에서 현재 보이는 draw slot만 찾는 projection index와 typed fill
  capability를 사용한다. box·line·arc의 실제 color buffer만 갱신하며 component 고유 opacity를
  보존하고, cancel·projection 이동·canonical handoff 시 원래 값을 정확히 복원하거나 ownership만
  해제한다.

### Performance

- Phase 3 code land에서 Color Picker의 raw input은 중첩 RAF나 document 재순회 없이 frame당
  최신 semantic delta 한 번만 `O(1) + O(k)`로 Skia와 상단 Compare Mode의 Preview에 전달된다.
  finish 전에는 canonical document를 다시 보내지 않고, finish 시 canonical revision envelope를
  먼저 보장한 뒤 Preview overlay를 atomic retire한다. `?adr187FillPilot=0`은 명시적 rollback
  스위치로 남겨 두었다.
- protocol/bridge/store/renderer 집중 81개와 전체 Builder 4081개 테스트가 통과했다. 실제
  상단 Compare Mode split에서 populated canonical fixture의 Color picker pointer drag도
  콘솔 오류/경고 없이 동작했다. Preview DOM은 `Badge`/`Button`으로 hydration됐고
  색상 값 `#290505FF`를 소비했다.
- Phase 3 closure trace(N=50/500/5,000, 5초 native pointer cadence)에서 drag 중
  canonical/legacy/layout/projection/full rebuild/full-document message는 0이고
  Preview delta와 target incremental patch만 발생했다. N=5,000의 장시간은
  presentation handler가 아닌 전체 Skia scene render lane으로 분리 기록했으며,
  Phase 4의 paint/layout/structure consumer 분리 범위다.
- Phase 4 첫 slice는 runtime snapshot에 paint/layout/structure revision과 semantic
  root 집합을 분리하고, affected subtree만 layout map에 병합하는 순수 planner/resolver와
  회귀 테스트를 추가했다. Persistent Taffy 결과 수집에는 `getLayoutsForIds` seam을
  추가해 TagList post-fold 측정처럼 실제 소비 노드 `k`개만 WASM batch로 되돌려받도록
  했다. 계산 자체는 여전히 page-root dirty compute 경계에 있으며, production
  `useLayoutPublisher`/Skia targeted 연결은 다음 slice의 G6 증명 전까지 보류한다.
  `computeDirtyLayoutForIds`도 추가해 used-size 승격 dirty root와 affected 결과 집합을
  분리하는 엔진 계약을 고정했다.
  - **Why**: 기존에는 picker와 store action의 중첩 RAF 뒤에 full-document preview/scene 작업이
    이어져 단일 `requestAnimationFrame` callback이 52ms까지 길어질 수 있었다.

## 여러 줄 입력(TextArea) 속성 편집 - 2026-08-22

### Bug Fixes

- 여러 줄 입력 상자에서 오류 문구와 필수 표시("\*" 또는 "(required)")를 속성 패널에서 넣을 수
  없던 문제를 수정했다. 두 값은 화면에 그리는 쪽에서는 원래 받고 있었고 **넣을 자리만** 없었다 —
  한 줄 입력 상자(TextField)에는 있는 항목이라 형제끼리 어긋나 있었다.
- 입력 도우미 5종(자동완성 / 자동수정 / 입력 모드 / 엔터키 힌트 / 맞춤법 검사)도 여러 줄 입력
  상자에 추가했다. 모바일 키보드 종류를 지정하는 등 한 줄 입력 상자와 같은 편집이 가능해진다.

### Known Issues

- 입력 상자를 "오류" 상태로 두고 오류 문구를 넣어도 **캔버스에는 표시되지 않는다** — 미리보기만
  빨간 테두리와 문구를 보여준다. 필수 표시도 미리보기는 작고 흐린 글씨, 캔버스는 라벨과 같은
  크기로 보여 두 화면이 다르다. 둘 다 이번 변경으로 생긴 것이 아니라 입력 상자 계열 전체가
  원래 갖고 있던 차이이며, 별도 건으로 정리한다.

## Select/ComboBox 선택값 표시 - 2026-08-22

### Bug Fixes

- Select·ComboBox 에서 옵션을 골라도 캔버스에는 계속 안내 문구(placeholder)가 보이던 문제를
  수정했다. 미리보기와 캔버스가 이제 같은 값을 보여준다. 값을 지우면 양쪽 다 안내 문구로
  돌아온다.
- 실행 취소(undo)로 선택이 되돌아가도 미리보기가 이전 선택을 계속 표시하던 문제를 함께
  수정했다. 캔버스는 바로 바뀌고 미리보기만 남아 있어 둘이 어긋나 보였다.

## 메뉴 선택 표시 - 2026-08-22

### Bug Fixes

- 메뉴에서 선택 모드를 켜고 항목을 골라도 어떤 항목이 선택됐는지 화면에 표시되지 않던 문제를
  수정했다. 선택 상태 자체는 정상 저장되고 있었고 표시만 없었다. 이제 다중 선택 메뉴는 선택한
  항목에 체크(✓), 단일 선택 메뉴는 점(●)을 accent 색으로 표시한다.
- 표시 자리는 선택 여부와 관계없이 확보되므로 항목을 고를 때 글자가 밀리지 않는다. 선택을 쓰지
  않는 메뉴(선택 모드 None)는 자리도 만들지 않아 기존 메뉴 모양이 그대로다.

## 세로 snap panel stack의 남은 높이 resize - 2026-08-22

### Bug Fixes

- top-left/top/top-right에 snap된 세로 panel stack에서 내부 splitter를 아래로
  resize할 때, 아래 panel이 `minHeight`에 닿으면 browser 아래쪽에 공간이 남아도
  위 panel이 더 이상 커지지 않던 문제를 수정했다.
- paired resize가 소비하지 못한 pointer 이동량을 같은 column의 실제 남은 workspace
  높이로 이어서 계산한다. 마지막 panel의 bottom이 workspace 끝에 닿을 때까지
  splitter가 pointer를 따르며, interaction 시작 layout 기준 계산으로 clamp 이후 복귀도
  유지한다.

## Center snap 패널 수평 대칭 resize - 2026-08-22

### Bug Fixes

- center-top/center/center-bottom zone에 snap된 패널의 좌·우 resize가 반대쪽 edge를
  고정하며 패널 중심을 이동시키던 문제를 수정했다. center anchor와 기존
  `originOffset.x`는 유지하고 width를 pointer edge 이동량의 2배로 계산해, 잡은 edge는
  마우스를 정확히 따르면서 반대 edge가 같은 거리만큼 반대 방향으로 이동한다.
- resize는 interaction 시작 layout을 기준으로 계속 계산하므로 min/max clamp를 넘겼다가
  돌아와도 pointer와 panel edge가 다시 일치한다. 좌·우 양 edge와 top/center/bottom zone을
  회귀 테스트로 고정했다.

## GridList quiet - 2026-08-22

### Added

- GridList 에 Quiet 표시를 추가했다. 켜면 카드에서 배경과 테두리가 사라지고 라벨·설명만 남으며
  (마우스를 올리면 배경이 돌아온다), 선택된 카드의 accent 테두리는 그대로 유지된다. 캔버스와
  미리보기가 같은 결과를 낸다.

### Bug Fixes

- `selectionMode` 가 Single 인 GridList 의 캔버스 카드에 미리보기에는 없는 선택 체크박스가
  그려지고 카드가 22px 높아지던 문제를 수정했다(2026-08-21 변경에서 유입). GridList 는
  Multiple 에서만 체크박스를 그린다 — Tree 는 Single 에서도 그리며, 둘의 차이는 의도된 것이다.
- GridList 카드가 variant 별 시각 규칙을 전혀 적용받지 못하던 문제를 수정했다(규칙 파일이
  스타일 목록에 빠져 있었고 카드 마크업에도 속성이 없었다). 기본 카드의 시각은 변화 없다.

## GridList 카드 선택 체크박스 Skia 대칭 - 2026-08-22

### Bug Fixes

- `selectionStyle="checkbox"` 인 GridList 카드에서 캔버스(Skia)가 선택 체크박스를 그리지
  않고 카드 높이도 highlight 기준으로 남던 문제를 수정했다. 카드는 세로 스택이라 체크박스가
  라벨 위에 서고 카드가 22px 높아진다(브라우저 실측 98 vs 76) — 이제 두 화면의 카드 높이와
  체크박스 위치가 같다.
- Properties 패널에서 Selection Style 을 바꿔도 새로고침 전에는 캔버스 카드 높이가 그대로던
  문제를 수정했다. 선택 축이 레이아웃에 영향을 주는 prop 으로 등록되고, 행 레이아웃 캐시가
  체크박스 표시 여부를 시그니처에 포함한다.
- GridList 카드가 선택돼도 캔버스에서 accent 테두리·체크 표시가 나오지 않던 문제를 수정했다
  (행 투영이 선택 신호를 한 가지 이름으로만 전달하고 있었다).

## Tree 선택 체크박스 Skia 대칭 - 2026-08-21

### Bug Fixes

- **`selectionStyle="checkbox"` 인데 캔버스에는 체크박스가 없었다** (감사 §1-2 축② 2/2):
  - DOM 은 RAC 가 `<Checkbox slot="selection">` 을 Tree 행 첫 자식으로 렌더하는데 Skia 는
    그 슬롯 자체가 없었다. 실측 — DOM 라벨 x=52 / Skia 30 (정확히 체크박스 폭 22 만큼 어긋남).
  - **Why**: 체크박스는 `leadingIcon`(chevron) 과 **다른 슬롯**이다. 기존 좌측 슬롯 모델은
    icon ↔ avatar 처럼 배타 관계만 다뤘고, "앞에 하나 더 서는" 가산 슬롯이 없었다.
  - 신설 `selectionCheckbox` 채널 + `selection_checkbox` primitive(append). 폭 예약은
    `resolveSelectionSlot` 한 helper 를 text(buildCatalogShapes)와 chevron(leading_icon)이
    함께 더한다 — 갈리면 라벨이 체크박스 위에 겹친다.
  - 가시성 신호(`_showSelectionCheckbox`)는 builder 가 부모 Tree 의 selectionMode·
    selectionStyle 로 산출해 주입하고, DOM 렌더러와 **같은 helper**(`resolveSelectionBehavior`,
    같은 fallback)를 쓴다 — 두 표면의 판정이 갈리지 않게.

## 컬렉션 selectionStyle 채널 (GridList·Tree) - 2026-08-21

### Features

- **`selectionStyle` D2 표면 신설** (design-data 감사 §1-2 축②):
  - RSP ListView/TreeView 의 `selectionStyle` — 선택을 **무엇으로 표시하는가**.
    `"checkbox"`(행 체크박스) | `"highlight"`(배경 강조만, 클릭이 선택을 교체).
  - RAC 는 같은 축을 `selectionBehavior`(`"toggle"`/`"replace"`)로 부른다. 패널·binding 은
    RSP 이름을 쓰고 변환은 `resolveSelectionBehavior` 한 곳에서만 한다.
  - 기본값은 **컴포넌트마다 다르다** — GridList `checkbox`, Tree `highlight`. 두 렌더러가
    종전에 넘기던 `selectionBehavior`(각각 toggle/replace)를 그대로 보존한 값이라, 기존
    문서의 시각이 이 변경으로 바뀌지 않는다(RSP 기본은 둘 다 checkbox).

### Bug Fixes

- **선택 축이 패널에서 편집 불가였다**: 두 렌더러가 `element.props.selectionBehavior` 를
  이미 읽고 있었으나 `accepts` 에 없어 패널에 노출되지 않았고, RSP 이름도 없었다.

### Architecture

- **변환을 한 곳에 모은 이유 — 기본값이 갈려 있었다**: Tree 렌더러는 `"replace"`, GridList
  렌더러는 `"toggle"` 을 기본으로 넘겼다. 컴포넌트와 렌더러가 각자 변환하면 같은 사용자
  선택이 한쪽에서만 체크박스를 낸다. 그래서 helper 가 **fallback 을 인자로 받는다**.

### Known Issue

- **checkbox 모드는 Skia 가 체크박스를 그리지 않는다** (기존 결손, 이번 변경 이전부터).
  실측: GridList 행 DOM 98px(체크박스) vs 76px(highlight), Skia 컨테이너 164 = 76×2+gap 12 →
  **Skia 는 highlight 기하**. 즉 `highlight` 는 지금 두 표면이 일치하고, `checkbox` 는
  DOM 에만 체크박스가 있다. Skia 대칭은 후속 슬라이스.

## Tag chip 항목별 avatar 슬롯 - 2026-08-21

### Features

- **TagGroup itemSchema `avatar` 채택** (design-data 감사 §2-C Tag avatar 슬롯 — icon 에 이어
  같은 항목의 나머지 절반):
  - 항목별 이미지 URL 을 지정하면 chip 좌측에 원형 아바타가 그려진다. `icon`(glyph)과 **같은
    좌측 슬롯**을 공유하며, 둘 다 지정된 항목은 **avatar 가 이긴다** — 나란히 그리면 chip
    (fit-content) 폭과 시각이 함께 어긋난다.
  - DOM: `.tag-leading-avatar`(16px 원 + object-fit cover + 4px 간격, 장식이라
    `alt=""`/`aria-hidden`). Skia: catalog `Tag.variants[*].leadingAvatar.srcProp: "avatar"`
    - `leading_avatar` skiaPrimitive(append) — 원 배경 위에 원형 클립 이미지.
  - 폭은 세 곳이 같은 값(지름 16 + gap 4): catalog rule / layout 상수
    (`TAG_LEADING_AVATAR_SIZE`·`GAP`) / 수동 CSS. `tagLeadingIconMetric.test.ts` 가
    catalog 와의 불일치 + "두 슬롯 폭 합산 금지" 를 잡는다.

### Bug Fixes

- **행 데이터의 이미지 URL 이 icon slot 으로 새고 있었다**: `getItemIcon` 이 `avatar`/`image`
  키를 아이콘 이름 fallback 으로 읽어, URL 이 들어 있으면 **아무것도 렌더되지 않은 채 아이콘
  폭만 예약**됐다(ListBox/GridList 포함). 이제 값의 형태로 갈린다 — glyph 이름에는 경로
  구분자도 확장자도 없고, URL/경로/data URI 는 아이콘 이름일 수 없다. 이미지 참조는 신설
  `avatar` slot(`getItemAvatar`)으로, glyph 이름은 종전대로 icon slot 으로 간다.

### Architecture

- **`leadingAvatar` — 좌측 슬롯의 두 번째 표현**:
  - 슬롯이 하나뿐이라 판정도 하나여야 한다. `resolveLeadingSlot`(buildCatalogShapes)이
    avatar > icon > 없음을 정하고, **폭 shift 와 그리기 primitive 2종이 그 결론을 공유**한다.
    DOM 도 `renderTagLeadingSlot` 단일 헬퍼로 같은 우선순위를 쓴다(chip 본체 / maxRows 미러 /
    `renderTagGroup` items 경로 3곳).
  - Skia 는 이미지가 비동기 로드라 원 배경을 먼저 그린다 — URL 이 잘못된 항목이 빈 자리로
    남지 않도록 DOM `<img>` 의 빈 영역과 대응하는 자리표시를 둔다.

## Tag chip 항목별 leading icon - 2026-08-21

### Features

- **TagGroup itemSchema `icon` 채택** (design-data 감사 §2-A Tag avatar/icon 슬롯):
  - Select/ComboBox itemSchema 와 같은 `icon` 채널을 Tag 항목에 추가 — 패널에서 chip 별
    아이콘을 지정한다.
  - DOM: chip 안 `.tag-leading-icon` glyph(14px + 4px 간격, 프로젝트 고정-크기 아이콘 관례).
  - Skia: catalog `Tag.variants[*].leadingIcon.nameProp: "icon"` + `leading_icon`
    skiaPrimitive(append). **rule 데이터 게이팅** — 아이콘 이름이 없는 chip 은 glyph 도,
    텍스트 shift 도 없다(chip 은 fit-content 라 여백만 생기면 폭이 그대로 발산한다).
  - 폭은 세 곳이 같은 값(icon 14 + gap 4)을 쓴다: catalog rule / layout 상수
    (`TAG_LEADING_ICON_SIZE`·`GAP` — chip 박스 폭 + wrap·maxRows 접힘 판정) / 수동 CSS.
    `tagLeadingIconMetric.test.ts` 가 catalog 와 상수의 불일치를 잡는다.

### Architecture

- **`leadingIcon.nameProp` — rule 정적 이름과 행 데이터의 합성 채널**:
  - 기존 leadingIcon 은 rule 의 고정 glyph(DisclosureHeader chevron 등) 전용이라 항목별
    아이콘을 표현할 수 없었다. `nameProp` 으로 `props[key]` 를 읽고, 없으면 `name` 폴백,
    둘 다 없으면 미표시 — trailingIcon 의 `showProp` 과 같은 데이터-게이팅 idiom.
  - 폭 shift(`buildCatalogShapes`)와 glyph(`leading_icon` primitive)가 **같은 helper**
    (`resolveLeadingIconName`)로 판정한다 — 둘이 갈리면 "폭은 밀렸는데 아이콘이 없다"가 된다
    (실제로 이번 작업 중 stale dist 상태에서 그 증상이 재현됐다).

## Select·ComboBox 팝오버 행 icon/description 렌더 - 2026-08-21

### Bug Fixes

- **itemSchema 의 icon/description 이 팝오버에서 안 보였다** (design-data 감사 §1-1):
  - 두 컴포넌트의 `itemSchema` 는 icon/description 을 선언하고 패널 편집도 되는데, 팝오버
    행은 `{label}` 문자열만 emit 했다. ListBox 행만 slot 마크업을 emit 했고 ListBox.css 의
    `[slot="icon"]`/`[slot="description"]` 규칙은 클래스 스코프라 팝오버 행에도 이미
    적용되고 있었다 — **빠진 것은 마크업뿐**.
  - **Why**: 같은 `.react-aria-ListBoxItem` 행을 세 곳(ListBox 렌더러 / Select 팝오버 /
    ComboBox 팝오버)이 각자 만들고 있었다. 마크업을 `renderListBoxItemSlotContent` 단일
    소스로 모아 재발을 막는다.
  - 팝오버는 canvas projection 이 없는 DOM 전용 표면이라(트리거만 그린다) Skia 대칭 영향 없음.
- **팝오버 컨텍스트 충돌 2건 동반 수리**:
  - 좌측 `--spacing-xl` gutter 는 선택 표시(`[data-selected]::before` ✓)가 쓰는 자리인데
    icon 이 같은 자리에 놓여 라벨과 겹쳤다 → icon 을 gutter 다음으로 옮기고 텍스트 여백을
    `calc(--spacing-xl + icon + 6px)` 로 확장.
  - 행 우측 체크마크까지 렌더되면 선택 행에 체크가 둘이 된다 → 팝오버 경로는
    `showSelectionCheck: false` (좌측 ✓ 가 이미 담당).
- live: preview iframe 에서 icon/label/description 3행 렌더 + icon 행 padding-left 46px /
  icon left 24px(겹침 없음) + 선택 행 trailing check 0개 + 트리거는 라벨만 표시
  (description 은 catalog 규칙이 이미 `display:none`).

## field labelAlign — 죽어 있던 side 라벨 정렬 채널 복구 (축① 완결) - 2026-08-21

### Bug Fixes

- **side 라벨 폭이 캔버스와 preview 에서 달랐다** (10종 field):
  - Skia 는 `labelPosition="side"` 에서 Label 에 176px 고정폭을 주입하는데 DOM 에는 대응
    rule 이 없어 라벨이 자연폭이었다. catalog 가 `--form-label-width: 11rem` 을 정의만 하고
    **읽는 CSS rule 이 0건**이었던 것이 원인.
  - **Why**: 폭 채널이 반쪽만 배선돼 있으면 같은 문서가 두 화면에서 다르게 보인다 —
    labelAlign 이 시각으로 나타나는 전제(라벨 박스가 텍스트보다 넓음)도 함께 무너진다.
- **labelAlign "end" 가 캔버스에서 조용히 좌측 정렬됐다**:
  - `resolveLabelAlignment` 이 RSP 값(`start`/`end`)을 그대로 shape align 에 실었는데 Skia
    shape align 은 `left|center|right` 만 인식 → 미지 값이 좌측으로 떨어졌다. CSS 는
    `text-align: start/end` 를 그대로 이해해 DOM 만 정상이었다 (값 어휘 불일치).

### Features

- **field 10종 labelAlign 채택** (design-data 감사 §1-2 축①):
  - TextField/TextArea/NumberField/SearchField/Select/ComboBox/DateField/TimeField/
    DatePicker/DateRangePicker — binding accepts + 컴포넌트 `data-label-align` + 렌더러 전달.
  - DOM: catalog nested rule 이 side 모드 라벨에 `width: var(--form-label-width, 11rem)` +
    `text-align: var(--form-label-align, start)` 적용. Skia: `start|center|end` →
    `left|center|right` 매핑.
  - 상속 규칙은 양 경로 동일(nearest-wins): 자기 prop 우선, 없으면 Form 조상 —
    **Form 상속 범위도 DOM 렌더러와 동일하게** FormRenderers 4종으로 한정(Date/Selection
    6종은 자기 prop만; 그 범위 불일치 자체는 별도 관찰 항목).
  - CheckboxGroup/RadioGroup 제외 — 라벨 자연폭이 이미 정본이라 정렬이 성립하지 않는다.

## ToggleButtonGroup staticColor — 그룹→자식 상속 채널 (축③ 완결) - 2026-08-21

### Features

- **ToggleButtonGroup staticColor** (design-data 감사 §1-2 축③ 마지막 1종):
  - RSP S2 ActionButtonGroup 정의대로 **자식 상속 채널**. 그룹 자체 fill 은 transparent
    이라 시각이 바뀌지 않고, 흑백 스킴은 자식 ToggleButton 에서 성립한다.
  - DOM: `ToggleButtonGroupStaticColorContext` → 자식 `data-static-color`.
    Skia: `resolveToggleGroupContext` 주입(orientation/density 와 같은 경로).
    **두 경로 모두 자식 명시값 우선** — propagation rule(override:true)은 자식이 지정한
    값을 덮어쓰고 문서를 변형하므로 채택하지 않았다.
  - indicator 모드 조합 시각 확정: 트랙 = static 25% wash / 선택 pill = solid static /
    비선택 라벨 = static 색 (수동 `ToggleButtonGroup.css`). Skia 는 indicator 모드
    렌더 자체가 없는 **기존** 비대칭이라 DOM 쪽만 깨지지 않게 유지.

### Fixed

- **ToggleButton isQuiet / staticColor 가 DOM 경로에서만 dead 였던 결손**:
  delegating renderer(`renderToggleButton`)가 두 prop 을 shared 컴포넌트로 넘기지 않아,
  catalog·CSS·D2 표면이 모두 갖춰진 뒤에도 Preview/publish 에서 미적용이었다(Skia 는
  canonical props 직독이라 CSS↔Skia 비대칭). 그룹 렌더러도 staticColor 전달 추가.
- **static 이 border-width 채널 없는 컨테이너에 검은 테두리를 그리던 Skia 결손**:
  `buildCatalogShapes` 가 `size.borderWidth ?? 1` fallback 탓에 DOM 이 그리지 않는
  테두리를 static 색으로 그렸다. "border-width 채널 보유 또는 불투명 border 색" 을
  데이터 기준으로 판정하도록 수정(ToggleButton 형 대칭은 그대로 유지).
- live 검증: 패널 Static Color=Black → 캔버스 3버튼 흑백, 자식 1개만 White 지정 시
  그 버튼만 반전, Preview iframe computed(bg #000/#fff, 그룹 border-width 0px).
- 회귀: DOM 상속 4케이스 + renderer 전달 3케이스 + Skia 주입 3케이스 + static 테두리
  조건 3케이스.

## ProgressBar·ProgressCircle over background — staticColor 채택 - 2026-08-21

### Features

- **ProgressBar/ProgressCircle staticColor (RSP S2 "over background")** (design-data 감사 §2-F, §1-2 축③):
  - 유색/이미지 배경 위 고정 흑백 — Button 형(bg 반전) 이식이 아니라 value-fill 2채널
    스킴 신설: track = static 25% wash / fill·indicator = solid static / ProgressBar
    label·value 텍스트 = static.
  - DOM: 수동 `ProgressBar.css` `[data-static-color]` var 재정의(unlayered — generated
    variant var 를 cascade 로 이김) + ProgressCircle.tsx 인라인 stroke.
  - Skia: value_fill_bar/arc static 분기 + buildCatalogShapes **fillBar-채널 데이터
    분기**(track wash 0.25 — Button 형 solid 반전과 구분) + propagation
    (staticColor → ProgressBarTrack raw / Label·Value 텍스트 style.color) +
    ArcShape.strokeAlpha 채널 신설.
  - toRacProps: DATA_ATTR_ENUM_KEYS 도 propPassthrough 허용 (ProgressCircle 어댑터가
    staticColor 를 색 계산 input 으로 소비하는 outlier — StatusLight variant 동형).
  - live 검증: 캔버스 black 60% bar/ring + 25% wash + auto 대조군, DOM
    computed(--fill-color #000 / --track-color rgb(0 0 0 / 0.25)), 패널 Static Color 노출.
  - 회귀: skiaPrimitives.progressStaticColor 7케이스 + DOM leg 4케이스.

## isDisabled 노출 3종 + IconButton 편집 표면 확장 - 2026-08-21

### Features

- **Badge/StatusLight/Avatar isDisabled 노출** (design-data 감사 §2-F):
  - D3 `states.disabled`(opacity 0.38)는 3종 모두 준비돼 있었으나 binding accepts
    미노출로 패널 편집 불가. Badge 는 data-disabled → generated CSS, StatusLight 는
    인라인 dim(generated class 미부여 outlier — Avatar 동형), Skia 는 componentState
    generic 이 즉시 소비.
  - live 검증: 캔버스 dim(뱃지·dot·아바타 0.38) + publish DOM data-disabled/opacity 실측.
- **IconButton instance 편집 표면 확장 — Static Color/Disabled** (감사 §2-A):
  - Button root binding 은 기수용이나 propsSchema 미노출로 instance 편집 불가하던 결손.
    repairOrigin 이 구버전 seed 문서 root props 에도 기본값을 채운다.
  - isQuiet 은 기각 판정 — composition IconButton 정체성은 Button+icon 조합(S2 Button
    엔 isQuiet 없음), ActionButton 계열 신설 시에만 재개.
  - live 검증: 패널 Static Color/Disabled 필드 + staticColor black → 캔버스 흑백 스킴.

## Toggle 계열 xl 완결 — Checkbox 채택 + indicator catalog 배선 - 2026-08-21

### Bug Fixes

- **Radio/Switch xl 이 md 로 렌더되던 결손 수정** (design-data 감사 §1-3):
  - catalog 에 xl 이 기존재했으나 수동 CSS xl 블록(Radio.css/Switch.css)과 layout
    `PHANTOM_INDICATOR_CONFIGS` xl 키가 없어 xl 선택 시 시각·배치 모두 md fallback.
  - **Why**: size 축 확장이 catalog(D2/D3 emit)에만 반영되고 수동 CSS 미러와
    layout config 의 `as "sm"|"md"|"lg"` 캐스트 4곳이 xl 을 md 로 강제 정규화.
  - 수정: CSS xl 블록 + config xl + `phantomIndicatorSizeKey()` 헬퍼로 캐스트 교체.
- **Checkbox/Radio/Switch Skia indicator 가 전 size 고정(md 값)이던 비대칭 수정**:
  - Skia primitive 는 처음부터 `size.indicator.*` 를 읽도록 작성돼 있었으나 catalog
    에 대응 필드 부재로 box 20 / track 36×20 하드코딩 fallback — DOM(16/20/24)과 비대칭.
  - 수정: `ComponentRuleSize.indicator` 를 specs `IndicatorSpec` 동형으로 확장,
    Checkbox(boxSize 16~~30)/Radio(+dotSize 6~~14)/Switch(track 32~52) catalog 배선.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`

### Features

- **Checkbox/CheckboxGroup xl size 채택** (Spectrum 4단계 규정 — Radio/Switch 형제 대칭):
  - catalog xl(fontSize text-xl·gap 12 / gap 20) + Checkbox.css xl + generated CSS.
  - live 검증: 캔버스 XL indicator 30px + 패널 Size S/M/L/XL + publish DOM
    computed(box 30px·gap 12px / Switch track 52×30) — 3 leg 동일 값.
  - 회귀: `toggleIndicatorXlCatalog.test.ts` 11케이스 (catalog↔layout↔Skia 3자 동치).

## Vite 8 — Rolldown 번들러 전환 - 2026-08-21

### Infrastructure

- **vite 7.3.6 → 8.2.2**: catalog 단일 버전으로 builder/publish 동시 전환.
  `build.rollupOptions` → `build.rolldownOptions`, Tailwind v4 `@utility`
  호환을 위해 `build.cssMinify: "esbuild"` 유지 (Vite 8 기본 Lightning CSS 미사용).
  - 후속: `@vitejs/plugin-react-swc` → `@vitejs/plugin-react` 6.1 (Oxc React
    refresh) — SWC 플러그인 미사용이라 Rolldown 권장 경로로 전환.
  - 검증: type-check PASS, test 3926 PASS, `vite build` builder+publish,
    live `http://127.0.0.1:5173` 랜딩·dashboard 로드.

## Node 패널 공통 디자인 정렬 — Panel/Section style contract - 2026-08-21

### Bug Fixes

- **Node 패널이 Properties/Styles 패널과 다른 sidebar 스타일로 남아 있던 문제 수정**:
  - Pages·Layers·Frames를 공통 `Section`과 `ActionIconButton` 구조로 전환하고,
    panel shell·header·content padding·semantic color token을 현재 패널 규칙에 맞췄다.
  - Tree row도 Layout의 ID·Class Name control과 같은 28px 높이와 6px radius
    token을 사용하도록 맞췄다.
  - Row의 좌우 padding은 `--spacing`, 우측 action은 Parent Page Select 내부와
    같은 `--text-xl` 크기를 사용해 control 내부 rhythm도 통일했다.
  - Tree interaction도 Builder 공통 flat row 상태로 정리했다. hover/pressed는
    foreground 8%/12% tint, selected는 `--accent-subtle`, keyboard focus는 독립된
    2px focus ring을 사용하며, selected의 중복 배경·outline·inset shadow를 제거했다.
    우측 action은 hover·selected뿐 아니라 keyboard focus와 `:focus-within`에서도
    노출된다.
  - Public `Tree.css`는 `<Tree data-composition-tree>` 경계 안에서만 적용되도록
    격리했다. raw React Aria Tree를 사용하는 authoring panel이 public Tree의
    hover/pressed/selected 배경을 함께 상속해 반투명 상태가 이중 합성되던 전역
    selector 충돌을 원인에서 차단했다.
  - Page/Layer/Frame tree의 텍스트 앞 타입 아이콘, depth 들여쓰기 세로선,
    expand·selection·drag action은 기존 tree 정보구조 그대로 유지했다.
  - **Why:** 초기 sidebar 전용 `.section-content { all: unset; }`과 수동
    `PanelHeader` 조합이 공통 8px padding/background/typography를 제거하고 있었다.
  - 위치: `apps/builder/src/builder/panels/nodes/`

## lucide-react 1.x · react-router 8 - 2026-08-21

### Infrastructure

- **lucide-react 0.575 → 1.33**: 구 alias 아이콘명을 정식명으로 교체
  (`AlertCircle`→`CircleAlert` 등), extract 스크립트를 `.mjs`/동적 resolve 로 갱신.
- **react-router 7 → 8**: `react-router-dom` 패키지 제거, import 를 `react-router` 로 통일.

## 의존성 보안 패치 — vitest/vite/react-router/postcss/nanoid - 2026-08-21

### Infrastructure

- **critical/high 취약점 일괄 해소**: `@vitest/browser` 4.1.11, `vite` 7.3.6,
  `react-router` 7.18.2, `postcss` 8.5.26, `nanoid` 5.1.16 등 범위 내 갱신 +
  저위험 major(`jsdom` 30, `puppeteer` 25, `eslint` 10 in config).
  `pnpm audit --audit-level high` 기준 critical/high 0건.

## ProgressCircle·TimeField 형제 대칭 — min/max 지원 - 2026-08-21

### Added

- **ProgressCircle 이 minValue/maxValue 를 받는다** (ProgressBar 형제 대칭). 종전엔
  0–100 스케일이 캔버스 호(arc)와 미리보기 SVG 양쪽에 하드코딩되어 있었다 — 이제
  둘 다 `(value-min)/(max-min)` 비율로 그려지고 aria-valuemin/max 도 따라간다.
  실측: min 50 / max 150 / value 100 → 반원(50%).
- **TimeField 가 minValue/maxValue 를 받는다** (DateField 형제 대칭). "HH:mm" 문자열을
  패널에 입력하면 컴포넌트가 Time 으로 파싱해 RAC 검증에 전달한다.

### Fixed

- TimeField granularity 옵션에서 근거 없는 "Day" 제거 — 시각 필드의 RAC granularity
  는 hour/minute/second 뿐이고 렌더러도 그 3종만 수용하고 있었다 (죽은 옵션).

## Spectrum 수치 규칙 일괄 채택 — 필드 최소폭·ProgressBar 상하한·Tooltip 최대폭·Separator 두께 축·Table 행 hover - 2026-08-21

### Added

- **짧은 필드가 알아볼 수 없게 좁아지지 않는다.** TextField 는 높이의 1.5배
  (xs 27 ~ xl 81px), SearchField 는 3배(sm 66 ~ xl 162px)를 최소폭으로 갖는다 —
  Spectrum 식별성 하한, Button(2.25×) 채택과 동형. 캔버스(Skia)와 미리보기(DOM)가
  같은 catalog 값을 읽는다.
- **ProgressBar 는 48px 아래로 접히지 않고 768px 위로 늘어나지 않는다** (Spectrum
  guideline). 이를 위해 catalog `sizes.maxWidth` 채널을 신설했다 (타입 + CSS 생성
  - 엔진 주입).
- **Tooltip 은 160px 에서 줄바꿈한다** (Spectrum 스키마 수치). 캔버스 쪽은 tooltip
  전용 주입 분기를 신설해 해소 — catalog 값이 미리보기에만 도달하고 캔버스 엔진
  채널이 없던 결손이었고, 함께 `width: fit-content` 를 주입해 캔버스 tooltip 이
  부모 폭으로 늘어나던 발산도 정렬했다.
- **Separator 크기가 이제 실제로 두께를 바꾼다** — sm 1px / md 2px / lg 4px
  (Spectrum divider S/M/L). 종전엔 세 크기가 전부 같은 두께라 크기 축이 시각적으로
  무력했다. 기본(md) 구분선이 1px → 2px 로 굵어진다.
- **Table 행에 hover 배경이 생겼다** (Spectrum: 행 hover 상시 피드백). 선택 배경은
  기존 그대로.

### Fixed

- **Separator 크기 축이 죽어 있던 근본 원인 제거** — 생성 시점에 factory 가
  `height: 1` 을 요소 style 에 구워 넣어, catalog 두께 값(캔버스·미리보기·CSS 3
  소비처)이 영구히 가려졌다. 기존 문서의 구분선은 저장된 1px 을 유지한다 (신규
  생성분부터 catalog 두께 적용).
- 수동 Separator.css(1/1/2px)와 catalog(1/1/1px)가 서로 달랐던 선재 비대칭도 두께
  축 정렬로 함께 해소.

> 판정 기록: ColorSlider 최소 길이 80px 은 보류 (표준 채널 부재 — 감사 문서 §1-4
> 수리 현황 참조). vertical Separator 의 캔버스 두께 축은 선재 결손으로 별도 추적.

## 컴포넌트 패널에서 꺼낼 수 없던 4종 노출 — TextArea·Meter·Pagination·ColorField - 2026-08-21

### Fixed

- **TextArea 가 컴포넌트 패널에 없어서 애초에 배치할 수가 없었다.** catalog 의 패널 정보
  (Forms / "text area" / 아이콘)와 생성 함수는 처음부터 있었는데 팔레트 표시 순서 배열에만
  빠져 있었다 — 2026-06-11 에 구 정적 목록에서 자동 캡처할 때 없던 것이 그대로 굳은 결손이지
  의도적 비노출이 아니다.
- **같은 형태가 3종 더 있었다** — 생성 함수와 팔레트 목록을 전수 대조해 찾았다. **Meter**
  (형제 ProgressBar 는 목록에 있었다), **Pagination**, **ColorField**(형제 TextField/
  NumberField/SearchField 는 있었다). 셋 다 패널 정보·생성 함수·전용 렌더러를 모두 갖췄는데
  목록에만 없어 꺼낼 수 없었고, 제외 사유는 코드 어디에도 없었다. Forms 14종 → 17종,
  Layout 10종 → 11종.

> 남은 미노출 중 **의도적인 것 4종**: 알림(Toast — 코드로만 띄움) / Radio(라디오 그룹 안에서만
> 의미) / Navigation(Nav 의 다른 이름) / DataTable(화면 표현 없는 데이터). **판단이 필요한 것
> 2종**: ColorPicker·ColorSwatchPicker 는 카탈로그 분류가 `color` 인데 팔레트에는 그 분류가
> 아예 없다 — 배열 누락이 아니라 분류를 forms 로 옮길지 새로 만들지 결정이 먼저다.

## TextArea 가 드디어 여러 줄이 된다 + field 크기 전파 결손 해소 - 2026-08-21

### Fixed

- **TextArea 가 미리보기에서 한 줄 `<input>` 으로 그려지고 있었다.** 이름이 TextArea 인데
  여러 줄이 아니었고 `rows` 를 바꿔도 아무 변화가 없었다. 원인은 렌더 경로였다 — catalog
  generic 경로가 RAC `TextField` 를 그리고 그 안에 팔레트가 만든 `Input` 자식이 들어갔다.
  RAC 에는 TextArea **컨테이너** 자체가 없고 `<TextField>` 안에 `<TextArea>` 입력을 넣는 것이
  정본 구조라, TextField 와 같은 방식(wrapper self-compose)으로 맞췄다. 이제 진짜
  `<textarea>` 가 그려지고 `rows` 가 높이에 반영된다 (실측 md: 3줄 70px → 6줄 130px).
- **크기 위임이 `<textarea>` 에 닿지 않던 것도 함께 고쳤다.** 크기별 글자·여백 규칙이
  `.react-aria-Input` 만 노리고 있어 textarea 는 통째로 못 받았다. 실측 결과 이제 S~XL 에서
  글자 12/14/16/18px, 여백 2·8 → 12·24px 로 따라간다.
- **TextArea 의 크기 전파 규칙이 `Label` 하나뿐이었다** (형제 TextField 에는 `Input` 규칙이
  있다). 증상이 한쪽에만 나타나 눈에 잘 안 띄었다 — 미리보기는 CSS 자손 규칙 덕분에 정상으로
  보였고 **캔버스만** 입력 상자가 기본 크기(M)에 고정됐다. 전파 규칙이 없으면 속성 패널 전파와
  캔버스 위임이 **동시에** 끊긴다(같은 색인을 공유한다). `label`·`placeholder` 전파도 함께
  채웠다. 크기 전파 계약 테스트에 TextArea/TextField 와 `Input` 자식을 추가해 재발을 막았다.

## TextArea 생성 CSS 가 통째로 미매칭이던 문제 해소 + Skia 사이즈 스케일 정렬 - 2026-08-21

### Fixed

- **캔버스(Skia)와 미리보기(DOM)가 TextArea 의 크기 스케일에서 한 단계 어긋나 있었다.**
  미리보기 실측값과 catalog 값이 이렇게 달랐다:

  | 항목      | 미리보기(DOM) 실측  | 구 catalog 값 (캔버스) |
  | --------- | ------------------- | ---------------------- |
  | paddingX  | 8 / 12 / 16 / 24    | 10 / 14 / 16 / 24      |
  | 모서리    | 4 / 6 / 8 / 12      | 4 / 6 / 6 / 8          |
  | 글자 크기 | xs / sm / base / lg | sm / base / lg / xl    |

  Spectrum 도 text area 를 "text field 가 지원하는 표준 옵션 전부"로 규정하므로 타입 스케일
  공유가 정본이다 — 어긋난 쪽은 캔버스였다. 이제 두 화면이 같은 값을 본다. 여러 줄 입력
  상자라는 성질에서 오는 `height`(64/80/120/160)만 TextArea 고유값으로 남겼다.

- **원인은 도달할 수 없는 CSS 였다.** canonical `TextArea` 는 DOM 에서 RAC `TextField` 로
  렌더된다 — RAC 에는 TextArea **컨테이너** primitive 가 없어 TextField 가 감싸고, RAC 가
  자기 이름으로 클래스를 붙이기 때문이다. 그래서 `.react-aria-TextArea` 를 노리던 생성
  `TextArea.css` 는 **구조적으로 영원히 걸리지 않았고**, 실제 시각은 TextField 의 생성 CSS
  가 담당했다. 겉보기로는 정상이라 드러나지 않던 상태다.
- 이제 그런 rule 은 **CSS 를 만들지 않는다**. 게이트는 컴포넌트 이름 목록이 아니라 binding
  데이터에서 파생하므로(`source.component ≠ rule key`) 같은 형태가 새로 생겨도 자동 적용된다.
  나머지 92개 파일의 생성 결과는 바이트 단위로 동일하다.
- `.react-aria-TextArea` 라는 이름을 되살리지 않은 것은 그것이 RAC 에서 **안쪽 `<textarea>`**
  의 클래스이기 때문이다. 컨테이너 규칙을 그 이름으로 내보내면 나중에 진짜 textarea 가
  들어오는 순간 엉뚱한 요소에 걸린다.

> 스코프 밖 (이번에 발견, 별도 과제): ① 팔레트가 만드는 TextArea 의 입력 자식이 `Input`
> 이라 DOM 은 **한 줄 `<input>`** 으로 렌더된다 — `rows` 가 시각에 반영되지 않는다.
> ② field 패밀리의 부모→자식 크기 위임(`.react-aria-TextField[data-size] .react-aria-Input`)
> 이 CSS 에만 있고 캔버스에는 없어, 자리표시자 글자 크기가 두 화면에서 갈린다.

## TextArea quiet 배선 — boolean 시각 prop 의 data-\* 라우팅 - 2026-08-21

### Fixed

- **TextArea 의 Quiet 편집 항목이 실제로 동작한다** — field 패밀리 11종 중 TextArea 만 quiet
  시각 규칙이 0건인 형제 비대칭이었다. 프로퍼티 패널에는 항목이 있는데 아무 일도 일어나지
  않던 상태다.
- 근본 원인은 prop 투영기(`toRacProps`)였다. `isQuiet` 은 boolean 이라 raw React prop 으로
  통과했는데, RAC primitive 는 모르는 prop 이라 무시되고 `data-quiet` 도 붙지 않아 theme CSS
  가 걸리지 않았다 (`labelPosition`/`staticColor` 가 겪은 것과 같은 결함 축). 이제 boolean
  시각 prop 을 `data-*` 로 라우팅한다 — **켜졌을 때만** 내보내, 꺼진 상태에서 존재 셀렉터가
  걸리는 일이 없다.
- 부수 효과로 raw 경로를 타던 ColorField/ComboBox/DatePicker/DateRangePicker/Link/Select 의
  quiet 도 함께 살아난다.
- TextArea 의 quiet 시각은 TextField 와 **동형**(배경·테두리 제거 + 밑줄 1선)으로 맞췄다 —
  같은 패밀리 안에서 quiet 의 뜻이 갈리지 않도록 의도적으로 복제했다.

> 스코프 밖 (알려진 상태): field 계열 quiet 은 DOM 전용이고 캔버스(Skia)는 여전히 일반 입력
> 상자로 그린다. quiet 의 캔버스 표현에는 배경 외에 테두리 제거·밑줄 채널이 필요한데 아직
> 없다 — TextArea 만 반쪽을 넣으면 패밀리 안에서 또 갈리므로 기존 10종과 같은 상태로 두었다.

## ToggleButtonGroup density + Tabs·ToggleButtonGroup 기본값 Spectrum default 전환 - 2026-08-21

### Features

- **ToggleButtonGroup 에 `density` 가 생겼다** — Spectrum ActionGroup 규정을 근거로 삼았다:
  _"compact density retains the same font and icon sizes, but has tighter spacing. **The
  action buttons also become connected** for non-quiet action groups."_ 즉 버튼이 연결되는
  것은 orientation 의 성질이 아니라 **compact density 의 성질**이다.
  - `regular` (기본): 버튼 분리 — gap 8 + 버튼별 균등 radius
  - `compact`: 연결 — gap 0 + 양끝만 radius + 인접 겹침 (종전 시각)
- 구 구조는 연결 규칙을 `orientation` 에 매달아 **항상 연결**이었고(= Spectrum 기준 compact
  고정) default 인 regular 를 표현할 수 없었다. 2축 조합은 `&[data-orientation="…"]`
  compound selector 로 표현한다 — catalog 의 attr gate 는 하나만 붙기 때문이다.

### Changed

- **기본 density 2건을 Spectrum 스키마 default 인 `regular` 로 전환** (사용자 결정):
  - **Tabs/TabList**: 탭 사이 간격 0 → 8. DOM 렌더러는 이미 `data-density` 기본을 regular 로
    내보내고 있어서, 구 catalog 기본 `compact` 는 오히려 DOM↔Skia 비대칭이었다.
  - **ToggleButtonGroup**: 기존 그룹의 시각이 연결 bar 에서 분리 형태로 바뀐다.
- 두 컴포넌트의 `density` 편집 항목은 프로퍼티 패널에 이미 있었으나 소비 경로가 없는 dead
  prop 이었다 — 이번에 실제로 배선됐다.

### Fixed

- **publish 에서 compact 연결이 보이지 않던 문제** — segmented 규칙 selector 가 marker
  div(`> * >`) 경유 형태만 있었는데, 그 marker 는 빌더 preview 의 구조이고 publish 앱은
  ToggleButton 을 그룹의 직접 자식으로 렌더한다. 두 형태를 함께 내보낸다. 구 `orientation`
  gate 시절부터의 결함이다.

> 잔존 관찰: 인접 버튼 겹침(`margin-inline-start: -1px`)이 computed 에 반영되지 않는다.
> ToggleButton border 가 transparent 라 시각 영향은 없고 구 코드에서도 같은 선언이었다.

## TableView density 적용 + Column/Cell 세로 padding 이중 계산 수정 - 2026-08-21

### Features

- **TableView `density` 가 실제로 동작한다** — 프로퍼티 패널에 선언만 있고 소비 경로가 없던
  dead prop 이었다. Spectrum `table.item.padding × density` 모델을 따라 **행 높이는 size 축이
  정하고 density 는 item 내부 여백만** 바꾼다 (`table-row-height-*` 토큰은 density 무관하며
  구 `-regular` 접미사 토큰은 deprecated).
- 채널을 TableView 가 아니라 **소비 주체인 Column/Cell** (`catalog densities`) 에 두고,
  TableView 는 density 값만 자손에 위임한다 — Skia 는 `applyImplicitStyles` 주입, DOM 은
  `renderTableViewSubtree` 인자. 행 높이 = 텍스트 24 + paddingY×2 → **compact 32 / regular 40
  / spacious 48** (Spectrum medium 계열과 일치). 기본값 `regular` 는 기존 값과 같아 미지정
  프로젝트의 시각 변화가 없다.

### Fixed

- **density 편집이 캔버스에 즉시 반영된다** — `density` 가 layoutVersion 트리거와 레이아웃
  캐시 시그니처 **양쪽에 미등재**여서, 어제 추가한 Tabs density 도 새로고침 전까지 Skia 에
  반영되지 않았다. 두 계층은 AND 조건이라 함께 등재했다.
- **표 행 높이가 CSS 와 어긋나던 이중 계산 제거** — 레이아웃이 Column/Cell 의 세로 padding 을
  border-box 로 반환하는데 엔진이 style 의 padding 을 다시 더하고 있었다. catalog
  `containerStyles.padding` 이 leaf 에 도달하지 않아 style 이 늘 비어 있던 탓에 여태 우연히
  맞았고, density 주입이 style 에 값을 넣자 드러났다 (실측 행 40 대신 56, 4px 차이가 16px 로
  증폭). 이제 세로 padding 은 style 에 없는 축만 레이아웃이 싣는다.

> 관찰 (후속 과제): publish 앱은 TableView/Column/Cell 을 클래스 없는 `<div>` 로만 등록해
> 표 시각 자체가 없다 — density 이전의 결손이다.

## Panel workspace 이동 cursor 및 좌우 edge snap 복원 - 2026-08-21

### Fixed

- 패널 상단 이동 영역에서 `grab`, mouse down에서 `grabbing`, 실제 패널 이동 중에는
  `default` cursor로 전환되는 계약을 복원했다. drag 중에도 `grabbing`이 유지되던 회귀를
  `data-dragging` shell 상태로 바로잡고 cascade 순서를 회귀 테스트로 고정했다.
- left/right snap candidate를 이동 panel frame 접촉이 아니라 target edge에 대한 마우스
  위치로만 판정하도록 복원했다. panel frame의 left/right가 4px 위치에 닿아도 pointer가
  target edge에서 멀면 snap line이나 commit을 만들지 않는다.
- 같은 cluster의 panel을 이동할 때 기존 결합을 떼는 suppression이 모든 후속
  `panel-edge`까지 계속 제거하던 문제를 수정했다. drag 시작점에서 28px를 벗어난 뒤에는
  suppression을 해제해, 세로 stack에서 바로 좌우 column snap으로 전환할 수 있다.
- hidden panel만 든 두 번째 raw column이 있으면 화면상 column은 하나인데도 2-column
  limit에 걸리던 문제를 수정했다. 좌우 snap 수용 여부는 visible column 수로 판정하고,
  commit 중 transient raw column은 v3 normalization에서 두 column으로 정규화한다.

## density 채널 신설 (Spectrum 규칙) + Tabs density 교정 - 2026-08-21

### Features

- **`ComponentRule.densities` 채널 신설** — Spectrum 규칙 채택: density 는 **폰트(size 축)를
  유지하고 간격·수직 padding 만** 바꾼다. 그래서 `sizes` 와 직교하는 축으로 두었다
  (sizes 안에 중첩하면 size×density 조합이 폭발하고 폰트까지 끌려간다).
- Skia 는 `resolveCatalogDensityField`, DOM 은 generate-css 가 `[data-density="…"]` 규칙으로
  emit 해 **같은 catalog 데이터**를 읽는다. `densities` 미정의 컴포넌트는 density prop 이
  있어도 반응하지 않아 기존 동작이 그대로다.
- **TabList density** 정의 (compact gap 0 / regular gap 8). Spectrum 근거:
  `tab-item-to-tab-item-compact-horizontal-medium` = "Spacing (between tab items, horizontal)".

### Fixed

- **Tabs density 가 Spectrum 규칙에 맞게 교정** — 구현이 "density=regular 이면 **size 를 lg 로
  승격**해 TabPanel padding 을 키우는" 방식이라 폰트까지 커졌고(규칙 위반), 대상도 탭 항목이
  아니라 패널이었다. 게다가 DOM 에는 대응 CSS 가 0건이라 **Skia 에서만 발현하는 비대칭**이었다.
  이제 TabPanel padding 은 size 축 단독이고, density 는 TabList 의 탭 간 간격을 제어한다.
  **Why**: `resolveTabPanelPadding` 이 `"tabpanels"` 문자열을 하드코딩해 컴포넌트를 식별하고
  있어 catalog SSOT 밖에 규칙이 살아 있었다.

> 기본 density 는 현행 시각 보존을 위해 `compact` 로 두었다 — Spectrum 스키마 default 는
> `regular` 이나, 기본값 전환은 기존 프로젝트의 탭 간격을 일괄 변경하므로 별도 판단으로 남긴다.

## quiet fill preset 채널 신설 — isQuiet dead prop 해소 (ToggleButton) - 2026-08-21

### Features

- **`FillTokenSpec.quiet` 채널 신설** — `isQuiet` boolean prop 이 고르는 fill preset.
  기존 키(outline/subtle)가 `fillStyle` enum 값인 것과 달리 boolean 이 고르며, 두 축을 함께
  노출하는 컴포넌트가 없어 경쟁하지 않는다. **`fill.quiet` 이 정의된 경우에만** 분기하므로
  미정의 컴포넌트의 기존 동작은 그대로다.
- Skia(`buildCatalogShapes`)와 DOM(`CSSGenerator` → `[data-quiet]` 규칙)이 **같은
  `fill.quiet` 데이터를 읽어** 대칭이 성립한다. selected 는 quiet 을 타지 않아 선택 표시가
  유지된다 (Spectrum quiet ActionButton 정합).

### Fixed

- **ToggleButton `isQuiet` 이 실제로 동작** — D2 표면과 `data-quiet` emit 은 있었으나 시각
  정의가 rules·CSS 어디에도 없어 켜도 아무 일이 없던 dead prop 이었다. `fill.quiet`
  (기본 투명, hover/pressed 에서만 배경) 정의로 해소.

> **왜 containerVariants 가 아니라 fill 축인가**: field 계열의 기존 quiet 은
> `containerVariants.quiet.true` 에 있는데, 그 Skia 소비 경로
> (`implicitStyles.resolveActiveContainerVariants`)는 layout 채널이라 색상을 보지 않는다.
> 거기에 두면 DOM 만 바뀌고 Skia 는 그대로여서 즉시 비대칭이 난다 — 실제로 그 quiet nested
> 규칙들이 "DOM generated CSS 전용" 으로 기록돼 있던 이유다. 배경은 ADR-908 fill preset 이
> SSOT 이므로 그쪽으로 통합했다.

## design-data 감사 §1-1 표면 단절 수리 (Tooltip variant / Toast 시맨틱·스코프) - 2026-08-20

### Fixed

- **Toast `info` variant 가 informative(파랑) 시맨틱을 되찾음** — catalog 에서 `info` 가
  fill·border 모두 `neutral` 과 완전 동일값이라 "variant 를 골라도 아무 변화가 없는"
  상태였다. `{color.informative-subtle}` + `{color.informative}` 로 정렬해 positive/negative
  형제와 같은 스킴이 됐다 (Spectrum toast guideline).
- **canonical Toast element 가 catalog(D3 SSOT) 시각을 받도록 복구** — 수동 `Toast.css` 는
  imperative 런타임(ToastProvider/ToastRegion) 전용인데 canonical Toast 와 `.react-aria-Toast`
  클래스를 공유했고, 수동은 unlayered·generated 는 `@layer components` 안이라 cascade layer
  규칙상 **수동이 항상 이겼다**. 그 결과 DOM 은 런타임 값(accent 12% mix), Skia 는 catalog 값을
  그려 비대칭이었다. 수동 규칙 전체를 `.react-aria-ToastRegion` 하위로 스코프해 두 경로를
  격리 — 런타임 시각은 보존, canonical 은 generated 로 복귀. variant 어휘도 서로 다르다
  (런타임 `info|success|warning|error` ↔ catalog `info|positive|neutral|negative`).

### Features

- **Tooltip `variant` 를 프로퍼티 패널에 노출** — rules table variants 4종
  (neutral/info/positive/negative) + generated CSS `[data-variant]` 4규칙 + 렌더러
  `data-variant` emit 이 모두 있었으나 binding `accepts` 선언만 없어 편집이 불가능했다.
  렌더러 fallback 도 대응 규칙이 없는 `"default"` → catalog `defaultVariant`(neutral) 로 정렬
  (시각 결과 불변 — base 규칙이 neutral 값).
- **DateRangePicker `placeholder` 편집 표면 추가** — 렌더러 `resolvePlaceholder` 가 이미
  소비하는데 accepts 선언이 없어 표면이 통째 결손이었다 (DatePicker 는 노출 중 — 형제 대칭 회복).

- **RangeCalendar 에 `isInvalid` / `autoFocus` / `pageBehavior` 편집 표면 추가** — Calendar 만
  노출 중이던 RSP 규정 prop 3종의 형제 대칭 회복. 렌더러도 함께 보강했다 (컴포넌트는
  `AriaRangeCalendarProps` 를 spread 하므로 전달만으로 RAC 에 닿는다).
- **ToggleButton 에 RSP S2 `staticColor` prop (auto/white/black) 추가** — Button/Link 에 이미
  있던 축의 잔여 전개. 유색·이미지 배경 위에서 테마 무관 고정 흑백 스킴 (배경=static,
  텍스트=역상, 테두리=static). Skia 는 `buildCatalogShapes` 의 static 블록이 컴포넌트 식별
  없이 `staticColor` prop + fill 채널로만 분기하도록 이미 작성돼 있어 D2 표면과 수동 CSS
  추가만으로 대칭이 성립한다 (라이브 검증: black → bg #000/text #fff, white → 반대).

### Changed

- **Tree 의 catalog 고정 `maxHeight: 300px` 제거** — ListBox 가 2026-07-29 사용자 결정으로
  같은 값을 뺀 것의 누락 적용분. Tree 는 발산까지 있었다 — 수동 `Tree.css` 는
  `max-height: 100%`(부모 기준)인데 catalog 만 300 고정이라 DOM 과 Skia 가 서로 다른 상한을
  썼다. `overflow: auto` 는 유지 (높이를 저작하면 그때 스크롤이 산다). generated CSS 변경 0건
  — 생성기가 top-level containerStyles 를 읽지 않아 Skia 경로 전용 수정이다.

## Button min-width 식별성 하한 채택 (Spectrum 2.25×height) - 2026-08-20

### Features

- **Button 에 size 별 `min-width` 하한 추가** — Spectrum Button 가이드라인
  ("min-width = 높이의 2.25배") 채택. 짧은 라벨("OK" 등) 버튼도 식별 가능한 형태 유지
  (xs 45 / sm 50 / md 68 / lg 95 / xl 122px = ceil(2.25 × border-box height)).
  긴 라벨은 영향 없음, 사용자 inline `minWidth`(0 포함)는 양 경로 모두 우선.
- catalog `sizes[*].minWidth` 단일 SSOT — DOM 은 generate-css `min-width` 자동 emit,
  Skia 는 implicitStyles 주입 → 엔진 `min_width` clamp (standalone/조합 공통).
  `ComponentRuleSize.minWidth` 필드 신설 (minHeight 선례 동형).

## Button staticColor prop 채택 (RSP S2) - 2026-08-20

### Features

- **Button 에 RSP S2 `staticColor` prop (auto/white/black) 추가** — 유색·이미지 배경 위에서
  테마 무관 고정 흑백 스킴. fill 은 배경=static + 텍스트 역상 + 테두리=static, outline 은
  텍스트·테두리만 static (배경은 outline 투명 유지). Link 와 동일한 D2 surface.
- CSS(`Button.css [data-static-color]`)와 Skia(`buildCatalogShapes` static 스킴 +
  `resolveButtonChildColor` 자식 상속) 양 경로 대칭 구현. generic 투영(`toRacProps`)은
  `staticColor` 를 `data-static-color` 로 라우팅해 raw prop DOM 누출을 차단 (Link 의
  generic 경로 동일 결함 함께 교정).

## [AI 어시스턴트 패널 개편 — Photoshop-style contextual composer] - 2026-08-20

### Features

- **AI Assistant를 Photoshop식 context-aware 추천·composer 구조로 개편**:
  - 현재 page/selection을 반영한 `해주세요`·`보여주세요` 추천 카드와 하단 고정 composer, 참조 이미지 affordance, AI 응답 확인 고지를 추가했다
  - 기존 agent loop, 대화 초기화·중단 동작은 유지하고 `.panel > PanelHeader + .panel-contents` 공통 shell과 activity rail·move·resize 계약을 그대로 사용한다
  - 위치: `apps/builder/src/builder/panels/ai/AIPanel.tsx`, `AIPanel.css`, `components/AgentControls.tsx`

## Panel workspace snap guide 정합성 - 2026-08-20

### Fixed

- panel-relative snap 판정과 가이드가 동일한 committed frame geometry를 사용하도록
  통합하고, pointer가 보이는 panel edge에 근접했을 때만 drop candidate를 노출한다.
- gap 중앙의 snap guide를 interaction line token 기준으로 정렬하고 dock 경계 안에서
  길이를 clamp한다. panel dock clipping, activity rail z-index와 drag cursor도 함께
  복원했다.

## PanelConfig 퍼센트 치수 지원 - 2026-08-20

### Fixed

- `PanelConfig`의 width/height 치수 설정이 px 숫자와 surface 기준 `%` 문자열을 모두
  지원하도록 정규화 경로를 통합했다. splitter와 layout solver는 해석된 숫자 registry만
  소비하며, workspace surface 크기 변경 시 registry도 다시 계산한다.

## [ADR-186 Implemented — production 9-zone panel workspace cutover] - 2026-08-19

### Architecture

- **panel workspace production state를 zone-owned v3 graph로 전환**: store, coordinator,
  runtime과 persistence가 `placementZone` + column/row size를 직접 소비하며 arbitrary
  `position/x/y`를 저장하지 않는다. v2 parser/exact backup과 v3-aware projection은 rollback
  compatibility boundary로만 유지한다
- **Photoshop 기본 activation과 Pencil 9-zone을 하나의 interaction graph로 종결**:
  left/right/bottom panel은 top-left/top-right/bottom에서 시작하고 빈 9-zone drop과
  panel-relative outer-face snap을 지원한다. invalid/Escape/cancel은 committed graph나
  storage를 쓰지 않는다
- **legacy free-XY production writer 제거**: anchored cluster floating 승격,
  `panelWorkspaceLayoutInteraction`의 persisted position mutation, v2 dock drop projection과
  unsnapped drop commit을 삭제했다
- **실제 workspace reset command 추가**: header의 `Reset Panel Layout`이 actual measured
  placement surface와 registry default를 사용해 기본 rail/zone/size graph를 즉시 복원한다
- G0~G5를 완료하고 ADR-186을 Implemented로 승격했다. actual Builder
  move/resize/snap/reload/reset, focused Vitest 24 files/234 tests, typecheck/preflight,
  native 약 120Hz 5초 pointer trace(baseline -0.17pp), persisted XY 0과
  exact/post-edit/v3-born old-code rollback rehearsal을 통과했다

## [ADR-186 G4 — zone activation·rail identity·reference resize 정책] - 2026-08-19

### Architecture

- **Photoshop 기본 activation을 v3 zone policy로 전환**: left/right panel은 아래로 stack하고 실제 높이가 부족하면 left는 오른쪽, right는 왼쪽 안쪽에 최대 두 번째 column을 만든다. hidden row/column은 graph와 선호 크기를 보존하되 fit 수요에서는 제외해 hide/reopen 시 마지막 zone·row를 그대로 복원한다
- **activity rail identity와 current placement를 분리**: panel-relative cross-rail snap은 target zone만 승계하고 `railOrder`는 byte-equivalent로 유지한다. explicit reset만 registry의 default rail/zone/size를 복원하며 현재 visibility는 보존한다
- **outer/shared resize를 immutable reference graph에서 계산**: 9/9 zone에서 outer anchor와 paired row/column 총량을 고정하고 min/max overrun 후 복귀 drift를 0으로 만들었다. local Builder에서 우측 stack/왼쪽 overflow, 4px gap, right/bottom anchor와 paired row resize·reload를 확인했다
- production storage/coordinator public type은 계속 v2 compatibility path를 사용한다. Phase 5의 v3 primary cutover, `floatAnchoredPanelWorkspaceClusters`와 persisted free-XY 제거는 아직 시작하지 않았다
- 위치: `apps/builder/src/builder/layout/panelWorkspacePolicyV3.ts`, `panelWorkspaceRuntime.ts`, `panelWorkspaceLayoutV3*.ts`, `docs/adr/design/186-phase-4-policy-identity-resize.md`

## [ADR-186 G3 — transient panel drag와 candidate/drop transaction] - 2026-08-19

### Architecture

- **free XY를 drag session preview로 격리**: pointermove는 committed v2 layout이나 storage를 쓰지 않고 coordinator의 transient preview만 RAF 단위로 publish한다. valid panel-edge/9-zone drop만 graph를 한 번 commit하며 invalid drop, Escape, pointer cancel은 byte-equivalent base layout으로 돌아간다
- **Photoshop panel adjacency와 Pencil 9-zone을 단일 candidate resolver로 통합**: panel의 실제 snap 가능한 outer face를 zone보다 우선하고 candidate는 항상 최대 1개만 노출한다. drag 중에만 3x3 zone overlay를 표시하며 기존 모든 면 dropper는 제거했다
- **snap line과 resize hover bar의 시각 계약을 통일**: 공통 focus-ring color token과 2px thickness를 사용해 가로 방향 height와 세로 방향 width가 일치한다. 실제 Builder pointer trace에서 solve/DOM geometry query/version mismatch/long task 0, Escape rollback과 valid drop reload를 확인했다
- production persistence와 activation/resize는 계속 v2 compatibility path를 사용한다. Phase 4 정책 전환과 Phase 5 v3 production cutover/free-XY 제거는 아직 시작하지 않았다
- 위치: `apps/builder/src/builder/layout/panelWorkspaceZoneDrop.ts`, `PanelWorkspace.*`, `panelWorkspaceRuntime.ts`, `panelWorkspaceLayoutCoordinator.ts`, `docs/adr/design/186-phase-3-drag-transaction.md`

## [ADR-186 G2 — 9-zone solver와 common placement surface] - 2026-08-19

### Architecture

- **fit-before-origin 9-zone panel geometry를 추가**: top/center/bottom과 left/center/right origin을 actual placement surface local rect에서 순수 계산해 cluster 크기가 바뀌어도 right/top/bottom anchor가 흔들리지 않는다. 320x180 경계에서도 visible frame이 surface를 벗어나지 않는다
- **panel frame의 containing block을 공통 4px dock으로 통일**: 별도 placement wrapper 없이 `.panel-dock`이 CSS inset을 정확히 한 번 소유하고, `.panel-dock-surface`는 좌우 nav 사이의 dynamic frame 영역만 제공한다. local Builder 실측에서 네 edge 4px, dock-surface edge 오차 0px를 확인했다
- **Phase 2 build를 v3 operational rollback target으로 연결**: migration 직후 record는 exact v2 raw를 복원하고, migrated-post-edit와 v3-born record는 current v3 graph를 valid v2 floating layout으로 projection한다. current v3 prepared backup → v2 primary → committed marker의 세 crash 경계를 재실행 가능한 fixture로 고정했다
- production drag/runtime/state는 계속 v2이며 Phase 3 candidate/drop transaction과 v3 production writer는 아직 전환하지 않았다
- 위치: `apps/builder/src/builder/layout/panelWorkspaceLayoutV3*.ts`, `apps/builder/src/builder/layout/PanelWorkspace.*`, `docs/adr/design/186-phase-2-zone-solver-placement-surface.md`

## [ADR-186 G1 — 9-zone panel layout v3 migration model] - 2026-08-19

### Architecture

- **Phase 1에서 zone-only panel layout v3와 durable v2 migration protocol을 shadow 경계로 추가**:
  - persisted arbitrary XY 없이 Photoshop 기본 rail을 `top-left`/`top-right`/`bottom`으로 매핑하고, Pencil 9-zone vocabulary와 bottommost -> topmost focus order를 정본화했다
  - actual placement surface를 받는 pure v2 -> v3 migration이 floating center, tail-topmost collision, mixed-rail 10+ cluster overflow를 deterministic하게 정규화한다
  - exact v2 raw를 prepared backup으로 저장한 뒤 v3 primary와 committed marker를 순서대로 쓰며, 세 write boundary crash와 malformed/mismatch recovery를 fail-closed fixture로 고정했다
  - production store/runtime/renderer는 계속 v2를 사용한다. local Builder에서도 primary `version: 2`, v2 backup key 미생성을 확인했으며 production cutover와 v3 -> v2 rollback build는 다음 Gate에 남겼다
  - 위치: `apps/builder/src/builder/layout/panelWorkspaceLayoutV3*.ts`, `docs/adr/design/186-phase-1-v3-model-migration.md`

## [ADR-922 floating-first panel launch와 overlay rail] - 2026-08-19

### Architecture

- **legacy sidebar형 anchored panel launch를 제거**: cache-clear와 기존 v2 record의 left/right/bottom anchored cluster를 production runtime에서 floating placement로 승격한다. Nodes/Properties는 열린 상태를 유지하지만 Canvas 위 독립 frame으로 시작하며, 기존 active rail order와 panel local state는 보존한다
- **모든 activity rail을 Canvas overlay로 전환**: left/right rail과 bottom Monitor rail은 panel workspace의 absolute interaction surface로 남되 `occupiedInsets`와 Grid main track을 점유하지 않는다. Canvas/Skia/scrollbar는 full workspace local rect를 한 번만 소비한다
- **floating-first initial rail activation에도 Photoshop식 cascade를 유지**: 승격된 `anchor:left`/`anchor:right` floating cluster는 세로 여유가 있으면 기존 column 아래에 쌓고, 공간이 부족하면 left는 오른쪽·right는 왼쪽 새 column으로 전환한다. 사용자가 직접 이동하거나 cross-snap한 일반 floating cluster의 토글 관계는 보존한다
- **panel height resize의 config max 제한을 제거**: `maxHeight`는 초기 선호 높이와 호환 metadata로만 유지하며, resize·normalization·floating move 경로는 실제 workspace 높이를 상한으로 사용한다. 숨겨진 row는 outer resize의 neighbor 제약에 포함하지 않는다
- **physical `PanelDock` shell을 복원**: 모든 activity rail, stable panel frame, shared splitter는 하나의 floating dock DOM 아래에서 렌더한다. cluster 이동에도 panel React identity를 유지하는 dock-local geometry 이관의 Phase 1이다
- **dock rail/dropper presentation을 snapshot으로 파생**: visible column마다 dock-local rail과 first/last dropper를 렌더한다. dropper는 drag 중에만 표시되며, 실제 insertion mutation은 다음 phase에서 연결한다
- anchored placement schema는 기존 record를 읽기 위한 compatibility boundary로만 남긴다. production에서 panel move/snap/resize 뒤에는 floating cluster graph가 정본이다

### Bug Fixes

- **우측 floating panel의 왼쪽 면에 가로 snap할 때 기존 panel이 새 column 폭만큼 오른쪽으로 밀리던 문제를 수정**: 새 column 삽입 폭과 4px gap만큼 cluster origin을 왼쪽으로 이동해 snap target의 화면 x 좌표를 유지한다

## [ADR-922 panel stack viewport fit과 shared resize 복구] - 2026-08-19

### Bug Fixes

- **우측/좌측 panel stack이 preferred height를 넘는 즉시 `constrained-overlay`로 바뀌어 Canvas 위에 panel surface를 덮던 문제를 수정**: 실제 최소 높이가 workspace에 들어오는 동안에는 anchored inset을 유지하고 마지막 row를 최소 높이까지 압축한다. 최소 높이조차 들어오지 않는 좁은 viewport에서만 기존 overlay emergency presentation을 사용한다
- **anchored stack의 top 4px gap이 세로 fit budget에서 빠져 panel 하단이 viewport를 4px 넘던 문제를 수정**: leading gap을 solver와 overlay 전환 기준 모두에 반영했다
- **스냅된 panel의 stack 내부 row splitter가 pointer event를 받지 못해 세로 resize가 불가능하던 문제를 수정**: shared splitter를 interaction surface로 명시했다
- **panel max/min height를 넘긴 pointer가 경계 안으로 되돌아와도 resize edge와 다시 맞지 않던 drift를 수정**: React Aria incremental move delta를 gesture 시작점 기준으로 누적하고, runtime은 immutable 시작 layout에 대한 reference delta로 매 frame reflow한다. max/min 경계 밖 이동은 clamp하되, pointer 재진입 시 정확한 위치에서 즉시 resize를 재개한다

## [ADR-922 좌·우 panel rail 활성화 cascade] - 2026-08-18

### Features

- **좌·우 activity rail의 panel on/off를 workspace-aware placement transaction으로 연결**: 기본 anchor에 남아 있는 panel을 켜면 같은 rail column의 마지막 visible panel 아래에 쌓고, bottom rail을 제외한 실제 workspace 높이를 넘을 때만 두 번째 column을 만든다. right rail은 새 column을 왼쪽 상단에, left rail은 오른쪽 상단에 둔다
- 최대 2-column 뒤에는 기존 deterministic `constrained-overlay` solver를 그대로 적용한다. 이미 floating 또는 cross-rail snap된 panel과 bottom Monitor는 이전 placement/visibility 계약을 유지한다
- Command Palette·단축키·DataTable Editor 자동 표시는 같은 activation dispatcher를 경유하므로, activity rail click과 실제 workspace rect 기준 배치 규칙이 일치한다

## [ADR-922 초기 의도 재검증 — actual rail·shared splitter·presentation RAF 정정] - 2026-08-18

### Bug Fixes

- **empty rail DOM을 지운 뒤에도 없는 rail의 48px inset이 남던 문제를 수정**: normalized `railOrder`에 실제 button이 있는 side만 rail size를 점유한다. bottom rail 0인 populated layout에서 main/Canvas 높이가 `892→940px`, 800×600에서는 `504→552px`로 실제 가용 영역을 모두 사용한다
- **cross-rail snap 뒤 resize handle이 placement anchor가 아니라 activity rail side를 따르던 문제를 수정**: frame outer edge는 coordinator snapshot anchor와 internal boundary에서 파생한다. row/column boundary는 snapshot의 shared `PanelSplitter` 한 개가 geometry/version/ARIA를 소유한다
- **G2b applied latency가 presentation RAF가 아닌 microtask에서 끝나던 계측 결함을 수정**: layout effect 뒤 실제 RAF를 종점으로 사용하고, expected 도착 전 old version은 mismatch로 세지 않는다. 최종 5초 trace는 123.46Hz, p95 14.7ms, mismatch/long task/DOM query 0, delivery delta -0.56pp로 PASS했다

## [ADR-922 Implemented — Photoshop식 panel workspace 최종 전환] - 2026-08-18

### Architecture

- **Phase 0~~6과 G0~~G6를 완료하고 panel layout runtime을 v2 coordinator 하나로 통일**:
  - Zustand의 v1 `panelLayout` projection과 set/reset/save/load 및 bottom/modal compatibility action을 제거했다. panel UI는 side 인자 없는 visibility toggle, floating command, coordinator snapshot만 사용한다
  - unused `PanelArea`/`BottomPanelArea`/`PanelContainer`/`ModalPanelContainer`, v1 `panelStackLayout`, DOM inset `panelLayoutRuntime`과 전용 CSS/export/test 약 2,800줄을 제거했다
  - rail order가 비어 있는 side는 `<nav><ul /></nav>`를 만들지 않는다. default bottom Monitor fixture와 이동된 Monitor fixture를 함께 유지해 bottom 기능 삭제 없이 빈 rail DOM만 제거했다
  - v1 parser와 prepared/committed exact backup, emergency read-only projection은 rollback compatibility window가 끝날 때까지 유지한다. migrated-v1/v2-born failure·refresh rehearsal 32건을 다시 통과했다
  - populated Builder에서 Settings floating, Monitor toggle+refresh, legacy DOM 0, 800×600 main `704×504`, 활성 panel viewport overflow 0을 확인하고 사용자 배치와 viewport를 원상복구했다

## [ADR-922 G4·G5 hidden lifecycle과 panel splitter 접근성] - 2026-08-18

### Architecture

- **Phase 5에서 stable-mounted panel의 hidden work와 resize 접근성 계약을 완결**:
  - Monitor를 숨기면 React `Activity`가 chart RAF, `ResizeObserver`, polling Effect를 정리하고, Effect cleanup 밖에 남던 memory-history RAF와 pending idle collection도 명시적으로 취소한다. Realtime tab 같은 local UI state는 hidden→visible 왕복 뒤 그대로 유지된다
  - resize handle을 shared `PanelSplitter`로 추출했다. React Aria `useMove`의 pointer/Arrow 동작에 `useKeyboard` Home/End를 결합하고, separator name/orientation/value/min/max와 controlled panel content 관계를 한 곳에서 제공한다
  - left/top edge의 min/max delta 반전과 RTL physical Arrow 방향을 component fixture로 고정했다. populated Builder에서는 splitter resize와 panel move를 keyboard로 1px 이동 후 원복하고 focus-visible과 ARIA 갱신을 확인했다
  - shell은 기존 content node에 stable id만 부여한다. `PanelHeader`/title/action/contents DOM과 스타일은 변경하지 않으며, History 대표 frame에서 각 구조가 중복 없이 1개임을 검증했다

## [ADR-922 G3 workspace occupancy와 Canvas-local metrics 전환] - 2026-08-18

### Architecture

- **Phase 4에서 panel `occupiedInsets`와 Canvas 가용 영역을 하나의 실제 layout transaction으로 통합**:
  - `PanelWorkspace`가 main content와 panel overlay를 포함하는 공통 Grid host가 되고, coordinator snapshot의 left/right/bottom `occupiedInsets`를 main track에 정확히 한 번 적용한다
  - `BuilderCore`의 WebGL-off direct `BuilderCanvas` sibling을 제거했다. WebGL, Compare, WebGL-off는 모두 동일한 `main.workspace`를 유지하고 내부 renderer content만 전환한다
  - `.panel-rail-measure-*`와 `registerPanelElement`를 제거했다. `useWorkspaceCanvasSizing`은 Grid가 만든 실제 local canvas rect만 `ResizeObserver`로 publish하고 shell/canvas layout version을 함께 기록한다
  - `CanvasScrollbar`는 panel inset을 다시 빼거나 pan origin에 더하지 않으며, Skia minimap도 actual Skia canvas 우측 edge에서 기본 offset만 사용한다. hit-test, fit, visible-page 계산은 동일한 Canvas-local `containerSize`를 공유한다
  - 1800px normal에서 host `1800×940` → main/Canvas `1704×892`, Compare Skia pane `1288.83×892`, 800px viewport에서 main/Canvas `704×504`가 snapshot과 일치했다. anchored fixture는 left/right/bottom `542/372/48px`와 main `686×804`를 같은 version으로 적용한다
  - `panelLayoutRuntime.ts`와 unused legacy host 파일 자체는 Phase 6 call-graph cleanup 전까지 남기되 production import는 0건이다

## [ADR-922 G2b panel workspace production v2 cutover] - 2026-08-18

### Architecture

- **Phase 3에서 Photoshop식 panel placement/visibility/interaction을 단일 v2 coordinator로 production 전환**:
  - exclusive real-frame canary가 native display period 기준 applied-frame p95, frame delivery, version mismatch, long task, pointer DOM geometry query G2b를 통과한 뒤 임시 query gate를 제거했다
  - 모든 registry panel frame은 `.panel-workspace` 아래 한 번만 생성되고 `useSyncExternalStore` snapshot의 geometry/visibility/version을 소비한다. move/detach/상·우·하·좌 snap과 row/column/outer-edge resize는 RAF-batched transaction으로 source와 인접 frame을 같은 version에 갱신한다
  - interaction hot path는 panel DOM rect를 다시 읽지 않으며, cancel은 시작 시 committed v2 snapshot을 byte-equivalent로 복원한다. successful end에서만 Zustand commit과 debounce primary write를 한 번 예약한다
  - live Zustand SSOT와 `composition-panel-layout` primary를 v2로 전환했다. 기존 v1 raw는 primary write 전 prepared backup으로 보존하고 성공 뒤 committed로 잠그며, backup 없는 v2-born record는 refresh에서 byte-equivalent로 유지한다
  - shortcut scope와 DataTable Editor 자동 표시도 v2 visibility를 소비한다. Monitor bottom placement, viewport height fit, hidden frame의 React Activity 상태 보존을 유지한다
  - Canvas inset을 소유하는 `.panel-rail-measure-*`와 `panelLayoutRuntime`은 Phase 4 workspace occupancy 전환 전까지 의도적으로 유지한다

## [ADR-922 G2a immutable panel layout shadow coordinator] - 2026-08-18

### Architecture

- **Phase 2 / G2a에서 production 전환 전 panel layout transaction을 검증 가능한 shadow store로 고정**:
  - workspace/v2 layout을 root·frame·row/column splitter가 같은 version으로 소비하는 immutable snapshot과 `useSyncExternalStore` selector를 추가했다
  - 같은 display frame의 input은 native RAF 한 건으로 합쳐 solve/publish를 각각 최대 한 번 수행하고, invalid solve는 기존 snapshot을 유지한다
  - 대표 v1 5-panel geometry를 allowlist 없이 비교해 active side/right-edge order와 hidden panel min-width migration drift를 해소했다
  - snap candidate를 snapshot geometry만으로 계산하는 pure adapter를 추가했다. production `PanelWorkspace` pointer handler, v1 store와 localStorage primary는 Phase 3 G2b 전까지 변경하지 않는다

## [ADR-922 패널 layout v2 model과 rollback 경계를 선행 고정] - 2026-08-18

### Architecture

- **Phase 1 / G1에서 Photoshop식 single placement graph의 production 전환 전 계약을 구현**:
  - registry panel이 placement와 activity rail에 각각 정확히 한 번 존재하는 versioned v2 schema, 최대 2-column/4px gap, 320x180 main reservation과 deterministic constrained-overlay solver를 pure module로 추가했다
  - current v1의 default, multi-active, Monitor bottom, floating, snapped column, invalid/removed ID를 v2로 옮기는 validated migration과 registry add/remove normalization을 fixture로 고정했다
  - primary v2 write 전에 exact v1 raw를 `prepared` backup으로 보존하고 write 성공 뒤 `committed`로 잠그는 protocol을 추가했다. quota/crash/raw 변경/committed mark 실패와 v2-born emergency projection을 injected storage에서 검증한다
  - 신규 v2 module은 아직 production store/renderer에서 import하지 않는다. live Zustand state와 `composition-panel-layout` primary record, 기존 패널 UI는 Phase 3 cutover 전까지 v1을 유지한다

## [패널 간 스냅을 Photoshop식 column/stack layout으로 전환] - 2026-08-18

### Bug Fixes

- **패널 옆면 중앙에서 스냅되지 않고 세로로 쌓은 패널이 브라우저 하단을 벗어나던 문제를 수정**:
  - 좌상단 네 점의 거리만 비교하던 snap 판정을 상·하 horizontal edge band와 좌·우 vertical edge band의 교차 구간 판정으로 교체했다. 대상 패널과 시작 좌표가 일치하지 않아도 실제 edge가 가까우면 후보가 된다
  - snap 결과를 개별 `x/y`가 아니라 `panelClusters → columns → panelIds` 관계로 저장한다. 상·하는 같은 column의 순서로 삽입되어 폭을 공유하고, 좌·우는 같은 시작 높이의 인접 column으로 배치된다
  - column 내부는 Photoshop Online에서 확인한 `4px` 간격을 유지한다. 패널 높이 합계가 workspace를 넘으면 마지막 패널부터 content 높이를 줄여 전체 stack을 브라우저 안에 맞추고, viewport가 다시 커지면 마지막 사용자 조정 높이를 복원한다
  - snap된 panel의 내부 경계를 resize하면 drag 중인 panel과 인접 panel에 반대 delta를 같은 frame에 적용한다. pointer가 움직이는 동안에는 transient cluster layout만 렌더하고, resize 종료 시 최종 layout을 한 번만 저장한다
  - Settings panel root를 공통 `.panel` 구조로 맞춰 frame resize 시 Header, Section, form control이 panel 전체 폭을 함께 채우도록 수정했다
  - Monitor panel을 공통 `.panel` / `PanelHeader` / `.panel-contents` / `Section` DOM으로 전환했다. 차트는 `ResizeObserver`가 읽은 실제 SVG 폭을 좌표계로 사용해 panel resize 중에도 텍스트가 가로로 늘어지지 않고, tab은 5-column grid로 반응한다. legacy `minWidth: 600`은 공통 233px로 낮추되 초기 bottom 폭 600px은 유지했다
  - Analysis의 raw button/select과 Threshold의 absolute popup/native range를 공통 `ActionIconButton` / `PropertySelect` / `PropertySlider`와 React Aria `DialogTrigger` / `Popover` / `Dialog`로 교체했다. `component-memory-items`도 Builder 공통 `.list-group` / `.list-item` / `list-item-*` DOM으로 정렬했다. 300px 이하에서 tab은 아이콘만 보이지만 접근성 이름은 유지한다
  - 빈 Memory chart의 1B 미만 눈금이 `undefined` 단위로 표시되던 `formatBytes` 경계값을 보정했다
  - Command Palette는 React Aria `ModalOverlay`/`Dialog`/`ListBox`의 focus trap·dismiss·keyboard 계약을 유지하면서, 내부 shell을 공통 `.panel` / `PanelHeader` / `.panel-contents` 구조로 전환했다. 제목에는 toolbar와 같은 Command 아이콘을 표시한다. 검색 입력은 raw input 대신 공통 `BuilderSearchField`의 opt-in `control` appearance를 사용해 Properties와 같은 React Aria Group DOM, compact spacing, muted surface, radius, inset shadow, focus ring을 공유한다. 검색 영역과 목록은 같은 `var(--spacing-sm)` outer inset을 사용하며, 포털에서도 같은 Header 스타일이 적용되고 modal 표면·간격·행·shortcut badge는 Builder token을 사용한다
  - activity rail의 기존 on/off는 유지한다. stack panel을 껐다 켜면 관계와 순서가 보존된 상태로 reflow하며, panel을 직접 이동하면 cluster에서 분리할 수 있다. keyboard 이동도 snap 감지대를 연속해서 빠져나올 수 있도록 release hysteresis를 유지한다
  - 저장된 Properties 같은 독립 placed panel이 현재 viewport 밖에 남아 rail toggle 후에도 보이지 않던 문제를 수정했다. cluster가 없는 panel도 workspace 경계 안으로 복귀시키고, `showRight=false`와 active 배열이 불일치한 저장 상태는 첫 toggle에서 다시 표시되도록 self-heal한다. activity rail은 현재 panel z-order보다 항상 위에 있어 panel이 rail 영역과 겹쳐도 pointer로 on/off할 수 있다

### Architecture

- **개별 floating panel 상태와 별도로 지속 가능한 `PanelClusterState`를 추가**:
  - snap·분리·resize·toggle·viewport resize가 같은 pure reflow 경로를 사용한다. column 공통 폭, panel 순서, viewport clamp 계산은 `panelStackLayout.ts`에 격리했다
  - 저장된 구 레이아웃은 빈 `panelClusters` 기본값으로 마이그레이션한다. 기존 `modalPanels` 저장 키, 패널 Header DOM, React Aria move/resize primitive는 유지한다

## [Builder 패널 shell을 Photoshop식 panel-relative workspace로 전환] - 2026-08-17

### Features

- **모든 등록 패널을 같은 non-modal workspace에서 이동·resize하고 다른 패널에 스냅할 수 있다**:
  - 좌·우·하단 activity rail은 기존처럼 패널 on/off만 담당한다. 화면 전체의 `left/right/bottom` drop zone과 viewport edge 강제 dock은 제거했다
  - 패널을 이동하면 다른 활성 패널의 상·우·하·좌 snap target이 표시된다. 28px 범위에 들어오면 Photoshop Online에서 확인한 패널 간 4px 간격으로 정렬되고, target이 없으면 현재 위치에 자유 배치된다
  - 코너 한 점에서만 동작하던 resize handle을 Photoshop처럼 edge 전체로 확장했다. 자유 배치된 패널은 좌·우·하단, 초기 좌·우 패널은 노출된 세로 edge와 하단, 하단 패널은 상단 edge 어디서든 크기를 조절한다. 왼쪽 edge resize는 `x`와 width를 함께 저장해 오른쪽 경계가 움직이지 않는다
  - 패널마다 조정한 width/height, 자유 배치·snap 위치와 z-order를 기존 `composition-panel-layout` 저장 경로에 보존한다. rail로 패널을 끄고 다시 열어도 이 배치는 유지된다
  - grabber·resize separator는 React Aria `useMove`를 사용해 pointer와 keyboard 이동을 함께 지원한다
  - 패널 표시/숨김은 기존 activity rail 토글이 계속 담당한다. shell에 추가됐던 제목·닫기 행과 기존 헤더 숨김 CSS를 제거하고, 기존 `<aside>` 와 새 workspace에 같은 공통 Header selector를 적용해 각 패널의 `PanelHeader` 제목·action 레이아웃을 그대로 복원했다

### Architecture

- **기존 `PanelArea`·`BottomPanelArea`·`ModalPanelContainer`의 세 갈래 host를 `PanelWorkspace` 하나로 교체했다**:
  - `PanelRegistry`의 모든 패널을 stable key와 React `Activity` 경계 안에 한 번씩 유지해 이동·snap 중 패널 로컬 상태와 scroll 위치가 보존된다
  - 콘텐츠의 공통 `PanelHeader`/`Section` DOM과 기존 제목·action 스타일은 유지하고, 외부 shell은 이동 grabber·resize handle만 소유한다
  - Canvas는 고정 sidebar grid에 의해 축소되지 않고 전체 main 영역을 사용하며, `panelLayoutRuntime` 측정 채널에는 패널 frame이 아닌 activity rail 너비만 전달한다

## [작업 내역 패널을 Builder 패턴과 Photoshop 구조로 정렬] - 2026-08-17

### Features

- **History 패널의 DOM/CSS를 StylePanel과 같은 공통 Panel System으로 통합하고, 정보구조를 Photoshop Online 작업 내역 패널에 맞췄다**:
  - 수동 스냅샷 header와 독립 card 목록을 공통 `Section` 기반 `스냅샷`/`편집` 그룹으로 교체했다. 작업 행은 시간·번호를 전면에 노출하던 2단 card 대신 아이콘+라벨 중심의 compact flat row로 표시한다. 현재 편집 버튼은 `aria-current="step"`과 Inspector Group의 `bg-muted`/inset shadow/radius 패턴을 사용하며 높이도 `--inspector-control-size`로 맞춘다
  - History의 `Section` content는 Style/Property 패널과 같은 공통 padding/gap을 상속하고, history/snapshot 행의 구분선은 제거했다. 행 버튼 자체 padding은 기존 값을 유지한다
  - 상단 도구는 스냅샷 생성·활성 스냅샷 삭제·더보기로 정리했다. 전역 Header와 중복되던 Undo/Redo를 제거하고, 전체 페이지 기록 삭제는 선택 항목 삭제로 오해되는 단독 trash 아이콘 대신 `현재 페이지 기록 초기화` 메뉴 항목으로 명시한다
  - 기존 ADR-180의 클릭 복원, 더블클릭 rename, 미래 state 흐림, 사용자 스냅샷 상한 및 canonical 복원 순서는 유지한다
  - 위치: `apps/builder/src/builder/panels/history/{HistoryPanel.tsx,HistoryPanel.css}`

## [Canvas와 Nodes 패널에서 Page 이름을 바로 바꾼다] - 2026-08-17

### Features

- **Skia Canvas의 page 상단 title 또는 Nodes 패널의 Pages 행을 더블클릭하면 inline rename으로 진입한다**:
  - `Enter`/blur는 변경을 저장하고 `Escape`는 취소한다. Canvas의 첫 pointer press는 기존 page 선택·직접 drag를 유지하며 같은 title의 두 번째 press만 편집으로 전환한다
  - Canvas editor는 drag 편의를 위해 넓힌 hit bounds가 아니라 Skia가 반환한 실제 title line box를 사용한다. `12px` font/line-height와 Medium weight를 유지하고 input padding·border가 text origin을 밀지 않게 해 편집 전후 title 위치가 일치한다
  - **Why**: 두 화면은 `pages[].title`을 표시만 했고 canonical page root의 `name`을 갱신하는 mutation이 없어, Figma/Pencil식 page rename 진입점 자체가 없었다
  - 두 진입점은 같은 `renamePageTitle` action을 사용한다. canonical document를 먼저 갱신한 뒤 Builder page mirror를 동기화하고 IndexedDB에 저장하며, 전용 history payload로 Undo/Redo도 title과 canonical document를 함께 복원한다
  - Components system page의 고정 이름은 기존 불변 계약대로 편집 대상에서 제외한다
  - 위치: `apps/builder/src/builder/{workspace/canvas/BuilderCanvas.tsx,panels/nodes,stores}`

## [breakpoint 전환 뒤 Canvas page 선택이 이전 좌표를 보지 않는다] - 2026-08-17

### Bug Fixes

- **상단 breakpoint를 바꾼 뒤 다른 page body를 클릭해도 기존 page가 계속 selected 상태로 남던 문제를 수정**:
  - **Why**: page title/body pointerdown이 시작한 `pagePositionPresentation`은 drag 종료 뒤에도 마지막 breakpoint의 `canonical` map 참조를 유지했다. 화면·hover·title은 새 breakpoint 좌표로 갱신됐지만 body selection, selection bounds, page occlusion은 inactive snapshot의 이전 좌표를 우선 읽어 서로 다른 page를 판정했다
  - interaction 전용 position reader가 transient drag가 active일 때만 presentation 좌표를 사용하고, inactive 상태에서는 현재 `pagePositions`를 읽도록 분리했다. 같은 판독자를 쓰는 빈 영역 선택, 겹친 page occlusion, Canvas context menu, guide/title occlusion도 함께 정렬된다
  - 회귀 테스트는 `Desktop` presentation 종료 → `Tablet` page 위치 변경 → body selection/occlusion 전환을 고정하고, active drag 중 transient override 우선순위가 유지되는지도 검증한다
  - 위치: `apps/builder/src/builder/workspace/canvas/{BuilderCanvas.tsx,interaction/pagePositionPresentation.ts,interaction/selectionModel.ts}`

## [preview DataTable 이 응답을 버리는 요청을 그만 보낸다 — dataStates 배관 제거] - 2026-08-17

### Bug Fixes

- **preview 의 DataTable 컴포넌트가 fetch 는 하고 결과는 버리고 있었다** (`refreshInterval` 지정 시 타이머로 무한 반복):
  - ADR-132 가 컬렉션 데이터의 sink 를 `collections.runtimeData` 로 옮긴 뒤, 그 이전 세대 배관인 `RenderContext.setDataState` → `runtimeStore.dataStates` 가 **끊긴 채** 남았다. `renderContext`(preview/App.tsx)가 `setDataState` 를 공급하지 않아 항상 `undefined` 였고, `DataTableComponent` 의 호출 6곳이 전부 `?.()` no-op 이었다
  - **Why 안 보였나**: 컴포넌트가 비시각적(`return null`)이라 화면에 아무 단서가 없고, 실패도 아니라서 콘솔에는 오히려 `✅ [Canvas] DataTable loaded: … (N items)` 성공 로그가 찍혔다. 게다가 `docs/reference/status/PLANNED.md` 가 "데이터 로드 ✅ Runtime Store의 dataStates 활용" 로 **동작한다고 광고**하고 있었다
  - 도달 경로 확인: 인스펙터가 최상위 `element.dataBinding` 을 쓰고(`inspectorActions.ts:1281`) 컴포넌트가 그것을 `legacy-only` 로 읽는다 — 사용자가 DataTable 을 놓고 컬렉션을 고르면 실제로 요청이 나갔다
  - 수정: 헛도는 fetch 와 배관 전부 제거 — `DataTableComponent.tsx`(226줄) 삭제, `renderDataTable` 은 `null` 반환, `RenderContext.setDataState` / shared `DataState` / `runtimeStore.dataStates` + `setDataState` / preview `DataState` 제거. **화면·데이터 변화 0** (결과를 소비하는 쪽이 애초에 없었다)
  - 배선 복구가 답이 아닌 이유: 판독자도 0건이고, 두 `DataState` 가 동명이인이면서 형태가 달라(`error: string | null` vs `Error | string | null`) 그대로는 대입도 안 된다. 현행 경로는 Builder DataTable 패널 → `collections` postMessage → `useCollectionData` 단일 진입점
  - live: preview 앱 마운트 정상, 실제 Vite 모듈 파이프라인으로 `rendererMap` 94개 구축 확인 + `DataTable` 렌더러를 빈 컨텍스트로 호출해 `null` 반환·무예외 확인 (종전 코드는 이 지점에서 fetch 를 걸었다)
  - 동반: `PLANNED.md` 의 잘못된 ✅ 3건 정정, `CANVAS_ISOLATION.md` 설계 스냅샷에 제거 주석
  - 위치: `packages/shared/src/{renderers/DataRenderers.tsx,types/renderer.types.ts}`, `apps/builder/src/preview/store/{types.ts,runtimeStore.ts}`

## [중복·죽은 코드 전수 정리 — 15파일 삭제 + 동명 선언 29건 판정] - 2026-08-17

### Architecture

- **`utils/performance/` 배럴과 모니터 3종이 한 번도 평가된 적 없었다** (본 엔트리의 마지막 단계):
  - `index.ts` 배럴을 어느 모듈도 import 하지 않아, 하단의 `window.__perfTools` 등록 IIFE 가 실행된 적이 없다. `stylePanelMetrics` / `fpsMonitor` / `memoryMonitor` 도 배럴 외 import 0건이라 함께 죽어 있었다
  - **Why 오래 안 보였나**: `utils/performanceMonitor.ts`(단수, **실사용**)와 이름이 한 글자 차이라 grep 이 섞이고, `docs/how-to/development/BENCHMARK_TEMPLATE.md` 가 `window.__perfTools.startAll()` 절차를 안내하고 있어 "쓰이는 도구" 로 읽혔다
  - 실측(실행 중인 빌더): `__perfTools` / `__fpsMonitor` / `__memoryMonitor` / `__stylePanelMetrics` **전부 `undefined`**, 대조군 `__composition_PERF__` 는 `object` — 소스에 선언된 다른 `window.__*` 전역은 모두 런타임에 존재
  - 삭제 4파일 1,428줄. 살아 있는 대체 경로는 `builder/utils/perfMarks.ts`(`window.__composition_PERF__`, ADR-069)와 Monitor 패널(`useFPSMonitor` / `useMemoryStats` / `useWebVitals` / `useComponentMemory`)
  - 동반: 안내가 깨져 있던 `BENCHMARK_TEMPLATE.md` §7.1 을 살아 있는 콘솔 API 로 교체, `STYLE_PARSING.md` Phase 0 체크리스트에 후기 추가, `diagnostics.static.test.ts` 의 배럴 단언 2건 제거
- **참조 0건이 된 builder 사본 삭제 — 11파일 3,316줄**: `numberUtils` / `dateUtils` / `useCollectionData`(ADR-132 로 대체) / `useCollectionDataCache` / `componentVariants.types` / `useAsyncQuery` / `collections.types`, 그리고 죽은 Builder↔Preview 채널 3종(`canvasDeltaMessenger` / `iframeMessenger` + 그 규칙 문서)
  - **Why**: ADR-125 Phase 3 이 `UPDATE_CANONICAL_DOCUMENT` 를 단일 채널로 확정한 뒤에도 delta 계열 메시지 정의·핸들러가 남아 있었다. ADR-122 인벤토리가 이미 정리 대상으로 지목한 항목
  - 삭제 판정은 grep 0건만으로 하지 않고 ADR/문서가 **알고도 남긴 것인지** 대조 — 실제로 그 절차가 오판 하나를 잡았다(아래 `getElementEvents`)
- **동명 선언 29건 전수 판정 — 실제 중복 6건, 나머지는 동명이인 확정**:
  - 통합: `FieldType` / `FieldDefinition` / `ColumnMapping` 이 builder·shared 에 **바이트 단위로 동일**하게 선언돼 있어 shared 를 정본으로 재수출, `Toast` 는 관계를 주석으로만 적어 두던 것을 `Omit<StoreToast, "action">` 파생으로 전환
  - 삭제: 소비처 0건이던 `SectionProps` / `SelectionState` / `ButtonProps` / `ToggleButtonProps`
  - `react-aria-starter` 26건은 upstream 스냅샷이라 설계상 동명 — 판정에서 제외
- **Preview 렌더 타입을 shared 정본으로 통합**: `PreviewElement` / `RenderContext` / `ComponentRenderer` 의 builder 사본을 제거하고 이중 단언 13곳(`as unknown as Shared*`)을 없앴다. `PreviewElement.fills` 를 shared 에 추가해 형태 차이를 해소

### Bug Fixes

- **`getElementEvents` 를 "ADR-149 가 bridge 를 미뤘다" 는 근거로 남겨 뒀는데 그 근거가 틀렸다**:
  - ADR-158(Implemented 2026-08-16)이 인터랙션을 canonical **root** `events` 컬렉션(`InteractionRule[]`)으로 옮기면서 그 bridge 를 이미 만들었다. 소비처 2곳은 전환(`workflowEdges`)·삭제(`canvasDeltaMessenger`)로 모두 사라진 상태였다
  - 요소별 `props.events` / `element.events` 는 읽는 쪽도 쓰는 쪽도 없는 legacy 저장 데이터로만 남았고 roundtrip 보존은 `legacyElementSanitizer` 담당 — builder·shared 양쪽에서 삭제
- **`useBorderRadiusDrag` 가 보내던 `merge: true` 는 아무도 읽지 않았다**: A/B 라이브 대조(같은 메시지를 `merge` 유무로 발신 → 결과 동일 `0px`)로 무해 확인 후 제거

### Documentation

- 삭제한 각 지점에 **왜 지웠는지**를 남기는 tombstone 주석을 배치 — 특히 죽은 프로토콜 사실 2건(`merge?: boolean` 미판독, `ThemeVarsMessage.vars` 형태 불일치)은 코드가 사라지면 재발견 비용이 큰 관찰이라 주석으로 보존

## [단축키 id 타입이 오타를 다시 막는다 — ShortcutId 리터럴 union 복원] - 2026-08-17

### Bug Fixes

- **`ShortcutId` 가 `string` 으로 무너져 있어 71개 단축키 id 의 오타 방어가 전혀 작동하지 않았다**:
  - 선언은 `keyof typeof SHORTCUT_DEFINITIONS` 로 리터럴 union 을 파생하는 형태였는데, 정작 그 객체에 `: ShortcutDefinitions` **타입 주석**이 붙어 있었다. 주석은 `as const` 를 이긴다 — `typeof` 가 `Record<string, ShortcutDefinition>` 으로 고정되고 `keyof` 는 `string` 이 된다
  - **Why**: 두 파일에 나눠 적혀 있어 각각만 보면 정상으로 읽힌다 (`keyboard.ts` 의 `ShortcutId = string` 은 순환 회피용, `keyboardShortcuts.ts` 의 `keyof typeof` 는 파생 의도). 둘을 잇는 `ShortcutDefinitions` 가 그 사이에서 union 을 삼켰다
  - 실측: 존재하지 않는 id 를 `ShortcutId` 에 대입해도 컴파일 통과. 30+ 소비처의 `as ShortcutId` 캐스팅이 전부 no-op 이고 `shortcutId?: ShortcutId` prop 이 오타를 하나도 막지 못했다
  - 수정: 타입 주석 제거 + `as const satisfies ShortcutDefinitions` — `keyof` 가 71키 union 을 유지한 채 항목별 형태 검사도 받는다. 복원 확인: 오타 대입이 `"copy" | "cut" | … | "treeSelectSpace"` union 위반으로 정확히 실패
  - **복원이 드러낸 실제 결함**: `CommandPalette` 의 `openSettingsModal` / `openHistoryModal` / `openAIModal` 3개 case 가 정의에 없는 id 라 **한 번도 실행되지 않는 죽은 분기**였다 (실제 정의는 `openSettings` 하나이고 같은 switch 아래에서 패널 토글로 처리 중). 제거 — 실행된 적이 없어 동작 변화 0
  - 동반: `as const` 로 `scope` 가 readonly 가 되어 소비 3곳(`KeyboardShortcut.scope` / `matchesScope` / `scopesOverlap`)이 `readonly` 배열을 수용
  - live: 빌더 로드 후 ⌘K 동작 → 팔레트 실제 표시 + 목록 정상(⌘Z/⌘⇧Z i18n), 런타임 정의 71개 불변, 죽은 id 3종 부재 확인
  - 위치: `apps/builder/src/builder/{config/keyboardShortcuts.ts,types/keyboard.ts,components/overlay/CommandPalette.tsx,hooks/useGlobalKeyboardShortcuts.ts,hooks/useKeyboardShortcutsRegistry.ts,utils/detectShortcutConflicts.ts}`

## [게시본에서 인터랙션 규칙이 동작한다 — publish 재배선] - 2026-08-17

### Features

- **빌더에서 저장한 인터랙션 규칙이 게시된 사이트에서 그대로 실행된다** (ADR-158 후속):
  - 종전 publish 는 legacy `element.events` + `ActionExecutor` 로 실행했는데 ADR-158 Phase 1 에서 그 mirror 파생이 끊겨 **입력이 영구 empty — 게시본 인터랙션이 완전 무동작**이었다. export 페이로드는 `CompositionDocument` 전체를 직렬화하므로 규칙(`document.events`)은 이미 게시본에 도착해 있었고, 없던 것은 소비뿐
  - dispatcher(`executeInteractionRule`)와 규칙 색인(`buildInteractionIndex`/`createElementHandlers`)을 preview 에서 `packages/shared/src/interactions/` 로 승격 — preview 와 publish 가 **같은 모듈**을 소비한다 (Framer/Webflow 모델: 빌더의 인터랙션 = 게시본의 인터랙션. 정책 한 곳 원칙 — preview 쪽 구 경로는 re-export 포워더로 존치)
  - publish 신규 `InteractionRuntime`: 규칙 색인 + 동작 deps (navigate = 슬러그 → 페이지 전환, 외부 URL/앵커는 브라우저 기본 의미 / toast = shared `ToastProvider` / capability patch = 런타임 override 층 — preview `patchInteractionOverride` 와 동일 병합 의미). legacy 이벤트 분기와 `ActionExecutor` 소비는 제거
  - 위치: `packages/shared/src/interactions/{dispatcher,bindings}.ts` · `apps/publish/src/renderer/{InteractionRuntime,ElementRenderer}.tsx` · `apps/publish/src/App.tsx`

## [event-id 죽은 채널 제거 — Items 패널 "On Action" 은퇴] - 2026-08-17

### Breaking Changes

- **Menu/Select/ComboBox 항목의 "On Action" 드롭다운(`onActionId`)이 사라졌다** (ADR-158 Phase 4 후속):
  - 이 채널은 **골라 저장해도 아무 일도 일어나지 않는 dead seam** 이었다 — 실행 쪽 `resolveActionId` 가 상시 `undefined`(noop) 였고, 드롭다운이 저장하는 값조차 "액션 id" 가 아니라 이벤트 타입 이름(`onPress` 등)인 어휘 혼선의 산물
  - RAC/RSP 대조: Select 는 per-item action 이 어휘에 없고(선택 = `onSelectionChange`), ComboBox 는 특수 케이스뿐. per-item action 이 정규인 Menu 도 항목 → 이동은 `MenuItem href` 가 정식 경로 — `StoredMenuItem.href` 로 이미 지원
  - 제거 범위: ItemsManager `event-id` case + binding 3곳 itemSchema + `Stored*.onActionId` + `RuntimeMenuItem.onAction` + `resolveActionId` seam(shared/preview) + dead 변환기 `toRuntimeSelectItem`/`toRuntimeComboBoxItem`(소비 0). 구 문서의 저장된 `onActionId` 키는 읽는 곳이 없어 무해
  - **재개 조건**: 항목 단위 커맨드 요구가 실제로 생기면 인터랙션 규칙에 itemKey 매칭을 확장 (dispatcher 가 callback 인자를 버리는 현 구조를 여는 것이 전제 — Figma 의 per-node Reaction 모델과 동형)
  - `EVENT_REGISTRY`(11종) 는 이로써 소비자 0 — legacy `ElementEvent.event_type` 은 구 데이터(은퇴한 `onClick` 등)를 표현 못 하던 거짓 union 이라 불투명 문자열로 정정
  - 위치: `packages/specs/src/types/{select,combobox,menu}-items.ts` · `packages/shared/src/catalog/bindings/{Menu,Select,ComboBox}.binding.ts` · `packages/shared/src/renderers/CollectionRenderers.tsx` · `apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx`

- **소비자 0 이 된 legacy 이벤트 타입 선언 2파일 은퇴** (위 제거의 후속, 441줄 순삭제):
  - `packages/shared/src/types/event.types.ts`(12심볼) — 배럴 재수출 한 줄이 유일 참조였다. 패키지가 `private` 이라 npm 표면도 없고 모노레포 import 0건
  - `apps/builder/src/types/events/events.types.ts`(32심볼) — **전량 소비 0**. `EventHandlerMap` 이 살아 있어 보였으나 **동명이인 3중 선언**이었고 실제 소비되는 것은 `packages/shared/src/types/renderer.types.ts:180` 쪽(`createEventHandlerMap` seam). 자리표시자로만 남던 `ElementEvent[]` 2곳(`BaseElementProps` / `ElementProps`)은 `unknown[]` 로 낮췄다 — `Element.events` 가 이미 쓰던 형태이고, 실제 read 경로 `getElementEvents` 가 `unknown[]` 을 반환해 shape 무의존이기 때문
  - **`props.events` 데이터 채널은 유지** — ADR-149 Phase 3-c 가 undo 정합 read source 로 의도 보존한 부분이다(canonical root 에 undo 통합이 없어 reader 를 canonical 로 바꾸면 undo 후 버그). 타입 선언과 데이터 채널은 별개 축이라는 것이 이번 판정의 실질
  - 검증: 파일을 치운 상태로 type-check 선실증(5패키지 PASS) 후 삭제 · 테스트 감소 0(shared 771 / builder 3589) · live 빌더 로드 정상(446요소, 콘솔 에러 0) + `getElementEvents` 3단계 우선순위(`props.events` → `element.events` → `[]`) 동작 확인

## [프레임 페이지에서 요소 추가가 기존 슬롯 콘텐츠를 지우던 문제] - 2026-08-17

### Bug Fixes

- **프레임이 적용된 페이지에 요소를 하나 추가하면 preview 에서 그 슬롯의 기존 콘텐츠가 통째로 사라졌다**:
  - 실측(Home + `layout-355cb029`): body 에 Button 하나를 추가하자 preview 의 content 슬롯에서 ListBox(ref) 서브트리 16노드가 소멸 (frame 하위 DOM 42→26). **Skia 캔버스는 둘 다 유지** — 축 비대칭이 진단 단서
  - **Why**: DOM 축 합성 `projectPageFrameNode` 의 "채워진 슬롯은 프레임 기본 자식을 감춘다" 정책이 슬롯의 기존 자식을 전부 master 기본 자식으로 간주했다. 그러나 프레임 적용 페이지의 기존 콘텐츠는 `RefNode.descendants[slotPath].children`(ADR-135 slot mirror)으로 슬롯 **안에** 들어와 있다 — resolver mode C 가 슬롯 자식을 이것으로 교체하므로, fill 발생 시 감춰지는 것이 placeholder 가 아니라 **사용자 콘텐츠**였다
  - 수정: fill 시 슬롯 자식 중 page 소유(`getPageOwnedChildrenFromFrameRef` 기반 `pageOwnedIds`)는 보존하고 fill 을 뒤에 이어 붙인다 — Skia 축 `resolvePageWithFrame` 의 "frame 소유 자식만 hide" 정책과 정렬 (§9.5 두 축 대칭)
  - 검증: `projectPageFrameTree.test.ts` 신규 1건 (수정 전 RED) + 기존 "기본 자식 감춤" 회귀 유지. live — 같은 조작이 42→**43** (ListBox 유지 + Button 렌더), 캔버스·preview 대칭 회복
  - 위치: `apps/builder/src/adapters/canonical/projectPageFrameTree.ts`

## [캔버스 navigation 엣지가 인터랙션 규칙을 다시 본다] - 2026-08-16

### Bug Fixes

- **워크플로 오버레이의 event-navigation 엣지가 한 건도 안 나왔다**:
  - `computeWorkflowEdges` 가 요소의 legacy `props.events` / `element.events` 를 읽는데, ADR-158 Phase 1 에서 그 mirror 파생이 끊겨 **신규 인터랙션 규칙이 캔버스에 전혀 반영되지 않았다**
  - **Why**: 조용한 결함이다 — 엣지가 안 보이는 것과 규칙이 없는 것이 화면상 구분되지 않는다. ADR-158 Phase 4 은퇴 조사에서 드러났다
  - 수정: canonical `events` root collection 의 `InteractionRule[]` 을 읽는다. `action.kind === "navigate"` → `params.path` 를 슬러그 매칭, 소스 페이지는 `elementId` 로 요소를 조회해 얻는다 (규칙이 가리키는 요소가 삭제됐을 수 있다)
  - **legacy 갈래는 되살리지 않고 걷어냈다** — 구 문서에 남은 entry 는 실행 경로가 없어(패널 삭제 + `isInteractionRule` 필터) 그리면 *일어나지 않을 이동*을 그리는 셈이다. 그 디코더가 해석하던 어휘 자체도 같은 커밋에서 은퇴한 47종 액션이다
  - 라벨을 패널과 같은 어휘(`TRIGGER_LABELS`)로 맞췄다 — 캔버스에 `onPress`, 패널에 "누를 때" 가 뜨면 같은 것을 두 이름으로 부르는 셈이다
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` · `BuilderCanvas.tsx`
- **구 `SerializedEvent` entry 가 섞이면 캔버스가 죽을 수 있었다**: `events` 는 타입상 `InteractionRule[]` 이지만 구 문서에는 `action` 필드가 없는 entry 가 남아 있을 수 있다 — 가드 없이 `rule.action.kind` 를 읽으면 `TypeError`. 실행 쪽과 같은 `isInteractionRule` 판정으로 걸러낸다
- 회귀 감시: `workflowEdges.interactionRules.test.ts` 11건 (이 모듈은 종전에 테스트가 0건이었다). live A/B — 규칙 추가 시 Page 2 로 들어가는 마젠타 점선 화살표 표시, 규칙 제거 시 소멸

## [ADR-158 Implemented — 구 이벤트 시스템 은퇴 96파일 / 19,513 LOC] - 2026-08-16

### Breaking Changes

- **구 EventsPanel 과 그 어휘가 사라졌다** — 사용자 명시 삭제 승인 후 실행:
  - `builder/panels/events/` 92파일 (17,387 LOC) · `utils/events/` 3파일 (1,419 LOC) · ADR-149 legacy adapter `rootCollectionMigration.ts` + 테스트 (707 LOC)
  - `EVENT_REGISTRY` 24종 → **RAC 실존 11종**. DOM 별칭 10종(`onClick`/`onMouseEnter`/`onKeyDown` 등)과 비RAC·미구현 3종(`onScroll`/`onResize`/`onLoad`) 은퇴
  - `IMPLEMENTED_ACTION_TYPES` 47종(camelCase 28 + snake_case 별칭 19)과 레이블·카테고리 맵 은퇴 — Do 축은 `CAPABILITY_REGISTRY` 소유
  - `SelectedElement.events` projection · `updateLegacyElementEvents` · `RenderContext.eventEngine` 채널 제거
  - **저장된 구 데이터는 깨지지 않는다** — 읽는 쪽(`isInteractionRule`)이 구 entry 를 걸러내고, publish `ElementRenderer` 의 legacy 소비는 `events === undefined → {}` no-op 이다

### Features

- **인터랙션 규칙이 실제로 실행된다** (ADR-158 Phase 3): 트리거 요소를 누르면 navigate / toast / 대상 요소 capability(show·hide·toggle, Modal open 등)가 동작한다. 종전에는 규칙을 저장해도 소비하는 런타임이 0개였다

### Bug Fixes

- **`EventEngine` 은 write-only dead 였다**: `syncVariables` 만 호출되는데 그것이 채우는 `this.state` 를 읽는 것은 `executeEvent`(호출 0건)와 `getState()`(외부 호출 0건)뿐 — 넣기만 하고 아무도 꺼내지 않는 통이었다. 값 동기화 구독까지 함께 제거

### Architecture

- **ADR-158 `Accepted → Implemented`** (Phase 0~4 전부 완료). `docs/adr/completed/` 로 이동, README 행 갱신
- Phase 3 에서 **배선 결손 3건**을 발견·수리했다 (전부 "등재는 됐는데 전달 경로가 없다" 는 같은 형태):
  - 대상 축 — `Modal.binding.accepts` 에 `isOpen` 누락
  - 트리거 축 — catalog generic 경로가 `createEventHandlerMap` 을 아예 호출하지 않아 **cutover 116 타입 전체**가 무반응
  - 실행 override 미판독 — `toRacProps` / `toReactStyle` 두 소비자가 원본 `node` 를 읽음
- **G2 4종 live 확증** (Chrome MCP, cutover 트리거 Button×3 / Link×1): toast · hide/show(toggle 4연타 교대) · modal open(자식 없는 Modal — 같은 세션의 FocusScope 수리 동반) · navigate(Home → Page 2)
- 회귀 감시: `eventRegistryVocabulary.test.ts` (은퇴 13종 재도입 차단) · `capabilityBindingReach.test.ts` · `CanonicalNodeRenderer.interactionTrigger/interactionOverride.test.tsx`

### Documentation

- **breakdown 이 몰랐던 파손 지점 1건**: `ItemsManager` 의 `event-id` 드롭다운(Menu/ComboBox/Select 의 `onActionId`)이 `EVENT_REGISTRY` 의 live consumer 였다 — §0 표 ① 의 6곳에 없었다. 그래서 registry 를 지우지 않고 11종으로 좁혀 존치
- **남은 dead seam 3건** (이번 범위 밖, 후속 판단용):
  - `event-id` 채널 자체가 죽어 있다 — preview `resolveActionId` 가 항상 `undefined` 라 골라 저장해도 실행 경로가 없다
  - `workflowEdges`(캔버스 navigation 엣지)가 legacy `element.events` 를 읽는데 Phase 1 에서 mirror 파생이 끊겨 신규 규칙이 보이지 않는다
  - `packages/shared` 의 `PublishEventRuntime` 은 barrel 재export 외 소비처 0건

## [실행 override 를 안 읽던 소비자 둘째 — G2 4종 cutover 트리거 재확증] - 2026-08-16

### Bug Fixes

- **catalog generic 경로에서 공통 show/hide/toggle 이 무반응이었다** (ADR-158 Phase 3):
  - `toReactStyle(node)` 가 병합 결과가 아니라 **원본 `node`** 를 읽어 `style.display` patch 가 버려졌다. 직전에 고친 `toRacProps(node, …)`(Modal.isOpen 무반응)와 **같은 자리 같은 형태** — 소비처마다 따로 같은 실수를 하는 모양이라, 병합된 `renderNode` 를 한 번 만들어 이 경로의 모든 소비자가 그것을 읽게 했다
  - **Why**: dispatcher 는 계속 `ok` 를 돌려주고 화면만 안 바뀐다. 셋째 소비자가 붙을 때 조용히 새지 않도록 두 축(style / prop)을 각각 테스트로 못 박았다
  - 위치: `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`

### Documentation

- **G2 4종을 cutover 트리거로 재확증** — 직전까지의 통과는 legacy·위임 렌더러 트리거로 얻은 것이라, 사용자가 실제로 누르는 catalog 타입 조합은 트리거 배선 이후 처음 열렸다. Button ×3 / Link ×1 을 트리거로 라이브 실측:
  - toast — `react-aria-ToastRegion` + `react-aria-Toast` 에 메시지 표시
  - hide / show — `inline-flex → none → inline-flex → none`, toggle 4연타 완전 교대
  - modal open — **자식 없는** Modal(기본 autoFocus/trapFocus)이 0→1, 프레임 유지 (같은 세션의 FocusScope 수리도 실경로에서 함께 통과)
  - navigate — Home → Page 2, 404 아님
- **측정 함정 2건** (같은 트리거의 규칙을 바꿔 가며 재느라 결과가 섞였다):
  - 규칙을 다시 쓰면 문서가 재전송되고 **실행 override 가 비워진다**(의도된 설계). 그래서 "show 가 요소를 숨긴다" 같은 반대 결론이 나온다 — 실제로는 override 가 비워진 상태에서 직전 규칙의 핸들러가 동작한 것
  - override 는 즉시 비워지는데 **핸들러 교체는 한 렌더 뒤에 반영된다**. 규칙을 바꿔 가며 재지 말고 **트리거를 규칙 수만큼 따로 두고** 각각 한 번씩 누를 것

## [인터랙션 트리거가 catalog 116 타입에 배선돼 있지 않았다] - 2026-08-16

### Bug Fixes

- **규칙을 만들어도 Button / Link / Checkbox / Switch / Select 에서 아무 일도 일어나지 않았다** (ADR-158 Phase 3):
  - `createEventHandlerMap` 을 호출하는 곳이 `rendererMap` 계열 renderer **14곳뿐**이었다. catalog cutover **116 타입**은 `toRacProps` 로 렌더되는 generic 경로를 타는데 그 경로에는 호출 지점이 아예 없다 → 규칙을 등재해도 콜백이 컴포넌트에 전달되지 않는다
  - live 실측: Link 의 RAC fiber props 에 `on*` 이 **0건**. 배선 후 `onPress` 1건
  - **Why**: cutover 116 타입이 곧 사용자가 실제로 누르는 것들이라, 이 경로가 끊기면 인터랙션 기능 전체가 사실상 죽는다. 같은 세션에 고친 Modal 의 `accepts` 결손과 **같은 형태** — 등재는 됐는데 전달 경로가 없고, dispatcher 는 멀쩡해서 증상이 "눌렀는데 아무 일도 없다" 로만 보인다. 한쪽은 대상 축, 이쪽은 트리거 축이다
  - `racRest` **뒤**에 펼친다 — 같은 이름의 catalog prop 이 트리거 콜백을 덮으면 안 된다. 규칙이 없는 요소에는 동결된 빈 객체가 돌아와 prop 이 붙지 않는다
  - 위치: `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`
  - live 확인: Link `onPress` → `navigate /page-2` → 미리보기가 Home → Page 2 로 이동, 404 아님
- **preview `RenderContext` 에 `services` 선언이 없었다**: App 이 실제로 채우고 shared 렌더러가 소비하는데도 타입에 없어, preview 쪽에서 `context.services` 를 읽으려 하면 컴파일이 막혔다. shared `RuntimeServices` 를 그대로 가리켜 둘이 갈리지 않게 했다

### Documentation

- **직전 세션의 navigate 진단은 틀렸다** — "preview 에 pages 가 등록되지 않아 404 착지" 로 기록했으나, live 실측상 `UPDATE_PAGES` 는 7 페이지가 정상 전달되고 라우트도 슬러그대로(`/page-2`) 만들어진다. 실제 원인은 위의 트리거 배선 결손 하나였다

## [내용 없는 overlay 가 미리보기를 날리던 결함 — FocusScope 빈 scope] - 2026-08-16

### Bug Fixes

- **자식 없는 Modal 을 열면 미리보기가 통째로 백지가 됐다**:
  - `@react-aria/focus` 의 `FocusScope` 는 자기가 렌더한 sentinel `<span>` 두 개 **사이의 DOM 노드**를 모아 `scope` 배열로 들고 있다. 사이에 아무것도 없으면 `[]` 가 되는데, `useAutoFocus` 의 가드는 `scopeRef.current` 의 **존재만** 보므로 빈 배열도 통과한다 → `getFirstInScope` 의 `scope[0].previousElementSibling` 에서 `TypeError` → 트리 전체 언마운트
  - **Why**: 빌더에서 "요소만 놓고 아직 내용을 안 채운 overlay" 는 일상적인 중간 상태다. 그 상태가 미리보기 전체를 날리면 사용자는 무엇을 되돌려야 하는지도 알 수 없다
  - **같은 결함이 3곳에 있었다** — `Modal`(autoFocus 기본 true) · `Popover`(기본 true) · `Form`(기본 false 라 `autoFocus` 를 켤 때만). 셋 다 RAC 컴포넌트를 감싸는 composition wrapper 가 **사용자가 작성한 subtree** 를 그대로 `FocusScope` 에 넘기는 형태다. RAC 자신은 항상 구체 요소를 감싸므로 이 상태를 겪지 않는다
  - 수정: 공용 `ContentFocusScope` 가 scope 첫머리에 `<span hidden data-focus-scope-anchor>` 하나를 항상 넣어 **scope 가 비지 않게** 한다. 앵커는 `hidden` 이라 레이아웃·접근성 트리·포커스 탐색 어디에도 참여하지 않고, `FocusScope` 자신이 이미 같은 자리에 sentinel `<span hidden>` 두 개를 렌더하고 있어 `:first-child` 가 사용자 내용을 가리키지 않는 상태도 종전 그대로다
  - **`React.Children.count(children) === 0` 판정을 기각한 이유**: 자식은 있는데 DOM 노드를 하나도 만들지 않는 형태(닫힌 overlay 를 유일한 자식으로 둔 Modal 등)가 그대로 남는다. 실측 — 세 형태(자식 0 / 자식은 있고 DOM 0 / 빈 Form + autoFocus) 모두 **같은 `previousElementSibling` 에서 동일하게** 죽었다
  - 위치: `packages/shared/src/components/{ContentFocusScope,Modal,Popover,Form}.tsx`
  - 회귀 감시: `overlayEmptyFocusScope.test.tsx` (RED 3건 → GREEN). live 확인 — 기본값(autoFocus/trapFocus) 그대로 빈 Modal 을 열어 미리보기 트리 유지 + 내용이 있을 때 autoFocus 가 여전히 첫 버튼으로 이동

## ["추가" 아이콘 규칙 확정 + 가드 사각 2건 해소] - 2026-08-16

### Bug Fixes

- **삭제 아이콘 발산이 라이브 화면 2곳에 더 있었다 — 직전 엔트리의 보고가 불완전했다**:
  - `LayerTreeItemContent.tsx` / `PageTreeItemContent.tsx` — **레이어 트리·페이지 트리의 삭제 버튼**이 구 `Trash` 였다. 가장 자주 보는 패널이다
  - **Why**: 가드 정규식이 `from "lucide-react"` (겹따옴표)만 매칭해 **홑따옴표 import 21개 파일을 통째로 못 봤다**. 직전 엔트리의 "`Trash` 는 FramesTab 2파일 + dead 2건" 은 이 사각의 산물이다. 정규식을 `["']` 로 고치자 events 트리 4건까지 함께 드러났다
  - live 실측: 페이지 트리 삭제 5버튼 · 프레임 트리 3버튼 전부 `lucide-trash-2`, 금지 변종 DOM 토큰 0건
- **`ACTION_ICONS` 이름 충돌** — `events/blocks/ActionBlock.tsx` 에 동명의 로컬 맵(액션 타입 → 아이콘)이 있어 정본 import 와 부딪혔다. 로컬 쪽을 이웃(`ACTION_TYPE_LABELS`)과 맞춰 `ACTION_TYPE_ICONS` 로 좁혔다
- **ADR-181 C4 #6 정적 테스트가 깨져 있었다**: `HistoryPanel` 소스에 `"page-guide": RulerDimensionLine` 리터럴을 단언하는데 직전 커밋이 그 줄을 정본 경유로 바꿨다. 직전 작업이 `stores/history/` 를 테스트 범위에 넣지 않아 놓쳤다. 단언을 `ACTION_ICONS.toggleRulers` 로 갱신 — 확인할 것은 "가이드 entry 가 눈금자 그림을 쓴다" 이지 특정 심볼명이 아니다

### Features

- **"추가" 어포던스 아이콘 규칙 확정 — `Plus` 하나**:
  - 종전에는 `Plus`(29곳)와 `CirclePlus`(6곳)로 갈려 있었다. 실측상 잠재 규칙은 **"아이콘 단독 = `CirclePlus` / 텍스트 동반 = `Plus`"** 였고 `CirclePlus` 6/6 이 일치했다
  - **그 규칙을 기각한 이유** — ① 이미 새고 있었다 (FillSection 2건은 아이콘 단독인데 `Plus`) ② **기계 집행이 불가능하다** (JSX 형제에 텍스트 노드가 있는지로 판정해야 해 정적 스캔이 취약 — 막지 못하는 규칙은 규칙이 아니다) ③ `PanelHeader actions` 자리의 다른 아이콘(gear/trash)이 전부 선화 단독이라 거기서 원형 변종만 튄다
  - 예외는 하나 — **같은 화면에서 두 종류를 더할 때의 구분 변종** (`ItemsManager` 의 `FolderPlus` "Add Section" ↔ `Plus` "Add Item"). 구분할 상대가 없으면 변종을 쓰지 않는다
  - 사용자-가시 변화: Pages / Frames 섹션 헤더의 추가 버튼과 Add Page 다이얼로그가 원형 `⊕` → 선화 `+` (live 확인)
  - 초기 가설("최상위 개체 생성 vs 목록 항목 추가")은 **반증됐다** — `PagesSection`(CirclePlus)과 `DataTableList`(Plus)가 둘 다 패널 섹션 헤더의 "새 최상위 개체 만들기" 이고, `ActionTypePicker`(CirclePlus)와 `ActionList`(Plus)는 완전히 같은 "액션 추가" 다

### Architecture

- **가드 조항 ③ 추가 — 금지 변종 0건** (`actionIcons.static.test.ts`):
  - 조항 ①은 registry 가 **import 하는** 심볼만 본다. 정본이 `Trash2` 인데 누가 `Trash` 를 집는 것은 못 잡는데, **그게 정확히 이번에 고친 발산의 형태다**. 고쳐 놓고 재도입을 막지 않으면 같은 자리로 돌아온다
  - `Trash`→`delete` / `Ruler`→`toggleRulers` / `CirclePlus`·`PlusCircle`→`add`, 각 항목에 "왜 이 변종이 아닌가" 사유 동반. 정본 키 오타 감지 단언 포함
  - RED 검증 — RuleRow 에 `Trash` 직접 import 시 조항③ FAIL
- **`ACTION_ICONS.add` 등재 + 30개 파일 배선** (dashboard 포함 — "새 프로젝트" / "프로젝트 삭제" 도 같은 액션이다)
- **예외 3건 추가** (`INTENTIONAL_DIVERGENCE`) — 판정 기준이 "같은 그림"이 아니라 **같은 액션**이라: `PropertyNumberInput` 의 `Plus` 는 `Minus` 와 짝인 **스테퍼 증가**(추가 아님), 랜딩 `App.tsx` 의 `CirclePlus` 는 액션 없는 **장식**, (기존) TypographySection 정렬 6종은 `textAlign` 스타일 값
- 규칙 문서화: `.claude/rules/panel-structure.md` §아이콘 — 등재 기준 / 기각한 대안과 그 이유 / 금지 패턴 6종

## [빌더 액션 아이콘 정본 — ACTION_ICONS registry + 정적 가드] - 2026-08-16

### Bug Fixes

- **같은 액션이 화면마다 다른 아이콘으로 갈려 있던 2건**:
  - **삭제**: `Trash2` 25곳 vs **`Trash`** — `FramesTab/{FrameList,FrameElementTree}.tsx` (라이브 화면). 나머지 `Trash` 2건은 진입점 없는 `panels/events/` 트리
  - **눈금자 토글**: 컨텍스트 메뉴 `Ruler` vs Settings 패널 `RulerDimensionLine` — **같은 `setShowRulers` 를 부르는 두 진입점**. 직전 커밋에서 컨텍스트 메뉴에 아이콘을 넣으며 생겼다. `RulerDimensionLine` 쪽이 정본 (History 의 `page-guide` 도 "눈금자 토글과 같은 아이콘" 주석을 달고 이미 그 그림을 쓰고 있었다)
  - **Why**: 빌더 크롬 아이콘에 **정본이 없어** 106개 파일이 `lucide-react` 를 각자 import 한다 (실측 — 고유 220심볼 / import 지점 537 / 그 중 105심볼이 2개 이상 파일에 중복). 같은 액션이 여러 화면에 나오면 한쪽만 바꿔도 아무것도 막지 않는다. 손으로 맞춘 흔적(History `page-guide` 주석, 정렬 8종)은 있었지만 규약이 코드에 없어 매번 사람이 기억해야 했다
  - live 실측: 컨텍스트 메뉴 눈금자 → `lucide-ruler-dimension-line` (Settings 패널과 동일), FramesTab 삭제 3버튼 → `lucide-trash-2`, 요소 메뉴 11항목 아이콘 누락 0건, 콘솔 에러 0건
- **`copySelection` 반환값이 `run` 계약과 어긋나던 타입 에러** (선행 결함):
  - `Promise<boolean>` 을 `() => void | Promise<void>` 자리에 넘기고 있었다. baseline 에 없던 항목이라 HEAD 에서도 type-check 가 실패 중이었다 (HEAD 원본으로 재현 확인)
  - 호출부가 이미 `void item.run()` 으로 버리므로 `void` 로 명시 — 동작 변화 없음
  - 위치: `canvas/contextMenu/canvasContextMenuProviders.ts`

### Architecture

- **`ACTION_ICONS` — 2개 이상 화면에 나오는 액션의 아이콘 정본** (`builder/config/actionIcons.ts`, 20항목):
  - 등재 기준 2가지 — ① 같은 사용자 액션이 **2개 이상 surface** 에 노출 ② 그 액션이 **한 벌로 읽히는 묶음**이면 묶음 전체 (정렬 8종처럼 낱개만 등재하면 나머지가 다시 갈린다)
  - 등재: 편집 4(copy/paste/duplicate/delete) · 구성 2(group/ungroup) · 컴포넌트 3(component/goToOrigin/detach) · 정렬·분배 9 · 뷰 토글 2(rulers/snap). 도메인 타입 키 매핑 `ALIGNMENT_ICONS` / `DISTRIBUTION_ICONS` 파생
  - **비대상이 설계의 본체** — 220심볼 중 200개는 그대로 직접 import 다. z-order 4종·줌 2종처럼 한 화면에만 있는 것은 조회 비용만 늘고 막아 주는 게 없다
  - **치수·색은 소유하지 않는다**: 같은 삭제라도 컨텍스트 메뉴 14px, 툴바 16px 이고 그게 맞다 (surface 밀도). registry 는 "무엇을" 만 소유하고 "얼마나 크게" 는 호출부가 정한다 — 치수까지 넣으면 registry 가 surface 별 분기를 흡수하며 비대해진다
  - 중복이던 `ContextMenuIcon` 타입은 `ActionIcon` 별칭으로 흡수
  - 배선: 컨텍스트 메뉴 · 다중 선택 툴바 · Styles/Properties 패널 · History · Settings · FramesTab · datatable/component/interactions 목록 등 **25개 파일**
- **정적 가드 2조항** (`actionIcons.static.test.ts`, 23 케이스):
  - ① 등재 심볼의 **registry 밖 직접 import 0건** ② 등재 항목별 **소비처 ≥1** (죽은 항목이 "고를 수 있는 것" 으로 남지 않게 — ADR-900 잔재 게이트가 소비자 0건인 채 수개월 남았던 것과 같은 형태)
  - **Why**: registry 만 두면 새 코드가 안 쓰면 그만이라 6개월 뒤 반쪽이 된다. 실제로 막는 것은 가드다
  - RED 검증 — RuleRow 에 `Trash2` 직접 import 재도입 시 ①이 FAIL, 소비처 없는 키 추가 시 ②가 FAIL
  - **예외 4건은 사유와 함께 등재** (`INTENTIONAL_DIVERGENCE`): 정본 기준은 "같은 그림" 이 아니라 **같은 액션**이라, 심볼만 겹치는 것은 묶으면 오히려 한쪽이 잘못 따라 바뀐다 — TypographySection 의 정렬 6종은 `textAlign` **스타일 값**(요소 정렬 아님), ModifiedStyles/Transform 의 `RulerDimensionLine` 은 치수 입력 필드 아이콘(눈금자 토글 아님), eventCategories 의 `Component` 는 이벤트 카테고리 라벨
- **type-check baseline 라인 시프트 4건 갱신** (`.type-errors-baseline.txt`): 항목 수 43 → 43, 내용 변화 0 — 전부 편집으로 밀린 줄 번호다. `elements.ts(485→500)` 은 이번 작업과 무관한 선행 드리프트로, 갱신 전에는 HEAD 도 type-check 가 실패하고 있었다. 라인 무시 (파일·코드·메시지) 전수 대조로 신규 0 / 소실 0 확인 후 갱신

## [컨텍스트 메뉴 chrome 을 header 메뉴 패턴으로 정렬] - 2026-08-16

### Bug Fixes

- **빌더 다크 모드에서 메뉴 3종이 흰 판으로 남던 문제** (컨텍스트 메뉴 / header 메뉴 / 줌 메뉴):
  - 빌더 UI 를 다크로 두면 패널은 `#202023` 인데 이 메뉴들만 `#fff` 로 떴다 (본문도 검정 그대로라 사실상 반전)
  - **Why**: builder 토큰은 `[data-context="builder"]` 스코프인데, 이 메뉴들은 portal 로 `body` 밑에 붙어 그 밖으로 나간다. `builder-system.css` 에 그 경우를 받으려는 fallback (`body:not([data-preview="true"]) > .react-aria-Popover`)이 있지만 **두 조건 모두 지금은 성립하지 않는다** — RAC 가 popover 를 style 만 있는 wrapper `<div>` 로 한 겹 감싸 직계 자식이 아니고(실측 `body > div > .context-menu-popover`), `className` 을 주면 기본 클래스 `react-aria-Popover` 도 사라진다 (실측: 문서 전체 `.react-aria-Popover` 0건). 그래서 스코프를 아예 못 받고 전역 light 값으로 떨어졌다 — light 에서는 두 팔레트가 거의 같아 드러나지 않았다
  - 수정은 **popover 별 마커가 아니라 구조 규칙 하나**로 했다 — RAC 1.18 에는 `UNSTABLE_PortalProvider` 가 없어 portal 대상을 옮길 수 없고, 빌더 문서에서 `#root` 밖 body 자식은 portal 산물뿐이다: `[data-builder-theme] body:not([data-preview="true"]) > :not(#root)`. 그래서 **앞으로 추가되는 overlay 도 자동으로** 스코프를 받는다 (초안에서 세 메뉴에 붙였던 `data-context="builder"` 마커는 중복이 되어 걷어냄)
  - `data-builder-theme` 은 이제 색 선택 외에 **"빌더가 mount 중"** 이라는 게이트도 겸한다 — `BuilderCore` 가 unmount 시 제거하도록 보완했다. 없으면 dashboard/auth 라우트로 넘어가도 속성이 남아 그쪽 overlay 까지 빌더 팔레트를 받는다 (실측: 라우트 이동 후 속성 제거 확인)
  - **같이 고친 축 — portaled 목록만 16px 로 크던 문제**: 빌더는 root 에 base font-size 를 두지 않고 컨트롤마다 정하는데, portal 로 나간 목록(ListBoxItem/MenuItem)은 어떤 규칙도 못 받아 브라우저 기본 16px 로 떨어졌다 — 패널보다 커서 드롭다운만 튀었다. 같은 portal 스코프에 `font-size: var(--text-xs)`(12px) 기준을 준다 (실측: `property-select-popover` / `property-unit-input-popover` 항목 16 → 12px, 패널 legend·Select 트리거 값과 일치). 자기 크기를 명시한 overlay(메뉴 3종 12px / 아이콘 피커 12·10px)는 그대로
  - 기준값 판정 주의 — **컨트롤 엘리먼트의 `font-size` 를 기준으로 삼으면 안 된다**. Select 트리거 `button` 은 14px 이지만 직접 텍스트가 없는 상자이고, 실제로 보이는 값은 자식 `.react-aria-SelectValue` 의 12px 이다. 인스펙터 렌더 텍스트 전수 실측은 12px 28개 / 10px 6개 / **14px 0개**
  - 부수 효과(의도): light 에서도 이제 패널과 같은 builder 팔레트를 쓴다 — 표면이 `#fff` → `gray-50`, 본문이 `gray-950` → `slate-800` 으로 아주 조금 부드러워진다
  - live 실측(다크): 컨텍스트 메뉴 popover `rgb(32,32,35)` · 라벨 `zinc-100` · 아이콘/단축키 `zinc-400` · 구분선 `zinc-700` · 삭제 `red-400`, 하위 메뉴와 hover(`--bg-muted`)까지 정합. 인스펙터 Select/단위 드롭다운도 같은 팔레트 + 14px. light 로 되돌려 재확인
  - 위치: `packages/shared/src/components/styles/theme/builder-system.css` · `main/BuilderCore.tsx`

### Features

- **우클릭 컨텍스트 메뉴가 header 메뉴(`.header-menu-popover`)와 같은 모양이 됨**:
  - popover: 모서리 `--radius-lg`(8px, 기존 `--radius-sm`) + `overflow: hidden` + `contain: layout style` + 최소 폭 200px, 열기/닫기 모션(`translateY` 2px, 0.1s/0.08s) 추가
  - **패딩 소유자가 popover → menu 로 이동**. header 패턴과 같은 3층 분담(popover=껍데기 / menu=패딩 · 스크롤 / item=flex + gap). 뷰포트가 좁아 RAC 가 popover 에 `max-height` 를 인라인으로 걸면 `overflow: hidden` 이 항목을 잘라내므로, 스크롤은 menu 가 맡는다 (실측: 항목 13개 메뉴에서 `max-height: 608px` 상속 확인)
  - item: `gap` + 모서리 `--radius-md`, hover/focus 는 `--bg-muted` · pressed 는 `--accent-subtle` 로 분리(기존 3상태 동일 배경), 단축키는 `margin-left: auto` 로 우측 정렬
  - 구조: 단축키를 RAC `<Keyboard>` 로, 토글 체크를 lucide `Check`(14px)로 교체하고 **하위 메뉴 항목에 `ChevronRight` 표식 추가**(기존에는 하위 메뉴 여부가 보이지 않았다). 체크와 단축키가 같이 뜨는 항목(눈금자 표시 ⇧R)은 `auto` 마진이 둘로 갈려 체크가 가운데로 밀리므로, 뒤따르는 `kbd` 는 gap 만으로 붙인다
  - popover 에 `outline: none` 유지 — header 메뉴와 달리 우클릭 진입에서는 popover 자신(`tabIndex=-1`)이 포커스를 받아 UA 포커스 링이 그려진다
  - **라벨 글자 크기가 14px 로 커져 있던 것 정정** (12px, header 와 동일 — 항목 높이 37→34px). **Why**: 라벨이 RAC 기본 클래스 `react-aria-Text` 를 달고 있어 `@layer components` 의 `font-size: var(--text-sm)` 가 **span 자신에게** 걸렸다 — 부모 item 의 `--text-xs` 는 상속이라 항상 진다(레이어 순서와 무관). 같은 규칙의 `color: var(--fg)` 가 destructive("삭제 / Delete") 빨강도 지우고 있었다. 덮어쓰기 대신 라벨 클래스를 `context-menu-item-label` 로 갈아끼워 두 증상을 함께 해소 — header 의 클래스 없는 `<span>` 과 같은 상속 상태가 된다
- **컨텍스트 메뉴 항목에 아이콘 추가** (header 메뉴와 같은 `아이콘 · 라벨 · 단축키` 3열):
  - 요소 메뉴 14종 + 정렬 하위 메뉴 8종 + 빈 영역 메뉴 5종 전부. z-order 4종은 한 걸음(`ArrowUp`/`ArrowDown`) ↔ 끝까지(`ArrowUpToLine`/`ArrowDownToLine`) 대비로 한 가족으로 읽히게 두고, **정렬 8종은 같은 액션을 쓰는 다중 선택 툴바(`MultiSelectStatusIndicator`)와 동일 아이콘**을 재사용했다 — 두 진입점이 다른 그림을 쓰면 같은 동작으로 안 읽힌다
  - 아이콘 열은 **메뉴 단위로 예약**한다: 한 항목이라도 아이콘이 있으면 나머지는 빈 자리를 받아 라벨 시작선이 맞고, 아무도 없으면 열 자체가 없어 종전처럼 납작하다. 항목마다 조건부로 렌더하면 섞인 메뉴에서 라벨이 어긋난다 (회귀 테스트 2건 — 되돌리면 RED 확인)
  - provider 는 `.ts` 라 JSX 대신 컴포넌트 참조를 넘긴다 (`ContextMenuIcon` = 구조적 타입, lucide 결합 없음)
  - destructive 항목은 아이콘도 라벨과 같이 빨강 — 라벨만 빨갛고 아이콘이 회색이면 "삭제" 가 비활성처럼 읽힌다
  - 위치: `contextMenu/{types.ts,ContextMenuOverlay.tsx,contextMenu.css}` + `canvas/contextMenu/canvasContextMenuProviders.ts`
  - live 실측(빌더 우클릭): 요소 메뉴 / 빈 영역 메뉴 / 다중 선택 정렬 하위 메뉴 / 토글 체크 + 단축키 동시 노출 4경로 확인 — 열린 두 메뉴 모두 라벨 시작선 1개, 아이콘 누락 0건
  - 위치: `apps/builder/src/builder/components/overlay/contextMenu/{contextMenu.css,ContextMenuOverlay.tsx}`

## [프레임 적용 페이지의 canonical 자식 배치 정정] - 2026-08-16

### Bug Fixes

- **프레임 적용 페이지에서 최상위 요소를 그룹화하면 요소가 사라지던 문제**:
  - 프레임이 적용된 페이지(canonical `ref` 노드)에서 페이지 최상위 요소들을 그룹화하면, 새 frame 과 그 자식들이 canonical 문서에서 사라졌다 (store 에만 남아 새로고침 전까지 split-brain). undo 는 노드는 되살렸지만 형제 순서를 복원하지 못했다
  - **Why**: `attachChildToPage` 가 ref 페이지에서 `slot_name` 유무와 무관하게 **항상 슬롯 override**(`descendants`)를 골랐다. 반면 hydrate 는 페이지 최상위 요소를 `children` 에 둔다 — 그래서 legacy 속성이 완전히 같은 형제가 두 곳으로 갈렸고(실측: `parent_id: null` + `slot_name` 없는 ListBox 2개가 각각 `children`/`descendants`), 새 frame 이 override 로 들어간 뒤 자식 reparent 가 `children` 트리에서 그 frame 을 찾지 못해 자식들까지 유실됐다
  - 수정: 슬롯을 지목하지 않은(`slot_name` 없는) 요소는 페이지의 직접 자식으로 붙인다. 슬롯 배치는 `slot_name` 이 있을 때만. 기존 override 데이터는 옮기지 않는다 (마이그레이션 불요)
  - 재현 조건이 좁아 오래 보이지 않았다 — 일반 요소 추가는 `parent_id` 가 있어 다른 분기를 타고, `parent_id: null` 인 페이지 최상위 요소를 다루는 경로에서만 드러난다 (ADR-182 그룹화 통합 검증 중 발견)
  - live 실측: 그룹화 → frame 이 `children` 에 삽입 + 자식 2개 정상 포함 → undo 1회로 **형제 순서까지** 원복 → 새로고침 정합. 회귀 테스트 2건 (slot-less → children / slot-named → override)
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutations.ts`

## [빌더 우클릭 컨텍스트 메뉴 — ADR-182 Phase 0~5] - 2026-08-16

### Features

- **대상별 통합 컨텍스트 메뉴** (ADR-182 Implemented):
  - 캔버스에서 우클릭하면 브라우저 기본 메뉴("이미지 저장 / 이미지 복사 / 검사")가 뜨던 증상 해소. 표면 4종 — 캔버스 요소(T1) / 빈 영역(T2) / 레이어 트리 행(T3, T1 재사용) / 그 외 빌더 셸(T4, 기본 메뉴 억제)
  - 요소 메뉴: 복사·붙여넣기·복제 / 맨 앞으로·앞으로·뒤로·맨 뒤로 / 그룹·그룹 해제·정렬 ▸ / 컴포넌트 만들기·원본으로 이동·인스턴스 분리 / 삭제. 조건 미충족 항목은 비활성이 아니라 **숨김** (Figma/Pen 공통 관례), 토글은 라벨 교체
  - 빈 영역 메뉴: 여기에 붙여넣기 / 화면에 맞추기 / 100% / 눈금자 표시 / 객체 스냅
  - 단축키 표기는 `formatShortcut(SHORTCUT_DEFINITIONS[id])` 파생 단일 소스 — 메뉴 내 하드코딩 0건
  - 기본 메뉴 예외: `input`/`textarea`/`contenteditable` 은 브라우저 메뉴 유지, DEV 빌드는 ⌥+우클릭으로 통과 (Inspect 편의). 눈금자 스트립은 억제하되 메뉴도 열지 않는다
- **z-order 액션 4종 + 단축키** (ADR-182 Phase 4): 맨 앞으로 `]` / 앞으로 ⌘] / 뒤로 ⌘[ / 맨 뒤로 `[`. children[] 순서가 곧 그리기 순서라 "맨 앞" 은 형제 배열의 마지막이다. 이미 그 끝이거나 형제가 하나면 no-op — 아무것도 바꾸지 않는 undo 단계를 쌓지 않는다
- **잘라내기 ⌘X**: 정의만 있고 핸들러가 없던 단축키를 연결. **복사 성공이 삭제의 전제** — 클립보드 쓰기는 권한·포커스로 조용히 실패할 수 있고, 그때 지우면 되돌릴 곳 없이 사라진다

### Bug Fixes

- **우클릭이 다중 선택을 단일 선택으로 덮어쓰던 문제**:
  - 선택 집합 안의 요소를 우클릭하면 선택이 유지되고, 밖이면 교체된다 (빈 영역은 선택 bounds 밖일 때만 해제)
  - **Why**: 우클릭 경로가 좌클릭(`resolveClickTarget` — editingContext 경계)과 다른 자체 해석을 쓰고 무조건 단일 선택으로 덮어썼다. 두 경로를 같은 심볼로 단일화
- **레이어 트리 컨텍스트 메뉴 배경이 투명하던 문제**: 미정의 토큰 `--bg-elevated`(정의 0건)를 쓰고 있었다 → `--bg-raised` 로 정정. 중복 정의됐던 CSS 2벌(`Workspace.css` ≡ `NodesPanel.css`)을 `@layer builder-system` 단일 스타일시트로 통합
- **단축키 안내가 실제 바인딩과 달랐던 문제 3건** (전부 JSX 리터럴 표기):
  - 줌 메뉴 "확대" 가 `⌘+` 로 적혀 있었으나 바인딩은 `⌘=` 다 (`+` 는 numpad 전용 `zoomInNumpad`) — 안내대로 누르면 Shift 가 붙어 동작하지 않았다
  - 다중 선택 패널의 "모두 복사"/"붙여넣기" 가 `⌘⇧C`/`⌘⇧V` 로 적혀 있었으나 그 조합은 **스타일·속성 복사**(`copyStyles`/`copyProperties`)의 것이다. 이 버튼들이 하는 일(선택 요소 전체 복사)의 단축키는 `⌘C`/`⌘V`
  - 같은 패널의 "세로 분배" 가 `Cmd+Alt+Shift+V` 로 적혀 있었으나 실제는 `⌥⇧V` (Cmd 없음)
  - **Why**: 표기가 `SHORTCUT_DEFINITIONS` 파생이 아니라 리터럴이라 정의 변경을 따라가지 못했다 (ADR-182 R4 가 지목한 표기-실바인딩 불일치)
  - 수정: 줌 메뉴 5항목 + 다중 선택 패널 11항목(shortcut-hint 3 + aria-label 8) + 도움말 푸터 1항목을 `formatShortcut(SHORTCUT_DEFINITIONS[id])` 파생으로 전환 — 위치: `workspace/ZoomControls.tsx`, `components/selection/MultiSelectStatusIndicator.tsx`, `components/help/KeyboardShortcutsHelp.tsx`

### Architecture

- **액션 오케스트레이션 공유 계층 `canvasActions`** (Phase 1.5): copy/paste/duplicate/delete/group/ungroup/align/distribute 8종의 오케스트레이션이 컴포넌트·훅 내부 클로저에 갇혀 있어 메뉴가 호출할 수 없었다. 로직 무변경 호출부 이동으로 추출하고, 단축키 등록부 2곳과 메뉴가 같은 구현을 소비한다 (elements map 은 인자 주입 — 두 read model 의 alias 를 한 어댑터 경계에서 정규화)
  - Properties 패널의 "모두 복사"/"붙여넣기"/"그룹화" 도 같은 계층을 소비하도록 통합 — 종전엔 동일 오케스트레이션을 자체 구현하고 있어서 버튼 표기가 실제 단축키와 어긋나도 드러나지 않았다 (위 Bug Fix 의 병인). 그룹화는 자체 구현이 자식의 `page_id` 를 저장하지 않아 **cross-page 선택을 그룹화하면 자식 page_id 가 옛 페이지에 남던 결함**도 함께 해소 (`createGroupFromSelection` 은 frame page 로 옮긴 값을 이미 돌려주고 있었다)
  - 정렬·분배·그룹 해제의 "되돌리기 1회" 정적 가드(`multiSelectHistoryEntry.static.test.ts`)를 옮겨간 구현(`canvasActions.ts`) 대상으로 이설 — 검사 대상이 옛 파일에 남아 계약이 실질 미검증 상태였다
- 신규 mutation `moveElementToSiblingEdge` 는 `runCanonicalMutation` 경유 (ADR-184/185 — canonical → store → rebuild → history → persist 순서와 history 기록 의무를 러너가 소유)
- 위치: `apps/builder/src/builder/components/overlay/contextMenu/*`, `workspace/canvas/contextMenu/*`, `workspace/canvas/actions/canvasActions.ts`, `stores/utils/siblingReorder.ts`

## [페이지 생성/삭제 undo 복구 — page-lifecycle entry] - 2026-08-15

### Bug Fixes

- **페이지 추가·삭제가 undo 되지 않던 문제** (ADR-185 Phase 0 gap G-1 수리):
  - `appendPageShell`/`removePageLocal` 이 history entry 를 기록하지 않아 페이지 생성·삭제 후 Cmd+Z 가 무반응 — 삭제된 페이지의 body+요소 서브트리+위치 복원 불가
  - **Why**: history 기록이 호출부 opt-in 인 구조에서 페이지 lifecycle 경로만 entry 유형 자체가 없었다 (entry 유형에 page-position/page-guide 는 있으나 생성·삭제 부재 — ADR-185 감사로 확정)
  - 수정: 신규 `page-lifecycle` entry (ADR-177 early-branch 계보) — 페이지 행 + 소속 요소 subtree (canonical 파생, lazy 미로드 포함) + auto-detach 치환쌍 + breakpoint 위치 + 활성 페이지를 한 단위로 되돌린다. history 가 페이지별 스택이라 적용이 활성 페이지를 바꾸는 entry 는 새 활성 스택으로 이관 (`migrateEntryToPage` — 이관 없이는 undo↔redo 반대 방향 도달 불가). History 패널 아이콘/라벨 ("페이지 추가/삭제 — 제목") 동반
  - live 실측: 생성 undo(제거+활성 복귀)→이관 후 redo(복원+활성 전환) / 삭제 undo(canonical 85 완전 복귀+위치 원복)→redo 재삭제→undo 재복원 / 새로고침 정합
  - 잔존: 마지막 페이지 삭제 (남는 스택 없음 — 기록 생략) / History 패널 goToIndex 경유 적용은 이관 생략 (스택 index 산술 보존)
  - 위치: `apps/builder/src/builder/stores/{history.ts, elements.ts, history/historyActions.ts}`

## [history coverage 계약 — ADR-185 Phase 0~2] - 2026-08-15

### Architecture

- **mutation 의 undo 기록 의무화 — 러너 history 스테이지 필수 union** (ADR-185 Phase 0~2 Implemented):
  - 사용자-가시 mutation 이 history entry 없이 출시되는 계열이 4회 재발 (요소 move 과거 미기록 / 복합 생성 dead saveSnapshot / ADR-181 가이드 사후 편입 / 페이지 생성·삭제 — 실패가 조용해 발견 시점이 항상 "사용자가 undo 를 눌렀는데 무반응")
  - **Why**: history 기록이 호출부별 opt-in — 순서는 ADR-184 러너가 소유했지만 기록 **존재 여부**는 무계약이었다
  - `runCanonicalMutation` 의 `history` 를 optional → **required union** (`(result) => void` 또는 `{ skip: 사유 }`) 으로 강화 — 신규 mutation 의 조용한 미기록이 타입 에러로 전환, 빈 skip 사유는 진입 시점 throw (fail-fast). 정당한 생략 (preview transient / silent live edit / preview ingress) 은 사유와 함께 1급 표현
  - Phase 0 전수 감사: ADR-184 인벤토리 26 지점 분류 (기록함 15 / 의도적 생략 5 / 비-mutation 5 / gap 1) — gap 목록은 ADR-185 breakdown §4 가 수리 백로그 정본
  - 검증: RED 4 실측 → 347 tests PASS + live undo exercise (Select 추가 → Cmd+Z 완전 원상)
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`, `.claude/rules/state-management.md`

- **Known gap (G-1) — 당일 별도 수리 완료 (위 엔트리)**: 페이지 생성/삭제는 기록 시점 undo 불가 — `appendPageShell`/`removePageLocal` (stores/elements.ts) 가 history entry 를 기록하지 않는다 (호출자 포함 0건). 수리는 ADR-185 비스코프 (사용자 결정 2026-08-15 "계약만 — 수리는 별도"), breakdown §4-2 백로그 참조

## [복합 컴포넌트 생성 undo 복구 — factories addElementsToStore] - 2026-08-15

### Bug Fixes

- **복합 컴포넌트 (Select/NumberField/Table 등) 생성이 undo 되지 않던 문제**:
  - 팔레트 복합 생성 경로 (`ComponentFactory → addElementsToStore`) 의 히스토리 기록이 구 `saveSnapshot` API 를 조건부 호출 — 해당 API 가 store 에서 소멸한 뒤 `if (saveSnapshot)` 가드가 조용히 no-op 되어 entry 가 한 번도 기록되지 않았다
  - **Why**: history 시스템이 canonical event 기반으로 전환되는 동안 이 경로만 legacy API 참조로 잔존 — ADR-184 파일럿 live 실측 중 발견된 선재 gap
  - 수정: store 측 `addComplexElement` 와 동일한 canonical insert event entry (`buildCanonicalInsertEvents` + `type: "add"` + `elementIds`) 로 기록 — 러너 history 슬롯 (canonical merge 뒤) 에서 위치 조회. dead `saveSnapshot` 회귀는 `elementCreation.indexSync.test.ts` 가 정적 차단
  - live 실측: Select 추가 (canonical 85→90 / store 77→82) → undo (85/77, elementsMap 제거) → redo (5요소 가족 복원 + mirror 등재) → undo 원복 (IndexedDB 포함 85)
  - 위치: `apps/builder/src/builder/factories/utils/elementCreation.ts`

## [canonical mutation 순서 러너 — ADR-184 Phase 0~3] - 2026-08-15

### Architecture

- **`runCanonicalMutation` — 신규 mutation 경로의 4단 순서 구조화** (ADR-184 Implemented):
  - canonical → store set → `_rebuildIndexes` → history → persist(백그라운드) 순서를 러너 (`adapters/canonical/canonicalMutationRunner.ts`) 가 소유 — 신규 mutation 은 스테이지 함수만 제공하며 set-1차 형태의 순서 위반은 시그니처상 표현 불가 (canonical required)
  - **Why**: 4단 순서가 관례 + 사후 정적 가드로만 강제되어 위반이 반복 — `createInstance` set-1차 잔존, stale-canonical race 로 origin → copy → paste 시 instance 가 일반 element 로 생성되던 사용자-가시 결함 (`a859f8b97`/`ee91020c4` 수습). 위반별 사후 가드 노동을 러너 1개 + 우회 차단 가드 1개로 수렴
  - 적용 범위는 **신규 경로 한정** — 기존 15파일 호출부는 allowlist 고정 (이관은 "회귀 위험 대비 이득 작음" 선행 판정 유지), `canonicalMutationRunner.static.test.ts` 가 allowlist 밖 wrapper 직호출을 차단 (RED 실측 검증)
  - 파일럿: 복합 컴포넌트 생성 `addElementsToStore` (기준형) 러너 전환 — live 실측 (Select 추가 → canonical/store/IndexedDB 동기 + 새로고침 정합, 동작 불변)
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutationRunner.ts`, `builder/factories/utils/elementCreation.ts`, `builder/main/BuilderCore.tsx` (bridge DI), `.claude/rules/state-management.md` (신규 경로 규칙)

## [레이아웃 explain 디버그 채널 — ADR-183 Phase 0~3] - 2026-08-15

### Infrastructure

- **엔진 판정 트레이스 + `window.__layoutExplain(elementId)` 판독 채널** (ADR-183 Implemented — dev 전용):
  - 레이아웃 엔진이 solve 시점에 갖고 있다가 기록 없이 소멸시키던 판정 7종 (증분 skip HIT/MISS·사유, used-size clamp 바인딩, §4.5 automatic minimum floor 출처, shrink-to-fit 재진입, intrinsic 측정 캐시 세대, flex item 재-solve, grid 트랙 해소) 을 런타임 게이트 트레이스로 노드 단위 기록
  - **Why**: 30일 fix 집계 engine 34·skia 33건의 공통 역추적이 "추측 + printf + 재빌드" 반복 — `.claude/rules/layout-engine.md` 의 "~로 진단 금지" 오진 이력에서 이벤트 목록을 역산해, 문서 방어를 실행 시점 판별로 이동 (예: 새로고침-정상 = AvailChanged 캐시 서명 / 무관 형제 성장 = HIT / justify-content no-op = avail "미결정" 명명)
  - off 시 판정 지점당 `Option` 분기 1회 — G1 벤치 게이트 PASS (최대 +1.57% ≤ 2%, 쌍대 비율·A/A 대조군·순서 회전 프로토콜). 배치 프로토콜 (`build_tree_batch`/binary_protocol) 무변경 — 별도 조회 API
  - 게이트는 살아 있는 트리에 켠다 (1회차 호출 = 게이트 켬 → 재현 동작 → 2회차 = 시퀀스 판독) — fresh 재계산이면 캐시 계열 오진이 사각. TS 측정 스칼라는 `[TS]` prefix 별도 줄 병기 (엔진 판정 아님)
  - 위치: `packages/composition-engine/src/{trace,tree,flex,wasm}.rs`, `apps/builder/src/builder/workspace/canvas/wasm-bindings/{compositionEngineWasm,compositionEngine,layoutBridge}.ts`, `layout/engines/{persistentTaffyTree,layoutExplain,fullTreeLayout}.ts`

## [Architecture — PixiJS Spec 계약 제거] - 2026-08-15

### Breaking Changes

- `@composition/specs`의 PixiJS 전용 계약을 제거했다: `RenderSpec.pixi`와
  `ComponentSpec.overlay.pixiLayer`를 삭제하고, `GroupSpec`/`SlotSpec`의
  placeholder `pixi()` callback도 제거했다.
- PixiJS runtime·dependency는 이미 ADR-900에서 제거된 상태이며, 이번 변경은
  남아 있던 workspace 내부 schema surface를 React/Skia Canvas 경로로 수렴한다.

### Documentation

- Codex agent/workflow 설명을 CanvasKit/Skia + DOM/WASM input 기준으로 정정했다.
- 검증: workspace source에서 `pixi`, `pixiLayer`, `render.pixi` consumer 0건,
  PixiJS package/import/runtime 초기화 0건.

### Infrastructure

- `@composition/specs` build가 public `types`/`renderers`/`primitives` subpath도
  함께 생성하도록 수정해 stale generated Pixi 계약 재노출을 막았다.

## [Styles 패널 — position 의 modify/reset 비대칭 수정] - 2026-08-15

### Bug Fixes

- **`position` 을 편집해도 "modify N" 뱃지가 세지 않던 문제 수정**:
  - **Why**: ADR-177 이 Transform 섹션에 position row 를 추가하며 `TRANSFORM_PROPS`(섹션 reset 판정 범위)에만 `"position"` 을 넣고 `PANEL_STYLE_PROPS`(modify 뱃지·Modified Styles 범위 SSOT)에는 넣지 않았다 → **reset 버튼은 활성인데 modify 는 0** 인 비대칭. 2026-06-24 grid placement 사례와 같은 형태이며, 그 재발을 막으려고 둔 `panelStylePropsUnion.static` 가드가 실제로 이것을 잡고 있었다(main 에서 red 상태였음)
  - 수정: `PANEL_STYLE_PROPS` 의 Transform 블록에 `"position"` 추가 (배열 순서도 `TRANSFORM_PROPS` 와 일치)
  - 검증: 라이브 빌더 실측 — `position: absolute` 를 준 Button 에서 Transform reset 판정 `["position"]` ↔ modify 뱃지 수정 전 `[]` / 수정 후 `["position"]` 로 비대칭 해소. 스위트 2905 passed (수정 전 1 failed)
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`

## [ADR-900 잔재 스윕 — 상시 거짓 게이트 전수 정리] - 2026-08-15

> 앞선 3건(스크롤바 world 범위 · pan 추종 · registry/culling)이 모두 "PixiJS 존재를 전제한 판정이 조용히 상시 거짓/빈 값이 된다" 는 같은 병인이었다. `container` / `getBounds` / `stage` / `Application` 을 쓰는 판정을 전수 조사해 남은 것을 정리한 결과.

### Bug Fixes

- **WebGL 컨텍스트 손실 알림이 한 번도 표시되지 않던 문제 수정**:
  - **Why**: `useCanvasSurfaceLifecycle` 이 `containerRef.current?.querySelector("canvas")` 로 캔버스를 찾아 `webglcontextlost` 리스너를 걸었는데, `SkiaCanvas` 는 `React.lazy` + `Suspense fallback={null}` 이라 effect 가 도는 시점에 캔버스가 **DOM 에 없어** 조기 반환했다. 유일한 재실행 신호 `appReady` 는 `setAppReady(true)` 가 PixiJS Application 초기화 콜백 안에만 있어 ADR-900 이후 **상시 false** — 리스너가 영영 등록되지 않았다. 그래서 `isContextLost` 가 늘 false 였고 `WorkspaceStatusIndicator` 의 "⚠️ GPU 리소스 복구 중" 이 표시된 적이 없다. 렌더 복구 자체는 `SkiaCanvas` 가 `watchContextLoss` 로 따로 하고 있어 무증상으로 남아 있었다
  - 수정: 캔버스를 소유한 층이 단일 소유자 — `SkiaCanvas` 의 `watchContextLoss` 콜백이 렌더 복구(ref)와 사용자 알림(store)을 함께 발행하고, 밖에서 DOM 조회로 거는 중복 경로를 제거. 손실 상태로 unmount 되면 플래그도 해제
  - 검증: 라이브 빌더에서 캔버스에 `webglcontextlost` 합성 dispatch → 알림 표시, `webglcontextrestored` → 해제, 이후 정상 렌더 확인. 수정 전에는 세 단계 모두 무반응
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`, `apps/builder/src/builder/workspace/canvas/hooks/{useCanvasSurfaceLifecycle,useCanvasRuntimeBootstrap}.ts`
- **성능 오버레이의 상시 0 지표 3줄 제거** (`Textures` / `Sprites` / `VRAM`):
  - **Why**: PixiJS 리소스 회계 지표라 setter 3종의 호출부가 ADR-900 이후 0건이다. 성능 계측 중에 0 이 실측값처럼 읽히는 것이 오히려 해롭다
  - 함께: 같은 필드를 읽던 `logGPUMetrics()`(호출부 0건)도 삭제. Skia 대응물이 필요하면 CanvasKit 계측을 새로 붙이고 그때 필드를 되살린다
- **`isUnifiedFlag()` 가 모든 플래그를 true 로 돌려주던 문제 수정**:
  - **Why**: `UNIFIED_ENGINE` 을 먼저 보고 true 면 즉시 반환하는 단락 평가라, `UNIFIED_ENGINE: true` 인 지금 표에 `false` 로 적힌 6개(`USE_DOM_HOVER` / `USE_DOM_CURSOR` / `USE_CAMERA_OBJECT` / `USE_HYBRID_TEXT` / `USE_CSS3_EFFECTS` / `USE_TILE_CACHE`)가 거짓말이었다. 그 6개는 소비자 0건이라 오늘은 무증상이지만, 새 소비자가 붙는 순간 표를 읽고 판단한 쪽과 동작이 갈린다
  - 수정: 단락 평가 제거 — 현행 소비자 3개는 전부 `true` 선언이라 동작은 동일하고 표만 정직해진다
  - 검증: 라이브 실측 — 거짓 플래그 **6 → 0**
- **dev 성능 프로파일러가 "요소 수: 0" 을 출력하던 문제 수정**:
  - **Why**: `gpuMetrics.elementCount` 의 writer(`updateElementCount`) 호출부가 ADR-900 이후 0건이라 상시 0 인데, `window.__composition_PROFILER` 의 `start()` / `report()` / `hotpath()` 가 모두 그 값을 읽고 있었다. 5k 요소 프레임 드랍 조사에 쓰는 화면이라 그대로 두면 해롭다
  - 수정: 삭제가 아니라 **실측 출처에 배선** — `performanceMonitor` 가 이미 canonical 순회로 재고 있던 값을 `getDocumentElementCount()` 로 공개해 단일 출처로 삼고, 죽은 store 필드(`GPUMetrics.elementCount` + `updateElementCount`)는 제거. 스냅샷은 1초 주기라 O(n) 순회를 감당한다
  - 주의: `PerformanceMetrics.elementCount`(`utils/performanceMonitor.ts`)는 같은 이름의 **별개 live 지표**다 — 미변경
  - 검증: 라이브 실측 — `takeSnapshot().elementCount` **0 → 445**

### Architecture

- **PixiJS Container 조작 경로 제거** (`ViewportController` / `useViewportControl` / `ViewportControlBridge`):
  - 유일한 호출부가 `app={null}` 하드코딩이라 Camera Container 탐색·attach 블록이 도달 불가였고, 그 잔재의 `isAttached()` 가 스크롤바 추종과 `panToPage` 를 막고 있었다 (직전 3건의 병인). 재발 방지를 위해 `PixiContainerLike` / `container` / `attach` / `detach` / `isAttached` 와 `app` / `cameraLabel` 옵션을 삭제
  - `viewportActions.test.ts` 의 "attached / unattached controller" 케이스 쌍은 해당 분기가 이미 없어 같은 경로를 돌고 있었다 (이름만 정정, 값 조합이 달라 둘 다 유지)
- **`UNIFIED_ENGINE_FLAGS` 표를 실소비자 있는 2개로 축소** (10 → 2):
  - 삭제한 8개는 전부 **소비자 0건**이었다 — `REMOVE_PIXI`(유일 소비처 `handlePixiAppInit` 가 상시 false 게이트의 출처로 밝혀져 함께 제거됨) · `USE_DOM_HOVER` · `USE_DOM_CURSOR` · `USE_CAMERA_OBJECT` · `USE_SCENE_GRAPH` · `USE_HYBRID_TEXT` · `USE_CSS3_EFFECTS` · `USE_TILE_CACHE`
  - **Why**: 전환 계획과 완료 사실은 ADR-100/900 과 본 CHANGELOG 가 기록한다. 소비자 없는 플래그로 중복 보관하면 "토글할 수 있는 것" 으로 잘못 읽힌다 — 실제로 `USE_CAMERA_OBJECT` 는 같은 날 삭제된 `viewport/Camera.ts` 를, `REMOVE_PIXI` 는 이미 사라진 PixiJS ticker 정지 경로를 가리키고 있었다. 남은 2개(`USE_RUST_LAYOUT_ENGINE` / `UNIFIED_ENGINE`)는 실소비처가 있어서 남는다
  - 함께: `false` 항목이 표에서 사라져 **단락 평가 회귀를 값 비교로는 더 이상 잡을 수 없게 됐다**(전부 true 면 결과가 같다). 소스 텍스트 가드로 대체하고, `false` 플래그가 재도입되면 값 비교가 자동으로 다시 물리도록 남겨 뒀다. 민감도 실측 — 단락 평가를 되살리면 값 비교 4건은 통과하고 소스 가드만 RED
  - 검증: 라이브 실측 — 플래그 키 2개, 두 소비처 모두 `true` 수신, WASM 레이아웃 엔트리 **640건**(실제 치수) 산출로 `USE_RUST_LAYOUT_ENGINE` 경로 생존 확인, 콘솔 에러 0
- **죽은 render-version 확인 응답 프로토콜 제거**:
  - store 렌더 버전을 PixiJS 렌더러가 확인 응답하고 그 격차로 동기화 이탈을 감지하던 구조인데 양 끝이 끊겨 있었다 — `incrementRenderVersion` 호출부 0건 → `renderVersion` 0 고정, 유일한 `syncPixiVersion` 호출부는 그 0 을 되비추는 미러 → 판정식 `0 - 0 > 2` 가 **구조상 항상 false**
  - 삭제: `renderVersion` / `lastPixiRenderVersion` / `incrementRenderVersion` / `syncPixiVersion` / `selectIsSyncMismatch` / `detectSyncMismatch`
- **`computedLayout` 채널 제거** (@pixi/layout 시대):
  - yoga 계산 결과를 스타일 패널에 넘기던 경로인데 유일한 writer `updateSelectedElementLayout` 의 호출부가 0건이라 값이 채워진 적이 없다. store action + `BaseElementProps` / `SelectedElement` 필드 + 두 곳에 중복 선언돼 있던 `ComputedLayout`(`{width?, height?}`) 인터페이스를 삭제
  - **동명 타입 주의**: `canvas/layout/engines/LayoutEngine.ts::ComputedLayout` 은 살아 있는 레이아웃 엔진 결과 타입으로 전혀 다른 것이다 (남긴 주석에 구분 명시)
- **미사용 `Camera` 클래스 삭제** (`viewport/Camera.ts`, 참조 0건):
  - ADR-900 breakdown 이 "PixiJS Container → Camera 클래스" 로 계획했으나(`USE_CAMERA_OBJECT`) 실제 구현은 `viewportState` 뮤터블 ref + `ViewportController` 로 갔다 — 목표는 달성됐고 이 파일만 남았다. `gpu/GPUBackend.ts` 와 달리 ADR 이 이득으로 채택한 보존 대상이 아니다

- **`canvas/sprites/` → `canvas/styleConversion/` 리네임**:
  - ADR-100 Phase 9 에서 PixiJS Sprite 컴포넌트(BoxSprite / TextSprite / ImageSprite / ElementSprite)가 전부 삭제되고 `styleConverter` / `paddingUtils` / `tagSpecMap` 만 남았는데 디렉터리 이름은 그대로였다 — **스프라이트가 하나도 없는 sprites 디렉터리**
  - 같은 이유로 반환 타입 4개도 `Pixi*` → `Render*` (`RenderTransform` / `RenderFillStyle` / `RenderStrokeStyle` / `RenderTextStyle`). 실제 소비처는 Skia 렌더 경로다
  - `skia/` 안으로 넣지 않은 이유: 소비처가 Skia 렌더 경로와 **레이아웃 경로 양쪽**이라 렌더러 하위에 두면 의존 방향이 뒤집힌다
  - 함께: `legacyCanvasSurfaces.static.test.ts` 의 삭제-파일 가드가 옛 경로만 검사해 디렉터리 소멸 후 공허하게 통과할 뻔한 것을 신·구 경로 병기로 보강
  - 검증: 라이브 실측 — 실행 중 빌더가 새 경로 모듈을 로드(`styleConversion/styleConverter.ts`), 번들에 `sprites` 0건, `convertStyle("#3b82f6", radius 8px)` → `0x3B82F6` / `8` 정상, 레이아웃 엔트리 640건 유지, 콘솔 에러 0
  - 참고: 아카이브 CHANGELOG·완료 ADR 의 `sprites/` 경로 언급은 **이미 삭제된 파일**(ElementSprite 등)을 가리키는 과거 기록이라 그대로 둔다
- **`cssColorToPixiHex` → `cssColorToRgbNumber`** (`utils/color/`):
  - CSS 색상을 `0xRRGGBB` 숫자로 바꾸는 기본 변환기다 — 출력은 렌더러와 무관한 RGB 숫자이고 실제 소비처도 Skia 경로다. oklch/lab/`currentColor` 해석이 필요한 상위 wrapper 는 `styleConversion/styleConverter.ts::cssColorToHex` 로, 두 계층 관계를 doc 에 명시
  - 검증: 라이브 실측 — 신 심볼 존재·구 심볼 부재, `#3b82f6` → `0x3B82F6`, `rebeccapurple` → `0x663399`, oklch wrapper 정상 동작, 콘솔 에러 0
  - **이로써 코드 심볼의 PixiJS 잔재는 0** — 남은 `pixi` 문자열은 전부 "무엇이 왜 사라졌는가" 를 적은 주석이다

### Documentation

- **사실과 다른 주석 정정** — 오진 유발 지점:
  - `selectionRenderer` — 엣지 핸들 판정은 "PixiJS 히트 영역" 이 아니라 `selection/types.ts::hitTestHandle` 의 좌표 계산이다
  - `Workspace` 비교 모드 — "iframe + PixiJS 동시 표시" → Preview iframe + Skia
  - `gpu/GPUBackend.ts` — **미배선이지만 의도된 보존** 명시. ADR-900 §Positive 가 WebGPU 전환 경로로 채택한 추상화이므로 참조 0건 grep 으로 지우면 안 된다. `CanvasKitWebGLBackend.watchContextLoss` 가 살아 있는 손실 경로의 미배선 사본이라는 점도 함께 기록
  - `BuilderCanvas` 파일 헤더 — 기능 목록에 "PixiJS Application 초기화" 가 적혀 있었다. 하지 않는 일이다
  - `SkiaCanvas` StoreRenderBridge — "PixiJS Application이 없을 때 …" 라고 적혀 조건 분기가 있는 것처럼 읽혔다. 이 effect 는 무조건 실행된다

## [뷰포트 실시간 상태 판정 — pan 중 스크롤바·panToPage 복구] - 2026-08-15

### Bug Fixes

- **캔버스 pan 중 스크롤바 위치가 실시간으로 반영되지 않던 문제 수정** (+ `panToPage` no-op):
  - **Why**: 소비자들이 "컨트롤러를 써도 되는가" 를 `ViewportController.isAttached()`(= PixiJS Container 연결 여부)로 판정했는데, ADR-900 으로 PixiJS 가 제거되어 `attach()` 호출 조건(`app?.stage`)이 성립하지 않는다 — **라이브에서 항상 false** (실측). 그래서 스크롤바는 컨트롤러의 실시간 상태 대신 React mirror 를 읽었고, mirror 는 `endPan()` 에서만 동기화되므로 **드래그하는 내내 thumb 이 제자리에 멈춰 있었다**. 같은 게이트를 쓰는 `panToPage` 와 workflow pan 은 early return 으로 **완전한 no-op** 이었다 (페이지 트리에서 페이지를 클릭해도 이동 0 — 실측)
  - 수정: 컨트롤러의 `currentState` 는 Container 유무와 무관하게 pan/zoom/setPosition 에서 갱신되므로 그 사실을 `hasLiveState()` 로 따로 표현하고, 소비자 3곳(스크롤바 metric · panToPage · workflow pan)을 이 판정으로 전환. `isAttached()` 는 남기되 오해 방지 주석 추가
  - 검증: 라이브 빌더 실측 — 앱 인스턴스에서 `isAttached false` / `hasLiveState true`. pan 제스처 중(`endPan` 전) 스크롤바 metric 이 `visibleViewport.x 241 → 511` 로 컨트롤러(−520)를 따라감 (mirror 는 −220 에 정체). `panToPage` 는 게이트 통과까지 확인 — 이후 300ms rAF 애니메이션은 백그라운드 탭에서 rAF 가 멈춰 이 환경에서 미검증
  - 위치: `apps/builder/src/builder/workspace/canvas/viewport/{ViewportController.ts,panToPage.ts}`, `apps/builder/src/builder/workspace/canvas/hooks/useWorkflowInteraction.ts`, `apps/builder/src/builder/workspace/scrollbar/viewportMetrics.ts`

## [캔버스 스크롤바 — 초기 갱신과 문서 밖 추종] - 2026-08-15

### Bug Fixes

- **로드 직후 스크롤바 thumb 이 그려지지 않던 문제 수정**:
  - **Why**: 마운트 시점에는 `containerSize` 가 아직 0 이라 metric 계산이 null 을 돌려주고 초기 `updateThumb()` 이 아무것도 그리지 못했다. 갱신 소스 3종(뷰포트 조작 · track 리사이즈 · 패널 토글)이 전부 그 **뒤의 변화**만 알려주므로 첫 pan/zoom 전까지 thumb 이 크기 0 으로 남았다
  - 수정: `viewportSyncStore`(containerSize/canvasSize) 구독 추가 — 값이 채워지는 순간 재계산. world 범위의 content 입력인 페이지 위치도 함께 구독해 페이지 추가·삭제·재배치가 뷰포트 조작 없이도 반영된다 (비교는 `pagePositionsVersion` 카운터 하나, 갱신은 rAF 합침)
  - 검증: 라이브 빌더 리로드 직후 **인터랙션 0회**에서 가로 `width 102.8px` / 세로 `height 635.5px` — 종전에는 둘 다 미설정(0)
- **문서 밖으로 pan 하면 thumb 이 계속 얇아지며 멈추던 문제 수정**:
  - **Why**: world 를 뷰포트로 **무제한 확장**해 content 밖에서는 pan 한 만큼 world 도 같이 커졌다 — `viewportStart / scrollableWorld` 가 1 에 고정돼 thumb 이 트랙 끝에 붙은 채 크기만 줄었다 (실측 뷰포트 x 12,000→20,000: thumb 190→**120**)
  - 수정: 확장을 **한 화면 분량**으로 제한하고, 그로 인해 뷰포트가 world 를 넘을 수 있게 되므로 thumb 크기는 트랙 길이로, 위치는 `[0, scrollableWorld]` 로 clamp
  - 검증: 라이브 실측 — 문서 안(x 0→10,136)은 종전대로 thumb 217 고정 · 위치 28→1,459 정상 추종. 문서 밖(x 12,000→50,000)은 thumb **192 고정** · 위치 1,512 고정 (종전 192→120 축소)
  - 위치: `apps/builder/src/builder/workspace/scrollbar/{calculateWorldBounds.ts,viewportMetrics.ts,CanvasScrollbar.tsx}`

## [캔버스 스크롤바 — 문서 전체 범위 반영] - 2026-08-15

### Bug Fixes

- **가로 스크롤바를 끝까지 끌어도 문서 대부분에 도달할 수 없던 문제 수정**:
  - **Why**: world 범위의 content 기준이 `canvasSize` 하나였는데 그 값은 **페이지 1장 크기**다 (`panToPage`/fit·fill/page layout 이 전부 그 의미로 쓴다). 문서 전체를 덮으라고 있던 "모든 요소 bounds 합집합" 단계는 `elementRegistry` 가 ADR-900 PixiJS 제거 이후 비어 있어 **no-op** 이었다. 실측(25페이지, x 0→11670): world 가 x **2903** 까지만 잡혀 thumb 이 트랙의 66%를 차지한 채 **이미 오른쪽 끝**에 붙어 있었고, 그 너머 18개 페이지는 스크롤바로 갈 수 없었다 (팬으로 가면 world 가 뒤따라 늘어나며 thumb 크기가 계속 변했다)
  - 수정: content 기준을 **아트보드(페이지/프레임) rect 합집합**으로 교체. 요소 단위 합집합을 되살리지 않은 이유 — 요소는 페이지 안에 있어 커버리지 이득이 없고, 스크롤바 metric 은 자주 계산되는데 요소 전수 순회는 그만큼 비싸다. frame 편집 모드는 캔버스가 페이지를 비우므로 대상도 프레임으로 갈린다
  - 함께: 이 단계가 사라져 `getRegisteredElementIds` 가 참조 0건이 되어 `elementRegistry` Container Map·`getElementBounds`·`getElementBoundsSimple` 의 죽은 fallback 까지 정리됐다
  - 검증: 라이브 빌더 실측 — world maxX **2903 → 11870**(문서 오른쪽 11670 + padding), thumb **66% → 23%**(뷰포트 2890 / world 12070 정합)이고 더는 오른쪽 끝에 붙어 있지 않다. 회귀 5건은 25페이지 시나리오 포함
  - 위치: `apps/builder/src/builder/workspace/scrollbar/{calculateWorldBounds.ts,viewportMetrics.ts}`, `apps/builder/src/builder/workspace/canvas/elementRegistry.ts`

## [Canvas — PixiJS 시대 registry·culling 잔재 제거] - 2026-08-15

### Architecture

- **도달 불가 상태로 남아 있던 viewport culling 경로와 element registry 죽은 심볼 제거**:
  - **Why**: `useViewportCulling` ↔ `cullingCache` 는 서로만 참조하는 닫힌 루프로 앱 어디서도 import 되지 않았다(라이브 컬링은 `executeRenderCommands` 의 AABB 경로 — canvas-rendering.md §8). `elementRegistry` 의 PixiJS Container Map 은 유일한 writer 였던 `registerElement` 의 호출부가 0건이라 **라이브에서 항상 비어 있었다**(실측 `getRegistrySize() === 0`)
  - 삭제: `hooks/useViewportCulling.ts`, `scene/cullingCache.ts` 파일 2개 + `registerElement` / `unregisterElement` / `getElementContainer` / `getRegistrySize` / `logRegistryStats` 심볼 5개
  - **존치**: `findElementAtPosition` — ADR-027(Status: Partial, Phase D 미구현) 설계표가 명시하는 표면이라 sweep 대상에서 제외하고 그 근거를 코드 주석으로 고정
  - **남는 관찰**: `getRegisteredElementIds` 는 살아 있는 호출부(`scrollbar/calculateWorldBounds.ts`)가 있으나 Map 이 비어 있어 "모든 요소 bounds 합집합" 단계가 no-op 이다 — 증상은 그 다음 viewport 확장 단계가 가린다. scrollbar world 범위의 동작 변경이라 별도 판단으로 남김
  - 검증: 라이브 빌더 재로드 — 25페이지 정상 렌더 · 스크롤바 정상 · 콘솔 에러 0. canvas 스위트 전건 PASS + type-check --force PASS
  - 위치: `apps/builder/src/builder/workspace/canvas/{elementRegistry.ts,scene/index.ts}`

## [Canvas 캐시 정리 — 페이지 layout 캐시 liveness 정리] - 2026-08-15

### Performance

- **삭제된 페이지·전환한 프로젝트의 layout 캐시 엔트리가 세션 내내 남던 문제 수정**:
  - **Why**: `pageLayoutCache` 는 페이지당 `fullTreeLayoutMap`(요소당 ComputedLayout) + filteredChildIdsMap + syntheticElementsMap 을 들고 있는데 제거 경로가 없었다. `useLayoutPublisher` 는 발행 맵에 대해서만 stale key 정리를 하고 있었다
  - 수정: 같은 liveness 로 `prunePageLayoutCache(activeLayoutCacheKeys)` 실행. **LRU 상한이 아니라 liveness** — 캔버스는 여러 페이지를 동시에 그리므로 상한을 두면 가시 페이지 수를 넘는 순간 프레임마다 퇴거·재계산이 돈다. 발행 키(frame mirror id 포함)와 캐시 키가 다르므로 `getPageLayoutCacheKey` 를 캐시 쪽에서 노출해 한 곳에서만 만든다
  - 검증: 라이브 빌더 20페이지 문서 — 전 페이지가 레이아웃 유지 (가시 페이지 퇴거 0), 콘솔 에러 0
  - 위치: `apps/builder/src/builder/workspace/canvas/{scene/layoutCache.ts,hooks/useLayoutPublisher.ts}`
- **projection content signature 가 layout 변경마다 헛돌던 문제 수정**:
  - **Why**: 시그니처 memo 의 dep 에 `layoutVersion` 이 있었으나 memo 본문은 이를 읽지 않는다. 시그니처는 구조만 직렬화하고 기하는 담지 않으므로(canvas-rendering.md §9), 요소 없이 layoutVersion 만 오르는 경우(테마 토글 · 폰트 로드 · 컨테이너 리사이즈) **같은 문자열**을 다시 만들었다 — 전 elements `stableSerialize` 는 이 memo 를 분리한 이유 자체다
  - 수정: dep 에서 제거. scene 재빌드는 `sceneStructureSnapshot` 이 여전히 `layoutVersion` 을 dep + 인자로 들고 있어 그대로 실행한다
  - 위치: `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`

## [드롭 타깃 — catalog containerStyles fallback 복구] - 2026-08-15

### Bug Fixes

- **드롭 인디케이터가 컨테이너의 방향·여백을 무시하던 문제 수정**:
  - **Why**: `dropTargetResolver` 는 inline style 이 없을 때 `getSpecForTag(type).containerStyles` 를 기본값으로 읽었는데, ADR-142 cutover 이후 `TAG_SPEC_MAP` 에는 잔존 spec 3개(Frame/Group/Slot)만 남고 그중 어느 것도 `containerStyles` 를 갖지 않는다 — 일반 컴포넌트에서 이 fallback 은 **항상 undefined** 였다. 방향을 catalog 에만 둔 Breadcrumbs(`flexDirection: row`)가 세로로 판정돼 삽입 라인이 반대 축에 그려졌고, 여백을 catalog 에만 둔 ListBox/Tree/TagGroup 은 padding·gap 이 0 으로 계산됐다. 같은 파일이 `display`/`flexDirection`/`justifyContent` 에는 이미 fallback 을 적용하고 있었으므로 의도 자체는 있었고 **출처만 죽어 있었다**
  - 수정: catalog rule 의 `containerStyles`(top-level / structure / structure.composition 3 선언 위치 병합)를 type 별 메모이즈로 읽는 `resolveCatalogContainerStyles` 를 추가하고 resolver 가 이를 경유. padding/gap 도 같은 fallback 을 타도록 `readContainerSpacing` 으로 단일화 — 값이 TokenRef(`{spacing.xs}`)면 숫자 파서 전에 해석한다
  - 부수 효과: 방향/여백을 catalog 에만 둔 컨테이너(Breadcrumbs/Menu/Toolbar/Tabs/TagGroup/Tree)가 이제 드롭 대상으로 인식된다 — 종전에는 body 로 흘렀다. ListBox/GridList 의 item 정책(`isSlotCandidateAllowed`)은 그대로다
  - 검증: 라이브 빌더 실측 — 구 경로 `getSpecForTag(t)?.containerStyles` 는 Breadcrumbs/Toolbar/Tree/TagGroup/ListBox 전부 `null`, 신규 경로는 각각의 catalog 값 반환. 회귀 2건(Breadcrumbs 축 / Tree 삽입 라인)은 fallback 을 끄면 RED
  - 위치: `apps/builder/src/builder/workspace/canvas/{selection/dropTargetResolver.ts,layout/engines/implicitStyles.ts}`

## [Canvas/Skia 성능 기준 — native refresh cadence 정렬] - 2026-08-15

### Architecture

- `60fps`를 Canvas/Skia의 목표 상한으로 사용하지 않고, native display refresh cadence를 목표로 재정의했다.
- 60Hz 환경의 p95 frame time은 호환성 최소선으로 유지하며, 성능 판정은 frame time p50/p95/p99를 우선한다.
- FPS 측정 전 초기값을 60으로 가장하지 않고, 실제 rAF 관측값의 고주사율(예: 120Hz)을 clamp 없이 보존한다.
- 개발 profiler와 performance checklist의 문구를 목표·최소선·미측정 상태로 구분했다.
- 위치: `apps/builder/src/builder/workspace/canvas/utils/gpuProfilerCore.ts`, `apps/builder/src/builder/utils/performanceMonitor.ts`, `.agents/skills/composition-patterns/rules/perf-checklist.md`
- 검증: native refresh FPS 변환 회귀 테스트 및 performance monitor static contract 추가.

## [Skia 이미지 캐시 — 참조 중 SkImage 강제 퇴거 제거] - 2026-08-15

### Bug Fixes

- **서로 다른 이미지가 100개를 넘는 문서에서 캔버스가 크래시하던 문제 수정**:
  - **Why**: `evictLRU`가 미참조 후보를 못 찾으면 **가장 오래된 엔트리를 강제 퇴거**했다. SkImage 는 `SkiaNodeData.image.skImage` 에 핸들로 저장돼 다음 프레임에도 그려지므로, 삭제된 핸들에 `.width()` 를 부르는 순간 WASM 이 죽는다. 게다가 `releaseSkImage` 가 refCount 0 에서 즉시 폐기해 **후보 풀이 항상 비어 있었고**, 그래서 상한을 넘는 순간부터 살아 있는 이미지가 매번 하나씩 파괴됐다
  - 수정: 퇴거 대상을 미참조(refCount 0) 엔트리로 한정하고, 후보가 없으면 퇴거를 건너뛴 뒤 상한 초과를 1회 경고한다. `releaseSkImage` 는 엔트리를 캐시에 남겨 퇴거 후보로 만든다
  - 함께: 퇴거 시 `.delete()` 를 지연 큐(`scheduleWasmDisposal`) 경유로 변경 — 퇴거는 비동기 로드 완료 안에서도 일어나 프레임의 record 와 flush 사이에 낄 수 있고, 이미 제출된 이미지를 flush 전에 파괴하면 그 draw 가 소실된다. 참조를 소유하지 않고 핸들만 싣는 경로(specShapeConverter)를 위해 렌더러가 폐기 핸들을 만나면 placeholder 로 떨어진다
  - 검증: 라이브 빌더 실측 — 실제 CanvasKit 에 서로 다른 PNG 101개 로드 시 `cacheSize 101` / 최초 이미지 생존(`width() === 4`) / 경고 1회. release 후 102번째 로드에서 그 엔트리만 퇴거되고 폐기는 drain 까지 지연(`pendingDisposal 1`), 나머지 참조 이미지 생존. 회귀 3건은 구 동작 복원 시 전부 RED
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{imageCache.ts,nodeRendererImage.ts}`

## [Canvas pointer/hit lifecycle — element owner 및 stale SpatialIndex 정리] - 2026-08-15

### Bug Fixes

- **요소 pointer 세션과 Skia hit index가 이전 입력/프레임을 영구 보유하던 문제 수정**:
  - **Why**: `endPointer()`가 pan 분기에서만 호출되어 element owner의 `activePointerId`가 pointerup 뒤에도 남았고, SpatialIndex `batchUpdate`는 이전 snapshot에만 있던 ID를 제거하지 않았다
  - 수정: 중앙 pointer handler가 element owner의 pointerup/pointercancel을 직접 종료하고, SpatialIndex batch snapshot이 생략된 ID를 WASM index와 mapper에서 제거하도록 변경
  - 검증: element pointerup/pointercancel lifecycle 및 stale/empty snapshot 회귀 테스트
  - 위치: `apps/builder/src/builder/workspace/canvas/{hooks/useCentralCanvasPointerHandlers.ts,wasm-bindings/spatialIndex.ts}`

## [Canvas 휠 라우팅 — overflow longhand·catalog 해석] - 2026-08-15

### Bug Fixes

- **선택된 overflow 컨테이너가 휠 스크롤되지 않던 문제 수정**:
  - **Why**: 선택 기반 휠 라우팅이 `style.overflow` shorthand 만 읽어, store 가 longhand(`overflowX`/`overflowY`)로 저장한 값과 catalog `containerStyles` 에만 overflow 를 둔 컬렉션 컨테이너(ListBox 등)가 미해석 → 전부 뷰포트 팬으로 흘렀다
  - 수정: `resolveEffectiveOverflow(node.type, style)` 경유로 shorthand + longhand + catalog 를 함께 해석
  - **미변경(사양)**: 캔버스 휠 스크롤은 대상이 **선택된 상태에서만** 동작한다. 포인터를 올려두는 것만으로는 스크롤되지 않으며, viewport handler 가 containerEl 의 capture 소유자로 남는다. 이를 "hover 경로를 삼키는 버그" 로 보고 위상을 맞바꾼 변경은 되돌렸다 — 사용자 가시 동작은 동일한 채 의도치 않은 hover 스크롤만 무장시켰다
  - 검증: 라이브 빌더 실측 — 동일 좌표·동일 휠에서 미선택 `scrollTop 0→0`(뷰포트 팬) / page body 선택 `0→200`. 계약은 `useViewportControl.wheelRouting.static.test.ts` 가 고정
  - 위치: `apps/builder/src/builder/workspace/canvas/viewport/useViewportControl.ts`

## [Skia mask layer LIFO — DstIn 합성 대상 정정] - 2026-08-15

### Bug Fixes

- **mask-image가 effects/blend/drag 레이어 조합에서 부모 layer를 오염시키던 문제 수정**:
  - **Why**: END가 effects/blend restore를 먼저 수행해 최상단 mask layer를 먼저 닫았고, 이후 mask 합성을 바깥 layer에서 실행했다. 기존 offscreen callback도 비어 있어 실제 content를 mask shader에 공급하지 못했다
  - 수정: mask layer에서 먼저 DstIn 합성 후 restore하고, effects → blend → drag alpha → element save 순으로 LIFO 복원. alpha mask는 native DstIn, luminance mask는 단일 child RuntimeEffect로 변환
  - 검증: alpha/luminance 합성 계약 + blend/effect/mask command 순서 회귀 테스트, Skia 관련 테스트 및 `codex:typecheck`
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererMask.ts,renderCommands.ts}`

## [Skia clip save/restore 대칭 — zero-size overflow 컨테이너] - 2026-08-15

### Bug Fixes

- **zero-size `clipChildren` 컨테이너가 이후 Canvas 렌더링의 save 스택을 손상시키던 문제 수정**:
  - **Why**: `CMD_CHILDREN_BEGIN`은 양수 크기에서만 clip save를 열었지만 `CMD_CHILDREN_END`는 `clipChildren`만 보고 무조건 restore해 부모 element save까지 제거할 수 있었다
  - 수정: command 생성 시 BEGIN과 동일한 clip 조건을 `hasClip`으로 기록하고 END에서 해당 플래그만 restore
  - 검증: zero-width clipping owner의 save/restore 균형 회귀 테스트 + Skia 관련 27 tests + `codex:typecheck` + `codex:preflight`
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`

## [기본 폰트 fallback 체인 정정 — monospace 오타 제거] - 2026-08-15

### Bug Fixes

- **기본 폰트 스택 중간의 `monospace` 오타 제거** (simplify 관찰 후속):
  - body 기본값·root computed 기본·export 기본 body 의 fallback 체인이 `"Pretendard", "Inter Variable", monospace, system-ui, sans-serif` — Pretendard/Inter Variable 이 모두 로드되지 않는 환경에서 본문이 고정폭으로 떨어지는 잠복 결함
  - **Why**: `cc9c4ca3f`(2026-04-07 TextSpec size preset)가 `createDefaultBodyProps()` 의 `DEFAULT_FONT_FAMILY` 를 리터럴로 치환하며 끼어든 오타 (커밋 메시지에 관련 언급 0, DOM 정본 `DEFAULT_BASE_TYPOGRAPHY` 와도 불일치) — 이후 2곳으로 복제
  - 수정: 3곳 리터럴에서 `monospace` 만 제거 (기존 문서에 저장된 체인은 Pretendard 로드 시 monospace 미도달 — migration 불요)
  - 검증: 라이브 모듈 직접 실행 — `createDefaultBodyProps()`/`ROOT_COMPUTED_STYLE` 양쪽 monospace 부재 확인
  - 위치: `apps/builder/src/types/builder/unified.types.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/cssResolver.ts`, `packages/shared/src/utils/export.utils.ts`

## [이미지 placeholder dark mode 정합 — theme-bypass 리터럴 정리] - 2026-08-14

### Bug Fixes

- **Image 요소의 사용자 지정 배경을 캔버스(Skia)만 무시했다** (simplify 관찰 후속 `/fix`):
  - Style 패널 Background(fills)를 설정해도 Preview(DOM)에만 배경이 보이고 캔버스는 미표시 — `object-fit: contain/none` 여백(letterbox)·투명 PNG 에서 가시적 발산
  - **Why**: 사용자 배경 채널 2개가 모두 image 경로에 미배선 — ① canonical `fills`(현행 Style 패널 경로, box 경로는 `fillsToSkiaFillColor` 소비하는데 `buildImageNodeData` 는 미소비) ② legacy `style.background(-Color)`(`converted.fill` 로 변환돼 오지만 버려짐). 더해서 렌더러(`renderImage`)가 skImage 로드 경로에서 배경 rect 자체를 그리지 않았다. DOM oracle 은 `.react-aria-Image` 기본 배경 + `fillsToCssBackgroundStyle` merge + inline style spread — 배경이 이미지 **뒤** 레이어
  - 수정: builder 는 fills → solid style bg → catalog placeholder 토큰 우선순위로 `box.fillColor` 산출 (buildBoxNodeData 동일 어법 — opacity effect 이중 적용 방지, gradient/url 문자열은 토큰 fallback), 렌더러는 로드 경로에서 `drawImageRect` 전에 배경 rect (transparent alpha 0 은 skip, radius clip 승계)
  - 검증: 라이브 — Image(contain, 1×1 이미지) + `updateSelectedFills` 빨강 → Skia `box.fillColor [1,0,0,1]` probe + 캔버스 스크린샷에서 letterbox 좌우 빨강 확인 (undo 원복). 계약 테스트 12건 (fills 우선/legacy style/opacity 분리/transparent/gradient fallback/렌더 순서)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{buildImageNodeData.ts,nodeRendererImage.ts}`

- **이미지 placeholder 배경이 dark mode 에서 light 회색으로 남았다** (simplify 보류 항목 후속):
  - Image/Avatar/Logo/Thumbnail 의 미로드 placeholder 배경이 `#e5e7eb` 리터럴 고정이라 theme 를 무시했다
  - **Why**: `buildImageNodeData` 가 theme 입력 자체가 없어 catalog fill 토큰(`{color.neutral-subtle}` — DOM `Image.css` 의 `var(--bg-muted)` 대응)을 해석할 수 없었다
  - 수정: `resolveSkiaVisualRule` 로 catalog fill base 를 얻어 `resolveColor(token, theme)` 해석 (light `#e5e5e5` / dark `#404040`). catalog 미보유 태그(Logo/Thumbnail)는 동일 토큰 fallback
  - 검증: 라이브 dark 토글 왕복 — placeholder fillColor `#e5e5e5 → #404040 → #e5e5e5` 실측 (`__composition_SKIA_DEBUG__` probe)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{buildImageNodeData.ts,StoreRenderBridge.ts}`

- **disabled 요소의 dim 이 컴포넌트별 catalog 값을 무시하고 0.38 일괄이었다** (simplify 보류 항목 후속):
  - 캔버스에서 disabled 컴포넌트 전부가 opacity 0.38 로 dim — Breadcrumbs 는 DOM 이 `[data-disabled] { opacity: 1 }` (dim 없음, 톤 변화로만 표현) 인데 Skia 만 흐려졌다
  - **Why**: `buildSpecNodeData` 의 disabled 분기가 spec(`spec.states.disabled.opacity`)만 읽었는데, ADR-142 이후 잔존 spec 은 3개뿐이라 catalog 컴포넌트 전부가 0.38 리터럴 fallback 으로 떨어졌다. catalog `structure.states.disabled.opacity` 는 60개 컴포넌트에 존재 (Breadcrumbs=1, 문자열 `"0.38"` 4건 혼재)
  - 수정: spec → catalog rule → 0.38 순 fallback + 문자열 coerce + opacity ≥ 1 이면 effect 미부착 (불필요 save layer 회피)
  - 검증: 라이브 Button isDisabled 토글 왕복 (effects `null → [{opacity, 0.38}] → null`) + 회귀 테스트 3건 (Button 0.38 / Breadcrumbs 미부착 / Select 문자열 coerce)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`

- **기본 폰트 텍스트의 측정↔렌더 폰트 발산** (simplify 보류 항목 후속):
  - fontFamily 미지정 spec 텍스트가 측정은 Pretendard, 렌더는 Inter 로 갈라져 폭·줄바꿈 위치가 미세하게 어긋날 수 있었다 (canvas-rendering §3 "측정기와 렌더러가 동일한 배열" 위반)
  - **Why**: 기본값 리터럴이 4곳에 제각각 — 렌더러(`specShapeConverter`)만 `"Inter"`/`["Inter","system-ui","sans-serif"]`, 측정기 2곳(`specBuildHelpers`/`canvaskitTextMeasurer`)은 `"Pretendard"`. DOM 정본(`DEFAULT_BASE_TYPOGRAPHY`)은 Pretendard 선두
  - 수정: `customFonts.ts` 에 `CANVAS_FONT_FALLBACK_FAMILIES`(Pretendard 선두) 단일 소스 신설, 4곳 + 이미지 altText 2곳이 공유. 렌더 기본이 Inter → Pretendard 로 정렬 (D3 DOM 대칭)
  - 검증: 라이브 전수 probe — 텍스트 노드 43개 중 Inter 선두 체인 0건
  - 위치: `apps/builder/src/builder/{fonts/customFonts.ts,workspace/canvas/skia/{specShapeConverter,specBuildHelpers,nodeRendererImage}.ts,workspace/canvas/utils/canvaskitTextMeasurer.ts}`

### Architecture

- **box 경로의 도달 불가 collection item 리터럴 분기 제거**:
  - `buildBoxNodeData` 의 `isCollectionItem` 분기(카드 배경 `0.98` 근백색 / 테두리 `0.83` 연회색 / borderRadius 8 / strokeWidth 1 강제)와 `StoreRenderBridge` 의 `COLLECTION_ITEM_TAGS` 삭제
  - **Why**: 대상 태그(GridListItem/ListBoxItem)가 catalog cutover 상수라 `isSpecPath` 게이트를 항상 통과 — box fallback 분기에 도달 불가. theme-bypass 리터럴로 지목됐으나 실측 결과 죽은 코드였다

- **InlineAlert 자식 font 위임을 bridge 라우팅에서 resolver 층으로 이관** (simplify 보류 항목 후속):
  - `StoreRenderBridge` 요소 라우팅 함수 안에 인라인이던 InlineAlert → Heading/Description font 위임(heading/desc fontSize·fontWeight 4필드 read-through)을 `buildSpecNodeData` 의 `resolveInlineAlertChildFont` resolver 로 이동
  - **Why**: 부모→자식 위임의 거처는 propagation registry 또는 buildSpecNodeData resolver 층 둘인데 InlineAlert 만 세 번째 층(bridge)에 살아 신규 위임 추가 시 거처 자체가 모호했다. registry rule 화는 기각 — Inspector 가 자식 store style 에 기록해 시스템 주입이 "사용자 수정" 으로 읽히는 축이 열림 (렌더 시점 주입 의미 보존). 구 근거 "spec/text 양쪽 경로 lift-up"(ADR-058 P2)은 buildTextNodeData 폐지로 소멸
  - 검증: 라이브 lg InlineAlert 생성 → Heading 18/700 · Description 16/400 (자체 기본 16/14 와 구분되는 위임값) 실측 후 undo 복원 + 회귀 테스트 (lg 위임 + 사용자 style.fontSize 우선)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{StoreRenderBridge.ts,buildSpecNodeData.ts}`

- **`.button-base` membership 3벌 손 미러 → catalog 단일 선언** (simplify 보류 항목 후속):
  - preview `BUTTON_BASE_TYPES` / Skia `BUTTON_BASE_PARENT_TAGS` 두 로컬 Set("신규 추가 시 동시 갱신" 주석 의존) 삭제 — shared `usesButtonBaseUtility()` 가 catalog `structure.cssEmitMode === "button-base"`(Button/ToggleButton) + 신설 `structure.buttonBase`(ToggleButtonGroup — emit 은 direct, utility 착용만) 에서 파생
  - **Why**: 동일 membership 이 3곳(generate-css 는 이미 catalog 읽음 + 미러 2벌)에 있어 누락 시 신규 button-base 컴포넌트의 자식 색 상속이 Skia 에서만 조용히 빠지는 구조. 미러 주석의 "STRUCTURE_META 와 1:1" 은 ADR-912 Phase 2(generator-local Map 삭제) 이후 stale — ToggleButtonGroup 은 catalog cssEmitMode 에 없어 이미 3벌이 발산해 있었다
  - 검증: membership 계약 테스트 신설(정확히 3개 잠금) + 라이브 Button(primary) 자식 Text 상속 색 white 유지, variant 토글 재빌드 2회 정상
  - 위치: `packages/shared/src/{types/composition-document.types.ts,catalog/{generated/componentRulesTable.ts,resolvers/resolveComponentRule.ts}}`, `apps/builder/src/{preview/utils/specCatalogBacked.ts,builder/workspace/canvas/skia/buildSpecNodeData.ts}`

- **Slider/TagGroup 수동 전파 resolver 삭제 — registry 단일 메커니즘으로 통합** (simplify 보류 항목 후속):
  - `buildSpecNodeData` 의 `resolveSliderProps` / `resolveTagGroupAllowsRemoving` / `resolveTagListItemsFromParent` 3개 삭제 (−140줄)
  - **Why**: 같은 함수 안의 `applyParentPropagationProps`(registry 일반 경로)가 동일 규칙(`sliderPropagationRules` value/minValue/maxValue → SliderTrack, `tagGroupPropagationRules` items/variant/size/maxRows/allowsRemoving → TagList)을 이미 적용한 뒤 resolver 가 재수행하는 이중 구현이었다. Slider 기본값(50/0/100)은 소비처 `slider_fill_bar` escape 내장값과 동일, variant 전파는 Slider catalog `variants:{}` + SliderTrack default 단일 variant 라 사어
  - registry 보강: `tagGroupPropagationRules` 에 중첩 childPath `["TagList","Tag"]` allowsRemoving 규칙 추가 — string `"Tag"` 는 직계만 매칭이라 factory 트리(TagGroup > TagList > Tag)에서 dead 였고, Skia 레이어 우회 resolver 가 그 구멍을 메우고 있었다 (Slider `["SliderTrack","SliderThumb"]` 선례)
  - 검증: 라이브 Slider 생성 → fill bar 60=200×30% → value 70 편집 → 140=200×70% 실측 후 undo 복원. 회귀 테스트 3건 (Slider value 전파 / Tag 손자 remove X / 미설정 시 X 없음)
  - 위치: `apps/builder/src/builder/{workspace/canvas/skia/buildSpecNodeData.ts,utils/propagationRegistry.ts}`

### Performance

- **오버레이 라벨 Font 를 (fontMgr, weight) 키 캐시로 — 프레임당 WASM Font 생성/삭제 제거** (simplify 효율 항목 후속):
  - 오버레이 라벨 6곳(치수/페이지 타이틀/collection remainder/스냅 배지/workflow ×2)이 호출마다 `matchFamilyStyle`(1–6회 WASM) + `new ck.Font()` 생성 → 프레임 끝 delete 반복 — 팬 1초 기준 Font 생성/삭제 ≈ 360회/초
  - 수정: `acquireOverlayFont` 신설 — weight 축은 Normal/Medium 2종뿐이라 (fontMgr 참조, weight) 당 Font 1개 유지 + zoom 종속 크기는 `setSize` 로 갱신. fontMgr 교체는 참조 비교로 전체 재구축. workflow 2곳의 bare `matchFamilyStyle("Pretendard")`(Variable 명 로드 시 라벨 조용히 소실)도 공용 fallback 체인으로 정합
  - 검증: 캐시 계약 테스트 4건 (인스턴스 재사용/weight 분리/fontMgr 교체 재구축/미해소 미캐시) + skia 스위트 241 PASS. 라이브 스크린샷 — 페이지 타이틀(Normal+활성 Medium)·치수 라벨 정상, 콘솔 오류 0
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{selectionRenderer,slotMarkerRenderer,snapGuideRenderer,workflowRenderer}.ts`

- **빈 슬롯 해치 판정의 프레임당 elementsMap 전수 스캔 제거** (simplify 효율 항목 후속):
  - `hasVisibleSlotContent` 의 폴백이 빈 슬롯 하나당 `elementsMap.values()` 전수 순회 — hatch 대상은 정의상 빈 슬롯이라 매칭 없이 항상 끝까지 돌아 빈 슬롯 E × 요소 N 이 비-idle 프레임(팬/줌/드래그)마다 반복 (5k 문서 기준 ~0.3–0.5ms/프레임 추정)
  - 수정: elementsMap **참조**를 키로 한 "자식 보유 parent_id 집합" 역인덱스 캐시 (`getCachedOverflowInfoMap` 참조-키 어법) — 슬롯당 O(1) 조회. 폴백 자체는 보존 — childrenMap 이 layout-filtered 소스(`getSharedFilteredChildrenMap`)일 때 layout 제외 자식을 놓치는 간극을 메우는 load-bearing 경로
  - 검증: 기존 slot marker 테스트 31건(스캔 의존 fixture 포함) 판정 동등 PASS + 캐시 계약 테스트 2건 신설. 라이브 스크린샷 — 빈 슬롯 해치 정상 / 채워진 슬롯 해치 없음 / 콘솔 오류 0
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.ts`

## [캔버스 월드 격자 제거 — Settings 패널 정리] - 2026-08-14

### Breaking Changes

- **Settings 패널의 Show Grid / Snap to Grid / Grid Size 3개 제거** (2026-08-14 사용자 요청 — "의미가 있나? 체크해줘"):
  - store 필드 `showGrid` / `snapToGrid` / `gridSize` 와 setter 3종 삭제. 남는 캔버스 설정은 **Show Rulers + Snap to Objects** 둘
  - 섹션명 `Grid & Guides` → `Rulers & Guides`
  - **Why — 맞출 대상이 없었다**: 격자는 scene 원점 기준 **월드 격자**인데, 페이지 안 요소 좌표는 레이아웃 엔진 소유라 격자와 무관하다. 격자가 기준이 될 수 있는 유일한 대상은 페이지(아트보드) 위치인데, 자동 배치 간격이 **470px**(페이지 390 + 여백 80)이라 8/16/24 어느 쪽과도 안 떨어진다 — 라이브 실측 8개 페이지 중 8px 격자 위에 놓인 것은 **3개**, 16px 은 1개, 24px 은 1개. 켜도 아트보드가 격자에 얹히지 않았다
  - **Snap to Grid 는 페이지 드래그 한 곳에만 걸려 있었다** (`usePageDrag`) — 요소에는 적용되지 않고 될 수도 없다(자유 배치가 아님). 페이지에 걸면 위 470 간격을 8의 배수로 반올림해 자동 배치를 깨뜨렸고, 우선순위상 객체 스냅이 먼저 잡아 실제 동작도 드물었다
  - **배경 격자는 이미 따로 있었다** — `DotBackground` 가 16 scene px 점 배경을 상시 그린다. Show Grid 는 그 위에 얹는 **두 번째 격자**였고, gridSize 8/24 에서는 간격이 다른 두 격자가 겹쳐 보였다
  - 대체 수단: 정렬은 `Snap to Objects`(ADR-179, 페이지 간 6축 흡착 + 정렬선) + 수동 가이드(ADR-181), 배경 텍스처는 `DotBackground`
  - 위치: `apps/builder/src/builder/{panels/settings/SettingsPanel.tsx,stores/canvasSettings.ts,workspace/canvas/hooks/usePageDrag.ts}`

### Architecture

- **격자 제거로 드러난 죽은 코드 정리**:
  - `skia/gridRenderer.ts` **삭제** — 유일 호출자(`skiaFramePlan` 의 `buildGridScreenOverlayNode`)와 함께. 내부에 도달 불가 분기도 있었다: `if (zoom > 2) return baseSize/2; if (zoom > 4) return baseSize/4` 에서 뒤 줄은 앞 줄이 항상 먼저 잡았고, 함수 주석이 약속한 "gridSize 의 정수 배수" 와 달리 `/2`·`/4` 는 약수라 **줌 200% 초과에서 표시선의 절반이 snap 위치가 아니었다**. `GridRenderOptions.showSnapGrid` / `snapSize` 도 전달자가 없어 점 격자 루프가 통째로 죽어 있었다
  - `workspace/canvas/grid/index.ts` **삭제** — `ZOOM_PRESETS` / `DEFAULT_GRID_SIZE` / `DEFAULT_SNAP_SIZE` 3개 상수 전부 소비처 0 (재export 경로만 존재)
  - `canvasStore.ts` 의 `useCanvasGridSettings` / `useCanvasSetGridSettings` 제거 — `stores/index.ts` · `workspace/index.ts` 재export 외 소비처 0
  - `invalidationPacket` 의 grid sub-packet 제거 (`RendererGridInvalidation*`, `buildGridSignature`)
  - **잔여 2건은 분리**: `skiaOverlayHelpers.buildGridRenderInput` 과 `SkiaRenderer` 의 `screenOverlayNode` 슬롯(격자가 유일 공급자였다). 해당 파일들이 다른 작업으로 편집 중이라 이번 커밋에서 뺐고, packet 에는 상수 시그니처 tombstone 을 남겨 소비처가 무효화를 유발하지 않게 했다

## [눈금자 + 수동 가이드 — ADR-181 Phase 0~7] - 2026-08-14

### Bug Fixes

- **눈금자와 가이드의 축이 반대였다** (ADR-181 후속, 2026-08-14 사용자 지적):
  - 위쪽(가로) 자에서 끌어내리면 **세로** 가이드가 나왔다. Figma·Photoshop·Illustrator·Sketch 는 모두 **자와 나란한** 선을 준다 (은유 = "눈금자 자체를 캔버스로 끌어당긴다")
  - **Why**: 도입 때 "자가 재는 축과 직교" 로 잡았다 — 가로 자는 x 를 재니 x 를 고정하는 세로선, 이라는 논리. 그럴듯하지만 **끄는 방향과 선이 반응하는 축이 어긋난다**: 위쪽 자를 아래로 끄는 내내 세로선은 x 로만 정해지므로 꿈쩍도 하지 않았다
  - **커서도 같이 뒤집혔다** — 스트립 커서가 CSS 에 하드코딩돼 있어(`.ruler-strip--h { cursor: col-resize }`) 축만 고치면 "커서는 좌우인데 끌면 위아래로 나오는" 어긋남이 남았다. 이제 `guideCursorForAxis(guideAxisForRulerStrip(...))` 로 **축 매핑에서 파생**한다 (캔버스의 기존 가이드 hover 커서와도 같은 함수)
  - 매핑을 `guideAxisForRulerStrip()` 순수 함수로 분리했다 — JSX 리터럴 두 줄로 두면 서로 바뀌어도 타입이 잡아 주지 않고, 잘못된 쪽에도 그럴듯한 설명이 붙는다
  - 위치: `apps/builder/src/builder/workspace/components/{rulerMetrics.ts,RulerOverlay.tsx}`

- **가이드를 끄는 동안 페이지 밖에서는 아무 표시도 없었다** (ADR-181 후속, 2026-08-14 사용자 보고):
  - 눈금자에서 손을 대고 끌어도 **페이지 사각형 안에 들어가기 전까지** 선이 보이지 않았다. 드래그는 언제나 눈금자 위(=페이지 밖)에서 시작하므로 사용자가 처음 겪는 것이 "끌기 시작 → 아무 일도 없음" 이었고, 그래서 기능 자체가 없는 것으로 읽혔다
  - **Why**: 미리보기가 `mergeGuideDrag` 하나로만 나왔는데, 그것은 소속 페이지가 정해진 뒤에야 목록에 항목을 얹는다. 가이드 좌표가 페이지-로컬(C9)이라 소속 없는 구간을 표현할 방법이 없었던 것 — 커밋 거부(의도)와 **피드백 부재**(누락)를 한 조건이 겸하고 있었다
  - 수정: 드래그 상태가 소속과 무관한 커서 scene 좌표(`scenePosition`)를 항상 싣고, 소속이 없는 동안 뷰포트를 가로지르는 선을 그린다. 소속이 정해지면 종전대로 그 페이지에 클립된 선으로 바뀐다 — **선이 잘리기 시작하는 순간이 곧 "여기 놓으면 붙는다" 는 신호**라 두 표현을 통일하지 않았다
  - 미리보기는 순간 피드백이라 §8.5 의 **조작 표식** 열이다 (스냅 정렬선과 같은 취급 — occlusion·페이지 클립 미적용). 확정 가이드가 콘텐츠성 chrome 인 것과 갈린다
  - 위치: `apps/builder/src/builder/workspace/canvas/{interaction/guidePresentation.ts,hooks/useGuideDrag.ts,skia/guideRenderer.ts,skia/skiaOverlayBuilder.ts}`

- **페이지 밖으로 끌어낸 가이드가 유령 점선을 남겼다** (ADR-181 후속, 2026-08-14 사용자 보고):
  - 가이드를 페이지 밖으로 끌면 선은 사라지는데 **연장 점선만 캔버스에 남았다**. 다른 가이드를 고르거나 빈 곳을 누르면 그때 사라졌다
  - **Why**: 가이드가 지워진 게 아니라 **살아 있었다**. 좌표가 페이지-로컬(C9)이라 범위를 벗어난 값도 그대로 저장되고, 본체는 페이지 rect 클립에 잘려 안 보이는데 연장선은 조작 표식이라 클립 밖에서 그려진다. 지워진 줄 알았던 그 선이 **스냅에는 계속 참여**하고 있었다 — C10 이 막으려던 "보이지 않는 선에 흡착" 바로 그 상태
  - 수정: 페이지 밖으로 나가면 **눈금자로 되돌린 것과 같은 삭제**로 처리한다. 렌더러에도 같은 판정을 걸어(`isGuideWithinPage` 공용) breakpoint 를 줄여 범위 밖에 남은 가이드도 유령을 만들지 않는다
  - 위치: `apps/builder/src/builder/workspace/canvas/{hooks/useGuideDrag.ts,interaction/guidePresentation.ts,skia/guideRenderer.ts}`

### Features

- **가이드 3-상태 — Figma 실측 색·알파** (ADR-181 후속, 2026-08-14 사용자의 Figma 직접 확인):
  - 기본 **웜 레드 #F24822 알파 0.7** / hover·드래그 **같은 빨강 불투명** / 선택 **하늘색 #6DC1FF**. 두 축이 서로 다른 것을 말한다 — **알파는 잡을 수 있는지**, **색은 선택 여부**
  - 한때 시안(#59A8D7)이었고, 그 다음엔 알파만으로 선택을 표현했다. 알파 축 자체가 틀린 게 아니라 **붙은 상태가 틀렸다** — 같은 빨강의 명도 차이는 1px 선에서 구분되지 않는다. 기본색이 스냅 표식과 겹치는 것은 Figma 어법 그대로이며, 둘의 구분은 색이 아니라 **수명**이 진다 (스냅 정렬선은 드래그 중에만, 가이드는 계속)
  - hover 와 선택을 한 모듈(`guideEmphasis`)에 두고 우선순위(**선택이 hover 를 이긴다**)를 `resolveGuideEmphasis` 한 곳에 뒀다 — 선택 표식이 포인터 위치에 따라 깜빡이면 "지금 무엇이 선택돼 있나" 를 읽을 수 없다
  - 실측(라이브 픽셀): 흰 배경 대비 (255−G) 비 = 69/98 = **0.704**, (255−B) = 82/116 = **0.707** — 설계 알파 0.7 과 일치

- **선택은 드래그가 끝난 뒤에 선다** (ADR-181 후속, 2026-08-14 사용자의 Figma 확인):
  - 종전에는 pointer**down** 즉시 하늘색이 됐다. Figma 는 잡고 있는 동안 웜 컬러로 두고 **놓는 순간** 하늘색이 된다
  - **Why**: 선택은 "무엇을 조작 중인가" 가 아니라 **"무엇을 조작했나"** 의 결과다. down 에 붙이면 아직 결과가 없는데 결과 표식이 먼저 선다 — 잡고 있다는 신호는 이미 hover 알파와 커서가 준다
  - 요소 선택 해제는 종전대로 down 에서 한다 (가이드를 잡은 순간 요소 조작이 아닌 것은 확정이라 미룰 이유가 없다)

- **연장선은 선택 전용이 아니다** (ADR-181 후속, 2026-08-14 사용자 요청):
  - **마우스를 올리거나 끌고 있을 때도** 선의 방향 끝까지 이어진다 (색만 강조 상태를 따라간다 — hover·드래그는 웜 레드, 선택은 하늘색)
  - **Why**: 연장이 답하는 질문은 "이 선이 어디까지 가는가" 이고, 그게 필요한 때는 선택했을 때가 아니라 그 선을 **만지는 모든 순간**이다
  - 끌고 있는 가이드는 hover 로 취급한다 — 눈금자에서 막 끌어낸 가이드는 hover 이벤트를 거치지 않으므로, 그러지 않으면 강조가 "hover 가 먼저 왔는지" 라는 우연에 좌우된다

- **선택한 가이드를 Delete 로 지운다** (ADR-181 후속, 2026-08-14 사용자 요청):
  - 가이드를 선택하고 Delete/Backspace 를 누르면 지워진다. 종전에는 눈금자로 되돌리는 드래그가 유일한 삭제 경로였다
  - 드래그 삭제와 **같은 커밋 경로**(`deletePageGuide` → `commitPageGuideChanges`)라 히스토리 1 entry + persist + 재렌더가 한 묶음이고, 어느 쪽으로 지웠든 Cmd+Z 가 같게 동작한다
  - 우선순위는 Escape 와 같은 어법이다 — 가이드 선택과 요소 선택은 배타라 둘 중 하나만 서 있고, 가이드가 선택돼 있으면 Delete 는 그쪽을 향한다. 입력 필드 포커스 중에는 종전대로 단축키가 동작하지 않는다
  - 위치: `apps/builder/src/builder/{workspace/canvas/viewport/pageGuideActions.ts,hooks/useGlobalKeyboardShortcuts.ts}`

- **가이드 위 hover 커서 복구** (ADR-181 후속, 2026-08-14 사용자 요청):
  - **가이드 위 hover 커서가 아예 안 뜨던 것**을 고쳤다. 커서를 쓰는 곳이 둘이라 — 중앙 pointer 핸들러가 이동마다 `setCursor("default")` 로 되돌려 가이드 훅이 세운 값이 같은 프레임에 덮였다. 우선순위 판정을 `BuilderCanvas.setCursor` **한 곳**으로 모으고, "default"(= 아무것도 없다는 뜻)일 때만 가이드 커서가 이긴다 — move/resize 처럼 잡을 수 있는 대상을 가리키는 커서는 그대로 통과
  - 캔버스를 벗어날 때(`pointerleave`) 커서를 정리한다 — 히트 판정이 RAF 뒤에 도는데 탭이 가려지면 RAF 가 멈춰 마지막 상태로 굳는다

- **가이드 선택 + 방향 끝까지 연장** (ADR-181 후속, 2026-08-14 사용자 요청 — Figma 어법):
  - 캔버스의 가이드를 클릭하면 선택되고, 강조된 가이드는 **선의 방향 끝까지** 이어져 보인다. 페이지를 벗어난 구간은 **점선** — 실선/점선의 갈림이 곧 소속 표시라, 어느 페이지 것인지와 어디까지 이어지는지를 한 선이 같이 말한다
  - 요소 선택과 **배타**다 (둘 다 "지금 무엇을 조작 중인가" 라서 동시에 서면 Escape 가 어느 쪽을 향하는지 알 수 없다). Escape 또는 다른 곳 클릭으로 해제되고, 눈금자를 끄면 같이 풀린다 (조작 게이트 C10)
  - 선택은 **문서가 아니라 UI 상태**다 — persist 하지 않고 undo 대상도 아니며 새로고침하면 사라진다. 연장선은 §8.5 의 **조작 표식**이라 페이지 클립·occlusion 을 받지 않는다 (가이드 본체가 콘텐츠성 chrome 인 것과 갈린다)
  - **클릭과 드래그를 3px 로 가른다**: 없으면 클릭이 곧 미세 이동이 된다 — 12% 줌에서 1 screen px 은 8.3 scene px 이라 같은 자리를 눌렀다 떼도 좌표가 달라져 히스토리 entry 가 쌓였다 (실측 후 추가)
  - 위치: `apps/builder/src/builder/workspace/canvas/interaction/guideEmphasis.ts`, `skia/guideRenderer.ts`, `hooks/useGuideDrag.ts`

- **눈금자(Ruler)** (ADR-181 Phase 1 Implemented):
  - 캔버스 상단·좌측에 눈금 스트립 — Shift+R 또는 설정 패널 "Show Rulers" 로 토글 (기본 OFF)
  - 눈금 간격은 줌에 따라 1-2-5×10ⁿ 계열로 자동 전환, 라벨이 겹칠 만큼 촘촘해지면 보조 눈금을 생략
  - **Why (렌더 표면 판정)**: 1차로 Skia 오버레이에 그렸으나 최적화 4단계(틱 Path 배칭 → TextBlob 캐시 → `Path.MakeFromCmds` → Picture 캐시) 후에도 `render.frame` 이 0.40→1.21ms(예산 4.9%)로 HC1(1%) 에 못 미쳤다 — 잔여분이 **래스터화 비용**이라 같은 계열로는 더 줄지 않는다. 사용자 판정으로 DOM 레이어로 전환해 Skia 증가분이 **0** 이 됐다 (도트 배경 ADR-902 의 반복 패턴 + 위상 이동 기법 승계)
  - 위치: `apps/builder/src/builder/workspace/components/{RulerOverlay.tsx,rulerMetrics.ts}`

- **수동 가이드 — 페이지 귀속 기준선** (ADR-181 Phase 2~6 Implemented):
  - 눈금자 스트립에서 캔버스로 끌어내면 가이드 생성, 캔버스에서 끌면 이동, 눈금자로 되돌리면 삭제. 각 조작이 Cmd+Z/Cmd+Shift+Z 대상이고 새로고침 후에도 유지된다
  - 요소·페이지 드래그가 가이드에 흡착 (ADR-179 스냅 체계 편입 — 정렬선 판정에만 참여)
  - 가이드는 **페이지에 귀속**되고 breakpoint 별로 따로 관리된다 — 페이지를 옮기면 함께 따라오고, 겹친 페이지에서는 위 페이지에 가려진 구간이 그려지지 않는다
  - **표시는 눈금자와 독립, 조작만 눈금자 ON 한정**: 가이드는 스냅에 참여하므로 숨기면 "보이지 않는 선에 흡착" 이 되어 원인 추적이 불가능해진다. 반대로 조작은 진입점(생성·삭제)이 전부 눈금자에 있어 ON 한정이 자연스럽고, 그 덕에 눈금자 OFF 면 pointer 체인이 도입 이전과 **바이트 동등**하다
  - 위치: `packages/shared/src/types/composition-document.types.ts` (`pageGuides`), `apps/builder/src/builder/workspace/canvas/{skia/guideRenderer.ts,hooks/useGuideDrag.ts,interaction/guide*.ts,viewport/pageGuideActions.ts}`

### Architecture

- **`page-guide` 히스토리 kind 추가 — 비-element 축 3번째** (ADR-181 Phase 3):
  - `page-position`(ADR-177) / `snapshot-restore`(ADR-180) 에 이어 element 노드 경로를 타지 않는 세 번째 entry kind
  - 소비 지점이 초안의 3곳(undo/redo/goToIndex)이 아니라 **6곳** 이었다 — `syncDatabaseForEntries` skip, addEntry DEV guard 면제, 패널 라벨·아이콘까지. 그중 타입 시스템이 잡아 주는 것은 아이콘 맵 하나뿐이라 나머지 5곳을 정적 가드로 고정
  - `page-position` 과 갈리는 지점 둘: 스토어 미러가 없어 canonical 만 되돌리고, 목록 **전체**가 before/after 라 생성·이동·삭제가 한 어법이다
  - 위치: `apps/builder/src/builder/stores/history.ts`, `stores/history/historyActions.ts`

### Performance

- **눈금자·가이드의 프레임 예산 영향** (ADR-181 HC1, G5 실측):
  - 눈금자 ON/OFF `render.frame` p50 +0.025ms(**0.15%**), 가이드 20개에서도 +0.025ms(0.15%) — 기준 1% 충족
  - 가이드 드래그 100 move 동안 canonical write·히스토리·persist 각 **0** (pointerup 1회 commit)
  - **측정법 주의**: 단발 A/B 는 믿을 수 없다 — 첫 1쌍은 +1.26%(게이트 초과)로 보였고 ON/OFF 순서를 교대해 4쌍 반복하자 사라졌다. 이후 전 측정을 교대 반복으로 고정

## [히스토리 스냅샷 — ADR-180 Phase 0~4] - 2026-08-13

### Features

- **히스토리 스냅샷 — 선형 truncation 생존 복원 지점** (ADR-180 Implemented):
  - 히스토리 패널에 스냅샷 섹션 신설 — 카메라 버튼 즉시 생성 ("스냅숏 N", 프로젝트당 user 10개 상한 + 도달 시 생성 차단·삭제 유도), 행 클릭 복원, 더블클릭 인라인 rename, hover 삭제 (confirm 1회)
  - 스냅샷 = canonical `CompositionDocument` 전체 캡처본 — undo 후 재편집으로 폐기되는 redo 분기를 명시 시점으로 보존/복원 (Photoshop 웹 History 어법 동형). IndexedDB `composition-history` v3 `snapshots` store 영속 — 새로고침 후에도 유지
  - 복원은 boot hydrate 동형 문서 전체 교체 + `snapshot-restore` 히스토리 entry 로 **undo 가능** (복원 직전 상태를 system 스냅샷으로 자동 캡처, 프로젝트당 최신 5개 rolling)
  - **Why**: 선형 히스토리는 undo 후 새 편집 시 redo 분기를 폐기 (`history.ts` truncation) 하며 복구 수단이 없었다 — 스냅샷이 그 구조적 손실 경로의 표준 보상 장치
  - live 게이트 (Chrome MCP): 복원 doc == 스냅샷 원본 JSON 완전 일치, 복원↔undo↔redo 왕복 정합, 새로고침 hydrate 동일성, 5,003노드 합성 직렬화 p50 9.4ms (< 800ms 예산)
  - 위치: `apps/builder/src/builder/stores/history/{snapshots,snapshotRestore}.ts`, `panels/history/HistoryPanel.tsx`

### Bug Fixes

- **복원 시 타 페이지 히스토리 clear 가 미방문 페이지를 놓침** (ADR-180 R4 보강):
  - `clearOtherPageHistories` 가 메모리 로드된 페이지만 순회 — lazy 미로드 페이지의 IndexedDB 히스토리가 잔존해 재방문 시 부활 (stale delta 적용 위험)
  - **Why**: 페이지 히스토리는 방문 시점 lazy 로드라 메모리 키 순회로는 프로젝트 전수가 안 잡힌다
  - 수정: 복원 전/후 페이지 id 합집합을 전달해 전수 clear — 타 프로젝트 히스토리는 보존 (live IDB 실측 확증)

## [색상 피커 popover 공용화 — PropertyColor → ColorPickerPanel] - 2026-08-14

### Features

- **border/text 색상 피커를 배경(fill) 피커와 동일한 공용 패널로 통합** (사용자 지적 — 두 popover 의 디자인 비대칭):
  - `PropertyColor` (Appearance borderColor / Typography color / ModifiedStyles 색상) 의 자체 구현 피커(ColorArea+Hue+맨 hex input, 미스타일 ~130줄)를 fill popover 가 쓰는 공용 `ColorPickerPanel` 소비로 교체
  - 획득 능력: Alpha 슬라이더 + EyeDropper(스포이드) + HEX/RGBA/CSS 포맷 탭 + 빌더 디자인 스타일
  - commit-skip 함정 가드가 수동 ref 에서 `resetKey` 설계 차단으로 격상 (외부 value 재동기화는 요소 전환 시에만). 저장 포맷은 불투명 색이면 종전 `#RRGGBB` 유지 (알파 사용 시에만 hex8)
  - 위치: `apps/builder/src/builder/components/property/PropertyColor.tsx`
- **fill popover 의 Type 선택기를 fieldset+legend 표준 구조로 정합** (사용자 지적 — footer 의 Blend 는 `fieldset.properties-aria`+legend 인데 상단 `.fill-type-selector` 는 bare ToggleButtonGroup):
  - `FillTypeSelector` 를 `fieldset.properties-aria.fill-type-selector` + `legend "Type"` 으로 감싸 ADR-163 패널 표준 (라벨 있는 필드 그룹 계약) 정합. fieldset `min-inline-size` 기본값 해제는 고유 클래스가 공급 (panel-system 어법)
  - 위치: `apps/builder/src/builder/panels/styles/components/{FillTypeSelector.tsx,FillDetailPopover.css}`
- **popover 내부 inset 을 컨테이너 단일 소유로 통일** (사용자 지적 — `.color-picker-panel` 만 8px 을 갖고 Type/Blend fieldset 은 popover 벽에 붙는 불일치):
  - `.color-picker-panel`/`.image-fill-editor` 의 보상 padding 제거 → `.fill-detail-popover` 가 8px 단일 공급 (모든 탭·fieldset 균일 inset)
  - PropertyColor popover 는 전용 클래스 `.property-color-popover` 신설 + 8px — **공용 Popover/타 popover 무영향** (구 `.color-picker-popover` 는 shared ColorPicker.css 의 dead Dialog 규칙과 이름 충돌이라 분리)
  - 위치: `panels/styles/components/{ColorPickerPanel,FillDetailPopover,ImageFillEditor}.css`, `components/property/PropertyColor.tsx`, `components/styles/form-controls.css`

## [색상 피커 드래그 캔버스 실시간 반영 — PropertyColor preview 채널] - 2026-08-13

### Bug Fixes

- **색상 드래그가 캔버스에 드롭 시점에만 반영되던 공백 해소**:
  - `PropertyColor` (Appearance borderColor / Typography color / ModifiedStyles 색상) 의 드래그 중 `handleChange` 가 로컬 state 만 갱신 — 패널 스와치는 실시간인데 Skia 캔버스는 `onChangeEnd` 커밋까지 무반영이었다
  - **Why**: 캔버스 preview 채널(`updateStylePreview` — RAF 배칭·히스토리/DB 무접촉·layoutVersion bump, borderWidth 드래그가 이미 사용 중)이 색상 피커에만 배선돼 있지 않았다. FillSection(배경)은 자체 preview 경로 보유로 무관
  - 수정: `PropertyColor` 에 `onPreview` prop 신설 + 3개 섹션 배선. 드래그 세션 중 외부 value 동기화를 차단하는 가드 동반 — preview 가 value prop 을 미리 바꾸면 `lastSavedValue` 가 덮여 드롭 커밋이 "변경 없음" 으로 소실된다 (style-ssot PropertyUnitInput commit-skip 함정과 동형)
  - 위치: `apps/builder/src/builder/components/property/PropertyColor.tsx`, `panels/styles/sections/{AppearanceSection,TypographySection,ModifiedStylesSection}.tsx`
- **배경(fill) 드래그도 캔버스 무반영이던 두 번째 축 해소** (사용자 실측 후속):
  - fill preview 액션 2종 (`updateSelectedFillsPreview`/`updateSelectedFillsPreviewLightweight`) 이 elements/elementsMap 만 갱신하고 **layoutVersion bump + canonical sync 가 없어** Skia 재렌더 trigger 부재 — DOM preview iframe 만 반영되는 비대칭 (Skia 는 `element.fills` 를 직접 소비하므로 데이터는 도달, trigger 만 결손)
  - 수정: 두 액션에 `updateSelectedStylePreview` 와 동일 tail (layoutVersion + dirtyElementIds + canonical sync) 부여 — CSS 변환 생략 최적화는 유지, RAF throttle 은 호출부 보장
  - 위치: `apps/builder/src/builder/stores/inspectorActions.ts` (+ `inspectorFills.test.ts` 의 stale featureFlags mock 수리 — `isCanvasCompareMode` 미등재로 스위트 전체가 로드 실패하던 기존 결함)

## [페이지 위치 입력 적응형 통합 — Transform position row] - 2026-08-13

### Features

- **페이지 X/Y 입력을 Styles 패널 Transform 으로 통합** (Pen/Figma 단일 Position 어법):
  - body 선택 시 Transform position row 가 CSS left/top 대신 페이지 캔버스 위치(`pagePositions`)를 X/Y 로 표시·편집 — commit 은 `updatePagePosition` 경유라 히스토리 entry·persist·undo 는 ADR-177 계약 그대로
  - Properties 패널(PageBodyEditor)의 Position 섹션 제거 — 위치 입력을 한 곳으로 단일화
  - projection/frame body (page_id 없음) 는 position row 자체를 숨김, 일반 요소는 현행 Left/Top + Absolute 토글 유지
  - **Why**: 페이지 위치(빌더 전용 배치)와 CSS left/top(출판 스타일)은 별개 데이터인데 두 패널에 병렬 노출되어 혼동 축이었고, body 에 살아 있던 Absolute 토글이 body style 에 무의미한 `position:absolute` 를 기록해 preview 발산 축이던 결함도 함께 소멸
  - **드래그 중 실시간 X/Y 갱신**: 페이지 드래그 중 패널 X/Y 가 commit 시점까지 멈춰 있던 공백 해소 — X/Y row 를 소형 컴포넌트로 분리해 ADR-176/178 transient 채널(`pagePositionPresentation`)을 `useSyncExternalStore` 로 직접 구독. Zustand set 무경유(드래그 프레임이 전역 셀렉터 sweep 을 유발하지 않음) + 스냅샷을 반올림 정수 문자열로 잘라 표시값이 실제 바뀐 프레임에만 해당 row 하나만 재렌더 (드래그 외 시간 비용 0)
  - 위치: `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`, `apps/builder/src/builder/panels/properties/editors/PageBodyEditor.tsx`

## [히스토리 패널 시각 어법 — 미래 state 흐림·타입 아이콘·라벨 가시화] - 2026-08-13

### Bug Fixes

- **히스토리 패널 라벨 완전 비가시 수리**:
  - 공유 `Button` 에 `ghost` variant 가 정의돼 있지 않아 `variant="ghost"` 가 기본 `--button-color: var(--fg)` 로 폴백 → `.button-base` 가 행 배경을 어둡게 칠하고, 라벨 색(`--fg`)과 동색이 되어 텍스트가 보이지 않았다
  - **Why**: `.button-base` 는 `--button-color` 를 배경으로 칠하는 filled 색 시스템 — variant 매핑(`Button.css`)에 ghost 부재 시 default 로 떨어진다
  - 수정: 패널 한정 `--button-color: transparent` + `--button-text: var(--fg)` 중화 (공유 Button 표면 무변경, hover/pressed 는 button-base color-mix 파생 유지)
- **`page-position` entry 라벨이 "변경" 으로 표기**: ADR-177 페이지 이동 entry 가 라벨 매핑에 없어 default 폴백 → "페이지 이동" (+다중 페이지 카운트) 케이스 추가

### Features

- **히스토리 패널 시각 어법 개선** (Adobe Photoshop 웹 History 패널 조사 1단계 적용):
  - **미래 state 흐림 처리**: undo 후 redo 가능 구간(`index > currentIndex`)을 `data-future` + opacity 로 흐리게 표시 — "새로 편집하면 이 구간이 폐기된다" 를 예고하는 Photoshop 선형 히스토리 어법 (hover 시 복원 가능성 표시로 흐림 완화)
  - **entry 타입 아이콘**: add/remove/update/move/batch/group/ungroup/page-position → lucide 아이콘 매핑, 시작 상태는 File 아이콘
  - live 실측: 28/35 시점에서 미래 7건 흐림 + 타입별 아이콘 렌더, 항목 27 클릭 jump 시 카운트·흐림 즉시 재분류, redo 원복 정상
  - 위치: `apps/builder/src/builder/panels/history/{HistoryPanel.tsx,HistoryPanel.css,historyEntryLabel.ts}`

## [등간격 스냅·간격 수치 배지 — ADR-179 Phase 4] - 2026-08-13

### Features

- **등간격(equal spacing) 스냅 + 간격 수치 배지** (ADR-179 Phase 4 — 2026-08-12 이연분 재개 종결, 전 phase 완료):
  - 드래그 중 이웃들의 간격 리듬에 흡착: **between** (두 이웃 사이 양쪽 간격이 같아지는 중앙) + **sequence** (인접 쌍의 간격을 연장하는 지점 — A|B|이동 대상). 직교축이 겹치는 이웃("행/열" 문맥)만 대상, 축별 독립, 정렬선 스냅과 최근접 경합 (동률은 정렬선)
  - 흡착 순간 **간격 세그먼트(양끝 틱) + 간격 수치 배지** 표시 — Figma 어법 (Pen v1.2.1 실측: 수치 표시 없음, 정렬선+정렬점 마커뿐). 배지는 `--accent` 배경 + `--fg-on-accent` 텍스트, 페이지·absolute 요소 공통 (같은 스냅 엔진)
  - **Why**: "정렬선의 경우 Figma 에서는 간격 수치 값이 나타나지 않나?" (2026-08-12 사용자) — Pen 대조 실측 후 재개 지시. 등간격 배치(3 페이지 나란히)가 눈대중이던 마지막 축
  - live 실측: P4·P5 간격(160.248…) 리듬 연장 지점에 P3 정확 흡착 — 커밋 gap 두 개 float 동일값, 배지 "160" 2개 렌더, pointerup 소거, undo 원복
  - **스냅 가이드 색 웜 레드 전환**: 정렬선·등간격 표시·수치 배지 색을 무채색 `--accent` 에서 웜 레드 `#F24822` 상수로 변경 (배지 텍스트 흰색). **Why**: Figma `#F24822`/Pen `#DD3F17` 픽셀·코드 실측 대조 — 드래그 중 순간 피드백은 콘텐츠·선택 파랑과 혼동되지 않는 이질색이 두 도구 공통 관례, 무채색은 명도로만 겨뤄 식별성 열세 (사용자 결정)
  - **정렬점 × 마커**: 정렬선 위에 실제로 맞은 점들(edge 매칭 = 그 변의 코너 2점, center 매칭 = 중심 1점 — 이동 박스 + 매칭 후보 전부, 근접 중복 제거)을 × 마크로 표시. **Why**: 선만으로는 "어느 점이 붙었는지" 가 안 보인다 — Pen v1.2.1 어법 차용 (선 위 × 가 등을 맞댄 화살촉처럼 읽혀 구간 분절 게슈탈트)
  - **흡착 임계 8 → 5 screen px 하향**: `SNAP_THRESHOLD_SCREEN_PX = 5` (scene 임계 = 5/zoom). **Why**: 시작값 8 은 Figma 관례 근사였으나 흡착 반경이 조작감 대비 넓었다 — Pen v1.2.1 실측값(`Tce=5`) 채택 (breakdown C4/R2 의 G1 조정 절차, 사용자 결정)
  - **성립 정렬선 전부 방출** (사용자 보고): 축당 최근접 1선만 그리던 것을 흡착 확정 위치에서 성립하는 모든 라인으로 확장 — 같은 크기 페이지 정렬 시 상·중·하(가로) / 좌·중·우(세로) 동시 표시, 마커도 라인별 수집. **Why**: Figma/Pen 은 동률 성립 라인을 전부 그린다 (Pen `recordedSnaps` 배열 동형) — 1선만 그리면 나머지 성립 정렬이 침묵해 정렬 상태가 과소 전달
  - **Alt 홀드 거리 측정 신설** (Figma Alt-measure 어법 — ADR-179 §1.2 의 인접 항목, 사용자 지시로 반영): 요소/페이지 body 선택 후 **Alt/Option 홀드 + 다른 요소 호버** = 선택 bbox 와 호버 대상 사이 거리를 세그먼트(양끝 틱) + 수치 배지로 표시. 분리 시 축별 마주 보는 edge 간격, 포함 시 4방 inset (부모/컨테이너 측정). 다중 선택은 합집합 bbox 기준, Alt 해제·호버 이탈·드래그 시작 시 즉시 소거. deep hover 와 결합 — 컨테이너 안 리프를 호버하면 그 리프까지의 거리
  - 위치(추가분): `workspace/canvas/interaction/{measureGuides,measureGuidePresentation}.ts`, `workspace/canvas/hooks/useElementHoverInteraction.ts`
  - 위치: `workspace/canvas/interaction/{snapGuides,snapGuidePresentation}.ts`, `workspace/canvas/skia/{snapGuideRenderer,skiaOverlayBuilder,selectionRenderer}.ts`

## [캔버스 스냅·정렬 가이드 — ADR-179 Implemented] - 2026-08-12

### Features

- **객체 스냅 + 정렬선(스마트 가이드) 신설 — 페이지·absolute 요소 드래그** (ADR-179 Phase 0~3·5, Phase 4 등간격 이연):
  - 페이지 드래그: 다른 페이지의 가장자리·중앙 6축(left/centerX/right × top/centerY/bottom)에 흡착 + 흡착 순간 두 박스를 관통하는 정렬선 표시. absolute 요소 드래그: 형제·부모 컨테이너 기준 같은 흡착 (같은 스냅 엔진 — `resolveSnappedPosition` 순수 함수 공유)
  - **우선순위**: 객체 스냅 > snap-to-grid (축별 — 객체 흡착 성사 축은 그리드 미적용), **Cmd/Ctrl 홀드 = 전 스냅 억제**, Shift 축 고정 먼저 → 고정 축만 스냅 (Figma 관례)
  - 임계 8 screen px (scene 임계 = 8/zoom — zoom 무관 화면상 동일 흡착 거리), stateless 판정 (raw 포인터 기준 — 임계 밖 즉시 해제, "달라붙어 못 떼는" 조작감 없음)
  - 신규 설정: Settings 패널 **Snap to Objects** (기본 ON)
  - **Why**: 정렬 보조가 snap-to-grid(기본 OFF) 하나뿐 — 페이지 자유 배치 모델에서 나란히 놓는 조작이 눈대중이었다 (2026-07-16 감사 H1 축의 첫 착수). 다중 드래그는 리더에 스냅 + 델타 공유 (ADR-178 문법 승계)
  - 성능: 후보 수집 드래그 시작 1회, 프레임당 판정 0.56µs(10 후보)/1.80µs(50 후보) — 프레임 예산 16.6ms 의 0.011% 이하 (R1/G2). ADR-176 publish 1회·map clone 금지 계약 무변경
  - 정렬선은 조작 표식(드래그 순간 피드백) — 페이지 간 occlusion clip 미적용 분류 (§8.5), 색은 builder 무채색 `--accent` 1 screen px
  - 위치: `workspace/canvas/interaction/{snapGuides,snapGuidePresentation,dragModifiers}.ts`, `workspace/canvas/hooks/{usePageDrag,useDragBridge,useCentralCanvasPointerHandlers}.ts`, `workspace/canvas/skia/{snapGuideRenderer,skiaOverlayBuilder}.ts`, `stores/canvasSettings.ts`, `panels/settings/SettingsPanel.tsx`

## [캔버스 다중 선택 이동 — ADR-178 Implemented] - 2026-08-12

### Features

- **다중 선택 드래그 — 요소·페이지가 집합으로 함께 움직임** (ADR-178 Phase 0~4):
  - 요소 2+개 다중 선택 드래그: 전 대상이 같은 델타로 이동, 드롭 시 canonical batch move + **히스토리 1 entry** (Cmd+Z 1회 전체 복귀). 대상 집합은 정규화 — 조상 선택 시 자손 제외(이중 이동 방지), body 는 요소 드래그에서 제외
  - **페이지 다중 선택·드래그 신설**: 페이지 타이틀 **Shift 클릭** = 그 페이지를 다중 선택에 토글 (cross-page). 선택된 페이지 중 하나를 잡아 끌면 전체가 같은 델타로 이동 — batch entry 1개 (ADR-177 `pagePositionEvent.entries[]`), undo 1회 전체 복귀 + 문서 batch 저장
  - **이동 modifier**: 드래그 중 **Shift = 축 고정** (시작점 기준 지배 축 — 요소는 드롭 판정 좌표까지, 페이지는 리더 델타에 적용되어 다중 동반 고정), **Alt/Option 드래그 = 복제** (원본 잔류, 복제본이 델타 위치에 생성 — 기존 duplicate 파이프라인 재사용, 복제+이동 = entry 1개)
  - **Why**: 드래그 파이프라인이 구조적 단일 대상(`selectedElementIds[0]` / 시각 오프셋 전역 단일 슬롯 / `pageOwner` 단수)이라 다중 선택을 해도 하나만 움직였다 — Figma/Pencil 이동 문법과의 격차 축. 시각 오프셋은 `Set + 공유 델타` 로 확장 (프레임당 갱신 델타 2필드 — 전체 map clone 0)
  - 위치: `workspace/canvas/interaction/{selectionModel,dragModifiers,canvasGestureSession,pagePositionPresentation}.ts`, `workspace/canvas/hooks/{useDragBridge,usePageDrag,useCentralCanvasPointerHandlers}.ts`, `workspace/canvas/skia/{nodeRendererTree,renderCommands}.ts`, `adapters/canonical/canonicalMutations.ts` (`moveElementsToCanonicalTarget`), `stores/elements.ts` (`updatePagePositionsBatch`)

### Bug Fixes

- **body 혼합 다중 선택 드래그 엣지 폐쇄** (ADR-178 Phase 1):
  - 다중 선택에 body 가 섞이면 body 가드가 통과해 `selectedIds[0]`(body 가능)로 드래그가 시작돼 페이지 전체가 시각 이동하는 혼란 상태가 있었다
  - **Why**: body 가드가 선택 1개일 때만 `selectedElement` 를 조회 — 다중에서 무조건 통과. 정규화 단일 진입점이 body 를 제외해 폐쇄
- **다중 드롭 undo 의 형제 순서 뒤집힘** (ADR-178 Phase 1):
  - **Why**: move event 를 이동 순서(from index 오름차순)로 기록하면 undo 의 역순 적용이 큰 자리부터 삽입해 순서가 뒤집힌다 — 기록을 from index **내림차순**으로 정렬 (undo=오름차순 복원, redo=최종 문서 기준 내림차순 재적용 양방향 정합)
- **페이지 타이틀 드래그 간헐 실패 해소** (ADR-178 Phase 2 — 사전 결함):
  - **Why**: pointerdown 마다 열리는 element gesture 세션을 pointerup 에서 아무도 닫지 않아 같은 pointerId 로 잔류 — `tryClaimPage` 가 첫 press 이후 구조적으로 실패했다 (계측 실측). 타이틀 경로에 `promoteElementToPage` fallback (같은 pointer 의 element 제스처를 page 로 승격하는 기존 API) 연결

## [페이지 위치의 문서 데이터화 — ADR-177 Implemented] - 2026-08-12

### Features

- **페이지(아트보드) 이동이 저장·undo 대상이 됨** (ADR-177 Phase 0~4):
  - 페이지 드래그·화면 정렬·인스펙터 X/Y 입력·화살표 nudge 가 전부 히스토리 entry 로 기록 — Cmd+Z/Cmd+Shift+Z 로 복귀/재적용. 화면 정렬은 **batch 1 entry** (Cmd+Z 1회로 전체 복귀)
  - 새로고침/재로드 후 사용자 배치 유지 — canonical document `pagePositions` root 필드 (breakpoint 별 scene px, **lazy write** — 이동한 페이지만 기록)
  - **Why**: 페이지 위치가 인메모리 뷰 상태라 새로고침 시 배치가 초기 정렬로 소실되고 이동을 되돌릴 수 없었다 (2026-08-12 실측). Figma/Pencil 은 프레임 위치가 문서 데이터 — ADR-176 이 의도적으로 이연한 스키마 축의 완결
  - 신규 UI: 페이지(body) 선택 시 인스펙터 **Position X/Y** + 화살표 **nudge 1px / Shift 10px** (element 선택 시 화살표=형제 순서 변경은 현행 유지)
  - BC 0% — 필드 없는 기존 문서는 현행 재계산 폴백, 로드 시 재직렬화 0. 히스토리는 `page-position` entry 로 element 노드 경로 미진입 (early-branch + 정적 가드)
  - 위치: `stores/elements.ts` (`updatePagePosition`/`initializePagePositions`), `stores/history/historyActions.ts`, `stores/canonical/canonicalDocumentStore.ts` (`setPagePositions`), `panels/properties/editors/PageBodyEditor.tsx`, `hooks/useGlobalKeyboardShortcuts.ts`, `workspace/canvas/viewport/pageLayoutActions.ts`

## [겹친 page 의 콘텐츠성 chrome 페이지 간 occlusion — 빈 slot 해치] - 2026-08-12

### Bug Fixes

- **아래 page 의 빈 slot 해치가 위(활성) page body 위에 그려지던 문제**:
  - 콘텐츠성 오버레이 chrome(슬롯 해치/테두리, collection remainder, hover 아웃라인)의 가시성 클립(`hitBoundsMap`)은 **조상** clip 만 반영한다 — 페이지끼리는 조상 관계가 아니라 페이지 간 occlusion 이 걸리지 않았고, 오버레이 패스는 씬 content 위에서 돌아 아래 페이지의 chrome 이 위 페이지 body 를 그대로 가로질렀다
  - **Why**: 페이지 간 가림은 페인트 순서(활성 페이지 최상단 — `orderPagesForPaint`)의 산물이라 조상 clip 모델 밖 — 페이지 테두리(`renderFrameAreaBorder`)에 이미 적용한 순서 기반 `ClipOp.Difference` occlusion 을 콘텐츠성 chrome 에도 적용해야 한다
  - 수정: chrome target 에 소유 `pageId` 를 싣고, `withPageOcclusionClip` 이 소유 페이지보다 페인트 순서가 뒤인 페이지 rect 를 제외하고 그림 — 슬롯 해치 / collection remainder / hover 아웃라인 3종 적용. 소유 페이지가 활성(최상단)이면 클립 없음
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{skiaOverlayBuilder,skiaOverlayHelpers}.ts`
- **아래 page 의 상단 title 도 위 page body 위에 떠 보이던 문제** (같은 결함 계열, 후속 사용자 보고):
  - page title 은 조상-clip 축에서는 조작 표식(항상 표시)이지만 **페이지 간 축에서는 occlusion 대상** — 가려진 page 의 "Page N" 텍스트가 활성 page body 한가운데 떠 위 page 의 내용처럼 읽혔다
  - 수정: title 렌더도 `withPageOcclusionClip` 경유 + 히트 대칭으로 BuilderCanvas title pointerdown capture 에 paint-rank guard 추가 (가려진 지점의 title press 는 무시되고 위 page 일반 히트로 폴백 — 부분 가림은 point 판정이라 보이는 구간은 여전히 잡힘). 활성 page title 은 영향 없음
  - 위치: `apps/builder/src/builder/workspace/canvas/{skia/skiaOverlayBuilder.ts,BuilderCanvas.tsx}`

## [Page body 첫 클릭 제스처에서 바로 드래그] - 2026-08-12

### Bug Fixes

- page 빈 영역을 **처음 누른 제스처에서 바로 page 를 잡아 끌 수 있다** — 기존에는 클릭(선택) → 해제 → 재클릭 두 제스처가 필요했다.
  - **Why**: 빈 영역 press 의 page drag 승격 조건이 "이전 press 에서 이미 선택된 page" (`selectedPageId === bodySelection.pageId`) 라, 첫 press 는 body 선택만 하고 드래그 세션을 시작하지 않았다.
  - 수정: body 선택 직후 같은 제스처에서 `promoteElementToPage` + `startPageDrag` 승격. 클릭만 하고 안 움직이면 canonical commit 없음 (`usePageDrag` finish 의 `isSamePosition` 가드) — 클릭 의미 불변.
  - 위치: `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`

### Verification

- `pnpm type-check` PASS + live builder 실측 (Chrome MCP): 미선택 page 빈 영역 press+드래그 한 제스처로 선택과 동시에 드래그 델타만큼 이동 (Page 3/Page 5 × 2회, 전후 좌표 대조)

## [겹친 page 는 활성 page 가 최상단 — 페인트·히트 동기화] - 2026-08-11

### Features

- page 가 겹쳐 있을 때 **활성(선택된) page 가 겹침 최상단에 그려진다** — 생성/문서 순서와 무관하게 지금 작업 중인 page 가 항상 위로 올라온다 (OS 창 click-to-raise 멘탈 모델). canonical page 순서(패널 목록/저장)는 불변 — 순수 workspace 표시 축.
  - 페인트: `collectVisiblePageRoots` 가 활성 page body 를 마지막 root 로 재배열 (`pagePaintOrder.ts` 신설, rootSignature 로 커맨드 스트림 캐시 자동 무효화). page 전환 시 content invalidate — overlayVersion 만으로는 `classifyFrame` 이 snapshot blit 을 유지.
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/pagePaintOrder.ts`, `skia/{visiblePageRoots,SkiaCanvas}.tsx?`

### Bug Fixes

- **겹침 영역 빈 클릭이 아래 깔린 page 를 선택하던 비대칭 수정**: body 히트가 문서 순서 정방향 + 첫 매치라 페인트(뒤쪽이 위)와 반대였다. top-first(페인트 역순) 순회로 교체 — `findTopPageIdAtCanvasPoint` 단일 수식.
  - 위치: `apps/builder/src/builder/workspace/canvas/selection/selectionHitTest.ts`
- **위 page body 에 가려진 아래 page 요소가 클릭/호버되던 문제 수정** (live 실측): page 간 tie-break 만으로는 위 page 에 요소가 없는 지점에서 아래 page 요소가 유일 후보로 남아 "안 보이는데 클릭"됐다. 히트 지점을 덮는 최상단 page rank 미만의 후보를 제외하는 occlusion 필터 추가 — 클릭(`pickTopmostHitElementId`)/컨텍스트 메뉴/호버 3경로 동일 적용.
  - **Why**: canvas-rendering.md §8.5 — 포인터 판정은 렌더러가 실제로 그린 영역만 대상.
  - 위치: `selection/selectionHitTest.ts`, `interaction/{selectionModel,resolveCanvasInteractionTarget,canvasContextMenu}.ts`, `hooks/{useCentralCanvasPointerHandlers,useElementHoverInteraction}.ts`
- **아래 page 의 바깥 테두리선이 위 page body 를 가로질러 보이던 문제 수정** (사용자 보고): 테두리는 overlay 패스에서 전 page 일괄로 content 위에 그려졌다. `renderFrameAreaBorder` 가 페인트 순서 기반으로 위 page rect 를 clip difference 제외 — 테두리는 아트보드의 콘텐츠성 chrome 이라 content 와 같이 잘린다 (page 타이틀은 조작 표식이라 항상 표시 유지).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{workflowRenderer,skiaOverlayBuilder}.ts`

### Verification

- `pagePaintOrder.test.ts` 6 + `visiblePageRoots.test.ts` 3 + `selectionHitTest.test.ts` 15 등 42 PASS + `pnpm type-check` PASS
- live builder 실측 (Chrome MCP): Page 2↔Page 3 겹침 상태에서 ① 활성 전환 시 상단 교대 ② 겹침 클릭이 위 page 요소(InlineAlert) 선택 ③ 위 page 가 덮은 지점 클릭이 아래 page 요소 대신 위 page body 유지 ④ 아래 page 테두리 미표출 확인

## [Page 드래그 중 slot chrome 추적 — transient delta 적용] - 2026-08-11

### Bug Fixes

- page body/title 드래그 중 slot 영역(해치+테두리), collection remainder("+N more"), editing-context border 가 페이지와 함께 움직이지 않고 드롭 후에만 한 번에 이동하던 문제를 수정했다.
  - **Why**: overlay 의 콘텐츠성 chrome 은 스트림 빌드 시점의 canonical `pagePositions` 기준 boundsMap/hitBoundsMap 을 그대로 소비했다. content 패스(`executeRenderCommands`)와 selection overlay 는 렌더 시점에 presentation snapshot delta 를 더해 움직이지만, `buildSlotMarkerTargets`/`buildCollectionRemainderTargets`/editing-context border 는 delta 미적용 → 드롭 시 canonical commit + 스트림 재빌드 후에만 새 위치로 점프.
  - 수정: 세 chrome 에 `readPagePositionDelta` 를 적용 — inset/클립 산출은 canonical 좌표계에서 종결 후 최종 bounds 만 평행이동 (조상 clip 도 같은 delta 로 움직이므로 정합).
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{skiaOverlayHelpers,skiaOverlayBuilder}.ts`

### Verification

- `skiaOverlayHelpers.test.ts` 27 PASS (신규 transient delta 4건: active page 이동 / 타 페이지 불변 / clip 후 이동 순서 / inactive 불변) + `pnpm type-check` PASS

## [Canvas page 전체 선택 위치 이동 복구] - 2026-08-03

### Bug Fixes

- Pages 패널에서 page 전체를 선택한 뒤, page의 빈 영역 또는 selection outline을 drag하면 해당 page 위치가 이동하도록 복구했다. page title drag와 같은 transient presentation 및 종료 시 canonical position commit 경로를 사용한다.
  - **Why**: page 전체 선택은 `body`를 선택하지만 중앙 pointer handler가 `body`를 element drag 대상에서 제외해, 빈 영역의 drag도 다시 body 선택으로만 처리했다. 또한 selection hit-test가 projection의 `pageId` 별칭을 읽지 않아 Page body outline을 누락할 수 있었다.
- page body drag 중에는 Skia content cache와 selection/title overlay도 transient page position을 매 frame 소비하도록 연결했다.
  - **Why**: content render closure가 build 시점의 presentation snapshot을 캡처하고, snapshot 변경이 content cache invalidation을 일으키지 않아 pointerup의 canonical update 뒤에만 page가 이동해 보였다.
- 자식 요소를 누르는 동작과 Frame edit mode는 기존 selection/drag 경로를 유지한다.

### Verification

- page-body drag gesture, transient Skia render/cache, selection outline targeted Vitest PASS

## [Canvas page title 선택·드래그 복구] - 2026-08-02

### Bug Fixes

- Canvas page title pointer 경로가 drag owner만 claim하고 `currentPageId`를 갱신하지 않아, title을 클릭해도 해당 page가 선택되지 않던 문제를 수정했다.
  - **Why**: title hit-test가 중앙 selection handler를 `__handled`로 막은 뒤 page selection을 수행하지 않아 active page가 이전 값에 남았다.
- title을 클릭하면 해당 page가 선택되고, 같은 title에서 바로 drag하면 기존 page-position drag가 이어서 동작한다.

### Verification

- page title selection/page drag/gesture/Skia overlay targeted Vitest 확인
- local Builder에서 title click의 page selection 및 title drag에 따른 page 좌표 저장 확인
- `pnpm run codex:preflight` PASS

## [Canvas page drag presentation 최적화 — ADR-176 Implemented] - 2026-08-01

### Performance

- page title drag 중에는 active page 위치만 transient presentation으로 갱신하고,
  정상 종료 시 canonical `updatePagePosition`을 한 번만 호출하도록 변경했다.
- cached Skia command/tree content는 유지하고 page root late transform만 적용해
  drag 중 scene snapshot·renderer input·content cache fan-out을 줄였다.

### Interaction

- page drag를 shared gesture owner에 연결하고 `pointercancel`, `Escape`, blur,
  visibility change, unmount 및 breakpoint/canonical position 교체 시 stale commit을
  차단한다.
- page title, workflow frame, body selection/hit-test가 같은 presentation position을
  읽도록 정렬했다.
- 실제 multi-page Builder에서 page drag success/cancel, Space pan, body hit-test,
  breakpoint snapshot 보존 및 active breakpoint 전용 `화면 정렬`을 확인했다.

## [명시적 Page 화면 정렬] - 2026-08-01

### Changed

- breakpoint 전환이나 Settings의 page 방향 변경만으로 기존 page 위치를 재배치하지 않도록 변경했다.
- 상단 Zoom popover에 `화면 정렬`을 추가해 현재 breakpoint canvas 크기와 Settings의 방향으로 page들을 명시적으로 재배치한다.

### Bug Fixes

- 최초 project hydration과 breakpoint 전환 초기에 빈 page-position snapshot이 저장되어 page가 `(0, 0)`에 겹치던 문제를 수정했다.
- 아직 snapshot이 없는 breakpoint에 최초 진입할 때 이전 breakpoint의 page 좌표를 재사용해 page가 겹치던 문제를 수정했다.
- page 추가 시 horizontal 전용 계산으로 `vertical`·`zigzag` 배치와 `PAGE_STACK_GAP`이 깨지던 문제를 수정했다.

## [Viewport 입력 스케줄링 통합 — ADR-175 Implemented] - 2026-07-31

### Performance

- Space-drag, wheel pan, Ctrl/Cmd+wheel zoom을 공통 `ViewportInteractionSession`으로
  이관했다. 원시 이벤트마다 발생하던 controller listener fan-out과 canonical
  `setViewportSnapshot()` write를 display frame 및 interaction 종료 경계로 분리했다.
- 상단 zoom popover와 keyboard zoom이 사용하는 `viewportActions`도 동일 command
  arbitration을 거친다. 진행 중 wheel/drag는 먼저 final state를 mirror한 뒤 command를
  적용하므로 stale store state로 zoom을 계산하지 않는다.
- Workflow page focus의 `panToPage` animation, minimap drag, canvas scrollbar thumb drag도
  같은 session lifecycle으로 수렴했다. 새 input/command가 들어오면 진행 중 animation의
  final state를 먼저 보존하고 ownership을 넘긴다.
- breakpoint 전환은 active session의 final mirror를 저장한 뒤 전환·restore command를
  수행해, interaction 중 이전 breakpoint가 stale viewport를 저장하지 않게 했다.
- Unified Skia 경로에서 controller의 display-container attach 여부로 상단 Zoom menu와
  keyboard command가 session을 우회하던 결함을 제거했다. 실제 `확대` smoke에서 `110%`,
  controller listener 1회, mirror commit 1회를 확인했다.
- Phase 3 smoke에서 wheel pan 20회, Ctrl/Cmd+wheel zoom 12회, Space-drag 20회는 각각
  continuous interaction당 mirror commit 1회로 수렴했다. Skia renderer의 잔여 long task는
  input scheduling과 분리해 관찰만 유지하며 ADR-172/173 범위는 변경하지 않았다.
- 상단 ZoomControls는 canonical Zustand가 아니라 controller의
  `ViewportPresentationStore`를 zoom-only로 구독한다. wheel zoom 중 `%`는 rAF 뒤 즉시
  바뀌되 canonical mirror·persistence는 idle 종료 때만 commit하며, pan-only frame은
  zoom UI notification을 만들지 않는다.

### Interaction

- Hand/Pan mode는 drag가 시작되기 전 `Space` keydown만으로도 element와 workflow hover를
  즉시 clear한다. 대기 중인 hover rAF도 취소하며, keyup 뒤에는 다음 pointer move부터만
  hover hit-test를 재개한다. Space를 먼저 놓은 active pan은 pointerup까지 계속 차단한다.

### Verification

- `ViewportInteractionSession`/`viewportActions`/metrics targeted Vitest 18개 PASS
- `pnpm run codex:preflight` PASS (기존 type-check baseline 53건 외 신규 오류 0)
- `viewportPresentation` unit/UI contract 4개 PASS 및 local Builder wheel zoom smoke PASS

## [Paragraph 노드 소유 확정 — ADR-174 Implemented] - 2026-07-31

### Architecture

- **paragraph 소유를 전역 LRU 에서 텍스트 노드로 전환 완결** (ADR-174 Phase 2 재적용 + Phase 3~4, commit: `30c6661fb`/`9fd5233f1`):
  - 오전 되돌림(아래 엔트리)의 진범이 노드 소유 설계가 아니라 폰트 인스턴스 복제 버그(아래 수리 엔트리)로 확정되어, 수리 위에서 설계 원안을 재적용 — 실측: retained **5,336개 보유에도 힙 128 MB 평탄** (구 단가였다면 22 GB 급).
  - Phase 3: 전역 `paragraphCache`(상한 1,000)/전환 플래그/`VITE_PARAGRAPH_CACHE_SIZE` env 전량 제거 — 상한→퇴거→프레임 중 폐기라는 텍스트 소실 병인 자체가 소멸. paragraph 수명 = 노드 수명 (`releaseParagraphsIn` 3지점), fontMgr 무효화는 per-entry 검사.
  - Phase 4 검증: G5 — 편집 즉시 반영(stale 0) / 페이지 전환 왕복 / 줌 10~~14%↔100% ×2 전 텍스트 유지 + 저줌 5,336 → 복귀 490 (해제 경로 실동작). G4 A/B(LRU+수리 팔 대비) — record p50/p95 동등~~우위, 최악 프레임 총비용 동등(longtask max 229 vs 234), 불리 경로는 cold walk record 최대 1건 +41ms (dedup 2.8× 1회성)로 최악 프레임 미형성.
  - 규칙 정정: `canvas-rendering.md` §3 — "Paragraph 캐싱 금지" 는 측정 경로 한정, 렌더 측은 노드 소유 retained + 공유 FontCollection 의무.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererText,nodeRendererState,retainedParagraph,renderCommands,useSkiaNode}.ts`

## [Paragraph 폰트 인스턴스 공유 — WASM 힙 88% 절감, 텍스트 소실 진범 수리] - 2026-07-31

### Bug Fixes

- **paragraph 마다 variable font 인스턴스 ~5.78 MB 가 생성·보유되던 결함 수리** (commit: 후속):
  - **Why**: `ParagraphBuilder.Make(style, fontMgr)` 는 호출마다 새 FontCollection 을 만들고, renderText 가 variable font weight 적용을 위해 pushStyle 하는 `fontVariations: [{axis:"wght"}]` 가 그 collection 별로 **폰트 인스턴스를 복제**시켰다 — paragraph 가 사는 동안 개당 ~5.78 MB 가 함께 산다 (처녀 힙 실측: per-call 5.78 MB/개 vs 공유 collection 0, wght 4종 순환에도 0).
  - 이것이 ADR-174 Phase 2 되돌림(같은 날 오전)의 **진짜 근본 원인** — 노드 소유 설계가 보유 수를 늘리자 잠복 단가가 증폭되어 wasm32 2 GiB 상한 도달 → 할당 전멸 → 텍스트 소실·렌더 정지. 설계 결함이 아니라 선행 잠복 버그였다 (사용자 지적 "버그일 수도 있지 않은가" 가 정확했음).
  - 수리: `SkiaFontManager.getFontCollection()` — 공유 FontCollection (fontMgr 수명 동기, provider 는 resolveFamily 이름 공간 유지) + renderText 를 `MakeFromFontCollection` 으로 전환.
  - 실측 (실사용 22페이지 문서): LRU 팔 **1,090 → 134 MB**, retained 팔(worktree 검증) **2,147(천장) → 134 MB** (보유 345개). 전 페이지 텍스트 정상 렌더 (한글 포함).
  - 정적 가드: `nodeRendererText.static.test.ts` — per-call builder 재도입 차단.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{fontManager,nodeRendererText}.ts`

## [Paragraph 노드 소유 전환 되돌림 — ADR-174 Phase 2] - 2026-07-31

### Bug Fixes

- **텍스트가 다시 렌더되지 않던 회귀 해소 — paragraph 소유 전환 되돌림** (ADR-174 Phase 2, commit: `954c17532`):
  - 증상: 실사용 다중 페이지 문서에서 **도형·버튼은 그려지는데 프레임 여럿의 텍스트만 통째로 빠짐**. 계속 조작하면 캔버스가 통째로 얼어붙고 콘솔에 `RuntimeError: Aborted()`.
  - **Why**: paragraph 수명을 전역 LRU(상한 1,000 키)에서 **텍스트 노드 소유**로 옮기면서 상한이 사라졌는데, composition 캔버스는 22 페이지 프레임을 **동시에** 그리므로 보유 집합이 곧 문서 전체가 된다. CanvasKit WASM 힙이 **2,147 MB = wasm32 주소공간 상한**에 닿아 이후 모든 할당이 실패 → paragraph 생성 실패로 글자만 조용히 빠지고, 이어서 `PictureRecorder` 까지 실패해 렌더 루프가 정지했다. 페이지 전환(`clearSkiaRegistry`)은 이 캔버스에서 아무것도 회수하지 않아 기존 경계로는 회수가 일어나지 않는다.
  - 실측 A/B (같은 문서·같은 뷰포트, 런타임 플래그): `retained ON` 힙 2,147 MB + 텍스트 소실 vs `retained OFF` 힙 1,090 MB 평탄 + 전 프레임 정상. 되돌림 후 재확인 — 22 페이지 전체 렌더 · 힙 1,194 MB · 콘솔 에러 0.
  - 되돌림 범위는 Phase 2 (소유 전환) 한정. **Phase 1 (프레임 중 WASM `.delete()` 지연 폐기) 은 유지** — 소유 모델과 독립적으로 성립하며, 원 버그의 글리프 소실 기제를 끊는 부분이다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{nodeRendererText,renderCommands,useSkiaNode}.ts`

## [렌더링 성능 작업 되돌림 — ADR-172 / ADR-173 Deprecated] - 2026-07-30

### Bug Fixes

- **캔버스 렌더링 회귀 3건 해소 — 원인 작업 전량 되돌림**:
  - 해소된 증상: ① 재래스터 후 **컴포넌트 텍스트가 불특정하게 렌더되지 않음** (초기 화면 밖으로 스크롤 시 어떤 곳은 나오고 어떤 곳은 안 나옴) ② **Page 6~18 정상 미표시** ③ 브레이크포인트 전환이 수십 초 blocking
  - **Why**: ADR-173 Phase 1 이 컬링 반경을 200 → 512px 로 넓혔는데, 이는 blit 적중률을 위해 **매 래스터가 그리는 면적을 약 2배로 늘린 거래**였다 (1500×800 뷰포트 기준 1900×1200 → 2524×1824). 실사용 문서에서 래스터 비용 증가가 blit 절약을 넘어섰고, walk 당 가시 텍스트가 1,416개가 되어 paragraph 캐시 상한(1,000)을 넘기며 프레임마다 스래싱 → delete 된 paragraph 의 WASM 힙 주소 재사용으로 CanvasKit 내부 텍스트 blob 캐시가 stale 히트 → 해당 글리프만 에러 없이 소실됐다.
  - 되돌린 범위: ADR-172(팬 경로 파생 비용 제거) + ADR-173(제스처 중 재래스터 이연) 전 Phase + 편집 프레임 계측·시그니처 캐시 4건 + 당일 텍스트 소실 증상 처치 1건 — 코드 기준점 `61a191b35`
  - ADR 문서 2건은 **음성 결과 기록**으로 보존 (Status → Deprecated, 각 본문에 §되돌림 기록 + 재시도 선결 조건)

### Performance

- **되돌림에 따른 성능 원복**: ADR-172/173 이 주장한 개선(팬 프레임 파생 재구축 0 · 재래스터 14→2 · 드롭 0)은 함께 사라진다. 다만 실사용에서 개선이 체감되지 않았고 회귀만 남았다는 것이 되돌림 사유다 — **게이트 통과(작업량 지표 count=0)가 프레임 총비용 개선을 뜻하지 않았다.** 재시도 시 프레임 총비용 분해가 선행 조건.

## [Absolute Button 좌표 보존 복구] - 2026-07-29

### Bug Fixes

- padding 또는 border가 있는 flex Frame 안의 Button을 `Absolute position`으로 전환하면 좌표가 부모 inset만큼 다시 밀리던 문제를 수정
  - 전환 시 `Left`/`Top`을 부모 border-box가 아니라 Skia absolute layout과 같은 콘텐츠 원점(`border + padding` 이후) 기준으로 기록
  - 현재 breakpoint의 responsive padding과 catalog container fallback도 함께 반영

### Verification

- `TransformSection.test.tsx` — 부모 `padding: 12px 20px`, `borderWidth: 2px`에서 `Left: 38px`, `Top: 31px` 회귀 테스트 PASS
- Builder browser: padding `20px`, border `2px` Frame의 첫 Button을 Absolute로 전환해 `Left: 0`, `Top: 0` 및 화면 위치 유지 확인

## [Absolute Frame의 Hug border-box 크기 복구] - 2026-07-29

### Bug Fixes

- `position: absolute`로 전환한 Hug Frame이 자식 콘텐츠 영역만큼만 `158 × 30`으로 계산되어, 동일한 flow Frame의 `202 × 74`와 달라지던 문제를 수정
  - **Why:** absolute 자식 배치가 auto 크기 컨테이너의 content-box 반환값을 곧바로 layout box로 기록해 padding `40px`과 border `4px`를 누락했다
  - absolute 컨테이너는 배치 직전에 자체 padding·border를 한 번 반영해 CSS와 같은 border-box를 기록하며, leaf의 기존 intrinsic border-box 계약은 유지

### Verification

- `cargo test` (`packages/composition-engine`) — 320 unit, 15 golden, 11 tree golden PASS
- `pnpm wasm:build:engine` PASS
- Builder browser: 현재 Home의 absolute Frame 선택 크기 `202 × 74` 확인

## [Nodes/Skia drag-drop 구조 이동 수정] - 2026-07-29

### Bug Fixes

- Nodes panel에서 같은 부모 안의 요소를 drag-drop해도 `moveElementToContainer`가 조기 종료해 순서가 바뀌지 않던 문제를 수정
  - same-parent 이동도 전달된 `insertionIndex`로 canonical `children[]`를 재배치하고 store mirror 및 IndexedDB document를 동기화
  - legacy fallback에서도 이동 요소를 기존 sibling 목록에서 먼저 제외해 중복 삽입을 방지
- Skia canvas에서 Body의 요소를 Body 내부 Group/Frame 위로 drag-drop할 때 Group insert 대신 Body reorder로 남던 문제를 수정
  - hit-test가 현재 부모의 descendant container를 가리키면 same-parent 인접 여부와 무관하게 해당 container reparent를 우선
  - 이미 Group 내부에 있는 요소의 same-parent reorder와 현재 부모 hit 경로는 유지
- Absolute 요소를 Group/Frame/ButtonGroup 등 Body가 아닌 유효한 container 위로 drag-drop하면 해당 container의 flow child로 reparent하고 `position` 선언을 제거
  - 기존 `Left`/`Top`과 나머지 style은 보존하며, Body 빈 공간 및 다른 Page로 이동하는 경로는 Absolute 상태를 유지
  - Nodes panel reparent도 Skia와 같은 공용 Absolute-release 계약을 사용하고, canonical move와 style update를 하나의 history transaction으로 기록

### Verification

- `pnpm -F @composition/builder exec vitest run src/builder/stores/__tests__/elementMove.test.ts src/builder/workspace/canvas/selection/dropTargetResolver.test.ts`
- cross-check targeted Vitest: store/history/DragBridge/drop resolver/canonical mutation/Transform 12 files, 135 tests PASS
- Builder browser: Nodes panel keyboard drag-drop로 동일 부모의 `frame`을 마지막 위치로 이동한 뒤 Layer 순서 변경 확인
- Builder browser: Nodes panel keyboard drag-drop로 Absolute Button을 ButtonGroup의 level 3 child로 편입하면 `Absolute position`이 해제되고, Undo 한 번으로 level 2 및 Absolute 상태가 함께 복원됨을 확인
- Builder browser: Skia pointer drag로 Absolute Button을 ButtonGroup에 드롭한 뒤 level 3 child 편입 및 `Absolute position` 해제 확인
- `pnpm run codex:preflight` PASS

## [Transform Absolute position 토글 추가] - 2026-07-29

### Added

- Style Panel의 `Transform` section에서 `Left`, `Top` 오른쪽 action을 `LayoutFreeform` 아이콘의 `Absolute position` 토글로 연결
- Box Shadow의 `Inset shadow`와 같은 `SwatchIconToggleButton` 패턴을 사용하며, 활성화 시 `position: absolute`, 비활성화 시 `position` 선언만 제거
- flex/inline-flex 자식에서 토글을 활성화하면 현재 scene x/y를 parent-local `Left`/`Top`으로 캡처해 flow에서 빠진 뒤에도 시각적 위치를 유지하고, 비활성화 시에는 offset을 보존
- Transform reset/dirty 및 responsive style eligibility에 `position`을 포함
- `Left` 단위는 `px / % / vw`, `Top` 단위는 `px / % / vh`만 노출하고 unit selector의 `reset` action을 제거
- Absolute 해제 상태에서는 `Left`/`Top`을 `auto`로 비활성 표시하되 저장된 offset은 보존하고, Absolute 상태에서 입력을 비우면 해당 inline offset만 제거

### Bug Fixes

- Absolute 요소를 다른 Page로 드롭할 때 canonical parent를 destination container로 이동하고 `Left`/`Top`을 destination-local 좌표로 변환
- cross-page reparent와 좌표 갱신을 하나의 history transaction으로 묶어 Undo 한 번에 원래 Page와 좌표가 함께 복원되도록 수정
- Pencil과 동일하게 Absolute 활성화만으로는 현재 Group/Frame/Container 레이어를 유지하고, 빈 canvas 영역으로 드롭할 때만 canonical Page Body의 첫 번째 직계 자식으로 승격해 Layers 최상단에 배치
- Body 승격은 기존 destination-local `Left`/`Top` 변환과 history transaction을 재사용해 화면 위치를 유지하고 Undo 한 번으로 원래 레이어에 복귀
- 일반 flow 요소를 reorder할 때 Absolute sibling을 placeholder와 sibling animation의 flow 계산에서 제외해 `Left`/`Top` 좌표에 고정

### Verification

- Transform/PropertyUnitInput/reset targeted Vitest 3 files, 85 tests PASS
- Builder browser: `Left`를 `24`로 설정한 뒤 Absolute 해제 시 `auto` disabled 표시, 재활성화 시 `24` 복원 확인
- Builder browser: Left unit `px / % / vw`, Top unit `px / % / vh`, 빈 입력 Enter의 inline offset 제거 확인
- Publish render model과 standalone HTML payload가 fractional Absolute offset(`left: 60.123px`, `top: 45.678px`)을 반올림하거나 숫자로 강제 변환하지 않고 보존하는 회귀 테스트 추가
- `pnpm run codex:preflight` PASS

## [Button icon picker 중첩 버튼 오류 수정] - 2026-07-29

### Bug Fixes

- Button 계열의 icon이 활성화된 inspector에서 picker trigger 내부에 clear button이 중첩되어 hydration warning이 발생하고, clear 클릭 시 icon picker까지 열리던 문제를 수정
- **Why:** 공용 `PropertyIconPicker`의 trigger와 clear action이 하나의 React Aria `Button` 안에 구성되어 `<button>`이 중첩되었으므로, 두 action을 같은 control group의 sibling button으로 분리

## [Transform Min/Max 빈 값의 단위 선택 동작 수정] - 2026-07-29

### Bug Fixes

- `Min W`, `Max W`, `Min H`, `Max H`가 unset 상태에서 `0`으로 표시되고 단위만 선택해도 `0` 값이 저장되던 문제를 수정
- 빈 constraint의 단위 선택은 로컬 draft로만 유지하고, 숫자를 입력해 Enter 또는 blur할 때 선택한 단위와 함께 처음 저장
- constraint 단위 목록에서 기본 W/H sizing과 일관되지 않던 `rem`을 제거

## [Style Panel breakpoint 중복 배지 제거] - 2026-07-29

### Changed

- Style Panel 상단의 `styles-breakpoint-badge`와 Responsive section 제목의 `responsive-badge`를 제거해, 현재 breakpoint 정보가 Responsive visibility 컨트롤에서만 한 번 표시되도록 정리
- badge 전용 렌더링 helper와 CSS를 함께 제거하되 Responsive override picker·chip·visibility 동작은 유지

## [Transform 크기 모드를 Fixed · Fill · Hug로 정리] - 2026-07-29

### Changed

- **W/H Sizing을 `Fixed / Fill / Hug` 계약으로 정리**:
  - 사용자 노출 명칭 `Fit`을 `Hug`로 바꾸되 저장 key `fit`과 CSS `fit-content`는 기존 문서 하위호환을 위해 유지
  - `Fixed` 전환 시 현재 렌더 크기를 `px` fallback으로 사용하고, 한 축의 전환이 다른 축의 `Fill` 속성까지 지우지 않도록 flex/grid 축 소유권을 분리
  - active breakpoint 및 Spec 기본 크기를 반영해 현재 W/H mode를 판정
- **Transform 기본 단위 목록 축소**: Width는 `px / % / vw`, Height는 `px / % / vh`만 노출하고 기존 CSS unit 파싱·저장 지원은 유지
- **`Self Align` 컨트롤 제거**: 중복 정렬 UI만 제거하며, `Fill`과 기존 문서 렌더링에 필요한 `alignSelf`/`justifySelf` CSS 지원은 유지

## [증분 skip 이 요소 크기를 매 편집마다 부풀리던 문제] - 2026-07-28

### Bug Fixes

- **다른 요소를 편집할 때마다 무관한 요소의 높이가 누적으로 커지던 문제** (사용자 보고 2026-07-28):
  - Toolbar 의 gap 을 바꾸면 components 페이지의 GridListItem origin 이 **68 → 120 → 172 …** 로 회당 **+52**, ListBoxItem 이 **+16** 씩 자랐다. 새로고침하면 원래 값으로 돌아왔다
  - **Why**: 엔진의 증분 skip(`solve_node`)이 저장된 `node.layout` 을 반환했는데, 그 값은 배치 단계에서 **부모가 border-box 로 덮어쓴** 것이다. auto 축의 반환 계약은 content-box 라 부모가 `padding+border` 를 **다시** 더했다 — skip 될 때마다 그만큼 부풀고, 빌더는 편집당 `computeLayout` 을 2회 돌려 `2×(padding+border)` 가 누적됐다
  - 증상이 **편집한 요소가 아니라 형제/무관 요소**에 나타나고(편집 대상은 dirty 라 skip 되지 않음), padding 이 0 인 요소는 무증상(Form 168 고정)이라 컬렉션 컴포넌트 고유 결함처럼 보였다
  - 함께 정정: 최초 로드 값에도 이미 1회분이 섞여 있었다 — GridListItem `94 → 68`, iconButton `40 → 30` (둘 다 CSS 계산값과 일치)
  - 수정: `TreeNode::last_solved` 에 **반환값**을 따로 저장하고 skip 이 그것을 돌려준다. 측정 패스 snapshot/restore 도 3종 → 4종으로 확장
  - 위치: `packages/composition-engine/src/tree.rs` · 회귀 감시 `incremental_skip_is_idempotent_for_padded_auto_container`

## [엔진 기본 축 전수 정합 — ADR-170 격자 2,702 조합 발산 0] - 2026-07-28

레이아웃 엔진의 Chrome 발산을 "증상 발견 → 수정" 이 아니라 **직교 격자 전수 대조**로 닫았다. display × width × height × min/max × leaf 종류 × 부모 컨텍스트를 곱한 2,702 조합에서 도입 시점 **727 발산 (26.9%)** 이 나왔고, 9개 군집으로 나눠 wave 1~7 로 전건 해소했다 (이연 0건).

### Bug Fixes

- **컨테이너의 `width: min-content / max-content / fit-content` 가 자기 내용을 못 읽던 문제** (군집 B, 157건):
  - 키워드 폭이 부모 intake 의 `CONTENT` 센티넬로만 처리되어, 실제로 소비된 값이 일반 solve 의 **content bounding box** — auto 자식이 stretch 된 폭까지 포함된 값이었다
  - **Why**: 확정 폭 자식은 min==max==bbox 라 **우연히** 정합이었고, 측정 스칼라 leaf 에서만 stretch 폭이 bbox 를 밀어 올렸다 (`width:min-content` 상자가 부모 폭 전체가 됨 — Chrome 50 / 엔진 300). 대조군 없이 보면 "엔진이 키워드를 무시한다" 로 잘못 귀속된다
  - 수정: `solve_node` 가 `measure_intrinsic_width` 로 해소해 definite 로 dispatch (CSS-SIZING-3 §5). 측정 패스 안에서는 재진입 대신 키워드가 요구하는 모드로 센티넬 교체 (§5.2)
  - 위치: `packages/composition-engine/src/tree.rs`
- **`min-width`/`max-width` 로 정해진 폭이 자식 배치에 반영되지 않던 문제** (군집 A, 339건):
  - clamp 가 부모 intake 에만 걸려 **상자만 clamp 되고 자식들은 clamp 이전 폭 기준**으로 배치됐다 (`w=120px+minW200`: 상자 200 / 자식 120 · `w=auto+maxW60`: 상자 60 / 자식 300)
  - **Why**: used size 는 clamp **뒤** 값이고 그것이 내부 배치·파생의 입력이다 (CSS-SIZING-3 §5.1). 기존 규칙이 flex main/cross + grid block 3축만 덮어 인라인 축이 비어 있었다
  - 수정: `solve_node` 가 dispatch 전에 clamp. auto 폭은 block 부모 + clamp 바인딩 시에만 definite 승격 (flex/grid item 의 used 크기는 커널 소관 유지)
- **`aspect-ratio` 가 clamp 전 폭으로 파생하고, stretch 로 정해진 폭에서는 아예 전송되지 않던 문제** (군집 G·F, 10건):
  - 실측 (`ratio 2`, 내용 50): `w:120px+maxW60` → Chrome 50 / 엔진 60 · 양축 auto (부모 300) → Chrome 150 / 엔진 50
  - **Why**: 전송 입력은 **used size** 다 (CSS-SIZING-4 §5) — clamp 뒤 값이어야 하고, block-level stretch 로 정해진 폭도 입력이 된다. w→h 전송은 §5.2.2 자동 최소(content 하한)의 대상이라 전송값을 굳히면 내용이 넘친다
- **flex item 재-solve 가 `%` 높이를 컨테이너 content 크기에 풀던 문제** (군집 C, 108건):
  - `flex-col(height:auto)` 안의 `h=50%` 상자가 content 50 의 절반인 **25** 로 붕괴하고 내부 자식까지 25 기준으로 축소됐다
  - **Why**: `solve_flex` 3.5 의 auto-main fallback 이 음수 센티넬 기준이라 auto 컨테이너에서 **항상** 재-solve 가 발생했고, 그 재-solve 가 `used_main` 을 상속 available 로 내려 §10.5 게이트를 우회했다. fallback 을 "자식이 실제로 solve 된 available" 로 정정하니 불필요 재-solve 자체가 사라졌다
- **column flex 의 라인 cross 가 content 로 떨어지던 문제** (군집 E, 16건): 커널 `cross_definite` 가 `explicit_w` 만 봐서, 명시 폭이 없어도 block-level stretch 로 확정인 column cross 를 놓쳤다 (§9.4 step 8 → step 11 stretch 가 auto-cross leaf 를 content 까지만 늘림 — Chrome 300 / 엔진 90)
- **단독 `fr` 트랙이 자식 내용보다 작아지던 문제** (군집 D, 29건): `1fr` = `minmax(auto, 1fr)` (CSS-GRID-1 §7.2.4) 이 파서에 없어 base 를 채울 자리가 없었다. 2단계 분배도 §12.7.1 freeze-restart 가 아닌 근사였다 (`1fr 1fr`/120, 기여 90·30 → CSS 90·30 / 엔진 60·60)
- **grid 트랙 기여가 margin 을 빼먹던 문제** (군집 H, 45건): §12.5 기여는 **margin-box** 인데 content-box 로 산출해, 누락된 margin 이 §12.8 균등 분배로 갈라져 정확히 절반씩 어긋났다 (실측 165 / 160). `%` margin 은 순환이라 0 으로 본다
- **TS 선해석이 엔진의 정확값을 근사로 덮던 문제** (군집 I, 23건): `enrichWithIntrinsicSize` 의 `calculateContentWidth` 근사가 컨테이너 키워드 폭을 주입하고 있었다 (손자 70px 를 품은 block 의 `fit-content`: DOM 70 / 주입값 80). 통과 게이트를 grid 한정에서 **자식 보유 컨테이너 전체**로 확대 — 자식 없는 합성 leaf(INLINE_BLOCK/CIRCLE)는 엔진이 content 를 모르므로 주입 잔존
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

### Architecture

- **결정적 전수 격자 도입** — `apps/builder/tests/parity/basicAxis{ContainerSize,ChildSize,Nesting}.browser.test.ts` (2,702 조합). 발산은 **양방향 ratchet** (`basicAxis.known.ts`) 로 잠근다 — 신규 발산도 red, 해소된 발산도 (목록에서 지우라고) red. 현재 전 목록 빈 배열
  - 격자 3 (중첩 전파) 은 도입 시점부터 engine·pipeline **전건 정합** — 발산은 전부 "한 노드가 자기 크기를 정하는 단계" 에 있고, 정해진 크기가 아래로 전파되는 경로는 이미 닫혀 있었다
- **grid 재진입의 트랙 freeze 제거** — freeze 는 §12.7.1 base 부재의 **우회**였음이 확인됐다. base 공급 후에는 원본 토큰 재계산이 같은 값을 알고리즘으로 재현하고(`1fr 1fr`/min-content → 40·30), clamp 로 커진 컨테이너의 §12.8 stretch 와 `%` 트랙 재해소가 함께 살아난다. 암묵 열(명시 template 없음)만 1차 합성 px 유지
  - 이로써 **구 잔존 "grid `%` 트랙 내부 배분" 이 부수 해소**됐다 (`50% auto`/max-content → DOM 90·90 = 엔진). 같은 날 앞선 엔트리의 "grid 는 트랙을 얼려서 넘긴다" 서술은 본 변경으로 대체됨
- **규칙 이관** — `.claude/rules/layout-engine.md` 에 신규 절 4개(컨테이너 키워드 소유권 / flex 재-solve 누수 / 단독 `fr` base / 격자 사각 목록) + 기존 절 정정(used size 네 축, freeze 관련 서술)

### Performance

- 엔진 마이크로벤치 동일-머신 A/B (수정 전 `605f856f7` 대비): **회귀 0** — `grow_nowrap` 19.0→17.1µs, `tree_solve` depth1 11.5→9.7µs 개선, 나머지 노이즈 밴드 내. wave 2 가 도입한 `NodeStyle` 전체 clone(50필드 힙 복제)을 단일 borrow 로 교체한 결과

## [shrink-to-fit 컨테이너 — 크기 확정 뒤 자식 재배치] - 2026-07-28

### Bug Fixes

- **shrink-to-fit 컨테이너 안에서 `%` 크기와 auto 폭 자식이 잘못 배치되던 문제**:
  - 인라인 available 이 미결정이면 컨테이너 크기가 자식으로부터 나오는데, 그 pass 에서 자식의 `%` 는 기준이 없어 `auto` 로 풀리고 auto 폭 블록 자식은 stretch 대신 fit-content 가 된다. 엔진이 거기서 멈춰 있었다
  - **Why**: 그 해석은 **intrinsic 기여를 구하는 동안만** 맞다 (CSS-SIZING-3 §5.1 순환 백분율). CSS 는 크기가 정해진 **뒤** 그 크기를 containing block 으로 삼아 자식을 정상 배치한다
  - 실측 발산 (상자 폭 120 확정): `width:50%` → Chrome 60 / 구 엔진 120 · `width:150%` → 180(넘침) / 120 · `marginLeft:10%` → x=147·w=108 / x=135·w=120 · auto 폭 짧은 형제 → 120(stretch) / 40
  - 수정: `solve_block` / `solve_flex` / `solve_grid` 말미에 확정 폭으로 **1회 재진입**. 컨테이너 상자는 1차 pass 의 intrinsic 크기를 유지한다 (자식이 더 커지면 CSS 도 넘치게 둔다)
  - grid 는 트랙을 **얼려서** 넘긴다 — 원본 토큰으로 다시 세우면 `fr` 이 확정 폭을 나눠 가져 `1fr 1fr`/min-content 가 Chrome 40·30 대신 35·35 가 된다
  - 위치: `packages/composition-engine/src/tree.rs`
- **명시 열이 없는 grid 의 폭이 미결정 센티넬(-1) 로 보고되던 문제**:
  - `grid-template-columns` 미지정이면 auto-placement 가 암묵 열을 만들고 그 크기는 `grid-auto-columns`(기본 `auto`)가 정하는데, intrinsic 경로가 "명시 토큰 없음" 으로 그냥 빠져나갔다
  - **Why**: `container_w` 가 미결정 센티넬 그대로 남아 그 값이 컨테이너 폭이 됐다. 행 축은 암묵 트랙을 만들고 있었으므로 열 축만 빠져 있던 비대칭
  - 라이브 실측: `align-items:center` 아래 Toolbar 를 `display:grid` 로 바꾸면 폭 **-1** → 수정 후 **64** (자식 4개가 암묵 1열에 정상 배치)
  - 위치: `packages/composition-engine/src/tree.rs::solve_grid`

### Architecture

- **grid auto 크기 반환이 content-box 계약으로 정정**: intrinsic 경로가 `container_w + own_pb_h` 를 반환해 부모 커널의 pad_border 가산과 **이중 계산**됐다 (실측 padding 10 grid: DOM 140 / 구 엔진 160). auto 축 반환은 content-box 라는 기존 계약에 맞췄다
- **회귀 감시**: `apps/builder/tests/parity/shrinkToFitInline.browser.test.ts` 신규 (49 케이스 — 재해소 39 / 중첩 1 / grid 키워드 2 / 암묵 열 5 / 잔존 2). 민감도 — 재진입 무력화 19 red, grid 트랙 freeze 제거 10 red, 암묵 열 합성 무력화 6 red

## [Container Align — 비-stretch 교차축에서 컴포넌트가 접히던 문제] - 2026-07-28

### Bug Fixes

- **스타일 패널의 Container Align 을 선택하면 등록된 컴포넌트가 아이콘 폭만 남기고 접히던 문제**:
  - 라이브 실측(components 페이지): GridList **12px** / MenuItem **24px** / ListBoxItem **48px** — 폭을 가진 아이콘만 남고 텍스트가 0 이었다. 수정 후 MenuItem 91 / ListBoxItem 115 / GridListItem 125
  - **Why**: Container Align 9칸은 전부 non-stretch `align-items` 라 auto-cross 자식이 **shrink-to-fit** 이 되어 `INDEFINITE_AVAIL(-1)` 을 받는데, 그 상태에서 크기를 만들어 내는 경로 **둘 다** 비어 있었다 — ① 엔진 `solve_block` 이 auto 폭 자식을 센티넬로 stretch 해 폭이 `-1` ② TS `enrichWithIntrinsicSize` 가 `width:%` 텍스트 leaf 에 측정 스칼라를 공급하지 않아 폭 0. 근거는 한 규칙이다: 늘어날 available 이 없으면 intrinsic 기여는 stretch 가 아니라 **content** 이고(CSS-SIZING-3 §5), containing block 이 미결정이면 `%` 는 `auto` 처럼 동작한다(§5.1 순환 백분율)
  - **통로는 ADR-151 B22** — catalog `Text.containerStyles.width = "100%"` 선주입이 키워드도 `auto` 도 아니라 스칼라 게이트에서 탈락했다. stretch 부모에서는 `%` 가 해소되어 스칼라가 소비되지 않으므로 게이트를 넓혀도 기존 경로는 불변
  - ADR-169 Phase 1 이 **같은 처방**을 측정 패스(`-2`/`-3`)에만 걸어 둔 상태였다 — `INDEFINITE_AVAIL(-1)` 로 확대
  - 위치: `packages/composition-engine/src/tree.rs::solve_block` / `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (`needsWidth`)
  - **주의**: Direction 미지정 상태에서 Container Align 을 누르면 `flexDirection` 기본값 `row` 가 함께 쓰여 전 자식이 한 줄로 shrink 한다 — 그건 CSS 대로이고 본 결함과 무관하다

### Documentation

- **`.claude/rules/layout-engine.md`**: §"늘어날 available 이 없으면 기여는 content 다 — Container Align 교차축" 추가 (두 경로 표 · B22 통로 · 잔존 2건 · 금지 패턴)

### Infrastructure

- **Chrome 실측 fixture 신규**: `apps/builder/tests/parity/containerAlign.browser.test.ts` (engine block 4 · engine flex 3 · pipeline 3 · 잔존 1). DOM leg 은 실제 Preview 와 같게 텍스트에 `width:100%` 를 준다 — 빼면 오라클이 실물과 달라져 가짜 발산이 난다. 민감도 — 엔진 확대 되돌림 3 red / TS 게이트 되돌림 2 red

## [body 뷰포트 분리를 전 배치 문법으로 — Chrome 기준 정렬] - 2026-07-28

### Bug Fixes

- **`min-height`/`max-height` 로 크기가 바뀐 컨테이너의 내부 배치가 clamp 이전 값으로 굳던 문제 — cross 축·grid 로 확대**:
  - `row + minHeight:400` 안의 크기 미지정 자식이 Chrome 400 / 엔진 **0** (라인 cross 가 컨테이너 inner cross 로 안 잡혀 `stretch` 가 죽음)
  - `minHeight:400` + `gridTemplateRows: 60px 1fr` 이 Chrome 60/340 / 엔진 **60/60** (`1fr` 행·`align-content`·§12.8 stretch 가 전부 `explicit_h` 게이트)
  - **Why**: 앞선 커밋이 flex **main** 축만 고쳤는데, body 주입을 전 배치 문법으로 넓히려면 나머지 두 축도 같은 규칙이어야 한다. grid 는 트랙 sizing 자체가 definite 여부에 매달려 있어 clamp 된 높이로 `solve_grid` 를 **재진입**한다(2회로 종료, 재진입 전 자식 subtree dirty 복구)
  - 위치: `packages/composition-engine/src/tree.rs::solve_flex` (3.7) / `::solve_grid`

- **body 뷰포트 주입을 배치 문법과 무관한 한 규칙으로**:
  - 직전 커밋은 세로 flex body 만 `min-height` 로 바꿨다. block/row flex/grid 는 확정 높이가 남아 `height:50%` 자식이 페이지 높이의 절반으로 **해소**됐다 — Chrome 은 0 (body 가 `min-height:100vh` 라 백분율 높이가 안 풀린다)
  - **Why**: 주입 축을 갈래로 두면 갈래마다 Chrome 발산이 따로 남고 프레임 슬롯 정책도 축마다 달라진다. 이제 폭은 `width = pageW`, 블록 축은 `min-height = pageH` 하나이고 상자 크기만 Step 5 가 뷰포트로 환원한다
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`

- **프레임 슬롯의 블록 축 크기 주입 제거**:
  - `resolvePageSlotStyle` 이 flex row 프레임의 슬롯에 `height:100%` 를 주입했는데, body 가 `min-height` 로 서면 그 백분율은 해소되지 않으면서 "크기를 명시" 한 것이라 `align-items:stretch` 까지 꺼져 슬롯이 **0** 이 된다 (Chrome 실측 동일)
  - 주입을 빼면 stretch 가 슬롯을 라인 cross 로 채운다(실측 80x400 / 310x400, DOM 동형). 인라인 축(`width:100%`)은 부모 폭이 확정이라 유지. grid 분기는 2026-07-27 에 같은 결론에 먼저 도달해 있었다
  - 위치: `apps/builder/src/adapters/canonical/pageFrameProjection.ts`

### Documentation

- **`.claude/rules/layout-engine.md`**: §"컨테이너의 used size 는 min/max clamp 뒤의 값이다 — 세 축 모두" 로 확장(축별 거처 표 + grid 재진입 계약), §"body 는 뷰포트가 아니다" 를 단일 규칙으로 갱신 + 잔존 1건 기록(명시 `height:%` cross 자식이 Chrome 0 / 엔진 stretch — 본 변경 이전에도 동일, 실사용 경로 없음)

### Infrastructure

- **fixture 보강**: `bodyViewportBox.browser.test.ts` 14건 (block/row flex/grid body 를 각각 Chrome 대조), `apps/builder/src/adapters/canonical/__tests__/pageSlotStyle.test.ts` 5건 신규 — 슬롯 정책이 무방비였다(복원해도 0 red). 민감도 — flex cross 1 red / grid 1 red / 슬롯 주입 복원 2 red

## [body 는 뷰포트가 아니다 — 세로 flex 페이지의 자식 압축] - 2026-07-28

### Bug Fixes

- **페이지 body 를 `display:flex` + `flex-direction:column` 으로 두면 등록된 컴포넌트가 통째로 눌리던 문제**:
  - 실측(components 페이지 390×844): 자식 높이 합 1423 이 정확히 페이지 높이 844 로 압축 — ListBox 162→35.6 / GridList 164→29.4 / Card 322→85.6. Card 는 **내용 305 가 85.6 상자를 넘어 다음 형제 위로 겹쳤다**
  - **Why**: Chrome 은 페이지를 뷰포트(확정 높이 · clip + scroll)와 body(`min-height:100vh` · 내용만큼 자람) **두 노드**로 처리하는데, 캔버스에는 뷰포트 노드가 없어 `fullTreeLayout` Step 1.5 가 body 에 `height = pageH` 를 주입해 한 노드가 두 역할을 겸했다. `display:block` 에서는 충돌하지 않던 것이, body 가 세로 flex 컨테이너가 되는 순간 "뷰포트 크기"가 "flex main-size 예산"으로 재해석되며 자식이 예산에 맞춰 축소됐다. 압축을 전량 흡수한 3개(ListBox/GridList/Card)는 주축 `overflow` 가 `visible` 이 아니라 CSS-FLEXBOX §4.5 content floor 가 없는 요소였다
  - 수정: 세로 flex body 에만 `min-height` 주입(압축 소멸, Chrome 동형) + **보고 높이는 뷰포트 상자로 환원** — clip 높이이자 `maxScrollTop` 기준이라, 내용 높이를 보고하면 스크롤이 0 이 되고 넘친 내용이 프레임 밖 캔버스로 도달 불가 상태로 유출된다. block / row flex / grid body 는 확정 높이가 필요해 종전 유지
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (Step 1.5 / Step 5)

- **`min-height`·`max-height` 로 크기가 바뀐 flex 컨테이너 안에서 `flex-grow`/`flex-shrink` 가 안 돌던 문제** (CSS-FLEXBOX-1 §9.4→§9.7):
  - `column + minHeight:400` 안의 `flexGrow:1` 자식이 Chrome 340 / 엔진 **0**. `column + maxHeight:200` 안의 `height:100px` 자식 3개가 Chrome 67씩 / 엔진 100씩
  - **Why**: 컨테이너의 used main size 는 min/max clamp **뒤**의 값이고 flexible length 는 그 값에 대해 풀리는데, 엔진은 clamp 를 배치 **뒤에만** 걸었다(root `fixup_root_self_size` / flex item off 10·12 / grid `track_contribution` 셋 다 이미 배치된 상자만 조정). 프레임 페이지의 content 슬롯이 `flex:1 1 auto` 라 위 body 수정의 전제 조건이기도 하다
  - auto 주축 item 은 §4.5 floor 가 막아 찌그러지지 않는다 — ListBox 형태(`maxHeight:300` + auto 높이 행)는 clamp 후에도 행 100 유지 + 넘침(실측 DOM·엔진 동형)
  - 위치: `packages/composition-engine/src/tree.rs::solve_flex` (3.6)

### Documentation

- **`.claude/rules/layout-engine.md`**: §"컨테이너의 used main size 는 min/max clamp 뒤의 값이다" / §"body 는 뷰포트가 아니다 — 상자는 뷰포트, 배치는 내용" 2개 절 추가 (주입 축 판정 근거 + 금지 패턴)

### Infrastructure

- **Chrome 실측 fixture 신규**: `apps/builder/tests/parity/bodyViewportBox.browser.test.ts` (9건) — 자식 좌표는 `viewport(확정) > body(min-height:100%)` DOM 오라클 대조, body 상자 높이는 오라클 대응물이 없어 빌더 계약으로 분리 단언. 민감도 — 주입 축 되돌림 3 red / 엔진 재분배 무력화 2 red

## [그리드 컨테이너의 블록 크기 = 행 트랙 extent] - 2026-07-28

### Bug Fixes

- **`height:auto` 그리드의 높이가 셀 bounding box 였던 문제** (CSS-GRID-1 §11.1):
  - 컨테이너 높이를 자식 셀들의 bounding box(`max_bottom`)로 잡아 CSS 와 **두 방향으로** 어긋났다 — 트랙보다 작은 자식이면 짧아지고(30px 행 + 20px 자식 → 20), 넘치는 자식이면 따라 늘어났다(30px 행 + 100px 자식 → 100). 빈 트랙은 통째로 빠지고(`30px 40px` + 자식 1개 → 20, CSS 70), 자식 margin 까지 컨테이너를 늘렸다
  - 블록 크기를 **행 트랙 합 + row gap + 자기 padding/border** 로 정정. 넘치는 자식은 흘러넘치고 빈 트랙도 자리를 차지한다
  - **미결정 블록 축의 행 토큰을 자식 기여로 세운다** — 인라인 축의 §12.5–§12.7.1 과 같은 규칙. `1fr`/`%` 는 여유가 없으니 content 크기, `minmax(auto,60px)` 는 §12.6 으로 상한까지. 종전엔 `1fr` 이 상속 available 로 0 이 되고 그 0 위에서 셀 bbox 가 우연히 CSS 값과 맞아 가려져 있었다 — 두 변경이 한 묶음인 이유
  - **암묵 행이 명시 트랙과 함께 만들어진다** — 종전엔 `gridTemplateRows` 가 하나라도 있으면 암묵 행을 아예 안 만들어 범위 밖 자식이 크기 0 트랙에 얹혔다(실측 `30px` 1행 + 자식 3개: DOM 70 / 엔진 50, 셋째 자식이 둘째 위에 겹침). 행 목록 = 명시 토큰 ++ `grid-auto-rows` 순환
  - **자식 → 트랙 매핑을 실제 배치로 교체** — `grid::resolve_child_cells` 를 `place_children` 에서 추출해 트랙 sizing 과 공유한다. `i / col_count` 근사는 CSS §8.5 커서 규칙(definite column 이 커서보다 왼쪽이면 다음 행)을 몰라 **측정한 행과 배치된 행이 갈렸다**(실측: definite-column 자식 2개가 CSS 는 2행인데 근사는 1행 → DOM 400 / 근사 200)
  - **Why**: 트랙 extent 만 고치면 `1fr`/`%` 의 우연한 정합이 깨지고, 배치 매핑을 근사로 두면 측정 대상 자체가 틀린다 — 셋이 한 규칙의 서로 다른 층이라 함께 반영해야 한다
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` 행 트랙 sizing 통합 + `final_h`), `packages/composition-engine/src/grid.rs` (`resolve_child_cells` / `resolve_cells_from_intents` 추출)
  - 검증: Chrome 대조 fixture 신설 `gridContainerBlockSize.browser.test.ts` (engine 30 + pipeline 16 + 잔존 1) / parity 837건 green / Rust 344건 green / builder unit 3012건 green / type-check PASS. 민감도 — 트랙 extent 되돌림 25 red, 미결정 축 기여 해소 무력화 130 red, 암묵 행 생성 무력화 4 red, 배치 매핑 근사 복원 6 red
  - 라이브 확인: 실행 중인 빌더가 로드한 WASM 으로 13형태(트랙>내용 / 자식 넘침 / 빈 트랙 / rowGap / padding / 자식 margin / `1fr` / `50%` / `minmax(auto,60px)` / 암묵 행 / `gridAutoRows` / definite column 역순 / flow:column)를 Chrome 실측과 대조해 전건 일치
  - 잔존: 자식이 **없는** 그리드는 트랙을 세우지 않는다 — `solve_node` 가 in-flow 자식 0 이면 leaf 로 조기 반환한다(실측 `30px 40px` → DOM 70 / 엔진 0). 거처가 트랙 sizing 이 아니라 dispatch

## [그리드 컨테이너의 min/max-content 산출 — ADR-169 grid 이연 해소] - 2026-07-28

### Bug Fixes

- **그리드가 자기 intrinsic 크기를 구하지 못하던 문제** (CSS-GRID-1 §12.5 + §12.6 + §12.7.1):
  - 인라인 축이 미결정이면 나눠 줄 여유가 없는데, `resolve_grid_tracks` 2단계가 `remaining = (container - fixed - gap).max(0.0)` 이라 음수 available 에서 `fr_size = 0` → **fr·auto 트랙이 통째로 붕괴**했다. ADR-169 는 이 때문에 grid 서브트리를 측정에서 아예 제외했고(`subtree_has_grid` 가드), 그 이연이 `containerIntrinsic` I/J 스냅샷(DOM 400 / 엔진 1920)으로 고정돼 있었다
  - `solve_grid` 가 미결정 인라인 축을 감지해 트랙을 **자식 기여**로 세우도록 했다. 세 진입이 한 경로로 모인다 — 측정 모드 센티넬(flex item shrink-to-fit) / `width` 가 intrinsic 키워드 / 상속 available 이 indefinite
  - `fr` 은 §12.7.1 used flex fraction 으로 편다: 후보는 (a) 각 flexible 트랙의 base ÷ factor(factor ≤ 1 이면 base), (b) 그 트랙 아이템의 max-content 기여 ÷ Σfactor(Σ < 1 이면 1). 실측 `3fr 1fr` → uff 60 → 180·60, `0.5fr 0.5fr` → uff 120 → 60·60. **min-content 모드에서는 펴지 않는다**(base 그대로 — `3fr 1fr` → 70)
  - **`%` 트랙은 `auto` 처럼 동작한다** — 백분율의 기준이 지금 구하려는 크기 자신이라 해소할 수 없다
  - **컨테이너 폭은 트랙 extent** 로 정정 — 셀 bounding box 는 자식이 점유한 칸까지라 빈 트랙이 빠졌다(실측 `1fr 1fr` + 자식 1개 → DOM 240, 점유 셀 기준 120)
  - **인라인 축의 stretch-fit 도 definite** 로 판정 — block-level `width:auto` 그리드가 §12.8 stretch 대상이 된다(`gridItemBox` 구 잔존 ② 해소). 블록 축은 그대로 — `height:auto` 는 진짜 미결정
  - **TS 선해석 제거** — `enrichWithIntrinsicSize` 가 grid 컨테이너의 intrinsic 키워드를 `calculateContentWidth` 로 미리 풀어 주입하고 있었다. 그 함수는 트랙을 몰라 자식 폭 합 근사를 낸다(실측 자식 120·60 / `auto auto` → DOM 180, 주입값 80)
  - **Why**: 재개 조건이 "§12 track sizing 의 min/max-content 기여 산출(§12.7.1 포함)" 로 문서화돼 있었고, 그 선행 단계가 같은 날의 §12.5/§12.6 작업으로 섰다. 가드와 `subtree_has_grid` 헬퍼는 삭제
  - 위치: `packages/composition-engine/src/tree.rs` (`grid_intrinsic_track_sizes` 신규 + `solve_grid` 의 `inline_intrinsic` 분기 + `measure_intrinsic_width` 가드 제거), `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
  - 검증: Chrome 대조 fixture 신설 `gridContainerIntrinsic.browser.test.ts` (engine 키워드 47 + flex item 11 + 규칙 2 + 잔존 1, pipeline 6) / `containerIntrinsic` I·J 4 leg 이 이연 스냅샷 → **발산 0** 승격 / `gridItemBox` 잔존 ② → 정합 4종 승격 / parity 790건 green / Rust 344건 green / builder unit 3012건 green / type-check PASS. 민감도 — intrinsic 경로 차단 5 red, §12.7.1 제거 25 red, 트랙 extent → 셀 bbox 4 red, stretch-fit 게이트 축소 1 red, TS 선해석 복원 6 red
  - 라이브 확인: 실행 중인 빌더의 WASM 직접 호출 12형태(키워드 max/min × fr·auto·minmax·gap·빈 트랙, flex item 3종)가 Chrome 실측과 일치
  - 잔존: `%` 트랙의 **내부 배분** — 컨테이너 크기는 맞지만 CSS 는 크기 확정 후 `%` 를 다시 풀어 남은 공간을 재분배한다(`50% auto` / max-content → DOM 90·90, 엔진 120·60). 2-pass 트랙 sizing 이 필요. catalog·앱 소스에 `%` grid 트랙 0건

## [암묵 그리드 행이 `grid-auto-rows` 를 무시하던 문제] - 2026-07-28

### Bug Fixes

- **`gridTemplateRows` 미명시 그리드에서 `grid-auto-rows` 가 통째로 무시되던 문제**:
  - 암묵 행을 자식 intrinsic 으로만 재서 `{n}px` 로 박았고, 명시한 `grid-auto-rows` 는 `grid_layout` 에 넘어가도 이미 치환된 뒤라 읽히지 않았다 (실측 `gridAutoRows:["30px"]` → DOM 30 / 엔진 20)
  - 명시 트랙과 **같은 해소기**(CSS-GRID-1 §12.5 content 기여)를 태우도록 통일 — 측정값이 그 트랙의 기여이므로 `30px` / `min-content` / `minmax(auto,60px)` 가 한 규칙으로 처리되고, 값이 여러 개면 순환한다. 고정 크기면 `auto` 가 아니라 §12.8 stretch 대상에서도 자동으로 빠진다
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` 의 implicit rows 분기)
  - 검증: `gridAutoTrackStretch.browser.test.ts` 잔존 스냅샷 → 정합 케이스 5종으로 승격 / parity 721건 green / Rust 344건 green / type-check PASS. 민감도 — 해소기를 빼면 4 red
  - 라이브 확인: 실행 중인 빌더의 WASM 직접 호출 6형태(미지정 auto·`30px`·`60px`·`min-content`·`minmax(auto,60px)`·순환)가 Chrome 실측과 일치

## [grid item 의 크기 키워드가 셀 폭으로 늘어나던 문제] - 2026-07-28

### Bug Fixes

- **`fit-content`/`min-content`/`max-content` 를 단 grid 자식이 트랙 폭으로 stretch 되던 문제** (CSS-ALIGN-3 §4.1):
  - stretch 는 "아이템의 그 축 크기가 **`auto`**" 일 때만 적용된다. 키워드는 auto 가 아니므로 대상이 아닌데, `place_grid_axis` 의 `explicit` 판정이 `resolve_self_size` 결과(`> 0.0`) 하나였다 — 그 함수는 키워드를 길이로 풀 수 없어 **0** 을 돌려주므로 미설정과 구분되지 않았다
  - 실측(트랙 150, 자식 min-content 40 / max-content 120): `fit-content` DOM 120 / 엔진 150, `min-content` 40 / 150, `max-content` 120 / 150. **`auto` 는 종전에도 정합**(150)이라 어긋난 것은 키워드 축 하나
  - **Why**: 같은 자식이 flex 부모에서는 120·40 으로 정상이었다 — 이 비대칭이 진단 신호였다. 명시 px(`width:40px`)는 이미 존중받고 있었으니 "확정 크기" 개념이 px 에만 걸려 있었던 셈
  - 위치: `packages/composition-engine/src/tree.rs` (`size_is_intrinsic_keyword` 신규 + `solve_grid` 의 `explicit` 판정)
  - 검증: `gridTrackContribution.browser.test.ts` I 그룹 신설(키워드 4 × 부모 3 = 12) / parity 717건 green / Rust 344건 green / type-check PASS. 민감도 — 키워드 OR 제거 시 7 red
  - 라이브 확인: 실행 중인 빌더의 WASM 직접 호출 12형태가 Chrome 실측과 일치

## [그리드 자식의 측정값이 엔진까지 도달하지 않던 문제 — 3결함] - 2026-07-28

### Bug Fixes

- **content 기반 트랙 안의 텍스트가 폭 0 으로 무너지던 문제**:
  - `enrichWithIntrinsicSize` 의 측정 스칼라(`contentMinWidth`/`contentMaxWidth`) 주입 조건이 `isFlexChild && TEXT_LEAF_TAGS` 라 grid 자식이 빠져 있었다. block 자식은 stretch 되어 스칼라가 없어도 되지만 grid 는 트랙이 content 로 정해질 수 있어(`auto`/`min-content`/`max-content`/`fit-content()`) 스칼라 없이는 엔진이 텍스트 크기를 알 길이 없다
  - 증상이 **content 기반 트랙에서만** 드러난다 — `1fr`/`px` 트랙은 자식이 트랙으로 stretch 되어 우연히 맞는다(실측 `1fr auto`/320 값 텍스트 0 vs `1fr 1fr` 156·156 정상). catalog 컴포넌트가 멀쩡했던 것은 값 자식이 `fit-content` 를 달고 있어 우회했기 때문 — 정상 동작이 **우연**이었다
  - `isFlexChild` 자체를 넓히지 않고 별도 신호(`isGridChild`)를 쓴다. 같은 플래그가 flex-grow 억제와 non-container `minWidth` 주입에도 쓰여 무관한 동작이 딸려온다
- **grid 트랙 수를 문자 수로 세던 문제**:
  - catalog 는 `gridTemplateColumns: "1fr auto"` 처럼 **문자열**로 저장하는데 DFS 가 그대로 `.length` 를 세어 트랙 8개로 봤다. 자식 available 이 1/8 로 쪼그라들어 텍스트가 실제보다 훨씬 좁은 폭에서 줄바꿈 측정됐다(실측 6줄 180 → 정정 후 1줄 20). `coerceGridTrack` 정규화 후 계산. gap 도 store longhand(`columnGap`)를 먼저 읽도록 정정 — `gap` 만 읽으면 항상 0
- **비균등 트랙에서 height-for-width 재측정이 돌지 않던 문제**:
  - Step 4.5 는 "enrichment 가 가정한 폭" 과 실배치 폭을 비교해 재측정 여부를 정하는데, 그 가정 폭을 style 로부터 **역추정**했다. grid 는 부모 폭이 아니라 **트랙 추정폭**을 넘기므로 어긋나고, "어느 폭에서도 단일줄" skip 이 잘못 발동해 좁은 추정폭에서 잰 높이가 굳었다 (실측 `1fr auto`/400: DOM 20 / 엔진 40)
  - DFS 가 실제 사용값을 `enrichAvailWidth` 로 batch 노드에 남기고 트리거가 그것을 읽는다. WASM payload 는 `{style, children}` 만 뽑으므로 직렬화 영향 없음
  - **Why**: 셋이 겹쳐 있어 한 결함의 fixture 가 다른 결함을 가린다 — 가정 폭을 고치면 트랙 수 결함이 재측정으로 흡수된다. 그래도 트랙 수는 고쳐 둔다(재측정이 못 도는 경로의 1-pass 정확도)
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/{utils,fullTreeLayout,persistentTaffyTree}.ts`
  - 검증: `gridTrackContribution.browser.test.ts` pipeline 그룹 확장(content 트랙 4 + 대조군 2 + 비균등 재측정 7 + 잔존 2) / parity 705건 green / builder unit 3012건 green / type-check PASS. 민감도 — 스칼라 게이트 5 red, 가정 폭 2 red
  - 라이브 확인: 실행 중인 빌더에서 catalog 문자열 형태(`"1fr auto"`)와 배열 형태가 같은 결과로 수렴(`1fr 1fr 1fr` → 133x60, Chrome 실측 일치)
  - 잔존: grid item 의 **width 키워드**(`fit-content`/`min-content`/`max-content`)가 무시되고 트랙 폭으로 stretch 된다(DOM 316.6 vs 340). `width:auto` 는 정상이라 키워드 축 하나이며, 본 변경 이전부터 동일

## [그리드 트랙이 자식의 content 기여를 반영하지 않던 문제] - 2026-07-28

### Bug Fixes

- **`min-content`/`max-content`/`fit-content()` 트랙 키워드가 통째로 `auto` 폴백(=1fr 근사)이던 문제** (CSS-GRID-1 §12.5 "Resolve Intrinsic Track Sizes"):
  - `<track-size>` 는 언제나 min·max 두 개의 sizing function 인데 엔진은 `auto` 토큰 하나만 알았다. `tree.rs` 가 그 토큰을 "컨테이너 폭으로 solve 한 결과" **한 값**으로 치환했고, 나머지 키워드는 `grid.rs` 파서에서 `auto` 로 떨어져 여유를 나눠 가졌다. 실측 컨테이너 300 기준 — `min-content` DOM 40 / 엔진 200, `max-content` 120 / 200, `fit-content(60px)` 60 / 200
  - **한 값으로는 맞출 수 없다**: 자식 min 40 / max 120, 두 열에서 컨테이너를 바꾸면 CSS 는 150→75·75, 300→150·150, 500→250·250 으로 간다. base(min-content) ↔ 상한(max-content) 사이를 §12.6 이 움직이고 상한을 넘는 여유만 §12.8 이 가져가기 때문. 트랙 모델에 base·growth limit 를 분리하고 자식 기여를 공급해 세 점이 동시에 맞는다
  - **`minmax(auto, px)` 의 base 가 0 이던 문제**도 해소 — 내용 120 인 트랙이 상한 80 에서 멈추던 것이 §12.4 대로 120 이 된다
  - **§6.6 자동 최소 크기 clamp** 신규: "고정 max 트랙만 span 하는" 아이템의 content-based minimum 은 그 상한으로 잘린다. 단 **아이템의 선호 크기가 `auto` 처럼 동작할 때만** — 실측(트랙 `minmax(auto,20px)`, 내용 min 40) `width:auto`→20 / `width:90px`→90 / `min-width:70px`→70 / `width:50%`→20. 트랙 쪽도 min sizing 이 `auto` 일 때만이다(`minmax(min-content,20px)`→40)
  - **`minmax()` 안의 `%`** 가 `1fr` 로 떨어지던 문제: `minmax(auto,10%)` 가 여유를 전부 먹었다 (DOM 30 / 엔진 200)
  - **Why**: 자식을 아는 층은 `tree.rs` 이고 `grid.rs` 는 확정된 트랙만 sizing 한다. 그래서 content 함수 해소를 tree 층에 두고 `grid_layout` 의 wasm 시그니처는 그대로 뒀다. 인라인 축 기여는 ADR-169 의 `measure_intrinsic_width` 를 그대로 재사용하고, 블록 축은 높이가 내용 크기 하나뿐이라 `(h, h)` 를 공급해 종전 동작을 보존한다
  - 위치: `packages/composition-engine/src/tree.rs` (`SizingFn`/`split_track_sizing`/`resolve_track_with_contribution`/`clamp_auto_min_contribution`/`col_contribution` 신규 + `solve_grid` 측정 블록 재작성), `packages/composition-engine/src/grid.rs` (`parse_minmax` % 해석, `tokenize_template` 공개)
  - 검증: Chrome 대조 fixture 신설 `apps/builder/tests/parity/gridTrackContribution.browser.test.ts` (engine 38 + row 7 + 규칙 요약 2 + pipeline 대조 2 + 잔존 1) / parity 전체 693건 green / Rust 344건 green / type-check PASS. 민감도 — min·max 기여를 한 값으로 합치면 14 red, §6.6 clamp 무력화 2 red, clamp 의 auto-min 게이트 제거 1 red, `minmax` % 해석 제거 1 red
  - 라이브 확인: 실행 중인 빌더의 WASM 직접 호출로 11개 형태(키워드 3종·§6.6 clamp 비대칭 3종·`%` 상한·여유 3구간·catalog `1fr auto`)가 Chrome 실측과 일치. catalog 의 content 기반 트랙은 `1fr auto` 4곳(ProgressBar/Meter/Slider)뿐이고 종전과 같은 값에 수렴(`1fr auto`/320 → 180·120)
  - 잔존: content 기반 트랙 안의 **텍스트 leaf** 가 빌더 파이프라인에서 폭 0. 엔진은 기여를 소비할 준비가 됐지만 `enrichWithIntrinsicSize` 의 스칼라 주입이 flex 자식으로 한정돼 grid 자식에 공급되지 않는다 (본 변경 이전부터 동일 — baseline 실측 확인)

## [`minmax()` 그리드 트랙이 상한까지 자라지 않고, fr 분배가 컨테이너를 넘던 문제] - 2026-07-28

### Bug Fixes

- **`minmax(_, px)` 트랙이 base(=min)에 멈춰 있던 문제** (CSS-GRID-1 §12.6 "Maximize Tracks"):
  - 남는 공간이 있으면 각 트랙의 base 를 growth limit 까지 키워야 하는데 그 단계가 통째로 없었다. `minmax(50px,80px)` 이 50 에 굳었고, `fr` 트랙이 함께 있을 때만 우연히 상한에 닿았다
  - **부작용 — 트랙 합이 컨테이너를 넘었다**: fr 여유를 `컨테이너 − Σmin` 으로 잡아 minmax 의 성장분을 빼지 않았다. `minmax(100px,150px) 1fr` / 400 에서 150 + 300 = **450**. §12.6 을 넣으면서 fr 분배식도 `컨테이너 − Σ확정크기` 로 정정
  - 분배는 균등 + 상한 도달 시 freeze + 남은 몫 재분배. 전원이 상한에 닿으면 남는 공간은 그대로 남는다 (`auto` 트랙이 없으면 §12.8 대상도 없음)
  - **정렬과 무관하게 항상 돈다** — `justify-content:start` 여도 트랙은 상한까지 자란 뒤 트랙셋이 정렬된다. `auto` 트랙 stretch(§12.8)가 `normal`/`stretch` 에서만 도는 것과 다른 점
  - `minmax(auto, 80px)` 이 0 으로 붕괴하던 것도 해소 (base 0 → 상한까지 성장)
  - 위치: `packages/composition-engine/src/grid.rs` (`maximize_tracks` 신규 + `resolve_grid_tracks` 단계 재정렬)
  - 검증: Chrome 대조 fixture 신설 `apps/builder/tests/parity/gridMinmaxTracks.browser.test.ts` (46 정합 + 합-초과 회귀 + 잔존 1) / parity 전체 648건 green / Rust 344건 green. 민감도 — §12.6 무력화 43 red
  - 라이브 확인: 실행 중인 빌더의 WASM 직접 호출로 9개 형태(상한 성장·내용 초과·균등·freeze 재분배·3트랙·`jc:start`·gap·합-초과 회귀)가 Chrome 실측과 일치. catalog 및 앱 소스에 `minmax(` 사용 0건이라 기존 문서 영향 없음
  - 잔존: 트랙의 **content 기여** 미측정 — `minmax(auto, px)` 의 base 가 0 이라 내용이 상한을 넘으면 어긋난다(내용 120 → DOM 120 / 엔진 80). `min-content`/`max-content`/`fit-content()` 트랙 키워드도 같은 뿌리로 미지원(→ `auto` 폴백). ADR-169 grid intrinsic 이연의 재개 조건과 동일 축

## [`auto` 그리드 트랙이 남는 공간을 나눠 갖지 않던 문제] - 2026-07-28

### Bug Fixes

- **`auto` 트랙이 내용 크기에서 멈춰 컨테이너의 남는 공간을 비워 두던 문제** (CSS-GRID-1 §12.8 "Stretch auto Tracks"):
  - 축의 정렬이 `normal`/`stretch`(기본값)이면 남는 여유가 `auto` 트랙들에 균등 분배되어야 하는데, 엔진은 트랙을 자식 내용 크기로 측정한 뒤 그대로 뒀다. 컨테이너가 300 이어도 `auto auto` 트랙이 40·40 에 머물러 자식들이 왼쪽에 몰렸다 (CSS 는 150·150)
  - **Why**: `auto` 트랙 측정이 "내용 크기 = 최종 크기" 로 끝나 있었다. CSS 에서 내용 크기는 **하한**이고, 남는 공간이 있으면 거기서 더 자란다. 세로축도 같은 뿌리 — 높이 200 그리드의 20·40 행이 그대로 쌓여 아래 130 이 빈 채로 남았다 (CSS 는 95·105)
  - 정렬을 `start`/`center`/`end`/`space-*` 로 지정하면 종전대로 트랙은 내용 크기를 유지하고 트랙셋 전체가 정렬된다. `fr` 트랙이 함께 있으면 `fr` 이 여유를 먼저 가져가므로 `auto` 는 내용 크기 그대로다. 넘칠 때는 아무것도 하지 않는다
  - **적용 범위를 좁힌 지점**: 컨테이너 축이 **명시 크기**일 때만 적용한다. block-level `width:auto` 그리드는 CSS 상 크기가 확정이지만 엔진이 shrink-to-fit 과 구분하지 못하며, 같은 자리에서 `1fr` 이 이미 어긋나 있다(flex 안 auto-width 그리드에서 DOM 80 vs 엔진 400) — `auto` 와 무관한 별개 축이라 함께 고치지 않고 스냅샷으로 분리해 고정
  - 위치: `packages/composition-engine/src/tree.rs` (`stretch_auto_tracks` + `solve_grid` 측정 직후 배선)
  - 검증: Chrome 대조 fixture 신설 `apps/builder/tests/parity/gridAutoTrackStretch.browser.test.ts` (61 정합 + 규칙 요약 + 잔존 2) / 기존 grid 잔존 스냅샷 2건이 정합 케이스로 승격 (`gridItemBox` `gridAlignContent`) / parity 전체 600건 green / Rust 344건 green. 민감도 — stretch 무력화 35 red, 정렬 게이트 제거 31 red, 확정-크기 게이트 완화 5 red
  - 라이브 확인: 실행 중인 빌더가 로드한 WASM 을 직접 호출해 10개 형태(기본·start·center·`auto 100px`·`auto 1fr`·넘침·gap·세로 3종)가 Chrome 실측과 일치함을 확인. 현재 문서는 grid 컨테이너 0개이고 카탈로그 grid 4곳(ProgressBar/Slider)이 전부 `1fr auto` + 높이 auto 라 no-op — ProgressBar 내부 기하 수정 전후 동일
  - 잔존 2건 (같은 fixture 스냅샷, 둘 다 본 변경 이전부터): `minmax(px,px)` 가 growth limit 까지 자라지 않음(§12.6 — §12.8 보다 앞 단계) / 암묵 트랙이 `grid-auto-rows` 를 무시하고 자식 내용으로만 측정됨

## [노드 Picture 캐시 + 스냅샷 ping-pong — ADR-153 Phase 3 + ADR 종결] - 2026-07-28

### Architecture

- **노드 Picture 캐시 도입 — content 재렌더가 미변경 요소를 재생(replay)** (ADR-153 Phase 3, Implemented 승격 — P4 incremental budget 은 G4 미달로 미도입 종결):
  - 요소별 self-draw 블록(자기 shapes/text — 자식 요소 제외)을 SkPicture 로 record, 내용 불변이면 `drawPicture` 재생. 키 = registry 노드 identity + width/height (**위치 제외** — 드래그/이동은 재기록 없음). 활성 transition/animation 노드는 volatile 면제(직접 draw), 텍스트 편집 중 요소는 캐시 우회
  - **Why**: content 변경/카메라 보정 재렌더가 매번 전체 씬을 CanvasKit 에 재발행 — 상호작용 프레임의 지배 축 (record 40-51%). 실측 (줌 오실 150틱): replay 99.89% (재기록 5/4,592), record.content mean 2.98→0.21ms, render.frame max 227→41ms (p95 1.5ms)
  - **StoreRenderBridge 무변경 재빌드 차단**: 카메라 틱마다 전 노드가 내용 동일한 새 객체로 재등록되어 identity 캐시를 무효화하던 경로를 2겹으로 차단 — sync no-op 가드 (빌드 입력 ref 전량 동일 시 생략) + build 결과 content-equal 재사용 (루트 x/y 제외). 편집 1회 = 재기록 1 노드 한정 실측
  - **content 스냅샷 ping-pong** (R7 — 격차 5): 표면 2장 교대로 "그리는 표면 ≠ 스냅샷 표면" 보장, Ganesh copy-on-write/stall 제거 — flush.content p99 5.4→0.3ms / max 7.2→0.4ms 실측 확정 (비용: content surface 1장 GPU 텍스처 추가, 수용 위험 명시)
  - **R2 lifecycle**: SkImage 퇴거 리스너 → 참조 Picture 선행 해제 (해제 순서 Picture→Image), unmount 통합 destroy (56→0 실측), LRU 상한 1024, `paintPool.static.test.ts` 정적 강제 + 신규 Picture 캐시 unit test 7건
  - 위치: 신규 `apps/builder/src/builder/workspace/canvas/skia/nodePictureCache.ts`, `renderCommands.ts`(selfSpans + record/replay), `StoreRenderBridge.ts`(가드+재사용), `SkiaRenderer.ts`(ping-pong+volatile 공급), `imageCache.ts`/`useSkiaNode.ts`(invalidate 배선)

## [grid item 이 트랙 폭으로 늘어나고 margin·min/max 가 무시되던 문제] - 2026-07-28

### Bug Fixes

- **grid item 박스 모델 정정 — 그리드 영역은 containing block 일 뿐** (CSS-GRID §10.1/§10.2 + CSS-ALIGN-3 §4.1/§4.2). 네 갈래 결함이 `solve_grid` 자식 배치 한 블록에 있었다 (트랙 150 기준 실측):
  - **명시 크기 무시 → 트랙 폭 stretch**: `width:40px` 자식이 150. **Why**: 세로축은 "explicit 크기가 stretch 를 이긴다"(ADR-156 옵션 3-a)를 받았는데 **가로축만 못 받은 비대칭**이었다. `%`/min-max 도 같이 삼켜졌다
  - **margin 미소비** (양축): `marginLeft:20px` 가 x 에 반영 안 되고, stretch 폭도 영역에서 margin 을 빼지 않음
  - **auto margin 미흡수** (§10.2): flex §8.1 과 동형 규칙이 grid 에는 없었다
  - **자식 min/max 미적용 + 넘침을 자름**: `maxWidth:60` → 150, `width:300` → 150(CSS 는 300 으로 넘침). block·flex 부모에서는 각 커널이 이미 적용하는데 grid 만 빠져 있었다 (부모 3종 대조 실측: block·flex 10/10 정합 vs grid 5/5 발산)
  - 수정: 두 축 대칭 단일 함수 `place_grid_axis` 로 통합 — 축마다 따로 두면 한쪽에만 규칙이 붙는다(이번 결함의 원인). 넘칠 때 위치 정렬이 음수 offset 인 것도 flex 축과 동일 규칙으로 정렬
  - **영향**: ProgressBar/Meter/Slider 계열 grid 컴포넌트의 라벨/값이 트랙 폭으로 늘어나던 것이 CSS 대로 자기 폭을 유지한다 (Preview DOM 과의 D3 대칭 회복)
  - 부수 정정: Rust golden 2건이 **자식 폭에 트랙 폭을 기대**하고 있어 결함을 고정하고 있었다 (`grid_mixed_px_and_auto_columns_preserve_px` / `grid_progressbar_realstruct_row_and_col_auto`) — Chrome 실측 근거와 함께 정정. 트랙 폭의 근거는 형제 x 좌표가 대신 증명
  - 위치: `packages/composition-engine/src/tree.rs`
  - 검증: 신규 `apps/builder/tests/parity/gridItemBox.browser.test.ts` 113건 (Chrome 실측 대조 2 leg). 민감도 — explicit 104 red / margin 14 / min·max 10 / 넘침 6. 라이브 빌더 WASM 직접 호출로 6 케이스 + ProgressBar 실구조(60/30/320) 확인
  - 잔존 3건 (같은 fixture 스냅샷 고정): 내용 없는 auto-width 자식의 shrink-to-fit · `auto` 트랙 여유 균등 분배 · **block-level** `justify-self` 미지원
  - 파생: `containerIntrinsic.browser.test.ts` I/J 스냅샷에서 자식 폭 항목이 빠졌다 (grid item 이 명시 width 를 유지하게 되어 해소) — 남은 항목은 전부 트랙/컨테이너 폭이라 ADR-169 grid 이연 그 자체

## [`*-reverse` flex 에서 아이템 margin 이 반대쪽에 붙던 문제] - 2026-07-27

### Bug Fixes

- **reverse 축의 margin start/end 역할 정정** (`flex-direction: *-reverse` / `flex-wrap: wrap-reverse`):
  - 증상: 어긋남이 **정확히 margin 값**만큼 반대편으로 — `row-reverse` + `marginLeft:20px` 가 x=240 (CSS 260), `column-reverse` + `marginTop:20px` 가 y=140 (CSS 160), `wrap-reverse` + `marginTop:20px` 가 240 (CSS 260)
  - **Why**: 엔진은 reverse 를 **정방향 배치 + 기하 반사**로 구현하는데 (`tree.rs` 3.9 — 커널은 reverse 를 모른다), 반사는 좌표를 뒤집을 뿐 margin 이 아이템의 **어느 쪽에 붙는지**는 바꾸지 못한다. `row-reverse` 의 main-start 는 오른쪽이라 main-start margin = physical `margin-right` 인데 커널은 `margin-left` 를 main-start 로 쓰고 있었다
  - 수정: `write_flex_item` 이 반전 축의 물리 margin 쌍을 맞바꿔 커널에 정방향 논리로 전달 (`MarginAxisReverse` — 값과 auto 마스크 동시). 컨테이너 수준 정렬·padding 은 종전에도 정합이라 반사 자체는 무변경
  - auto margin 과 **무관한 별개 결함** (고정 margin 에서도 재현) — 위 auto margin sweep 중 발견
  - 위치: `packages/composition-engine/src/tree.rs`
  - 검증: 신규 `apps/builder/tests/parity/reverseMargin.browser.test.ts` 44건 (고정 12 · cross 대조 2 · auto×reverse 4 · wrap-reverse 6 · 대조군 2, 2 leg) + Rust `reverse_axis_swaps_margin_start_end`. 민감도 — 스왑 되돌리면 18/44 red (autoMargin 79 은 green 유지 = 두 결함 분리 확증). 라이브 빌더 WASM 직접 호출로 260/200 · 260/0 · 160/100 확인

## [`margin: auto` 가 캔버스에서 여유 공간을 흡수하지 않던 문제] - 2026-07-27

### Bug Fixes

- **flex 아이템의 `margin: auto` 흡수를 커널이 라인 단위로 소유** (CSS-FLEXBOX-1 §8.1 / §9.4 step 11 / §9.6 step 13·14):
  - 증상 3종 — (a) cross 축(`marginTop:auto` 등)은 통째로 미구현이라 `align-items` 값이 그대로 이겼다 (실측 y=0, CSS 160). (b) cross auto margin 이 있어도 `stretch` 가 아이템을 라인 높이로 늘렸다 (CSS 는 내용 크기 유지). (c) `flex-wrap:wrap` 컨테이너는 main 축 흡수조차 일어나지 않았다 (실측 x=100, CSS 150)
  - **Why**: 흡수량은 **그 라인의** 여유와 라인 cross 에 달려 있는데, 구 구현은 라인을 모르는 tree.rs 후처리(step 3.8)가 main 축만 **단일 라인 근사**로 처리했다. 라인을 소유한 flex 커널로 이관하니 세 증상이 한 번에 닫힌다 — 정렬 무효화 규칙(§9.6 step 14 / §8.1)도 축마다 따로 걸 필요가 없어진다
  - `resolve_signed` 가 `auto` 를 0 으로 주어 `margin: 0` 과 구분되지 않으므로, flex 입력에 `margin_auto_mask`(off 20, 물리 4비트) 채널 신설 — 기록·해석이 같은 상수(`flex::MARGIN_AUTO_*`)를 공유
  - 위치: `packages/composition-engine/src/flex.rs` (`place_line_main_axis` / `place_line_cross_axis` / `parse_item`), `src/tree.rs` (`write_flex_item` off 20 + step 3.8 제거)
  - 검증: 신규 `apps/builder/tests/parity/autoMargin.browser.test.ts` 79건 (Chrome 실측 대조, engine·pipeline 2 leg) — 민감도 cross 분기 38 red / main 흡수 20 red. 라이브 빌더의 로드된 WASM 직접 호출로 cross 160 · main 260 확인, Components 페이지 56 노드 좌표 무변동
  - 잔존: grid item 의 auto margin 미구현 — 명시 width 가 트랙 폭으로 stretch 되는 ADR-156 §Residual 이 **먼저** 걸리는 순서까지 같은 fixture 의 스냅샷이 고정

## [Paint 풀 + 캐시 해제 단일화 — ADR-153 Phase 2] - 2026-07-27

### Architecture

- **Paint free-list 풀 도입** (ADR-153 Phase 2 — 신규 `skia/paints.ts`):
  - `Paint()` 직접 생성 77건 전수 감사 (frame-hot/event-hot/cold 3분류) 후 (a)/(b) 전량을 `acquirePooledPaint`/`releasePooledPaint`/`acquireScopedPaint` 로 전환 — 14개 렌더러 파일. fresh 기본 상태 리셋 (사이트가 쓰는 setter 12종 전수) 로 사이트 구성 코드 무변경
  - **Why**: 상호작용 프레임마다 그리기 항목 수만큼 WASM malloc/free 반복 (open-pencil `paints.ts` singleton 등가 — R2 누수 위험 + heap churn). 실측: 줌 구동 중 재사용 9,742회 / 신규 생성 2회 (풀 크기 2 로 안정)
  - 재발 방지: `paintPool.static.test.ts` — skia/ 소스의 직접 `new ck.Paint()` 0건 정적 강제
- **Skia 캐시 해제 경로 단일화** (`disposable.ts` — open-pencil lifecycle 패턴):
  - `registerSkiaCacheDestroy`/`destroyAllSkiaCaches` 레지스트리 — paintPool + imageCache self-register, SkiaCanvas unmount 한정 동작. 호출자 0건이던 `clearImageCache` 실배선 (캔버스 teardown 시 SkImage 잔존 해소)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{paints,disposable,imageCache,SkiaCanvas}` + 렌더러 14파일

## [렌더 계측 보강 — ADR-153 Phase 1] - 2026-07-27

### Infrastructure

- **렌더 파이프라인 측정 보강** (ADR-153 Phase 1, dev-only — Accepted 승격 + 첫 phase):
  - 캐시 miss 사유 분류 (1-a): `CacheMetrics.recordMiss(reason)` 확장 — commandStream 5중 키 성분별 (`forced/cold/registry/layout/page-pos/frame-pos/root-signature`) + contentSurface 프레임 승격 사유 (`invalidate/cleanup/registry/no-snapshot/zoom-refresh/coverage-refresh/animation`). dev 콘솔 `window.__composition_CACHE_METRICS__`
  - draw-call 카운터 (1-b): 커맨드 스트림 길이 + CMD_DRAW 디스패치 수 → HUD `Cmds/Draws`
  - GPU 프레임 시간 (1-c): `EXT_disjoint_timer_query_webgl2` non-blocking 측정 → HUD `GPU` (신규 `gpuTimer.ts`)
  - speedscope export (1-d): perfMarks trace ring → evented 프로파일 직렬화 + HUD `Export trace` 버튼 (신규 `speedscopeExport.ts`, 외부 의존 0)
  - 상호작용 프레임 분해 라벨 상설화 (1-e): `render.skia.record.content` / `flush.content` / `flush.main`
  - **Why**: 2026-07-27 분해 실측 (record 40-51% / flush+snapshot 32-56%, JS 조립 2-7%) 의 임시 계측을 상설화 — Phase 3 Picture 캐시 G2 판정과 이후 렌더 성능 ADR 의 공급 지표. "무엇이 느린지 모르면 캐시 설계 자체가 추측이다"
  - G1 통과: production 번들 계측 모듈 유입 0 (grep 검증) + 오버헤드 render.frame mean 0.23ms/frame + Chrome MCP live HUD 실동작
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{cacheMetrics,drawStats,gpuTimer,renderCommands,SkiaRenderer}.ts`, `canvas/utils/{gpuProfilerCore,speedscopeExport,GPUDebugOverlay}`, `builder/utils/perfMarks.ts`

## [높이 auto 인 flex 부모에서 백분율 height 가 잘못 해소되던 문제] - 2026-07-27

### Bug Fixes

- **`height:auto` flex 컨테이너 안의 `height:%` 자식이 상속 available 로 해소되던 문제**.
  - **Why**: `%` 는 containing block 의 해당 축이 definite 일 때만 해소된다. 그런데 **두 축의 성립 조건이 다르다** — 인라인 축(width)은 부모가 available 을 내려주면 확정이지만(block 레벨 stretch), 블록 축(height)은 `height:auto` 가 곧 내용 크기라 **확정되지 않는다**(CSS §10.5). 엔진은 flex cross 축 판정에서 두 축을 한 규칙(`explicit || avail >= 0`)으로 묶고 있었다 — 폭 쪽 근거(DatePicker `width:100%`)를 높이에 그대로 적용한 것이다.
  - 실측: `flex(row, width:300, height 미지정)` 안의 `height:50%` 자식이 상속 600 의 절반인 **300** 으로 해소(DOM 은 0 — `%` → auto → 내용 없음). 컨테이너도 그만큼 부풀었다.
  - **게이트가 두 경로에 필요했다** — `%` 를 푸는 ctx 와 **자식 재귀 solve 에 내려주는 available** 양쪽. 한쪽만 막으면 자식이 자기 solve 에서 상속값으로 다시 해소한다(`solve_block` 은 원래 두 곳 다 있었고 `solve_flex` 는 둘 다 없었다). 민감도: ctx 만 되돌리면 8 red, 재귀 available 만 되돌리면 16 red.
  - 폭 축의 조항은 유지 — 지우면 stretch 부모 안의 `width:100%` 손자가 다시 수축한다(2026-07-14 DatePicker). 신규 fixture 가 stretch/shrink-wrap 양쪽을 같이 잠근다.
  - 검증: 신규 parity fixture 76건(block/flex-row/flex-column × 부모높이 definite·auto × 50%·100% × width·height·both + shrink-wrap 회귀 2 × 2 leg). Rust 316 PASS, parity 299 PASS, 빌더 3002 PASS, type-check 신규 위반 0. 라이브 재확인: Components 페이지 56 노드 좌표 무변동(ListBoxItem 84 / ListBox 행 50 / GridListItem 76).
  - 위치: `packages/composition-engine/src/tree.rs`, `apps/builder/tests/parity/percentSize.browser.test.ts`

## [CSS 정합 탐색 sweep — 배치 파싱 크래시 + grid align-content] - 2026-07-27

### Bug Fixes

- **flex 부모의 block 자식이 절대 길이 `flex-basis` 를 가지면 그 페이지 레이아웃이 통째로 사라지던 문제**.
  - **Why**: 엔진 `NodeStyle` 의 길이 필드는 전부 문자열이라 숫자가 들어오면 `build_tree_batch` 가 **배치 전체**를 거부한다 → `calculateFullTreeLayout` null → 페이지 레이아웃 소멸. `buildNodeStyle` block branch 는 정규화(`dim()`) **뒤에** `applyFlexItemProperties` 로 flex item 속성을 덧쓰는데, 그 안의 `parseCSSPropWithContext` 가 절대 길이를 숫자로 돌려준다(`"0px"` → `0`). grid branch 는 같은 이유로 이미 정규화하고 있었고 **block branch 만 비대칭**이었다 (2026-07-06 ProgressBar `rowGap:4` 사건과 동일 병인 — 한쪽만 처방됨).
  - 백분율(`0%`)·`auto` 는 문자열로 남아 무증상이라, 절대 길이 `flex-basis` 를 싣는 import/preset 에서만 드러난다 (편집 UI 는 `flexBasis` 미노출).
  - 두 branch 공용이 되어 헬퍼 이름에서 grid 한정 어감 제거 (`normalizeGridDimFields` → `normalizeDimFields`).
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`
- **`height:auto` 그리드가 `align-content` 로 밀려나고 높이가 부풀던 문제**.
  - **Why**: 여유 공간은 definite block size 에서만 생긴다(CSS-ALIGN-3 §4.4). `solve_grid` 는 `height:auto` 일 때 트랙 sizing 을 위해 **상속 available** 을 컨테이너 높이로 대입하는데, 그 값을 그대로 여유로 봐서 **없는 공간**을 트랙 사이에 나눠 넣었다. 직전 항목의 flex 미결정 main 센티넬과 **같은 병인의 grid 판**.
  - 실측: `align-content:center` → 트랙이 `(600−70)/2 = 265` 아래로 밀리고 컨테이너 높이 `70 → 335`. `space-between` 은 `560 / 600`.
  - 판정은 `explicit_h > 0.0`. 인라인 축(`justify-content`)은 block 레벨 stretch 로 폭이 늘 definite 이라 대상 아님. catalog·factory 에 `alignContent` authoring 이 **0건**이라 현행 컴포넌트에는 무영향 — import/preset 경로의 잠복 결함만 닫는다.
  - 위치: `packages/composition-engine/src/tree.rs`

### Infrastructure

- **CSS 정합 탐색 sweep — 14개 축을 Chrome DOM 대조로 훑어 발산 목록화**. padding/border · min·max clamp · margin(고정/auto) · 백분율 · align-self · reverse 방향 · order · flex-basis · 마진 상쇄 · 중첩 flex · grid · overflow/inline display · box-sizing · aspect-ratio.
  - 정합 확인(발산 0): min/max clamp · align-self · reverse(row-reverse/column-reverse/wrap-reverse) · 마진 상쇄 · 중첩 flex · overflow/inline display · aspect-ratio · 컨테이너 자신의 min/max.
  - 위 2건 수정 후 남은 **기록된 발산**: 교차축 `margin:auto` 미구현 · `height:auto` flex 부모에서 백분율 height 가 상속 available 로 해소됨 · `flex-basis:content` 미측정 · `box-sizing:content-box` 미지원(엔진은 항상 border-box) · grid item 의 명시 width 가 트랙 폭으로 stretch(ADR-156 §Residual) · definite 높이 grid 의 auto 트랙 stretch 분배 미구현.
  - 신규 fixture 2종: `flexItemDimContract.browser.test.ts`(11) · `gridAlignContent.browser.test.ts`(23, 잔존 stretch 차이 스냅샷 포함). parity 총 223 PASS.
  - 위치: `apps/builder/tests/parity/`, 규칙 `.claude/rules/layout-engine.md`

## [높이 auto 인 flex 세로 컨테이너에서 자식이 위로 삐져나가던 문제] - 2026-07-27

### Bug Fixes

- **Components 페이지의 ListBoxItem 마스터 높이가 의도치 않게 줄고 내용이 행 위로 삐져나가던 문제**. 사용자 보고: "components 에 listboxItem Origin 의 높이가 의도하지 않게 변형되어 있다".
  - **Why**: 여유 공간은 **확정된 main 크기**에서만 산출된다(CSS §9.7). `flex-direction:column` + `height:auto` 는 컨테이너가 내용으로 축소되므로 여유라는 개념 자체가 없고, `justify-content` 는 아무 일도 하지 않아야 한다. 엔진은 이 "미결정" 상태를 **음수 센티넬**(−1)로 전달하는데, 위치 정렬이 그걸 실제 여유로 오해해 `−1 − 내용합` 의 절반만큼 자식을 컨테이너 **위로** 밀어냈다. auto 높이는 밀려난 만큼 함께 줄었다.
  - 실측: ListBoxItem 마스터가 `(−1 − 76)/2 = −38.5` 만큼 위로 밀려 아이콘/라벨/설명이 프레임 상단 밖으로 나가고 높이가 **84 → 45.5**. catalog `containerStyles.justifyContent:center` 를 가진 형태만 해당해, `justifyContent` 가 없는 GridListItem 마스터(76)는 멀쩡한 **비대칭**으로 나타났다.
  - 센티넬 가드는 원래 `resolve_flexible_lengths` / `collect_lines` / main 축 auto margin 흡수에 있었고 `place_line_main_axis` 에만 없었다. 분배 정렬의 `.max(0.0)` 클램프가 **결과적으로** 가려주고 있다가, 직전 커밋에서 위치 정렬의 클램프를 걷어내며(넘침 정렬 정정) 드러났다.
  - 검증: 라이브(사용자 보고 문서) — ListBoxItem 마스터 2개 모두 높이 `45.5 → 84`, 자식 `y=4 / 30 / 56` 으로 행 안에 수렴, 형제 GridListItem 76 무변동. Rust 314 PASS(신규 1 — justify 6종 × 미결정 main), parity 189 PASS(신규 12 — Chrome DOM 대조 6 케이스 × 2 leg), 빌더 3002 PASS.
  - **`flexSweep`(1152 조합)는 이 축을 못 잡는다** — 컨테이너 main 을 항상 확정으로 주기 때문에 결함이 있어도 전부 green(실측). 미결정 main 은 `crossAxisOverflow` fixture 의 `INDEFINITE_MAIN_CASES` 가 유일한 감시자다(엔진을 되돌리면 center/end × 2 leg = 4 red).
  - 위치: `packages/composition-engine/src/flex.rs`, `apps/builder/tests/parity/crossAxisOverflow.browser.test.ts`, 규칙 `.claude/rules/layout-engine.md`

## [프레임을 적용한 페이지가 preview 에 렌더되지 않던 문제] - 2026-07-27

### Bug Fixes

- **페이지에 프레임을 적용하면 CSS preview 가 빈 화면이 되던 문제**. 사용자 보고: "page 에 frame 적용 후 css preview 에 렌더링되지 않는다".
  - **Why**: `resolveCanonicalDocument` 는 ref 를 열 때 master 자식과 instance 자식을 **이어 붙인다**(`[...origin, ...instance]`). 일반 컴포넌트 ref 에는 맞지만 페이지↔프레임에는 틀리다 — 프레임의 body(빈 슬롯 보유)와 페이지의 body(콘텐츠 보유)가 **형제로 나란히** 놓인다. 실측: preview 루트가 `390×844` 가 아니라 **`390×1688`** 이 되어, 빈 슬롯이 뷰포트를 정확히 채우고 콘텐츠는 `y=844` 부터 시작 — 화면에는 빈 프레임만 보였다.
  - ADR-903 의 `slot` 계약은 추천 목록 **검증**(비차단 warn)일 뿐 배치 기제가 아니라, resolver 안에서 풀리는 문제가 아니다. 캔버스(Skia)는 `resolvePageWithFrame` 이라는 별도 합성 층을 갖고 있어 정상이었고 — 그래서 증상이 **캔버스는 맞는데 preview 만 틀린** 비대칭으로 나타났다. canonical 렌더 경로(ADR-116) 전환 때 이 합성이 DOM 축으로 이식되지 않은 것이 근본 원인이다(preview 의 legacy element 분기에는 슬롯 치환이 있으나, canonical 분기가 먼저 return 해 프레임 페이지에서는 죽은 코드).
  - DOM 축 합성 `projectPageFrameNode` 를 추가했다 — page body 를 하나로 합치고(프레임 레이아웃 병합), 프레임 슬롯을 그 자식으로 투영하고, 페이지 콘텐츠를 슬롯 이름으로 라우팅한다. 슬롯 id 는 캔버스와 같은 `{pageId}::page-frame::{slotId}`.
  - **정책은 한 곳으로 모았다** — body style/responsive 병합과 슬롯 style 보완 규칙을 `pageFrameProjection.ts` 로 추출해 두 축이 공유한다. 순회만 축별로 다르다(flat + `parent_id` ↔ 중첩 트리). 규칙이 두 벌이면 그 순간 시각 발산이 시작된다.
  - 검증: 회귀 10건 — 종전 "형제 두 body" 를 기준선으로 함께 고정. 슬롯 라우팅 / 미매칭 콘텐츠 소실 금지 / 채워진 슬롯의 기본 자식 감춤 / 뷰포트 키 page 우선 / 프레임 미참조·일반 컴포넌트 ref 무변경 포함. 기존 `resolvePageWithFrame` 28건 무변동. 라이브(사용자 보고 문서): preview 루트 `1688 → 844`, 슬롯 `390×60 @0,0` + `390×784 @0,60`, ListBox 3행이 content 슬롯 안에 렌더 — **캔버스 좌표와 정확히 일치**. 프레임 미적용 페이지 무영향 확인.
  - 위치: `apps/builder/src/adapters/canonical/{projectPageFrameTree,pageFrameProjection}.ts`, `apps/builder/src/preview/App.tsx`, 규칙 `.claude/rules/canvas-rendering.md` §9.5

## [flex sweep 이 음수 free space 조합을 훑도록 확장 — 672 → 1152] - 2026-07-27

### Infrastructure

- **`flexSweep` 파라메트릭 sweep 에 "내용이 컨테이너를 넘기는" 조합을 추가**. 교차축 384 → 576, main 축 288 → 576 (합 672 → 1152).
  - **Why**: 종전 sweep 은 컨테이너 cross 를 줄 합보다 **크게**만 잡아 양수 여유 조합만 훑었다. 바로 앞 두 항목의 정렬 결함 3건이 전부 그 사각지대에 있었고, 672 조합을 통과하면서도 하나도 못 잡았다.
  - 교차축은 `CROSS_SIZE` 에 세 번째 값 `definite-overflow` 를 더했다 — 직교 차원이 아니라 값 추가인 이유는 `auto` 컨테이너가 내용으로 자라 음수 여유가 성립하지 않기 때문이다(직교로 두면 절반이 중복). 최대 자식 cross 와 줄 합 **둘 다보다 작은** 값이라 `align-items`(라인 안)와 `align-content`(라인 간) 양쪽에서 음수가 된다.
  - main 축은 `MAIN_SPACE` 축을 더했다. `shrink=1` 조합은 자식이 줄어들어 실제로는 여유 0 이 되지만 그 자체가 shrink 계약 검증이라 유지한다.
  - **확장분이 실제로 그 경로를 훑는지 엔진을 되돌려 확인**: 라인 cross 승격을 `max` 로 되돌리면 교차축 **48/576** red, 정렬 여유 클램프를 되살리면 교차축 **80/576** + main **32/576** red. 인위적 조합이 아니라는 근거이자 이 축을 지웠을 때 잃는 커버리지의 크기다.
  - 1152 조합 실행 시간 66ms — 기존 대비 체감 없음.
  - `crossAxisOverflow` fixture 는 그대로 둔다. sweep 은 격자를 **넓게**("어딘가 틀렸다"), fixture 는 규칙별 **기대 좌표를 명시**로("무엇이 몇으로 틀렸다") 잠그는 서로 다른 역할이다.
  - 위치: `apps/builder/tests/parity/flexSweep.browser.test.ts`, 규칙 `.claude/rules/layout-engine.md`

## [넘칠 때 center/flex-end 정렬이 조용히 flex-start 로 무너지던 문제 — flex 3축] - 2026-07-27

### Bug Fixes

- **내용이 컨테이너보다 클 때 `center` / `flex-end` 정렬이 무시되고 시작 쪽에 붙던 문제**. `align-items`(교차축), `justify-content`(main 축), `align-content`(라인 간) **3축 모두** 같은 결함이었다.
  - **Why**: 세 곳 모두 여유 공간을 `.max(0.0)` 으로 클램프하고 있었다. 여유가 음수면 0 이 되어 offset 이 0 — 즉 `flex-start` 와 같은 배치다. CSS-ALIGN-3 §4.2 의 기본 정렬은 **`unsafe`** 라 넘쳐도 진짜로 정렬한다 (`center` 는 양쪽으로 균등, `flex-end` 는 시작 쪽으로). 클램프는 `safe` 키워드를 쓴 것과 같은 동작인데 composition 은 그 키워드를 소비하지 않는다.
  - Chrome 실측 — 컨테이너 100 / 아이템 300: `center` **−100**, `flex-end` **−200** (엔진은 둘 다 0). 컨테이너 cross 60 / 두 줄 합 100: `align-content:center` 줄 y **−20·30**, `flex-end` **−40·10** (엔진은 0·50).
  - **분배 정렬(`space-between/around/evenly`)과 `align-content:stretch` 의 클램프는 그대로 뒀다 — 그쪽은 결함이 아니라 정답이다**. Chrome 실측에서 세 분배값 모두 음수 여유에서 start(0) 로 떨어진다 (CSS-ALIGN-3 §4.4 fallback). 한 계열의 규칙을 양쪽에 적용하면 반대쪽이 깨지므로 `free_main`/`free_main_raw`, `cross_free`/`cross_free_raw` 두 값을 분리했다.
  - 검증: Chrome 대조 fixture 를 교차축 13 · main 축 6 · align-content 6 케이스로 확장(각 engine leg + pipeline leg, 총 50) — 수정 전 교차축 4 / main 4 / align-content 4 red. Rust 339건(신규 4 포함) / 브라우저 parity 177 / 빌더 2992 PASS + type-check 회귀 0. 라이브: 실행 중 빌더의 WASM 이 3축 모두 CSS 값(−100 / −200 / −20)을 내는 것, 사용자 문서에서 이 분기에 닿는 컨테이너 0건(기존 화면 무변동) 확인.
  - `flexSweep` 의 종전 주석이 이 영역을 "엔진 0 클램프로 발산" 이라 적어 뒀는데 이제 사실이 아니라 정정했다 — 여전히 sweep 밖(양수 여유만 훑음)이라는 사실만 유효하다.
  - 위치: `packages/composition-engine/src/flex.rs`, fixture `apps/builder/tests/parity/crossAxisOverflow.browser.test.ts`, 규칙 `.claude/rules/layout-engine.md`

## [확정 높이 밴드 안의 auto 자식이 내용만큼 자라던 문제 — flex 교차축] - 2026-07-27

### Bug Fixes

- **`align-items: stretch` 인 flex 컨테이너에서 높이(폭)가 `auto` 인 자식이 컨테이너를 넘어 내용 크기까지 자라던 문제**. 확정 높이 밴드 안에 auto-height 자식을 두는 형태 — 프리셋 row 레이아웃의 기본 구성이라 실제로 닿는다.
  - **Why**: CSS-FLEXBOX §9.4 step 8 은 "single-line + definite cross 컨테이너의 flex 라인 outer cross size **는** 컨테이너의 inner cross size" 라는 **대입**인데, 엔진이 `max` 로 두고 있었다. 라인이 아이템에 맞춰 커지면 `stretch` 가 그 커진 라인을 채우므로 자식이 내용까지 자란다. CSS 는 컨테이너에서 자르고 내용이 라인 밖으로 흘러넘친다.
  - Chrome 실측: 확정 높이 100 + `height:auto` 자식 + 내용 300 → **DOM 100 / 엔진 300**. row(높이)·column(폭) 동형이고 빌더 실 파이프라인까지 그대로 전파됐다.
  - `align-items: flex-start` 는 아이템이 자기 크기를 유지하므로 **종전에도 정합**이었다 — 증상이 stretch 에서만 나오던 이유다.
  - **왜 sweep 에 안 걸렸나**: `flexSweep`(384+288 조합)는 definite cross 를 줄 합보다 **크게** 잡는다 — 음수 free space 는 align-content 정합 영역 밖이라 의도적으로 비켜 간 구성이다. 그래서 "라인 cross > 컨테이너 cross" 형태가 한 번도 안 들어갔다. 이 영역은 이제 별도 fixture 소관.
  - 검증: 신규 Chrome 대조 fixture 14건(row/column × stretch·flex-start × 내용 초과/미달 + 컨테이너 auto, engine leg + pipeline leg) — 수정 전 4건 red. 기존 브라우저 parity 141건 / Rust 336건(신규 2건 포함) / 빌더 2992건 전부 PASS. 라이브: 실행 중인 빌더의 WASM 이 같은 트리에서 CSS 값(100)을 내는 것과, 사용자 문서의 현재 요소 중 이 분기에 닿는 것이 0건(= 기존 화면 무변동)임을 함께 확인.
  - 위치: `packages/composition-engine/src/flex.rs`, fixture `apps/builder/tests/parity/crossAxisOverflow.browser.test.ts`, 규칙 `.claude/rules/layout-engine.md`

## [넘침 표시 chrome 이 프레임 슬롯 너머를 못 보던 문제] - 2026-07-27

### Bug Fixes

- **프레임을 적용한 페이지에서 넘친 콘텐츠를 알려주는 표시가 전혀 나오지 않던 문제**. 컨테이너를 가리켰을 때 밖으로 나간 부분을 반투명으로 보여주는 오버레이도, 밖으로 나간 요소를 선택했을 때의 사선 해칭도 나오지 않았다.
  - **Why**: 바로 앞 스크롤 문제와 **같은 전제**다 — `buildOverflowInfoMap` 이 넘침을 컨테이너의 **직계 자식**에서만 찾았다. 프레임 적용 페이지는 `body(overflow:auto) > Slot(overflow:visible) > 콘텐츠` 구조이고 슬롯이 페이지 높이에 딱 맞으므로 "넘침 0" 이 되어 맵에 항목 자체가 안 생겼다.
  - 이제 `overflow:visible` 자손을 따라 내려간다. 하강은 두 지점에서 멈춘다 — **자기 클립을 가진 자손**(그쪽이 자기 경계로 흡수)과 **이미 밖으로 나간 자손**(그 사각형이 넘침을 대표하므로, 더 내려가면 같은 영역에 반투명 fill 이 겹쳐 쌓인다). 그 결과 각 노드는 가장 가까운 클립 조상 하나에만 귀속되어 순회 비용은 O(N) 이고 선택 해칭의 id→컨테이너 매핑도 모호해지지 않는다.
- **catalog 에만 `overflow` 가 있는 컨테이너가 chrome 대상에서 빠져 있던 문제**. `ListBox`/`Tree`(auto), `Card`/`DisclosureGroup`(hidden) 처럼 overflow 를 `props.style` 이 아니라 catalog `containerStyles` 에 둔 컴포넌트가 해당된다.
  - **Why**: 2026-07-22 에 스크롤/클립 소비자들을 `resolveEffectiveOverflow` 로 모을 때 이 chrome 경로가 빠져 raw `props.style.overflow` 를 계속 읽고 있었다. Skia 씬은 이미 그 컨테이너들을 클립하는데 chrome 만 "넘치는 게 없다" 고 말하는 어긋남이었다.
  - sub-pixel 초과(엔진 f32 잔차)는 넘침으로 치지 않는다 — chrome 이 초과분에 1px stroke 를 그리므로 잔차까지 잡으면 hover 마다 파란 선이 따라붙는다.
- **스크롤한 뒤 오버레이가 스크롤 전 좌표에 남던 문제**. `getCachedOverflowInfoMap` 이 `registryVersion`/`pagePosVersion` 만 캐시 키로 봤는데, 스크롤은 그 둘을 올리지 않고 좌표만 이동한 새 `treeBoundsMap` 을 낸다. 상류 캐시 키를 여기서 다시 나열해 맞추는 대신 **결과 맵의 참조**를 키로 삼아 상류가 키를 늘려도 어긋나지 않게 했다.
  - 검증: 회귀 테스트 10건 — 종전 "직계만" 동작을 기준선으로 함께 고정. 라이브 실측(사용자가 보고한 그 문서): 프레임 밖으로 나간 5번째 Card 를 선택하면 사선 해칭이 그려지고, 프레임 body 를 가리키면 위로 넘어간 Card 가 반투명으로 표시된다 — 커서를 빼면 사라진다. `slot` 은 자체 overflow 가 없으므로(`resolveEffectiveOverflow("slot") === undefined`) 이 표시는 **body 가 슬롯을 거쳐 자손까지 본** 결과로만 성립한다.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/skiaFrameHelpers.ts`, 테스트 `.../skia/__tests__/overflowInfoDescendants.test.ts`

## [프레임을 적용한 페이지가 내용이 넘쳐도 스크롤되지 않던 문제] - 2026-07-27

### Bug Fixes

- **프레임을 적용한 페이지에서 슬롯 안 콘텐츠가 페이지 높이를 넘겨도 스크롤바가 생기지 않던 문제**. 사용자 보고: `basic 2-Row` 를 Home 에 적용하고 슬롯에 Card 5개를 넣었으나 "home page 의 overflow 는 auto 인데 scrollbar 가 생성되지 않는다".
  - **Why**: 스크롤 가능 영역을 **직계 자식만** 훑어 산출했다 (`fullTreeLayout.ts` GAP 4). 프레임 적용 페이지는 `body(overflow:auto) > Slot(overflow:visible) > 실제 콘텐츠` 구조인데, 슬롯이 페이지 높이에 정확히 맞으므로 body 가 "넘치는 게 없다" 고 판정했다. CSS 는 자손의 넘침이 `overflow:visible` 조상을 **통과해** 스크롤 컨테이너까지 올라온다 (CSS-OVERFLOW-3 §3).
  - ADR-050 이 "각 컨테이너가 자기 직계 자식의 union" 을 위험 **낮음**으로 적어둔 단순화였는데, 프레임 프로젝션(ADR-135/136)이 body 와 콘텐츠 사이에 슬롯 계층을 **필수로** 끼워 넣으면서 그 전제가 깨졌다.
  - 이제 `overflow:visible` 자손을 따라 내려가며 넘침을 모은다 (부모 상대 좌표라 offset 누적). 자기 스크롤/클립 컨테이너인 자손에서는 멈춘다 — 그쪽이 자기 스크롤로 흡수하므로.
  - 검증: 같은 문서 실측 — 프레임 적용 Home `maxScrollTop 0 → 674`, 프레임 없는 페이지는 `399` 로 무변동. **Chrome ground truth 와 정확히 일치**(동일 트리 `scrollHeight − clientHeight = 674`, content 슬롯 높이 916 도 일치). 라이브: 스크롤바 썸 렌더 + 휠 스크롤 동작 + 콘텐츠 이동 확인. 회귀 6건 — 종전 "직계만" 동작을 기준선으로 함께 고정.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (`computeScrollExtent` 로 분리), 테스트 `.../__tests__/scrollExtentDescendants.test.ts`
  - **알려진 잔존**: 슬롯 자체의 높이는 커지지 않는다 — `flex:1` 슬롯이 확정 높이 컨테이너에서 남는 공간만 받는 것은 **CSS 동작과 동일**(Chrome 실측 916 일치)이므로 의도된 결과다. 별개로 `buildOverflowInfoMap`(overflow chrome)이 아직 직계 자식만 보던 것은 아래 항목에서 해소.

## [프레임 프리셋 슬롯이 손대지 않아도 "수정됨" 으로 읽히던 문제] - 2026-07-27

### Bug Fixes

- **프레임 프리셋을 적용한 뒤 슬롯을 선택하면 Transform 리셋 버튼이 항상 켜져 있던 문제**. 사용자 보고: "초기값인데도 수정값이 들어가서 모두 Transform 의 리셋 버튼이 활성화되어있다".
  - **Why**: 프리셋 적용은 사용자의 편집이 아니라 "이 레이아웃의 기본 형태" 를 심는 일인데, 심는 자리가 슬롯의 `props.style`(base) 과 `responsive`(breakpoint override) **inline** 이다. dirty/reset baseline 은 프리셋 컨테이너(body)만 알고 **슬롯은 몰랐다** — 그래서 프리셋이 심은 값이 전부 사용자 편집으로 읽혔다. 실측: 프리셋 **26 슬롯 전부** Transform dirty (모두 `minHeight`, 고정폭 슬롯은 `width`/`flexShrink` 추가). 비-desktop 은 한술 더 떠 "override 가 **존재하면** dirty" 라, 프리셋이 심은 tablet width 까지 수정됨으로 잡혔다.
  - 이제 baseline 이 부모 프레임의 `appliedPreset` + 슬롯 이름으로 그 슬롯의 `defaultStyle`/`responsiveStyle` 을 찾아 기준값으로 쓴다. 비-desktop 도 존재 여부가 아니라 **값** 비교로 바뀌었다.
  - 리셋의 목적지도 함께 정정 — 비-desktop 리셋이 override 를 **지우면** desktop cascade 값(sidebar 250px)으로 떨어져 프리셋이 의도한 형태가 무너진다. 프리셋이 그 breakpoint 에 심은 값이 있으면 **그 값으로** 복원한다.
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`
- **같은 슬롯의 Transform Height 가 실제 크기와 무관하게 `60px` 로 표시되던 문제**.
  - **Why**: Slot 은 고유 높이가 없는 배치 자리(flex/grid 가 크기를 정함)인데 catalog `Slot.sizes.*.height` 가 40/60/80 을 들고 있었고, 패널은 inline height 가 없으면 catalog 로 fallback 한다. 그 값은 **렌더·레이아웃 소비자가 0건**이라 화면에는 영향이 없었고 — 그래서 캔버스는 맞는데 **패널만 거짓말하는** 비대칭이었다 (라이브 실측: 실제 박스 `200 × 1024`, 패널 표시 `60`).
  - catalog Slot 의 height 를 `0`(= 고유 높이 없음)으로 정정 — 같은 composition-native 레이아웃 컨테이너인 `body`/`frame` 과 동일한 표기다. 빈 슬롯이 보이게 하는 하한은 종전대로 프리셋 `minHeight` 소관.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`
- 검증: 회귀 테스트 35건 — 프리셋 정의를 직접 순회해 **전 프리셋 × 전 슬롯 × 3 breakpoint** 에서 dirty 0 을 단언하므로 프리셋을 새로 추가해도 baseline 누락이 자동으로 잡힌다. baseline 을 되돌리면 27건 red. 라이브: 리셋 버튼 소멸 / Height `auto` + Min H `60` / 실제로 width 를 240 으로 고치면 리셋 버튼 재등장 → 리셋 시 문서가 **바이트 단위로 원상 복구**(tablet 200px).

## [컴포넌트 라이브러리의 ListBox/GridList 마스터가 빈 채로 생성되던 문제] - 2026-07-27

### Bug Fixes

- **새 프로젝트의 Components 페이지에서 ListBox·GridList 마스터가 아무 행도 보여주지 못하던 문제**.
  - **Why**: 행 템플릿(`component-listbox-item-*` / `component-gridlist-item-default`)은 `{icon}`/`{label}`/`{description}` 을 보간하는데 origin seed 의 `props.items` 가 `[]` 였다. 보간할 데이터가 없으니 authoring 판정이 **static + 정적 자식 0개**로 떨어져 컬렉션이 통째로 비었다 — 컴포넌트 라이브러리 마스터가 자기 모습을 못 보여주는 상태.
  - 시드에 중립적인 대표 행 3개를 기본값으로 실었다 (ListBox: Inbox / Starred / Archive + lucide 아이콘, GridList: Documents / Images / Downloads). 이제 authoring 판정이 `data-bound / items` 로 넘어가 행이 실제로 렌더된다.
  - **기존 문서는 그대로 유지된다** — `repairOrigin` 이 기존 `props` 를 보존하므로 재시드가 사용자가 편집(또는 비운) items 를 덮어쓰지 않는다.
  - 검증: 회귀 테스트 5건 — 기본 items 존재 + 템플릿이 보간하는 키 구비 + authoring 판정 `data-bound` + **실제로 행 3개가 렌더**(로딩 해소 후) + 사용자가 비운 items 를 되살리지 않음. 시드를 되돌리면 3건이 red.
  - 위치: `apps/builder/src/builder/components/{listbox/listBoxTemplateOrigins.ts,gridlist/gridListTemplateOrigins.ts}`

## [컬렉션 밖 항목이 preview 를 통째로 죽이던 문제] - 2026-07-27

### Bug Fixes

- **프레임을 적용한 Components 페이지에서 preview 가 빈 화면이 되던 문제**. 콘솔에 `Uncaught Error: ListBoxItem cannot be rendered outside a collection.` 이 뜨고 그 위 트리가 통째로 언마운트됐다.
  - **Why**: React Aria 는 collection 항목(`ListBoxItem` 등)을 **자기 collection 안에서만** 렌더할 수 있다. 그런데 컴포넌트 쇼케이스 페이지는 항목 variant 를 **body 직계에 단독 배치**한다 — 실측 `page-components` body 직계에 `ListBoxItem` 2개 · `GridListItem` · `MenuItem` 4건. Skia 캔버스는 React Aria 를 쓰지 않아 그대로 그렸고 **DOM preview 만 죽어서**, 빌더와 미리보기가 "한쪽은 그림 / 한쪽은 크래시" 로 갈렸다.
  - 이제 `CanonicalNodeRenderer` 가 조상에 맞는 collection 이 없는 항목을 만나면 **최소 React Aria collection 을 즉석에서 씌운다**. 호스트는 `display: contents` 라 박스를 만들지 않아 Skia 가 그리는 단독 항목과 시각 결과가 같고, 이미 collection 안에 있는 항목은 덧씌우지 않는다. **문서(데이터)는 바꾸지 않는다** — 단독 배치는 쇼케이스 의도다.
  - 검증: 실제 문서의 Components 페이지(프레임 적용 상태)에서 요소 **57개 전부 렌더**(수정 전 0), 호스트 4개 생성(`display: contents`), 실제 컬렉션 2개는 이중 래핑 없음. 회귀 테스트 11건은 수정을 끄면 사용자가 본 그 오류로 9건이 red 가 된다.
  - 위치: `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`, 테스트 `apps/builder/src/preview/components/__tests__/CanonicalNodeRenderer.orphanCollectionItem.test.tsx`

## [컨테이너가 자기 고유 폭을 갖게 됨 — 사이드바 레이아웃 초과/붕괴 해소 (ADR-169)] - 2026-07-27

### Bug Fixes

- **사이드바형 프리셋에서 콘텐츠가 프레임을 넘치거나 사이드바가 사라지던 문제** (`sidebar-left` / `sidebar-right` / `list-detail`).

  | 형태                                    | 변경 전        | 변경 후    | DOM(정답)  |
  | --------------------------------------- | -------------- | ---------- | ---------- |
  | 프리셋 실형태 (사이드바 `flexShrink:0`) | 250 / **1920** | 250 / 1670 | 250 / 1670 |
  | 사이드바에 `flexShrink:0` 이 없는 형태  | **0** / 1920   | 240 / 1680 | 240 / 1680 |
  | 자식이 실제로 넓은 경우 (고정 3000px)   | 0 / 3000       | 0 / 3000   | 0 / 3000   |
  - **Why**: 레이아웃 엔진이 flex item 을 **컨테이너의 가용 폭으로 한 번 풀어 보고 그 결과를 그 item 의 고유 폭으로 삼았다.** 그래서 _스스로 폭을 갖지 않고 늘어나기만 하는 내용_(`width:100%`, auto 폭 블록)이 "이 item 은 1920 이 필요하다" 로 오인됐다. 게다가 그 한 값이 flex 기준 크기와 **최소 크기(CSS-FLEXBOX-1 §4.5)** 양쪽에 쓰여, **상한 근사가 하한으로** 작동했다 — 그래서 item 이 available 밑으로 못 내려가고 형제가 부족분을 뒤집어썼다. 세 번째 행처럼 자식이 진짜로 넓으면 DOM 도 똑같이 형제를 붕괴시키므로, 이는 정상 동작이라 건드리지 않았다.
  - 이제 컨테이너 item 은 **엔진이 자기 알고리즘을 측정 모드로 재실행**해 min/max-content 를 산출한다 (Taffy `AvailableSpace::{MinContent,MaxContent}` / Blink `ComputeMinMaxSizes` 와 같은 형태). 텍스트 leaf 는 기존대로 TS 폰트 측정 스칼라를 쓴다 — 경계는 **"폰트 측정은 TS / 구조 집계는 엔진"**.
  - **grid 는 의도적으로 이연**한다. 측정 모드에서 grid 의 `fr`·`auto` 트랙이 0 으로 풀려 grid item 이 통째로 사라지므로(실측 1920 → 0), 측정 자체를 포기하고 이전 경로를 남겼다. 재개 조건은 CSS-GRID-1 §12 track sizing 선행 — `.claude/rules/layout-engine.md` §컨테이너 intrinsic 에 기록.
  - 위치: `packages/composition-engine/src/tree.rs` (`measure_intrinsic_width` / `solve_flex` / `solve_block`), `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

### Performance

- **깊게 중첩된 레이아웃의 계산 시간 회귀 차단** — 위 수정이 처음에는 중첩 깊이에 지수적이었다 (깊이 12 기준 47 µs → **36.5 ms**). 원인은 측정 캐시가 아니라(적중률 100%), 정확한 고유 폭이 들어가면서 "분배 후 재배치" 단계가 **매 레벨 발생**해 레벨마다 서브트리를 한 번 더 풀던 것이다.
  - 측정 모드가 자식 컨테이너를 재귀적으로 다시 푸는 대신 **캐시된 값을 소비**하도록 바꾸고, 어차피 결과가 버려지던 **선행 solve 를 제거**해 재배치 단계 하나로 일원화했다.
  - 깊이 1/4/8/12 = **9.1 / 20.0 / 33.7 / 46.0 µs** (전부 도입 전 수치 이하, 깊이당 ≈3.1 µs 선형). 실제 빌더 진입점 기준 깊이 12 가 **26.4 ms → 0.4 ms**.
  - 위치: `packages/composition-engine/src/tree.rs`, 벤치 `packages/composition-engine/benches/tree_solve.rs`

### Architecture

- **ADR-169 Implemented** — 컨테이너 intrinsic 크기 산출 (Phase 0~4). 프로토콜 슬롯(`FLEX_FIELD_COUNT = 20`, off 13/19)은 그대로이고 **공급 주체**만 바뀌었다. 엔진↔TS 경계와 grid 이연 재개 조건은 `.claude/rules/layout-engine.md` §컨테이너 intrinsic / §TS 잔존 계약 / §automatic minimum 에 기록.
- TS 의 컨테이너 대상 `minWidth` 선주입을 제거했다 (leaf 는 존치) — 그 주입이 §4.5 최소 크기 분기를 무력화해 엔진 수정이 도달하지 못하게 막고 있었다. 원인은 주입을 일시 차단한 대조 실험으로 확정.
- Chrome 실측 fixture `apps/builder/tests/parity/containerIntrinsic.browser.test.ts` (16 케이스) 신설 — 정합 3 / 해소된 발산 4 / R8 판별·대조 5 / grid 이연 상태 4.

## [grid 셀 안 자식이 컨테이너 폭을 쓰던 문제 — 측정 pass ↔ 증분 캐시] - 2026-07-27

### Bug Fixes

- **grid 슬롯에 넣은 요소의 폭이 슬롯 폭을 넘던 문제** (dashboard 프레임을 적용한 페이지, desktop 에서 보고). `240px 1fr` 의 두 번째 칸(1628)에 놓인 `width: 100%` 요소가 **1888**(= 컨테이너 content 폭)로 잡혔다 — sidebar 240 + gap 20 이 빠지지 않은 값이다.

  | 대상                      | 변경 전 | 변경 후 |
  | ------------------------- | ------- | ------- |
  | content 슬롯 (grid 트랙)  | 1628    | 1628    |
  | 그 안의 `width:100%` 요소 | 1888    | 1628    |
  - **Why**: `solve_grid` 의 auto row/column **intrinsic 측정 pass** 가 자식 서브트리를 **컨테이너 크기**로 solve 하는데, `solve_*` 는 말미에 `dirty=false` 를 찍는다. 이어지는 "셀 크기로 재귀 solve" 가 `subtree_has_dirty == false` 에 걸려 **증분 skip → stale 캐시**를 돌려줬다. 셀 자신은 직후 `bounds` 로 덮어써지므로 **자손만** 어긋나 눈에 잘 띄지 않았다.
  - `solve_flex` 는 같은 함정을 이미 알고 `used_main` 재-solve 전에 `mark_subtree_dirty` 로 되살리고 있었다 — grid 쪽에만 없던 대칭 결함이다. 셀 크기가 측정 available 과 같으면 되살리지 않아 증분 재사용은 보존한다.
  - 검증: Chrome 실측 차등 하니스 5 케이스 추가 (`slotPercentChild.browser.test.ts`) — grid(암묵 auto row / 명시 auto row / 2단 중첩) 3건이 수정 전 FAIL, block 기준선 2건은 전후 PASS. Rust 324 + parity 105 케이스 PASS.
  - 위치: `packages/composition-engine/src/tree.rs::solve_grid`

- 함께 확인한 **범위 밖 발산 2건** (수정하지 않음, 실측만 기록):
  - grid item 의 명시 `width` 가 stretch 에 먹힌다 (`240px 1fr` 두 번째 칸 + `width:700px` → DOM 700 / 엔진 1680). ADR-156 옵션 3-b 의 문서화된 residual.
  - flex 컨테이너에 **자식을 가진 flex item** 이 섞이면 형제가 붕괴한다 (row 1920 에 `[240px, {grow:1, 자식 width:100%}]` → DOM `240 / 1680` vs 엔진 `0 / 1920`). 자식이 없으면 동일 구조가 정상이라 `used_main` 재-solve 뒤 두 번째 `flex_layout` 입력 문제로 보인다.

## [프레임을 적용한 페이지의 breakpoint 대응 복구 — page-frame 합성] - 2026-07-27

### Bug Fixes

- **프레임을 페이지에 적용하면 슬롯이 breakpoint 를 따라가지 않던 문제** (dashboard 2종에서 보고). 같은 프리셋이 프레임 편집 화면에서는 정상이고 페이지에서만 어긋났다 — 실측 (dashboard, mobile 390):

  | 맥락                  | 결과                                           |
  | --------------------- | ---------------------------------------------- |
  | 프레임 편집 (기준)    | 358 폭 세로 스택 — 60 / 60 / 652 (페이지 높이) |
  | 페이지 적용 (변경 전) | 2열 grid 유지 — sidebar 240 / **content 98**   |
  | 페이지 적용 (변경 후) | 358 폭 세로 스택 — 60 / 60 / 652 (기준과 동일) |
  - **Why**: `mergePageBodyWithFrameLayout` 이 frame body 의 `props.style` 만 합쳤다. breakpoint override 는 `responsive` — **최상위 canonical 필드**라 `{...pageBody}` 스프레드가 page body 것만 실어 왔고, page body 는 자기 override 가 없는 게 보통이다 (실측: 프레임 바인딩된 3개 페이지 전부 `responsive: null`). 그래서 프리셋이 심은 컨테이너 override(트랙 교체 / mobile 세로 스택)가 통째로 사라졌다.
  - 슬롯 쪽 override 는 노드 스프레드(`asPageResolvedSlot`)로 **살아남아 있었다.** 한쪽만 살아남은 탓에 `Widget Panel` 은 tablet 에서 widgets 가 `(0,1024) 488×1024` 로 이동해 **sidebar 와 겹쳤다** — item 은 옮겨졌는데 컨테이너의 3행 트랙이 안 왔기 때문. ADR-168 G8("item placement override 는 컨테이너 template override 를 동반한다")이 프리셋 정의에서는 지켜졌는데 이 합성 경로에서 반쪽만 통과했다. 변경 후 `(0,964) 768×60` 하단 전폭 행.
  - 병합 정책은 base style 과 동일하다 — frame 이 이기되 page 가 선언한 viewport 키(width/height/min·max/background\*)는 page 가 되찾는다. `visibility` 는 page 것만 쓴다: 합쳐진 노드가 page body 라, frame body 를 mobile 에서 숨기라는 선언을 그대로 적용하면 page 소유 콘텐츠까지 사라진다.
  - 위치: `workspace/canvas/scene/resolvePageWithFrame.ts`

- **grid 프레임을 적용한 페이지에서 슬롯 행마다 페이지 한 장 높이가 되던 문제** — desktop dashboard 실측: navigation 이 `60` 이어야 하는데 `1048` 이 되고 두 번째 행이 `y=1084` 로 **페이지 밖**에 놓였다 (총 높이가 페이지의 2배).
  - **Why**: `getPageResolvedSlotStyle` 의 grid 분기가 `height: 100%` 를 주입했다. CSS 에서 grid item 의 백분율 높이는 자기 **grid area** 기준이고 `auto` 행은 불확정이라 auto 로 접히는데, 레이아웃 엔진은 컨테이너 높이로 해석해 `auto` 행이 페이지 전체로 부풀었다.
  - grid item 은 기본 stretch 라 주입 자체가 불필요하다 — 같은 슬롯이 프레임 편집 맥락에서는 주입 없이 자기 area 를 정확히 채운다 (실측 desktop: sidebar 240×968 / content 1628×968). ADR-168(슬롯이 자기 배치·크기를 스스로 선언) 이전의 fallback 이었다. 배치 fallback(`gridArea ??= slotName`)만 남긴다.
  - 위치: `workspace/canvas/scene/resolvePageWithFrame.ts`

- 검증: 프레임 편집 맥락을 기준으로 **dashboard 2종 × 3 breakpoint 전수 대조** — 6조합 모두 좌표·크기가 기준과 일치. flex 계열(`3-Row`) 회귀 없음. 회귀 테스트 5건 추가 (`resolvePageWithFrame.test.ts`), 그중 3건은 수정 전 FAIL 확인.

## [Frame Preset 미리보기 식별성 — 썸네일 가독성 정규화] - 2026-07-26

### Bug Fixes

- **Frame Preset 썸네일이 프리셋을 구분해주지 못했던 문제** (실측, 80×60 썸네일 기준):

  | 항목                              | 원래 비율 | 변경 전 렌더               | 변경 후          |
  | --------------------------------- | --------- | -------------------------- | ---------------- |
  | 밴드 슬롯 60px / 1080px (desktop) | 5.6%      | 3.3px                      | 12px 구간        |
  | 밴드 슬롯 60px / 844px (mobile)   | 7.1%      | 4.3px                      | 12px 구간        |
  | 사이드바 250px / 1920px           | 13.0%     | 10.4px                     | 12px 구간        |
  | 슬롯 이름표 (`fontSize` 8)        | —         | 높이 4.8px + 가로 75% 압축 | 제거 → 호버 툴팁 |
  - 증상: mobile 에서 `전체화면 / 수직 2단 / 수직 3단 / 좌측·우측 사이드바 / 목록-상세` **6개가 사실상 동일한 회색 사각형**이었고, `피드` 만 카드 격자 덕에 구분됐다. 슬롯 이름표는 어느 프리셋에서도 읽히지 않았다.
  - **Why**: 썸네일이 **실제 프레임의 픽셀 비율을 그대로** 80×60 에 그렸다. 1080px 안의 60px 밴드는 5.6% = 3.3px 이고, 1px 테두리 두 개를 빼면 내부가 1~~2px 라 선 한 줄로 읽힌다. 프리셋을 구분하는 특징(어떤 밴드·열이 있는가)이 전부 3~~13px 구간에 몰리고 서로의 차이는 1~3px 였다. 썸네일의 용도는 **식별**이지 계측이 아닌데 비율 충실성이 식별성을 잡아먹은 셈이다.
  - 좌표계 왜곡이 나머지 절반이었다. `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` 로 정사각 좌표를 80×60 에 눌러 담아 x·y 배율이 0.8 / 0.6 으로 갈렸다 — `strokeWidth: 1` 이 가로 0.8px·세로 0.6px, `rx: 2` 가 1.6×1.2 타원, `fontSize: 8` 이 높이 4.8px + 가로 75% 압축이었다.
  - 인접 슬롯이 경계를 공유해 각자의 1px 테두리가 같은 선에 겹쳐, 별개 블록이 아니라 **한 덩어리에 칸막이가 있는 모양**으로 읽혔다.
  - 위치: `panels/properties/editors/LayoutPresetSelector/{normalizeThumbnailAreas,PresetPreview,index}.tsx`

- **썸네일 표현이 패널 안에서 겉돌았던 문제** — 채워진 회색 블록이라 이 패널만의 별개 표현이었다. 컴포넌트 패널 항목 아이콘(`.list-item-icon`)도, 바로 위 카테고리 헤더의 lucide 레이아웃 아이콘(`Layout` / `Columns2` / `LayoutGrid` / `Rows3`)도 **inset 표면 + `--fg-muted` 선화**인데 썸네일만 벗어나 있었다. 같은 색 패턴으로 정렬 — 실제 빌더 계산값이 배경·반경·색 모두 아이콘 박스와 일치한다.
  - **바깥 테두리는 두지 않는다** (2026-07-27). 아이콘 박스는 16px 글리프를 담느라 경계를 그려주지만, 썸네일 도형은 상자를 거의 채우므로 도형 자체가 이미 경계다 — 한 겹 더 두르면 첫 도형과 2px 간격으로 나란히 놓여 이중선이 된다. 부수 효과로 좌표 매핑도 정확해졌다: `box-sizing: border-box` 라 1px 테두리가 80×60 뷰포트를 **78×58 로 줄여** viewBox 가 x 0.975 / y 0.967 비균등 축소되고 있었다 (제거 후 실측 80×60, 1:1).
  - **모든 도형이 면이다** (2026-07-27). 표면은 아이콘 패턴을 유지하되 도형 채널만 갈린다 — 배치를 읽는 단위라 덩어리로 보이는 편이 낫다는 판단. 채움은 `--bg-muted`: 지시된 `--border` 와 light(gray-200)·dark(zinc-700) 모두 **값이 완전히 같아** 픽셀 차이가 0 이면서 "테두리 변수를 배경·채우기에 사용 금지" (`rules/css-tokens.md`) 를 지킨다.
  - 위계는 표면에서 멀어지는 **elevation 3단**이다 — 표면 `--bg-inset` / 슬롯·판 `--bg-muted` / required 슬롯·격자 카드 `--bg-emphasis`. 실측 lightness: light `0.985 / 0.928 / 0.872`, dark `0.210 / 0.370 / 0.442` (방향은 뒤집히지만 두 테마 모두 단조롭게 멀어진다).
  - 격자 셀을 품은 슬롯은 required 여도 판 단계로 내린다 — 카드와 같은 색이면 카드 8개가 통째로 사라진다. 그 슬롯의 required 는 카드가 대신 표시한다.
  - `currentColor` 소비자가 사라져 `.preset-preview-svg` 의 `color` 선언도 제거했다 (죽은 선언). 선을 다시 도입하면 그 선언이 다시 필요하다 — `.list-item.applied` 가 카드에 거는 `--fg-on-accent` 가 상속되기 때문이며, 그 사유는 CSS 주석에 남겼다.
  - 위치: `panels/properties/editors/LayoutPresetSelector/{PresetPreview.tsx,styles.css}`

- **required 슬롯 강조가 거꾸로 작동했던 문제** — required 슬롯을 `--accent-subtle` 배경으로 강조하려 했는데 오히려 뒤로 물러나 보였다.
  - **Why**: builder 테마의 `--accent-subtle` 은 이름과 달리 **회색 wash** 다 (light `rgba(107,114,128,.15)` / dark `rgba(161,161,170,.2)`). `--bg-overlay` 위에 얹으면 일반 슬롯의 `--bg-muted`(gray-200) **보다 밝다** — 강조 색이 아니라 후퇴 색으로 작동했다.
  - 강조는 **표면 대비가 커지는 방향**으로만 준다. 최종 형태는 required 슬롯의 면을 한 단계 올린 `--bg-emphasis` — 실측 lightness (표면 / 일반 / required): light `0.985 / 0.928 / 0.872`, dark `0.210 / 0.370 / 0.442`. 두 테마 모두 required 의 표면 대비가 약 2배다 (대비 방향은 뒤집히지만 관계는 유지).
  - `--accent-subtle` 의존은 완전히 없어졌다. 재도입은 렌더 계약 테스트가 막는다.
  - 같은 함정을 CSS 규칙으로 못 박았다 — `.claude/rules/css-tokens.md` §"builder 테마의 accent 는 무채색".
  - 위치: `panels/properties/editors/LayoutPresetSelector/PresetPreview.tsx`

### Features

- **Frame Preset 표시명을 영문 정식 명칭으로** (2026-07-27). 카테고리와 프리셋 제목이 한국어였다.
  - 카테고리: 기본 → `Basic` / 네비게이션 → `Navigation` / 목록-상세 → `List` / 피드 → `Feed` / 복합 → `Complex` / 대시보드 → `Dashboard` (각 label 이 `PresetCategory` union key 와 맞춰진다)
  - 프리셋: 전체화면 → `Fullscreen` / 수직 2단 → `2-Row` / 수직 3단 → `3-Row` / 좌측·우측 사이드바 → `Left Sidebar`·`Right Sidebar` / 목록-상세 → `List-Detail` / 피드 → `Feed` / 대시보드 → `Dashboard` / 대시보드 (위젯) → `Widget Panel`. `Holy Grail` 은 원래 영문
  - `List-Detail` 과 `Feed` 는 M3 canonical layout 의 공식 명칭 그대로다. `Widget Panel` 은 `Dashboard` 그룹 안에서 이 프리셋이 더하는 것(위젯 열)을 가리킨다 — "Dashboard + Widgets" 는 카드 폭을 넘겨 잘린다
  - 카드 이름은 `nowrap` + ellipsis 라 길이가 제약이다. 전 10종 실측 결과 최대 폭 75px(`Right Sidebar`) 로 **잘림 0건** (사용 가능 폭 88px)
  - 슬롯 `description` 도 함께 영문화했다 — 이 값은 생성되는 Slot 요소 props 로 **저장**되므로, 기존 문서의 슬롯은 이전 한국어 설명을 유지한다

### Architecture

- **`normalizeThumbnailAreas`** — 썸네일 가독성 정규화 레이어 신설. 파생(`derivePreviewAreas`)의 비율 계약(ADR-168 G3 — 썸네일 비율 = 실제 렌더 비율)은 그대로 두고, **표시 직전**에 통과시키는 순수 변환이다. 축별로 슬롯 경계가 만드는 구간에 최소 두께(12px)를 보장하고 늘린 만큼은 최소치를 넘는 구간에서만 여유에 비례해 회수한다 — piecewise-linear 좌표 remap 이라 인접·포함·순서가 보존되고 `content` 가 밴드보다 크다는 위계도 남는다. 격자 셀은 슬롯 경계를 만들지 않고 같은 사상을 통과하므로 부모 슬롯 안에 그대로 머문다.
  - 전체 합으로 재정규화하는 방식을 먼저 썼다가 테스트가 반증했다 — `수직 3단` 밴드가 12px 목표에서 9.3px 로 복귀. 최소치를 `100 / 구간 수` 로 낮추는 보정이 회수 가능성을 산술적으로 보장한다(`slack 합 − excess = 100 − 구간 수 × 최소치 ≥ 0`).
  - 위상 보존은 정적 계약으로 고정했다 (프리셋 10종 × breakpoint 3종 전수): 슬롯 이름·개수 동일, 두 축 0~100 덮음, 순서 불변, 셀 포함 관계 유지, 단조성.
- 슬롯 이름표를 SVG `<title>` 로 옮겼다 — 호버 툴팁과 스크린 리더 양쪽에 걸리고 레이아웃 비용이 0 이다. 카드 접근 이름도 `"content*전체화면"` → `"header · content 전체화면"` 으로 정상화됐다.
- `PresetPreview.test.tsx` 신설 (9 케이스) — 이 컴포넌트의 결함은 두 번 모두 **그려지긴 하는데 정보를 전달하지 않는** 형태였다. 그래서 "무엇이 어떤 시각 채널을 담당하는가" 를 렌더 결과로 고정한다: required 강조 = 테두리 / 이름표 = 없음 (`<title>` 이 담당) / 좌표계 = px / 사각형은 inset 만큼 물러남. 테두리 채널을 되돌리면 3 케이스가 FAIL 하는 것까지 확인했다.
- 프리셋 10개의 썸네일 파생을 매 렌더마다 돌려 `PresetPreview` 의 `memo` 가 무력했던 것도 함께 해소 (breakpoint 기준 `useMemo`).

## [되돌리기 단위 정합 — 한 조작 = undo 1회] - 2026-07-26

### Bug Fixes

- **한 번의 조작을 되돌리려면 undo 를 여러 번 눌러야 했던 문제** (실측 엔트리 수):

  | 조작                        | 전               | 후  |
  | --------------------------- | ---------------- | --- |
  | Button 아이콘 선택 / 지우기 | 3                | 1   |
  | 그룹 해제 (Cmd+Shift+G)     | 2                | 1   |
  | 다중 선택 삭제 (요소 2개)   | 4                | 1   |
  | 정렬 / 분배 (패널 버튼)     | 2                | 1   |
  | 정렬 / 분배 (단축키)        | 1 + 선택 요소 수 | 1   |
  | 배치 편집 (공통 속성)       | 2                | 1   |
  | 그룹 (Cmd+G)                | 1                | 1   |

  "후" 값은 표의 모든 행이 실측이다.
  - 정렬·분배는 `left/top/width/height` 가 모두 px 인 요소가 있어야 동작하므로(그 4개가 없으면 조기 종료) 임시로 조건을 만들어 **패널 버튼과 단축키 두 경로를 따로** 확인했다 — 오른쪽 정렬(우변 160 정합) / 위 정렬 / 수평 분배(가운데 50 → 100px 균등) 모두 엔트리 1개 + undo 1회 복원.
  - 배치 편집(다중 선택 "공통 속성")은 필드 변경이 **대기 상태로 모이고 "모두 적용" 버튼**에서 한 번에 반영되는 구조다. `isDisabled` 토글 → 적용 → 엔트리 1개, 두 요소 모두 반영, undo 1회 복원. 요소 id 가 prop 이름으로 새는 현상(아래 인자 형태 오류)도 0건으로 확인.
  - **Why**: 원인이 두 갈래다. ① Button 아이콘 조작은 store write 가 3갈래(아이콘 자식 생성 + label 을 Text 자식으로 이관 + Button children 비우기)인데 감싸는 장치가 없었다 → **동기 history 트랜잭션 창**으로 감쌌다. ② 나머지는 `track*` 헬퍼와 store action 이 **같은 변경을 두 번 기록**했다. `track*` 은 mutation 이 스스로 history 를 기록하지 않던 시절의 것인데, 2026-07-15 에 전 mutation 경로가 canonical event 부착으로 전환된 뒤 짝을 맞추지 않은 호출부가 중복이 됐다.
  - 상태가 깨지지는 않았다(중복 insert 가 upsert) — 증상은 **아무 것도 안 바뀌는 죽은 undo 단계**였다. 그룹 해제는 undo 1회가 "빈 frame 만 복원", 2회에야 자식이 돌아왔다.
  - 다중 삭제는 요소별 삭제를 병렬로 돌려 **각각이 오래된 상태를 기준으로 저장**하면서 앞선 삭제를 메모리에 되살릴 수 있는 race 도 있었다 → 배치 삭제 1회로 교체.
  - 정렬/분배/배치 편집이 넘기던 인자는 형태부터 틀렸다 — "모든 요소에 적용할 props 패치" 자리에 `{요소id: 스타일}` 맵을 넘겨 **요소 id 가 prop 이름으로** 기록됐다.
  - 위치: `panels/properties/{ButtonChildSection,PropertiesPanel,CanvasSelectionShortcuts}.tsx`, `stores/utils/historyHelpers.ts`

### Architecture

- **`historyManager.runInTransaction(meta, fn)`** — 여러 mutation 을 되돌리기 1단위로 묶는 진입점. 여닫기를 한 곳에 모아 `finally` 누락으로 창이 열린 채 남는 사고를 없앤다. `fn` 은 **동기**여야 한다: 창이 열린 동안의 기록은 전부 병합되므로 창 안에서 `await` 로 양보하면 그 틈의 무관한 변경까지 같은 되돌리기 단위로 빨려 들어간다. 양보 지점이 없으면 JS 단일 스레드가 상호배제를 제공한다.
- **양보 감지** — 창이 실제로 양보하면 커밋 시 경고한다(`queueMicrotask` 기반). 동기 창이면 감지 콜백이 커밋 뒤에 돌아 조용하다.
- `trackMultiDelete` 제거 — "요소마다 엔트리 1개" 라는 설계 자체가 문제였다. `trackBatchUpdate` 는 `trackInstancePropagation` 의 정당한 사용처가 있어 유지하고, 호출 규약(기록하는 action 과 병용 금지 / 인자 의미)을 문서화했다.

## [Frame 프리셋 반응형 — desktop/tablet/mobile 3 breakpoint 대응 (ADR-168)] - 2026-07-26

### Features

- **프리셋이 breakpoint 별로 형태를 바꾼다** (ADR-168 Phase 1~5):
  - 좁은 폭에서 사이드바를 **줄이는 게 아니라 세로로 스택**한다. 레퍼런스 4출처(M3 canonical layout / Apple HIG split view / Wroblewski column drop / Framer·Webflow 템플릿)가 같은 결론으로 수렴한다.
  - **실측** — 목록-상세: list `320`(desktop) → `260`(tablet) → **전폭 스택**(mobile, list 높이 120 / detail 684). Holy Grail: `200·1fr·200` → `160·1fr·160` → 5단 세로 스택(content 504). 좌·우 사이드바: `250` → `200` → 전폭 스택.
  - 전환은 컨테이너 `display: grid → flex` + `flexDirection: column` **한 줄**로 끝난다 — 슬롯이 grid 배치와 flex 크기를 병기하므로 grid 모드에선 flex 가, flex 모드에선 grid line 이 무시된다. 덕분에 슬롯 트리가 평면으로 유지되고 이름 없는 wrapper 노드가 생기지 않는다.
  - 10 프리셋 × 3 BP = **30 조합 전수 실측**: 고정폭 합이 뷰포트를 넘는 경우 0건, 콘텐츠 슬롯 폭·높이 0 인 경우 0건.
- **프리셋 카탈로그 9 → 10 재구성**:
  - 신규 `목록-상세`(M3 canonical list-detail), `피드`(카드 격자 — 폭에 따라 열 수 4→2→1).
  - `complex-3col` 삭제 — Holy Grail 과 컬럼 폭만 다른 동일 구조라 흡수. 기존 프레임의 레이아웃 자체는 유지되고 "적용됨" 배지만 사라진다.
  - 카테고리 4 → 6(`목록-상세`/`피드` 추가). 카테고리 추가 시 손댈 곳이 union + 메타 한 쌍으로 줄었다.
- **프리셋 썸네일이 현재 breakpoint 를 반영한다**:
  - 손으로 적던 좌표 배열 10벌을 폐지하고 프리셋 정의에서 파생한다. 헤더의 breakpoint 토글을 바꾸면 캔버스와 썸네일이 함께 바뀐다.
  - 격자 슬롯은 내부 카드 셀까지 그린다 — `피드`의 열 수 변화(4→2→1)가 썸네일에 드러난다.

### Bug Fixes

- **프리셋 썸네일·경고 다이얼로그가 다크모드를 따르지 않던 문제**:
  - **Why**: 원시 토큰(`--color-gray-*` / `--color-white` / `--color-warning-*`)은 dark 재정의가 없다. 다크 테마에서 흰 배경 위에 연회색 사각형이 그려지고 이름표가 배경에 묻혔다.
  - 시맨틱 토큰으로 전환(`--bg-overlay` / `--bg-muted` / `--bg-inset` / `--border` / `--fg-muted` / `--accent` / `--notice`). 실측: svg 배경·rect fill·stroke·라벨·경고 아이콘 5개 값 전부 light↔dark 반응.
- **portal 로 열리는 다이얼로그가 builder 토큰을 못 받던 문제**:
  - **Why**: `builder-system.css` 의 portal fallback 이 `body > .react-aria-Modal` 인데 RAC 는 Modal 을 `.react-aria-ModalOverlay` 로 한 겹 감싼다 → `>` 결합자 미매칭 → `--notice` 등 semantic 토큰이 전부 미정의가 되어 선언이 통째로 무효화. 경고 아이콘이 주황을 잃고 본문 색을 상속했다.
  - `ExistingSlotDialog` 의 Modal 에 `data-context="builder"` 부여. 경고 색뿐 아니라 `--bg-inset` 등 다이얼로그 전체 토큰이 테마별로 정상화됐다.
  - **잔존**: fallback 선택자 자체는 여전히 RAC Modal 에 매칭되지 않는다. 신규 builder modal 은 `data-context="builder"` 를 직접 부여해야 한다.
- **프리셋 적용 후 Preview 의 `@media` CSS 가 새로고침 전까지 갱신되지 않던 문제**:
  - **Why**: `updateElement` 의 layout 영향 판정이 `props` 축만 봤다. `responsive` 는 top-level 필드라 `responsive`-only write 가 layout 무영향으로 판정되어 `layoutVersion` 이 오르지 않고 resolve 재계산·preview 재발행이 건너뛰어졌다. 캔버스가 정상으로 보인 건 슬롯 생성·삭제 mutation 이 `layoutVersion` 을 올려준 덕에 편승했기 때문.
  - `inspectorActions`(Style 패널 경로)에만 있던 처리를 일반 경로로 승격 — 이 규칙은 호출자 속성이 아니라 필드 자체의 성질이다.
  - 위치: `apps/builder/src/builder/stores/utils/elementUpdate.ts`. 가드: `elementUpdate.static.test.ts`.
- **슬롯의 breakpoint override 가 canonical 문서로 옮겨지지 않던 문제** (ADR-154 시절 gap):
  - **Why**: `canonicalMutations.ts` 의 슬롯 분기가 필드를 직접 나열하며 early return 해 `baseNode` 의 `responsive` 스프레드에 도달하지 못했다. 슬롯 레벨 override 의 첫 writer 가 생기면서 드러났다 — mobile 에서 body 는 세로로 쌓이는데 사이드바만 250px 그대로였다.
- **publish CSS 에서 grid line 숫자에 `px` 가 붙어 선언이 무효화되던 문제** (R7):
  - **Why**: `formatCssValue` 가 숫자에 `px` 를 붙이는데 `UNITLESS_PROPS` 에 `gridColumnStart/End`·`gridRowStart/End` 가 없었다. `grid-column-start:1px` 는 무효라 DOM 은 auto-placement, Skia 는 숫자 line 배치 → **배포 산출물 발산**.
  - 실측 확인: 4키 전부 unitless emit (`grid-column-start=1`, `grid-column-end=3`, `grid-row-start=3`, `grid-row-end=4`).
- **Undo 가 breakpoint override 를 되돌리지 않던 문제**:
  - **Why**: `updateElement` 의 history 기록 조건이 `props` 존재 여부였다. `responsive` 는 top-level 필드라 props 없는 write 가 되어 **history entry 가 아예 생기지 않았다**. 기록됐더라도 update event 는 props 만 실어 나르므로(`replaceNodeProps`) `responsive` 는 undo 대상에서 빠진다.
  - props 밖 canonical 필드(`responsive`/`fills`) 변경은 full node 를 담는 replace event 쌍으로 기록한다. 판정은 `canonicalHistoryEvents.hasNonPropsCanonicalHistoryChange` **단일 소스** — 이 규칙이 `inspectorActions` 안에만 인라인으로 있던 탓에 일반 경로가 같은 처리를 못 갖고 있었다.
  - **실측**: undo 2회 지점에서 `responsive` → `null` 복원.
- **프리셋 적용을 되돌리려면 undo 를 4번 눌러야 했던 문제**:
  - **Why**: 프리셋 적용 1회가 네 갈래 mutation(슬롯 제거 / 슬롯 삽입 / body props / body responsive)이라 history entry 도 4개가 쌓였다. 사용자에겐 한 번의 조작인데 되돌리기 단위가 4개였다.
  - `HistoryManager` 에 트랜잭션을 도입 — 열려 있는 동안 `addEntry` 는 엔트리를 만들지 않고 `canonicalEvents` 를 시간순으로 모으고, 커밋에서 엔트리 1개로 확정한다. mutation 함수는 그대로 두고 호출부에서 감싸는 방식이라 다른 다단계 조작에도 쓸 수 있다.
  - 커밋은 `finally` 에 둔다(중단 시 버리지 않음) — 이미 일어난 변경을 기록 없이 남기면 되돌릴 수 없다.
  - 트랜잭션 창은 **store write 만** 감싼다: 슬롯 노드 생성·스타일 병합 같은 순수 계산과 canonical document IndexedDB 영속화를 창 밖으로 뺐다. 창이 열린 동안의 무관한 mutation 은 같은 엔트리로 병합되므로 창이 넓을수록 오염 위험이 커진다. `removeCanonicalPresetSlots` 를 메모리 변경(동기)과 영속화(창 밖)로 분리했다.
  - **실측**: 목록-상세 적용 → **undo 1회로 완전 복원**(`appliedPreset`·`flexDirection`·슬롯·`responsive` 4축), **redo 1회로 완전 재적용**, 재 undo 로 원상 복귀.
  - 트랜잭션 창을 **동기 블록**으로 마감 — 창 안에서 store action 을 await 하지 않고 promise 만 모아 창 밖에서 기다린다. 창 안의 `await` 는 곧 캔버스 조작 같은 무관한 변경이 같은 되돌리기 단위로 빨려 들어갈 틈인데, 양보 지점이 없으면 JS 단일 스레드가 상호배제를 제공하므로 **mutation 큐 같은 별도 직렬화 장치가 불필요**해진다. 전제로 두 곳의 양보를 제거: 요소 삭제가 history 기록 앞에서 IndexedDB 연결을 기다리던 것(연결 획득을 영속화 직전으로 이동 — 부수 효과로 메모리 반영이 IDB open 을 기다리지 않는다)과, origin 편집 영향 확인 게이트가 대화상자가 필요 없는 경로에서도 `async` 라 microtask 경계를 만들던 것(동기 fast path).
  - 여닫기를 `runInTransaction(meta, fn)` 한 곳으로 모아 `finally` 누락으로 창이 열린 채 남는 사고를 없앴고, 창이 실제로 양보하면 커밋 시 경고한다(`queueMicrotask` 기반 감지 — 동기 창이면 감지 콜백이 커밋 뒤에 돌아 조용하다).
  - **실측**: Holy Grail(슬롯 5개 + grid + responsive 3키) 적용 시 **양보 경고 0건** = 실행 시점에 창이 동기였다는 직접 증거. undo/redo 왕복 정상, 새로고침 후 슬롯 5개 유지(구 슬롯 0).
- **tablet override 가 캐시 히트로 흡수되던 문제** (R5): `LAYOUT_STYLE_KEYS` 에 `gridColumnEnd`·`gridRowEnd`·`gridTemplateAreas` 누락 — `*Start` 와 트랙 템플릿만 등재돼 있어 `End` 만 바뀌는 override 가 무반영이었다.

### Architecture

- **반응형 eligibility 2분할** — ADR-154 전제 개정:
  - `RESPONSIVE_ELIGIBLE_STYLE_PROPS` = `SECTION_EDITABLE_RESPONSIVE_PROPS`(32키, Style 패널 편집) ∪ `PRESET_AUTHORED_RESPONSIVE_STYLE_PROPS`(grid 7키, 편집 UI 없음).
  - **Why**: ADR-154 의 "eligible ≡ Style 패널 편집 키" 는 _write 주체가 Style 패널 단일_ 이라는 조건부 전제였다. 프리셋이 두 번째 write 주체가 되면서 "편집 UI 유무" 와 "breakpoint 별 가변 필요" 가 분리된다. 확장이 편의가 아니라 **필수**인 이유: `clearNonEligibleResponsiveOverrides` 가 non-eligible 키를 실제로 삭제하므로, 확장 없이는 프리셋이 쓴 grid override 가 다음 스타일 편집에서 조용히 지워진다.
  - `gridArea` shorthand 는 의도적 제외 — 모든 선언이 `!important` 동일 특정도라 emit source order 가 승자를 정하고, 같은 BP 에서 shorthand 와 longhand 를 함께 내면 shorthand 가 longhand 를 리셋한다.
- **캔버스 프레임 크기 SSOT 신설** (`workspace/canvasBreakpoints.ts`): desktop 1920×1080 / tablet 768×1024 / mobile 390×844. 기존에 `BuilderCore` + 테스트 2벌로 복제돼 있던 값을 단일화하고 썸네일 파생이 3벌째가 되는 것을 차단했다. **미디어 쿼리 경계(1280)와 혼동 금지** — 1280 으로 환산하면 320px 트랙이 25% 로 나오지만 실제 렌더는 16.7% 다.
- **grid item placement override 는 컨테이너 템플릿 override 를 동반해야 한다** (R8): `GRID_REBUILD_TRIGGER_KEYS` 는 컨테이너 키만 담고 검사가 `isGridDisplay` 게이트 안에 있어, item placement 단독 변경은 `updateStyleRaw` 로 떨어져 grid 배치 캐시 무효화에 실패한다(조용한 무반영). `presetDefinitions.static.test.ts` 가 정적으로 단언한다.

### Documentation

- `.claude/rules/` 갱신 없음 — 본 변경은 프리셋 카탈로그와 반응형 계약이라 기존 `layout-engine.md` §"Grid area 이름 해석" / `panel-structure.md` 예약 prefix 규칙을 그대로 따른다.
- ADR-168 → `docs/adr/completed/`, 실측 상세는 design breakdown §7-1.

## [Frame 프리셋 적용 — 슬롯이 캔버스에 안 그려지던 문제] - 2026-07-26

### Bug Fixes

- **Frame 프리셋을 눌러도 프레임이 빈 채로 보이던 문제** — 슬롯이 자기 배치를 선언하도록 수정:
  - **Why**: 프리셋은 `containerStyle` 을 body 에만 적용하고 슬롯에는 크기·배치를 주지 않았다. 빈 Slot 은 콘텐츠 크기가 0 이고, 생성 CSS(`.react-aria-Slot` = `inline-flex` + `height:60px`)에도 catalog(`Slot.sizes` = height 만)에도 주축 크기가 없어 레이아웃 엔진이 0 을 산출했다. **실측**: `전체화면` 적용 후 content 슬롯이 `0,0 0x844`, `수직 2단` 은 header/content 모두 `390x0`. 데이터(레이어 트리·"적용됨" 표시)는 정상이라 적용된 것처럼 보이는데 캔버스만 비어 있었다.
  - flex 프리셋 5종: content 계열에 `flex:1`, header/footer 밴드에 `minHeight`, 고정 사이드바에 `flexShrink:0` 을 부여. **실측 결과** — 전체화면 `390x844` / 수직 2단 `60 + 784` / 수직 3단 `60 + 724 + 60` / 좌·우 사이드바 `250 + 140`.
  - grid 프리셋 4종: 슬롯에 배치 자체가 없어 auto-placement 로 **겹쳤다**(Holy Grail 에서 content 와 aside 가 같은 자리). `gridArea` 이름 + `gridColumn/RowStart/End` **숫자 line 병기**로 수정 — 이름만으로는 엔진이 배치를 해석하지 못한다(`rules/layout-engine.md` §"Grid area 이름 해석"). **실측(1920 폭)** — Holy Grail `200 / 1520 / 200`, 대시보드(위젯) `200 / 1440 / 280` 으로 정확 배치.
  - 프리셋 **교체가 멱등**해졌다: 이전 프리셋의 컨테이너 키를 걷어낸 뒤 병합한다. 이전에는 `수직 2단`(flex column) → `Holy Grail`(grid) 전환 시 `flexDirection:"column"` 이 grid 컨테이너에 잔존했다.
  - 위치: `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/{presetDefinitions,presetStyle,usePresetApply}.ts`
  - 회귀 가드: `presetDefinitions.static.test.ts` — 모든 슬롯이 주축 크기(flex) 또는 배치 5키(grid)를 선언했는지, grid line 이 트랙 범위 안인지, `gridArea` 가 `gridTemplateAreas` 에 존재하는지 단언. `defaultStyle` 은 optional 이라 누락돼도 컴파일이 통과하므로 타입으로는 못 막는다.
  - grid 프리셋의 header/footer/navigation 밴드가 빈 상태에서 높이 0 이던 잔존 결함은 아래 엔진 수정으로 함께 해소됐다.

### Architecture

- **레이아웃 엔진: grid `auto` 트랙이 자식의 `min-height`/`min-width` 를 반영** (CSS-GRID-1 §12.5 minimum contribution):
  - **Why**: `tree.rs` 가 `auto` 트랙을 자식 측정값(`solve_node`)으로 치환하는데, 그 값에 자식 자신의 min/max clamp 가 빠져 있었다. 자기 min/max 를 적용하는 경로는 flex item(`flex.rs` 가 프로토콜 off 10/12 로 처리)과 root(`fixup_root_self_size`) 둘뿐이라 grid 트랙 측정만 비어 있었다. 그 결과 **콘텐츠가 없고 `min-height` 만 선언한 자식이 0 으로 측정되어 트랙 전체를 무너뜨렸다** — 대시보드 프리셋의 navigation 밴드가 데스크톱에서 `1920x0` 으로 사라지던 원인. 대조 실험으로 확정: 같은 자리에 `height:60` → 60, `minHeight:60` → 0.
  - 수정: `LayoutTree::track_contribution()` 을 신설해 auto row/column intrinsic 측정 3지점에서 자식의 min/max 로 clamp. `solve_node` 전역은 건드리지 않는다 — 트랙 크기 산정은 CSS 가 기여값을 따로 정의하는 지점이라 국소 적용이 맞고, 전역 변경은 flex/block 경로와 이중 적용될 위험이 있다.
  - **live 실측(1920×1080)** — 대시보드 navigation `1920x0` → `1920x60`, sidebar/content 가 `y=60` 으로 정상 하향. Holy Grail `header 60 / sidebar·content·aside 880 / footer 60`, 3열 레이아웃 `460/920/460`, 대시보드(위젯) `200/1360/280` 전부 정확.
  - 위치: `packages/composition-engine/src/tree.rs`
  - 회귀 테스트 3종: auto row 가 `min-height` 를 반영 / auto column 이 `min-width` 를 반영 / `max-height` 가 기여값 상한으로 걸림(clamp 양방향)

## [body 편집 계약 공백 — 페이지·프레임 오소링 컨트롤 복구] - 2026-07-26

### Bug Fixes

- **body 를 선택하면 Properties 패널이 "편집 계약이 비어 있습니다" 만 띄우던 문제** — 오소링 컨트롤 5종 복구:
  - 복구 항목: 페이지 ↔ 재사용 Frame 연결·해제 / 부모 페이지 지정(nested route + slug) / body customId / body className / Frame body 프리셋(Slot 자동 생성).
  - **Why**: 2026-06-03 `5b89e707e`(ADR-912 단계 2)가 per-type dispatch(`getEditor(type, ctx)`)를 `resolveEditContract` 단일 진입점으로 교체할 때, `registry.ts` 의 body 전용 분기(`editMode === "layout" ? LayoutBodyEditor : PageBodyEditor`)가 대체 없이 사라졌다. catalog `binding.props.accepts` 는 **element props 계약**이라 페이지·프레임 오소링 축을 표현할 수 없어 `bodyBinding.props.accepts` 는 `{}` 이고, 그 결과 semantic 필드 0개 → EmptyState 로 빠졌다. 두 에디터 파일과 그 테스트는 그대로 남아 type-check·vitest 어디에서도 잡히지 않았다.
  - **영향 범위**: `applyPageFrameBindingExplicit` / `…FromSelection` 의 소비자가 0건이 되어 **페이지에 Frame 을 새로 걸거나 해제할 수단이 UI 에 전혀 없었다**. 읽기 경로(`getPageFrameBindingId` → LayerTree)는 살아 있어 이미 걸린 Frame 은 렌더됐다 — "보이는데 바꿀 수 없는" 비대칭.
  - 복구 형태: `PageBodySection` 을 `ComponentSemanticsSection` / `FrameSlotSection` 과 같은 계층의 섹션으로 추가. catalog `accepts` 확장이나 새 `InspectorFieldKind` 도입이 아니다 — element props 계약을 오소링 축으로 오염시키지 않는다. `CatalogEditContractEditor` 는 `DEDICATED_SECTION_TYPES`(현재 `body`)에서 EmptyState 를 생략한다(실제 컨트롤과 함께 뜨면 모순된 안내가 된다).
  - **live 검증** (실제 builder): body 선택 → Nested Routes(Parent Page / Slug / Preview URL) + Layout(ID / Class Name) 섹션 렌더, EmptyState 미표시. Class Name 실입력 → canonical 문서와 legacy 배열 양쪽 반영 확인 후 원복, 새로고침 후 원복 상태 유지, console 에러 0. Frame 섹션은 현 프로젝트에 reusable frame 이 0개라 설계대로 미표시(`reusableFrames.length === 0` → null). layout 모드 분기는 단위 테스트로만 검증.
  - 회귀 가드: `PageBodySection.static.test.ts` 가 패널의 마운트 지점과 EmptyState 억제 분기를 소스로 단언한다 — 이 결함의 실패 모드가 "컴포넌트는 남고 소비 지점만 사라짐" 이었으므로 파일 존재가 아니라 배선을 검사한다.
  - 위치: `apps/builder/src/builder/panels/properties/PageBodySection.tsx` (신규) · `panels/properties/PropertiesPanel.tsx`

## [하단 패널 리사이즈 핸들 더블클릭 = 기본 높이 복원 — Pen v1.2.1 수법 차용] - 2026-07-26

### Features

- **하단 패널(Monitor 등) 리사이즈 핸들을 더블클릭하면 기본 높이(200px)로 복원**:
  - 키보드 등가 경로도 함께 — 핸들 포커스 후 Enter/Space (더블클릭만 두면 마우스 전용 기능이 된다). 기존 ArrowUp/ArrowDown ±20px 조절은 그대로.
  - 복원 목표는 `DEFAULT_PANEL_LAYOUT.bottomHeight` 역참조 — 별도 상수를 두면 기본값이 바뀔 때 어긋난다.
  - 핸들에 `title` 추가 — 숨은 제스처의 발견성 확보.
  - **live 검증**: 실제 드래그로 200→320 변경 후 더블클릭 → 200 복원, 키보드 경로도 ArrowUp→220 후 Enter → 200 복원 확인.
  - 위치: `apps/builder/src/builder/layout/BottomPanelArea.tsx`
  - **함께 검토한 container query 사이드바 탭(아이콘↔라벨)은 미도입** — 반응할 트리거가 없다. 사이드바 폭은 registry config(`minWidth || 233`)로 고정이고, 폭을 바꿀 수 있는 `setPanelWidth`/`updateModalPanelSize` 는 **호출자 0건**(타입 선언만)이다. 지금 넣으면 항상 같은 분기만 타는 CSS가 된다 → 패널 폭 리사이즈 기능이 생기는 시점의 후속 작업으로 남긴다.

## [캔버스 화살표 키 = 형제 순서 재배치 — Pen v1.2.1 수법 차용] - 2026-07-26

### Features

- **캔버스 포커스 상태에서 화살표 키로 선택 요소의 형제 순서를 한 칸 이동**:
  - ↑/← = 이전 형제, ↓/→ = 다음 형제. **컨테이너 방향과 무관하게 4방향 모두 순서 축에 매핑** — flex row/column 마다 키 의미가 갈리면 예측성이 떨어진다.
  - **Why**: composition 은 flow 자식의 x/y 를 레이아웃 엔진이 소유하므로 자식에게 "이동" 이 뜻할 수 있는 것은 canonical `children[]` 순서뿐이다 (순서 SSOT, ADR-118). 그런데 화살표 키에는 핸들러가 없어 사용자가 가장 먼저 시도할 키가 죽은 affordance 로 남아 있었고, 순서 변경 수단은 마우스(캔버스 드래그 / 노드 트리 드래그)뿐이었다.
  - 이동은 기존 canonical 진입점 재사용 — `moveElementCanonicalPrimary` + `trackCanonicalMove`(undo) + `layoutVersion` 증가 + IndexedDB persist. 드래그 재배치와 같은 경로라 히스토리 표현도 동일한 move event.
  - 경계·제외: 첫 형제의 이전 / 마지막 형제의 다음은 no-op, projected render id 와 ref override(`descendants`) 내부 노드도 제외 (후자는 move event 재적용이 불안전 — undo 훼손 방지). 다중 선택은 1차 범위 제외.
  - 텍스트 편집 중에는 동작하지 않는다 — `useActiveScope` 가 `text-editing` 을 `canvas-focused` 보다 먼저 판정한다.
  - **live 검증** (실제 builder, 형제 11개 컨테이너): 4개 키를 개별로 눌러 store 순서와 **Skia 노드 좌표 양쪽** 변화 확인 (GridList y 400→324 / GridListItem 324→664), `layoutVersion` 이동마다 증가, 선택 유지, 마지막 요소의 "다음" 은 no-op, 왕복 후 원본 순서·좌표 정확 복원.
  - 위치: `apps/builder/src/builder/stores/utils/siblingReorder.ts` (신규 순수 로직) · `stores/elements.ts` (`reorderElementWithinParent`) · `config/keyboardShortcuts.ts` · `hooks/useGlobalKeyboardShortcuts.ts`

### Infrastructure

- **단축키 충돌 정적 가드 추가** (`utils/detectShortcutConflicts.test.ts`): 현행 정의의 충돌 0건을 단언. 구 `arrowUp`/`arrowDown` 이 `["canvas-focused", "panel:events"]` scope 로 선언돼 있어(핸들러 0건) 캔버스 재배치와 겹칠 수 있었고, events 패널 표기는 `eventsNavUp`/`eventsNavDown`(`panel:events`)으로 분리해 해소했다. events 패널의 실제 처리는 원래부터 자체 훅의 raw key 분기라 동작 변화 없음.

## [유휴 프레임 wake 정리 — performanceMonitor FPS 버스트 측정] - 2026-07-26

### Performance

- **prod 에서 게이트 없이 상시 가동되던 rAF 루프 1개 제거** (ADR-167 파생 작업 D1):
  - `performanceMonitor.startAutoCollect()` 이 FPS 산출을 위해 상시 rAF 루프를 돌렸다. 이 루프는 초당 100회 이상 깨어나 `frameTimes` 버퍼(60 프레임 ≈ 120Hz 에서 0.5초)를 갱신했지만, 실제 소비는 30초에 1회 `collect()` 뿐이라 갱신분의 대부분이 그대로 버려졌다.
  - **Why**: 대조 사례인 `gpuProfilerCore` 는 `import.meta.env.DEV` 게이트를 갖는데 이 루프만 빠져 있어, 개발용 계측이 사용자 빌드에서도 상시 동작했다. ADR-167 (on-demand 프레임 루프) 의 G0 실측 과정에서 발견 — 해당 ADR 자체는 효과 크기 미달로 기각됐으나, 본 항목은 그와 무관하게 유효한 손실이다.
  - 수정: 측정을 **수집 직전 60 프레임 버스트**로 전환 (`sampleFPSBurst`). 30초 간격 기준 duty cycle 약 1.7%. DEV 게이트 대신 버스트를 택한 이유는 게이트가 prod 에서 `fps` 를 상수 60 으로 고정시켜 `healthScore` 의 FPS 축(최대 -20점)과 FPS 경고를 죽이기 때문 — 버스트는 측정 창(60 프레임)을 그대로 보존하면서 유휴 wake 만 없앤다.
  - hidden 탭처럼 rAF 가 멈춰 버스트가 끝나지 못하면 1초 시한 후 접고 `collect()` 는 그대로 진행 — 메모리/요소 수 축 감시는 유실되지 않는다.
  - **실측** (live builder, 유휴 4초): rAF 자기재예약 루프 **3개 → 2개** (약 360 → 240 schedule/s). 버스트는 30초 창에서 60회로 확인.
  - 위치: `apps/builder/src/builder/utils/performanceMonitor.ts` · 정적 가드 `performanceMonitor.static.test.ts`

## [각도 파라미터 리사이즈 커서 — Pen v1.2.1 수법 차용] - 2026-07-26

### Features

- **선택 핸들 hover 커서를 커스텀 이미지 커서로 전환**:
  - OS 기본 resize 커서 키워드 (`nwse-resize` 등) 대신, 핸들 각도로 회전한 양방향 화살표를 오프스크린 캔버스에 1x/2x 로 그려 `-webkit-image-set(...) 12 12, <keyword>` 로 적용. 흰 외곽선 + 검정 본체 (배경 무관 가시성), keyword fallback 동반이라 이미지 커서 미지원 환경은 기존 동작 유지.
  - **Why**: OS/플랫폼별 커서 테마 편차 제거 + 임의 각도 지원 — 요소 회전 기능 도입 시 `rotationDeg` 인자만으로 그대로 확장 (Pen v1.2.1 실측 분석 `docs/explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md` §6-2 차용 후보).
  - 각도는 1° 양자화 + 180° 대칭 접기로 캐시 — 현행 축 정렬 핸들은 0/45/90/135° 4종만 실사용.
  - live 검증: builder 실행 중 핸들 hover 로 3종 fallback (`ew`/`ns`/`nwse`) 의 image-set 적용 + 24x24/48x48 비트맵 렌더 확인.
  - 위치: `apps/builder/src/builder/workspace/canvas/selection/resizeCursors.ts` (신규) · `hooks/useCentralCanvasPointerHandlers.ts`

## [사용자 그림자 오버라이드의 theme 추종 — 저장 리터럴 읽기 시점 정규화 (ADR-166 후속)] - 2026-07-25

> 바로 아래 ADR-166 엔트리가 **catalog 기본값 축**을 닫았고, 본 엔트리는 거기서 "Phase 3 완료 후 재판정 대상" 으로 남겼던 **사용자 inline 값 축**을 닫는다. design breakdown §8 의 해당 잔존 항목은 해소 표시로 갱신됐다.

### Bug Fixes

- **스타일 패널에서 고른 Box Shadow 가 theme 을 따라가지 않던 문제** (ADR-166 후속 Phase 1~4):
  - 패널은 프리셋을 고른 순간의 **리터럴 CSS** 를 `props.style.boxShadow` 에 기록한다. 리터럴은 theme 정보를 담지 못하므로 dark 캔버스에서 고른 그림자도 light 값으로 굳고, light 에서 고른 뒤 dark 로 바꿔도 따라오지 않았다.
  - **Why**: ADR-166 이 catalog 축을 `{shadow.*}` TokenRef 로 옮기면서 기본값은 theme 을 따라가게 됐는데, 사용자 편집 축만 리터럴로 남아 **한 화면에서 두 축이 다르게 동작**하는 비대칭이 됐다. 본 ADR 이 만든 결함은 아니고 선행 상태다 — Phase 1 이전에는 TS map 이 flat 이라 애초에 따라갈 값이 없었다.
  - 수정: 저장 형식은 그대로 두고 **읽는 쪽에서 프리셋으로 되돌린다**. Skia 는 `normalizeShadowForTheme` 로 현재 theme 리터럴을, DOM 은 `shadowLiteralToCssVar` 로 `var(--shadow-*)` 를 받는다. 이미 저장된 프로젝트가 마이그레이션 없이 함께 회복된다.
  - 저장 형식을 바꾸는 두 안은 기각했다 — `{shadow.md}` 는 inline 이 **원문 CSS 채널**이라 DOM 이 선언을 버리고 Skia 파서도 null 로 떨어져 지금보다 나빠진다. `var(--shadow-md)` 는 CSS var 치환이 계산값 시점이라 `inset var(--shadow-md)` 가 3레이어 중 첫 레이어에만 inset 을 걸고, dirty/reset baseline 이 리터럴을 내며, 기존 데이터가 구제되지 않는다.
  - **실측** (dev server 에서 서빙 중인 모듈 직접 호출): 저장값 = light `md` 리터럴일 때 `buildBoxNodeData` 가 light `α .08/.04/.12` → dark `α .24/.12/.36` (기하 `dy 4/2/0` 동일). 같은 값의 DOM 축은 preview iframe probe 로 light `rgba(0,0,0,0.08) 0 4px 12px …` → dark `rgba(0,0,0,0.24) …` — **두 소비자 수치 일치**.
  - 위치: `packages/specs/src/primitives/shadowNormalize.ts` · `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts` · `packages/shared/src/utils/fillAdapter.ts`
- **fills 없는 요소가 DOM style 어댑터를 통째로 건너뛰던 문제**: `adaptElementFillStyle` 의 조기 반환(`if (!("fills" in element)) return element`)이 style 변환 지점 전체를 스킵했다. fills 분기 안으로 옮겨 style 축이 항상 통과한다. **Why**: 그대로 뒀으면 그림자 정규화가 대다수 요소에서 무반영이었다 — 어댑터가 "fills 전용" 이라는 전제가 style 축 확장과 충돌.

### Architecture

- **그림자 리터럴 ↔ 프리셋 역매핑 SSOT 신설** (`shadowNormalize.ts`): `matchShadowPreset` / `normalizeShadowForTheme` / `shadowLiteralToCssVar` / inset 레이어 헬퍼. 패널이 들고 있던 사본(`cssToPresetMap` + `mapShadowLayers`)을 흡수해 **세 소비자(패널 표시 · Skia · DOM) 한 벌**로 통일. 값이 바뀔 때 한 곳만 갱신돼 조용히 어긋나는 것을 차단.
- **`adaptElementFillStyle` → `adaptElementStyle` 개명**: fills 전용이 아니게 됐다. 호출부 5곳(preview 3 · publish 2) 갱신.
- **소비자별 출력이 갈리는 근거 명문화**: Skia 는 렌더 시점에 theme 을 알아 리터럴을, DOM 은 theme 배선 없이 CSS 변수를 받는다. preview iframe(`preview.html`)과 publish 가 둘 다 `theme.css → preview-system.css` 를 로드하고 dark 가 `[data-theme="dark"]` 로 갈리므로 브라우저가 전환한다 — 빌더 chrome 의 `App.css` 는 같은 이름을 Tailwind 스케일의 다른 값으로 재정의하지만 preview iframe 이 그 파일을 로드하지 않아 새지 않는다.
- **저장 정규형 = light 명시**: `shadows[value]` → `getShadowToken(value, "light")`. 동작은 같지만(별칭이 lightShadows) 의도를 코드에 남긴다. ADR-166 Phase 1 이 legacy 로 표시했던 `shadows` light 별칭의 **마지막 소비처가 소멸**했다.
- **가드 증설**: `shadowNormalize.test.ts` 13 · `resolveContainerStylesFallback.test.ts` +5 · `fillAdapter.test.ts` +4. 그중 **두 소비자 개입 집합 대칭** 단언이 핵심 — 한쪽만 정규화하면 캔버스와 Preview 가 다른 그림자를 그린다.

### 알려진 잔존 (범위 밖 — 재개 조건 명시)

- **inset 축 theme 추종**: 적용 범위를 elevation 3단계(`sm`/`md`/`lg`)의 inset 미적용 값으로 한정했다. `--shadow-*` CSS 변수가 3개뿐이라 `none`/`inset`/inset-토글 값은 DOM 이 var 로 낼 수단이 없고, Skia 만 theme 을 따르면 두 소비자가 갈라진다. 양쪽 다 통과시켜 현행 동작을 유지 — 회귀 없음. 재개 조건 = `--shadow-inset` 계열 CSS 변수 신설이 필요해질 때.
- 패널 dirty/reset baseline(`resolveAppearanceSpecPreset`)은 여전히 light 리터럴 고정이다. 프리셋 역매핑이 light·dark 양쪽을 인덱싱하므로 **표시·dirty 판정에는 영향이 없다**. 재개 조건 = baseline 이 theme 별로 갈려야 하는 소비처 등장.

## [그림자 D3 SSOT 단일화 — theme-aware 토큰 + Spectrum 2 스케일 재정의 (ADR-166 Implemented)] - 2026-07-25

> 바로 아래 두 엔트리의 "알려진 잔존 (Skia 축 — 보류, 별도 ADR 대상)" 을 **전건 해소**한다. 그 잔존 서술 중 2건은 실측으로 반증됐다 — 아래 "잔존 서술 정정" 참조.

### Breaking Changes

- **그림자 스케일 4단계 → 3단계**: `--shadow-xl` / `shadows.xl` / `{shadow.xl}` 제거. Spectrum 2 가 4번째 elevation 을 발행하지 않고 D3 소비처가 0건이라 임의 확장 대신 축소를 택했다. 스타일 패널 Box Shadow 프리셋도 `sm/md/lg` 3종으로 축소된다.
  - 빌더 chrome(`App.css`)은 같은 이름의 `--shadow-*` 를 **한 단계 어긋난 값으로 별도 보유**한다(builder-system layer). 이번 변경은 D3 만 건드리므로 `DataTablePresetSelector.css` 등 chrome 소비처는 영향 없다.
- **`{shadow.focus-ring}` 제거**: 값에 `var(--accent)` 를 담고 있어 Skia 파서가 해석하지 못했고 실사용도 0건이었다. focus ring 은 ADR-061 의 `{focus.ring.*}` + `FOCUS_RING_TOKENS` 가 소유한다.
- **`sm`/`md`/`lg` 값이 Spectrum 2 역할 토큰으로 교체**: `sm`←`emphasized` / `md`←`elevated` / `lg`←`dragged`. 이름은 크기 축을 유지한다(패널이 크기 축으로 노출 + 소비처 40+곳).
  - **Why**: 외부 레퍼런스 원본 아티팩트를 실측 대조한 결과 **출처가 혼재**해 있었다 — 스케일 이름·값 체계는 Tailwind 인데 overlay 3건의 값은 Adobe Spectrum 기하와 정확히 일치했다. 게다가 `sm` 은 외부 최하단 대비 3.7배 약했고, dark 배수는 단계마다 3~5배로 불균일했다(Adobe 는 균일 3배).
  - Tooltip/Popover 의 새 값은 근사가 아니라 **출처 복귀** — 구 값의 기하(`0 2px 8px` / `0 4px 12px`)가 SP2 `emphasized`/`elevated` 최상위 레이어와 정확히 일치한다.
- **dark = 전 레이어 alpha ×3** 으로 정규화 (구 3~5배 불균일).

### Bug Fixes

- **dark 모드에서 overlay 그림자가 흰 후광으로 반전되던 문제**:
  - catalog 3건이 `color-mix(in srgb, var(--fg) N%, transparent)` 였는데 `--fg` 는 dark 에서 근-흰색이라 그림자가 밝은 번짐이 됐다. `--shadow-*` 의 정책(검정 유지 + 불투명도 상향)과 **반대 방향**.
  - live 실측: light `color(srgb 0.09 … / 0.2)` 검정 → dark `color(srgb 0.96 … / 0.2)` 흰색.
  - 수정: 값 언어를 `{shadow.*}` TokenRef 로 수렴 + `resolveToken` 의 `shadow` 카테고리를 `color` 와 동형으로 theme 분기(flat map → light/dark 이원화).
- **캔버스에 overlay 그림자가 나오지 않던 문제** (Popover / Tooltip / Modal 전부):
  - `buildSkiaEffects` 는 `props.style.boxShadow` 만 읽어서, elevation 을 catalog 에만 둔 컴포넌트는 캔버스에서 그림자가 없었다.
  - 수정: `resolveEffectiveBoxShadow` 신설 — raw 우선 + catalog fallback + TokenRef 를 theme 별 rgba 로 전개 (`resolveEffectiveOverflow` 동형). **파서는 수정하지 않았다** — 전개 결과가 기존 파서를 그대로 통과하는 형태다.
  - 메모이즈는 **해석 결과가 아니라 catalog 원문**에 건다. 결과를 캐시하면 최초 조회 theme 이 고착된다 — 테마 전환이 리로드 없이 반영되는 것으로 live 확인.
- **catalog 에 `{shadow.md}` 를 넣으면 CSS 선언이 통째로 무효가 되던 문제**: `emitContainerStyles` 만 토큰 해석(`resolveBoxShadow`)을 우회해 리터럴 `{shadow.md}` 를 emit 하고 있었다. 브라우저는 파싱 실패한 선언을 조용히 버리므로 스냅샷 테스트도 통과한다 — 값이 아니라 **경유 자체**를 정적 가드로 잠갔다.
- **스타일 패널이 overlay 의 Box Shadow 를 "custom" 으로 표시하던 문제**: 패널 preset resolver 가 catalog 의 TokenRef 를 해석하지 않아 원문과 프리셋 값이 매칭되지 않았다. 해석 경유 추가 + 프리셋 역매핑을 light·dark **양쪽 값**으로 인덱싱. 이제 Tooltip/Popover/Modal 이 각각 `sm`/`md`/`lg` 로 표시된다.
- **Popover `[data-variant="filled"]` 만 구 그림자가 남던 문제**: `Popover.css` 가 더 높은 명시도로 구 값을 재선언하고 있어 그 variant 만 dark 후광이 잔존했을 경로. base 와 같은 `var(--shadow-md)` 로 정렬.
- **`StoreRenderBridge` 의 spec 폴백 분기가 `theme` 을 넘기지 않던 문제**: 바로 아래 box 분기는 `ctx.theme` 을 넘기는데 폴백만 누락돼 기본값 `"light"` 로 떨어졌다. 같은 함수의 shell 배경 토큰 해석도 이 결함을 공유하던 상태.

### Architecture

- **그림자가 D3 SSOT 단일 채널로 수렴**: catalog `containerStyles.boxShadow` = `{shadow.*}` TokenRef 하나를 DOM(CSS)·Skia 두 consumer 가 함께 읽는다. `ContainerStylesSchema.boxShadow` 타입도 `string | ShadowTokenRef` 로 확장.
- **Skia 그림자 primitive 2건 은퇴** (`popover_shadow` / `dialog_shadow`): 인자 무관 하드코딩 상수라 테마를 따르지 않았고 catalog 와 이중 소스였다. Popover 는 `popover_arrow`, Dialog 는 `overlay_backdrop` 만 남아 — **box-shadow 로 표현 불가한 형상만 primitive** 라는 경계가 섰다.
- **Dialog 는 elevation 을 갖지 않음이 정본**으로 확정: RAC starter `Dialog.css` 그림자 부재 + composition `Dialog.tsx` 주석("should be used within a Modal overlay") 정합. 이제 DOM·Skia 양쪽 모두 그림자 없음.
- **가드 4종 신설** — 값 언어 회귀를 기계로 차단:
  - catalog 전수 (`shadowTokenContract.test.ts`): `boxShadow` **키 이름 깊이 탐색**이라 컴포넌트를 열거하지 않는다(향후 신설 중첩 위치 자동 포섭). `var(`/`color-mix(` 0건 · `{shadow.X}` 가 light·dark 양쪽 존재 · overlay 서열 `sm<md<lg` · Dialog elevation 부재. 탐색이 0건이 되면 나머지가 vacuous 통과하므로 traversal 자체도 단언.
  - **CSS↔토큰 수치 대칭** (`shadowCssParity.test.ts`): `preview-system.css --shadow-*` ↔ `lightShadows`/`darkShadows`. 두 벌은 같은 출처지만 **서로를 참조하지 않는 손-유지 사본**이라 한쪽만 고치면 조용히 발산하는데, 양쪽 다 "그림자가 보여서" 시각 점검으로 안 잡힌다(α .08 ↔ .24 류).
  - generator 경유 (`cssGenerator.shadow.static.test.ts`) · `resolveToken` theme 분기 (`tokenResolver.test.ts` 증설).
- **cross-check 8조합 전수 통과**: Preview iframe 에 probe 요소를 붙여 실제 cascade 를 태운 computed 값 ↔ Skia 노드 effects 대조. dark Popover 실측 DOM `α .24/.12/.36 · dy 4/2/0 · blur 12/6/2` ↔ Skia `dy4/σ5.10 · dy2/σ2.55 · dy0/σ0.85` — **σ = blur / 2.355 변환까지 일치**.

### 잔존 서술 정정 (아래 엔트리 대상)

- ❌ "Popover 는 `popover_shadow` primitive(rgba 0.15)로 캔버스 그림자 유지" → **사실이 아니다.** 그 primitive 는 등록만 되어 있고 캔버스에 닿은 적이 없다. `target:"bg"` shadow 는 bg 박스가 root 로 추출되면 `nodeById` 의 **spread 사본**에 effect 가 push 되고, root 조립부는 `bgBox`/`children` 만 읽어 사본을 버린다(border 는 write-through 분기가 있으나 shadow 는 없는 비대칭). 즉 착수 시점 캔버스 그림자는 **Popover 포함 전부 공백**이었다.
- ❌ "Dialog `dialog_shadow` 단독 제거 시 캔버스에서 모달 elevation 이 통째로 사라진다" → 같은 이유로 사실이 아니며, 애초에 Dialog 는 elevation 소유자가 아니다. primitive 제거는 **시각 변화 0** 의 죽은 코드 정리였다.
- 이 converter 결함(`target:"bg"` shadow 삼킴) 자체는 ADR-166 이 해당 채널을 쓰지 않는 방향이라 **범위 밖**으로 두었다. 재개 조건 = spec/primitive shadow shape 를 쓰는 신규 컴포넌트 등장.

### 알려진 잔존 (범위 밖 — 재개 조건 명시)

- 그림자 파서 2벌(`parseShadow` ↔ `parseOneShadow`) 통합 — 값 언어 수렴으로 증상이 사라져 독립 리팩터로 분리. 재개 조건 = 임의 CSS 붙여넣기 경로가 실사용에서 문제화.
- `staticSelectors` 의 `var(--shadow-*)` 8건 — CSS 축 전용 채널(중첩 selector), Skia 대칭 대상 아님.
- 빌더 chrome `App.css` 의 `--shadow-*` 이름 충돌 — builder-system layer 라 D3 체인 밖. 재개 조건 = 두 계층을 오가는 CSS 등장.

## [Modal elevation 소유 확정 + ColorSwatch 경계 링 복원 — drop-shadow 토큰 오용 정정] - 2026-07-25

### Bug Fixes

- **Modal 과 ColorSwatch 의 box-shadow 선언이 통째로 무효였던 문제**:
  - `--drop-shadow-sm` / `--drop-shadow-md` 는 `preview-system.css` 에 "Drop shadows (for filter property)" 주석과 함께 `drop-shadow(...)` **함수값**으로 정의된 filter 전용 토큰인데, 사용처 2곳(`overlays.css` Modal / `ColorSwatch.css`)이 전부 `box-shadow:` 에 쓰고 있었다 — 정의 목적대로 쓰이는 곳이 **0곳**. 두 선언 모두 계산값이 `none` 으로 죽어 있었다(live 실측)
  - **Modal**: overlay elevation 정본을 catalog `structure.containerStyles.boxShadow` 로 등록. **Why**: RAC starter `Modal.css`(`0 8px 32px rgba(0 0 0 / .2)`) + `Dialog.css` 의 그림자 부재가 upstream 정본 — **Modal 이 모달 elevation 을 소유**하고 Dialog 는 갖지 않는다. geometry/alpha 는 starter 그대로, 색만 Popover(15%)/Tooltip(12%)와 같은 `color-mix(--fg N%)` 언어로 통일 (다크모드 반전 + elevation 서열 Tooltip < Popover < Modal 일관)
  - **ColorSwatch**: starter 원본은 `inset 0 0 0 1px rgba(0,0,0,.1)` 즉 **경계 링**이지 elevation 이 아니다. `--drop-shadow-sm` 으로 바뀐 시점에 값의 의미까지 뒤바뀌어 있었다. 링 복원 + 색만 `color-mix` 로 (다크 스와치에서도 보이게). elevation 이 아니므로 catalog 이관 대상 아님 — 수동 CSS 유지
  - **결과** (live 실측, 전 → 후): Modal `none → rgb(23,23,23)/0.2 0 8px 32px`, ColorSwatch `none → rgb(23,23,23)/0.1 inset 0 0 0 1px`. Popover/Tooltip 불변
  - generated CSS diff 는 의도한 1줄뿐 (`generated/Modal.css` +1)
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/components/styles/{overlays,ColorSwatch}.css`

### 알려진 잔존 (Skia 축 — 보류, 별도 ADR 대상)

> 앞선 엔트리의 "Skia 배선 시 Popover primitive 와 이중 적용" 서술은 **문제를 과소평가한 것**이라 아래로 정정한다.

- Skia 그림자 파서(`parseOneShadow`)는 색상 패턴이 `rgb/hsl/#hex` 뿐이라 catalog 값(`color-mix(in srgb, var(--fg) N%, transparent)`)을 해석하지 못한다. 실측 — `rgba(0,0,0,0.15)` → alpha 0.15 정상이지만 `color-mix(… var(--fg) 15% …)` → **alpha 1.0 불투명 검정**. Skia spec 경로에는 CSS var 해석기 자체가 없다 (`specBuildHelpers.ts:254` 가 `var(` 를 만나면 `#6750A4` placeholder 로 대체)
- 따라서 "Skia 가 catalog boxShadow 를 읽게 배선" 은 단순 배선이 아니라 **theme-aware 그림자 색 해석 도입**이 선행돼야 한다. 캔버스 테마는 `skiaTheme` 로 별도 관리되므로 DOM probe(`getCSSVariable`) 로 우회하면 "빌더 라이트 / 페이지 다크" 조합에서 틀린 색이 나온다
- Dialog `dialog_shadow` primitive 제거도 여기에 종속 — 단독 제거 시 캔버스에서 모달 elevation 이 통째로 사라진다
- 현 상태: Popover 는 `popover_shadow` primitive(rgba 0.15)로 캔버스 그림자 유지, Tooltip/Modal 은 캔버스 그림자 없음 (DOM 과 비대칭 잔존)
- 방향 후보: catalog `boxShadow` 의 색을 TokenRef 로 표현해 Skia 의 기존 theme-aware 토큰 파이프라인에 태우는 설계 — 별도 ADR

## [overlay 그림자 catalog 정본화 — Popover/Tooltip box-shadow D3 SSOT 이관] - 2026-07-25

### Bug Fixes

- **Popover/Tooltip 을 선택하면 스타일 패널이 Box Shadow 를 "none" 으로 표시하던 문제**:
  - 두 컴포넌트는 DOM 에 실제로 그림자가 걸려 있는데(live 실측 — Popover `0 4px 12px color-mix(--fg 15%)`, Tooltip `0 2px 8px color-mix(--fg 12%)`) 패널은 "none" 이었다
  - **Why**: 그림자 정본이 **수동 CSS 에만** 있었다 (`Popover.css` / `Tooltip.css`). 패널의 catalog tier(`resolveAppearanceSpecPreset` → `resolveCatalogContainerBase`)가 읽는 `containerStyles` 에 box-shadow 를 선언한 컴포넌트가 **전체 0건**이라, inline 값이 없으면 곧바로 하드코딩 fallback `"none"` 으로 떨어졌다. 수동 CSS 가 catalog 파생이 아닌 독립 정의였다는 점에서 D3 위반이기도 하다
  - 수정: `ContainerStylesSchema.boxShadow` 신설 + `emitContainerStyles` 가 `box-shadow` emit → catalog `Popover`/`Tooltip` 의 `structure.containerStyles` 에 **수동 CSS 실효값 그대로** 등록 → 수동 CSS 의 중복 선언 제거로 정본 일원화 (generated CSS 가 유일 emit 지점)
  - **결과** (live 실측): 계산값 완전 불변 — Popover `rgb(23,23,23)/0.15 0 4px 12px`, Tooltip `rgb(23,23,23)/0.12 0 2px 8px` 로 수정 전후 동일. 캔버스에 Tooltip 배치 후 선택 시 Box Shadow 표시가 `none → custom`(프리셋 밖 복합 그림자의 설계된 표기)
  - generated CSS diff 는 의도한 2줄뿐 (`generated/Popover.css` +1, `generated/Tooltip.css` +1). Popover 는 `containerStyles` 가 `undefined` 였다가 신설된 케이스라 variant 색상 emit 이 꺼지지 않는지(`containerHasColors` 오탐) 회귀 테스트로 고정
  - 함께 제거: `overlays.css` 의 `.react-aria-Popover { box-shadow: var(--drop-shadow-md) }` — `--drop-shadow-md` 는 `drop-shadow(...)` **filter 함수**라 box-shadow 값으로는 무효(계산값 `none`)이고, index.css 30행이라 뒤 정의에 어차피 덮이던 dead 선언
  - 위치: `packages/specs/src/types/spec.types.ts` · `packages/specs/src/renderers/CSSGenerator.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/components/styles/{Popover,Tooltip,overlays}.css`

### 알려진 잔존

- `.react-aria-Modal` / `.react-aria-ColorSwatch` 의 `box-shadow: var(--drop-shadow-*)` 도 같은 타입 불일치로 무효다 — 두 컴포넌트는 현재 그림자가 **없다**(패널 "none" 표시가 정확). 고치면 없던 그림자가 새로 생기는 시각 변경이라 값 선택을 포함해 별도 판단 대상
- `Dialog` 는 Skia `dialog_shadow` primitive 로만 그림자를 그리고 DOM 에는 없다 (Skia↔CSS 비대칭). Skia 는 catalog `containerStyles.boxShadow` 를 읽지 않으므로 이번 이관 대상 밖 — 배선 시 Popover 는 primitive 와 이중 적용이 되므로 함께 정리 필요

## [스타일 패널 instance 값 동기 — origin(master) style baseline tier 복원] - 2026-07-25

### Bug Fixes

- **reusable component instance 선택 시 스타일 패널이 origin 값을 표시하지 못하던 문제**:
  - 사용자 보고: "page 내 요소에는 box shadow 가 적용되어 있는데 선택 후 스타일 패널에는 none". 실측(Home 페이지 ListBox instance) — origin `component-listbox`.props.style = `{ padding*: 10, boxShadow: "inset 0 10px 15px -3px …, inset 0 4px 6px -4px …" }`, instance 자신의 style = `{ width, maxHeight, overflow }`. Preview DOM inline 은 `padding: 10px; box-shadow: … inset …` 로 정상 렌더되는데 패널만 **Box Shadow: none / Padding: 4**
  - **Why**: 렌더 경로는 `resolveCanonicalRefProps` → `mergePropsWithStyleDeep(master.props, ref.props)` 로 origin 을 깔고 instance override 를 얹는데, 패널의 `useElementStyleContext` 는 origin 을 **type 해석에만** 쓰고 style/props 는 instance 자신의 값만 읽었다. 그래서 값 체인 `inline → catalog preset → 하드코딩` 에서 origin tier 가 통째로 빠진다. boxShadow 가 가장 눈에 띈 이유는 catalog `containerStyles` 에 box-shadow 를 선언한 컴포넌트가 0건이라 곧바로 `"none"` 으로 떨어지기 때문이고, padding 은 catalog 값 4 가 그럴듯하게 표시돼 그동안 안 걸렸다 — boxShadow 전용 결함이 아니다
  - 수정: `useElementStyleContext` 가 `type: "ref"` 노드에 대해 origin 을 baseline 으로 병합. props 축은 렌더 SSOT 와 **동일 함수**(`mergePropsWithStyleDeep`)를 경유하고, style 축은 responsive override 가 tier 마다 따로 걸리므로 **tier 별로** `resolveResponsiveStyleMap` 해석 후 병합(canvasSceneNode 의 template origin 해석과 동형). node-level `fills` 도 origin fallback 추가
  - dirty/reset 판정(`useResetStyles`)은 raw instance override 를 읽는 별도 경로라 무영향 — 표시값 merge 가 override 감지를 삼키지 않는다
  - **결과** (live 실측, 동일 ListBox instance): Box Shadow `none → lg` + inset 토글 활성, Padding `4 → 10`. instance 고유 값(width 100% / overflow auto)과 plain 요소(Badge = md)는 불변
  - 전 섹션 공유 컨텍스트라 Appearance 뿐 아니라 Layout/Transform/Typography/Fill 의 origin 승계도 함께 해소. `size` 승계로 catalog preset tier 선택도 정합화
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useElementStyleContext.ts`

## [빌더 패널 표준 구조화 — ADR-163 Implemented] - 2026-07-25

### Bug Fixes

- **인스펙터 액션 버튼이 스타일 없이 렌더되던 문제** (ADR-163 후속):
  - `className="control-button add|secondary|delete"` 18곳(6파일)에서 owner 클래스와 modifier 모두 CSS 정의가 0건이었다. live 5곳(ItemsManager 4 + ChildItemManager 1)의 버튼이 **순수 `<button>` 과 계산값이 완전 동일** — 배경·테두리·패딩 없음, `cursor: default`, 본문 16px(패널 표준 12px 대비). GridList 인스펙터의 "Add GridListItem" 이 대표 사례
  - **Why**: 소실이 아니라 처음부터 실질 정의가 없던 관성 네이밍. git 이력상 `.control-button` 은 구 inspector CSS 의 `width: 100%` 한 줄이 전부였고 그 파일이 대규모 리팩터에서 사라진 뒤 재정의된 적이 없다. `.add`/`.secondary`/`.delete` modifier 는 정의된 적 자체가 없다
  - 수정: `propertyEditors.css` 에 `.control-button` 기본형 + `:hover:not(:disabled)` / `:disabled` / `:focus-visible` + `--add`(전폭 dashed 어포던스) / `--secondary`(중립 solid) / `--delete`(destructive) modifier + `.editor-actions` 컨테이너(flex column) 정의. 시각 기준은 코드베이스에 이미 있는 add 버튼 house style(`.add-kv-btn` / `.add-action-button` / `.add-field-btn`)에서 도출 — 원시 토큰 없이 시맨틱 토큰만 사용
  - bare modifier 는 ADR-163 §2 규칙대로 `control-button--{state}` 로 동반 전환 (18곳), CSS import 를 미연결 6파일에 배선
  - **결과** (live 실측): `Add GridListItem` 버튼이 dashed 1px / radius 4px / padding 4·8px / 12px / `cursor: pointer` / 전폭 216px, 높이 38→26px. 클릭 동작 불변(항목 0→1, undo 원복)
  - 위치: `apps/builder/src/builder/panels/properties/editors/styles/propertyEditors.css` · `panels/properties/{editors,generic}/**`

### Architecture

- **properties/editors dead chain 삭제 + index.css 잡화 분할** (ADR-163 후속 2건, 사용자 승인):
  - **dead chain 21파일 삭제 (-3,639줄)**: `properties/editors/index.ts` 배럴은 소비처가 0이고 `PropertiesPanel` 은 `./editors` 에서 `ElementSlotSelector` 만 import 한다 — 컴포넌트 편집의 live 경로는 `useEditContract` + `GenericFieldRenderer`(catalog). 그 결과 per-type 에디터 15종(Breadcrumb/Cell/Column/ColumnGroup/DataTable/GridListItem/LayoutSlug/ListBoxItem/Row/Slider/TableBody/Table/TableHeader/Tag/TreeItem)은 렌더 경로 자체가 없었다. 전용 헬퍼 2(`editorUtils`/`propertyEditorNode`) + 배럴 + 전용 CSS 2 + 전용 정적 테스트 동반 삭제
  - **보존**: `ElementSlotSelector`/`ResponsiveVisibilityEditor`(LIVE) + 페이지·레이아웃 오소링 서브트리(PageBodyEditor / LayoutBodyEditor / PageLayoutSelector / PageParentSelector / LayoutPresetSelector). **실측 정정** — `LayoutPresetSelector` 는 test-only 가 아니라 LIVE: `panels/styles/hooks/useResetStyles.ts` 가 `presetDefinitions`(LAYOUT_PRESETS) / `presetStyle` 을 직접 import 한다 (심볼 기반 검사가 서브모듈 named import 를 놓쳤던 것 — 전량 삭제였다면 styles 패널이 깨졌을 지점)
  - **index.css 1,169 → 95줄**: ① 짝 없는 고아 CSS 4클러스터 제거 — `.slot-editor-*`/`.slot-children-*` 와 `.auto-generate-section`/`.schema-*` 는 삭제 이전 트리에서도 소비자 0(원래부터 고아), `.datatable-*`/`.layout-slug-*` 는 위 삭제로 고아화. ② 나머지를 소비자 컴포넌트 옆으로 분할(8파일 신설 + 각 TSX 에서 import) — LoadingSpinner / MultiSelectStatusIndicator / BatchPropertyEditor / SelectionFilter / SmartSelection / SelectionMemory / pageSelectors / ModifiedStylesSection
  - **cascade 보존**: 신설 8파일 전부 원본과 동일한 `@layer builder-system` 유지 (`FillSection.css` 의 `@layer components` 를 복제하면 레이어 순서상 우선순위가 낮아짐). 클러스터 간 선택자 중복 0 확인 → 파일 분리로 인한 오버라이드 순서 변화 없음
  - **Why**: 배럴 하나가 죽어 있으면 그 아래 전부가 "존재하지만 실행되지 않는 코드" 가 되어, 이번 Phase 4-c 처럼 규칙 위반을 교정해도 화면에 반영되지 않는다. index.css 도 같은 문제의 CSS 판본 — 1,169줄 중 어느 규칙이 살아 있는지 파일 위치가 답하지 못했다
  - **검증**: 선택자 117개 분할 전후 대조(손실 0/추가 0) · builder vitest 351 files 2,637 tests PASS · G4 live(fresh reload 오류 0, 인스펙터 6종 정상 렌더, 분할 CSS 9종 `@layer builder-system` 로드 확인)
  - 위치: `apps/builder/src/builder/panels/properties/editors/**` · `components/styles/index.css` · `components/{feedback,selection}/*.css` · `panels/styles/sections/ModifiedStylesSection.css`

- **패널 6종 root `.panel` 통일 + 예약 prefix 정본 회수 + 정적 가드 2개** (ADR-163 Phase 2~4-c, Implemented 승격):
  - **root 클래스 통일 (Phase 2~3)**: datatable / datatableEditor / theme / ai / history / fonts 6패널의 root 에 `.panel` 병기 (기존 고유 root 클래스는 co-located CSS 참조가 살아 있어 제거하지 않고 병기). unlayered 고유 root 가 layered `.panel`(@layer builder-system) 을 이기고 공유 속성(flex/column/height:100%)이 동일해 **Chrome computed before==after (diff 0)**
  - **예약 prefix 정본 회수 (Phase 4-a·4-c)**: `.section-divider` 를 ApiEndpointEditor.css → panel-system.css `@layer builder-system` top-level 로 승격(3패널 5곳 공용이므로 rename 이 아니라 승격). datatable 전용 정의는 도메인 접두로 rename — `.panel-tabs`/`.panel-tab` → `.datatable-tab{s}`, `.panel-selection`/`.panel-option` → `.datatable-creator-mode{s}`, `.section-tabs`/`.section-tab` → `.datatable-creator-tab{s}`, `.section-header-title` → `.variable-editor-section-title`(빈 `.section-header{}` 2규칙은 inert → 삭제). properties editor 계열이 탭 아닌 리스트/오버뷰에 쓰던 `tab-*` 8종 70곳(8파일) → `editor-*`
  - **인스펙터 3열 grid 템플릿 single-source (Phase 4-b)**: `grid-template-columns: 1fr 1fr var(--inspector-control-size)` 9회 재선언 → `.section` 의 `--inspector-row-columns` 토큰 1개 + `var()` 참조 9곳. DOM 무변경 A방식(사용자 confirm) — 원안 B(`.fieldset-row` 클래스 병기 + 패턴 A→B DOM 전환)는 R5 시각 회귀 위험으로 미채택, `.fieldset-row` 는 신규 패널용 forward-standard 로 문서 유지
  - **invalid HTML + Tailwind 인라인 해소 (Phase 4-c)**: TagEditor 의 `<div className="properties-aria">` + `<legend>` 2곳 → `<fieldset>` (legend 는 fieldset 전용). fieldset 기본값 `min-inline-size: min-content` 는 고유 클래스 `min-width: 0` 으로 해제해 이전 div 폭 거동 유지. Tailwind 유틸 인라인 7파일 제거 → 시맨틱 클래스(`propertyEditors.css` 신설 + `variable-debugger.css` 로그레벨 6클래스) — **패널 영역 Tailwind grep 0 도달**
  - **재발 차단 — 정적 가드 2개**: `panel-system.static.test.ts`(dead 중첩) + `reservedPrefix.static.test.ts` 신설 — 인프라 allowlist 9파일 밖에서 `panel-*`/`section-*`/`fieldset-*`/`tab-*` **base 정의** 0건 단언. 인스턴스 한정 override(`.section.block-view`, `.section[data-section-id="x"]`)는 비대상(구조 정본을 대체하지 않고 특정 인스턴스만 조정)
  - **Why**: 구조 클래스가 패널마다 재정의되면 특이성 동률 + import 순서 의존 오버라이드 체인이 생겨 "어느 규칙이 이기는지" 를 읽을 수 없다 (`inspector-layout.css:249` 의 "panel-system.css 의 `.fieldset-actions` 리셋" 주석이 실증). 규칙 문서만으로는 재생산을 막지 못해 정적 가드로 기계 집행
  - **실측 정정 5건** (전부 Phase 0 census miscount — grep 이 contextual descendant 선택자까지 카운트): `.panel-tabs` 4중 정의 → **단일 정의** / `.iconButton` 5중 정의 → **base 0 + 서로 다른 context override 5**(통합할 base 없음, camelCase rename 도 44 참조 churn 대비 이득 없어 기각) / `.empty-state` 2중 → `EmptyState` 컴포넌트가 이미 단일 소스 / settings=대시보드 컴포넌트(scope 밖)·monitor=dev tool(예외) / row 래퍼 5종 → 8개 + pattern-A. 그 결과 원안의 "중복 정의 통합" 은 실체가 작았고 실제 산출은 **예약 prefix 회수 + 토큰 single-source + 정적 가드**
  - **검증 (실제 exercise)**: GridList 인스펙터 ItemsManager 의 "Add GridListItem" 클릭 → `.editor-item-title` 0→1 / `.editor-overview-text` "Total: 0→1"(undo 원복) · datatable 탭 Tables→APIs 전환 → `.datatable-tab.active` 배경 `--accent` ↔ transparent 토글 · 정적 가드 negative control(임시 squat 추가 → FAIL 검출 → 원복 green) · Chrome computed diff 0 · type-check + 정적 가드 4 tests PASS
  - **후속 이관**: `.control-button` 정의 부재 — `className="control-button add|secondary|delete"` 18곳에서 `.control-button` 과 modifier 모두 CSS 정의 0건이라 live 5곳(ItemsManager 4 + ChildItemManager 1)이 **순수 `<button>` 과 계산값 완전 동일**. 네이밍 위반이 아니라 스타일 정의 부재라 별도 판정
  - 위치: `apps/builder/src/builder/panels/{datatable,properties,events}/**`, `apps/builder/src/builder/components/styles/{panel-system.css,inspector-layout.css,reservedPrefix.static.test.ts}`, `.claude/rules/panel-structure.md`

- **panel-system.css dead 블록 제거 + 표준 구조 규칙 명문화** (ADR-163 Phase 1):
  - `.section` 블록 안에 중첩돼 있던 `.panel-wrapper[data-panel="styles"|"properties"] .section-content` 규칙(구 360~480행)을 삭제. CSS 네이티브 중첩상 `.section .panel-wrapper[…] .section-content` 로 컴파일되는데 실제 DOM 은 `.panel-wrapper` 가 `.section` 의 **조상**이라 조상-자손 순서가 반대 → 영구 무매칭 dead 블록이었다 (한 번도 적용된 적 없음)
  - **현행 시각 유지 (diff 0)**: 삭제 대상 선언은 전부 (a) 다른 live 규칙과 중복 (`.layout-direction`/정렬 3x3/`.justify-control` → inspector-layout.css 섹션 스코프 / `.page-layout-*` → index.css / base padding·bg·gap → 기존 `.section .section-content` + properties top-level 규칙) 이거나 (b) live 정의가 없어 복구 시 현행 변경 (`.properties-aria`/`.component-fieldset`/`.fieldset-legend` — 현재 브라우저 기본값 렌더). 무매칭 규칙 제거는 렌더 불변 — Chrome 실측으로 삭제 전후 동일 확증 (`.properties-aria` display=block / `.fieldset-legend` 12px 불변)
  - 정적 가드 `panel-system.static.test.ts` 신설 — `.section` 블록 내 `.panel-wrapper` 중첩 선택자 0건 단언 (dead 패턴 재발 차단, 주석 제외)
  - `.claude/rules/panel-structure.md` 신설 (glob-scoped) — 표준 DOM 트리 / 클래스 네이밍 예약표 / CSS 모듈화 / 상관관계 계약 명문화. Properties/Styles 레퍼런스, Nodes/Events 예외
  - **Why**: dead 블록이 "표준 필드 그룹 스타일" 주석을 달고 있어 "중복이니 삭제" 오판을 유발 (2026-07-24 실제 회귀 1회). 현행 시각은 top-level live 규칙 + inspector-layout.css + 브라우저 기본값의 조합이라 dead 정본을 강제 live 화하면 회귀. 규칙 파일 + 정적 가드로 정본 위치 고정
  - 위치: `apps/builder/src/builder/components/styles/panel-system.css` (529→404행) · `panel-system.static.test.ts` · `.claude/rules/panel-structure.md`

## [레이아웃 intrinsic sizing 측정 계약 — ADR-165 Implemented] - 2026-07-25

### Architecture

- **min/max-content 스칼라 공급 + 엔진 fit-content 소유** (ADR-165 Phase 0~3, Implemented 승격 — ADR-164 후속 체인 ① 완결):
  - 텍스트 leaf 의 폭 intrinsic 을 측정 스칼라 2종으로 계약화 — `enrichWithIntrinsicSize` 가 `contentMinWidth`(최장 단어 폭)/`contentMaxWidth`(단일줄 폭, 기존 Canvas 2D 측정 재사용) 를 NodeStyle(49→51필드) 로 공급하고, 엔진이 CSS-SIZING-3 §5 공식을 소유 (`tree.rs::resolve_leaf_intrinsic_width` — fit-content=clamp(min-content, stretch-fit, max-content) / min·max-content 키워드 / auto→max-content 제안. dormant MIN/MAX_CONTENT 센티널 소비 배선)
  - `flex.rs` §4.5 automatic minimum floor 를 **정확 min-content** 로 정밀화 (`FLEX_FIELD_COUNT` 19→20, off 19 `content_min_main` — absent 시 ADR-164 상한 근사 fallback). **사용자-가시 변화**: shrink 압박 시 다단어 텍스트가 단일줄 폭이 아닌 CSS 와 동일한 최장 단어 폭까지 축소 (명세 정합화 — 현행 실문서 발생 0건 실측, 신규 parity fixture 로 Chrome diff 0 확증)
  - TEXT_LEAF 폭·minWidth 주입 제거 (구 상한 근사 채널 소멸) — 축소가 노출한 잠복 발산 2건 동반 정정: 명시 `width:"auto"` 스칼라 미공급 + **Label CSS base `width:fit-content` 채널 부재** (catalog Label 은 containerStyles 부재 — 구 폭 주입이 우연히 대신 전달 → `implicitStyles.ts` 에 B22 역방향 선주입 신설)
  - Step 4.5 (2-pass) 를 **"폭 확정 후 높이 1회 재측정" 계약**으로 축소 — 스칼라 기반 재줄바꿈 불가능 skip (트리거 25/47→23/47, 잔여는 % 추정 기저 오차로 정합 무해·이연 명문화). grid intrinsic track 은 실사용 0건 실측 + 사용자 confirm 으로 의도적 이연 (재개 조건 명문화)
  - **Why**: ADR-164 §6 이 명문화한 잔존 발산 — injected minWidth = 단일줄 측정폭(ceil) ≥ 실제 min-content → 재줄바꿈 케이스에서 CSS 대비 덜 shrink. 폭 축 intrinsic 은 스칼라 2종으로 명세상 완결되므로 콜백 재설계 없이 dormant 센티널 배선만으로 엔진이 소유 가능
  - 경계 규칙화: `layout-engine.md` §TS 잔존 계약 표 재작성 (minWidth 채널 행 → 스칼라 계약 흡수, 2-pass 행 → height-for-width 축소 계약) + `canvas-rendering.md` §3 스칼라 경로 (동일 font 체인 의무)
  - 검증: parity 100 (기존 90 회귀 0 + 신규 `intrinsicSizing.browser.test.ts` 10 — engine 6·pipeline 4, Chrome diff 0) / cargo 321 (신규 leaf 유닛 5) / layout 유닛 299 / bench 회귀 0 + S4·S5 신규 기준치 / live builder exercise (fresh reload 콘솔 0 + layout map 배치 불변)
  - 위치: `packages/composition-engine/src/{flex,tree}.rs`, `apps/builder/src/builder/workspace/canvas/layout/engines/{utils,fullTreeLayout,implicitStyles}.ts`, `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutTypes.ts`, `apps/builder/tests/parity/intrinsicSizing.browser.test.ts`

## [레이아웃 TS 보정 레이어의 엔진 흡수 — ADR-164 Implemented] - 2026-07-25

### Architecture

- **automatic minimum size (CSS-FLEXBOX-1 §4.5) 엔진 소속화** (ADR-164 Phase 0~3, Implemented 승격):
  - composition-engine `flex.rs` 에 content-based minimum floor 구현 — 조건 `명시 min 부재 ∧ item 주축 overflow visible ∧ 주축 크기 auto` → floor = `content_main` (max clamp 동반). 프로토콜 `FLEX_FIELD_COUNT` 18→19 (off 18 = 주축 overflow, `tree.rs::write_flex_item` 기록 — flex 배열은 Rust 내부 구성이라 TS 직렬화 무변경)
  - `fullTreeLayout.ts` Step 5.7 (부모 overflow≠visible 기준 flexShrink:0 전면 주입) 동시 제거. **사용자-가시 변화**: overflow≠visible flex 컨테이너의 자식이 이제 CSS 와 동일하게 content floor 까지 shrink — 의도된 명세 정합화 (신규 parity fixture 로 Chrome 실측 diff 0 확증)
  - **Why**: ADR-916 의 성공 기준이 Taffy 동등성이라 Taffy 시대 TS 보정이 엔진 교체 후에도 상류에 잔존 — dual-run diff 0 방법론은 상류 보정이 가로챈 입력 차원에 구조적으로 blind
  - G2 재정의 (사용자 confirm): `utils.ts` minWidth 동시 주입은 보정이 아니라 **leaf content 제안값 전달 채널**로 재분류·잔존 (엔진은 텍스트 측정 부재로 leaf content 무지 — CanvasKit 측정 oracle 불변)
  - position:absolute 잔여 2건 (containing block 조상 체인 / fixed viewport) 은 실사용 0건 실측 → "의도적 미지원" 명문화 종결 (`tree.rs` doc comment + `layout-engine.md` 신설 절)
  - 경계 규칙화: `layout-engine.md` §"automatic minimum size — 엔진 소속" 교체 + §"TS 잔존 계약" 신설 (엔진 gap 을 TS 보정으로 재차 메우는 침식 차단), `canvas-rendering.md` 금지 패턴 동기 갱신
  - 검증: cargo 316 (신규 floor 유닛 7) / parity 90/90 (신규 `autoMin.browser.test.ts` 8케이스 × engine·pipeline 2 leg) / layout 유닛 299 / bench 회귀 0 / live builder exercise
  - 위치: `packages/composition-engine/src/{flex,tree}.rs`, `packages/composition-engine/benches/flex_shrink.rs`, `apps/builder/src/builder/workspace/canvas/layout/engines/{fullTreeLayout,utils}.ts`, `apps/builder/tests/parity/autoMin.browser.test.ts`

## [스타일 패널 Box Shadow inset 토글] - 2026-07-25

### Features

- **Appearance 섹션 Box Shadow — 프리셋(sm~xl) × inset 직교 2축 모델**:
  - `.style-shadow` grid 를 `"box-shadow box-shadow icon"` 3열로 확장 — icon 영역에 `fieldset-actions actions-icon` 항목 (legend "inset" + `SwatchIconToggleButton`) 배치. 토글은 다른 fieldset-actions 버튼과 동일한 `swatch-icon-button` 시각 패턴 (SwatchIconButton 의 toggle 변형 신설, selected 시 inner accent-subtle)
  - inset 은 프리셋이 아니라 out shadow 의 modifier — Select 프리셋 목록에서 `inset` 항목 제거, 토글이 전담. "xl 선택 + inset 토글" 상태에서 Select 는 custom 이 아니라 **xl 을 유지** (프리셋 키 판정을 inset-stripped 값 기준으로 수행)
  - 토글 on/off 시 boxShadow 전 레이어의 `inset` prefix 일괄 추가/제거 (rgba 내부 쉼표 무시하는 layer split — `parseShadow` 와 동일 regex). 프리셋 전환 시 inset 상태 유지, off 시 원 프리셋 문자열 복원
  - 그림자 없음(`none`/미설정) 상태에서는 토글 비활성
  - **Why (inset 유지 결함)**: `PropertySelect` 의 memo 커스텀 비교가 onChange 참조 변경을 무시 → inset 토글만 바뀌면 value/options 불변으로 재렌더 스킵 → onChange closure 의 inset 상태가 stale 화되어 프리셋 전환 시 inset 소실. `insetActiveRef` 미러로 commit 시점 최신값 참조
  - 위치: `apps/builder/src/builder/panels/styles/sections/AppearanceSection.tsx`, `apps/builder/src/builder/components/styles/{inspector-layout,panel-system}.css`

## [slot 해치 오버레이 클립 — 페이지 프레임 밖 렌더 차단] - 2026-07-24

### Bug Fixes

- **ListBox/GridList 등 slot 컴포넌트가 스크롤로 page 프레임을 벗어나도 계속 그려지던 문제**:
  - slot authoring chrome(사선 해치 + 테두리)과 collection remainder(ADR-157 "+N more") 은 씬이 아니라 **오버레이 패스**에서 그려지는데, 대상 bounds 를 `treeBoundsMap`(= 클립 미적용 **원본 박스**)에서 가져왔다. `renderSlotHatchPattern` 은 자기 bounds 로만 `clipRect` 를 걸어서 조상 클립이 전혀 적용되지 않았다.
  - **Why**: 오버레이 패스는 씬의 clip save/restore **밖**에서 돈다. 그래서 page body(`overflow:auto`, 390×844)를 스크롤해 프레임 밖으로 나간 ListBox 의 해치가 프레임 상단 경계 **위로 66px** 캔버스 배경 위에 그려졌다. 같은 요소의 히트 영역은 직전 §8.5 수정으로 이미 클립돼 있어서 **"보이는데 클릭은 안 되는"** 비대칭 상태였다.
  - 수정: `buildSlotMarkerTargets` / `buildCollectionRemainderTargets` 가 `hitBoundsMap`(조상 clip 교차 결과)으로 chrome bounds 를 잘라낸다. 전부 잘린 요소는 맵에 미등재 → chrome 자체를 생성하지 않고, 부분 가시 요소는 보이는 구간에만 그린다. padding inset 은 원본 박스 기준으로 먼저 적용한 뒤 클립한다(순서 역전 시 잘린 박스 기준 inset 으로 어긋남). 교차 수식은 `intersectBoxes()` (`selection/types.ts`) 로 단일화해 렌더 커맨드의 조상 clip 교차와 같은 함수를 쓰게 했다.
  - 검증: live 실측(dev builder, HMR) — Components 페이지 body 를 스크롤한 상태에서 프레임 상단 경계(y≈456) 위 캔버스 영역이 **수정 전 해치 66px 노출 → 수정 후 완전히 깨끗**, 해치는 프레임 경계에서 정확히 잘림(확대 스크린샷 확인). 신규 회귀 테스트 5(부분 클립/전부 클립 × slot·remainder + 기존 호출 호환) + builder 2636 PASS / type-check PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.ts`, `skia/skiaOverlayBuilder.ts`, `canvas/selection/types.ts`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.5 (오버레이 chrome 갈림 기준 표 + 금지 패턴 3건 추가)

- **slot 컴포넌트를 호버한 채 스크롤하면 실선 아웃라인만 프레임 밖에 남던 문제**:
  - `buildHoverHighlightTargets` 에서 자식 점선 가이드라인은 `hitBoundsMap` 을 쓰는데 **context 실선 아웃라인 분기만 `treeBoundsMap`**(원본 박스)이었다. 호버한 채로 page body 를 스크롤해 컨테이너가 프레임 밖으로 밀리면 점선은 사라지는데 실선 아웃라인은 캔버스 배경에 그대로 남았다.
  - **Why**: 호버 아웃라인은 조작 대상이 없는 순간 피드백이라 **선택 박스와 성격이 다르다**. 선택 박스는 핸들을 잡아야 해서 부분 클립돼도 원본 박스를 유지해야 하지만, 호버 아웃라인은 실제 보이는 영역만 따라가야 한다.
  - 수정: context 분기도 `hitBoundsMap` 기준으로 전환. 전부 잘리면 아웃라인 자체를 생성하지 않는다. page body 는 조상이 없어 clip 대상이 아니고 두 맵 모두에 없을 수 있으므로 `resolvePageBodyBounds` 프레임 경계 폴백을 그대로 유지(회귀 테스트로 고정).
  - 검증: live 실측(dev builder, HMR) — 상단 slot 해치에 마우스를 올린 채 page body 를 스크롤 → 해치·아웃라인 모두 프레임 상단 경계에서 정확히 잘리고 경계 위 캔버스는 깨끗(확대 확인). 신규 회귀 테스트 3(부분 클립/전부 클립/body 폴백) + builder 2639 PASS / type-check PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayHelpers.ts`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.5 (호버 chrome 전체가 `hitBoundsMap` — 선택 박스와의 차이 명시)

## [선택 드래그 의도 판정 — 겹친 요소 클릭 허용 (Figma/Pencil 정합)] - 2026-07-24

### Bug Fixes

- **선택된 요소의 박스에 겹쳐 있을 뿐인 다른 요소를 클릭하면 선택이 바뀌지 않던 문제**:
  - pointerdown 을 "현재 선택을 잡아 끄는 동작(드래그 의도)" 으로 볼지의 판정이 **선택 박스(bbox) 안인가** 단독이었다. 그래서 커서 아래에 다른 요소가 있어도 이전 선택 박스 안이기만 하면 클릭이 삼켜졌다.
  - **Why**: 선택 박스는 드래그 핸들일 뿐 히트 영역이 아니다. 깊이 진입은 이미 더블클릭 + `editingContext`(`resolveClickTarget`)가 전담하고 있어서, 이 판정까지 깊이/포함관계를 겸하면 겹친 형제 클릭이 사라진다. body 선택 시 페이지 전체가 삼켜지던 것을 호출부 특수 분기로 막아둔 것도 같은 결함의 국소 우회였다.
  - 수정: 판정을 `resolveSelectionDragIntent()` 로 분리하고 기준을 **계층 정규화된 클릭 타깃**으로 교체 — 커서 아래 요소를 현재 editingContext 깊이로 정규화한 결과가 선택 요소면 드래그, 아니면 그 요소를 새로 선택. body 예외와 "히트 없음 → 드래그 유지"(기존 동작 보존)를 함수 내부로 흡수해 호출부 특수 분기를 제거. `inSelectionBounds` 는 이 판정과 AND 로만 쓰인다.
  - 외부 도구 대조: Figma 는 실제 객체 지오메트리로 판정해 클릭한 객체를 선택(공식 문서). Pencil 도 동일 — **실측 확인**(Pencil 앱 MCP): 파랑 프레임 선택 → 파랑 bbox 안의 주황 프레임 클릭 → 주황 선택. 깊이 진입은 두 도구 모두 더블클릭이라 composition 과 이미 일치했고 발산 지점은 이 판정 하나였다(중첩 3단 검정 클릭 → 초록 선택으로 실측).
  - 검증: live 실측(dev builder) — 실제 Components 페이지 문서 트리(50 요소)에 판정 로직 직접 실행: (a) `component-gridlist` 선택 + `component-form__field-1-input` 클릭 → 드래그 의도 false(=선택 전환, 40클릭 트레이스에서 잡혔던 잔존 1건), (b) 자기 자신 클릭 true, (c) 자손(`__label`) 클릭 true, (d) body 선택 + 자식 클릭 false, (e) 히트 없음 true. 신규 회귀 테스트 8 + builder 2631 PASS / type-check PASS. **미검증**: 브라우저 탭이 백그라운드(Skia RAF 정지)라 포인터 이벤트 경유 실클릭은 확인하지 못함.
  - 위치: `apps/builder/src/builder/workspace/canvas/interaction/selectionModel.ts`, `interaction/index.ts`, `hooks/useCentralCanvasPointerHandlers.ts`, `utils/hierarchicalSelection.ts`(읽기 전용 `ReadonlyMap` 확장)
  - 규칙: `.claude/rules/canvas-rendering.md` §8.8 (드래그 의도 = 계층 정규화 타깃 + 금지 패턴)

## [Breakpoint별 Canvas viewport 복원] - 2026-07-24

### Features

- `desktop`/`tablet`/`mobile` breakpoint별 Canvas 전체 pan 위치와 zoom을
  `builder.workspace.breakpoint-viewports.v1`에 저장하고 새로고침 후 복원.
- 기존 선택 breakpoint(`builder-breakpoint`)와 Compare Mode split
  (`builder.workspace.compare-split.v1`) 저장 계약은 유지.

## [Skia 히트 테스트 클립 인지 — 잘려 안 보이는 영역 선택 차단] - 2026-07-24

### Bug Fixes

- **overflow 컨테이너에서 잘려 화면에 없는 영역이 선택/호버되던 문제** (Skia 렌더 공통):
  - `renderCommands.visitElement` 이 각 요소의 **원본 박스**를 `boundsMap` 에 기록하고 그대로 `syncSpatialIndex()` 로 WASM SpatialIndex 에 넣었다. 렌더러는 `CMD_CHILDREN_BEGIN` 에서 `clipChildren` 일 때만 `canvas.clipRect` 로 자식을 잘라내므로, **그리기 기하와 히트 기하가 발산**했다.
  - **Why**: 조상이 `overflow: hidden/clip/scroll/auto` 로 잘라낸 자손이 히트 인덱스에는 잘리기 전 크기로 남아, 화면에 아무것도 없는 좌표가 그 자손을 히트시켰다. collection 계열은 row projection 이 `projection.listBoxId` 로 owner redirect 하므로 **owner 컴포넌트가 선택**되는 형태로 드러났다.
  - 실측 증상: ListBox 인스턴스(`maxHeight:300` + `overflow:auto`, 내용 300 초과)에서 owner 아래 10px(local y=310) 클릭 시 body 대신 ListBox 선택 / page body(`overflow:auto`, 844) 아래로 밀려난 형제가 페이지 프레임 밖 빈 캔버스에서 선택.
  - 수정: `buildRenderCommandStream` 이 조상 clip rect 를 누적 교차한 `hitBoundsMap` 을 함께 산출하고, SpatialIndex·호버 AABB·휠 스크롤 타깃이 이 맵을 쓴다. 교차가 비면 미등재 = 히트 불가. 오버레이/TextEditOverlay/AI 이펙트/측정은 원본 `boundsMap` 유지. drag top-layer 재방문은 clip save/restore 밖에서 그려지므로 clip 면제.
  - 검증: live 실측(dev builder) — maxHeight:300 ListBox 기준 (a) local y=310 클릭 → `body` 선택 (수정 전 ListBox), (b) 보이는 영역 클릭 → ListBox 유지, (c) 휠 스크롤 동작 유지 + 스크롤로 들어온 행 클릭 → ListBox 유지, (d) 프레임 밖으로 밀려난 `Form` 클릭 → 선택 해제 (수정 전 Form 선택). 신규 회귀 테스트 6 + builder 2606 PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`, `skia/skiaFramePipeline.ts`, `skia/types.ts`, `skia/SkiaCanvas.tsx`, `hooks/useElementHoverInteraction.ts`, `hooks/useScrollWheelInteraction.ts`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.5 (원본 박스 ↔ 히트 영역 분리 계약 + 금지 패턴)

- **요소가 없는 빈 공간 호버 시 페이지 전체 자식 가이드라인이 그려지던 문제**:
  - `useElementHoverInteraction` 의 그룹 하이라이트 확장 분기가 hover context 종류를 구분하지 않아, 빈 영역 fallback (`resolvePageBodyHoverTarget` / `resolveFrameBodyHoverTarget`) 으로 잡힌 **body** 도 컨테이너처럼 취급했다. `collectLeafDescendants(body)` 가 페이지 전체 리프를 반환 → 모든 리프에 점선 가이드라인.
  - **Why**: 호버 후보는 editingContext/body 의 **직계 자식**이라 body 는 AABB 히트로 context 가 될 수 없다. body context = "여기엔 요소가 없다" 신호인데 확장 분기가 이를 컨테이너 deep-hover 와 동일 취급했다.
  - 수정: 확장 판정을 `resolveHoverGroupState()` 단일 진입점으로 분리하고 body context 는 확장 제외 (`hoveredLeafIds: []`, `isGroupHover: false`). context 실선 아웃라인은 유지 — 클릭 시 body 선택 affordance 보존.
  - 검증: live 실측(dev builder) — ListBox 2개가 있는 페이지의 빈 영역 호버 시 (a) body 실선 아웃라인만 표시, 행 점선 0개 (수정 전 두 ListBox 전 행에 점선), (b) ListBox 호버 시 해당 ListBox 행에만 점선 유지(다른 ListBox 미영향). 신규 회귀 테스트 4 + builder 2610 PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.ts`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.6 (body 는 hover 그룹 확장 대상 아님 + 금지 패턴)

- **스크롤 컨테이너에서 자식 가이드라인이 스크롤 후 갱신되지 않던 문제**:
  - `hoveredLeafIds` 를 `collectLeafDescendants` 가 `hitBoundsMap.has()` 로 **필터링해 hover state 에 캐시**했다. 재계산 trigger 는 hover context 변경(=pointermove) 뿐이라, 포인터를 움직이지 않는 휠 스크롤로는 갱신되지 않았다.
  - **Why**: 가시성(클립/스크롤)은 프레임마다 달라지는 **기하** 속성인데 이를 "무엇을 호버 중인가"라는 **구조** 캐시에 섞었다. 결과적으로 호버 시점의 가시 집합이 고착돼, 처음 가려져 있던 행은 스크롤로 나타나도 가이드라인이 없고 마우스를 뺐다 다시 넣어야 나왔다.
  - 수정: 캐시 계층 분리 — `collectLeafDescendants` 는 bounds 를 보지 않는 구조적 리스트를 반환하고, 가시성 판정은 프레임마다 도는 `buildHoverHighlightTargets` 가 `hitBoundsMap` 조회로 수행. 전부 잘린 리프는 건너뛰고 부분 가시 리프는 보이는 구간에만 그린다.
  - 검증: live 실측(dev builder) — `maxHeight:200 + overflow:auto` ListBox 호버 후 **포인터 고정 상태로** 휠 스크롤 시 새로 들어온 행 3개(이수빈/강수빈/김서연)에 가이드라인 즉시 표시(수정 전 미표시). 신규 회귀 테스트 3(clip 제외/스크롤 복귀/폴백) + builder 2614 PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.ts`, `skia/skiaOverlayHelpers.ts`, `skia/skiaOverlayBuilder.ts`, `skia/skiaFramePlan.ts`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.6 캐시 계층 분리 표

- **캔버스에서 컴포넌트 선택이 불특정하게 무시되던 문제** (노드 트리 선택은 정상):
  - `computeSelectionBounds` 의 요소 분기가 **이미 scene 좌표**인 bounds 에 `(bounds - panOffset) / zoom` 보정을 한 번 더 적용했다. 비교 대상인 클릭 좌표는 `screenToCanvasPoint` 결과라 scene 좌표 — 좌표계가 어긋난 유령 선택 박스가 만들어졌다.
  - **Why**: 유령 박스에 걸린 클릭이 `inSelectionBounds` 로 판정돼 "이미 선택된 요소 안 클릭 = 드래그 의도" 분기로 빠지면서 **선택이 통째로 무시**됐다. 유령 박스 위치가 pan 과 선택 요소 위치의 조합에 좌우돼 특정 컴포넌트와 무관하게 불특정하게 재현됐다. 같은 함수의 body 분기는 raw scene 좌표를 써서 한 함수 안에 두 좌표계가 공존했다 — PixiJS `getBounds()` 가 screen 좌표를 반환하던 시절의 잔재.
  - 수정: 요소 분기도 scene 좌표를 그대로 사용(`boxes.push(bounds)`). 결함의 입력이던 `panOffset` 파라미터는 인터페이스·호출부에서 제거해 재도입 시 컴파일 에러가 나게 했다.
  - 검증: live 실측(dev builder) — 임시 dev 트레이스로 40클릭 계측. **수정 전** 실패 10건 중 9건이 `inSelectionBounds=true`, 계산 박스가 scene 박스와 `panOffset(215,228)` 만큼 이탈(`20,188 350x110` → `-195,-40 350x110`). **수정 후** 비교 가능 37건 전부 일치(불일치 0, zoom 1·0.5 양쪽), 좌표 이탈로 인한 실패 0건. 트레이스는 검증 후 제거. 신규 회귀 테스트 2 + builder 2623 PASS.
  - 위치: `apps/builder/src/builder/workspace/canvas/interaction/selectionModel.ts`, `canvas/BuilderCanvas.tsx`
  - 규칙: `.claude/rules/canvas-rendering.md` §8.7 (선택 박스 좌표계 = scene 단일계 + 금지 패턴)

## [Data 바인딩 해제 버튼 크기 정합 — 컨트롤 높이 28 고정] - 2026-07-24

### Bug Fixes

- **Content ▸ Data 컬렉션 선택 시 컨트롤 높이가 28→30 으로 튀던 문제**:
  - 데이터 바인딩 해제(X) 버튼 `.binding-clear` 이 고정 크기 대신 `padding: var(--spacing-xs)` + 아이콘(14px) intrinsic 으로 잡혀 **22×22** 였다. 컬렉션을 선택하면 이 버튼이 추가되는데, Select 트리거(20×20)보다 커서 `align-items:center` 행 높이가 22 로 늘고 `.react-aria-Group` 컨트롤 박스가 28(콘텐츠 20 + padding 4+4)→30 으로 커졌다.
  - **Why**: 패널의 다른 아이콘-버튼(chevron span / field-picker-icon / Select Button span)은 모두 `var(--text-xl)`(20×20) 고정인데 `.binding-clear` 만 padding 기반이라 혼자 22 로 튀었다.
  - 수정: `.binding-clear` 를 `width/height: var(--text-xl)` + `padding: 0` + `flex: 0 0 auto` 로 20×20 고정. 바인딩 유무와 무관하게 행 20 / group 28 로 일정.
  - 검증: live 실측(dev builder) — 실제 `.binding-name-row` 에 합성 해제 버튼 주입 측정(비파괴): 버튼 20×20 / 행 20 / group 28 (수정 전 22 / 22 / 30). property tests 8 PASS.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.css`

## [Text 필드 피커 시각 통일 — width combo 셸 + 팝오버 부모 정렬] - 2026-07-24

### Features

- **ListBoxItem Content ▸ Text 의 `{field}` 컬럼 피커를 패널 표준 셸로 통일**:
  - Text 템플릿 입력(`PropertyFieldTemplateInput`)이 혼자 다른 flex 레이아웃으로 떠 있던 것을 Transform ▸ width(`PropertyUnitInput`) 와 동일한 시각 규약으로 맞췄다. input 은 배경 투명·테두리 제거로 회색 `react-aria-Group` 셸과 통합하고, 우측 Braces 트리거는 width 의 chevron 자리와 동일한 20×20 흰 정사각(radius-sm) 버튼으로 정렬.
  - **팝오버 부모 정렬**: 필드 삽입 팝오버가 우측 트리거 버튼에 앵커링돼 오른쪽으로 벗어나던 것을, `useControlPopoverMetrics` 의 `controlRef` 를 트리거 버튼에 붙여 `margin-left = group.left − button.left` 로 부모(field 박스) 좌측·폭에 정렬. width/PropertySelect 팝오버와 동일 규약.
  - 상호작용(커서에 `{key}` 삽입, 여러 필드 혼합)과 ARIA(role=textbox + menu button)는 그대로 유지 — RAC ComboBox(role=combobox, 단일 값 선택) 로 바꾸지 않은 이유는 삽입 모델·접근성 시맨틱 보존(D1).
  - **피커 항목 시각을 ListBox 팝오버와 일관화**: 필드 피커는 `Menu`(role=menu, 항목=삽입 명령)라 generated `MenuItem.css`(md) 가 collection Select 의 `ListBoxItem.css`(md) 와 달라 항목이 더 컸다(height 32px vs auto 28px, border-radius 6px vs 2px, font-weight 400 vs 600, gap 8px vs 2px, 컨테이너 radius 6px vs 8px). role 은 유지하되 `field-picker-menu` 마커 클래스로 이 피커에만 스코프된 언레이어 override 를 걸어 밀도·모서리·굵기·컨테이너 곡률를 ListBoxItem/ListBox(md) 규약에 맞췄다 — generated 스펙 CSS(`@layer components`, 전역 메뉴 공용)는 미편집.
  - **Why**: MenuItem/ListBoxItem 은 독립 스펙이라 generated CSS 를 고치면 앱 전역 메뉴가 바뀐다. 시각 일관성은 소비 지점(피커) 스코프 override 로 국한해야 D1(RAC role) 침범 없이 달성된다.
  - 검증: live 실측(dev builder) — 셸/input/트리거 computed 가 width 와 픽셀 일치(셸 `--bg-muted`/padding 4/radius 6, input transparent+border0+`0 0 0 4px`+12px, 트리거 20×20 흰박스 radius 4) + 팝오버 `x/w` = 부모 group `x/w` (1957/216, 오차 0) + 피커 MenuItem computed(height 28 / radius 2 / weight 600 / gap 2, 컨테이너 radius 8) = ListBoxItem/ListBox(md) spec 정확 일치.
  - 위치: `apps/builder/src/builder/components/property/PropertyFieldTemplateInput.{tsx,css}`

## [Override Reset 회복 토스트 + globalToast 쿨다운 우회 옵션] - 2026-07-24

### Features

- **인스턴스 Override Reset 시 실행취소 토스트**:
  - Properties ▸ Component ▸ Overrides 의 Reset 버튼(특히 dataBinding 처럼 무거운 저작물)을 눌러도 확인 다이얼로그로 편집 흐름을 끊지 않되, `'{override} 해제됨'` + **실행취소** 액션 토스트를 띄워 오클릭을 즉시 되돌릴 수 있게 했다.
  - **Why**: Reset 은 단일 클릭 삭제인데 버튼·행 표기가 `style` 같은 가벼운 override 와 동일해 데이터 바인딩을 실수로 날리기 쉬웠다. 확인 단계(다이얼로그)는 정상 편집을 방해하므로, 즉시 실행 + 회복 경로(undo 토스트) 조합을 택했다.
  - 위치: `apps/builder/src/builder/panels/properties/ComponentSemanticsSection.tsx`

### Bug Fixes

- **`globalToast` 반복 토스트가 5분 쿨다운에 억제됨**:
  - 같은 override 를 다시 Reset 하면 동일 메시지라 회복 토스트가 뜨지 않았다 ("나타났다가 다시 하니 안 뜸").
  - **Why**: `showToast` 의 `type:message` 5분 쿨다운(정보성 알림 스팸 방지)이 undo 같은 **반복돼야 하는** 액션 토스트까지 억제했다. `globalToast.error` 만 `bypassCooldown` 을 강제했고 `info/success/warning` 은 옵션 자체를 못 넘겼다.
  - 수정: `globalToast.info/success/warning` 시그니처에 `bypassCooldown` 옵션을 노출하고, Reset 회복 토스트에서 `bypassCooldown: true` 전달. 실증 — 실제 앱에서 dataBinding reset → undo → reset 반복 시 토스트 2회 모두 표시.
  - 위치: `apps/builder/src/builder/stores/toast.ts`

## [Data 바인딩 피커 정리 — 팝오버 정렬 SSOT + 행 통합 + 죽은 오소링 표면 제거] - 2026-07-24

### Breaking Changes

- **Data 바인딩의 "데이터 경로" 입력 제거**:
  - Content > Data 에서 경로 입력(`items[0].name` 류)이 사라진다. 기존 저장 문서의 `path` **값은 보존** (컬렉션 변경 시 재기록) — 편집 표면만 제거. 결과적으로 Data 섹션은 **컬렉션 Select 1행**만 남는다 (field 높이 56 → 30px).
  - **Why**: `path` 를 실제로 해석하는 코드는 `preview/hooks/useDataSource.ts` 의 `useDataBinding`(`path.split(/[.[\]]+/)` 드릴다운) 하나뿐인데, 그 모듈은 배럴 재수출만 있고 **import 0건인 dead module** 이다. 살아있는 유일한 소비처는 `useCollectionDataCache.createCacheKey` 의 캐시 키 문자열(`prop:${source}:${name}:${path}`) — 값을 바꿔도 **캐시만 무효화되고 로드 데이터는 불변**. 실제 행 read 경로인 `readDataBindingRows`(Skia projection + DOM 공통)와 `useCollectionData` 는 `source`/`name` 만 읽는다.
  - 계약상으로도 어긋났다: `kind:"binding"` 은 collection 컴포넌트 전용이라 결과가 항상 **행 배열**인데 `items[0].name` 은 단일 값 드릴다운 문법이다. 행 안에서 필드를 고르는 일은 같은 날 반영된 ADR-159 `{field}` 템플릿(경로 접근 `{address.city}` + 포맷 `|date`)이 담당한다 — `path` 는 그 기능의 죽은 선행 버전.
  - 필드/타입은 캐시 키 호환 때문에 유지. 물리 제거는 후속 판단.
  - **후속 처리 (같은 날, 사용자 승인)**: 위 dead module 인 `apps/builder/src/preview/hooks/`(`useDataSource.ts` + 배럴 `index.ts`) 삭제. export 8종(`useDataSource`/`useVariable`/`useRouteParams`/`useDataBinding` + 타입 4종) 소비처 각 0건 / 배럴 importer 0건 / 별칭 import 0건 실측. ADR-159 P4c residual 목록에서 이 항목은 **G4 게이트 대상이 아님**으로 정정 (소비처 0 ⇒ 저장 문서가 의존 불가 ⇒ read 호환 리스크 없음). 검증: type-check 61 baseline 유지 + `tsc -b` 에 module resolution 에러 0건 + builder vitest 347 files / 2600 tests PASS.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.{tsx,css,test.tsx}`

- **Data 바인딩의 "갱신 모드 / 갱신 간격" 오소링 UI 제거**:
  - Content > Data 에서 갱신 모드(수동/마운트 시/주기적) Select 와 갱신 간격 입력이 사라진다. 기존 저장 문서의 `refreshMode` / `refreshInterval` **값 자체는 보존** (컬렉션 선택·경로 편집 시 재기록) — 편집 표면만 제거.
  - **Why (3중 근거)**: (1) RAC/RSP 어느 collection 레퍼런스에도 "갱신 주기" 개념이 없다 — RAC 의 비동기 표면은 `useAsyncList` 의 `load`/`loadMore`/`reload`/`sort` + `loadingState`/`onLoadMore` 뿐이라 D2(Props/API — RSP 참조) 기준 미규정 prop([ssot-hierarchy.md](../.claude/rules/ssot-hierarchy.md) §6). (2) 유일한 소비처인 `useCollectionData` auto-refresh effect 가 `if (!isApiBinding) return` 으로 시작하는데, ADR-159 P4b 로 오소링이 `source:"dataTable"` 고정이라 **신규 바인딩은 실행 0** — 설정해도 동작하지 않는 UI 였다. (3) `"onMount"` 는 effect 가 `"interval"` 만 분기해 api 바인딩에서조차 소비처 0건.
  - 타입(`RefreshMode`) / `DataBinding` 필드 / auto-refresh effect 물리 제거는 api 바인딩 잔존 저장 문서 실측이 필요하므로 **ADR-159 P4c 의 G4 게이트와 함께** 처리 (지금 지우면 기존 api+interval 바인딩 회귀).
  - 검증: 신규 `PropertyDataBinding.test.tsx` 3 케이스(오소링 UI 부재 / 경로 편집 시 값 보존 / 컬렉션 변경 시 값 보존) + live — Data 섹션이 2행(컬렉션 Select, 경로 입력)으로 축소, field 높이 105.7 → 56px.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.{tsx,css,test.tsx}`

### Features

- **Content > Data 바인딩 피커를 한 행으로 통합**:
  - 기존에는 바인딩 표현식 preview 행(`{{dataTable.Users}}` + 해제 X)과 컬렉션 Select 행이 **선택 상태를 중복 표기**했다. 이제 Select 가 표준 동작대로 선택값(`Users`)을 직접 표시하고, 해제 버튼만 같은 행 우측에 남는다 (field 높이 136 → 106px).
  - **Why**: `<SelectValue>{"컬렉션 선택..."}</SelectValue>` 로 placeholder 문자열이 **하드코딩**돼 있어 Select 가 선택값을 표시할 수 없었고, 그 공백을 메우려고 preview 행이 붙어 있던 구조였다. `SelectValue` 를 render prop(`isPlaceholder ? "컬렉션 선택..." : selectedText`)으로 되돌리면 중복 자체가 소멸한다.
  - 전체 표현식은 행 `title` 로 보존. 해제 버튼은 Select 렌더 여부와 무관하게 노출 — collection 0개 상태에서도 기존(legacy 포함) 바인딩을 제거할 수 있어야 하기 때문.
  - 위치: `apps/builder/src/builder/components/property/PropertyDataBinding.{tsx,css}`

### Bug Fixes

- **Content > Data 컬렉션 피커 팝오버만 다른 Select 와 폭·좌측 정렬이 어긋남**:
  - 프로퍼티/스타일 패널의 Select·ComboBox 팝오버는 control 외곽 박스(`.react-aria-Group`, 회색 field) 폭·좌측에 맞춰 뜨는데, 컬렉션 피커만 RAC 기본(trigger 기준)으로 떠서 field 박스보다 좁고(249 vs 277px) 24px 안쪽으로 들어가 보였다.
  - **Why**: 이 정렬은 CSS 가 아니라 `group ↔ control` 실측 rect 로 `width / min-width / margin-left` 를 계산하는 JS 로직인데, `PropertySelect` 와 `PropertyUnitInput` 에 **각각 복제**돼 있었다. 나중에 추가된 `PropertyDataBinding` 이 복제를 빠뜨려 패널 규약에서 이탈. field 에 `control-label` 아이콘 컬럼이 있으면 trigger 가 group 보다 24px 안쪽이라 이탈이 두드러진다.
  - 수정: 계산을 `useControlPopoverMetrics` 훅으로 추출해 **단일 소스화**하고 3개 소비자(`PropertySelect` / `PropertyUnitInput` / `PropertyDataBinding`)가 공유. anchor 를 못 넘기는 경우(group 을 `PropertyFieldset` 이 렌더) `closest(".react-aria-Group")` 자동 해석 + 조건부 마운트되는 control 도 잡도록 callback ref 기반으로 전환.
  - 갱신 모드 Select 는 라벨과 한 행을 나눠 쓰는 하위 control 이라 group 정렬 시 trigger 보다 100px 이상 벗어난다 — RAC 기본(trigger 기준) 유지.
  - 검증: live 실측 — 컬렉션 피커 `min-width: 216px(=group 폭) / margin-left: -24px` 적용 확인, 기존 2개 소비자 회귀 없음(`PropertySelect` Variant `min-width: 277px / margin-left: -4px` 리팩터 전후 동일, `PropertyUnitInput` 단위 팝오버 `min-width: 86px / margin-left: -24px`).
  - 위치: `apps/builder/src/builder/components/property/useControlPopoverMetrics.ts`(신규), `PropertySelect.tsx`, `PropertyUnitInput.tsx`, `PropertyDataBinding.tsx`

## [Collection 목록 boot 초기화 — DataStore editMode 게이트 제거] - 2026-07-24

### Bug Fixes

- **컴포넌트 Data 바인딩의 collection 목록이 DataTable 패널을 한 번 열기 전까지 비어 보임**:
  - ListBox 등 Properties > Content > Data 의 컬렉션 피커가 collection 이 실제 등록돼 있어도 "등록된 Collection 이 없습니다." 로 표시되고, DataTable 패널을 1회 열면 그때부터 정상 표시됐다.
  - **Why**: DataStore 초기화(`initializeForProject` — variables/collections/apiEndpoints)가 `if (editMode === "layout")` 블록 안에 갇혀 있었다. 이 게이트는 frame(layout) 요소 로드 블록의 잔재로 (본문은 2026-05-02 canonical 전환 `ae79affc0` 에서 제거됨), `editMode` 기본값이 `"page"` 라 일반 페이지 편집 boot 에서 초기화가 통째로 skip 됐다. 이후 `DataTablePanel` 마운트 effect 의 `fetchCollections` 가 store 를 채우던 것이 "패널을 열면 나타난다" 증상의 정체.
  - 수정: 게이트 제거 — DataStore 초기화를 edit mode 무관하게 boot 경로에서 항상 실행. 소비처가 사라진 `useEditModeStore` import 도 함께 제거.
  - 영향 범위: 컬렉션 피커뿐 아니라 `useCollectionData` 경유 행 데이터(ListBox/GridList/Table)도 패널 개방 없이 boot 시점에 로드된다.
  - 검증: `BuilderCore.static.test.ts` 정적 가드 추가(게이트 재도입 차단, RED→GREEN) + live — page 모드 새로고침(DataTable 패널 닫힌 상태)에서 `[DataStore] Initialized: 0 variables, 1 tables` 부팅 로그 확인 + ListBox Content>Data 피커 드롭다운에 `Users` 노출 확인.
  - 위치: `apps/builder/src/builder/main/BuilderCore.tsx`, `apps/builder/src/builder/main/BuilderCore.static.test.ts`

## [Collection 필드 템플릿 바인딩 — ADR-159 `{field}` 보간 + dataTable 단일 소스] - 2026-07-24

### Features

- **collection 행 텍스트 `{field}` 템플릿 보간** (ADR-159 P1~P3, Implemented):
  - slot Text(또는 item props)에 `{num}`, `No.{num} — {email}` 같은 템플릿을 쓰면 data-bound ListBox/GridList 행이 임의 컬럼으로 보간 렌더 — 기존에는 `getItemLabel` 고정 휴리스틱 키(label/name 등)만 표시 가능.
  - **Why**: 보간 기계 자체가 코드베이스에 없어 Users(num/email) 지정이 DOM/Skia 대칭적으로 무시됐음. shared 단일 resolver(`packages/shared/src/collections/fieldTemplate.ts`)를 Skia projection 과 DOM 렌더 양쪽이 소비 (G2 — consumer 자체 파싱 0건, 선재 ad-hoc 파서 교체 포함).
  - 문법: 다중 필드+literal 혼합 / `{{`·`}}` 이스케이프 / 미지 필드 빈 문자열 / 토큰 없으면 기존 휴리스틱과 bit-동일 (BC).
- **문법 B — 경로 + 포맷** (ADR-159 P5):
  - 경로 접근 `{address.city}` / `{arr[0].x}` (flat key 정확 일치 우선 — 기존 문서 BC), 포맷 `{createdAt|date}`(`YYYY-MM-DD`) / `{num|number}`(천단위) — `FIELD_TEMPLATE_FORMATTERS` registry 가 확장 지점, 실패 시 미포맷 fallback.
  - array/object Table 셀 → 컴포넌트 placeholder: array 는 read-only TagGroup 칩(cap 3 + `+N`), object 는 휴리스틱 label 텍스트 (구 "[object Object]"/JSON 노출 제거). Skia projection ↔ DOM 이 동일 분류(`classifyTableCellDisplay`) 소비.
- **오소링 필드 피커** (ADR-159 P4a):
  - Properties 패널의 템플릿 텍스트 키(children/text/description) 편집 입력에 소유 collection 컬럼 피커(Braces 버튼 → Menu) — 선택 시 커서 위치에 `{key}` 삽입 + 즉시 반영. Components 페이지 master 편집도 소비자 인스턴스 역추적으로 컬럼 제공(`useOwnerCollectionColumns`).
- **데이터 소스 dataTable 단일화** (ADR-159 P4b):
  - 컴포넌트 Data 바인딩 피커가 소스 4종(dataTable/api/variable/route) 선택 → 컬렉션(테이블명) 선택 단일로 축소. 신규 기록은 `source:"dataTable"` 고정, 구소스 문서는 read 호환 + legacy 안내. DataTable factory/AI tool 의 api binding 생성 제거 (신규 유입 0).
  - **P4c residual (사용자 확정)**: api/variable/route 잔존 runtime 경로 물리 제거는 G4(Supabase 저장 문서 전수 실측 — RLS 차단) 재실측 후 별도 진행.

### Architecture

- **ADR-159 Accepted → Implemented** (2026-07-24, execute-adr Phase 0~6):
  - 바인딩 primitive = 재귀 BindingNode 목표 모델의 text-leaf 구현 (write-back·교차 lookup 은 후속 ADR). `SlotChildConfig.text` 운반 축 +1 (ADR-148 확장).
  - 검증: vitest 신규 90+ (fieldTemplate 24 / cellValue 8 / scene 47 / DOM 6 / resolver 8 등) + live 보간 2회(피커 `{num}` 삽입 10행, `{createdAt|date}` 실데이터 10행) + cross-check(G1/G2/G3 게이트).
  - 위치: `packages/shared/src/collections/{fieldTemplate,cellValue}.ts`, `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`, `packages/shared/src/renderers/SelectionRenderers.tsx`, `packages/shared/src/components/{ListBox,GridList,Table}.tsx`, `apps/builder/src/builder/components/property/*`, `apps/builder/src/builder/panels/properties/generic/*`

## [GridList grid layout 2열 렌더 + Skia↔DOM 정합] - 2026-07-23

### Bug Fixes

- **GridList `layout:"grid"` 이 DOM 1열 / Skia 2열-과wrap 로 발산**:
  - grid 레이아웃에서 DOM/preview 는 1열(stack 동일)로, Skia 는 2열이나 카드가 좁은 폭에서 텍스트 과도 wrap(148px, DOM 76px 대비 2배) + rows-group 폭 1열(169px)로 축소돼 카드가 컨테이너를 넘쳐 clip 됐다.
  - **Why (2겹)**: (1) **DOM**: element 저장 style 의 `display:flex`(+flexWrap) 가 `GridList.css` 의 `display:grid` + `[data-layout="grid"]` grid-template-columns 를 override → flex full-width 1열. (2) **Skia**: OWNER 컨테이너를 `display:grid` 2열(implicitStyles)로 두었는데 자식이 projected rows-group **1개** → rows-group 이 column 1(169px)로 축소 + 그 안 flex-wrap 카드 폭 `calc((100%-gap)/numCols)` 이 순환 의존으로 과도 분할·wrap.
  - 수정: (1) **DOM** — `GridList.tsx` 가 `layout==="grid"` 시 inline `display:grid` + `grid-template-columns:repeat(cols,minmax(0,1fr))` 로 stale flex 를 덮음. (2) **Skia** — OWNER 를 flex-column(단순 컨테이너)로, projected rows-group 를 `display:grid` + `gridTemplateColumns:[1fr×numCols]` 로 전환(열 폭을 순환 없이 track 으로 확정), 카드 폭 `100%`(track 채움). 사용자 결정(2열 grid 채택).
  - 검증: live builder — grid GridList Skia 컨테이너 204 ≡ DOM 204(parity), rows-group 350×164(2열), 카드 169×76(2열 배치·wrap 없음, DOM 정합). layout engine + scene 312 테스트 PASS.
  - 위치: `packages/shared/src/components/GridList.tsx`(DOM display:grid), `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`(OWNER flex-column), `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`(rows-group display:grid + 카드 폭)

## [GridList stack 컨테이너 높이 Skia↔DOM 정합] - 2026-07-23

### Bug Fixes

- **GridList(stack) 카드 컨테이너가 Skia 에서 34px 더 커 바닥에 빈 공간**:
  - stack GridList 의 Skia 컨테이너 높이가 326px 로 계산돼 DOM/preview(292px)보다 34px 크고, rows-group(카드 252px) 아래에 34px 빈 공간이 생겼다.
  - **Why (2겹)**: (1) `enrichWithIntrinsicSize` 의 double-pad 가드(`isInjectedGridListOwner`)가 `_projectedRowsContentHeight` 주입 owner(sample mode)만 커버해, explicit padding(catalog containerStyles 20)을 가진 **items-based** GridList owner 에서 컨테이너 padding 이 이중 계산됐다(§1.55c 는 border-box 반환인데 enrich 가 padding 재가산). (2) §1.55c 의 `cardHeight` 공식이 카드 border(catalog GridListItem.sizes.md.borderWidth=1×2)를 누락해 카드당 -2px(3카드 -6) 잔차.
  - 수정: (1) enrich 가드를 `type==="gridlist"` 전체 owner 로 확장(§1.55c injected/items 양 경로 모두 border-box 반환 — padding 재가산 항상 제외). (2) `resolveGridListItemMetric` 에 `cardBorderWidth` 추가 + §1.55c `cardHeight` 에 `cardBorderWidth*2` 가산 → projected 카드(content50+padding24+border2=76)와 정합.
  - 검증: live builder — stack GridList Skia 컨테이너 292 ≡ DOM preview 292(parity), rows-group 252. layout engine + scene 312 테스트 PASS(gridListSpacingHeight / gridListDataBoundContentHeight baseline 74→76 정정).
  - **후속 (해소됨)**: `layout: "grid"` 의 Skia↔DOM 레이아웃 발산(2열 구성)은 위 "GridList grid layout 2열 렌더" 엔트리에서 해소됨.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`(enrich 가드 + §1.55c), `packages/specs/src/renderers/utils/collectionItemMetrics.ts`(cardBorderWidth)

## [GridList ref 기반 재사용 composite 전환 — ADR-161] - 2026-07-23

### Architecture

- **GridList 를 ListBox 동형 ref-composite 로 전환** (ADR-161 Phase 1/2/3/4/5/7 Implemented):
  - 컨테이너 재사용 origin `component-gridlist`(`slot:[component-gridlist-item-default]`) 신규 등록 — factory 신규 GridList 는 standalone `type:"GridList"` 대신 `type:"ref", ref:"component-gridlist"` 인스턴스로 생성(ListBox `component-listbox` 동형). Component 패널에 Role=Instance / "Go to component" 노출.
  - **scene node type ref→master 근본 해석** (Phase 4): `toCanvasSceneNode` 가 ref 의 type 을 `"ref"` 로 두어 type-기반 projection gate(`isGridListSceneSource`)가 ref 를 차단하던 근본 원인을, `visit` 단일 지점에서 master type 을 해석해 `sceneNode.type` 에 반영하도록 수정(per-gate patch 대신). 모든 collection gate 가 type 으로 일관 통과.
  - **preview + Skia 컨테이너 origin slot 대칭 소비** (Phase 3): `resolveGridListTemplateOriginId`(Skia) + `App.tsx` inline master 해석(preview)이 `component-gridlist`.slot[0] 을 읽어 item 템플릿을 해석(리터럴 하드코딩 제거). 두 소비자가 동일 SSOT 를 동일 방식으로 읽음(canvas-rendering.md symmetric consumer).
  - **프로퍼티 패널 slot authoring parity** (Phase 7): `slotHostPolicy` 에 `isGridListHost`/`isGridListItemTemplateVariant` 추가 → GridList origin 프로퍼티에 Slot 섹션(GridListItem/Default) 표시(ListBox 대칭). per-type 편집기는 `useEditContract`(catalog)로 대체된 dead 코드라 item 편집기 전환 불요.
  - **기존 인스턴스 = 타입 미변환 ListBox-parity** (Phase 5): ListBox `migrateLegacyListBoxTemplatesToOrigins` 가 standalone 타입을 변환하지 않고 origin bootstrap 만 함을 확인 → GridList 도 타입 미변환 채택(R2 HIGH→LOW). 기존 standalone GridList 는 `ensureGridListTemplateOrigins`(hydration 기배선) 컨테이너 origin bootstrap + `isGridListSceneSource` type gate 로 렌더 유지(데이터 손실 위험 없음).
  - **시각 결과 불변** (BC): ref-composite 는 authoring/reuse 층 추가일 뿐, GridList 카드(bg+border+label+description) 렌더 결과 무변경. slot[0]==item origin 리터럴이라 전환 후에도 동일 origin 해석.
  - **잔존**: R5 publish 앱 slot 미소비(ADR-148 R9 동일 알려진 gap, 본 ADR scope 밖 — publish flat-props BC).
  - 위치: `apps/builder/src/builder/components/gridlist/gridListTemplateOrigins.ts`, `factories/definitions/SelectionComponents.ts`, `workspace/canvas/scene/canvasSceneNode.ts`, `preview/App.tsx`, `builder/components/slotHostPolicy.ts`

## [GridList 렌더 크래시 수정 + layout prop 노출] - 2026-07-23

### Bug Fixes

- **데이터 바인딩 GridList 가 preview 에서 "Invalid slot 'label'" 크래시**:
  - GridList 항목을 렌더하면 `Uncaught Error: Invalid slot "label". Valid slot names are "description"` 로 preview 가 크래시했다.
  - **Why**: RAC(react-aria-components 1.18.0) `GridListItem` 의 TextContext 는 `DEFAULT_SLOT` + `description` 만 제공하고 **label slot 을 제공하지 않는다**(ListBoxItem 은 제공). 커밋 `c51e0d1d2` 가 "ListBoxItem 동형" 으로 GridListItem 안에 `<Text slot="label">` 을 도입하면서 RAC 슬롯 계약을 위반.
  - 수정: GridListItem 의 label 은 default slot `<Text>` 로 렌더(3 소비 경로: `renderGridListItemSlotContent`/`renderGridListItem` fallback/`GridList.tsx` dynamic). accessible name 은 `GridListItem` 의 `textValue` 담당. bold 시각은 `GridList.css` `.react-aria-Text:not([slot="description"])` 로 유지(react-aria-Text 기본 16 → line box 24 → Skia 카드 76 정합 무변).
  - 재사용 origin(`component-gridlist-item-default`)의 `__label` slot 자식은 `props.slot:"label"`(ListBox 복제 잔재)를 제거 — slot 구성은 `metadata.slotRole` 이 담당(`getSlotRole` 이 metadata 우선)하므로 redundant + 직접 렌더 시 크래시 유발. `description` slot 은 GridListItem 이 지원하므로 유지.
  - 위치: `packages/shared/src/renderers/SelectionRenderers.tsx`, `packages/shared/src/components/GridList.tsx`, `packages/shared/src/components/styles/GridList.css`, `apps/builder/src/builder/components/gridlist/gridListTemplateOrigins.ts`

### Features

- **GridList `layout` prop(stack ↔ grid) property 패널 노출**:
  - RAC 공식 prop `layout`(react-aria.adobe.com/GridList) 이 컴포넌트·factory 에는 이미 소비되고 있었으나(`GridList.tsx` `layout={layout}`, factory 기본 `stack`), catalog binding 의 `accepts` 에 미선언되어 property 패널에서 편집할 수 없었다.
  - `gridListBinding.props.accepts` 에 `layout` enum(stack/grid, 기본 stack) 추가 — Appearance 섹션에 편집기 노출. RAC 가 `data-layout` 으로 소비하므로 DOM raw attr 누출 없음(selectionMode 동형).
  - live 검증(project 2333): GridList 추가 → preview 크래시 없이 3 items 렌더(label default slot / fontWeight 600 / description slot) + Layout prop 편집기 노출 + stack↔grid 전환 시 `data-layout` 즉시 반영.
  - 위치: `packages/shared/src/catalog/bindings/GridList.binding.ts`

## [반응형 편집 모델 반전 — ADR-154 개정 1: 기본 전역 + 명시적 override] - 2026-07-23

### Bug Fixes

- **breakpoint override 의 width/height 등에서 `%`·`vw` 단위 유실 수정** (ADR-154 개정 1 후속):
  - breakpoint 전용 override 를 저장할 때 `width`/`height`/`margin` 의 `50%` → `50`(→ `50px`) 로 단위가 유실돼, `%`·`vw` 지정이 고정 px 로 잘못 렌더됐다. 토글로 override 를 켤 때(현재 값 seed)도 `100%` → `100px` 로 점프.
  - **Why**: 스타일 값의 숫자 변환 대상 집합이 base 저장 경로와 responsive override 경로에서 서로 달라(override 만 width/height/margin/order 를 추가로 숫자화), 같은 값이 override 여부에 따라 다르게 저장되던 비대칭.
  - 숫자 변환을 `NUMERIC_COERCE_STYLE_PROPS` + `toStyleNumericValue` 단일 소스로 통합(width/height/margin/top/left 등 dimensional 축 제외 → `%`/`vw`/`auto` 문자열 보존). base 3경로 + override 경로 공용.
  - 위치: `apps/builder/src/builder/stores/utils/responsiveWriteRouting.ts`, `.../stores/inspectorActions.ts`. (commit: `9877d05ba`)

- **값이 없는 Layout·Transform 속성에 "Add override" 가 안 걸리던 문제 수정** (ADR-154 개정 1 후속):
  - `minWidth`/`maxWidth`/`flexGrow`/`alignSelf`/`aspectRatio` 처럼 factory 기본값이 없는 eligible 속성은 "Add override" 를 눌러도 seed 할 현재 값이 없어 아무것도 저장되지 않았고, 토글 상태가 데이터에서 파생되는 구조라 즉시 OFF 로 읽혀 override 가 걸리지 않았다.
  - **Why**: 토글 ON 이 "현재 effective 값 복사" 만 하고 effective 가 없을 때의 fallback 이 없어 no-op → 사용자가 해당 breakpoint 전용 값을 시작할 방법이 없었다.
  - effective 값이 없으면 `resolveEligibleSeedDefault` 의 CSS-initial 값(length→`auto`, spacing→`0`, enum→유효 기본, flexGrow→`0`/flexShrink→`1`)으로 seed → 토글 고정 + 편집 가능한 필드 노출. 초기값이 시각 무변화라 토글 순간 화면은 그대로.
  - 32개 eligible 속성 전수가 non-empty seed 를 갖는지 정적 테스트로 확증(drift 가드). 위치: `apps/builder/src/builder/stores/utils/responsiveWriteRouting.ts`, `.../stores/inspectorActions.ts`.

### Features

- **breakpoint 편집이 기본 전역(전 breakpoint 공통) 으로 반전**:
  - 이전에는 Tablet/Mobile 화면에서 스타일을 편집하면 자동으로 그 breakpoint 전용 override 가 생성됐다. 이제 **어느 breakpoint 에서 편집하든 기본은 전역**(모든 breakpoint 공통) 이다.
  - **Why**: 화면 전환만으로 편집 적용 범위가 바뀌어 예측이 어려웠다("왜 여기서 이게 이렇게 나오지?"). desktop↔mobile 차이는 대부분 크기/배치(Layout·Transform) 축이라는 실사용 정신 모델에 맞춰, 그 축만 명시적으로 분리하도록 좁혔다.
  - breakpoint 전용 값은 **Style 패널 Responsive 섹션의 "Add override"** 로 명시적으로 추가한다(현재 값이 seed 되고, 이후 그 속성 편집이 해당 breakpoint 로 라우팅). chip ✕ 로 전역 복귀.
  - override 대상은 **Layout · Transform 섹션 속성 한정**(width/height/padding/margin/gap/display/flex 등 32키). 배경·border·radius·typography·overflow 등은 어느 breakpoint 에서든 항상 전역.
  - 위치: `packages/shared/src/types/responsive.types.ts` (`RESPONSIVE_ELIGIBLE_STYLE_PROPS`), `apps/builder/src/builder/stores/utils/responsiveWriteRouting.ts`, `.../stores/inspectorActions.ts`, `.../panels/styles/sections/ResponsiveSection.tsx`.

### Architecture

- **전역/응답형 판정 단일 규칙화 (특례 분기 소멸)**:
  - 원안이 border 15키만 전역 예외(blocklist)로 두고 나머지 전 속성을 responsive 로 취급하던 것을 반전 — `isGlobalStyleProp(p) ≡ !isResponsiveEligibleStyleProp(p)`. 배경(fills)·border dirty/reset 특례가 "non-eligible → base 비교" 단일 규칙로 흡수됐다.
  - write 3함수(commit/preview/batch)가 `shouldWriteBreakpointOverride` 단일 판정 공유. read 경로(builder resolve + shared @media CSS)는 non-eligible stale override 를 skip(기존 프로젝트의 원안-시대 override 즉시 무력화).
  - 저장 스키마(`responsive.styles`)·cascade resolve·@media 출력은 무변경 — authoring 정책 계층만 교체.
  - ADR-154 개정 1 (Phase R0~R4, `docs/adr/completed/154-responsive-breakpoint-authoring.md` §개정 1). (commit: `6a9e951f5`)

## [Compare Mode split persistence — 2026-07-23]

### UX

- CSS/Canvas Compare Mode의 `20–80%` pane split을 브라우저 `localStorage`에 저장해 새로고침 후에도 복원합니다. 드래그 중에는 저장하지 않고 `pointerup`/`pointercancel` 시 최신값만 저장합니다.

## [collection 행 inset 입력 산출 SSOT 봉쇄 — ADR-160 후속 F1/F2] - 2026-07-23

### Bug Fixes

- **data-bound collection 행 텍스트 wrap 폭 parity (ADR-160 §2.1 발견 1 latent 잔존 봉쇄)**:
  - ADR-160 은 행 geometry 통로(`resolveCollectionRowMetric`)를 봉쇄했으나 그 함수에 넘기는 **입력**(textX/rightReserve/gap)은 M1(layout)·escape 가 독립 산출해, icon 또는 selected(check) 행에서 wrap maxWidth 가 갈렸다 — data-bound(flat-props) projection 에서 label/description 이 escape 보다 넓게 측정돼 행 높이가 짧게 할당 → 텍스트 잘림 가능
  - **Why**: escape 는 `textX = max(paddingLeft, slotInset + iconSize + slotGap)` / `rightReserve = showCheck ? checkSize + slotGap : 0` 로 아이콘·check 폭을 예약하는데 M1 은 `textX = paddingLeft, rightReserve = 0` 으로 미예약 → 같은 텍스트가 두 경로에서 다른 폭으로 wrap
  - 수정: 공유 `resolveListBoxItemInset({paddingLeft, slotInset, iconSize, hasIcon, showCheck}) → {textX, rightReserve}` 를 escape·M1 이 공동 호출(F1 escape 채택 / F2 M1 §1.55b-2 caller 가 slot 구성 + `isSelected` 에서 컨텍스트 추출). GridList within-card gap 은 M1 `style.gap ?? 2` → `resolveGridListItemMetric().descGap`(고정 2) SSOT 로 전환(escape 동일 심볼)
  - **oracle**: 현 project 는 childful-unfold 라 flat-props 분기 gating OFF → 라이브 미노출. 봉쇄 증명 = **폭-민감 measurer** 주입 differential 테스트(icon+selected 행 `M1(inset)===escape` + `inset 미적용 < escape`). 라이브(70da5ae3)는 childful 경로 무영향(46요소·5 collection layout==skia mismatch 0, 콘솔 에러 0)
  - 검증: 신규 10(inset 단위 8 + differential 2) + 회귀 190 collection + type-check baseline(61). 커밋 `98e8f63f3`(F1 specs)/`d9a4b402f`(F2 builder)
  - 위치: `packages/specs/src/renderers/utils/collectionItemMetrics.ts`(`resolveListBoxItemInset`), `packages/specs/src/renderers/skiaPrimitives.ts`(escape), `apps/builder/.../layout/engines/utils.ts`(M1). 상세: ADR-160 design breakdown §2.3

## [Style 패널 numeric 입력 commit 정책 — 2026-07-22]

### Performance

- `Layout`, `Transform`, `Appearance`, `Typography`의 numeric `PropertyUnitInput`은 타이핑 중 Canvas/layout preview를 실행하지 않고 `Enter` 또는 `blur` 시 최종값을 commit합니다. `ArrowUp`/`ArrowDown`의 연속 입력 preview는 유지합니다.
- **Why**: `padding`, `gap`, `width`, `height`, `borderWidth` 등은 입력 자리수마다 layout/render 경로를 갱신할 수 있어 중간값 렌더를 제거했습니다.

## [collection projection 행 텍스트 측정 SSOT 단일화 — ADR-160 Implemented] - 2026-07-22

### Architecture

- **ADR-160 Implemented (Phase 0~5, execute-adr) — collection projection 행 텍스트 측정 SSOT 단일화**:
  - 반복 parity 버그(2026-07-22 width/gap/wrap/겹침 5건 + GridList 동형 — 위 3계층 수정)의 **근본**: projection 행이 텍스트를 자식 노드 아닌 `props` 로 들어, escape(M3, packages/specs)가 layout-util 측정 함수(M1/M2 공유)를 패키지 경계로 재사용 못 해 **별도 재측정**하는 이중화. 새 parity 축마다 두 소스에 반영해야 하고 한 곳 누락이 곧 회귀였다
  - **SSOT 도입**: `resolveCollectionRowMetric`(icon/check-aware — `packages/specs/src/renderers/utils/collectionItemMetrics.ts`) 가 행 geometry(블록 wrap 측정 + 스택 offset + rowHeight/contentHeight + maxWidth)를 단일 소유. ListBox/GridList 차이(anchoring / desc lineHeight 1.333× vs 1.5× / icon·check reserve)는 입력으로 흡수
  - **소비 전환**: escape(`listBoxItem`/`gridListCard`, skiaPrimitives.ts) + layout M1(`resolveListBoxItemRowHeightFromStyle` / GridListItem §1.55b2, utils.ts) 이 모두 이 함수를 **공동 호출** → escape 자체 geometry 재측정 통로 봉쇄. escape 의 `measureSpecWrappedTextHeight` 직접 호출 0건(SSOT 함수 내부로 이동)
  - **설계 편차**: ADR 대안 D 의 `buildSpecNodeData → _slotMetrics` prop 주입은 미채택 — escape 가 이미 buildSpecNodeData width injection(`style.width`, `buildSpecNodeData.ts:1514`)으로 확정 폭을 받으므로 SSOT 함수 직접 호출로 충분(주입/직접호출 둘 다 count-neutral·동일 통로 봉쇄, 직접호출이 plumbing/미사용 prop 없이 더 간단). 상세: design breakdown §2.2
  - **Why**: ADR-907 Layer D("동일 resolver 심볼 공유", M1/M2 확립)를 escape(M3)까지 확장. ADR-157 표시 정책(가상화 stride M2 단일 줄) 경계 불변, canonical schema 무변경, D3 시각(Skia↔CSS 대칭)
  - **잔존(latent) → ✅ 봉쇄(2026-07-23 후속 F1/F2, 위 엔트리)**: geometry 통로 봉쇄 후 남았던 입력 산출 residual(M1 icon/check-aware maxWidth 미적용 / GridList gap-source / icon slot iconSize)은 공유 `resolveListBoxItemInset` helper + `resolveGridListItemMetric().descGap` SSOT 로 봉쇄됨
  - 검증: 신규 13(collectionRowMetric 10 + differential 3) + 회귀 700+(specs 637 / collection builder 69) + type-check baseline(61) + 라이브(builder 무오류·전 collection layout==skia). 커밋 `e5fa15e57`(P0)/`822359006`(P1)/`6b3ffd978`(P3a)/`fe43c833f`(P3b)/`a7f634520`(P4)
  - 위치: `packages/specs/src/renderers/utils/collectionItemMetrics.ts`(SSOT), `packages/specs/src/renderers/skiaPrimitives.ts`(escape 소비), `apps/builder/.../layout/engines/utils.ts`(M1 소비)

## [GridList 카드도 긴 label/description wrap 미반영 — ListBox 동형 3계층 수정] - 2026-07-22

### Bug Fixes

- **GridList 카드의 label/description 이 길면 CSS 는 카드가 늘어나나 Skia 는 단일 줄로 고정 + description 이 wrap 된 label 위에 겹침** (ListBox item 과 동일 "단일 줄 가정" 문제가 GridList 에 복제):
  - collection-item parity sweep 에서 ListBox 3계층 수정 후 GridList 를 점검 — gridlist_card escape 와 GridListItem 행 공식이 listbox_item 과 코드 대칭인데 wrap 미측정 상태였다
  - **계층 1 (layout 행 공식)**: `utils.ts` §1.55b2 GridListItem 행이 `getTextLineHeight(labelFs) + gap + getTextLineHeight(descFs)` 단일 줄 → 카드 콘텐츠 폭(availableWidth − 좌우 padding)에서 `measureWrappedTextHeight` 멀티라인 측정 추가 (ListBox §1.55b-2 동형). 가상화 stride 는 단일 줄 유지(ADR-157 불변)
  - **계층 2 (컨테이너 enrich 동결)**: bounded-scroll owner preserve 제외(`isBoundedScrollOwnerStyle`)가 collection-agnostic 이라 GridList 도 자동 커버 (별도 수정 불요)
  - **계층 3 (escape paint 스택)**: `skiaPrimitives.ts` gridlist_card 가 `stackY += entryLineHeight`(단일 줄)로 스택 → label wrap 시 description 겹침. 주입 측정기(`measureSpecWrappedTextHeight`)의 wrap 블록 높이로 스택 offset·카드 높이·배경 계산, text 에 `maxWidth`+`lineHeight` 명시(listbox_item 동형)
  - **Why**: gridlist_card 와 listbox_item 은 label/description 수직 스택 구조가 대칭이라, ListBox 만 고치면 GridList 에서 동일 증상이 재현된다
  - 검증: specs 627 + builder 23 PASS(gridlist_card wrap 6 신규 포함), type-check baseline PASS. GridList 컨테이너 인스턴스가 페이지에 없어 라이브 재현은 미실시 — ListBox 동형 메커니즘(라이브 검증됨) + 단위 테스트로 확증. 실제 GridList 배치 시 검증 권장
  - 위치: `apps/builder/.../layout/engines/utils.ts` §1.55b2, `packages/specs/.../skiaPrimitives.ts` gridListCard

## [ListBox wrap 행 잔존 2건 — 컨테이너 높이 동결 해소 + escape 스택 겹침 수정] - 2026-07-22

### Bug Fixes

- **긴 label/description 행이 wrap 으로 커져도 ListBox 컨테이너(maxHeight+overflow:auto)가 안 늘어나고 행이 잘림** (행 높이 wrap-aware 화 이후 잔존 — CSS 는 min(content, maxHeight)=300):
  - `preserveEnrichHeight`(fullTreeLayout, `onlyProjectionRowsChild`)가 bounded-scroll collection owner 까지 과포괄 — enrich 1-pass 추정(단일 줄 행 합산 234)이 Taffy 에 동결되어, Step 4.5 2-pass 가 행을 wrap 실측으로 키워도(rowsGroup 400) owner 는 234 에 고정
  - **Why**: preserve 는 TagList flex:1 side-label 발산용이며 주석도 "ListBox top-level 은 height 제거로도 정상" 명시 — 행이 단일 줄이던 시기엔 동결값과 실측이 우연히 일치해 무해했으나 wrap-aware 행 도입 후 발산 표면화
  - 수정: bounded-scroll owner(`height`/`maxHeight` px + overflow scroll/auto — `isBoundedScrollOwnerStyle`)는 preserve 제외 → Taffy auto(자식 실측 합) + max_size(maxHeight) clamp. sample-mode(auto-height, ADR-157) owner 는 bounded 아님 → preserve 유지(표시 정책 불변). 라이브 검증: owner Skia 234→300 == CSS 300
  - 위치: `apps/builder/.../layout/engines/fullTreeLayout.ts`
- **wrap 된 label(3줄) 위에 description 이 겹쳐 그려짐** (escape 스택 offset 단일 줄 가정):
  - `listbox_item` escape 가 description y 를 `paddingTop + label 1줄 lineHeight + gap` 으로 계산 — label 이 wrap 되면 paint(converter 는 paragraph 를 y 기준 top-start 로 아래로 흘림)와 겹침
  - **Why**: escape(packages/specs)에 wrap 블록 높이 측정 수단이 없어 단일 줄 가정이 구조적이었다
  - 수정: specs 에 주입식 측정 hook(`setSpecWrappedTextHeightMeasurer`) 신설 — builder 가 paint 동일 엔진(`measureWrappedTextHeight`, CanvasKit-backed)을 주입, escape 는 label/description **wrap 블록 높이**로 스택 offset·행 높이 fallback·slot 배경 밴드를 계산(미주입 시 단일 줄 fallback = BC). text shape 에 `lineHeight`(px) 명시로 converter strut 도 CSS(desc 1.333×)와 정합. 라이브 검증: label 3줄 + desc 5줄 겹침 없이 CSS 와 동일 렌더
  - 위치: `packages/specs/.../skiaPrimitives.ts`, `packages/specs/.../utils/measureText.ts`, `apps/builder/.../utils/textMeasure.ts`

## [ListBox 인스턴스가 origin gap 을 Skia 에서 상속 못 함 — 행 간격 origin fallback] - 2026-07-22

### Bug Fixes

- **origin ListBox 의 gap 을 바꿔도 ref 인스턴스의 Skia 행 간격이 반영 안 됨** (CSS preview 는 origin gap 정상 상속):
  - 행 projection gap resolver(`appendListBoxRowProjection`)가 인스턴스 scene node 자체 style + catalog fallback 만 읽어, 인스턴스가 자체 gap override 를 안 주면 origin ListBox 의 `rowGap`(예: 10)을 놓치고 catalog default(2)로 떨어졌다
  - **Why**: CSS(DOM)는 `CanonicalNodeRenderer` 의 ref 해석으로 origin container style(gap)을 상속하나, Skia scene projection 은 origin 해석 없이 인스턴스 style 만 소비 → D3 asymmetry
  - 수정: `sourceNode` 가 ref 면 origin ListBox style 을 해석해 gap fallback 체인에 삽입 — **인스턴스 자체 gap → origin gap → catalog default** 순. 라이브 검증: 인스턴스(자체 gap 없음) 행 간격 CSS 10 == Skia 10(수정 전 2). 인스턴스 자체 gap 은 계속 우선
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`

## [ListBoxItem 긴 label/description 이 Skia 행에서 안 늘어남 — 행 높이 wrap-aware 화] - 2026-07-22

### Bug Fixes

- **ListBoxItem 의 label/description 텍스트가 길어 CSS 는 자동 줄바꿈으로 행이 늘어나는데 Skia 는 단일 줄 높이로 고정** (내용 잘림·겹침):
  - projection 행 높이 공식 `resolveListBoxItemRowHeight` 가 `label lineHeight + gap + description lineHeight` 로 **각 1줄 고정** — text wrap(멀티라인) 미측정
  - **Why**: projected 행은 label/description 을 `props`(자식 scene 노드 아님)로 들고 escape 가 그리므로 행 높이가 공식-기반이다. 공식이 단일 줄이라 CSS 자동 줄바꿈(행 성장)과 발산
  - 수정: `resolveListBoxItemRowHeightFromStyle` 에 `wrapContext`(label/description 텍스트 + 실제 행 가용 폭) 추가 → 콘텐츠 폭에서 `measureWrappedTextHeight` 로 멀티라인 높이 측정(GridListItem card §3.5 동형). §1.55b layout 분기만 wrapContext 전달, collection 가상화 stride 는 미전달 = 균일 단일 줄(ADR-157 content-height 불변). 라이브 검증: 긴 설명 행 CSS 102 == Skia 102(수정 전 54), 단일 줄 행 무회귀
  - 위치: `apps/builder/.../layout/engines/utils.ts`, `packages/specs/.../collectionItemMetrics.ts`

## [ListBoxItem width:50% 가 Skia 에서 100% 로 렌더 — 행 projection 이 origin width 를 존중] - 2026-07-22

### Bug Fixes

- **origin ListBoxItem 에 `width:50%` 를 줘도 Skia 인스턴스 행은 100% 로 렌더** (CSS preview 는 50% 로 정상 → Skia↔CSS parity 위반):
  - ListBox 행 projection(`appendListBoxRowProjection`)이 각 행 style 에 `width: "100%"` 를 **무조건 하드코딩**하여 origin template 의 `width:50%`(templateAnchorStyle 에 존재)를 덮어썼다
  - **Why**: 행은 항상 full-width 라는 가정으로 100% 를 강제. 그러나 CSS(DOM)는 origin ListBoxItem 의 `width` 를 각 행 요소에 적용하므로, 사용자가 50% 를 주면 두 consumer 가 갈라진다(D3 symmetric parity 위반)
  - 수정: 행 style 을 `templateAnchorStyle`(+selected overlay) 병합 결과로 두고, **width 가 없을 때만** `"100%"` 기본값 적용 → origin 명시 width(50% 등) 존중. 라이브 확인: 인스턴스 행 폭 171px(= rows-group 342 × 50%), origin 195px(= 390 × 50%), width 미지정 selected origin 은 390px(100%) 유지
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`

## [Form/field 의 labelPosition·labelAlign DOM 누출 — catalog 투영기가 label-layout hint 를 data-* 로 라우팅] - 2026-07-22

### Bug Fixes

- **`labelPosition`/`labelAlign`/`necessityIndicator` 가 `<form>`/field DOM 요소에 누출** (React `"does not recognize the labelAlign prop"` 경고):
  - `toRacProps` (catalog canonical→RAC 투영기) 는 `variant`/`size`/`fillStyle` (visual-enum) 만 `data-*` 로 라우팅하고, 그 외 `kind:"enum"` 은 raw React prop 으로 통과시켰다. RSP label-layout hint 3종(`labelPosition`/`labelAlign`/`necessityIndicator`)은 `kind:"enum"` 이라 raw prop 으로 방출됨
  - **Why**: canonical 렌더 경로(`CanonicalNodeRenderer` cutover)는 `<PrimitiveComponent {...toRacProps()}>` 로 **raw RAC primitive**(`RAC.Form` 등)에 스프레드한다. RAC/DOM 에 이 3 prop 은 존재하지 않아 `<form>` DOM 속성으로 흘러 React 경고 + theme·`Form.css` 의 `[data-label-position]`/`[data-label-align]` selector 미매칭(label 레이아웃 CSS 무반영)의 이중 결함. `labelPosition`(default `top`)/`labelAlign`(default `start`)은 기본값이 있어 항상 누출
  - 수정: `toRacProps` 에 `DATA_ATTR_ENUM_KEYS`(키 이름 기반 data-\* 라우팅 집합 — `labelPosition`/`labelAlign`/`necessityIndicator`) 추가. visual-enum kind 와 동일 분기로 `data-{kebab}` 만 emit(raw prop 차단). 18개 field/collection binding 이 동일 hint 를 선언하므로 단일 choke point 에서 일괄 교정 — delegating renderer(Slider/ProgressBar/Meter/field 렌더러)는 `toRacProps` 미경유라 무영향
  - 위치: `packages/shared/src/catalog/outputs/toRacProps.ts`

## [catalog-only overflow 컨테이너의 Skia 스크롤/클립 미동작 — systematic consumer-side 해소] - 2026-07-22

### Bug Fixes

- **overflow 를 catalog `containerStyles` 에만 둔 컨테이너가 Skia 빌더에서 스크롤/클립이 동작하지 않던 구조적 문제** (사용자 지적: "overflow 가능한 모든 Skia 부분에서 동일 문제"):
  - **Why**: Skia 스크롤/클립 4 소비자 — 일반 컨테이너 maxScroll(`fullTreeLayout` GAP4) / 휠(`useScrollWheelInteraction`) / clip·scrollbar shape(`buildSpecNodeData`·`buildBoxNodeData`) — 가 전부 raw `element.props.style.overflow` 만 읽었다. overflow 를 catalog rule 에만 둔 컨테이너(ListBox/Tree/body 의 `auto` · Card/DisclosureGroup 의 `hidden`)는 factory 가 real props.style 에 overflow 를 안 materialize 하면 4 소비자에 도달하지 못해 스크롤 미동작·자식 미클립(캔버스에서 넘쳐 보임). 시스템 페이지 body(20ac5e60d)·ListBox(66d653642) 를 개별 materialize 로 우회해 왔으나 근본은 소비자가 catalog fallback 을 안 읽는 것.
  - 수정: 공용 resolver `resolveEffectiveOverflow(type, rawStyle)` 도입 — raw overflow 우선(사용자/factory 편집), 없으면 catalog root overflow 를 3 위치(top-level `containerStyles` · `structure.containerStyles`(Card) · `structure.composition.containerStyles`(DisclosureGroup))에서 조회(type→overflow 메모이즈, hot path short-circuit). 4 소비자를 이 resolver 경유로 전환 → catalog-only overflow 컨테이너도 스크롤/클립 동작.
  - **범위 경계**: `.bar` 등 staticSelectors 의 sub-part overflow(ProgressBar/Meter)는 root clip 이 아니므로 제외(spec shapes 렌더 담당). ComboBox/Select 의 popover 내부 listbox overflow 는 builder 에 trigger 만 렌더되어 무관. **collection 가상화(collectionVirtualization)는 raw 유지** — catalog maxHeight fallback 병합 시 bare ListBox 가 ADR-157 auto-height sample/hatch 대신 bounded 로 바뀌어 정책 변경이 되므로, ListBox bounded-scroll 은 factory/hydration materialize(instance 실 style)가 계속 담당.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`(resolver) · `fullTreeLayout.ts`(GAP4) · `hooks/useScrollWheelInteraction.ts` · `skia/buildSpecNodeData.ts` · `skia/buildBoxNodeData.ts`
  - 검증: type-check PASS(baseline 61 무동) · 회귀 테스트 +7(resolveEffectiveOverflow 3 위치 포괄/sub-part 제외/raw 우선 + Card clip catalog 기본값 갱신) · layout engines 277 유닛 PASS. **라이브 검증**: Card `getSkiaNode().clipChildren=true`(catalog structure.containerStyles), ListBox origin(catalog-only overflow:auto) `clipChildren=true`, ListBox 인스턴스 scrollbar/scrollOffset + 300 clamp, DOM iframe scrollable — Components 페이지 전체 무회귀.

## [ListBox overflow:auto 인데 스크롤 안 되고 넘쳐 보이던 문제 — bounded-scroll 기본값을 real props.style 로 materialize] - 2026-07-22

### Bug Fixes

- **ListBox 에 아이템을 늘려도 overflow:auto 가 scroll 처럼 안 되고 visible 처럼 컨테이너가 계속 늘어나던 문제** (사용자 보고 2026-07-22):
  - **Why**: 스크롤 동작(collectionVirtualization 가상화 window resolver — `readBoundedHeightPx` + `isScrollOverflow`) / 휠(useScrollWheelInteraction) / scrollbar·clip shape(buildSpecNodeData / buildBoxNodeData) **4 소비자가 전부 raw `element.props.style` 의 overflow·maxHeight 를 읽는다.** 그러나 ListBox 의 `maxHeight:300px`+`overflow:auto` 는 catalog `containerStyles` 에만 있고(layout `resolveContainerStylesFallback` + Style 패널만 소비), factory 는 instance props.style 에 `{ width:"100%" }` 만 둔다. 4 소비자가 maxHeight/overflow 를 못 읽어 가상화가 **unbounded(auto-height)** 로 판정 → 행이 300px 를 넘어도 clamp/스크롤 없이 컨테이너가 계속 성장. 시스템 페이지 body 스크롤 미표시(2026-07-21, commit 20ac5e60d)와 **동일한 catalog↔raw-consumer 비대칭**.
  - 수정: bounded-scroll 기본값(`maxHeight:"300px"`, `overflow:"auto"`)을 ListBox instance 의 **real props.style** 로 materialize — factory 신규 경로(`createListBoxDefinition`) + 기존 instance hydration repair(`ensureListBoxScrollStyle`). real style 1곳이 4 raw 소비자를 동시 충족(catalog fallback 일반화 대비 blast radius 최소, 20ac5e60d 선례와 동일 판단). repair 는 height/overflow 를 **하나도** 명시 안 한 순수 default instance 만 대상 — 커스텀 높이·auto-height(overflow 명시)는 보존, 멱등.
  - 위치: `apps/builder/src/builder/factories/definitions/SelectionComponents.ts`(factory) · `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts`(hydration repair)
  - 검증: type-check PASS(baseline 61 무동) · 회귀 테스트 +6(factory style 1 + migration 보강/보존/멱등/origin 무영향 5). **라이브 검증(사용자 프로젝트 9-item ListBox)**: reload 시 migration 이 instance style 을 `{width:100%, maxHeight:300px, overflow:auto}` 로 보강 → DOM(iframe) `clientHeight 298 < scrollHeight 366` **scrollable true**(scrollTop 0→60 실이동) + Skia `getSharedLayoutMap` 컨테이너 높이 358 성장 → **300 clamp**. 이전엔 양 렌더러 모두 unbounded 성장.

## [data-bound GridList 인스턴스 DOM을 slot 기반으로 전환 — 레거시 클래스 렌더로 인한 Skia↔DOM 12px 발산 해소] - 2026-07-22

### Bug Fixes

- **data-bound GridList 인스턴스가 Preview/Publish DOM 에서 카드 높이 64 로 렌더돼 Skia 빌더 캔버스(76)·origin(76)과 12px 어긋나던 문제**:
  - **Why**: data-bound GridList 인스턴스의 label/description 을 `<span className="gridlist-item-label/description">` **레거시 클래스**로 렌더했다 (label `--text-sm` 14 / weight 600, desc `--text-xs` 12 / muted → 카드 64). 그러나 GridList **origin**(reusable template 실 Text 자식)과 **ListBoxItem** 은 `<Text slot="label/description">`(react-aria-Text 16, slot) 을 쓴다 — origin·ListBox 는 slot, GridList 인스턴스만 레거시 클래스라 **비대칭**. Skia `gridlist_card` metric 은 slot 기준 76(label 16/24 + desc 16/24)으로 계산하므로 인스턴스 DOM(64)과 Skia(76)가 12px 발산했다 (2026-07-22 라이브 스크래치 인스턴스 검증에서 발견 — 이전 검증은 synthetic slot 노드를 써서 이 차이를 놓침).
  - 수정: GridList 인스턴스 렌더(3 경로)를 `<Text slot="label">`/`<Text slot="description">` 로 전환(origin·ListBoxItem 통일). GridList.css 는 `.gridlist-item-*` 레거시 클래스 규칙을 `[slot="label"] { font-weight: 600 }` / `[slot="description"] { color: var(--fg-muted) }` 로 대체 — **font-size 축소 없이 react-aria-Text 기본 16 유지**(ListBox 는 `--lb-desc-size` 12 로 축소하지만 GridList slot 은 line-height override 가 없어 Skia 가 desc 16/24 로 계산). 결과 인스턴스 DOM = origin = Skia = 76(label 16/24 bold + desc 16/24 muted).
  - **3 렌더 경로 동시 전환**: `renderGridListItemSlotContent`(projection 행) + GridListItem fallback(`SelectionRenderers.tsx`), `GridList.tsx` 컴포넌트(Text import 추가).
  - 위치: `packages/shared/src/renderers/SelectionRenderers.tsx` · `packages/shared/src/components/GridList.tsx` · `packages/shared/src/components/styles/GridList.css`
  - 검증: type-check PASS(baseline 61 무동). **라이브 검증**: iframe 실 CSS(레거시 클래스 규칙 제거 + `[slot=*]` 규칙 존재)에 방출 구조(react-aria-Text slot) 주입 = 카드 76(label 16/24 fw600 · desc 16/24 fg-muted), Skia projection `getSharedLayoutMap` = [76,76,76]. 스크래치 GridList 인스턴스 생성·측정·`removeElement` 로 라이브 프로젝트 원복.

## [ListBox 아이템 행 높이 metric을 실 렌더에 정합 — data-bound 인스턴스 label base 14→16 + description line-height] - 2026-07-22

### Bug Fixes

- **data-bound ListBox 인스턴스 행이 Skia 빌더 캔버스에서 실제 DOM 렌더보다 짧게 계산되던 잠재 문제**:
  - **Why**: ListBox item metric 이 (1) label base 를 item fontSize(14) 로 가정했으나 `react-aria-Text` 는 부모 size 미상속·16 고정이라 label line box 는 24(=1.5×16) 여야 한다(라이브 실측: item fontSize 14 여도 label 은 16/24 렌더). (2) description line box 를 `getTextLineHeight`(1.5×fs)=18 로 산출했으나, ListBox `[slot=description]` CSS 는 line-height 를 1.333×fs 토큰으로 override 해 12→16 이다(label 의 1.5× 와 별도 비율 — desc 14→18.67, 24→32 실측). 두 오차가 부분 상쇄해 default desc 행이 49(실 50)·plain 29(실 32) 로 -1~-3px 어긋났고, label 만 고치면 desc 행이 52 로 오버슛됐다. 대상 프로젝트는 explicit 3xl label 이라 미발현(2026-07-21 ListBox 정합 세션에서 보류)이었으나 기본 크기 인스턴스에서 상시 -3px.
  - 수정: label base = `COLLECTION_TEXT_DEFAULT_FONT_SIZE`(16), label line box = `getTextLineHeight`(1.5×), description line box = 신규 `getDescriptionLineHeight`(1.333×fs, xs 토큰 비율) → 12→16. default desc 행 50 / plain 32 로 실 DOM 정합. 명시 slot size 는 우선.
  - **3 높이 소스 + fallback 상수 동시 수정 (Layer D 대칭, ADR-147 계약)**: row resolver `resolveListBoxItemRowHeightFromStyle`(`utils.ts` §1.55b-2 projection 행 + 가상화 stride), `listbox_item` escape(`skiaPrimitives.ts` Skia 그리기), container aggregate `resolveListBoxItemMetric`(`collectionItemMetrics.ts` static props.items §1.55b — standalone ListBoxItem 높이 = container per-item 할당 계약 유지 위해 동일 32/50), `DEFAULT_LISTBOX_ROW_HEIGHT`(`collectionVirtualization.ts`).
  - 위치: `packages/specs/src/primitives/typography.ts`(getDescriptionLineHeight 신규) · `packages/specs/src/renderers/utils/collectionItemMetrics.ts` · `packages/specs/src/renderers/skiaPrimitives.ts` · `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` · `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts`
  - 검증: type-check PASS(baseline 61 무동) · specs 609 + 빌더 canvas/layout 405 유닛 PASS. **라이브 검증(dev 재시작)**: Skia 빌더 캔버스 projected ListBox 행(`getSharedLayoutMap`)이 `[50,50,50,32,32,32]` — DOM 오라클(desc 50 / plain 32)과 정확 일치.

## [GridList 카드 높이 metric을 실 렌더에 정합 — ListBox 유사 패턴 sweep] - 2026-07-22

### Bug Fixes

- **GridList 카드(인스턴스/projection/sample) 높이가 실제 렌더(origin·CSS)보다 짧게 계산되던 문제**:
  - **Why**: GridList card metric 이 slot-based 렌더로 전환된 뒤에도 옛 공식을 유지해 실 렌더와 다중 값이 어긋났다. (1) label/description line box 를 `getLabelLineHeight`(typography 토큰) 로 산출 — GridList slot 은 `[slot=*]` line-height override 가 없어 실제로는 기본 Text 의 1.5×fs 로 렌더된다(ListBox 의 desc 1.333 override 와 대조, 라이브 확인). (2) base font-size 를 item fontSize(14) 로 가정 — 그러나 `react-aria-Text` 는 부모 size 를 상속하지 않고 16 으로 고정 렌더되므로 label·description 둘 다 16→line box 24 여야 한다. (3) description 을 `fontSize-2` 로 label 에 결합 — GridList 는 description font-size override 가 없어 고정 16 이어야 하며, label 을 키우면 description 이 과팽창했다. (4) within-card gap 을 `descGap 4/6` 으로 계산 — 실제 GridListItem flex `gap` 은 `--spacing-2xs`=2. 결과적으로 default 카드가 64 로 계산돼 라이브 origin 76 / DOM 76 / large-label 97 보다 짧아, 큰 label 에서 instance 행이 cramped 되고 텍스트가 겹칠 수 있었다.
  - 수정: label/description line box = `getTextLineHeight`(1.5×fs), base = `COLLECTION_TEXT_DEFAULT_FONT_SIZE`(16, react-aria-Text 기본), description 고정 16 decouple, within-card gap = 2. slot 자식 명시 size 는 우선(큰 label 은 slot fold 값 사용). default 카드 64 → 74(+ border 2 = origin 76).
  - **4 소비 경로 동시 수정 (Layer D 대칭)**: `calculateContentHeight` gridlistitem projection 분기 + gridlist container 분기(`utils.ts`), `gridlist_card` escape(`skiaPrimitives.ts`), `resolveGridListRowStride`(ADR-157 sample/hatch stride, `collectionVirtualization.ts`), `resolveGridListItemMetric.descGap`(`collectionItemMetrics.ts`).
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` · `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts` · `packages/specs/src/renderers/skiaPrimitives.ts` · `packages/specs/src/renderers/utils/collectionItemMetrics.ts`
  - 검증: type-check PASS(baseline 61 무동) · 관련 유닛 98 PASS. 라이브 CSS oracle(DOM injection GridListItem 카드 76/97) + 라이브 origin(`getSharedLayoutMap` 76) 실측이 fix target 이며 metric 이 이제 정확히 산출. GridList 컨테이너 인스턴스는 대상 프로젝트에 부재(reusable origin 만 — child-sum 경로라 metric 미사용)이므로 시각 회귀 없는 preventive 정합.

## [ListBox 아이템 CSS↔Skia 높이 정합 — min-height 축소·스크롤 미생성 수정] - 2026-07-22

### Bug Fixes

- **ListBox 아이템 수가 늘어날수록 CSS 에서 각 ListBoxItem 이 축소·겹치고 스크롤바가 안 생기던 문제 (Skia 는 정상)**:
  - **Why**: catalog `ListBoxItem.sizes.md.minHeight=20` 이 generated CSS 에 `min-height: 20px` 로 emit 되어, flex column collection item 의 자동 min-content(= `min-height: auto`) 보호를 덮어썼다. 컨테이너가 고정 높이일 때 flex 자식이 내용(label+description) 아래로 축소되고, 그 결과 `scrollHeight` 가 `clientHeight` 를 넘지 못해 `overflow: auto` 가 스크롤을 만들지 못했다. Skia 는 layout 엔진이 overflow≠visible 컨테이너의 flex 자식에 `flexShrink: 0` 을 주입(fullTreeLayout Step 5.7)해 내용 높이를 유지 → 두 렌더 경로 비대칭.
  - 수정: catalog 에서 `minHeight` 제거 후 `pnpm generate:css` 재생성(`min-height` 미emit → `auto`). Skia `resolveListBoxItemRowHeight` 는 element `style.minHeight ?? 20` 을 읽어 catalog 를 참조하지 않으므로 무회귀 (`max(content, 20)` 에서 content 항상 우세). 라이브 검증: item 22.7/20px→50/32px, scrollHeight 264>clientHeight 146 스크롤 생성.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (ListBoxItem sizes.md) · `packages/shared/src/components/styles/generated/ListBoxItem.css`

## [border(색/스타일/너비)를 breakpoint 무관 전역 속성으로 통일 — 배경 fills 동형] - 2026-07-22

### Bug Fixes

- **mobile breakpoint 에서 border 를 편집해도 CSS 에 정상 적용되지 않고, desktop 편집만 모든 breakpoint 에 적용되던 비대칭**:
  - **Why**: border 색/스타일/너비는 `props.style` 축이라 ADR-154 responsive 시스템에 들어가 비-desktop 편집이 `responsive.styles` override 로 저장되는데, 응답형 @media border CSS 렌더가 불안정했다. 배경(fills)은 `node.fills[]` 전역 채널이라 이 문제가 없다 — 사용자 요청대로 border 를 배경처럼 전역 통일.
  - 수정: `borderColor/borderStyle/borderWidth`(+ 4-way longhand)를 `GLOBAL_STYLE_PROPS` 로 정의해 어느 breakpoint 에서 편집해도 base `props.style` 에 저장(=@media 없는 기본 CSS 로 전 breakpoint 적용). write↔dirty↔reset 5경로 일관 처리 — write 3함수가 전역 속성을 base 로 라우팅 + stale responsive override 정리, `computeDirtyStyleProps`/`resetStyles` 가 non-desktop 에서도 base 비교로 dirty/reset(모바일 reset 버튼 활성). `borderRadius`(형태)는 제외.
  - 위치: `apps/builder/src/builder/stores/utils/globalStyleProps.ts` · `apps/builder/src/builder/stores/inspectorActions.ts` · `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`

## [Components 페이지 스크롤 표시·편집 시 요소 순서 유지·Text 배경 정렬 수정] - 2026-07-21

### Bug Fixes

- **Components 페이지 콘텐츠가 페이지 높이를 넘어도 스크롤바가 안 나오던 문제**:
  - **Why**: 스크롤 동작(fullTreeLayout GAP4 maxScroll) / 렌더(buildSpecNodeData·buildBoxNodeData scrollbar) / 휠(useScrollWheelInteraction) 4 소비자가 모두 raw `element.props.style.overflow` 를 읽는데, 시스템 페이지 body 가 `props:{}` 로 생성돼 overflow 미설정 → maxScrollTop 이 0 에 머물러 스크롤바 미표시. 일반 페이지는 factory `createDefaultBodyProps` 로 이미 real overflow:auto 를 갖는 비대칭.
  - 수정: catalog body `containerStyles.overflow:auto`(패널 기본값) + 시스템 페이지 body 에 실제 `props.style.overflow:auto` 부여(신규 생성 + 기존 프로젝트 `repairComponentsPageNode` 1회 보강, 명시값 보존).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` · `apps/builder/src/builder/pages/systemComponentsPage.ts`
- **요소의 값/스타일을 편집하면 canonical `children[]` 에서 형제 중 맨 아래로 재배열되던 버그 (Components 페이지 1·2차 요소)**:
  - **Why**: `upsertElementIntoDocument` 는 `shouldPreserveExistingCanonicalPosition` 이 true 여야 제자리 replace(순서 보존), false 면 remove+append(맨 뒤). ① reusable origin 이 `componentRole` 미러 없이 `reusable:true` 만 있으면 `legacyPositionMatches` 가 저장 role(undefined) vs 재계산 role("master") 불일치로 false. ② seed/template 로 position metadata 없이 저장된 자식은 `previous=null` 로 false.
  - 수정: previousNode 의 reusable/ref 로 role·masterRef 를 대칭 재계산 + metadata 부재 시 트리 구조(직속 자식 여부)로 위치 판정.
  - 위치: `apps/builder/src/adapters/canonical/canonicalMutations.ts`
- **Text 컴포넌트에 배경색을 추가하면 텍스트가 가운데 정렬되던 버그**:
  - **Why**: `buildCatalogShapes` 의 `isInlineText` box 판정이 사용자 `style.backgroundColor`(fills 채널)를 opaque box 신호로 써서, Text 에 배경을 추가하면 `hasOpaqueBg=true → isInlineText=false` → center/middle 오정렬. DOM `<span>` 에 background 를 줘도 inline flow 라 left/top 을 유지하므로 Skia 도 동일해야 D3 parity.
  - 수정: `isInlineText` 판정을 사용자 배경색이 아니라 rule 변형 fill(stateBg opaque)·border 기준으로 변경 — Text leaf 는 배경 유무 무관 left/top 유지, box archetype(Button/Badge)은 center/middle 보존.
  - 위치: `packages/specs/src/renderers/buildCatalogShapes.ts`

## [ListBoxItem 3경로(origin/instance/CSS) 행 높이·label fontWeight 정합 — Text line box + description decouple + render-time 600 주입] - 2026-07-21

### Bug Fixes

- **Skia home instance ListBoxItem 행 높이가 origin(Components)·CSS 와 크게 다름 (label size 를 키우면 특히)**:
  - 두 원인 복합. **(A) label line box 모델 불일치**: instance projection(escape `listbox_item` + `resolveListBoxItemMetric` + `resolveListBoxItemRowHeightFromStyle`)이 label/description line box 를 `getLabelLineHeight`(typography 토큰, 3xl→36)로 산출 → origin 실 Text 자식·CSS(line-height 1.5, 3xl→**45**)보다 짧게. **(B) description fontSize 가 label 과 결합 (주원인, +28px)**: description slot size 부재 시 `Math.max(11, labelFs-1)` 로 fallback 해, label 3xl(30) 시 description 을 **29** 로 부풀려(line box 44) 행이 원본 대비 +28px (라이브: instance **101** vs origin 72 / CSS 73).
  - **Why**: label/description 은 **Text** leaf 라 line box = `1.5×fs`(CSS·leaf Text 레이아웃 동일)여야 하고, description 은 CSS `[slot="description"]{ font-size: var(--lb-desc-size, var(--text-xs)) }` 처럼 label 과 무관한 고정 --text-xs(12)여야 한다. 라이브 DOM 실측으로 방향 확정(label 30px/45px/600, desc 12px/16px/400, row 73).
  - 수정:
    - `getTextLineHeight`(=`ceil(1.5×fs)`) 헬퍼 신설(`packages/specs/src/primitives/typography.ts`) → ListBoxItem 3경로 label/description line box 를 token 룩업에서 1.5 로 교체. `getLabelLineHeight` 는 standalone Text/Label(specShapeConverter)·gridlist_card 용으로 불변.
    - description fontSize fallback 을 `labelFs-1` → **12**(--text-xs, label 무관) 로 decouple (resolver + escape). 명시 slot size 우선.
  - 결과(라이브): instance **101 → 75** — origin 72 / CSS 73 과 3px 이내 정합(28px+ 격차 해소).
  - 위치: `packages/specs/src/primitives/typography.ts` · `packages/specs/src/renderers/utils/collectionItemMetrics.ts` · `packages/specs/src/renderers/skiaPrimitives.ts`(listbox_item) · `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

- **origin ListBoxItem 의 label fontWeight 가 instance/CSS 와 다름 (origin 만 얇게)**:
  - 근본 원인: reusable ListBoxItem origin 의 label slot 자식은 fold 대상이 아니라 독립 leaf scene 노드로 서는데, Skia leaf Text 렌더가 catalog **Text** rule 의 textWeight(400)로 그린다. 그러나 collection label 정본은 **600** — catalog `ListBoxItem.variants.default.textWeight` + 수동 CSS `[slot="label"]{font-weight:600}` + instance escape 600 이 모두 600. origin Skia 만 400.
  - **Why**: 템플릿 fontWeight 주입은 `repairOrigin` 이 기존 origin children 을 보존해 기존 프로젝트에 미반영이므로 부적합. DOM 의 parent-scoped CSS 처럼 **render-time** 주입이라야 기존·신규 origin 모두 커버.
  - 수정: scene build 자식 순회(`canvasSceneNode.ts`)에서 collection-item label slot 자식에 render-time fontWeight 600 주입(`injectCollectionLabelWeight`). 자식 명시 fontWeight 우선, description 은 400 유지. (Table 셀 `fontWeight` 주입 선례 동형)
  - 검증(라이브 DOM): CSS label fontWeight 600 확증. 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`

## [배경(fills) 초기화 버튼이 desktop 에서만 뜨던 비대칭 수정 — 전역 fills 를 모든 breakpoint 에서 dirty 로 감지] - 2026-07-21

### Bug Fixes

- **Style 패널 Appearance 섹션의 배경 초기화 버튼이 desktop breakpoint 에서만 활성화됨 (배경은 breakpoint 무관 전역 공유인데 tablet/mobile 에서는 되돌릴 수 없음)**:
  - 근본 원인: 배경은 breakpoint 무관 **전역** 채널(`node.fills`)로 authoring 되고, write(`updateSelectedFills`)·reset(`AppearanceSection.handleReset → updateSelectedFills([])`)이 모두 breakpoint 를 안 보고 전역 fills 를 다룬다. 그런데 dirty 판정 `computeDirtyStyleProps`(useResetStyles.ts)의 non-desktop 분기가 `responsive.styles`(style-prop 맵)만 읽고 조기 return — fills 는 그 맵에 절대 안 담겨 tablet/mobile 에서 `backgroundColor` 가 dirty 로 안 잡힘 → `hasDirty=false` → `onReset` undefined → 리셋 버튼 미표시.
  - **Why**: write·reset 은 이미 전역인데 dirty 판정만 desktop 분기에서만 fills 를 adapt 하던 **write-global / detect-desktop-only 비대칭**. "자기 tier override 만 reset" 논리는 per-breakpoint prop 에만 맞고, 전역 속성인 배경엔 안 맞는다 (사용자 지적: 전역 공유면 reset 도 전역이어야 함).
  - 수정: `computeDirtyStyleProps` non-desktop 분기가 전역 `element.fills` 존재 시 `backgroundColor` 를 모든 breakpoint 에서 dirty 로 surface — 전역 write ↔ 전역 reset 대칭 복원. reset 동작(`handleReset` 의 `updateSelectedFills([])`)은 기존부터 전역이라 무변경, 버튼 표시(`hasDirty`)만 정합.
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`
  - 검증: `useResetStyles.test.tsx` ADR-154 블록에 4종 추가(mobile/tablet 전역 fills→`backgroundColor` dirty · fills 없으면 non-dirty BC · `useHasDirtyStyles` mobile+fills→true = 실 hook 게이트) — 66 PASS 회귀 0 · type-check PASS · **live(Chrome MCP)**: PropertySection 이 `onReset` truthy 시 `.section-actions` 에 "Reset section" 버튼 렌더(Transform 섹션 dirty 상태로 실제 표시 확인) — 버튼 배선 확증, 게이트 hook 은 실 hook unit test 로 검증

## [ListBoxItem 자식 Text 의 props.size 가 layout 에서 14 로 clobber 되던 문제 수정 — 자식 size 미해소로 padding 0 에서 행 높이 붕괴] - 2026-07-21

### Bug Fixes

- **origin ListBoxItem 의 label/description size 를 키워도(3xl/2xl) layout 높이가 반영 안 되고, padding 0 에서 행 높이가 붕괴(자식이 14px 로 축소)**:
  - 근본 원인: `injectCollectionItemFontStyles`(implicitStyles.ts — ListBoxItem/GridListItem 컨테이너에서 항상 호출)가 자식 Text/Description 에 `fontSize: style.fontSize ?? 14`(Description 12)로 주입한다. label/description slot 자식은 텍스트 크기를 raw `style.fontSize` 이 아니라 **`props.size` 토큰**(3xl 등)으로 authoring 하므로, `style.fontSize` 만 읽으면 **14/12 로 clobber** 되어 자기 size 를 잃는다. leaf Text 높이 = fontSize×1.5 라 14 → 21 로 붕괴(padding 여백이 없는 0 에서 특히 가시).
  - **Why**: [Phase A slot 채널 fold](#) / [Phase B fills fold](#) 와 동형의 세 번째 사례 — 시각 스타일을 나르는 지점이 `props.style` 만 가정하면 Label/Text 의 size(`props.size`) 축을 놓친다. origin 은 실 자식 Text 노드라 layout child-sum 경로를 타는데, 그 자식 fontSize 가 이 injection 에서 clobber 됐다.
  - 수정: `injectCollectionItemFontStyles` 가 자식 `props.size` 를 `specSizeFontSize(type, size)`(catalog fontSize) 로 해소해 14/12 fallback 전에 사용 (explicit `style.fontSize` 우선, size 없으면 기존 14/12 BC). lineHeight 는 주입 불필요 — leaf Text 높이가 CSS line-height 1.5(fontSize×1.5, DOM 상속과 동일)를 따르므로 fontSize 만 size 로 채우면 size 비례 높이 산출.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
  - 검증: `collectionItemFontSizeImplicitStyles.test.ts` 4종(3xl→30 / label 3xl+desc 2xl 각자 해소 / no-size 14 BC / explicit fontSize 우선) 추가(111 PASS 회귀 0) · type-check PASS · **live(Chrome MCP, mobile, padding 0)**: origin ListBoxItem 계산 높이가 44(자식 20/20 붕괴) → **85**(label 45 / desc 36, size 비례)로 회복, DOM 인스턴스 label(line-height 45px)과 origin 일치 실증(`getSharedLayoutMap` probe)

## [origin ListBoxItem label/description 의 배경(fills) 편집이 인스턴스 행에 미전파 수정 — slot 채널 fills→backgroundColor fold] - 2026-07-21

### Bug Fixes

- **Components 페이지 origin ListBoxItem 의 label(또는 description)에 배경색을 줘도 인스턴스 행에 반영 안 됨 (Skia·DOM 양쪽)**:
  - 근본 원인: Text/Label slot 자식의 "배경"은 Style 패널이 raw `style.backgroundColor` 이 아니라 노드 **`fills` 배열**(`{type:"color", color:"#RRGGBBAA", enabled}`)로 authoring 한다 (origin 은 실 자식이라 scene builder 가 `fills → box.fillColor` 렌더). slot 전파 단일 채널 `resolveSlotComposition`(packages/shared slotRoles.ts)이 `props.style` 만 추출하고 **`fills` 축을 통째로 버려** 두 consumer(Skia `listbox_item` escape / DOM emit `SelectionRenderers` `slotStyleOf`)에 배경이 도달 못 함.
  - **Why**: [size 축 미전파 fix](#) 와 동형의 fills 판 — slot 채널이 "시각 스타일"을 나를 때 `props.style` 만 가정하면 Label/Text 의 size(`props.size`)·배경(`fills`) 같은 별도 축을 놓친다.
  - 수정 (단일 지점 — 채널 fold 로 Skia + DOM 동시 해소):
    - **채널**: `resolveSlotComposition` 이 slot 자식 `fills` 의 마지막 활성 color fill 을 `style.backgroundColor`(hex6, `fillsToBackgroundColor` 규약 = alpha drop)로 fold (explicit `style.backgroundColor` 우선). specs ← shared 경계상 builder 헬퍼 못 써 inline.
    - **Skia escape**: `listbox_item` 이 label/description slot backgroundColor 를 각 텍스트 line box 뒤 배경 밴드(roundRect)로 렌더 (텍스트보다 먼저 push).
    - **DOM**: `SelectionRenderers.slotStyleOf("label")` 가 이미 slot style 전체를 inline spread → 채널 fold 로 자동 parity.
  - 위치: `packages/shared/src/catalog/slotRoles.ts` · `packages/specs/src/renderers/skiaPrimitives.ts`(listbox_item)
  - 검증: slotRoles fills fold 5종(hex6 fold·topmost·enabled:false skip·explicit 우선·BC) + escape 밴드 3종(label-bg·description-bg·부재/transparent BC) 추가(45 PASS) · type-check PASS · **live(Chrome MCP, mobile)**: origin label 에 녹색 fill(#2CAB3F) → Home 인스턴스 3행 label DOM computed `rgb(44,171,63)` + Skia 캔버스 각 행 label 녹색 밴드 렌더 실증(description 은 배경 없음 = origin 일치)

## [ListBoxItem 인스턴스 행 높이가 label/description slot size 에 미반응 수정 — getLabelLineHeight 단일 소스 + slot font 반영] - 2026-07-21

### Bug Fixes

- **origin ListBoxItem 의 label/description size 를 키워도(예: label 3xl) 인스턴스 행 높이가 안 커져 텍스트가 겹침 (padding 0 일 때 standalone Text 는 size 에 맞춰 커지는데 collection 행은 안 커짐)**:
  - 두 원인 복합: **(A) line-height cap** — `resolveListBoxItemMetric` 과 Skia `listbox_item` escape 가 `fontSize → lineHeight` 를 `>16 → 28` 로 눌러 xl(20)/2xl(24)/3xl(30) 이상을 전부 28 로 고정(GridListItem escape 는 이미 `getLabelLineHeight` 사용, ListBoxItem 만 방치). **(B) 행 높이가 slot size 를 안 읽음** — projected 행 노드의 intrinsic 높이(`calculateContentHeight` listboxitem 분기)와 가상화 window(`resolveListBoxRowHeight`)가 ListBoxItem 자체 `style.fontSize`(없음→14)만 읽고 label/description slot 자식의 folded fontSize(3xl/2xl)를 무시.
  - **Why**: label/description 은 텍스트 크기를 `props.size` 토큰(→ `_slots` fold)으로 authoring 하는데 행 높이 resolver 가 그 축을 안 봤다. line-height cap 은 표준 사이즈(≤18)만 상정한 계단 매핑이라 2xl+ 를 눌렀다. origin 은 실 자식 노드라 layout child-sum 으로 정상 → instance projection 경로 한정 버그.
  - 수정 (Skia, **generic — border 아닌 size 축 전반**):
    - **line-height 단일 소스**: `resolveListBoxItemMetric.lineHeight` + escape 를 `getLabelLineHeight`(typography 룩업 + `ceil(fontSize*1.5)` fallback, standalone Text/Label = LABEL_SIZE_STYLE 동형)로 교체. 표준 사이즈(≤18)는 값 동일(BC), 2xl+ 만 size 비례로 커짐.
    - **slot font 반영**: `resolveListBoxItemRowHeight` 에 `descriptionLineHeight`(label≠description size 지원) 추가, `resolveListBoxItemRowHeightFromStyle` 에 slot font size 파라미터 추가, `calculateContentHeight` listboxitem 분기 + `resolveListBoxRowHeight` 가 `_slots` 에서 label/description fontSize 를 추출해 전달. escape 도 per-slot `entryLineHeight` 로 스택 배치.
  - 위치: `packages/specs/src/renderers/utils/collectionItemMetrics.ts` · `packages/specs/src/renderers/skiaPrimitives.ts`(listbox_item) · `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` · `apps/builder/src/builder/workspace/canvas/scene/collectionVirtualization.ts`
  - 검증: escape geometry 3종(label만 3xl→y22 / label 3xl+desc 2xl→y22·58 스택 / BC 14→y14) + virtualization 1종(3xl+2xl 행 높이 78) 추가(70 PASS) · type-check PASS · **live(Chrome MCP, mobile)**: Home data-bound 인스턴스 projected 행 계산 높이 = Aardvark/Cat(label 3xl+desc 2xl) **72** / New Item(label 3xl) **40** 로 size 반영 + y 0/74/148 겹침 0 실증(`getSharedLayoutMap` window-probe)

## [origin ListBoxItem style(border/box-shadow 등) 편집이 인스턴스 행에 미전파 수정 — 행-root responsive 해석 + Skia appearance 렌더] - 2026-07-21

### Bug Fixes

- **Components 페이지 origin ListBoxItem 의 style(border / box-shadow 등) 변경이 인스턴스 행에 반영 안 됨 (특히 mobile breakpoint 편집)**:
  - 두 gap 복합: **(A) 행-root 전파가 responsive 를 무시** — Skia `appendListBoxRowProjection` 의 `templateAnchorStyle` 이 origin/anchor/selected-origin 의 raw `props.style` 만 읽고 `responsive.styles` 를 활성 breakpoint 로 해석하지 않아, mobile breakpoint 에서 편집한 override(예: border 는 `responsive.styles.mobile` 로 저장)가 행에 도달 못 함. **(B) Skia escape 가 border/box-shadow 를 안 그림** — `listbox_item` 이 row-bg(background+radius)만 렌더하고 border stroke·box-shadow 를 아예 방출하지 않음.
  - **Why**: ADR-154 는 편집 write 만 breakpoint-aware 로 만들었고 origin 행-root 전파는 read-blind (owner style 은 fadd46ba2 에서 해석했으나 origin 행-root 는 누락 — 같은 write-aware/read-blind 비대칭). escape 는 background 특정 렌더라 appearance 패널의 border/shadow 미커버.
  - 수정 (Skia, **generic — border 특정이 아니라 style 전체**):
    - **행-root responsive 해석**: `appendListBoxRowProjection` 이 origin/anchor/selected-origin style 을 `resolveResponsiveStyleMap(..., activeBreakpoint)` 로 병합 → border 뿐 아니라 background/padding/radius/typography 등 **모든 style 속성**이 활성 breakpoint 로 함께 흐름.
    - **escape appearance 렌더 확장**: `listbox_item` 이 row style 에서 border(`type:"border"` stroke, borderStyle 부재 시 solid) + box-shadow(`parseShadow` → `type:"shadow"`) 를 row-bg target 으로 렌더. 배경 없어도 border/shadow target 위해 transparent row-bg 생성.
  - 검증: `skiaPrimitives.listBoxItemSlots.test.ts` 에 border/shadow 렌더 5종 추가(borderWidth>0→border shape·borderStyle 반영·BC·boxShadow 분해·border+bg 공존, 18 PASS) · type-check PASS · **live(Chrome MCP, mobile)**: origin ListBoxItem 에 mobile border(1px #E31414) 설정 → Home data-bound 인스턴스 각 행에 red border 렌더 실증(캔버스 zoom 확인)
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts` · `packages/specs/src/renderers/skiaPrimitives.ts`
  - 참고: Preview/Publish DOM 의 **responsive** origin style→인스턴스 행 반영은 @media(width 기반, `data-element-id` 타겟) 메커니즘이라 synthetic 행에 미도달 — 별도 후속. desktop base style 은 DOM 도 기존 inline(`rootStyleOf`) 경로로 반영됨.

## [origin ListBoxItem/Default label 텍스트 size 편집이 인스턴스 행/CSS 에 미전파 수정 — slot 구성 채널 size→fontSize fold] - 2026-07-21

### Bug Fixes

- **Components 페이지 origin ListBoxItem/Default 의 label(Text) 텍스트 size 변경이 해당 ListBox 를 사용한 인스턴스 행에도, Preview/CSS 에도 반영 안 됨**:
  - Label/Text slot 자식은 텍스트 크기를 raw `style.fontSize` 이 아니라 `props.size` 토큰(catalog `Text.sizes[size].fontSize` → typography 매핑)으로 authoring 한다. 그런데 origin slot 구성을 인스턴스 행으로 전파하는 채널 `resolveSlotComposition`(`packages/shared/src/catalog/slotRoles.ts`)이 **slot 자식의 `props.style` 만 추출**하고 `props.size` 는 버려, `_slots.slots.label.style.fontSize` 가 비어 두 consumer(Skia `listbox_item` escape / DOM emit `SelectionRenderers`)가 모두 기본 크기로 렌더했다.
  - **Why**: slot 구성 채널이 "시각 스타일"을 `props.style` 로만 정의한다고 가정했으나, Label/Text 의 크기 SSOT 는 `props.size`(size delegation)다. 채널이 size prop 을 무시하면 origin 크기 편집이 slot 구성 SSOT(ADR-148 Decision 3, "origin 스타일 변경 → instance 행 추종")에 도달하지 못한다.
  - 수정: `resolveSlotComposition` 이 slot 자식의 `props.size` 를 catalog `COMPONENT_RULES_TABLE[type].sizes[size].fontSize` → `resolveToken` 으로 **px 숫자**로 해소해 `config.style.fontSize` 로 fold(explicit `style.fontSize` 우선). px 숫자라 Skia(`resolveSpecFontSize` number 분기)·DOM(inline `fontSize:number`) 두 consumer 가 동일 소비 — TokenRef 를 실으면 DOM inline 이 무효 CSS. 타이포 토큰은 theme 무관이라 eager 해소 안전. 모든 경로(Skia projection `appendListBoxRowProjection` / DOM provider / SelectionRenderers fallback)가 이 함수 경유 → 단일 지점 수정으로 ListBox/GridList/Menu 공통 반영.
  - 검증: `slotRoles.test.ts` 에 size fold 계약 4종 추가(3xl→30 / explicit fontSize 우선 / size 없으면 미주입 / description slot 동일) · slot·origin 관련 33 PASS(slotRoles / skiaPrimitives listbox slots / gridlist·menu template origins) · type-check PASS(shared→specs `resolveToken` import, 신규 위반 0) · **live(Chrome MCP)**: origin label size:3xl 상태에서 Home data-bound 인스턴스 행 label — DOM preview `slot="label"` computed fontSize **30px** 측정 + Skia 캔버스 label 30px급 렌더(description 14px 대비) 실증
  - 위치: `packages/shared/src/catalog/slotRoles.ts`

## [reset 버튼/dirty 뱃지가 non-desktop responsive override 미감지 수정 — dirty/reset breakpoint-aware] - 2026-07-21

### Bug Fixes

- **mobile/tablet breakpoint 에서 설정한 responsive override 를 Style 패널 reset 버튼/"modify N" 뱃지가 감지 못 함** (override 가 있어도 reset 버튼 dim, 눌러도 해제 불가):
  - dirty 판정(`computeDirtyStyleProps`)과 reset write(`updateSelectedStyles`)가 모두 base(`props.style`)만 보는 breakpoint-blind 상태였다. ADR-154 편집은 non-desktop 에서 `element.responsive.styles.{bp}` 로 저장되므로, base 비교로는 override 를 영원히 감지 못 하고(reset 버튼 dim), reset 을 눌러도 base 를 건드려 오염시켰다(단수 `updateSelectedStyle` 만 responsive-aware 였고 reset 이 쓰는 복수 `updateSelectedStyles` 는 아니었음).
  - **Why**: ADR-154 write 측 중 단수 편집 경로만 breakpoint-aware 로 전환됐고, dirty/reset(감지 + 복수 write)은 뒤따르지 못한 비대칭. 앞선 표시 경로 수정과 같은 계열(write breakpoint-aware ↔ read/reset breakpoint-blind).
  - 수정 3-part:
    - `computeDirtyStyleProps` 에 non-desktop 분기 — 해당 breakpoint 에 **명시된** override(`responsive.styles[key][bp]`)만 모은 style map 에 기존 `resolveCurrentStyleValue`(gap→rowGap/columnGap 합성 재사용, count 정합) 를 적용. cascade 상속값은 제외(자기 tier 의 명시 override 만 dirty — reset 은 그 tier 의 override 만 clear).
    - `useHasDirtyStyles`/`useDirtyStyleProps` 가 `activeBreakpoint` 를 구독·전달(dep 포함) → breakpoint 전환 시 재판정.
    - `updateSelectedStyles`(복수)를 단수 `updateSelectedStyle` 와 대칭인 responsive-aware 로 전환 → reset 이 non-desktop 에서 `buildResponsiveStyleOverride` 로 해당 breakpoint override 를 "" 로 clear(단일 history entry, base 무변경). `resetStyles` 도 non-desktop 분기에서 override props 만 "" 로 reset.
  - override/dirty 판정은 여전히 raw `element.responsive` 기준(merged style 로 재판정하지 않음 — `feedback-merged-style-map-kills-override-detection`).
  - 검증: `useResetStyles.test.tsx` 에 non-desktop 계약 7종 추가(computeDirtyStyleProps mobile override 감지/desktop 무시/다른 tier 제외, useHasDirtyStyles mobile true·desktop false, reset 이 responsive clear·base 무변경) · styles+stores 644 PASS(사전 존재 3 실패 무관) · type-check PASS(신규 위반 0) · **live(Chrome MCP, mobile)**: clean 상태 reset 버튼 0개 → padding override 추가 시 reset 버튼 출현·활성(base 무 padding → 순수 responsive dirty) → 복수 `updateSelectedStyles("")` 로 responsive override clear·base 무변경 실증
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts` · `apps/builder/src/builder/stores/inspectorActions.ts`

## [비-desktop breakpoint 편집값이 Style 패널 재선택 시 미표시 수정 — 표시 경로 responsive resolve] - 2026-07-21

### Bug Fixes

- **mobile/tablet breakpoint 에서 Style 패널로 편집한 값(gap/padding/width 등)이 다른 요소 선택 후 재선택 시 사라짐** (편집 직후에는 보이나 재선택하면 base 값으로 되돌아 보임):
  - ADR-154 에서 편집 write 경로(`inspectorActions.updateSelectedStyle`)는 `activeBreakpoint !== "desktop"` 이면 `element.responsive.styles[breakpoint]` 로 저장하도록 breakpoint-aware 로 만들었으나, **Style 패널 표시 read 경로(`useElementStyleContext`)는 `element.props.style`(desktop base)만 읽고 `responsive.styles` 를 병합하지 않아** 재선택 시 편집값을 놓쳤다. 편집 직후에는 `PropertyUnitInput` 의 로컬 입력 state 가 값을 들고 있어 보이지만, 요소 전환 후 재선택하면 입력이 `value` prop(=base)으로 재초기화되어 값이 소실. gap 뿐 아니라 non-desktop 에서 편집한 **모든 style 필드**(Layout/Transform/Appearance/Typography 4 섹션)가 동일 증상.
  - **Why**: ADR-154 write 측은 breakpoint-aware 로 전환됐는데 Style 패널 read/표시 측이 breakpoint-blind 로 남은 비대칭. 패널은 `activeBreakpoint` 를 헤더 라벨 표시에만 쓰고 실제 값 resolve 엔 미사용이었다.
  - 수정: `useElementStyleContext` 가 `activeBreakpoint` 를 구독하고, 비-desktop + `element.responsive` 존재 시 canvas render 와 **동일한 `resolveResponsiveStyleMap` SSOT** 로 responsive override 를 base 에 merge 한 style 을 반환 → 6개 display 값 hook(useLayoutValues/useTransformValues/useAppearanceValues/useTypographyValues/useLayoutAuxiliary/useFillValues) 전체에 자동 반영. 패널 표시 ↔ 캔버스 렌더 대칭 확보.
  - override/dirty(reset 버튼) 판정은 raw `element`+`element.responsive` 를 읽는 별도 경로(`useResetStyles`)라 무영향 — merged style 로 override 존재를 재판정하지 않음(`feedback-merged-style-map-kills-override-detection`).
  - 검증: `useLayoutValues.test.tsx` 에 responsive 표시 계약 추가(mobile override 33→"33" 표시 / desktop 은 spec fallback, RED→GREEN) · `styleReadCanonical.static.test.ts` guard 를 blanket `useStore` ban → element-read 정밀 차단 + `state.activeBreakpoint` 허용으로 정정 · styles hooks + resolveResponsive 158 PASS · builder type-check PASS · **live(Chrome MCP, mobile)**: body gap:33 편집 → responsive.styles.mobile 저장(base 무전가) → 패널 Gap 입력 "33" 표시 → 다른 요소 선택 후 재선택 시 "33" 유지 실증(정확한 repro 재현·해소)
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useElementStyleContext.ts`
  - 참고: reset 버튼/dirty 뱃지의 non-desktop responsive override 감지는 별도 read 경로(base 기준)라 이번 수정 범위 밖 — 후속 판정 대상.

## [Laptop breakpoint 토글 제거 — 아트보드 preset 을 3-tier(desktop/tablet/mobile)로 정리] - 2026-07-21

### Bug Fixes

- **상단 breakpoint 토글의 Laptop 버튼이 별도 override tier 로 오인되게 함** (실제로는 desktop tier 로 resolve — `toResponsiveBreakpoint`):
  - ADR-154 스타일 override tier 는 `BreakpointName = desktop|tablet|mobile` 3개뿐이고, Laptop(1440) 은 아트보드 크기 preset 전용이라 편집 시 desktop tier 에 저장된다. 반면 Tablet 은 자기 tier 를 가져, "Tablet 은 개별인데 Laptop 은 왜 공유?" 라는 혼란을 유발했다.
  - 수정: `BuilderCore` 아트보드 preset 목록에서 `laptop` 제거(desktop/tablet/mobile 3개) + `BuilderHeader` 의 Laptop 아이콘 렌더/import 제거. 스타일 데이터 모델(`BreakpointName`/cascade/`responsiveCss`)은 laptop 을 애초에 tier 로 갖지 않아 무변경 — 마이그레이션 없음.
  - 구 localStorage 정합화: laptop 제거 이전 `builder-breakpoint="laptop"` 이 저장돼 있으면 무효 id 이므로 `VALID_BREAKPOINT_IDS` 가드로 desktop 복원(토글에 없는 key 선택 방지).
  - 검증: builder type-check PASS · live(Chrome MCP): 토글 = Desktop/Tablet/Mobile 3개(Laptop 부재), 구 `laptop` localStorage 리로드 시 Desktop selected 로 정합화 실증
  - 위치: `apps/builder/src/builder/main/BuilderCore.tsx` · `BuilderHeader.tsx`
  - 참고: tablet tier 유지(3-tier). desktop/mobile 2-tier 수렴은 tablet override 실사용 빈도 확인 후 별도 결정(ADR-154 개정 대상).

## [Skia collection projection 이 mobile/tablet responsive gap/padding 미반영 수정 — scene 에 activeBreakpoint 주입] - 2026-07-21

### Bug Fixes

- **mobile/tablet breakpoint 에서 ListBox 컨테이너에 설정한 `gap`/`padding` 이 Skia(빌더 캔버스)에만 미반영** (Preview 는 `@media` 로 반영 → D3 Skia↔DOM 비대칭):
  - Skia layout/render 경로(`useLayoutPublisher`/`StoreRenderBridge`)는 `resolveResponsiveLayoutNode` 로 responsive override 를 activeBreakpoint 기준 반영하지만, **scene collection projection(`canvasSceneNode` — projected row 간 gap/padding)은 owner 의 raw(desktop) `props.style` 만 읽어** mobile/tablet 편집(=`element.responsive.styles` 저장)을 놓쳤다. 컨테이너 box height/min-height 는 layout 경로라 맞고 **행 간 gap 만** 어긋나는 부분 증상.
  - **Why**: `buildCanonicalSceneModel` useMemo 가 activeBreakpoint 를 dep 으로 물지 않아 breakpoint 전환 시 scene 재빌드 자체가 안 됐고, projection 도 responsive resolve 진입점이 없었다.
  - 수정: (1) `resolveResponsive.ts` 의 style-merge 를 `resolveResponsiveStyleMap` 헬퍼로 추출(layout node ↔ scene projection 동일 merge SSOT) (2) `BuildCanvasSceneGraphOptions`/`BuildCanonicalSceneModelOptions` 에 `activeBreakpoint` 주입 → ListBox projection 의 owner style 을 breakpoint 로 resolve (3) `BuilderCanvas` scene useMemo 가 store `activeBreakpoint` 를 구독·dep 에 포함 → breakpoint 전환 시 scene 재빌드.
  - 검증: `canvasSceneNode.test.ts` 에 responsive rowGap 계약 추가(mobile override 12 → rowsGroup rowGap 반영, desktop 은 catalog 기본값) · scene/resolveResponsive/collectionVirtualization 90 PASS · builder type-check PASS · (live wiring 은 사용자 확인 대기 — 대상 프로젝트 in-memory 편집 비영속으로 자동 측정 제약)
  - 범위: 이번 수정은 **ListBox** 한정. GridList/Table projection 도 동일 raw-style 패턴 — 후속 sweep 대상.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/resolveResponsive.ts` · `scene/canvasSceneNode.ts` · `scene/canonicalSceneModel.ts` · `BuilderCanvas.tsx`

## [ListBox 컨테이너 responsive override 가 ListBoxItem 으로 전가 수정 — items[] 행 data-element-id 격리] - 2026-07-21

### Bug Fixes

- **비-desktop breakpoint(mobile/tablet)에서 ListBox 컨테이너에 설정한 `min-height`/`gap` 등이 Preview 에서 각 ListBoxItem(자식 행)에도 전가됨**:
  - ADR-154 responsive override 는 `buildResponsiveElementCss` 가 `@media { [data-element-id="{owner}"] { prop: value !important } }` 로 emit 한다. `items[]`(Path 2) 행이 owner ListBox 의 `element.id` 를 `data-element-id` 로 물려받고 있어, 컨테이너용 responsive 규칙이 모든 행에도 매치되어 min-height/row-gap/column-gap 이 행으로 새어나갔다 (mobile 뷰포트에서 행 min-height:200/gap:10 실측).
  - **Why**: `renderListBoxLeaf` 가 2026-04-21 부터 행에 `data-element-id={element.id}`(owner)를 부여 — `data-element-id` 는 canonical element 1개를 고유 식별해야 하는데 행이 컨테이너 id 를 공유해 per-element `@media` 규칙과 충돌. (Path 1 템플릿 행은 `template.id` 를 써 owner 와 충돌하지 않아 무증상)
  - 수정: `renderListBoxLeaf`(items[] 경로)에서 행의 `data-element-id={element.id}` 제거. 클릭→선택 매핑은 preview 의 `closest([data-element-id])` 가 상위 ListBox 루트(owner)를 찾아 보존.
  - 검증: `listBoxAdr146Template.test.tsx` 에 Path 2 행 owner-id 격리 계약 추가(RED→GREEN) · shared renderers 68 PASS · type-check PASS · live(Chrome MCP, mobile 390px): 행 min-height 200→20px·row-gap 10→2px(기본값 복귀), 컨테이너는 min-height:200/gap:10 responsive override 유지
  - 위치: `packages/shared/src/renderers/SelectionRenderers.tsx`

## [Compare 모드 줌 fit/축소 시 캔버스 전체 소실 수정 — viewport containerSize 좌표계] - 2026-07-20

### Bug Fixes

- **compare(미리보기 분할) 모드에서 화면에 맞추기/화면 채우기/축소 직후 Skia 캔버스 콘텐츠 전체가 사라짐** (dot 배경만 남고, 이후 어떤 줌/pan 으로도 회복 불가 — reload 로만 복구):
  - viewport store 의 `containerSize` 를 workspace 전체 요소(좌측 preview pane 포함)로 측정하는데, `zoomToFit`/`zoomToFill`(ZoomControls·⌘0)과 `zoomViewportAtContainerCenter`(확대/축소/100%/200%)는 이 값을 보정 없이 사용 — pan 이 좌측 preview pane 폭만큼 오른쪽으로 밀려 콘텐츠가 우측 인스펙터 패널 아래로 이동했다. 렌더 파이프라인은 매 프레임 정상(command stream 310개 방출 실측)이라 "전체 미렌더" 로 오인되는 증상.
  - **Why**: 초기 배치(`centerCanvas`)만 `compareSplit` 로 수동 보정하고 있었고, 나머지 줌 경로는 좌표계가 갈라진 `containerSize` 를 그대로 소비했다. compare 좌표계 분리는 측정 시점에 한 번만 해소되어야 할 문제.
  - 수정: `useWorkspaceCanvasSizing` 의 ResizeObserver 측정 대상을 workspace 전체 → **Skia canvas 가 실제 차지하는 우측 pane(`canvasAreaRef`)** 으로 교체. `effectiveWidth` 수동 보정 제거 — fit/fill/줌 중심·`panToPage`·`buildVisiblePageSet`·workflow minimap 등 `containerSize` 전 소비자가 자동 정합. compare 토글 시 DOM 교체를 재관측하도록 effect deps 에 `compareMode` 추가.
  - 검증: live(Chrome MCP) — fit(94%) 후 pan 이 canvas 영역 기준 정확 중앙(검산 376.2 = 실측 376.17), 축소(84%) 중심 유지, 콘텐츠 소실 재현 소멸 · `useWorkspaceCanvasSizing.static.test.ts` 5 케이스(보정 재도입 차단 가드) · type-check PASS(Cached 0)
  - 위치: `apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.ts` · `Workspace.tsx` · `components/WorkspaceCompareMode.tsx`
  - 부수 판정: "panel 추가 직후 instance 미렌더" 관찰은 코드 결함이 아니라 **Chrome MCP hidden 탭의 rAF pause 관찰 아티팩트**로 확정 (visible 탭에서 즉시 렌더 실증 — 연속 rAF 루프 구조상 store 파생이 옳으면 다음 프레임에 반영됨)

## [ListBox Selected variant slot 배선 — selected 행 origin 스타일 소비] - 2026-07-20

### Bug Fixes

- **ListBox slot 등록의 `ListBoxItem/Selected` variant 가 죽은 등록** (Skia/Preview 공통):
  - ListBox origin 의 `slot: [Default, Selected]` 중 Selected 는 렌더 소비처가 0 — selected 행 배경이 catalog token(accent-subtle) 하드결선이라 사용자가 Selected origin 스타일/배경을 편집해도 어디에도 반영되지 않았다.
  - 추가로 Skia 쪽은 projection 이 `_isSelected` 만 주입하고 `listbox_item` escape 는 `props.isSelected` 를 읽어 **selected row-bg/체크마크 자체가 죽은 분기**였고, seed 의 `var(--color-accent-subtle)` 는 정의부 0건인 죽은 변수였다.
  - **Why**: ADR-146 의 slot variant 모델(Selected origin)이 등록만 되고 소비 배선이 한 번도 구현되지 않았다 (사용자 재기: "전혀 연계성이 없이 등록만되어있다").
  - 수정 (Skia+DOM 대칭, catalog fill=base / origin=override 층):
    - projection: selected 행 해석 resolver(`resolveListBoxSelectedOriginId` — slot 의 `metadata.variant==="selected"` → slot[1] → 상수) + Selected origin `props.style` overlay + **canonical `fills` 채널 운반**(Style 패널 Background 는 fills 에 기록됨 — buildSpecNodeData fills→hex6 변환 재사용) + `isSelected` 보편 축 주입
    - escape(`listbox_item`): row-bg fill 을 `style.backgroundColor(override) → catalog selected fill → 투명` 우선순위로 통일, Default origin 배경도 행에 렌더
    - Preview DOM: `RenderContext.listBoxRowTemplateStyles`(base+selected) 주입 + RAC render-prop style 로 `data-selected` 행에 overlay
    - `resolveColor`: `var(--xxx)` 시맨틱 변수 문자열을 토큰 역변환 해석 (Skia 검정(0x000000) 붕괴 방지, dark theme 정합)
    - seed/repair: `var(--color-accent-subtle)` → `var(--accent-subtle)` 정정 (구 seed 리터럴 한정 교체)
  - 검증: canvasSceneNode 32 + listbox_item escape 21 + tokenResolver 14 + shared renderers 67 PASS · live(Chrome MCP): Preview 에서 Cat 행 선택 시 Selected origin 배경(#ff3366) inline 반영 + persist(selectedKey) 초기 렌더 확인, Skia 는 Selected origin fills 렌더 실증
  - 위치: `canvasSceneNode.ts` · `skiaPrimitives.ts` · `tokenResolver.ts` · `SelectionRenderers.tsx` · `preview/App.tsx` · `renderer.types.ts` · `listBoxTemplateOrigins.ts`

## [Reusable instance 편집 계약 복원 — ref fallback] - 2026-07-20

### Bug Fixes

- **일반 페이지의 ListBox instance 에서 리스트(items) 편집 불가** (Properties 패널 편집 계약 공백):
  - 팔레트로 추가한 ListBox 는 Components 페이지 origin 을 참조하는 `type:"ref"` instance 로 생성되는데, 편집 계약 resolve 가 (A′) catalog reusable 미등록 + `propsSchema` 미선언, (A) `getCatalogEntry("ref")` 부재로 **양쪽 모두 탈락** → 패널이 "편집 계약이 비어 있습니다" EmptyState 만 표시. items 추가/삭제·Variant·Size·Selection Mode 편집이 instance 에서 전부 불가능했다 (origin 에서만 가능).
  - **Why**: ADR-146 이 instance 를 bare ref 로 전환할 때 Inspector 편집 계약이 ref 노드의 raw type("ref") 기준으로만 resolve 되어, origin type(ListBox)의 primitive 계약(items-manager 포함)으로 이어지는 경로가 없었다.
  - 수정: `resolveEditContract` 에 (A″) fallback — 비-registry ref instance 는 origin 문서 노드의 type 이 primitive catalog entry 를 가지면 그 `accepts` 로 계약을 파생 (base = origin props, write = instance root props override). registry reusable(Toolbar/Form — propsSchema 의도적 미선언)은 ADR-148 Phase 2 결정대로 제외.
  - 적용 범위: ListBox 뿐 아니라 GridList/Menu 등 template-origin ref instance 전반 + 사용자 생성 컴포넌트 instance (origin root type 이 primitive 인 경우).
  - 위치: `packages/shared/src/catalog/resolvers/resolveEditContract.ts` (+ `resolveEditContract.test.ts` 4 케이스)

## [Builder Skia 상호작용 상태 시각(hover/pressed/focus) 철회 — ADR-150 Phase A1 재판정] - 2026-07-20

### Architecture

- **Builder Skia 캔버스의 pointer 연동 hover/pressed/focus 상태 시각 철회** (ADR-150 Phase A1 재판정, revert `5e635ebbc`):
  - 2026-07-19 도입했던 "Builder 캔버스(Skia)가 hover 시 hover fill / pointerdown 시 pressed fill / keyboard focus 시 focus ring 을 실시간 표시"를 **전량 철회**. 되돌린 커밋 4건: `d2b7a1b2f`(hover) · `99947f241`(pressed) · `e98ab8887`+`433ba3a6c`(focus ring).
  - **Why**: Skia 화면은 **빌더(화면 정의·구성 surface, Pencil app 동형)이지 프론트엔드가 아니다.** hover/pressed/focus 를 pointer 이동에 연동해 실시간 재현하는 것은 **Preview(CSS/DOM)의 역할**(D1 — RAC 가 `:hover`/`data-*` 를 자동 소유)이며, 빌더가 이를 시뮬레이션한 A1 은 D1(DOM/접근성)을 D3(시각) 소비 경로로 끌어온 **경계 오판**이었다. 빌더가 표시할 상태는 노드가 선언적으로 나타내는 state variant(selected/disabled)이지, 마우스 hover 재현이 아니다.
  - **보존** (철회 대상 아님): 편집 보조 hover **outline**(`buildHoverHighlightTargets` — A1 이전부터 존재하는 선택/편집 보조) + 선언적 상태 시각(`racStateAttrs` disabled 분기 + catalog `FillStateTokens`) + ADR-154 render-visual(독립 영역).
  - 제거된 파일: `hoverStateOverlay.ts`(+test) · `useElementPressInteraction.ts` · `useFocusVisibleModality.ts`. 수정 원복: `StoreRenderBridge.ts`(buildInteractionStateNode) · `buildSpecNodeData.ts`(racStateInput·focus ring) · `SkiaCanvas.tsx` · `skiaFramePlan.ts` · `skiaOverlayBuilder.ts`.
  - 검증: type-check PASS(baseline 63 유지) · overlay 테스트 16 pass · 삭제 심볼 dangling 참조 0.
  - 문서 재판정: ADR-150 A1 Implemented→철회(Status 진행 로그·Context·R1·G-A1·HC#3) · ADR-911 R-4 HIGH→MED / G-state 를 **선언적 상태(selected/disabled) parity** 로 재정의. ADR-150 A2(가상화)/A3(drill-in)은 상호작용 시뮬레이션이 아니라 빌더의 대용량 표시·깊은 편집이라 유효 — 유지.

## [Skia Image 대체텍스트 placeholder 크래시 수정] - 2026-07-20

### Bug Fixes

- **Image 대체텍스트(alt) placeholder 렌더 크래시** (Skia):
  - 로드되지 않은(broken/loading src) Image 요소가 `altText` 를 가지면 `renderImage` 의 placeholder 경로가 `new ck.ParagraphStyle({ textAlign, maxLines, ellipsis })` 를 **`textStyle` 없이** 생성 → CanvasKit 생성자가 `textStyle.color` 접근에서 `Cannot read properties of undefined (reading 'color')` 크래시. 매 프레임 재시도로 Skia overlay 렌더가 크래시 루프(콘솔 flood).
  - **Why**: CanvasKit `ParagraphStyle` 생성자는 default `textStyle` 을 요구한다 (정상 사용처 `nodeRendererText.ts:366` 은 `textStyle` 명시). placeholder 경로만 누락 — unloaded image + altText 조합이 실제 렌더될 때만 발현되는 잠복 버그(collection 가상화 작업과 무관, 렌더 경로 dispatch 는 `node.type==="image"` 한정).
  - 수정: `textStyle`(color/fontSize/fontFamilies — 아래 pushStyle 과 동일 값) 명시 주입.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/nodeRendererImage.ts`

## [반응형 Breakpoint 저작 배선 — ADR-154 (Phase 1~3)] - 2026-07-19

### Features

- **viewport 별 반응형 스타일 저작** (ADR-154, desktop/tablet/mobile 3-breakpoint desktop-first cascade):
  - 기존 BuilderHeader breakpoint 스위처를 `activeBreakpoint` SSOT 로 재사용 — tablet/mobile 선택 시 스타일 편집이 base(desktop)가 아닌 **override**로 저장 (`element.responsive.styles.{prop}.{tablet|mobile}`), desktop 은 기존 `props.style`(base) 그대로 (BC 0)
  - **Builder(Skia)**: `resolveResponsiveLayoutNode` 가 `activeBreakpoint` 기준으로 override 를 merge — tablet 에서 flexDirection override 편집 시 캔버스 자식 배치 즉시 전환(row↔column), width override 시 레이아웃 폭 반영
  - **Preview / Publish(DOM)**: 요소별 `@media` CSS 출력 — tablet/mobile override 만 `[data-element-id]` selector 로 emit, iframe/뷰포트 리사이즈 시 breakpoint 동작
  - 위치: `packages/shared/src/utils/responsiveCss.ts`(신규 SSOT) · `apps/builder/src/builder/workspace/canvas/layout/resolveResponsive.ts` · `apps/builder/src/preview/App.tsx` · `packages/shared/src/utils/export.utils.ts`
- **canonical schema `CanonicalNode.responsive`** (ADR-154 Phase 1): optional 필드 + `responsive.types.ts` shared 이동 + .pen import/export roundtrip 보존. responsive 부재 문서 로드 무영향.
- **Inspector 반응형 저작 UI** (ADR-154 Phase 2 후속, 2026-07-19):
  - 스타일 패널 헤더에 항상-표시 **breakpoint 배지** (현재 편집 대상: Desktop=base 중립 / Tablet·Mobile=override 강조) + **Responsive 섹션** — 활성 breakpoint 에서 override 된 필드를 chip 목록으로 표시(어느 필드가 override 인지), 각 chip ✕ 로 해당 override 제거
  - **Visibility 편집기 배선**: 그동안 참조 0건 orphan 이던 `ResponsiveVisibilityEditor` 를 PropertySection 으로 배선 — desktop 은 base(lock, Display 속성으로 제어), tablet/mobile 만 `responsive.visibility` override(→ `@media display:none`). 신규 store 액션 `updateSelectedResponsiveVisibility(bp, visible)`(tablet/mobile 만, 기본값 표시는 override 키 제거)
  - override 존재 판정은 raw `element.responsive` 를 읽는 `useResponsiveOverrides` 훅 (병합 map 재판정 회피 — feedback-merged-style-map-kills-override-detection)
  - **비-desktop live preview**: `updateSelectedStylePreview` 가 tablet/mobile 에서 early-return 대신 `buildResponsiveStyleOverride`(commit 과 동일 helper)로 responsive override 를 elementsMap 에 반영 → 슬라이더 드래그/입력 타이핑 중 캔버스 즉시 반영(desktop preview 와 동일 구조, base 무변경). live(Chrome MCP): mobile mid-drag width preview → 카드 layout 폭 390→50 즉시 + Skia 축소, commit 전
  - live 검증(Chrome MCP, project 000 Card): Tablet↔Mobile 배지/섹션 전환 + "Width" override chip 노출·✕clear + Mobile visibility hidden(eye-off) 반영 + desktop base(width 100%) 격리 확인. 패널 Activity(ADR-155) 가시 시에만 live 갱신
  - 위치: `apps/builder/src/builder/panels/styles/StylesPanel.tsx` · `sections/ResponsiveSection.tsx`(신규) · `hooks/useResponsiveOverrides.ts`(신규) · `panels/properties/editors/ResponsiveVisibilityEditor.tsx`(lockedBreakpoints) · `stores/inspectorActions.ts` · `panelNode.ts`(responsive 타입 노출)

### Architecture

- **3경로(Skia/Preview/Publish) resolve 단일 진입점** (ADR-154, R2):
  - Builder(Skia) `resolveResponsiveLayoutNode` 와 DOM(@media) `responsiveCss.ts` 가 **동일** `getResponsiveValueWithCascade` 로 breakpoint 값 pre-resolve → 발산 0. `BREAKPOINTS` 상호배타 범위라 mobile 이 tablet 을 cascade 상속 못 하는 문제는 각 breakpoint 를 cascade pre-resolve 하여 해당 `@media` 에 직접 삽입해 해소.
  - **Why (R6 — inline specificity)**: Preview/Publish 는 스타일을 inline(`style=`)으로 적용해 일반 stylesheet 규칙이 inline 을 못 이긴다. stylesheet `!important`(important-author 버킷)가 non-important inline(normal-author 버킷)을 origin/importance 단계에서 이기는 CSS cascade 규칙을 이용 — override `@media` 만 `!important` 로 emit 하고 base inline 은 무변경(desktop BC 0, inline strip 불필요).
  - live 검증(Chrome MCP): Preview/Publish 리사이즈 3-breakpoint(desktop 200/tablet 200/mobile 80px) + Skia layout width == DOM computed width(80==80px) 동시 대칭 + persist roundtrip.
  - **render-visual props 대칭 (2026-07-19 후속 fix)**: `fontSize`/`textAlign`(2/14) Skia glyph 를 `StoreRenderBridge.buildNodeForElement`(렌더 단일 choke point)에서 layout 과 동일 `resolveResponsiveLayoutNode` 적용 → glyph 가 activeBreakpoint override 값 렌더. layout(12/14)+render-visual(2/14) = 14/14 Skia↔DOM 대칭 완성. 위치: `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` + `useSkiaNode.ts`(`__composition_SKIA_DEBUG__` render-side parity probe 신규).
  - **apps/publish 리액트 SSG @media (2026-07-19 후속)**: `PageRenderer` 가 `collectResponsiveCssFromElements`(shared, flat `Element[]` 대응 신규)로 `@media <style>` emit + `deriveProjectRenderModelFromDocument` 가 canonical `responsive` 를 runtime `Element` 로 전달(shared `Element.responsive?` 필드 추가). `ElementRenderer` 는 이미 `data-element-id` 부여 → base inline + override `@media` 분리. `generateStaticHtml`·preview 와 동일 `buildResponsiveElementCss` SSOT. live(Chrome MCP, publish dev + sessionStorage payload): tablet `display:none` / mobile `width:50px`+`display:none`(cascade). 이로써 publish 3경로(generateStaticHtml/preview iframe/리액트 SSG) + Skia/render-visual 전 축 완결 — **ADR-154 잔여 없음**.

## [EventsPanel 2-depth 재설계 + canonical events primary 편집 — ADR-149 (Wave 1)] - 2026-07-19

### Features

- **EventsPanel 2-depth UX 전면 재작성** (ADR-149 Wave 1, Phase 2b):
  - 기존 878 LOC block editor 트리(WhenBlock/IfBlock/ThenElseBlock + action-picker/action-editor overlay, depth 3~4)를 **2-depth inline UX**로 대체 (HC1: depth ≤ 2, overlay 0)
  - **L1** = 컴포넌트 supportedEvents callback props 목록 — 각 이벤트를 바인딩 상태(미설정/N 액션)와 함께 행으로 표시. 빈 상태에서 추천 이벤트 chips + 템플릿 chips
  - **L2** = 행 클릭 시 inline accordion — 액션 목록 + inline 액션 config 에디터(25종 ActionEditor 재사용) + 추천 액션 chips + 설정 누락 경고 + 고급(조건/debounce·throttle) + 이벤트 제거
  - 위치: `apps/builder/src/builder/panels/events/EventsPanel.tsx`(878→~330 LOC) + `components/EventAccordionItem.tsx`(신규)

### Architecture

- **canonical events/actions primary 편집** (ADR-149 Phase 2a/2c):
  - EventsPanel 이 canonical root collection(`document.events`/`document.actions`)에 쓰는 **단일 write 진입점 `updateEventsRootCollection`** 확정 — `updateAndSave`(node projection + history + persist) + `writeEventsToRootCollection`(canonical root 파생, `stores/canonical/rootCollectionEventsWrite.ts`)
  - dead selected-\* events mutation 4종 + `syncEventsToRootCollection` delegate 제거
  - **Why**: 편집 SSOT 를 canonical 문서로 이동 (ADR-131 root collection 소비). 과도기 props.events 는 history/persist/런타임 매개로 유지
- **역방향 adapter `migrateRootCollectionToLegacy`** (ADR-149 Phase 3-a, HC5):
  - canonical root(`SerializedEvent[]`+`SerializedAction[]`) → legacy `EventHandler[]` 복원 (actionRef chain 순회 + fallbackActionRef→elseActions + condition {expr}→string + fidelity slot). forward fidelity 보강(enabled/debounce/throttle/delay) 으로 round-trip 동등성 확보
  - 위치: `apps/builder/src/adapters/canonical/rootCollectionMigration.ts`
- **ActionsPanel 제거 + dead EventHandlerFactory 은퇴** (ADR-149 Phase 2c/3-b):
  - ADR-131 Phase 5 G3 raw skeleton ActionsPanel + PanelId `"actions"` 제거(HC4). dead `EventHandlerFactory`(`utils/events/eventHandlers.ts`) 삭제 — import 소비처 0
  - **Why (Option A 재정의)**: Phase 3 recon 에서 원 전제(런타임이 canonical 소비하도록 EventHandlerFactory 전환)가 거짓 판명 — 패널 이벤트를 올바로 소비하는 런타임 0개(Preview 미동작 + publish `element.events` mismatch). 실제 런타임 동작 bridge + Wave 2 convention + true 방향 역전 + cross-event reuse 는 **별도 ADR 이관**(사용자 confirm)

## [Builder Skia 상호작용 상태 시각(hover/pressed/focus) — ADR-150 Phase A1] - 2026-07-19

> **⚠️ 철회됨 (2026-07-20 재판정)** — 아래 A1 도입 기록은 이력으로 보존한다. 빌더가 pointer 연동 hover/pressed/focus 를 실시간 표시하는 것은 D1/D3 경계 오판이라 전량 revert 됐다. 실제 상태는 최상단 [철회 엔트리(2026-07-20)](#builder-skia-상호작용-상태-시각hoverpressedfocus-철회--adr-150-phase-a1-재판정---2026-07-20) 참조.

### Features

- **Builder Skia 캔버스 hover/pressed/focus 상태 시각화** (ADR-150 Phase A1):
  - Builder 캔버스(Skia)가 요소 hover 시 hover fill, pointerdown 유지 시 pressed fill, keyboard focus(Tab 등) 시 focus ring 을 Preview DOM(RAC `data-hovered`/`data-pressed`/`data-focus-visible`)과 동일 규칙으로 표시. 그동안 disabled 만 시각화되고 hover/pressed/focus 는 threading 부재로 미표시였음
  - **Why**: catalog `FillStateTokens`(ADR-908)에 hover/pressed 색이 이미 존재했으나 "어느 노드가 어느 상태인가"를 잇는 threading + 상태 변화를 그리기에 도달시키는 무효화 채널이 없어 Skia 화면이 상태에 반응하지 못했음 (912 잔여 3종)
  - focus ring 색은 theme accent(`var(--accent)`, tint 파생)로 해소 → dark mode/커스텀 tint 대응 + DOM `--focus-ring`(2px/offset2) 대칭
  - focus 소스 = keyboard modality ∩ 선택 요소 (빌더 캔버스는 요소별 keyboard focus 부재 — RAC `useFocusVisible` 축소판 modality 추적)
  - 위치: `hoverStateOverlay.ts` / `useElementPressInteraction.ts` / `useFocusVisibleModality.ts` (신규), `buildSpecNodeData.ts`(focus ring), `SkiaCanvas.tsx`(배선)

### Architecture

- **상태 전용 overlay 무효화 채널** (ADR-150 Phase A1):
  - hover/pressed/focus 대상 노드만 상태 fill/ring 으로 재빌드해 overlay draw pass 에 덮어 그림 — command stream(default shape) 및 scene 무변경(scene rebuild 0)
  - **Why**: `sceneVersion` signature 에 상호작용 상태를 넣으면 매 pointermove 가 scene rebuild 를 유발(ADR-135/136 Render-Space Boundary 위반). 상태는 기존 `overlayVersion` 채널로만 반영해 signature 불변 유지
  - 위치: `SkiaCanvas.tsx`, `skiaFramePlan.ts`, `skiaOverlayBuilder.ts`

## [명시 높이 grid 자식이 Builder(Skia)에서 셀 높이로 늘어나던 결함 — ADR-156 §Residual 옵션 3-a 세로축] - 2026-07-18

### Bug Fixes

- **명시 height grid 자식이 stretch 로 셀 높이로 늘어나던 결함** (ADR-156 §Residual, 옵션 3-a 세로축):
  - `align-self:stretch`(기본)인 grid 자식이 **명시 height**(예: `height:40px`)를 가져도 Builder 레이아웃 엔진이 이를 무시하고 셀/행 높이로 stretch → Preview(DOM/CSS)와 발산. CSS 는 definite height 가 stretch 를 이겨 그 높이를 유지 + top 정렬한다.
  - **Why**: `tree.rs::solve_grid` 의 stretch 분기가 자식 explicit height 를 확인하지 않고 셀 높이 `h` 로 채웠음. `align-self:stretch` 는 자식 height 가 `auto` 일 때만 셀을 채워야 함(definite 는 유지).
  - 수정: `resolve_self_size` 로 자식 explicit height 감지 → `align==stretch && explicit height` 이면 `start(top)` 정렬 코드로 승격해 explicit height 유지. auto-height 자식은 stretch 로 셀 채움(무회귀).
  - **CSS-incorrect 단언 정정**: 기존 cargo 테스트 2개(`grid_implicit_auto_row_multi_row_max_height`·`grid_mixed_px_and_auto_rows_preserve_px`)가 짧은 명시-height 자식을 셀로 stretch 한다고 단언 → Chrome ground truth(harness `domLeg`: c0 h=30/h=40/h=20)로 반증 후 정정. row 높이(max intrinsic) 자체는 무변경.
  - 라이브 확증: builder grid(200×100) + 자식(height:40) → Skia layout map 자식 `{y:0, h:40}`(셀 100 으로 stretch 안 함). ProgressBar/Meter/Slider 는 explicit height == 셀 → 무회귀.
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` 세로 배치 분기), `apps/builder/tests/parity/phase3a-align.browser.test.ts`
  - 잔여: 수평 mirror(justify:stretch 하 explicit-**width** 자식) 는 §Residual(미착수 — grid 에서 드묾).

## [Grid justify-items/justify-self 가로 배치가 Builder(Skia)에서 무시되던 결함 — ADR-156 §Residual 옵션 3-a] - 2026-07-18

### Bug Fixes

- **Grid 자식 justify-items/justify-self(가로) 미반영** (ADR-156 §Residual E2, 옵션 3-a):
  - grid 컨테이너의 `justify-items` 또는 자식 `justify-self`(start/center/end)가 Builder 레이아웃 엔진에서 무시돼, 명시 폭(예: `width:40px`) grid 자식이 항상 셀 폭으로 stretch 되고 가로 정렬이 적용 안 됨 → Preview(DOM/CSS)와 발산.
  - **Why**: `grid.rs` 셀 커널은 셀 bounds 만 반환하고, `tree.rs::solve_grid` 의 per-child 마감이 세로(align)만 자식 실크기로 재배치하고 가로(justify)는 항상 stretch 였음(옵션 3-b 계약).
  - 수정: `tree.rs::solve_grid` 에 `grid_inline_justify`(=`grid_block_align` 가로 대칭) + `parse_justify_items` 배선 — justify≠stretch 이고 자식이 실제 width(cw>0)를 가지면 셀 안 start/center/end 배치 + 폭 respect. auto-width 자식(cw=0)은 stretch 유지.
  - **JS DFS 제거 불요 확증**: §Residual 은 "JS DFS 가 폭을 트랙 폭으로 강제 → JS DFS 제거로만 해소" 라 했으나, 신설 2-layer 파리티 하니스(`pipelineLeg`)로 explicit-width 자식은 JS DFS 무해(Layer 1 === Layer 2)를 실측 → 엔진 단독 수정으로 양 레이어 정합.
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid`/`grid_inline_justify`/`parse_justify_items`), `apps/builder/tests/parity/phase3a.browser.test.ts`
  - 잔여: intrinsic(shrink-to-fit) 폭 justify + align 세로축 explicit-height respect 는 §Residual(별도 착수).

## [preview 가 background 탭에서 편집을 반영하지 않던 결함 — ADR-151 잔여 ②] - 2026-07-18

### Bug Fixes

- **background(hidden) 탭에서 요소 편집이 Preview 에 reload 전까지 미반영되던 결함** (ADR-151 잔여 ②):
  - Preview 로의 canonical 문서 재송신(`UPDATE_CANONICAL_DOCUMENT`)이 `requestAnimationFrame`(`scheduleNextFrame`)으로 예약돼 있었는데, rAF 는 background 탭에서 동작하지 않아 재송신이 정체 → 편집이 reload(PREVIEW_READY 초기 송신) 전까지 Preview DOM 에 반영되지 않았다
  - **Why**: focused 실사용자는 무영향(rAF 정상 동작)이나, Preview 를 hidden 탭에서 읽는 CSS↔Skia parity 자동화(ADR-151/156 sweep)가 이 정체로 "prop 편집 stale" 을 관측 — 매 편집마다 reload 강제. layouts/pages 송신은 동기인데 canonical 송신만 rAF 였던 비대칭이 근본 원인
  - 수정: visible→`requestAnimationFrame` / hidden→`setTimeout` 하이브리드 스케줄러 `scheduleFrameOrTimeout` 도입 + canonical 재송신 effect 배선 (focused 탭 hot path 무변경)
  - 라이브 확증: hidden 탭에서 prop 편집 → `UPDATE_CANONICAL_DOCUMENT` 송신 + Preview DOM 반영 (reload 불필요). 회귀 가드: `scheduleTask.test.ts`(5) + canonical effect source-guard
  - 위치: `apps/builder/src/builder/utils/scheduleTask.ts`, `apps/builder/src/builder/hooks/useIframeMessenger.ts`

## [composition-engine CSS 정합 복구 완결 — ADR-156 Implemented (Phase 6 R7 정적 가드)] - 2026-07-18

### Architecture

- **ADR-156 Implemented 승격 — 엔진↔CSS 레이아웃 정합 복구 전건 종결** (Phase 0~6):
  - 실 Chrome(`@vitest/browser`+Playwright, DOM `getBoundingClientRect` ground truth) 자동 차등 oracle 을 도입해 순환 oracle(`golden.rs` 기대값 = "CSS 명세 손계산")을 끊고 엔진↔CSS 발산 17군(E1~E17)을 수정
  - 사용자-가시 수정(E1 align-self / E6 percent height / E7 음수 margin / E8 reverse 3종 / E10·E11 position relative·absolute / E13·E14 grid placement·auto 트랙)은 Phase 2~5 CHANGELOG 엔트리에 개별 기록
  - **Why**: `wrap` 승격 결함(`bb6ab7e40`)이 34 flex unit + 15 golden 을 전부 통과한 근본 원인 = 엔진과 테스트가 같은 명세 해석을 공유(순환 oracle). Chrome 실측을 독립 oracle 로 세워 재발을 자동 차단
  - 검증: cargo **304**(lib 277) + 파리티 스위트 **50**(phase2/3/4/4_5/5 + 672 조합) flaky 0 + type-check baseline 63
  - §Residual: Layer 2 block-height 마스킹(R5) / grid justify 가로축(옵션 3-b) / E9 baseline / E16 order
  - 위치: `docs/adr/completed/156-engine-css-parity-alignment-margin.md` (root 이관)

### Infrastructure

- **NodeStyle 정적 필드 계약 가드 신설** (ADR-156 Phase 6, R7):
  - `nodestyle_field_contract_guard` — `NodeStyle` 49필드 **전수 구조분해(`..` 금지)** 로 필드 추가 시 컴파일 RED(`error[E0027]`) + 산술 계약 `소비 47 + 미소비 2 = 선언 49` + 미소비 allowlist `UNCONSUMED_NODESTYLE_FIELDS = [justifySelf, justifyItems]` (§Residual 1:1)
  - **Why**: 「선언 O·소비 X」 축이 breakdown §1-3 문서 표 단독이라 stale 화 — 본 ADR 이 발견한 미소비 9필드가 어떤 가드에도 걸리지 않았다. 이제 필드 추가 시 교차표 갱신을 컴파일러가 강제. Phase 2~5 배선으로 원 미소비 9→2(`justify_self`/`justify_items` = grid 가로축, 옵션 3-b)
  - 위치: `packages/composition-engine/src/tree.rs` (pub const `NODESTYLE_FIELD_COUNT`/`UNCONSUMED_NODESTYLE_FIELDS` + `#[cfg(test)]` 가드)

## [margin auto·root 자기 크기·aspect-ratio 가 Builder(Skia)에서 CSS 와 어긋나던 결함 — ADR-156 Phase 5] - 2026-07-18

### Bug Fixes

- **root(페이지 body) 자기 크기 결함군 수정** (ADR-156 E5):
  - 증상: 무폭 root 가 availW 를 채우지 않고 content 로 수축 / auto 높이에 padding·border 누락 / 자기 min·max 높이 clamp 무시
  - **Why**: 엔진의 `solve_block/flex/grid` 는 auto 크기를 content bounding box(shrink-to-fit)로 반환하고, 중첩 노드는 부모 커널이 stretch/clamp 하지만 **root 는 부모가 없어** 그 값이 그대로 최종 크기가 됐다. `fixup_root_self_size`(compute_layout 후처리)로 block-level root 를 availW fill + auto 높이 pad_border 합산 + 자기 min/max clamp. explicit 차원은 미변경
  - 라이브 영향: body 가 auto 크기라 fill 이 live 발동하나 CSS-correct(availW = 기기 폭)이며 무회귀(기존 full-width 자식으로 동일 폭). full-width 자식이 없던 페이지에서 body 수축이 함께 정합됨
- **`margin:auto` 정렬 미구현 수정** (ADR-156 E4):
  - block 가로 `margin:auto` → content box 잉여 균등 분배(중앙). flex main 축 `margin:auto` → 잉여 흡수(justify-content 보다 우선, 단일 라인)
  - **Why**: 엔진이 auto margin 을 0 으로 처리(`resolve_signed`)해 정렬이 소실. solve_block/solve_flex 후처리로 잉여 공간 분배. (Inspector 입력 경로는 아직 없어 pencil import / 향후 정렬 기능 유입 대비)
- **`aspect-ratio` 미소비 수정** (ADR-156 E15):
  - 증상: 한 축만 명시하고 `aspect-ratio` 로 다른 축을 파생해야 하는데 파생 크기가 전면 소실(예: width 100 + ratio 2 → height 0)
  - **Why**: `aspect_ratio` 필드가 선언만 되고 소비 0곳. `apply_aspect_to_dims` 로 `solve_node`(자기 크기) + `write_block_item`(부모 stretch 차단) 양쪽에서 파생. width 100 + ratio 2 → height 50, height 60 + ratio 3 → width 180
- 위치: `packages/composition-engine/src/tree.rs`
- 검증: Chrome 차등 파리티(`tests/parity/phase5.browser.test.ts`) 9 fixture + 전체 스위트 50 + Rust 303 tests(E4/E5/E15 +6) + type-check 63 무증가. **live(빌더 Skia scene)**: E15 aspect(w100→h50)·E4 block margin auto(x60 중앙) 반영, E5 body 회귀 0(시각 파손 없음) 확인

## [position(relative offset·absolute 3종)이 Builder(Skia)에서 CSS 와 어긋나던 결함 — ADR-156 Phase 4.5] - 2026-07-18

### Bug Fixes

- **`position:relative` 시각 offset 이 Builder(Skia)에서 무시되던 결함 수정** (ADR-156 E10):
  - 증상: relative 요소에 `top`/`left` 를 줘도 Skia 는 정상 흐름 위치 그대로 그림 (Preview 는 offset 반영) — CSS↔Skia 비대칭
  - **Why**: 엔진이 relative 를 in-flow 로만 배치하고 inset 시각 이동 단계가 없었다. `solve_node` 이 컨테이너 배치 직후 `apply_relative_offsets` 후처리로 relative 자식만 자기 box 를 inset 만큼 이동(형제·컨테이너 크기 불변, CSS §9.4.3)
- **`position:absolute` 3종 미구현 결함 수정** (ADR-156 E11):
  - ① 양측 inset(`left`+`right` 또는 `top`+`bottom`) + 크기 auto → containing block 안에서 stretch (기존: 크기 0)
  - ② inset 무지정 → 정상 흐름 위치(static position) 유지 (기존: 컨테이너 원점 0,0 고정)
  - ③ `margin:auto` + 양측 inset + 명시 크기 → 잉여 공간 균등 분배(중앙) (기존: 좌상단 고정)
  - **Why**: `place_absolute_children` 이 `left` 우선·단측 역산·static 근사(0)만 처리. 축별 `resolve_abs_axis` 헬퍼로 리팩터해 stretch/static/margin-auto 를 CSS 근사(§10.3.7/§10.6.4)로 구현. static position 은 문서 순서상 선행 in-flow 형제 하단으로 근사
  - 회귀 기준선: `%` inset(ABS-2)은 이미 정합 — 유지 확인
- 위치: `packages/composition-engine/src/tree.rs`
- 검증: Chrome 차등 파리티(`tests/parity/phase4_5.browser.test.ts`) 5 fixture + 전체 스위트 41 + Rust 297 tests(relative/abs +4) + type-check 63 무증가. **live(빌더 Skia scene)**: relative offset(15,30)·absolute stretch(180×60@10,15)·static(y30)·margin-auto(x80) 전부 반영 확인 — position/absolute 경로는 Layer 2 마스킹 없이 Skia 직접 도달(Phase 4 block-height 와 대비)

## [flow 배치 발산(음수 margin·reverse·부모-자식 상쇄·overflow BFC)가 Builder(Skia)에서 CSS 와 어긋나던 결함 — ADR-156 Phase 4] - 2026-07-18

### Bug Fixes

- **음수 margin 이 Builder(Skia)에서 무시되던 결함 수정** (ADR-156 E7):
  - 증상: `marginTop:-10px`/`marginLeft:-20px` 등 음수 margin 이 Skia 에서 0 으로 처리돼 형제 당김·요소 확장이 소실 (Preview 는 정상)
  - **Why**: 엔진의 margin 해석기(`resolve_dimension`)가 `n >= 0.0` 필터로 음수를 0 으로 뭉갰다. `resolve_signed`(음수 보존)로 교체 — 배치 커널(`block.rs collapse_margins`/`flex.rs` cursor)은 이미 음수를 정확히 처리
- **flex `row-reverse`/`column-reverse`/`wrap-reverse` 가 Builder(Skia)에서 무시되던 결함 수정** (ADR-156 E8):
  - 증상: Inspector Direction 을 reverse 로 바꿔도 Skia 는 정방향으로 그림 (Preview 는 역방향) — CSS↔Skia 비대칭
  - **Why**: 엔진 파서가 `row-reverse`→`row`, `wrap-reverse`→`wrap` 으로 정규화하며 reverse 정보를 버렸다. 배치 직후 **순수 기하 reflection**(row/column-reverse=main 축, wrap-reverse=cross 축)으로 정정 — 배치 커널 무변경
- **부모-자식 마진 상쇄(block) 미구현 + overflow BFC 상쇄 차단 결함** (ADR-156 E3/E17):
  - 엔진이 부모에 padding/border/overflow≠visible 이 없을 때 첫 자식 top margin 이 부모와 상쇄돼 밖으로 탈출하는 CSS 규칙(§8.3.1)을 미구현. `solve_block` 이 BFC 차단 요인 판정 후 상쇄를 활성화하고 탈출 margin 을 조상으로 전파하도록 구현. `overflow:hidden/scroll/auto` 는 BFC 로 상쇄를 차단(E17, E3 와 동시 구현)
  - **Why (§Residual)**: 엔진은 정확(파리티 + live 직접 호출 mid.h=20)하나, 빌더가 auto-height block 컨테이너 높이를 JS 로 선계산(`calculateContentHeight`, 마진 상쇄 미구현)해 주입하므로 live Skia 는 아직 상쇄 전 높이를 그린다 → 엔진 변경은 block 경로에서 live-inert(회귀 0). Layer 2(adapter) 후속 과제로 등재
- **R6 계열**: overflow 편집이 상쇄 재판정 relayout 을 유발하도록 `LAYOUT_STYLE_KEYS` 에 `overflowX`/`overflowY` 등재
- 위치: `packages/composition-engine/src/{tree.rs,block.rs}`, `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`
- 검증: Chrome 차등 파리티(`tests/parity/phase4.browser.test.ts`) 8 fixture + 전체 스위트 36 + Rust 293 tests + live(빌더: E7-flex 음수 margin·E8 reverse 3종 Skia 반영 확인, E3/E17 block-height 는 Layer 2 §Residual)

## [grid 정렬·배치가 Builder(Skia)에서 CSS 와 어긋나던 결함 — ADR-156 Phase 3 (grid 커널, 옵션 3-b)] - 2026-07-18

### Bug Fixes

- **grid 컨테이너/자식 정렬·배치가 Builder(Skia)에서 CSS(Preview)와 어긋나던 결함 4종 수정** (ADR-156 Phase 3, 옵션 3-b):
  - **E13 span 배치**: `grid-column: span 2` 등 셀을 여러 칸 차지하는 자식 뒤의 자동 배치 자식이 점유된 칸에 겹치던 결함. CSS 그리드 배치 알고리즘(§8.5)의 2-phase 점유 처리로 정정 (명시 행 아이템 먼저 → 자동 아이템은 빈 칸으로)
  - **E12 트랙 정렬**: 고정 크기 트랙이 컨테이너보다 작을 때 `justify-content`(열)/`align-content`(행)가 무시돼 항상 좌상단에 몰리던 결함. start/center/end/space-between/around/evenly 반영
  - **E14 auto-flow**: `grid-auto-flow: column` 이 무시돼 항상 행 우선 배치되던 결함 + `grid-auto-columns` 로 암시 열 크기 지정 반영 (열 우선 배치)
  - **E2 자식 정렬(세로)**: `align-items`/`align-self` 가 무시돼 자식이 항상 셀 좌상단에 꽉 차게 그려지던 결함. 비-stretch 정렬 시 자식을 셀 세로 여유에서 start/center/end 배치
  - **Why**: 레이아웃 엔진 `grid.rs` 에 정렬 처리가 0줄이었고, `grid-auto-flow`/`gridAutoColumns` 등이 미소비였다. 발산 필드가 페이지 레이아웃 캐시 시그니처(`LAYOUT_STYLE_KEYS`)에 미등재라 해당 편집이 캐시 히트로 무반응이던 계열 결함(R6)도 함께 해소
  - **옵션 3-b 범위**: 엔진은 정렬(위치)만 추가하고 크기는 기존 stretch 를 유지 — `justify-items`(가로 배치·크기)는 별도 폭 보정 로직과의 이중 적용 우려로 후속 판정(§Residual)
  - 위치: `packages/composition-engine/src/{grid.rs,tree.rs}`, `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`
  - 검증: Chrome 차등 파리티(`tests/parity/phase3.browser.test.ts`) 8 fixture + Rust 293 tests + live(빌더 grid: 기본 stretch 셀 채움 회귀 0 / align center 세로 중앙 / span 2행 배치)

## [정렬 피커·percent 높이가 Builder(Skia)에서 동작하지 않던 결함 — ADR-156 Phase 2 (E1 align-self / E6 percent height)] - 2026-07-18

### Bug Fixes

- **Inspector 정렬 피커(`align-self`)가 Preview(CSS)에서만 동작하고 Builder(Skia)에서 무반응이던 결함 수정** (ADR-156 E1):
  - 증상: 정렬 피커로 자식을 부모 안에서 위/아래·중앙 정렬해도 Skia 캔버스에서 위치가 바뀌지 않음 (Preview 는 정상) — CSS↔Skia 비대칭
  - **Why**: 레이아웃 엔진 `NodeStyle.align_self` 가 **선언만 되고 읽는 코드가 0곳**이었다. store→엔진 송신(`taffyStyleToRecord`)은 정상이나 엔진이 값을 버려, 정렬이 Preview 에서만 반영됐다. 추가로 9칸 피커가 함께 쓰는 `justifySelf` 가 페이지 레이아웃 캐시 시그니처(`LAYOUT_STYLE_KEYS`)에 미등재라, 가로 전용 이동(`leftTop`→`centerTop`)이 캐시 히트로 흡수돼 재배치 자체가 일어나지 않았다
  - 수정: `flex.rs` 필드 계약을 17→18 필드로 확장해 per-item `align_self` 를 소비(`place_line_cross_axis` 가 컨테이너 `align-items` 를 override, `auto`=상속). `layoutCache.ts` 의 `LAYOUT_STYLE_KEYS` 에 `justifySelf` 등재. `justify-self` 는 flex 에서 무효(grid 전용)라 소비는 Phase 3
  - 위치: `packages/composition-engine/src/{flex.rs,tree.rs}`, `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`
- **percent 높이(`height:50%` 등)가 Builder(Skia)에서 컨테이너 폭 기준으로 잘못 계산되던 결함 수정** (ADR-156 E6):
  - 증상: 자식에 `height:50%` 를 주면 Skia 가 컨테이너 **높이**가 아니라 **폭**의 50% 로 그림 (Preview 는 높이 기준) — 폭≠높이 컨테이너에서 비대칭
  - **Why**: 엔진의 percent 해석 컨텍스트(`ctx_for`)가 폭 단일 축만 담아, column 자식의 `height`·block 자식의 `height` 를 폭 기준으로 해소했다
  - 수정: `height`/`minHeight`/`maxHeight` 를 축별 컨텍스트(높이 기준)로 라우팅. 컨테이너 높이가 **명시 definite** 일 때만 실축, `auto` 면 percent→`auto`(CSS §10.5). `padding`/`margin` 의 percent 는 폭 기준 유지
  - 위치: `packages/composition-engine/src/tree.rs`
  - 검증: Chrome 차등 파리티 하니스(`tests/parity/phase2.browser.test.ts`, 실 DOM = ground truth) 8 fixture + 672 조합 무회귀 + Rust 288 tests + live(빌더 store 편집 → Skia 반영, Preview 대칭). 잔여 발산(E2/E3/E7/E8 등)은 후속 Phase

## [block 부모 안 컴포넌트가 Skia 에서 세로 중앙에 놓이던 결함 — flex line 승격 조건 정정] - 2026-07-17

### Bug Fixes

- **`display: block` 컨테이너에 등록한 Button 등 컴포넌트가 Builder(Skia)에서만 세로 중앙에 배치되던 결함 수정**:
  - 증상: Home page(body, Layout direction `block`)에 Button 을 등록하면 Preview(CSS)는 좌상단, Builder(Skia)는 좌측·세로 중앙 — CSS↔Skia 비대칭
  - **Why**: block 부모는 inline-level 자식(Button = inline-block)을 만나면 CSS inline formatting context 를 flex row wrap 으로 시뮬레이션한다 (`INLINE_BLOCK_PARENT_CONFIG` = wrap + `align-items:center` + `align-content:flex-start`). 그런데 레이아웃 엔진이 CSS 의 "single-line 컨테이너" 를 **결과 라인 수 1개**(`line_count == 1`)로 판정해, wrap 컨테이너의 유일한 라인까지 컨테이너 cross(페이지 높이)로 승격시켰다. 승격된 라인 안에서 `align-items:center` 가 작동해 Button 이 페이지 세로 중앙으로 이동하고, 상단 고정용 `align-content:flex-start` 는 무력화됐다. CSS 명세(§5.2)의 single-line 은 **`flex-wrap:nowrap`** 을 뜻하며, wrap 컨테이너는 라인이 1개여도 multi-line 이라 라인 cross 가 자식 높이로 남아 상단에 쌓인다
  - 수정: 라인 cross 승격(§9.4 step 8)과 align-content 무효화(§8.4) 판정 기준을 `line_count == 1` → `wrap == WRAP_NOWRAP` 으로 정정. `align_content_offsets` 의 stretch 분기도 같은 기준으로 정렬해 `wrap + 1라인 + align-content:stretch` 기존 동작 보존
  - 검증: body(1920×1080) > Button 실측 y=525(중앙) → **y=0(상단)**, Preview 와 대칭 복구. Rust 256 tests PASS (신규 2: 상단 고정 + stretch 회귀 가드)
  - 위치: `packages/composition-engine/src/flex.rs`

## [IconButton origin 크기 정정 — Button 척도 seed 주입] - 2026-07-18

### Bug Fixes

- **IconButton origin 이 Button 보다 한 단계씩 크게 렌더되던 결함 수정** (ADR-148 Phase 2 후속):
  - **Why**: origin seed 가 자식 Icon/Text 에 Button 척도(size + inline fontSize/lineHeight/iconPx)를 주입하지 않아, 자식이 각자의 default(md) 스케일(Text md=text-base 16/24, Icon md=24)로 렌더 — 같은 size 리터럴이 Button 척도(md=text-sm 14/20, icon 18)보다 타이포 토큰 한 단계 위라 전 size 에서 한 단계 크게 보였다. propagation rule 은 _변경_ 시점에만 작동해 seed 초기값을 못 채운다 (팔레트 생성 경로 `buildButtonChild` 는 직접 주입 — origin seed 만 누락)
  - 수정: seed 자식에 `buttonIconPx`/`buttonTextMetrics` 단일 소스로 척도 주입 + `repairOrigin` 이 구버전 문서의 무척도 자식을 root size 기준으로 채움 (사용자 명시 값은 보존) — 기존 프로젝트는 reload 시 자동 회복
  - 검증: live — reload 후 origin 92×30 (Button md 정합, 이전 103×54), Size S/M 전환 시 22/30 전파 왕복, vitest 신규 2건
  - 위치: `apps/builder/src/builder/components/iconbutton/iconButtonTemplateOrigins.ts`

## [Components 페이지 origin slot 자식 더블클릭 편집 — collection item unfold] - 2026-07-17

### Bug Fixes

- **GridListItem/ListBoxItem origin 의 slot 하위 요소를 더블클릭으로 선택·편집할 수 없던 결함 수정** (ADR-148 후속):
  - **Why**: scene 빌더의 slot 자식 접힘(인스턴스 이중 렌더 차단용)이 Components 페이지의 reusable origin 에도 적용되어 slot 자식(Icon/Label/Description)의 interaction node 가 없었고, 더블클릭 drill-down 이 참조하는 `interactiveChildrenMap` 이 빈 배열이라 컨텍스트 진입·자식 선택 분기가 발동하지 않았다
  - 수정: reusable origin 은 접지 않고 slot 자식을 실 scene 노드로 세운다 (Card origin·DOM renderer children-first 와 동형 authoring 표면). 이중 렌더는 `listbox_item`/`gridlist_card` escape 의 `_hasChildren` shell gating(자식 실재 시 shell 만 — 내용은 자식이 담당)으로 차단, layout item metric 분기도 childful 이면 일반 컨테이너 자식 합산으로 전환. projection 행은 자식이 없어 기존 동작 완전 보존
  - 검증: origin 카드 더블클릭 → editingContext 진입 + label slot 자식 선택 + Inspector 편집면 (live), 인스턴스 카드 무회귀 (live + vitest 신규 9건)
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts` / `packages/specs/src/renderers/skiaPrimitives.ts` / `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

## [Reusable·Slot 시스템 단일화 완결 — ADR-148 Implemented (Phase 4 collection item slot 이식)] - 2026-07-17

### Features

- **GridList 카드 / Menu item 의 slot 구성이 origin 문서를 따라가도록 이식** (ADR-148 Phase 4 — 마지막 phase, ADR-147 ListBoxItem 모델 복제):
  - Components 페이지에 GridListItem origin(label/description slot 자식) + MenuItem origin(icon/label/shortcut/description — Menu itemSchema 8키 중 시각 slot 4키) 이 자동 seed 되고, **origin 에서 slot 자식을 지우면 모든 GridList 카드/Menu item 에서 해당 slot 이 사라진다** (데이터가 있어도 미렌더 — 구성 SSOT = origin 자식 구성). slot 자식 `style` 편집은 전 instance 에 스타일 overlay 로 전파
  - 소비 배선: GridList projection `_slots` 주입(origin style overlay + `templateOriginId` 포함) + Skia `gridlist_card` escape(gating/overlay/스택 순서) + layout 카드 높이 gating + DOM emit(`renderGridList` 3단 fallback / `renderMenuItemSlotParts` 공용 helper — MenuButton 내부 3경로 포함) + Preview provider `templateSlotCompositions` 통합. `SLOT_ROLES` 에 `shortcut` 추가 (additive 1줄)
  - Menu 는 Skia 캔버스에 trigger 버튼만 렌더(항목은 Preview popover) — Menu item 의 소비 표면은 DOM 단일 축으로 기록
  - 위치: `apps/builder/src/builder/components/{gridlist,menu}/*TemplateOrigins.ts`(신규) / `canvasSceneNode.ts`(projection) / `packages/specs/src/renderers/skiaPrimitives.ts`(escape) / `packages/shared/src/renderers/SelectionRenderers.tsx`·`CollectionRenderers.tsx`·`components/Menu.tsx`(DOM emit)

### Documentation

- **ADR-148 Status Implemented 승격 + closure**: Phase 0(ListBoxItem slot 배선 정정) → 1(catalog reusable 등록 단일화) → 2(IconButton + propsSchema + 템플릿 바인딩) → 3(InlineAlert/Card 전환) → 4(collection item slot 이식) 전 phase 완결. 본문 `docs/adr/completed/` 이동 + README 대시보드 재산정(완료 163). 잔존 R9 기록: publish 앱은 registry 직접 렌더 경로라 slot 구성 미소비 (Phase 0 부터의 기존 gap — 후속 분리)

## [InlineAlert·Card reusable 전환 + Card variant 렌더 수정 — ADR-148 Phase 3] - 2026-07-17

### Bug Fixes

- **Card variant 편집이 Preview DOM 에 반영되지 않던 결함 수정** (ADR-148 Phase 3 cross-check 발견):
  - **Why**: `renderCard` 가 `element.props.variant` 를 shared `Card` 컴포넌트에 전달하지 않아 DOM `data-variant` 가 내부 default "primary" 로 고정 — Skia 는 catalog rule 로 variant fill 을 소비해 편집 시 CSS↔Skia 발산 (ADR-912 R6 의 S2 variant 모델 전환 때 전달 누락, legacy flat Card 포함 전 경로 잔존 결함)
  - 수정: structural/legacy 두 분기 모두 variant 전달 — 편집 실시간 전파·새로고침 왕복 대칭 확인
  - 위치: `packages/shared/src/renderers/LayoutRenderers.tsx`

### Features

- **InlineAlert / Card — factory-대체군 reusable 조합 전환** (ADR-148 Phase 3, Toolbar/Form/IconButton 동형):
  - 팔레트 생성이 `type:"ref"` instance 로 전환 — origin 조합 문서(InlineAlert > Heading `{title}` + Description `{description}` / Card 4-region: Preview>Image·Header>Heading `{title}`·Content>Description `{description}`·Footer)가 렌더 정본. Card 는 바인딩이 depth-2 자식에 위치 (중첩 치환 첫 실사용)
  - **propsSchema 편집**: instance 선택 시 Title/Description/Variant(+Card 는 Size) 필드 자동 파생 — 편집은 instance override (Overrides 표시 + Reset), 구 Card `title→CardHeader.Heading` propagation 라우팅을 템플릿 바인딩이 대체 (legacy flat 문서용 propagation rule 존속)
  - factory seam 삭제: `createInlineAlertDefinition`/`createCardDefinition` + ComponentFactory method/creators + `COMPLEX_COMPONENT_TAGS` 2항목 (kill criteria "definition fallback 0" 충족)
  - 재판정 보류 2종 기록: Toast (생성 진입점 0 — palette 비노출 imperative 알림 설계) / IllustratedMessage (DOM 어댑터+Skia escape 가 flat props self-compose — 환원 부적격, ADR-912 진로 1번 의도 설계)
  - 위치: `apps/builder/src/builder/components/{inlinealert,card}/`(origin seed) / `packages/shared/src/catalog/componentCatalog.ts`(reusableEntry 2건) / `apps/builder/src/builder/factories/`(seam 삭제)

## [IconButton 신규 reusable + propsSchema 편집 — ADR-148 Phase 2] - 2026-07-17

### Features

- **IconButton — 첫 신규 reusable 조합 컴포넌트** (ADR-148 Phase 2):
  - 팔레트 Buttons 카테고리에 "icon button" 추가 — 클릭 시 `type:"ref"` instance 생성, origin(Button > Icon + Text 조합 문서)이 렌더 정본
  - **propsSchema 편집**: instance 선택 시 Inspector 에 Label/Icon/Variant/Size 4필드 자동 파생(origin `metadata.propsSchema` — ADR-148 Decision 4 확정). 편집은 instance override 로 기록되어 Overrides 표시 + Reset 지원, origin 수정은 override 없는 instance 에 전파
  - **템플릿 바인딩 `{키}` 치환 엔진 신설**: origin 자식의 `{label}`/`{icon}` placeholder 를 instance 편집값으로 치환 — propagation 손등록(코드 규칙)의 데이터 대체 방향. propsSchema 미선언 origin(ListBox 계열 row-data 바인딩)의 placeholder 는 원형 보존
  - 위치: `packages/shared/src/catalog/templateBinding.ts`(엔진) / `apps/builder/src/builder/components/iconbutton/iconButtonTemplateOrigins.ts`(origin seed) / `resolveEditContract.ts`(Inspector 분기)

### Bug Fixes

- **reusable 치환의 CSS↔Skia 발산 선차단** (ADR-148 Phase 2 cross-check 발견):
  - **Why**: resolve 는 flat synthetic 축(builder Skia)과 nested children 축(Preview DOM — ADR-903 resolver)을 모두 소비 표면으로 가짐 — flat 축만 치환하면 Preview 가 `{label}` 원형을 렌더
  - 수정: 양축(`canonicalRefResolution.ts` + `resolvers/canonical/index.ts`) 동일 바인딩 배선, 중첩 reusable 은 `_resolvedFrom` 에서 재귀 중단(안쪽 row-data placeholder 오염 방지)

## [ListBoxItem slot 자식 배선 — ADR-148 Phase 0 승계 정정] - 2026-07-17

### Bug Fixes

- **origin slot 조합 자식(Icon/Label/Description) 편집이 화면에 반영되지 않던 미배선 정정** (ADR-148 Phase 0 — 사용자 보고 "slot 개념만 적용되었을 뿐 정상 동작 아님"):
  - **Why**: ADR-147 이 도입한 slot 조합 자식(`metadata.slotRole`)의 소비처가 정의부 + Skia scene 제외 판정 2곳뿐 — 렌더(DOM/Skia)·projection·편집기 전 경로가 flat props 만 읽어, origin 에서 slot 자식을 지우거나 스타일을 바꿔도 화면 변화 0 (write-only authoring 구조)
  - 수정: projection 이 origin slot 자식에서 `resolveSlotComposition()` 구성(존재·순서·스타일)을 `_slots` 로 주입하고, Skia `listbox_item` escape / DOM emit(`renderListBoxItemSlotContent`) / layout 높이(`calculateContentHeight` listbox·listboxitem 분기) 3경로가 이를 소비 — origin 에서 description slot 자식을 지우면 instance 행이 양축(Skia/Preview)에서 1줄로, label slot 자식 style(color/fontWeight/fontSize)은 행 라벨에 overlay, icon slot fontSize 는 `--lb-icon-size` CSS 변수로 DOM 여백까지 대칭
  - 위치: `packages/shared/src/catalog/slotRoles.ts`(신규 — 공용 vocabulary+resolver), `packages/specs/src/renderers/skiaPrimitives.ts`, `packages/shared/src/renderers/SelectionRenderers.tsx`, `apps/builder/.../canvasSceneNode.ts`, `apps/builder/.../layout/engines/utils.ts`, `apps/builder/src/preview/App.tsx`

### Architecture

- **slotRole 공용 vocabulary shared 승격** (ADR-148 Decision 3): builder-local `LISTBOX_ITEM_SLOT_ROLES`/`getListBoxItemSlotRole` 제거 → shared `SLOT_ROLES`(12종)+`getSlotRole`+`resolveSlotComposition`+`isSlotEnabled` — 컴포넌트별 allow-set 을 코드에 두지 않고 origin 문서의 자식 구성이 SSOT. `ListBoxItemEditor` 는 slot 조합 문서에서 내용 설정 시 제거된 slot 자식을 자동 재생성(양방향 동기, dead edit 차단)
- **reusable 등록 단일화 — catalog `kind:"reusable"` entry** (ADR-148 Phase 1): 별도 레지스트리 `REUSABLE_COMPOSITE_ORIGINS` 하드코딩 맵을 catalog entry 파생으로 대체 — "1 컴포넌트 = 1 등록"이 reusable 축(Toolbar/Form)까지 완성. 인덱스 2원화(`CATALOG_BY_TYPE` kind≠reusable 렌더·binding 전용 / `REUSABLE_BY_TYPE` 생성·팔레트 전용) + 동명 primitive `placeable:false`(placeable 단일성) + `REUSABLE_ORIGIN_ENSURERS`(entry↔ensurer drift 는 registrationContract 불변식 R①~R④ 가 차단). 인스턴스 canonical `type:"ref"` 저장은 무변 — 기존 문서 영향 0
  - 위치: `packages/shared/src/catalog/componentCatalog.ts`, `apps/builder/src/builder/components/reusableCompositeOrigins.ts`, `apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts`

## [숨은 패널 selection fan-out 차단 — ADR-155 패널 활성 gating] - 2026-07-17

### Performance

- **비활성 패널을 React 19.2 `<Activity mode="hidden">` 으로 gating — 선택 클릭 시 숨은 패널 작업 완전 소거** (ADR-155 Phase 0~3 Implemented):
  - **Why**: `PanelContainer` 의 `isActive={true}` 하드코딩 + memo 전파 차단으로 화면에 없는 패널 14종이 매 선택 클릭마다 store 구독 갱신을 실행 — 클릭당 ~~110ms (86~~205ms) 동기 long task 의 본체가 숨은 패널 commit effect 순회 (busy 샘플 ~74%, 숨은 스타일 입력 25개 host update = 클릭당 DOM 속성 쓰기 93건)
  - 수정: `PanelWrapper` 가 비활성 패널을 Activity hidden 으로 무조건부 래핑 — hidden 중 uSES 구독 자체가 해제되어 갱신 알림을 받지 않음 (DOM·컴포넌트 상태 보존, 재활성 시 최신화). 슬라이드 애니메이션의 `data-active` CSS 채널은 속성축 분리로 공존
  - 숨김 중에도 필요하던 캔버스 전역 단축키 (Cmd+C/V/D/A·Escape·그룹·정렬 등 PropertiesPanel 발 11 핸들러 + Styles Copy/Paste) 는 신설 `CanvasSelectionShortcuts` host (BuilderCore mount) 로 이전 — properties 패널이 닫혀 있어도 동작
  - Activity `display:none` 이 소실시키는 패널 스크롤 위치는 scroll 기록 → 재활성 rAF 복원으로 보완 (실측 420→0 회귀 → 1600px 보존)
  - 실측 (550 요소 문서, Chrome MCP): 선택 클릭 longtask 0건 (pointerdown duration 24ms) / commit effect busy 비율 74%→12% (MutationEffects 0%) / hidden 패널 mutation 0 (이전 클릭당 ~125건)
  - left/right 12패널의 dead `if (!isActive)` 가드 제거 동반 (bottom 경로 MonitorPanel 은 live 가드 유지)
  - 위치: `apps/builder/src/builder/layout/PanelContainer.tsx`, `apps/builder/src/builder/panels/properties/CanvasSelectionShortcuts.tsx`, `apps/builder/src/builder/main/BuilderCore.tsx`

## [선택 클릭 재렌더 낭비 제거 — canonical elements view 문서당 1회 캐시] - 2026-07-17

### Performance

- **선택 클릭마다 canonical 문서 전체 재-materialize 하던 경로를 문서 참조당 1회 캐시로 통합** (빌더 성능 개선 3번):
  - **Why**: `useSelectedElementData` 가 선택 변경마다 `visitCanonicalDocumentElements` 로 전체 노드를 legacy Element 로 재생성 (Styles ×2 / Properties / Events 4개 패널 소비처 각각 실행) + ref 요소용 `findElementInCanonicalDocument` 가 추가 전체 순회 — 클릭당 문서 4~8회 평탄화. 숨은 패널도 `PanelContainer` 가 `isActive={true}` 하드코딩으로 항상 구독하므로 패널 수만큼 증폭. 비용이 문서 크기 × 패널 수로 선형 증가하는 구조
  - 수정: `getCanonicalDocumentElementsView(doc)` — WeakMap 문서 참조 키 캐시 (`{elements, byId}`). canonical store 의 clone-on-write 보장 (mutation 시에만 참조 교체) 위에서 안전. 선택 시 O(1) `byId` lookup, `useElements`/`useCanonicalPropertySourceElements` 도 인스턴스별 재평탄화 → 공유 view 로 전환 (문서 편집 시 N회 → 1회)
  - 실측 exercise: Chrome MCP live — 선택 클릭 → 패널 반영 정상, `updateElementProps` mutation → clone-on-write 참조 교체 + 파생 뷰 신규 값 반영 + 원복 확인. 소형 테스트 문서 (26 요소) 에서는 클릭당 React 커밋 총합이 측정 한계 내 동일 (병목이 RAC 패널 fan-out 으로 이동) — 효과는 문서 크기에 비례
  - 계약 테스트: 캐시 동일 참조 / clone-on-write 재구축 / byId last-match (기존 순회 의미 보존) 4건 (`canonicalElementsView.test.ts`)
  - 위치: `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`, `apps/builder/src/builder/stores/index.ts`, `apps/builder/src/builder/panels/properties/hooks/useCanonicalPropertyRead.ts`

## [ADR-151 잔여 3건 해소 — TableView 발산 / preview marker 소실 / components 페이지 안내] - 2026-07-17

### Bug Fixes

- **IllustratedMessage 캔버스↔Preview 시각 발산 (Skia 48 vs CSS 240 → md 240=240 / sm 197=197)** (ADR-151 후속, 06f1319b3):
  - **Why**: 3겹 — layout 높이 분기 부재 (escape 그리기가 48px 박스를 넘침) + escape 가 top-left 고정으로 padding/factory 정렬(alignItems:flex-start) 미소비 + DOM 컴포넌트가 md 하드코딩 (binding propPassthrough 부재로 size prop 미도달)
  - 수정: `resolveIllustratedMessageMetric` (catalog rule sizes read-through) 을 DOM/Skia escape/layout 3경로 단일 산식으로 도입 — escape 는 element style (padding/gap/alignItems, longhand 우선) 소비, layout 분기는 content-box 계약 (caller 가 style padding 가산)
  - 위치: `packages/specs/src/renderers/utils/illustratedMessageMetrics.ts` (신규), `skiaPrimitives.ts`, `packages/shared/src/components/IllustratedMessage.tsx`, `apps/builder/.../layout/engines/utils.ts`
  - 신규 관측 (후속): preview 가 prop 편집을 canonical 재송신 전까지 미반영 — breakdown §Phase 6 잔여 표 기록
- **Skia nowrap 텍스트의 center/right 정렬 소실 — placeholder ○ 박스 좌측 고정** (ADR-151 후속, d96cf04e2):
  - **Why**: nowrap 은 CanvasKit 큰 width 버그 회피로 paragraph 를 intrinsic 폭으로 재layout — 내부 align 무효 + 외부 보정 부재로 밴드 좌측 고정 (CSS 는 nowrap 이어도 text-align 유지)
  - 수정: 명시 maxWidth 밴드가 있으면 (band − intrinsic) 차 offset 으로 center/right 복원 — calendar 요일 등 nowrap+center escape 전반 동일 계열
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/nodeRendererText.ts`

- **TableView flex 부모 발산 (Skia 350×80 vs CSS 179.4×106 → 350×82 = 350×82)** (ADR-151 후속):
  - **Why**: catalog CSS 채널 이중 단절 — generated/TableView.css 가 index.css 미import + renderTableView 가 `react-aria-TableView` 클래스 미부여 raw div → width:100%/text-sm 이 DOM 미도달. 재배선 시 archetype base `align-items:center` 가 살아나 자식 stretch 붕괴 + DOM border-box +2 를 엔진 미합산 + Cell 폰트가 상속 의존 (root text-sm cascade 로 파괴) — 4겹 원인
  - 수정: import + 클래스 부여 (inline dup 은 catalog CSS 단일 위임으로 제거) + catalog `alignItems:"stretch"` 양 채널 + layout 채널 `borderWidth:"1px"` + Column/Cell 16/24 subtree 미러
  - 위치: `packages/shared/styles/index.css`, `packages/shared/src/renderers/LayoutRenderers.tsx`, `packages/shared/src/catalog/generated/componentRulesTable.ts`
- **IllustratedMessage/Skeleton preview 측정·클릭 선택 불가 — cutover marker 소실** (ADR-151 후속):
  - **Why**: cutover 경로는 `data-element-id` 를 컴포넌트 props 로 주입하는데 두 컴포넌트가 rest 미전개로 소실 — "preview 미렌더" 관측의 실체 (시각 렌더는 정상). preview 클릭 선택 (`closest("[data-element-id]")`) 도 불가였음
  - 수정: `...rest` 전개 (StatusLight 패턴, Skeleton 은 3분기 전부) + 비위임 internal leaf 7종 marker contract 테스트
  - 잔여: 측정 가능 전환 후 IllustratedMessage Skia 48 vs CSS 240 시각 발산 신규 관측 (escape 기하 + layout 높이 분기 부재) — 후속
- **components 시스템 페이지 preview 빈 화면** (ADR-151 후속, 사용자 (a)안):
  - **Why**: `pageRole:"components"` 페이지는 `isRuntimePageNode` 가 설계상 제외 + legacy fallback 이 ADR-125 이후 dead (UPDATE_ELEMENTS 미수신) → 빈 화면 + 경고만 잔존
  - 수정: 필터 유지 + "Components page is not previewable" 안내 렌더 (`apps/builder/src/preview/App.tsx`)

## [빌더 잔여 CSS↔Skia 발산 일소 — ADR-151 Phase 0~6] - 2026-07-17

### Bug Fixes

- **Calendar/RangeCalendar 대형 발산 (dw+6~~24/dh+2~~26 → 0/0)** (ADR-151 Phase 1):
  - **Why**: generated RangeCalendar.css 미import (컨테이너 chrome 전체 죽음) + 셀 메트릭이 컨테이너 gap 값을 inter-cell 간격으로 오용 + border 1px layout 미반영 — 3겹 원인
  - 수정: import 추가 + DOM `td { padding: 2px }` 셀 박스 모델 정렬 (cellBox=cellSize+4) + catalog `borderWidth: "1px"` layout 채널
  - 위치: `packages/shared/styles/index.css`, `apps/builder/.../layout/engines/utils.ts`, `packages/specs/src/renderers/skiaPrimitives.ts`
- **Card dh-3 / Link dh-5 / Tree dh+6 / GridList 내부 row 50 vs 64** (ADR-151 Phase 2):
  - **Why**: Card Description 이 catalog CSS 미도달 (plain div) + Link lineHeight 토큰 부재 (3자 발산) + Tree border 1px layout 미반영 + GridListItem projection layout 분기 부재
  - 수정: `react-aria-Description` 클래스 정렬 + Link.sizes lineHeight 5종 + Tree borderWidth + row 메트릭 DOM 계약 분기
- **StatusLight dh+3 / Badge dh+2 / Checkbox dw+7.6 / Table dh-2** (ADR-151 Phase 4/6):
  - **Why**: StatusLight 가 catalog height(24) 미소비 · Badge catalog borderWidth 1 이 dead 값 (CSS border-style 부재) 인데 Skia 만 가산 · Checkbox 라벨을 기본 폰트로 측정 (catalog Label 14/600 아님) · Table 은 DOM 외곽 border 1px 을 Skia 단일 box 가 미합산
  - 수정: rule height read-through · borderWidth 0 정정 · `extractSpecTextStyle("label")` 정렬 · table 분기 border×2 합산 (402=402)
- **CSS base `width:100%` 채널의 Skia 미배선 — flex 부모에서 fit-content 붕괴 (B22)** (ADR-151 Phase 4~6):
  - **Why**: Text/Table/Separator/Heading/Paragraph/Description 의 DOM 폭 원천인 CSS `width:100%` 를 Skia layout 이 소비하지 않음 — plain block body 에서는 IFC 시뮬레이션 주입이 우연히 같은 값을 만들어 은폐, flex-column(align-items:flex-start) body 에서만 노출 (Text Skia 31 vs CSS 350)
  - 수정: catalog top-level `containerStyles.width:"100%"` + `applyImplicitStyles` 선주입 (`B22_CSS_FULL_WIDTH_TAGS` — 후주입은 intrinsic 하드닝에 밀림). Disclosure(Group) 은 전제 착오로 판명되어 철회 (generated CSS 에 base width 규칙 없음 — DOM 정본 fit-content)
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `apps/builder/.../layout/engines/implicitStyles.ts`
- **Menu 캔버스 표현 발산 — Skia 만 390px 전폭 바** (ADR-151 B7, 사용자 결정 "트리거 버튼 통일"):
  - catalog menu containerStyles 를 트리거 박스 (inline-flex/fit-content) 로 전환 — DOM MenuTrigger 패턴 (61.2×30) 과 정합
- **fontVariant 텍스트 측정 비대칭 방어** (ADR-151 Phase 5): `needsFallback()` 에 fontVariant 검사 — small-caps 는 CanvasKit 측정 경로로 우회해 측정↔렌더 일치

### Architecture

- **허용 오차 판정 기준 명문화 + golden 편입** (ADR-151 Implemented 승격, 2026-07-17):
  - ±2px 이내 + 텍스트 측정 엔진 기인 규명 시 수용 (ADR-042 승계, 원인 미상은 크기 무관 수용 금지) — ToggleButton +2.5 / ToggleButtonGroup +2.8 / Link dw+1.5 / Badge dw-1.1 수용, breakdown 실측표가 golden 기대값
  - Rust `tree_golden.rs` N10 (flex-start column percent 폭 계약) + JS 절대값 golden (calendar 238/200 · table 402 · width:100% 선주입 6케이스 등) 편입 — engine scope 회귀테스트 공백 해소
  - 잔여 후속 이관 4건 (엔진 percent-in-intrinsic / TableView flex 발산 / IllustratedMessage preview 미렌더 / preview 페이지 전환 요소 미공급) 은 design breakdown §Phase 6 잔여 기록 표 정본

## [Skia 스크롤 컨테이너 오컬링 수정 — 스크롤로 뷰포트에 들어온 자식 미렌더] - 2026-07-16

### Bug Fixes

- **overflow scroll/auto 컨테이너 스크롤 시 fold 아래 컴포넌트 미렌더**:
  - page(body)/컨테이너를 스크롤해 뷰포트로 들어온 자식이 마우스 오버 시 hover outline (레이아웃) 만 보이고 컴포넌트 본체는 그려지지 않던 문제
  - **Why**: `executeRenderCommands` 의 AABB 컬링용 절대좌표 스택(`translateStack`)이 `CMD_CHILDREN_BEGIN` 의 scroll translate (`canvas.translate(-scrollLeft, -scrollTop)`) 를 미반영 — 자식을 스크롤 전 좌표로 판정해 화면 밖으로 오컬링. boundsMap/hit-test 경로는 scroll 차감돼 outline 만 정상 표시. Tree 경로(`nodeRendererTree`)는 자식 컬링 경계에 scrollOffset 을 이미 반영했으나 Command Stream 경로 전환 시 동일 보정이 누락
  - 수정: CHILDREN_BEGIN 에서 컬링 스택에 스크롤 오프셋 반영 + `scrollDeltaStack` 으로 CHILDREN_END 복원 (중첩 스크롤 대응). 뷰포트 밖에 남는 자식의 컬링은 유지 (회귀 테스트 2건)
  - 검증: 라이브 builder 에서 body overflow=scroll + 콘텐츠 오버플로 상태로 wheel 스크롤 → fold 아래 Form/TextField 렌더 확인 (Chrome MCP 실측)
  - 스크롤바 동반 검증 (2026-07-16 후속 확인): thumb 이 scrollTop 0 → 중간(비례 위치) → max(바닥 클램프) → 0 복귀 전 구간에서 스크롤 위치를 정확히 추적함을 실측 — `buildBoxNodeData` 의 thumb 계산 (`thumbY = scrollTop/maxScrollTop × (track−thumb)`) 과 `renderScrollbar` 경로는 정상, 별도 수정 불요
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`

## [Builder 프레임 jank 2건 제거 — FontMgr 프레임 밖 재구축 + Preview resolve 중복 정리] - 2026-07-16

### Performance

- **Skia FontMgr 재구축을 rAF 프레임 밖으로 분리** (부팅 프레임 ~460ms 제거):
  - 폰트 배치 로드 종료 지점(`loadAllCustomFontsToSkia` / `syncCustomFontsWithSkia`)에서 `warmFontMgr()` 로 `ck.FontMgr.FromData` 전체 재파싱을 선지불
  - **Why**: 렌더 루프의 lazy `getFontMgr()` 가 첫 rAF 프레임 안에서 재구축을 지불해 draw 비용과 한 프레임에 겹침 — 실측 부팅 `render.frame` 1005ms = draw 542ms + FromData ~460ms. 수정 후 frame−draw 잔차 460ms → 7ms (Chrome MCP 실측)
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`, `apps/builder/src/builder/fonts/loadCustomFontsToSkia.ts`
- **Preview canonical resolve 를 문서 변경당 2회+ → 1회로 축소**:
  - dev 전용 로깅 effect 의 full `resolveCanonicalDocument`(순수 console.log 목적) 제거 + 렌더 경로 resolve 를 문서 단위 `useMemo` 로 메모이제이션 (import registry prefetch 완료 시에만 재계산)
  - **Why**: preview 는 same-origin iframe 이라 builder 와 main thread 를 공유 — 편집 중 문서 변경마다 전체 문서 resolve 2회 + `[ADR-116] preview canonical resolve` 콘솔 로그가 builder 프레임 사이에 끼어 pointer 인터랙션 600ms long frame 을 가중
  - 위치: `apps/builder/src/preview/App.tsx` (정적 가드: `previewFrameMirror.static.test.ts` — registry 경유 resolve 1회 + memo 존재 고정)

## [Slider labelPosition — orientation 패널 항목 대체] - 2026-07-16

### Breaking Changes

- **Slider 속성 패널 `orientation` 항목 제거 → `labelPosition` 으로 대체**:
  - Slider Inspector 의 Orientation(horizontal/vertical) 편집 항목 삭제, Label Position(Top/Side) 추가
  - **Why**: orientation=vertical 은 Slider grid 레이아웃(`"label output"` / `"track track"`) 미지원이라 실효 없던 편집 항목. RSP Slider 는 labelPosition 을 시각 배치 축으로 사용 → 레퍼런스 정합
  - 기존 프로젝트 영향 없음: 저장된 `orientation` prop 은 `renderSlider` 가 여전히 forward(기본 horizontal), 데이터 마이그레이션 불요. 패널 편집 항목만 제거
  - 위치: `packages/shared/src/catalog/bindings/Slider.binding.ts`

### Features

- **Slider `labelPosition="side"` — Label · Track · Value 가로 배치** (RSP Slider labelPosition 레퍼런스 정합):
  - `side` 시 grid(`"label output"` / `"track track"`) → flex-row 전환. Label · Track · Value 순서로 한 줄 가로 배치 (Track 이 남는 폭 flex:1 로 채움)
  - D3 3중 대칭 구현: CSS(catalog `structure.composition.containerVariants["label-position"]` → generated `Slider.css` `[data-label-position="side"]`) + Skia(top-level `containerVariants` + `implicitStyles` 자식 배열 재정렬 label→track→value) + DOM(shared `Slider` `data-label-position` emit / `renderSlider` forward)
  - **Why**: ProgressBar/Meter `labelPosition="side"` 선례(2026-07-15)와 동형 통일. 사용자 명세 = side 일 때 Label · Track · Value 표시
  - live 검증(Chrome MCP): DOM Preview + Skia Canvas 양쪽 Label·Track·Value 가로 배치 대칭 확인 (side 전환 시 높이 32→20 축소 = 2행→1행)
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(Slider), `packages/shared/src/components/Slider.tsx`, `SelectionRenderers.renderSlider`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`(Slider 분기)

## [catalog prop parity 복원 종결 — ADR-915 Implemented] - 2026-07-16

> ADR-912(spec→catalog cutover)로 축소됐던 컴포넌트 편집 prop("프로퍼티 대량 소실") 복원의 마지막 잔여를 종결. 대부분은 07-15 "RAC/RSP 정합 감사"가 선행 복원했고, 본 세션은 남은 live·대칭 셀만 grep + Chrome MCP live 검증으로 복원.

### Bug Fixes

- **Slider "값 라벨 표시"(showValueLabel) 토글이 Builder(Skia)에서 안 먹던 비대칭** (ADR-915 P1.5-d):
  - showValueLabel=false 시 Preview(DOM)는 값 라벨을 숨기나 Builder Canvas(Skia)는 "50" 라벨이 남음
  - **Why**: `implicitStyles.ts` Slider 분기가 canonical prop `showValueLabel` 대신 존재하지 않는 레거시 이름 `showValue`(unified.types)를 읽어, SliderOutput 자식이 절대 필터링되지 않음. `resolveProgressProps`의 showValueLabel 체크는 ProgressBar/Meter 전용이라 Slider 미커버
  - 수정: `showValueLabel ?? showValue` 브리지 (canonical 우선 + 레거시 fallback)
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
  - 검증: Chrome MCP builder 에서 토글 off→on 양방향 CSS Preview·Skia Canvas 대칭 확인 (commit `566a712f5`)

### Features

- **NumberField `locale` + Slider `showValueLabel` 편집 prop 복원** (ADR-915 P1-g/P1.5-d):
  - NumberField `locale`: 숫자 포맷 로케일 편집 UI (renderNumberField 기소비 — DOM-live)
  - Slider `showValueLabel`: 값 라벨 표시 토글 (accepts + shared Slider 조건부 SliderOutput + renderSlider DOM forward)
  - 위치: `packages/shared/src/catalog/bindings/{NumberField,Slider}.binding.ts` / `packages/shared/src/components/Slider.tsx` / `packages/shared/src/renderers/SelectionRenderers.tsx`
  - 복원 원칙: live consumer grep 검증 후 복원(dead restoration 금지). form-common labelAlign/validationBehavior·Table columns/rows·P1-d defaultSelected·P1-e CheckboxGroup value 는 dead/redundant/asymmetric 으로 제외(결정 지점 ④ option A). Card asset(Skia 렌더 필요)·Image(신규 catalog 등록 필요)·0-2 TableView 명칭은 후속 분리
  - 상세: [ADR-915](adr/completed/915-catalog-prop-parity-restoration.md)

## [빌더 패널 Select focus ring 이중 표시·소실·깜빡임 수정] - 2026-07-16

### Bug Fixes

- **프로퍼티/스타일 패널 Select 의 focus ring 이 이중 표시되고, popover 열림/닫힘 시 소실·깜빡이던 문제**:
  - 3중 증상: (1) Tab focus 시 부모 Group ring + Select/Button 개별 ring 동시 표시(이중), (2) popover 열린 동안 부모 ring 소실(ComboBox 와 불일치 — ComboBox 는 열림-선택-닫힘 전 과정 유지), (3) 값 선택/트리거 재클릭 닫힘 시 ring 이 ~170ms 꺼졌다 켜지는 깜빡임.
  - **Why**: ① canvas 컴포넌트용 generated Select.css(unlayered)의 `[data-focus-visible]`/`[data-pressed]` outline 이 `@layer builder-system` 보다 cascade 우선이라 빌더 패널 컨텍스트로 leak — 패널 focus 설계(부모 `.react-aria-Group:focus-within` 단일 ring)와 충돌. ② Select 는 popover 열림 시 focus 가 ListBox(portal)로 이동해 `:focus-within` 을 잃음. ③ 닫힘 시 focus 가 body 로 낙하했다가 RAC FocusScope 복원까지 수십~수백 ms gap 동안 CSS 가 볼 수 있는 신호가 전부 꺼짐 (`data-focused` 도 리렌더 타이밍에 따라 해제 — 레이스라 CSS 단독 해결 불가).
  - 수정: ① form-controls.css 에서 Group 하위 Select/Button 의 `[data-focus-visible|pressed|focused]` outline 제거 (`!important` — unlayered leak 차단, Switch 기존 패턴과 동일). ② Group ring 조건에 `:has(.react-aria-Select[data-open])` + `[data-focused]` 추가 — popover 열린 동안 유지. ③ `useSelectTriggerFocusRestore` 훅 신설 — 닫힘 시 다음 frame(paint 직전)에 focus 가 popover 내부/body 미아 상태면 트리거로 복원. 외부 클릭으로 다른 컨트롤에 간 focus 는 강탈하지 않음(동기 무조건 복원은 focus 강탈 회귀 실측으로 기각). PropertySelect + PropertyDataBinding(소스/이름/갱신 모드 Select 3개) 적용.
  - 유사 패턴 전수 점검: GradientEditor/MeshGradientEditor(Fill popover portal — `.section` 밖이라 부모 ring 패턴 비대상), SelectionMemory·이벤트 패널 계열·SettingsPanel(부모 ring 없음) 해당 없음 판정. PropertyIconPicker(DialogTrigger 기반 인접 패턴)는 증상 미실측으로 보류.
  - 검증: Chrome MCP 실빌더 rAF 프레임 레코더 — Tab focus 단일 ring, popover 열림 중 ring 유지, 값 선택/재클릭 닫힘 시 ring off ~~170ms → 0~~1 frame(인지 불가), 외부 클릭 시 RAC 기본 동작 보존. type-check PASS.
  - 위치: `apps/builder/src/builder/components/styles/form-controls.css`, `apps/builder/src/builder/components/property/{PropertySelect,PropertyDataBinding}.tsx`, `apps/builder/src/builder/components/property/useSelectTriggerFocusRestore.ts`(신규)

## [추가 Fill(FillLayerRow) 팝오버 24px 붕괴 수정] - 2026-07-16

### Bug Fixes

- **추가 Fill(2번째~)의 swatch 클릭 시 편집 팝오버가 24px 로 붕괴하던 문제**:
  - primary Fill 은 `FillSection` 의 `color-swatch-button`(Background fieldset 을 채워 ≈180px)이 trigger 라 팝오버가 180px 로 정상. 추가 Fill 은 `FillLayerRow` 의 24px swatch(`fill-layer-row__swatch-btn`)가 trigger 인데, 두 진입점이 **같은 `.fill-detail-popover-container` Popover** 를 쓰고 그 폭이 `width: var(--trigger-width)` 라 24px trigger → 팝오버가 24px 로 붕괴해 편집 불가였다.
  - **Why**: 2026-07-15 "팝오버 폭 = 호출자 폭" 변경이 primary(180px swatch)만 상정했고, 24px swatch 진입점을 놓쳤다.
  - 수정: `.fill-detail-popover-container.react-aria-Popover` 에 `min-width: 180px` 추가. primary 는 이미 180px 라 불변, 24px trigger 만 180px 로 복원 → 두 진입점 동일 폭.
  - 검증: Chrome MCP 실빌더 — FillLayerRow swatch 팝오버 computed `min-width: 180px` / `width: 180px`(rendered ≈171px, 우측 경계 shift), FillTypeSelector·컬러영역·HEX·Blend 전체 콘텐츠 정상 렌더 확인.
  - 위치: `apps/builder/src/builder/panels/styles/components/FillLayerRow.css`

## [Fill 팝오버 FillTypeSelector 선택 배경 검정 회귀 수정] - 2026-07-16

### Bug Fixes

- **Fill 팝오버의 indicator ToggleButtonGroup(FillTypeSelector 등) 선택 버튼 배경이 검정으로 표시되던 문제**:
  - Background swatch 클릭 시 열리는 팝오버에서 Color/Gradient/Image 탭(및 Gradient subtype)의 활성 버튼 배경이 검정으로 나타났다. 정상은 Layout 섹션 Direction 그룹과 동일한 밝은색(`--bg-overlay`) 칩.
  - **Why**: indicator 모드 `SelectionIndicator` 는 `button-base`(`background: var(--button-color)`)로 칠해진다. 선택된 ToggleButton 은 components layer 에서 `--button-color: var(--fg)`(라이트모드 검정). Layout Direction 그룹은 `[data-context="builder"]`(inspector-layout.css, `@layer builder-system`)의 `--button-color: var(--bg-overlay)` 오버라이드로 정상 표시되지만, 팝오버는 RAC portal 로 `[data-context="builder"]` **밖으로 렌더**되어 이 오버라이드를 못 받아 검정 `--fg` 가 SelectionIndicator 에 상속됐다.
  - 수정: `.fill-detail-popover-container` 스코프에 동일 오버라이드(`--button-color: var(--bg-overlay)` + `--btn-border-radius: var(--radius-sm)`) 복원. 특정도 0-4-0 > default-selected 0-3-0 (같은 `@layer components`).
  - 검증: Chrome MCP 실빌더 — 선택된 SelectionIndicator 배경 computed = `oklch(0.985 0 0)`(bg-overlay, 밝음), `--fg`(oklch 27.8%, 검정) 아님. 확대 스크린샷으로 밝은 raised 칩 확인.
  - 위치: `apps/builder/src/builder/panels/styles/components/FillLayerRow.css`

## [Fill 팝오버 gradient Center/Radius 를 grid-template-areas 나란히 배치] - 2026-07-16

### Features

- **gradient Center X/Y·Radius Width/Height 를 grid-template-areas 로 나란히 2열 배치** (직전 full-width 세로 스택 → 쌍 나란히):
  - Center X/Y 가 한 행, Radius Width/Height 가 한 행에 나란히. gradient 타입마다 컨트롤 구성이 달라 타입별 areas 를 정의 — Radial `"cx cy" / "rw rh"`, Angular `"cx cy" / "rot rot"`, Linear `"rot rot"`. 단일 값 Rotation 은 2열 전체 폭.
  - 열은 `1fr 1fr` 균등 — 직전 시도의 `auto 1fr` 은 오른쪽 열(Center Y·Radius Height)이 좁아 값이 잘렸다. GradientControls 컨테이너에 타입별 클래스(`gradient-controls--{type}`) + 각 필드에 `grid-area` 부여.
  - 검증: Chrome MCP 실빌더 — radial 팝오버에서 Center X/Y(30/40)·Radius Width/Height(60/50)가 나란히 배치되고 값이 잘림 없이 표시됨을 확인.
  - 위치: `apps/builder/src/builder/panels/styles/components/GradientControls.tsx`, `GradientControls.css`

## [Fill 팝오버 gradient Center/Radius 를 PropertyUnitInput 으로 통일] - 2026-07-16

### Features

- **gradient Center X/Y·Radius Width/Height 입력을 ScrubInput 에서 PropertyUnitInput 으로 교체** (rotation 통일 후속):
  - Radial(Center X/Y + Radius W/H)·Angular(Center X/Y) 의 6개 ScrubInput 을 PropertyUnitInput 으로 전환 — 이로써 gradient 팝오버의 **모든 수치 입력이 패널 표준 컴포넌트**(Padding/blend/rotation 계열)로 통일된다. `ScrubInput` import 제거.
  - 단위 `%`, 축 아이콘(lucide `MoveHorizontal`=가로 X·Width / `MoveVertical`=세로 Y·Height), `allowKeywords=false`, min 0 / max 100.
  - 레이아웃: `GradientControls.css` 의 grid(`auto 1fr`) → `flex-direction: column` full-width 세로 스택. **Why**: 이전 grid 는 오른쪽 열(Center Y·Radius Height)이 좁아 값이 잘려 안 보였다. ScrubInput 전용 `__label`/`__row`/`__scrub` 등 클래스 제거.
  - 검증: Chrome MCP 실빌더 — radial 팝오버에서 Center X/Y(30/40)·Radius W/H(60/50) 4개가 full-width PropertyUnitInput(축 아이콘+값+chevron)으로 렌더되고 값이 정확히 표시됨을 확인.
  - 위치: `apps/builder/src/builder/panels/styles/components/GradientControls.tsx`, `GradientControls.css`

## [Fill 팝오버 gradient Rotation 을 PropertyUnitInput 으로 통일] - 2026-07-16

### Features

- **Fill 편집 팝오버의 gradient Rotation 입력을 ScrubInput 에서 PropertyUnitInput 으로 교체** (Linear / Angular):
  - blend(PropertySelect)와 동일한 property 계열 — Padding(`PropertyUnitInput`)과 같은 컴포넌트로 `fieldset` + `legend` + 아이콘(lucide `RotateCw`) + 값 + 단위 dropdown 구조를 통일한다.
  - 단위는 CSS 표준 `deg` — `PropertyUnitInput` 의 `parseUnitValue` 단위 정규식이 `[a-z%]+` 라 `°` 기호를 파싱하지 못하기 때문. `allowKeywords=false`, min 0 / max 360.
  - Radial 의 Center/Radius, Angular 의 Center 는 요청 범위 밖이라 ScrubInput 유지(Angular 는 Center=ScrubInput + Rotation=PropertyUnitInput 혼재).
  - 검증: Chrome MCP 실빌더 — Rotation fieldset(legend "Rotation") + RotateCw 아이콘 렌더 + "90" 입력 시 store `rotation` 반영·input 표시값 갱신 확인.
  - 위치: `apps/builder/src/builder/panels/styles/components/GradientControls.tsx`

## [Fill 팝오버 Blend 셀렉터를 PropertySelect 로 통일] - 2026-07-16

### Features

- **Fill 편집 팝오버의 Blend 모드 셀렉터를 네이티브 `<select>` 에서 PropertySelect 로 교체**:
  - 패널의 다른 enum 필드(Border Style / Box Shadow / Overflow)와 동일한 `PropertySelect` 사용 — Padding(`PropertyUnitInput`)과 같은 `components/property/` 폴더 자매 컴포넌트로, `fieldset` + `legend` + 아이콘 + 컨트롤 구조를 통일한다(chevron 포함 RAC Select).
  - BLEND_MODE_OPTIONS 12종을 `styleOptions.ts` 로 이동(다른 옵션 상수와 동일 위치). 아이콘은 lucide `Blend`.
  - 검증: Chrome MCP 실빌더 — Blend fieldset(legend "Blend") 렌더 + dropdown 12옵션 표시 + Multiply 선택 시 store `blendMode` 반영·버튼 텍스트 갱신 확인.
  - 잔존: 기존 `BlendModeSelector.tsx` / `.css` 는 사용처 0건(dead) — 파일 삭제는 사용자 승인 후 별도.
  - 위치: `apps/builder/src/builder/panels/styles/components/FillDetailPopover.tsx`, `constants/styleOptions.ts`

## [Background 컬러 피커 popover 폭 정렬 — 호출자(swatch) width] - 2026-07-15

### Features

- **Background 컬러 피커 popover 폭을 호출자(swatch 버튼) width 에 정렬** (기존 244px 고정 → 180px, 좌측 정렬):
  - padding/border 4-way 편집 블록이 각자 섹션 컨텐츠 폭을 채우는 것과 동형. swatch 버튼이 Background fieldset 을 꽉 채우므로(180px), RAC 가 노출하는 `--trigger-width`(trigger 기준)를 popover width 로 써서 동일 컬럼 폭 + 좌측 정렬로 뜬다. 내부 컬러 피커도 그 폭에 맞춰 늘어난다.
  - **Why**: 기존 `.fill-detail-popover-container.react-aria-Popover { width: 244px }` 하드코딩(specificity 0,2,0)이 호출 컨텍스트와 무관한 고정 폭이었다. `--trigger-width` 는 fill 타입(Color↔Gradient)이 바뀌어도 trigger(swatch)가 안 변해 고정 — 기존 244px 의 "전환 시 위치 점프 방지" 목적도 그대로 유지된다.
  - FillSection(Background) + FillLayerRow(추가 레이어) popover 가 같은 클래스라 각자 자기 trigger 폭으로 정렬된다.
  - 위치: `apps/builder/src/builder/panels/styles/components/FillLayerRow.css`

## [ProgressBar/Meter Label Position=side — 레이블 가로 배치 D3 구현] - 2026-07-15

### Features

- **ProgressBar/Meter Label Position 편집 + side 레이아웃**:
  - 프로퍼티 패널 Appearance 에 Label Position(top/side) 편집 속성 추가 (RAC/RSP 정합 감사 후속).
  - `side` = **Label · Track(진행 막대) · Value** 가로 한 줄 배치 (기존 `top` 은 label+value 윗줄 / bar 아랫줄 2단 grid).
  - **Why**: 정합 감사 시 labelPosition 이 D3 시각 소비 경로 없어 dead 편집 UI 로 제거됐던 것을, CSS+Skia 대칭 구현 완료 후 재노출.
  - CSS(Preview DOM): catalog `componentRulesTable` 의 ProgressBar/Meter `containerVariants["label-position"].side` (structure.composition=DOM / top-level=Skia) → generated CSS `display:flex; flex-direction:row` + `.bar{order:1;flex:1}` + `.value{order:2}`.
  - Skia(빌더 캔버스): `implicitStyles` ProgressBar/Meter 분기가 side 일 때 자식 배열을 `label→track→value` 재정렬 + 부모 grid→flex-row 전환 (fullTreeLayout order sort 가 store 원본만 읽어 주입 order 미반영이라 배열 재정렬로 대칭 확보).
  - factory inline `display:grid` 제거 (NumberField ADR-913 정정 동형 — inline specificity(1-0-0)가 generated CSS `[data-label-position="side"]`(0-2-0)를 이기던 근본 차단 해소).
  - live 검증(Chrome MCP): Preview DOM `display:flex` label→bar→value + Skia layout Label(x0)→Track(x68)→Value(x320) 대칭 확인.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`, `apps/builder/src/builder/factories/definitions/DisplayComponents.ts`, `packages/shared/src/components/Meter.tsx`

## [컬러 피커 UI 간결화 — 입력 모드 3종 + 얇은 hue/alpha 슬라이더] - 2026-07-15

### Features

- **컬러 피커 입력 모드를 HEX / RGBA / CSS 3종으로 축소** (HSL / HSB 숨김):
  - HSL / HSB 는 동일 내부값(`#RRGGBBAA`)의 표기 변환 뷰일 뿐 표현 가능한 색 집합이 동일 — 셀렉터에서만 숨겼고 `ColorInputMode` 타입·변환 함수(`hex8ToHsl` 등)는 보존해 마이그레이션/소비처 영향 없음. CSS 모드는 named color·외부 CSS 문자열 붙여넣기 유일 관로라 유지.
  - 위치: `apps/builder/src/builder/panels/styles/components/ColorInputModeSelector.tsx`
- **색조(hue)·알파 슬라이더 트랙 높이 28→8px 축소**:
  - 피커 상단 두 슬라이더를 얇게 조정. 피커로 scope 된 오버라이드라 공용 `ColorSlider` 다른 사용처(GradientBar 등)에는 영향 없음.
  - 위치: `apps/builder/src/builder/panels/styles/components/ColorPickerPanel.css`

## [Publish body 아트보드 정합 — ElementRenderer body 노드 min-height:100vh (preview 정합 후속)] - 2026-07-15

### Bug Fixes

- **Publish 에서 세로 중앙정렬 body 의 콘텐츠가 뷰포트 대신 collapse 박스 최상단에 갇히던 비대칭** (preview 정합 `ed96db23a` 후속):
  - **Why**: publish 도 canonical body 노드를 중첩 `<div>` 로 렌더하며 height 없는 style 만 얹어 content-fit 로 collapse 한다. `useBodyElement` 이 body 스타일을 실제 `<body>` 태그에 주입해 **배경은 실제 body 가 뷰포트를 채워 정상**이지만, **세로 중앙정렬(flex + justifyContent:center)·자식 height:100%** 처럼 body 박스 높이에 의존하는 레이아웃은 실제 body 가 마스킹하지 못한다. 라이브 실측: flex-center body(minHeight 미지정) 자식이 뷰포트 중앙(y494) 대신 collapse 박스(h34) 최상단(y17)에 갇힘 → Skia(전체 아트보드 중앙) 와 발산.
  - 수정: `ElementRenderer` 에서 `type==="body"` & 사용자 height/minHeight 미지정 시 `min-height:100vh` 주입(preview `CanonicalNodeRenderer` 와 동일 규칙). 라이브 재검증: 중첩 body div 34→988(100vh), 자식 y17→477(중심 494=뷰포트 중앙).
  - 범위: publish 앱은 vitest 인프라 부재 → live(Chrome MCP) + type-check 검증. preview 회귀 테스트가 동일 로직 패턴 커버.
  - 위치: `apps/publish/src/renderer/ElementRenderer.tsx`

## [패널 Appearance dirty/reset/컬러 피커 정리 — 배경(fills) dirty 소스화 + boxShadow/overflow 정합] - 2026-07-15

### Bug Fixes

- **배경을 fills 로만 바꾸면 Appearance 리셋 버튼이 안 뜨던 결함 (M1)**:
  - **Why**: 배경이 canonical `fills` 필드로 이관된 뒤 dirty 판정(`computeDirtyStyleProps`)이 `props.style` 만 검사 → color/gradient/image fill 변경이 감지 안 됨.
  - 수정: fills 로 effective style 을 adapt(color→backgroundColor 비교)하고, gradient/image fill 은 backgroundImage 라 색이 surface 안 되므로 별도 dirty 표시.
  - 위치: `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`
- **Appearance 리셋 시 배경(fills)이 undo 로 복원 안 되고, fills 가 없어도 무조건 비우던 결함 (M2)**:
  - **Why**: `updateAndSave` 의 history 가 props-only update event 라 canonical 1차 필드인 fills 를 버렸다(`replaceNodeProps` 가 props 만 교체). handleReset 은 fills 유무와 무관하게 `updateSelectedFills([])` 를 호출해 스퍼리어스 history/mutation 을 남겼다.
  - 수정: fills 변경을 replace event(full node, instance mirror 와 동일 경로)로 기록해 undo/redo 배경 복원. handleReset 은 fills 가 non-empty 일 때만 삭제.
  - 위치: `apps/builder/src/builder/stores/inspectorActions.ts`, `panels/styles/sections/AppearanceSection.tsx`
- **Box Shadow 를 한 번 만지면 영구 dirty 이고 Reset 이 "none" 을 기록하던 결함 (M3)**:
  - **Why**: PropertySelect 가 Reset("reset")→onChange("") 로 변환하는데 box-shadow onChange 가 ""(Reset)·"none" 을 모두 "none" 으로 기록 → baseline 부재와 결합해 영구 dirty. dirty baseline(`resolveSpecStyleDefaults`)에 boxShadow/borderStyle 축 자체가 없었다.
  - 수정: Reset("")→inline 키 삭제(baseline 복귀), "none"→명시 "none" 기록. dirty baseline 에 boxShadow(?? none)/borderStyle(?? solid) 추가(factory 가 두 축을 inline 주입 안 하므로 fallback 안전).
  - 위치: `panels/styles/sections/AppearanceSection.tsx`, `panels/styles/hooks/useResetStyles.ts`
- **비프리셋 그림자(import/paste 된 임의 CSS)가 Select 에서 빈 선택으로 표시되던 결함 (M4)**:
  - 수정: 현재 boxShadow 가 알려진 프리셋이 아니면 동적 "custom" 항목을 추가해 표시.
  - 위치: `panels/styles/sections/AppearanceSection.tsx`
- **borderStyle/boxShadow/overflow 가 컴포넌트 catalog 기본값을 무시하고 항상 solid/none/visible 로 고정 표시 + overflow 에 Reset 항목 부재 (M5)**:
  - **Why**: appearance preset 이 이 3축을 catalog containerStyles 에서 읽지 않았다.
  - 수정: `AppearanceSpecPreset` + `appearanceFromContainerStyles` 확장(camel-normalized). 표시값 우선순위 inline > catalog > 하드코딩. `OVERFLOW_OPTIONS` 에 Reset 항목 추가(auto 는 실 CSS 값이라 별도).
  - 위치: `panels/styles/utils/specPresetResolver.ts`, `panels/styles/hooks/useAppearanceValues.ts`, `panels/styles/constants/styleOptions.ts`
- **컬러 피커가 색 확정(커밋)마다 열린 popover 가 닫히던 결함 (M6)**:
  - **Why**: `ColorPickerInner` 의 key 에 value 를 포함 → 커밋마다 재마운트 → DialogTrigger open 상태 소실.
  - 수정: key 를 selectedElementId 단독으로 축소(요소 전환 시에만 remount), 외부 value 는 useEffect 로 로컬 상태 동기화 + hex Input focus 중 스킵 가드(PropertyUnitInput 계약 정합).
  - 위치: `apps/builder/src/builder/components/property/PropertyColor.tsx`
- 검증: 회귀 테스트 확장(useResetStyles boxShadow/borderStyle/fills dirty + useAppearanceValues catalog 표시 + inspectorFills fills replace event) 총 74 통과, type-check PASS(baseline 67). Chrome MCP 실빌더 — Box Shadow md→Reset 시 none 복귀 + modify 카운트 감소(영구 dirty 아님), Overflow 드롭다운 Reset 항목 노출, 컬러 popover 다중 커밋 유지, 배경 fill 추가 후 undo(제거)/redo(복원) 확인.

## [boxShadow / overflow Skia 배선 복원 — spec·catalog 경로 effects/clip/scroll 공급] - 2026-07-15

### Bug Fixes

- **boxShadow(그림자)와 overflow(클리핑·스크롤)가 Preview DOM 에는 적용되나 Builder Skia 캔버스에서 무반응이던 결함 — 렌더러 능력은 있고 공급 배선만 끊긴 구조를 복원 (Phase 1~3)**:
  - **Why**: Skia 렌더 계약(`renderCommands`)은 `SkiaNodeData.effects`(→`beginRenderEffects`, drop-shadow 다중 지원) / `clipChildren`(→`CMD_CHILDREN_BEGIN` clip rect) / `scrollOffset`+`scrollbar`(→자식 좌표 이동 + 스크롤바)를 이미 소비하고 있었고, box 경로(`buildBoxNodeData`)는 이 필드들을 채웠다. 그러나 대다수 컴포넌트가 지나는 spec/catalog 경로(`buildSpecNodeData`)는 이 3필드를 전혀 방출하지 않았고(그림자·클리핑 소실), 스크롤은 box·spec 양 경로 모두 `StoreRenderBridge` 가 `scrollState` 를 미전달해(sprite 시대 배선이 bridge 이관 때 탈락) `scrollOffset`/`scrollbar` 산출 자체가 불가했다. hit-test 만 `scrollVersion` 을 반영해 렌더↔인터랙션 split-brain 상태였다.
  - 수정 (Phase 1 — boxShadow): `buildSpecNodeData` 가 box 경로와 동일 파서 `buildSkiaEffects(style)` 로 CSS effects(boxShadow→drop-shadow, filter→blur/color-matrix, opacity, backdrop-filter)와 blendMode 를 node 에 접붙임. transform 은 transform-origin 보정이 별도 필요해 제외.
  - 수정 (Phase 2 — overflow 클리핑): `buildSpecNodeData` 가 overflow hidden/clip/scroll/auto 에서 node-level `clipChildren=true` 설정(box 경로와 동일 계약). 기존 텍스트 `clipText` 는 spec 내부 텍스트만 잘라 요소 자식 클리핑에는 별도 필요.
  - 수정 (Phase 3 — overflow 스크롤): `SpecBuildInput.scrollState` 추가 + `buildSpecNodeData` 가 `scrollOffset`/`scrollbar` 산출(box 경로 `buildBoxNodeData:175-204` 와 동일 계약). `StoreRenderBridge.buildNodeForElement` 가 `useScrollState.scrollMap` 에서 조회해 spec/box 3 호출부에 공급. bridge 가 `useScrollState` 를 구독 → wheel(`scrollBy`)로 scrollTop/scrollLeft 변경 시 해당 요소만 `incrementalSync` 재빌드(`registerSkiaNode` 가 `registryVersion` 을 올려 command stream 갱신). maxScroll(콘텐츠 크기) 변경은 layout publish(fullRebuild)가 커버. `canvas-rendering.md §8`(자식 boundsMap scrollOffset 차감 + scrollVersion 캐시 무효화) 계약 준수.
  - 검증: 단위·회귀 테스트 16건(effects 5 + clipChildren 6 + scroll 5) + type-check PASS(baseline 67). Chrome MCP 실빌더 — Form 컨테이너에 boxShadow(빨간 그림자) → 캔버스 렌더 확인, overflow:hidden → 자식 110px 클리핑, overflow:scroll → 스크롤바 썸 렌더 + 휠 스크롤 시 내용 이동 + 썸 이동(hit-test 정합) 확인, 좌(CSS Preview)·우(Skia 캔버스) 그림자·클리핑·스크롤바 시각 대칭 확인.
  - 위치: `apps/builder/src/builder/workspace/canvas/skia/{buildSpecNodeData,StoreRenderBridge}.ts`

## [Border 편집 gate 정합 — 편집기 계약(companion write) + border-style 3경로 배선] - 2026-07-15

### Bug Fixes

- **Appearance 의 border 편집(color/width/radius/style)이 컴포넌트·경로별로 되다 안 되다 하던 결함 — DOM/Skia 경로별 gate 편차 전면 정합**:
  - **Why**: 테두리는 CSS 상 width/color/style 3속성이 모두 갖춰져야 보인다. CSS `border-style` 초기값이 `none` 이라 style 패널에서 borderColor/borderWidth 만 인라인으로 써도 Preview DOM 은 테두리를 그리지 않았고, 생성 CSS 가 border-style 을 선언한 컴포넌트(Card/ListBox, Button `.button-base`)만 보이고 border-style 부재인 TextField root·Frame(CSS 부재)은 무반응이었다. Skia 3경로도 그리기 gate 가 서로 달랐다 — catalog(`buildCatalogShapes`)는 borderColor 필요, spec(`applyInlineBorderOverlay`)은 width+color 동시 필요(+radius 가 이 gate 뒤라 radius 단독 무반응), box(`buildBoxNodeData`)는 strokeStyle 키 자체 미방출. borderStyle 은 사용자 style 이 catalog/spec/box 어디에서도 소비되지 않아 렌더러가 8종 전부 지원함에도 solid 로만 그려졌다.
  - 수정 (편집기 계약, Figma 류): borderColor/borderWidth/borderStyle 중 하나를 처음 설정할 때 나머지 축의 기본값(style:solid / width:1 / color:`#d4d4d4`=lightColors.border)을 store 인라인 style 에 동반 기록. SSOT(store) 단일 지점에 불변식을 두어 DOM/Skia 4경로가 항상 동일한 3필드를 받게 하여 경로별 gate 편차를 구조적으로 소멸. 기본 color 는 고정 hex 라 DOM↔Skia 동일 값으로 시각 대칭. `borderStyle="none"` 은 테두리 숨김 의도이므로 companion 미주입.
    - 위치: `apps/builder/src/builder/stores/utils/borderCompanionDefaults.ts` (신규), `stores/inspectorActions.ts` (updateSelectedStyle/updateSelectedStyles/updateSelectedStylePreview 배선)
  - 수정 (border-style 3경로 공통 소비): 우선순위 사용자 style → catalog visual → 기본 solid. `none` 은 4경로 모두 테두리 숨김으로 대칭.
    - catalog: `buildCatalogShapes` 가 `visual.borderStyle` 만 읽던 것을 사용자 `style.borderStyle` 우선으로 정정 + none 시 border shape 미생성. `BorderShape.style` 타입을 렌더러 지원 8종(`BorderStyleValue`: solid/dashed/dotted/double/groove/ridge/inset/outset)으로 확장.
    - spec: `applyInlineBorderOverlay` 의 borderRadius 반영을 width+color gate 앞으로 분리(radius 단독 반영 회복) + `none` 조기 종료 + strokeStyle 캐스트를 협소한 `"dashed"|"dotted"` → 8종으로 정정.
    - box: `buildBoxNodeData` 가 `box.strokeStyle` 키를 방출(div dashed/dotted 등 렌더) + `none` 시 stroke 억제.
    - 위치: `packages/specs/src/renderers/buildCatalogShapes.ts`, `packages/specs/src/types/shape.types.ts`, `apps/builder/src/builder/workspace/canvas/skia/{buildSpecNodeData,buildBoxNodeData}.ts`
  - 검증: 단위·회귀 테스트 18건(companion 계약 8 + catalog borderStyle 5 + box borderStyle 4 + spec static guard 1) + specs 렌더러 362 + skia 129 회귀 통과, type-check PASS(baseline 67). Chrome MCP 실빌더 — Button(catalog)·TextField(catalog)·frame(spec)·Box(box) 4종에 color/width/radius/style 시나리오 적용, 편집기 계약 매트릭스(color→+solid+w1 / width→+solid+color / radius→border無 / style=dashed→+w1+color) 4경로 동일 확인 + dashed/dotted/radius 테두리가 Skia 캔버스 ↔ CSS Preview 시각 대칭 렌더 확인.

## [Gradient fill Skia 렌더 복원 — catalog/spec 경로 FillStyle 채널 + angular/radial 정합] - 2026-07-15

### Bug Fixes

- **gradient fill(linear/radial/angular/mesh)이 CSS(Preview)에서만 렌더되고 Skia 캔버스에는 미표시되던 결함**:
  - **Why**: catalog/spec 경로(`buildSpecNodeData`)의 배경 채널이 단색 전용(hex6 `backgroundColor` + `_fillBgAlpha`)이라 비-color fill 이 소거됨. 렌더러 자체는 `SkiaNodeData.box.fill: FillStyle` 채널 + `applyFill`(mesh 는 RuntimeEffect)로 이미 gradient 를 지원 — box 경로(`buildBoxNodeData`)만 이 채널을 쓰고 있었다.
  - 수정: `buildSpecNodeData` 가 `specShapesToSkia` 변환 직후 top enabled 비-color fill 을 `fillsToSkiaFillStyle(fills, w, h)` 로 변환해 최상위 `box.fill` 에 접붙임 (box 경로와 동일 계약 — shader 성공 시 fillColor 무시). gradient 단독 fills 는 `fillsToSkiaFallbackColor`(첫 stop/point 색)를 hex6 채널에 주입해 bg box 방출(border-radius 해소) + shader 실패/이미지 로딩 중 graceful fallback 확보.
- **angular gradient 의 rotation 이 Skia 에서 무시되어 CSS `from Ndeg` 와 시작 각도가 어긋나던 결함**:
  - **Why**: `angularGradientFillItemToSkia` 의 localMatrix 가 -90° 고정 행렬 — `item.rotation` 미소비.
  - 수정: θ = rotation − 90° 일반 회전 행렬로 교체 (rotation=0 은 기존 -90° 보정과 동치 — 회귀 테스트로 고정).
- **radial gradient 의 radius 가 DOM 에서 소거되고 Skia 는 원형 근사라 falloff 크기가 양 경로 모두 fill 모델과 어긋나던 결함**:
  - **Why**: DOM 어댑터가 `circle`(farthest-corner) 고정 출력으로 radius 미반영, Skia 는 `max(rx, ry)` 원형 근사.
  - 수정: DOM 은 `radial-gradient(rw% rh% at cx% cy%, ...)` ellipse 크기 명시(radius 무효 시 기존 circle 보존), Skia 는 `RadialGradientFill.matrix`(localMatrix) 신설 + y-scale(ry/rx) 로 타원 표현 — `MakeTwoPointConicalGradient` 8번째 인자로 전달.
- 검증: 단위 테스트 19건(buildSpecNodeData 4 + fallbackColor 6 + gradient 행렬 7 + fillAdapter radial 2) + Chrome MCP 실빌더 — body 요소에 linear(135°)/radial(center 30/30, 타원 60/50)/angular(45°)/mesh(2×2 4색) 순차 설정, 4종 모두 좌(CSS Preview)·우(Skia 캔버스) 시각 동일 확인.
- 잔존 한계: catalog 컴포넌트의 image fill 은 캐시 히트 후 렌더(box 경로와 동일), image/mesh 의 fill-level opacity 미표현(기존과 동일) — 후속 과제.
- 위치: `apps/builder/src/builder/workspace/canvas/skia/{buildSpecNodeData,fills,types}.ts`, `apps/builder/src/builder/panels/styles/utils/fillToSkia.ts`, `packages/shared/src/utils/fillAdapter.ts`

## [Background(fills) alpha 채널 복원 — 반투명 fill 불투명 렌더 수정] - 2026-07-15

### Bug Fixes

- **fill 의 alpha(hex 8자리 alpha × fill-level opacity)가 캔버스/Preview 렌더에서 소거되어 반투명 배경이 불투명으로 표시되던 결함**:
  - **Why**: `fillsToCssBackgroundStyle` 의 color 분기가 `toHex6` 로 hex8 의 alpha 를 절단하고 `fill.opacity` 도 미소비 — 커밋(store fill `#86326329`, alpha 16%)은 정상인데 Preview computed 는 `rgb(134,50,99)` (불투명). Skia 변환기(`fillToSkia`)는 alpha 를 정상 적용하므로 DOM↔Skia 대칭 위반이기도 했고, catalog Skia 채널은 이 CSS 산출(hex6)을 주입받아 캔버스도 불투명이었다.
  - 수정:
    - DOM: color 분기가 합성 alpha(hex alpha × opacity) < 1 이면 `rgba()` 로 emit (불투명은 기존 hex6 유지). gradient stop alpha 도 동일 수정 — Skia 는 이미 stop alpha 적용이라 대칭 회복.
    - Skia catalog: 색 문자열 채널은 hex6 전용(hex8 은 `hexStringToNumber` 채널 시프트가 어긋남)이라, builder 주입부가 `fillsToSkiaFillColor` 결과를 hex6 `backgroundColor` + 데이터 키 `_fillBgAlpha` 로 분해 전달하고 `buildCatalogShapes` 가 bg shape `fillAlpha` 에 곱함 (ADR-142 §3 데이터 분기).
  - 검증: 단위 테스트 5건(adapter 3 + catalog 2) + Chrome MCP 실빌더 — alpha 71% fill 이 Preview computed `rgba(191,107,156,0.71)` + Skia 캔버스 동일 반투명 렌더 확인.
  - 잔존 한계: image/mesh fill 의 fill-level opacity 는 양 경로 모두 미표현 (기존과 동일) — 후속 과제.
  - 위치: `packages/shared/src/utils/fillAdapter.ts`, `packages/specs/src/renderers/buildCatalogShapes.ts`, `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`

## [컬러 피커 HEX 입력 관용 — bare hex 조용한 원복 수정] - 2026-07-15

### Bug Fixes

- **컬러 피커 HEX 필드에 `#` 없이 hex 를 입력하면 조용히 이전 색으로 원복되던 결함**:
  - **Why**: `HexFields` 가 입력값을 `normalizeToHex8` 로 바로 넘기는데, `#` 없는 bare hex ("FF3B30")는 유효 CSS 색이 아니라 colord 검증에서 탈락 → fallback(이전 값) 반환 → **이전 색이 그대로 재커밋**되어 사용자 입력이 무시된 것처럼 보임 (에러 표시도 없음).
  - 수정: HEX 입력 필드 전용 `normalizeHexInputToHex8` 신설 — 공백 trim + 3/4/6/8자리 bare hex 에 `#` 보충 후 기존 정규화 위임. `normalizeToHex8` 자체는 CSS 값 일반 정규화(마이그레이션 소비처) 의미 보존을 위해 무변경.
  - 검증: 단위 테스트 7건 + Chrome MCP 실빌더 — bare hex `FF3B30` 입력 → fill `#FF3B30FF` 커밋 → Skia/Preview/스와치/피커 동기화 확인.
  - 위치: `apps/builder/src/builder/panels/styles/utils/colorUtils.ts`, `components/ColorInputFields.tsx`

## [Background(fills) canonical 파이프라인 복원 — Appearance 배경 기능 전면 복구] - 2026-07-15

### Bug Fixes

- **Appearance > Background(fills) 기능 전체가 canonical 전환(ADR-116/122) 이후 죽어 있던 결함 — 5개 층 절단 전면 복원**:
  - **Why**: canonical 문서 전환 때 `element.fills` 가 이관되지 않아 (1) 쓰기: canonical node 에 fills 미탑재(`metadata.legacyProps` 격리 보존만, 복원 경로 0건), (2) 읽기: canonical→Element 파생이 `fills: undefined` 하드코딩 → 커밋 직후 스와치 리셋 + 구조 변경 1회에 fills 소거, (3) Preview: `fills: []` 하드코딩이 truthy 빈 배열로 사용자 `style.background*` 까지 능동 소거, (4) Skia: canonical scene node 가 fills 미운반 → 캔버스 미반영, (5) 패널: 표시(canonical, 빈 값) vs 액션(legacy elementsMap, 실값) 소스 분열 → 드래그마다 addFill 중복 누적.
  - 수정 (schema 위치는 사용자 confirm 으로 **canonical 1차 필드** 확정 — Pencil fill 6종 개념 정합, `theme` 노드 레벨 선례):
    - 쓰기·읽기: `CanonicalNode.fills` 1차 필드 신설 + `legacyElementToCanonicalNode` 탑재 + `canonicalNodeToElement` 복원(구 문서는 `metadata.legacyProps.fills` fallback 승격)
    - Preview: `CanonicalNodeRenderer` fills 운반 + `adaptStyleWithFills` 빈 배열=fills 없음 semantics 정정
    - Skia: `CanvasSceneNode.fills` 운반 + catalog 배경 채널 소비(우선순위 fills > style.backgroundColor, color fill 한정) + ADR-136 projection signature 에 fills 등재
    - 패널: `getCurrentFills` canonical 우선 통일 + `ensureColorFill`(create-or-update) 로 가상 fill 승격 중복 append 구조적 차단
  - 검증: canonical 왕복 회귀 테스트 16건 신규 + Chrome MCP 실빌더 exercise — 배경 설정 → 캔버스(Skia)/Preview(DOM) 대칭 반영 → 자식 추가(구조 변경) 생존 → 새로고침(IndexedDB persist/hydrate) 생존 확인
  - 잔존 한계: catalog 컴포넌트의 gradient/image fill 은 Skia catalog shape 채널이 색상 전용이라 미표현(box 경로는 전체 fill 모델 지원) — 후속 과제
  - 위치: `packages/shared/src/types/composition-document.types.ts`, `apps/builder/src/adapters/canonical/canonicalMutations.ts`, `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`, `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`, `packages/shared/src/utils/fillAdapter.ts`, `apps/builder/src/builder/workspace/canvas/scene/{canvasSceneNode,buildSceneSnapshot}.ts`, `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`, `apps/builder/src/builder/panels/styles/{hooks/useFillActions.ts,sections/FillSection.tsx}` (commit: 5eb7cb7fd~2ff56825f 4-phase)

## [Preview body 아트보드 정합 — canonical body 노드 min-height:100vh] - 2026-07-15

### Bug Fixes

- **canonical Preview 에서 body 박스가 아트보드 높이를 채우지 못하고 content 로 collapse 하던 비대칭**:
  - **Why**: canonical DOM 렌더 경로는 body 노드를 중첩 `<div>` 로 렌더하며 `element.props.style`(height 無)만 얹어 `display:block` content-fit 로 collapse(실측 96px). 반면 Skia(Builder)는 layout map 의 body 높이(페이지 프레임 844px)를 그대로 그린다 → body 박스 자체가 844 vs 96 으로 갈림. 콘텐츠 좌표는 layout map 공유로 완전 일치(Text/Avatar x/y/w/h byte-identical)하나, **body 배경/테두리가 있으면 Builder ↔ Preview 가 시각적으로 달라지는 D3 대칭 위반**.
  - 수정: canonical generic 렌더에서 `type==="body"` 이고 사용자가 height/minHeight 미지정 시 `min-height:100vh` 주입 → viewport(=preview iframe=device frame=Skia artboard) 기준으로 body 를 아트보드에 정합(실측 96→844). 사용자가 height/minHeight 명시 시 보존(주입 skip).
  - **왜 100vh 인가**: 라이브 실측 결과 `min-height:100%` 는 상위 frame 이 auto height 라 percentage cascade 가 0 으로 처리되어 무효(body 96 유지). `100vh` 는 상위 체인과 무관하게 viewport 로 resolve → body 844 fill.
  - 범위: builder Preview 전용(`CanonicalNodeRenderer`). Publish 앱은 별도 body 렌더 경로(`useBodyElement`)라 미영향.
  - 위치: `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx` (+ `__tests__/CanonicalNodeRenderer.bodyFill.test.tsx` 회귀 4건)

## [기존 테스트 실패 6건 해소 — Avatar/ColorField 팩토리 정합 + stale 단언 갱신] - 2026-07-15

### Bug Fixes

- **팔레트로 추가한 Avatar 의 크기 변경이 무시되던 버그** (selection 박스 32px 고정):
  - **Why**: `createDefaultAvatarProps`(palette-add else 분기 baseline)가 `style:{width:32,height:32}` inline 을 유지했는데, 팩토리 `createAvatarDefinition`은 2026-07-14 에 이 inline 을 제거했다(catalog `Avatar.sizes.{xs..xl}.height` 가 크기 SSOT). inline 숫자가 있으면 `enrichWithIntrinsicSize` 가 early return 하여 size→diameter 분기가 안 돌고 layout bounds 가 32 로 고정된다.
  - 수정: baseline 에서 inline width/height 제거 → 팩토리와 byte-identical (entryUniverseContract Gate G4 정합)
  - 위치: `apps/builder/src/types/builder/unified.types.ts` (`createDefaultAvatarProps`)
- **신규 ColorField 의 gap reset 버튼이 항상 활성(false dirty)이던 버그**:
  - **Why**: 팩토리가 `gap:4` 를 emit 했으나 dirty baseline resolver(`resolveLayoutSpecPreset`)는 `composition.gap`(var(--spacing-xs)) 이 아니라 catalog `sizes.md.gap=8` 을 읽는다. Select(6=6)/SearchField(8=8) 등 형제는 `factory inline gap == sizes.md.gap` 불변식을 지키는데 ColorField 만 4≠8 이었다(2026-07-02 회귀).
  - 수정: 팩토리 + baseline 의 gap 을 catalog SSOT 값 8 로 정합 (시각 gap 4px→8px, size 스케일 xs6/sm6/md8/lg10/xl12 단조성 복원)
  - 위치: `apps/builder/src/builder/factories/definitions/DateColorComponents.ts`, `src/types/builder/unified.types.ts`

### Infrastructure

- **history 정비/canonical persist 가드/TextField DELEGATING 전환 후 낡은 정적·DOM 단언 4건 갱신** (production 은 정상, 테스트만 stale):
  - BuilderCore.static: `db.documents.put(projectId, doc, { reason })` 급감 가드 3번째 인자 추가 → 정확 문자열 단언을 prefix 매칭으로 완화
  - usePageManager.canonical: `ensureListBoxTemplateOrigins` bootstrap 이 문서 생성/마이그레이션 시점으로 이동(b80465573) → hydrate 경로 단언에서 제거
  - CanonicalNodeRenderer.field ×2: TextField DELEGATING 전환(f556385db) 으로 canonical marker 가 delegating wrapper 로 이동 → 마커 위치 단언 갱신(primitive 엔 data-element-id 유지)
  - 위치: `apps/builder/src/builder/main/BuilderCore.static.test.ts`, `hooks/__tests__/usePageManager.canonical.test.ts`, `preview/components/__tests__/CanonicalNodeRenderer.field.test.tsx`

## [프로퍼티 패널 RAC/RSP 정합 감사 — 누락 편집 prop 일괄 추가] - 2026-07-15

### Features

- **36개 컴포넌트 binding accepts 에 누락 편집 prop 추가** (Phase 1~3):
  - 전 catalog binding (115개) 의 `accepts` 를 RAC/RSP 공식 Props 레퍼런스와 전수 대조 — "렌더러가 이미 소비 중이거나 RAC 공식인데 Property 패널에 편집 UI 가 없던" prop 을 선별 추가
  - fields/date (Phase 1): TextField/TextArea/SearchField/NumberField 의 maxLength/minLength/pattern/autoFocus/necessityIndicator, ColorField 의 channel/colorSpace 등 8종, DatePicker/DateRangePicker 의 isRequired/isInvalid/name/pageBehavior/shouldCloseOnSelect/maxVisibleMonths 등 12~15종, Calendar/RangeCalendar 의 min/maxValue/pageBehavior 등
  - selection/collections (Phase 2): Checkbox/Switch 의 isReadOnly/isRequired/name/value/autoFocus, Select/ComboBox 의 validation·필드 상태 7~11종, Slider value, Meter/ProgressBar 의 labelPosition/valueLabel, ListBox/GridList/Tree/TagGroup/ToggleButtonGroup 의 disallowEmptySelection
  - buttons/overlays (Phase 3): Button/Link/Radio autoFocus, Tooltip/Popover 의 placement/offset/crossOffset/shouldFlip/containerPadding, Disclosure/DisclosureGroup/DropZone isDisabled, ColorSlider orientation
  - **Why**: ADR-142 catalog cutover 후 binding `accepts` 가 D2 편집 SSOT 인데, 다수 컴포넌트에서 DOM 렌더러가 소비하는 공식 prop 이 패널에 미노출 (TagGroup maxRows 2026-07-01 사례와 동형 누락이 전 패밀리에 잔존)
  - 미소비 prop 은 렌더러 배선 동반 (FormRenderers/DateRenderers/ColorRenderers/CollectionRenderers/LayoutRenderers). 소비 경로가 없는 prop (ColorArea colorSpace, Modal isDismissable, staticColor 계열 등) 은 dead 편집 UI 방지를 위해 의도적 미추가
  - 위치: `packages/shared/src/catalog/bindings/*.binding.ts` (36개), `packages/shared/src/renderers/*.tsx` (5개) (commit: 6e6c55122, 250a8e852, ae3527a7e)

## [undo/redo/History 패널 — canonical 아키텍처 정합 정비 (ADR-124 후속 완결)] - 2026-07-15

### Bug Fixes

- **속성 편집·드래그 이동·인스턴스 조작의 undo 가 canonical-only 데이터를 손상시킬 수 있던 legacy 경로 제거** (사용자 보고: history 기능이 오래전 제작 후 현재 코드 미반영):
  - **Why**: ADR-124 가 canonical event 부착을 diff API 에만 구현했는데 실제 mutation 은 전부 plain `addEntry` 호출 — 최다 빈도 편집이 deprecated snapshot 으로 기록되고, undo 는 flat Element[] → canonical **전체 교체** fallback 을 타면서 ref descendants/slot·frame metadata 소실 위험 + HC#2 (canonical 1차) 위반이 상존했다.
  - 전 call site 를 canonical event 로 전환: update event (full merged props 계약) / move event (빌더 신설) / replace event 쌍 (instance mirror field 표현, 빌더 신설)
  - 위치: `stores/utils/{elementUpdate,instanceActions,historyHelpers,elementRemoval,elementCreation}.ts`, `stores/inspectorActions.ts`, `workspace/canvas/hooks/useDragBridge.ts`
- **LayerTree cross-container 이동이 undo 불가** — history 자체가 미기록. move event 기록 신설 (`stores/elements.ts` moveElementToContainer)
- **paste/duplicate/group 후 undo 를 요소 수만큼 눌러야 하던 이중 기록** — addElement 개별 entry + trackMultiPaste/trackGroupCreation batch entry 가 중복 생성. `addElement(…, { skipHistory })` 로 단일 batch entry 화
- **구조 변경 (parent_id) batch 의 undo 가 부모를 복원하지 않던 latent 결함** — batch diff 기록이 props-only event 를 만들어 parent 복원이 early-return 에 가려짐. update+move event 병합 entry 로 정정
- **대량 paste 의 undo 가 새로고침 시 유실** — 급감 가드가 undo persist 를 차단해 메모리·DB 발산. entry 의 canonical event deleteIds 로 산출한 `expectedShrinkNodeCount` 검증 통과 시에만 허용 (fail-closed — 2026-07-14 소실 차단책의 정량 검증 예외, 사용자 승인)
- **instance 내부 요소 update 의 undo 가 조용히 no-op** — canonical update 적용기 `replaceNodeProps` 가 ref descendants override 를 탐색하지 않던 사각지대 해소 (`stores/history/canonicalHistoryEvents.ts`)
- **History 패널 label 이 원시 UUID/`drag-reorder` sentinel 노출** — canonicalEvents + 현재 canonical document 조회 기반으로 재설계, 삭제된 노드는 truncated id + "(삭제됨)" (`panels/history/historyEntryLabel.ts` 신설)

### Architecture

- **HC#2 순서 정정 (ADR-122 §Residual 부분 해소)**: undo/redo/goToHistoryIndex 의 legacy fallback 을 canonical 1차 → set 2차 + canonical 재파생으로 전환, source-order 정적 가드 추가. legacy fallback 은 구 IndexedDB v1 entry 전용으로 격하. `applyElementSnapshotBatch` (instance detach) 도 canonical-first 재배열
- **잔재 정리**: `addDiffEntry`/`addBatchDiffEntry` (호출처 0)/`trackAIBatchOperation` (호출처 0) + CommandDataStore (deprecated 필드만 읽던 부기, 342 LOC) 삭제 — Monitor 패널 통계는 entry 기반 `estimatedMemoryUsage` 로 대체. historyActions 디버그 console.log 127줄 제거. `addEntry` 에 canonicalEvents 미부착 DEV 경고 가드
- 커버 범위는 요소 도메인 한정 (사용자 결정) — root collections (themes/variables/events/actions/collections)/페이지/Frame CRUD 의 undo 미지원은 알려진 제한으로 유지

### 검증

- 핵심 불변식 _canonical doc → mutation → undo → 원본 deep-equal_ roundtrip 을 mutation family 별 신설 (move/replace/R7 override/batch/v1 legacy 발산-0/v1·v2 혼합 cross-jump/급감 가드 delta) — history·instance·가드 테스트 87건 PASS, type-check PASS (baseline 69→68, 1건 실수정)
- **라이브 실측** (Chrome, 실제 builder — 신규 프로젝트): ① 요소 추가 → 패널 label "추가 button_1" (UUID 아님) → undo 소멸/redo 복귀 ② Inspector 텍스트 편집 → label "수정 button_1" → undo 시 Canvas(Skia)+Inspector 동시 복원 ③ **LayerTree cross-container 이동이 history 에 기록되고 (신규) undo 로 원 부모·순서 복귀** ④ **paste 가 정확히 1 entry → undo 1회 완전 롤백** (이중 기록 해소) ⑤ 패널 cross-jump (시작 상태↔최신) 양방향 ⑥ 새로고침 후 Skia+DOM Preview+History 패널 복원 및 복원 스택 위 undo 정상. 콘솔: canonicalEvents 미부착 DEV 경고 0건 / persist BLOCKED 0건. (별개 관찰: paste 가 선택된 Button 의 자식으로 중첩 삽입해 button-in-button hydration 경고 — paste target 로직의 기존 이슈, history 무관)

## [field 패밀리 root width — catalog 단일 정본 (DatePicker 가 auto 로 떨어지던 split 제거)] - 2026-07-15

### Bug Fixes

- **DatePicker/DateRangePicker 의 Style 패널 width 기본값이 `auto`** — 같은 field 패밀리의 다른 컴포넌트는 모두 `100%` 인데 이 둘만 달랐다 (사용자 적발).
  - **Why**: Style 패널 Transform 의 width 는 `toStr(inline, specDefault, "auto")` 이고 **`specDefault` = catalog `composition.containerStyles.width`** 다 (`TransformSection.tsx`). 2026-06-24 정정이 **TextField/TextArea/SearchField/ColorField 4종만** catalog 로 올리고, 나머지는 "factory inline `width:100%` 가 baseline 이라 정합" 으로 남겨뒀다. 그런데 **DatePicker/DateRangePicker 는 factory 조차 root width 를 주지 않아** catalog·factory 어느 쪽에서도 값을 못 받고 `auto` fallback 으로 떨어졌다. 나머지 5종(NumberField/DateField/TimeField/Select/ComboBox)은 catalog 가 똑같이 비어 있었지만 factory inline 이 가려 증상만 없던 상태 — 즉 **패밀리 정본이 두 갈래로 쪼개져 있던 것**이 근본 원인이다.
  - 수정: catalog `composition.containerStyles.width: "100%"` 를 **비어 있던 7종 전부**에 추가 (DatePicker / DateRangePicker / NumberField / DateField / TimeField / Select / ComboBox) → `pnpm generate:css` 로 7개 CSS 재생성. layout 기본값은 factory inline 이 아니라 catalog 소유라는 D3 계약(`feedback-layout-default-belongs-in-catalog-not-factory-overlay`) 에도 정합 — factory inline 은 Style 패널 false dirty 를 만들어 `useResetStyles` 에 baseline mirror 를 계속 쌓게 한다.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (7 entry) + `packages/shared/src/components/styles/generated/{DatePicker,DateRangePicker,DateField,TimeField,NumberField,Select,ComboBox}.css`

### 검증

- **라이브 실측** (Chrome, 실제 builder): DatePicker 선택 → Style 패널 `PropertyUnitInput value` 가 `"auto"` → **`"100%"`** (대조군 TextField 와 동일값). 생성 CSS 규칙 `.react-aria-DatePicker { width: 100% }` 확인, Preview DOM 폭 350px = 부모 body content 폭(390 − padding 40), **Skia layout 폭 350 = DOM 350 → CSS↔Skia 대칭 유지**.
- 회귀 계약: `fieldFamilyWidthContract.test.ts` 신규 — field 10종의 catalog width + resolver 출력 전수 고정 (21 test). `resolveCatalogContainerBase.snapshot.test.ts` 의 기존 "width 없음" 기대값 7건은 이번 정본화에 맞춰 갱신.
- catalog 스위트 328/328 통과, `pnpm type-check` 신규 위반 0. (builder utils/factories 의 기존 실패 11건은 clean tree 에서도 동일 — 본 변경과 무관)

## [DisclosureGroup size 미반영 — propagation 은 cascade 하지 않는다 (3단 중첩 경로 명시 필요)] - 2026-07-15

### Bug Fixes

- **DisclosureGroup 의 size 를 바꿔도 CSS·Skia 모두 반영 안 됨** (사용자 보고, 직전 Disclosure 수정의 후속). 바로 앞 커밋에서 `Disclosure → Header/Content` 전파를 고쳤지만, 한 단계 위인 **DisclosureGroup 에도 propagation 규칙이 부재**했다.
  - **Why (핵심 — cascade 없음)**: 구조가 `DisclosureGroup > Disclosure × N > {DisclosureHeader, DisclosureContent}` 인 **3단 중첩**인데, **propagation 은 cascade 하지 않는다.** Inspector 는 **선택된 요소의 rule 만** 실행하므로 그룹에 `size → Disclosure` 만 주면 그 Disclosure 의 rule 이 자동으로 이어 달리지 않는다 — **손자(Header/Content)까지 중첩 childPath 로 명시**해야 한다 (Select 의 `["SelectTrigger","SelectIcon"]` 선례 동형). `resolveChildPath` 가 같은 type 형제를 전부 매칭하므로 Disclosure 가 N 개여도 한 rule 로 커버된다.
  - factory 는 자식 Disclosure 에 `size` 를 주지 않아 store 값이 `null` 이었고, 규칙이 없으니 Skia delegation(`getParentTagsForChild` 역인덱스)도 없어 catalog `defaultSize`(md) 로 고정 — 그룹을 lg 로 바꿔도 자식이 md 에 머물렀다.
  - 위치: `apps/builder/src/builder/utils/propagationRegistry.ts` (`disclosureGroupPropagationRules` — `Disclosure` / `["Disclosure","DisclosureHeader"]` / `["Disclosure","DisclosureContent"]` 3 rule)

### 검증

- **라이브 3 size sweep** (Inspector 실제 클릭 → 새로고침 → 실측). 그룹 내 Disclosure **2개 모두** 반영:

  | size | store (그룹·Disclosure·Header·Content 전부) | Skia Header | DOM 헤더 폰트 | DOM 헤더 높이 |
  | ---- | ------------------------------------------- | ----------- | ------------- | ------------- |
  | sm   | sm                                          | 32          | 12px          | 34            |
  | md   | md                                          | 36          | 14px          | 36            |
  | lg   | lg                                          | 40          | 16px          | 39            |

  수정 전에는 자식 Disclosure 의 store size 가 `null`, Header/Content 는 `md` stale, Skia 는 36/20 고정이었다. Disclosure 단독 케이스와 동일한 값으로 수렴 — 그룹 경유가 대칭을 깨지 않는다.

- `sizePropagationPathContract.test.ts` 에 DisclosureGroup 추가 + size-bearing 자식에 `Disclosure` 등록 — **수정 전 RED** ("DisclosureGroup size 규칙 존재: expected 0 to be greater than 0").

### Documentation

- **`DisclosureGroup.sizes.fontSize` 스케일 불일치는 의도적으로 두었다** — 테스트로 그 판단을 고정 (`disclosureHeaderFontInherit.test.ts`). 그룹만 `text-sm / text-sm / text-lg`(sm=md, lg 는 자식보다 +2px)로 Disclosure 계열(`text-xs / text-sm / text-base`)과 갈리지만 **시각에 도달하는 소비처가 없다**: DOM 은 자식 `[data-size]` 가 그룹 font-size 를 덮고, Skia 는 `DisclosureGroup` 이 `SHELL_ONLY_CONTAINER_TAGS` 라 텍스트 shape 를 emit 하지 않는다(빈 shell). 그룹이 자기 텍스트를 갖거나 shell-only 에서 빠지면 이 테스트가 먼저 깨지므로, 그때 스케일을 맞추면 된다.

## [Disclosure size 가 자식에 안 내려감 — propagation rule 부재 + layout md 고정 + CSS 상속 체인 단절] - 2026-07-15

### Bug Fixes

- **Disclosure 의 size 를 바꿔도 DisclosureHeader 가 CSS·Skia 둘 다 안 변하고, DisclosureContent 는 CSS 만 변함** (사용자 보고). **세 겹의 독립 결함**이 겹쳐 있었다 — 하나만 고쳐도 증상이 안 사라진다.
  - **(1) propagation rule 이 아예 없었다** (`propagationRegistry.ts`). 옛 경로가 stale 한 게 아니라 Disclosure 항목 **자체가 부재**. 이건 **두 경로를 동시에** 끊는다: Inspector 전파(`buildPropagationUpdates`)가 자식 store 에 size 를 못 쓰고, **Skia delegation 도 죽는다** — `resolveParentDelegatedSize` 가 `getParentTagsForChild()`(propagation **역인덱스**)로 부모를 찾기 때문이다. 규칙이 없으면 역인덱스가 비어 delegation 이 `null` → 자식이 `defaultSize`(md) 고정. Card(`size → CardHeader/CardContent/CardFooter`)와 같은 rule 을 추가.
  - **(2) layout 이 size 를 무시하고 `.sizes.md` 를 하드코딩** (`layout/engines/utils.ts`). `disclosureHeaderDims()` 가 size 인자를 안 받아, catalog 에 sm/md/lg(height 32/36/40)가 다 있는데도 항상 md(36) 를 읽었다. 바로 옆 `statusLightDims(sizeName)` / `sliderTrackRowHeight(sizeName)` 는 size 를 받는데 이 함수만 누락 — 동형으로 맞춤.
  - **(3) DOM 헤더의 font-size 상속 체인이 두 곳에서 끊김** (catalog `Disclosure.structure.composition.staticSelectors`). 헤더는 `<Disclosure><Heading><Button slot="trigger">` 구조인데, `<Heading>`은 `<h3>` 로 렌더돼 **브라우저 기본 16px** 을, `.react-aria-Button` base 는 **`font-size: var(--text-sm)`(14px)** 를 각자 선언해 부모 `[data-size]` 의 font-size 를 차단했다. **`inherit` 는 직계 부모를 따르므로 Button 에만 넣으면 Heading 의 16px 을 물려받는다** — 체인의 **두 노드 모두** `font-size: inherit` 필요. 같은 체인의 `justify-content` / `--icon-size` 가 이미 "Button base 가 부모를 덮는다" 는 동일 함정을 겪었던 세 번째 사례.
  - **Why (증상이 자식별로 갈린 이유)**: `DisclosureContent` 는 자기 font-size 를 선언하지 않아 부모 Disclosure 의 font-size 를 **CSS 상속으로 우연히** 받았다 → "Content 는 CSS 만 변경". Header 는 위 (3) 으로 상속이 막혀 CSS 도 안 변했고, (1)+(2) 로 Skia 도 md 고정이었다 → "Header 는 둘 다 안 변경".
  - 위치: `apps/builder/src/builder/utils/propagationRegistry.ts` · `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` · `packages/shared/src/catalog/generated/componentRulesTable.ts` (+ `pnpm generate:css`)

### 검증

- **라이브 3 size sweep** (Inspector 실제 클릭 → 새로고침 → 실측). store / Skia layout height / DOM 헤더 버튼 font·height:

  | size | store(부모·자식) | Skia Header | DOM 헤더 폰트    | DOM 헤더 높이 |
  | ---- | ---------------- | ----------- | ---------------- | ------------- |
  | sm   | sm               | 32          | **12px** (전 16) | 34            |
  | md   | md               | 36          | 14px             | 36            |
  | lg   | lg               | 40          | **16px** (전 14) | 39            |

  수정 전에는 Skia 가 3 size 모두 36/20 고정이었고 DOM 헤더 폰트는 전 size 14px 였다. Content 도 Skia 16/20/24 로 size 를 따라간다.

- `sizePropagationPathContract.test.ts` 에 Disclosure 추가 — **수정 전 RED** ("Disclosure size 규칙 존재: expected 0 to be greater than 0" — 규칙 0건이 테스트로 확증됨). size-bearing 자식 목록에 `DisclosureHeader`/`DisclosureContent` 등록.
- `disclosureHeaderFontInherit.test.ts` 신규 — 상속 체인 두 노드의 `font-size: inherit` + **상속 source(`Disclosure.sizes`) = Skia source(`DisclosureHeader.sizes`)** fontSize 일치를 고정 (갈리면 inherit 가 DOM 을 변하게만 할 뿐 Skia 와 못 맞춤). 수정 전 2 RED.
- **stale 테스트 정정**: `disclosureHeaderIconSize.test.ts` 의 height 기대값이 `28/30/32`(fontSize + paddingY\*2 **산술 추정**) 로 남아 있었다. 2026-07-14 sweep 이 catalog 를 CSS 실측값 `32/36/40` 으로 고쳤는데 테스트만 안 따라와 계속 RED 였던 것 — 이번 라이브 실측(DOM 34/36/39)이 catalog 가 옳음을 확증해 기대값을 정정했다.
- `packages/shared/src/catalog` + `apps/builder/src/builder/utils` **336 통과 / 실패 0**. type-check 0 error.

## [Icon DOM 이 size 무시하고 24px 고정 — internal leaf 의 size/variant passthrough 누락] - 2026-07-15

### Bug Fixes

- **Icon 컴포넌트가 md 를 제외한 모든 size 에서 DOM↔Skia 비대칭** (사용자 보고: "Icon 컴퍼넌트 skia - css 의 M size 를 제외하고는 정합성이 일치하지 않는다"). Skia 는 size 를 정상 반영(16/18/24/36/48)하는데 **DOM 의 `<svg>` 는 항상 24px** 였다 — md 에서만 우연히 일치.
  - **Why**: `Icon.tsx` 는 size 를 **React prop 으로 소비**해 `ICON_SIZE_MAP[size]` → `<svg width>` 를 계산하는데, `Icon.binding` 에 `propPassthrough: ["size"]` 가 없어 `toRacProps` 가 size 를 **`data-size` 속성으로만** 라우팅했다. SVG `width` 는 **속성**이라 `[data-size]` CSS 로는 도달할 수 없다 → React prop 이 안 오면 컴포넌트 default `"md"` 로 고정. Skia 는 store 의 `props.size` 를 직접 읽어 정상이므로 **md(24) 에서만 두 값이 우연히 같아** 사용자 증상과 정확히 일치한다.
  - **선례와 동일 root-cause**: `Avatar` / `ProgressCircle` / `StatusLight` 는 같은 이유로 이미 `propPassthrough` 를 갖고 있었다 — Icon 만 누락. 2026-07-14 의 field wrapper 6종 수정은 "wrapper 가 `data-size` 를 덮어쓰는" 유형만 훑어 **size 를 계산 입력으로 쓰는 internal leaf** 를 놓쳤다.
  - 라이브 실측(수정 전): xs DOM 24 vs Skia 16 / sm 24 vs 18 / **md 24 = 24** / lg 24 vs 36 / xl 24 vs 48.
  - 위치: `packages/shared/src/catalog/bindings/Icon.binding.ts`
- **Badge 의 variant / size / fillStyle 이 전부 default 로 덮어써짐** (동행 감사 발견). `Badge.tsx` 가 `{...props}` **뒤에** 자기 `data-variant` / `data-size` / `data-fill-style` 를 재작성하는데 passthrough 가 없어, React prop 이 `undefined` → default(`accent` / `sm`)가 `toRacProps` 의 값을 **덮어쓴다**. `fillStyle` 은 컴포넌트 default 가 없어 **속성 자체가 소실**된다. `Badge.css` 가 세 축을 모두 셀렉터로 소비하므로 실제 시각 결함.
  - 위치: `packages/shared/src/catalog/bindings/Badge.binding.ts` (`propPassthrough: ["variant", "size", "fillStyle"]`)

### 검증

- **라이브 5 size sweep** (설정 → 새로고침 → 초기 렌더 실측, DOM `<svg width>` vs Skia layout box): xs **16/16** · sm **18/18** · md **24/24** · lg **36/36** · xl **48/48** — 전 size 일치. 수정 전에는 DOM 이 5 size 모두 24 고정이었다.
- `sizePassthroughContract.test.ts` 확장 — 감시 대상을 "DELEGATING wrapper" 에서 **"size 를 React prop 으로 읽는 전 컴포넌트"** 로 재정의(Icon/Badge/StatusLight/Avatar/ProgressCircle 추가) + `{...props}` 뒤 `data-*` 재작성 축 전수를 검사하는 multi-axis 계약 신설. **수정 전 6 RED → 수정 후 GREEN**, Badge 수정만 되돌리면 3 RED (load-bearing 확증).
- `Icon.binding.test.ts` 계약 정정 — 기존 테스트가 "size 는 `data-*` 로만 emit" 이라는 **결함 자체를 계약으로 고정**하고 있었다.
- **Skeleton 은 제외**: `size` 를 accepts 에 갖지만 빌더가 타는 base 분기에서 `data-size` 를 emit 하지 않고 CSS 에도 `[data-size]` 규칙이 없어 **소비처가 0** — passthrough 를 넣어도 시각 효과가 없어 근거 없는 확대로 판단, 제외 사유를 테스트에 명시.
- `packages/shared` + `packages/specs` 1575 통과. type-check 0 error. 사전 실패 1건(`disclosureHeaderIconSize` — clean tree 에서도 동일 실패 확인, 본 변경 무관).

## [Skia 아이콘 glyph 가 iconSize 아닌 typography fontSize 로 그려짐 — icon_font 크기 채널 복구] - 2026-07-14

### Bug Fixes

- **Skia 아이콘이 size 별 iconSize 보다 작게 렌더링** (사용자 보고). 박스는 `iconSize` 로 커지는데 **glyph 만 typography 를 따라가** 박스 안에서 작게 그려졌다 — L→XL 로 키워도 glyph 가 거의 그대로였다.
  - **Why**: `icon_font` primitive 가 `style?.fontSize != null` 이면 그 값을 glyph 크기로 썼다. 이 판정은 `style` 이 **override 전용**이던 시절엔 맞았지만, ADR-912 `toSkiaStyle` 이후 `style` 은 **rule base ⊕ override 병합 map** 이다 — base 에 rule 의 `fontSize`(typography)가 **항상** 들어오므로 판정이 상시 참이 되어 `iconSize` 채널이 죽었다. `SelectIcon` 은 두 축의 값이 달라(xs 14 vs 10 / sm 16 vs 12 / md 18 vs 16 / lg 22 vs 18 / xl 28 vs 20) 전 size 에서 glyph 가 박스보다 작았다.
  - **일반 `Icon` 이 멀쩡해 보인 건 우연**: catalog `Icon` 은 `fontSize` 와 `iconSize` 를 같은 값(16/16 · 24/24 · 48/48)으로 써서 어느 쪽이 이기든 결과가 같았다 — 이 우연이 결함을 가려줬다.
  - 수정: 크기 채널을 `iconSize`(merged → rule 순)로 읽고, `fontSize` 는 **사용자가 `props.style` 에 직접 넣었을 때만** override 로 수용(merged base 의 rule fontSize 는 무시).
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts` (`iconFont`)

### 검증

- 라이브(실제 Inspector 클릭 5 size sweep): DatePicker 의 Skia glyph = Skia 박스 = DOM glyph = **14 / 16 / 18 / 22 / 28** 전 size 일치. 수정 전 XL 은 glyph 가 20 에 머물렀다.
- 회귀 테스트 `skiaPrimitives.iconFontSizeChannel.test.ts` (신규 8 케이스) — **수정 전 6/8 RED** 확인. 통과하는 2개는 원래 통과해야 할 케이스(사용자 override / Icon 의 값 일치)라 판별력 확증.
- `packages/specs` 552 통과. type-check 0 error. `packages/shared` 는 기존 실패 1건(`disclosureHeaderIconSize` — 본 변경 stash 후 clean tree 에서 동일 실패 확인, 무관).

## [트리거 아이콘 glyph 가 size 를 안 따름 + size passthrough 전수 확장 — 아이콘 스케일 단일 SSOT] - 2026-07-14

### Bug Fixes

- **트리거 아이콘 glyph 가 size 를 바꿔도 항상 16px 고정** (Select / ComboBox / SearchField / DatePicker / DateRangePicker 전부). 앞선 수정이 맞춘 건 아이콘을 **감싸는 박스**(`--dp-btn-width` / `--select-chevron-size`)였고, 그 **안의 glyph** 는 별개 축이었다.
  - **Why**: wrapper 들이 아이콘 svg 를 `width={16}` / `<Icon style={{ fontSize: 16 }} />` 로 **하드코딩**했다. svg 의 `width`/`height` 는 **속성**이라 CSS 변수로는 못 덮는다 → size 를 xs~xl 어디로 바꿔도 DOM glyph 는 16 고정인데, Skia 는 `SelectIcon.sizes[*].iconSize` 로 그린다 → **전 size 비대칭**. md 에서 "박스 18 = Skia 18" 만 보고 일치로 오판했던 지점 — 실측하면 그 안의 glyph 는 16 이었다.
  - 수정: catalog `SelectIcon.iconSize` 를 읽는 `resolveTriggerIconSize()` 단일 resolver 를 두고, 5개 wrapper 가 전부 이걸 경유(Skia 의 `icon_font` 와 **같은 source**).
  - 위치: `packages/shared/src/catalog/resolvers/resolveTriggerIconSize.ts` (신규), `packages/shared/src/components/{Select,ComboBox,SearchField,DatePicker,DateRangePicker}.tsx`
- **xs/sm 아이콘 크기가 DOM(14/16) ↔ Skia(10/14) 로 어긋남** (직전 엔트리의 "알려진 잔여" — **해소됨**).
  - **Why**: catalog `iconSize` 가 xs/sm 만 10/14 로 DOM 아이콘 스케일(14/16)과 달랐다. `iconSize` 는 **Skia 전용**이다 — 이걸 emit 하는 `--icon-size` CSS 변수는 Disclosure 만 소비하므로(폭발 반경 확인) catalog 를 DOM 스케일로 수렴시켜도 DOM 렌더에 영향이 없다.
  - 수정: `SelectIcon` / `SelectTrigger` / `Select` / `ComboBox` 의 `sizes.{xs,sm}.iconSize` 를 14/16 으로 통일 → **5개 size 전부 14/16/18/22/28 한 숫자**. `SelectIcon` 은 `height === iconSize` 가 불변식이라 height 도 동반 수정(glyph 넘침 차단).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (+ `pnpm generate:css` → Select/ComboBox 의 `--icon-size` 만 변경, 소비처 없음)
- **size 변경 미반영이 DatePicker 만의 문제가 아니었음 — `propPassthrough` 전수 확장** (직전 엔트리의 "미검증 의심 4종" — **확증 후 수정**).
  - **Why**: `DateField` / `TimeField` / `Select` / `ComboBox` / `SearchField` / `NumberField` 전부 wrapper 가 `size` 를 React prop 으로 소비 + 자기 `data-size` 를 `{...props}` 뒤에 재작성하는데 binding 에 `propPassthrough` 가 없었다 → `toRacProps` 실측 결과 **6종 모두 `size` React prop 이 `undefined`** (= wrapper default `"md"` 고정 + `data-size` 덮어씀). DatePicker 와 동일 결함.
  - 위치: `packages/shared/src/catalog/bindings/{DateField,TimeField,Select,ComboBox,SearchField,NumberField}.binding.ts`
- **SearchField / NumberField 의 size propagation 이 옛 평면 트리 기준** (DatePicker 와 동일 결함).
  - **Why**: factory 트리는 `X > SelectTrigger > {SelectValue, SelectIcon}` 인데 size 규칙만 평면 경로(`childPath: "SelectIcon"`)로 남아 **매칭 실패** — NumberField 는 자식 경로 규칙이 **아예 없었다**. 같은 파일의 `placeholder` 규칙이 이미 `["SelectTrigger","SelectValue"]` 중첩 경로를 쓰고 있던 게 트리 구조의 증거다(size 만 안 따라감). 자식의 stale size 가 부모를 계속 가린다.
  - 위치: `apps/builder/src/builder/utils/propagationRegistry.ts`

### Architecture

- **아이콘 스케일 = 단일 SSOT (catalog `SelectIcon.iconSize`)**: DOM glyph / DOM 박스 / Skia glyph / Skia 레이아웃 박스가 전부 같은 숫자에서 파생. typography 토큰(`--text-*`)을 아이콘 크기로 쓰는 경로는 제거됨(폰트 스케일 ≠ 아이콘 스케일).
- **회귀 테스트 3종 신설** (전부 수정 전 RED 확인):
  - `triggerIconGlyphSize.test.tsx` — 5개 wrapper × 5 size 의 DOM glyph == catalog `iconSize`, + "size 를 바꿔도 안 변함(16 고정)" 차단.
  - `sizePassthroughContract.test.ts` — wrapper self-compose 8종의 `propPassthrough: ["size"]` + `toRacProps` 가 React prop·`data-size` **둘 다** emit.
  - `sizePropagationPathContract.test.ts` — propagation `childPath` 를 **실제 factory 트리에 대고** 검증. 트리에 있는 size-bearing 자식이 해소 가능한 규칙으로 전부 덮이는지 확인(형제 동일 type 은 엔진과 같이 `filter` 로 전부 매칭). 트리에 없는 type 을 가리키는 dead rule 은 무해하므로 통과시킨다.

### 검증

- **live builder, 실제 Inspector 클릭**으로 size 변경 (store action 직접 호출은 전파 안 됨 — Inspector 경로만 `buildPropagationUpdates` 를 태운다):
  - **DatePicker** 5 size 전부: DOM glyph = DOM 박스 = Skia = **14 / 16 / 18 / 22 / 28**.
  - **Select** 5 size 전부: store = DOM `data-size` = chevron 박스 = DOM glyph = Skia = **14 / 16 / 18 / 22 / 28** (이전엔 glyph 가 16 고정 + passthrough 없어 `data-size` 자체가 md 고정).
- 신규 테스트 3종 + 기존 스위트: `packages/shared` 524 passed, `builder utils` 29 passed. type-check PASS. 유일한 실패(`disclosureHeaderIconSize`)는 **수정 전 baseline 에서도 동일하게 실패**함을 격리 실행으로 확증(본 변경과 무관).

## [DatePicker size 변경 미반영 — CSS passthrough 누락 + propagation 경로가 옛 트리 기준] - 2026-07-14

### Bug Fixes

- **DatePicker 의 size 를 바꿔도 CSS(Preview) 가 그대로이고, Skia SelectIcon 크기도 안 바뀜** (사용자 적발). 원인이 **서로 다른 2개**였다:
  - **(1) CSS/DOM — binding 에 `propPassthrough: ["size"]` 누락**: `toRacProps` 는 `kind:"size"` 를 **`data-size` 속성으로만** 라우팅한다(RAC primitive 는 unstyled → CSS 가 `[data-size]` 로 처리). 그런데 DatePicker 는 `source: internal` — composition wrapper(`DatePicker.tsx`)가 **size 를 React prop 으로 직접 소비**하고(하위 Label/DateInput/Button 크기 결정) `{...props}` **뒤에** 자기 `data-size={size}` 를 다시 쓴다. **Why**: passthrough 가 없으니 wrapper 의 `size` 가 undefined → **default `"md"` 고정**, 게다가 그 `md` 가 `toRacProps` 가 넣어준 `data-size="lg"` 를 **덮어써** CSS selector 가 영원히 md 로 매칭됐다. ProgressCircle/Avatar/StatusLight 가 같은 이유로 이미 `propPassthrough` 를 쓰고 있었다(선례). 수정: DatePicker/DateRangePicker binding 에 `propPassthrough: ["size"]` 추가.
  - **(2) Skia SelectIcon — propagation rule 이 옛 평면 트리 기준**: factory canonical 자식 통일(2026-06-23)로 트리가 `DatePicker > SelectTrigger > {DateInput, SelectIcon}` 이 됐는데, propagation rule 은 spec 시대의 **평면 경로**(`childPath: "DateInput"`)를 그대로 두고 **`SelectTrigger`/`SelectIcon` 규칙은 아예 없었다**. **Why**: DateInput 은 자기 size 가 없어 Skia delegation(`props.size ?? delegated`)으로 우연히 정상이었지만, **SelectIcon 은 store 에 `size:"md"` 가 남아** 그 stale 값이 `props.size` 앞자리를 차지해 부모를 영원히 가렸다 → 아이콘이 md(18)에 고정. 수정: `size → SelectTrigger` / `size → ["SelectTrigger","DateInput"]` / `size → ["SelectTrigger","SelectIcon"]` (+ granularity 경로도 2단계로) — SearchField/Select 가 같은 자식 구조에 이미 갖고 있던 규칙과 정합. `override: true` 라 자식의 stale 값을 이긴다.
  - 위치: `packages/shared/src/catalog/bindings/{DatePicker,DateRangePicker}.binding.ts`, `apps/builder/src/builder/utils/propagationRegistry.ts`
  - 검증 (live builder, **실제 Inspector 클릭**으로 size 변경): M → DOM 아이콘 18 = Skia 18 / picker 350×54 양쪽 동일. L → DOM 22 = Skia 22 / 350×70 동일. XL → DOM 28 = Skia 28 / 350×90 동일. 자식(SelectTrigger/DateInput/**SelectIcon**)이 전부 부모 size 로 전파됨(이전엔 SelectIcon 만 md 고정). 신규 회귀 테스트 7건(수정 전 RED — glyph 가 부모 size 무관하게 16 고정 / passthrough 미포함 확인). type-check PASS, 기존 실패는 baseline 과 동일(격리 실행 확증).
  - ~~**알려진 잔여(별도 결함)**: xs/sm 에서 DOM 아이콘(14/16)과 Skia(10/14)가 다르다~~ → **해소됨** (위 2026-07-14 엔트리). 다만 근본 원인은 xs/sm 스케일 불일치**만이 아니라**, DOM glyph 가 size 와 무관하게 **16px 하드코딩**이었던 것 — 여기서 "md/lg/xl 은 일치" 라고 본 건 DOM **박스**와 Skia **glyph** 를 비교한 오판이었다.

## [DatePicker 트리거 아이콘 크기 — typography 토큰 대신 아이콘 스케일로 통일 (DOM↔Skia 대칭)] - 2026-07-14

### Bug Fixes

- **DatePicker/DateRangePicker 의 트리거 아이콘이 DOM 20 vs Skia 18 로 어긋남** (md 기준):
  - **Why**: catalog 의 `dp-btn`/`drp-btn` delegation 만 아이콘 박스 크기를 **typography 토큰**(`--text-xl` 등)으로 지정하고 있었다. **폰트 크기 스케일은 아이콘 박스 스케일이 아니다** — `--text-xl`=20 / `--text-2xl`=24 / `--text-3xl`=30 이라 Skia 가 소비하는 `SelectIcon.sizes[*].iconSize`(18/22/28)와 **md/lg/xl 전부** 어긋났다. Select 는 처음부터 `.select-chevron` 을 **px 아이콘 스케일**(14/16/18/22/28)로 지정해 정합이었고, **DatePicker/DateRangePicker 만 예외**였다.
  - 수정: `dp-btn`/`drp-btn` 을 Select 와 동일한 아이콘 스케일(14/16/18/22/28)로 통일 → DOM/Skia 가 **전 size 동일 값**. catalog(D3 SSOT) 편집 후 `pnpm generate:css` 로 CSS 재생성.
  - **부수 효과**: 아이콘이 2px 넓던 만큼 DateInput 폭도 밀려 있었다(Skia 310 vs DOM 308). 아이콘을 맞추자 **DateInput 폭 불일치도 함께 해소** — DatePicker 전 요소가 DOM 과 완전 일치.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts` (delegation `dp-btn`/`drp-btn`), `packages/shared/src/components/styles/generated/{DatePicker,DateRangePicker}.css` (재생성)
  - 검증 (live builder 실측): 아이콘 **Skia 18×18 @ x=327 = DOM 18×18 @ x=327**, DateInput **Skia 310 = DOM 310**, SelectTrigger 350×30, DatePicker 350×54 — **전 요소 일치, 잔여 0**. DOM probe 로 5개 size 전수 확인(xs 14 / sm 16 / md 18 / lg 22 / xl 28 = `SelectIcon.iconSize` 정합). 신규 회귀 테스트 5건(수정 전 RED 3건 확인) — typography 토큰 재도입 차단 포함. shared 1 failed(`disclosureHeaderIconSize`, 기존 실패 — 격리 실행으로 무관 확증) / specs 544 통과 / type-check PASS.

## [flex-grow 분배 복구 — intrinsic 폭을 명시 width 로 굳혀 grow 차단 / align-items 를 indefinite 신호로 오용] - 2026-07-14

### Bug Fixes

- **`flex:1` 자식이 grow 하지 못하고 콘텐츠 폭에 고정** (직전 커밋 `d0435ed4e` 의 잔여 항목 해소):
  - 증상: Skia DatePicker 의 DateInput 이 폭 **102**(콘텐츠)에 고정되고 chevron 아이콘이 x=119 로 딸려옴. DOM 은 `flex:1 1 0%` 로 **308** 까지 grow 하고 아이콘은 우측 끝(x=345). 같은 페이지의 **TextField 도 96 에 고정**(DOM 390) — 동일 결함의 다른 발현이었다.
  - **(1) layout — intrinsic 폭을 `width` 로 굳혀 grow 를 원천 차단** (`enrichWithIntrinsicSize`): `INLINE_BLOCK_TAGS` 자식은 콘텐츠 폭을 **명시 `width`** 로 주입받는다. **Why**: CSS 에서 intrinsic 폭은 flex **base size** 일 뿐이고 used 폭은 free space 분배 결과다 — `width` 로 박으면 분배가 불가능해진다. `dateinput` 은 standalone DateField 의 box 가 텍스트를 담도록 2026-06-23 에 `INLINE_BLOCK_TAGS` 로 등록됐는데, 그 등록이 **picker 안에서 grow 해야 하는 경우까지** 폭을 굳혔다. 같은 `flex:1 minWidth:0` 을 받는 **SelectValue 는 `INLINE_BLOCK_TAGS` 비소속**이라 애초에 width 가 안 박혀 정상 grow 했다 — Select 의 정상 동작은 **우연**이었다. 수정: `flex-grow > 0` 인 flex item 에는 width 를 주입하지 않고, intrinsic 폭은 `minWidth` 하한으로만 남긴다.
  - **(2) layout — `minWidth: 0` 을 미설정으로 오판** (falsy 함정): 보존 가드가 `!style?.minWidth` 라서 **`0` 을 미설정으로 읽어** intrinsic 폭으로 덮어썼다. `minWidth: 0` 은 implicitStyles 가 `flex:1` 과 **짝으로** 주입하는 "콘텐츠 밑으로도 축소 허용" 명시값이다. 수정: `== null` 판정. 동시에 "변경 없으면 원본 반환" 가드가 width/height 만 비교해 **minWidth 단독 주입을 조용히 버리던** 문제도 함께 수정.
  - **(3) 엔진 — `align-items` 를 컨테이너 cross 의 indefinite 신호로 오용** (`tree.rs::solve_flex`): 비-stretch 컨테이너가 **모든** 자식에게 `INDEFINITE_AVAIL` 을 내려보냈다. **Why**: `align-items` 는 *auto-cross 자식을 늘릴지*만 정할 뿐 **cross 를 명시한 자식에는 아무 영향이 없다**. `align-items:flex-start` 인 DatePicker 밑에서 **`width:100%` 로 폭이 확정된 SelectTrigger** 까지 indefinite 를 받아 → trigger 의 main(row=width) 이 indefinite → `flex.rs` 의 **Step 0 early-return 으로 grow 분배가 통째로 skip** → `flex:1`(basis 0%) 인 DateInput 이 **폭 0** 으로 붕괴했다. 수정: **자식별 판정** — cross 를 명시한 자식은 available 을 그대로 받고, auto-cross 자식만 indefinite 를 받는다. (컨테이너 단위로 넓히면 width 미지정 DatePicker 가 shrink-to-fit 을 잃고 350 으로 팽창 — 그래서 자식별이어야 한다.)
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`, `packages/composition-engine/src/tree.rs`
  - 검증 (live builder 실측, 수정 전 → 후): DateInput 폭 **102 → 310** (DOM 308, 잔여 2px 은 아이콘 18 vs DOM 버튼 20 차이 — layout 아님, **위 "트리거 아이콘 크기" 엔트리에서 해소**), SelectIcon x **119 → 327** (DOM 325 → 아이콘 수정 후 327 로 일치), **TextField 96 → 390** (DOM probe 실측 390 으로 확증). 페이지 전체 18개 요소 before/after diff 결과 **변경 3건이 전부 위 의도된 수정**이며 부수 변화 0건. Rust 280건 전체 통과(회귀 0, Chrome 실측 golden 25건 + shrink-to-fit/stretch 양쪽 contract 동시 lock), 신규 회귀 테스트 Rust 1건 + JS 8건(수정 전 RED 5건 확인). canvas 실패 12건은 clean-tree baseline 과 동일한 기존 실패(`tagSpecMap`/`canvasSceneNode` 등, 격리 실행으로 무관함 확증). type-check PASS.

## [DatePicker DateInput height 0 — 2-pass 가 주입 height 삭제 / stretch vs shrink-to-fit 구분] - 2026-07-14

### Bug Fixes

- **Skia 에서 DateInput 의 height 가 0 이 되어 사라짐** (직전 수정 후 잔존, block body 프로젝트에서 재현):
  - 엔진 1-pass 는 **정확했다** (실측: DateInput h=20 / trigger h=30 / DatePicker h=54, DOM 과 일치). 값을 망가뜨린 건 그 뒤의 **2-pass 재계산(Step 4.5)** 이었다.
  - **(1) 2-pass selection 루프가 store 원본을 봄** — "명시 height 를 가진 노드는 skip" 가드가 `elementsMap`(store 원본)에서 height 를 읽는데, **SelectTrigger 의 height(30px)는 store 에 없고 `implicitStyles` 가 주입**한다. **Why**: 가드가 주입된 height 를 `undefined`(=auto)로 잘못 읽어 skip 하지 않고 `childUpdates` 에 편입 → 뒤이은 "컨테이너는 height 제거(엔진 auto 계산)" 분기가 **주입된 30px 을 삭제** → trigger 가 auto(28)로 축소되고, 그 안의 DateInput(`height:100%`)이 **auto 부모 기준 → 0** 으로 붕괴. 같은 블록의 **update 루프는 이미 `processedElementsMap` 을 쓰고 있어 selection 루프만 비대칭**이었다. `.claude/rules/layout-engine.md` §2-Pass re-enrichment 의 "Step 4.5에서 processedElementsMap 우선 사용" 규칙 위반. 수정: selection 루프도 `processedElementsMap ?? elementsMap`.
  - **(2) 엔진 — stretch 부모와 shrink-to-fit 부모를 구분하지 못함** — 직전 커밋(7ab97be2e)의 `cross_definite_self` 가 **명시 크기(`explicit_*`)만** 보았다. **Why**: block 부모 안의 block-level flex 컨테이너는 **width 명시가 없어도 부모 폭으로 stretch** 되므로 그 폭은 확정이다(`body(block) > DatePicker > SelectTrigger(width:100%)` → 390 이 정답, DOM 390). 명시 크기만 보면 이 케이스를 shrink-to-fit 으로 오판해 trigger 가 콘텐츠 폭(160)으로 수축한다. definite 판정에 **(b) 부모가 definite available 을 내려줌(`avail_* >= 0`)** 을 추가 — shrink-wrap 하는 부모(flex `align-items:flex-start` 등)만 자식에게 `INDEFINITE_AVAIL`(음수)을 내려보내므로, 이 신호로 두 케이스가 갈린다. 직전 커밋의 shrink-to-fit 정합(`body(flex column, align-items:flex-start)`)은 그대로 유지.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`, `packages/composition-engine/src/tree.rs`
  - 검증 (live builder 실측): DateInput **h=20**(수정 전 0, Skia 에서 소실) = DOM 20, SelectTrigger **390×30** = DOM 390×30, DatePicker **390×54** = DOM 390×54. Rust 신규 3건(1-pass 정확성 + stretch 390 + shrink-to-fit 93 동시 lock) + 전체 279건 통과(회귀 0, Chrome 실측 golden 25건 포함). canvas+specs 11 failed/1490 passed = clean-tree baseline 동일. type-check PASS.
  - **잔여**: Skia DateInput 폭이 102(콘텐츠) vs DOM 348(`flex:1` grow) — layout 이 `flex:1` item 에 intrinsic 폭을 **명시 width 로 주입**해 grow 를 막는다. 표시되는 box(trigger)와 텍스트는 정합이라 시각 영향은 없으나 별도 정리 대상. → **해소됨** (위 "flex-grow 분배 복구" 엔트리).

## [DatePicker CSS↔Skia 레이아웃 정합 — shrink-to-fit % / DateInput box 오인] - 2026-07-14

### Bug Fixes

- **DatePicker 가 Skia 에서만 부모 폭 전체로 팽창하고, DateInput 이 입력 box 를 위아래로 넘침** (CSS 는 정상, 유사 컴포넌트 Select 는 정상):
  - Select 가 "정상" 이었던 건 store 에 `width:100%` 가 **명시**돼 있어 부모가 definite 였기 때문이다. DatePicker 는 width 미지정(=shrink-to-fit)이라 아래 결함이 드러났다. 근본은 4겹.
  - **(1) 엔진 — `%` 자식이 shrink-to-fit 부모를 팽창시킴** — 컨테이너 자신의 cross 가 auto 인데도 자식의 `%` cross 를 **상속 available** 로 풀었다. **Why**: CSS §10.2 — containing block 의 해당 축이 content 의존(auto)이면 `%` 는 `auto` 로 푼다. `body(column, align-items:flex-start) > DatePicker(width 미지정) > SelectTrigger(width:100%)` 에서 trigger 의 100% 가 350 으로 풀리고, shrink-to-fit 이어야 할 DatePicker 가 그 자식을 감싸며 **350 으로 팽창**(DOM 113.1). cross 축 `%` 전용 `cross_ctx` 도입 — 컨테이너 cross 가 definite 일 때만 available 기준, 아니면 indefinite. **main 축/padding/margin/gap 은 기존대로 available 기준**(available 자체를 죽이면 shrink-to-fit 상한과 main 배치가 무너져 SelectValue 폭 0 회귀).
  - **(2) 엔진 — `%` flex-basis 가 indefinite main 에서 0 으로 굳음** — `flex:1` 은 `flex-basis:0%` 로 전개되는데, main 이 indefinite 면 grow 할 free space 도 없어 item 이 **폭 0 으로 붕괴**한다. **Why**: CSS §9.2.3 — `%` basis 는 main 이 indefinite 면 `content` 로 취급한다. 위 (1) 수정으로 trigger 의 main(width)이 auto 가 되자 그 안의 DateInput(`flex:1`)이 0 이 됐다. `resolve_flex_basis` 에 indefinite-main → CONTENT 분기 추가.
  - **(3) layout — DateInput 에 trigger 행 높이(30) 를 주입** — `SelectTrigger.sizes.height`(md=30)는 **입력 box 행 높이**이지 그 안쪽 DateInput 의 높이가 아니다. **Why**: trigger 는 border 1px + paddingY 4px 를 가진 30px box 이므로 content-box 는 `30 − 8 − 2 = 20`. 30 을 주면 자식이 box 를 **위아래 5px 씩 넘친다**(Skia DateInput y=5 h=30 vs DOM h=20). box 높이는 `selecttrigger` 분기가 이미 소유하므로 DatePicker 분기의 height 주입 제거 → 콘텐츠 높이(20). Select 의 SelectValue 가 height 주입 없이 콘텐츠로 남는 것과 동형.
  - **(4) layout — DateInput 폭이 padding/gap/icon 을 이중 계상** — `calculateContentWidth` 가 옛 escape-box 공식(`paddingX + text + gap + icon + padRight`)을 유지했다. **Why**: renderer(`datefieldSegments`)는 picker 일 때 이미 **segment text 만** 그린다(box 는 SelectTrigger, icon 은 SelectIcon — 이중 렌더 방지). layout 만 옛 공식을 써서 trigger 가 제공하는 padding/icon 을 DateInput 이 또 더했다(102 → 138, DatePicker 178). DOM 실측도 picker 안 DateInput = border 0 / padding 0 / 자식은 DateSegment 뿐. picker 는 순수 텍스트 폭, standalone DateField 는 좌우 padding 포함 box 로 분리.
  - **(부수) Skia `_parentTag`/`_locale` 미전파** — `resolveDateInputParent` 가 직계 부모만 봐서 `DatePicker > SelectTrigger > DateInput` 구조에서 `null` 반환 → escape 가 `_parentTag` 기본값 "DateField" 로 fallback(picker 인데 box 를 그리는 분기). SelectTrigger 를 한 단계 건너뛰도록 수정.
  - 위치: `packages/composition-engine/src/tree.rs`, `apps/builder/src/builder/workspace/canvas/layout/engines/{implicitStyles,utils}.ts`, `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`
  - 검증 (live builder 실측): DatePicker 높이 **54 = DOM 54**, DateInput 높이 **20 = DOM 20**(수정 전 30, box 밖으로 넘침), Label 74 ≈ DOM 74.8, trigger 높이 30 = DOM 30, SelectIcon 세로 중앙 복귀. **Select 는 350 유지(무회귀)**. 폭은 layout 산식이 양쪽 동일해졌음을 확증 — Skia DateInput 102 = `measureText("MM / DD / YYYY")` 101.96, DOM 71.1 = `"연도. 월. 일."` — 잔여 차이는 전적으로 **placeholder 텍스트가 다른 것**(아래 Known Issues). Rust 신규 3건(RED 확인) + 전체 277건 통과(회귀 0, Chrome 실측 golden 25건 포함). JS 신규 4건 + layout engines 217건 통과. canvas+specs 11 failed = clean-tree baseline 동일.

### Known Issues

- **Skia 가 DateInput placeholder 에 브라우저 locale 을 반영하지 않음** (사전 존재, baseline 동일): DOM(RAC)은 브라우저 locale 로 `연도. 월. 일.` 을 그리는데 Skia 는 `_locale` 미지정 시 `en-US` 기본값(`MM / DD / YYYY`)을 쓴다. `locale` prop 을 설정해도 layout 폭에는 반영되지 않는다 — DFS post-order 상 자식(DateInput)의 `enrichWithIntrinsicSize` 가 부모(SelectTrigger)의 prop 주입보다 먼저 실행되기 때문. 레이아웃 산식이 아니라 **측정 대상 텍스트**의 문제라 본 수정 범위와 분리.

## [TagGroup labelPosition=side CSS↔Skia 정합 — flex-basis / flex item 재-solve / align-content] - 2026-07-14

### Bug Fixes

- **TagGroup `labelPosition="side"` 가 Skia 에서만 세로로 쌓이고, 칩이 한 줄로 나열되며 TagGroup 영역을 벗어남** (CSS 는 정상):
  - catalog `containerVariants["label-position"].side` / `implicitStyles` / WASM 입력(batch `flexDirection:"row"`)까지 **전부 정상**이었다. 근본은 아래 3겹이 겹친 것.
  - **(1) block-child `width:100%` 보정의 오폭** — 이 보정은 **IFC 시뮬레이션 부모** 전용이다(block 부모 + inline-level 자식 → `toTaffyDisplay` 가 row+wrap 을 합성. CSS block container 안의 block 자식이 부모 폭 100% 인 것을 재현). 그런데 게이트가 **결과 style**(`display:flex && flexWrap:wrap`)만 보고 있어 **사용자/catalog 가 선언한 진짜 CSS flex 컨테이너**까지 잡았다. **Why**: CSS flex item 은 block-level 이어도 부모 폭 100% 가 아니다 — flex-basis/grow 가 폭을 정한다. side TagGroup 이 정확히 `flex + row + wrap` 이라 TagList 가 `width:100%`(350px) 로 고정 → `Label(68) + gap(4) + 350 > 350` → 둘째 줄로 wrap → 세로 배치처럼 보임. `isInlineBlockSimulationParent(effectiveDisplay)` 게이트 추가.
  - **(2) 엔진이 `flex-basis` 를 읽지 않음** — `NodeStyle.flex_basis` 는 선언·역직렬화만 되고 `write_flex_item` 이 **항상 AUTO(-1) 를 하드코딩**했다. `flex.rs` 의 basis 해석 우선순위(명시 basis → width → content)에 명시 basis 가 도달하지 못함. **Why**: `inset_*` 와 동형의 조용한 실패 — JS 는 정확히 보내고 Rust 가 안 읽는다. 결과: `flex:1`(basis 0%) 자식이 basis=content 로 fallback → 남은 공간을 못 쓰고 자기 content 폭을 요구 → row-wrap 에서 다음 줄로 밀림. `resolve_flex_basis` 신설(`%` 는 **main 축** 기준이라 별도 `main_ctx` 전달, `content` 키워드 → CONTENT 센티넬).
  - **(3) flex item 의 subtree 를 used size 로 재-solve 하지 않음** — `solve_flex` 가 자식을 **분배 전 available 폭**으로 한 번만 solve 하고, grow/shrink 로 최종 폭이 바뀌어도 subtree 를 다시 풀지 않았다. **Why**: CSS 는 flex item 의 used main size 로 내용을 다시 배치한다(§9.9). TagList(flex:1)가 350 기준으로 칩을 wrap 해 굳은 뒤 실제 폭 278 을 받으니 **칩이 한 줄로 나열되며 자기 박스를 넘침**. 재-solve 패스 추가(used main ≠ 배치 기준 main 인 컨테이너 자식만, 1회. 증분 skip 우회를 위해 `mark_subtree_dirty` 선행, explicit main 자식은 used 값으로 임시 override 후 원복).
  - **(4) multi-line `align-content` 가 indefinite cross 에서 분배** — `cross_free = available_cross − total_line_cross` 가 `cross_is_definite` 를 안 봤다. **Why**: CSS §8.4 — 컨테이너 cross 가 indefinite(height:auto)면 컨테이너가 라인 합계로 축소되므로 분배할 free space 자체가 없다. 상속 `available_cross`(페이지 높이 400)를 그대로 써서 **없는 여유 공간**을 라인 사이에 분배 → TagList 둘째 줄이 y=202, height 232 로 폭주. 단일 라인 경로는 이미 보호돼 있었으나(ToggleButtonGroup 397→30) multi-line 이 미보호였다.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/{fullTreeLayout,taffyDisplayAdapter}.ts`, `packages/composition-engine/src/{tree,flex}.rs`
  - 검증 (live builder 실측 — test PASS 단독 종결 아님): Inspector 로 top → side 전환 시 즉시 정합. Skia Label(x0,w68) + TagList(**x72, w278, h64**) = DOM Label(x0,w67.8) + `.tag-list-wrapper`(**x71.8, w278.2, h64**). 칩 4번째가 **(0,34) 둘째 줄**로 DOM 과 동일. TagGroup 높이 350×64 일치(수정 전 429). Rust 신규 8건(RED 확인) + 전체 274건 통과(회귀 0, Chrome 실측 golden 25건 포함). JS 신규 7건 + layout engines 155건 통과. canvas+specs 11 failed/1486 passed = clean-tree baseline 과 동일.

## [레이아웃 엔진 position:absolute 지원 — SliderThumb selection box 정합] - 2026-07-14

### Features

- **composition-engine: `position:absolute` / `fixed` (out-of-flow) 지원 추가**:
  - 기존: `Style.inset_top/right/bottom/left` 필드가 `tree.rs` 에 **선언·역직렬화만** 되고 flex/block/grid 어느 알고리즘도 읽지 않았다. `Position::Absolute` 개념 자체가 없어 **absolute 자식이 일반 in-flow 자식으로 배치** → 주입한 `left/top` 이 전량 무시되고 항상 컨테이너 원점(0,0) 고정 (조용한 실패 — JS 쪽 `left → insetLeft` 매핑은 정상이라 코드만 읽으면 멀쩡해 보였음).
  - 추가: `solve_node` 가 자식을 **in-flow / out-of-flow 로 분리**(`display:none` 처리와 동형). in-flow 배치로 컨테이너 크기가 확정된 뒤 `place_absolute_children` 이 inset + margin 으로 배치한다.
  - CSS 계약 준수: absolute 자식은 **컨테이너 auto 크기·형제 배치·gap 에 기여하지 않는다**(out-of-flow). containing block = 부모 **padding box**. `left` 우선, 없으면 `right` 역산, 둘 다 auto 면 static 근사. inset `%` 는 containing block 기준. **음수 inset/margin 허용** (`translate(-50%)` 에뮬레이션 채널 — `resolve_inset` / `resolve_signed` 신규).
  - 미지원(의도적): margin auto 센터링, 조상 체인 탐색(가장 가까운 positioned ancestor — 직계 부모를 containing block 으로 간주), `fixed` 의 viewport 기준.
  - 위치: `packages/composition-engine/src/tree.rs`
  - 검증: Rust 테스트 7건 신규 (inset 배치 / `%` inset / 음수 margin 중심보정 / out-of-flow 크기·형제 비기여 / right·bottom 역산 / padding box 원점 / absolute-only 자식). RED 확인 — out-of-flow 분리를 끄면 6건 FAIL. 기존 260건 전부 통과(회귀 0).

### Bug Fixes

- **SliderThumb 의 selection/hit box 가 항상 트랙 좌측 끝에 고정**:
  - 증상: 보이는 thumb 은 정상인데 **선택 영역·클릭 판정 박스가 value 와 무관하게 원점**에 있어, thumb 을 클릭해도 안 잡히고 엉뚱한 위치가 선택됨.
  - **Why**: `implicitStyles` 가 주입하는 `position:absolute + left:${percent}% + top + marginLeft` 를 **엔진이 소비하지 않았다**(위 Features 항목). 주입 자체는 처음부터 정상이었다.
  - 수정: 엔진의 absolute 지원으로 **JS 변경 없이 해소**. 실측 (md/350px/value=50): selection box `{x:166, y:-5, 18×18}` → 중심 **(175, 4)** = DOM 과 완전 일치.
  - 검증: live builder 실측 — value 0/25/50/75/100 에서 selection box 중심이 `trackWidth × value%` 를 정확히 추종(0/87.5/175/262.5/350), y 는 트랙 세로 중앙(4) 고정. steady-state(value=80) 에서 Skia (280,4) = DOM (280,4).

- **Slider value=0 이 50 으로 튀던 문제** (falsy 함정):
  - `implicitStyles` 의 `Number(rawValue) || 50` 에서 **`0` 이 falsy 라 50 으로 대체**됨 → value 0 인 Slider 의 thumb 이 트랙 **중앙**에 배치.
  - 수정: `Number.isFinite(Number(v)) ? Number(v) : 50` — NaN 일 때만 fallback.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
  - 검증: 회귀 테스트 7건 신규 (`sliderThumbImplicitStyles.test.ts` — value=0 게이트 포함, RED 확인).

## [Slider thumb 위치 — Skia↔CSS 발산 해소] - 2026-07-14

### Bug Fixes

- **SliderThumb 이 value 를 따라가지 않고 트랙 좌측 끝에 고정 (x/y 동시 발산)**:
  - 증상: Skia 캔버스에서 Slider 의 thumb 이 **value 와 무관하게 항상 트랙 좌측 끝**에 그려지고, 세로도 트랙 중앙선에서 벗어남. CSS(Preview)는 정상 — 양쪽 발산. (실측 md/350px/value=50: DOM thumb 중심 (175, 4) vs Skia (9, 9))
  - **Why**: thumb 렌더를 SliderThumb element 가 담당하면서 그 box 배치를 `implicitStyles` 의 `position:absolute + left:${percent}% + top` 주입에 의존했는데, **composition-engine(Rust)은 absolute/inset 을 레이아웃에 반영하지 않는다** — `Style.inset_top/right/bottom/left`(`tree.rs`)는 선언·역직렬화만 되고 flex/block/grid 어느 알고리즘도 읽지 않으며 `Position::Absolute` 개념 자체가 없다. 주입된 좌표가 전량 무시되어 thumb box 가 항상 컨테이너 원점(0,0)에 고정됐다. (margin 은 정상 소비 — 엔진이 읽는 유일한 오프셋 채널)
  - 수정: thumb 렌더 소유권을 **SliderTrack 의 `slider_fill_bar` escape 로 복귀**. 이 escape 는 `_containerWidth`(트랙 실폭)와 value 를 이미 정확히 알고 replace 모드로 트랙 box 전체를 소유하므로, 엔진의 absolute 미지원과 무관하게 DOM 과 동일 좌표를 산출한다. thumb 중심 = `(width * percent, trackHeight / 2)` — RAC `useSliderThumb`(`left:${p}% + translate(-50%,-50%)`) + CSS `.react-aria-SliderThumb{top:50%}` 정합. range(2-thumb) 지원.
  - `slider_thumb` escape 는 **shapes 0** 으로 전환 (SliderThumb element 는 selection/hit box 전용) — 이중 렌더 차단.
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts` (`sliderFillBar` / `sliderThumb`)
  - 검증: 회귀 테스트 14건 (thumb x 가 value 추종 0/25/50/75/100% + y=trackHeight/2 + range 2-thumb + min/max 정규화). live builder 3축 실측 — 트랙 폭 350px / 175px 양쪽에서 Skia thumb 중심이 DOM 과 완전 일치 (폭 비의존 확인).
  - **잔존 (별도 과제)**: SliderThumb 의 **selection/hit box** 는 여전히 원점 고정 — 엔진의 `position:absolute` 지원이 전제라 본 수정 범위 밖. 보이는 thumb 은 정상.

## [Preview 상호작용 → Skia 동기화 (Disclosure header 클릭)] - 2026-07-14

### Bug Fixes

- **Preview 에서 Disclosure header 를 클릭해 접어도 Skia 는 펼친 채 남던 발산**:
  - **Why**: Preview 의 `updateElementProps`(`useRuntimeStore`)는 **Preview runtime store 전용**이라 builder store(= Skia 렌더 source)로 올라가지 않았다. 그래서 header 클릭이 CSS 에만 반영되고 Skia 는 이전 상태를 그렸다. 추가로 RAC 는 그룹 안 Disclosure 의 확장을 **그룹의** `onExpandedChange` 로만 통지하는데(개별 Disclosure 의 핸들러는 호출 안 함) `renderDisclosureGroup` 에 그 핸들러가 없어 그룹 안에서는 Preview store 조차 갱신되지 않았다.
  - 수정: (1) `renderDisclosureGroup` 에 `onExpandedChange` 추가 — 각 자식의 `isExpanded` 를 동기화. (2) Preview → builder 역전파 경로 신설 — `ELEMENT_PROPS_CHANGED` 메시지로 문서 prop 변경을 builder 에 알리고 `useStore.updateElementProps` 로 갱신(layoutVersion / dirty / canonical sync / persist 일괄 처리). 역전파는 `pickBuilderSyncedProps` **allowlist**(`isExpanded`)로 좁혀, hover/focus 같은 순수 런타임 상태가 문서 편집·undo 히스토리를 오염시키지 않게 했다.
  - 동작: header 클릭은 Inspector 의 State > Expanded 토글과 **동일한 문서 편집**으로 취급된다(undo/redo 가능, 새로고침 후 유지).
  - 검증: live builder 3축 실측 — Section 1 header 클릭 시 store `[true,false]` / CSS `aria-expanded=[true,false]` / Skia contentHeight `[20,0]` 전부 일치. `allowsMultipleExpanded=false` 규칙(다른 하나 자동 닫힘)도 양쪽 반영. 회귀 테스트 6건 신규.
  - 위치: `apps/builder/src/preview/messaging/builderPropSync.ts`, `apps/builder/src/preview/App.tsx`, `apps/builder/src/preview/messaging/messageHandler.ts`, `apps/builder/src/builder/hooks/useIframeMessenger.ts`, `packages/shared/src/renderers/LayoutRenderers.tsx`

## [DisclosureGroup allowsMultipleExpanded CSS↔Skia 미반영] - 2026-07-14

### Bug Fixes

- **DisclosureGroup 의 `allowsMultipleExpanded` 가 CSS/Skia 양쪽 모두 반영 안 됨** (단독 Disclosure 는 정상):
  - **Why**: 두 경로가 서로 다른 진실을 봤다. **DOM(RAC)** 은 그룹 상태머신(`useDisclosureGroupState`)이 개별 `isExpanded` 를 override 하며 `allowsMultipleExpanded=false` 면 후보 중 **첫 번째만** 펼친다. 반면 **Skia** 는 `applyImplicitStyles`(DisclosureContent `display:none`)와 `resolveDisclosureHeaderParent`(chevron 방향)가 오직 `disclosure.props.isExpanded === false` 만 보고 **부모 그룹의 제약을 전혀 몰라** 자식 Disclosure 를 전부 펼쳐 그렸다. 단독 Disclosure 는 그룹 상태머신이 없어 양쪽이 우연히 일치했다.
  - 추가 원인 2건: (1) `allowsMultipleExpanded` / `isExpanded` 가 `LAYOUT_AFFECTING_PROP_KEYS` 에 없어 Inspector 편집 시 `layoutVersion` 이 증가하지 않았다 → 재레이아웃 skip. `LAYOUT_PROP_KEYS`(캐시 시그니처)에도 `allowsMultipleExpanded` 누락. (2) RAC DisclosureGroup 은 **uncontrolled** 라 `defaultExpandedKeys` 가 초기값으로만 쓰인다 → `false→true` 로 되돌려도 내부 `expandedKeys` 가 축약된 `{첫 번째}` 상태를 유지(useEffect 가 축약만 하고 복원 안 함) → Preview 에 미반영.
  - 수정: 그룹 확장 판정을 `resolveGroupExpandedDisclosureIds` / `isDisclosureExpandedInContext` **SSOT helper** 로 통합하고 DOM(`defaultExpandedKeys`) / Skia(content 숨김 + chevron)가 같은 규칙을 소비하도록 정렬(RAC `useDisclosureGroupState` 와 동형 — 첫 번째 키만 유지). layout 무효화 체인 2곳에 키 등록. `renderDisclosureGroup` 의 React `key` 에 `allowsMultipleExpanded` 포함 → 토글 시 재마운트로 초기 상태 재적용.
  - 검증: live builder 왕복 실측 — 토글 OFF 시 CSS `aria-expanded=[true,false]` + Skia contentHeight `[20,0]` / ON 시 CSS `[true,true]` + Skia `[20,20]`, chevron 방향까지 대칭. 회귀 테스트 15건 신규.
  - 위치: `packages/shared/src/utils/disclosureGroupExpansion.ts`, `packages/shared/src/renderers/LayoutRenderers.tsx`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`, `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`, `apps/builder/src/builder/stores/utils/layoutInvalidation.ts`

## [ProgressCircle / Avatar size 변경이 selection 영역에 미반영] - 2026-07-14

### Bug Fixes

- **ProgressCircle / Avatar 의 size 를 바꿔도 selection 영역(레이아웃 bounds)이 안 바뀜** (CSS/Skia 공통):
  - **Why**: factory(`DisplayComponents.ts`)가 두 컴포넌트에 `props.style.width/height` 를 **32 숫자로 하드코딩**해 저장했다. 그러나 정원형 leaf 의 크기 SSOT 는 catalog `COMPONENT_RULES_TABLE.{Avatar,ProgressCircle}.sizes.{...}.height`(diameter=height) 다. inline 숫자가 있으면 `enrichWithIntrinsicSize` 가 `needsWidth/needsHeight=false` 로 **early return** 하여 size→diameter 분기가 아예 호출되지 않는다 → size 를 sm/lg 로 바꿔도 layout bounds 가 32 에 고정 → selection 박스 미갱신 + 양쪽 렌더 크기 미반영. **md 에서만 우연히 catalog 값(32)과 일치**해 정상으로 보였다.
  - 수정: (1) factory inline `width/height` 제거 — 크기 결정권을 catalog 로 환원(`marginLeft:-8` 같은 catalog 미보유 값은 보존). (2) Avatar 는 `IMAGE_INTRINSIC_TAGS` 소속이라 `needsWidth` 조건(문자열 키워드 한정)에 안 걸려 inline 제거 시 width 가 0 이 되던 문제 → `CIRCLE_LEAF_TAGS` 분기를 `needsWidth` + `childResolvedWidth` 양쪽에 추가. (3) 기존 직렬화 프로젝트의 stale inline 은 hydration migration(`circleLeafInlineSizeMigration`)이 strip — **factory 기본값(32)과 정확히 일치할 때만** 제거하여 사용자가 조정한 크기는 보존.
  - 검증: live builder 3축 실측 — Size 컨트롤 L 클릭 시 store `size:"lg"` / layout bounds 64×64(selection) / Preview DOM `data-size="lg"` width 64px 전부 일치. 기존 프로젝트 새로고침 시 stale inline(`width:32`)이 실제로 strip 되어 `style:{}` 로 정리됨을 확인. 회귀 테스트 31건 신규(레이아웃 20 + migration 11).
  - 위치: `apps/builder/src/builder/factories/definitions/DisplayComponents.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`, `apps/builder/src/adapters/canonical/circleLeafInlineSizeMigration.ts`

## [Avatar 이니셜 정렬 CSS↔Skia 발산 수정] - 2026-07-14

### Bug Fixes

- **Avatar 이니셜이 Skia 에서 원 우측 가장자리에 그려짐** (CSS 는 정중앙):
  - **Why**: `specShapeConverter` 의 text `x` 계약은 "중심 좌표"가 아니라 **좌측 오프셋 padding** 이다 — `align:center` + `x>0` 이면 `paddingLeft=x`, `maxWidth=containerWidth-2x` 로 좌우 대칭 여백을 깎는다. `avatar` primitive 가 원 중심을 지정할 의도로 `x: radius` 를 넘겨(md=16) `maxWidth = 32-32 = 0` → containerWidth 로 clamp 되면서 정렬 기준 구간이 `[16, 48]` 로 밀렸고, 그 중앙(x=32)이 지름 32 원의 **우측 끝**이 됐다. DOM(`Avatar.tsx` 의 flex `justifyContent:center`)은 원 정중앙 → 시각 발산.
  - 수정: 이니셜 text shape 을 `x=0 / y=0 + align:center + baseline:middle` 로 전환 — 컨테이너 전체 기준 중앙 정렬 관용구(다른 primitive 와 동일)로 통일.
  - 검증: 실행 중인 빌더의 실제 `specShapesToSkia` 로 실측 — 수정 전 정렬 기준 중앙 x=32(원 우측 끝) → 수정 후 x=16(원 정중앙, circle 중심과 일치). 회귀 테스트 9건 신규(수정 되돌리면 정렬 3건 FAIL 확인).
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`, `packages/specs/src/renderers/__tests__/skiaPrimitives.avatar.test.ts`

## [Canonical 문서 영구 손실 차단 — 요소 소실 사건 대응] - 2026-07-14

### Bug Fixes

- **프로젝트 요소 대량 소실 (사건 3회 재현) — 손실 아키텍처 3층 절단**:
  - **Why**: 3층 결합 — ① freeze 시 AutoRecovery `clearAllPages()` / LRU eviction 이 legacy store 를 부분 상태로 만듦 (canonical-first 인덱스 재구축과 어긋나는 split-brain, 메모리 절감 실효 없음) ② page-shell bridge 가 raw `state.elements` 로 canonical 을 전체 교체 → 부분 집합으로 잘림 ③ persist 구독이 canonical 변경마다 IndexedDB 단일 row 를 무검증 덮어쓰기 → 영구 확정. 별도 주 용의: hydration 의 `documents.get` null read 시 빈 fallback 이 migration 체인을 통과해 skeleton (fallback Home + 시스템 Components + template origins, 27 nodes) 이 되고 persist-back 이 실제 row 를 덮어씀 — 소실 후 row 가 skeleton 형상과 정확히 일치.
  - 수정 (3 커밋): 급감 가드 (`documents.put` 단일 관문 — 기존 대비 30% 미만 급감 write 기본 거부, 요소/페이지 삭제만 `allowShrink` 통과) + `documents_backup` ring (DB v20, 프로젝트당 5세대/60s 버킷) + null read 시 persist-back 금지 + AutoRecovery store-level unload 제거 + bridge canonical-first 재구성 전환.
  - 검증: 단위/static 계약 17건 + live exercise — 급감 write (24→2) 차단 실측, 페이지 추가/삭제 roundtrip 보존, **부분 store (3요소) 강제 후 bridge 동작에도 canonical 무손실** (구 코드라면 붕괴).
  - 위치: `apps/builder/src/lib/db/indexedDB/{adapter,documentPersistGuard}.ts`, `apps/builder/src/builder/hooks/{usePageManager,useAutoRecovery}.ts`, `apps/builder/src/builder/stores/elementLoader.ts`, `apps/builder/src/builder/main/BuilderCore.tsx`

## [CSS↔Skia 정합 수정 2차 — parity 잔여 백로그 sweep] - 2026-07-14

### Bug Fixes

- **전 컴포넌트 공통 폭 +2px 발산 — 페이지 경계선 border→outline**:
  - **Why**: `.app .canvas` 의 `border: 1px solid` 가 border-box 폭을 좌우 1px 씩 잠식 → Preview iframe viewport 가 390 대신 388 로 수축, 모든 컴포넌트의 CSS 측정치가 Skia 대비 -2px. outline 은 레이아웃 비참여라 시각 동일 + 폭 복원.
  - 위치: `apps/builder/src/builder/styles/layout/canvas.css`, `apps/builder/src/builder/main/BuilderCanvas.tsx`
- **field 계열 10종 높이 +2~+6 발산** (TextField/TextArea/DateField/TimeField/NumberField/Select/ComboBox/SearchField/DatePicker/DateRangePicker):
  - **Why**: 2겹 — ① 엔진이 `display:none` 자식(도움말/에러 슬롯)을 flex flow + gap 계산에 참여시킴 (CSS 는 완전 비참여 + trailing gap 없음). ② implicitStyles field 분기 gap 이 고정 4 fallback — catalog sizes gap(xs 2/sm 4/md 6/lg 8/xl 10)과 불일치.
  - 수정: `solve_node` 에서 display:none 자식 flow 제외 + `zero_subtree_layout`(레이아웃 0 + dirty clear — 증분 skip 게이트 보존). gap 은 `specSizeField` catalog read-through.
  - 회귀 테스트: `tree_golden.rs` N9 (display:none 자식 — trailing gap 미발생 golden)
  - 위치: `packages/composition-engine/src/tree.rs`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
- **Disclosure/DisclosureGroup 높이 발산 + 그룹 초기 펼침 비대칭**:
  - **Why**: 3겹 — ① catalog DisclosureHeader sizes(28/30/32)가 DOM 실측(트리거 line-height + paddingY 8×2 = 32/36/40)과 불일치. ② disclosurecontent 높이가 텍스트 미분류로 fs×1.5 fallback. ③ canonical 렌더 경로(CanonicalNodeRenderer) flatten 이 customId 를 누락 → `defaultExpandedKeys` 미매칭으로 DOM 그룹이 항상 접힘 (Skia 는 펼침 — 구조 발산).
  - 수정: catalog 32/36/40 + generated CSS 재생성, content 텍스트 높이 extractSpecTextStyle 산출, renderDisclosureGroup/renderDisclosure `customId ?? id` 정렬
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`, `packages/shared/src/renderers/LayoutRenderers.tsx`, `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- **GridList 카드 높이 -30 / Tree 항목 메트릭 발산**:
  - **Why**: GridList — Skia 카드 높이가 fontSize 합산 모델인데 CSS 는 line-height 모델(label 24 + desc 20) → 행당 -10. Tree — catalog TreeItem md 가 DOM starter `Tree.css` 고정 메트릭(32px/text-base/16)과 불일치 + gap 이 starter `@supports :has` 재선언(0)과 발산.
  - 수정: gridListCard(Skia shapes)와 layout 높이 분기를 `getLabelLineHeight` 동일 심볼 공유로 전환(Layer D 계약), TreeItem md 32/text-base/16 + Tree gap `"0px"` (containerStyles 타입 계약 `Record<string,string>`)
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`, `packages/shared/src/catalog/generated/componentRulesTable.ts`
- **빈 텍스트 leaf 유령 24px + InlineAlert 높이 -10**:
  - **Why**: 텍스트 leaf 가 text/label 부재여도 fs×1.5 fallback 높이를 가짐 → CSS 0h 와 발산 (기본 텍스트 없는 Heading 등). InlineAlert 는 자식 Heading/Description lineHeight 미주입(generated CSS 배율 1.4/1.5 미러 부재) + border 2px 레이아웃 미참여.
  - 수정: 빈 leaf → 높이 0 가드 2곳(TEXT_LEAF 분기 + 최종 generic fallback), inlinealert 분기에 lineHeight("px" 문자열)/borderWidth 주입
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`
- **Separator 기본 HR 이 2×18 outline box 로 렌더** (Skia 390×1 이 정합):
  - **Why**: 수동 CSS 가 `.horizontal` 클래스/`aria-orientation` 속성만 매치하는데 RAC 는 수평(기본) 방향에 aria-orientation 을 emit 하지 않음 → 기본 HR 이 어떤 크기 규칙에도 안 걸림 + generated CSS paddingY(4/8/16)가 import 순서에 따라 두께로 잔존.
  - 수정: `:not(.vertical):not([aria-orientation="vertical"])` 기본 수평 규칙(width 100%/height 1px/padding 0) + `data-size`/`data-variant` 계약 병기, catalog Separator paddingY→0 (간격은 margin 소관)
  - 위치: `packages/shared/src/components/styles/Separator.css`, `packages/shared/src/catalog/generated/componentRulesTable.ts`

## [CSS↔Skia 정합 수정 — ADR-916 후속 parity sweep] - 2026-07-13

### Bug Fixes

- **Tabs 가 Skia 캔버스에서 페이지 전체 높이로 폭발** (CSS 53px vs Skia 844/1024px):
  - **Why**: 엔진 `solve_flex` 가 column flex 컨테이너의 main 축 available 산출 시, 컨테이너 height:auto(indefinite) 인데도 부모가 내려준 definite available(페이지 높이)을 그대로 main 으로 전달 → `implicitStyles` 가 TabPanels 에 주입하는 `flexGrow:1` 이 grow 분배를 발동해 페이지 높이를 채움. CSS §9.7 은 free space 를 definite main 에서만 산출 — 블록 레벨 stretch 는 인라인축(width)에만 적용된다. Taffy 시절엔 indefinite 처리로 무해했던 주입이 ADR-916 자체 엔진 전환 후 회귀로 전환된 사례.
  - 수정: column 방향 main(=height)은 컨테이너 자신의 explicit height 가 있을 때만 definite, auto 면 `-1`(indefinite sentinel) 전달 — `flex.rs` 의 기존 Step 0 가드(available<0 → grow 미발동, hypothetical 유지)가 발동
  - 회귀 테스트: `tree_golden.rs` N7 (Tabs 실전 형상 — definite 부모 안 auto-height column + flexGrow:1 자식, CSS 산술 손계산 golden). 변조→RED 확인 후 fix→GREEN (panels 971→24, tabs 1000→53)
  - 검증: cargo test 258 PASS (lib 234 + golden 15 + tree_golden 8 + doc 1), live builder 에서 Tabs 선택 확인 — TabList+패널이 콘텐츠 높이로 수렴
  - 위치: `packages/composition-engine/src/tree.rs` (solve_flex avail_main), `packages/composition-engine/tests/tree_golden.rs`
- **Table 이 Skia 캔버스에서 고정 높이를 잃고 48px 로 수축** (CSS 402px vs Skia 48px):
  - **Why**: CSS `Table.tsx` 는 `heightMode`(default "fixed") 에서 컨테이너 높이를 `props.height`(px, default 300) 로 고정하는 가상화 스크롤 계약인데, Skia layout 은 이 prop 을 소비하지 않고 content(헤더 24+바디 24)로 수축 — 렌더러만 아는 높이 계약이 layout 경로에 부재.
  - 수정: `applyImplicitStyles` 에 table 분기 추가 — heightMode "fixed" 이고 사용자 `style.height` 미명시일 때 `props.height` 를 style.height/minHeight 로 주입. "auto"/"viewport"/"full" 은 content 유지(vh 단위는 엔진 px 모델 밖). `LAYOUT_PROP_KEYS` 에 `height`/`heightMode` 추가 — 편집 시 캐시 시그니처 무효화 (Disclosure isExpanded 선례 동형)
  - 검증: live builder Table 선택 배지 390×400 (CSS 402 border-box 정합), type-check PASS
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`, `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`
- **Calendar/RangeCalendar 가 Skia 캔버스에서 부모 폭 전체로 stretch** (CSS fit-content 256/238 vs Skia 390/768 — 2026-07-07 수정의 미해결 잔존):
  - **Why**: 2겹 소실 — ① 엔진 block 자식 intake(`write_block_item`)가 fit-content 센티넬(-2)을 AUTO(-1)로 붕괴시켜 block.rs 의 shrink-to-fit 커널(필드표상 지원)에 도달 못 함 (a359d513a 는 flex cross 축만 보존, body 는 block). ② JS 직렬화(`parseCSSPropWithContext`)가 intrinsic 키워드를 전역 drop — Calendar 컨테이너 intrinsic 은 자식(CalendarGrid) 측정 의존이라 enrich 선해석 불가.
  - 수정: ① `write_block_item` width/height intake 를 `resolve_cross_dimension_opt`(fit-content 보존)로 전환. ② `buildNodeStyle` flex 분기에 calendar/rangecalendar allowlist — `width:fit-content` 를 record 에 복원해 엔진 센티넬로 전달 (전역 passthrough 는 2-pass 상호작용 미검증이라 allowlist 한정)
  - 회귀 테스트: `tree_golden.rs` N8 (block 컨테이너 안 fit-content flex column — 변조 RED 200→fix GREEN 120)
  - 검증: cargo test 259 PASS, live builder Calendar 390→278 / RangeCalendar 390→278 수렴 (잔여 Δ22/40 은 CalendarGrid 셀 메트릭 drift — 별도 항목)
  - 위치: `packages/composition-engine/src/tree.rs`, `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`

- **Switch/StatusLight/Breadcrumbs 폭 발산 — fit-content ↔ stretch 분류 3종 정렬** (2026-07-13 parity sweep):
  - **Switch**: catalog(D3 SSOT) containerStyles 는 `inline-flex` 인데 수동 `Switch.css` 가 `display: flex`(블록 stretch) → CSS 388 vs Skia 89 발산. CSS 를 inline-flex 로 정정 (S2 Switch 동일). **Why**: 수동 CSS 가 catalog 에서 파생되지 않은 D3 위반 잔존
  - **StatusLight**: `createDefaultStatusLightProps`(palette 단순 경로)가 `display: flex` 로 남아 있던 이중 default 소스 — 2026-06-23 정정이 factory definition 에만 적용됨. getDefaultProps 도 inline-flex 로 정정 + Preview 렌더러 하드코드 기본값도 inline-flex 정렬. CSS 388 → 75 (Skia 75 정합)
  - **Breadcrumbs**: catalog containerStyles 는 `display: flex`(블록 레벨 → stretch 의도)이고 CSS 도 388 stretch 인데, Skia 만 `INLINE_BLOCK_TAGS` fit-content 주입으로 194 수축 → 컨테이너 "breadcrumbs" 를 Set 에서 제거 (자식 "breadcrumb" 은 유지, 높이는 implicitStyles 분기 존속). Skia 194 → 390 (CSS 정합)
  - **Menu 는 보류**: factory `width:100%`(2026-06-23 사용자 결정 — Menu=목록 표현) vs Preview 렌더러(트리거 chip 표현)의 표현 방식 충돌 — 분류 수정이 아닌 표현 설계 판단 필요
  - 위치: `packages/shared/src/components/styles/Switch.css`, `packages/shared/src/renderers/LayoutRenderers.tsx`, `apps/builder/src/types/builder/unified.types.ts`, `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`
- **CheckboxGroup/RadioGroup 높이 16px 수축** (CSS 84 vs Skia 68):
  - **Why**: 2겹 gap 소실 — ① group 자체 gap(Label↔items)이 `specFallback.gap ?? 4` 였는데 containerStyles 의 토큰 문자열이 직렬화에서 drop 되어 실효 0. ② synthetic items wrapper gap 이 8 fallback — CSS `--cb-items-gap`/`--radio-items-gap` 은 12px 고정.
  - 수정: group gap = catalog sizes gap(sm 8/md 12/lg 16, generated CSS `[data-size]` 미러), wrapper gap = 12 고정
  - 검증: live builder CheckboxGroup/RadioGroup 84=84 정합
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`

### Infrastructure

- **layout 디버그 전역 `__composition_LAYOUT_DEBUG__` (dev 전용)**: 콘솔/자동화(Chrome MCP)의 CSS↔Skia parity 검증 하니스가 `getSharedLayoutMap`/`getSharedLayoutVersion` 을 읽는 단일 진입점. 콘솔 dynamic import 가 Vite HMR 이후 앱 그래프와 다른 모듈 인스턴스를 받는 문제 우회. production 빌드 제외.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`

## [문서 깨진 링크 475건 일괄 정리 — 경로 drift 복구 + 죽은 링크 해제] - 2026-07-13

### Documentation

- **`docs/` + `.claude/` 전역에 깨진 상대 링크 475건 누적**:
  - **Why**: 근본 원인은 파일 이동 후 인바운드 링크 미갱신. 최대 단일 원인은 `23ba7f814` "Reorganize docs directory based on Diátaxis framework"(2025-12-27) — **108 rename / 0 delete** 인데 이를 가리키던 링크를 하나도 갱신하지 않았다. 여기에 ADR `completed/` 이관, ADR 파일명 리네임(slug 변경), 삭제된 소스 파일 인용이 겹쳐 누적됐다.
  - 조사 결과 "삭제되어 복구 불가"로 보이던 링크 대부분이 실제로는 **rename 이었음** — git rename 이력을 SSOT 로 삼아 정확한 현행 경로를 복원했다(추측/유사도 매칭 아님).
- **439건 재연결** — 우선순위 기반 해석:
  1. git rename 이력 체인 추적(`git log --diff-filter=R -M`) → 정확한 현행 경로 (118건)
  2. 저장소 내 basename 유일 매칭 (201건)
  3. basename 다중 매칭 → 선호 규칙(`.claude` > `.agents`, 같은 트리, 최단 경로) (88건)
  4. ADR 번호 기반 (32건) — **링크 레이블의 `[ADR-NNN]` 번호가 authoritative**. 파일명 slug 만 stale 한 경우(`076-listbox-items-ssot.md` → `-hybrid.md`, `022-s2-color-token.md` → `-migration.md`) 같은 번호의 실제 파일로 연결. 파일명 유사도 매칭은 오연결 위험이 있어 배제 — 예: `[ADR-106](106-skip-css-generation-debt-resolution.md)` 는 레이블·설명("charter")상 `106-skipcssgeneration-audit-charter.md` 가 정답이나 유사도로는 `106-b-*` 가 선택됨.
- **36건 링크 해제(텍스트 보존)** — 대상 파일이 실제로 존재하지 않는 경우:
  - **Why**: 완료 ADR·CHANGELOG 는 작성 시점의 사실 기록이다. ADR-908 이 `ReactRenderer.ts` 를, ADR-906 이 `GridList.spec.ts` 를 인용한 것은 정확한 기록이고, 그 파일들은 이후 ADR-142/912 가 삭제했다. CHANGELOG 가 당시 추가된 테스트 파일을 인용한 것도 마찬가지. 링크만 제거하고 파일명 텍스트는 남겨 기록을 보존한다 — 존재하지 않는 파일을 "유사한 현행 파일"로 재연결하면 기록이 왜곡된다.
  - 해당: 삭제된 소스 파일 인용(903/905/906/908), Diátaxis 재편 이전에 삭제된 문서(`PLANNED_FEATURES.md`, `performance/*` 등), CHANGELOG 의 삭제된 테스트 파일 인용, 저장소 파일이 아닌 malformed 경로(`~/.claude/…/memory/…`).
- **의도적 미수정 2건** — 링크 형태이나 실제 링크가 아닌 **문서 예시**:
  - `.claude/rules/changelog.md` 의 CHANGELOG 헤더 작성 예시, `docs/adr/design/115-*-breakdown.md` 의 bash 블록 내 "ADR 본문에 붙여넣을 텍스트" 예시. 링크 검사기는 깨진 링크로 보고하지만 경로를 고치면 예시가 오히려 틀어진다.
- 검증: 재스캔 결과 잔여 깨진 링크 = 위 의도적 2건뿐. diff 453 add / 452 delete (링크 타깃만 치환, 본문 텍스트 무변경). 소스 코드 변경 0.

## [docs/adr 문서 정리 — 완료 ADR 5건 completed/ 이관 + README 상태 표 재정합] - 2026-07-13

### Documentation

- **`docs/adr/` 루트에 종결 상태(Implemented / Superseded / Deprecated) ADR 5건이 잔존**:
  - **Why**: ADR-916 이관(2026-07-08)과 같은 문제의 잔여분. 루트는 진행 중(Proposed / Accepted / Partial) ADR 전용이라는 컨벤션과 실제 상태가 어긋나, "루트에 있으면 진행 중"이라는 정본 조회 가정이 깨진다.
  - 이관: ADR-142(Implemented 2026-06-02) / ADR-133(Deprecated 2026-07-08, 후속 ADR-149) / ADR-144(Superseded by ADR-145) / ADR-147(Superseded by ADR-148) / ADR-920(Superseded by ADR-910) → `docs/adr/completed/` (`git mv`, 본문 내용 무변경).
  - 이관 후 루트 잔존 11건은 전부 진행 중 상태로 확인 — 013 / 015 / 016 / 027(Partial) / 117 / 134 / 148 / 149 / 910 / 911 / 915.
  - `design/` · `reviews/` 하위 폴더는 ADR 번호 기준 유지(기존 컨벤션) — 본문 파일만 이동.
- **참조 경로 갱신** — 이관 5건을 가리키던 링크 전수:
  - 이관 파일 내부: `design/…` → `../design/…`, `completed/…` → 형제 경로, 저장소 루트 참조 `../../` → `../../../`.
  - 외부 참조: `CLAUDE.md`, `.claude/rules/{canvas-rendering,css-tokens,ssot-hierarchy}.md`, `.claude/skills/composition-patterns/SKILL.md`, `docs/COMPONENT_SPEC.md`, `docs/reference/components/SPEC_CSS_BOUNDARY.md`, `docs/reference/audits/2026-05-30-canonical-component-inventory.md`, `docs/adr/{148,149}-*.md`, `docs/adr/completed/{010,032,034,036,131,146,907,908}-*.md`, `docs/adr/design/{133,142,147}-*-breakdown.md`, `docs/adr/reviews/144.md`.
  - `docs/CHANGELOG.md` 의 과거 엔트리 내 경로 문자열은 작성 시점 기록이라 유지(historical).
- **`docs/adr/README.md` 상태 표 재정합** — 이관 과정에서 드러난 기존 오분류 동시 교정:
  - **Why**: "미구현(Proposed)" 표에 이미 Implemented 인 ADR 8건(141 / 143 / 145 / 146 / 912 / 913 / 914 / 916)이 잔존해, 표만 보면 완료 작업이 미착수로 읽혔다. 이관 대상 142 / 147 / 920 도 같은 표에 있었다.
  - 조치: Implemented 9건(141 / 142 / 143 / 145 / 146 / 912 / 913 / 914 / 916) → "완료" 표 이동(완료일 컬럼 채움), Superseded 2건(147 / 920) → "Superseded / Deprecated" 표 이동(후속 ADR 명시). 행 본문은 보존.
  - 현황 요약 수치 실측 재계산: 완료 156(완료 표 146 + Superseded/Deprecated 10) / 부분 완료 3 / 미구현 10 / 합계 169. 기존 수치(132 / 8 / 13 / 153)는 stale.
  - 사전 존재 깨진 링크 6건 동시 수정 — 032 / 034 / 035 / 037 / 039 가 `completed/` 이관 후에도 루트 경로로 참조되던 건, 존재하지 않는 `design/068-…-breakdown.md` 링크 제거.

## [docs/adr 문서 정리 — ADR-916 completed/ 이관 + README 표 포맷 점검] - 2026-07-08

### Documentation

- **ADR-916 본문 파일이 Status=Implemented(2026-07-06) 인데도 `docs/adr/completed/`로 이동되지 않고 루트에 잔존**:
  - **Why**: 900번대 다른 Implemented ADR(900/902~~909/912~~914)은 모두 `completed/`에 있는데 916만 예외로 남아 있어 디렉터리 컨벤션과 실제 상태가 어긋났다. 정본 조회 시 "Implemented는 completed/에 있다"는 가정이 깨지는 지점.
  - 조치: `git mv docs/adr/916-unified-rust-engine.md docs/adr/completed/916-unified-rust-engine.md`. 참조 경로 갱신 — `.claude/skills/composition-patterns/SKILL.md`, `.claude/skills/composition-patterns/reference/layout-engine.md`, `docs/reference/components/SPEC_CSS_BOUNDARY.md`, `docs/adr/design/916-unified-rust-engine-breakdown.md`, `docs/adr/README.md` 완료 표 링크. 별도 계획 문서와 `docs/adr/reviews/916.md`는 실행 당시 시점 기록으로만 보존한다.
  - design/reviews 하위 폴더(`docs/adr/design/`, `docs/adr/reviews/`)는 completed 여부와 무관하게 ADR 번호 기준으로 유지되는 기존 컨벤션 확인 — 916도 동일 패턴이라 본문 파일만 이동.

### Infrastructure

- **`docs/adr/README.md` 마크다운 표 컬럼 정렬 패딩으로 파일 크기 759KB, 최장 라인 17,881자**:
  - **Why**: "완료" 표의 "비고" 컬럼이 최장 셀 폭에 맞춰 전 행 공백 패딩됨(Prettier 기본 GFM 표 정렬) — 706줄 중 303줄이 500자 초과, 편집/diff 가독성 저하.
  - 압축 포맷(최소 패딩) 시도 → PostToolUse Prettier hook이 Edit 직후 재정렬해 원복(오히려 793KB로 증가). Prettier 3.x가 GFM 표 컬럼 정렬을 강제하는 기본 동작이라 hook 설정 변경 없이는 우회 불가 — 사용자 확인 후 정렬 패딩 상태 그대로 수용, 916 경로/링크 갱신만 반영.

## [Calendar CSS↔Skia 정합 — 요일 locale + width fit-content] - 2026-07-07

### Bug Fixes

- **자체 엔진 flex cross 축이 `fit-content` 를 `auto` 와 구분 못 해 stretch** (Calendar width 발산 근본 #2):
  - **Why**: `flex.rs` `parse_item` 이 cross size 를 `auto`(stretch 대상) vs 명시 px 만 구분. `tree.rs` `resolve_dimension_opt` 이 fit-content 센티넬(-2)을 `None`(→AUTO -1)로 붕괴시켜 flex cross 축에서 `cross_is_auto=true` → 컨테이너 cross(부모 폭)로 stretch. CSS 는 `width: fit-content` = shrink-to-fit(align-items:stretch 무시)
  - 수정: `resolve_cross_dimension_opt`(tree.rs) 가 fit-content 만 `flex::CONTENT`(-2) 센티넬로 보존 → `flex.rs` `parse_item` 이 `content_cross`(자식 intrinsic)로 shrink-to-fit. `write_flex_item` cross intake 에서 CONTENT 센티넬은 `spec_to_content` 감산 제외
  - 위치: `packages/composition-engine/src/flex.rs`(`parse_item` cross_content + `CONTENT` pub), `src/tree.rs`(`resolve_cross_dimension_opt` + `write_flex_item`)
  - 검증: RED(cross fit-content → stretch 100) → GREEN. cargo lib 234(신규 `fit_content_cross_uses_content_not_stretch` + `flex_column_child_fit_content_width_shrinks_not_stretch`) + golden 15 + tree_golden 7 = 0 failed. 격리 엔진 실측: Calendar(fit-content, 자식 246) → 246 확증

- **Calendar 자식(CalendarHeader/CalendarGrid) `width: 100%` 주입이 fit-content 붕괴** (Calendar width 발산 근본 #3):
  - **Why**: `implicitStyles` 가 두 자식에 `width: 100%` 주입 → Calendar(fit-content) 부모에서 100% 가 available 폭으로 해소 → 자식이 부모 폭으로 stretch → Calendar fit-content = max child = available(334) 로 팽창(CSS 256 발산). CalendarGrid 는 `INLINE_BLOCK_TAGS` 미등록이라 intrinsic 폭 미주입
  - 수정: `width: 100%` 주입 제거(whiteSpace:nowrap 유지). CalendarGrid 를 `INLINE_BLOCK_TAGS` 추가 → `enrichWithIntrinsicSize` 가 intrinsic 폭(cellSize*7+gap*6 = md 246) 주입(CalendarHeader 동형). DateInput(2026-06-23) layout width:100% 제거 선례 동형
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`(width:100% 제거), `utils.ts`(INLINE_BLOCK_TAGS calendargrid)
  - 검증: type-check PASS(baseline 69), calendar-symmetry 3 PASS. `calculateFullTreeLayout`(canonical) 실측: Calendar → **246**(자식 246, CSS 정합)
  - **미해결(진행 중)**: 실제 화면 render(selection badge)는 **여전히 514**. 앱 render 는 `renderNodesMap`(projection render 노드, ADR-135/136 render-space)에서 layout 계산 → canonical 경로(246)와 별개로 514 산출. projection render 경로 조사 후속. canonical layout / 엔진 fit-content 수정 자체는 유효

- **Calendar 가 Skia 에서 부모 폭 전체로 stretch (Skia 350px vs CSS fit-content 256px)** (전수조사 발견):
  - **Why**: CSS 는 `CalendarCommon.css .react-aria-Calendar { width: fit-content }` 로 콘텐츠 폭(md 256px) 렌더. Calendar catalog rule 은 `structure.containerStyles.width: "fit-content"` 를 갖지만, layout fallback `resolveContainerStylesFallback` 은 **top-level `rule.containerStyles`(경로 A)** 또는 **`structure.composition`(경로 B)** 만 읽고 `structure.containerStyles` 는 직접 소비 안 함. Calendar 는 spec 삭제(ADR-912) + `structure.composition` 부재(archetype "calendar") → 두 경로 다 미도달 → `{}` 반환 → 부모 flex-column 에서 `align-items: stretch` 로 Calendar 가 부모 폭 전체로 stretch → Skia 350 vs CSS 256 발산
  - 수정: Calendar/RangeCalendar rule 에 **top-level `containerStyles: { display, flexDirection, width: "fit-content" }`** 추가(경로 A 도달). TabPanel/Tree 선례 동형(spec 삭제 + composition 부재 컨테이너의 확립된 fix). `structure.containerStyles` 는 dirty baseline 용 유지(동일값 → drift 0). collection-item(ListBoxItem/GridListItem)은 top-level 미추가 → `{}` lock 유지(회귀 없음)
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(Calendar/RangeCalendar top-level containerStyles)
  - 검증: RED (`resolveContainerStylesFallback("calendar"/"rangecalendar", {})` → `{}`) → GREEN 3종 PASS(`display`/`flexDirection`/`width: fit-content` 반환 + parentStyle.width override 우선). 소비 경로 실측: fallback 출력이 `{}` → `{width:"fit-content",...}` 로 전환 확인(엔진 fit-content → content 폭 해소는 Toolbar/Menu/ToggleButtonGroup 동일 mechanism). type-check PASS(baseline 69), listboxitem/gridlistitem `{}` lock + calendar escape 9 회귀 유지
  - 후속(비차단): 셀 pitch(Skia cellSize 30 + gap 6 = 36 vs CSS 34) 는 여전히 별도 작업

- **Calendar Skia 요일 헤더가 영어(`Sun Mon…`)로 나와 Preview(한국어 `일 월…`)와 발산** (전수조사 발견):
  - **Why**: Skia `calendar_month_grid` / `calendar_grid` escape 는 요일을 `Intl.DateTimeFormat(props.locale ?? "en-US")` 로 생성한다. Calendar 계열 factory(DatePicker/DateRangePicker/Calendar/RangeCalendar)가 CalendarGrid 자식에 `locale` 을 주입하지 않아 escape 가 `en-US` 로 fallback → 영어 요일. 반면 Preview DOM 은 RAC `I18nProvider` 의 locale context(`ko`)를 React context 로 읽어 한국어 → 두 렌더 발산. nav 타이틀(`2026년 7월`)은 CalendarHeader 의 static string(이미 `navigator.language` 로 생성)이라 양쪽 다 한국어여서 타이틀만 맞고 요일만 어긋남
  - **근본 위치는 escape 아닌 factory**: escape mechanism 자체는 정상(locale 주면 한국어 emit — node 실측 확인). CalendarGrid.binding 도 `locale` 을 D2 prop 으로 이미 선언. 결함은 factory 미주입뿐
  - 수정: `buildCalendarInitData` 가 monthText 와 동일 `navigator.language` locale 을 반환하도록 하고, 4개 Calendar 계열 factory 의 CalendarGrid 자식 props 에 `locale` 주입(RangeCalendar 는 헤더 타이틀 inline locale 도 동일 const 로 DRY)
  - 위치: `apps/builder/src/builder/factories/definitions/DateColorComponents.ts`(`buildCalendarInitData` + DatePicker/DateRangePicker/Calendar 3사이트), `DisplayComponents.ts`(RangeCalendar)
  - 검증: RED (factory 4종 CalendarGrid 에 locale 없음) → GREEN `calendarGridLocale.test.ts` 4 PASS. live builder: 기존 CalendarGrid 에 `locale: "ko-KR"` 주입(신규 factory 산출과 동일 상태) 후 escape locale 해소 실행 → 요일 `일 월 화 수 목 금 토` = DOM 정합(`matchesDOM: true`, 이전 en-US → `Sun…`). type-check PASS(baseline 69 불변), calendar escape 회귀 9 PASS
  - 후속(비차단): 셀 pitch 발산(Skia cellSize 30 + gap 6 = 36 vs CSS 34) 은 별도 작업 — 본 수정은 지배적 locale 발산만

## [grid 컨테이너 CSS↔Skia 정합 — ProgressBar/Meter/Slider 레이아웃 실패 해소] - 2026-07-06

### Bug Fixes

- **grid 컨테이너(ProgressBar/Meter/Slider) 배치 시 Skia 레이아웃 전면 실패 + 무한 재시도** (전수조사 발견, 실제 CRITICAL 2겹):
  - **버그 #1 — grid branch dimension 숫자 정규화 누락**:
    - **Why**: `buildNodeStyle` 의 grid branch 는 `applyCommonTaffyStyle`(숫자 그대로 반환) 결과를 partial 로 직접 반환하여 flex 경로의 `taffyStyleToRecord.dim()` 정규화를 우회. 이 buildFull 경로는 `normalizeStyle.dimToString()` 후처리도 안 거침(persistentTaffyTree 경로 전용). factory 가 `rowGap: 4`(숫자) + `display: grid` 로 저장 → 숫자 rowGap 이 그대로 `build_tree_batch` 로 가 `invalid type integer 4, expected string` parse error → `calculateFullTreeLayout` null → persistentTree 리셋 무한 재시도 → 레이아웃 전면 실패
    - 수정: grid branch return 직전 `normalizeGridDimFields()` 로 gap/padding/border/size/margin/inset/flexBasis 숫자 → px string 정규화 (flex 경로와 대칭, `IMPLICIT_DIM_PROPS` 목록 정합). `layout-engine.md` "grid 직렬화 3경로 모두 정규화" 원칙의 grid branch 공백 보완
    - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (`GRID_DIM_FIELDS`, `normalizeGridDimFields`)
  - **버그 #2 — grid 명시 auto row intrinsic 미측정** (#1 수정 후 표면화):
    - **Why**: 기존 `solve_grid` intrinsic 측정은 implicit auto row(`gridTemplateRows` 미명시 + placement 미명시) 경로만 발동. ProgressBar/Meter 는 `gridTemplateRows: "auto auto"` 명시 + 자식 gridRowStart/End placement 구조 → 미측정 → `grid.rs` 가 auto 를 1fr 로 근사해 available_h 를 나눠 가져 컨테이너가 availH 전체로 폭발(716) 또는 0 붕괴(availH<0)
    - 수정: 명시 track 안에 auto 토큰이 있으면 자식을 solve 해 intrinsic height 획득, 자식 gridRowStart(1-based line)로 row 결정 후 auto 토큰 row 만 max intrinsic 으로 치환(px/fr/% row 보존). flex.rs `cross_is_definite` 수정과 동형 축
    - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` auto row 측정 확장)
  - **버그 #3 — grid 명시 auto column intrinsic 미측정** (#2 수정 후 cross-check 로 표면화):
    - **Why**: `solve_grid` 는 auto row 만 측정하고 auto **column** 은 `grid.rs` 의 1fr 근사(available 분배)에 맡김. ProgressBar `gridTemplateColumns: "1fr auto"` 에서 CSS 는 auto col = value content(~29), 1fr = 나머지(~307) 인데, Skia 는 auto col 이 1fr 과 available 을 반반 나눠 가져 value 폭 발산(168) + 중앙으로 밀림(CSS 는 우측 정렬)
    - 수정: `template_cols` 에 auto 토큰이 있으면 자식 intrinsic width 측정, gridColumnStart(1-based line)로 col 결정 후 auto 토큰 col 만 max intrinsic width 로 치환(1fr/px/% col 보존). auto row 와 대칭 로직
    - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` auto column 측정 추가)
  - 검증: 브라우저 재빌드 wasm 실측 — ProgressBar height **32**(availH=-1/716 양쪽 동일 = 폭발 없음, 이전 716/4), value **width 30 @우측**(CSS 29 정합, 이전 168 @중앙), Track/Label CSS 정합, parse error 소멸. cargo lib 231 + golden 15 + tree_golden 7 = 0 failed(회귀 테스트 6종 추가: auto row 측정/px+auto row 혼합/row 건너뜀 + auto column 측정/px+auto col 혼합/col-major fallback + ProgressBar 실구조 row·col 동시 auto 통합), type-check PASS. reviewer approve(CRITICAL/HIGH 0, col-major fallback 자체 정정 + row×col 통합 테스트 갭 반영)
  - 후속(비차단): auto row/column 측정의 `gridRowStart`/`gridColumnStart` "span N" / 음수 line 미지원(현재 factory 순수 숫자 line 만 사용) — 향후 `grid.rs::parse_grid_line` 재사용 리팩터 대상

- **Slider grid track/label 겹침 + value 아래쪽 배치** (전수조사 후속 — grid 버그 #4, Slider 전용):
  - **Why**: Slider 는 catalog `containerStyles` 에 `gridTemplateColumns: "1fr auto"` 만 있고 **`gridTemplateRows` 미방출**(암묵 2행). 자식은 `gridRowStart` 로 label/output=row1, track=row2 명시. 버그 #2 가 고친 auto row 측정은 `gridTemplateRows` **명시** 케이스만 커버 → Slider 처럼 rows 미명시 + placement 명시인 조합은 두 측정 경로 모두 미발동(경로 A 는 `placement_spec.is_empty()` 요구, 경로 B 는 `template_rows` 에 "auto" 토큰 요구) → `template_rows` 빈 문자열 그대로 `grid.rs` 전달 → row track 0개 → `cell_bounds_for_child` 가 track 부재로 height=100 fallback + row2 를 gap 위치에 배치 → 전 자식 겹침 + 컨테이너 height 폭발(104)
  - 수정: `solve_grid` 경로 A(implicit auto row)의 `placement_spec.is_empty()` 조건 제거. `gridTemplateRows` 미명시 + 자식 존재 시(placement 무관) 자식 `gridRowStart` 로 row 결정, 각 행 max intrinsic 을 px 트랙으로 주입(placement 없는 자식은 row-major `i / col_count` fallback)
  - 위치: `packages/composition-engine/src/tree.rs` (`solve_grid` `implicit_rows` 경로)
  - 검증: RED (Slider 실측 348/rowGap4/1fr auto/placement) → height 104 재현. GREEN → 32(row0 20 + gap 4 + row1 8), track y=24. cargo lib 232 + golden 15 + tree_golden 7 = 0 failed(회귀 테스트 1종 추가: `grid_implicit_auto_row_with_placement_slider_realstruct`). live: Preview track y=24, label 겹침 해소

- **Slider thumb 위치가 Skia 와 불일치 (range 편집 후 stale)**:
  - **Why**: `renderSlider` 는 uncontrolled(`defaultValue`) 로 렌더하고 value 변경 시 `key` 에 value 를 담아 리마운트로 새 defaultValue 를 반영. 그런데 key 에 `minValue`/`maxValue` 가 빠져서 range(min/max) 편집은 value 불변 → key 불변 → **리마운트 실패** → RAC 가 이전 range 에 stale → 내부 value 가 새 max 로 clamp 되어 thumb 이 Skia(store value 기준 percent)와 발산 (store value=50/max=63 인데 RAC input value=63 clamp → thumb left 100% vs Skia 79.4%)
  - 수정: remount key 에 min/max 포함(`${id}-${value}-${min}-${max}`). min/max prop 도 동일 상수 참조로 SSOT 정합
  - 위치: `packages/shared/src/renderers/SelectionRenderers.tsx` (`renderSlider`)
  - 검증: RED (maxValue/minValue 변경 시 key 불변) 2건 재현. GREEN → `selectionRemountKey.test.tsx` 9 테스트 PASS(Slider value/min/max 3종 추가). live: 수정 후 CSS input value=50 = store, thumb left=79.37% = Skia 79.4% 정합. type-check PASS

## [flex 단일 라인 align-content/definite — ToggleButtonGroup height 397→30] - 2026-07-06

### Bug Fixes

- **단일 라인 flex 컨테이너가 Skia 에서 height 폭발 (ToggleButtonGroup: CSS 30 vs Skia 397)** (ADR-916 후속):
  - **Why**: 자체 Rust 엔진(composition-engine) `flex.rs` 가 단일 라인 컨테이너에도 `align-content: stretch`(CSS 기본값)를 적용해 라인 cross 를 available_cross 로 부풀림. CSS §8.4 는 align-content 를 다중 라인에서만 적용. 부모(body flex column, height 764)가 준 큰 available_cross 로 `alignItems: center` 컨테이너 라인이 764 근처까지 팽창 → 자식이 중앙으로 밀려 컨테이너 bounding box(max_bottom) 폭발
  - **2차 전제 (착수 중 발견)**: 이 엔진은 "단일 라인 컨테이너의 라인 cross = 컨테이너 cross"(자식 stretch 대상)를 별도 로직 없이 align-content stretch 로 대신 구현 → align-items center/end/stretch/clamp 전부 부풀려진 라인 cross 에 의존. 단순히 stretch 를 끄면 `align-items: stretch` 자식이 0 으로 붕괴. 근본은 `available_cross` 가 definite(컨테이너 cross 확정=height 명시)와 indefinite(height auto)를 구분 못 함
  - 수정: `flex_layout` 에 `cross_is_definite: bool` 인자 도입. definite 면 단일 라인 라인 cross = available_cross(align-items 가 그 공간 채움/정렬), indefinite 면 자식 max(제자리 → 컨테이너 content 축소). `align_content` stretch_extra 는 다중 라인 전용으로 환원. `place_line_cross_axis` 무변경. `tree.rs solve_flex` 가 `is_row ? explicit_h>0 : explicit_w>0` 로 definite 판정 전달
  - 검증: 브라우저 로드 재빌드 wasm 실측 — ToggleButtonGroup(indefinite) group height **30**(Preview DOM CSS height 30 일치, 이전 397), definite(height 명시 100) group 100 + 자식 중앙 y35. cargo 247 PASS, 신규 6 테스트(definite/indefinite/다중 라인/tree 통합) + 기존 회귀 5종 유지
  - 위치: `packages/composition-engine/src/flex.rs` (`flex_layout` cross_is_definite + 단일 라인 라인 cross 승격, `align_content_offsets`), `src/tree.rs` (solve_flex 호출부)
  - 후속(비차단): 부모 stretch 상속 definite(자기 cross 미명시라도 부모가 자식 cross 확정) 미구현 — 자기 cross 명시만 definite 판정. ToggleButtonGroup/현 catalog 미해당

## [자체 엔진 box-sizing 계약 정합 — specified size border-box] - 2026-07-06

### Bug Fixes

- **Button 등 padding 보유 요소가 Skia 에서 CSS 보다 크게 렌더** (ADR-916 후속):
  - 자체 Rust 엔진(composition-engine)이 specified width/height 를 content-box 로 해석 + padding/border 재가산 → enrich 가 주입하는 border-box 값과 이중 가산. md Button 기준 높이 30→40, 폭 +26px (paddingX 12×2 + border 1×2)
  - **Why**: 앱 세계 전체(Preview `* { box-sizing: border-box }`, store, 구 Taffy 0.9 계약)는 border-box 인데 신규 엔진 커널만 CSS 기본값(content-box)으로 작성됨(`c046daedc`). dual-run fixture 가 전부 padding=0 이라 계약 차이가 미검출
  - 수정: `tree.rs` specified intake 층에서 border-box→content 변환 (커널 block/flex/grid.rs 무변경). 같은 뿌리 형제 결함 — 컨테이너 own padding 의 자식 available 감산·좌표 offset·percent containing-block ctx — 도 함께 정합
  - 검증: 브라우저 로드 wasm 실측 — Button xs~xl 높이 20/22/30/42/54 (CSS 정합), 컨테이너 padding20 → 자식 stretch 260 + 좌표(20,20), 50% + paddingX10 → border-box 200, padding=0 회귀 불변
  - 위치: `packages/composition-engine/src/tree.rs` (`spec_to_content` / `pad_border_start` intake helper, solve_flex/block/grid own padding)

## [Button xl border-radius CSS↔Skia 대칭 복원] - 2026-07-06

### Bug Fixes

- **Button `xl` size 모서리 반경 발산 (Preview 8px vs Skia/catalog 12px)**:
  - **Why**: `Button.tsx` wrapper 의 legacy `SIZE_BORDER_RADIUS` 상수(Component Spec Phase 1 잔재)가 `xl: 8`(`--radius-lg`)을 **inline style** 로 주입 → catalog SSOT(`sizes.xl.borderRadius = {radius.xl}` = 12px)와 불일치. inline style(specificity 0-1-0-0)이 generated CSS `[data-size="xl"] { border-radius: var(--radius-xl) }`(12px)를 무조건 override → Preview DOM 8px 렌더, Skia Canvas 12px 렌더 → D3 시각 대칭 파괴. (lg 는 양쪽 8px 라 우연히 일치, xl 만 발산.)
  - 수정: wrapper 의 inline `borderRadius` 주입 + `SIZE_BORDER_RADIUS` 상수 제거 → border-radius 를 catalog-generated CSS(`[data-size]`) 단일 경로로 위임. 사용자 명시 `style.borderRadius` 는 그대로 전달(RAC style prop).
  - 검증: Chrome MCP live — xl Button Preview computed `border-radius: 12px`(inline 소멸) + Style Panel Border Radius 12 표시 + Skia canvas 렌더 대칭. type-check baseline 69 신규 0.
  - 위치: `packages/shared/src/components/Button.tsx`

## [Taffy 완전 제거 — ADR-916 endgame] - 2026-07-06

### Architecture

- **Taffy 외부 의존 완전 제거 — 자체 엔진(composition-engine) 단독 운영** (ADR-916 endgame, kill criteria 3/3 후속):
  - **Why**: ADR-916 Implemented(2026-07-06, layout 엔진 전환 완료) + endgame kill criteria 3/3 충족 후 잔존 Taffy 물리 자산 정리 — 단일 엔진 SSOT 확립 + 번들 감소(이중 WASM 로드 해소) + R4 폴백 이중화 HIGH 위험 해소.
  - Rust crate 2종 물리 삭제: `packages/composition-layout`(taffy 0.10, Phase 0-A 폐기 경로) + `apps/builder/src/builder/workspace/canvas/wasm`(composition-wasm, taffy 0.9, 3,578라인, `taffy_bridge`/`binary_protocol`/`block_layout`/`grid_layout`) + WASM 산출물 `wasm-bindings/pkg`(452K).
  - Taffy 소비 JS 삭제(13파일): `taffyLayout.ts`/`rustWasm.ts`/`layoutEngine.ts` + `wasm-worker/` 전체(5) + dual-run 하네스(`dualRunEngines`/`dualRunHarness`(+test)/`dualRunLive.test`/`persistentTaffyTree.seam.test`).
  - `createLayoutEngine()` 자체 엔진 단독 반환 — Taffy 폴백 경로(`new TaffyLayout()`) 소멸. 로드 실패 보상은 기존 15초 폴링/재시도 부트스트랩 유지(신규 폴백 코드 없음). 부팅 게이트 `isRustWasmReady`→`isCompositionEngineReady` 전환(bootstrap + fullTreeLayout).
  - 타입 소스 이전: `LayoutResult`→`compositionEngine.ts`, `TaffyStyle` 계열/`TaffyNodeHandle`→신규 `layoutTypes.ts`. 보존 변환기 `TaffyFlexEngine`/`TaffyBlockEngine`/`TaffyGridEngine` 은 이름만 Taffy — 순수 JS element→style 변환, 자체 엔진이 소비.
  - build 스크립트 정리: `build:layout`/`wasm:build`/`wasm:dev`/`wasm:test` 제거, `wasm:build:engine`(자체 엔진) 존치.
  - 검증: type-check baseline 69 신규 0 / composition-engine cargo test 233 PASS(Taffy crate 삭제 후 자체 엔진 테스트 무손실) / Chrome MCP live exercise — `[ADR-916] composition-engine WASM initialized` 부팅 + 콘솔 에러 0 + 컨테이너·grid 배치 + Canvas↔CSS 시각 정합(폴백 없이 자체 엔진 단독).
  - 위치: `apps/builder/src/builder/workspace/canvas/{wasm-bindings,layout/engines,hooks}/`, 삭제 `packages/composition-layout/`.

## [자체 단일 Rust 레이아웃 엔진 통합 — ADR-916 Implemented] - 2026-07-06

### Architecture

- **layout 엔진 Taffy → 자체 Rust 엔진(composition-engine) 전환 완료** (ADR-916, Accepted → Implemented):
  - **Why**: 외부 라이브러리(Taffy) 래핑 제거 + WASM 경계 횡단 최소화. Skia(CanvasKit) 렌더 유지, layout 계산만 자체 `composition-engine` crate(taffy 무의존)로 이관.
  - Phase 1 self-impl 3종: `flex.rs`(CSS Flexbox §9.7 grow/shrink 분배 + §9.3 wrap + align-content), `block.rs`(§8.3.1 margin collapse + through-collapse chain), `grid.rs`(§7 track sizing + §8 placement + repeat/minmax/named areas).
  - Phase 2-B `tree.rs`: 트리 오케스트레이션(DFS 빌드 + display 디스패치 + 증분 dirty 조상 전파) + `LayoutEngineAPI` batch 계약(`build_tree_batch` → `compute_layout` → `get_layouts_batch`). 자식 좌표는 부모 content-box 상대(taffy_bridge 계약 동일).
  - live 전환: `USE_RUST_LAYOUT_ENGINE` + `UNIFIED_ENGINE` flag true → `createLayoutEngine` seam 이 자체 엔진 주입. builder 진입 시 `[ADR-916] composition-engine WASM initialized`, Canvas(Skia 자체 엔진 layout) ↔ CSS Preview 시각 정합.
  - 검증: cargo test 233 PASS(lib 211 + golden 15 + tree_golden 6 + doc 1), dualRunLive(자체 vs Taffy) 12/12 diff 0, tree_golden(Chrome 실측 독립 oracle) 6/6, type-check baseline 69 신규 0.
  - **명시 잔존(승격 후 관리, 미완 아님)**: (a) Taffy 폴백 로직 이중화(R4 HIGH) — endgame(Taffy 물리 삭제)까지 dual-run CI 상시 관리, (b) 2-CAT propagation WASM 배선 = 성능 최적화 후속 단위(layout 정확성 무관), (c) Phase 2 렌더 계층(2-C scene / 2-D commands / 2-E text) = "이관 대상 제외" 구조적 종결.
  - 위치: `packages/composition-engine/src/{flex,block,grid,tree,style,cascade,display,spatial_index}.rs`, `apps/builder/src/builder/workspace/canvas/wasm-bindings/{layoutBridge,compositionEngine,featureFlags}.ts`.

## [ADR-916 P2-CAT R10 — text-xl line-height CSS↔Skia 대칭 복원] - 2026-07-05

### Bug Fixes

- **text-xl line-height 30 → 28 (Skia↔CSS 시각 발산 정합)** (ADR-916 P2-CAT ② R10):
  - **Why**: primitive `typography.ts` 의 `text-xl--line-height` 가 30 이었는데(주석 `20 × 1.5 = 30` — 다른 9개 토큰의 CSS `calc()` 배율 패턴 미준수), CSS 정본 `shared-tokens.css --text-xl--line-height: calc(1.75 / 1.25)` 는 20 × 1.4 = **28**. Skia 렌더(`getLabelLineHeight`/`resolveToken` 경유 → primitive 직접 소비)는 30px, CSS Preview(`var(--text-xl--line-height)`)는 28px 로 xl 크기 텍스트(Heading/Paragraph xl)의 줄 높이가 D3 시각 대칭 위반.
  - 정본 판정: CSS `calc(1.75/1.25)=28` 이 정본(text-2xs~text-5xl 10개 토큰 중 text-xl 만 유일 발산, 나머지 9개는 전부 CSS calc 정합). primitive 30 이 버그.
  - 수정: `typography.ts` `text-xl--line-height` 30 → 28 (primitive SSOT 정정 — Skia·CSS 양변이 같은 소스에서 28 로 수렴). `token.types.ts` 주석 정정. L0 ledger `KNOWN_TYPOGRAPHY_DIVERGENCES` 에서 `text-xl:lineHeight` 제거(정합화 → 등록 유지 시 stale).
  - 회귀 가드: `typography.test.ts` 신규 — 대표값 golden(10 토큰) + `getLabelLineHeight(20)===28` Skia 소비 계약 앵커(30 회귀 시 RED 확인). `typographyCssParity.test.ts` L0 전수 정합(ledger 밖)이 text-xl 을 자동 감시. `tokenSnapshot` 갱신.
  - baseline 대조: builder 테스트 67 failed 는 R10 변경 전(HEAD, text-xl=30)과 후가 동일 — 전부 pre-existing(propagation rule 구조 등, line-height 무관), R10 회귀 0.
  - 위치: `packages/specs/src/primitives/typography.ts`, `renderers/utils/typographyCssParity.ts`, `types/token.types.ts`.

## [ADR-916 grid gap offset fix + Phase 2-A/2-B 이관 착수] - 2026-07-04

### Bug Fixes

- **Grid gap offset 승계 버그 수정**:
  - **Why**: gap 이 있는 CSS Grid 에서 2번째 이후 column/row 의 시작 offset 계산이 바로 앞 트랙 뒤 gap 을 누락했다. `GridLayout.utils.ts` 와 `composition-engine/src/grid.rs` 가 같은 `colStart-2`/`rowStart-2` 조건을 공유해 현재 JS live 경로와 Rust 후보 엔진이 같은 버그로 대칭이었고, Phase 2 배선 시 잘못된 기준선이 될 수 있었다.
  - 수정: JS live helper와 Rust `grid.rs` 를 동시에 `colStart-1`/`rowStart-1` 조건으로 정정해 앞선 트랙 각각 뒤의 leading gap 을 offset 에 포함.
  - 회귀 가드: Rust golden ignore 해제, row+column leading gap fixture 추가, JS `GridLayout.utils.test.ts` 추가.
  - 검증: `cargo test --manifest-path packages/composition-engine/Cargo.toml`, `cargo clippy --manifest-path packages/composition-engine/Cargo.toml --tests`, `pnpm exec vitest run apps/builder/src/builder/workspace/canvas/layout/GridLayout.utils.test.ts`, `pnpm run codex:typecheck` PASS.

### Architecture

- **ADR-916 자체 Rust 레이아웃 엔진 live 전환 — Taffy → composition-engine (seam C-2a)**:
  - **Why**: 외부 Taffy WASM 래핑을 taffy-free 자체 엔진(`packages/composition-engine`)으로 교체 (ADR-916). 본 변경으로 live builder 레이아웃 계산이 `createLayoutEngine()` seam 을 통해 자체 엔진(`CompositionEngineLayout`)으로 전환됐다. 시각 결과는 Taffy 와 동일(diff 0) — 사용자-가시 동작 변화 없음, 엔진만 교체.
  - seam 배선 3 sub-scope 완료: (B) dual-run self-diff 측정 + (C-1) 실전 catalog 진단 → 선결 2건(flex.rs main-negative / grid.rs implicit auto row) 해소 → (C-2b) 실전 중첩/혼합 5 fixture 전면 diff 0 proof → **(C-2a) 런타임 배선 + flag 전환**.
  - 배선: `compositionEngineWasm.ts`(전역 로드) + `compositionEngine.ts`(동기 wrapper) — taffy `rustWasm.ts`/`TaffyLayout` 패턴 미러링. 자체 pkg `LayoutEngine` 이 camelCase 16-메서드 = `LayoutEngineAPI` 이름 일치라 raw 타입 변환만. `USE_RUST_LAYOUT_ENGINE: false→true`, wasm-pack out-dir 을 apps/builder 내부(`wasm-bindings/composition-engine-pkg/`)로 지정(`package.json wasm:build:engine`).
  - 안전망: 자체 WASM 미준비 시 `createLayoutEngine` 이 TaffyLayout 으로 폴백 — 회귀 시 flag 조정으로 rollback.
  - live 검증(Chrome MCP): builder 진입 → `createLayoutEngine()` 이 `CompositionEngineLayout` 반환 + flex row 실계산(leaf-b x=30) + Canvas/Skia 렌더 무붕괴. dualRunLive 12/12 + type-check(baseline 69) 무회귀.
  - 위치: `apps/builder/src/builder/workspace/canvas/wasm-bindings/{compositionEngine,compositionEngineWasm,layoutBridge,init,featureFlags}.ts`.

### Infrastructure

- **ADR-916 Phase 2-A/2-B 이관 진행** (내부 — live Builder 영향 없음):
  - `style.rs` — CSS 값 산술 파서 커널 + font/border shorthand 분해 (`cssValueParser.ts` 순수 산술 계층).
  - `cascade.rs` — CSS Cascade Resolver 순수 헬퍼 (`cssResolver.ts` 자기완결 계층): 상속 규칙/초기값/cascade 키워드/currentColor/font-variant/논리→물리 속성.
  - `display.rs` — CSS Display 변환 순수 문자열 계층 (`taffyDisplayAdapter.ts` 자기완결 계층): Display Level 3 이원 구조 파싱/blockification/inline-level 판정/자식 분류.
  - `tree.rs` (2-B) — 트리 오케스트레이션 (`taffy_bridge.rs` batch 계약 대응). 단위 1: handle 관리(alloc/recycle) + `build_tree_batch`(post-order 파싱) + `get_layouts_batch`(flat) + 증분 API. 단위 2: post-order flex solve — flex 컨테이너에서 자식 재귀 solve → `flex.rs` 배치 → 자식 bounding box 로 컨테이너 content 크기(height:auto) 도출, NodeStyle → flex flat f32(논리축 매핑) 변환. 단위 3-a: block dispatch — block 컨테이너에서 자식 재귀 solve → `block.rs` 배치 → bounding box 로 컨테이너 크기 도출, NodeStyle → block flat f32(19필드 물리축) 변환, margin collapse/auto-width stretch/fit-content 는 block.rs 내부 처리. 단위 3-b: grid dispatch — grid 컨테이너에서 `grid.rs`(문자열 계약) 어댑터로 셀 배치 → 각 자식 셀 크기로 재귀 solve → 셀 좌표 반영, track array → space-join / gridColumnStart+End → `parse_grid_line` 결합 형식 재조립 / 자식 placement 파이프 직렬화. 단위 4: 증분 dirty 추적 — 증분 API(update_style/set_children/mark_dirty)가 변경 노드 + 조상 체인을 dirty 로 전파(taffy mark_dirty 계약 이식, `TreeNode.parent` 포인터), `solve_node` 는 clean 서브트리 skip(저장 layout 재사용)하고 dirty 서브트리만 재계산, available 변경/clear 시 skip 무효화(%/auto stale 방지). flex/block/grid 3 display dispatch + 증분 재계산 완성 → tree.rs 오케스트레이션 4 단위 완료 = LayoutEngineAPI batch 계약 완비(다음은 seam 배선 + dual-run). DFS 상단(resolveStyle/implicit/enrich = tag·spec·store 도메인)은 JS 잔류.
  - store·DOM 의존(getRootComputedStyle/var()/토큰), spec SSOT 의존(FONT_STRETCH_KEYWORD_MAP), tag 도메인 의존(INLINE_BLOCK_TAGS/VERTICAL_ALIGN_MIDDLE_TAGS) 은 JS 잔류. seam(`createLayoutEngine`) 미배선 순수 함수라 사용자-가시 변화 없음. 검증은 composition-engine cargo test/clippy 기준으로 고정.
  - `wasm.rs` (2-B seam 배선 A) — 자체 crate WASM wrapper. `LayoutEngine`(`#[wasm_bindgen]`) struct 가 내부 `tree::LayoutTree` 를 감싸 JS `LayoutEngineAPI`(layoutBridge.ts) 16 메서드 노출 — `taffy_bridge.rs::TaffyLayoutEngine` 과 동일 시그니처라 `createLayoutEngine` seam 에 교체 가능하게 꽂힘. `#[cfg(target_arch = "wasm32")]` 게이트로 native cargo test 무영향, binary protocol 미구현(JSON 경로 fallback). **"seam 배선"은 3 sub-scope 로 분해**: (A) WASM 바인딩(live 0, 완료) → (B) dual-run self-diff 측정(다음) → (C) `createLayoutEngine` flag 전환(live 엔진 교체, (B) self-diff 0 통과 전제). **seam 미배선 유지** — wrapper 존재 ≠ flag 전환. wasm32 컴파일 성공 확인, live builder 영향 0.

## [CalendarHeader 헤더 정렬 + Style 패널 layout 동기화 — nav 중앙 정렬 & flex 편집 반영] - 2026-07-02

### Bug Fixes

- **CalendarHeader 월/년 text 가 Skia 에서 왼쪽으로 치우침 (center 정렬 무력화)**:
  - **Why**: `inline_icon_text` primitive 의 center text shape 가 `align:"center"` + `whiteSpace:"nowrap"` 을 동시 지정 → `nodeRendererText.ts:107-110` 이 nowrap 시 `layoutMaxWidth=100000` 으로 `maxWidth` 를 덮어 center 정렬이 무력화 → text 가 `x=cellSize` 에서 왼쪽 정렬(왼쪽 치우침). DOM `<header>` 는 flex heading center 라 중앙 → CSS↔Skia 비대칭. 동형 nav 를 그리는 `calendar_grid` primitive 는 nowrap 미지정이라 정상(증거).
  - 수정: text shape 에서 `whiteSpace:"nowrap"` 제거 → text 가 `[cellSize, width-cellSize]` 대칭 슬롯에서 center → 중심 = width/2 (DOM 대칭). "2026년 7월" 은 maxWidth 내라 wrap 안 됨.
  - live 검증: DOM header heading offset 중앙(119), Skia text 중심 width/2 정합.

### Features

- **CalendarHeader Style 패널 Layout(Gap/Padding/Justify) 편집 → Skia+DOM 동기화** (사용자 요청 B2):
  - **배경**: CheckboxGroup 은 자식(Label/Checkbox)이 개별 Element 라 컨테이너 `props.style` layout 편집이 Taffy flex 로 반영되나, CalendarHeader 는 chevron/text/chevron 이 `inline_icon_text` primitive shape(자식 Element 아님, 3개 고정)라 Style 패널 Layout 편집이 반영 안 됐다. 자식 Element 컨테이너화(B1)는 Calendar `<header>` self-compose 해체 + hydration migration 2개 HIGH 리스크 대공사라, primitive 가 element.props.style 을 직접 소비하는 B2 채택.
  - **Skia**: `inline_icon_text` 가 `style.paddingLeft/paddingRight/columnGap/rowGap/gap/justifyContent` 를 읽어 chevron/text/chevron 을 flex-like 배치(space-between 기본 / center). 기본값(style 미지정)은 기존 좌표 유지(회귀 0). style-ssot 규칙: gap 은 columnGap/rowGap longhand 우선 → shorthand gap fallback.
  - **DOM**: `renderCalendar`/`renderRangeCalendar` 가 자식 CalendarHeader element.props.style 의 layout 부분(`resolveCalendarHeaderStyle` 화이트리스트)을 `Calendar`/`RangeCalendar` 의 `headerStyle` prop 으로 전달 → `<header style>` 에 반영. header 구조/ARIA(D1) 불변, 시각 layout(D3)만 적용.
  - **delegating 전환**: `renderFacetDeclaration` 에 `calendar`/`rangecalendar` 를 `delegating-internal` 로 추가 → Preview 가 `INTERNAL_RENDERERS[calendar]=Calendar` 직접 컴포넌트 대신 `renderCalendar`(headerStyle 지원) 경유. generic 자식 재귀 skip(CalendarHeader/CalendarGrid 는 Calendar self-compose). contract INVENTORY internal 29→31 갱신.
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 에 style 소비 계약(padding/gap/justifyContent 반영 + 미지정 시 기존 좌표 유지 + longhand 우선) 추가. `renderFacetDeclarationContract.test.ts` INVENTORY 31 갱신. specs 514 / shared 444 / contract 7 tests PASS.
  - live 검증: CalendarHeader style `{justifyContent:"flex-start", columnGap:"8px"}` 편집 → DOM header inline `justify-content: flex-start; column-gap: 8px;` 적용 + heading offset 119→42 이동 확인. Skia 는 primitive 가 동일 style 소비(대칭). type-check PASS(baseline 69).
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(inlineIconText style 소비), `packages/shared/src/renderers/DateRenderers.tsx`(resolveCalendarHeaderStyle + renderCalendar headerStyle), `packages/shared/src/renderers/LayoutRenderers.tsx`(renderRangeCalendar headerStyle), `packages/shared/src/components/{Calendar,RangeCalendar}.tsx`(headerStyle prop), `apps/builder/src/preview/components/renderFacetDeclaration.ts`(calendar/rangecalendar delegating)

- **CalendarHeader flex layout 기본값 catalog baseline + DOM `<header>` space-between** (B2 마무리 — Style 패널 표시):
  - **Why**: B2 로 편집 소비 경로는 열렸으나 CalendarHeader element 에 flex layout **기본값**이 없어 Style 패널 Layout(Direction/Justify)에 아무것도 안 뜨고 DOM `<header>` 도 `justify-content` 미지정이었다(Heading `flex:1` 로 중앙 효과만). 사용자 지적: "display:flex, flex-direction:row, justify-content:space-between, align-items:center 그대로 적용하면 Style 패널 동기화되고 끝". DOM `<header>` 는 이미 flex 컨테이너(prev button / Heading / next button 자식)라 CheckboxGroup 과 동일 구조 — layout 기본값만 baseline 공급하면 됨.
  - 수정: catalog rule `CalendarHeader.structure.containerStyles` 에 `{display:flex, flexDirection:row, justifyContent:space-between, alignItems:center}` baseline 추가(DisclosureHeader structure 동형, element="header"). Style 패널이 이 baseline 을 Layout section 에 Direction(row)/Justify(space-between)로 표시 + 편집 시 element.props.style override → Skia+DOM 동기화. `CalendarCommon.css` `.react-aria-Calendar header` 에 동일 flex 4값 명시(구 display:flex+align-items 만 → justify-content:space-between + flex-direction:row 보강). generated `CalendarHeader.css` 신규 emit.
  - live 검증: CalendarHeader 선택 → Style 패널 Layout 에 Direction=row / Justify=space-between 표시(확대 스크린샷 확인). DOM `<header>` computed `display:flex; flex-direction:row; justify-content:space-between; align-items:center`. Justify center 편집 → DOM `justify-content:center` override, 원복 → base space-between 복귀. shared 444 / specs 514 PASS, type-check baseline 69.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(CalendarHeader.structure), `packages/shared/src/components/styles/CalendarCommon.css`(header flex 4값)

- **CalendarHeader `flex-direction: column` Skia 반영 (row→column CSS↔Skia 대칭)**:
  - **Why**: B2 는 `justifyContent/gap/paddingX` 만 소비하고 `flexDirection` 은 안 읽었다 → direction row→column 변경 시 CSS Preview 는 자식(prev/heading/next)이 세로로 쌓이는데 Skia `inline_icon_text` 는 row 절대좌표 고정이라 반영 안 됨(D3 시각 발산). live 측정: CSS Preview column 시 자식 relY 0/30/51(세로), Skia 가로 유지.
  - 수정: `inlineIconText` 가 `style.flexDirection` 소비 → column/column-reverse 면 세로 3슬롯 배치(위 chevron `cellSize/2` / 중앙 text `colHeight/2` / 아래 chevron `colHeight-cellSize/2`, x 는 컨테이너 중앙 `width/2`). colHeight 는 `_containerHeight`(CONTAINER_DIMENSION_TAGS 주입) 폴백 `cellSize*3+gap*2`. row 는 기존 좌표 유지(회귀 0).
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 에 column 계약(chevron x=중앙 동일 + y 세로 쌓임 + text y=colHeight/2) + row 유지(y 동일, x 가로) 추가. specs 516 tests PASS.
  - live 검증: direction column 편집 → CSS Preview + Skia canvas 양쪽 세로 배치("‹" 위 / "2026년 7월" 중앙 / "›" 아래) 대칭 확인. type-check baseline 69.
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(inlineIconText column 분기)

- **CalendarHeader text/chevron 세로 중앙 정렬 — `_containerHeight` 우선 (align-items:center 대칭)**:
  - **Why**: `inlineIconText` 가 `cy = size.height`(rule 고정 md 30)/2 로 세로 위치를 잡고 **실제 노드 높이(`_containerHeight`)를 안 썼다** → 노드 높이가 rule 30 과 다를 때(예: Calendar size lg → header 36) text/chevron 이 세로 중앙에서 위로 3px 치우침(catalog `align-items:center` 인데 Skia 미반영). width 는 `_containerWidth` 우선인데 height 만 rule 고정이라 비대칭.
  - 수정: `height` 를 `_containerHeight`(주입, 실제 노드 높이) 우선 → `size.height`(rule) → 30 폴백 순으로 변경(width 와 대칭). `cy = 실제 높이/2` → DOM `<header>` `align-items:center` 와 정합. column 분기 colHeight 도 동일 변수 재사용.
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 에 `_containerHeight` 우선(주입 36 → 모든 shape y=18) + 미주입 폴백(size.height 30 → y=15) 계약 추가. specs 518 tests PASS.
  - live 검증: Calendar size lg(header 36) → Skia text/chevron y=18(세로중앙), CSS Preview 와 대칭(수정 전이면 y=15 위 치우침). type-check baseline 69.
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(inlineIconText height=\_containerHeight 우선)

- **CalendarHeader text 세로 중앙 — `y:0` baseline 위임 (chevron 과 정렬 경로 통일)**:
  - **Why**: `_containerHeight` 우선으로 cy 를 실제 높이 중앙으로 잡아도 text 가 여전히 위쪽 치우침. 근본은 specShapeConverter 의 **text baseline 경로 분기**: text `baseline:"middle"` + `shape.y>0` 이면 `paddingTop = y - lineHeightPx/2`(**lineHeight 근사 경로** — 미지정 lineHeight 는 `getLabelLineHeight` 계산값이라 실제 glyph 세로 위치와 어긋남), 반면 chevron(icon_font) `baseline:"middle"` 은 `shape.y` 무시하고 항상 `containerHeight/2`(진짜 중앙). 두 경로가 달라 text 만 위로 치우침(사용자 지적: "text lineHeight/자체 정렬 문제" 정확).
  - 수정: text shape `y: cy` → **`y: 0`** (baseline:"middle" 유지). specShapeConverter 의 `shape.y===0` 경로 → `paddingTop = (containerHeight - textBlockHeight)/2` (컨테이너 실제 높이 기준 진짜 세로 중앙 = chevron 과 동일 결과, lineHeight 근사 회피). row/column 분기 text 모두 `y:0` 통일.
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 세로중앙 계약 갱신 — chevron y=`_containerHeight`/2 / text y=0 + baseline:"middle"(specShapeConverter 컨테이너 중앙 위임). specs 519 tests PASS.
  - live 검증: Skia header text "2026년 7월" 이 chevron 과 세로 중앙 정렬(확대 스크린샷) — 위쪽 치우침 해소, CSS Preview 대칭. type-check baseline 69.
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(inlineIconText row/column text y=0)

- **CalendarHeader text 세로 중앙 근본 — `verticalAlign` 전달 경로 신설 + Style 패널 동기화** (앞 `y:0` 이 불완전했던 진짜 근본):
  - **Why**: `y:0` + baseline:"middle" 로도 text 가 여전히 위쪽 치우침. 사용자가 근본을 짚음: "text lineHeight/자체 정렬 문제" → Style 패널 Typography **Vertical Align:center** 를 수동 설정하니 Skia 세로 중앙이 됨. 진짜 근본 = **specShapeConverter 의 text case 가 `verticalAlign` 필드를 SkiaNodeData(`node.text`)로 전달하지 않음** → nodeRendererText `computeDrawY` 가 verticalAlign=undefined → top 정렬(위쪽). baseline(좌표 계산)과 verticalAlign(glyph 세로 정렬)은 별개 축인데 후자 경로가 아예 없었다. icon_font(chevron)는 baseline:middle → containerHeight/2 라 세로 중앙, text 만 verticalAlign 누락으로 top.
  - 수정: (1) `TextShape` 타입에 `verticalAlign?: "top"|"middle"|"bottom"|"baseline"` 필드 신설(`shape.types.ts`). (2) `specShapeConverter` text case 가 `shape.verticalAlign` → `node.text.verticalAlign` 전달(누락 경로 신설). (3) `inlineIconText` center text 가 `verticalAlign = style.verticalAlign ?? "middle"`(기본 중앙 + Style 패널 override) 지정, row/column 공통. → computeDrawY 가 `(node.height - textHeight)/2` 진짜 세로 중앙.
  - **catalog + Style 패널 동기화** (사용자 요구): catalog rule `CalendarHeader.structure.containerStyles.verticalAlign:"middle"`(dirty baseline/synthetic) + **factory 3곳**(createCalendarDefinition / DatePicker·DateRangePicker 내부 Calendar)이 `props.style.verticalAlign:"middle"` 주입 → Style 패널 Typography Vertical Align 이 "middle" 표시(useTypographyValues 는 element.props.style 만 읽으므로 factory inline 필수) + 편집 시 primitive override. catalog structure == factory inline → dirty 0.
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 에 text verticalAlign 기본 "middle" + style.verticalAlign override(top/bottom) 계약 추가. specs 521 / shared 444 tests PASS.
  - live 검증: element.props.style.verticalAlign:"middle" → Style 패널 Vertical Align "middle" 표시(JS 확인) + 사용자가 수동 설정 시 Skia 세로 중앙 직접 확인함(수정은 그 수동 동작을 primitive 기본값 + factory 로 자동화). type-check baseline 69. (이번 세션 Skia 스크린샷은 CDP 캡처 타임아웃으로 미수행 — 경로/테스트/사용자 실측 선례로 확증.)
  - 위치: `packages/specs/src/types/shape.types.ts`(TextShape.verticalAlign), `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts`(text verticalAlign 전달), `packages/specs/src/renderers/skiaPrimitives.ts`(inlineIconText verticalAlign), `apps/builder/src/builder/factories/definitions/DateColorComponents.ts`(factory 3곳 style), `packages/shared/src/catalog/generated/componentRulesTable.ts`(structure verticalAlign)

- **전수조사 후속 — catalog↔factory 동기화 갭 3건 (사용자 요청 "당연히 이뤄져야 한다")**: CalendarHeader 사후 발견 대신 전 컴포넌트에서 catalog↔factory layout 동기화 갭을 병렬 조사(3 축: factory inline layout 위반 / structure.containerStyles Skia 미도달 / verticalAlign 동종 누락).
  - **TabPanel — 자식 flex-column layout Skia 미도달 (Skia↔CSS 발산)**:
    - **Why**: TabPanel 은 spec 삭제(ADR-912 cutover) + `structure.composition` 부재(archetype "collection") 라, layout(`display:flex/column`)이 `structure.containerStyles` 에만 있어 `resolveContainerStylesFallback("tabpanel")` 이 경로 A(top-level `rule.containerStyles`)·경로 B(`structure.composition`) 둘 다 미도달 → `{}` 반환 → `getElementDisplay` block 라우팅 → 패널 안 사용자 자식이 Skia 에서 block(flex gap/align/flexGrow 유실), DOM 은 generated `TabPanel.css` `display:flex;flex-direction:column` → Skia↔CSS 비대칭.
    - 수정: ListBox/Menu/Tree 선례처럼 catalog `TabPanel` 에 top-level `containerStyles:{display:flex,flexDirection:column}` 승격 → 경로 A 가 Skia 에 공급. `structure.containerStyles`(동일값)는 dirty baseline(`resolveCatalogContainerBase` last-wins)용 유지 → baseline drift 0. padding 은 `implicitStyles` tabs/tabpanels 분기가 size 별 주입하므로 top-level 미포함.
    - 회귀 가드: `resolveContainerStylesFallback.test.ts` 에 tabpanel 케이스(empty→flex/column, parentStyle.display 명시→제외) 추가(30→32 tests).
    - live 검증: Tabs 추가 → TabPanel 안 Button 2개 → Skia canvas 에서 세로(flex-column) 배치 + gap 확인(확대 스크린샷). 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(TabPanel top-level containerStyles).
  - **ColorField — factory root inline layout 이 migration strip 대상과 자기모순**:
    - **Why**: ColorField factory root `props.style` 에 `display:flex/flexDirection:row` 를 inline 주입하는데, ColorField 는 `FIELD_FAMILY_TAGS`(fieldInlineLayoutMigration) 대상이라 hydration 이 기존 element 의 inline `display/flexDirection` 을 strip 하도록 설계됨(migration test 가 assert). 즉 migration 은 "제거" 하는데 factory 는 신규 element 에 "재도입" 하는 자기모순 — Select/ComboBox 는 2026-06-30 에 정확히 이 패턴으로 factory inline 제거됐는데 ColorField 만 누락. inline 은 (a) reset 버튼 오활성 (b) preview `@layer` variant CSS 를 specificity 로 이겨 CSS↔Skia 비대칭 유발.
    - 수정: ColorField factory root 에서 `display/flexDirection/alignItems` 제거(Select 선례 동형), `width:100%` + `gap:4`(catalog `composition.gap:var(--spacing-xs)`=0.25rem=4px 정합, 구 `gap:"8px"` 는 catalog 불일치라 dirty 유발이었음) 만 잔존. row 축은 catalog `composition.layout:flex-row`(CATALOG_LAYOUT_STYLES flex-row) + Skia `getSideLabelParentStyle`/specFallback 이 담당.
    - 위치: `apps/builder/src/builder/factories/definitions/DateColorComponents.ts`(createColorFieldDefinition root style).
  - **DateInput — segment text verticalAlign 동기화 (CalendarHeader 동종, CalendarGrid 는 제외)**:
    - **Why**: DateInput 도 `datefield_segments` primitive 가 segment text 를 그리는데 verticalAlign 미소비 → Skia 세로 정렬이 computeDrawY fallback 에만 의존 + Style 패널 Typography Vertical Align 편집이 Skia 미반영(CalendarHeader 와 동일 구조적 gap). 동종 조사에서 CalendarGrid 는 제외 — 날짜/요일 text 가 `y:cy`(각 셀 중앙 좌표)+baseline:middle 방식이라 verticalAlign:middle 을 넣으면 computeDrawY 가 node 전체 높이 중앙으로 그려 셀 좌표 무시 → 날짜 겹침으로 깨짐(사용자 승인 = DateInput 만).
    - 수정: `datefield_segments` 의 두 text 경로(picker/DateField·TimeField)가 `verticalAlign = style.verticalAlign ?? "middle"` 소비. factory 4곳(DatePicker/DateRangePicker/DateField/TimeField 내부 DateInput) `props.style.verticalAlign:"middle"` 주입. DateInput 은 catalog structure 없는 sub-part 라 dirty baseline 은 `resolveSubpartContextDefaultStyle`(useResetStyles) DateInput 분기에 verticalAlign:"middle" 미러 추가(factory inline ↔ baseline 동기화).
    - live 검증: 신규 DateField 생성 → DateInput `props.style.verticalAlign:"middle"` 주입 확인 + Style 패널 Typography Vertical Align "middle" 표시(selectedIndex 1) + reset 버튼 미표시(dirty 0, baseline 정합). specs 333 / catalog 258 / fallback+migration 38 tests PASS, type-check baseline 69.
    - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(datefieldSegments verticalAlign), `apps/builder/src/builder/factories/definitions/DateColorComponents.ts`(DateInput 4곳 style), `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts`(resolveSubpartContextDefaultStyle DateInput baseline).

## [DisclosureHeader chevron 크기 CSS↔Skia 대칭 — 고정 18 통일] - 2026-07-02

### Bug Fixes

- **DisclosureHeader chevron 이 Skia 에서 size 별로 CSS 와 어긋남** (TagGroup remove X 축1 동형, CSS cascade 실측 정정):
  - **Why**: Disclosure 는 부모가 `<Heading><Button slot="trigger"><svg class="disclosure-chevron">` 를 self-compose 하고(Disclosure.tsx:72-82, DisclosureHeader 독립 DOM 노드 없음), Skia `leading_icon` primitive 는 chevron glyph 를 catalog rule `size.iconSize` 로 그린다. ADR-912 cutover 시 rule 은 `md`(iconSize 15)만 정의 → sm/lg 는 primitive fallback `round(fontSize×1.1)`(sm 13 / lg 18) + md 15 → CSS↔Skia 비대칭(D3 위반).
  - **정본 재확정 (CSS cascade 실측)**: 초기 분석은 `.disclosure-chevron { width/height: var(--icon-size) }` + Disclosure.css `[data-size]` --icon-size(sm14/md16/lg20)로 "DOM size 반응"이라 판단했으나, live `getComputedStyle` 로 확인하니 DOM chevron 은 **전 size 18px 고정**. trigger `<Button slot="trigger">` 는 data-size 를 안 받아 `.react-aria-Button` 기본 `--icon-size: 18px`(Button.css:40)이 적용되고, Disclosure 의 size 반응 --icon-size 는 조상 Heading 까지만 내려오다 Button 이 자기 기본 18 로 재선언해 덮음(dead). 즉 TagGroup remove X / CalendarHeader chevron 과 동일한 **DOM 고정-크기 컨벤션**(값만 18).
  - 수정: catalog rule DisclosureHeader `sizes` 에 sm/md/lg 3 size 명시 + iconSize 전 size **18 통일**(구 md 15) → `leading_icon` glyph = iconSize = 18 로 DOM 18 과 대칭. fontSize/height/paddingX 는 Skia leaf 메트릭(text baseline·좌표 base)이라 size 별 유지. 컴포넌트 식별 if 없이 rule 데이터만(ADR-142 §3).
  - **회귀 가드**: `disclosureHeaderIconSize.test.ts`(shared, rule 값 계약: 3 size iconSize=18 + paddingX 12 + height 28/30/32) + `skiaPrimitives.disclosureHeaderIconSize.test.ts`(specs, leading_icon glyph=iconSize 18 fallback 아님) 신규 + 기존 `buildCatalogShapes.leadingIcon.test.ts` 15→18 갱신. RED: 수정 전 sm/lg 미정의 + md 15≠18 FAIL. shared 444 / specs 506 tests PASS.
  - live 검증: Preview DOM chevron `getBoundingClientRect` sm/md/lg 모두 18×18px 확인(Button 기본 --icon-size), Skia md chevron 이 CSS 18px chevron 과 시각 동등(수정 전이면 15px). type-check PASS(baseline 69).
  - **교훈**: 아이콘 크기 정본은 CSS 규칙 파일만 보고 판단 금지 — cascade override(Button 기본 --icon-size 가 Disclosure size 반응 덮음)를 live `getComputedStyle` 로 실측해야 정확. 초기 14/16/20 오분석 → 18 실측 정정.
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(DisclosureHeader sizes sm/md/lg iconSize 18)

## [CalendarHeader chevron 크기 CSS↔Skia 대칭 — 고정 16 통일] - 2026-07-02

### Bug Fixes

- **CalendarHeader prev/next chevron 이 Skia 에서 size 별로 CSS 와 어긋남** (TagGroup remove X 축1 동형 판정):
  - **Why**: Calendar/RangeCalendar 의 헤더 chevron 은 DOM(`Calendar.tsx`/`RangeCalendar.tsx` self-compose `<header>`)에서 `<ChevronLeft size={16}>` / `<ChevronRight size={16}>` — **size prop 무관 고정 16px** Lucide glyph(프로젝트 DOM 아이콘 공통 고정-크기 컨벤션). 반면 Skia `inline_icon_text` primitive(`skiaPrimitives.ts`, CalendarHeader replace)는 chevron glyph 를 `fontSize + 2`(rule `size.fontSize` 토큰 파생)로 그려 **size 별 가변**(sm 14 / md 16 / lg 18) → md 만 우연 일치, sm 은 Skia 2px 작고 lg 는 Skia 2px 큼 → CSS↔Skia 시각 비대칭(D3 위반).
  - 수정: `inlineIconText` 의 chevron glyph fontSize 를 **전 size 고정 16**(`CALENDAR_CHEVRON_DOM_PX`)으로 못 박아 DOM `size={16}` 과 대칭. layout `iconSize`(sm20/md26/lg32)는 `cellSize`(=iconSize+4)·좌표 계산 전용이라 **glyph 크기와 분리 유지** → 위치 회귀 없음. rule sizes 미주입 폴백은 기존 `fontSize+2` 유지. center text 는 `size.fontSize` 유지(size 비례, chevron 고정과 무관). TagGroup remove X 축1(DOM 고정-크기 통일)과 동형 판정 — 컴포넌트 식별 if 없이 primitive 데이터 흐름만 (ADR-142 §3).
  - **회귀 가드**: `skiaPrimitives.inlineIconText.test.ts` 신규 — 좌·우 chevron glyph fontSize=16(sm/md/lg 전부) + center text fontSize=rule 토큰(14 md) 유지 + cellSize/좌표는 iconSize 유지(위치 불변) 6 케이스(502 tests PASS). RED: 수정 전 sm(14)/lg(18) FAIL, md(16) 우연 통과.
  - live 검증: Preview DOM chevron `getBoundingClientRect` md/lg 모두 16×16px 확인, Skia lg chevron 이 CSS 16px chevron 과 시각 동등(수정 전이면 18px). type-check PASS(baseline 69).
  - 위치: `packages/specs/src/renderers/skiaPrimitives.ts`(`CALENDAR_CHEVRON_DOM_PX` + `inlineIconText` chevron glyph 고정)

## [TagGroup maxRows 접힘 — Taffy 실측 rowY 기반 재설계 (폭 가변 견고)] - 2026-07-02

### Bug Fixes

- **TagGroup `maxRows` 세로 gap 발산 재발 — 추정 wrap 공식이 폭 가변에서 Taffy 실배치와 어긋남** (2026-07-01 gap fix 의 근본 대체):
  - **Why**: 직전 두 접근(`c05b620fc` fold-skip 1-pass 폭 310 / `4bdd470e9` 2-pass 추정 재보정 폭 350)은 chip 접힘 개수·height 를 **추정 wrap 공식**(`resolveTagWrapLayout`, measureText + 특정 폭 값 의존)으로 계산했다. TagGroup 폭은 **가변**인데, 이 추정은 (1) JS measureText ≠ Taffy WASM 텍스트 측정, (2) 부모 top-down 추정폭 ≠ 실제 flex/100% resolve 후 폭, (3) f32 정밀도로 실제 Taffy flexWrap 배치와 어긋난다. 라이브 계측(15 items maxRows=3): render skip 은 Skia 그리기만 막고 Taffy 는 chip 16개(15+Show all)를 **5줄**로 배치(rowY=[0,34,68,102,136], RowsGroup height 166) → 표시는 3줄이나 height 5줄분 → 잉여 여백이 `align-content` 분산 → 세로 gap 발산 + Show all 이 selection box 밖. maxRows 경계(폭에 따라 접힘 판정이 갈리는 값)에서만 발현.
  - 수정 (chip 개수 제어 SSOT = layout 의 Taffy 실측 rowY, 폭 값 미사용):
    - **rowY 기반 접힘** (`computeTagFoldKeep`, 신규): `fullTreeLayout` Step 4.5b 가 Taffy 가 배치한 각 chip 의 **실제 y좌표(rowY)**로 행 번호를 매핑해 `행 번호 ≥ maxRows` 인 비-Show all chip 을 RowsGroup Taffy 트리(`updateChildren`)에서 제외. 폭 값을 전혀 안 써 리사이즈에 견고. CSS 정본(`TagGroup.tsx` `computeVisibleTagCount`: `getBoundingClientRect().y` 로 rowCount, `rowCount > maxRows` break)과 **동일 원리** — DOM y ↔ Taffy layout y 대응.
    - **TagList height = RowsGroup Taffy 실측** (Step 4.5c, 신규): chip 제외 recompute 후 RowsGroup auto height(표시 행 + Show all 실측)를 TagList 에 강제 → 추정 contentHeight 대신 실측이라 오차 0, Show all 항상 box 안.
    - **`alignContent: flex-start`** (`appendTagRowProjection` RowsGroup): flex-wrap 다중 행을 컨테이너 상단 정렬 → 미설정 시 Taffy 기본 분산으로 남던 여백 제거. CSS `.react-aria-TagList` 상단 정렬과 동형.
    - **render skip = layoutMap 기반** (`StoreRenderBridge`): 추정 wrap 공식 재실행 제거. layout 이 Taffy 트리에서 뺀 chip 은 `ctx.layoutMap` 좌표 부재 → 미emit (남긴 chip 은 좌표 있음 → 그림). layout 접힘과 render 자동 정합(단일 SSOT).
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 `computeTagFoldKeep` 5 케이스(접힘 발생 시 행번호≥maxRows 제외+Show all 유지 / 미발생 시 Show all 제외 / **폭 무관**: 같은 15 item 이 넓은 폭 3행·좁은 폭 8행이어도 rowY 기준 정확 접힘 / maxRows=1 / 빈·maxRows=0) 추가 (19 tests PASS). RED 확인: 접힘 경계 `< maxRows` → `<=` 변조 시 3 케이스 FAIL.
  - live 검증: 15 items maxRows=1(box 118)/2(166)/3(214) 모두 chip N줄 촘촘 + Show all 다음 행 box 안, 세로 gap 정상(4px). 패널로 폭 좁아진 상태(chip 3개/행)에서도 rowY 재계산으로 자동 정합. type-check PASS(baseline 69).
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`(`computeTagFoldKeep` + Step 4.5b rowY 접힘 + Step 4.5c 실측 height), `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`(alignContent), `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`(render layoutMap 기반)
- **TagGroup `maxRows` 미접힘 케이스에서 selection height 에 tag 한 줄 여분 공백** (위 rowY 재설계의 미완결 후속):
  - **Why**: 위 재설계 Step 4.5c 는 **접힘이 발생한 경우에만**(`foldChipRemovals.length > 0`) TagList height 를 실측으로 강제했다. 그러나 `appendTagRowProjection` 은 `maxRows>0` 이면 Show all chip 을 **항상 append** 하므로, 11 tag / maxRows=3 처럼 item 이 3행(4+4+3)에 딱 맞아 **접힘 미발생**인 경우에도 Show all chip 이 4번째 행(라이브 rowY=102)에 배치돼 RowsGroup 이 4행이 된다. `computeTagFoldKeep` 은 미접힘 시 Show all 을 keep 에서 제외하고 그 keep(11) ≠ chipIds(12) 라 fold 경로에 진입(Show all Taffy 제거)하지만, **Taffy `setChildren` 으로 chip 을 제거해도 RowsGroup 컨테이너의 auto height 는 축소되지 않는다**(증분 갱신 한계 — 라이브 계측: 자식 3행 배치 uniqueYs=[0,34,68]인데 컨테이너 height 는 Show all 포함 stale 132). preserveEnrichHeight 가 그 stale 값을 TagList 에 강제 → selection 156(4행) = 3행 콘텐츠 아래 한 줄 여분.
  - 수정:
    - **Step 4.5c 를 접힘 여부 무관 전체 projection TagList 에 적용** — `projectionTagLists`(전수 수집)를 순회.
    - **컨테이너 실측 대신 자식 chip 실측 bottom 사용** — RowsGroup 컨테이너 auto height 가 stale 하므로, 유지된 chip 들의 `max(chip.y + chip.height)` 로 content height 를 직접 산출(폭 무관, Show all 제거 반영). 이 값을 RowsGroup + TagList 양쪽에 명시 height 로 강제 → TagGroup 세로 합산까지 정합.
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 케이스 추가 — 11 tag 3행 + Show all 4번째 행(y=102) → 미접힘이라 keep=11(Show all 제외) 이면서 keep(11) < 전체 chip(12) 이라 fold 경로 진입 보증(20 tests PASS). RED 확인: 미접힘 Show all 제외 로직 변조 시 2 케이스 FAIL.
  - live 검증: 11 tag maxRows=3(미접힘) selection 156→**122** = CSS 정본(iframe DOM 실측 122)과 정확 일치, 여분 공백 소멸. maxRows=2(접힘) 도 CSS 122 ↔ Skia 122 + 양쪽 "Show all (11)" 대칭. type-check PASS(baseline 69).
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`(Step 4.5c 자식-bottom 실측 + 접힘 무관 전수 적용)
- **TagGroup `maxRows` 접힘이 size=lg 에서 수렴 실패 (11 tags 4행 전부 표시, maxRows 무시) + CSS↔Skia 비대칭**:
  - **Why**: `maxRows` 접힘 측정용 숨겨진 미러 DOM(`hiddenRef`, `TagGroup.tsx`)은 `className="react-aria-TagList"` + `data-tag-size={size}` 를 가진 채 `<AriaTagGroup>` **밖의 형제**로 렌더된다. 그런데 chip size CSS 규칙(`TagGroup.css`)이 `.react-aria-TagGroup[data-tag-size] .react-aria-Tag` 로 **`.react-aria-TagGroup` 하위**만 매칭 → 미러 chip 은 조상에 `.react-aria-TagGroup` 이 없어 size CSS 가 안 걸려 **항상 기본(md 근사) 크기로 측정**된다. 라이브 계측(lg): 미러 chip w=82/h=30(md) 4개/행 3행 vs 실제 chip w=98/h=42(lg) 3개/행 4행 → `computeVisibleTagCount` 가 미러(md 3행) 기준으로 행 수를 오산 → visibleTagCount 부정확 → lg 에서 접힘 수렴 실패(중간에 8+Show all 진동 후 최종 11 tags 전부 4행 표시, Show all 없이 maxRows 무시, height 213). Skia 는 Taffy 실측(9 tags 3행 + Show all 4번째 행, selection 214)로 정상 접힘 → **CSS(11 전부)↔Skia(9+Show all) 시각 비대칭**(D3 위반). md 는 미러=실제 우연 일치라 안 드러났다.
  - 수정: chip size 규칙(xs~xl)에 미러 셀렉터 `.react-aria-TagList[data-tag-size="..."] .react-aria-Tag` 를 콤마 병기 → 미러 chip 도 실제와 동일 size 로 측정. (실제 표시 TagList 는 `data-tag-size` 미보유 → 이 셀렉터는 미러에만 매칭, 실제 렌더 무영향.)
  - **회귀 가드**: `tagGroupMirrorChipSize.test.ts` 신규 — TagGroup.css 를 문자열로 읽어 5 size 각각 (a) 미러 셀렉터 병기 (b) 실제 셀렉터 유지 (c) 두 셀렉터가 같은 콤마 블록 공유(값 drift 방지) 검증(11 tests PASS). RED: lg 미러 셀렉터 제거 시 2 케이스 FAIL.
  - live 검증: lg maxRows=2 → CSS 6 tags+Show all 165 ↔ Skia 166 대칭. lg maxRows=3 → CSS 9 tags 3행+Show all 4번째 행 213 ↔ Skia 214 대칭(4회 측정 진동 없음). md maxRows=3(11 tags 3행, 접힘 없음, 122) 회귀 없음. type-check PASS(baseline 69).
  - 위치: `packages/shared/src/components/styles/TagGroup.css`(chip size 5규칙 미러 셀렉터 병기)
- **TagGroup `labelPosition="side"` 에서 selection height 에 tag 한 줄 여분 공백** (위 미접힘 여분 공백 fix 의 side-label 후속):
  - **Why**: 위 자식-bottom 실측 교정은 `top-label`(column) 에서만 완결됐다. `labelPosition="side"` 인 TagGroup 은 `fullTreeLayout` 의 `sideLabelProjectionContainer` 판정으로 `preserveEnrichHeight=true` → enrich 의 `calculateContentHeight`(추정 wrap, stale mirror items 기반) 가 산출한 명시 height 가 Taffy 에 강제된다(라이브 계측: TagGroup 명시 98=3행 추정, 실제 TagList 자식은 2행 64). Step 4.5b/c 가 TagList/RowsGroup 을 자식-bottom 실측(64)으로 교정하고 부모를 dirty 로 마킹해도, **TagGroup 의 명시 height 는 auto 가 아니라 fixed 라 재계산 시에도 98 유지** → selection/hover outline 이 실제 자식(64) 아래로 34px(1행) 여분 공백. top-label 은 column 이라 preserve 미적용(자식 2개 → auto 세로 합산 자연 수렴)이라 발현 안 됨, side-label(row)만 발산.
  - 수정: Step 4.5c 에서 자식 실측 교정 시점에 **부모(side-label TagGroup)의 명시 height 를 제거**(`delete batch[i].style.height` + dirty)해 Taffy 가 row auto height(`max(Label, 교정된 TagList)=64`)로 재계산하게 한다. 정합(`tlAligned && rowsAligned`) 여부와 **독립** — TagList 가 이미 64 로 정합이어도 부모 TagGroup 은 stale 98 을 명시 강제하므로 continue 앞에서 처리. 사용자 명시 CSS height 는 보존.
  - **회귀 가드**: 판정을 순수 함수 `shouldClearSideLabelTagGroupHeight`(신규 export)로 추출, `tagGroupSideHeight.test.ts` 에 4 케이스 추가 — side+명시 height 없음→true / top→false(회귀 가드) / 사용자 명시 height→false(의도 보존) / 비-TagGroup→false (24 tests PASS). RED: `=== "side"` → `=== "top"` 변조 시 2 케이스 FAIL.
  - live 검증: side md maxRows=5(6칩 2행) selection 98→**64** = CSS 정본(iframe DOM 64)과 정확 일치, 여분 공백 소멸. side md maxRows=1(접힘, Show all) → CSS 64(showAllBottom=64) ↔ Skia 64 대칭. side lg maxRows=5(3행) → CSS 138 ↔ Skia 138 대칭. top md(Label+2행, selection 88) 회귀 없음. type-check PASS(baseline 69).
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`(`shouldClearSideLabelTagGroupHeight` + Step 4.5c 부모 명시 height 제거)
- **TagGroup `labelPosition="side"` 에서 CSS 가 maxRows 초과 표시 (CSS 3줄 vs Skia 2줄+Show all)**:
  - **Why**: `maxRows` 접힘 측정용 미러 DOM(`hiddenRef`)은 `<AriaTagGroup>` 밖의 형제(position:relative 최상위 div 자식)로 `width:100%` 를 갖는다. 그런데 `labelPosition="side"` 에서 실제 chip 배치 컨테이너(`.tag-list-wrapper`)는 `flex-direction:row` 로 Label 옆 남은 폭(전체 − Label − gap)에서 chip 을 wrap 한다. 미러는 Label 차감을 못 받아 **전체 폭으로 측정** → 행당 chip 과다 → `computeVisibleTagCount` 가 visibleTagCount 를 과다 산출 → 실제 배치(좁은 폭)에서 maxRows 초과. 라이브 계측(side md maxRows=2 / 10칩): 미러 폭 348px → 2줄에 8개 fit 판정(visibleTagCount=8), 실제 wrapper 폭 276px 에서 그 8개가 **3줄** → CSS 가 maxRows=2 위반(3줄 표시). Skia 는 실제 배치폭 rowY 로 접어 2줄+Show all → **CSS(8칩 3줄)↔Skia(6칩 2줄+Show all) 비대칭**. (이전 lg 수렴 실패는 chip **size** 축, 본 건은 미러 **폭** 축 — 둘 다 "미러가 실제의 정확한 대체 아님" 공통 근본.) Skia 정본(maxRows=N=N줄 의도 준수).
  - 수정: `computeVisibleTagCount` 측정 직전에 실제 `.tag-list-wrapper` clientWidth 를 미러 width 에 주입 → side-label Label 차감 폭 반영. 실제 wrapper 에 `tagListWrapperRef` 부착 + ResizeObserver 가 wrapper 도 관찰(Label 텍스트 변경 시 재측정). 실제 wrapper 가 아직 없는 측정 초기엔 `width:100%` fallback 유지.
  - **회귀 가드**: `tagGroupMirrorChipSize.test.ts` 에 side-label 폭 동기화 4 케이스 추가 — `tagListWrapperRef` 선언 / 미러 width 에 `clientWidth` 주입 / 실제 wrapper 에 ref 부착 / ResizeObserver wrapper 관찰(TagGroup.tsx 소스 구조 계약, 15 tests PASS). RED: 폭 주입 라인 제거 시 1 케이스 FAIL. (jsdom 은 clientWidth/getBoundingClientRect.y 미계산 → 실제 wrap 수렴은 live 확증.)
  - live 검증: side md maxRows=2 / 10칩 → 미러 폭 348→**276**(=실제 wrapper 폭), visibleTagCount 8→**6**, CSS 3줄→**2줄 + Show all 3번째 줄**(98) ↔ Skia selection 350×98(2줄+Show all) 대칭. type-check PASS(baseline 69).
  - 위치: `packages/shared/src/components/TagGroup.tsx`(`tagListWrapperRef` + `computeVisibleTagCount` 미러 폭 동기화 + ResizeObserver wrapper 관찰)
- **TagGroup `allowsRemoving` remove X 아이콘이 Skia 에서 CSS 보다 작음** (CSS↔Skia 크기 비대칭):
  - **Why**: chip 우측 remove X 를 CSS(DOM)는 `TagGroup.tsx` 가 `<Button slot="remove"><X size={14} /></Button>` 로 **모든 size 14px 고정** Lucide glyph(프로젝트 다른 아이콘 Calendar/Table 16px 등과 동일한 고정-크기 컨벤션)로 그리는데, Skia `buildCatalogShapes` trailingIcon 은 catalog Tag rule `sizes.iconSize`(`round(fontSize×0.75)` = xs8/sm9/md11/lg12/xl14)를 glyph fontSize 로 사용했다 → md 11px vs CSS 14px 로 Skia X 가 3px 작음(사용자 관찰). 라이브 계측(md): CSS remove SVG 14×14px vs Skia iconSize 11.
  - 수정: catalog `COMPONENT_RULES_TABLE.Tag.sizes.*.iconSize` 를 **전 size 14 로 통일**(CSS 14 고정을 정본으로 대칭). Tag 는 leading icon 이 없어 iconSize=remove X(trailingIcon) 전용 → 14 통일 부작용 없음. layout chip width(`resolveTagChipMetric`)는 iconSize 가 아니라 fontSize 로 remove 예약 폭을 잡아 layout 무영향. Tag 는 generated CSS 없음(DOM 은 부모 TagGroup self-compose) → iconSize 변경이 CSS remove X(하드코딩 14)에 영향 없음.
  - **회귀 가드**: `tagRemoveIconSize.test.ts` 신규 — Tag rule 전 size iconSize=14 데이터 계약(1 test, RED: 구값 4 size FAIL). `buildCatalogShapes.trailingIcon.test.ts` 신규 — trailingIcon glyph fontSize=size.iconSize read-through + showProp 게이트 계약(3 tests, `fontSize×0.75` fallback 회귀 방지).
  - live 검증: md TagGroup remove X 가 Skia 11→14px 로 커져 CSS(14) 와 대칭(zoom 육안 확인). catalog 28파일/241 + specs 24파일/304 테스트 회귀 없음. type-check PASS(baseline 69).
  - 위치: `packages/shared/src/catalog/generated/componentRulesTable.ts`(Tag.sizes.\*.iconSize 14 통일)
- **TagGroup `allowsRemoving` remove X 가 Skia 에서 label 에 붙어 보임 (우측 위치 계산 오류)** (위 iconSize 확대의 후속 — CSS↔Skia 위치 비대칭):
  - **Why**: Skia `buildCatalogShapes` trailingIcon 우측 절대 배치 `iconCx = containerWidth - paddingRight - iconSize/2` 에서 `paddingRight` 를 `size.paddingX`(md 12)로 잡았다. 그러나 정본은 우측 여백 = **`paddingY`**(md 4) — CSS `.react-aria-Tag[data-allows-removing] { padding-right: var(--spacing-xs) }`(=4, 상하 padding 과 대칭) + layout SSOT `resolveTagWrapLayout`(`chipPaddingRight = allowsRemoving ? paddingY : paddingX`)이 동일하게 paddingY 를 쓴다. Skia 가 12 를 쓰면 X 중심이 우측 절대배치에서 안쪽으로 (12−4=)8px 당겨져 **label 을 침범**(iconSize 를 11→14 로 키운 뒤 겹침이 더 두드러짐) + 우측엔 12px 과다 여백. 라이브 계측(md, chip 94px): 정본 X 중심 cx=80(우측 여백 7=paddingY4+btn2+border1) vs Skia 는 label 에 붙음.
  - 수정: trailingIcon 블록의 `paddingRight` fallback 을 `size.paddingX` → **`size.paddingY`** 로 교정(`style?.paddingRight ?? style?.padding` 사용자 override 는 존중). 이로써 X 중심 = `containerWidth - paddingY - iconSize/2` → text↔X gap = iconGap(4), X 우측 여백 = paddingY(4)로 layout 모델(`text | iconGap | glyph | paddingY`)과 정합. 컴포넌트 식별 if 아님 — trailingIcon 데이터로 진입한 블록의 우측 여백 규칙(ADR-142 §3).
  - **회귀 가드**: `buildCatalogShapes.trailingIcon.test.ts` 에 위치 계약 3 케이스 추가 — X 중심=containerWidth−paddingY−iconSize/2 + 우측여백=paddingY / paddingX≠paddingY 일 때 paddingY 채택 / style.paddingRight override 존중(6 tests PASS). RED: paddingY→paddingX 되돌림 시 2 케이스 FAIL.
  - live 검증: md remove X 가 label 에 붙던 것이 gap 4px + 우측 여백 4px 로 CSS(`New Tag ×`)와 대칭(zoom 육안). lg size 도 gap 정합(회귀 없음). type-check PASS(baseline 69).
  - 위치: `packages/specs/src/renderers/buildCatalogShapes.ts`(trailingIcon paddingRight fallback paddingY)
- **TagGroup `allowsRemoving` remove X 우측 여백이 이번엔 paddingY 보다도 작음 (위 paddingY 단독 교정의 후속 정정)** (CSS↔Skia 위치 정밀 대칭):
  - **Why**: 위 교정(우측 여백 = paddingY 4)은 여전히 CSS 실측(7px)보다 작았다. CSS 실측(md chip 94px) remove X 우측 여백 = **7px = paddingY(4) + `.tag-remove-btn` padding(2) + chip border(1)**. Skia 는 paddingY(4)만 잡아 X 가 chip 우측 경계에 붙음(사용자 관찰: "padding-top 보다 padding-right 여백이 더 작다"). remove 버튼의 padding/border inset(3px)이 우측 여백에서 누락됐다. 라이브 실측: CSS svg cx=80(=cw−14), Skia paddingY 단독 시 cx=83(우측 여백 4).
  - 수정: trailingIcon 데이터에 **`insetRight`** 필드 신설 — 우측 여백 = `paddingY + insetRight`. Tag rule trailingIcon 에 `insetRight: 3`(= remove버튼 padding 2 + chip border 1) 지정. X 중심 = `containerWidth − (paddingY + insetRight) − iconSize/2` = 94 − 7 − 7 = **80**(CSS svg cx 80 실측 정확 일치). insetRight 미지정 컴포넌트는 우측 여백 = paddingY 단독(기본 0). 사용자 명시 `style.paddingRight` override 시 insetRight 미가산. 컴포넌트 식별 if 아님 — trailingIcon rule 데이터(ADR-142 §3).
  - **회귀 가드**: `buildCatalogShapes.trailingIcon.test.ts` 위치 계약 갱신 — X 중심=cw−(paddingY+insetRight)−iconSize/2=80 (CSS 실측 cx 일치) / paddingX≠paddingY 시 paddingY+insetRight 채택 / insetRight 미지정 시 paddingY 단독 / style.paddingRight override(7 tests PASS). RED: paddingY→paddingX 되돌림 시 FAIL.
  - live 검증: md remove X 우측 여백 4→7px 로 CSS(svg cx 80, 우측 여백 7)와 정확 대칭(zoom 육안 + CSS 실측 cx 80 대조). specs 308 + catalog 241 회귀 없음. type-check PASS(baseline 69).
  - 위치: `packages/specs/src/renderers/buildCatalogShapes.ts`(insetRight 소비) + `utils/resolveComponentVisual.ts`·`composition-document.types.ts`(trailingIcon.insetRight 타입) + `catalog/generated/componentRulesTable.ts`(Tag trailingIcon insetRight:3)

## [TagGroup 8종 수정 — Add Tag Skia 미반영 / chip gap Skia↔CSS 비대칭 / non-standard orientation prop 제거 / labelPosition=side selection 높이 발산 / maxRows Property 편집 UI 누락 / maxRows Skia 화면 접힘 / maxRows "Show all" 위치 발산 / maxRows 세로 gap 발산] - 2026-07-01

### Bug Fixes

- **TagGroup Property 패널 "Add Tag" 시 CSS preview 에는 새 tag 가 나타나나 Skia 캔버스에는 고정된 초기 tag 만 표시** (CSS↔Skia 비대칭):
  - **Why**: Inspector `ItemsManager` 의 "Add Tag"(`store.addItem(tagGroupId, "items", …)`)는 **`TagGroup.props.items` 만** 갱신하고 TagGroup→TagList propagation(`{ parentProp:"items", childPath:"TagList", override:true }`)을 트리거하지 않는다(propagation 은 `PropertiesPanel` 의 `onUpdate` 경로에서만 실행, `addItem` 은 store 를 직접 호출해 우회). DOM 렌더러(`TagGroup.tsx`)는 `TagGroup.props.items` 를 `useResolvedCollectionItems` 로 직접 소비 → 즉시 반영. 반면 Skia projection `resolveDataBoundTagProjection` 은 **자식 `TagList.props.items`**(propagation 복사본, factory 생성 시점의 초기 4개 Chocolate/Mint/Strawberry/Vanilla)를 읽고, Tabs 의 `resolveDataBoundTabProjection` 과 달리 **owner 조회 fallback 이 없어** stale 값을 그대로 그렸다.
  - 수정: `resolveDataBoundTagProjection` 에 owner-first fallback 추가 — dataBinding 이 없을 때 owner `TagGroup.props.items` 를 우선(`{ ...tagListProps, items: ownerProps.items }`). propagation `override:true` 정본(부모 items 가 자식을 덮어씀)을 Skia 시점에 방어적으로 복원. Tabs 의 owner fallback 대칭이되 Tab 은 `!hasItems` 조건인 반면 Tag 는 override:true 정본이라 owner 를 항상 우선(stale 4개 존재 상태에서도 최신 items 채택). owner 미발견(독립 TagList) 시 기존 `TagList.props` 로 회귀.
  - **회귀 가드**: `canvasSceneNode.test.ts` 에 2 케이스 추가 — owner 5개 vs stale TagList 4개 → chip 5개 + "New Tag" 포함(fix 되돌리면 정확히 FAIL 확인), owner 없는 독립 TagList → TagList.items 로 회귀.
  - live 검증: builder 에서 TagGroup 생성 → "Add Tag" 클릭 → Skia 캔버스에 chip 5개(+ 재클릭 6개, 2행 wrap)로 즉시 반영 + 콘솔 에러 0 확인.
  - 위치: `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`(`findOwnerTagGroupProps` + `resolveDataBoundTagProjection` owner-first)
- **TagList chip 간 gap 이 size=lg 에서 Skia↔CSS 비대칭** (chip 간격 정본 미반영, ADR-907 Layer D 위반):
  - **Why**: chip 배치를 담당하는 Skia projection `appendTagRowProjection` 이 rowsGroup gap 을 `props.gap ?? 4` 하드코딩으로 설정해 **catalog `TagList.sizes.gap`(sm/md=4, lg=6) 을 무시**. sm/md 는 우연히 4 로 일치했으나 lg 에서 배치 gap(4)과 layout height 계산(`resolveTagChipMetric` = catalog 6)이 **Skia 내부 비대칭**. CSS 도 `.tag-list-wrapper { gap: var(--spacing-xs) }`(4px, size 무관)라 catalog lg=6 을 반영 못 해 3경로가 모두 어긋났다.
  - 수정: catalog `TagList.sizes.gap` 을 정본으로 3경로 정합.
    - `resolveTagListGap(size)` 를 `utils.ts` 에서 export (`TagList.sizes[size].gap` read-through) — `resolveTagChipMetric` 도 이를 재사용해 gap 단일 소스화.
    - Skia projection `appendTagRowProjection` 이 `props.gap ?? 4` 대신 `resolveTagListGap(size)` 호출 (배치 ↔ height 계산 동일 resolver 공유, ADR-907 Layer D). 사용자 명시 `props.gap` 은 존중.
    - CSS: `.react-aria-TagGroup[data-tag-size="lg"] .tag-list-wrapper { gap: 6px }` 추가 (`--spacing-xs` 4 / `--spacing-sm` 8 사이라 대응 토큰 없어 직접 지정). hidden 미러 DOM(maxRows 측정)도 lg=6px 정합.
  - **회귀 가드**: `canvasSceneNode.test.ts` 에 2 케이스 추가 — rowsGroup gap md=4 / lg=6(하드코딩 4 로 되돌리면 lg 케이스 정확히 FAIL 확인).
  - live 검증: lg TagGroup 의 CSS(DOM 실측 columnGap 6px, 인접 chip [6,6,6]) ↔ Skia(zoom 비교 동일 간격) 정합 확인 + md 회귀 없음(양쪽 4px) + 콘솔 에러 0.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`(`resolveTagListGap` export), `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`(projection gap), `packages/shared/src/components/styles/TagGroup.css` + `TagGroup.tsx`(size 별 CSS gap)
- **TagGroup `orientation` prop 제거 — RAC/RSP 미규정 non-standard prop (D2 위반)**:
  - **Why**: `orientation`("horizontal"\|"vertical")은 RAC TagGroup Props 표에도 RSP TagGroup Props 표에도 **존재하지 않는** prop 이다(양쪽 전수 확인). composition 은 `TagGroup.binding.ts` accepts + `TagGroup.tsx` 타입에 이를 추가해 Property 패널에 Orientation 편집 UI 를 노출했으나, DOM 렌더러(RAC `<TagGroup>`)는 orientation 을 모르므로 **무시**(live 실측: orientation=vertical 이어도 `.tag-list-wrapper` `flex-direction: row`, `data-orientation` 속성 없음). 반면 Skia(`implicitStyles.ts` taglist 분기)만 `orientation==="vertical"` 을 소비해 chip 을 column 배치 → **DOM(무시)↔Skia(반영) 비대칭 + dead 편집 UI**. ssot-hierarchy §6 "Spec 에 RSP 미규정 prop 도입 (D2 위반)" 에 해당. 그룹↔라벨 배치는 RSP 표준 `labelPosition`(top/side)이 담당(직교 축).
  - 수정: orientation 전수 제거 — `TagGroup.binding.ts` accepts / `TagGroup.tsx` 타입 선언 / `implicitStyles.ts` taglist 분기 vertical override / `CollectionRenderers.tsx` `renderTagGroup` 의 orientation 전달. chip 배치는 항상 row+wrap. (Tabs/ToggleButtonGroup/Toolbar 의 orientation 은 RAC 표준이라 보존.)
  - **기존 데이터 무해**: store 에 `orientation: "vertical"` 이 남은 element 도 소비 경로 전부 제거로 무시됨(DOM 원래 무시 + Skia override 제거 + 패널 UI 없음) → hydration migration 불필요.
  - **회귀 가드**: `collectionBindings.test.ts` 의 TagGroup 케이스를 "orientation accepts 제거 + toRacProps drop" 검증으로 갱신(이전엔 orientation 유지 기대).
  - live 검증: TagGroup 선택 시 Property 패널 Appearance 에서 Orientation dropdown 사라짐(Label Position 만 유지) + 기존 orientation=vertical element 가 DOM 가로 렌더 유지 + 콘솔 에러 0.
  - 위치: `packages/shared/src/catalog/bindings/TagGroup.binding.ts`, `packages/shared/src/components/TagGroup.tsx`, `packages/shared/src/renderers/CollectionRenderers.tsx`, `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`, `apps/builder/src/builder/panels/styles/utils/orientationDrivenTags.ts`(주석 정리)
- **TagGroup `labelPosition="side"` 시 selection/hover outline 높이가 실제 렌더보다 낮게 잡혀 마지막 chip 행이 박스 밖으로 삐져나감** (Skia selection ↔ CSS 렌더 높이 비대칭):
  - **Why**: items SSOT = `TagGroup.props.items`, `TagList.props.items` 는 mirror. mirror 는 TagGroup→TagList propagation(`{ parentProp:"items", childPath:"TagList", override:true }`)으로 채워지는데 이 propagation 은 `PropertiesPanel` `onUpdate` 경로에서만 돌고 `store.addItem` 은 우회 → mirror 가 stale(예: owner 7개, mirror 4개). selection outline 높이는 layout 이 TagGroup 에 배정한 최종 height 를 그대로 mirror 하는데(`selectionRenderer` 는 순수 passthrough), 그 height 를 산출하는 `calculateContentHeight` 의 `taggroup` 분기가 자식 TagList 의 **stale mirror items(4)** 로 chip wrap 행 수를 계산 → side 폭(≈290)에서 2줄=64. 반면 CSS(propagation 7)/Skia chip projection(직전 fix 의 owner-first fallback 7)은 owner 7개로 3줄=98 을 그려 **layout height(64) ↔ 실제 chip 렌더(98) 34px 발산**. top(column) 은 발산이 작아 눈에 안 띄었고 side 에서만 도드라졌다(라이브 dimension 실측: side "390 × 64" vs CSS DOM 98).
  - 수정: `taggroup` height 분기가 TagList child 계산 시 owner `TagGroup.props.items` 를 우선 mirror(`{ ...child.props, items: ownerItems }`) — 정적 items(dataBinding 없음) 한정, `canvasSceneNode.resolveDataBoundTagProjection` 의 owner-first fallback 과 대칭. owner 미보유(독립 TagList) 또는 dataBinding 존재 시 기존 child.props 로 회귀.
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 케이스 추가 — owner 7개 + stale mirror 4개 → owner 로 계산한 height 와 동일(mirror 미적용으로 되돌리면 `expected 64 to be 98` 로 정확히 FAIL 확인). 기존 5 케이스(side 차감 / chip border-box 30 / max(Label,TagList)) 무영향.
  - live 검증: builder 에서 side TagGroup(7개 chip) selection dimension 64→98 교정 + selection box 가 3줄 전체 감쌈 + top(88)/side(98) top↔side 왕복 안정 + CSS DOM 실측(98)과 정합 확인.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`(`calculateContentHeight` taggroup 분기 owner-items mirror)
- **TagGroup `maxRows` (RSP 표준 — 지정 행 초과 tag 접기 + "Show all") Property 패널 편집 UI 누락**:
  - **Why**: `maxRows` 는 factory default `maxRows:2`(`GroupComponents.ts`)로 store 에 저장되고 DOM 렌더러(`TagGroup.tsx`)는 숨겨진 미러 DOM 측정 + collapse 슬라이스로 완전 소비(CSS preview 정상 접힘 + "Show all" 버튼). 그러나 `TagGroup.binding.ts` accepts 에 `maxRows` 가 없어 Property 패널에 편집 진입점이 전혀 없었다(Inspector 는 `catalog binding.props.accepts` 를 순회해 필드를 자동 생성 — accepts 부재 = dead). 사용자가 값을 바꿀 수 없었다.
  - 수정: `TagGroup.binding.ts` accepts 에 `maxRows: { kind:"number", label:"Max Rows", section:"appearance", min:0 }` 추가 → Property 패널 Appearance 섹션에 Max Rows 스테퍼 필드 노출. `toRacProps` 가 wrapper 로 통과(TagGroup.tsx 소비).
  - **회귀 가드**: `collectionBindings.test.ts` TagGroup 케이스에 maxRows accepts(kind:number/label) + toRacProps 통과 검증 추가.
  - live 검증: TagGroup 선택 시 Property 패널 Appearance 에 "Max Rows: 2" 스테퍼 등장 확인.
  - 위치: `packages/shared/src/catalog/bindings/TagGroup.binding.ts`
- **TagGroup `maxRows` Skia 화면 접힘 미반영 — chip 전체 렌더 + "Show all" chip 부재** (CSS↔Skia 비대칭, 후속 완료):
  - **Why**: layout height(`calculateContentHeight` taglist 분기)는 이미 maxRows 접힌 높이(2줄 + Show all 행)를 계산해 `preserveEnrichHeight` 로 컨테이너 높이를 확정하나, chip 을 그리는 Skia projection(`appendTagRowProjection` → `type:"Tag"` scene node)은 **전체 chip 을 flexWrap 배치**해 초과 chip 이 화면에 남고 "Show all" chip 도 없었다. 3개 조사 에이전트로 근본 확정: projection 은 scene graph(layout 선행)라 컨테이너 폭 미보유 → chip 개수를 못 줄임. clip(overflow:hidden)도 무효(접힌 height 98=3행분이라 chip 3줄이 그 안에 들어감 — 높이만 자르고 개수 안 줄임).
  - 수정 (layout→render 단방향, 2-pass 순환 없음):
    - **wrap sim SSOT 추출**: `resolveTagWrapLayout({items, containerWidth, sizeName, allowsRemoving, maxRows})` → `{visibleItemCount, shouldShowAll, rowCount, contentHeight}`. `calculateContentHeight` taglist 분기(높이)와 Skia chip render skip(개수)이 **동일 resolver 공유**(ADR-907 Layer D). 삭제된 TagList.spec.ts shapes() Phase 1 wrap 공식과 문자 그대로 동일.
    - **chip render skip**: `StoreRenderBridge.buildNodeForElement` 가 chip(projection kind:"tag-row") render 시 부모 RowsGroup 의 `ctx.layoutMap.get(rowsGroupId).width`(폭 소유)로 wrap sim 재실행 → `rowIndex >= visibleItemCount` chip 은 `null` 반환(미emit). **owner-first**: maxRows/items/size 는 owner TagGroup.props(TagList mirror stale 회피 — selection 높이 버그와 동일 원인).
    - **"Show all (N)" chip**: `appendTagRowProjection` 이 maxRows 설정 시 `_isShowAll` 마커 chip 을 항상 emit, render 게이트가 `shouldShowAll`(폭 기반) 일 때만 표시. 시각(`buildCatalogShapes` `_isShowAll` 분기)은 투명 배경 + accent 텍스트(테두리 없음) — 삭제된 TagList.spec 시각 사양 재현. label 은 CSS 동형 "Show all (전체수)".
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 `resolveTagWrapLayout` 5 케이스(maxRows=0 전체 / 접힘 시 visibleItemCount<전체+shouldShowAll / maxRows 증가→visibleItemCount 단조 / 좁은 폭→감소 / contentHeight = calculateContentHeight SSOT 공유) 추가.
  - live 검증: maxRows=2 TagGroup(13 items) → Skia chip 2줄 + "Show all (13)" chip(투명 배경 + 파란 accent 텍스트) 표시 + CSS preview 와 정합. maxRows 증가 시 chip 더 표시, top↔side 무관 작동.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`(`resolveTagWrapLayout`), `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`(Show all chip emit), `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts`(chip skip 게이트), `packages/specs/src/renderers/buildCatalogShapes.ts`(`_isShowAll` 시각)

- **TagGroup `maxRows` "Show all" 위치 발산 — chip 다음이 아닌 위치 + TagGroup 영역 밖 배치** (위 fix 최종층, CSS↔Skia 비대칭):
  - **Why**: 위 fix 의 render skip(`StoreRenderBridge`)은 Skia **그리기**만 막았을 뿐 chip 좌표는 Taffy 가 이미 부여했다. projection chip(`type:"Tag"`)은 `childrenByParent` 에 실려 fullTreeLayout 이 **9 chip 전부를 RowsGroup flexWrap 으로 실배치**한다 → 초과 "유령 chip" 이 좌표를 점유해 Show all(scene 마지막 chip)을 마지막 실제 행(접힌 컨테이너 height 밖)으로 밀어냈다. maxRows=1 처럼 강하게 접을수록(실배치 5행분 vs 강제 height 2행분) Show all 이 TagGroup selection 박스 아래로 튀어나갔다. 2개 조사 에이전트로 확정: chip x/y 는 Taffy flexWrap 이 계산, render 는 표시 여부만 게이트 → render skip 으로는 좌표를 못 없앰.
  - 수정: **layout 단계에서 초과 chip 을 Taffy 트리에서 제외** — `fullTreeLayout` DFS 의 RowsGroup childIndices 구성 시 `computeTagRowsGroupFoldSkip()`(신규)이 부모 폭(`availableWidth`, RowsGroup width:100%)으로 wrap sim(`resolveTagWrapLayout`, `calculateContentHeight` 와 동일 resolver = ADR-907 Layer D)을 실행해 `visibleItemCount` 이상 chip id 를 childIndices 에서 뺀다. Taffy 트리 = visible chip + Show all → RowsGroup height 가 접힌 height 와 정합하고 Show all 이 마지막 visible chip 다음(TagGroup 영역 안)에 배치. render skip 게이트는 이중 안전망으로 유지.
  - **owner-first**: fold 계산의 maxRows/items/size 는 owner TagGroup.props(RowsGroup.parent=TagList, TagList.parent=TagGroup) — TagList mirror 는 propagation 미갱신 stale 가능(selection 높이 버그와 동일 원인). dataBinding 없을 때만 owner 우선.
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 `computeTagRowsGroupFoldSkip` 5 케이스(maxRows=1 초과 chip skip+Show all 유지 / owner-first: stale mirror 4개여도 owner 9개로 접힘 / maxRows=0 null / 비-RowsGroup null / 좁은 폭→더 많은 skip 단조성) 추가. RED 확인: owner-first 제거 시 2 케이스 실패.
  - live 검증: maxRows=1(9 items) → Skia "Show all (9)" 가 chip 1줄 다음 행 + selection 박스(350×88) 안에 정확히 배치, CSS preview 와 정합. maxRows=2 → Show all 이 2줄 chip 우측 여유에 같은 행 배치(350×122). 이전엔 Show all 이 박스 밖.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`(`computeTagRowsGroupFoldSkip` + RowsGroup childIndices fold-skip)

- **TagGroup `maxRows` 세로 gap 발산 — maxRows=3 등 경계에서만 chip 행 간격 벌어짐** (위 fix 후속층, CSS↔Skia 비대칭):
  - **Why**: TagList height(`calculateContentHeight` taglist 분기 → `resolveTagWrapLayout`)는 1-pass 에서 **부모 top-down 추정폭**(예 350)으로 계산 후 `preserveEnrichHeight` 로 강제되나, 실제 RowsGroup Taffy 배치폭(예 310, padding 차감 후)과 다르다. 경계 케이스(12 items 가 폭 350 에선 maxRows=3 안에 3줄 fit=접힘 없음 / 폭 310 에선 초과=접힘+Show all)에서 **접힘 판정 자체가 갈려**, TagList 강제 height(3줄=98) < 실제 chip 배치(chip 10+Show all=4줄분) → RowsGroup 잉여 여백이 `align-content`(미설정 기본 분산)로 chip 행 사이에 퍼져 세로 gap 발산. maxRows=1/2 는 두 폭 모두 접힘 판정 일치라 정상. debugger 에이전트 + 라이브 계측(DIAG 로그)로 폭 350 vs 310 불일치 확정.
  - 수정: **2-pass 에서 RowsGroup 의 1-pass 실제 폭으로 TagList height 재계산** — `fullTreeLayout` Step 4.5b(신규)가 projection RowsGroup(`-rows:`)의 Taffy 실배치 폭(`firstPassLayouts`)으로 `calculateContentHeight`(=`resolveTagWrapLayout`, owner-first)를 재실행해 TagList height 를 갱신 + markDirty + recompute. 접힘 판정 폭이 fold-skip / render(StoreRenderBridge layoutMap.width)와 **동일 실폭**으로 단일화 → height=실제 chip 배치 정합 → 분산 gap 소멸.
  - **회귀 가드**: `tagGroupSideHeight.test.ts` 에 폭 의존 접힘 경계 3 케이스(동일 items+maxRows 에서 넓은 폭 접힘 없음/좁은 폭 접힘 / contentHeight 는 containerWidth 에 단조 반응 / 실폭 동일 시 calculateContentHeight = resolveTagWrapLayout) 추가 (19 tests PASS). RED 확인: 2-pass 재보정 비활성화 시 maxRows=3 gap 발산 재현(350×156 vs 정상 350×122).
  - live 검증: maxRows=3(12 items) → 재보정 전 350×156(gap 넓게 분산) → 재보정 후 350×122(chip 3줄 촘촘, CSS preview 정합). maxRows=1(350×88)/2(350×122) 회귀 없음.
  - 위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`(Step 4.5b TagList projection height 실폭 재보정)

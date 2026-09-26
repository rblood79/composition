/**
 * UI 관련 상수들을 모아둔 파일
 */

/**
 * 기본 아이콘 속성
 * 대부분의 UI 아이콘에 적용되는 기본 스타일
 */
export const iconProps = {
    color: 'var(--color-gray-400)',
    strokeWidth: 2,
    size: 16
};

/**
 * 활성화된 아이콘 속성
 * 활성 상태의 아이콘에 적용되는 스타일
 */
export const iconPropsOn = {
    color: 'var(--color-White)',
    strokeWidth: 2,
    size: 16
};

/**
 * 편집 아이콘 속성
 * 편집 관련 아이콘에 적용되는 스타일
 */
export const iconEditProps = {
    color: 'var(--color-gray-300)',
    strokeWidth: 2,
    size: 14
};

/**
 * 인스펙터 아이콘 속성
 * 인스펙터 관련 아이콘에 적용되는 스타일
 */
export const iconInspector = {
    color: 'var(--color-gray-400)',
    strokeWidth: 2,
    size: 14
};

/**
 * 컴퍼넌트아이콘 속성
 * 컴퍼넌트 관련 아이콘에 적용되는 스타일
 */
export const iconComponent = {
    color: 'var(--color-red-500)',
    strokeWidth: 2,
    size: 16
};

/**
 * 작은 아이콘 속성
 * 작은 버튼, 인라인 아이콘에 적용되는 스타일
 */
export const iconSmall = {
    color: 'var(--color-gray-500)',
    strokeWidth: 2,
    size: 12
};

/**
 * 큰 아이콘 속성
 * 플레이스홀더, 빈 상태 아이콘에 적용되는 스타일
 */
export const iconLarge = {
    color: 'var(--color-gray-400)',
    strokeWidth: 2,
    size: 24
};

/**
 * 앱 아이콘 (`public/appIcon.svg`) URL — 배포 base (production `/composition/`) 를 붙인다.
 * JS 에서 루트 절대 경로로 적으면 production 에서 404 다 (`appIcon.static.test.ts` 가 막는다).
 */
export const APP_ICON_URL = `${import.meta.env.BASE_URL}appIcon.svg`;

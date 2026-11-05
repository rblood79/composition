/** S2 Picker selectedCount 문구. shared의 지원 언어(en/ko), 그 외는 영어 fallback. */
export function pickerSelectedCount(count: number, locale = "en-US"): string {
  const korean = locale.toLowerCase().startsWith("ko");
  const number = new Intl.NumberFormat(korean ? "ko-KR" : "en-US").format(
    count,
  );
  return korean ? `${number}개 항목 선택됨` : `${number} items selected`;
}

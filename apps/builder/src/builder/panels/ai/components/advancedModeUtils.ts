/** 진행 요약이 역할 이름을 중복해서 말하지 않도록 접두·접미를 제거한다. */
export function trimLabelEcho(label: string, summary: string): string {
  const trimmed = summary.trim();
  if (trimmed === label) return "";
  if (trimmed.startsWith(`${label} `)) {
    return trimmed.slice(label.length).trim();
  }
  if (trimmed.endsWith(` ${label}`)) {
    return trimmed.slice(0, -label.length).trim();
  }
  return trimmed;
}

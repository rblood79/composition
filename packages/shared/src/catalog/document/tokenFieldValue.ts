/** 문서·Canvas·RAC 입력이 함께 쓰는 @멘션·#태그 구간 분리. */
export interface CatalogTokenSegment {
  type: "text" | "token";
  text: string;
}

export function catalogTokenSegments(text: string): CatalogTokenSegment[] {
  const segments: CatalogTokenSegment[] = [];
  const pattern = /(?<=[\s\u200B]|^)[#@][^\s\u200B]+(?=[\s\u200B])/gu;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset)
      segments.push({ type: "text", text: text.slice(offset, match.index) });
    segments.push({ type: "token", text: match[0] });
    offset = match.index + match[0].length;
  }
  if (offset < text.length)
    segments.push({ type: "text", text: text.slice(offset) });
  return segments;
}

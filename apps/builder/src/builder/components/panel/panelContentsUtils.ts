/** `.panel-contents` 클래스 문자열을 합성한다. */
export function panelContents(...extra: (string | false | undefined)[]) {
  return ["panel-contents", ...extra.filter(Boolean)].join(" ");
}

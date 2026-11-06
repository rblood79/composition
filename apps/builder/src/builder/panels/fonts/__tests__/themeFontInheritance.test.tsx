import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { installThemeMaps } from "../../../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { createCatalogThemesHost } from "../../themes/catalog/catalogThemesHost";
import { catalogThemeState } from "../../../catalogRuntime/theme";
import { openStylesFixture } from "../../styles/__tests__/support/catalogStylesFixture";
import { useTypographyValues } from "../../styles/hooks/useTypographyValues";

afterEach(() => installThemeMaps(null));

it("Design의 테마 서체 표시가 실제 서체·개별 지정·Reset·Undo/Redo를 따른다", async () => {
  const f = await openStylesFixture([{ id: "text", type: "Text" }], {
    theme: catalogThemeState,
  });
  try {
    f.select("text");
    const theme = createCatalogThemesHost(f.workspace);
    const { result, unmount } = renderHook(
      () => useTypographyValues(f.recordOf("text")),
      { wrapper: f.wrapper },
    );
    await act(async () =>
      theme.setActiveThemeBaseTypography({ fontFamily: "Inter" }),
    );
    expect(result.current?.fontFamily).toBe("Inter");
    expect(result.current?.fontFamilyAuthored).toBe("");
    await act(async () => f.host.updateStyle("fontFamily", "Pretendard"));
    expect(result.current?.fontFamily).toBe("Pretendard");
    await act(async () => f.host.updateStyle("fontFamily", ""));
    expect(result.current?.fontFamily).toBe("Inter");
    expect(result.current?.fontFamilyAuthored).toBe("");
    await act(async () => f.workspace.undo());
    expect(result.current?.fontFamily).toBe("Pretendard");
    await act(async () => f.workspace.redo());
    expect(result.current?.fontFamily).toBe("Inter");
    unmount();
  } finally {
    f.workspace.dispose();
  }
});

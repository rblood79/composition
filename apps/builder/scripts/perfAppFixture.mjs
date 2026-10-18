// 4단계 Rust 판정 (2026-10-16) — 실사용 형태 fixture `app-pages`.
//
// 합성 격자 (`mixed` · `nested-flex`) 와 달리 사람이 만드는 사이트 · 앱 문서의 모양을 따른다: 22 페이지
// (마케팅 · 블로그 · 쇼핑 · 대시보드 · 설정 · 문서 · 컴포넌트 모음), flex 중첩 뼈대 + 팔레트 원본 instance
// (Button · TextField · Select · TableView · Tabs · Disclosure · Calendar …) 를 팔레트 삽입 경로
// (`catalogPaletteInsertPlan`) 로 놓는다. 글자는 seed 고정 PRNG 의 단어 조합이라 실행마다 같은 문서다.
// 규모: 22 페이지 · 문서 노드 ~3.3k · Canvas record ~5.1k (07-30 실문서 5,069 요소 · 23 페이지와 같은 급).
//
// `page.evaluate(seedAppPages)` 로 부른다 — 함수 본문만 직렬화되므로 바깥 이름을 쓰지 않는다. 뼈대는
// facade `insertTree` (요소 등록 — 편집 · 선택 드라이버가 찾는다), 페이지는 facade `appendPageShell`.
// seedIds = Home 의 hero · feature 카드 · nav 링크 · 인용 · 가격 카드 (`track`) — [1] 은 feature 카드 (편집:
// wrap 줄의 폭 → 형제 재배치), [8] 은 nav 행의 첫 링크 (drag — 고정 카메라 화면 안, 메뉴 순서 바꾸기).
//
// ADR-272 Phase 0 `many-pages`: `{ pages, gap }` 를 주면 같은 21 페이지 목록을 돌려 `pages` 장까지 늘리고
// (두 바퀴째부터 이름 · route 에 차례 번호), 페이지 grid 간격을 `gap` 으로 둔다 — 규모 전용 합성물 (Q1).
// 인자가 없으면 지금 그대로 22 페이지 (`app-pages` 의 ratchet run 이 이 문서를 잰다).
export async function seedAppPages(options) {
  const pageTotal = options?.pages ?? 22;
  const pageGap = options?.gap;
  const store = window.__composition_STORE__;
  const h = window.__COMPOSITION_CATALOG__;
  const ws = h.workspace;
  const g = () => ws.runtime.graph;
  const NODE = "project:node:";
  let seed = 7;
  const rnd = () =>
    (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const W =
    "account analytics billing budget campaign customer dashboard data deploy design document export feature feedback growth insight integration invoice launch metric mobile onboarding order payment pipeline plan platform product project report revenue roadmap sales schedule search security service settings signal storage subscription support team template timeline traffic upgrade usage user workflow workspace".split(
      " ",
    );
  const words = (n) => Array.from({ length: n }, () => pick(W)).join(" ");
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const sentence = (n) => cap(words(n)) + ".";
  const para = (s) =>
    Array.from({ length: s }, () => sentence(8 + Math.floor(rnd() * 10))).join(
      " ",
    );
  const title = (n) => words(n).split(" ").map(cap).join(" ");
  const col = (v, s, c, track) => ({
    t: "frame",
    l: { display: "flex", flexDirection: "column" },
    v,
    s,
    c,
    track,
  });
  const row = (v, s, c, extra = {}) => ({
    t: "frame",
    l: { display: "flex", flexDirection: "row", ...extra },
    v,
    s,
    c,
  });
  const wrap = (v, s, c) => row(v, s, c, { flexWrap: "wrap" });
  const T = (x, fontSize) => ({
    t: "Text",
    x,
    v: fontSize ? { fontSize } : undefined,
  });
  const P = (type, props) => ({ p: type, props });

  let seq = 0;
  let nodes = 0;
  const tracked = [];
  let tracking = true;
  const build = (parentId, specs) => {
    const flat = [];
    const later = [];
    const visit = (spec, parent, isRoot) => {
      if (spec.p) {
        later.push({ parent, type: spec.p, props: spec.props });
        return null;
      }
      const id = `perf-app-${seq++}`;
      const children = [];
      for (const c of spec.c ?? []) {
        const cid = visit(c, id, false);
        if (cid) children.push(cid);
      }
      flat.push({
        id,
        type: spec.t,
        root: isRoot,
        track: !!spec.track,
        children,
        text: spec.x,
        visual: spec.v,
        sizing: spec.s,
        layout: spec.l,
      });
      if (spec.track && tracking) tracked.push({ id, cat: spec.track });
      return id;
    };
    for (const s of specs) visit(s, parentId, true);
    store.getState().insertTree(parentId, flat);
    nodes += flat.length;
    for (const { parent, type, props } of later) {
      const plan = h.palette.catalogPaletteInsertPlan(
        {
          graph: g(),
          records: ws.root.domInputs,
          selection: () => [{ target: { kind: "node", id: NODE + parent } }],
          itemOfRecord: (i) => ws.itemOfRecord(i),
          pageContent: () => undefined,
          newId: ws.newId,
        },
        type,
        props,
      );
      if (!plan.command) throw new Error(`app-pages: palette refused ${type}`);
      ws.execute(plan.command);
      nodes += 1;
    }
    ws.session.clearSelection();
  };

  const BG = ["#ffffff", "#f8fafc", "#f1f5f9", "#eef2ff", "#fdf4ff", "#ecfeff"];
  const nav = () =>
    row(
      { padding: 16, gap: 24, backgroundColor: "#ffffff" },
      {},
      [
        T("Northwind", 20),
        row(
          { gap: 20 },
          {},
          Array.from({ length: 6 }, () => ({
            ...T(cap(pick(W))),
            track: "nav",
          })),
        ),
        row({ gap: 8 }, {}, [P("Button"), P("Button")]),
      ],
      { justifyContent: "space-between", alignItems: "center" },
    );
  const hero = () =>
    col(
      { padding: 80, gap: 24, backgroundColor: pick(BG) },
      {},
      [
        P("Heading", { children: title(6) }),
        T(para(2), 18),
        row({ gap: 12 }, {}, [P("Button"), P("Button")]),
        P("Image"),
      ],
      "hero",
    );
  const featureCard = () =>
    col(
      { padding: 24, gap: 12, backgroundColor: "#f8fafc" },
      { width: 400 },
      [P("Icon"), T(title(3), 20), T(para(2))],
      "feature",
    );
  const features = (n) =>
    col({ padding: 64, gap: 32 }, {}, [
      P("Heading", { children: title(4) }),
      T(para(1), 16),
      wrap({ gap: 24 }, {}, Array.from({ length: n }, featureCard)),
    ]);
  const stats = (n) =>
    wrap(
      { padding: 48, gap: 32, backgroundColor: "#eef2ff" },
      {},
      Array.from({ length: n }, () =>
        col({ gap: 4 }, { width: 280 }, [
          T(String(Math.floor(rnd() * 900 + 100)) + "k", 40),
          T(title(3)),
        ]),
      ),
    );
  const person = () =>
    row(
      { gap: 12 },
      {},
      [P("Avatar"), col({ gap: 2 }, {}, [T(title(2)), T(title(2), 12)])],
      { alignItems: "center" },
    );
  const testimonials = (n) =>
    col({ padding: 64, gap: 24 }, {}, [
      P("Heading", { children: title(3) }),
      wrap(
        { gap: 24 },
        {},
        Array.from({ length: n }, () =>
          col(
            { padding: 24, gap: 16, backgroundColor: "#ffffff" },
            { width: 400 },
            [T("“" + para(2) + "”"), person()],
            "quote",
          ),
        ),
      ),
    ]);
  const priceCard = () =>
    col(
      { padding: 32, gap: 16, backgroundColor: "#ffffff" },
      { width: 380 },
      [
        T(title(1), 20),
        T("$" + (Math.floor(rnd() * 90) + 9), 40),
        T(sentence(10)),
        col(
          { gap: 8 },
          {},
          Array.from({ length: 8 }, () =>
            row({ gap: 8 }, {}, [P("Icon"), T(sentence(5))], {
              alignItems: "center",
            }),
          ),
        ),
        P("Button"),
      ],
      "price",
    );
  const pricing = () =>
    col({ padding: 64, gap: 32, backgroundColor: "#f8fafc" }, {}, [
      P("Heading", { children: title(4) }),
      wrap({ gap: 24 }, {}, [priceCard(), priceCard(), priceCard()]),
    ]);
  const faq = (n) =>
    col({ padding: 64, gap: 12 }, { width: 960 }, [
      P("Heading", { children: "Frequently asked questions" }),
      ...Array.from({ length: n }, () => P("Disclosure")),
    ]);
  const footer = () =>
    col({ padding: 48, gap: 32, backgroundColor: "#0f172a" }, {}, [
      wrap(
        { gap: 48 },
        {},
        Array.from({ length: 5 }, () =>
          col({ gap: 8 }, { width: 200 }, [
            T(title(1), 16),
            ...Array.from({ length: 6 }, () => T(cap(words(2)))),
          ]),
        ),
      ),
      row({ gap: 16 }, {}, [
        T("© 2026 Northwind Inc."),
        P("Link"),
        P("Link"),
        P("Link"),
      ]),
    ]);
  const shell = (content) =>
    row({ gap: 0 }, { width: 1440 }, [
      col({ padding: 16, gap: 6, backgroundColor: "#0f172a" }, { width: 240 }, [
        T("Northwind", 18),
        ...Array.from({ length: 14 }, () => T(cap(words(2)))),
      ]),
      col(
        { padding: 24, gap: 24, backgroundColor: "#f8fafc" },
        { width: 1200 },
        [
          row(
            { gap: 12 },
            {},
            [P("SearchField", { label: "Search" }), P("Button"), P("Avatar")],
            { justifyContent: "space-between", alignItems: "center" },
          ),
          ...content,
        ],
      ),
    ]);
  const statCard = () =>
    col({ padding: 20, gap: 8, backgroundColor: "#ffffff" }, { width: 270 }, [
      T(title(2), 13),
      T("$" + Math.floor(rnd() * 99000), 28),
      P("Meter"),
    ]);
  const activity = (n) =>
    col(
      { gap: 8 },
      {},
      Array.from({ length: n }, () =>
        row(
          { gap: 12, padding: 8 },
          {},
          [
            P("StatusLight"),
            T(sentence(7)),
            T(Math.floor(rnd() * 59) + " min ago", 12),
          ],
          { alignItems: "center" },
        ),
      ),
    );
  const fields = (n) =>
    col(
      { gap: 16 },
      { width: 640 },
      Array.from({ length: n }, (_, i) =>
        i % 7 === 3
          ? P("Select", { label: title(2) })
          : i % 7 === 5
            ? P("Checkbox", { children: sentence(5) })
            : i % 7 === 6
              ? P("Switch")
              : P("TextField", { label: title(2), placeholder: words(3) }),
      ),
    );
  const blogCard = () =>
    col({ gap: 12, padding: 16, backgroundColor: "#ffffff" }, { width: 420 }, [
      P("Image"),
      P("Badge"),
      T(title(6), 22),
      T(para(2)),
      row(
        { gap: 8 },
        {},
        [P("Avatar"), T(title(2)), T("Oct " + (Math.floor(rnd() * 28) + 1))],
        { alignItems: "center" },
      ),
      P("Link"),
    ]);
  const article = (n) =>
    col({ padding: 64, gap: 20 }, { width: 840 }, [
      P("Breadcrumbs"),
      P("Heading", { children: title(8) }),
      person(),
      P("Image"),
      ...Array.from({ length: n }, (_, i) =>
        i % 6 === 5
          ? P("Heading", { children: title(4) })
          : i % 9 === 8
            ? P("Image")
            : i % 11 === 10
              ? P("InlineAlert")
              : T(para(4), 17),
      ),
    ]);
  const productCard = () =>
    col({ gap: 10, padding: 12, backgroundColor: "#ffffff" }, { width: 320 }, [
      P("Image"),
      T(title(3), 18),
      T("$" + (rnd() * 300).toFixed(2), 20),
      row({ gap: 8 }, {}, [P("Badge"), P("Button")], {
        justifyContent: "space-between",
      }),
    ]);
  const teamCard = () =>
    col({ gap: 8, padding: 20, backgroundColor: "#ffffff" }, { width: 300 }, [
      P("Avatar"),
      T(title(2), 18),
      T(title(3), 13),
      T(para(1)),
      row({ gap: 8 }, {}, [P("Link"), P("Link")]),
    ]);
  const PAGES = {
    home: () => [
      col({}, { width: 1440 }, [
        nav(),
        hero(),
        stats(4),
        features(9),
        testimonials(6),
        pricing(),
        faq(8),
        footer(),
      ]),
    ],
    pricing: () => [
      col({}, { width: 1440 }, [
        nav(),
        hero(),
        pricing(),
        features(6),
        faq(12),
        footer(),
      ]),
    ],
    about: () => [
      col({}, { width: 1440 }, [
        nav(),
        hero(),
        stats(4),
        col({ padding: 64, gap: 24 }, {}, [
          P("Heading", { children: "Our team" }),
          wrap({ gap: 24 }, {}, Array.from({ length: 16 }, teamCard)),
        ]),
        footer(),
      ]),
    ],
    blog: () => [
      col({}, { width: 1440 }, [
        nav(),
        col({ padding: 64, gap: 24 }, {}, [
          P("Heading", { children: "Blog" }),
          P("Tabs"),
          wrap({ gap: 24 }, {}, Array.from({ length: 18 }, blogCard)),
        ]),
        footer(),
      ]),
    ],
    article: () => [col({}, { width: 1440 }, [nav(), article(60), footer()])],
    shop: () => [
      col({}, { width: 1440 }, [
        nav(),
        row({ gap: 24, padding: 32 }, {}, [
          col({ gap: 12 }, { width: 260 }, [
            P("SearchField", { label: "Filter" }),
            P("CheckboxGroup"),
            P("RadioGroup"),
            P("Slider"),
            P("TagGroup"),
          ]),
          wrap(
            { gap: 20 },
            { width: 1100 },
            Array.from({ length: 24 }, productCard),
          ),
        ]),
        footer(),
      ]),
    ],
    contact: () => [
      col({}, { width: 1440 }, [
        nav(),
        row({ gap: 48, padding: 64 }, {}, [
          col({ gap: 16 }, { width: 560 }, [
            P("Heading", { children: "Contact us" }),
            T(para(3)),
            activity(4),
          ]),
          col({ gap: 16 }, {}, [
            fields(10),
            P("TextArea"),
            row({ gap: 8 }, {}, [P("Button"), P("Button")]),
          ]),
        ]),
        footer(),
      ]),
    ],
    signup: () => [
      col(
        { padding: 64, gap: 24, backgroundColor: "#f1f5f9" },
        { width: 1440 },
        [
          P("Heading", { children: "Create your account" }),
          fields(14),
          P("RadioGroup"),
          P("Checkbox", { children: "I agree to the terms" }),
          row({ gap: 8 }, {}, [P("Button"), P("Link")]),
        ],
      ),
    ],
    dashboard: () => [
      shell([
        wrap({ gap: 16 }, {}, Array.from({ length: 8 }, statCard)),
        P("Tabs"),
        P("TableView"),
        row({ gap: 24 }, {}, [
          col(
            { gap: 12, padding: 16, backgroundColor: "#ffffff" },
            { width: 580 },
            [T("Recent activity", 18), activity(20)],
          ),
          col(
            { gap: 12, padding: 16, backgroundColor: "#ffffff" },
            { width: 580 },
            [T("Tasks", 18), P("ListBox"), P("ProgressBar"), P("ProgressBar")],
          ),
        ]),
      ]),
    ],
    users: () => [
      shell([
        row({ gap: 12 }, {}, [
          P("SearchField", { label: "Users" }),
          P("Select", { label: "Role" }),
          P("Select", { label: "Status" }),
          P("Button"),
        ]),
        P("TableView"),
        P("TableView"),
        row(
          { gap: 8 },
          {},
          Array.from({ length: 8 }, () => P("Button")),
        ),
      ]),
    ],
    projects: () => [
      shell([
        row(
          { gap: 12 },
          {},
          [P("Heading", { children: "Projects" }), P("Button")],
          { justifyContent: "space-between" },
        ),
        P("Tabs"),
        wrap(
          { gap: 16 },
          {},
          Array.from({ length: 18 }, () =>
            col(
              { gap: 8, padding: 16, backgroundColor: "#ffffff" },
              { width: 370 },
              [
                row({ gap: 8 }, {}, [T(title(3), 16), P("Badge")], {
                  justifyContent: "space-between",
                }),
                T(para(1)),
                P("ProgressBar"),
                row({ gap: 4 }, {}, [P("Avatar"), P("Avatar"), P("Avatar")]),
              ],
            ),
          ),
        ),
        P("GridList"),
      ]),
    ],
    projectDetail: () => [
      shell([
        P("Breadcrumbs"),
        P("Heading", { children: title(4) }),
        P("TagGroup"),
        P("Tabs"),
        row({ gap: 24 }, {}, [
          col({ gap: 12 }, { width: 760 }, [
            T(para(5)),
            P("TableView"),
            activity(12),
          ]),
          col(
            { gap: 12, padding: 16, backgroundColor: "#ffffff" },
            { width: 380 },
            [
              T("Details", 16),
              ...Array.from({ length: 8 }, () =>
                row({ gap: 8 }, {}, [T(title(1), 12), T(title(2))], {
                  justifyContent: "space-between",
                }),
              ),
              P("Calendar"),
            ],
          ),
        ]),
      ]),
    ],
    settings: () => [
      shell([
        P("Heading", { children: "Settings" }),
        P("Tabs"),
        col({ gap: 24, padding: 24, backgroundColor: "#ffffff" }, {}, [
          T("Profile", 18),
          fields(12),
          P("Separator"),
          T("Notifications", 18),
          ...Array.from({ length: 8 }, () =>
            row(
              { gap: 12 },
              {},
              [
                col({ gap: 2 }, { width: 600 }, [
                  T(title(3), 15),
                  T(sentence(10), 13),
                ]),
                P("Switch"),
              ],
              { justifyContent: "space-between" },
            ),
          ),
          P("Separator"),
          T("Danger zone", 18),
          P("InlineAlert"),
          row({ gap: 8 }, {}, [P("Button"), P("Button")]),
        ]),
      ]),
    ],
    billing: () => [
      shell([
        P("Heading", { children: "Billing" }),
        wrap({ gap: 16 }, {}, Array.from({ length: 4 }, statCard)),
        pricing(),
        P("TableView"),
        fields(6),
      ]),
    ],
    notifications: () => [
      shell([
        P("Heading", { children: "Notifications" }),
        P("InlineAlert"),
        P("InlineAlert"),
        activity(40),
      ]),
    ],
    help: () => [
      col({}, { width: 1440 }, [
        nav(),
        col({ padding: 64, gap: 24, backgroundColor: "#eef2ff" }, {}, [
          P("Heading", { children: "How can we help?" }),
          P("SearchField", { label: "Search help" }),
        ]),
        features(12),
        faq(20),
        footer(),
      ]),
    ],
    docs: () => [
      col({}, { width: 1440 }, [
        nav(),
        row({ gap: 32, padding: 32 }, {}, [
          col({ gap: 8 }, { width: 280 }, [P("Tree"), P("ListBox")]),
          article(50),
          col({ gap: 6 }, { width: 220 }, [
            T("On this page", 14),
            ...Array.from({ length: 12 }, () => P("Link")),
          ]),
        ]),
        footer(),
      ]),
    ],
    components: () => [
      col(
        { padding: 48, gap: 24 },
        { width: 1440 },
        [
          "Button",
          "Link",
          "TextField",
          "TextArea",
          "NumberField",
          "SearchField",
          "Select",
          "ComboBox",
          "Checkbox",
          "CheckboxGroup",
          "Switch",
          "RadioGroup",
          "Slider",
          "ProgressBar",
          "Meter",
          "Badge",
          "Avatar",
          "Image",
          "Card",
          "Tabs",
          "TableView",
          "ListBox",
          "GridList",
          "Tree",
          "MenuTrigger",
          "Breadcrumbs",
          "TagGroup",
          "DatePicker",
          "Calendar",
          "ToggleButton",
          "InlineAlert",
          "Disclosure",
          "Form",
          "ButtonGroup",
          "StatusLight",
          "Toolbar",
        ].map((t) =>
          col({ gap: 8, padding: 16, backgroundColor: "#ffffff" }, {}, [
            T(t, 16),
            row({ gap: 16 }, {}, [P(t), P(t)]),
          ]),
        ),
      ),
    ],
  };
  const LIST = [
    ["pricing", "Pricing", "/pricing"],
    ["about", "About", "/about"],
    ["blog", "Blog", "/blog"],
    ["article", "Article — Launch", "/blog/launch"],
    ["article", "Article — Roadmap", "/blog/roadmap"],
    ["article", "Article — Security", "/blog/security"],
    ["shop", "Shop", "/shop"],
    ["contact", "Contact", "/contact"],
    ["signup", "Sign up", "/signup"],
    ["dashboard", "Dashboard", "/app"],
    ["users", "Users", "/app/users"],
    ["projects", "Projects", "/app/projects"],
    ["projectDetail", "Project detail", "/app/projects/1"],
    ["settings", "Settings", "/app/settings"],
    ["billing", "Billing", "/app/billing"],
    ["notifications", "Notifications", "/app/notifications"],
    ["help", "Help center", "/help"],
    ["docs", "Docs — Getting started", "/docs"],
    ["docs", "Docs — API", "/docs/api"],
    ["components", "Components", "/components"],
    ["dashboard", "Analytics", "/app/analytics"],
  ];

  const state = store.getState();
  const homePageId = state.currentPageId;
  const homeBody = state.elements.find(
    (e) => e.page_id === homePageId && e.type === "body",
  );
  if (!homeBody) throw new Error("app-pages: body 없음");
  if (!g().getEntry(NODE + "perf-app-0")) {
    // Home 의 카드가 seedIds 가 되도록 Home 먼저 (track 순서 = Home 문서 순서).
    build(homeBody.id, PAGES.home());
    tracking = false;
    for (let i = 0; i < pageTotal - 1; i += 1) {
      const [key, name, route] = LIST[i % LIST.length];
      const lap = Math.floor(i / LIST.length);
      const bodyId = `perf-app-body-${i}`;
      store.getState().appendPageShell(
        {
          id: `perf-app-page-${i}`,
          slug: lap ? `${route}-${lap + 1}` : route,
          title: lap ? `${name} ${lap + 1}` : name,
        },
        { id: bodyId },
      );
      build(bodyId, PAGES[key]());
    }
    if (pageGap !== undefined)
      ws.execute(h.commands.setPageLayoutSettings({ pageLayout: { gap: pageGap } }));
    store.getState().activatePage(homePageId);
  }
  await new Promise((r) => setTimeout(r, 0));
  const of = (cat) => tracked.filter((t) => t.cat === cat).map((t) => t.id);
  return {
    seedIds: tracked.length
      ? [
          ...of("hero"),
          ...of("feature").slice(0, 7),
          ...of("nav"),
          ...of("feature").slice(7),
          ...of("quote"),
          ...of("price"),
        ]
      : Array.from({ length: 64 }, (_, i) => `perf-app-${i}`),
    nodeCount: nodes,
    records: ws.root.domInputs.size,
    pageIds: store.getState().pages.map((p) => p.id),
    homePageId,
  };
}

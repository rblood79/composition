// (ADR-128) cloud `BaseApiService` / `ElementsApiService` / `ProjectsApiService` /
// `PagesApiService` / `DocumentsApiService` exports 제거. Supabase data layer
// dead 정책에 따라 cloud adapter file 전부 삭제되었다. 본 index 는 mock data
// API + apiConfig + handleApiError 만 export 한다.
import {
  cmsMockData,
  largeMockData,
  mockAuditLogs,
  mockDepartments,
  mockInvitations,
  mockOrganizations,
  mockPermissions,
  mockProjectMemberships,
  mockProjects,
  mockRoles,
  mockEngines,
  mockComponents,
  mockJsonPlaceholderUsers,
  mockPosts,
  mockComments,
  mockAlbums,
  mockPhotos,
  mockTodos,
  buildComponentTree,
  getProjectEnginesSummary,
  getComponentTreeDepth,
  getComponentsByLevel,
  getComponentPath,
  getComponentDescendants,
  type CmsMockData,
  type MockAuditLog,
  type MockDepartment,
  type MockInvitation,
  type MockOrganization,
  type MockPermission,
  type MockProject,
  type MockProjectMembership,
  type MockRole,
  type MockUserData,
  type MockEngine,
  type MockComponent,
  type MockJsonPlaceholderUser,
  type MockPost,
  type MockComment,
  type MockAlbum,
  type MockPhoto,
  type MockTodo,
} from "./mocks/mockLargeDataV2";

// 확장된 CMS 목업 데이터 export
export {
  cmsMockData,
  largeMockData,
  mockAuditLogs,
  mockDepartments,
  mockInvitations,
  mockOrganizations,
  mockPermissions,
  mockProjectMemberships,
  mockProjects,
  mockRoles,
  mockEngines,
  mockComponents,
  mockJsonPlaceholderUsers,
  mockPosts,
  mockComments,
  mockAlbums,
  mockPhotos,
  mockTodos,
  buildComponentTree,
  getProjectEnginesSummary,
  getComponentTreeDepth,
  getComponentsByLevel,
  getComponentPath,
  getComponentDescendants,
};

export type {
  CmsMockData,
  MockAuditLog,
  MockDepartment,
  MockInvitation,
  MockOrganization,
  MockPermission,
  MockProject,
  MockProjectMembership,
  MockRole,
  MockUserData,
  MockEngine,
  MockComponent,
  MockJsonPlaceholderUser,
  MockPost,
  MockComment,
  MockAlbum,
  MockPhoto,
  MockTodo,
};

// === Mock API Endpoint ===
interface MockApiConfig {
  [key: string]: (
    path: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
}

const fetchMockData = async (
  path: string,
  params?: Record<string, unknown>,
): Promise<unknown> => {
  console.log("🌐 Fetching mock data from path:", path, "with params:", params);
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 컴포넌트별 특화 엔드포인트
  if (path === "/countries" || path === "/api/countries") {
    return handleCountriesEndpoint(params);
  } else if (path === "/cities" || path === "/api/cities") {
    return handleCitiesEndpoint(params);
  } else if (path === "/categories" || path === "/api/categories") {
    return handleCategoriesEndpoint(params);
  } else if (path === "/products" || path === "/api/products") {
    return handleProductsEndpoint(params);
  } else if (path === "/status" || path === "/api/status") {
    return handleStatusEndpoint(params);
  } else if (path === "/priorities" || path === "/api/priorities") {
    return handlePrioritiesEndpoint(params);
  } else if (path === "/tags" || path === "/api/tags") {
    return handleTagsEndpoint(params);
  } else if (path === "/languages" || path === "/api/languages") {
    return handleLanguagesEndpoint(params);
  } else if (path === "/currencies" || path === "/api/currencies") {
    return handleCurrenciesEndpoint(params);
  } else if (path === "/timezones" || path === "/api/timezones") {
    return handleTimezonesEndpoint(params);
  }
  // 기존 엔드포인트
  else if (path === "/permissions" || path === "/api/permissions") {
    return handlePermissionsEndpoint(params);
  } else if (path === "/roles" || path === "/api/roles") {
    return handleRolesEndpoint(params);
  } else if (path === "/departments" || path === "/api/departments") {
    return handleDepartmentsEndpoint(params);
  } else if (path === "/organizations" || path === "/api/organizations") {
    return handleOrganizationsEndpoint(params);
  } else if (path === "/projects" || path === "/api/projects") {
    return handleProjectsEndpoint(params);
  } else if (
    path === "/project-memberships" ||
    path === "/api/project-memberships"
  ) {
    return handleProjectMembershipsEndpoint(params);
  } else if (path === "/audit-logs" || path === "/api/audit-logs") {
    return handleAuditLogsEndpoint(params);
  } else if (path === "/invitations" || path === "/api/invitations") {
    return handleInvitationsEndpoint(params);
  } else if (path === "/engines" || path === "/api/engines") {
    return handleEnginesEndpoint(params);
  } else if (path === "/components" || path === "/api/components") {
    return handleComponentsEndpoint(params);
  } else if (path === "/component-tree" || path === "/api/component-tree") {
    return handleComponentTreeEndpoint(params);
  } else if (path === "/engine-summary" || path === "/api/engine-summary") {
    return handleEngineSummaryEndpoint(params);
  } else {
    // 기본: 사용자 데이터
    return handleUsersEndpoint(path, params);
  }
};

// 컴포넌트별 특화 엔드포인트 핸들러

// Countries 엔드포인트 (Select, ComboBox, ListBox용)
const handleCountriesEndpoint = (params?: Record<string, unknown>) => {
  const countries = [
    { id: "kr", name: "대한민국", code: "KR", continent: "아시아" },
    { id: "us", name: "미국", code: "US", continent: "북아메리카" },
    { id: "jp", name: "일본", code: "JP", continent: "아시아" },
    { id: "cn", name: "중국", code: "CN", continent: "아시아" },
    { id: "uk", name: "영국", code: "GB", continent: "유럽" },
    { id: "fr", name: "프랑스", code: "FR", continent: "유럽" },
    { id: "de", name: "독일", code: "DE", continent: "유럽" },
    { id: "ca", name: "캐나다", code: "CA", continent: "북아메리카" },
    { id: "au", name: "호주", code: "AU", continent: "오세아니아" },
    { id: "sg", name: "싱가포르", code: "SG", continent: "아시아" },
  ];
  console.log(`🌍 /countries 엔드포인트: ${countries.length}개 국가 반환`);
  return applyPagination(countries, params);
};

// Cities 엔드포인트 (Select, ComboBox, ListBox용)
const handleCitiesEndpoint = (params?: Record<string, unknown>) => {
  const cities = [
    { id: "seoul", name: "서울", country: "대한민국", population: 9720846 },
    { id: "busan", name: "부산", country: "대한민국", population: 3413841 },
    { id: "tokyo", name: "도쿄", country: "일본", population: 13960000 },
    { id: "newyork", name: "뉴욕", country: "미국", population: 8336817 },
    { id: "london", name: "런던", country: "영국", population: 8982000 },
    { id: "paris", name: "파리", country: "프랑스", population: 2165423 },
    { id: "beijing", name: "베이징", country: "중국", population: 21540000 },
    { id: "shanghai", name: "상하이", country: "중국", population: 24280000 },
    {
      id: "singapore",
      name: "싱가포르",
      country: "싱가포르",
      population: 5685807,
    },
    { id: "sydney", name: "시드니", country: "호주", population: 5312163 },
  ];
  console.log(`🏙️ /cities 엔드포인트: ${cities.length}개 도시 반환`);
  return applyPagination(cities, params);
};

// Categories 엔드포인트 (Menu, Select용)
const handleCategoriesEndpoint = (params?: Record<string, unknown>) => {
  const categories = [
    {
      id: "electronics",
      name: "전자제품",
      icon: "💻",
      description: "컴퓨터, 스마트폰 등",
    },
    { id: "fashion", name: "패션", icon: "👕", description: "의류, 액세서리" },
    { id: "food", name: "식품", icon: "🍔", description: "식료품, 음료" },
    { id: "books", name: "도서", icon: "📚", description: "책, 잡지" },
    { id: "sports", name: "스포츠", icon: "⚽", description: "운동용품" },
    { id: "beauty", name: "뷰티", icon: "💄", description: "화장품, 향수" },
    {
      id: "home",
      name: "홈/인테리어",
      icon: "🏠",
      description: "가구, 생활용품",
    },
    { id: "toy", name: "장난감", icon: "🎮", description: "완구, 게임" },
  ];
  console.log(
    `📁 /categories 엔드포인트: ${categories.length}개 카테고리 반환`,
  );
  return applyPagination(categories, params);
};

// Products 엔드포인트 (ListBox, GridList용)
const handleProductsEndpoint = (params?: Record<string, unknown>) => {
  const products = [
    {
      id: "p1",
      name: 'MacBook Pro 16"',
      price: 3290000,
      category: "전자제품",
      stock: 15,
    },
    {
      id: "p2",
      name: "iPhone 15 Pro",
      price: 1550000,
      category: "전자제품",
      stock: 42,
    },
    {
      id: "p3",
      name: "AirPods Pro",
      price: 329000,
      category: "전자제품",
      stock: 78,
    },
    {
      id: "p4",
      name: "Nike Air Max",
      price: 159000,
      category: "패션",
      stock: 24,
    },
    {
      id: "p5",
      name: "Adidas Ultraboost",
      price: 189000,
      category: "스포츠",
      stock: 31,
    },
    {
      id: "p6",
      name: "Sony WH-1000XM5",
      price: 449000,
      category: "전자제품",
      stock: 19,
    },
    {
      id: "p7",
      name: "iPad Air",
      price: 929000,
      category: "전자제품",
      stock: 28,
    },
    {
      id: "p8",
      name: "Samsung Galaxy S24",
      price: 1190000,
      category: "전자제품",
      stock: 35,
    },
  ];
  console.log(`📦 /products 엔드포인트: ${products.length}개 상품 반환`);
  return applyPagination(products, params);
};

// Status 엔드포인트 (Select, RadioGroup용)
const handleStatusEndpoint = (params?: Record<string, unknown>) => {
  const statuses = [
    { id: "todo", name: "할 일", label: "할 일", color: "#9CA3AF" },
    { id: "in-progress", name: "진행 중", label: "진행 중", color: "#3B82F6" },
    { id: "review", name: "검토", label: "검토", color: "#F59E0B" },
    { id: "done", name: "완료", label: "완료", color: "#10B981" },
    { id: "blocked", name: "차단됨", label: "차단됨", color: "#EF4444" },
  ];
  console.log(`📊 /status 엔드포인트: ${statuses.length}개 상태 반환`);
  return applyPagination(statuses, params);
};

// Priorities 엔드포인트 (Select, RadioGroup용)
const handlePrioritiesEndpoint = (params?: Record<string, unknown>) => {
  const priorities = [
    { id: "low", name: "낮음", label: "낮음", icon: "⬇️", level: 1 },
    { id: "medium", name: "보통", label: "보통", icon: "➡️", level: 2 },
    { id: "high", name: "높음", label: "높음", icon: "⬆️", level: 3 },
    { id: "urgent", name: "긴급", label: "긴급", icon: "🔥", level: 4 },
  ];
  console.log(
    `⚡ /priorities 엔드포인트: ${priorities.length}개 우선순위 반환`,
  );
  return applyPagination(priorities, params);
};

// Tags 엔드포인트 (ListBox, CheckboxGroup용)
const handleTagsEndpoint = (params?: Record<string, unknown>) => {
  const tags = [
    {
      id: "frontend",
      name: "프론트엔드",
      label: "프론트엔드",
      color: "#3B82F6",
    },
    { id: "backend", name: "백엔드", label: "백엔드", color: "#10B981" },
    { id: "design", name: "디자인", label: "디자인", color: "#F59E0B" },
    { id: "documentation", name: "문서", label: "문서", color: "#8B5CF6" },
    { id: "bug", name: "버그", label: "버그", color: "#EF4444" },
    { id: "feature", name: "기능", label: "기능", color: "#06B6D4" },
    { id: "enhancement", name: "개선", label: "개선", color: "#84CC16" },
    { id: "testing", name: "테스트", label: "테스트", color: "#EC4899" },
  ];
  console.log(`🏷️ /tags 엔드포인트: ${tags.length}개 태그 반환`);
  return applyPagination(tags, params);
};

// Languages 엔드포인트 (Select, ComboBox용)
const handleLanguagesEndpoint = (params?: Record<string, unknown>) => {
  const languages = [
    {
      id: "ko",
      name: "한국어",
      label: "한국어",
      nativeName: "한국어",
      code: "ko-KR",
    },
    {
      id: "en",
      name: "영어",
      label: "영어",
      nativeName: "English",
      code: "en-US",
    },
    {
      id: "ja",
      name: "일본어",
      label: "일본어",
      nativeName: "日本語",
      code: "ja-JP",
    },
    {
      id: "zh",
      name: "중국어",
      label: "중국어",
      nativeName: "中文",
      code: "zh-CN",
    },
    {
      id: "es",
      name: "스페인어",
      label: "스페인어",
      nativeName: "Español",
      code: "es-ES",
    },
    {
      id: "fr",
      name: "프랑스어",
      label: "프랑스어",
      nativeName: "Français",
      code: "fr-FR",
    },
    {
      id: "de",
      name: "독일어",
      label: "독일어",
      nativeName: "Deutsch",
      code: "de-DE",
    },
    {
      id: "ru",
      name: "러시아어",
      label: "러시아어",
      nativeName: "Русский",
      code: "ru-RU",
    },
  ];
  console.log(`🌐 /languages 엔드포인트: ${languages.length}개 언어 반환`);
  return applyPagination(languages, params);
};

// Currencies 엔드포인트 (Select, ComboBox용)
const handleCurrenciesEndpoint = (params?: Record<string, unknown>) => {
  const currencies = [
    {
      id: "krw",
      name: "대한민국 원",
      label: "원 (₩)",
      code: "KRW",
      symbol: "₩",
    },
    {
      id: "usd",
      name: "미국 달러",
      label: "달러 ($)",
      code: "USD",
      symbol: "$",
    },
    { id: "jpy", name: "일본 엔", label: "엔 (¥)", code: "JPY", symbol: "¥" },
    { id: "eur", name: "유로", label: "유로 (€)", code: "EUR", symbol: "€" },
    {
      id: "gbp",
      name: "영국 파운드",
      label: "파운드 (£)",
      code: "GBP",
      symbol: "£",
    },
    {
      id: "cny",
      name: "중국 위안",
      label: "위안 (¥)",
      code: "CNY",
      symbol: "¥",
    },
    {
      id: "aud",
      name: "호주 달러",
      label: "호주 달러 (A$)",
      code: "AUD",
      symbol: "A$",
    },
    {
      id: "cad",
      name: "캐나다 달러",
      label: "캐나다 달러 (C$)",
      code: "CAD",
      symbol: "C$",
    },
  ];
  console.log(`💰 /currencies 엔드포인트: ${currencies.length}개 통화 반환`);
  return applyPagination(currencies, params);
};

// Timezones 엔드포인트 (Select, ComboBox용)
const handleTimezonesEndpoint = (params?: Record<string, unknown>) => {
  const timezones = [
    {
      id: "asia-seoul",
      name: "서울",
      label: "서울 (UTC+9)",
      timezone: "Asia/Seoul",
      offset: "+09:00",
    },
    {
      id: "asia-tokyo",
      name: "도쿄",
      label: "도쿄 (UTC+9)",
      timezone: "Asia/Tokyo",
      offset: "+09:00",
    },
    {
      id: "america-newyork",
      name: "뉴욕",
      label: "뉴욕 (UTC-5)",
      timezone: "America/New_York",
      offset: "-05:00",
    },
    {
      id: "america-losangeles",
      name: "로스앤젤레스",
      label: "로스앤젤레스 (UTC-8)",
      timezone: "America/Los_Angeles",
      offset: "-08:00",
    },
    {
      id: "europe-london",
      name: "런던",
      label: "런던 (UTC+0)",
      timezone: "Europe/London",
      offset: "+00:00",
    },
    {
      id: "europe-paris",
      name: "파리",
      label: "파리 (UTC+1)",
      timezone: "Europe/Paris",
      offset: "+01:00",
    },
    {
      id: "australia-sydney",
      name: "시드니",
      label: "시드니 (UTC+10)",
      timezone: "Australia/Sydney",
      offset: "+10:00",
    },
    {
      id: "asia-dubai",
      name: "두바이",
      label: "두바이 (UTC+4)",
      timezone: "Asia/Dubai",
      offset: "+04:00",
    },
  ];
  console.log(`🕐 /timezones 엔드포인트: ${timezones.length}개 시간대 반환`);
  return applyPagination(timezones, params);
};

// Permissions 엔드포인트 핸들러
const handlePermissionsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /permissions 엔드포인트: ${mockPermissions.length}개 반환`);
  return applyPagination(mockPermissions, params);
};

// Roles 엔드포인트 핸들러
const handleRolesEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /roles 엔드포인트: ${mockRoles.length}개 반환`);
  return applyPagination(mockRoles, params);
};

// Departments 엔드포인트 핸들러
const handleDepartmentsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /departments 엔드포인트: ${mockDepartments.length}개 반환`);
  return applyPagination(mockDepartments, params);
};

// Organizations 엔드포인트 핸들러
const handleOrganizationsEndpoint = (params?: Record<string, unknown>) => {
  console.log(
    `📊 /organizations 엔드포인트: ${mockOrganizations.length}개 반환`,
  );
  return applyPagination(mockOrganizations, params);
};

// Projects 엔드포인트 핸들러
const handleProjectsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /projects 엔드포인트: ${mockProjects.length}개 반환`);
  return applyPagination(mockProjects, params);
};

// Project Memberships 엔드포인트 핸들러
const handleProjectMembershipsEndpoint = (params?: Record<string, unknown>) => {
  console.log(
    `📊 /project-memberships 엔드포인트: ${mockProjectMemberships.length}개 반환`,
  );
  return applyPagination(mockProjectMemberships, params);
};

// Audit Logs 엔드포인트 핸들러
const handleAuditLogsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /audit-logs 엔드포인트: ${mockAuditLogs.length}개 반환`);
  return applyPagination(mockAuditLogs, params);
};

// Invitations 엔드포인트 핸들러
const handleInvitationsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /invitations 엔드포인트: ${mockInvitations.length}개 반환`);
  return applyPagination(mockInvitations, params);
};

// Engines 엔드포인트 핸들러
const handleEnginesEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /engines 엔드포인트: ${mockEngines.length}개 반환`);
  return applyPagination(mockEngines, params);
};

// Components 엔드포인트 핸들러
const handleComponentsEndpoint = (params?: Record<string, unknown>) => {
  console.log(`📊 /components 엔드포인트: ${mockComponents.length}개 반환`);
  return applyPagination(mockComponents, params);
};

// Component Tree 엔드포인트 핸들러 (Tree 컴포넌트용)
const handleComponentTreeEndpoint = (params?: Record<string, unknown>) => {
  const engineId = params?.engineId as string | undefined;

  if (engineId) {
    const tree = buildComponentTree(engineId, mockComponents);
    console.log(
      `🌳 /component-tree 엔드포인트: Engine ${engineId}의 트리 구조 반환`,
    );
    return tree;
  }

  // engineId가 없으면 첫 번째 엔진의 트리 반환
  const firstEngine = mockEngines[0];
  if (firstEngine) {
    const tree = buildComponentTree(firstEngine.id, mockComponents);
    console.log(
      `🌳 /component-tree 엔드포인트: 기본 Engine ${firstEngine.id}의 트리 구조 반환`,
    );
    return tree;
  }

  return [];
};

// Engine Summary 엔드포인트 핸들러
const handleEngineSummaryEndpoint = (params?: Record<string, unknown>) => {
  const projectId = params?.projectId as string | undefined;

  if (projectId) {
    const summary = getProjectEnginesSummary(
      projectId,
      mockEngines,
      mockComponents,
    );
    console.log(
      `📊 /engine-summary 엔드포인트: Project ${projectId}의 엔진 요약 반환`,
    );
    return summary;
  }

  // projectId가 없으면 첫 번째 프로젝트의 요약 반환
  const firstProject = mockProjects[0];
  if (firstProject) {
    const summary = getProjectEnginesSummary(
      firstProject.id,
      mockEngines,
      mockComponents,
    );
    console.log(
      `📊 /engine-summary 엔드포인트: 기본 Project ${firstProject.id}의 엔진 요약 반환`,
    );
    return summary;
  }

  return [];
};

// Users 엔드포인트 핸들러 (기존 로직)
const handleUsersEndpoint = (
  path: string,
  params?: Record<string, unknown>,
) => {
  // 엔드포인트 경로에 따라 다른 데이터 반환
  let filteredData = largeMockData;

  // 특정 엔드포인트 경로에 대한 데이터 필터링
  if (path === "/users" || path === "/api/users") {
    // JSONPlaceholder 스타일 Users (username, website, address.geo 등 포함)
    console.log(
      `📊 /users 엔드포인트: JSONPlaceholder 형식 사용자 ${mockJsonPlaceholderUsers.length}개 반환`,
    );
    return applyPagination(
      mockJsonPlaceholderUsers as unknown as MockUserData[],
      params,
    );
  } else if (path === "/cms-users" || path === "/api/cms-users") {
    // CMS 내부용 상세 사용자 데이터 (기존 largeMockData)
    filteredData = largeMockData.filter(
      (user) =>
        user.role.includes("개발자") ||
        user.role.includes("디자이너") ||
        user.role.includes("분석가"),
    );
    console.log(
      `📊 /cms-users 엔드포인트: CMS 사용자 데이터 ${filteredData.length}개 반환`,
    );
  } else if (
    path === "/admins" ||
    path === "/api/admins" ||
    path === "/api/users/admins"
  ) {
    // 관리자 데이터만 반환 (프로젝트 매니저, 시스템 아키텍트 등)
    filteredData = largeMockData.filter(
      (user) =>
        user.role.includes("매니저") ||
        user.role.includes("아키텍트") ||
        user.role.includes("보안"),
    );
    console.log(
      `📊 /admins 엔드포인트: 관리자 데이터 ${filteredData.length}개 반환`,
    );
  } else if (path === "/companies" || path === "/api/companies") {
    // 회사 목록만 반환 (중복 제거)
    const uniqueCompanies = [
      ...new Set(largeMockData.map((user) => user.company)),
    ];
    filteredData = uniqueCompanies.map((company, index) => ({
      id: index + 1,
      name: company, // 회사 이름을 name 필드에 매핑
      company: company,
      // 회사별 직원 수 계산
      employeeCount: largeMockData.filter((u) => u.company === company).length,
    })) as unknown as MockUserData[];
    console.log(
      `📊 /companies 엔드포인트: 회사 목록 ${filteredData.length}개 반환`,
    );
  } else if (
    path === "/company-employees" ||
    path === "/api/company-employees"
  ) {
    // 회사별 직원 데이터 반환 (기존 동작)
    const targetCompanies = ["테크노베이션", "디지털솔루션", "스마트시스템즈"];
    filteredData = largeMockData.filter((user) =>
      targetCompanies.includes(user.company),
    );
    console.log(
      `📊 /company-employees 엔드포인트: 회사 직원 데이터 ${filteredData.length}개 반환`,
    );
  } else if (
    path === "/developers" ||
    path === "/api/developers" ||
    path === "/api/users/developers"
  ) {
    // 개발자만 반환
    filteredData = largeMockData.filter((user) => user.role.includes("개발자"));
    console.log(
      `📊 /developers 엔드포인트: 개발자 데이터 ${filteredData.length}개 반환`,
    );
  } else if (
    path === "/managers" ||
    path === "/api/managers" ||
    path === "/api/users/managers"
  ) {
    // 매니저만 반환
    filteredData = largeMockData.filter((user) => user.role.includes("매니저"));
    console.log(
      `📊 /managers 엔드포인트: 매니저 데이터 ${filteredData.length}개 반환`,
    );
  } else if (path === "/products" || path === "/api/products") {
    // 제품 관련 데이터 (향후 확장을 위해 추가)
    filteredData = largeMockData.filter(
      (user) =>
        user.role.includes("제품") ||
        user.role.includes("기획") ||
        user.role.includes("디자이너"),
    );
    console.log(
      `📊 /products 엔드포인트: 제품 관련 데이터 ${filteredData.length}개 반환`,
    );
  } else if (path === "/posts" || path === "/api/posts") {
    // JSONPlaceholder 스타일: Posts
    console.log(`📊 /posts 엔드포인트: 게시글 목록 ${mockPosts.length}개 반환`);
    return applyPagination(mockPosts as unknown as MockUserData[], params);
  } else if (path === "/comments" || path === "/api/comments") {
    // JSONPlaceholder 스타일: Comments
    console.log(
      `📊 /comments 엔드포인트: 댓글 목록 ${mockComments.length}개 반환`,
    );
    return applyPagination(mockComments as unknown as MockUserData[], params);
  } else if (path === "/albums" || path === "/api/albums") {
    // JSONPlaceholder 스타일: Albums
    console.log(`📊 /albums 엔드포인트: 앨범 목록 ${mockAlbums.length}개 반환`);
    return applyPagination(mockAlbums as unknown as MockUserData[], params);
  } else if (path === "/photos" || path === "/api/photos") {
    // JSONPlaceholder 스타일: Photos
    console.log(`📊 /photos 엔드포인트: 사진 목록 ${mockPhotos.length}개 반환`);
    return applyPagination(mockPhotos as unknown as MockUserData[], params);
  } else if (path === "/todos" || path === "/api/todos") {
    // JSONPlaceholder 스타일: Todos
    console.log(`📊 /todos 엔드포인트: 할일 목록 ${mockTodos.length}개 반환`);
    return applyPagination(mockTodos as unknown as MockUserData[], params);
  } else {
    // 기본적으로 모든 데이터 반환 (기존 동작 유지)
    console.log(
      `📊 기본 엔드포인트 또는 알 수 없는 경로: 전체 데이터 ${filteredData.length}개 반환`,
    );
  }

  // Simulate filtering if 'search' param is provided
  if (params && typeof params.search === "string") {
    const searchTerm = params.search.toLowerCase();
    filteredData = largeMockData.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.company.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm),
    );
  }

  return applyPagination(filteredData, params);
};

// 페이지네이션 공통 로직
const applyPagination = <T>(
  data: T[],
  params?: Record<string, unknown>,
): T[] => {
  // 전체 데이터 요청 확인
  if (params && params.getAll === true) {
    console.log(`📊 Returning all data: ${data.length} items`);
    return data;
  }

  // 페이지네이션 지원 (page/limit 방식)
  if (
    params &&
    typeof params.page === "number" &&
    typeof params.limit === "number"
  ) {
    const page = params.page;
    const limit = params.limit;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const totalItems = data.length;
    const returnedItems = Math.min(endIndex, totalItems) - startIndex;

    console.log(
      `📄 Pagination: page ${page}, limit ${limit}, startIndex ${startIndex}, endIndex ${endIndex}`,
    );
    console.log(
      `📊 Total data: ${totalItems}, returning: ${returnedItems} items`,
    );

    // 페이지네이션을 위해 전체 데이터 개수 정보를 포함한 객체 반환
    const result = data.slice(startIndex, endIndex);

    // 페이지네이션을 위한 메타데이터 추가
    Object.assign(result, {
      __meta: {
        totalItems,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: endIndex < totalItems,
        startIndex,
        endIndex,
      },
    });

    return result;
  }

  // 기본적으로 모든 데이터 반환 (기존 동작 유지)
  console.log(`📊 Returning all data (default): ${data.length} items`);
  return data;
};

export const apiConfig: MockApiConfig = {
  MOCK_DATA: fetchMockData,
  // 여기에 다른 Mock API 또는 실제 API 매핑을 추가할 수 있습니다.
};

// 통합 API 응답 타입
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// 공통 에러 핸들링 함수
export const handleApiError = (
  error: unknown,
  operation: string,
): ApiResponse<null> => {
  console.error(`${operation} 실패:`, error);
  return {
    data: null,
    error:
      error instanceof Error
        ? error.message
        : "알 수 없는 오류가 발생했습니다.",
    success: false,
  };
};

// API 서비스 통합 클래스 (선택적)
// (ADR-128) `ApiService` 통합 클래스 제거 — cloud-only adapter 전부 삭제됨.
// 신규 caller 는 mock API (`apiConfig`) 또는 IndexedDB (`getDB()`) 직접 사용.

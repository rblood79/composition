/**
 * I18n Type Definitions
 *
 * Defines types for internationalization system
 */

/**
 * Supported locales
 */
export type SupportedLocale = "ko-KR" | "en-US";

/**
 * Direction for text layout
 */
export type Direction = "ltr" | "rtl";

/**
 * Locale configuration
 */
export interface LocaleConfig {
  /** Locale identifier (e.g., 'ko-KR', 'en-US') */
  locale: SupportedLocale;
  /** Display name in the locale's own language */
  name: string;
  /** Text direction */
  direction: Direction;
  /** Date format pattern */
  dateFormat: string;
  /** Time format (12h or 24h) */
  timeFormat: 12 | 24;
  /** Currency code */
  currency: string;
}

/**
 * Translation keys structure
 */
export interface TranslationKeys {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    close: string;
    open: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    confirm: string;
    back: string;
    next: string;
    previous: string;
    search: string;
    filter: string;
    clear: string;
    reset: string;
    apply: string;
    select: string;
    selectAll: string;
    deselectAll: string;
  };
  builder: {
    title: string;
    newProject: string;
    openProject: string;
    saveProject: string;
    addElement: string;
    deleteElement: string;
    duplicateElement: string;
    undo: string;
    redo: string;
    preview: string;
    publish: string;
    settings: string;
  };
  settings: {
    title: string;
    language: string;
    rulersAndGuides: string;
    showRulers: string;
    snapToObjects: string;
    pageLayout: string;
    pageLayoutHorizontal: string;
    pageLayoutVertical: string;
    pageLayoutZigzag: string;
    themeAppearance: string;
    themeMode: string;
    themeModeLight: string;
    themeModeDark: string;
    themeModeAuto: string;
    uiScale: string;
    uiScaleSmall: string;
    uiScaleDefault: string;
    uiScaleLarge: string;
  };
  header: {
    menu: string;
    openProject: string;
    importProject: string;
    exportProject: string;
    deleteProject: string;
    resetPanelLayout: string;
    settings: string;
    shortcuts: string;
    help: string;
    about: string;
    noProject: string;
    logo: string;
    emptyHistory: string;
    undo: string;
    redo: string;
    viewportControls: string;
    viewportSize: string;
    viewOptions: string;
    compareMode: string;
    skiaOnlyMode: string;
    showWorkflowOverlay: string;
    hideWorkflowOverlay: string;
    preview: string;
    monitor: string;
    publish: string;
    desktop: string;
    tablet: string;
    mobile: string;
  };
  workspace: {
    workArea: string;
    movePanel: string;
    resizePanel: string;
    resizeRow: string;
    resizeColumn: string;
    leftPanelControls: string;
    rightPanelControls: string;
    bottomPanelControls: string;
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
  zoom: {
    level: string;
    menu: string;
    in: string;
    out: string;
    fit: string;
    fill: string;
    align: string;
  };
  panels: {
    nodes: string;
    components: string;
    dataTable: string;
    dataTableEditor: string;
    theme: string;
    settings: string;
    ai: string;
    properties: string;
    styles: string;
    interactions: string;
    history: string;
    monitor: string;
  };
  nodes: {
    pages: string;
    frames: string;
    panelTabs: string;
    addPage: string;
    selectPage: string;
    addFrame: string;
    noFrames: string;
    selectFrame: string;
    noElements: string;
    layers: string;
    collapseAll: string;
  };
  styles: {
    view: string;
    layout: string;
    layoutHint: string;
    style: string;
    styleHint: string;
    text: string;
    textHint: string;
    screen: string;
    screenHint: string;
    modified: string;
    modifiedHint: string;
    modifiedCount: string;
    copyStyles: string;
    pasteStyles: string;
    focus: string;
    selectElement: string;
  };
  datatable: Record<string, string>;
  monitor: Record<string, string>;
  debugger: Record<string, string>;
  components: {
    // Content
    text: string;
    icon: string;
    separator: string;
    badge: string;
    progressBar: string;
    meter: string;
    skeleton: string;
    avatar: string;
    avatarGroup: string;
    statusLight: string;
    inlineAlert: string;
    progressCircle: string;
    image: string;
    illustratedMessage: string;
    // Layout
    panel: string;
    card: string;
    tabs: string;
    breadcrumbs: string;
    link: string;
    nav: string;
    scrollBox: string;
    maskedFrame: string;
    cardView: string;
    slot: string;
    // Buttons
    button: string;
    toggleButton: string;
    toggleButtonGroup: string;
    toolbar: string;
    buttonGroup: string;
    actionMenu: string;
    selectBoxGroup: string;
    // Forms
    textField: string;
    numberField: string;
    searchField: string;
    checkbox: string;
    checkboxGroup: string;
    radioGroup: string;
    select: string;
    comboBox: string;
    switch: string;
    slider: string;
    rangeSlider: string;
    colorPicker: string;
    dropZone: string;
    fileTrigger: string;
    form: string;
    field: string;
    // Collections
    table: string;
    listBox: string;
    gridList: string;
    tree: string;
    tagGroup: string;
    menu: string;
    section: string;
    tableView: string;
    // Date & Time
    calendar: string;
    datePicker: string;
    dateRangePicker: string;
    dateField: string;
    timeField: string;
    rangeCalendar: string;
    // Overlays
    dialog: string;
    modal: string;
    popover: string;
    tooltip: string;
    // Legacy (backward compatibility)
    input: string;
    radio: string;
    timePicker: string;
    fileUpload: string;
    type: string;
  };
  validation: {
    required: string;
    minLength: string;
    maxLength: string;
    email: string;
    url: string;
    pattern: string;
    min: string;
    max: string;
    invalidDate: string;
    invalidTime: string;
    invalidNumber: string;
  };
  messages: {
    projectCreated: string;
    projectSaved: string;
    projectDeleted: string;
    elementAdded: string;
    elementDeleted: string;
    elementUpdated: string;
    unsavedChanges: string;
    confirmDelete: string;
    confirmLeave: string;
    noResults: string;
    loadingData: string;
    errorLoadingData: string;
    itemCount: string;
  };
}

/**
 * I18n Context value
 */
export interface I18nContextValue {
  /** Current locale */
  locale: SupportedLocale;
  /** Set locale */
  setLocale: (locale: SupportedLocale) => void;
  /** Translate function */
  t: (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => string;
  /** Current direction */
  direction: Direction;
  /** Current locale config */
  config: LocaleConfig;
  /** Format date */
  formatDate: (date: Date) => string;
  /** Format time */
  formatTime: (date: Date) => string;
  /** Format number */
  formatNumber: (value: number) => string;
  /** Format currency */
  formatCurrency: (value: number) => string;
}

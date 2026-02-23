
export const translations = {
  zh: {
    appName: "MangaType Live",
    undo: "撤销",
    redo: "重做",
    settings: "设置",
    help: "帮助",
    addFiles: "添加图片",
    addFolder: "添加文件夹",
    gallery: "图库",
    current: "当前图片",
    processAll: "所有图片",
    // New specific translation buttons
    translateCurrent: "翻译当前",
    translateAll: "翻译所有",
    stop: "停止处理",
    saveImage: "保存图片",
    zipAll: "打包下载",
    noImageSelected: "未选择图片",
    dragDrop: "拖拽文件，粘贴图片，或使用侧边栏。",
    properties: "属性",
    deleteBubble: "删除气泡",
    content: "内容",
    enterText: "输入文本...",
    aiAssistant: "AI 助手",
    aiThinking: "AI 思考中...",
    dramatic: "戏剧化",
    casual: "口语化",
    translate: "翻译",
    maskGeometry: "遮罩形状",
    width: "宽",
    height: "高",
    whiteBg: "白底遮罩",
    typography: "排版",
    direction: "方向",
    horizontal: "横排",
    vertical: "竖排",
    size: "字号",
    rotation: "旋转",
    fontFamily: "字体",
    manualAdd: "点击添加",
    toolMode: "工具模式",
    toolBubble: "气泡工具 (Mode 1)",
    toolMask: "气泡工具 (Mode 2)",
    toolBrush: "修补画笔 (Brush)",
    toolNone: "浏览模式",
    translateRegions: "翻译选区",
    translateRegionsDesc: "绘制红框来辅助 AI。在设置中开启「遮罩模式」可仅发送红框内容。",
    importJson: "导入 JSON",
    merge: "合并图层",
    globalStyles: "全局样式",
    concurrency: "并发数",
    noBubbleSelected: "未选中气泡",
    clickBubbleHint: "点击画布上的气泡进行编辑。",
    aiSettings: "AI 设置",
    aiProvider: "AI 提供商",
    baseUrl: "Base URL",
    apiKey: "API Key",
    modelSelection: "模型选择",
    textDetection: "本地文本检测",
    detectionExpansion: "探测框膨胀率",
    detectionExpansionHint: "接收到坐标后，向外扩大的比例。正数扩大，负数缩小。",
    allowAiRotation: "允许 AI 旋转",
    allowAiRotationHint: "尝试让 AI 识别文字倾斜角度（实验性）。",
    allowAiFontSelection: "允许 AI 选择字体",
    allowAiFontSelectionHint: "开启后，AI 会根据语气自动选择草书、毛笔等字体。关闭则全部默认使用黑体。",
    fontSelectionPrompt: "字体选择提示词",
    fontSelectionPromptHint: "指导 AI 如何根据语境选择合适的字体。请勿修改字体 ID。",
    allowAiColorSelection: "允许 AI 选择字体颜色",
    allowAiColorSelectionHint: "开启后，AI 会根据场景自动选择文字颜色和描边颜色。关闭则默认使用黑字白边。",
    colorSelectionPrompt: "颜色选择提示词",
    colorSelectionPromptHint: "指导 AI 如何根据场景选择合适的颜色组合。请勿修改颜色代码格式。",
    detectionTab: "检测与辅助",
    detectionTabDesc: "配置红框、本地检测与辅助对齐功能。",
    enableMaskedImageMode: "遮罩发送模式",
    enableMaskedImageModeHint: "若图片存在红框，仅将红框内的部分发送给 AI（其余部分留白）。",
    useMasksAsHints: "使用红框作为提示",
    useMasksAsHintsHint: "将红框的坐标作为文本提示发送给 AI，告诉它\"这里有文字\"。",
    drawMasksOnImage: "在图片上绘制红框",
    drawMasksOnImageHint: "开启后，发送给 AI 的图片会画上红框标注，让 AI 能直观看到标记区域。",
    appendMasksToManualJson: "附加到手动 JSON",
    appendMasksToManualJsonHint: "开启后，在\"手动 JSON 导入\"的提示词后面附加当前图片的所有红框坐标。",
    autoDetectBackground: "自动检测背景色",
    autoDetectBackgroundHint: "在移动、缩放或绘制气泡时，自动吸取周围颜色作为遮罩背景（关闭则默认为白色）。",
    enableDialogSnap: "对话框吸附",
    enableDialogSnapHint: "当检测到手动绘制的红框时，自动将 AI 生成的气泡中心吸附到红框中心。",
    forceSnapSize: "强制匹配尺寸",
    forceSnapSizeHint: "吸附时，强制气泡完全继承红框的宽和高，忽略 AI 的尺寸判断。",
    defaultFontSize: "默认字号",
    fontSizeTab: "字号控制",
    fontSizeTabDesc: "配置 AI 如何决定每个气泡的字号大小。",
    allowAiFontSize: "允许 AI 控制字号",
    allowAiFontSizeHint: "开启后，AI 会根据气泡内容和语气自动调整字号。关闭则使用默认字号。",
    fontSizeScaleMode: "档位模式",
    fontSizeDirectMode: "直接模式",
    fontSizeScaleEntries: "字号档位",
    fontSizeAddScale: "添加档位",
    fontSizeScalePrompt: "档位模式提示词",
    fontSizeScalePromptHint: "指导 AI 如何选择字号档位。档位列表会自动追加到末尾。",
    fontSizeDirectPrompt: "字号选择提示词",
    fontSizeDirectPromptHint: "指导 AI 如何选择具体的字号数值。",
    fontSizeFallback: "默认/回退字号",
    fontSizeFallbackHint: "当 AI 未输出字号时使用此值。",
    systemPrompt: "系统提示词",
    cancel: "取消",
    saveSettings: "保存设置",
    manualJsonImport: "手动 JSON 导入",
    pasteJson: "在此粘贴 AI 输出的 JSON...",
    copyPrompt: "复制提示词",
    loadTemplate: "加载模板",
    applyBubbles: "应用气泡",
    envConfigured: "环境变量已配置",
    refreshModels: "刷新模型",
    fetching: "获取中...",
    noModels: "未找到模型",
    failedFetch: "获取失败",
    promptCopied: "提示词已复制！",
    jsonError: "JSON 格式错误",
    processing: "处理中",
    done: "完成",
    error: "错误",
    language: "语言 / Language",
    sure: "确定?",
    galleryTitle: "图库",
    generatedHtml: "生成的 HTML",
    close: "关闭",
    copyHtml: "复制 HTML",
    baseUrlHint: "格式如 https://api.provider.com 或 https://api.provider.com/v1 均可。",
    modelFilterHint: "输入部分字符过滤列表；留空或输入完整模型名则显示全部。",
    preRequestMessages: "请求前置消息",
    preRequestHint: "这些消息将作为对话历史插入在请求图片之前。",
    role: "角色",
    msgContent: "消息内容",
    addMessage: "添加消息",
    translateMenu: "AI 翻译",
    autoDetect: "自动识别 (Auto)",
    maskScan: "红框扫描 (Mask)",
    maskStyle: "遮罩样式",
    shape: "形状",
    shapeRect: "直角",
    shapeRound: "圆角",
    shapeEllipse: "椭圆",
    cornerRadius: "圆角半径",
    feathering: "羽化程度",
    resetStatus: "重置状态",
    // Model Capabilities
    modelCapabilities: "模型能力",
    modelCapabilitiesDesc: "配置模型支持的功能以优化 API 调用。",
    functionCallingSupport: "Function Calling 支持",
    functionCallingHint: "如果模型支持结构化函数/工具调用，请启用（如 GPT-4、Gemini 2.0+、DeepSeek V3）。",
    jsonModeSupport: "JSON Mode 支持",
    jsonModeHint: "如果模型支持强制 JSON 输出格式，请启用（如 GPT-4、Gemini 2.0+）。回退使用基于提示词的 JSON。",
    modelCapabilitiesTip: "现代模型请保持两项都启用（默认）。对于不支持工具调用的老旧模型或本地 LLM，请禁用 Function Calling。系统会自动降级到更简单的方法。",
    // Inpainting Tab
    inpaintingTab: "文字去除 (Inpainting)",
    inpaintingTabDesc: "配置 IOPaint 集成以进行文字擦除。",
    enableInpainting: "启用文字去除",
    enableInpaintingHint: "需要本地运行 IOPaint 服务。",
    inpaintingUrl: "API 地址",
    inpaintingModel: "模型名称",
    inpaintingModelHint: "默认为 `lama`。其他可用模型: `manga`, `mat`, `migan`。",
    // New Sidebar Localization
    textRemoval: "文字去除 (Inpaint)",
    inpaintArea: "擦除选中区域",
    restoreArea: "还原选中区域",
    inpaintDesc: "智能去除/还原红框内的文字。",
    // Clean Box Tool
    cleanBoxTitle: "选区清理",
    cleanBoxDesc: "定义选区属性并执行清理。",
    smartErase: "智能擦除 (AI)",
    enableInpaintHint: "请先在设置中开启 Inpainting 功能。",
    manualFill: "颜色填充",
    fillColor: "填充颜色",
    fillSelected: "填充选中框",
    fillSelectedHint: "仅填充当前选中的红框",
    inpaintSelected: "调用 API 擦除",
    inpaintSelectedHint: "仅擦除当前选中的紫框",
    batchOperations: "批量任务",
    applyToAll: "应用到所有图片",
    batchFillRed: "填充红框 (Fill)",
    batchFillRedHint: "跳过紫色框，仅填充红色普通框。",
    batchErasePurple: "擦除紫框 (Erase)",
    batchErasePurpleHint: "跳过红色框，仅发送紫色标记框给 AI。",
    restore: "还原区域",
    restoreHint: "恢复原始图片内容 (同时移除气泡遮罩)",
    goBoxCleaner: "前往选区清理",
    boxCleanerDesc: "切换到修补模式的选区工具来清理文字。",
    maskTypeLabel: "选区属性",
    maskTypeFill: "普通填充",
    maskTypeErase: "API 擦除",
    inpaintWorkshop: "修补工坊",
    copyOriginal: "复制原图",
    pasteResultHint: "点击聚焦后\nCtrl+V 粘贴",
    clearResult: "清除结果",
    applyResult: "应用到图片",
    // Workspace Layers
    layerOriginal: "原图",
    layerClean: "擦除后",
    layerFinal: "翻译后",
    deleteInpaint: "删除擦除层",
    // Paint Tool
    brushSize: "画笔大小",
    brushColor: "画笔颜色",
    brushSettings: "画笔设置",
    pickScreenColor: "吸取屏幕颜色",
    brushModePaint: "绘画模式 (Paint)",
    brushModeRestore: "还原模式 (Restore)",
    // Tooltips
    fontSizeTooltip: "字体大小",
    maskSizeTooltip: "遮罩大小",
    processPending: "处理待办项 (自动)",
    scanCurrent: "扫描当前文字",
    scanAll: "扫描全部文字",
    cleanCurrent: "擦除当前 (去除文字)",
    cleanAll: "擦除全部 (去除文字)",
    pickColor: "屏幕吸管",
    transparentColor: "透明 (无填充)",
    bringToFront: "置于顶层",
    moveUp: "上移一层",
    moveDown: "下移一层",
    sendToBack: "置于底层",
    clearAll: "清空列表",
    skippedRestore: "已跳过 API (点击恢复)",
    skipAPI: "跳过 API 处理",
    exportConfig: "导出配置",
    importConfig: "导入配置",
    exportConfigHint: "将所有设置导出为 JSON 文件，方便在其他浏览器中恢复。",
    importConfigHint: "从 JSON 文件导入设置，覆盖当前配置。",
    configExported: "配置已导出！",
    configImported: "配置导入成功！页面即将刷新。",
    configImportError: "导入失败：文件格式无效。",
    configBackupRestore: "配置备份与恢复",
    configBackupRestoreHint: "导出配置文件以备份，或从文件恢复配置。换浏览器时可用此功能迁移设置。",
    resetToDefaults: "恢复出厂设置",
    resetToDefaultsHint: "清除所有自定义设置，恢复到初始默认状态。此操作不可撤销。",
    resetToDefaultsConfirm: "确定要恢复出厂设置吗？所有自定义配置将被清除，页面将刷新。",
    resetToDefaultsBtn: "恢复出厂设置",
    copyPromptHint: "复制提示词 (用于外部 AI)",
    loadTemplateHint: "加载示例 JSON",
    helpDocs: {
      title: "使用指南",
      intro: "MangaType Live 是一个在浏览器中运行的漫画嵌字工具。它用 AI 自动识别漫画中的文字气泡，翻译内容，并将译文排版到原图上。支持批量处理整本漫画。",
      // Tab labels
      tabOverview: "快速上手",
      tabTranslate: "AI 翻译",
      tabMask: "选区与红框",
      tabCleanup: "文字擦除",
      tabEdit: "编辑气泡",
      tabExport: "导出",
      tabSettings: "设置说明",
      tabShortcuts: "快捷键",
      // Overview tab
      quickStart: [
        { title: "1. 导入图片", desc: "把图片或文件夹直接拖进窗口，或点击左侧「添加图片/文件夹」按钮。也可以用 Ctrl+V 粘贴剪贴板中的截图。" },
        { title: "2. AI 翻译", desc: "切换到 View 模式，点击「翻译当前」处理当前页，或「翻译所有」批量处理。AI 会自动识别气泡位置、翻译文字并排版。" },
        { title: "3. 编辑调整", desc: "点击画布上的气泡选中它，拖动移动位置，拖动 8 个控制点调整大小。右侧面板可以修改文字内容、字体、字号、颜色、排版方向等。" },
        { title: "4. 导出保存", desc: "底部工具栏点击图片图标保存当前页，或点击压缩包图标打包下载所有图片。" }
      ],
      layoutTitle: "界面布局",
      layoutDesc: "左侧是图库缩略图列表和工具栏，中间是画布工作区，右侧是选中气泡/选区的属性编辑面板。画布上方有三个图层切换按钮：「原图」「擦除后」「翻译后」。",
      // Translate tab
      translateSections: [
        {
          title: "基本翻译",
          desc: "在 View 模式下，底部工具栏会显示翻译按钮。",
          steps: [
            "「翻译当前」— 只翻译当前选中的图片",
            "「翻译所有」— 批量翻译图库中所有未处理的图片",
            "处理中可以随时点击「停止」按钮中断"
          ],
          tip: "如果配置了多个 API 端点，批量翻译时会自动轮询分配任务，提高速度。"
        },
        {
          title: "手动 JSON 导入",
          desc: "没有 API Key？可以用手动模式：点击工具栏的 JSON 按钮，复制提示词粘贴到任意 AI 对话中（ChatGPT、Claude 等），再把 AI 返回的 JSON 粘贴回来即可。",
          steps: [
            "点击 JSON 图标打开导入面板",
            "点击「复制提示词」，粘贴到外部 AI",
            "将 AI 返回的 JSON 粘贴到输入框",
            "点击「应用气泡」"
          ]
        },
        {
          title: "重置状态",
          desc: "点击翻译按钮旁边的刷新图标，可以重置所有图片的处理状态为「未处理」，方便重新翻译。"
        }
      ],
      // Mask tab
      maskSections: [
        {
          title: "什么是选区（红框）",
          desc: "选区是你手动画在图片上的矩形区域，用来告诉 AI「这里有文字」。切换到 Mask 工具后，在画布上拖拽即可绘制红框。红框可以拖动移动、拖动控制点调整大小。"
        },
        {
          title: "红框的三种用法",
          desc: "红框不只是标记，它有多种辅助 AI 的方式：",
          steps: [
            "作为提示 — 开启「使用红框作为提示」后，红框坐标会以文字形式告诉 AI 哪里有文字",
            "画在图上 — 开启「在图片上绘制红框」后，发给 AI 的图片上会直接画出红框标注",
            "遮罩模式 — 开启「遮罩发送模式」后，只把红框内的区域发给 AI，其余部分留白"
          ],
          tip: "三种方式可以组合使用。对于复杂排版的漫画，先画红框再翻译效果更好。"
        },
        {
          title: "对话框吸附",
          desc: "开启「对话框吸附」后，AI 生成的气泡会自动对齐到最近的红框中心。配合「强制匹配尺寸」可以让气泡完全继承红框的大小，实现精确定位。"
        },
        {
          title: "本地文字检测（扫描）",
          desc: "如果你运行了本地 Python 检测服务，切换到 Mask 工具后会出现「扫描当前/扫描全部」按钮。点击后会自动识别图片中的文字区域并生成红框，省去手动画框的工作。",
          tip: "需要在设置 > 检测与辅助中开启并配置检测 API 地址。"
        }
      ],
      // Cleanup tab
      cleanupSections: [
        {
          title: "图层系统",
          desc: "每张图片有三个图层：「原图」是上传的原始图片；「擦除后」是去掉原文后的干净背景；「翻译后」是最终效果（干净背景 + 译文气泡）。点击画布上方的按钮切换查看。"
        },
        {
          title: "颜色填充（红框）",
          desc: "选中一个红框后，右侧面板会出现「填充」选项。点击后用纯色覆盖该区域，适合背景简单的场景。填充是即时的，不需要调用 API。",
          steps: [
            "画一个红框覆盖要清理的文字",
            "在右侧面板选择填充颜色（默认白色）",
            "点击「填充选中框」"
          ]
        },
        {
          title: "AI 擦除（紫框）",
          desc: "将红框的属性切换为「API 擦除」后，它会变成紫色。紫框会调用 IOPaint API 进行智能擦除，效果更好但需要本地服务。",
          steps: [
            "在设置中开启 Inpainting 并配置 API 地址",
            "画一个选区，在右侧面板将属性改为「API 擦除」（变紫色）",
            "点击「调用 API 擦除」"
          ],
          tip: "可以批量操作：「填充红框」一键填充所有红框，「擦除紫框」一键擦除所有紫框。"
        },
        {
          title: "手动修补画笔",
          desc: "切换到「擦除后」图层后，工具栏会出现 Paint 工具。它有两个子模式：",
          steps: [
            "Freehand（手绘）— 用画笔直接在擦除后的图层上涂抹修补，支持吸管取色",
            "Box Tool（选区工具）— 在擦除后图层上画红框/紫框进行填充或擦除"
          ],
          tip: "手绘模式下还有「还原模式」，可以把误擦的区域恢复为原图内容。"
        },
        {
          title: "修补工坊",
          desc: "对于自动擦除效果不理想的区域，可以使用修补工坊：复制原图区域到外部工具（如 PS）处理后，再粘贴回来应用。在右侧面板选中一个选区后即可看到此功能。"
        }
      ],
      // Edit tab
      editSections: [
        {
          title: "选中与移动",
          desc: "在 View 或 Bubble 模式下，点击画布上的气泡即可选中。选中后可以直接拖动移动位置。双击画布空白处取消选中。"
        },
        {
          title: "调整大小",
          desc: "选中气泡后会出现 8 个控制点。拖动四角的控制点等比缩放，拖动四边的控制点单方向拉伸。"
        },
        {
          title: "右侧编辑面板",
          desc: "选中气泡后，右侧面板显示所有可编辑属性：",
          steps: [
            "文字内容 — 直接编辑翻译文本",
            "排版方向 — 横排或竖排",
            "字体 — 9 种中文字体可选（黑体、宋体、可爱体、毛笔等）",
            "字号 — 拖动滑块或用滚轮调整",
            "旋转 — 调整文字倾斜角度",
            "文字颜色与描边 — 支持预设组合和自定义颜色",
            "遮罩背景色 — 覆盖原文的底色，支持自动取色和吸管",
            "遮罩形状 — 直角、圆角、椭圆三种，可调圆角半径和羽化程度"
          ]
        },
        {
          title: "手动添加气泡",
          desc: "切换到 Bubble 工具后，可以点击「点击添加」按钮在画布中央创建一个新气泡，也可以直接在画布上拖拽绘制。"
        },
        {
          title: "AI 润色",
          desc: "选中气泡后，右侧面板有「戏剧化」「口语化」「翻译」三个 AI 按钮，可以对当前气泡的文字进行风格化处理。"
        },
        {
          title: "全局样式",
          desc: "底部工具栏的调色板图标可以打开全局样式面板，批量调整当前页所有气泡的字号大小、遮罩大小和字体。"
        },
        {
          title: "图层顺序",
          desc: "右侧面板底部有上移/下移/置顶/置底按钮，控制气泡的叠放顺序。"
        }
      ],
      // Export tab
      exportSections: [
        {
          title: "保存单张",
          desc: "底部工具栏的图片图标，将当前页面导出为 PNG 下载。导出时会自动将所有气泡和填充遮罩渲染到图片上。"
        },
        {
          title: "打包下载",
          desc: "底部工具栏的压缩包图标，将图库中所有图片打包为 ZIP 下载。会显示进度。"
        },
        {
          title: "合并图层",
          desc: "底部工具栏的合并图标（橙色），将当前页的所有气泡和遮罩永久烧录进图片像素中。合并后气泡消失，图片变成纯图片，无法再编辑气泡。",
          tip: "适用于：气泡太多导致卡顿时先合并一批；想在已有文字上叠加新效果；导出前确认定稿。"
        },
        {
          title: "跳过处理",
          desc: "在图库缩略图上右键可以标记「跳过 API 处理」。被跳过的图片不会被 AI 翻译，但仍会包含在 ZIP 导出中（保留原图）。"
        }
      ],
      // Settings tab
      settingsSections: [
        {
          title: "AI 端点配置",
          desc: "在设置 > 端点管理中添加 API 端点。支持 Gemini 和 OpenAI 兼容格式。可以添加多个端点，批量翻译时会自动轮询使用。每个端点可以单独设置模型、API Key 和能力标记（是否支持 Function Calling / JSON Mode）。"
        },
        {
          title: "检测与辅助",
          desc: "配置红框如何辅助 AI：「使用红框作为提示」「在图片上绘制红框」「遮罩发送模式」三个开关。还有「对话框吸附」和本地文字检测 API 的配置。"
        },
        {
          title: "文字去除 (Inpainting)",
          desc: "配置 IOPaint 服务地址和模型。需要在本地运行 IOPaint 服务（默认端口 8080）。支持 lama、manga、mat、migan 等模型。"
        },
        {
          title: "提示词编辑",
          desc: "可以自定义发送给 AI 的系统提示词，以及添加「请求前置消息」作为对话历史注入。"
        },
        {
          title: "AI 能力开关",
          desc: "在高级设置中可以开关：AI 选择字体、AI 选择颜色、AI 控制字号、AI 旋转角度。每个功能都有对应的提示词可以自定义。"
        },
        {
          title: "字号控制",
          desc: "两种模式：「档位模式」让 AI 从预设档位中选择（如 tiny/small/normal/large）；「直接模式」让 AI 输出具体的 rem 数值。档位可以自定义添加和调整。"
        },
        {
          title: "遮罩样式",
          desc: "设置全局默认的遮罩形状（直角/圆角/椭圆）、圆角半径和羽化程度。单个气泡可以在右侧面板覆盖这些默认值。"
        },
        {
          title: "备份与恢复",
          desc: "在通用设置中可以导出/导入配置文件（JSON），方便在不同浏览器间迁移设置。也可以一键恢复出厂设置。"
        }
      ],
      // Shortcuts tab
      shortcutGroups: [
        {
          title: "通用操作",
          items: [
            { key: "Ctrl+Z", desc: "撤销" },
            { key: "Ctrl+Y", desc: "重做" },
            { key: "Delete / Backspace", desc: "删除选中的气泡或选区" },
            { key: "← →", desc: "切换上一张/下一张图片" }
          ]
        },
        {
          title: "气泡编辑",
          items: [
            { key: "ctrl + 鼠标滚轮", desc: "选中气泡后，调整字号大小" },
            { key: "Alt + 鼠标滚轮", desc: "选中气泡后，调整遮罩大小" },
            { key: "双击空白处", desc: "取消选中" }
          ]
        },
        {
          title: "画笔工具",
          items: [
            { key: "Alt + 点击画布", desc: "吸取画布上的颜色" }
          ]
        }
      ]
    }
  },
  en: {
    appName: "MangaType Live",
    undo: "Undo",
    redo: "Redo",
    settings: "Settings",
    help: "Help",
    addFiles: "Add Files",
    addFolder: "Add Folder",
    gallery: "Gallery",
    current: "Current Image",
    processAll: "All Images",
    // New specific translation buttons
    translateCurrent: "Translate Current Image",
    translateAll: "Translate All Images",
    stop: "Stop",
    saveImage: "Save Image",
    zipAll: "ZIP All",
    noImageSelected: "No Image Selected",
    dragDrop: "Drag & Drop files, Paste image, or use the Sidebar.",
    properties: "Properties",
    deleteBubble: "Delete Bubble",
    content: "Content",
    enterText: "Enter text...",
    aiAssistant: "AI Assistant",
    aiThinking: "AI thinking...",
    dramatic: "Dramatic",
    casual: "Casual",
    translate: "Translate",
    maskGeometry: "Mask Geometry",
    width: "Width",
    height: "Height",
    whiteBg: "White Background",
    typography: "Typography",
    direction: "Direction",
    horizontal: "Horizontal",
    vertical: "Vertical",
    size: "Size",
    rotation: "Rotation",
    fontFamily: "Font Family",
    manualAdd: "Click Add",
    toolMode: "Tool Mode",
    toolBubble: "Bubble Tool (Mode 1)",
    toolMask: "Mask Tool (Mode 2)",
    toolBrush: "Paint Tool (Brush)",
    toolNone: "View Mode",
    translateRegions: "Translate Regions",
    translateRegionsDesc: "Draw red boxes to assist AI. Enable 'Mask Mode' in settings to send only boxed content.",
    importJson: "JSON",
    merge: "Merge",
    globalStyles: "Global Styles",
    concurrency: "Concurrency",
    noBubbleSelected: "No Bubble Selected",
    clickBubbleHint: "Click on a bubble in the canvas to edit its text and properties here.",
    aiSettings: "AI Settings",
    aiProvider: "AI Provider",
    baseUrl: "Base URL",
    apiKey: "API Key",
    modelSelection: "Model Selection",
    textDetection: "Local Text Detection",
    detectionExpansion: "Detection Expansion",
    detectionExpansionHint: "Inflate detected boxes by this ratio. Positive to expand, negative to shrink.",
    allowAiRotation: "Allow AI Rotation",
    allowAiRotationHint: "Attempt to detect text rotation angle (Experimental).",
    allowAiFontSelection: "Allow AI Font Selection",
    allowAiFontSelectionHint: "If enabled, AI will choose fonts (Wild/Brush etc.) based on tone. If disabled, defaults to Noto.",
    fontSelectionPrompt: "Font Selection Prompt",
    fontSelectionPromptHint: "Guide AI to choose appropriate fonts based on context. Do not modify font IDs.",
    allowAiColorSelection: "Allow AI Color Selection",
    allowAiColorSelectionHint: "If enabled, AI will choose text and stroke colors based on scene. If disabled, defaults to black text with white stroke.",
    colorSelectionPrompt: "Color Selection Prompt",
    colorSelectionPromptHint: "Guide AI to choose appropriate color combinations based on scene. Do not modify color code format.",
    detectionTab: "Detection & Masks",
    detectionTabDesc: "Configure masks, local detection, and snapping.",
    enableMaskedImageMode: "Masked Image Mode",
    enableMaskedImageModeHint: "If red boxes exist, send ONLY the boxed content to AI (rest is whitened out).",
    useMasksAsHints: "Use Masks as Hints",
    useMasksAsHintsHint: "Send coordinates of red boxes as text hints to AI.",
    drawMasksOnImage: "Draw Masks on Image",
    drawMasksOnImageHint: "When enabled, red boxes are drawn onto the image sent to AI, so it can visually see the marked regions.",
    appendMasksToManualJson: "Append to Manual JSON",
    appendMasksToManualJsonHint: "When enabled, append all red box coordinates of the current image to the manual JSON import prompt.",
    autoDetectBackground: "Auto Detect Background Color",
    autoDetectBackgroundHint: "Automatically sample the bubble edge color when moving or resizing (Defaults to white if off).",
    enableDialogSnap: "Dialog Snapping",
    enableDialogSnapHint: "Automatically snap AI-generated bubble centers to the nearest manual red box center.",
    forceSnapSize: "Force Match Size",
    forceSnapSizeHint: "When snapping, force the bubble to use the red box's dimensions completely.",
    defaultFontSize: "Default Font Size",
    fontSizeTab: "Font Size",
    fontSizeTabDesc: "Configure how AI determines font size for each bubble.",
    allowAiFontSize: "Allow AI Font Size",
    allowAiFontSizeHint: "If enabled, AI adjusts font size based on content and tone. If disabled, uses default size.",
    fontSizeScaleMode: "Scale Mode",
    fontSizeDirectMode: "Direct Mode",
    fontSizeScaleEntries: "Scale Entries",
    fontSizeAddScale: "Add Scale",
    fontSizeScalePrompt: "Scale Mode Prompt",
    fontSizeScalePromptHint: "Guide AI on how to choose font size scales. Scale list is auto-appended.",
    fontSizeDirectPrompt: "Font Size Prompt",
    fontSizeDirectPromptHint: "Guide AI to choose appropriate font size values.",
    fontSizeFallback: "Default / Fallback Size",
    fontSizeFallbackHint: "Used when AI does not output a font size.",
    systemPrompt: "System Prompt",
    cancel: "Cancel",
    saveSettings: "Save Settings",
    manualJsonImport: "Manual JSON Import",
    pasteJson: "Paste AI JSON output here...",
    copyPrompt: "Copy AI Prompt",
    loadTemplate: "Load Draft Template",
    applyBubbles: "Apply Bubbles",
    envConfigured: "Environment Configured",
    refreshModels: "Refresh Models",
    fetching: "Fetching...",
    noModels: "No models found",
    failedFetch: "Failed to fetch",
    promptCopied: "Prompt copied!",
    jsonError: "Invalid JSON format",
    processing: "Processing",
    done: "Done",
    error: "Error",
    language: "Language / 语言",
    sure: "Sure?",
    galleryTitle: "Gallery",
    generatedHtml: "Generated HTML",
    close: "Close",
    copyHtml: "Copy HTML",
    baseUrlHint: "Format like https://api.provider.com or https://api.provider.com/v1 both work.",
    modelFilterHint: "Partial text filters list. Empty or exact match shows all.",
    preRequestMessages: "Pre-request Messages",
    preRequestHint: "Messages inserted before the main image request.",
    role: "Role",
    msgContent: "Content",
    addMessage: "Add Message",
    translateMenu: "AI Translate",
    autoDetect: "Auto Detect",
    maskScan: "Mask Scan",
    maskStyle: "Mask Style",
    shape: "Shape",
    shapeRect: "Rect",
    shapeRound: "Round",
    shapeEllipse: "Ellipse",
    cornerRadius: "Corner Radius",
    feathering: "Feathering",
    resetStatus: "Reset Status",
    // Model Capabilities
    modelCapabilities: "Model Capabilities",
    modelCapabilitiesDesc: "Configure what features your model supports to optimize API calls.",
    functionCallingSupport: "Function Calling Support",
    functionCallingHint: "Enable if your model supports structured function/tool calling (e.g., GPT-4, Gemini 2.0+, DeepSeek V3).",
    jsonModeSupport: "JSON Mode Support",
    jsonModeHint: "Enable if your model supports forced JSON output format (e.g., GPT-4, Gemini 2.0+). Fallback uses prompt-based JSON.",
    modelCapabilitiesTip: "Leave both enabled (default) for modern models. Disable Function Calling for older models or local LLMs that don't support tools. The system will automatically fall back to simpler methods.",
    // Inpainting Tab
    inpaintingTab: "Text Removal (Inpainting)",
    inpaintingTabDesc: "Configure IOPaint integration for text cleaning.",
    enableInpainting: "Enable Inpainting",
    enableInpaintingHint: "Requires local IOPaint service.",
    inpaintingUrl: "API URL",
    inpaintingModel: "Model Name",
    inpaintingModelHint: "Default is `lama`. Others: `manga`, `mat`, `migan`.",
    // New Sidebar Localization
    textRemoval: "Text Removal (Inpaint)",
    inpaintArea: "Inpaint Selected Area",
    restoreArea: "Restore Selected Area",
    inpaintDesc: "Uses local IOPaint API to remove text, or restore original pixels.",
    // Clean Box Tool
    cleanBoxTitle: "Clean Box Tool",
    cleanBoxDesc: "Define mask properties and perform cleaning.",
    smartErase: "Smart Erase (AI)",
    enableInpaintHint: "Please enable Inpainting in Settings first.",
    manualFill: "Color Fill",
    fillColor: "Fill Color",
    fillSelected: "Fill Selected Box",
    fillSelectedHint: "Only fill the current Red box",
    inpaintSelected: "API Erase Box",
    inpaintSelectedHint: "Only erase the current Purple box",
    batchOperations: "Batch Tasks",
    applyToAll: "Apply to All Images",
    batchFillRed: "Fill Red Boxes",
    batchFillRedHint: "Skip purple boxes, fill only red manual boxes.",
    batchErasePurple: "Erase Purple Boxes",
    batchErasePurpleHint: "Skip red boxes, send only purple markers to AI.",
    restore: "Restore Region",
    restoreHint: "Revert to original pixels",
    goBoxCleaner: "Go to Box Cleaner",
    boxCleanerDesc: "Switch to Paint Mode Box Tool to clean text.",
    maskTypeLabel: "Mask Attribute",
    maskTypeFill: "Manual Fill",
    maskTypeErase: "API Erase",
    inpaintWorkshop: "Inpaint Workshop",
    copyOriginal: "Copy Original",
    pasteResultHint: "Click to focus\nCtrl+V to paste",
    clearResult: "Clear Result",
    applyResult: "Apply to Image",
    // Workspace Layers
    layerOriginal: "Original",
    layerClean: "Clean",
    layerFinal: "Translated",
    deleteInpaint: "Delete Inpaint Layer",
    // Paint Tool
    brushSize: "Brush Size",
    brushColor: "Brush Color",
    brushSettings: "Brush Settings",
    pickScreenColor: "Pick Screen Color",
    brushModePaint: "Paint Mode",
    brushModeRestore: "Restore Mode",
    // Tooltips
    fontSizeTooltip: "Font Size",
    maskSizeTooltip: "Mask Size",
    processPending: "Process Pending (Auto)",
    scanCurrent: "Scan Current (Local Detect)",
    scanAll: "Scan All (Local Detect)",
    cleanCurrent: "Clean Current (Inpaint)",
    cleanAll: "Clean All (Inpaint)",
    pickColor: "Pick color from screen",
    transparentColor: "Transparent (No Fill)",
    bringToFront: "Bring to Front",
    moveUp: "Move Up",
    moveDown: "Move Down",
    sendToBack: "Send to Back",
    clearAll: "Clear All",
    skippedRestore: "Skipped API (Click to Restore)",
    skipAPI: "Skip API Processing",
    exportConfig: "Export Config",
    importConfig: "Import Config",
    exportConfigHint: "Export all settings to a JSON file for backup or migration.",
    importConfigHint: "Import settings from a JSON file, replacing current config.",
    configExported: "Config exported!",
    configImported: "Config imported! Page will reload.",
    configImportError: "Import failed: invalid file format.",
    configBackupRestore: "Backup & Restore",
    configBackupRestoreHint: "Export your config to back it up, or import a file to restore. Useful when switching browsers.",
    resetToDefaults: "Reset to Factory Defaults",
    resetToDefaultsHint: "Clear all custom settings and restore to initial defaults. This action cannot be undone.",
    resetToDefaultsConfirm: "Are you sure you want to reset all settings to factory defaults? All custom config will be lost and the page will reload.",
    resetToDefaultsBtn: "Reset to Defaults",
    copyPromptHint: "Copy prompt for external AI",
    loadTemplateHint: "Load sample JSON",
    helpDocs: {
      title: "User Guide",
      intro: "MangaType Live is a browser-based manga typesetting tool. It uses AI vision models to automatically detect speech bubbles, translate text, and typeset the result onto the original image. Supports batch processing entire volumes.",
      tabOverview: "Quick Start",
      tabTranslate: "AI Translation",
      tabMask: "Masks & Boxes",
      tabCleanup: "Text Cleanup",
      tabEdit: "Editing",
      tabExport: "Export",
      tabSettings: "Settings",
      tabShortcuts: "Shortcuts",
      quickStart: [
        { title: "1. Import Images", desc: "Drag images or folders into the window, or click 'Add Files / Add Folder' in the left sidebar. You can also paste screenshots with Ctrl+V." },
        { title: "2. AI Translate", desc: "Switch to View mode. Click 'Translate Current' for the active page, or 'Translate All' for batch processing. The AI will detect bubbles, translate text, and typeset automatically." },
        { title: "3. Edit & Adjust", desc: "Click a bubble on the canvas to select it. Drag to move, drag the 8 control handles to resize. The right panel lets you edit text, font, size, color, direction, and mask style." },
        { title: "4. Export", desc: "Use the image icon in the bottom toolbar to save the current page, or the archive icon to download all images as a ZIP." }
      ],
      layoutTitle: "Interface Layout",
      layoutDesc: "Left side: image gallery thumbnails and toolbar. Center: canvas workspace. Right side: property editor for the selected bubble or mask. Above the canvas are three layer tabs: Original, Clean, and Translated.",
      translateSections: [
        {
          title: "Basic Translation",
          desc: "In View mode, the bottom toolbar shows translation buttons.",
          steps: [
            "'Translate Current' — translate only the active image",
            "'Translate All' — batch translate all unprocessed images in the gallery",
            "You can click 'Stop' at any time to abort"
          ],
          tip: "If you have multiple API endpoints configured, batch translation will automatically round-robin tasks across them for faster processing."
        },
        {
          title: "Manual JSON Import",
          desc: "No API key? Use manual mode: click the JSON button in the toolbar, copy the prompt into any AI chat (ChatGPT, Claude, etc.), then paste the AI's JSON response back.",
          steps: [
            "Click the JSON icon to open the import panel",
            "Click 'Copy AI Prompt' and paste it into an external AI",
            "Paste the AI's JSON response into the input box",
            "Click 'Apply Bubbles'"
          ]
        },
        {
          title: "Reset Status",
          desc: "Click the refresh icon next to the translate buttons to reset all images back to 'unprocessed' status, allowing you to re-translate them."
        }
      ],
      maskSections: [
        {
          title: "What Are Masks (Red Boxes)",
          desc: "Masks are rectangular regions you draw on the image to tell the AI 'there is text here'. Switch to the Mask tool and drag on the canvas to draw a red box. Boxes can be moved and resized with control handles."
        },
        {
          title: "Three Ways to Use Red Boxes",
          desc: "Red boxes aren't just markers — they help the AI in multiple ways:",
          steps: [
            "As hints — Enable 'Use Masks as Hints' to send box coordinates as text hints to the AI",
            "Drawn on image — Enable 'Draw Masks on Image' to visually annotate the image sent to AI",
            "Masked mode — Enable 'Masked Image Mode' to send only the boxed regions to AI (rest is whitened out)"
          ],
          tip: "These can be combined. For manga with complex layouts, drawing boxes before translating gives better results."
        },
        {
          title: "Dialog Snapping",
          desc: "Enable 'Dialog Snapping' to automatically align AI-generated bubbles to the nearest red box center. Combined with 'Force Match Size', bubbles will fully inherit the box dimensions for precise positioning."
        },
        {
          title: "Local Text Detection (Scan)",
          desc: "If you're running the local Python detection service, switching to the Mask tool reveals 'Scan Current / Scan All' buttons. This auto-detects text regions and generates red boxes, saving you from drawing them manually.",
          tip: "Requires enabling and configuring the detection API URL in Settings > Detection & Masks."
        }
      ],
      cleanupSections: [
        {
          title: "Layer System",
          desc: "Each image has three layers: 'Original' is the uploaded image; 'Clean' is the background with original text removed; 'Translated' is the final result (clean background + translated bubbles). Switch between them using the tabs above the canvas."
        },
        {
          title: "Color Fill (Red Boxes)",
          desc: "Select a red box and the right panel shows a 'Fill' option. This covers the region with a solid color — great for simple backgrounds. Filling is instant and doesn't require any API.",
          steps: [
            "Draw a red box over the text to clean",
            "Choose a fill color in the right panel (default: white)",
            "Click 'Fill Selected Box'"
          ]
        },
        {
          title: "AI Erase (Purple Boxes)",
          desc: "Switch a red box's attribute to 'API Erase' and it turns purple. Purple boxes use the IOPaint API for intelligent removal — better quality but requires a local service.",
          steps: [
            "Enable Inpainting in Settings and configure the API URL",
            "Draw a box, then change its attribute to 'API Erase' in the right panel (turns purple)",
            "Click 'API Erase Box'"
          ],
          tip: "Batch operations available: 'Fill Red Boxes' fills all red boxes at once, 'Erase Purple Boxes' sends all purple boxes to the API."
        },
        {
          title: "Manual Paint Brush",
          desc: "Switch to the 'Clean' layer and the toolbar shows the Paint tool. It has two sub-modes:",
          steps: [
            "Freehand — paint directly on the clean layer to fix artifacts, with eyedropper color picking",
            "Box Tool — draw red/purple boxes on the clean layer for filling or erasing"
          ],
          tip: "Freehand mode also has a 'Restore' brush that reverts painted areas back to the original image content."
        },
        {
          title: "Inpaint Workshop",
          desc: "For areas where auto-erase isn't perfect, use the Inpaint Workshop: copy the original region to an external tool (e.g., Photoshop), fix it, then paste the result back. Available in the right panel when a mask is selected."
        }
      ],
      editSections: [
        {
          title: "Select & Move",
          desc: "In View or Bubble mode, click a bubble on the canvas to select it. Drag to reposition. Double-click empty space to deselect."
        },
        {
          title: "Resize",
          desc: "Selected bubbles show 8 control handles. Drag corners for proportional scaling, drag edges for single-axis stretching."
        },
        {
          title: "Right Panel Editor",
          desc: "When a bubble is selected, the right panel shows all editable properties:",
          steps: [
            "Text content — edit the translated text directly",
            "Direction — horizontal or vertical layout",
            "Font — 9 Chinese fonts available (Gothic, Serif, Cute, Brush, etc.)",
            "Font size — drag the slider or use mouse wheel",
            "Rotation — adjust text angle",
            "Text color & stroke — preset combos and custom colors",
            "Mask background — color behind text, supports auto-detect and eyedropper",
            "Mask shape — rectangle, rounded, or ellipse, with adjustable corner radius and feathering"
          ]
        },
        {
          title: "Add Bubbles Manually",
          desc: "Switch to the Bubble tool, then click 'Click Add' to create a new bubble at the center, or drag on the canvas to draw one."
        },
        {
          title: "AI Polish",
          desc: "With a bubble selected, the right panel has 'Dramatic', 'Casual', and 'Translate' AI buttons to restyle the current bubble's text."
        },
        {
          title: "Global Styles",
          desc: "The palette icon in the bottom toolbar opens the global styles panel, letting you batch-adjust font size, mask size, and font family for all bubbles on the current page."
        },
        {
          title: "Layer Order",
          desc: "The bottom of the right panel has move up/down/top/bottom buttons to control bubble stacking order."
        }
      ],
      exportSections: [
        {
          title: "Save Single Image",
          desc: "The image icon in the bottom toolbar exports the current page as a PNG download. All bubbles and filled masks are rendered onto the image."
        },
        {
          title: "Download All as ZIP",
          desc: "The archive icon in the bottom toolbar packages all images into a ZIP download. Progress is shown during generation."
        },
        {
          title: "Merge Layers",
          desc: "The orange merge icon in the bottom toolbar permanently burns all bubbles and masks into the image pixels. After merging, bubbles disappear and the image becomes a flat picture — bubbles can no longer be edited.",
          tip: "Useful when: too many bubbles cause lag; you want to overlay new effects on existing text; finalizing before export."
        },
        {
          title: "Skip Processing",
          desc: "Right-click a gallery thumbnail to mark it as 'Skip API Processing'. Skipped images won't be AI-translated but will still be included in ZIP exports (preserving the original)."
        }
      ],
      settingsSections: [
        {
          title: "API Endpoint Configuration",
          desc: "In Settings > Endpoints, add API endpoints. Supports Gemini and OpenAI-compatible formats. You can add multiple endpoints — batch translation will automatically round-robin across them. Each endpoint has its own model, API key, and capability flags (Function Calling / JSON Mode support)."
        },
        {
          title: "Detection & Masks",
          desc: "Configure how red boxes assist the AI: 'Use Masks as Hints', 'Draw Masks on Image', and 'Masked Image Mode' toggles. Also includes 'Dialog Snapping' and local text detection API configuration."
        },
        {
          title: "Text Removal (Inpainting)",
          desc: "Configure the IOPaint service URL and model. Requires running IOPaint locally (default port 8080). Supports lama, manga, mat, migan models."
        },
        {
          title: "Prompt Editor",
          desc: "Customize the system prompt sent to the AI, and add 'Pre-request Messages' injected as conversation history before the main request."
        },
        {
          title: "AI Capability Toggles",
          desc: "In Advanced settings, toggle: AI font selection, AI color selection, AI font size control, AI rotation detection. Each feature has a customizable prompt."
        },
        {
          title: "Font Size Control",
          desc: "Two modes: 'Scale Mode' lets AI choose from preset tiers (tiny/small/normal/large); 'Direct Mode' lets AI output exact rem values. Scale tiers can be customized."
        },
        {
          title: "Mask Style",
          desc: "Set global defaults for mask shape (rectangle/rounded/ellipse), corner radius, and feathering. Individual bubbles can override these in the right panel."
        },
        {
          title: "Backup & Restore",
          desc: "In General settings, export/import config files (JSON) for migrating settings between browsers. Factory reset is also available."
        }
      ],
      shortcutGroups: [
        {
          title: "General",
          items: [
            { key: "Ctrl+Z", desc: "Undo" },
            { key: "Ctrl+Y", desc: "Redo" },
            { key: "Delete / Backspace", desc: "Delete selected bubble or mask" },
            { key: "← →", desc: "Previous / next image" }
          ]
        },
        {
          title: "Bubble Editing",
          items: [
            { key: "Mouse Wheel", desc: "Adjust font size (with bubble selected)" },
            { key: "Alt + Mouse Wheel", desc: "Adjust mask size (with bubble selected)" },
            { key: "Double-click empty area", desc: "Deselect" }
          ]
        },
        {
          title: "Paint Tool",
          items: [
            { key: "Alt + Click canvas", desc: "Pick color from canvas" }
          ]
        }
      ]
    }
  }
};

export type Language = 'zh' | 'en';
export type TranslationKey = keyof typeof translations.zh;

export const t = (key: string, lang: Language): string => {
  const keys = key.split('.');
  let value: any = translations[lang];
  for (const k of keys) {
    value = value?.[k];
  }
  return typeof value === 'string' ? value : key;
};

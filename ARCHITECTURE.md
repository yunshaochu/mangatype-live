# MangaType Live - Project Blueprint & Specification

**MangaType Live** 是一个无构建步骤 (No-Build)、基于 ES Modules 的 Web 原生漫画嵌字工具。
本文档不仅是使用说明，更是**项目复刻蓝图**。任何开发者应能根据本文档完全重构本项目的所有功能。

---

## 1. 核心架构与环境 (Architecture)

### 运行环境

*   **模式**: 纯前端 (Client-side Only), 无需 Node.js 后端，无需 Webpack/Vite 打包。
*   **模块化**: 使用 ES Modules (`<script type="module">`) 和 Import Maps。
*   **样式**: Tailwind CSS (CDN Runtime) + Google Fonts。

### 依赖库 (Import Map)

使用以下精确版本或兼容版本：

```json
{
  "imports": {
    "lucide-react": "https://esm.sh/lucide-react@^0.563.0",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "@google/genai": "https://esm.sh/@google/genai@^1.38.0",
    "react/": "https://esm.sh/react@^19.2.3/",
    "react": "https://esm.sh/react@^19.2.3"
  }
}
```

### 字体资源

在 `<head>` 预加载以下字体以实现漫画效果：

1.  **Noto Sans SC** (标准黑体)
2.  **Zhi Mang Xing** (草书/拟声词)
3.  **Ma Shan Zheng** (毛笔楷体)

---

## 2. 数据模型 (Data Models)

这是应用的核心状态定义 (`types.ts`)。复刻时严格遵守此结构。

### 气泡对象 (Bubble)

这是画布上的核心原子单位。

*   **坐标系**: 所有坐标 (`x`, `y`) 和尺寸 (`width`, `height`) 均为相对于图片尺寸的**百分比 (0-100)**。这确保了响应式缩放。
*   **渲染逻辑**: 使用 `transform: translate(-50%, -50%)` 基于中心点定位。

```typescript
interface Bubble {
  id: string;          // UUID
  x: number;           // Center X (0-100%)
  y: number;           // Center Y (0-100%)
  width: number;       // Width (0-100%)
  height: number;      // Height (0-100%)
  text: string;        // 气泡内容
  isVertical: boolean; // true = vertical-rl (竖排), false = horizontal-tb
  fontFamily: 'noto' | 'zhimang' | 'mashan';
  fontSize: number;    // CSS rem 单位
  color: string;       // 字体颜色 (Hex)
  backgroundColor: string; // 遮罩颜色 (Hex 或 'transparent')
  rotation: number;    // 旋转角度 (degrees)
}
```

### 全局状态 (State)

*   **`image`**: 包含 `url` (Blob URL), `base64` (用于 AI 分析), `width`, `height`, `aspectRatio`.
*   **`bubbles`**: `Bubble[]` 数组。
*   **`selectedId`**: 当前选中的气泡 ID。
*   **`aiConfig`**: AI 配置 (Provider, API Key, Model, System Prompt, Default Font Size).

---

## 3. 核心功能规范 (Functional Specs)

### 3.1 画布交互 (Canvas Interaction)

*   **添加气泡**: 点击图片任意空白处 -> 计算点击位置百分比 -> 创建新气泡 -> 设为选中状态。
*   **拖拽移动**:
    1.  `MouseDown` (气泡): 记录初始鼠标位置和气泡初始位置。
    2.  `MouseMove` (Window): 计算鼠标位移量 (像素) -> 转换为百分比增量 -> 更新气泡 `x, y`。
    3.  `MouseUp` (Window): 清除拖拽状态。
*   **选中/取消**: 点击气泡选中；点击画布空白处或按下 ESC 取消选中。

### 3.2 AI 智能识别 (Service Layer)

位置: `services/geminiService.ts`
逻辑: 采用 **三级降级策略 (3-Tier Fallback Strategy)** 以确保最大成功率。

1.  **Tier 1: Function Calling**
    *   定义 `create_bubbles_for_comic` 工具。
    *   配置 `functionCallingConfig: { mode: 'ANY' }`。
    *   优点: 结构最稳定，直接返回对象数组。
2.  **Tier 2: JSON Mode**
    *   设置 `responseMimeType: "application/json"`。
    *   Prompt 中强制要求 JSON 结构。
    *   解析: 使用 `JSON.parse`。
3.  **Tier 3: 纯文本提取 (Raw Text / Dumb Luck)**
    *   当上述失败时，让 AI 输出纯文本 JSON。
    *   解析: 使用正则提取 Markdown 代码块 (` ```json ... ``` `) 或寻找首尾 `{}` 进行截取解析。

### 3.3 气泡编辑器 (Bubble Editor)

当选中气泡时显示的侧边栏组件。包含：

*   **文本编辑**: `textarea` (自动换行)。
*   **AI 润色**: 三个按钮调用 `polishDialogue` 服务。
    *   *Dramatic*: 增加张力。
    *   *Casual*: 口语化。
    *   *Translate*: 翻回英文。
*   **尺寸滑块**: `width` 和 `height` (5% - 50%)。
*   **白底遮罩开关**: 切换 `backgroundColor` 在 `#ffffff` 和 `transparent` 之间。
*   **排版控制**: 横/竖排切换按钮，字体大小滑块，旋转滑块。
*   **字体选择**: 列表展示三种预设字体的预览效果。

### 3.4 手动 JSON 导入 (Manual JSON)

允许用户从外部 LLM (ChatGPT/Claude) 复制结果。

*   提供 "Copy Prompt" 按钮 (复制下文的 Prompt)。
*   输入框支持粘贴包含 Markdown 标记的 JSON。
*   解析逻辑能处理 ` ```json ` 包裹的内容。

### 3.5 导出 HTML

生成的 HTML 代码是**自包含**的：

*   外层 `div` 使用 `position: relative` 和 `inline-block`。
*   气泡 `div` 使用 `position: absolute`。
*   样式全部内联 (Inline Styles)，确保复制到任何博客/网页都能保持原样。

---

## 4. 关键提示词 (Prompts Engineering)

为了复刻本项目的 AI 效果，使用以下精确的提示词。

### System Prompt (自动识别)

用于 `detectAndTypesetComic` 函数：

```text
You are an expert Manga Typesetter and Translator. 
1. Look at this manga page.
2. Identify every speech bubble.
3. Read the text inside.
4. Translate the text to Chinese (Simplified). Use a natural, comic-book style.
5. Determine the bounding box (x, y, width, height in %) to effectively MASK (cover) the original text.
6. Return the data as a list of bubbles.

Important Constraints:
- 'x' and 'y' are the center coordinates (0-100).
- 'width' and 'height' should be large enough to hide the original text but fit inside the bubble.
- If the bubble is vertical (standard for most manga), set isVertical to true.
- Use REAL newline characters (Enter key) for line breaks. 
- CRITICAL: Do NOT output literal "\n" strings. Do NOT use the letter "n" as a separator.
- If the translation is long, use real line breaks to ensure it fits the vertical orientation.
```

### Manual Export Prompt (手动模式)

用于 `ManualJsonModal` 组件，供用户复制：

```text
你是一个专业的漫画嵌字和翻译专家。请分析这张图片，执行以下步骤：

1. **识别气泡**：找出图片中所有的对话气泡。
2. **翻译内容**：读取气泡内的文字，并将其翻译成自然流畅的**简体中文**。
3. **计算遮罩坐标**：计算一个矩形框来覆盖原始文字。
   - `x` 和 `y` 是气泡的**中心点**坐标（0-100%）。
   - `width` 和 `height` 是相对于图片总宽高的百分比（0-100%）。
   - 确保框足够大以覆盖原文，但不要超出气泡边界。
4. **判断排版**：如果气泡是竖排文字（漫画通常如此），`isVertical` 设为 true。

**请务必只输出以下格式的 JSON 代码，不要包含markdown标记或其他废话：**

{
  "bubbles": [
    {
      "text": "这里是翻译后的中文内容...",
      "x": 50,
      "y": 45,
      "width": 15,
      "height": 20,
      "isVertical": true
    }
  ]
}
```

### Text Polishing Prompts (润色)

*   **Dramatic**: `Rewrite the following comic book dialogue to be more dramatic: "{text}"`
*   **Casual**: `Rewrite the following comic book dialogue to be casual: "{text}"`
*   **English**: `Translate to natural graphic novel English: "{text}"`

---

## 5. UI/UX 细节规范

*   **布局**: 左侧侧边栏 (w-80, 固定, overflow-auto)，右侧主画布区域 (flex-1, 居中, bg-gray-900)。
*   **文件上传**: 
    *   使用隐藏的 `<input type="file" />` 元素，并通过 `ref` 触发点击。
    *   **关键修复**: 该 Input 始终渲染在 DOM 中 (不能被条件渲染)，否则在图片加载后“Change Image”按钮会失效。
*   **字体类名映射**:
    *   'noto' -> `'Noto Sans SC', sans-serif`
    *   'zhimang' -> `'Zhi Mang Xing', cursive`
    *   'mashan' -> `'Ma Shan Zheng', cursive`
*   **加载状态**: 自动嵌字时，按钮应显示 Loading Spinner (`Loader2`) 并禁用点击。

---

## 6. API 集成细节

### Google Gemini SDK

*   **Import**: `import { GoogleGenAI } from "@google/genai";`
*   **Initialization**: `const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });`
*   **Image Handling**: Must convert Blob to Base64 strictly (remove `data:image/...;base64,` prefix) before sending to `inlineData`.

### OpenAI Compatibility

*   **Endpoint**: `${baseUrl}/chat/completions`
*   **Payload**: `{ model, messages: [...], tools: [...], response_format: { type: "json_object" } }`
*   **Vision**: Pass image as `image_url` within the user message content array.

---

## 7. 核心视觉算法：椭圆羽化遮罩 (Technical Detail: Elliptical Feathered Mask)

这是本项目最核心的 UI 技巧，用于实现“无缝覆盖原图文字”的效果。

### 挑战
漫画气泡通常是非规则椭圆。如果使用简单的矩形白色背景，会覆盖气泡的边缘线，显得非常生硬。

### 解决方案
我们通过 CSS 的组合拳实现了一个**动态比例的椭圆羽化遮罩**：

1.  **椭圆形状实现**:
    通过 `border-radius: 50%`。因为容器的 `width` 和 `height` 是根据气泡内容动态调整的百分比值，设置 50% 的圆角会自动根据宽高比生成对应的**正圆或椭圆**。

2.  **“越往外越淡”的羽化效果**:
    关键不在于 `blur` 滤镜（滤镜会使内部文字也变模糊），而在于 **`box-shadow` (外阴影)**。
    我们给背景色为白色的椭圆添加了一个**扩散半径很大但偏移为 0** 的白色阴影：
    ```css
    background-color: #ffffff;
    box-shadow: 0 0 10px 5px #ffffff;
    ```
    *   `0 0`: 阴影不偏移，正对着椭圆中心。
    *   `10px`: 模糊半径 (Blur radius)，负责“由实向虚”的过渡。
    *   `5px`: 扩展半径 (Spread radius)，负责向外延展覆盖范围，确保彻底盖住原字。

3.  **图层叠加顺序**:
    *   **底层**: 椭圆背景 + 阴影（负责遮盖原图文字）。
    *   **顶层**: 文本内容（保持绝对清晰，不参与模糊）。

---

## 8. 技术填坑：SVG ForeignObject 竖排文字渲染修复 (Vertical Text Hack)

在将 HTML 转换为 Canvas/Image 时，我们利用了 `<svg><foreignObject>` 技术。但是，Chrome/Webkit 引擎在 `foreignObject` 中处理 `writing-mode: vertical-rl`（竖排）配合 Flexbox 居中时存在严重 Bug，通常会导致**第一行文字（即最右侧那行）**出现异常的缩进或位移。

### 问题现象
竖排文字的 Flex 容器在 Canvas 渲染中，首行前会被强行插入大量空白，或者整体偏离中心。

### 解决方案：牺牲行 + 几何补偿 (Sacrificial Line + Geometric Shift)

我们采用了一种“曲线救国”的 Hack 方案，只在生成导出图像时应用：

1.  **牺牲行 (The Sacrificial Line)**:
    在竖排文本的最前面（即逻辑上的第一行，视觉上的最右侧）强行插入一个换行符 `\n`。
    ```javascript
    const renderText = b.isVertical ? `\n${safeText}` : safeText;
    ```
    *原理*: Canvas 渲染引擎的 Bug 会“吃掉”这第一行（空行）的布局正确性，从而保护真正的文字内容不受影响。

2.  **几何修正 (Geometric Correction)**:
    插入空行后，Flex 容器的宽度变宽了（增加了一行的高度，约 `1.5em`），导致居中逻辑让真正的文字整体**向左偏移**。
    为了修正视觉中心，我们需要将整个容器**向右平移**半个行宽。
    ```css
    /* 假设 line-height 为 1.5 */
    /* 空行宽度 = 1.5em */
    /* 需要右移补偿 = 1.5em / 2 = 0.75em */
    transform: translateX(0.75em);
    ```

3.  **结果**:
    *   Bug 作用在了看不见的空行上。
    *   `translateX` 把看不见的空行踢出了气泡的视觉中心区域。
    *   真正的文字完美居中显示。

---

遵循以上规范，即可完美复刻 MangaType Live。
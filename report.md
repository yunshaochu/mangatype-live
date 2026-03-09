# 单图 AI 原始 JSON 查看功能调研报告

> 日期：2026-03-10  
> 目标：评估“用户查看单张图片的 AI 回复原始 JSON（格式化后）”是否值得做、应该摆放在哪里、以及实现上最合适的落点。

## 1. 结论先行

- 这个功能值得加，而且和项目当前的“手动 JSON 导入”能力是同一条认知链上的自然补全。
- 最合适的产品落点不是缩略图，也不是 `BubbleEditor`，而是“当前图片级”的信息区域。
- 最推荐的交互是：
  - 右侧栏在“当前有图片、但没有选中 bubble / mask”时，显示一个图片级信息面板。
  - 面板内提供 `查看 AI 原始 JSON` 按钮。
  - 点击后用独立 modal 展示格式化 JSON，附带复制按钮；不要把长 JSON 直接塞进 320px 的侧栏。
- 数据层面不建议把“整份 provider 原始 HTTP 响应”直接持久化到 `ImageState`。
  - 第一阶段应该保存“最终被解析/应用的 bubbles payload”及少量元信息。
  - 更推荐放在 `ProjectContext` 的单独 runtime map 中，而不是放进 `ImageState`，这样不会污染 undo/history。

## 2. 为什么这个功能是合理的

现有产品里已经有一条非常明确的 JSON 心智模型：

- 用户可以从底部工具条打开 `手动 JSON 导入`，见 `components/ControlPanel.tsx:272` 和 `components/ControlPanel.tsx:305`。
- 导入 modal 本身已经把 JSON 当成一等公民：复制 prompt、加载模板、粘贴 JSON、解析后生成 bubbles，见 `components/ManualJsonModal.tsx:56` 到 `components/ManualJsonModal.tsx:189`。
- README 也把“手动 JSON 导入”作为正式工作流写出来了。

所以，“让用户查看单张图片最近一次 AI 返回的结构化 JSON”并不是横插一个调试功能，而是把现有 JSON 工作流补齐为：

1. AI 生成 JSON  
2. 用户可以导入 JSON  
3. 用户也可以回看当前图片到底收到了什么 JSON

这对几个场景都直接有价值：

- 排查模型是否输出了异常字段。
- 对比“原始结构化结果”和最终 bubbles 显示的差异。
- 复制当前图片结果去做 prompt 调整或外部复现。
- 给你自己调模型 / 调 prompt / 调 schema 时提供一手证据。

## 3. 当前项目里与这个功能直接相关的事实

### 3.1 界面结构：这是一个“图片级”功能，不是 bubble 级功能

当前页面是稳定的三栏结构：

- 左侧：图库 + 底部控制条，见 `App.tsx:251` 到 `App.tsx:271`
- 中间：工作区，见 `App.tsx:281` 到 `App.tsx:289`
- 右侧：选中对象属性区，见 `App.tsx:297` 到 `App.tsx:315`

右侧栏当前只处理两类对象：

- 选中 bubble 时显示 `BubbleEditor`，见 `App.tsx:298` 到 `App.tsx:299`
- 选中 mask 时显示 mask 面板，见 `App.tsx:300` 到 `App.tsx:611`

如果当前图片存在，但没有选中 bubble / mask，右侧栏只显示一个空态，见 `App.tsx:612` 到 `App.tsx:613`。

这意味着：

- 右侧栏其实已经预留了一个“当前图片，但无局部选中对象”的空白容器。
- “查看当前图片 AI JSON”天然适合占这个位置。
- 它不属于 bubble 属性，不应该塞进 `BubbleEditor`。

### 3.2 左下控制条已经有 JSON 入口，但它是“输入”不是“查看”

底部控制条在 `drawTool === 'none'` 时显示：

- 翻译当前
- 翻译全部
- 重置状态
- 手动 JSON 导入按钮

见 `components/ControlPanel.tsx:272` 到 `components/ControlPanel.tsx:313`。

这里的 JSON 按钮本质上是“把外部 JSON 导回项目”。它是一个输入入口，不是结果查看入口。

如果把“查看原始 JSON”也硬塞到这里，会出现两个问题：

- 语义混淆：一个是导入，一个是查看，都是 JSON 图标，用户会误解。
- 空间拥挤：这一排已经很紧，继续加按钮会进一步压缩主操作。

所以这里最多适合做“二级快捷入口”，不适合做主入口。

### 3.3 自动翻译链路现在不会保留原始 JSON

当前自动翻译的服务层 `detectAndTypesetComic(...)` 只返回 `DetectedBubble[]`，见 `services/geminiService.ts:746` 到 `services/geminiService.ts:971`。

不同 provider / 模式下，原始结构化数据来自不同位置：

- Gemini Function Calling：`response.functionCalls[0].args`，见 `services/geminiService.ts:835` 到 `services/geminiService.ts:838`
- Gemini JSON Mode：`fallbackResponse.text`，见 `services/geminiService.ts:853` 到 `services/geminiService.ts:867`
- Gemini Raw Text：`rawResponse.text`，见 `services/geminiService.ts:880` 到 `services/geminiService.ts:893`
- OpenAI Tool Call：`tool_calls[0].function.arguments`，见 `services/geminiService.ts:957` 到 `services/geminiService.ts:960`
- OpenAI Content：`message.content`，见 `services/geminiService.ts:962` 到 `services/geminiService.ts:964`

但这些原始数据在当前实现里都会立刻被解析/校验/映射为标准化 bubbles，之后就丢掉：

- `extractAndValidateBubblesFromText(...)` 最终只返回 bubbles，见 `services/geminiService.ts:465` 到 `services/geminiService.ts:473`
- `runDetectionForImage(...)` 拿到 `detectAndTypesetComic(...)` 的结果后，直接转成编辑器用的 `Bubble[]` 并写进图片状态，见 `hooks/useProcessor.ts:314` 到 `hooks/useProcessor.ts:420`

结论很明确：

- 现在 UI 上之所以没有这个功能，不是摆放问题，而是根本没有把原始 JSON 留下来。

### 3.4 `ImageState` 里没有这类字段

当前 `ImageState` 只存图片层、bubbles、mask、状态等，没有任何 AI 原始响应字段，见 `types.ts:132` 到 `types.ts:167`。

这也是为什么当前无法在“切回某一张图时查看它上次 AI 返回的 JSON”。

### 3.5 直接塞进 `ImageState` 会进入 undo/history

这个项目的历史栈是整个 `ImageState[]` 快照：

- `useProjectState.setImages(...)` 默认会把旧 `present` 推入 `past`，见 `hooks/useProjectState.ts:34` 到 `hooks/useProjectState.ts:48`

所以如果把大段原始 JSON 直接挂进 `ImageState`：

- 每次相关状态写入都会被历史系统带上
- undo 语义会被“调试信息”污染

虽然 JSON 文本一般没有 base64 那么重，但它本质上仍然不是“用户编辑内容”，更像“运行时调试信息”。

因此从架构上看，更干净的方案是：

- `ImageState` 继续只保存编辑内容
- AI 原始 JSON 放到 `ProjectContext` 的独立 runtime state / map 中，用 `imageId` 关联

## 4. “原始 JSON”到底应该显示什么

这里必须先定口径，否则 UI 会稳定不了。

### 4.1 不建议展示“完整 provider HTTP 响应”

原因：

- OpenAI 和 Gemini 的响应外壳不同。
- OpenAI 兼容接口还支持 SSE/ndjson 重组，见 `services/geminiService.ts:487` 到 `services/geminiService.ts:530`
- 有的路径拿到的是 text，有的是 function args object，有的是 tool call arguments string。

如果你坚持“百分之百原样展示 provider 返回包”，最后会得到一套非常不统一的查看体验。

### 4.2 更合理的一阶段定义

建议把这个功能定义成：

> 展示“当前图片最近一次成功被解析并应用的 bubbles payload”，并保留其来源信息。

也就是用户看到的核心正文统一为：

```json
{
  "bubbles": [...]
}
```

同时配少量元信息：

- `sourceKind`: `gemini_function` / `gemini_json` / `gemini_text` / `openai_tool` / `openai_content` / `manual_import`
- `provider`
- `model`
- `capturedAt`
- `bubbleCount`

首版边界建议直接固化为共享类型：只保存最终应用的 bubbles payload 的格式化 JSON 与展示元信息，不保存完整 provider HTTP response，也不保存修复前原始字符串。

这样做的好处：

- 用户看到的是统一结构。
- 你仍然保留了“这次到底是哪个通道产出的”关键信息。
- 实现复杂度明显低于保存完整 provider envelope。

## 5. 摆放位置对比

| 方案 | 放置位置 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- | --- |
| A | 底部控制条，和 `手动 JSON 导入` 并列 | 离翻译按钮近，入口显眼 | 空间已经紧；导入和查看语义混在一起；对“当前图片”感弱 | 不建议做主入口 |
| B | 右侧栏空态替换成“当前图片信息面板”，再用 modal 展示正文 | 最符合“单图级信息”；不污染画布；有现成空位；可顺手放统计和元信息 | 需要补一个新面板组件 | **最推荐** |
| C | 图库缩略图 hover 操作 | 每张图入口直观 | 缩略图已有 skip/reset/delete/status，继续加会很挤；hover 发现性差 | 不建议 |
| D | 合并进 `ManualJsonModal`，做 tab：导入 / 查看 | 可以复用 JSON 文本区 | 把“外部导入工作流”和“查看当前自动结果”混成一个 modal，语义发散 | 不建议作为首版 |
| E | 工作区浮层按钮 | 取用快 | 污染画布；和编辑操作抢注意力 | 不建议 |

## 6. 推荐交互方案

### 6.1 主入口

把当前右侧栏的空态：

- `App.tsx:612` 到 `App.tsx:613`

替换为一个图片级面板，例如：

- 标题：`当前图片`
- 子信息：翻译状态、bubble 数量、mask 数量、最近来源
- 主按钮：`查看 AI 原始 JSON`
- 次按钮：`复制 JSON`

这样做的好处是：

- 用户只要切到某一张图，就知道这是“这张图的资料区”。
- 没选中 bubble / mask 时，右栏不再浪费。
- 图片级功能和对象级属性彻底分层。

### 6.2 正文展示方式

不要把完整 JSON 直接塞进右侧栏。

推荐：

- 点击按钮后打开独立 modal
- modal 内显示格式化 JSON
- 提供 `复制` 按钮
- 可选再加一个 `下载 .json`

原因很简单：

- 右侧栏默认宽度只有 320px 左右，JSON 阅读体验很差。
- JSON 适合短暂沉浸式查看，不适合长期常驻。

### 6.3 二级快捷入口

如果后面你觉得主入口还不够快，再补一个轻量快捷入口：

- 放在底部控制条 JSON 导入按钮旁边
- 只有在当前图片已经存在 `raw json` 时才显示

但这个应该是二阶段优化，不该先做。

## 7. 推荐实现方案

### 7.1 数据结构

建议新增一个图片级 runtime 调试结构，而不是先改 `ImageState`：

```ts
type ImageAiResponseDebug = {
  prettyJson: string;
  sourceKind: 'gemini_function' | 'gemini_json' | 'gemini_text' | 'openai_tool' | 'openai_content' | 'manual_import';
  provider?: 'gemini' | 'openai';
  model?: string;
  capturedAt: number;
  bubbleCount: number;
};
```

首版边界保持一致：这个结构只承载最终应用的 bubbles payload 和来源元信息，不承载完整 provider envelope 或 repair 前文本。

在 `ProjectContext` 里维护：

```ts
Record<string, ImageAiResponseDebug>
```

这样：

- 不进 undo/history
- 不干扰导出
- 删除图片时顺手清理 map 即可

### 7.2 服务层返回值建议升级

当前 `detectAndTypesetComic(...)` 只返回 `DetectedBubble[]`，这会逼着上层只能看到“标准化后的结果”。

更合适的是改成类似：

```ts
type DetectionResult = {
  bubbles: DetectedBubble[];
  rawPayload: unknown;
  sourceKind: 'gemini_function' | 'gemini_json' | 'gemini_text' | 'openai_tool' | 'openai_content';
};
```

这样 `useProcessor` 在成功时就能同时拿到：

- 可应用到编辑器的 `bubbles`
- 可展示给用户的 `rawPayload`
- 可写进 UI 元信息的 `sourceKind`

### 7.3 采集点

建议覆盖两条链路：

1. 自动翻译链路  
   `services/geminiService.ts` -> `hooks/useProcessor.ts`

2. 手动 JSON 导入链路  
   `components/ManualJsonModal.tsx` -> `App.tsx`

这样用户无论是：

- 自动翻译生成
- 手动导入外部 JSON

都能在同一个地方回看“本图最近一次结构化输入/输出”。

### 7.4 是否要保存“修复前字符串”

不建议第一版就做。

原因：

- `ManualJsonModal` 和 `geminiService` 都带有 JSON repair 逻辑。
- 如果把“原始坏字符串”“修复后字符串”“最终 payload”全都展示出来，复杂度会上升很多。

第一版只展示“最终成功解析并应用的 payload”就够了。

如果后面你想做 prompt/debug 深挖，再扩展成：

- 原始文本
- 修复后文本
- 最终 payload

三层视图。

## 8. 为什么我不推荐其他摆法

### 8.1 不推荐放在缩略图

图库单卡已经承担了：

- skip
- reset status
- delete
- status badges

见 `components/Gallery.tsx:249` 到 `components/Gallery.tsx:299`。

再给每个缩略图加一个 JSON 查看按钮，会出现两个问题：

- hover 按钮越来越密
- 用户会把“查看 JSON”误解成批量/管理动作，而不是内容检查动作

### 8.2 不推荐塞进 `BubbleEditor`

`BubbleEditor` 是严格的 bubble 级属性编辑器。

而原始 JSON 是一次图片翻译请求的整体结果，和单个 bubble 不是同一层级。

把它塞进去会导致两个坏结果：

- 当 bubble 没被选中时入口消失
- 用户会误以为 JSON 是“这个 bubble 的来源”，而不是“这张图的整体 AI 结果”

### 8.3 不推荐和 `ManualJsonModal` 合并

`ManualJsonModal` 当前职责很清晰：

- 复制 prompt
- 粘贴 JSON
- 解析后 apply

见 `components/ManualJsonModal.tsx:121` 到 `components/ManualJsonModal.tsx:187`。

如果把“查看自动翻译结果”也并进去，modal 会同时承担：

- 外部输入
- 内部结果查看

这两个任务的上下文完全不同，容易把 modal 做成杂物间。

## 9. 推荐落地顺序

### Phase 1：最小可用版

- 服务层返回 `rawPayload + sourceKind + bubbles`
- `ProjectContext` 增加 `imageAiResponseDebugById`
- 自动翻译成功时写入 debug map
- 手动 JSON 导入成功时也写入 debug map
- 右侧栏空态改为“当前图片信息面板”
- 增加 `AiResponseJsonModal`

### Phase 2：增强体验

- modal 增加 `下载 JSON`
- 控制条增加“存在结果时才显示”的快捷查看入口
- 面板显示最近一次来源、模型、时间

### Phase 3：更深的调试模式

- 展示“原始文本 / 修复后文本 / 最终 payload”三层视图
- 支持对比“当前 bubbles”与“原始 payload”

## 10. 最终建议

如果你现在就要拍板，我建议定成下面这版：

> “查看 AI 原始 JSON”作为**单图级只读功能**，主入口放在**右侧栏的当前图片信息面板**，正文通过**独立 modal**展示；数据保存为**最近一次成功解析并应用的 bubbles payload**，并带上来源元信息；实现上优先放到 **ProjectContext 的独立 runtime map**，不要先塞进 `ImageState`。”

这是当前代码结构里最顺手、最不拧巴、后续也最容易继续扩展的一种摆法。

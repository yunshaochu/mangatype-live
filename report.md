# layoutVariants 纯文本候选改造报告

## 结论

这次改造的方向已经明确，不需要兼容旧协议：

- `breakAfter` 全面删除，不保留 fallback，不做兼容。
- `extraLayoutVariantCount` 全面删除，它是遗留垃圾，不再保存在 `AIConfig`、UI、localStorage、测试和文案里。
- 候选协议改为“AI 直接返回完整候选文本 + 可选字号”，前端直接使用，不再做任何“数字断点 -> 重新断句”的计算。
- 候选组数不再由配置项控制，而是直接在 prompt 里明确要求 AI 返回几组候选。

这不是“优化旧方案”，而是“替换旧方案”。

## 当前清理边界（2026-03-09）

本轮把 legacy 清理范围先锁定为 runtime、test、config 三类代码路径，后续 issue 只允许在这些已知路径里做删除，不再新增新的读取点或兼容桥接。

当前检索命中的 runtime/config 路径：

- `types.ts`
- `contexts/ProjectContext.tsx`
- `components/BubbleEditor.tsx`
- `components/settings/FontSizeTab.tsx`
- `services/aiConfigStorage.ts`
- `services/geminiService.ts`
- `services/i18n.ts`
- `services/layoutVariantBubbleState.ts`
- `services/layoutVariantProjection.ts`
- `services/layoutVariantText.ts`
- `services/translationPromptPresets.ts`

当前检索命中的测试路径：

- `services/aiConfigStorage.test.ts`
- `services/geminiServiceTranslationContract.test.ts`
- `services/layoutVariantBubbleState.test.ts`
- `services/layoutVariantProjection.test.ts`
- `services/layoutVariantState.test.ts`
- `services/layoutVariantText.test.ts`
- `services/translationPromptPresets.test.ts`

收敛约束：

- 后续实现只承认 `layoutVariants[].text` 和可选 `layoutVariants[].fontSize`。
- 候选组数只允许由 prompt 模板定义，不再通过设置或存储字段控制。
- 除 `report.md`、`plan/*`、`issues/*` 外，不再新增任何 legacy 字段引用。

## 新协议

保留 `layoutVariants` 这个字段名，减少改动面，但字段语义彻底改掉。

推荐目标 JSON：

```json
{
  "bubbles": [
    {
      "text": "真的非常感谢你",
      "fontSize": 1.2,
      "layoutVariants": [
        {
          "text": "真的非常\n感谢你",
          "fontSize": 1.1
        },
        {
          "text": "真的\n非常感谢你",
          "fontSize": 1.3
        }
      ],
      "x": 50,
      "y": 45,
      "width": 25,
      "height": 20,
      "isVertical": true
    }
  ]
}
```

协议要求：

- 顶层 `text` 始终是第 0 组主结果。
- `layoutVariants` 只放第 1~N 组额外候选。
- 每个候选必须直接给出完整 `text`。
- 每个候选可以给 `fontSize`，不给就沿用主结果字号。
- 候选之间的区别应主要是断句和字号，不应改写原句含义。
- 协议中不再出现 `breakAfter`。

## 为什么要彻底删掉 `breakAfter`

### 1. 这个字段本质上是在逼 LLM 做它不擅长的事

当前方案要求 AI 输出“第几个字后断句”的数字。这个任务对模型不自然，问题很直接：

- 模型擅长直接改写文本，不擅长稳定计数。
- 数字一旦错一位，整个候选文本就错。
- JSON 看上去合法，但画布上会变成错误断句，排查成本高。

### 2. 当前 prompt 规则和运行时规则本来就不完全一致

现在 prompt 描述的是“按纯中文字符数索引，不含标点和换行”，但运行时真正执行的是另一套逻辑：

- `deriveBaseText()` 会先归一化文本。
- `applyBreakAfterToBaseText()` 是按 grapheme 切分。
- 标点和 ASCII 拼接规则并不等于 prompt 里的“纯中文字符数”。

这说明 `breakAfter` 从设计上就不稳，删掉比修补更合理。

### 3. 运行时其实已经偏向纯文本候选

当前代码里，候选显示逻辑已经是：

- 如果 `layoutVariants[i].text` 存在，直接用它。
- 只有没有 `text` 时，才退回到 `breakAfter` 计算。

也就是说，真正落后的不是渲染主链路，而是协议层和遗留代码。

## 需要删除的垃圾

这一节必须当成“清理清单”，不是“可选优化”。

### A. 删除 `breakAfter` 的全部痕迹

需要删除的代码痕迹包括：

- `types.ts`
- `BubbleLayoutVariant.breakAfter`
- `normalizeLayoutVariant()` 对 `breakAfter` 的处理
- `areLayoutVariantsEqual()` 对 `breakAfter` 的比较

- `services/layoutVariantText.ts`
- `normalizeBreakAfter()`
- `applyBreakAfterToBaseText()`
- 如果 `deriveBaseText()` 只为 `breakAfter/baseText` 服务，也应一起删除整个文件

- `services/layoutVariantProjection.ts`
- 删除 `applyBreakAfterToBaseText` 的 import
- 删除“没有 `variant.text` 时按 `breakAfter` 计算文本”的分支
- `getActiveBubbleLayoutState()` 直接使用 `variant.text`

- `services/layoutVariantBubbleState.ts`
- 删除 `baseText` 初始化逻辑
- 删除主文本变化时对 `baseText` 的重算
- 如果文件只剩少量逻辑，可以考虑直接内联或重写

- `services/geminiService.ts`
- 删除所有要求 AI 输出 `breakAfter` 的 prompt 文案
- 删除 layout variant schema 里的 `breakAfter`
- 删除 “Each candidate should use breakAfter...” 之类描述

- `services/translationPromptPresets.ts`
- 删除共享约束里的 `breakAfter`
- 删除示例 JSON 里的 `breakAfter`
- 删除 manual JSON placeholder 里的 `breakAfter`

- `TODO.txt`
- 删除关于 `breakAfter` 的设计说明，避免后续误导

- 所有相关测试
- `services/geminiServiceTranslationContract.test.ts`
- `services/layoutVariantProjection.test.ts`
- `services/layoutVariantBubbleState.test.ts`
- `services/layoutVariantState.test.ts`
- `services/layoutVariantText.test.ts`

### B. 删除 `extraLayoutVariantCount` 的全部痕迹

这个字段不是“暂时没接好”，而是应该彻底移除。

需要删除的代码痕迹包括：

- `types.ts`
- `AIConfig.extraLayoutVariantCount`
- `DEFAULT_EXTRA_LAYOUT_VARIANT_COUNT`
- `MAX_EXTRA_LAYOUT_VARIANT_COUNT`
- `normalizeExtraLayoutVariantCount()`

- `contexts/ProjectContext.tsx`
- 默认配置里的 `extraLayoutVariantCount`

- `services/aiConfigStorage.ts`
- `AI_CONFIG_STORAGE_FIELDS` 中的 `extraLayoutVariantCount`
- 持久化和反序列化时对它的处理

- `services/aiConfigStorage.test.ts`
- 所有与 `extraLayoutVariantCount` 有关的测试

- `components/settings/FontSizeTab.tsx`
- “Extra Variants / 额外候选数”滑块整块 UI
- 对 `normalizeExtraLayoutVariantCount()` 的 import

- `services/i18n.ts`
- `extraLayoutVariantCount`
- `extraLayoutVariantCountHint`

- 文档和报告
- 任何提到“候选数配置项”的帮助文案都应删除

## 额外建议：`baseText` 也应该一起删

如果不再存在 `breakAfter`，那 `baseText` 基本就失去存在意义了。

当前检查看下来，`baseText` 的主要用途就是：

- 从主文本派生无换行文本
- 供 `breakAfter` 重排时使用
- 在候选失效时一起记录状态

既然新的候选协议是“候选自己直接带完整文本”，那这层派生文本就没有价值了。建议把下面这些一起视为垃圾清理：

- `Bubble.baseText`
- `DetectedBubble.baseText`
- 与 `baseText` 相关的 normalize 逻辑
- `ProjectContext` 里相关日志字段

如果保留 `baseText`，只会让人误以为系统还在走“主文本 + 派生断点”的老路径。

## 改造后的实现思路

### 1. 保留 `layoutVariants`，但只保留 `text` 和 `fontSize`

推荐类型形态：

```ts
export interface BubbleLayoutVariant {
  text: string;
  fontSize?: number;
}
```

这里建议把 `text` 改成必填，而不是可选。因为新协议下，没有 `text` 的候选就是无效候选。

### 2. Prompt 直接写死候选组数要求

不再用配置项，也不再从 UI 调节。

推荐做法：

- 在 prompt 里明确写“请额外返回 2 组候选”或“请额外返回 3 组候选”。
- 这条要求放在 layout variant 专用说明里。
- 如果以后想改候选组数，直接改 prompt 模板，不新增配置项。

这样做的好处：

- 简单。
- 可控。
- 不再出现“UI 里有配置但请求侧没接上”的半成品状态。

### 3. 前端直接使用候选文本，不再做重排计算

目标是把逻辑收敛成：

1. AI 返回主结果 `text`
2. AI 返回额外候选 `layoutVariants[*].text`
3. 当前选中哪个候选，就直接显示哪个候选文本
4. 当前选中哪个候选，就直接用哪个候选字号

中间不允许再出现：

- `breakAfter`
- `baseText`
- `applyBreakAfterToBaseText()`
- 候选文本的二次推导

## 这次改造里可以不动的部分

这些主链路本身不是问题：

- `components/BubbleEditor.tsx` 的候选切换 UI
- `components/BubbleLayer.tsx` 的候选显示主路径
- `services/exportService.ts` 的导出主路径

原因不是它们“设计先进”，而是它们已经走 `getActiveBubbleLayoutState()`，而这个 helper 本来就优先吃候选 `text`。

真正要做的是把 helper 里剩余的 `breakAfter` 残渣删掉。

## 需要顺手修掉的一个问题

虽然这份报告的主题是清垃圾，但有一个问题建议一起修：

- `components/BubbleEditor.tsx` 的字号修改会按当前候选写回
- `components/BubbleLayer.tsx` 里的 `Ctrl/Cmd + 滚轮` 现在还是直接改 `bubble.fontSize`

如果保留这个行为，候选字号会出现两套修改路径不一致。  
建议把画布滚轮也切到“修改当前 active layout 的字号”。

这不是协议问题，但它会在“候选拥有独立字号”后更明显。

## 建议实施顺序

### 第一阶段：先删协议垃圾

先删：

1. `breakAfter`
2. `extraLayoutVariantCount`
3. `baseText`

优先目标是让协议、类型、prompt、测试统一到新模型，不要再出现新旧混杂。

### 第二阶段：重写候选契约

修改这些文件：

1. `services/geminiService.ts`
2. `services/translationPromptPresets.ts`
3. `components/ManualJsonModal.tsx`
4. 相关测试

目标是让 AI 和手动 JSON 都只产出“完整候选文本”。

### 第三阶段：清理运行时残留

修改这些文件：

1. `services/layoutVariantProjection.ts`
2. `services/layoutVariantBubbleState.ts`
3. `contexts/ProjectContext.tsx`
4. `components/BubbleLayer.tsx`

目标是彻底删掉旧断点逻辑，让候选切换只剩“直接取文本”和“直接取字号”。

## 最终判断

这次改造应该采用硬切方式，不要做兼容层，不要保留废字段。

明确建议：

1. 删除 `breakAfter` 在代码中的所有痕迹。
2. 删除 `extraLayoutVariantCount` 在代码中的所有痕迹。
3. 一并删除 `baseText` 这类只服务旧方案的派生字段。
4. 保留 `layoutVariants` 字段名，但把它改成“完整候选文本数组”。
5. 在 prompt 里直接要求 AI 返回固定组数的候选，不再新增配置项。

这套方案最干净，也最符合你现在的目标：  
AI 直接给多个可用候选，前端直接拿来切换使用，不再计算，不再猜，不再数数字。

# BPOOL-000 交集规则验收合同（冻结）

- 日期：2026-03-06
- 来源：`report.md` 第 7 节验收标准（5 条）
- 冻结目标：显示、处理、导出统一遵循 `轮廓池 ∩ 红框窗口` 规则。

## 术语与边界（冻结）

1. 红框（`MaskRegion`）仅作为窗口几何，不再作为轮廓主体生命周期容器。
2. 轮廓（`ContourRegion`）为独立对象，生命周期独立于任意单个红框。
3. 预览、精确填充/预擦除、DOM 导出、Canvas 导出必须使用同一交集口径。
4. 旧数据兼容迁移必须保证“可读、不丢轮廓、可重复加载幂等”。

## 非目标（冻结）

1. 不引入“新建红框自动继承最近轮廓”等隐式行为。
2. 不改变 AI 检测接口协议，仅调整本地存储与消费链路。
3. 不在本任务中引入跨图片共享轮廓。

## 验收标准追溯矩阵（5/5 已映射，未映射=0）

| 验收标准（report.md:114） | 目标链路 | 对应 issue | 关键文件 refs |
| --- | --- | --- | --- |
| 1. 任意新建红框包围到已有文字轮廓时，橙色轮廓立即可见。 | 预览链路统一为交集渲染 | BPOOL-040 | `components/Workspace.tsx:998`; `report.md:115` |
| 2. 同一轮廓可被多个红框分别显示（各自显示交集）。 | 独立轮廓池 + 多窗口检索 | BPOOL-010,BPOOL-040 | `types.ts:75`; `components/Workspace.tsx:998`; `report.md:116` |
| 3. 在某个红框执行精确涂白/擦除时，仅该红框交集区域被处理。 | 处理链路统一消费交集集合 | BPOOL-050 | `contexts/ProjectContext.tsx:469`; `services/exportService.ts:704`; `report.md:117` |
| 4. 删除初始扫描红框后，轮廓仍可被其他红框访问。 | 迁移与生命周期解耦 | BPOOL-020,BPOOL-030 | `contexts/ProjectContext.tsx:336`; `hooks/useProcessor.ts:976`; `report.md:118` |
| 5. DOM/Canvas 导出结果与编辑器一致（同一交集规则）。 | 导出链路规则一致化 | BPOOL-060 | `services/exportService.ts:558`; `services/exportService.ts:1033`; `report.md:119` |

## 可执行验收口径

1. 所有后续 issue 的设计与代码评审均以上述 5 条映射为硬门槛。
2. 若出现新增行为，必须先更新本合同与 CSV 对应 `acceptance_criteria/review_*_requirements/refs` 再改代码。
3. 本合同不替代测试；测试证据在对应 issue 闭环中分别记录。

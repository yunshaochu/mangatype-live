---
mode: plan
cwd: D:\A1\mangatype-live
task: 根据 Report.md 生成可执行计划（API Endpoints 暂停倒计时实时刷新）
complexity: medium
planning_method: builtin
created_at: 2026-03-07T02:47:39.5394371+08:00
---

# Plan: API Endpoints Pause Countdown Realtime Refresh

🎯 任务概述
基于现有 Report 结论，落地一份可执行的改造计划，使 API Endpoints 页面中的暂停倒计时在不切页的情况下实时递减。
计划仅覆盖最小必要改动与验证路径，避免引入全局状态抖动和额外持久化写入。

📋 执行计划
1. 明确改造边界与验收口径
   - 以 UI 展示修复为主，不改变保护策略与降级逻辑；把“每秒递减、到期自动消失、无页面切换”设为核心验收标准。
2. 扩展时间判断函数的可选 now 参数
   - 在 `services/apiProtection.ts` 为 `isEndpointPaused` 和 `getRemainingPauseTime` 增加 `nowMs` 可选参数，并保留默认值以兼容现有调用。
3. 在 ProviderTab 引入本地时间 tick
   - 在 `components/settings/ProviderTab.tsx` 新增 `nowMs` 本地 state；仅当存在 paused endpoint 时启动 `setInterval(1000)`，并在 unmount/条件变化时清理定时器。
4. 统一倒计时渲染走 nowMs
   - 把暂停判断与剩余时间显示改为传入 `nowMs`，保证组件每秒重渲染时倒计时可见递减。
5. 保持运行时调度逻辑不变并做兼容检查
   - 确认 `hooks/useProcessor.ts` 等非 UI 场景调用继续使用默认 `Date.now()` 路径，无需额外修改；避免引入行为回归。
6. 执行手工验证与回归检查
   - 验证单 endpoint/多 endpoint 同时暂停、暂停到期消失、切换 tab/关闭设置弹窗后无定时器泄漏；覆盖 zh/en 文案场景。
7. 记录验证结果与后续优化项
   - 补充变更说明与风险备注（例如秒级重渲染成本、可选惰性清理 `pausedUntil`），便于后续迭代。

✅ 边界锁定检查清单（RTC-000）
- 改造目标仅限 API Endpoints 暂停倒计时实时刷新，不调整暂停/恢复策略与持久化路径。
- 验收基线固定为：每秒递减、到期自动消失、无需切页。
- 代码改动主链路限定在 `components/settings/ProviderTab.tsx` 与 `services/apiProtection.ts`。

⚠️ 风险与注意事项
- 秒级重渲染会增加 ProviderTab 的刷新频率，需要将 interval 严格限制在“存在暂停 endpoint 且页面可见”条件下。
- 若未来 endpoint 数量显著增加，需要关注列表渲染成本并评估是否做更细粒度 memo。
- 中文文档/终端编码可能出现乱码，不影响代码改造本身，但提交说明建议统一 UTF-8。

📎 参考
- `components/settings/ProviderTab.tsx:600`
- `components/settings/ProviderTab.tsx:604`
- `services/apiProtection.ts:480`
- `services/apiProtection.ts:488`
- `components/settings/ProviderTab.tsx:189`
- `components/SettingsModal.tsx:23`
- `contexts/ProjectContext.tsx:420`

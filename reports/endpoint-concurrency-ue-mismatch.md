# Endpoint 并发 U/E 不一致：复现与验收

## 术语

- `U`（User concurrency）：端点配置的 `endpoint.concurrency`（用户期望并发）。
- `E`（Effective concurrency）：运行时的 `endpoint.effectiveConcurrency`（调度实际使用的并发）。

在开启 `apiProtectionStateMachineV2` 的调度路径中，调度会以 `E` 作为并发上限（回退到 `U`）。见：`hooks/useProcessor.ts:891`。

## 复现（历史问题）

目标：复现 UI 显示 `U!=E`（例如 `U5/E10`），并说明这会让 V2 调度继续按旧 `E` 运行。

1. 在 Settings -> Endpoints 中，选择一个 **normal** 端点（`protectionMode !== 'degraded'`），确保它已启用。
2. 将并发设为 10 并保存，确认 UI 标签显示 `U10/E10`。
3. 再将并发改为 5 并保存。
4. **历史行为**：由于保存路径未同步 `effectiveConcurrency`，UI 可能出现 `U5/E10`，且 V2 调度仍按 `E10` 继续拉起请求（见 `hooks/useProcessor.ts:891` 的 `effectiveConcurrency` 计算）。
5. 刷新页面后，如果旧配置把 `effectiveConcurrency` 一起持久化并在归一化时被保留，`U!=E` 会继续存在。

## 验收（当前期望）

1. **Normal 保存立即生效**：保存并发后，UI 立即显示 `U==E`，无需再切换电源开关触发重置。
2. **Degraded 语义不被削弱**：当端点处于 `degraded` 时，保存并发不会“抬高” `E`（可保持降级并发）；若用户把 `U` 调低到小于 `E`，`E` 需要被约束不超过 `U`。
3. **刷新不回退**：
   - normal 端点在加载/归一化后不会再残留旧的 `effectiveConcurrency`（即 `E==U`）。
   - 存储/导出应避免把 `effectiveConcurrency` 当作常驻配置字段带出（以减少漂移风险）。

## 手动验证清单

1. normal 端点：保存 `U10 -> U5`，确认 UI 从 `U10/E10` 直接变为 `U5/E5`。
2. degraded 端点：构造 `protectionMode='degraded'` 且 `E < U` 的端点（例如触发保护或手工写入），保存 `U` 增大时 `E` 不应被抬高；保存 `U` 降低到小于 `E` 时 `E` 应被约束。
3. 刷新页面：normal 端点仍保持 `U==E`；degraded 端点保持预期保护语义。

## 关联实现位置

- 保存同步：`components/settings/ProviderTab.tsx:305`
- 归一化不变量：`types.ts:427`
- V2 调度使用 `E`：`hooks/useProcessor.ts:891`
- 存储/导出剥离 `effectiveConcurrency`：`services/aiConfigStorage.ts:88`

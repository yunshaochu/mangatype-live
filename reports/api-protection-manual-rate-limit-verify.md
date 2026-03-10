# API Protection 手动验证：真实限流触发暂停（MT-070）

目标：用真实 provider / 代理触发 rate limit，确认端点进入暂停（`pausedUntil` 写入）且调度在暂停期内停止对该端点继续发请求；暂停到期后恢复；重复失败达到阈值后自动停用。

## 前置条件

1. 准备一个 **会限流** 的 provider / 代理端点（OpenAI-compatible 或 Gemini）。
2. Settings -> Endpoints：只启用 **1 个端点**（避免干扰）。
3. 开启 API Protection（若有开关），并设置：
   - `apiProtectionDurations`（例如 30s/60s/…）
   - `apiProtectionDisableThreshold`（例如 5）
4. 将端点并发设置为 `U>1`（例如 5 或 10），并准备足够多图片让请求在短时间内集中发出。
5. 如开启 `apiProtectionStateMachineV2`，确认调度会按 `effectiveConcurrency` 控制并发。

## 触发步骤（示例）

1. 启动批处理（Translate/Detect 任一能走请求调度的任务），一次性加入多张图片。
2. 观察控制台/网络日志，直到 provider 返回限流错误（常见形态：`rate_limit_exceeded` / `too_many_requests` / `resource_exhausted` 等，或中文“调用频率限制/限流”）。
3. 触发后预期：
   - UI Endpoint 列表出现 **暂停徽标**（Clock + 剩余时间），并可在端点详情看到最近错误信息。
   - 端点对象写入 `pausedUntil`，且调度在暂停期内不再把该端点加入 `availableEndpoints`（调度会跳过 paused）。
4. 等待暂停到期：
   - 端点应恢复为可用状态（Clock 消失），任务可继续发请求（若仍有 pending）。
5. 重复触发直到达到 `disableThreshold`：
   - 端点应自动停用并展示停用原因（Disabled + reason）。

## 期望观察点（UI/状态）

- 暂停展示：`components/settings/ProviderTab.tsx:693`
- 调度跳过暂停端点：`hooks/useProcessor.ts:883`
- request 模式下 protectable failure 会先落地暂停再释放并发：`hooks/useProcessor.ts:475`

## 风险提示

若无法稳定触发真实限流，可先用更低额度/更严格限流的代理，或临时提高并发与批量规模；验证时务必只启用单端点，避免“失败自动 failover”掩盖暂停行为。

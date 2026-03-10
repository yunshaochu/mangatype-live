# MT-080 备忘：API Protection 可选后续项决策记录

本条为 **非阻塞（Optional / P2）** 跟进项，目标是记录本轮结论与后续实现建议，避免在缺少真实 E2E/生产限流环境下引入语义风险。

## 决策（2026-03-10）

- **暂不实现**：对 `400/401/403` 直接 disable endpoint（带用户可读原因）。
- **暂不实现**：在“所有 endpoints 都 paused”时自动等待并在 pause 到期后恢复调度（resume-after-pause）。

## 理由

1. **产品语义需明确**：`401/403` 既可能是临时 token 失效，也可能是用户配置错误；是否应立即 disable、如何提示、是否自动重试，需要产品侧确认。
2. **回归风险较高**：disable 逻辑会影响保存/加载、UI 展示、以及 failover；需要 E2E + 手动验证覆盖。
3. **调度语义变更**：当前 V2 调度在无可用 endpoint 时会中止并标记失败（见 `hooks/useProcessor.ts:903` 周边逻辑）。改为等待恢复可能引入“长时间挂起/无反馈/误以为卡死”的体验风险，需要 UI 交互配合（例如明确展示“等待恢复”状态与可取消）。

## 后续实现建议（若要做）

### 1) 401/403 disable

- 在错误分类中识别 `401/403`（可能来自 `status/statusCode/response.status`），将其归为“配置/鉴权错误”并触发 disable：
  - `enabled=false`
  - `disableReasonCode` / `disableReasonMessage` 设为清晰可读的原因
  - **不要** 影响 rate-limit/pause 的既有逻辑优先级
- 补充测试：
  - 分类测试：401/403 -> disable（且不进入 pause）
  - storage 测试：disable reason 可持久化

### 2) resume-after-pause

- 当 `pendingQueue>0` 且 `availableEndpoints.length===0` 且存在 paused endpoints 时：
  - 不立刻失败 pending
  - 计算最短剩余暂停时间 `min(pausedUntil-now)`，`await` 到期或用户取消
  - 到期后继续调度循环
- UI/UX：
  - 明确提示“所有端点暂停中，等待 XXs 后重试”，并提供取消按钮

## 关联代码位置

- 调度无可用端点时的中止逻辑：`hooks/useProcessor.ts:903`

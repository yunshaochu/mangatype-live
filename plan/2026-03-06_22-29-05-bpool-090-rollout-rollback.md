# BPOOL-090 灰度发布与双回滚预案

- 日期：2026-03-06
- 目标：为“轮廓池 × 红框交集”改造提供可执行灰度与回滚流程。

## 发布前检查

1. 执行 `npm run build`。
2. 执行 `npm run check:contour-decoupling`。
3. 执行 `npm run check:contour-acceptance`。
4. 执行 `npm run perf:contour:gate`。

## 灰度发布步骤（功能开关）

1. 阶段 A（低风险观测）
- `showContourPreview=true`
- `usePreciseFill=false`
- `preInpaintContour=false`

2. 阶段 B（处理链路灰度）
- `usePreciseFill=true`
- `preInpaintContour=true`

3. 阶段 C（导出一致性确认）
- 分别使用 `exportMethod=canvas` 与 `exportMethod=screenshot` 导出同一页面并对比。

## 回滚触发阈值

1. 任一验收场景失败（可见性、交集处理、删除初始红框后可访问、导出一致性）。
2. `perf:contour:gate` 不通过。
3. 用户反馈出现“所见非所得”或误改交集外像素。

## 双回滚路径

### 功能回滚（分钟级）

1. 设置 `usePreciseFill=false`。
2. 设置 `preInpaintContour=false`。
3. 保留 `showContourPreview=true` 用于问题定位。

### 代码回滚（提交级）

1. 定位最近稳定提交：`git rev-parse --short HEAD~1`。
2. 生成回滚提交：`git revert --no-edit <bad_commit_sha>`。
3. 验证：重复“发布前检查”四项。

## 演练记录（本地）

- 演练类型：代码回滚 dry-run（不改动当前工作树）
- 执行命令：
1. `git rev-parse --short HEAD`
2. `git rev-parse --short HEAD~1`
3. `git diff --name-only HEAD~1..HEAD`
4. `git show --no-patch --oneline HEAD~1`

- 演练结果：
- `drill_current=edacd38`
- `drill_rollback_target=5ea3e1b`
- `drill_changed_files=10`
- `target_commit_subject=[BPOOL-080] 补齐自动化与回归用例`

- 结论：回滚目标可定位、差异范围可枚举、命令链可执行。

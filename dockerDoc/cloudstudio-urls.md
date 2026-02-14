# Cloud Studio 服务公网 URL 获取方法

## 关键环境变量

Cloud Studio 会自动注入以下环境变量：

| 环境变量 | 说明 | 示例值 |
|----------|------|--------|
| `X_IDE_SPACE_KEY` | 工作空间唯一标识 | `4b8acf482c6a45f1ab62122f2a7de743` |
| `X_IDE_PREVIEW_DOMAIN` | 预览域名 | `ap-shanghai2.cloudstudio.club` |
| `X_IDE_SPACE_REGION` | 区域 | `ap-shanghai2` |

## URL 格式

```
https://{X_IDE_SPACE_KEY}--{端口}.{X_IDE_PREVIEW_DOMAIN}
```

## 获取方法

```bash
# 获取空间标识
SPACE_KEY=$(echo $X_IDE_SPACE_KEY)
# 获取预览域名
PREVIEW_DOMAIN=$(echo $X_IDE_PREVIEW_DOMAIN)

# 拼接 URL
echo "https://${SPACE_KEY}--3000.${PREVIEW_DOMAIN}"
```

## 示例

假设：
- `X_IDE_SPACE_KEY=4b8acf482c6a45f1ab62122f2a7de743`
- `X_IDE_PREVIEW_DOMAIN=ap-shanghai2.cloudstudio.club`

则各端口对应的公网地址为：

| 端口 | 公网 URL |
|------|----------|
| 3000 | `https://4b8acf482c6a45f1ab62122f2a7de743--3000.ap-shanghai2.cloudstudio.club` |
| 5000 | `https://4b8acf482c6a45f1ab62122f2a7de743--5000.ap-shanghai2.cloudstudio.club` |
| 8080 | `https://4b8acf482c6a45f1ab62122f2a7de743--8080.ap-shanghai2.cloudstudio.club` |

## 在应用中使用

如果需要在前端动态获取后端 API 地址，可以通过环境变量注入：

```javascript
// 在构建时注入环境变量
const API_BASE_URL = `https://${process.env.X_IDE_SPACE_KEY}--5000.${process.env.X_IDE_PREVIEW_DOMAIN}`;
```

或者在 Docker 容器启动时通过环境变量传递：

```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - API_URL=https://${X_IDE_SPACE_KEY}--5000.${X_IDE_PREVIEW_DOMAIN}
```

## 注意事项

1. **前端运行在浏览器中**：前端 JavaScript 代码运行在用户浏览器，无法访问 Docker 内部容器名，必须使用公网 URL
2. **端口需要被转发**：确保 Cloud Studio 已正确配置端口转发
3. **HTTPS 协议**：Cloud Studio 默认使用 HTTPS，确保应用支持 HTTPS 或正确处理协议

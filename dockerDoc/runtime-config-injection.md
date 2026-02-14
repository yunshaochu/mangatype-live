# Docker Compose 运行时环境变量注入方案

## 背景

在 Cloud Studio 环境中，前端应用运行在用户浏览器中，无法直接访问 Docker 容器内的环境变量。为了使前端能够获取 Cloud Studio 注入的公网 URL 环境变量，需要实现一套运行时配置注入机制。

## 环境变量说明

Cloud Studio 会自动注入以下环境变量：

| 环境变量 | 说明 | 示例值 |
|----------|------|--------|
| `X_IDE_SPACE_KEY` | 工作空间唯一标识 | `4b8acf482c6a45f1ab62122f2a7de743` |
| `X_IDE_PREVIEW_DOMAIN` | 预览域名 | `ap-shanghai2.cloudstudio.club` |
| `X_IDE_SPACE_REGION` | 区域 | `ap-shanghai2` |

公网 URL 格式：`https://${X_IDE_SPACE_KEY}--{端口}.${X_IDE_PREVIEW_DOMAIN}`

## 实现方案

### 整体流程

```
Cloud Studio 环境变量
        ↓
docker-compose.yml 传递给容器
        ↓
nginx 启动脚本生成 config.js
        ↓
前端 JS 读取 window.APP_CONFIG
```

### 修改的文件

#### 1. docker-compose.yml

为 frontend 服务添加环境变量传递：

```yaml
# ── MangaType Live (React frontend, port 3000) ──
frontend:
  build: ./mangatype-live
  ports:
    - "3000:80"
  environment:
    # Cloud Studio 环境变量 - 用于构建公网 URL
    - X_IDE_SPACE_KEY=${X_IDE_SPACE_KEY}
    - X_IDE_PREVIEW_DOMAIN=${X_IDE_PREVIEW_DOMAIN}
    - X_IDE_SPACE_REGION=${X_IDE_SPACE_REGION}
  depends_on:
    - text-detector
    - iopaint
  restart: unless-stopped
```

**说明**：Docker Compose 的 `${VAR}` 语法会从宿主机 shell 环境中读取变量值，然后注入到容器内部。

#### 2. mangatype-live/Dockerfile

在 nginx 容器启动时，动态生成 `config.js` 文件：

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 启动脚本：运行时注入环境变量到 config.js
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-inject-config.sh && \
    echo 'cat > /usr/share/nginx/html/config.js << EOF' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo 'window.APP_CONFIG = {' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo '  TEXT_DETECTION_API_URL: "https://${X_IDE_SPACE_KEY}--5000.${X_IDE_PREVIEW_DOMAIN}",' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo '  IOPAINT_API_URL: "https://${X_IDE_SPACE_KEY}--8080.${X_IDE_PREVIEW_DOMAIN}"' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo '};' >> /docker-entrypoint.d/40-inject-config.sh && \
    echo 'EOF' >> /docker-entrypoint.d/40-inject-config.sh && \
    chmod +x /docker-entrypoint.d/40-inject-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**说明**：
- `nginx:alpine` 镜像会自动执行 `/docker-entrypoint.d/` 目录下的 `.sh` 脚本
- 容器启动时，脚本读取环境变量 `X_IDE_SPACE_KEY` 和 `X_IDE_PREVIEW_DOMAIN`
- 动态生成 `/usr/share/nginx/html/config.js` 文件

生成的 `config.js` 示例：
```javascript
window.APP_CONFIG = {
  TEXT_DETECTION_API_URL: "https://4b8acf482c6a45f1ab62122f2a7de743--5000.ap-shanghai2.cloudstudio.club",
  IOPAINT_API_URL: "https://4b8acf482c6a45f1ab62122f2a7de743--8080.ap-shanghai2.cloudstudio.club"
};
```

#### 3. mangatype-live/nginx.conf

添加 `/config.js` 路由，禁用缓存确保每次获取最新配置：

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA: all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 禁止缓存 config.js，确保每次获取最新配置
    location = /config.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 4. mangatype-live/index.html

在 `<head>` 中添加 `config.js` 加载，确保在其他脚本之前执行：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MangaType Live</title>
    <!-- 运行时配置：由 nginx 容器启动时动态生成 -->
    <script src="/config.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- ... 其他内容 ... -->
  </head>
```

#### 5. mangatype-live/contexts/ProjectContext.tsx

修改配置加载逻辑，让运行时配置的 API URL 优先级最高：

```typescript
const STORAGE_KEY = 'mangatype_live_settings_v1';

// 从运行时配置获取 API URL（Cloud Studio 环境）
const getRuntimeConfig = () => {
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG) {
    return (window as any).APP_CONFIG;
  }
  return {};
};

const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-3-flash-preview',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultFontSize: 1.0,
  useTextDetectionApi: false,
  // 优先使用运行时配置，否则回退到 localhost
  textDetectionApiUrl: getRuntimeConfig().TEXT_DETECTION_API_URL || 'http://localhost:5000',
  language: 'zh',
  customMessages: [{ role: 'user', content: '翻译' }],
  autoDetectBackground: false,
  enableDialogSnap: true,
  forceSnapSize: false,
  enableMaskedImageMode: false,
  useMasksAsHints: false,
  allowAiFontSelection: true,
  defaultMaskShape: 'rectangle',
  defaultMaskCornerRadius: 20,
  defaultMaskFeather: 0,
};

// ... 

// 2. AI Config State
const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
  // 获取运行时配置（Cloud Studio 环境变量注入）
  const runtimeConfig = getRuntimeConfig();
  const defaultUrl = 'http://localhost:5000';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.customMessages) parsed.customMessages = DEFAULT_CONFIG.customMessages;
      const merged = { ...DEFAULT_CONFIG, ...parsed };
      // 优先级：用户手动设置的 URL > 运行时配置 > 默认值
      // 判断用户是否手动设置过：localStorage 中的值不是默认值
      const userSetUrl = parsed.textDetectionApiUrl && parsed.textDetectionApiUrl !== defaultUrl;
      if (!userSetUrl && runtimeConfig.TEXT_DETECTION_API_URL) {
        merged.textDetectionApiUrl = runtimeConfig.TEXT_DETECTION_API_URL;
      }
      return merged;
    }
  } catch (e) { console.warn("Failed to load settings", e); }
  return DEFAULT_CONFIG;
});
```

**关键点**：
- `getRuntimeConfig()` 函数读取 `window.APP_CONFIG`
- 默认配置优先使用运行时配置，否则回退到 `localhost`
- **优先级**：用户手动设置的 URL > 运行时配置 > 默认值
  - 如果 localStorage 中的 URL 不是默认的 `localhost:5000`，说明用户手动设置过，应该尊重用户的选择
  - 否则使用运行时配置（Cloud Studio 公网 URL）

## 使用方式

在 Cloud Studio 中启动：

```bash
docker-compose up --build -d
```

验证配置：

```bash
# 检查环境变量是否传递到容器
docker exec workspace-frontend-1 env | grep -E "X_IDE|PREVIEW"

# 检查 config.js 是否正确生成
docker exec workspace-frontend-1 cat /usr/share/nginx/html/config.js
```

## 注意事项

1. **前端运行在浏览器中**：前端 JavaScript 代码运行在用户浏览器，无法访问 Docker 内部容器名，必须使用公网 URL
2. **端口需要被转发**：确保 Cloud Studio 已正确配置端口转发
3. **HTTPS 协议**：Cloud Studio 默认使用 HTTPS，确保应用支持 HTTPS 或正确处理协议
4. **localStorage 缓存**：如果用户之前保存过设置，运行时配置仍会覆盖 API URL，确保 Cloud Studio 环境优先

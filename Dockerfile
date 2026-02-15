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

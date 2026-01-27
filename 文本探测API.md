# 漫画文本检测 API 文档

## 概述

本API服务提供漫画和漫画中的文本检测功能，可以检测文本区域、文本块和文本行坐标，支持日语、英语等多种语言。

**服务地址**: `http://localhost:5000`

## 目录

- [快速开始](#快速开始)
- [API端点](#api端点)
  - [健康检查](#健康检查)
  - [文本检测](#文本检测)
  - [文本检测（可视化）](#文本检测可视化)
  - [配置管理](#配置管理)
- [响应数据结构](#响应数据结构)
- [错误处理](#错误处理)
- [代码示例](#代码示例)

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python api_service.py
```

服务默认运行在 `http://0.0.0.0:5000`

### 3. 测试服务

```bash
curl http://localhost:5000/health
```

---

## API端点

### 健康检查

检查API服务状态和模型加载情况。

**请求**

```http
GET /health
```

**响应示例**

```json
{
  "status": "ok",
  "device": "cpu",
  "model_loaded": true
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 服务状态，"ok"表示正常 |
| device | string | 运行设备，"cpu"或"cuda" |
| model_loaded | boolean | 模型是否已加载 |

---

### 文本检测

检测图片中的文本，返回详细的文本块和文本行信息。

**请求**

```http
POST /detect
```

**请求方式**

#### 方式1: 上传图片文件（multipart/form-data）

```bash
curl -X POST -F "image=@test.jpg" http://localhost:5000/detect
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | file | 是 | 图片文件（支持jpg, png, jpeg, webp, bmp, gif） |
| return_mask | string | 否 | 是否返回mask的base64编码，"true"或"false"，默认false |

**响应示例**

```json
{
  "success": true,
  "image_size": {
    "height": 1170,
    "width": 1654
  },
  "text_blocks": [
    {
      "xyxy": [1408, 90, 1544, 211],
      "lines": [
        [[1521, 90], [1544, 90], [1544, 179], [1521, 179]],
        [[1500, 92], [1518, 92], [1518, 210], [1500, 210]]
      ],
      "vertical": true,
      "language": "ja",
      "font_size": 24,
      "distance": [1500.5, 1523.5],
      "angle": 0,
      "vec": [2.0, 400.0],
      "norm": 400.0,
      "merged": false,
      "weight": 14514000.0,
      "text": [],
      "prob": 1.0,
      "translation": "",
      "fg_r": 0,
      "fg_g": 0,
      "fg_b": 0,
      "bg_r": 0,
      "bg_g": 0,
      "bg_b": 0,
      "font_family": "",
      "bold": false,
      "underline": false,
      "italic": false,
      "alpha": 255,
      "rich_text": "",
      "line_spacing": 1.0,
      "_alignment": -1,
      "_target_lang": "",
      "_bounding_rect": null,
      "default_stroke_width": 0.2,
      "accumulate_color": true
    }
  ],
  "text_lines_count": 92,
  "mask_size": [1170, 1654]
}
```

#### 方式2: 发送base64编码图片（application/json）

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "return_mask": "true"
  }' \
  http://localhost:5000/detect
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| image | string | 是 | base64编码的图片，支持data URL格式 |
| return_mask | string | 否 | 是否返回mask的base64编码，"true"或"false" |

---

### 文本检测（可视化）

检测文本并返回标注了文本框的可视化图片。

**请求**

```http
POST /detect_visual
```

**请求方式**

上传图片文件：

```bash
curl -X POST -F "image=@test.jpg" http://localhost:5000/detect_visual --output result.jpg
```

**响应**

- Content-Type: `image/jpeg`
- 返回标注了文本框的图片文件

---

### 配置管理

获取或更新模型配置参数。

#### 获取配置

**请求**

```http
GET /config
```

**响应示例**

```json
{
  "model_path": "data/comictextdetector.pt",
  "input_size": 1024,
  "device": "cpu",
  "half": false,
  "conf_thresh": 0.4,
  "nms_thresh": 0.35,
  "mask_thresh": 0.3
}
```

#### 更新配置

**请求**

```http
POST /config
Content-Type: application/json
```

**请求示例**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "conf_thresh": 0.5,
    "nms_thresh": 0.3
  }' \
  http://localhost:5000/config
```

**请求参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| conf_thresh | float | 置信度阈值 (0-1) |
| nms_thresh | float | NMS阈值 (0-1) |
| mask_thresh | float | mask阈值 (0-1) |
| input_size | int | 输入图片尺寸（默认1024） |
| model_path | string | 模型文件路径（更改后会重新加载模型） |

**响应示例**

```json
{
  "success": true,
  "config": {
    "model_path": "data/comictextdetector.pt",
    "input_size": 1024,
    "device": "cpu",
    "half": false,
    "conf_thresh": 0.5,
    "nms_thresh": 0.3,
    "mask_thresh": 0.3
  }
}
```

---

## 响应数据结构

### 文本块（TextBlock）对象

| 字段 | 类型 | 说明 |
|------|------|------|
| xyxy | array[int] | 边界框坐标 [x1, y1, x2, y2] |
| lines | array[array[int]] | 文本行坐标数组，每行4个点 [x1, y1, x2, y2, x3, y3, x4, y4] |
| vertical | boolean | 是否为垂直文本（日语常见） |
| language | string | 语言类型："eng"(英语)、"ja"(日语)、"unknown"(未知) |
| font_size | float | 字体大小（像素） |
| distance | array[float] | 文本行与原点的距离 |
| angle | int | 旋转角度（度） |
| vec | array[float] | 文本块主向量 |
| norm | float | 文本块主向量模长 |
| merged | boolean | 是否为合并后的文本块 |
| weight | float | 文本块权重 |
| prob | float | 置信度（0-1） |
| translation | string | 翻译文本（目前为空） |
| fg_r, fg_g, fg_b | int | 前景色RGB值 |
| bg_r, bg_g, bg_b | int | 背景色RGB值 |

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 检测是否成功 |
| image_size | object | 图片尺寸 {width, height} |
| text_blocks | array | 检测到的文本块数组 |
| text_lines_count | int | 文本行总数 |
| mask_size | array[int] | mask尺寸 [height, width] |
| mask_base64 | string | mask的base64编码（仅在return_mask=true时返回） |
| mask_refined_base64 | string | 精炼mask的base64编码（仅在return_mask=true时返回） |

---

## 错误处理

### 错误响应格式

```json
{
  "error": "错误信息描述",
  "type": "错误类型"
}
```

### 常见错误

| HTTP状态码 | 错误类型 | 说明 |
|-----------|---------|------|
| 400 | No file selected | 未上传图片文件 |
| 400 | File type not allowed | 不支持的文件类型 |
| 400 | Failed to decode image | 图片解码失败 |
| 400 | No image data provided | 未提供图片数据 |
| 500 | FileNotFoundError | 模型文件不存在 |
| 500 | 其他 | 服务器内部错误 |

---

## 代码示例

### Python 示例

```python
import requests
import json

# API基础URL
API_URL = "http://localhost:5000"

# 1. 健康检查
def health_check():
    response = requests.get(f"{API_URL}/health")
    return response.json()

# 2. 文本检测（文件上传）
def detect_text(image_path):
    with open(image_path, 'rb') as f:
        files = {'image': f}
        data = {'return_mask': 'false'}
        response = requests.post(f"{API_URL}/detect", files=files, data=data)
    return response.json()

# 3. 文本检测（base64）
import base64

def detect_text_base64(image_path):
    with open(image_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode()
    payload = {
        'image': f'data:image/jpeg;base64,{image_data}',
        'return_mask': 'false'
    }
    response = requests.post(f"{API_URL}/detect", json=payload)
    return response.json()

# 4. 获取可视化结果
def detect_visual(image_path, output_path):
    with open(image_path, 'rb') as f:
        files = {'image': f}
        response = requests.post(f"{API_URL}/detect_visual", files=files)
    with open(output_path, 'wb') as f:
        f.write(response.content)

# 5. 更新配置
def update_config(conf_thresh=0.4, nms_thresh=0.35):
    payload = {
        'conf_thresh': conf_thresh,
        'nms_thresh': nms_thresh
    }
    response = requests.post(f"{API_URL}/config", json=payload)
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 检查服务状态
    print("服务状态:", health_check())
    
    # 检测文本
    result = detect_text("test.jpg")
    print(f"检测到 {len(result['text_blocks'])} 个文本块")
    print(f"共 {result['text_lines_count']} 行文本")
    
    # 获取可视化结果
    detect_visual("test.jpg", "result.jpg")
    
    # 更新配置
    print("更新配置:", update_config(conf_thresh=0.5))
```

### JavaScript/Node.js 示例

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = 'http://localhost:5000';

// 1. 健康检查
async function healthCheck() {
    const response = await axios.get(`${API_URL}/health`);
    return response.data;
}

// 2. 文本检测（文件上传）
async function detectText(imagePath) {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${API_URL}/detect`, form, {
        headers: form.getHeaders()
    });
    return response.data;
}

// 3. 文本检测（base64）
async function detectTextBase64(imagePath) {
    const image = fs.readFileSync(imagePath);
    const base64 = image.toString('base64');
    
    const response = await axios.post(`${API_URL}/detect`, {
        image: `data:image/jpeg;base64,${base64}`,
        return_mask: 'false'
    });
    return response.data;
}

// 4. 获取可视化结果
async function detectVisual(imagePath, outputPath) {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${API_URL}/detect_visual`, form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer'
    });
    fs.writeFileSync(outputPath, response.data);
}

// 使用示例
(async () => {
    try {
        console.log('服务状态:', await healthCheck());
        
        const result = await detectText('test.jpg');
        console.log(`检测到 ${result.text_blocks.length} 个文本块`);
        console.log(`共 ${result.text_lines_count} 行文本`);
        
        await detectVisual('test.jpg', 'result.jpg');
        console.log('可视化结果已保存');
    } catch (error) {
        console.error('错误:', error.message);
    }
})();
```

### JavaScript/浏览器 示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>漫画文本检测</title>
</head>
<body>
    <input type="file" id="imageInput" accept="image/*">
    <button onclick="detectText()">检测文本</button>
    <pre id="result"></pre>
    <img id="visualResult" style="max-width: 100%;">

    <script>
        const API_URL = 'http://localhost:5000';

        async function detectText() {
            const fileInput = document.getElementById('imageInput');
            const file = fileInput.files[0];
            if (!file) {
                alert('请选择图片');
                return;
            }

            const formData = new FormData();
            formData.append('image', file);

            try {
                // 获取JSON结果
                const response = await fetch(`${API_URL}/detect`, {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                document.getElementById('result').textContent = JSON.stringify(result, null, 2);

                // 获取可视化结果
                const visualResponse = await fetch(`${API_URL}/detect_visual`, {
                    method: 'POST',
                    body: formData
                });
                const blob = await visualResponse.blob();
                document.getElementById('visualResult').src = URL.createObjectURL(blob);
            } catch (error) {
                console.error('错误:', error);
                alert('检测失败: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

---

## 性能优化建议

### 1. 批量处理

对于大量图片，建议使用客户端批量调用，API服务会自动管理模型加载。

### 2. 参数调优

根据实际场景调整检测参数：

- **conf_thresh** (0.3-0.7): 置信度阈值，越高越严格
- **nms_thresh** (0.2-0.5): NMS阈值，控制重叠框的过滤
- **input_size** (640-1280): 输入尺寸，越大越精确但越慢

### 3. 使用GPU

如果有CUDA环境，将device配置为"cuda"可以显著提升速度。

```bash
# 启动时使用GPU
CUDA_VISIBLE_DEVICES=0 python api_service.py
```

---

## 注意事项

1. **模型文件**: 确保模型文件 `data/comictextdetector.pt` 存在
2. **图片格式**: 支持jpg, png, jpeg, webp, bmp, gif格式
3. **图片大小**: 建议图片尺寸在 1024x1024 以下以获得最佳性能
4. **并发请求**: API服务支持并发请求，但建议控制并发数在10以内
5. **文本语言**: 目前主要支持日语和英语的漫画文本检测

---

## 更新日志

### v1.0.0 (2026-01-25)
- 初始版本发布
- 支持文本块和文本行检测
- 支持日语、英语检测
- 提供RESTful API接口
- 支持JSON和可视化输出

---

## 技术支持

如有问题或建议，请联系项目维护者。

---

## 许可证

本项目遵循原项目的许可证。

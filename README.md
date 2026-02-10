# Roamly 地图管理系统（复刻方案 + 可运行实现）

这是一个面向历史地图图片管理的三栏式系统复刻：
- 左侧：分类目录与分面筛选（国家级/国际、国家、省、市）
- 中间：地图缩略图瀑布流 + 搜索 + 上传
- 右侧：地图详情编辑 + 城市级定位（经纬度 + 小地图）

![](./attachment/截屏2026-02-10%2023.11.24.png)

支持两种存储读取方式：
- 本地文件夹（推荐）
- WebDAV（远程文件仓）

## 1. 功能范围

- 扫描地图图片并入库（SQLite）
- 本地目录变化自动监听并增量更新（可开关）
- 地图元数据编辑
- 国家级与国际地图分类
- 市级定位字段（国家/省州/市/区县 + 经纬度）
- 搜索、分页、收藏、分面统计
- 文件上传到本地目录或 WebDAV
- 网页端选择本地地图根目录（无需重启）
- 按文件名自动匹配中国地级市（内置地级市词库）
- OCR 本地文字提取并参与检索（可搜地图内部文字）
- 地图大图缩放查看
- 中国省份分布图（点击省份直接筛选）

## 2. 目录结构

```txt
.
├─ server/                 # Node.js + Express API
│  ├─ src/
│  │  ├─ db.js             # SQLite schema + query
│  │  ├─ library.js        # local/webdav 扫描与存储适配
│  │  ├─ routes.js         # API
│  │  ├─ watcher.js        # 本地目录监听
│  │  └─ location-dict.js  # 城市坐标建议
│  └─ data/                # SQLite 数据
├─ web/                    # React + Vite 前端
│  ├─ src/App.jsx
│  └─ src/styles.css
├─ docker-compose.yml
└─ Dockerfile
```

## 3. 地图目录规范（建议）

为了自动识别“国家级/国际 + 市级分类”，建议使用：

```txt
national/中国/省/市/地图文件.jpg
international/国家/省州/城市/地图文件.jpg
```

如果路径不完全符合也可手动在右侧详情面板编辑。

## 4. 本地 Node 启动

### 4.1 安装

```bash
cp .env.example .env
npm install
```

### 4.2 运行（前后端联调）

```bash
npm run dev
```

访问：
- 前端：`http://localhost:5173`
- API：`http://localhost:4173/api/status`

首次进入如果未设置 `MAP_LIBRARY_DIR`：
- 点击右上角「设置」
- 在设置面板中输入或浏览选择本地目录
- 点击「设置目录」即可即时扫描，不用重启

## 4.4 OCR 依赖（macOS）

OCR 用于识别图片文字并支持 `q` 搜索命中地图内文本。  
若 API 返回 OCR 不可用，请安装：

```bash
brew install tesseract tesseract-lang
```

安装后重启服务，在「设置 -> OCR 文字检索」点击“重建 OCR 索引”。

### 4.3 生产模式本地启动

```bash
npm run build
npm run start
```

访问：`http://localhost:4173`

## 5. Docker 部署

### 5.1 本地目录模式

```bash
cp .env.example .env
# 在 .env 设置 STORAGE_DRIVER=local 和 MAP_LIBRARY_DIR=/maps
mkdir -p maps server/data
npm run docker:up
```

浏览器访问：`http://localhost:4173`

### 5.2 WebDAV 模式

`.env` 关键配置：

```env
STORAGE_DRIVER=webdav
WEBDAV_URL=https://dav.example.com/remote.php/webdav
WEBDAV_USER=xxx
WEBDAV_PASS=xxx
```

然后执行：

```bash
npm run docker:up
```

## 6. 关键 API

- `GET /api/status` 读取运行状态
- `GET /api/maps` 列表检索与分页
- `GET /api/maps/facets` 分面统计
- `GET /api/maps/:id` 详情
- `PUT /api/maps/:id` 保存元数据（包含城市定位）
- `POST /api/maps/:id/favorite` 收藏切换
- `POST /api/maps/scan` 手动重扫
- `POST /api/maps/upload` 上传地图
- `GET /api/locations/suggest?q=杭州` 城市定位建议
- `GET /api/files/:id` 图片流

## 7. 推荐下一步

- 将 `location-dict.js` 扩展为完整行政区/全球城市库
- 增加批量标注页面（按文件夹批量赋值国家、省、市）
- 接入 OCR（地图标题、图例文字自动抽取）
# Roamly

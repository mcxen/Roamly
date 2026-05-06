# Roamly

Roamly 是一个用于历史地图与地图图片整理、检索、标注和浏览的本地优先地图管理系统。

它提供三栏式界面：
- 左侧：搜索、分面筛选、统计信息
- 中间：地图缩略图列表、上传、分页浏览
- 右侧：地图详情编辑、大图预览、地理定位辅助

![](./attachment/截屏2026-02-10%2023.11.24.png)

## 当前项目概览

当前仓库是一个 Node.js + React 的 monorepo：
- `server/`：Express API、SQLite、文件扫描、OCR、运行时配置、项目元数据存储
- `web/`：React + Vite 前端
- `ios/`：UIKit iOS 客户端，支持离线图库、同步、OCR/AI 整理、范围与轮廓校准
- `maps/`：本地示例地图目录
- `bin/roamly`：NPM 安装后的 CLI 启动入口
- `scripts/npm-release.sh`：NPM 发布打包脚本

根目录通过 npm workspaces 管理前后端联调与构建。

## 已实现能力

### 1. 地图库管理
- 扫描本地目录、服务端托管目录或 WebDAV 目录中的地图图片
- 将文件信息与元数据写入 SQLite
- local 模式支持目录监听与增量更新
- 支持上传地图到当前存储后端
- server 模式支持把地图直接上传到服务端并自动归类，适合 Docker / 托管部署
- 支持按收藏、来源、国家、省份、城市、标签等维度筛选

### 2. 元数据编辑
- 标题、描述、标签、收藏状态
- 收藏单位 / 年代字段
- 分类范围：国家级 / 国际
- 国家、相关国家
- 省份、相关省份
- 城市、区县
- 经纬度

### 3. 检索能力
- 文件名检索
- 标题 / 描述检索
- 城市、国家、省份检索
- 标签检索
- OCR 文本检索

### 4. 地图可视化辅助
- 图片大图缩放查看
- 世界地球仪国家选择器
- 中国省级 2D 地图筛选
- 美国本土州级 2D 地图筛选
- 当前代码里预留了日本、俄罗斯 2D 区域图扩展位

### 5. OCR
- 基于本机 `tesseract` 做图片文字识别
- OCR 结果会写入索引并参与搜索
- 支持手动触发 OCR 重建

### 6. iOS 移动端整理
- UIKit 客户端支持离线图库、图库筛选、详情查看与本地缓存
- 支持批量 OCR、批量年代、批量地区和 AI 批量整理
- 批量 OCR / AI 任务使用底部全局进度条展示当前进度
- 支持 DeepSeek、OpenAI 和 OpenAI-Compatible 服务商配置、模型获取、延迟测试和 AI 对话历史
- 支持 AI 提取经纬度范围与缩略图 `coverage_outline`，并可在详情页手动校准地图轮廓

### 7. 项目级元数据持久化
Roamly 不只保存数据库，还会维护项目级 sidecar 元数据：
- local 模式：写入 `<地图根目录>/.roamly/project-data.json`
- webdav 模式：写入 `<WebDAV 根路径>/.roamly/project-data.json`
- 同时在本地 `DATA_DIR/projects/` 保留缓存副本

这部分用于保存项目维度的地图补充信息，并和当前地图库根目录绑定。

## 技术栈

### 后端
- Node.js
- Express
- SQLite
- chokidar
- multer
- sharp
- webdav
- pino

### 前端
- React 18
- Vite
- ECharts
- echarts-for-react
- d3-geo
- topojson-client
- react-zoom-pan-pinch
- china-map-geojson / world-atlas / us-atlas

## 目录结构

```txt
.
├─ bin/                     # CLI 启动入口
├─ maps/                    # 本地示例地图目录
├─ scripts/                 # 发布与辅助脚本
├─ server/
│  ├─ src/
│  │  ├─ index.js           # 服务入口
│  │  ├─ routes.js          # API 路由
│  │  ├─ db.js              # SQLite 读写
│  │  ├─ library.js         # local / webdav 存储适配与扫描
│  │  ├─ watcher.js         # 本地目录监听
│  │  ├─ ocr.js             # OCR 服务
│  │  ├─ project-store.js   # 项目级元数据 sidecar 存储
│  │  ├─ runtime-settings.js# 运行时存储配置
│  │  └─ location-dict.js   # 地理定位建议
│  └─ data/                 # 数据库与缓存目录
├─ web/
│  ├─ src/
│  │  ├─ App.jsx            # 主界面
│  │  └─ api.js             # 前端 API 封装
│  └─ vite.config.js
├─ docker-compose.yml
├─ Dockerfile
└─ README.md
```

## 存储模式

Roamly 当前支持三种存储后端：

### local
- 从本地目录扫描地图
- 支持目录浏览器选择根目录
- 支持监听目录变更
- 地图索引与项目级元信息会写入本地目录下的 `.roamly/project-data.json`
- 适合个人本地资料整理

### server
- 地图文件保存在服务端目录
- 用户可直接上传到服务端
- 未手动指定目录时会尝试自动归类到 `national/...`、`international/...` 或 `incoming/未归类`
- 上传或扫描后会后台预热压缩图/缩略图
- 适合 Docker、NAS、内网托管等“地图托管”模式

### webdav
- 从远程 WebDAV 目录读取地图
- 支持列出远程目录
- 支持上传到远程目录
- 地图索引与项目级元信息会同步写入 WebDAV 根目录下的 `.roamly/project-data.json`
- 适合远程文件仓库

## 推荐目录规范

虽然 Roamly 支持手动编辑元数据，但使用更规整的目录结构会更容易自动分类：

```txt
national/中国/省/市/地图文件.jpg
international/国家/省州/城市/地图文件.jpg
```

## 环境变量

可参考 `.env.example`：

```env
PORT=4173
STORAGE_DRIVER=server
MAP_LIBRARY_DIR=/Users/yourname/Documents/MapLibrary
SERVER_MAP_DIR=./server/data/maps
DATA_DIR=./server/data
DB_PATH=./server/data/roamly.db
WATCH_LIBRARY=true
WEB_DIST_DIR=./web/dist
OCR_ENABLED=true
OCR_LANG=chi_sim+eng

# WebDAV 模式时使用
# WEBDAV_URL=https://dav.example.com/remote.php/webdav
# WEBDAV_USER=your_user
# WEBDAV_PASS=your_pass
# WEBDAV_ROOT_PATH=/
```

说明：
- `MAP_LIBRARY_DIR` 在 local 模式下可以不预先设置，启动后可在网页中选择
- `SERVER_MAP_DIR` 用于 server 模式下的服务端托管目录
- `WATCH_LIBRARY` 仅在 local 模式有效
- `DATA_DIR` 用于保存数据库、运行时设置、缓存、上传临时文件

## 本地开发

### 安装依赖

```bash
cp .env.example .env
npm install
```

### 启动前后端联调

```bash
npm run dev
```

默认地址：
- 前端：`http://localhost:5173`
- API：`http://localhost:4173/api/status`

首次启动若未设置地图目录，可在页面设置中直接选择本地目录，无需重启。

## 生产构建

```bash
npm run build
npm run start
```

默认访问：
- 应用：`http://localhost:4173`

生产模式下，后端会直接托管 `web/dist` 静态文件。

### 本地服务端模式

如果后续要给手机端接入，推荐直接使用 `server` 模式，并把它理解成“用户本地启动一个 HTTP 服务，本地维护地图目录和 SQLite”：

```bash
STORAGE_DRIVER=server npm run start
```

默认本地落盘位置：

- SQLite：`./server/data/roamly.db`
- 服务端地图目录：`./server/data/maps`
- 运行时配置：`./server/data/runtime-settings.json`
- 扫描/项目缓存：`./server/data/projects/`

也就是说：

- 服务端模式下不需要远程数据库
- 用户扫描后的图库、上传的图片、编辑后的元数据都可以直接保存在本机
- 手机端只需要访问这个本地服务暴露出的 HTTP API

面向移动端的接口整理见 [docs/2026-04-07-server-mode-mobile-api.md](/Users/mcx/Documents/OpenSpring/Roamly/docs/2026-04-07-server-mode-mobile-api.md)。

## Docker 部署

### server 模式（推荐用于 Docker 托管）

```bash
cp .env.example .env
mkdir -p server/data/maps
npm run docker:up
```

推荐配置：

```env
STORAGE_DRIVER=server
SERVER_MAP_DIR=/app/server/data/maps
```

特点：
- 地图直接上传到服务端
- 文件保存在容器挂载卷中
- 未指定目录时自动归类到 `national/...`、`international/...` 或 `incoming/未归类`
- 适合作为多人共用的地图托管服务

### local 模式

```bash
cp .env.example .env
mkdir -p maps server/data
npm run docker:up
```

容器默认：
- 端口映射：`4173:4173`
- 数据库目录：`./server/data`
- 本地图册挂载：`${LOCAL_MAP_DIR:-./maps}:/maps`

默认访问：`http://localhost:4173`

### webdav 模式

在 `.env` 中配置：

```env
STORAGE_DRIVER=webdav
WEBDAV_URL=https://dav.example.com/remote.php/webdav
WEBDAV_USER=xxx
WEBDAV_PASS=xxx
WEBDAV_ROOT_PATH=/
```

然后执行：

```bash
npm run docker:up
```

## OCR 依赖

Roamly 的 OCR 依赖系统安装的 `tesseract`。

macOS：

```bash
brew install tesseract tesseract-lang
```

安装后重启服务，再在界面里触发 OCR 重建即可。

## NPM CLI 启动

仓库中已经包含 CLI 入口 `bin/roamly`，用于全局安装后直接启动。

预期使用方式：

```bash
npm i -g roamly
roamly
```

CLI 启动时默认数据目录：
- macOS：`~/Library/Application Support/Roamly`
- Linux：`${XDG_DATA_HOME:-~/.local/share}/roamly`

也可以覆盖：

```bash
DATA_DIR=/path/to/data roamly
```

如果需要打包 / 发布 NPM 包，可使用：

```bash
bash scripts/npm-release.sh --dry-run
```

该脚本会把发布内容整理到 `npm/roamly/.release/`。

## 主要 API

### 状态与配置
- `GET /api/status`
- `GET /api/storage/settings`
- `POST /api/storage/settings`
- `GET /api/storage/local/current`
- `GET /api/storage/local/folders`
- `GET /api/storage/local/browse`
- `POST /api/storage/local/select`
- `GET /api/storage/webdav/folders`

### 地图数据
- `GET /api/maps`
- `GET /api/maps/facets`
- `GET /api/maps/:id`
- `PUT /api/maps/:id`
- `POST /api/maps/:id/favorite`
- `POST /api/maps/scan`
- `POST /api/maps/upload`
- `GET /api/files/:id`

## iOS / 第三方客户端接入接口文档

以下接口可直接用于 iOS、iPadOS 或其他客户端接入。当前服务未内置用户鉴权，默认是受信任内网/自托管场景；如需多用户隔离，建议在网关层补认证。

### 1. 服务状态

#### `GET /api/status`
返回当前服务状态、存储模式、项目根目录、OCR 状态。

返回示例：
```json
{
  "ok": true,
  "storageDriver": "server",
  "mapLibraryDir": "",
  "serverMapDir": "/app/server/data/maps",
  "webdav": {
    "url": "",
    "username": "",
    "password": "",
    "rootPath": "/"
  },
  "watchLibrary": false,
  "ocr": {
    "available": true,
    "queueSize": 0,
    "lang": "chi_sim+eng"
  },
  "project": {
    "projectKey": "server:/app/server/data/maps",
    "source": "server",
    "root": "/app/server/data/maps",
    "cacheFile": "/app/server/data/projects/xxxx.json"
  }
}
```

### 2. 存储设置

#### `GET /api/storage/settings`
读取当前网页/客户端正在使用的存储配置。

#### `POST /api/storage/settings`
切换存储模式。网页端可以直接在三种模式之间切换：
- `server`：服务端托管模式
- `local`：本地文件夹模式，索引和项目元信息写入本地目录 `.roamly/project-data.json`
- `webdav`：WebDAV 模式，索引和项目元信息写入 WebDAV 根目录 `.roamly/project-data.json`

请求体示例：
```json
{
  "storageDriver": "server",
  "serverMapDir": "/app/server/data/maps",
  "mapLibraryDir": "",
  "webdav": {
    "url": "https://dav.example.com/remote.php/webdav",
    "username": "demo",
    "password": "secret",
    "rootPath": "/maps"
  }
}
```

### 3. 地图列表与搜索

#### `GET /api/maps`
用于分页列表、搜索、来源筛选、收藏筛选。

查询参数：
- `page` 页码
- `limit` 每页数量
- `q` 关键词，搜索标题/文件名/城市/OCR 文本
- `scope` 范围：`national` / `international`
- `country` 国家
- `province` 省/州
- `city` 城市
- `source` 来源：`local` / `server` / `webdav`
- `favorite=true` 仅收藏
- `tag` 标签

示例：
```http
GET /api/maps?page=1&limit=24&q=杭州&source=server
```

#### `GET /api/maps/facets`
返回国家、省份、城市、范围等聚合，用于客户端筛选面板。

#### `GET /api/maps/china-distribution`
返回中国省级分布统计，用于地图可视化筛选。

### 4. 地图详情与元信息编辑

#### `GET /api/maps/:id`
读取单张地图详情。

#### `PUT /api/maps/:id`
更新单张地图元信息。

请求体字段：
- `title`
- `description`
- `tags` 字符串数组
- `collection_unit`
- `scope_level`
- `country_code`
- `country_name`
- `province`
- `related_countries` 字符串数组
- `related_provinces` 字符串数组
- `city`
- `district`
- `latitude`
- `longitude`
- `year_label`
- `auto_resolve_city` 是否根据城市自动补全定位

示例：
```json
{
  "title": "杭州老城图",
  "tags": ["杭州", "民国"],
  "country_name": "中国",
  "province": "浙江",
  "city": "杭州",
  "year_label": "1932",
  "auto_resolve_city": true
}
```

#### `POST /api/maps/:id/favorite`
切换或设置收藏状态。

请求体示例：
```json
{ "favorite": true }
```

### 5. 上传、扫描、索引

#### `POST /api/maps/scan`
重新扫描当前存储根目录，更新地图索引，并自动触发 OCR 入队与压缩图预热。

返回中包含：
- `scanned`：扫描数量
- `folders`：可选目录列表
- `prewarm.queued`：预热的缩略图数量

#### `POST /api/maps/upload`
上传地图文件。适合 iOS 直接上传图片到当前存储后端。

请求格式：`multipart/form-data`

表单字段：
- `files`：一个或多个图片文件
- `folder`：目标目录，可留空，留空时后端自动归类
- `title`
- `description`
- `tags`，逗号分隔或 JSON 数组字符串
- `collection_unit`
- `scope_level`
- `country_code`
- `country_name`
- `province`
- `related_countries`
- `related_provinces`
- `city`
- `district`
- `latitude`
- `longitude`
- `year_label`
- `favorite`：`true/false`
- `auto_resolve_city`：`true/false`

能力说明：
- 上传后自动扫描入库
- 可对本批上传文件批量写入元信息
- 可根据城市自动补全国家/省份/经纬度
- 自动触发 OCR 入队
- 自动预热压缩图/缩略图

返回字段：
- `count`：上传文件数
- `paths`：落盘后的目标路径
- `updated`：成功写入批量元信息的记录数
- `items`：更新后的地图记录
- `scan`：扫描结果
- `prewarm`：缩略图预热结果

### 6. 文件读取与图片展示

#### `GET /api/files/:id`
读取原图或压缩图。

查询参数：
- `max`：最大边长，传入后返回压缩 JPEG
- `quality`：JPEG 质量，默认 82

示例：
- 原图：`GET /api/files/:id`
- 缩略图：`GET /api/files/:id?max=720&quality=72`

这适合 iOS 列表页先拉缩略图，详情页再按需拉原图。

### 7. 地理与 OCR

#### `GET /api/locations/suggest?q=杭州`
返回位置联想建议。

#### `GET /api/locations/resolve-city?q=杭州`
根据城市名解析国家、省份、经纬度。

#### `GET /api/locations/china-cities`
返回内置中国城市字典。

#### `GET /api/ocr/status`
返回 OCR 可用状态、队列长度、识别语言。

#### `POST /api/ocr/reindex`
批量重建 OCR 索引。

请求体示例：
```json
{
  "force": true,
  "limit": 6000
}
```

### 8. 本地/WebDAV 辅助接口

#### `GET /api/storage/local/current`
返回当前本地目录。

#### `GET /api/storage/local/folders`
返回本地目录树。

#### `GET /api/storage/local/browse?path=/your/path`
浏览本地目录。

#### `POST /api/storage/local/select`
设置当前本地目录。

#### `GET /api/storage/webdav/folders`
列出 WebDAV 目录树。

### 9. iOS 接入建议

推荐 iOS 端最少接入以下流程：
1. `GET /api/status` 检测服务可用性与当前存储模式
2. `GET /api/maps` 做首页分页与搜索
3. `GET /api/files/:id?max=720` 拉列表图
4. `GET /api/maps/:id` + `GET /api/files/:id` 做详情页
5. `POST /api/maps/upload` 完成上传与批量元信息写入
6. `PUT /api/maps/:id` 完成单图编辑保存
7. `POST /api/maps/scan` / `POST /api/ocr/reindex` 做手动索引维护

### 10. 当前限制

- 目前接口默认无认证，适合自托管或内网部署
- 目前没有用户隔离概念，iOS 客户端连接的是同一个图库项目
- 本地模式依赖服务进程所在机器可访问本地文件系统
- WebDAV 模式下图片流仍通过服务端代理返回

### 地理与 OCR
- `GET /api/locations/suggest?q=杭州`
- `GET /api/ocr/status`
- `POST /api/ocr/reindex`

## 当前实现特点

和普通图片管理器相比，Roamly 目前更偏“地图整理工作台”：
- 不只是看图，还强调地图的地理归属和检索
- 世界 / 中国 / 美国地图可直接参与筛选
- 既支持本地资料库，也支持 WebDAV 仓库
- 运行时存储配置可以在网页端修改，不要求每次改 `.env`
- 项目级 sidecar 数据让地图库在切换设备或存储时更容易保持上下文

## 后续可继续完善的方向

- 补齐日本、俄罗斯等国家的区域边界 GeoJSON
- 增加批量标注与批量修正能力
- 补充更完整的全球行政区 / 城市词典
- 增强 OCR 质量与后台任务可视化
- 优化 NPM 安装后的首次配置体验

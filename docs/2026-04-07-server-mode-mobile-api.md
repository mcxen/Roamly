# 服务端模式 API 整理

本文档面向后续手机端接入，聚焦 `server` 模式下的启动方式、数据落盘位置和推荐 API 调用顺序。

## 1. 模式定义

`server` 模式不是远程数据库服务，也不是额外的云端依赖。它就是用户在自己的机器上启动一个 Roamly 本地服务：

- 地图文件保存在本地目录：`SERVER_MAP_DIR`
- SQLite 保存在本地：`DB_PATH`
- 运行时配置保存在本地：`server/data/runtime-settings.json`
- 扫描后的项目级元数据缓存保存在本地：`DATA_DIR/projects/`
- 上传临时文件保存在本地：`DATA_DIR/uploads/`

典型默认值：

```txt
DATA_DIR=./server/data
DB_PATH=./server/data/roamly.db
SERVER_MAP_DIR=./server/data/maps
```

对手机端来说，这个模式可以理解为：

- App 只请求本机或局域网内的 HTTP API
- 用户自己维护本地地图目录和 SQLite
- 用户扫描过的图库、上传的图片和编辑过的元数据都留在本地

## 2. 启动与落盘约定

### 启动

```bash
npm run build
STORAGE_DRIVER=server npm run start
```

首次启动时：

- 如果 `SERVER_MAP_DIR` 已存在，服务会自动扫描并建立索引
- SQLite 会直接写到 `DB_PATH`
- 首页列表数据来自本地 SQLite 中的 `maps` 表

### 目录职责

```txt
server/data/
├─ roamly.db                # 本地 SQLite 主库
├─ runtime-settings.json    # 当前运行时存储模式与目录配置
├─ uploads/                 # 上传过程中的临时文件
├─ image-cache/             # 缩略图/压缩图缓存
├─ projects/                # 项目级 sidecar 缓存
└─ maps/                    # server 模式默认地图根目录
```

### 上传后的文件

`POST /api/maps/upload` 在 `server` 模式下会把图片直接写入 `SERVER_MAP_DIR` 下：

- 指定了 `folder` 时，写入对应子目录
- 未指定 `folder` 时，会根据文件名和定位推断自动归类
- 冲突文件名会自动追加 `_1`、`_2`

## 3. 推荐的手机端接入顺序

### 启动页

1. `GET /api/status`
2. 判断 `storageDriver === "server"`
3. 读取 `serverMapDir`、`ocr`、`project`

### 首页列表

1. `GET /api/maps?page=1&limit=24&source=server`
2. 列表缩略图使用 `GET /api/files/:id?max=720&quality=72`
3. 分面筛选使用 `GET /api/maps/facets?source=server`
4. 中国分布图使用 `GET /api/maps/china-distribution?source=server`

### 详情页

1. `GET /api/maps/:id`
2. 原图预览 `GET /api/files/:id`
3. 保存编辑 `PUT /api/maps/:id`
4. 收藏切换 `POST /api/maps/:id/favorite`

### 维护动作

1. 手动重扫 `POST /api/maps/scan`
2. OCR 重建 `POST /api/ocr/reindex`
3. 上传图片 `POST /api/maps/upload`

## 4. 关键接口

### `GET /api/status`

用于移动端启动自检。

关键字段：

```json
{
  "ok": true,
  "storageDriver": "server",
  "serverMapDir": "/absolute/path/to/maps",
  "ocr": {
    "available": true,
    "queueSize": 0
  },
  "project": {
    "projectKey": "server:/absolute/path/to/maps"
  }
}
```

### `GET /api/maps`

首页主列表接口。常用参数：

- `page`
- `limit`
- `q`
- `scope`
- `country`
- `province`
- `city`
- `favorite`
- `tag`
- `source=server`

### `GET /api/maps/:id`

返回单张地图详情，包含编辑表单需要的元数据，以及 OCR 信息。

### `PUT /api/maps/:id`

用于手机端保存元数据编辑结果。推荐提交字段：

- `title`
- `description`
- `tags`
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

### `POST /api/maps/upload`

上传字段：

- `files`: 一个或多个图片文件
- `folder`: 目标子目录，可空
- 其余可选字段同批量元数据字段

返回值里会带：

- `saved`: 已落盘文件
- `scan`: 最新扫描结果
- `appliedMeta`: 批量元数据写入结果

## 5. 对手机端的约束建议

- 手机端默认只接 `server` 模式，不必实现 `local` 目录浏览能力
- 首页请求统一显式带 `source=server`，避免混入其他存储来源
- 上传完成后直接刷新 `GET /api/maps`
- 若需要“是否可连接”的轻量探活，只调用 `GET /api/status`

## 6. 当前实现结论

- `server` 模式下，SQLite 已经是本地文件，不需要改成远程数据库
- 用户扫描过的图库、上传后的图片、编辑后的元数据都可以保留在本地目录
- 本次已修复服务启动时遗漏 `SERVER_MAP_DIR` 初次扫描的问题，避免首页首次启动时列表为空

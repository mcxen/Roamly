# flightcn GlobeView 学习记录

日期：2026-04-08

## 背景

Roamly 原本的地球筛选器使用 `d3-geo + canvas` 手工绘制正射投影球体，支持：

- 拖拽旋转
- 滚轮缩放
- 点击国家后筛选地图

这种方式可以快速做出视觉效果，但存在几个问题：

- 球体渲染、命中测试、缩放旋转都需要自己维护
- 后续如果要加 marker、航线、国家 hover、高亮动画，复杂度会快速上升
- Web 端和后续移动端难以形成统一的地图交互模型

## 参考项目

参考仓库：`https://github.com/ridemountainpig/flightcn`

本次重点学习的是它的 globe 实现思路，而不是航线业务本身。

## 核心观察

### 1. flightcn 不是“单独一个 GlobeView 组件”

它的核心不是手写一个 3D 球体控件，而是把 globe 作为 `MapLibre` 的投影模式：

```tsx
<Map projection={{ type: "globe" }} />
```

也就是说：

- 地图引擎负责球体投影
- 拖拽、缩放、投影切换由引擎处理
- 航线、机场、动画 marker 都挂在同一张地图上

这比手搓 canvas 更适合持续演进。

### 2. globe 只是地图容器的一种状态

`flightcn` 的做法不是“再做一套 globe 系统”，而是在统一地图组件里支持：

- 普通平面投影
- globe 投影
- marker / popup / route / animation 共用一套容器

这个思路对 Roamly 很重要：

- 以后如果要做地图点位、扫描来源、收藏路径、跨国线路，应该接到统一地图层
- 不应该继续在 `canvas` 上叠越来越多业务逻辑

### 3. globe 模式适合长距离、跨区域可视化

`flightcn` 的球面特别适合：

- 跨洲航线
- 全球视角的点位查看
- 把“世界范围数据”先放到一个全局容器里

这和 Roamly 的国家筛选器天然契合。Roamly 不需要先上复杂航线，但值得先把 globe 容器换成地图引擎实现。

## 对 Roamly 的落地判断

Roamly 当前最需要的，不是照搬 `flightcn` 的航线动画，而是迁移它的实现范式：

1. 使用 `MapLibre` 接管 globe 投影
2. 保留当前“点击国家筛选”的业务行为
3. 让后续 hover、高亮、国家 flyTo、marker、移动端地图能力都有统一基础

## 本次已落地的改动

已经完成的实现：

- 新增 `MapLibre` 版 globe 组件
- 使用 `projection: { type: "globe" }`
- 使用世界 GeoJSON source + layer 做国家填充和选中高亮
- 点击国家后仍然回写 Roamly 当前筛选条件

对应文件：

- `web/src/GlobeCountryPicker.jsx`
- `web/src/App.jsx`
- `web/src/styles.css`

## 和旧实现的对比

### 旧方案

- `canvas` 自绘
- `d3-geo` 负责投影与命中
- 手工维护 rotation / zoom

### 新方案

- `MapLibre` 管理 globe 投影
- GeoJSON source/layer 管理国家渲染与点击
- 地图引擎直接处理拖拽/缩放

## 下一步建议

### Web 端

- 加国家 hover 高亮
- 点击国家后 `easeTo` 聚焦
- 在 globe 上叠加地图数量 marker
- 把国家筛选和 2D 区域图的视觉层统一

### iOS 端

- 不做原生 3D globe 起步
- 优先做离线图库 + 服务端同步 + OCR 搜索
- 地图球体交互在 Web 管理端先成熟，再判断是否要上 iOS 地图可视化

## 结论

对 Roamly 来说，`flightcn` 最有价值的不是“球体长什么样”，而是：

> 把 globe 当成统一地图引擎里的一个投影能力，而不是单独维护的一块特效画布。

这会直接降低后续交互复杂度，并为 Web / iOS / 同步能力提供更稳的基础。

# 投球砸墙 · Ball & Bricks

固定视角 3D 投掷砸墙小游戏。Three.js 渲染 + Rapier3D（Rust / WASM）刚体物理。红砖按真实砖块比例（约 240:115:53）等比放大，错缝砌成 12 列 × 40 行（460 块），最底下一排砖绕 Z 轴转了 90°、竖着立在架子上当支撑，上面整面墙压在它们上面；背后有一整面大挡墙接住飞出去的球。

## 运行

ES Module 和 WASM 需要通过 HTTP 访问，不能直接双击 `index.html`。

```bash
cd ball-bricks
python -m http.server 8000
```

浏览器打开 <http://localhost:8000/>。

Windows 也可以直接双击 `start.bat`：它会在当前窗口运行本地服务并自动打开浏览器；窗口就是服务，关掉或按 Ctrl+C 即停止。若浏览器没有自动打开，手动访问 <http://localhost:8000/>。

依赖已放在 `vendor/`，断网也能玩。

## 操作

- 点击开始，进入固定视角
- 移动鼠标（或触摸拖动）瞄准，砖块或地面上会出现珊瑚色圆环
- **按住蓄力，按住期间可以继续拖动调整落点，松开投掷**
- 蓄力越久球速越快，虚线是预测弹道
- `R` 或左上角「重置」按钮重置砖墙

镜头固定，不会随鼠标转动。

## 可调参数

都在 `src/main.js` 顶部的 `CONFIG` 里：

| 参数 | 说明 |
| --- | --- |
| `layout` | `'wall'`（默认）或 `'pyramid'` |
| `wall.cols` / `.rows` | 砖墙列数与行数，默认 12 / 40，上面 460 块，奇数行错缝 |
| `wall.soldierBase` | 是否在底部加一排绕 Z 轴转 90° 的竖砖支撑 |
| `pyramid.base` / `.layers` | 可选金字塔布局，默认 4 / 4 |
| `stand.height` / `.thickness` | 架子高度与托板厚度 |
| `stand.margin` / `.depthMargin` | 托板比砖墙宽出 / 深出的量 |
| `stand.legWidth` | 架子腿宽度 |
| `backWall.z` / `.width` / `.height` | 背后大挡墙的位置和尺寸 |
| `brick.w` / `.h` / `.d` / `.mass` | 砖块长宽高与质量，默认 0.48 × 0.106 × 0.23 米，比例接近真实砖块 |
| `ball.minSpeed` / `.maxSpeed` | 最小 / 最大投掷速度 |
| `ball.chargeTime` | 蓄满力度所需秒数 |
| `ball.mass` | 球的质量 |
| `camera.z` | 玩家站位，越小离砖墙越近 |
| `camera.fov` / `.pitch` | 视野与固定镜头的俯仰角 |
| `targetZ` | 砖墙中心的 z 坐标 |

滚地球投掷模式还没做，后续可在投掷逻辑里加一个分支。

## 技术

- Three.js 0.186.1
- @dimforge/rapier3d-compat 0.21.0（WASM 内嵌在 JS 中）
- 固定 60 Hz 物理步进，砖块按位移和倾斜角度判定“倒下”

以上依赖均已本地内置于 `vendor/`。

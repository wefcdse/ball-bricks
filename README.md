# 投球砸墙 · Ball & Bricks

固定视角 3D 投掷砸墙小游戏。Three.js 渲染 + Rapier3D（Rust / WASM）刚体物理。主页提供 6 个场景：**砖墙**（9 列 × 40 行，底部竖砖托住每块底砖）、**高塔**（竖横交替 15 组）、**锥塔**（交错上升、越来越窄）、**城堡**（L 形双墙）、**柱阵**（四根高柱）和 **多米诺**（竖砖长龙）。砖块按真实比例（约 240:115:53）等比放大，背后有一整面大挡墙接住飞出去的球。

## 运行

ES Module 和 WASM 需要通过 HTTP 访问，不能直接双击 `index.html`。

```bash
cd ball-bricks
python serve.py
```

浏览器打开 <http://localhost:8000/>。

`serve.py` 默认监听 `0.0.0.0:8000`，启动后会在控制台列出本机所有 IPv4 地址（包括 WiFi、有线、WSL/Hyper-V 等虚拟网卡）。同一局域网里的手机用对应 IP 访问即可；首次可能需要在 Windows 防火墙里允许 Python。也可以指定端口：`python serve.py 8080`。

Windows 也可以直接双击 `start.bat`：它会在当前窗口运行本地服务并自动打开浏览器；窗口就是服务，关掉或按 Ctrl+C 即停止。若浏览器没有自动打开，手动访问 <http://localhost:8000/>。

Three.js 本地内置；Rapier 从 jsDelivr 加载，首次打开需要联网。

## 操作

- 在主页选择「砖墙」「高塔」「锥塔」「城堡」「柱阵」或「多米诺」
- 移动鼠标（或触摸拖动）瞄准，砖块或地面上会出现珊瑚色圆环
- **按住蓄力，按住期间可以继续拖动调整落点，松开投掷**
- 蓄力越久球速越快，虚线是预测弹道
- `R` 或左上角「重置」按钮重置当前场景

镜头固定，不会随鼠标转动。

## 可调参数

场景参数在 `src/main.js` 顶部的 `CONFIG` 里，各场景相机在 `SCENES` 里：

| 参数 | 说明 |
| --- | --- |
| `layout` | `'wall'`（默认）或 `'pyramid'` |
| `wall.cols` / `.rows` | 砖墙列数与行数，默认 9 / 40，上面 340 块，奇数行错缝 |
| `wall.soldierBase` | 是否在底部给每块底砖的头尾加竖砖支撑 |
| `tower.cols` / `.cycles` | 高塔每层砖数与竖横交替组数，默认 5 / 15 |
| `taper.baseCols` / `.layers` | 锥塔底部砖数与层数，默认 9 / 15，每两层收窄一块并左右错位 |
| `fort.rows` / `.xCols` / `.zCols` | 城堡双墙的高度与两边长度，默认 20 / 5 / 6 |
| `columns.rows` | 柱阵每根柱子的砖数，默认 18 |
| `domino.count` / `.spacing` | 多米诺数量与间距，默认 12 / 0.24 |
| `pyramid.base` / `.layers` | 可选金字塔布局，默认 4 / 4 |
| `stand.height` / `.thickness` | 架子高度与托板厚度 |
| `stand.margin` / `.depthMargin` | 托板比砖墙宽出 / 深出的量，可为负值 |
| `stand.legWidth` | 架子腿宽度 |
| `backWall.z` / `.width` / `.height` | 背后大挡墙的位置和尺寸 |
| `brick.w` / `.h` / `.d` / `.mass` | 砖块长宽高与质量，默认 0.48 × 0.106 × 0.23 米，比例接近真实砖块 |
| `ball.minSpeed` / `.maxSpeed` | 最小 / 最大投掷速度 |
| `ball.chargeTime` | 蓄满力度所需秒数 |
| `ball.mass` | 球的质量 |
| `camera.z` | 砖墙场景的相机距离，越小离墙越近 |
| `camera.fov` / `.pitch` | 砖墙场景的视野与固定镜头俯仰角 |
| `SCENES.<场景>.camera` | 各场景的相机高度 / 距离 / 俯仰 |
| `targetZ` | 砖墙中心的 z 坐标 |

滚地球投掷模式还没做，后续可在投掷逻辑里加一个分支。

## 技术

- Three.js 0.186.1
- @dimforge/rapier3d-compat 0.21.0（WASM 内嵌在 JS 中，从 jsDelivr 加载）
- 固定 60 Hz 物理步进，砖块按位移和倾斜角度判定“倒下”

Three.js 与 `RoundedBoxGeometry` 本地内置于 `vendor/`；Rapier 通过 importmap 从 <https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/dist/rapier.mjs> 加载。

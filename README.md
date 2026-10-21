# 投球拆塔 · Ball & Bricks

第一人称 3D 投掷打砖块沙盒。Three.js 渲染 + Rapier3D（Rust / WASM）刚体物理，砖块会真实倒塌。

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
- `R` 或左上角「重置」按钮重置砖塔

镜头固定，不会随鼠标转动。

## 可调参数

都在 `src/main.js` 顶部的 `CONFIG` 里：

| 参数 | 说明 |
| --- | --- |
| `layout` | `'pyramid'`（默认）或 `'wall'` |
| `pyramid.base` / `.layers` | 金字塔底边块数与层数，默认 4 / 4，共 30 块 |
| `wall.cols` / `.rows` | 砖墙布局的列数与行数 |
| `brick.w` / `.h` / `.d` / `.mass` | 砖块尺寸与质量 |
| `ball.minSpeed` / `.maxSpeed` | 最小 / 最大投掷速度 |
| `ball.chargeTime` | 蓄满力度所需秒数 |
| `ball.mass` | 球的质量 |
| `camera.z` | 玩家站位，越小离砖塔越近 |
| `camera.fov` / `.pitch` | 视野与固定镜头的俯仰角 |
| `targetZ` | 砖塔中心的 z 坐标 |

滚地球投掷模式还没做，后续可在投掷逻辑里加一个分支。

## 技术

- Three.js 0.186.1
- @dimforge/rapier3d-compat 0.21.0（WASM 内嵌在 JS 中）
- 固定 60 Hz 物理步进，砖块按位移和倾斜角度判定“倒下”

以上依赖均已本地内置于 `vendor/`。

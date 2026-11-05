# Spotify Lyrics Better HUD 1.3.3

基于 **[Fanbeixi / spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)** 的衍生项目，沿用原作者歌词源与匹配算法，从 1.3.0 起将窗口改为 Spotify 进程内的 C++ 原生悬浮窗，保留 A 按钮、网易云兜底和逐曲校时。感谢原作者提供的实现；完整署名见 [CREDITS.md](CREDITS.md)。本仓库的 **1.3.3** 是衍生版本号，不是原项目的版本号。

[下载 1.3.3](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [原作者项目](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)

## 效果展示

<img width="1500" height="1000" alt="image" src="https://github.com/user-attachments/assets/8fcde938-c67e-45d6-b507-bc0b4bc1a535" />

## 安装与使用

支持 Windows x64、Spotify 官网桌面版。下载 Release 中的 **Spotify-Lyrics-HUD-Setup-v1.3.3.exe**，单独运行即可；无需附属文件。先登录一次 Spotify，再退出它，运行安装器并选择 `1` 安装/修复。管理员 CMD 与普通权限均支持，管理员调用 Spicetify 时使用其 `--bypass-admin` 参数。

打开 Spotify 后，麦克风左侧的 **A** 按钮开关桌面歌词。窗口保留 Segoe UI 粗体、当前句下方的绿色呼吸光条、柔和辉光与边缘渐隐，可拖动、缩放；悬停歌词显示工具栏，点击 Aa 调整字号和抗锯齿，半圆图标调整歌词与调节小窗共用的透明度，# 图标输入颜色代码；调节面板在歌词上方或下方展开。歌词窗口直接在 Spotify.exe 内创建，与 Spotify 主进程使用同一 PID；Spotify 结束时窗口一同销毁。没有独立常驻 Launcher、开机监视程序或自动更新器。

安装器在 Spotify 目录添加 `version.dll` 和 `LyricsHUD/bridge.ini`，不修改 Spotify EXE。模块将版本查询转发到 Windows 系统 DLL，只在 Spotify 主进程启动歌词。已有其它插件的同名 DLL 时会拒绝覆盖。升级会移除旧 Launcher 和它的开机启动项；卸载只删除本项目模块，保留逐曲校时。

字体按钮左侧只显示校时数字，默认为 `0`，例如 `-1`、`-1.5`、`+1`。点击数字展开校时小窗，可用 ±0.5 秒按钮或直接输入秒数：负数让歌词提前，正数让歌词延后。每首歌独立保存，缓存位于 Spotify 安装目录内的 `LyricsHUD/lyric-offsets.json`。切歌、重启后恢复，不修改音频文件。

工具栏的四角图标切换当前显示器全屏，再次点击恢复原来的窗口大小和位置；关闭歌词也会退出全屏。全屏时仍可打开外观小窗，字号支持 14–120 px，配合低不透明度背景使用。校时按钮与其它按钮尺寸统一，滑条绿色更柔和，底部不显示歌词来源文字。

拖动和缩放全程保留圆角毛玻璃。使用鼠标捕获替代系统模态拖动循环，鼠标事件只记录最新目标，窗口位置按显示器刷新率（60–240 Hz）合并更新，歌词重绘保持最高 60 FPS；暂停移动时复用已有画面，避免每条鼠标事件都同步重设模糊和窗口区域。Esc 可取消拖动并恢复原位置与大小。不改变鼠标回报率、指针速度或系统平滑设置。

安装器选项 `2` 停用启动联动与按钮，并保留个人设置和其它扩展；选项 `5` 导出源码及许可证。Spotify 更新后按钮失效时，重新运行安装/修复。

## 更新日志

1.3.3 恢复多行歌词，长句随窗口宽度自动换行，不限制为两三行；按实际文本高度排列上下句，保留平滑纵向滚动。窗口高度不足时，仅自动缩小过长句的字号以完整显示，不改变保存的字号设置。换行布局只在歌词、字号或窗口尺寸变化时重算。

1.3.2 缩小工具栏文字画布并复用静态文字，外观颜色仅在设置变更时解析；过滤暂停时重复的播放快照，减少无效重绘。保留全屏歌词、绿色呼吸条与移动时持续毛玻璃。构建从 package.json 读取发布版本，运行时诊断与网络请求共用版本常量。

1.3.1 播放动画改为高精度 60 FPS 帧调度，长句滚动保留小数像素位置。字号、抗锯齿和透明度使用圆角滑条，拖动实时预览、松手保存；按 Tab 输入精确数值，Enter 确认。颜色支持 `RRGGBB` 和 `#RRGGBB`。背景不透明度采用细调曲线：新 0–40% 对应旧 0–5%，40–100% 对应旧 5–100%。歌词框与调节小窗共用 0–100% 背景不透明度和圆角毛玻璃，0% 为完全透明；移除固定深色叠层和多余底部留白，统一工具栏字号与基线。移除背景尺寸入口，直接拖动窗口边缘缩放；校时按钮合并为一个数字入口。移除齿轮设置按钮和独立设置窗口，外观调节拆入歌词上方工具栏；点击后在歌词下方展开圆角毛玻璃小面板，下方空间不足时自动显示在上方。面板与工具栏的文字全部使用同一套 Segoe UI 粗体 DirectWrite 渲染，图标直接绘制，无系统按钮白框。校时保留加减按钮，外观数值使用滑条或按 Tab 输入；颜色输入支持可选的 `#` 前缀和粘贴；有效输入停顿 0.5 秒后自动保存，也可按 Enter 确认。点击别处收起，Esc 关闭并放弃尚未保存的输入。新增 `Anti-aliasing`（0–100%）：0 为硬边，默认 50 为均衡，更高数值使边缘柔和。歌词改用适合透明浮窗的 DirectWrite 灰度抗锯齿，保留粗体、绿色呼吸条和渐隐；缓存文字布局和绘制资源，暂停且画面稳定时停止重复重绘。

1.3.0 已移除独立 Electron 歌词进程与全屏检测进程，窗口和检测均由 Spotify 内部承载。继续支持自动全屏穿透：全屏或无边框全屏应用位于前台时，歌词继续显示，但鼠标点击直接交给下方应用，歌词不能抢焦点或弹出悬停按钮；切回普通窗口、普通最大化窗口或桌面后恢复操作。此功能默认启用，支持多显示器，不需要手动切换。独占全屏游戏是否能显示桌面叠加层仍取决于游戏的呈现模式。

检测在线程中完成，不使用鼠标键盘钩子，不修改游戏、系统光标或光标锁定。游戏原本隐藏的光标不会因为悬停歌词而显示；普通全屏软件原有的光标保持原样。

[查看更新日志](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [完整改动](CHANGELOG.md)

## 从源码构建

需要 Windows x64、Node.js **22+**、Visual Studio 2022/2026 或 Build Tools 的 **Desktop development with C++**（含 x64 编译器与 Windows SDK）、Windows 自带的 .NET Framework 4.x C# 编译器和 `tar.exe`。在仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

脚本下载 `dependencies.lock.json` 锁定的依赖并校验 SHA256，将原有歌词源打包到 Spotify 扩展，运行回归测试，编译 C++ 进程模块和 C# 控制台安装器，再执行安装器自检。结果在 `dist/`：

- `Spotify-Lyrics-HUD-Setup-v1.3.3.exe`：可独立分发的安装/加载器。
- `Spotify-Lyrics-HUD-Source-v1.3.3.zip`：可上传 GitHub 的源码、构建脚本与许可。
- `SHA256SUMS.txt`：下载校验值。

首次构建需要访问 GitHub 和 npm。使用代理时推荐 Node.js 24.5+，下载器会使用现有的 `HTTPS_PROXY/HTTP_PROXY/NO_PROXY` 配置。已缓存依赖后可离线重建：`Build.ps1 -CacheDir <缓存目录>`。构建不安装或修改本机 Spotify。再次运行测试可执行 `npm test`，无需额外 `npm install`。首次应先完整构建以准备测试依赖。

```text
app/src/      沿用并测试的歌词源与匹配算法
extension/    Spotify A 按钮和客户端进度桥接
native/       Spotify 进程内 C++ 模块及系统 API 转发
installer/    控制台安装器、PowerShell 安装与迁移步骤
scripts/      校验下载、歌词源打包、测试与源码归档
tests/        同进程窗口、时钟、歌词匹配、本地协议、安装回滚及版本回归
licenses/     原作者与第三方完整许可
```

## 数据与授权

控制服务仅监听 `127.0.0.1:27946`，使用安装时随机生成的令牌；连接文件保存在 `%LOCALAPPDATA%/SpotifyLyricsCompanion/connection.json`。它包含本机密钥，不属于发布源码。界面设置保存在 `%APPDATA%/spotify-lyrics-hud`。源码包不含你的连接密钥、歌曲校时或个人设置。

歌词查询会向相应服务发送歌名、歌手和曲长，不需要输入 Spotify 或网易云密码。接口和歌词可用性由各服务决定。本项目不是 Spotify 官方产品；歌词版权归相应权利人所有。

HUD 与本仓库集成代码为 MIT；原作者许可原样保留在 `licenses/HUD-LICENSE.txt`。Spicetify CLI 2.46.4 为 LGPL-2.1，安装器附带对应源码与完整许可。原生版不分发 Electron/Chromium 运行时；JSON 解析使用 nlohmann/json v3.11.3（MIT）。其它依赖及修改范围见 [CREDITS.md](CREDITS.md) 和 [NOTICE.txt](NOTICE.txt)。GitHub 上传与署名步骤见 [RELEASING.md](RELEASING.md)。

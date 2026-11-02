# Spotify Lyrics Better HUD 1.2

基于 **[Fanbeixi / spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)** 的衍生项目，使用原作者 HUD 5.1.0 的窗口、设置界面与原生 SMTC 依赖，并添加 Windows Spotify 启动联动、A 按钮、网易云兜底和逐曲校时。感谢原作者提供的实现；完整署名见 [CREDITS.md](CREDITS.md)。本仓库的 **1.2** 是衍生版本号，不是原项目的版本号。

[下载 1.2](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [原作者项目](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)

## 安装与使用

支持 Windows x64、Spotify 官网桌面版。下载 Release 中的 **Spotify-Lyrics-HUD-Setup-v1.2.exe**，单独运行即可；无需附属文件。先登录一次 Spotify，再退出它，运行安装器并选择 `1` 安装/修复。管理员 CMD 与普通权限均支持，管理员调用 Spicetify 时使用其 `--bypass-admin` 参数。

打开 Spotify 后，麦克风左侧的 **A** 按钮开关桌面歌词。窗口可拖动、缩放；右键歌词托盘图标打开颜色与透明度设置。HUD 随 Spotify 启动和退出，属于独立的 Electron 进程。

字体按钮左侧为 `−0.5 / 秒数 / +0.5`：负数让歌词提前，正数让歌词延后，点击秒数归零。每首歌独立保存，缓存位于 Spotify 安装目录内的 `LyricsHUD/lyric-offsets.json`。切歌、重启后恢复，不修改音频文件。

安装器选项 `2` 停用启动联动与按钮，并保留个人设置和其它扩展；选项 `5` 导出源码及许可证。Spotify 更新后按钮失效时，重新运行安装/修复。

## 1.2 的同步改进

歌词顺序为 **LRCLIB → QQ 音乐 → 网易云音乐**。前一个来源没有可用同步歌词或请求失败时，继续下一个来源；同名歌会校验歌名、歌手、版本和曲长，避免误用搜索第一条。

播放时间优先来自 Spotify 客户端的 `Spicetify.Player.getProgress()`，通过现有的本地认证连接传给 HUD。按歌曲变化、暂停/恢复和跳转及时更新，并在本地用单调时钟推进到下一句。Windows SMTC 的读取时间不再被当作客户端进度的真实时间，迟到的系统事件也不会覆盖有效的客户端时钟。

桥接采样由 Electron 主进程通过 WebSocket 消息触发，避免 Spotify 最小化后的网页定时器节流。连接断开或超过 3.5 秒没有数据时，自动回退到 SMTC；重新连上后恢复客户端时钟。无须把所有歌曲统一强行提前。不同来源的 LRC 自身仍可能有偏移，逐曲按钮可单独修正。升级保留既有手动偏移；先前为补偿全局滞后设过的 `−0.5/−1`，可点击秒数归零后重新判断。

播放协调、歌词匹配、存储和本地控制分模块维护；切歌会取消旧请求，近期成功歌词最多缓存 8 首。隐藏或暂停不保留歌词行切换定时器；桥接连接保留低频保活，以检测恢复、暂停和断线。磁盘设置写入合并，歌词只在行号或播放状态变化时通知页面。Electron 仍是主要内存占用来源。

## 从源码构建

需要 Windows x64、Node.js **22+**、Windows 自带的 .NET Framework 4.x C# 编译器和 `tar.exe`。在仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

脚本下载 `dependencies.lock.json` 锁定的依赖并校验 SHA256，提取原作者运行时、复制本仓库唯一的 `app/` 源码，运行回归测试，编译 C# 启动器和控制台安装器，再执行安装器自检。结果在 `dist/`：

- `Spotify-Lyrics-HUD-Setup-v1.2.exe`：可独立分发的安装/加载器。
- `Spotify-Lyrics-HUD-Source-v1.2.zip`：可上传 GitHub 的源码、构建脚本与许可。
- `SHA256SUMS.txt`：下载校验值。

首次构建需要访问 GitHub 和 npm。使用代理时推荐 Node.js 24.5+，下载器会使用现有的 `HTTPS_PROXY/HTTP_PROXY/NO_PROXY` 配置。已缓存依赖后可离线重建：`Build.ps1 -CacheDir <缓存目录>`。构建不安装或修改本机 Spotify。再次运行测试可执行 `npm test`，无需额外 `npm install`。首次应先完整构建以准备测试依赖。

```text
app/          HUD 唯一源码：主进程、歌词源、计时、页面和资源
extension/    Spotify A 按钮和客户端进度桥接
installer/    C# 启动器、控制台安装器、PowerShell 安装步骤
scripts/      校验下载、运行时准备、测试与源码归档
tests/        时钟、桥接、匹配、校时、存储、控制及资源回归
licenses/     原作者与第三方完整许可
```

## 数据与授权

控制服务仅监听 `127.0.0.1:27946`，使用安装时随机生成的令牌；连接文件保存在 `%LOCALAPPDATA%/SpotifyLyricsCompanion/connection.json`。它包含本机密钥，不属于发布源码。界面设置保存在 `%APPDATA%/spotify-lyrics-hud`。源码包不含你的连接密钥、歌曲校时或个人设置。

歌词查询会向相应服务发送歌名、歌手和曲长，不需要输入 Spotify 或网易云密码。接口和歌词可用性由各服务决定。本项目不是 Spotify 官方产品；歌词版权归相应权利人所有。

HUD 与本仓库集成代码为 MIT；原作者许可原样保留在 `licenses/HUD-LICENSE.txt`。Spicetify CLI 2.46.4 为 LGPL-2.1，安装器附带对应源码与完整许可。Electron/Chromium 许可保留在运行时中。其它依赖及修改范围见 [CREDITS.md](CREDITS.md) 和 [NOTICE.txt](NOTICE.txt)。GitHub 上传与署名步骤见 [RELEASING.md](RELEASING.md)。

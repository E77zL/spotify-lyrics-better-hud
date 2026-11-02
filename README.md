# Spotify Lyrics Better HUD 1.2.1

基于 **[Fanbeixi / spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)** 的衍生项目，使用原作者 HUD 5.1.0 的窗口、设置界面与原生 SMTC 依赖，并添加 Windows Spotify 启动联动、A 按钮、网易云兜底和逐曲校时。感谢原作者提供的实现；完整署名见 [CREDITS.md](CREDITS.md)。本仓库的 **1.2.1** 是衍生版本号，不是原项目的版本号。

[下载 1.2.1](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [原作者项目](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)

## 效果展示

<img width="1500" height="1000" alt="image" src="https://github.com/user-attachments/assets/8fcde938-c67e-45d6-b507-bc0b4bc1a535" />

## 安装与使用

支持 Windows x64、Spotify 官网桌面版。下载 Release 中的 **Spotify-Lyrics-HUD-Setup-v1.2.1.exe**，单独运行即可；无需附属文件。先登录一次 Spotify，再退出它，运行安装器并选择 `1` 安装/修复。管理员 CMD 与普通权限均支持，管理员调用 Spicetify 时使用其 `--bypass-admin` 参数。

打开 Spotify 后，麦克风左侧的 **A** 按钮开关桌面歌词。窗口可拖动、缩放；右键歌词托盘图标打开颜色与透明度设置。Spotify 进程内的原生模块直接启动 HUD，歌词由 Electron 子进程显示；Spotify 退出时连接立即断开并关闭歌词。没有独立常驻 Launcher、开机监视程序或自动更新器。

安装器在 Spotify 目录添加 `version.dll` 和 `LyricsHUD/bridge.ini`，不修改 Spotify EXE。模块将版本查询转发到 Windows 系统 DLL，只在 Spotify 主进程启动歌词。已有其它插件的同名 DLL 时会拒绝覆盖。升级会移除旧 Launcher 和它的开机启动项；卸载只删除本项目模块，保留逐曲校时。

字体按钮左侧为 `−0.5 / 秒数 / +0.5`：负数让歌词提前，正数让歌词延后，点击秒数归零。每首歌独立保存，缓存位于 Spotify 安装目录内的 `LyricsHUD/lyric-offsets.json`。切歌、重启后恢复，不修改音频文件。

安装器选项 `2` 停用启动联动与按钮，并保留个人设置和其它扩展；选项 `5` 导出源码及许可证。Spotify 更新后按钮失效时，重新运行安装/修复。

## 更新日志

1.2.1 改进 Spotify 进程内联动、主动退出、设置原子保存和安装回滚，修复设置页面裁切及预设颜色不同步。原有 LRCLIB → QQ → 网易云、客户端进度同步和逐曲校时继续保留。

[查看更新日志](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [完整改动](CHANGELOG.md)

## 从源码构建

需要 Windows x64、Node.js **22+**、Visual Studio 2022/2026 或 Build Tools 的 **Desktop development with C++**（含 x64 编译器与 Windows SDK）、Windows 自带的 .NET Framework 4.x C# 编译器和 `tar.exe`。在仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1
```

脚本下载 `dependencies.lock.json` 锁定的依赖并校验 SHA256，提取原作者运行时、复制本仓库唯一的 `app/` 源码，运行回归测试，编译 C++ 进程模块和 C# 控制台安装器，再执行安装器自检。结果在 `dist/`：

- `Spotify-Lyrics-HUD-Setup-v1.2.1.exe`：可独立分发的安装/加载器。
- `Spotify-Lyrics-HUD-Source-v1.2.1.zip`：可上传 GitHub 的源码、构建脚本与许可。
- `SHA256SUMS.txt`：下载校验值。

首次构建需要访问 GitHub 和 npm。使用代理时推荐 Node.js 24.5+，下载器会使用现有的 `HTTPS_PROXY/HTTP_PROXY/NO_PROXY` 配置。已缓存依赖后可离线重建：`Build.ps1 -CacheDir <缓存目录>`。构建不安装或修改本机 Spotify。再次运行测试可执行 `npm test`，无需额外 `npm install`。首次应先完整构建以准备测试依赖。

```text
app/          HUD 唯一源码：主进程、歌词源、计时、页面和资源
extension/    Spotify A 按钮和客户端进度桥接
native/       Spotify 进程内 C++ 模块及系统 API 转发
installer/    控制台安装器、PowerShell 安装与迁移步骤
scripts/      校验下载、运行时准备、测试与源码归档
tests/        时钟、桥接、匹配、校时、存储、控制、生命周期及版本回归
licenses/     原作者与第三方完整许可
```

## 数据与授权

控制服务仅监听 `127.0.0.1:27946`，使用安装时随机生成的令牌；连接文件保存在 `%LOCALAPPDATA%/SpotifyLyricsCompanion/connection.json`。它包含本机密钥，不属于发布源码。界面设置保存在 `%APPDATA%/spotify-lyrics-hud`。源码包不含你的连接密钥、歌曲校时或个人设置。

歌词查询会向相应服务发送歌名、歌手和曲长，不需要输入 Spotify 或网易云密码。接口和歌词可用性由各服务决定。本项目不是 Spotify 官方产品；歌词版权归相应权利人所有。

HUD 与本仓库集成代码为 MIT；原作者许可原样保留在 `licenses/HUD-LICENSE.txt`。Spicetify CLI 2.46.4 为 LGPL-2.1，安装器附带对应源码与完整许可。Electron/Chromium 许可保留在运行时中。其它依赖及修改范围见 [CREDITS.md](CREDITS.md) 和 [NOTICE.txt](NOTICE.txt)。GitHub 上传与署名步骤见 [RELEASING.md](RELEASING.md)。

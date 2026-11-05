# Spotify Lyrics Better HUD

基于 **[Fanbeixi / spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)** 的衍生项目，使用原作者 HUD 5.1.0 的窗口、设置界面与原生 SMTC 依赖，并添加 Windows Spotify 启动联动、A 按钮、网易云兜底和逐曲校时。感谢原作者提供的实现；完整署名见 [CREDITS.md](CREDITS.md)。本仓库的 **1.2.2** 是衍生版本号，不是原项目的版本号。

[下载 1.2.2](https://github.com/E77zL/spotify-lyrics-better-hud/releases) · [原作者项目](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)

## 效果展示

<img width="1500" height="1000" alt="image" src="https://github.com/user-attachments/assets/8fcde938-c67e-45d6-b507-bc0b4bc1a535" />

<img width="630" height="824" alt="112-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/d586848c-e9e2-405d-a574-b2fd0a00ddc0" />

## 安装和使用

支持Windows 10以上系统，Spotify官网桌面版
下载Release中最新的exe程序，双击运行安装器并选择 `1` 安装/修复，安装后直接启动Spotify （管理员权限与普通权限均支持 管理员调用 Spicetify 时使用其 `--bypass-admin` 参数)
UI右下角麦克风左侧的图标为开关浮窗摁钮
窗口可拖动，鼠标抓住角落缩放，在全屏游戏时会让鼠标穿透浮窗以免跳出游戏进程

## 功能

没有独立Launcher、开机监视程序或自动更新器
本软件在Spotify安装目录添加 `version.dll` 和 `LyricsHUD/bridge.ini`，不修改 Spotify.exe
模块将版本查询转发到Windows系统DLL，只在Spotify主进程启动歌词
已有其它插件的同名 DLL 时会拒绝覆盖
升级会移除旧软件和它的开机启动项 (老版本实现歌词的方法是自启动独立进程)
卸载只删除本项目模块，保留逐曲校时

安装器选项 `2` 停用启动联动与按钮，并保留个人设置和其它扩展；选项 `5` 导出源码及许可证。Spotify 更新后按钮失效时，重新运行安装/修复

## 更新日志

[查看最新构建更新日志](https://github.com/E77zL/spotify-lyrics-better-hud/releases)

## 数据与授权

控制服务仅监听 `127.0.0.1:27946`，使用安装时随机生成的令牌；连接文件保存在 `%LOCALAPPDATA%/SpotifyLyricsCompanion/connection.json`。它包含本机密钥，不属于发布源码。界面设置保存在 `%APPDATA%/spotify-lyrics-hud`。源码包不含你的连接密钥、歌曲校时或个人设置。

歌词查询会向相应服务发送歌名、歌手和曲长，不需要输入 Spotify 或网易云密码。接口和歌词可用性由各服务决定。本项目不是 Spotify 官方产品；歌词版权归相应权利人所有。

HUD 与本仓库集成代码为 MIT；原作者许可原样保留在 `licenses/HUD-LICENSE.txt`。Spicetify CLI 2.46.4 为 LGPL-2.1，安装器附带对应源码与完整许可。Electron/Chromium 许可保留在运行时中。其它依赖及修改范围见 [CREDITS.md](CREDITS.md) 和 [NOTICE.txt](NOTICE.txt)。GitHub 上传与署名步骤见 [RELEASING.md](RELEASING.md)。

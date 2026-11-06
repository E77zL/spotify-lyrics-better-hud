using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Reflection;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Collections.Generic;

[assembly: AssemblyTitle("Spotify Lyrics HUD Companion Setup")]
[assembly: AssemblyDescription("Native in-process Spotify lyrics overlay")]
[assembly: AssemblyCompany("Lyrics HUD integration contributors")]
[assembly: AssemblyProduct("Spotify Lyrics HUD Companion")]
[assembly: AssemblyVersion("2.0.1.0")]
[assembly: AssemblyFileVersion("2.0.1.0")]

internal static class Installer
{
    private static readonly Assembly Self = Assembly.GetExecutingAssembly();
    private static readonly Dictionary<string, string> Hashes = new Dictionary<string, string>(StringComparer.Ordinal);
    private static bool NoPause;

    private static void Colored(string message, ConsoleColor color)
    {
        ConsoleColor old = Console.ForegroundColor;
        Console.ForegroundColor = color;
        Console.WriteLine(message);
        Console.ForegroundColor = old;
    }
    private static void Header()
    {
        if (!Console.IsOutputRedirected) { try { Console.Clear(); } catch { } }
        Console.WriteLine();
        Colored("  +----------------------------------------------------+", ConsoleColor.DarkGreen);
        Colored("  |    S P O T I F Y   /   L Y R I C S   H U D         |", ConsoleColor.Green);
        Colored("  |    NATIVE HUD SETUP v2.0.1 // SAME PROCESS           |", ConsoleColor.Green);
        Colored("  +----------------------------------------------------+", ConsoleColor.DarkGreen);
        Console.WriteLine();
        Console.WriteLine("  Spotify 启动联动 + A 按钮开关 · Windows x64");
        Colored("  原生 Spotify 歌词窗口；基于 Fanbeixi 歌词逻辑。", ConsoleColor.DarkGray);
        Console.WriteLine();
    }
    private static Stream OpenResource(string name)
    {
        Stream stream = Self.GetManifestResourceStream("payload." + name);
        if (stream == null) throw new InvalidDataException("Missing payload: " + name);
        return new DeflateStream(stream, CompressionMode.Decompress);
    }
    private static bool HasResource(string name)
    {
        using (Stream stream = Self.GetManifestResourceStream("payload." + name)) return stream != null;
    }
    private static void LoadManifest()
    {
        string content;
        using (var reader = new StreamReader(OpenResource("manifest.sha256"), Encoding.UTF8)) content = reader.ReadToEnd();
        foreach (string row in content.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            int split = row.IndexOf("  ", StringComparison.Ordinal);
            if (split != 64) throw new InvalidDataException("Invalid payload manifest");
            string name = row.Substring(split + 2);
            if (name != Path.GetFileName(name) || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                throw new InvalidDataException("Unsafe payload name");
            Hashes.Add(name, row.Substring(0, split));
        }
        if (Hashes.Count != 19) throw new InvalidDataException("Unexpected payload count");
    }
    private static void CopyVerified(string name, Stream destination)
    {
        using (Stream source = OpenResource(name))
        using (SHA256 hash = SHA256.Create())
        {
            // Hash while extracting. Large payloads never become large managed arrays.
            byte[] buffer = new byte[65536];
            int count;
            while ((count = source.Read(buffer, 0, buffer.Length)) != 0)
            {
                hash.TransformBlock(buffer, 0, count, buffer, 0);
                if (destination != null) destination.Write(buffer, 0, count);
            }
            hash.TransformFinalBlock(new byte[0], 0, 0);
            string actual = BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant();
            if (!String.Equals(actual, Hashes[name], StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Payload hash mismatch: " + name);
        }
    }
    private static void ExtractVerified(string name, string file)
    {
        bool created = false;
        try
        {
            using (var output = new FileStream(file, FileMode.CreateNew, FileAccess.Write))
            { created = true; CopyVerified(name, output); }
        }
        catch { if (created) File.Delete(file); throw; }
    }
    private static int RunAction(string action)
    {
        string tempBase = Path.GetFullPath(Path.GetTempPath());
        string temp = Path.Combine(tempBase, "SpotifyNetEaseSetup-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        try
        {
            foreach (string name in Hashes.Keys)
                if (HasResource(name)) ExtractVerified(name, Path.Combine(temp, name));
            string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
            if (!File.Exists(powershell)) throw new FileNotFoundException("Windows PowerShell 5.1 is required.");
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = powershell;
            info.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(temp, "ConsoleActions.ps1") + "\" -Action " + action;
            info.UseShellExecute = false;
            info.WorkingDirectory = temp;
            // Do not inherit a PowerShell 7-only module path into Windows PowerShell 5.1.
            info.EnvironmentVariables["PSModulePath"] =
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "WindowsPowerShell", "Modules") + ";" +
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "WindowsPowerShell", "Modules") + ";" +
                Path.Combine(Path.GetDirectoryName(powershell), "Modules");
            using (Process child = Process.Start(info)) { child.WaitForExit(); return child.ExitCode; }
        }
        finally
        {
            // Delete only the unique staging directory created by this invocation.
            string resolved = Path.GetFullPath(temp);
            if (String.Equals(Path.GetDirectoryName(resolved).TrimEnd(Path.DirectorySeparatorChar), tempBase.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase)
                && Path.GetFileName(resolved).StartsWith("SpotifyNetEaseSetup-", StringComparison.Ordinal))
            {
                try { Directory.Delete(resolved, true); }
                catch { Colored("  临时文件暂时被占用，系统临时目录中保留了安装缓存。", ConsoleColor.DarkGray); }
            }
        }
    }
    private static void Instructions()
    {
        Console.WriteLine("  01  先打开一次 Spotify 官网桌面版并登录，然后退出。");
        Console.WriteLine("  02  返回主菜单选择 1，等待安装完成。");
        Console.WriteLine("  03  打开 Spotify，麦克风左侧 A 按钮控制 HUD 显示/隐藏。");
        Console.WriteLine();
        Console.WriteLine("  · 原生歌词窗口由 Spotify.exe 内部承载，沿用上游歌词逻辑。");
        Console.WriteLine("  · LRCLIB → QQ → 网易云，前两个都无可用歌词时才查询网易云。");
        Console.WriteLine("  · 打开 / 关闭歌词带快速淡入淡出，悬停歌词使用上方工具栏调节。");
        Console.WriteLine("  · 歌词窗口和 Spotify 使用同一 PID，同步结束。关闭显示会被记住。");
        Console.WriteLine("  · 联动模块由 Spotify 本身加载，没有独立常驻启动器或自动更新程序。");
        Console.WriteLine("  · Spotify 更新后扩展失效时，重新运行本程序选择安装 / 修复。");
        Console.WriteLine(HasResource("spicetify-windows-x64.zip")
            ? "  · 离线版内置 Spicetify v2.46.4，已有版本会直接沿用。"
            : "  · 轻量版复用已有 Spicetify；缺少时下载固定版本并校验 SHA256。");
        Console.WriteLine("  · 卸载停用启动联动和按钮，保留 HUD 设置和其他扩展。");
        Console.WriteLine("  · 管理员窗口与普通窗口均支持安装。");
        Console.WriteLine("  · Spotify 内置 Marketplace 入口，可选主题、扩展和 CSS 小组件。");
        Console.WriteLine();
        Colored("  本程序不是 Spotify 官方产品。HUD 版权归上游作者所有。", ConsoleColor.DarkGray);
        Colored("  HUD / 集成代码：MIT；Spicetify：LGPL-2.1。", ConsoleColor.DarkGray);
        Colored("  菜单 5 可导出集成源码、Spicetify 源码和授权。", ConsoleColor.DarkGray);
    }
    private static void ExportSources()
    {
        Console.Write("  源码与授权文件的导出目录（直接回车取消）：");
        string input = Console.ReadLine();
        if (String.IsNullOrWhiteSpace(input)) return;
        string destination = Path.GetFullPath(input.Trim().Trim('"'));
        Directory.CreateDirectory(destination);
        foreach (string name in new string[] { "spicetify-source-v2.46.4.tar.gz", "HUD-INTEGRATION-SOURCE.zip", "HUD-LICENSE.txt", "SPICETIFY-LICENSE", "MARKETPLACE-LICENSE.txt", "LICENSE", "NOTICE.txt" })
        {
            string output = Path.Combine(destination, name);
            if (File.Exists(output)) throw new IOException("文件已存在，未覆盖：" + output);
            ExtractVerified(name, output);
        }
        Colored("  源码及授权文件已导出到：" + destination, ConsoleColor.Green);
    }
    private static void Pause()
    {
        if (NoPause || Console.IsInputRedirected) return;
        Console.WriteLine();
        Colored("  按回车返回菜单…", ConsoleColor.DarkGray);
        Console.ReadLine();
    }
    public static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = new UTF8Encoding(false);
            Console.InputEncoding = Encoding.UTF8;
            if (!Console.IsOutputRedirected) Console.Title = "Spotify // Lyrics HUD Companion Setup 2.0.1";
            LoadManifest();
            NoPause = args.Length > 0;
            if (args.Length > 0)
            {
                if (args[0] == "--self-test")
                {
                    foreach (string name in Hashes.Keys)
                    {
                        if (!HasResource(name))
                        {
                            if (name != "spicetify-windows-x64.zip") throw new InvalidDataException("Missing payload: " + name);
                            Console.WriteLine("PASS optional pinned dependency " + name);
                            continue;
                        }
                        CopyVerified(name, null); Console.WriteLine("PASS SHA256 " + name);
                    }
                    int result = RunAction("Verify");
                    Console.WriteLine(result == 0 ? "PASS single-file extraction / PowerShell verification / cleanup" : "FAIL payload verification");
                    return result;
                }
                if (args[0] == "--diagnose") return RunAction("Diagnose");
                if (args[0] == "--install") return RunAction("Install");
                if (args[0] == "--uninstall") return RunAction("Uninstall");
                if (args[0] == "--help") { Header(); Instructions(); return 0; }
                Console.WriteLine("Usage: Spotify-Lyrics-HUD-Setup-v2.0.1.exe [--self-test | --diagnose | --help | --install | --uninstall]");
                return 2;
            }
            for (;;)
            {
                Header();
                Console.WriteLine("  [1] 安装 / 修复 HUD + Spotify 联动");
                Console.WriteLine("  [2] 停用 HUD 联动和 A 按钮");
                Console.WriteLine("  [3] 检查环境");
                Console.WriteLine("  [4] 使用说明");
                Console.WriteLine("  [5] 导出开源组件源码与授权");
                Console.WriteLine("  [0] 退出");
                Console.WriteLine();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.Write("  setup > ");
                Console.ResetColor();
                string input = Console.ReadLine();
                if (input == null || input.Trim() == "0") return 0;
                Console.WriteLine();
                switch (input.Trim())
                {
                    case "1": RunAction("Install"); break;
                    case "2":
                        Console.Write("  确定停用 HUD 联动？输入 Y 继续：");
                        if (String.Equals(Console.ReadLine(), "Y", StringComparison.OrdinalIgnoreCase)) RunAction("Uninstall");
                        break;
                    case "3": RunAction("Diagnose"); break;
                    case "4": Instructions(); break;
                    case "5": ExportSources(); break;
                    default: Colored("  请输入菜单中的数字。", ConsoleColor.Yellow); break;
                }
                Pause();
            }
        }
        catch (Exception error)
        {
            Colored("  [ERROR] " + error.Message, ConsoleColor.Red);
            if (!NoPause && !Console.IsInputRedirected) { Console.WriteLine("  按回车退出。"); Console.ReadLine(); }
            return 1;
        }
    }
}

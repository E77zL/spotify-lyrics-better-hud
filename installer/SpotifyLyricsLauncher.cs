using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.IO.Pipes;

[assembly: System.Reflection.AssemblyTitle("Spotify Lyrics HUD Companion Launcher")]
[assembly: System.Reflection.AssemblyVersion("1.2.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.0.0")]

// The small launcher waits for Spotify. Electron runs only while Spotify runs.
internal static class SpotifyLyricsLauncher
{
    private static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    private static readonly int Session = Process.GetCurrentProcess().SessionId;
    private static readonly string EventName = "Local\\SpotifyLyricsHUD.Stop." + Session + "." + RootId();
    private static Process hud;
    private static NamedPipeServerStream lifetime;
    private static string token;
#if HUD_LIFECYCLE_TEST
    private const string SpotifyName = "SpotifyHudQA";
    private const int ControlPort = 27949;
#else
    private const string SpotifyName = "Spotify";
    private const int ControlPort = 27946;
#endif

    private static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--stop")
        {
            try { using (EventWaitHandle stop = EventWaitHandle.OpenExisting(EventName)) stop.Set(); } catch (WaitHandleCannotBeOpenedException) { }
            return 0;
        }
        bool created;
        using (Mutex singleton = new Mutex(true, EventName + ".Mutex", out created))
        {
            if (!created) return 0;
            try
            {
                string connectionFile = Path.Combine(Root, "connection.json");
                var connection = new JavaScriptSerializer().Deserialize<Connection>(File.ReadAllText(connectionFile));
                token = connection.token;
                if (connection.port != ControlPort || string.IsNullOrEmpty(token) || token.Length != 64) throw new InvalidDataException("Invalid connection.json");
                using (var stop = new EventWaitHandle(false, EventResetMode.ManualReset, EventName))
                using (var changed = new AutoResetEvent(false))
                using (var spotify = new SpotifyWatch(changed))
                {
                    DateTime lastStart = DateTime.MinValue;
                    var waits = new WaitHandle[] { stop, changed };
                    while (true)
                    {
                        bool running = spotify.Refresh();
                        if (running && (hud == null || hud.HasExited) && (DateTime.UtcNow - lastStart).TotalSeconds >= 10)
                        {
                            lastStart = DateTime.UtcNow;
                            try { StartHud(connectionFile); }
                            catch (Exception error) { StopHud(); Log(error); }
                        }
                        if (!running && hud != null) { StopHud(); lastStart = DateTime.MinValue; }
                        // Exited wakes this wait immediately. The timeout discovers launches
                        // and new helpers; it never delays an already tracked main's exit.
                        if (WaitHandle.WaitAny(waits, spotify.RequiresPolling ? 50 : 1000) == 0) break;
                    }
                    StopHud();
                }
                return 0;
            }
            catch (Exception error)
            {
                StopHud();
                Log(error);
                return 1;
            }
        }
    }

    private static void StartHud(string connectionFile)
    {
        if (hud != null) { hud.Dispose(); hud = null; }
        CloseLifetime();
        string pipeName = "SpotifyLyricsHUD.Lifetime." + Guid.NewGuid().ToString("N");
        var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
        lifetime = pipe;
        pipe.BeginWaitForConnection(result => { try { pipe.EndWaitForConnection(result); } catch { } }, null);
        var info = new ProcessStartInfo(Path.Combine(Root, "HUD", "Spotify悬浮歌词.exe"), "--managed-by-spotify");
        info.WorkingDirectory = Path.Combine(Root, "HUD"); info.UseShellExecute = false; info.CreateNoWindow = true;
        info.RedirectStandardOutput = true; info.RedirectStandardError = true;
        info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
        info.EnvironmentVariables.Remove("NODE_OPTIONS");
        info.EnvironmentVariables["SPOTIFY_HUD_CONNECTION"] = connectionFile;
        info.EnvironmentVariables["SPOTIFY_HUD_LIFETIME_PIPE"] = @"\\.\pipe\" + pipeName;
        hud = Process.Start(info);
#if HUD_LIFECYCLE_TEST
        hud.ErrorDataReceived += (sender, output) => { if (output.Data != null) Log(new Exception(output.Data)); };
#endif
        hud.BeginOutputReadLine(); hud.BeginErrorReadLine();
    }

    private sealed class SpotifyWatch : IDisposable
    {
        private readonly AutoResetEvent changed;
        private readonly Dictionary<int, Process> mains = new Dictionary<int, Process>();
        private readonly HashSet<int> helpers = new HashSet<int>();
        private readonly HashSet<int> previousIds = new HashSet<int>();
        private readonly HashSet<int> pollingMains = new HashSet<int>();
        internal bool RequiresPolling { get { return pollingMains.Count != 0; } }
        internal SpotifyWatch(AutoResetEvent changed) { this.changed = changed; }
        private void Exited(object sender, EventArgs args) { try { changed.Set(); } catch (ObjectDisposedException) { } }

        internal bool Refresh()
        {
            // One native snapshot; no Process objects for every helper on every poll.
            var current = SpotifyProcesses();
            helpers.RemoveWhere(id => !current.ContainsKey(id));
            foreach (var pair in current)
            {
                // Helper renderers may outlive the main process. Remember their
                // identity so they are not mistaken for a fresh Spotify launch.
                if (!mains.ContainsKey(pair.Key)
                    && (current.ContainsKey(pair.Value) || previousIds.Contains(pair.Value))) helpers.Add(pair.Key);
            }
            foreach (int id in new List<int>(mains.Keys))
            {
                bool exited;
                try { exited = mains[id].HasExited; } catch { exited = !current.ContainsKey(id); }
                if (exited || !current.ContainsKey(id)) { mains[id].Dispose(); mains.Remove(id); pollingMains.Remove(id); }
            }
            foreach (var pair in current)
            {
                if (mains.ContainsKey(pair.Key) || helpers.Contains(pair.Key)) continue;
                Process process;
                try { process = Process.GetProcessById(pair.Key); } catch (ArgumentException) { continue; }
                mains.Add(pair.Key, process);
                try
                {
                    process.Exited += Exited;
#if HUD_LIFECYCLE_TEST
                    if (Environment.GetEnvironmentVariable("HUD_TEST_POLLING") == "1") throw new System.ComponentModel.Win32Exception(5);
#endif
                    process.EnableRaisingEvents = true;
                }
                catch
                {
                    // Elevated Spotify or a restricted desktop may deny a wait
                    // handle. Keep working using a short process-snapshot check.
                    pollingMains.Add(pair.Key);
                }
            }
            // Retain dead parents only while a live Spotify child references them.
            previousIds.IntersectWith(current.Values);
            previousIds.UnionWith(current.Keys);
            return mains.Count != 0;
        }

        public void Dispose() { foreach (var process in mains.Values) process.Dispose(); mains.Clear(); }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ProcessEntry
    {
        public uint size, usage, pid;
        public IntPtr heap;
        public uint module, threads, parent;
        public int priority;
        public uint flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string name;
    }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32FirstW")] private static extern bool ProcessFirst(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32NextW")] private static extern bool ProcessNext(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] private static extern bool ProcessIdToSessionId(uint pid, out uint session);
    private static Dictionary<int, int> SpotifyProcesses()
    {
        var result = new Dictionary<int, int>();
        IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
        if (snapshot == new IntPtr(-1)) throw new System.ComponentModel.Win32Exception();
        try
        {
            var entry = new ProcessEntry(); entry.size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
            if (ProcessFirst(snapshot, ref entry)) do
            {
                uint session;
                if (String.Equals(entry.name, SpotifyName + ".exe", StringComparison.OrdinalIgnoreCase)
                    && ProcessIdToSessionId(entry.pid, out session) && session == Session) result[(int)entry.pid] = (int)entry.parent;
            } while (ProcessNext(snapshot, ref entry));
        }
        finally { CloseHandle(snapshot); }
        return result;
    }

    private static string RootId()
    {
        using (var sha = SHA256.Create()) { return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Root.ToUpperInvariant()))).Replace("-", "").Substring(0, 16); }
    }

    private static void Log(Exception error)
    {
        try { File.AppendAllText(Path.Combine(Root, "launcher-error.log"), DateTime.UtcNow.ToString("o") + " " + error.Message + Environment.NewLine); } catch { }
    }

    private static void StopHud()
    {
        CloseLifetime();
        if (hud == null) return;
        try
        {
            if (!hud.HasExited)
            {
                // Named-pipe EOF reaches GUI Electron reliably on Windows.
                // It hides before potentially slow tracker cleanup.
                if (hud.WaitForExit(250)) return;
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + ControlPort + "/shutdown");
                    request.Proxy = null; request.Method = "POST"; request.Headers["X-Hud-Token"] = token; request.ContentLength = 0;
                    request.Timeout = 1000;
                    using (var response = request.GetResponse()) { }
                }
                catch { }
                if (!hud.WaitForExit(3000)) hud.Kill();
            }
        }
        catch { }
        finally { hud.Dispose(); hud = null; }
    }

    private static void CloseLifetime()
    {
        if (lifetime != null) { try { lifetime.Dispose(); } catch { } lifetime = null; }
    }

    private sealed class Connection { public int port { get; set; } public string token { get; set; } }
}

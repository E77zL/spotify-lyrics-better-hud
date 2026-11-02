// MIT. Loaded by the user's Spotify installation; no remote-process injection.
// The Windows version APIs remain backed by the real System32 version.dll.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winver.h>
#include <bcrypt.h>
#include <algorithm>
#include <cwchar>
#include <string>
#include <vector>

static HMODULE moduleHandle;
static INIT_ONCE versionOnce = INIT_ONCE_STATIC_INIT;
static HMODULE systemVersion;

static BOOL CALLBACK LoadSystemVersion(PINIT_ONCE, PVOID, PVOID*) {
    wchar_t file[MAX_PATH] = {};
    const UINT length = GetSystemDirectoryW(file, MAX_PATH);
    if (length && length < MAX_PATH - 13 && wcscat_s(file, L"\\version.dll") == 0)
        systemVersion = LoadLibraryExW(file, nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    return TRUE; // A failed forward reports an API error; never stop Spotify.
}

static FARPROC VersionApi(const char* name) {
    InitOnceExecuteOnce(&versionOnce, LoadSystemVersion, nullptr, nullptr);
    const FARPROC result = systemVersion ? GetProcAddress(systemVersion, name) : nullptr;
    if (!result) SetLastError(ERROR_PROC_NOT_FOUND);
    return result;
}

// The prefix avoids redefining the SDK's dllimport declarations. The .def maps
// public Windows names to these strictly typed wrappers.
#define FORWARD(name, type, params, args) \
    extern "C" type WINAPI Hud_##name params { \
        static const auto function = reinterpret_cast<decltype(&::name)>(VersionApi(#name)); \
        if (!function) { SetLastError(ERROR_PROC_NOT_FOUND); return 0; } \
        return function args; \
    }
FORWARD(GetFileVersionInfoSizeA, DWORD, (LPCSTR f, LPDWORD h), (f, h))
FORWARD(GetFileVersionInfoSizeW, DWORD, (LPCWSTR f, LPDWORD h), (f, h))
FORWARD(GetFileVersionInfoSizeExA, DWORD, (DWORD flags, LPCSTR f, LPDWORD h), (flags, f, h))
FORWARD(GetFileVersionInfoSizeExW, DWORD, (DWORD flags, LPCWSTR f, LPDWORD h), (flags, f, h))
FORWARD(GetFileVersionInfoA, BOOL, (LPCSTR f, DWORD h, DWORD n, LPVOID p), (f, h, n, p))
FORWARD(GetFileVersionInfoW, BOOL, (LPCWSTR f, DWORD h, DWORD n, LPVOID p), (f, h, n, p))
FORWARD(GetFileVersionInfoExA, BOOL, (DWORD flags, LPCSTR f, DWORD h, DWORD n, LPVOID p), (flags, f, h, n, p))
FORWARD(GetFileVersionInfoExW, BOOL, (DWORD flags, LPCWSTR f, DWORD h, DWORD n, LPVOID p), (flags, f, h, n, p))
FORWARD(VerQueryValueA, BOOL, (LPCVOID p, LPCSTR block, LPVOID* out, PUINT n), (p, block, out, n))
FORWARD(VerQueryValueW, BOOL, (LPCVOID p, LPCWSTR block, LPVOID* out, PUINT n), (p, block, out, n))
FORWARD(VerLanguageNameA, DWORD, (DWORD language, LPSTR out, DWORD n), (language, out, n))
FORWARD(VerLanguageNameW, DWORD, (DWORD language, LPWSTR out, DWORD n), (language, out, n))
FORWARD(VerFindFileA, DWORD, (DWORD flags, LPCSTR f, LPCSTR win, LPCSTR app, LPSTR current, PUINT cn, LPSTR dest, PUINT dn), (flags, f, win, app, current, cn, dest, dn))
FORWARD(VerFindFileW, DWORD, (DWORD flags, LPCWSTR f, LPCWSTR win, LPCWSTR app, LPWSTR current, PUINT cn, LPWSTR dest, PUINT dn), (flags, f, win, app, current, cn, dest, dn))
FORWARD(VerInstallFileA, DWORD, (DWORD flags, LPCSTR src, LPCSTR dest, LPCSTR sd, LPCSTR dd, LPCSTR current, LPSTR temp, PUINT n), (flags, src, dest, sd, dd, current, temp, n))
FORWARD(VerInstallFileW, DWORD, (DWORD flags, LPCWSTR src, LPCWSTR dest, LPCWSTR sd, LPCWSTR dd, LPCWSTR current, LPWSTR temp, PUINT n), (flags, src, dest, sd, dd, current, temp, n))

class Handle {
public:
    HANDLE value;
    explicit Handle(HANDLE handle = nullptr) : value(handle) {}
    ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
};

static std::wstring ModuleDirectory() {
    wchar_t file[32768] = {};
    const DWORD length = GetModuleFileNameW(moduleHandle, file, ARRAYSIZE(file));
    if (!length || length == ARRAYSIZE(file)) return {};
    const wchar_t* slash = wcsrchr(file, L'\\');
    return slash ? std::wstring(file, static_cast<size_t>(slash - file)) : std::wstring();
}

static std::wstring Setting(const std::wstring& file, const wchar_t* key) {
    wchar_t value[32768] = {};
    GetPrivateProfileStringW(L"LyricsHUD", key, L"", value, ARRAYSIZE(value), file.c_str());
    return value;
}

static std::vector<wchar_t> ChildEnvironment(const std::wstring& connection, const std::wstring& pipe) {
    std::vector<std::wstring> entries;
    LPWCH block = GetEnvironmentStringsW();
    if (!block) return {};
    for (const wchar_t* entry = block; *entry; entry += wcslen(entry) + 1) {
        const wchar_t* equal = wcschr(entry, L'=');
        const std::wstring key(entry, equal ? equal : entry);
        if (_wcsicmp(key.c_str(), L"ELECTRON_RUN_AS_NODE") == 0 ||
            _wcsicmp(key.c_str(), L"NODE_OPTIONS") == 0 ||
            _wcsicmp(key.c_str(), L"SPOTIFY_HUD_CONNECTION") == 0 ||
            _wcsicmp(key.c_str(), L"SPOTIFY_HUD_LIFETIME_PIPE") == 0 ||
            _wcsicmp(key.c_str(), L"SPOTIFY_HUD_PARENT_PID") == 0) continue;
        entries.emplace_back(entry);
    }
    FreeEnvironmentStringsW(block);
    entries.push_back(L"SPOTIFY_HUD_CONNECTION=" + connection);
    entries.push_back(L"SPOTIFY_HUD_LIFETIME_PIPE=" + pipe);
    entries.push_back(L"SPOTIFY_HUD_PARENT_PID=" + std::to_wstring(GetCurrentProcessId()));
    std::sort(entries.begin(), entries.end(), [](const auto& a, const auto& b) { return _wcsicmp(a.c_str(), b.c_str()) < 0; });
    std::vector<wchar_t> result;
    for (const auto& entry : entries) { result.insert(result.end(), entry.begin(), entry.end()); result.push_back(0); }
    result.push_back(0);
    return result;
}

class PipeConnection {
    HANDLE pipe;
    Handle ready;
    OVERLAPPED operation = {};
    bool pending = false;
public:
    explicit PipeConnection(HANDLE handle) : pipe(handle), ready(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}
    bool connect() {
        if (!ready) return false;
        operation.hEvent = ready.value;
        if (ConnectNamedPipe(pipe, &operation)) return true;
        const DWORD error = GetLastError();
        pending = error == ERROR_IO_PENDING;
        return pending || error == ERROR_PIPE_CONNECTED;
    }
    ~PipeConnection() {
        if (pending) {
            CancelIoEx(pipe, &operation);
            DWORD ignored;
            GetOverlappedResult(pipe, &operation, &ignored, TRUE);
        }
    }
};

// Return true only for a failure worth retrying. An intentional HUD quit stays quit.
static bool RunHud(const std::wstring& root) {
    const std::wstring exe = root + L"\\HUD\\Spotify悬浮歌词.exe";
    const std::wstring connection = root + L"\\connection.json";
    if (GetFileAttributesW(exe.c_str()) == INVALID_FILE_ATTRIBUTES ||
        GetFileAttributesW(connection.c_str()) == INVALID_FILE_ATTRIBUTES) return false;
    unsigned char random[16];
    if (BCryptGenRandom(nullptr, random, sizeof(random), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) return true;
    std::wstring pipe = L"\\\\.\\pipe\\SpotifyLyricsHUD.Lifetime.";
    for (const unsigned char byte : random) { pipe += L"0123456789abcdef"[byte >> 4]; pipe += L"0123456789abcdef"[byte & 15]; }
    // No inheritable handles: only Spotify owns the server. Its exit (including
    // a crash) closes it, so the renderer receives EOF without a polling delay.
    Handle life(CreateNamedPipeW(pipe.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED | FILE_FLAG_FIRST_PIPE_INSTANCE,
        PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS, 1, 1024, 1024, 0, nullptr));
    if (!life) return true;
    PipeConnection pending(life.value);
    if (!pending.connect()) return true;
    auto environment = ChildEnvironment(connection, pipe);
    if (environment.empty()) return true;
    std::wstring command = L"\"" + exe + L"\" --managed-by-spotify";
    STARTUPINFOW startup = {}; startup.cb = sizeof(startup);
    PROCESS_INFORMATION child = {};
    const std::wstring directory = root + L"\\HUD";
    if (!CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE,
        CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW, environment.data(), directory.c_str(), &startup, &child)) return true;
    Handle process(child.hProcess);
    CloseHandle(child.hThread);
    // This thread belongs to Spotify, and has no wakeups while the HUD lives.
    DWORD exitCode = 1;
    if (WaitForSingleObject(process.value, INFINITE) != WAIT_OBJECT_0) return true;
    return !GetExitCodeProcess(process.value, &exitCode) || exitCode != 0;
}

static DWORD WINAPI BridgeThread(void*) {
    try {
        const std::wstring spotify = ModuleDirectory();
        const std::wstring config = spotify + L"\\LyricsHUD\\bridge.ini";
        const std::wstring root = Setting(config, L"InstallRoot");
        const bool absolute = (root.size() > 2 && root[1] == L':' && root[2] == L'\\') || root.compare(0, 2, L"\\\\") == 0;
        if (!absolute || root.find_first_of(L"\"\r\n") != std::wstring::npos ||
            !GetPrivateProfileIntW(L"LyricsHUD", L"Enabled", 0, config.c_str())) return 0;
        // Windows attaches this module once per process. No extra mutex or
        // polling handle is needed while the child lives.
        while (GetPrivateProfileIntW(L"LyricsHUD", L"Enabled", 0, config.c_str())) {
            if (!RunHud(root)) break;
            Sleep(10000);
        }
    } catch (...) { /* A lyrics failure must never propagate into Spotify. */ }
    return 0;
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        moduleHandle = instance;
        // Do not load another DLL or wait under the loader lock. The worker
        // starts only after Windows finishes this module's attach callback.
        wchar_t host[32768] = {};
        const DWORD length = GetModuleFileNameW(nullptr, host, ARRAYSIZE(host));
        const wchar_t* name = length && length < ARRAYSIZE(host) ? wcsrchr(host, L'\\') : nullptr;
#ifdef HUD_BRIDGE_TEST
        const wchar_t* expected = L"SpotifyBridgeTest.exe";
#else
        const wchar_t* expected = L"Spotify.exe";
#endif
        if (name && _wcsicmp(name + 1, expected) == 0 && !wcsstr(GetCommandLineW(), L"--type=")) {
            HANDLE thread = CreateThread(nullptr, 0, BridgeThread, nullptr, 0, nullptr);
            if (thread) CloseHandle(thread);
        }
    }
    return TRUE;
}

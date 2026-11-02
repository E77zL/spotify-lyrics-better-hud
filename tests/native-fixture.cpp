// MIT. A real Windows import-table host and a pipe-reading child for lifecycle QA.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winver.h>
#include <tlhelp32.h>
#include <cstdio>
#include <string>
#include <vector>

static std::wstring Env(const wchar_t* key) {
    wchar_t value[32768] = {};
    GetEnvironmentVariableW(key, value, ARRAYSIZE(value));
    return value;
}

static void Report(const wchar_t* name, const std::string& content) {
    FILE* file = nullptr;
    const auto path = Env(L"HUD_TEST_DIR") + L"\\" + name;
    if (_wfopen_s(&file, path.c_str(), L"wb") == 0) {
        fwrite(content.data(), 1, content.size(), file);
        fclose(file);
    }
}

static int Child() {
    const auto host = Env(L"SPOTIFY_HUD_PARENT_PID");
    DWORD parent = 0;
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    PROCESSENTRY32W entry = {}; entry.dwSize = sizeof(entry);
    if (snapshot != INVALID_HANDLE_VALUE) {
        if (Process32FirstW(snapshot, &entry)) do {
            if (entry.th32ProcessID == GetCurrentProcessId()) parent = entry.th32ParentProcessID;
        } while (Process32NextW(snapshot, &entry));
        CloseHandle(snapshot);
    }
    const auto pipe = Env(L"SPOTIFY_HUD_LIFETIME_PIPE");
    HANDLE connection = CreateFileW(pipe.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
    if (connection == INVALID_HANDLE_VALUE || host != std::to_wstring(parent) ||
        !Env(L"ELECTRON_RUN_AS_NODE").empty() || !Env(L"NODE_OPTIONS").empty() ||
        Env(L"SPOTIFY_HUD_CONNECTION") != Env(L"HUD_TEST_ROOT") + L"\\connection.json") return 10;
    Report(L"child.json", "{\"pid\":" + std::to_string(GetCurrentProcessId()) + ",\"parent\":" + std::to_string(parent) + "}");
    if (Env(L"HUD_TEST_CLEAN_EXIT") == L"1") { CloseHandle(connection); Report(L"clean-exit.json", "{}"); return 0; }
    char byte; DWORD count;
    ReadFile(connection, &byte, 1, &count, nullptr);
    CloseHandle(connection);
    Report(L"closed.json", "{\"at\":" + std::to_string(GetTickCount64()) + "}");
    return 0;
}

int wmain(int argc, wchar_t** argv) {
    if (argc > 1 && wcscmp(argv[1], L"--managed-by-spotify") == 0) return Child();
    wchar_t system[MAX_PATH] = {};
    GetSystemDirectoryW(system, MAX_PATH);
    const std::wstring file = std::wstring(system) + L"\\kernel32.dll";
    const auto real = LoadLibraryW((std::wstring(system) + L"\\version.dll").c_str());
    if (!real) return 20;
    const auto sizeFn = reinterpret_cast<decltype(&GetFileVersionInfoSizeW)>(GetProcAddress(real, "GetFileVersionInfoSizeW"));
    const auto readFn = reinterpret_cast<decltype(&GetFileVersionInfoW)>(GetProcAddress(real, "GetFileVersionInfoW"));
    DWORD ignored;
    const auto size = GetFileVersionInfoSizeW(file.c_str(), &ignored);
    if (!size || !sizeFn || !readFn || size != sizeFn(file.c_str(), &ignored)) return 21;
    std::vector<unsigned char> proxied(size), original(size);
    if (!GetFileVersionInfoW(file.c_str(), 0, size, proxied.data()) || !readFn(file.c_str(), 0, size, original.data()) || proxied != original) return 22;
    LPVOID value = nullptr; UINT length = 0;
    if (!VerQueryValueW(proxied.data(), L"\\", &value, &length) || length < sizeof(VS_FIXEDFILEINFO) ||
        static_cast<VS_FIXEDFILEINFO*>(value)->dwSignature != VS_FFI_SIGNATURE) return 23;
    wchar_t module[32768] = {};
    GetModuleFileNameW(GetModuleHandleW(L"version.dll"), module, ARRAYSIZE(module));
    wchar_t exe[32768] = {}; GetModuleFileNameW(nullptr, exe, ARRAYSIZE(exe));
    std::wstring directory(exe); directory.resize(directory.find_last_of(L'\\'));
    if (_wcsicmp(module, (directory + L"\\version.dll").c_str()) != 0) return 24;
    FreeLibrary(real);
    Report(L"host.json", "{\"forwarding\":true,\"pid\":" + std::to_string(GetCurrentProcessId()) + "}");
    Sleep(60000);
    return 0;
}

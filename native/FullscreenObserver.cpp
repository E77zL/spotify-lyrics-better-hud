// MIT. Small Win32 observer: no mouse/keyboard hooks and no cursor manipulation.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <cstdio>
#include <cwchar>
#include <initializer_list>
#include "fullscreen.h"

static DWORD hudPid;
static int previous = -1;

static void Refresh() {
    const int locked = IsFullscreenWindow(GetForegroundWindow(), hudPid) ? 1 : 0;
    if (locked == previous) return;
    DWORD written = 0;
    const char message[] = { locked ? '1' : '0', '\n' };
    if (!WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), message, sizeof(message), &written, nullptr) || written != sizeof(message)) ExitProcess(0);
    previous = locked;
}

static void CALLBACK Changed(HWINEVENTHOOK, DWORD event, HWND window, LONG object, LONG, DWORD, DWORD) {
    if (event == EVENT_OBJECT_LOCATIONCHANGE && (object != OBJID_WINDOW || window != GetForegroundWindow())) return;
    Refresh();
}

int wmain(int argc, wchar_t** argv) {
    if (argc != 2) return 2;
    wchar_t* end = nullptr;
    const unsigned long parsed = wcstoul(argv[1], &end, 10);
    if (!parsed || !end || *end) return 2;
    hudPid = parsed;
    HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, hudPid);
    if (!parent) return 3;
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    const DWORD flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
    HWINEVENTHOOK hooks[] = {
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, Changed, 0, 0, flags),
        SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, nullptr, Changed, 0, 0, flags),
        SetWinEventHook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, nullptr, Changed, 0, 0, flags),
        SetWinEventHook(EVENT_SYSTEM_DESKTOPSWITCH, EVENT_SYSTEM_DESKTOPSWITCH, nullptr, Changed, 0, 0, flags),
    };
    // Recover from display/style changes for apps that omit accessibility events.
    const UINT_PTR timer = SetTimer(nullptr, 0, 250, nullptr);
    if (!timer) { for (auto hook : hooks) if (hook) UnhookWinEvent(hook); CloseHandle(parent); return 4; }
    Refresh();
    bool running = true;
    while (running) {
        const DWORD wait = MsgWaitForMultipleObjects(1, &parent, FALSE, INFINITE, QS_ALLINPUT);
        if (wait != WAIT_OBJECT_0 + 1) break; // Parent exit also covers Electron crashes.
        MSG message;
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            if (message.message == WM_QUIT) { running = false; break; }
            if (message.message == WM_TIMER) Refresh();
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
    KillTimer(nullptr, timer);
    for (auto hook : hooks) if (hook) UnhookWinEvent(hook);
    CloseHandle(parent);
    return 0;
}

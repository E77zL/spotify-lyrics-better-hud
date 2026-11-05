// MIT. Rounded system blur with the same translucent fallback on older Windows.
#pragma once
#include "NativeDrawing.h"
#include <dwmapi.h>
inline void SetHudBlur(HWND window, bool enabled)
{
    // User32 exports the composition API on supported Windows 10/11 builds.
    struct Accent
    {
        int state, flags;
        DWORD tint;
        int animation;
    } accent{enabled ? 3 : 0, 0, 0, 0}; // Blur only. The shared tint is painted exactly once.
    struct Attribute
    {
        int id;
        void *data;
        SIZE_T size;
    } attribute{19, &accent, sizeof(accent)};
    using SetComposition = BOOL(WINAPI *)(HWND, Attribute *);
    static const auto set = reinterpret_cast<SetComposition>(
        GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetWindowCompositionAttribute"));
    if (set)
        set(window, &attribute);
}
inline void SetHudShape(HWND window, int width, int height, int radius)
{
    HRGN shape = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius * 2, radius * 2);
    if (shape && !SetWindowRgn(window, shape, FALSE))
        DeleteObject(shape);
}
inline void ApplyHudGlass(HWND window, int width, int height, int radius, int opacity)
{
    SetHudShape(window, width, height, radius);
    BOOL dark = TRUE;
    DwmSetWindowAttribute(window, 20, &dark, sizeof(dark));
    const DWM_WINDOW_CORNER_PREFERENCE corner = DWMWCP_ROUND;
    DwmSetWindowAttribute(window, DWMWA_WINDOW_CORNER_PREFERENCE, &corner, sizeof(corner));
    SetHudBlur(window, opacity > 0);
}

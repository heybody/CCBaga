# icons/
> L2 | 父级: ../CLAUDE.md
图标供 Tauri 应用包与菜单栏入口使用。
icon.png: 512 像素透明 RGBA 应用图标，满幅粗线 C 字弧加绿点（源 assets/ccd-switch-icon.svg）；由 scripts/make-ccd-icons.py 生成。
icon.ico: Tauri 原生 icon 转换器从相同 PNG 生成的 Windows 多尺寸图标。
icon.icns: macOS 应用包图标，16–1024 全尺寸 iconset 生成。
tray.svg / tray.png: macOS 菜单栏模板图标（粗线 C 字弧 + 实心点，纯黑透明 48px），main.rs 嵌入并设为模板。
tray-windows-light.png / tray-windows-dark.png: 32px 透明 Windows 托盘图标，字弧按系统栏明暗选深色/白色，圆点保持绿色；原生读取 SystemUsesLightTheme 并每两秒检测变化，不依赖应用窗口主题。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

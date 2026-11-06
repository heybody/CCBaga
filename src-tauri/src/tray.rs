// [INPUT]: 前端推送的身份名称、本地 5h/7d 额度百分比、界面语言与 Windows 系统栏明暗状态；不含凭据。
// [OUTPUT]: 菜单栏菜单：打开、身份快捷项（名称与 5h 同行，下一行不可点的 7d）、退出；点身份只显示窗口并发出 tray-switch 事件。
// [POS]: 托盘菜单边界；不直接切换身份，结束进程的授权仍由窗口内确认面板逐次取得。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use serde::Deserialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
#[derive(Clone, Deserialize)]
pub struct Entry {
    pub id: String,
    pub name: String,
    pub active: bool,
    #[serde(default)]
    pub five_hour: Option<u8>,
    #[serde(default)]
    pub seven_day: Option<u8>,
}
#[derive(Default)]
pub struct TrayIdentities(pub Mutex<Vec<Entry>>);
pub const SWITCH_PREFIX: &str = "switch:";

#[cfg(target_os = "windows")]
fn windows_light_theme() -> bool {
    crate::windows::registry_dword(
        windows_sys::Win32::System::Registry::HKEY_CURRENT_USER,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        "SystemUsesLightTheme",
    ).unwrap_or(1) != 0
}

#[cfg(target_os = "windows")]
fn windows_icon_for(light: bool) -> tauri::image::Image<'static> {
    if light { tauri::include_image!("icons/tray-windows-light.png") }
    else { tauri::include_image!("icons/tray-windows-dark.png") }
}

#[cfg(target_os = "windows")]
pub(crate) fn windows_icon() -> tauri::image::Image<'static> {
    windows_icon_for(windows_light_theme())
}

#[cfg(target_os = "windows")]
pub(crate) fn watch_windows_theme(app: tauri::AppHandle) {
    // 系统栏和应用可分别选明暗；不能只依赖窗口的 ThemeChanged 事件。
    std::thread::spawn(move || {
        let mut previous = windows_light_theme();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            let light = windows_light_theme();
            if light != previous {
                if let Some(tray) = app.tray_by_id("main") {
                    let _ = tray.set_icon(Some(windows_icon_for(light)));
                }
                previous = light;
            }
        }
    });
}
fn clean(entries: Vec<Entry>) -> Vec<Entry> {
    entries
        .into_iter()
        .filter(|entry| {
            !entry.id.is_empty()
                && entry.id.len() <= 128
                && entry.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .map(|entry| Entry {
            name: entry
                .name
                .chars()
                .filter(|c| !c.is_control())
                .take(64)
                .collect(),
            ..entry
        })
        .take(32)
        .collect()
}
// 向上取整：只要用过就至少亮一格，避免 9% 看起来和 0% 一样。
fn usage_bar(value: u8) -> String {
    let filled = usize::from(value.div_ceil(20).min(5));
    format!("{}{}", "▰".repeat(filled), "▱".repeat(5 - filled))
}
fn label(entry: &Entry, en: bool) -> String {
    if entry.id == "empty" {
        if en { "Empty identity" } else { "空身份" }.to_string()
    } else {
        entry.name.clone()
    }
}
fn usage_lines(entry: &Entry) -> Vec<String> {
    [("5h", entry.five_hour), ("7d", entry.seven_day)]
        .into_iter()
        .filter_map(|(window, value)| {
            value.map(|value| format!("{window} {} {value}%", usage_bar(value)))
        })
        .collect()
}
/// 制表符让额度落在菜单右侧同一列，名称长短不同时进度条仍对齐。
fn menu_lines(entry: &Entry, en: bool) -> Vec<String> {
    let name = label(entry, en);
    let mut usage = usage_lines(entry).into_iter();
    let first = usage.next().map_or(name.clone(), |line| format!("{name}	{line}"));
    std::iter::once(first).chain(usage.map(|line| format!("	{line}"))).collect()
}
pub fn menu(
    app: &tauri::AppHandle,
    language: &str,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{CheckMenuItem, IsMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem};
    let en = language == "en";
    let entries = app.state::<TrayIdentities>().0.lock().unwrap().clone();
    let mut builder = MenuBuilder::new(app);
    let mut items: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = Vec::new();
    items.push(Box::new(MenuItem::with_id(
        app,
        "open",
        if en { "Open Claude Code Desktop Switch" } else { "打开 Claude Code Desktop Switch" },
        true,
        None::<&str>,
    )?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    for entry in &entries {
        let lines = menu_lines(entry, en);
        items.push(Box::new(CheckMenuItem::with_id(
            app,
            format!("{SWITCH_PREFIX}{}", entry.id),
            &lines[0],
            !entry.active,
            entry.active,
            None::<&str>,
        )?));
        for (index, line) in lines.iter().enumerate().skip(1) {
            items.push(Box::new(MenuItem::with_id(
                app,
                format!("usage:{index}:{}", entry.id),
                line,
                false,
                None::<&str>,
            )?));
        }
    }
    if !entries.is_empty() {
        items.push(Box::new(PredefinedMenuItem::separator(app)?));
    }
    items.push(Box::new(MenuItem::with_id(
        app,
        "quit",
        if en { "Quit" } else { "退出" },
        true,
        None::<&str>,
    )?));
    for item in &items {
        builder = builder.item(item.as_ref());
    }
    builder.build()
}
pub fn refresh(app: &tauri::AppHandle) {
    let language = crate::ui_language::ui_language_read(app.clone());
    if let (Some(tray), Ok(menu)) = (app.tray_by_id("main"), menu(app, &language)) {
        let _ = tray.set_menu(Some(menu));
    }
}
/// 菜单点身份：显示窗口并把目标交给前端打开行内确认，不在此处结束进程或切换。
pub fn on_switch(app: &tauri::AppHandle, id: &str) {
    let known = app
        .state::<TrayIdentities>()
        .0
        .lock()
        .unwrap()
        .iter()
        .any(|entry| entry.id == id && !entry.active);
    if !known {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit_to("main", "tray-switch", id.to_string());
}
#[tauri::command]
pub fn tray_identities_set(app: tauri::AppHandle, entries: Vec<Entry>) {
    *app.state::<TrayIdentities>().0.lock().unwrap() = clean(entries);
    refresh(&app);
}
#[cfg(test)]
mod tests {
    use super::*;
    fn entry(id: &str, name: &str, active: bool) -> Entry {
        Entry { id: id.into(), name: name.into(), active, five_hour: None, seven_day: None }
    }
    #[test]
    fn label_shows_available_usage_windows() {
        let plain = entry("a", "work", false);
        assert_eq!(menu_lines(&plain, false), ["work"]);
        let both = Entry { five_hour: Some(0), seven_day: Some(9), ..plain.clone() };
        assert_eq!(menu_lines(&both, false), ["work	5h ▱▱▱▱▱ 0%", "	7d ▰▱▱▱▱ 9%"]);
        let weekly = Entry { seven_day: Some(100), ..plain };
        assert_eq!(menu_lines(&weekly, false), ["work	7d ▰▰▰▰▰ 100%"]);
        assert_eq!(label(&entry("empty", "x", false), true), "Empty identity");
    }
    #[test]
    fn clean_drops_unsafe_ids_and_bounds_names() {
        let entries = clean(vec![
            entry("abc-1", "a\nb", true),
            entry("../x", "bad", false),
            entry("empty", &"x".repeat(100), false),
        ]);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "ab");
        assert_eq!(entries[1].name.chars().count(), 64);
    }
}

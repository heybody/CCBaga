// [INPUT]: 前端推送的身份名称、本地 5h/7d 额度百分比、界面语言、Windows 系统栏明暗状态与 macOS 菜单字体宽度；不含凭据。
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
/// 每个身份的菜单行：(行首文字, 额度)。第一行行首是名称，后续行行首为空。
fn menu_rows(entry: &Entry, en: bool) -> Vec<(String, Option<String>)> {
    let mut usage = usage_lines(entry).into_iter();
    let first = (label(entry, en), usage.next());
    std::iter::once(first).chain(usage.map(|line| (String::new(), Some(line)))).collect()
}
/// Windows：菜单把制表符后的文字放进右侧快捷键列，所有行天然对齐。
#[cfg(not(target_os = "macos"))]
fn layout(rows: Vec<Vec<(String, Option<String>)>>) -> Vec<Vec<String>> {
    rows.into_iter()
        .map(|lines| {
            lines
                .into_iter()
                .map(|(head, usage)| usage.map_or(head.clone(), |u| format!("{head}\t{u}")))
                .collect()
        })
        .collect()
}
/// macOS：NSMenu 把制表符当普通制表位（默认每 28pt 一格），只用一个制表符时
/// 名称行和行首为空的行会落在不同格。按菜单字体量出行首宽度，补足制表符，
/// 让所有额度落在同一格。
#[cfg(target_os = "macos")]
fn layout(rows: Vec<Vec<(String, Option<String>)>>) -> Vec<Vec<String>> {
    extern "C" {
        fn ccd_menu_text_width(text: *const std::ffi::c_char) -> f64;
        fn ccd_menu_tab_interval() -> f64;
    }
    let width = |text: &str| {
        let text = std::ffi::CString::new(text).unwrap_or_default();
        // SAFETY: 传入以 NUL 结尾的 UTF-8；原生层只读并按值返回宽度。
        unsafe { ccd_menu_text_width(text.as_ptr()) }
    };
    // SAFETY: 无参数，只读取系统默认段落样式。
    let interval = unsafe { ccd_menu_tab_interval() };
    align_tabs(rows, width, interval)
}
/// 目标格取最宽行首之后、至少留 8pt 空隙的第一格；每行补的制表符数为
/// 从自身行首宽度跳到目标格所需的格数。
#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
fn align_tabs(
    rows: Vec<Vec<(String, Option<String>)>>,
    width: impl Fn(&str) -> f64,
    interval: f64,
) -> Vec<Vec<String>> {
    let interval = if interval.is_finite() && interval >= 1.0 { interval } else { 28.0 };
    let widest = rows
        .iter()
        .flatten()
        .filter(|(_, usage)| usage.is_some())
        .map(|(head, _)| if head.is_empty() { 0.0 } else { width(head) })
        .fold(0.0, f64::max);
    let target = ((widest + 8.0) / interval).ceil().max(1.0) as usize;
    rows.into_iter()
        .map(|lines| {
            lines
                .into_iter()
                .map(|(head, usage)| match usage {
                    None => head,
                    Some(usage) => {
                        let at = if head.is_empty() { 0 } else { (width(&head) / interval) as usize };
                        format!("{head}{}{usage}", "\t".repeat(target.saturating_sub(at).max(1)))
                    }
                })
                .collect()
        })
        .collect()
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
    let lines = layout(entries.iter().map(|entry| menu_rows(entry, en)).collect());
    items.push(Box::new(MenuItem::with_id(
        app,
        "open",
        if en { "Open" } else { "打开" },
        true,
        None::<&str>,
    )?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    for (entry, lines) in entries.iter().zip(&lines) {
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
    fn plain(rows: Vec<(String, Option<String>)>) -> Vec<String> {
        rows.into_iter().map(|(head, usage)| usage.map_or(head.clone(), |u| format!("{head}|{u}"))).collect()
    }
    #[test]
    fn rows_show_available_usage_windows() {
        let base = entry("a", "work", false);
        assert_eq!(plain(menu_rows(&base, false)), ["work"]);
        let both = Entry { five_hour: Some(0), seven_day: Some(9), ..base.clone() };
        assert_eq!(plain(menu_rows(&both, false)), ["work|5h ▱▱▱▱▱ 0%", "|7d ▰▱▱▱▱ 9%"]);
        let weekly = Entry { seven_day: Some(100), ..base };
        assert_eq!(plain(menu_rows(&weekly, false)), ["work|7d ▰▰▰▰▰ 100%"]);
        assert_eq!(label(&entry("empty", "x", false), true), "Empty identity");
    }
    /// 复现 macOS 错位：旧写法名称行跳到名称后的格，行首为空的行只到第 1 格；现在都落在同一格。
    #[test]
    fn mac_tabs_land_every_usage_in_the_same_stop() {
        let width = |text: &str| match text { "cares_ytbj" => 64.0, "careswpro" => 60.0, "空身份" => 40.0, _ => 0.0 };
        let rows = vec![
            vec![("cares_ytbj".into(), Some("5h a".into())), (String::new(), Some("7d b".into()))],
            vec![("careswpro".into(), Some("5h c".into())), (String::new(), Some("7d d".into()))],
            vec![("空身份".into(), None)],
        ];
        let out = align_tabs(rows, width, 28.0);
        // 最宽 64 + 8 = 72 → 第 3 格（84pt）。
        assert_eq!(out[0], ["cares_ytbj\t5h a", "\t\t\t7d b"]);
        assert_eq!(out[1], ["careswpro\t5h c", "\t\t\t7d d"]);
        assert_eq!(out[2], ["空身份"]);
        let stop = |line: &str, head: f64| (head / 28.0) as usize + line.matches('\t').count();
        assert_eq!(stop(&out[0][0], 64.0), 3);
        assert_eq!(stop(&out[0][1], 0.0), 3);
        assert_eq!(stop(&out[1][0], 60.0), 3);
        // 名称离格线太近时跳到下一格，保留空隙；异常间隔按 28pt。
        let tight = align_tabs(vec![vec![("n".into(), Some("u".into())), (String::new(), Some("v".into()))]], |_| 80.0, f64::NAN);
        assert_eq!(tight[0], ["n\t\tu", "\t\t\t\tv"]);
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

// [INPUT]: 受控的额度文字、Windows 系统菜单字体和 Win32 文本绘制度量。
// [OUTPUT]: 5h/7d、五格进度条与百分比三列等宽的原生菜单文字。
// [POS]: Windows 托盘排版；保留原生菜单与点击语义，不操作运行中的应用或身份。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use windows_sys::Win32::{
    Foundation::RECT,
    Graphics::Gdi::{CreateCompatibleDC, CreateFontIndirectW, DeleteDC, DeleteObject, DrawTextW,
        SelectObject, HDC, HFONT, HGDIOBJ, DT_CALCRECT, DT_NOPREFIX, DT_SINGLELINE},
    UI::WindowsAndMessaging::{SystemParametersInfoW, NONCLIENTMETRICSW, SPI_GETNONCLIENTMETRICS},
};

type Rows = Vec<Vec<(String, Option<String>)>>;
struct MenuFont { dc: HDC, font: HFONT, previous: HGDIOBJ }
impl MenuFont {
    fn new() -> Option<Self> {
        unsafe {
            let mut metrics: NONCLIENTMETRICSW = std::mem::zeroed();
            metrics.cbSize = std::mem::size_of_val(&metrics) as u32;
            if SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, metrics.cbSize, (&mut metrics as *mut NONCLIENTMETRICSW).cast(), 0) == 0 { return None; }
            let dc = CreateCompatibleDC(std::ptr::null_mut());
            if dc.is_null() { return None; }
            let font = CreateFontIndirectW(&metrics.lfMenuFont);
            if font.is_null() { DeleteDC(dc); return None; }
            let previous = SelectObject(dc, font);
            Some(Self { dc, font, previous })
        }
    }
    fn width(&self, text: &str) -> i32 {
        let text: Vec<u16> = text.encode_utf16().collect();
        let mut rect: RECT = unsafe { std::mem::zeroed() };
        // DrawText 使用与原生菜单一致的字体回退；GetTextExtentPoint32 会误量 ▰/▱。
        unsafe { DrawTextW(self.dc, text.as_ptr(), text.len() as i32, &mut rect, DT_CALCRECT | DT_SINGLELINE | DT_NOPREFIX); }
        rect.right
    }
}
impl Drop for MenuFont {
    fn drop(&mut self) { unsafe { SelectObject(self.dc, self.previous); DeleteObject(self.font); DeleteDC(self.dc); } }
}

/// 使用实测宽度组合空白，不能假定普通空格或 figure space 与数字等宽。
fn padding(left: &str, right: &str, target: i32, width: &impl Fn(&str) -> i32) -> String {
    let baseline = width(&format!("{left}{right}"));
    let pixels = (target - baseline).max(0) as usize;
    let mut choices: Vec<Option<String>> = vec![None; pixels + 1];
    choices[0] = Some(String::new());
    for n in 0..pixels {
        let Some(prefix) = choices[n].clone() else { continue; };
        for ch in [' ', '\u{200a}', '\u{2005}', '\u{2009}'] {
            let value = format!("{prefix}{ch}");
            // 字体回退与像素舍入使单字宽度不可直接相加，必须量完整片段。
            let actual = width(&format!("{left}{value}{right}")) - baseline;
            if actual > n as i32 && actual <= pixels as i32 {
                let slot = &mut choices[actual as usize];
                if slot.as_ref().is_none_or(|old| value.chars().count() < old.chars().count()) { *slot = Some(value); }
            }
        }
    }
    // 特殊系统字体可能无法表示单像素差；取最近的可表示宽度，不添加负间距。
    choices.into_iter().rev().flatten().next().unwrap_or_default()
}

fn align(rows: Rows, width: impl Fn(&str) -> i32) -> Vec<Vec<String>> {
    let mut columns = [0; 3];
    for (_, usage) in rows.iter().flatten() {
        if let Some(usage) = usage {
            for (n, part) in usage.split_whitespace().take(3).enumerate() { columns[n] = columns[n].max(width(part)); }
        }
    }
    // 给每列留出至少两个空格，确保 1px 字形差也能通过多种空白组合补齐。
    let gap = (width(" ") * 2).max(4);
    rows.into_iter().map(|lines| lines.into_iter().map(|(head, usage)| {
        let Some(usage) = usage else { return head; };
        let parts: Vec<_> = usage.split_whitespace().collect();
        if parts.len() != 3 { return format!("{head}\t{usage}"); }
        // 标签和条左对齐，百分比右对齐；整个额度区总宽度相同。
        let prefix = format!("{}{}{}", parts[0], padding(parts[0], "", columns[0] + gap, &width), parts[1]);
        let total = columns.iter().sum::<i32>() + gap * 2;
        format!("{head}\t{prefix}{}{}", padding(&prefix, parts[2], total, &width), parts[2])
    }).collect()).collect()
}

pub(super) fn layout(rows: Rows) -> Vec<Vec<String>> {
    match MenuFont::new() {
        Some(font) => align(rows, |text| font.width(text)),
        None => rows.into_iter().map(|lines| lines.into_iter().map(|(head, usage)| usage.map_or(head.clone(), |usage| format!("{head}\t{usage}"))).collect()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn system_menu_font_aligns_usage_labels_bars_and_percentages() {
        let font = MenuFont::new().expect("系统菜单字体");
        let rows = [0, 9, 10, 20, 99, 100].into_iter().map(|value| {
            ["5h", "7d"].into_iter().map(|label| (String::new(), Some(format!("{label} {} {value}%", super::super::usage_bar(value))))).collect()
        }).collect();
        let lines = align(rows, |text| font.width(text));
        let mut widths = Vec::new();
        let mut bar_offsets = Vec::new();
        for line in lines.iter().flatten() {
            let usage = line.strip_prefix('\t').unwrap();
            widths.push(font.width(usage));
            let bar = usage.find(['▰', '▱']).unwrap();
            bar_offsets.push(font.width(&usage[..bar]));
        }
        assert!(widths.iter().max().unwrap() - widths.iter().min().unwrap() <= 1, "总宽度: {widths:?}");
        assert!(bar_offsets.iter().max().unwrap() - bar_offsets.iter().min().unwrap() <= 1, "条起点: {bar_offsets:?}");
        assert_eq!(align(vec![vec![("空身份".into(), None)]], |text| font.width(text)), vec![vec!["空身份"]]);
    }
}

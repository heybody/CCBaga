// [INPUT]: Claude 桌面 App 自己写在本地的 plan-usage-history.json（version 2：t 毫秒、org、u.fh/u.sd 百分比）。
// [OUTPUT]: 按组织 UUID 取最后一条样本的 5 小时/每周已用百分比与采样时间。
// [POS]: 额度只读来源，写法借鉴 vibe-coding/mpb-probe 的 Claude 采集器；不读钥匙串、不碰令牌、不联网，样本过期也如实返回采样时间。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
const VERSION: i64 = 2;
const MAX_BYTES: u64 = 4 * 1024 * 1024;
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five_hour: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seven_day: Option<u8>,
    /// 采样时间（Unix 毫秒），界面据此标出「多久前」。
    pub sampled_at: i64,
}
/// 组织 UUID 只接受十六进制与连字符，避免把任意文本当作匹配键。
pub fn org_id(value: Option<&str>) -> Option<String> {
    let v = value?.trim();
    (!v.is_empty() && v.len() <= 64 && v.chars().all(|c| c.is_ascii_hexdigit() || c == '-'))
        .then(|| v.to_ascii_lowercase())
}
fn history_path(home: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        Some(home.join("Library/Application Support/Claude/plan-usage-history.json"))
    }
    #[cfg(target_os = "windows")]
    {
        let _ = home;
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
        if let Some(found) = local
            .as_ref()
            .and_then(|dir| std::fs::read_dir(dir.join("Claude-Data")).ok())
            .into_iter()
            .flatten()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().starts_with("claude_"))
            .map(|entry| entry.path().join("plan-usage-history.json"))
            .find(|path| path.is_file())
        {
            return Some(found);
        }
        std::env::var_os("APPDATA").map(|dir| PathBuf::from(dir).join("Claude/plan-usage-history.json"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = home;
        None
    }
}
fn percent(value: Option<&Value>) -> Option<u8> {
    let v = value?.as_f64()?;
    (v.is_finite() && (0.0..=100.0).contains(&v)).then(|| v.round() as u8)
}
pub(super) fn parse(value: &Value) -> BTreeMap<String, Usage> {
    let mut latest = BTreeMap::<String, Usage>::new();
    if value.get("version").and_then(Value::as_i64) != Some(VERSION) {
        return latest;
    }
    for sample in value.get("samples").and_then(Value::as_array).into_iter().flatten() {
        let (Some(org), Some(t), Some(u)) = (
            org_id(sample.get("org").and_then(Value::as_str)),
            sample.get("t").and_then(Value::as_i64).filter(|t| *t > 0),
            sample.get("u"),
        ) else {
            continue;
        };
        let usage = Usage {
            five_hour: percent(u.get("fh")),
            seven_day: percent(u.get("sd")),
            sampled_at: t,
        };
        if usage.five_hour.is_none() && usage.seven_day.is_none() {
            continue;
        }
        if latest.get(&org).is_none_or(|old| old.sampled_at < t) {
            latest.insert(org, usage);
        }
    }
    latest
}
/// 读取失败、格式版本不符或平台无此文件时返回空表，界面不显示额度而不是猜测。
pub fn read(home: &Path) -> BTreeMap<String, Usage> {
    history_path(home)
        .and_then(|path| super::profile::read_bounded_json(&path, MAX_BYTES))
        .map(|value| parse(&value))
        .unwrap_or_default()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keeps_latest_sample_per_org_and_rejects_bad_values() {
        let value = serde_json::json!({"version":2,"samples":[
            {"t":1000,"org":"AA-1","u":{"fh":10,"sd":20}},
            {"t":3000,"org":"aa-1","u":{"fh":30,"sd":40}},
            {"t":2000,"org":"aa-1","u":{"fh":99,"sd":99}},
            {"t":5000,"org":"bb","u":{"fh":120,"sd":-1}},
            {"t":6000,"org":"bad org","u":{"fh":1}},
            {"t":7000,"org":"cc","u":{"sd":55.6}}
        ]});
        let map = parse(&value);
        assert_eq!(map.len(), 2);
        assert_eq!(map["aa-1"], Usage { five_hour: Some(30), seven_day: Some(40), sampled_at: 3000 });
        assert_eq!(map["cc"].seven_day, Some(56));
        assert!(parse(&serde_json::json!({"version":3,"samples":[{"t":1,"org":"aa","u":{"fh":1}}]})).is_empty());
    }
}

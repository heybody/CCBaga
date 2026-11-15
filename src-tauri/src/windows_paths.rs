// [INPUT]: 当前用户 SID、固定 Claude MSIX LocalCache 与文件系统元数据。
// [OUTPUT]: 严格验证的 WpSystem 重定向、逻辑来源映射与卷编号比较。
// [POS]: 仅认可商店跨盘布局；不放行任意 junction 或子目录链接。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use std::path::{Component, Path, PathBuf};

fn sid_text() -> Option<String> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Authorization::ConvertSidToStringSidW};
    let sid = super::current_sid()?;
    let mut text = std::ptr::null_mut();
    unsafe {
        if ConvertSidToStringSidW(sid.as_ptr() as *mut _, &mut text) == 0 { return None; }
        let mut len = 0;
        while *text.add(len) != 0 { len += 1; }
        let result = String::from_utf16(std::slice::from_raw_parts(text, len)).ok();
        LocalFree(text.cast());
        result
    }
}

fn expected_target(actual: &Path, sid: &str) -> bool {
    let mut components = actual.components();
    let Some(Component::Prefix(prefix)) = components.next() else { return false };
    if !matches!(prefix.kind(), std::path::Prefix::Disk(_)) { return false; }
    if components.next() != Some(Component::RootDir) { return false; }
    components.as_path() == Path::new("WpSystem").join(sid)
        .join("AppData/Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache")
}

pub(crate) fn package_cache_target(path: &Path) -> Option<PathBuf> {
    let local = PathBuf::from(std::env::var_os("LOCALAPPDATA")?);
    if !local.is_absolute() || path != local.join("Packages/Claude_pzs8sxrjxfjjc/LocalCache") {
        return None;
    }
    // 固定入口以上不允许另外的链接；只豁免 LocalCache 这一节点。
    crate::identities::private::parents(path.parent()?).ok()?;
    let actual = dunce::canonicalize(path).ok()?;
    if actual == path || !expected_target(&actual, &sid_text()?) {
        return None;
    }
    // 系统创建的包目录可由 Administrators/SYSTEM 持有；实际身份源仍逐项核验当前用户所有权。
    crate::identities::private::parents(&actual).ok()?;
    Some(actual)
}

pub(crate) fn package_source(path: &Path) -> Option<PathBuf> {
    for ancestor in path.ancestors() {
        if let Some(target) = package_cache_target(ancestor) {
            return Some(target.join(path.strip_prefix(ancestor).ok()?));
        }
    }
    None
}

fn volume(path: &Path) -> Option<u32> {
    use windows_sys::Win32::{Foundation::{CloseHandle, INVALID_HANDLE_VALUE}, Storage::FileSystem::*};
    unsafe {
        let handle = CreateFileW(super::wide_path(path).as_ptr(), 0,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, std::ptr::null(),
            OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, std::ptr::null_mut());
        if handle == INVALID_HANDLE_VALUE { return None; }
        let mut info = std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>();
        let ok = GetFileInformationByHandle(handle, &mut info) != 0;
        CloseHandle(handle);
        ok.then_some(info.dwVolumeSerialNumber)
    }
}

pub(crate) fn same_volume(source: &Path, vault: &Path) -> bool {
    volume(source).zip(volume(vault)).is_some_and(|(a,b)| a == b)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn package_mapping_rejects_wrong_user_package_and_arbitrary_target() {
        let sid = "S-1-5-21-1-2-3-1001";
        let valid = format!("D:/WpSystem/{sid}/AppData/Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache");
        assert!(expected_target(Path::new(&valid), sid));
        for invalid in [valid.replace(sid,"S-1-5-21-1-2-3-1002"),
            valid.replace("Claude_", "Other_"), valid.replace("D:/WpSystem", "D:/temp/WpSystem"),
            format!("{valid}/extra"), valid.replace("D:", "//server/share")] {
            assert!(!expected_target(Path::new(&invalid), sid), "{invalid}");
        }
    }
    #[test]
    fn volume_requires_existing_nodes_and_compares_real_filesystem() {
        let path = std::env::temp_dir();
        assert!(same_volume(&path, &path));
        assert!(!same_volume(&path.join("missing-volume-probe-ccbaga"), &path));
        assert!(std::fs::metadata(path).unwrap().is_dir());
    }
}

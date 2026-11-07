// [INPUT]: 当前应用路径和已核验 SHA-256 的固定 fork 压缩包。
// [OUTPUT]: 保留当前签名要求的应用包，同卷原子替换。
// [POS]: 只替换当前 CCD Switch 应用包，不写保险库或提权。

use super::Ready;
use crate::identities::private;
use std::{
    ffi::CString,
    fs,
    os::unix::ffi::OsStrExt,
    path::{Path, PathBuf},
    process::Command,
};

const IDENTIFIER: &str = "ai.local.requirement-french";
const BUNDLE_NAME: &str = "CCD Switch.app";
const EXECUTABLE: &str = "Contents/MacOS/requirement-french";

struct Staging(PathBuf);

impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn run(command: &mut Command, error: &str) -> Result<std::process::Output, String> {
    let output = command.output().map_err(|e| format!("{error} {e}"))?;
    if !output.status.success() {
        return Err(format!("{error} {}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(output)
}

fn bundle_version(app: &Path) -> Result<String, String> {
    private::parents(&app.join("Contents/MacOS"))?;
    private::safe(&app.join(EXECUTABLE))?;
    let info = app.join("Contents/Info.plist");
    private::safe(&info)?;
    let info: plist::Dictionary = plist::from_file(info).map_err(|_| "macOS 应用包信息无效。")?;
    if info.get("CFBundleIdentifier").and_then(|value| value.as_string()) != Some(IDENTIFIER)
        || info.get("CFBundleExecutable").and_then(|value| value.as_string()) != Some("requirement-french")
    {
        return Err("macOS 应用包标识不匹配。".into());
    }
    info.get("CFBundleShortVersionString")
        .and_then(|value| value.as_string())
        .map(str::to_owned)
        .ok_or_else(|| "macOS 应用包版本无效。".into())
}

fn verify_signature(app: &Path) -> Result<(), String> {
    run(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(app),
        "macOS 应用包签名校验失败。",
    )?;
    Ok(())
}

fn preserve_signature(current: &Path, candidate: &Path) -> Result<(), String> {
    let output = run(
        Command::new("/usr/bin/codesign").args(["--display", "--verbose=2", "-r-"]).arg(current),
        "无法读取当前 macOS 应用签名。",
    )?;
    let signature = String::from_utf8_lossy(&output.stderr);
    if signature.lines().any(|line| line == "Signature=adhoc") {
        return Ok(());
    }
    let requirement = String::from_utf8_lossy(&output.stdout);
    let requirement = requirement.lines()
        .find_map(|line| line.strip_prefix("designated => "))
        .ok_or("无法读取当前 macOS 应用签名。")?;
    let matches_requirement = || {
        Command::new("/usr/bin/codesign")
            .args(["--verify", "--strict"])
            .arg(format!("-R={requirement}"))
            .arg(candidate)
            .output()
            .is_ok_and(|result| result.status.success())
    };
    if matches_requirement() {
        return Ok(());
    }

    // 维护安装用本地自签名证书，通过当前签名里的证书指纹选中同一把钥匙。
    let local_requirement = format!("identifier \"{IDENTIFIER}\" and certificate leaf = H\"");
    let identity = requirement.strip_prefix(&local_requirement)
        .and_then(|rest| rest.strip_suffix('"'))
        .filter(|hash| hash.len() == 40 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()))
        .ok_or("更新包无法保留当前 macOS 应用签名。")?;
    run(
        Command::new("/usr/bin/codesign").args(["--force", "--sign", identity]).arg(candidate),
        "无法用当前 macOS 签名证书签署更新包。",
    )?;
    if !matches_requirement() {
        return Err("更新包无法保留当前 macOS 应用签名。".into());
    }
    Ok(())
}

fn swap_bundles(current: &Path, candidate: &Path) -> Result<(), String> {
    let current = CString::new(current.as_os_str().as_bytes()).map_err(|e| e.to_string())?;
    let candidate = CString::new(candidate.as_os_str().as_bytes()).map_err(|e| e.to_string())?;
    // 两个目录位于同一卷。交换失败时，原应用仍在原位。
    if unsafe { libc::renamex_np(current.as_ptr(), candidate.as_ptr(), libc::RENAME_SWAP) } != 0 {
        return Err(format!("无法替换 macOS 应用。 {}", std::io::Error::last_os_error()));
    }
    Ok(())
}

pub(super) fn install(executable: &Path, ready: &Ready) -> Result<(), String> {
    let current = executable.ancestors().nth(3)
        .filter(|path| path.extension().is_some_and(|ext| ext == "app") && path.join(EXECUTABLE) == executable)
        .ok_or("请从可写位置的 CCD Switch 应用包启动更新。")?;
    private::safe(current)?;
    bundle_version(current)?;
    verify_signature(current)?;
    let parent = current.parent().ok_or("无法定位 macOS 应用安装目录。")?;
    let folder = parent.join(format!(".ccd-update-{}", crate::identities::new_id()?));
    private::create_directory(&folder).map_err(|_| "无法写入 macOS 应用安装目录。")?;
    let stage = Staging(folder);
    run(
        Command::new("/usr/bin/ditto").args(["-x", "-k"]).arg(&ready.path).arg(&stage.0),
        "无法解压 macOS 更新包。",
    )?;
    let candidate = stage.0.join(BUNDLE_NAME);
    if bundle_version(&candidate)? != ready.version {
        return Err("macOS 更新包版本与发布版本不匹配。".into());
    }
    verify_signature(&candidate)?;
    preserve_signature(current, &candidate)?;
    verify_signature(&candidate)?;
    swap_bundles(current, &candidate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use plist::{Dictionary, Value};

    fn fixture(app: &Path, version: &str) {
        fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
        fs::copy("/usr/bin/true", app.join(EXECUTABLE)).unwrap();
        let info: Dictionary = [
            ("CFBundleIdentifier", Value::String(IDENTIFIER.into())),
            ("CFBundleExecutable", Value::String("requirement-french".into())),
            ("CFBundleShortVersionString", Value::String(version.into())),
        ].into_iter().collect();
        plist::to_file_xml(app.join("Contents/Info.plist"), &info).unwrap();
        run(Command::new("/usr/bin/codesign").args(["--force", "--sign", "-"]).arg(app), "签署测试包失败。").unwrap();
    }

    #[test]
    fn install_rejects_wrong_release_then_atomically_replaces_bundle() {
        let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
        let dir = temp.join(format!("ccd-mac-update-{}", crate::identities::new_id().unwrap()));
        private::create_directory(&dir).unwrap();
        let stage = Staging(dir);
        let current = stage.0.join(BUNDLE_NAME);
        let candidate = stage.0.join("new").join(BUNDLE_NAME);
        fixture(&current, "0.2.50+local.20");
        fixture(&candidate, "0.2.50+local.21");
        let archive = stage.0.join("update.zip");
        run(
            Command::new("/usr/bin/ditto").args(["-c", "-k", "--keepParent"]).arg(candidate).arg(&archive),
            "压缩测试包失败。",
        ).unwrap();
        let mut ready = Ready { path: archive, hash: String::new(), version: "0.2.50+local.22".into() };
        assert!(install(&current.join(EXECUTABLE), &ready).unwrap_err().contains("版本"));
        assert_eq!(bundle_version(&current).unwrap(), "0.2.50+local.20");

        ready.version = "0.2.50+local.21".into();
        install(&current.join(EXECUTABLE), &ready).unwrap();
        verify_signature(&current).unwrap();
        assert_eq!(bundle_version(&current).unwrap(), ready.version);
        assert_eq!(fs::read_dir(&stage.0).unwrap().count(), 3);
    }
}

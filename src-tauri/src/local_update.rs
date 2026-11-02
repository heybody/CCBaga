// [INPUT]: 固定 fork 的 HTTPS Release 元数据和校验文件、当前版本、原生私有下载目录与事务锁。
// [OUTPUT]: 数字比较 local 构建版本、真实字节下载进度、校验暂存与复核后启动自动安装及重开本程序。
// [POS]: 定制版更新边界；不接受客户端 URL/路径、不访问身份正文、不结束 Claude 进程。
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::Manager;
use tauri::ipc::Channel;
use crate::identities::private;
const API: &str = "https://api.github.com/repos/heybody/CCBaga/releases?per_page=20";
const LIMIT: usize = 100 * 1024 * 1024;
#[derive(Deserialize)]
struct Asset { name: String, browser_download_url: String }
#[derive(Deserialize)]
struct Release { tag_name: String, draft: bool, prerelease: bool, assets: Vec<Asset> }
#[derive(Clone, Serialize)]
pub struct Info { pub current: String, pub latest: String, pub available: bool, pub supported: bool }
#[derive(Clone, Serialize)]
pub struct DownloadProgress { phase: &'static str, received: u64, total: Option<u64> }
struct Package { info: Info, installer: String, checksum: String, filename: String }
struct Ready { path: PathBuf, hash: String }
#[derive(Default)]
pub struct Updates(Mutex<Option<Ready>>);
fn version(value: &str) -> Option<[u64;4]> {
    let value = value.strip_prefix('v').unwrap_or(value);
    let (base, local) = value.split_once("+local.")?;
    let parts: Vec<_> = base.split('.').collect();
    if parts.len()!=3 { return None; }
    let mut result=[0;4];
    for (n, part) in parts.into_iter().chain(std::iter::once(local)).enumerate() {
        if part.is_empty() || !part.bytes().all(|b|b.is_ascii_digit()) || (part.len()>1 && part.starts_with('0')) { return None; }
        result[n]=part.parse().ok()?;
    }
    Some(result)
}
fn asset_url(url: &str, tag: &str, name: &str) -> bool {
    let raw=format!("https://github.com/heybody/CCBaga/releases/download/{tag}/{name}");
    url==raw || url==raw.replace('+',"%2B")
}
fn select(releases: Vec<Release>, current: &str) -> Result<Package,String> {
    let installed=version(current).ok_or("当前版本格式无效。")?;
    let mut choices=Vec::new();
    for release in releases {
        if release.draft || release.prerelease { continue; }
        let Some(v)=version(&release.tag_name) else {continue};
        let number=release.tag_name.trim_start_matches('v');
        let filename=format!("CCD-Switch_{number}_windows_x64-setup.exe");
        let Some(exe)=release.assets.iter().find(|a|a.name==filename && asset_url(&a.browser_download_url,&release.tag_name,&filename)) else {continue};
        let Some(sum)=release.assets.iter().find(|a|a.name=="checksums-windows.txt" && asset_url(&a.browser_download_url,&release.tag_name,"checksums-windows.txt")) else {continue};
        choices.push((v,Package {info:Info {current:current.into(),latest:number.into(),available:v>installed,supported:cfg!(windows)},installer:exe.browser_download_url.clone(),checksum:sum.browser_download_url.clone(),filename}));
    }
    choices.into_iter().max_by_key(|(v,_)|*v).map(|(_,p)|p).ok_or("未找到完整的 Windows 更新包。".into())
}
fn client() -> Result<reqwest::Client,String> {
    reqwest::Client::builder().user_agent("CCD-Switch-update").https_only(true)
        .timeout(Duration::from_secs(180)).connect_timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url=attempt.url();
            if attempt.previous().len()<5 && url.scheme()=="https" && url.port_or_known_default()==Some(443) && url.username().is_empty() && url.password().is_none() && matches!(url.host_str(),Some("github.com"|"release-assets.githubusercontent.com"|"objects.githubusercontent.com")) {attempt.follow()} else {attempt.error("invalid update redirect")}
        })).build().map_err(|e|e.to_string())
}
async fn fetch(client:&reqwest::Client,url:&str,limit:usize)->Result<Vec<u8>,String> {
    fetch_progress(client,url,limit,|_,_|{}).await
}
async fn fetch_progress(client:&reqwest::Client,url:&str,limit:usize,mut progress:impl FnMut(u64,Option<u64>))->Result<Vec<u8>,String> {
    let mut response=client.get(url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
    let total=response.content_length();
    if total.is_some_and(|n|n>limit as u64) {return Err("更新文件超过大小限制。".into());}
    let mut bytes=Vec::new();
    progress(0,total);
    while let Some(chunk)=response.chunk().await.map_err(|e|e.to_string())? {
        if bytes.len().saturating_add(chunk.len())>limit {return Err("更新文件超过大小限制。".into());}
        bytes.extend_from_slice(&chunk);
        progress(bytes.len() as u64,total);
    }
    Ok(bytes)
}
async fn latest(current:&str)->Result<Package,String> {
    let bytes=fetch(&client()?,API,2*1024*1024).await?;
    let releases=serde_json::from_slice(&bytes).map_err(|_|"更新信息格式无效。")?;
    select(releases,current)
}
fn sha(bytes:&[u8])->String {ring::digest::digest(&ring::digest::SHA256,bytes).as_ref().iter().map(|b|format!("{b:02x}")).collect()}
fn expected(bytes:&[u8],filename:&str)->Result<String,String> {
    let text=std::str::from_utf8(bytes).map_err(|_|"校验文件格式无效。")?;
    let mut hashes=text.lines().filter_map(|line| {
        let mut words=line.split_whitespace();let hash=words.next()?;let name=words.next()?.trim_start_matches('*');
        (name==filename && words.next().is_none() && hash.len()==64 && hash.bytes().all(|b|b.is_ascii_hexdigit())).then(||hash.to_ascii_lowercase())
    });
    let hash=hashes.next().ok_or("未找到安装包校验值。")?;
    if hashes.next().is_some(){return Err("安装包校验条目重复。".into());} Ok(hash)
}
fn verify_ready(ready:&Ready)->Result<(),String> {
    // parents 只接受目录，不能把已经存在的安装包文件本身传进去。
    private::parents(ready.path.parent().ok_or("更新状态不可用。")?)?;
    private::safe(&ready.path)?;
    let bytes=std::fs::read(&ready.path).map_err(|e|e.to_string())?;
    if bytes.len()>LIMIT || sha(&bytes)!=ready.hash {return Err("安装包校验失败；未安装。".into());}
    Ok(())
}
#[tauri::command]
pub async fn local_update_check(app:tauri::AppHandle)->Result<Info,String> {Ok(latest(&app.package_info().version.to_string()).await?.info)}
#[tauri::command]
pub async fn local_update_download(app:tauri::AppHandle,on_progress:Channel<DownloadProgress>)->Result<Info,String> {
    if !cfg!(windows) {return Err("此系统请使用维护安装流程。".into());}
    let cleaner=app.state::<crate::cleaner::Cleaner>();cleaner.enter()?;
    let result=async {
        let _=on_progress.send(DownloadProgress{phase:"checking",received:0,total:None});
        let package=latest(&app.package_info().version.to_string()).await?;
        if !package.info.available {return Err("当前已是最新版本。".into());}
        let client=client()?;
        let hash=expected(&fetch(&client,&package.checksum,65536).await?,&package.filename)?;
        let bytes=fetch_progress(&client,&package.installer,LIMIT,|received,total| {
            let _=on_progress.send(DownloadProgress{phase:"downloading",received,total});
        }).await?;
        let _=on_progress.send(DownloadProgress{phase:"verifying",received:bytes.len() as u64,total:Some(bytes.len() as u64)});
        if sha(&bytes)!=hash || !bytes.starts_with(b"MZ") {return Err("安装包校验失败；未安装。".into());}
        let root=app.path().app_cache_dir().map_err(|e|e.to_string())?;
        private::directory(&root)?;
        let folder=root.join(format!("update-{}",crate::identities::new_id()?));
        private::create_directory(&folder)?;
        let path=folder.join(&package.filename);
        if let Err(error)=private::write(&path,&bytes) {let _=std::fs::remove_dir_all(&folder);return Err(error);}
        let update_state=app.state::<Updates>();
        let mut ready=update_state.0.lock().map_err(|_|"更新状态不可用。")?;
        if let Some(old)=ready.replace(Ready{path,hash}) {if let Some(parent)=old.path.parent(){let _=std::fs::remove_dir_all(parent);}}
        Ok(package.info)
    }.await;
    cleaner.leave();result
}
#[tauri::command]
pub fn local_update_install(app:tauri::AppHandle,confirmed:bool)->Result<(),String> {
    if !confirmed {return Err("尚未确认安装更新。".into());}
    if !cfg!(windows) {return Err("此系统请使用维护安装流程。".into());}
    let cleaner=app.state::<crate::cleaner::Cleaner>();cleaner.enter()?;
    let result=(|| {
        let state=app.state::<Updates>();let ready=state.0.lock().map_err(|_|"更新状态不可用。")?;
        let ready=ready.as_ref().ok_or("请先下载并校验更新包。")?;
        verify_ready(ready)?;
        // NSIS passive 模式自动完成安装；/R 完成后重开应用，/UPDATE 保留更新语义。
        std::process::Command::new(&ready.path).args(["/P","/R","/UPDATE"]).spawn().map_err(|e|e.to_string())?;
        Ok(())
    })();
    cleaner.leave();
    if result.is_ok(){app.exit(0);} result
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn verified_staged_installer_accepts_regular_file_and_rejects_tampering(){
  let root=std::env::temp_dir().join(format!("ccd-update-{}",crate::identities::new_id().unwrap()));
  private::directory(&root).unwrap();let path=root.join("setup.exe");
  private::write(&path,b"MZ synthetic installer").unwrap();
  let ready=Ready{path:path.clone(),hash:sha(b"MZ synthetic installer")};
  verify_ready(&ready).unwrap();
  private::write(&path,b"modified").unwrap();assert!(verify_ready(&ready).is_err());
  std::fs::remove_file(&path).unwrap();assert!(verify_ready(&ready).is_err());
  std::fs::remove_dir(&root).unwrap();
 }
 #[test] fn download_reports_received_bytes_and_handles_unknown_length_and_limit(){
  use std::{io::{Read,Write},net::TcpListener};
  fn response(headers:&str,body:&[u8])->(String,std::thread::JoinHandle<()>) {
   let listener=TcpListener::bind("127.0.0.1:0").unwrap();
   let url=format!("http://{}/installer",listener.local_addr().unwrap());
   let reply=format!("HTTP/1.0 200 OK\r\n{headers}Connection: close\r\n\r\n").into_bytes();
   let body=body.to_vec();
   let thread=std::thread::spawn(move||{let (mut stream,_)=listener.accept().unwrap();let mut request=[0;2048];let _=stream.read(&mut request);stream.write_all(&reply).unwrap();let _=stream.write_all(&body);});
   (url,thread)
  }
  for (headers,total) in [("Content-Length: 6\r\n",Some(6)),("",None)] {
   let (url,server)=response(headers,b"MZtest");let mut events=Vec::new();
   let bytes=tauri::async_runtime::block_on(fetch_progress(&reqwest::Client::new(),&url,16,|n,total|events.push((n,total)))).unwrap();
   server.join().unwrap();assert_eq!(bytes,b"MZtest");assert_eq!(events.first(),Some(&(0,total)));assert_eq!(events.last(),Some(&(6,total)));
   assert!(events.windows(2).all(|pair|pair[0].0<=pair[1].0));
  }
  let (url,server)=response("Content-Length: 20\r\n",b"too large");
  assert!(tauri::async_runtime::block_on(fetch_progress(&reqwest::Client::new(),&url,6,|_,_|{})).is_err());server.join().unwrap();
 }
 #[test] fn local_versions_compare_build_numbers_and_reject_other_channels(){
  assert!(version("0.2.50+local.10")>version("0.2.50+local.9"));assert!(version("0.3.0+local.1")>version("0.2.50+local.99"));
  for invalid in ["0.2.50","v0.2.50-beta+local.1","0.2.50+local.01","0.2.50+local.10/evil"]{assert!(version(invalid).is_none());}
 }
 #[test] fn release_selection_requires_complete_fork_assets_and_never_reports_downgrade(){
  fn release(n:u8,complete:bool)->Release {let tag=format!("v0.2.50+local.{n}");let file=format!("CCD-Switch_0.2.50+local.{n}_windows_x64-setup.exe");let names=if complete {vec![file,"checksums-windows.txt".into()]}else{vec![file]};Release{draft:false,prerelease:false,assets:names.into_iter().map(|name|Asset{browser_download_url:format!("https://github.com/heybody/CCBaga/releases/download/{tag}/{name}"),name}).collect(),tag_name:tag}}
  let p=select(vec![release(9,true),release(10,false)],"0.2.50+local.8").unwrap();assert_eq!(p.info.latest,"0.2.50+local.9");assert!(p.info.available);
  assert!(!select(vec![release(9,true)],"0.2.50+local.10").unwrap().info.available);
  let mut bad=release(10,true);bad.assets[0].browser_download_url="https://example.invalid/installer.exe".into();assert!(select(vec![bad],"0.2.50+local.8").is_err());
 }
 #[test] fn checksum_is_exact_and_detects_changed_installer(){
  let bytes=b"MZ synthetic installer";let hash=sha(bytes);let line=format!("{hash} *setup.exe\n");assert_eq!(expected(line.as_bytes(),"setup.exe").unwrap(),hash);
  assert!(expected(line.as_bytes(),"other.exe").is_err());assert!(expected(format!("{line}{line}").as_bytes(),"setup.exe").is_err());assert_ne!(sha(b"modified"),hash);
 }
}

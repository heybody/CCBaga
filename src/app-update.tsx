/**
 * [INPUT]: 固定 fork 的原生更新检查/校验下载/确认安装接口、当前版本与身份事务锁。
 * [OUTPUT]: 启动与每六小时静默检测、仅在有新版本时显示的标题栏提示、可由设置抽屉受控打开并立即检查的更新窗、真实下载进度、提前确认后自动校验安装并重开应用、跳转 GitHub 发布页手动更新。
 * [POS]: 定制版更新入口；只在用户确认时关闭 CCD Switch，不结束 Claude 进程。
 */
import {Channel,invoke} from '@tauri-apps/api/core';
import {getVersion} from '@tauri-apps/api/app';
import {useEffect,useState} from 'react';
import {Button,Checkbox} from 'cromma-ui';
import {AppDialog} from './dialog';
import {useI18n} from './i18n';
export type UpdateInfo={current:string;latest:string;available:boolean;supported:boolean};
type Info=UpdateInfo;
type DownloadProgress={phase:"checking"|"downloading"|"verifying";received:number;total:number|null};
const size=(bytes:number)=>`${(bytes/1024/1024).toFixed(1)} MiB`;
export function AppUpdate({blocked,open:controlled,onOpenChange,onInfo}:{blocked:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;onInfo?:(info:Info|null,version:string)=>void}){
 const {t}=useI18n();
 const [local,setLocal]=useState(false),[version,setVersion]=useState(''),[info,setInfo]=useState<Info|null>(null);
 const open=controlled??local;
 const setOpen=(value:boolean)=>{setLocal(value);onOpenChange?.(value);};
 useEffect(()=>{onInfo?.(info,version);},[info,version]);
 const [progress,setProgress]=useState<DownloadProgress|null>(null);
 const [phase,setPhase]=useState<'check'|'download'|'install'|null>(null),[ready,setReady]=useState(false),[accepted,setAccepted]=useState(true),[error,setError]=useState('');
 // ----- 按用户偏好每次打开默认勾选，仍须点击下载/安装按钮 -----
 useEffect(()=>{if(open)setAccepted(true);},[open]);
 useEffect(()=>{
  let live=true;
  void getVersion().then(v=>{if(live)setVersion(v);}).catch(()=>{});
  const check=()=>void invoke<Info>('local_update_check').then(v=>{if(live){setInfo(v);setError('');}}).catch(e=>{if(live)setError(String(e));});
  check();const timer=setInterval(check,6*60*60*1000);
  return()=>{live=false;clearInterval(timer);};
 },[]);
 // ----- 从设置打开时立即检查；已知有新版本时不再重复请求 -----
 useEffect(()=>{if(open&&!info?.available&&!phase)void check();},[open]);
 async function check(){setPhase('check');setError('');try{setInfo(await invoke<Info>('local_update_check'));}catch(e){setError(String(e));}finally{setPhase(null);}}
 async function startInstall(){setPhase('install');await invoke('local_update_install',{confirmed:true});}
 async function download(){
  if(!accepted||blocked||phase)return;
  setPhase('download');setError('');setReady(false);setProgress(null);
  const onProgress=new Channel<DownloadProgress>(event=>setProgress(event));
  try{setInfo(await invoke<Info>('local_update_download',{onProgress}));setReady(true);await startInstall();}
  catch(e){setError(String(e));setPhase(null);}
 }
 async function install(){if(!accepted||!ready||blocked||phase)return;setError('');try{await startInstall();}catch(e){setError(String(e));setPhase(null);}}
 const busy=phase!==null;
 return <>
  {info?.available&&<button type="button" className="update-pill" disabled={blocked} onClick={()=>{setAccepted(true);setOpen(true);}}>{t('发现新版本 {v0}',{v0:info.latest})}</button>}
  <AppDialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}} title={t('定制版更新')} description={t('点击后下载并校验更新，随后自动安装并重新打开 CCD Switch。')} footer={<>
   <Button variant="secondary" data-dialog-cancel disabled={busy} onClick={()=>setOpen(false)}>{t('取消')}</Button>
   <Button variant="secondary" onClick={()=>void invoke('local_release_open').catch(e=>setError(String(e)))}>{t('前往 GitHub 手动更新')}</Button>
   <Button variant="secondary" disabled={busy||blocked} onClick={()=>void check()}>{t('检查更新')}</Button>
   {!ready&&info?.available&&info.supported&&<Button variant="ink" disabled={busy||blocked||!accepted} onClick={()=>void download()}>{t('下载并自动安装')}</Button>}
   {ready&&<Button variant="ink" disabled={busy||blocked||!accepted} onClick={()=>void install()}>{t('重试安装')}</Button>}
  </>}>
   <p>{t('当前版本')}：{info?.current||version||'—'}</p>
   {info&&<p>{info.available?t('可更新至 {v0}',{v0:info.latest}):t('当前已是最新版本。')}</p>}
   {phase==='check'&&<p role="status">{t('正在检查更新…')}</p>}
   {phase==='download'&&<div role="status" className="update-download-progress">
    <p>{t(progress?.phase==='verifying'?'正在校验更新包…':progress?.phase==='downloading'?'正在下载更新':'正在检查更新…')}</p>
    {progress?.phase==='downloading'&&<>
     <progress aria-label={t('更新下载进度')} max={progress.total||undefined} value={progress.total?progress.received:undefined} style={{width:'100%'}}/>
     <p>{progress.total?t('已下载 {v0} / {v1}（{v2}%）',{v0:size(progress.received),v1:size(progress.total),v2:String(Math.min(100,Math.floor(progress.received/progress.total*100)))}):t('已下载 {v0}',{v0:size(progress.received)})}</p>
    </>}
   </div>}
   {phase==='install'&&<p role="status">{t('正在启动自动安装，完成后将重新打开 CCD Switch…')}</p>}
   {error&&<p role="alert">{t(error)}</p>}
   {info&&!info.supported&&<p>{t('此系统请使用维护安装流程。')}</p>}
   {ready&&<p>{t('更新包已通过 SHA-256 校验。')}</p>}
   {info?.available&&info.supported&&<div className="identity-confirm"><p>{t('安装将关闭 CCD Switch 并打开安装程序；不会结束 Claude Desktop 或 Claude Code，不会切换账号。')}</p><Checkbox disabled={busy} checked={accepted} onCheckedChange={value=>setAccepted(value===true)} label={t('我同意关闭 CCD Switch 并启动安装程序')}/></div>}
  </AppDialog>
 </>;
}

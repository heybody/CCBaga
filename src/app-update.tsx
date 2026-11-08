/**
 * [INPUT]: 当前版本和固定发布源的原生检查、下载进度与安装命令；固定发布页打开命令。
 * [OUTPUT]: 两端共用的设置内更新状态与操作：在线更新（真实字节进度、校验/安装阶段）与前往 GitHub 手动下载；启动及每六小时静默检查。
 * [POS]: 用户点击后才下载和安装，更新任务在关闭设置后继续；只重启 CCD Switch，不结束 Claude。
 */
import {Channel,invoke} from '@tauri-apps/api/core';
import {getVersion} from '@tauri-apps/api/app';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from 'cromma-ui';
import {useI18n} from './i18n';

type UpdateInfo={current:string;latest:string;available:boolean};
type DownloadProgress={phase:'checking'|'downloading'|'verifying';received:number;total:number|null};
type Action='check'|'download'|'install';
type Failure={action:Action;message:string;quiet:boolean};
const size=(bytes:number)=>`${(bytes/1024/1024).toFixed(1)} MiB`;

export function percentOf(progress:DownloadProgress|null){
 return progress?.phase==='downloading'&&progress.total?Math.min(100,Math.floor(progress.received/progress.total*100)):null;
}

export function useAppUpdate(){
 const [version,setVersion]=useState('');
 const [info,setInfo]=useState<UpdateInfo|null>(null);
 const [phase,setPhase]=useState<Action|null>(null);
 const [failure,setFailure]=useState<Failure|null>(null);
 const [progress,setProgress]=useState<DownloadProgress|null>(null);
 const pending=useRef(false);
 // 下载或安装失败后保留重试状态，后台检查不覆盖它，避免重新下载。
 const stuck=useRef(false);
 const run=useCallback(async (action:Action,quiet=false)=>{
  if(pending.current)return;
  pending.current=true;
  setPhase(action);
  if(!quiet)setFailure(null);
  let step=action;
  try {
   if(action==='check'){
    setInfo(await invoke<UpdateInfo>('local_update_check'));
    if(quiet)setFailure(null);
   }else{
    stuck.current=false;
    if(action==='download'){
     setProgress(null);
     const onProgress=new Channel<DownloadProgress>(setProgress);
     setInfo(await invoke<UpdateInfo>('local_update_download',{onProgress}));
     step='install';
     setPhase(step);
    }
    await invoke('local_update_install',{confirmed:true});
    // 安装接手后保持状态，直到当前程序退出。
    return;
   }
  }catch(error){
   if(step!=='check')stuck.current=true;
   setFailure({action:step,message:String(error),quiet});
  }
  pending.current=false;
  setPhase(null);
 },[]);
 useEffect(()=>{
  void getVersion().then(setVersion).catch(()=>{});
  void run('check',true);
  const timer=setInterval(()=>{if(!pending.current&&!stuck.current)void run('check',true);},6*60*60*1000);
  return ()=>clearInterval(timer);
 },[run]);
 return {version:info?.current||version,info,phase,failure,progress,run,busy:phase==='download'||phase==='install',percent:phase==='download'?percentOf(progress):null};
}

export function AppUpdate({update,blocked}:{update:ReturnType<typeof useAppUpdate>;blocked:boolean}){
 const {t}=useI18n();
 const {version,info,phase,failure,progress,run,percent}=update;
 const [linkError,setLinkError]=useState('');
 const mac=document.documentElement.classList.contains('mac');
 const available=!!info?.available;
 const download=phase==='download'&&progress?.phase==='downloading'?progress:null;
 const loud=failure&&!failure.quiet?failure:null;
 const action=loud?.action??(available?'download':'check');
 const button=t(loud?'重试':action==='download'?'在线更新':'检查更新');
 let status='';
 if(loud)status=t(action==='check'?'检查更新失败':action==='download'?'下载失败，未安装':'安装失败，当前版本未改动');
 else if(phase==='install')status=t('正在安装，完成后自动重新打开…');
 else if(phase==='check')status=t('正在检查更新…');
 else if(phase==='download'){
  if(download)status=download.total?t('已下载 {v0} / {v1} · {v2}%',{v0:size(download.received),v1:size(download.total),v2:String(percent??0)}):t('已下载 {v0}',{v0:size(download.received)});
  else status=t(progress?.phase==='verifying'?'正在校验安装包…':'正在准备下载…');
 }else if(info)status=available?t('新版本 {v0} 可用',{v0:info.latest}):t('已是最新版');
 else if(failure)status=t('暂时无法检查更新');
 // 下载有总量时显示确定进度；准备、未知总量、校验和安装阶段显示不确定进度条。
 const bar=phase==='download'||phase==='install';
 const openRelease=()=>{setLinkError('');void invoke('local_release_open').catch(error=>setLinkError(String(error)));};
 return <section className="update-card" aria-label={t('软件更新')}>
  <div className="update-row">
   <div className="update-meta">
    <strong>{t('软件更新')}</strong>
    {version&&<small>{version}</small>}
   </div>
   <div className="update-actions">
    <Button size="small" variant="secondary" onClick={openRelease}>{t('GitHub 下载')}</Button>
    {!phase&&<Button size="small" variant={action==='check'?'secondary':'ink'} disabled={blocked} onClick={()=>void run(action)}>{button}</Button>}
   </div>
  </div>
  {status&&<span className="update-status" role={loud?'alert':'status'}>{status}</span>}
  {bar&&<progress aria-label={t('更新进度')} max={download?.total||undefined} value={download?.total?download.received:undefined}/>}
  {!phase&&!loud&&available&&<p>{t('在线更新只会重启 CCD Switch，不会关闭 Claude，也不会切换账号。')}{mac?t('macOS 可能请求一次钥匙串授权，用于保持应用签名。'):''}</p>}
  {!phase&&!loud&&!available&&<p>{t('也可以在 GitHub 查看最新版本并手动下载安装。')}</p>}
  {loud&&<details className="update-error">
   <summary>{t('错误详情')}</summary>
   <p>{t(loud.message)}</p>
  </details>}
  {loud&&<p>{t('也可以在 GitHub 下载安装包手动更新。')}</p>}
  {linkError&&<p role="alert">{t(linkError)}</p>}
 </section>;
}

/**
 * [INPUT]: 当前版本和固定发布源的原生检查、下载进度与安装命令。
 * [OUTPUT]: 两端共用的设置内更新状态与操作，启动及每六小时检查。
 * [POS]: 用户点击后才下载和安装，更新任务在关闭设置后继续。
 */
import {Channel,invoke} from '@tauri-apps/api/core';
import {getVersion} from '@tauri-apps/api/app';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from 'cromma-ui';
import {useI18n} from './i18n';

type UpdateInfo={current:string;latest:string;available:boolean};
type DownloadProgress={phase:'checking'|'downloading'|'verifying';received:number;total:number|null};
type Action='check'|'download'|'install';
const size=(bytes:number)=>`${(bytes/1024/1024).toFixed(1)} MiB`;

export function useAppUpdate(){
 const [version,setVersion]=useState('');
 const [info,setInfo]=useState<UpdateInfo|null>(null);
 const [phase,setPhase]=useState<Action|null>(null);
 const [failure,setFailure]=useState<{action:Action;message:string}|null>(null);
 const [progress,setProgress]=useState<DownloadProgress|null>(null);
 const pending=useRef(false);
 const run=useCallback(async (action:Action)=>{
  if(pending.current)return;
  pending.current=true;
  setPhase(action);
  setFailure(null);
  let step=action;
  try {
   if(action==='check'){
    setInfo(await invoke<UpdateInfo>('local_update_check'));
   }else{
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
   setFailure({action:step,message:String(error)});
  }
  pending.current=false;
  setPhase(null);
 },[]);
 useEffect(()=>{
  void getVersion().then(setVersion).catch(()=>{});
  void run('check');
  const timer=setInterval(()=>{if(!pending.current)void run('check');},6*60*60*1000);
  return ()=>clearInterval(timer);
 },[run]);
 return {version:info?.current||version,info,phase,failure,progress,run,busy:phase==='download'||phase==='install'};
}

export function AppUpdate({update,blocked}:{update:ReturnType<typeof useAppUpdate>;blocked:boolean}){
 const {t}=useI18n();
 const {version,info,phase,failure,progress,run}=update;
 const available=!!info?.available;
 const download=phase==='download'&&progress?.phase==='downloading'?progress:null;
 const percent=download?.total?Math.min(100,Math.floor(download.received/download.total*100)):null;
 const action=failure?.action??(available?'download':'check');
 const button=t(failure?'重试':action==='download'?'下载并安装':'检查更新');
 let status='';
 if(failure)status=t(action==='check'?'检查更新失败':action==='download'?'下载失败':'安装失败');
 else if(phase==='install')status=t('正在安装…');
 else if(phase==='check')status=t('正在检查更新…');
 else if(phase==='download'){
  if(download)status=percent===null?t('已下载 {v0}',{v0:size(download.received)}):t('下载中 {v0}%',{v0:String(percent)});
  else status=t(progress?.phase==='verifying'?'正在校验…':'正在准备下载…');
 }else if(info)status=available?t('有新版本 {v0}',{v0:info.latest}):t('已是最新版');
 return <section className="update-card" aria-label={t('软件更新')}>
  <div className="update-row">
   <div className="update-meta">
    <strong>{t('软件更新')}</strong>
    {version&&<small>{version}</small>}
    {status&&<span role={failure?'alert':'status'}>{status}</span>}
   </div>
   {!phase&&<Button size="small" variant={action==='check'?'secondary':'ink'} disabled={blocked} onClick={()=>void run(action)}>{button}</Button>}
  </div>
  {download&&<progress aria-label={t('更新下载进度')} max={download.total||undefined} value={download.total?download.received:undefined}/>}
  {!phase&&!failure&&available&&<p>{t('更新会重启 CCD Switch。')}</p>}
  {failure&&<details className="update-error">
   <summary>{t('错误详情')}</summary>
   <p>{t(failure.message)}</p>
  </details>}
 </section>;
}

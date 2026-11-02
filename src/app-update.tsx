/**
 * [INPUT]: 固定 fork 的原生更新检查/校验下载/确认安装接口、当前版本与身份事务锁。
 * [OUTPUT]: 启动与每六小时静默检测、仅在有新版本时显示的标题栏提示、可由设置抽屉受控打开的更新窗、应用内下载和明确确认后启动 Windows 安装器。
 * [POS]: 定制版更新入口；只在用户确认时关闭 CCD Switch，不结束 Claude 进程。
 */
import {invoke} from '@tauri-apps/api/core';
import {getVersion} from '@tauri-apps/api/app';
import {useEffect,useState} from 'react';
import {Button,Checkbox} from 'cromma-ui';
import {AppDialog} from './dialog';
import {useI18n} from './i18n';
export type UpdateInfo={current:string;latest:string;available:boolean;supported:boolean};
type Info=UpdateInfo;
export function AppUpdate({blocked,open:controlled,onOpenChange,onInfo}:{blocked:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;onInfo?:(info:Info|null,version:string)=>void}){
 const {t}=useI18n();
 const [local,setLocal]=useState(false),[version,setVersion]=useState(''),[info,setInfo]=useState<Info|null>(null);
 const open=controlled??local;
 const setOpen=(value:boolean)=>{setLocal(value);onOpenChange?.(value);};
 useEffect(()=>{onInfo?.(info,version);},[info,version]);
 const [phase,setPhase]=useState<'check'|'download'|'install'|null>(null),[ready,setReady]=useState(false),[accepted,setAccepted]=useState(false),[error,setError]=useState('');
 // ----- 受控打开时重置确认，避免沿用上一次勾选 -----
 useEffect(()=>{if(open)setAccepted(false);},[open]);
 useEffect(()=>{
  let live=true;
  void getVersion().then(v=>{if(live)setVersion(v);}).catch(()=>{});
  const check=()=>void invoke<Info>('local_update_check').then(v=>{if(live){setInfo(v);setError('');}}).catch(e=>{if(live)setError(String(e));});
  check();const timer=setInterval(check,6*60*60*1000);
  return()=>{live=false;clearInterval(timer);};
 },[]);
 async function check(){setPhase('check');setError('');try{setInfo(await invoke<Info>('local_update_check'));}catch(e){setError(String(e));}finally{setPhase(null);}}
 async function download(){setPhase('download');setError('');setReady(false);setAccepted(false);try{setInfo(await invoke<Info>('local_update_download'));setReady(true);}catch(e){setError(String(e));}finally{setPhase(null);}}
 async function install(){if(!accepted||!ready||blocked)return;setPhase('install');setError('');try{await invoke('local_update_install',{confirmed:true});}catch(e){setError(String(e));setPhase(null);}}
 const busy=phase!==null;
 return <>
  {info?.available&&<button type="button" className="update-pill" disabled={blocked} onClick={()=>{setAccepted(false);setOpen(true);}}>{t('发现新版本 {v0}',{v0:info.latest})}</button>}
  <AppDialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}} title={t('定制版更新')} description={t('自动检测定制版更新；下载完成并由你确认后，才启动安装程序。')} footer={<>
   <Button variant="secondary" data-dialog-cancel disabled={busy} onClick={()=>setOpen(false)}>{t('取消')}</Button>
   <Button variant="secondary" disabled={busy||blocked} onClick={()=>void check()}>{t('检查更新')}</Button>
   {!ready&&info?.available&&info.supported&&<Button variant="ink" disabled={busy||blocked} onClick={()=>void download()}>{t('下载更新')}</Button>}
   {ready&&<Button variant="ink" disabled={busy||blocked||!accepted} onClick={()=>void install()}>{t('关闭 CCD Switch 并启动安装')}</Button>}
  </>}>
   <p>{t('当前版本')}：{info?.current||version||'—'}</p>
   {info&&<p>{info.available?t('可更新至 {v0}',{v0:info.latest}):t('当前已是最新版本。')}</p>}
   {phase==='check'&&<p role="status">{t('正在检查更新…')}</p>}
   {phase==='download'&&<p role="status">{t('正在下载并校验更新包，请稍候…')}</p>}
   {error&&<p role="alert">{t(error)}</p>}
   {info&&!info.supported&&<p>{t('此系统请使用维护安装流程。')}</p>}
   {ready&&<div className="identity-confirm"><strong>{t('更新包已通过 SHA-256 校验。')}</strong><p>{t('安装将关闭 CCD Switch 并打开安装程序；不会结束 Claude Desktop 或 Claude Code，不会切换账号。')}</p><Checkbox checked={accepted} onCheckedChange={value=>setAccepted(value===true)} label={t('我同意关闭 CCD Switch 并启动安装程序')}/></div>}
  </AppDialog>
 </>;
}

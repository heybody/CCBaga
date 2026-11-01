/**
 * [INPUT]: 应用版本、固定定制版 Release 入口、共享界面语言与事务锁。
 * [OUTPUT]: 当前版本与手动更新说明；仅用户点击时打开定制版发布页。
 * [POS]: 身份专用版更新入口；不检查或安装上游原版，不下载或替换应用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {invoke} from '@tauri-apps/api/core';
import {getVersion} from '@tauri-apps/api/app';
import {useEffect,useState} from 'react';
import {Button,NavButton} from 'cromma-ui';
import {Refresh} from 'cromma-ui/pika';
import {AppDialog} from './dialog';
import {useI18n} from './i18n';
export function AppUpdate({blocked}:{blocked:boolean}){
  const {t}=useI18n();
  const [open,setOpen]=useState(false),[version,setVersion]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    void getVersion().then(value=>{if(live)setVersion(value);}).catch(e=>{if(live)setError(String(e));});
    return()=>{live=false;};
  },[]);
  async function releases(){
    setError('');
    try{await invoke('local_release_open');}catch(e){setError(String(e));}
  }
  return <>
    <NavButton className="workspace-nav update-nav" icon={<Refresh size={17} aria-hidden="true"/>} disabled={blocked} onClick={()=>setOpen(true)}>{t('定制版更新')}</NavButton>
    <AppDialog open={open} onOpenChange={setOpen} title={t('定制版更新')} description={t('本版本通过定制版发布页手动更新，请下载对应系统的安装包。')}>
      <p>{t('当前版本')}：{version||'—'}</p>
      {error&&<p role="alert">{error}</p>}
      <Button variant="ink" disabled={blocked} onClick={()=>void releases()}>{t('打开定制版发布页')}</Button>
    </AppDialog>
  </>;
}

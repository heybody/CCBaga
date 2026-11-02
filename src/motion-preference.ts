/**
 * [INPUT]: 本机 localStorage 中的界面动效开关与系统「减弱动态」偏好。
 * [OUTPUT]: useMotionSetting：用户开关、写入函数与最终是否播放动效（系统要求减弱动态时一律关闭）。
 * [POS]: 纯界面偏好；不进入宿主设置、身份保险库或原生命令，读写失败时按默认开启处理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {useSyncExternalStore} from 'react';
const key='ccd-switch.motion';
const listeners=new Set<()=>void>();
const media=typeof window==='undefined'?null:window.matchMedia('(prefers-reduced-motion: reduce)');
function stored():boolean{try{return localStorage.getItem(key)!=='off';}catch{return true;}}
let enabled=stored();
function subscribe(notify:()=>void){
 listeners.add(notify);media?.addEventListener('change',notify);
 return()=>{listeners.delete(notify);media?.removeEventListener('change',notify);};
}
export function setMotionEnabled(next:boolean){
 enabled=next;
 try{localStorage.setItem(key,next?'on':'off');}catch{/* 仅影响下次启动的默认值 */}
 listeners.forEach(notify=>notify());
}
export function useMotionSetting(){
 const on=useSyncExternalStore(subscribe,()=>enabled,()=>true);
 const reduced=useSyncExternalStore(subscribe,()=>media?.matches??false,()=>false);
 return {enabled:on,reduced,active:on&&!reduced};
}

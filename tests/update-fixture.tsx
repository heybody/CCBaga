import React from 'react';
import {MotionRoot,TooltipProvider} from 'cromma-ui';
import '../src/index.css';
import {createRoot} from 'react-dom/client';
import {mockIPC} from '@tauri-apps/api/mocks';
import {AppUpdate,useAppUpdate} from '../src/app-update';
import '../src/style.css';
let pending:{resolve:(value:unknown)=>void;reject:(error:Error)=>void;channel:any;index:number}|null=null;
const fixture={commands:[] as {command:string,args:any}[],fail:'',info:{current:'0.2.50+local.12',latest:'0.2.50+local.13',available:new URLSearchParams(location.search).get('available')!=='false'},
 emit:(event:any)=>{if(!pending)throw Error('no download');const id=typeof pending.channel==='string'?Number(pending.channel.replace('__CHANNEL__:','')):pending.channel.id;(window as any).__TAURI_INTERNALS__.runCallback(id,{index:pending.index++,message:event});},
 release:()=>{if(!pending)throw Error('no download');const request=pending;pending=null;request.resolve(structuredClone(fixture.info));},
 reject:()=>{if(!pending)throw Error('no download');const request=pending;pending=null;request.reject(Error('fixture download failed'));},
};
Object.assign(window,{updateFixture:fixture});
mockIPC((command,args:any)=>{fixture.commands.push({command,args});if(fixture.fail===command){fixture.fail='';throw Error('fixture update failed');}if(command==='plugin:app|version')return fixture.info.current;if(command==='local_update_check')return structuredClone(fixture.info);if(command==='local_update_download')return new Promise((resolve,reject)=>{pending={resolve,reject,channel:args.onProgress,index:0};});if(command==='local_update_install'){if(args.confirmed!==true)throw Error('consent missing');return;}if(command==='ui_language_read')return 'zh';});
function Fixture(){
 const update=useAppUpdate();
 return <div className="drawer-body" style={{width:460}}><AppUpdate update={update} blocked={false}/></div>;
}
createRoot(document.getElementById('root')!).render(<MotionRoot><TooltipProvider><Fixture/></TooltipProvider></MotionRoot>);

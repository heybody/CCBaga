/**
 * [INPUT]: 原生身份命令、保留策略、共享确认窗/进度、文件残留与 CLI 维护、定制版更新、界面语言与本机动效开关。
 * [OUTPUT]: 深色紧凑切换器：标题栏（更新提示/刷新/残留/设置）、身份插槽列表（当前身份高亮、点击行在原地展开切换确认、⋯ 菜单备份/重命名/删除）、底部切换选项与工作区保留抽屉、切换后可一键切回的提示；设置/残留/保留/说明以侧滑抽屉呈现，键盘 ↑↓/Enter/1–9/Esc。
 * [POS]: 身份管理 GUI；只呈现脱敏元数据，身份正文留在原生保险库；切换/备份/恢复仍需每次独立勾选结束进程，永久删除保留默认聚焦取消的 AlertDialog；不提供浏览器联动与导入导出入口，旧关联资料由原生层兼容。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {useEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {Button,Checkbox,Input} from 'cromma-ui';
import {Refresh,Settings01 as Settings,EraserDefault,FolderDefault} from 'cromma-ui/pika';
import {AnimatePresence,MotionConfig,motion} from 'motion/react';
import {invoke} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {useI18n} from './i18n';
import {AppDialog} from './dialog';
import {ClaudeStopConsent} from './claude-stop-consent';
import {IdentityOperationProgress,useCleanupActivity} from './cleaner-activity';
import {formatBytes} from './cleaner-model';
import {ClaudeCliPanel} from './claude-cli-panel';
import {ClaudeResiduePanel} from './claude-residue-panel';
import {AppUpdate,type UpdateInfo} from './app-update';
import {LanguageSwitch} from './language-switch';
import {HelpPanel} from './help';
import {setMotionEnabled,useMotionSetting} from './motion-preference';
import {credentialStatus,currentAccountMessage,defaultPolicy,policyRows,type Identity,type IdentityState,type PlanUsage} from './identity-model';
type Target=Identity|'empty'|'recovery'|'save';
type Drawer='settings'|'residue'|'keep'|'help';
type Slot={key:string;kind:'current'|'saved'|'empty';record?:Identity;target?:Target};
/** 个人账号默认组织名「<邮箱>'s Organization」只是重复邮箱，不再单独显示。 */
function organization(meta:{email?:string|null;organization?:string|null}|null|undefined) {
 const org=meta?.organization;
 return org&&meta?.email&&org===`${meta.email}'s Organization`?null:org;
}
function usageLevel(value:number){return value>=100?' full':value>=80?' high':'';}
function UsageLine({usage,now,t}:{usage:PlanUsage;now:number;t:(key:string,values?:Record<string,string|number>)=>string}){
 const minutes=Math.max(0,Math.round((now-usage.sampled_at)/60000));
 const ago=minutes<1?t('刚刚'):minutes<60?t('{v0} 分钟前',{v0:minutes}):minutes<2880?t('{v0} 小时前',{v0:Math.round(minutes/60)}):t('{v0} 天前',{v0:Math.round(minutes/1440)});
 const bar=(label:string,value?:number)=>value===undefined?null:<span className={`usage-item${usageLevel(value)}`}><span>{label}</span><i aria-hidden="true"><b style={{width:`${value}%`}}/></i><code>{value}%</code></span>;
 return <span className="slot-usage" title={`${t('来自 Claude 桌面 App 本地用量记录，不是实时数据。')} · ${ago}`}>{bar(t('5h'),usage.five_hour)}{bar(t('周'),usage.seven_day)}</span>;
}
function authLabel(status:string|null|undefined) {
 if(status==='local_unexpired')return '本地未过期';
 if(status==='refresh_available')return '可尝试续期';
 if(status==='expired')return '本地已到期';
 if(status==='api_key')return 'API 密钥';
 return '状态未知';
}
const sameTarget=(a:Target|null,b:Target|undefined)=>!!a&&!!b&&(a===b||(typeof a==='object'&&typeof b==='object'&&a.id===b.id));
export function IdentityPanel({onBusy, initialEmpty=false}: {onBusy?: (busy:boolean)=>void; initialEmpty?:boolean}) {
 const {t, locale}=useI18n();
 const motionSetting=useMotionSetting();
 const [state,setState]=useState<IdentityState|null>(null);
 const [now,setNow]=useState(Date.now);
 const [policy,setPolicy]=useState({...defaultPolicy});
 const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [cliBusy,setCliBusy]=useState(false);
 const [residueBusy,setResidueBusy]=useState(false),[residueRevision,setResidueRevision]=useState(0);
 const [error,setError]=useState('');
 const [stopAccepted,setStopAccepted]=useState(false);
 const [review,setReview]=useState<Target|null>(initialEmpty?'empty':null);
 const [name,setName]=useState(t('当前身份'));
 const [rename,setRename]=useState<Identity|null>(null), [renameValue,setRenameValue]=useState('');
 const [deletion,setDeletion]=useState<Identity|'current'|null>(null), [accepted,setAccepted]=useState(false);
 const [drawer,setDrawer]=useState<Drawer|null>(null);
 const [menu,setMenu]=useState<string|null>(null);
 const [showProcesses,setShowProcesses]=useState(false);
 const [toast,setToast]=useState<{text:string;back?:string}|null>(null);
 const [updateOpen,setUpdateOpen]=useState(false),[update,setUpdate]=useState<{info:UpdateInfo|null;version:string}>({info:null,version:''});
 const activity=useCleanupActivity();
 const list=useRef<HTMLOListElement>(null);
 const locked=busy||cliBusy||residueBusy||!!review||!!rename||!!deletion;
 const active=state?.records.find(row=>row.id===state.active);
 const current=state?.current;
 const saved=state?.records.filter(row=>!current?.present||row.id!==state.active)??[];
 const currentName=current?.display_name||current?.email?.split('@')[0]||active?.name||t('当前身份');
 // ----- 行内确认期间仍可改选其他身份；其余任务、重命名或删除确认进行时锁定 -----
 const rowBlocked=busy||cliBusy||residueBusy||!!rename||!!deletion||loading||!state||!!state?.recovery;
 const blocked=locked||loading||!state||!!state?.recovery;
 const effectivePolicy={...policy,history:review==='save'?false:review&&state?.options?.carry_sessions?true:policy.history};
 const kept=policyRows.filter(([key])=>effectivePolicy[key]).map(([,label])=>t(label));
 const removed=policyRows.filter(([key])=>!effectivePolicy[key]).map(([,label])=>t(label));
 const slots:Slot[]=[
  ...(loading&&!state||current?.present?[{key:'current',kind:'current' as const,target:'save' as const}]:[]),
  ...saved.map(record=>({key:record.id,kind:'saved' as const,record,target:record as Target})),
  {key:'empty',kind:'empty',target:'empty'},
 ];
 const isActive=(slot:Slot)=>slot.kind==='current'||(slot.kind==='empty'&&current?.present===false);
 useEffect(()=>{void read();},[]);
 // ----- 主界面只显示身份操作进度：残留扫描结果留在残留抽屉；成功完成 4 秒后收起，打开确认时让位 -----
 const [progressHidden,setProgressHidden]=useState(false);
 const act=activity.state;
 useEffect(()=>{
  if(!act)return;
  if(act.running){setProgressHidden(false);return;}
  if(act.failed||act.warning)return;
  const timer=setTimeout(()=>setProgressHidden(true),4000);return()=>clearTimeout(timer);
 },[act?.running,act?.failed,act?.warning,act?.started]);
 const showProgress=!!act&&(act.running||((act.kind==='identity'||act.kind==='clean')&&!progressHidden&&!review));
 useEffect(()=>{
  if(!review)return;
  const frame=requestAnimationFrame(()=>document.querySelector('.slot.expanded, .ccd-recovery')?.scrollIntoView({block:'start',behavior:motionSetting.active?'smooth':'auto'}));
  return()=>cancelAnimationFrame(frame);
 },[review]);
 // ----- 菜单栏快捷切换：只同步名称列表；点选后在窗口内打开同一行内确认，结束进程仍需逐次勾选 -----
 const trayPick=useRef<(id:string)=>void>(()=>{});
 trayPick.current=id=>{
  if(rowBlocked)return;
  const target:Target|undefined=id==='empty'?(current?.present===false?undefined:'empty'):saved.find(row=>row.id===id);
  if(target)choose(target);
 };
 useEffect(()=>{
  if(!state)return;
  const entries=[
   ...(current?.present?[{id:active?.id||'current',name:currentName,active:true}]:[]),
   ...saved.map(row=>({id:row.id,name:row.name,active:false})),
   {id:'empty',name:t('空身份'),active:current?.present===false},
  ];
  void invoke('tray_identities_set',{entries}).catch(()=>{});
 },[state,currentName]);
 useEffect(()=>{
  let stop:(()=>void)|undefined,gone=false;
  void listen<string>('tray-switch',event=>trayPick.current(event.payload)).then(off=>{if(gone)off();else stop=off;}).catch(()=>{});
  return()=>{gone=true;stop?.();};
 },[]);
 useEffect(()=>{
  const deadlines=[state?.current,...Object.values(state?.summaries??{})].map(item=>item?.expires_at).filter((expiry):expiry is number=>typeof expiry==='number'&&Number.isSafeInteger(expiry)&&expiry>now);
  if(!deadlines.length)return;
  const timer=setTimeout(()=>setNow(Date.now()),Math.min(2147483647,Math.max(1,Math.min(...deadlines)-Date.now())));
  return()=>clearTimeout(timer);
 },[state,now]);
 useEffect(()=>{onBusy?.(locked);return()=>onBusy?.(false);},[locked,onBusy]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),6000);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{
  if(!menu)return;
  const close=(event:PointerEvent)=>{if(!(event.target as Element).closest('.slot-menu, .slot-more'))setMenu(null);};
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
 },[menu]);
 async function read(invalidateResidue=true) {
  setLoading(true);
  try {
   const next=await invoke<IdentityState>('identities_read');
   setState(next);if(invalidateResidue)setResidueRevision(value=>value+1);setError('');
   if(review==='empty'){
    const resolved=next.current.display_name||next.current.email?.split('@')[0]||next.records.find(row=>row.id===next.active)?.name||t('当前身份');
    setName(old=>old===t('当前身份')?resolved.slice(0,64):old);
   }
   return true;
  }
  catch(e) {setError(String(e));return false;} finally {setLoading(false);}
 }
 async function setOptions(change:Partial<IdentityState['options']>) {
  const current=state?.options??{carry_sessions:false,fast_archive:false};
  const next={...current,...change};
  try {setState(await invoke<IdentityState>('identities_options',{carrySessions:next.carry_sessions,fastArchive:next.fast_archive}));setError('');}
  catch(e) {setError(String(e));}
 }
 async function refreshAfterError() {
  setResidueRevision(value=>value+1);
  try {setState(await invoke<IdentityState>('identities_read'));} catch {/* 保留操作错误，不掩盖恢复失败。 */}
 }
 function choose(target:Target) {
  setName(target==='recovery'?t('恢复前状态'):target==='save'?(active?.name||currentName).slice(0,64):currentName.slice(0,64));
  if(target==='recovery') {const previous=state?.records.find(row=>row.id===state.recovery);if(previous)setPolicy({...previous.policy});}
  else if(target==='save'&&active)setPolicy({...active.policy});
  setStopAccepted(false);setShowProcesses(false);setMenu(null);setToast(null);setReview(target);setError('');
 }
 async function stop() {
  await invoke('identities_stop',{confirmed:stopAccepted,onProgress:activity.channel()});
 }
 async function change() {
  if(!review||busy||!stopAccepted)return;
  const target=review,previous=current?.present===false?'empty':active?.id;setReview(null);setBusy(true);setError('');
  const onProgress=activity.start('identity',target==='recovery'?'恢复原身份':target==='save'?'保存当前身份备份':target==='empty'?'切换到空身份':'切换身份');
  try {
   await stop();
   const next=target==='save'
    ?await invoke<IdentityState>('identities_save',{currentName:name.trim(),policy:{...policy,history:false},onProgress})
    :await invoke<IdentityState>('identities_switch', {targetId:typeof target==='object'?target.id:'empty', currentName:name.trim(), policy, recover:target==='recovery', onProgress});
   setState(next);
   setResidueRevision(value=>value+1);
   activity.finish(true,next.browser_warning||(target==='recovery'?'原身份已恢复。':target==='save'?'当前身份已加密备份，工作区保持不变。':'身份切换完成。'));
   if(typeof target==='object'||target==='empty'){
    const back=previous==='empty'?(next.current.present?'empty':undefined):previous&&next.records.some(row=>row.id===previous)&&next.active!==previous?previous:undefined;
    setToast({text:typeof target==='object'?t('已切换到 {v0}',{v0:target.name}):t('已切换到空身份'),back});
   }
  } catch(e) {setError(String(e));activity.finish(false,String(e));await refreshAfterError();}
  finally {setBusy(false);}
 }
 function confirmDelete(target:Identity|'current') {setMenu(null);setDeletion(target);setStopAccepted(false);setAccepted(false);setError('');}
 async function remove() {
  if(!deletion||!accepted||busy||(deletion==='current'&&!stopAccepted))return;
  const target=deletion;setDeletion(null);setBusy(true);setError('');
  const onProgress=activity.start('identity',target==='current'?'直接删除当前身份':'删除暂存身份');
  try {
   if(target==='current')await stop();
   const next=await invoke<IdentityState>('identities_delete',{id:target==='current'?'current':target.id,policy,deleteBrowser:false,onProgress});
   setState(next);
   setResidueRevision(value=>value+1);
   activity.finish(true,next.browser_warning||'所选本地身份已直接删除。');
  } catch(e) {setError(String(e));activity.finish(false,String(e));await refreshAfterError();}
  finally {setBusy(false);}
 }
 async function saveName() {
  if(!rename||busy||!renameValue.trim())return;
  setBusy(true);
  try {setState(await invoke<IdentityState>('identities_rename',{id:rename.id,value:renameValue}));setRename(null);setError('');}
  catch(e) {setError(String(e));} finally {setBusy(false);}
 }
 function startRename(row:Identity){setMenu(null);setReview(null);setRename(row);setRenameValue(row.name);setError('');}
 // ----- 确认区只做展开动画；收起立即移除，避免退出动画残留过期的确认内容 -----
 // ----- 键盘：↑↓ 在可切换行之间移动，数字直达，Esc 逐层收起 -----
 function keys(event:KeyboardEvent<HTMLElement>){
  const target=event.target as Element;
  if(target.closest('.app-dialog-position'))return;
  if(event.key==='Escape'){
   if(menu)setMenu(null);else if(drawer)setDrawer(drawer==='help'?'settings':null);else if(review&&!busy)setReview(null);else return;
   event.preventDefault();return;
  }
  if(drawer||target.closest('input, textarea'))return;
  const buttons=[...(list.current?.querySelectorAll<HTMLButtonElement>('.slot-main')??[])];
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   const at=buttons.indexOf(document.activeElement as HTMLButtonElement);
   const next=buttons[(at+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length];
   next?.focus();event.preventDefault();return;
  }
  if(/^[1-9]$/.test(event.key)&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
   const button=buttons[Number(event.key)-1];
   if(button){button.focus();if(!button.disabled)button.click();event.preventDefault();}
  }
 }
 const carry=state?.options?.carry_sessions??false;
 const fast=state?.options?.fast_archive??false;
 const running=loading?t('检查中'):state?.processes==null?t('进程状态未知'):state.running?t('Claude 运行中'):t('Claude 未运行');
 const date=(value:number)=>new Date(value).toLocaleString(locale==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const confirmTitle=(target:Target)=>target==='recovery'?t('恢复原身份'):target==='save'?t(active?'更新当前身份备份':'保存当前身份备份'):target==='empty'?t('切换到空身份'):t('切换身份');
 const confirmTitle2=(target:Target)=>target==='recovery'||target==='save'?confirmTitle(target):t('切换到 {v0}',{v0:target==='empty'?t('空身份'):target.name});
 // ----- 确认面板：标题与按钮固定，中间内容可滚动；切换/备份以底部弹层呈现，恢复仍在恢复提示内 -----
 const confirmPanel=(target:Target,sheet=false)=><motion.div key="confirm" className={`slot-confirm${sheet?' ccd-sheet':''}`} role="region" aria-label={confirmTitle(target)}
  initial={sheet?{y:'100%'}:{height:0,opacity:0}} animate={sheet?{y:0}:{height:'auto',opacity:1}} exit={sheet?{y:'100%'}:undefined} transition={sheet?{type:'spring',stiffness:420,damping:38}:{duration:.22,ease:[.2,.8,.2,1]}}>
  {sheet&&<header className="sheet-head"><strong>{confirmTitle2(target)}</strong><button type="button" className="drawer-close" aria-label={t('关闭')} onClick={()=>setReview(null)}>✕</button></header>}
  <div className="slot-confirm-body">
   <p className="slot-confirm-lead">{target==='save'?t('把当前身份原地加密写入保险库；当前工作区与登录保持不变。'):target==='recovery'?t('先存下现状，再恢复上一次未完成切换前的身份。'):t('先加密备份当前身份，再换成 {v0}。',{v0:target==='empty'?t('空身份'):target.name})}</p>
   <div className="slot-confirm-grid">
    <label htmlFor="identity-current-name">{t('当前身份保存为')}</label><Input id="identity-current-name" maxLength={64} value={name} onChange={e=>setName(e.target.value)}/>
    {target==='save'&&<><span>{t('纳入加密备份')}</span><strong>{[t('登录与身份数据'),...removed].join(' · ')}</strong></>}
    <span>{t('留在工作区')}</span><strong>{kept.join(' · ')||t('无')}{target!=='recovery'&&<button type="button" className="slot-link inline" onClick={()=>setDrawer('keep')}>{t('调整')}</button>}</strong>
   </div>
   <div className="slot-processes">
    <button type="button" className="slot-link" aria-expanded={showProcesses} onClick={()=>setShowProcesses(value=>!value)}>{state?.processes==null?t('进程状态未知；执行前将重新核验。'):state.processes.length?t('确认后结束 {v0} 个 Claude 进程',{v0:state.processes.length}):t('未检测到 Claude 进程。')}</button>
    {showProcesses&&!!state?.processes?.length&&<ul>{state.processes.map(process=><li key={process.pid}><code>PID {process.pid}</code><span>{process.entrypoint}</span></li>)}</ul>}
    {state?.processes_truncated&&<p>{t('仅显示前 32 个进程；执行时重新核验完整范围。')}</p>}
   </div>
   <ClaudeStopConsent checked={stopAccepted} onChange={setStopAccepted}/>
   <p className="slot-note">{t('只管理本地状态；失效的登录可能需要重新认证。')}</p>
  </div>
  <div className="slot-confirm-actions">
   <Button variant="secondary" size="small" data-dialog-cancel autoFocus onClick={()=>setReview(null)}>{t('取消')}</Button>
   <Button variant="ink" size="small" disabled={!stopAccepted||busy||loading||!state||!name.trim()||(target!=='recovery'&&!!state.recovery)} onClick={()=>void change()}>{target==='recovery'?t('结束进程并恢复'):target==='save'?t('结束进程并保存备份'):t('结束进程、暂存并切换')}</Button>
   <span className="slot-hint">{t('Esc 取消')}</span>
  </div>
 </motion.div>;
 function slotView(slot:Slot,index:number){
  const on=isActive(slot);
  const summary=slot.record?state?.summaries?.[slot.record.id]:undefined;
  const meta=slot.kind==='current'?current:summary;
  const status=meta?credentialStatus(meta,now):null;
  const title=slot.kind==='empty'?t('空身份'):slot.kind==='current'?currentName:slot.record!.name;
  const email=slot.kind==='current'?(current?.email||t(currentAccountMessage(current))):slot.kind==='saved'?summary?.email:t('清空本地登录，保留所选工作区资料');
  const detail=slot.kind==='current'?[organization(current),t(active?'已备份':'未备份')]:slot.kind==='saved'?[organization(summary),date(slot.record!.saved_at),formatBytes(slot.record!.bytes)]:[];
  const renaming=rename&&slot.record&&rename.id===slot.record.id;
  const expanded=sameTarget(review,slot.target);
  const menuItems:{label:string;run:()=>void;danger?:boolean}[]=slot.kind==='current'?[
   {label:active?t('更新备份'):t('保存备份'),run:()=>choose('save')},
   {label:t('直接删除'),run:()=>confirmDelete('current'),danger:true},
  ]:slot.kind==='saved'?[
   {label:t('重命名'),run:()=>startRename(slot.record!)},
   {label:t('删除'),run:()=>confirmDelete(slot.record!),danger:true},
  ]:[];
  return <motion.li key={slot.key} layout="position" className={`slot ${slot.kind}${on?' active':''}${expanded?' expanded':''}`} data-slot={slot.kind}
   initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index,8)*.035,duration:.24}}>
   {on&&<motion.span layoutId="slot-active-glow" className="slot-glow" aria-hidden="true" transition={{type:'spring',stiffness:420,damping:36}}/>}
   <div className="slot-row">
    {renaming?<form className="slot-main slot-rename" onSubmit={event=>{event.preventDefault();void saveName();}}>
      <span className="slot-index" aria-hidden="true">{index+1}</span>
      <Input aria-label={t('身份名称')} maxLength={64} autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setRename(null);setError('');}}}/>
      <Button size="small" variant="ink" type="submit" disabled={busy||!renameValue.trim()}>{t('保存')}</Button>
      <Button size="small" variant="ghost" type="button" onClick={()=>{setRename(null);setError('');}}>{t('取消')}</Button>
     </form>
    :<button type="button" className="slot-main" disabled={!on&&rowBlocked} aria-disabled={on||undefined} aria-current={on?'true':undefined} aria-expanded={!on?expanded:undefined}
      aria-label={on?`${title} · ${t('当前使用')}`:`${t('切换到')} ${title}`}
      onClick={()=>{if(on||!slot.target)return;if(expanded)setReview(null);else choose(slot.target);}}>
      <span className={`slot-index${on?' live':''}`} aria-hidden="true">{on?<i className="slot-dot"/>:index+1}</span>
      <span className="slot-text">
       <span className="slot-title"><strong>{title}</strong>{meta?.plan&&slot.kind!=='empty'&&<span className={`slot-plan plan-${meta.plan.split(/[\s/]/)[0].toLowerCase()}`}>{meta.plan}</span>}{on&&<em>{t('当前使用')}</em>}</span>
       {(email||detail.some(Boolean))&&<span className="slot-sub">{email&&<span>{email}</span>}{detail.some(Boolean)&&<span className="slot-meta">{email?' · ':''}{detail.filter(Boolean).join(' · ')}</span>}</span>}
      </span>
      {meta?.usage&&slot.kind!=='empty'?<UsageLine usage={meta.usage} now={now} t={t}/>:<span/>}
      <span className="slot-tags">
       {status&&status!=='unknown'&&slot.kind!=='empty'&&<span title={t('仅依据本地元数据，不代表服务端认证结果。')} className={`slot-tag auth-${status}`}>{t(authLabel(status))}</span>}
      </span>
      {!on&&<span className="slot-cta" aria-hidden="true">{expanded?t('收起'):t('切换 →')}</span>}
     </button>}
    {menuItems.length>0&&!renaming&&<button type="button" className="slot-more" aria-label={`${t('更多操作')} · ${title}`} aria-haspopup="menu" aria-expanded={menu===slot.key} disabled={blocked&&!(review&&!busy)} onClick={()=>setMenu(value=>value===slot.key?null:slot.key)}>⋯</button>}
    <AnimatePresence>{menu===slot.key&&<motion.div className="slot-menu" role="menu" initial={{opacity:0,scale:.96,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.96,y:-4}} transition={{duration:.14}}>
     {menuItems.map(item=><button key={item.label} type="button" role="menuitem" className={item.danger?'danger':undefined} onClick={item.run}>{item.label}</button>)}
    </motion.div>}</AnimatePresence>
   </div>
  </motion.li>;
 }
 const drawerTitle:Record<Drawer,string>={settings:t('设置'),residue:t('Claude 文件残留'),keep:t('工作区保留'),help:t('使用说明')};
 return <MotionConfig reducedMotion={motionSetting.active?'never':'always'}>
 <section className="ccd" data-motion={motionSetting.active?'on':'off'} onKeyDown={keys}>
  <header className="ccd-bar">
   <div className="ccd-brand"><strong>Claude Code Desktop Switch</strong><span className={`ccd-running${state?.running?' on':''}`} role="status">{running}</span><AppUpdate blocked={locked} open={updateOpen} onOpenChange={setUpdateOpen} onInfo={(info,version)=>setUpdate({info,version})}/></div>
   <div className="ccd-tools">
    <button type="button" className="ccd-icon" title={t('刷新')} aria-label={t('刷新')} disabled={locked||loading} onClick={()=>void read()}><Refresh size={17} aria-hidden className={loading?'spin':''}/></button>
    <button type="button" className="ccd-icon" title={t('Claude 文件残留')} aria-label={t('Claude 文件残留')} aria-pressed={drawer==='residue'} onClick={()=>setDrawer('residue')}><EraserDefault size={17} aria-hidden/></button>
    <button type="button" className="ccd-icon" title={t('设置')} aria-label={t('设置')} aria-pressed={drawer==='settings'} onClick={()=>setDrawer('settings')}><Settings size={17} aria-hidden/></button>
   </div>
  </header>
  {error&&<p role="alert" className="ccd-alert">{t(error)}</p>}
  {state?.recovery&&<div className="ccd-recovery" role="alert">
   <div className="ccd-recovery-head"><strong>{t('有一次身份切换尚未完成')}</strong><Button size="small" variant="ink" disabled={locked||loading} onClick={()=>choose('recovery')}>{t('恢复原身份')}</Button></div>
   {review==='recovery'&&confirmPanel('recovery')}
  </div>}
  {state?.browser_warning&&<p className="ccd-alert subtle" role="status">{t(state.browser_warning)}</p>}
  <div className={`ccd-list-wrap${busy?' working':''}`}>
   <ol className="ccd-list" ref={list} aria-label={t('身份')}>{slots.map(slotView)}</ol>
  </div>
  {showProgress&&<IdentityOperationProgress activity={activity.state}/>}
  <footer className="ccd-foot">
   <Toggle label={t('带入未完成会话')} hint={t('仅影响切换：未归档会话留在工作区并带入新账号，目标账号原有会话一并挪入；保存或更新备份仍包含当前会话。')} checked={carry} disabled={blocked} onChange={value=>void setOptions({carry_sessions:value})}/>
   <Toggle label={t('快速模式')} hint={t('切换时直接移动缓存等数据；保存或更新备份时使用快速压缩，仍加密并校验。')} checked={fast} disabled={blocked} onChange={value=>void setOptions({fast_archive:value})}/>
   <button type="button" className="ccd-keep" onClick={()=>setDrawer('keep')}>{t('工作区保留')} <b>{kept.length}/{policyRows.length}</b> ›</button>
  </footer>
  {review&&review!=='recovery'&&<>
   <motion.div className="ccd-sheet-backdrop" aria-hidden="true" initial={{opacity:0}} animate={{opacity:1}} onClick={()=>{if(!busy)setReview(null);}}/>
   {confirmPanel(review,true)}
  </>}
  <AnimatePresence>{toast&&<motion.div className="ccd-toast" role="status" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:16}} transition={{type:'spring',stiffness:380,damping:30}}>
   <span>✓ {toast.text}</span>
   {toast.back&&(()=>{const back=toast.back==='empty'?'empty' as const:state?.records.find(row=>row.id===toast.back);return back?<button type="button" disabled={rowBlocked} onClick={()=>choose(back)}>{t('切回 {v0}',{v0:back==='empty'?t('空身份'):back.name})}</button>:null;})()}
   <button type="button" className="ccd-toast-close" aria-label={t('关闭')} onClick={()=>setToast(null)}>×</button>
  </motion.div>}</AnimatePresence>
  <SideDrawer open={drawer==='keep'} title={drawerTitle.keep} onClose={()=>setDrawer(null)}>
   <p className="drawer-lead">{t('勾选的资料留在工作区、各身份共用；不勾选的跟着身份一起暂存。')}</p>
   <div className="drawer-list">{policyRows.map(([key,label])=><div className="drawer-row" key={key}><Checkbox label={t(label)} checked={key==='history'&&review!=='save'&&carry?true:effectivePolicy[key]} disabled={locked||(key==='history'&&(review==='save'||carry))} onCheckedChange={checked=>setPolicy(old=>({...old,[key]:checked===true}))}/></div>)}</div>
   <p className="drawer-note">{t('登录与本地标识始终随身份；实际项目源码不扫描。')}</p>
  </SideDrawer>
  <SideDrawer open={drawer==='residue'} title={drawerTitle.residue} onClose={()=>setDrawer(null)}>
   <ClaudeResiduePanel activity={activity} blocked={locked||loading||!state||!!state?.recovery} revision={residueRevision} onBusy={setResidueBusy} onChanged={async()=>{if(!await read(false))throw new Error('身份状态刷新失败，请重新检查。');}}/>
  </SideDrawer>
  <SideDrawer open={drawer==='settings'} title={drawerTitle.settings} onClose={()=>setDrawer(null)}>
   <div className={`drawer-card${update.info?.available?' highlight':''}`}>
    <div><span className="drawer-label">{t('定制版更新')}</span><strong>{update.info?.available?t('可更新至 {v0}',{v0:update.info.latest}):update.info?t('当前已是最新版本。'):t('正在检查更新…')}</strong><small>{t('当前版本')}：{update.info?.current||update.version||'—'}</small></div>
    <Button size="small" variant={update.info?.available?'ink':'secondary'} disabled={locked} onClick={()=>setUpdateOpen(true)}>{update.info?.available?t('下载更新'):t('检查更新')}</Button>
   </div>
   <div className="drawer-row"><span>{t('界面动效')}<small>{motionSetting.reduced?t('系统已开启「减弱动态」，动效暂停。'):t('列表入场、选中光带与切换扫描等效果。')}</small></span><Switch label={t('界面动效')} checked={motionSetting.enabled} onChange={setMotionEnabled}/></div>
   <div className="drawer-row"><span>{t('界面语言')}</span><LanguageSwitch/></div>
   <div className="drawer-row"><span>{t('使用说明')}</span><Button size="small" variant="ghost" leftIcon={<FolderDefault size={15} aria-hidden/>} onClick={()=>setDrawer('help')}>{t('打开')}</Button></div>
   <ClaudeCliPanel blocked={locked||loading||!!state?.recovery} onBusy={setCliBusy}/>
  </SideDrawer>
  <SideDrawer open={drawer==='help'} title={drawerTitle.help} onClose={()=>setDrawer('settings')}><HelpPanel/></SideDrawer>
  <AppDialog alert className="identity-delete-alert" open={!!deletion} onOpenChange={open=>{if(!open&&!busy)setDeletion(null);}} title={deletion==='current'?t('直接删除当前身份'):t('删除暂存身份')} description={deletion==='current'?t('将结束 Claude 进程并删除所选本地数据。不会新增备份，已有暂存身份不受影响。'):t('永久删除这份暂存文件。当前工作区不受影响。')} footer={<><Button variant="secondary" data-dialog-cancel onClick={()=>setDeletion(null)}>{t('取消')}</Button><Button className="identity-delete-button" variant="ink" disabled={busy||!accepted||(deletion==='current'&&!stopAccepted)} onClick={()=>void remove()}>{t('确认直接删除')}</Button></>}>
   {deletion==='current'&&<ClaudeStopConsent checked={stopAccepted} onChange={setStopAccepted}/>}<div className="identity-confirm"><div className="identity-delete-warning"><span aria-hidden="true">!</span><strong>{t('警告：此操作不可撤销，不会创建新备份。')}</strong></div>{deletion==='current'?<><div className="identity-confirm-keep"><span>{t('删除范围')}</span><strong>{[t('登录与身份数据'),...removed].join(' · ')}</strong></div><div className="identity-confirm-keep"><span>{t('留在工作区')}</span><strong>{kept.join(' · ')||t('无')}</strong></div></>:<strong>{deletion?.name}</strong>}<Checkbox checked={accepted} onCheckedChange={setAccepted} label={t('我知道此操作无法撤销')}/></div>
  </AppDialog>
 </section>
 </MotionConfig>;
}

// ----- 抽屉常驻挂载：关闭时 inert 隐藏，残留扫描与 CLI 任务不因收起而中断 -----
function SideDrawer({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}){
 const {t}=useI18n();
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open)panel.current?.querySelector<HTMLElement>('.drawer-close')?.focus({preventScroll:true});},[open]);
 return <div className={`drawer-layer${open?' open':''}`} inert={!open} aria-hidden={!open}>
  <div className="drawer-scrim" onClick={onClose}/>
  <div className="drawer-panel" ref={panel} role="dialog" aria-modal="false" aria-label={title}>
   <div className="drawer-head"><strong>{title}</strong><button type="button" className="drawer-close" aria-label={t('关闭')} onClick={onClose}>×</button></div>
   <div className="drawer-body">{children}</div>
  </div>
 </div>;
}
function Switch({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled?:boolean;onChange:(value:boolean)=>void}){
 return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ccd-switch" onClick={()=>onChange(!checked)}><i aria-hidden="true"/></button>;
}
function Toggle({label,hint,checked,disabled,onChange}:{label:string;hint:string;checked:boolean;disabled?:boolean;onChange:(value:boolean)=>void}){
 return <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="ccd-toggle" title={hint} onClick={()=>onChange(!checked)}><i aria-hidden="true"/>{label}</button>;
}

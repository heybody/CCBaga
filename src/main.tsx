/**
 * [INPUT]: A 品牌图、Laper 最新 Landing 壳/侧栏视觉参数、Cromma UI、共享 YAML 界面语言、身份/浏览器/系统页面及快捷操作、网络资源入口与定制版手动更新组件。
 * [OUTPUT]: 身份管理专用入口，仅保留身份管理与使用说明。
 * [POS]: 单窗口编排层；任务运行时锁定导航，完成后重新挂载高级页面以刷新快照。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Panel, NavButton, MotionRoot, TooltipProvider } from 'cromma-ui';
import { ShieldCheck as IdentityIcon, FolderDefault as HelpIcon } from 'cromma-ui/pika';
import { Fragment, useState } from 'react';
import {useI18n} from "./i18n";
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IdentityPanel } from './identities';
import { LanguageSwitch } from './language-switch';
import { AppUpdate } from './app-update';
import { HelpPanel } from './help';
import appLogo from '../assets/cleaner-logo.jpg';
import './index.css';
import './style.css';
type Page = 'cleaner' | 'help';
const titles: Record<Page, string> = { cleaner: 'Claude 身份管理', help: '使用说明' };
const icons: Record<Page, typeof IdentityIcon> = { cleaner: IdentityIcon, help: HelpIcon };
function App() {
    const {t}=useI18n();
    const [page, setPage] = useState<Page>('cleaner');
    const [advancedBusy, setAdvancedBusy] = useState(false);
    const locked = advancedBusy;
    return <><div className="drag-strip" onMouseDown={e => { if (e.button === 0)
        void getCurrentWindow().startDragging(); }}/><div className="app-shell"><aside className="app-sidebar">
    <div className="app-brand"><img src={appLogo} width={28} height={28} alt="" draggable={false} className="rounded-xl"/><strong>{t("CCD Switch")}</strong></div>
    <nav aria-label={t("主要页面")}>{(['cleaner', 'help'] as const).map(p => { const Icon = icons[p]; return <Fragment key={p}>{(p==='help')&&<hr className="nav-divider"/>}<NavButton className="workspace-nav" active={page === p} aria-current={page === p ? "page" : undefined} disabled={locked} icon={<Icon size={18} aria-hidden="true"/>} onClick={() => {setPage(p);}}>{t(titles[p])}</NavButton></Fragment>; })}</nav>
    <div className="sidebar-bottom"><AppUpdate blocked={advancedBusy}/><LanguageSwitch /></div>
  </aside><Panel frame className="workspace">
    {page === 'cleaner' && <div className="cleaner-slot"><IdentityPanel onBusy={setAdvancedBusy}/></div>}
    {page === 'help' && <div className="cleaner-slot"><HelpPanel/></div>}
  </Panel></div></>;
}
createRoot(document.getElementById('app')!).render(<MotionRoot><TooltipProvider delayDuration={600} skipDelayDuration={300}><App /></TooltipProvider></MotionRoot>);

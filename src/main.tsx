/**
 * [INPUT]: Cromma UI 动效/提示根节点、共享 YAML 界面语言与身份管理面板。
 * [OUTPUT]: 身份管理专用单窗口：顶部拖动条 + 全宽深色切换器；更新、语言、说明与维护入口都收进面板的抽屉。
 * [POS]: 单窗口编排层；不再保留侧栏导航，任务锁由身份面板自身管理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { MotionRoot, TooltipProvider } from 'cromma-ui';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IdentityPanel } from './identities';
import './index.css';
import './style.css';
// macOS 使用叠加标题栏：标题栏与红绿灯同一行，由面板标题栏负责拖动；其他平台保留顶部拖动条。
const mac = /Mac/.test(navigator.userAgent);
if (mac)
    document.documentElement.classList.add('mac');
function App() {
    return <>{!mac && <div className="drag-strip" onMouseDown={e => { if (e.button === 0)
        void getCurrentWindow().startDragging(); }}/>}<div className="ccd-shell"><IdentityPanel/></div></>;
}
createRoot(document.getElementById('app')!).render(<MotionRoot><TooltipProvider delayDuration={600} skipDelayDuration={300}><App /></TooltipProvider></MotionRoot>);

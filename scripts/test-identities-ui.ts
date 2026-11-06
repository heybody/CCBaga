/**
 * [INPUT]: Node.js 标准管道、已锁定 playwright-core、固定引擎、Vite 与 tests/ 的虚构 Tauri IPC。
 * [OUTPUT]: 身份插槽列表、行内切换确认、⋯ 菜单、抽屉、动效开关、浏览器/网络与全清理确认、残留清理与真实 Channel 阶段动画的 DOM 验收，覆盖双语、默认取消及失败重扫；CCBAGA_TEST_BROWSER 可指定本机 Chromium。
 * [POS]: 发布前无头行为回归；无截图、无真实账号/文件修改，不加载原生宿主，不允许外网请求。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {strict as assert} from 'node:assert';
import {resolve,join} from 'node:path';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {testNetworkDiagnostics} from './test-network-diagnostics.ts';
import {testClaudeResidue} from './test-claude-residue.ts';
import {testIdentityOperation} from './test-identity-operation.ts';
import {testAppUpdate} from './test-app-update.ts';
const executablePath=process.env.CCBAGA_TEST_BROWSER||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome');
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false,watch:{ignored:['**/src-tauri/**','**/browser-runtime/**','**/releases/**','**/dist/**']}},optimizeDeps:{include:['@tauri-apps/api/mocks']}});
await server.listen();
const address=server.httpServer!.address() as {port:number};
const base=`http://127.0.0.1:${address.port}`;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('APPLE_')&&!key.startsWith('TAURI_SIGNING_PRIVATE_KEY'))) as Record<string,string>;
// ----- 临时 HOME/XDG 避免容器环境的只读配置和真实浏览器资料 -----
const temporary=await mkdtemp(join(tmpdir(),'ccbaga-ui-'));
for(const name of ['config','cache'])await mkdir(join(temporary,name));
Object.assign(env,{HOME:temporary,XDG_CONFIG_HOME:join(temporary,'config'),XDG_CACHE_HOME:join(temporary,'cache')});
let browser;
try{browser=await chromium.launch({executablePath,headless:true,env});}
catch(error){await server.close();await rm(temporary,{recursive:true,force:true});throw error;}
let checks=0;
try{
 const context=await browser.newContext({viewport:{width:1040,height:820},reducedMotion:'no-preference'});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')console.error(message.text());});page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.goto(base+'/tests/identities.html');
 const slots=page.locator('.slot');
 const fixtureCommands=(name:string)=>page.evaluate(name=>((window as any).identityFixture.commands as any[]).filter(row=>row.command===name).length,name);
 const consent=()=>page.getByRole('checkbox',{name:/我已保存任务，同意结束 Claude 进程|I have saved my work and agree to end Claude processes/,exact:true});
 const confirmPanel=page.locator('.slot-confirm');
 await page.getByText('fixture@example.invalid',{exact:true}).waitFor();
 assert.equal(await page.getByText(/浏览器未能重开|关联浏览器|browser fingerprint/i).count(),0);
 assert.equal(await page.evaluate(()=>Object.keys((window as any).identityFixture.state).some(key=>key.startsWith('browser'))),false);checks++;

 // ----- 主进程退出后状态变为有残留，点击确认才结束；Claude 运行时不显示入口 -----
 assert.equal(await page.getByRole('button',{name:'Claude 有残留',exact:true}).count(),0);
 const processesBefore=await page.evaluate(()=>{const s=(window as any).identityFixture.state,old=s.processes;s.main_running=false;s.services=['CoworkVMService'];s.processes=[{pid:5001,workspace:null,entrypoint:'Claude Desktop',helper:'chrome-native-host.exe'}];return old;});
 await page.getByRole('button',{name:'刷新',exact:true}).click();
 await page.getByRole('button',{name:'Claude 有残留',exact:true}).click();
 const residualDialog=page.getByRole('alertdialog');
 assert.match(await residualDialog.innerText(),/chrome-native-host\.exe[\s\S]*CoworkVMService/);
 await residualDialog.getByRole('button',{name:'取消',exact:true}).click();
 assert.equal(await fixtureCommands('identities_stop_residual'),0);checks++;
 await page.getByRole('button',{name:'Claude 有残留',exact:true}).click();
 await residualDialog.getByRole('button',{name:'结束残留',exact:true}).click();
 await page.getByText('Claude 未运行',{exact:true}).waitFor();
 assert.equal(await fixtureCommands('identities_stop_residual'),1);checks++;
 await page.evaluate(processes=>{Object.assign((window as any).identityFixture.state,{running:true,main_running:true,processes});},processesBefore);
 await page.getByRole('button',{name:'刷新',exact:true}).click();
 await page.getByText('Claude 运行中',{exact:true}).waitFor();

 // ----- 插槽列表：当前身份置顶高亮，暂存身份全部列出，空身份固定最后 -----
 assert.equal(await slots.count(),41);
 assert.equal(await slots.first().getAttribute('data-slot'),'current');assert.equal(await slots.last().getAttribute('data-slot'),'empty');
 assert.match(await slots.last().innerText(),/清空本地登录/);
 assert.equal(await page.locator('.slot.active').count(),1);
 assert.equal(await page.getByText('上次使用',{exact:true}).count(),0);
 assert.equal(await slots.filter({hasText:/^Identity 1\b/}).count(),0);checks++;
 assert.equal(await page.getByRole('switch',{name:'联动浏览器'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'导入',exact:true}).count(),0);assert.equal(await page.getByText('导出',{exact:true}).count(),0);
 assert.equal(await page.getByRole('switch',{name:'快速模式',exact:true}).count(),1);checks++;
 const current=page.locator('.slot.active');
 assert.match(await current.innerText(),/已备份/);assert.match(await current.innerText(),/Pro/);assert.match(await current.innerText(),/本地未过期/);
 const savedSecond=page.locator('.slot').filter({has:page.getByRole('button',{name:'切换到 Identity 2',exact:true})});
 assert.match(await savedSecond.innerText(),/user2@example\.invalid/);assert.match(await savedSecond.innerText(),/Org 2/);checks++;
 // ----- 当前身份的 ⋯ 菜单：直接删除仍是默认聚焦取消、遮罩不关闭的 AlertDialog -----
 await current.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'直接删除',exact:true}).click();
 let dialog=page.getByRole('alertdialog');await dialog.waitFor();
 assert.match(await dialog.innerText(),/不可撤销/);assert.equal(await dialog.getByRole('button',{name:'确认直接删除'}).isEnabled(),false);
 assert.equal(await dialog.getByRole('button',{name:'取消'}).evaluate(node=>node===document.activeElement),true);
 await page.mouse.click(3,3);assert.equal(await dialog.count(),1);
 await dialog.getByRole('button',{name:'取消'}).click();
 assert.equal(await fixtureCommands('identities_delete'),0);checks++;
 // ----- 更新备份在当前行原地展开；未勾选结束进程时不能执行，取消不调用命令 -----
 await page.getByRole('switch',{name:'带入未完成会话',exact:true}).click();
 await page.getByRole('switch',{name:'快速模式',exact:true}).click();
 await page.waitForFunction(()=>(window as any).identityFixture.state.options.carry_sessions&&(window as any).identityFixture.state.options.fast_archive);
 await current.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'更新备份',exact:true}).click();
 await confirmPanel.waitFor();
 assert.equal(await page.locator('.slot-confirm').count(),1);assert.match(await current.getAttribute('class')??'',/expanded/);
 assert.match(await confirmPanel.innerText(),/强制结束 Claude Desktop 和 Claude Code/);
 assert.equal(await confirmPanel.getByRole('button',{name:'结束进程并保存备份',exact:true}).isDisabled(),false);
 assert.equal(await consent().isChecked(),true);
 assert.equal(await confirmPanel.getByRole('button',{name:'取消',exact:true}).evaluate(node=>node===document.activeElement),true);
 await consent().uncheck();
 assert.equal(await confirmPanel.getByRole('button',{name:'结束进程并保存备份',exact:true}).isDisabled(),true);
 await consent().check();
 assert.equal(await consent().isChecked(),true);
 await page.keyboard.press('Escape');await confirmPanel.waitFor({state:'detached'});
 assert.equal(await fixtureCommands('identities_stop'),0);
 await current.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'更新备份',exact:true}).click();
 assert.equal(await consent().isChecked(),true);
 await confirmPanel.getByRole('button',{name:/确认后结束 1 个 Claude 进程/}).click();
 assert.match(await confirmPanel.innerText(),/PID 4201/);assert.match(await confirmPanel.innerText(),/VS Code/);
 assert.match(await confirmPanel.locator('.slot-confirm-grid').innerText(),/纳入加密备份\s+登录与身份数据 · 会话历史 · 缓存与日志/);
 assert.match(await confirmPanel.locator('.slot-confirm-grid').innerText(),/留在工作区\s+Skills 与命令/);
 await consent().check();
 await confirmPanel.getByRole('button',{name:'结束进程并保存备份',exact:true}).click();
 await page.waitForFunction(()=>((window as any).identityFixture.commands as any[]).some(row=>row.command==='identities_save'));
 assert.equal(await page.evaluate(()=>(window as any).identityFixture.state.current.present),true);checks++;
 assert.equal(await page.evaluate(()=>((window as any).identityFixture.commands as any[]).find(row=>row.command==='identities_save').args.policy.history),false);
 // ----- 工作区保留在抽屉里调整；空身份行原地确认并按所选策略切换 -----
 await page.getByRole('switch',{name:'带入未完成会话',exact:true}).click();
 await page.waitForFunction(()=>!(window as any).identityFixture.state.options.carry_sessions);
 await page.locator('.ccd-keep').click();
 await page.getByRole('dialog',{name:'工作区保留'}).getByRole('checkbox',{name:'Skills 与命令'}).uncheck();
 await page.keyboard.press('Escape');await page.locator('.drawer-layer.open').waitFor({state:'detached'});
 await page.getByRole('button',{name:'切换到 空身份',exact:true}).click();
 await confirmPanel.getByLabel('当前身份保存为').fill('First archive');
 await consent().check();
 await confirmPanel.getByRole('button',{name:'结束进程、暂存并切换'}).click();
 await page.waitForFunction(()=>!(window as any).identityFixture.state.current.present);
 assert.equal(await page.locator('.slot[data-slot="current"]').count(),0);assert.equal(await page.locator('.slot.active').getAttribute('data-slot'),'empty');
 const request=await page.evaluate(()=>((window as any).identityFixture.commands as any[]).find(row=>row.command==='identities_switch').args);
 assert.equal(request.policy.skills,false);assert.equal(request.targetId,'empty');assert.equal(request.currentName,'First archive');checks++;
 await page.locator('.ccd-toast').getByText('已切换到空身份').waitFor();
 // ----- 数字键直达暂存身份；切换后提示可切回上一身份（仍需重新确认） -----
 await page.locator('.slot-main').first().focus();
 const targetIndex=await page.locator('.slot-main').evaluateAll(nodes=>nodes.findIndex(node=>node.getAttribute('aria-label')==='切换到 Identity 3'));
 assert(targetIndex>=0&&targetIndex<9);
 await page.keyboard.press(String(targetIndex+1));
 await confirmPanel.waitFor();assert.match(await confirmPanel.innerText(),/再换成 Identity 3/);
 await consent().check();
 await confirmPanel.getByRole('button',{name:'结束进程、暂存并切换'}).click();await page.locator('.slot.active').getByText(/Fixture team/).waitFor();checks++;
 assert.equal(await page.getByRole('button',{name:'切换到 Identity 3',exact:true}).count(),0);
 await page.locator('.ccd-toast').getByText('已切换到 Identity 3').waitFor();
 await page.locator('.ccd-toast').getByRole('button',{name:'切回 空身份'}).click();
 await confirmPanel.waitFor();assert.match(await confirmPanel.innerText(),/再换成 空身份/);
 assert.equal(await consent().isChecked(),true);
 await confirmPanel.getByRole('button',{name:'取消',exact:true}).click();checks++;
 // ----- 删除暂存身份不再提供浏览器资料选项；行内重命名后删除 -----
 const other=page.locator('.slot').filter({has:page.getByRole('button',{name:'切换到 Identity 4',exact:true})});
 await other.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'删除',exact:true}).click();
 dialog=page.getByRole('alertdialog');
 assert.equal(await dialog.getByRole('checkbox',{name:'同时永久删除关联浏览器资料'}).count(),0);
 await dialog.getByRole('button',{name:'取消',exact:true}).click();checks++;
 await other.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'重命名',exact:true}).click();
 await page.getByRole('textbox',{name:'身份名称'}).fill('Renamed fixture');
 await page.keyboard.press('Enter');
 const renamed=page.locator('.slot').filter({has:page.getByRole('button',{name:'切换到 Renamed fixture',exact:true})});await renamed.waitFor();
 await renamed.getByRole('button',{name:/^更多操作/}).click();
 await page.getByRole('menuitem',{name:'删除',exact:true}).click();dialog=page.getByRole('alertdialog');
 await dialog.getByRole('checkbox',{name:'我知道此操作无法撤销'}).check();
 await dialog.getByRole('button',{name:'确认直接删除'}).click();await renamed.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>((window as any).identityFixture.commands as any[]).find(row=>row.command==='identities_delete').args.deleteBrowser),undefined);
 assert.equal(await page.evaluate(()=>(window as any).identityFixture.state.current.present),true);checks++;
 // ----- 语言切换、失败保留现状与恢复未完成切换 -----
 await page.evaluate(()=>{(window as any).identityFixture.language('en');});
 await page.getByRole('button',{name:'Switch to Empty identity',exact:true}).waitFor();assert.match(await slots.last().innerText(),/Sign out locally/);checks++;
 await page.evaluate(()=>{(window as any).identityFixture.setFailure('identities_switch');});
 await page.getByRole('button',{name:'Switch to Empty identity',exact:true}).click();
 await consent().check();
 await confirmPanel.getByRole('button',{name:'End processes, archive & switch'}).click();
 await page.getByText(/fixture operation failed/).first().waitFor();assert.equal(await page.evaluate(()=>(window as any).identityFixture.state.current.present),true);checks++;
 await page.evaluate(()=>{(window as any).identityFixture.recover();});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByRole('button',{name:'Restore previous identity',exact:true}).click();
 await consent().check();
 await page.locator('.ccd-recovery .slot-confirm').getByRole('button',{name:'End processes & restore'}).click();
 await page.waitForFunction(()=>(window as any).identityFixture.state.recovery===null);checks++;
 // ----- 动效开关：默认开启；关闭后停止动画，系统减弱动态同样静止 -----
 assert.equal(await page.locator('.ccd').getAttribute('data-motion'),'on');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('switch',{name:'Interface motion',exact:true}).click();
 assert.equal(await page.locator('.ccd').getAttribute('data-motion'),'off');
 assert.equal(await page.locator('.slot.active .slot-index').evaluate(node=>getComputedStyle(node).animationName),'none');
 await page.getByRole('switch',{name:'Interface motion',exact:true}).click();
 assert.equal(await page.locator('.ccd').getAttribute('data-motion'),'on');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('.ccd')?.getAttribute('data-motion')==='off');
 await page.keyboard.press('Escape');checks++;
 await page.locator('.slot.active').getByRole('button',{name:/^More actions/}).click();
 await page.getByRole('menuitem',{name:'Delete permanently',exact:true}).click();dialog=page.getByRole('alertdialog');
 await dialog.getByRole('checkbox',{name:'I understand this cannot be undone'}).check();
 const count=await page.evaluate(()=>(window as any).identityFixture.state.records.length);
 await dialog.getByRole('checkbox',{name:'I have saved my work and agree to end Claude processes',exact:true}).check();
 await dialog.getByRole('button',{name:'Confirm deletion',exact:true}).click();
 await page.waitForFunction(()=>!(window as any).identityFixture.state.current.present);assert.equal(await page.evaluate(()=>(window as any).identityFixture.state.records.length),count);checks++;
 assert.equal(errors.length,0,errors.join('\n'));
 checks+=await testAppUpdate(browser,base);
 checks+=await testNetworkDiagnostics(browser,base);
 checks+=await testClaudeResidue(browser,base);
 checks+=await testIdentityOperation(browser,base);
 console.log(`${checks} identity and network UI simulation checks passed; no native commands or user data used.`);
}finally{await browser.close();await server.close();await rm(temporary,{recursive:true,force:true});}

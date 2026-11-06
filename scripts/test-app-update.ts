import {strict as assert} from 'node:assert';
import type {Browser} from 'playwright-core';
export async function testAppUpdate(browser:Browser,base:string){
 const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const open=async()=>{await page.goto(base+'/tests/update.html');await page.getByRole('button',{name:'发现新版本 0.2.50+local.13',exact:true}).click();};
 const installs=()=>page.evaluate(()=>(window as any).updateFixture.commands.filter((c:any)=>c.command==='local_update_install').length);
 try {
  await open();let dialog=page.getByRole('dialog');
  assert.match(await dialog.innerText(),/0.2.50\+local.12/);
  await dialog.getByRole('button',{name:'前往 GitHub 手动更新',exact:true}).click();
  assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.filter((c:any)=>c.command==='local_release_open').length),1);
  assert.equal(await dialog.getByRole('checkbox').isChecked(),true);
  await dialog.getByRole('checkbox').uncheck();assert.equal(await dialog.getByRole('button',{name:'下载并自动安装',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await installs(),0);
  await page.getByRole('button',{name:'发现新版本 0.2.50+local.13',exact:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.getByRole('checkbox').isChecked(),true);
  await dialog.getByRole('button',{name:'下载并自动安装',exact:true}).click();
  await page.waitForFunction(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='local_update_download'));
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'downloading',received:1048576,total:2097152}));
  await dialog.getByText('已下载 1.0 MiB / 2.0 MiB（50%）',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('progressbar').getAttribute('value'),'1048576');assert.equal(await installs(),0);
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'downloading',received:1572864,total:null}));
  await dialog.getByText('已下载 1.5 MiB',{exact:true}).waitFor();assert.equal(await dialog.getByRole('progressbar').getAttribute('value'),null);
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'verifying',received:2097152,total:2097152}));
  await dialog.getByText('正在校验更新包…',{exact:true}).waitFor();assert.equal(await installs(),0);
  await page.evaluate(()=>(window as any).updateFixture.release());
  await page.waitForFunction(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='local_update_install'&&c.args.confirmed===true));
  assert.equal(await installs(),1);assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='identities_stop')),false);
  // 下载/校验失败不安装；安装启动失败可直接重试已校验的包。
  await open();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'下载并自动安装',exact:true}).click();
  await page.evaluate(()=>(window as any).updateFixture.reject());await dialog.getByRole('alert').waitFor();assert.equal(await installs(),0);
  await page.evaluate(()=>(window as any).updateFixture.fail='local_update_install');
  await dialog.getByRole('button',{name:'下载并自动安装',exact:true}).click();await page.evaluate(()=>(window as any).updateFixture.release());
  await dialog.getByRole('button',{name:'重试安装',exact:true}).waitFor();assert.equal(await installs(),1);
  await dialog.getByRole('button',{name:'重试安装',exact:true}).click();await page.waitForFunction(()=>(window as any).updateFixture.commands.filter((c:any)=>c.command==='local_update_install').length===2);
  assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.filter((c:any)=>c.command==='local_update_download').length),2);
  return 11;
 }finally{await context.close();}
}

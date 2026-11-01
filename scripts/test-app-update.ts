import {strict as assert} from 'node:assert';
import type {Browser} from 'playwright-core';
export async function testAppUpdate(browser:Browser,base:string){
 const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(10000);
 try {
  await page.goto(base+'/tests/update.html');
  await page.getByRole('button',{name:'发现新版本 0.2.50+local.10',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.match(await dialog.innerText(),/0.2.50\+local.9/);
  assert.equal(await page.getByText('打开定制版发布页',{exact:true}).count(),0);
  await dialog.getByRole('button',{name:'下载更新',exact:true}).click();
  await dialog.getByText('更新包已通过 SHA-256 校验。',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'关闭 CCD Switch 并启动安装',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='local_update_install')),false);
  await dialog.getByRole('checkbox',{name:'我同意关闭 CCD Switch 并启动安装程序',exact:true}).check();
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='local_update_install')),false);
  await page.getByRole('button',{name:'发现新版本 0.2.50+local.10',exact:true}).click();dialog=page.getByRole('dialog');
  assert.equal(await dialog.getByRole('checkbox').isChecked(),false);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button',{name:'关闭 CCD Switch 并启动安装',exact:true}).click();
  await page.waitForFunction(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='local_update_install'&&c.args.confirmed===true));
  assert.equal(await page.evaluate(()=>(window as any).updateFixture.commands.some((c:any)=>c.command==='identities_stop')),false);
  return 4;
 }finally{await context.close();}
}

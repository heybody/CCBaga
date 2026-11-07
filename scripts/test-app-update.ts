import {strict as assert} from 'node:assert';
import type {Browser} from 'playwright-core';

export async function testAppUpdate(browser:Browser,base:string){
 const context=await browser.newContext();
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage();
 page.setDefaultTimeout(10000);
 const update=page.getByRole('region',{name:'软件更新'});
 const button=(name:string)=>update.getByRole('button',{name,exact:true});
 const calls=(name:string)=>page.evaluate(name=>(window as any).updateFixture.commands.filter((call:any)=>call.command===name).length,name);
 const installs=()=>calls('local_update_install');
 const open=async()=>{
  await page.goto(base+'/tests/update.html');
  await button('下载并安装').waitFor();
 };
 try {
  await page.goto(base+'/tests/update.html?available=false');
  await update.getByText('已是最新版',{exact:true}).waitFor();
  assert.match(await update.innerText(),/0.2.50\+local.12/);
  await page.evaluate(()=>(window as any).updateFixture.fail='local_update_check');
  await button('检查更新').click();
  await update.getByRole('alert').getByText('检查更新失败',{exact:true}).waitFor();
  const details=update.getByText('Error: fixture update failed',{exact:true});
  assert.equal(await details.isVisible(),false);
  await update.getByText('错误详情',{exact:true}).click();
  await details.waitFor();
  await button('重试').click();
  await update.getByText('已是最新版',{exact:true}).waitFor();
  assert.equal(await calls('local_update_check'),3);
  assert.equal(await page.getByRole('dialog').count(),0);

  await open();
  assert.match(await update.innerText(),/有新版本 0.2.50\+local.13/);
  assert.equal(await installs(),0);
  await button('下载并安装').click();
  await page.waitForFunction(()=>(window as any).updateFixture.commands.some((call:any)=>call.command==='local_update_download'));
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'downloading',received:1048576,total:2097152}));
  await update.getByText('下载中 50%',{exact:true}).waitFor();
  assert.equal(await update.getByRole('progressbar').getAttribute('value'),'1048576');
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'downloading',received:1572864,total:null}));
  await update.getByText('已下载 1.5 MiB',{exact:true}).waitFor();
  assert.equal(await update.getByRole('progressbar').getAttribute('value'),null);
  await page.evaluate(()=>(window as any).updateFixture.emit({phase:'verifying',received:2097152,total:2097152}));
  await update.getByText('正在校验…',{exact:true}).waitFor();
  assert.equal(await installs(),0);
  await page.evaluate(()=>(window as any).updateFixture.release());
  await update.getByText('正在安装…',{exact:true}).waitFor();
  await page.waitForFunction(()=>(window as any).updateFixture.commands.some((call:any)=>call.command==='local_update_install'&&call.args.confirmed===true));
  assert.equal(await installs(),1);
  assert.equal(await calls('identities_stop'),0);

  await open();
  await button('下载并安装').click();
  await page.evaluate(()=>(window as any).updateFixture.reject());
  await update.getByRole('alert').getByText('下载失败',{exact:true}).waitFor();
  assert.equal(await installs(),0);
  await page.evaluate(()=>(window as any).updateFixture.fail='local_update_install');
  await button('重试').click();
  await page.evaluate(()=>(window as any).updateFixture.release());
  await update.getByRole('alert').getByText('安装失败',{exact:true}).waitFor();
  assert.equal(await installs(),1);
  await button('重试').click();
  await page.waitForFunction(()=>(window as any).updateFixture.commands.filter((call:any)=>call.command==='local_update_install').length===2);
  assert.equal(await calls('local_update_download'),2);
  return 12;
 }finally{await context.close();}
}

/**
 * [INPUT]: 身份脱敏摘要与可控时钟。
 * [OUTPUT]: 旧摘要、未知期限、到期边界和本地元数据语义回归；桌面资料存在不冒充已识别账号。
 * [POS]: 身份状态的纯函数测试，不读取凭据或联网验证账号。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {test,expect} from 'bun:test';
import {credentialStatus,currentAccountMessage,usageRefreshHint,usageStale,type CurrentIdentity} from './identity-model';
test('额度超过 5 小时才算过期，操作提示只给当前身份',()=>{
 const hours=3600000,usage={five_hour:10,sampled_at:0};
 expect(usageStale(usage,5*hours)).toBe(false);
 expect(usageStale(usage,5*hours+1)).toBe(true);
 expect(usageRefreshHint(usage,5*hours,true,true)).toBeNull();
 expect(usageRefreshHint(usage,6*hours,false,true)).toBeNull();
 expect(usageRefreshHint(null,6*hours,true,true)).toBeNull();
 expect(usageRefreshHint(usage,6*hours,true,true)).toBe('额度不是最新的，点一下 Claude 托盘图标刷新');
 expect(usageRefreshHint(usage,6*hours,true,null)).toBe('额度不是最新的，点一下 Claude 托盘图标刷新');
 expect(usageRefreshHint(usage,6*hours,true,false)).toBe('额度不是最新的，打开 Claude 刷新');
});
test('状态只表示可信本地元数据，到期不会继续显示未过期',()=>{
 expect(credentialStatus(null,100)).toBe('unknown');
 expect(credentialStatus({auth_status:'valid',expires_at:200},100)).toBe('unknown');
 for(const expires_at of [null,undefined,NaN,-1,Infinity,1.5])expect(credentialStatus({auth_status:'local_unexpired',expires_at},100)).toBe('unknown');
 expect(credentialStatus({auth_status:'local_unexpired',expires_at:200},100)).toBe('local_unexpired');
 expect(credentialStatus({auth_status:'local_unexpired',expires_at:200},200)).toBe('expired');
 expect(credentialStatus({auth_status:'refresh_available',expires_at:100},200)).toBe('refresh_available');
 expect(credentialStatus({auth_status:'api_key'},200)).toBe('api_key');
});
const unknown:CurrentIdentity={present:true,email:null,display_name:null,organization:null,plan:null,auth_status:null,unavailable:false};
test('桌面资料存在不冒充已识别或已验证的账号',()=>{
 expect(currentAccountMessage({...unknown,desktop_present:true})).toBe('检测到 Desktop 本地资料；账号请在客户端确认');
 expect(currentAccountMessage(unknown)).toBe('未读取到 Code 账号邮箱；不代表未登录');
 expect(currentAccountMessage({...unknown,desktop_present:true,unavailable:true})).toBe('账号信息暂不可读');
});

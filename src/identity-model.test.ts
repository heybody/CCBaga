/** 当前身份展示的离线回归；不读取真实账号。 */
import {expect,test} from 'bun:test';
import {currentAccountMessage,type CurrentIdentity} from './identity-model';
const unknown:CurrentIdentity={present:true,email:null,display_name:null,organization:null,unavailable:false};
test('桌面资料存在不冒充已识别或已验证的账号',()=>{
 expect(currentAccountMessage({...unknown,desktop_present:true})).toBe('检测到 Desktop 本地资料；账号请在客户端确认');
 expect(currentAccountMessage(unknown)).toBe('未读取到 Code 账号邮箱；不代表未登录');
 expect(currentAccountMessage({...unknown,desktop_present:true,unavailable:true})).toBe('账号信息暂不可读');
});

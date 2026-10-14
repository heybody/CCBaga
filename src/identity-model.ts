/**
 * [INPUT]: 原生 SQLite 身份目录与用户的数据保留选择。
 * [OUTPUT]: 身份/策略/账号显示信息类型、桌面资料与已识别邮箱的区别、默认保留选项和浏览器绑定。
 * [POS]: 身份管理的脱敏契约；只有明确允许的账号显示字段，不含凭据、原始文件正文或任意路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type IdentityPolicy={skills:boolean;plugins:boolean;mcp:boolean;settings:boolean;projects:boolean;history:boolean;cache:boolean};
export type Identity={id:string;name:string;saved_at:number;bytes:number;policy:IdentityPolicy};
export type CurrentIdentity={present:boolean;desktop_present?:boolean;display_name:string|null;email:string|null;organization:string|null;unavailable:boolean};
export function currentAccountMessage(current:CurrentIdentity|undefined):string {
 if(current?.unavailable)return '账号信息暂不可读';
 return current?.desktop_present?'检测到 Desktop 本地资料；账号请在客户端确认':'未读取到 Code 账号邮箱；不代表未登录';
}
export type BrowserLink={enabled:boolean;bound_ids:string[]};
export type IdentityState={browser:BrowserLink;browser_warning:string|null;records:Identity[];active:string;recovery:string|null;running:boolean;current:CurrentIdentity};
export const defaultPolicy:IdentityPolicy={skills:true,plugins:true,mcp:true,settings:true,projects:true,history:false,cache:false};
export const policyRows:readonly [keyof IdentityPolicy,string][]=[['skills','Skills 与命令'],['plugins','插件'],['mcp','MCP 配置'],['settings','个人设置'],['projects','项目记录'],['history','会话历史'],['cache','缓存与日志']];

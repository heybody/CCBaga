/**
 * [INPUT]: 每次操作独立的进程结束确认状态与共享语言。
 * [OUTPUT]: 醒目的强制结束/任务中断警告和按用户偏好默认勾选且可取消的确认项。
 * [POS]: 身份、文件清理及 CLI 维护的共用确认内容；不调用原生命令。
 */
import {Checkbox} from 'cromma-ui';
import {useI18n} from './i18n';
export function ClaudeStopConsent({checked,onChange}:{checked:boolean;onChange:(value:boolean)=>void}){
 const {t}=useI18n();
 return <div className="identity-confirm">
  <div className="identity-delete-warning" role="alert"><span aria-hidden="true">!</span><strong>{t('继续将强制结束 Claude Desktop 和 Claude Code 进程，正在执行的任务会中断，未保存内容可能丢失。')}</strong></div>
  <p>{t('请先保存任务并正常退出 Claude；也可以取消此次操作。')}</p>
  <Checkbox checked={checked} onCheckedChange={value=>onChange(value===true)} label={t('我已保存任务，同意结束 Claude 进程')}/>
 </div>;
}

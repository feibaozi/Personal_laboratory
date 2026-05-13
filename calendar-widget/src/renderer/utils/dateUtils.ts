import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

export function setDayjsLocale(lang: string) {
  dayjs.locale(lang === 'zh' ? 'zh-cn' : 'en');
}

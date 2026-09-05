import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

// ภาษาที่แปลครบแล้ว ส่วน ja/zh ยังแปลไม่ครบ — เลยเอา en เป็นฐานแล้ว merge
// คำแปลของภาษานั้นทับลงไป คีย์ไหนยังไม่แปลจะตกมาเป็นอังกฤษแทนที่จะพัง
type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = {...base};
  for (const [k, v] of Object.entries(override)) {
    const cur = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) &&
      cur && typeof cur === 'object' && !Array.isArray(cur)
        ? deepMerge(cur as Messages, v as Messages)
        : v;
  }
  return out;
}

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const base = (await import('../messages/en.json')).default as Messages;
  const messages =
    locale === 'en'
      ? base
      : deepMerge(base, (await import(`../messages/${locale}.json`)).default as Messages);

  return {locale, messages};
});

import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // ปรับ matcher ให้ครอบคลุมหน้าแรก (/) และ locale ต่างๆ
  matcher: [
    // Match หน้าแรก
    '/',
    // Match ทุกหน้าที่มี /en หรือ /th
    '/(th|en)/:path*',
    // Match หน้าอื่นๆ ที่ไม่ใช่ไฟล์ static หรือ api
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
// ClassA-Store/app/api/announcements/discord/route.ts
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

function extractImage(html: string): string {
  const match = html.match(/<img[^>]+>/i);
  if (!match) return '';
  return `<div class="announcement-image">${match[0]}</div>`;
}

function removeImages(html: string): string {
  return html.replace(/<img[^>]+>/gi, '');
}

async function htmlToImage(htmlContent: string, title: string): Promise<Blob> {
  // ✅ แปลง /uploads/... → full URL ก่อนส่งให้ puppeteer
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aclassstore.com';
  const processedHtml = htmlContent.replace(
    /src="\/uploads\//g,
    `src="${appUrl}/uploads/`
  );

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 800, deviceScaleFactor: 2 });

  const now = new Date();
  const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0d0d0d;
          color: #e2e8f0;
          font-family: 'Noto Sans Thai', 'Segoe UI', Arial, sans-serif;
          width: 640px;
          font-size: 15px;
          line-height: 1.7;
          padding: 32px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .date-box {
          background: #1a1a2e;
          border-radius: 10px;
          padding: 8px 14px;
          text-align: center;
          min-width: 56px;
          flex-shrink: 0;
        }
        .date-box .month { color: #7c6af7; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
        .date-box .day { color: #fff; font-size: 28px; font-weight: 800; line-height: 1; }
        .date-box .year { color: #666; font-size: 11px; }
        .title { font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
        .announcement-image {
          width: 100%;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 16px;
          max-height: 320px;
        }
        .announcement-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .content-box {
          background: #161622;
          border-radius: 14px;
          padding: 20px 24px;
          border: 1px solid #ffffff10;
        }
        strong { color: #fff; font-weight: 700; }
        ul { padding-left: 20px; margin: 8px 0; }
        li { margin: 7px 0; color: #cbd5e1; }
        li::marker { color: #7c6af7; }
        p { margin: 8px 0; color: #cbd5e1; }
        p strong { color: #fff; }
        iframe { display: none; }
        div[data-youtube-video] {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 0;
          color: #a78bfa;
          font-size: 13px;
        }
        div[data-youtube-video]::before { content: '🎥 YouTube Video (ดูลิงก์ด้านล่าง)'; }
        .footer {
          margin-top: 16px;
          display: flex;
          gap: 20px;
          font-size: 12px;
          color: #555;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="date-box">
          <div class="month">${month}</div>
          <div class="day">${day}</div>
          <div class="year">${year}</div>
        </div>
        <div class="title">${title}</div>
      </div>

     ${extractImage(processedHtml)}
          <div class="content-box">${removeImages(processedHtml)}</div>
    </body>
    </html>
  `, { waitUntil: 'load' });

  // ✅ รอรูปโหลดครบก่อน screenshot
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  });

  const body = await page.$('body');
  const base64 = await body!.screenshot({ type: 'png', encoding: 'base64' }) as string;
  await browser.close();

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes.buffer], { type: 'image/png' });
}

async function postToDiscord(imageBlob: Blob, htmlContent: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL!;

  const youtubeMatch = htmlContent.match(/embed\/([^?"]+)/);
  const youtubeId = youtubeMatch?.[1];

  const formData = new FormData();
  formData.append('file', imageBlob, 'announcement.png');
  if (youtubeId) {
    formData.append('payload_json', JSON.stringify({
      content: `🎥 https://www.youtube.com/watch?v=${youtubeId}`,
    }));
  }

  const res = await fetch(webhookUrl, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Discord error: ${res.status}`);
}

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, title } = await req.json(); // ✅ รับ title ด้วย
    if (!htmlContent) return NextResponse.json({ error: 'Missing htmlContent' }, { status: 400 });

    const imageBlob = await htmlToImage(htmlContent, title || '');
    await postToDiscord(imageBlob, htmlContent);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error)?.message }, { status: 500 });
  }
}
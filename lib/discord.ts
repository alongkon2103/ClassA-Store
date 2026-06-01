import puppeteer from 'puppeteer';

function extractImage(html: string): string {
  const match = html.match(/<img[^>]+>/i);
  if (!match) return '';
  return `<div class="announcement-image">${match[0]}</div>`;
}

function removeImages(html: string): string {
  return html.replace(/<img[^>]+>/gi, '');
}

export async function sendAnnouncementToDiscord(htmlContent: string, title: string, imageUrl?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aclassstore.com';
  const processedHtml = htmlContent.replace(/src="\/uploads\//g, `src="${appUrl}/uploads/`);

  const imageBanner = imageUrl
    ? `<div class="announcement-image"><img src="${imageUrl.startsWith('/') ? appUrl + imageUrl : imageUrl}"></div>`
    : extractImage(processedHtml);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 2 }); // ✅ กว้างขึ้น

  const now = new Date();
  const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();

  await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0d0d0d; color: #e2e8f0; font-family: 'Noto Sans Thai','Segoe UI',Arial,sans-serif; width: 900px; font-size: 16px; line-height: 1.7; padding: 36px 40px; }
.header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
.date-box { background: #1a1a2e; border-radius: 12px; padding: 10px 18px; text-align: center; min-width: 64px; flex-shrink: 0; }
.date-box .month { color: #7c6af7; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.date-box .day { color: #fff; font-size: 32px; font-weight: 800; line-height: 1; }
.date-box .year { color: #666; font-size: 12px; }
.title { font-size: 30px; font-weight: 800; color: #fff; }
.announcement-image { width: 100%; border-radius: 16px; overflow: hidden; margin-bottom: 20px; max-height: 400px; }
.announcement-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.content-box { background: #161622; border-radius: 16px; padding: 24px 28px; border: 1px solid #ffffff10; }
strong { color: #fff; font-weight: 700; }
ul { padding-left: 22px; margin: 8px 0; }
li { margin: 8px 0; color: #cbd5e1; }
li::marker { color: #7c6af7; }
p { margin: 8px 0; color: #cbd5e1; }
span { color: inherit !important; }
iframe { display: none; }
div[data-youtube-video] { display:flex; align-items:center; gap:8px; margin:12px 0; color:#a78bfa; font-size:14px; }
div[data-youtube-video]::before { content: '🎥 YouTube Video (ดูลิงก์ด้านล่าง)'; }
.footer { margin-top: 20px; display: flex; gap: 24px; font-size: 13px; color: #555; }
</style></head>
<body>
<div class="header">
  <div class="date-box">
    <div class="month">${month}</div>
    <div class="day">${day}</div>
    <div class="year">${year}</div>
  </div>
  <div class="title">${title}</div>
</div>
${imageBanner}
<div class="content-box">${removeImages(processedHtml)}</div>
</body></html>`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.evaluate(() => Promise.all(
    Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() : new Promise(r => {
        img.onload = r;
        img.onerror = r;
        setTimeout(r, 10000);
      })
    )
  ));

  const body = await page.$('body');
  const base64 = await body!.screenshot({ type: 'png', encoding: 'base64' }) as string;
  await browser.close();

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const imageBlob = new Blob([bytes.buffer], { type: 'image/png' });

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
  if (!res.ok) throw new Error(`Discord error: ${res.status} - ${await res.text()}`);
}
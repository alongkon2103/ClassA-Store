// เนื้อหานโยบายความเป็นส่วนตัว (ไทย/อังกฤษ) — แก้ข้อความที่นี่ที่เดียว
// ถ้าแอดมินใส่ system_configs key `privacy_th` / `privacy_en` (HTML) ไว้ หน้า /privacy จะใช้ของนั้นแทน
export type PrivacySection = { id: string; title: string; paragraphs?: string[]; bullets?: string[] }

export const PRIVACY_UPDATED = "2026-09-07"

export const PRIVACY_TH: PrivacySection[] = [
  {
    id: "collect",
    title: "1. ข้อมูลที่เราเก็บ",
    paragraphs: ["เราเก็บเฉพาะข้อมูลที่จำเป็นต่อการให้บริการร้านค้าและส่งมอบสินค้า ได้แก่"],
    bullets: [
      "ข้อมูลบัญชี — เมื่อคุณเข้าสู่ระบบด้วย Discord หรือ Google เราได้รับชื่อผู้ใช้ อีเมล รูปโปรไฟล์ และรหัสบัญชีจากผู้ให้บริการนั้น (เราไม่ได้รับและไม่เก็บรหัสผ่านของคุณ)",
      "ข้อมูลการสั่งซื้อ — สินค้า แพ็กเกจ ยอดชำระ ช่องทางชำระเงิน วันเวลา สถานะ และชื่อผู้ใช้ Roblox ที่ใช้ทำ whitelist",
      "สินค้าประเภทโปรแกรม — รหัสเครื่อง (HWID) เพื่อผูกสิทธิ์การใช้งานกับเครื่องของคุณ",
      "เนื้อหาที่คุณสร้าง — รีวิว รายการโปรด รูปที่อัปโหลดและโปรเจคในเครื่องมือสร้างรูปไลฟ์",
      "ข้อมูลทางเทคนิค — คุกกี้เซสชันสำหรับล็อกอิน ภาษาและโหมดสีที่เลือก และรหัสแนะนำ (affiliate) หากคุณเข้ามาผ่านลิงก์แนะนำ",
    ],
  },
  {
    id: "use",
    title: "2. เราใช้ข้อมูลเพื่ออะไร",
    bullets: [
      "ส่งมอบสินค้า — เพิ่มชื่อลง whitelist, ส่งคีย์, เปิดสิทธิ์ใช้งานโปรแกรม และแสดงประวัติออเดอร์ของคุณ",
      "ตรวจสอบและยืนยันการชำระเงิน แก้ไขปัญหา และให้การซัพพอร์ต",
      "คำนวณค่าคอมมิชชันของนายหน้า — นายหน้าเห็นเฉพาะยอดรวม ไม่เห็นข้อมูลส่วนตัวของผู้ซื้อ",
      "ส่งข่าวสารและโปรโมชั่น เฉพาะเมื่อคุณสมัครรับข่าวสารด้วยตัวเอง และยกเลิกได้ทุกเมื่อ",
      "ปรับปรุงบริการ และป้องกันการใช้งานผิดวัตถุประสงค์ เช่น การใช้สิทธิ์ซ้ำหลายเครื่อง",
    ],
  },
  {
    id: "payment",
    title: "3. การชำระเงิน",
    paragraphs: [
      "การชำระเงินดำเนินการผ่านผู้ให้บริการภายนอก ได้แก่ Stripe (บัตรเครดิต/เดบิต และ PromptPay) และ PayPal ข้อมูลบัตรของคุณถูกกรอกและเก็บรักษาที่ผู้ให้บริการเหล่านั้นโดยตรง เราไม่เห็นและไม่เก็บหมายเลขบัตร",
      "เราเก็บเฉพาะสถานะการชำระ ยอดเงิน ค่าธรรมเนียม และรหัสอ้างอิงธุรกรรม เพื่อใช้ยืนยันออเดอร์และออกหลักฐานเมื่อมีข้อสงสัย",
    ],
  },
  {
    id: "share",
    title: "4. การเปิดเผยข้อมูลให้บุคคลอื่น",
    paragraphs: ["เราไม่ขายหรือให้เช่าข้อมูลส่วนตัวของคุณ ข้อมูลอาจถูกส่งต่อเฉพาะกรณีต่อไปนี้"],
    bullets: [
      "ผู้ให้บริการชำระเงิน (Stripe, PayPal) และผู้ให้บริการเข้าสู่ระบบ (Discord, Google) ตามนโยบายความเป็นส่วนตัวของแต่ละราย",
      "สินค้าจากพาร์ทเนอร์ — เมื่อกดซื้อเกมของพาร์ทเนอร์ คุณจะไปทำรายการที่เว็บไซต์ของพาร์ทเนอร์โดยตรง ข้อมูลที่กรอกที่นั่นอยู่ภายใต้นโยบายของพาร์ทเนอร์รายนั้น",
      "เมื่อกฎหมายกำหนด หรือเพื่อคุ้มครองสิทธิ์และความปลอดภัยของร้านและผู้ใช้รายอื่น",
    ],
  },
  {
    id: "cookies",
    title: "5. คุกกี้และการจดจำในเบราว์เซอร์",
    bullets: [
      "คุกกี้เซสชันสำหรับสถานะการเข้าสู่ระบบ (ลบเมื่อออกจากระบบ)",
      "ค่าที่จำไว้ในเบราว์เซอร์ของคุณ เช่น ภาษาและโหมดสี ไม่ถูกส่งมาที่เรา",
      "รหัสแนะนำจากลิงก์นายหน้า เก็บชั่วคราวเพื่อคิดส่วนลดและค่าคอมมิชชันให้ถูกคน",
      "เราไม่ใช้คุกกี้โฆษณาหรือตัวติดตามของบุคคลที่สาม",
    ],
  },
  {
    id: "retention",
    title: "6. การเก็บรักษาและความปลอดภัย",
    bullets: [
      "ข้อมูลบัญชีและเนื้อหาที่คุณสร้างจะถูกเก็บตราบที่บัญชียังใช้งานอยู่",
      "ข้อมูลออเดอร์และการชำระเงินเก็บไว้ตามที่จำเป็นสำหรับบัญชีการเงินและข้อกำหนดทางกฎหมาย",
      "ทุกการเชื่อมต่อผ่าน HTTPS และจำกัดสิทธิ์เข้าถึงข้อมูลไว้เฉพาะผู้ดูแลระบบ",
    ],
  },
  {
    id: "rights",
    title: "7. สิทธิ์ของคุณ",
    bullets: [
      "ดูและแก้ไขชื่อที่แสดงได้ในหน้าบัญชีของคุณ · ลบรีวิว รายการโปรด และโปรเจคได้ด้วยตัวเอง",
      "ขอสำเนาข้อมูล แก้ไข หรือขอลบบัญชีและข้อมูลได้ โดยติดต่อเราผ่านช่องทางด้านล่าง เราจะดำเนินการภายใน 30 วัน (ข้อมูลออเดอร์ที่ต้องเก็บตามกฎหมายอาจยังคงอยู่)",
      "ยกเลิกการรับข่าวสารได้ทุกเมื่อผ่านลิงก์ในอีเมลหรือแจ้งเรา",
    ],
  },
  {
    id: "children",
    title: "8. ผู้เยาว์",
    paragraphs: ["บริการนี้เหมาะสำหรับผู้ที่มีอายุ 13 ปีขึ้นไป ผู้ที่มีอายุต่ำกว่า 20 ปีควรได้รับความยินยอมจากผู้ปกครองก่อนชำระเงิน หากพบว่าเก็บข้อมูลของเด็กโดยไม่ได้รับความยินยอม เราจะลบข้อมูลนั้นโดยเร็ว"],
  },
  {
    id: "changes",
    title: "9. การเปลี่ยนแปลงนโยบาย",
    paragraphs: ["เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยระบุวันที่มีผลไว้ด้านบนของหน้านี้ การใช้บริการต่อหลังจากวันที่มีผลถือว่าคุณรับทราบนโยบายฉบับใหม่"],
  },
  {
    id: "contact",
    title: "10. ติดต่อเรา",
    paragraphs: ["มีคำถามเกี่ยวกับข้อมูลส่วนตัว หรือต้องการใช้สิทธิ์ตามข้อ 7 ติดต่อทีมงานได้ทาง Discord หรือช่องทางในหน้าติดต่อเรา"],
  },
]

export const PRIVACY_EN: PrivacySection[] = [
  {
    id: "collect",
    title: "1. What we collect",
    paragraphs: ["We only collect what is needed to run the store and deliver your purchases:"],
    bullets: [
      "Account — when you sign in with Discord or Google we receive your username, email, avatar and provider account ID (we never receive or store your password)",
      "Orders — product, package, amount, payment method, date/time, status, and the Roblox username used for whitelisting",
      "Desktop programs — a machine ID (HWID) to bind your license to your device",
      "Content you create — reviews, favorites, uploaded images and projects in the live-image editor",
      "Technical — a session cookie for sign-in, your language/theme choice, and a referral code if you arrived through an affiliate link",
    ],
  },
  {
    id: "use",
    title: "2. How we use it",
    bullets: [
      "Delivering purchases — whitelisting, sending keys, activating program licenses, and showing your order history",
      "Verifying payments, resolving issues and providing support",
      "Calculating affiliate commissions — affiliates only see totals, never buyer details",
      "Sending news and promotions only if you subscribed yourself; unsubscribe any time",
      "Improving the service and preventing abuse such as license sharing across devices",
    ],
  },
  {
    id: "payment",
    title: "3. Payments",
    paragraphs: [
      "Payments are processed by third-party providers: Stripe (cards and PromptPay) and PayPal. Your card details are entered and stored with those providers directly — we never see or store card numbers.",
      "We keep only the payment status, amount, fees and a transaction reference to confirm orders and resolve disputes.",
    ],
  },
  {
    id: "share",
    title: "4. Sharing with others",
    paragraphs: ["We do not sell or rent your personal data. It is shared only in these cases:"],
    bullets: [
      "Payment providers (Stripe, PayPal) and sign-in providers (Discord, Google) under their own privacy policies",
      "Partner games — when you buy a partner's game you complete the purchase on the partner's website; anything you enter there is governed by that partner's policy",
      "Where required by law, or to protect the rights and safety of the store and other users",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies and browser storage",
    bullets: [
      "A session cookie for your sign-in state (removed when you sign out)",
      "Preferences remembered in your browser such as language and theme — these are not sent to us",
      "An affiliate referral code kept temporarily so discounts and commissions go to the right person",
      "We use no third-party advertising cookies or trackers",
    ],
  },
  {
    id: "retention",
    title: "6. Retention and security",
    bullets: [
      "Account data and content you created are kept while your account is active",
      "Order and payment records are kept as required for accounting and legal obligations",
      "All connections use HTTPS and data access is limited to administrators",
    ],
  },
  {
    id: "rights",
    title: "7. Your rights",
    bullets: [
      "View and edit your display name on your account page; delete your own reviews, favorites and projects any time",
      "Request a copy, correction, or deletion of your account and data through the contact channels below — we respond within 30 days (order records we must keep by law may remain)",
      "Unsubscribe from news at any time via the link in the email or by contacting us",
    ],
  },
  {
    id: "children",
    title: "8. Minors",
    paragraphs: ["The service is intended for users aged 13 and over. Users under 20 should have a parent or guardian's consent before making payments. If we learn we collected a child's data without consent we will delete it promptly."],
  },
  {
    id: "changes",
    title: "9. Changes to this policy",
    paragraphs: ["We may update this policy from time to time; the effective date is shown at the top of this page. Continued use after that date means you acknowledge the updated policy."],
  },
  {
    id: "contact",
    title: "10. Contact us",
    paragraphs: ["Questions about your data, or want to exercise your rights under section 7? Reach the team on Discord or through the channels on our contact page."],
  },
]

// เนื้อหานโยบายความเป็นส่วนตัว (ไทย/อังกฤษ/ญี่ปุ่น/จีน) — แก้ข้อความที่นี่ที่เดียว
// ถ้าแอดมินใส่ system_configs key `privacy_<locale>` (HTML) ไว้ หน้า /privacy จะใช้ของนั้นแทน
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

export const PRIVACY_JA: PrivacySection[] = [
  {
    id: "collect",
    title: "1. 収集する情報",
    paragraphs: ["ストアの運営と商品のお届けに必要な情報のみを収集します。"],
    bullets: [
      "アカウント — DiscordまたはGoogleでログインすると、ユーザー名、メールアドレス、アバター、プロバイダーのアカウントIDを受け取ります（パスワードは受け取らず、保存もしません）",
      "注文 — 商品、パッケージ、金額、支払い方法、日時、ステータス、およびWhitelist登録に使用したRobloxユーザー名",
      "デスクトッププログラム — ライセンスをお使いの端末に紐づけるためのマシンID（HWID）",
      "作成したコンテンツ — レビュー、お気に入り、アップロードした画像、ライブ画像エディターのプロジェクト",
      "技術情報 — ログイン用のセッションCookie、言語・テーマの設定、アフィリエイトリンク経由で訪問した場合の紹介コード",
    ],
  },
  {
    id: "use",
    title: "2. 情報の利用目的",
    bullets: [
      "商品のお届け — Whitelist登録、キーの送付、プログラムライセンスの有効化、注文履歴の表示",
      "支払いの確認、問題の解決、サポートの提供",
      "アフィリエイト報酬の計算 — アフィリエイトには合計額のみが表示され、購入者の情報は表示されません",
      "ご自身で登録された場合のみ、お知らせやプロモーションを送信します。いつでも配信停止できます",
      "サービスの改善と、複数端末でのライセンス共有などの不正利用の防止",
    ],
  },
  {
    id: "payment",
    title: "3. お支払い",
    paragraphs: [
      "お支払いは外部の決済事業者（Stripe：カードおよびPromptPay、PayPal）が処理します。カード情報はそれらの事業者に直接入力・保管され、当店はカード番号を閲覧も保存もしません。",
      "当店が保持するのは、注文の確認や問い合わせ対応に必要な支払いステータス、金額、手数料、取引参照番号のみです。",
    ],
  },
  {
    id: "share",
    title: "4. 第三者への提供",
    paragraphs: ["個人情報を販売したり貸し出したりすることはありません。提供するのは以下の場合のみです。"],
    bullets: [
      "決済事業者（Stripe、PayPal）およびログインプロバイダー（Discord、Google）— 各社のプライバシーポリシーに基づきます",
      "パートナーゲーム — パートナーのゲームを購入する際は、パートナーのウェブサイトで購入を完了します。そこで入力した情報は、そのパートナーのポリシーが適用されます",
      "法律で求められる場合、または当店と他のユーザーの権利と安全を守るために必要な場合",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookieとブラウザの保存データ",
    bullets: [
      "ログイン状態を保持するセッションCookie（ログアウト時に削除されます）",
      "言語やテーマなど、お使いのブラウザに記憶される設定 — これらは当店に送信されません",
      "割引と報酬を正しい相手に紐づけるため、一時的に保持されるアフィリエイト紹介コード",
      "第三者の広告Cookieやトラッカーは使用していません",
    ],
  },
  {
    id: "retention",
    title: "6. 保存期間とセキュリティ",
    bullets: [
      "アカウント情報と作成したコンテンツは、アカウントが有効な間保存されます",
      "注文と支払いの記録は、会計および法的義務のために必要な期間保存されます",
      "すべての通信はHTTPSで行われ、データへのアクセスは管理者に限定されています",
    ],
  },
  {
    id: "rights",
    title: "7. お客様の権利",
    bullets: [
      "アカウントページで表示名を確認・変更できます。ご自身のレビュー、お気に入り、プロジェクトはいつでも削除できます",
      "下記の連絡先から、アカウントとデータの写しの請求、訂正、削除を依頼できます。30日以内に対応します（法律上保存が必要な注文記録は残る場合があります）",
      "お知らせの配信は、メール内のリンクまたは当店への連絡でいつでも停止できます",
    ],
  },
  {
    id: "children",
    title: "8. 未成年の方",
    paragraphs: ["本サービスは13歳以上の方を対象としています。20歳未満の方は、お支払いの前に保護者の同意を得てください。同意なくお子様の情報を収集したことが判明した場合は、速やかに削除します。"],
  },
  {
    id: "changes",
    title: "9. ポリシーの変更",
    paragraphs: ["本ポリシーは随時更新されることがあります。発効日はこのページの上部に表示されます。発効日以降もサービスを利用された場合、更新後のポリシーを確認されたものとみなします。"],
  },
  {
    id: "contact",
    title: "10. お問い合わせ",
    paragraphs: ["データに関するご質問や、第7条の権利を行使したい場合は、Discordまたはお問い合わせページの窓口からご連絡ください。"],
  },
]

export const PRIVACY_ZH: PrivacySection[] = [
  {
    id: "collect",
    title: "1. 我们收集的信息",
    paragraphs: ["我们只收集运营商店和交付商品所需的信息："],
    bullets: [
      "账号 — 使用 Discord 或 Google 登录时，我们会获得你的用户名、邮箱、头像和该平台的账号 ID（我们不会获取或保存你的密码）",
      "订单 — 商品、套餐、金额、支付方式、日期时间、状态，以及用于 Whitelist 的 Roblox 用户名",
      "桌面程序 — 用于将授权绑定到你设备的机器码（HWID）",
      "你创建的内容 — 评价、收藏、上传的图片以及直播图片编辑器中的项目",
      "技术信息 — 用于登录的会话 Cookie、语言/主题偏好，以及通过推广链接访问时的推荐码",
    ],
  },
  {
    id: "use",
    title: "2. 我们如何使用",
    bullets: [
      "交付商品 — 添加 Whitelist、发送密钥、激活程序授权、显示你的订单记录",
      "核实付款、处理问题并提供支持",
      "计算推广佣金 — 推广员只能看到总额，看不到买家信息",
      "仅在你自行订阅时发送资讯和优惠，可随时退订",
      "改进服务并防止滥用，例如在多台设备上共享授权",
    ],
  },
  {
    id: "payment",
    title: "3. 付款",
    paragraphs: [
      "付款由第三方服务商处理：Stripe（银行卡和 PromptPay）及 PayPal。你的卡片信息直接在这些服务商处输入和保存，我们不会看到或保存卡号。",
      "我们只保留付款状态、金额、手续费和交易参考号，用于确认订单和处理争议。",
    ],
  },
  {
    id: "share",
    title: "4. 与他人共享",
    paragraphs: ["我们不会出售或出租你的个人信息，仅在以下情况共享："],
    bullets: [
      "支付服务商（Stripe、PayPal）和登录服务商（Discord、Google），适用其各自的隐私政策",
      "合作伙伴游戏 — 购买合作伙伴的游戏时，你将在合作伙伴的网站完成购买，在那里填写的信息受该合作伙伴的政策约束",
      "法律要求时，或为保护本店及其他用户的权利与安全时",
    ],
  },
  {
    id: "cookies",
    title: "5. Cookie 与浏览器存储",
    bullets: [
      "用于保持登录状态的会话 Cookie（退出登录时删除）",
      "保存在你浏览器中的偏好设置，如语言和主题 — 这些不会发送给我们",
      "临时保存的推广推荐码，以便把折扣和佣金记到正确的人",
      "我们不使用任何第三方广告 Cookie 或跟踪器",
    ],
  },
  {
    id: "retention",
    title: "6. 保存期限与安全",
    bullets: [
      "账号信息和你创建的内容在账号有效期间保留",
      "订单和付款记录按会计及法律要求保留",
      "所有连接均使用 HTTPS，数据访问仅限管理员",
    ],
  },
  {
    id: "rights",
    title: "7. 你的权利",
    bullets: [
      "在账号页面查看和修改显示名称；随时删除自己的评价、收藏和项目",
      "通过下方联系渠道申请账号和数据的副本、更正或删除 — 我们会在 30 天内处理（法律要求保留的订单记录可能会保留）",
      "随时通过邮件中的链接或联系我们退订资讯",
    ],
  },
  {
    id: "children",
    title: "8. 未成年人",
    paragraphs: ["本服务面向 13 岁及以上用户。未满 20 岁的用户在付款前应获得家长或监护人的同意。如果我们发现未经同意收集了儿童信息，将尽快删除。"],
  },
  {
    id: "changes",
    title: "9. 政策变更",
    paragraphs: ["我们可能不时更新本政策，生效日期显示在本页顶部。在该日期之后继续使用服务即表示你已知悉更新后的政策。"],
  },
  {
    id: "contact",
    title: "10. 联系我们",
    paragraphs: ["对你的数据有疑问，或想行使第 7 条中的权利？请通过 Discord 或联系页面上的渠道联系我们的团队。"],
  },
]

/** เลือกชุดเนื้อหาตาม locale — ภาษาที่ไม่มีใช้อังกฤษ */
export const PRIVACY_BY_LOCALE: Record<string, PrivacySection[]> = { th: PRIVACY_TH, en: PRIVACY_EN, ja: PRIVACY_JA, zh: PRIVACY_ZH }

# ClassA-Store System Architecture & Workflow

## 📌 Overview
ClassA-Store เป็นแพลตฟอร์มขายสินค้าดิจิทัลและระบบควบคุมเกม (Game Control) ที่เชื่อมต่อระหว่างผู้ซื้อ, เว็บไซต์, และเซิร์ฟเวอร์เกม (เช่น Roblox) โดยเน้นไปที่ระบบ **TikTok Interaction** ที่ทำให้การส่งของขวัญใน TikTok ส่งผลต่อเหตุการณ์ภายในเกม

---

## 🛠️ Key Components & Responsibilities

### 1. ClassA-Store (Frontend & Management API)
**Role:** หน้ากากสำหรับผู้ใช้ (Client-facing) และตัวจัดการฐานข้อมูล
- **Tech Stack:** Next.js (App Router), Prisma (PostgreSQL), Next-Auth (Discord/Google Auth), Tailwind CSS
- **หน้าที่หลัก:**
    - **Authentication:** จัดการการเข้าสู่ระบบผ่าน Discord และ Google
    - **Order Management:** จัดการสถานะการสั่งซื้อ (Pending, Paid, Fulfilled)
    - **Setting System:** หน้าให้ผู้ใช้ตั้งค่า Mapping ระหว่าง "ของขวัญ TikTok" กับ "ฟังก์ชันในเกม"
    - **API Proxy:** ทำหน้าที่เป็นด่านหน้า รับ Request จาก Roblox และส่งคำสั่งไปยัง `tiktok-service`

### 2. tiktok-service (Execution Engine)
**Role:** เครื่องยนต์หลักที่คอย "ฟัง" เหตุการณ์จาก TikTok LIVE
- **Tech Stack:** Node.js, `piratetok-live-js`, WebSocket
- **หน้าที่หลัก:**
    - **Connection Handling:** สร้าง Worker Process แยกตามรายชื่อผู้ใช้ เพื่อดึงข้อมูล Live
    - **Pirate Connection:** ใช้ Library พิเศษที่มีระบบจัดการ Signature ภายใน ทำให้การเชื่อมต่อเสถียรและไม่ค่อยติด 403
    - **Event Processing:** แปลงข้อมูลจาก TikTok ให้เป็น Format ที่ระบบเข้าใจ (Normalization)
    - **Gift Queuing:** เก็บสะสมของขวัญที่ได้รับไว้ใน Memory เพื่อรอการดึงออกไปใช้งาน

### 3. Database (PostgreSQL via Prisma)
**Role:** แหล่งเก็บข้อมูลถาวร
- **ตารางสำคัญ:**
    - `orders`: เก็บข้อมูลการซื้อและสถานะ (รวมถึง `tiktok_username` ปัจจุบัน)
    - `user_function_gifts`: เก็บข้อมูลการตั้งค่า (Mapping) ว่าของขวัญ ID ไหน คือฟังก์ชันชื่ออะไร
    - `products` & `product_functions`: ข้อมูลสินค้าและคำสั่งที่มีให้เลือกใช้ในเกมนั้นๆ

---

## 🔄 Core Workflows

### 1. การตั้งค่าระบบ (Setup Flow)
1. User เข้าหน้า **Order Settings** ในเว็บไซต์
2. User ใส่ชื่อ **TikTok Username** และกดบันทึก
3. User เลือก **Mapping** (เช่น ถ้าได้รับ "Rose" ให้รันฟังก์ชัน "SpawnZombie")
4. ระบบบันทึกค่าลงในตาราง `user_function_gifts` ผ่าน Prisma

### 2. การเริ่มดึงข้อมูล (Tracking Flow)
1. User กดปุ่ม **"Start Tracking"** บนหน้าเว็บ
2. เว็บส่ง Request ไปที่ `ClassA-Store API` -> ส่งต่อไปที่ `tiktok-service`
3. `tiktok-service` สั่งให้ Playwright ไปดึง Cookie สดใหม่จากหน้า TikTok
4. `tiktok-service` เริ่มรัน Worker เชื่อมต่อกับไลฟ์ของ User คนนั้น
5. สถานะบนหน้าเว็บจะเปลี่ยนเป็น **"Running"** (สีเขียว)

### 3. การรับของขวัญและการประมวลผล (Gift Flow)
1. มีคนส่งของขวัญใน TikTok LIVE
2. `tiktok-service` ตรวจพบเหตุการณ์ -> นำข้อมูลของขวัญใส่ลงใน **Queue** (In-memory)
3. **Roblox** ทำการ Polling (เรียก API ทุก 1-2 วินาที) มาที่ `ClassA-Store API`
4. `ClassA-Store API` ไปดึงข้อมูลดิบจาก `tiktok-service`
5. `ClassA-Store API` นำ Gift ID ที่ได้ มาเทียบกับตาราง Mapping ใน DB
6. ส่งผลลัพธ์กลับไปให้ **Roblox** เป็นรายการคำสั่ง (เช่น `functionName: "SpawnZombie"`)
7. `tiktok-service` ลบของขวัญออกจากคิวทันทีหลังจากถูกดึงไปแล้ว

---

## 🔐 Security & Communication Loop

- **Web ↔ Service:** สื่อสารผ่าน REST API โดยใช้ `x-api-key` ใน Header เพื่อยืนยันตัวตน
- **Roblox ↔ Web:** ใช้ `API_CHCK_WHILIST_KEY` เป็นรหัสลับ (Secret Key) เพื่อป้องกันการดึงข้อมูลจากบุคคลภายนอก
- **TikTok ↔ Service:** ใช้ Playwright ทำ Automated Handshake เพื่อจำลองพฤติกรรมมนุษย์ ป้องกันการโดนแบน

---

## 📈 Scalability
- **Multi-Worker:** ระบบออกแบบมาให้รองรับการรันหลาย Account พร้อมกันโดยแยก Process ชัดเจน
- **Memory Safety:** คิวของขวัญมีการจำกัดขนาดสูงสุด (1,000 รายการ) เพื่อป้องกัน RAM เต็มหากไม่มีการดึงข้อมูลออกไป

---
*เอกสารนี้จัดทำเพื่ออธิบายภาพรวมระบบทั้งหมดของ ClassA-Store (Version 2)*

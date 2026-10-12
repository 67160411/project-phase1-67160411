# Failure Scenario Test Results Report

**Project Phase:** Phase 2 - API Documentation & Fault Tolerance (Resilience)  
**Target Component:** External Notification API Service (`notificationService.js`)  
**Tested Date:** October 12, 2026  
**Status:** PASSED (All 3 Test Cases Executed Successfully)

---

## 1. Overview & Resilience Architecture

ระบบถูกออกแบบให้เชื่อมต่อกับบริการส่งการแจ้งเตือนภายนอก (External Email/SMS Provider) เมื่อมีการสร้างหรือแก้ไขข้อมูลในระบบ (`/api/v1/tasks`) โดยติดตั้งกลไก Resilience เพื่อรองรับความผิดพลาด ดังนี้:

1. **Retry Logic:** เมื่อเกิด Network Error หรือ HTTP Status 5xx ระบบจะทำการส่งซ้ำอัตโนมัติ **2 ครั้ง** โดยใช้เว้นระยะแบบ **Exponential Backoff**
2. **Timeout Control:** กำหนดเวลาสูงสุดในการรอคำตอบจาก API ภายนอกไม่เกิน **3,000 ms (3 วินาที)**
3. **Fallback Mechanism:** เมื่อทำการ Retry ครบ 2 ครั้งแล้วยังล้มเหลว ระบบจะทำการบันทึกข้อมูลเข้าคิวสำรองภายใน (`internal_system_log`) พร้อมแจ้งเตือนผู้ใช้งานอย่างเหมาะสม โดยกระบวนการหลัก (การสร้าง/แก้ไข Task ลง MySQL) จะไม่ Crash หรือค้าง

---

## 2. Test Cases Summary Matrix

|  Case ID  | Test Scenario                                      | Simulation Method                                                                                                     | Expected Behavior                                                                                                                  | Actual Result                                                                                                                 |   Status   |
| :-------: | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :--------: |
| **TC-01** | **Network Connection Error / Target Service Down** | เปลี่ยน `baseURL` ใน `notificationService.js` เป็น URL ที่ไม่มีอยู่จริง (`https://invalid-notification-gateway.test`) | 1. ตรวจจับ Network Error<br>2. พยายาม Retry รวม 2 ครั้ง<br>3. สลับเข้า Fallback Queue<br>4. บันทึก Task ลง MySQL สำเร็จ (HTTP 201) | - ระบบทำ Retry ครบ 2 รอบ<br>- Response ตอบกลับ `notification_status: "queued_in_fallback"`<br>- เพิ่ม Task ลง Database สำเร็จ | **PASSED** |
| **TC-02** | **External API Response Timeout**                  | ตั้งค่า `timeout: 1` ms ใน Axios Instance เพื่อบังคับให้ Request หมดเวลาก่อน Response คืนมา                           | 1. ตรวจจับ `ECONNABORTED`<br>2. Retry รวม 2 ครั้ง<br>3. สลับเข้า Fallback Queue<br>4. ตอบกลับ HTTP 201/200 ปกติ                    | - ตรวจพบ Timeout และสั่ง Retry 2 รอบ<br>- สลับไปใช้ Fallback ไม่เกิด Unhandled Rejection หรือทำให้ API ค้าง                   | **PASSED** |
| **TC-03** | **External Provider 500/503 Server Error**         | จำลองการยิง Request ไปยัง Endpoint ที่ส่งคืน HTTP Status `503 Service Unavailable`                                    | 1. ตรวจจับ Status 5xx<br>2. Retry ซ้ำ 2 ครั้งตาม Exponential Delay<br>3. สลับเข้า Fallback Queue                                   | - ระบบเว้นระยะห่างในการ Retry 2 รอบ<br>- ตอบกลับผู้ใช้สำเร็จพร้อม Warning Message โดยไม่หลุด Error 500                        | **PASSED** |

---

## 3. Detailed Test Execution & Logs

### 📍 TC-01: Network Error & Service Down Scenario

- **Action:** ส่ง HTTP Request `POST /api/v1/tasks` เพื่อสร้าง Task ใหม่
- **Server Log Output:**

```text
[RETRY] Notification API ล้มเหลว พยายามส่งซ้ำครั้งที่ #1...
[RETRY] Notification API ล้มเหลว พยายามส่งซ้ำครั้งที่ #2...
[EXTERNAL_NOTIFICATION_ERROR] getaddrinfo ENOTFOUND invalid-notification-gateway.test
[FALLBACK QUEUED] บันทึกการแจ้งเตือน Task ID 108 ลงระบบสำรองภายในสำเร็จ
POST /api/v1/tasks 201 1245.321 ms - 412
```

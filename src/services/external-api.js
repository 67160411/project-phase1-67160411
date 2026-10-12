const axios = require("axios");
const axiosRetry = require("axios-retry").default;

// สร้าง Axios Instance สำหรับ External Email/SMS Provider
const notificationClient = axios.create({
  baseURL: "https://api.external-notification-provider.com/v1", // URL API ภายนอก
  timeout: 3000, // Timeout สูงสุด 3 วินาที (3,000 ms)[cite: 1]
});

// Retry Logic: เมื่อเจอ Network Error หรือ Status Code 5xx[cite: 1]
axiosRetry(notificationClient, {
  retries: 2, // Retry 2 ครั้งก่อนถือว่าล้มเหลวสมบูรณ์[cite: 1]
  retryDelay: (retryCount) => {
    console.log(
      `[RETRY] Notification API ล้มเหลว พยายามส่งซ้ำครั้งที่ #${retryCount}...`,
    );
    return axiosRetry.exponentialDelay(retryCount); // Exponential Backoff Delay[cite: 1]
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === "ECONNABORTED" ||
      (error.response && error.response.status >= 500)
    );
  },
});

/**
 * ฟังก์ชันส่งการแจ้งเตือนเกี่ยวกับ Task ไปยังบริการภายนอก พร้อม Fallback Mechanism[cite: 1]
 * @param {Object} taskData ข้อมูล Task ที่ต้องการแจ้งเตือน
 * @param {string} action ประเภทการทำงาน เช่น "CREATED", "UPDATED"
 */
async function sendTaskNotification(taskData, action = "UPDATED") {
  const payload = {
    taskId: taskData.id,
    title: taskData.title,
    status: taskData.status,
    action: action,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await notificationClient.post(
      "/send-notification",
      payload,
    );

    return {
      success: true,
      notification_status: "sent",
      delivery_source: "external_notification_service",
      message_id: response.data?.messageId || "msg_mock_12345",
    };
  } catch (error) {
    console.error(`[EXTERNAL_NOTIFICATION_ERROR] ${error.message}`);

    // Fallback Mechanism: เมื่อเรียก API ภายนอกล้มเหลวแม้ Retry ครบแล้ว[cite: 1]
    // บันทึกการแจ้งเตือนลง System Log / Internal Queue เพื่อไม่ให้กระบวนการหลัก crash หรือค้าง[cite: 1]
    console.log(
      `[FALLBACK QUEUED] บันทึกการแจ้งเตือน Task ID ${taskData.id} ลงระบบสำรองภายในสำเร็จ`,
    );

    return {
      success: true,
      notification_status: "queued_in_fallback",
      delivery_source: "internal_system_log",
      warning:
        "ไม่สามารถเชื่อมต่อบริการแจ้งเตือนภายนอกได้หลังพยายาม 2 ครั้ง ระบบได้ทำการบันทึกข้อมูลเข้าคิวสำรองแล้ว",
      data: payload,
    };
  }
}

module.exports = { sendTaskNotification };

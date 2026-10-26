const DEFAULT_API_URL = "https://jsonplaceholder.typicode.com/todos/1";

const MAX_RETRIES = 2; // ลองใหม่ 2 ครั้ง รวมสูงสุด 3 ครั้ง
const TIMEOUT_MS = 3000; // จำกัดเวลาต่อครั้ง 3 วินาที
const INITIAL_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithTimeout(url) {
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`External API returned HTTP ${response.status}`);

      error.status = response.status;
      error.code = `HTTP_${response.status}`;

      // Retry เฉพาะ Server Error และ Too Many Requests
      error.retryable = response.status === 429 || response.status >= 500;

      throw error;
    }

    try {
      return await response.json();
    } catch (cause) {
      const error = new Error("External API returned invalid JSON", { cause });

      error.code = "INVALID_EXTERNAL_JSON";
      error.retryable = true;

      throw error;
    }
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        `External API timed out after ${TIMEOUT_MS} ms`,
        { cause: error },
      );

      timeoutError.code = "ETIMEDOUT";
      timeoutError.retryable = true;

      throw timeoutError;
    }

    // รักษา HTTP error ที่จำแนกไว้แล้ว
    if (error.status != null) {
      throw error;
    }

    // รักษาข้อผิดพลาดจาก JSON parsing
    if (error.code === "INVALID_EXTERNAL_JSON") {
      throw error;
    }

    // Network error หรือข้อผิดพลาดที่ไม่คาดคิดจาก fetch
    if (error.retryable == null) {
      error.code = error.code || "EXTERNAL_NETWORK_ERROR";
      error.retryable = true;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getExternalTodo() {
  const url = process.env.EXTERNAL_API_URL || DEFAULT_API_URL;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await requestWithTimeout(url);

      console.log(`[External API] Success on attempt ${attempt + 1}`);

      return {
        success: true,
        source: "external-api",
        data,
      };
    } catch (error) {
      console.error(`[External API] Attempt ${attempt + 1} failed:`, {
        code: error.code || "UNKNOWN_ERROR",
        status: error.status || null,
        message: error.message,
      });

      const canRetry = error.retryable !== false && attempt < MAX_RETRIES;

      if (!canRetry) {
        throw error;
      }

      const waitMs = INITIAL_DELAY_MS * 2 ** attempt;

      console.log(`[External API] Retrying in ${waitMs} ms`);

      await delay(waitMs);
    }
  }

  // ปกติจะไม่ถึงบรรทัดนี้ เพราะลูปจะ throw เมื่อหมดจำนวนครั้ง
  throw new Error("External API request failed");
}

// จำลองการแจ้งเตือนผ่าน Console
// ไม่ใช่การส่งอีเมลหรือ Push Notification จริง
async function sendTaskNotification(task, event = "CREATED") {
  console.log("[Task Notification]", {
    event,
    message:
      event === "CREATED" ? "สร้างงานใหม่สำเร็จ" : "แก้ไขข้อมูลงานสำเร็จ",
    task,
  });

  return {
    success: true,
    message: "Notification logged successfully",
  };
}

module.exports = {
  getExternalTodo,
  sendTaskNotification,
};

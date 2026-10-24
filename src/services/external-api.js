const DEFAULT_API_URL = "https://jsonplaceholder.typicode.com/todos/1";

const MAX_RETRIES = 2; // ลองใหม่ 2 ครั้ง รวมสูงสุด 3 ครั้ง
const TIMEOUT_MS = 3000; // รอสูงสุดครั้งละ 3 วินาที
const INITIAL_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithTimeout(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
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

      // ลองใหม่เฉพาะ Server Error (5xx)
      error.retryable = response.status >= 500;

      throw error;
    }

    return await response.json();
  } catch (error) {
    if (error.status == null) {
      // Network error, timeout หรือ JSON parsing error
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
      console.error(
        `[External API] Attempt ${attempt + 1} failed:`,
        error.message,
      );

      const canRetry = error.retryable !== false && attempt < MAX_RETRIES;

      if (!canRetry) {
        throw error;
      }

      const waitMs = INITIAL_DELAY_MS * 2 ** attempt;

      console.log(`[External API] Retrying in ${waitMs} ms`);

      await delay(waitMs);
    }
  }

  throw new Error("External API request failed");
}

// แจ้งเตือนตัวอย่างผ่าน Console
// ยังไม่ได้ส่งอีเมลหรือ Push Notification จริง
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

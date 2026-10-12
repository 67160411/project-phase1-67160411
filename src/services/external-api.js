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
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`External API returned HTTP ${response.status}`);

      error.status = response.status;
      error.retryable = response.status >= 500;

      throw error;
    }

    return await response.json();
  } catch (error) {
    // Network error และ timeout สามารถ retry ได้
    if (error.status == null) {
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
}

module.exports = {
  getExternalTodo,
};

const API_URL = "/api/v1/tasks";
const DEFAULT_USER_ID = 1;

const taskForm = document.querySelector("#taskForm");
const taskList = document.querySelector("#taskList");
const listMessage = document.querySelector("#listMessage");
const formMessage = document.querySelector("#formMessage");
const submitButton = document.querySelector("#submitButton");
const submitLabel = document.querySelector("#submitLabel");
const apiStatus = document.querySelector("#apiStatus");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");

let tasks = [];
let editingTaskId = null;
let isSubmitting = false;

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  in_progress: "กำลังดำเนินการ",
  done: "เสร็จแล้ว",
};

const CATEGORY_LABELS = {
  1: "Project",
  2: "Homework",
  3: "General",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function showMessage(element, message, type = "info") {
  element.textContent = message;
  element.className = `notice ${type}`;
}

function hideMessage(element) {
  element.textContent = "";
  element.className = "notice hidden";
}

async function requestApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const rawText = await response.text();
  let body = {};

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      throw new Error("เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ใช่ JSON");
    }
  }

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        body?.message ||
        `เกิดข้อผิดพลาด HTTP ${response.status}`,
    );
  }

  return body;
}

function formatDate(value) {
  if (!value) return "ไม่ได้ระบุ";

  const dateText = String(value).slice(0, 10);
  const parts = dateText.split("-");

  if (parts.length !== 3) return dateText;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function setApiStatus(online) {
  apiStatus.textContent = online
    ? "● API เชื่อมต่อแล้ว"
    : "● เชื่อมต่อ API ไม่สำเร็จ";

  apiStatus.className = `api-status ${online ? "online" : "offline"}`;
}

function updateStats() {
  document.querySelector("#totalCount").textContent = tasks.length;

  document.querySelector("#pendingCount").textContent = tasks.filter(
    (task) => task.status === "pending",
  ).length;

  document.getElementById("inProgressCount").textContent = tasks.filter(
    (task) => task.status === "in_progress",
  ).length;

  document.querySelector("#doneCount").textContent = tasks.filter(
    (task) => task.status === "done",
  ).length;
}

function renderTasks() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  // 1. กรองรายการตามคำค้นหาและสถานะ
  const filteredTasks = tasks.filter((task) => {
    const matchesKeyword = String(task.title ?? "")
      .toLowerCase()
      .includes(keyword);

    const matchesStatus =
      selectedStatus === "all" || task.status === selectedStatus;

    return matchesKeyword && matchesStatus;
  });

  // 2. เรียงงานที่เสร็จแล้วไว้ล่างสุด
  //    งานที่ยังไม่เสร็จเรียงวันครบกำหนดจากใกล้ไปไกล
  filteredTasks.sort((a, b) => {
    const aDone = a.status === "done";
    const bDone = b.status === "done";

    // งานที่เสร็จแล้วอยู่ล่างสุดเสมอ
    if (aDone !== bDone) {
      return aDone ? 1 : -1;
    }

    // เรียงตามวันครบกำหนดจากน้อยไปมาก
    // งานที่ไม่มีวันครบกำหนดจะอยู่ท้ายกลุ่ม
    const aDate = a.due_date ? String(a.due_date).slice(0, 10) : "9999-12-31";

    const bDate = b.due_date ? String(b.due_date).slice(0, 10) : "9999-12-31";

    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }

    // ถ้าวันครบกำหนดตรงกัน ให้เรียงตาม ID
    return Number(a.id) - Number(b.id);
  });

  // 3. กรณีไม่พบงาน
  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-state">
        ไม่พบรายการงานที่ตรงกับเงื่อนไข<br>
        ลองเปลี่ยนคำค้นหา หรือเพิ่มงานใหม่
      </div>
    `;
    return;
  }

  // 4. แสดงรายการงาน
  taskList.innerHTML = filteredTasks
    .map((task) => {
      const id = Number(task.id);
      const title = escapeHtml(task.title);
      const description = escapeHtml(task.description || "ไม่มีรายละเอียด");

      const status =
        STATUS_LABELS[task.status] || task.status || "ไม่ทราบสถานะ";

      const statusClass = ["pending", "in_progress", "done"].includes(
        task.status,
      )
        ? task.status
        : "pending";

      const category =
        task.category_name ||
        (typeof task.category === "string"
          ? task.category
          : task.category?.name) ||
        `Category ID ${task.category_id ?? "-"}`;

      // ปุ่มเปลี่ยนสถานะตามสถานะปัจจุบัน
      const actionLabel =
        task.status === "pending"
          ? "ทำเครื่องหมายกำลังดำเนินการ"
          : task.status === "in_progress"
            ? "ทำเครื่องหมายว่าเสร็จ"
            : "";

      return `
        <article class="task-card">
          <div class="task-main">
            <h3 class="task-title">${title}</h3>

            <p class="task-description">${description}</p>

            <div class="task-meta">
              <span>หมวดหมู่: ${escapeHtml(category)}</span>
              <span>ครบกำหนด: ${formatDate(task.due_date)}</span>
            </div>

            <div style="margin-top: 12px">
              <span class="status-badge status-${statusClass}">
                ${escapeHtml(status)}
              </span>
            </div>
          </div>

          <div class="task-actions">
            <button
              type="button"
              class="button button-secondary"
              data-action="edit"
              data-id="${id}"
            >
              แก้ไข
            </button>

            ${
              task.status === "pending" || task.status === "in_progress"
                ? `
                  <button
                    type="button"
                    class="button button-secondary"
                    data-action="toggle"
                    data-id="${id}"
                  >
                    ${actionLabel}
                  </button>
                `
                : ""
            }

            <button
              type="button"
              class="button button-danger"
              data-action="delete"
              data-id="${id}"
            >
              ลบ
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadTasks() {
  taskList.innerHTML = '<div class="loading">กำลังโหลดรายการงาน...</div>';

  try {
    const result = await requestApi(API_URL);

    if (!Array.isArray(result.data)) {
      throw new Error("รูปแบบข้อมูลรายการงานไม่ถูกต้อง");
    }

    tasks = result.data;

    setApiStatus(true);
    updateStats();
    renderTasks();

    console.log(
      "จำนวนงานทั้งหมด:",
      tasks.length,
      "งานที่เสร็จแล้ว:",
      tasks.filter((task) => task.status === "done"),
    );
  } catch (error) {
    setApiStatus(false);

    taskList.innerHTML = `
      <div class="empty-state">
        โหลดรายการงานไม่สำเร็จ<br>
        กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงาน
      </div>
    `;

    showMessage(listMessage, error.message, "error");
  }
}

function validateTaskForm() {
  const title = document.querySelector("#title").value.trim();
  const dueDate = document.querySelector("#due_date").value;
  const categoryId = Number(document.querySelector("#category_id").value);
  const status = document.querySelector("#status").value;

  if (!title) {
    throw new Error("กรุณากรอกชื่องาน");
  }

  if (title.length > 255) {
    throw new Error("ชื่องานต้องไม่เกิน 255 ตัวอักษร");
  }

  if (
    !dueDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    Number.isNaN(Date.parse(dueDate))
  ) {
    throw new Error("กรุณาเลือกวันครบกำหนดที่ถูกต้อง");
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Category ID ต้องเป็นจำนวนเต็มบวก");
  }

  if (!Object.hasOwn(STATUS_LABELS, status)) {
    throw new Error("กรุณาเลือกสถานะที่ถูกต้อง");
  }

  return {
    title,
    description: document.querySelector("#description").value.trim(),
    due_date: dueDate,
    status,
    user_id: DEFAULT_USER_ID,
    category_id: categoryId,
  };
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (isSubmitting) return;

  isSubmitting = true;
  submitButton.disabled = true;
  submitLabel.textContent = "กำลังบันทึก...";

  hideMessage(formMessage);

  let payload;

  try {
    payload = validateTaskForm();
  } catch (error) {
    showMessage(formMessage, error.message, "error");
    isSubmitting = false;
    submitButton.disabled = false;
    submitLabel.textContent =
      editingTaskId !== null ? "บันทึกการแก้ไข" : "+ เพิ่มงาน";
    return;
  }

  const isEditing = editingTaskId !== null;

  try {
    const result = await requestApi(
      isEditing ? `${API_URL}/${editingTaskId}` : API_URL,
      {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );

    editingTaskId = null;
    taskForm.reset();

    showMessage(
      formMessage,
      result.message || (isEditing ? "แก้ไขงานสำเร็จ" : "เพิ่มงานสำเร็จ"),
      "success",
    );

    await loadTasks();
  } catch (error) {
    showMessage(formMessage, error.message, "error");
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
    submitLabel.textContent =
      editingTaskId !== null ? "บันทึกการแก้ไข" : "+ เพิ่มงาน";
  }
});

function startEditTask(task) {
  editingTaskId = Number(task.id);

  document.querySelector("#title").value = task.title ?? "";

  document.querySelector("#description").value = task.description ?? "";

  document.querySelector("#due_date").value = task.due_date
    ? String(task.due_date).slice(0, 10)
    : "";

  document.querySelector("#status").value = task.status ?? "pending";

  document.querySelector("#category_id").value = String(task.category_id ?? "");

  submitLabel.textContent = "บันทึกการแก้ไข";

  showMessage(formMessage, `กำลังแก้ไขงาน ID ${task.id}`, "info");

  taskForm.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

taskList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  const task = tasks.find((item) => Number(item.id) === id);

  if (!Number.isInteger(id) || id <= 0 || !task) {
    showMessage(listMessage, "ไม่พบข้อมูลงานที่เลือก", "error");
    return;
  }

  // แก้ไข: นำข้อมูลมาใส่ฟอร์ม
  if (action === "edit") {
    startEditTask(task);
    return;
  }

  if (button.disabled) return;

  button.disabled = true;
  hideMessage(listMessage);

  try {
    if (action === "toggle") {
      let nextStatus;

      if (task.status === "pending") {
        nextStatus = "in_progress";
      } else if (task.status === "in_progress") {
        nextStatus = "done";
      } else {
        showMessage(
          listMessage,
          "งานนี้เสร็จแล้วหรือมีสถานะที่ไม่รองรับ",
          "info",
        );
        return;
      }

      const result = await requestApi(`${API_URL}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      tasks = tasks.map((item) =>
        String(item.id) === String(id) ? { ...item, status: nextStatus } : item,
      );

      renderTasks();

      showMessage(
        listMessage,
        result.message ||
          `เปลี่ยนสถานะเป็น "${STATUS_LABELS[nextStatus]}" สำเร็จ`,
        "success",
      );
    } else if (action === "delete") {
      const confirmed = window.confirm(
        `ต้องการลบงาน "${task.title}" (ID ${id}) ใช่หรือไม่?`,
      );

      if (!confirmed) return;

      const result = await requestApi(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      await loadTasks();

      showMessage(listMessage, result.message || "ลบงานสำเร็จ", "success");
    }
  } catch (error) {
    showMessage(listMessage, error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refreshButton").addEventListener("click", loadTasks);

searchInput.addEventListener("input", renderTasks);
statusFilter.addEventListener("change", renderTasks);

taskForm.addEventListener("reset", () => {
  editingTaskId = null;
  submitLabel.textContent = "+ เพิ่มงาน";
  hideMessage(formMessage);

  window.setTimeout(setDefaultDueDate, 0);
});

function setDefaultDueDate() {
  const input = document.querySelector("#due_date");

  if (input.value) return;

  const now = new Date();

  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  input.value = localDate.toISOString().slice(0, 10);
}

setDefaultDueDate();
loadTasks();

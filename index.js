const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "MINI REST API พร้อมใช้งาน" });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});

let tasks = [
  { id: 1, title: "ทำ mini-rest-api", dueDate: "2026-08-01", status: "pending"},
  { id: 2, title: "ส่งรายงานวิชา api", dueDate: "2026-08-05", status: "done"}
];
let nextId = 3;

// 1. GET: ดึงรายการงานทั้งหมด
app.get("/api/v1/tasks", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: tasks });
});

// 2. GET: ดึงข้อมูลงาน id
app.get("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  res.status(200).json({ message: "สำเร็จ", data: task });
});

// 3. POST: เพิ่มข้อมูลงานใหม่
app.post("/api/v1/tasks", (req, res) => {
  const { title, dueDate, status } = req.body;

  if (!title || !dueDate || !status) {
    return res.status(400).json({
        error: {
            code: "MISSING_FIELDS",
            message: "กรุณาระบุ title, dueDate และ status ให้ครบถ้วน"
        }
    });
  }

  const duplicate = tasks.find((t) => t.title === title);

  if (duplicate) {
    return res.status(409).json({
      error: {
        code: "TASK_EXISTS",
        message: "มีชื่องานนี้อยู่แล้ว"
      }
    });
  }

  const newTask = { id: nextId++, title, dueDate, status };

  tasks.push(newTask);

  res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newTask });
});

// 4. PUT: แก้ไขข้อมูลงานทั้งระเบียน
app.put("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, dueDate, status } = req.body;
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  if (!title || !dueDate || !status) {
    return res
      .status(400)
      .json({ error: { code: "MISSING_FIELDS", message: "กรุณาระบุ title, dueDate และ status ให้ครบถ้วน" } });
  }

  task.title = title;
  task.dueDate = dueDate;
  task.status = status;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: task });
});

// 5. DELETE: ลบข้อมูลงาน
app.delete("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  tasks.splice(index, 1);

  res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

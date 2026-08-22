const express = require("express");
const app = express();
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const resolvers = require("./resolvers");
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ข้อมูลของผู้ใช้และงานที่ต้องทำ (ตัวอย่างข้อมูล)
let users = [
  { id: 1, name: "สมจิต", email: "somjit@example.com" },
  { id: 2, name: "สมชาย", email: "somchai@example.com" },
  { id: 3, name: "สมหญิง", email: "somying@example.com" },
];

let tasks = [
  {
    id: 1,
    title: "ทำ project-phase1",
    description: "ทำให้เสร็จภายในกำหนดเวลา",
    category: "Project",
    dueDate: "2026-08-01",
    status: "in_progress",
    userId: 1,
  },
  {
    id: 2,
    title: "ส่งรายงานวิชา api",
    description: "ค้นคว้าและเขียนรายงานวิชา api",
    category: "Project",
    dueDate: "2026-08-05",
    status: "pending",
    userId: 2,
  },
  {
    id: 3,
    title: "สรุปสอบวิชา api",
    description: "เตรียมตัวสอบวิชา api ให้พร้อม",
    category: "Homework",
    dueDate: "2026-07-18",
    status: "done",
    userId: 3,
  },
];

let nextTaskId = 4;
let nextUserId = 4;

// GraphQL Endpoint
app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: resolvers,
    graphiql: true,
  }),
);

// Root REST Endpoint
app.get("/", (req, res) => {
  res.status(200).json({ message: "project-phase1-67160411 พร้อมใช้งาน" });
});

// 1. GET: ดึงรายการงานทั้งหมด (รองรับ Query String ?category=...)
app.get("/api/v1/tasks", (req, res) => {
  const { category } = req.query;

  if (category) {
    const filteredTasks = tasks.filter(
      (t) => t.category.toLowerCase() === category.toLowerCase(),
    );
    return res.status(200).json({ message: "สำเร็จ", data: filteredTasks });
  }

  res.status(200).json({ message: "สำเร็จ", data: tasks });
});

// 2. GET: ดึงข้อมูลงานตาม id
app.get("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  res.status(200).json({ message: "สำเร็จ", data: task });
});

// 2.1 GET: ดึงข้อมูลงานพร้อมข้อมูลผู้ใช้
app.get("/api/v1/tasks/:id/full", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  const user = users.find((u) => u.id === task.userId);

  res.status(200).json({
    message: "สำเร็จ",
    data: { ...task, user: user || null },
  });
});

// 3. POST: เพิ่มข้อมูลงานใหม่
app.post("/api/v1/tasks", (req, res) => {
  const { title, description, category, dueDate, status, userId } = req.body;

  if (!title || !dueDate || !status || !userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message: "กรุณาระบุ title, dueDate, status และ userId ให้ครบถ้วน",
      },
    });
  }

  const duplicate = tasks.find((t) => t.title === title);
  if (duplicate) {
    return res.status(409).json({
      error: {
        code: "TASK_EXISTS",
        message: "มีชื่องานนี้อยู่แล้ว",
      },
    });
  }

  const userExists = users.find((u) => u.id === Number(userId));
  if (!userExists) {
    return res.status(404).json({
      error: {
        code: "USER_NOT_FOUND",
        message: "ไม่พบข้อมูลผู้ใช้",
      },
    });
  }

  const newTask = {
    id: nextTaskId++,
    title,
    description: description || "",
    category: category || "General",
    dueDate,
    status,
    userId: Number(userId),
  };

  tasks.push(newTask);

  res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newTask });
});

// 4. PUT: แก้ไขข้อมูลงานทั้งระเบียน
app.put("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, description, category, dueDate, status, userId } = req.body;
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ message: "ไม่พบข้อมูลงาน" });
  }

  if (!title || !dueDate || !status || !userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message: "กรุณาระบุ title, dueDate, status และ userId ให้ครบถ้วน",
      },
    });
  }

  task.title = title;
  task.description = description || "";
  task.category = category || "General";
  task.dueDate = dueDate;
  task.status = status;
  task.userId = Number(userId);

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: task });
});

// 4.1 PATCH: แก้ไขข้อมูลงานบางฟิลด์
app.patch("/api/v1/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "ไม่พบข้อมูลงาน",
      },
    });
  }

  const { title, description, category, dueDate, status, userId } = req.body;

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (category !== undefined) task.category = category;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (status !== undefined) task.status = status;
  if (userId !== undefined) task.userId = Number(userId);

  res.status(200).json({
    message: "แก้ไขข้อมูลงานสำเร็จ",
    data: task,
  });
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

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { graphqlHTTP } = require("express-graphql");

const pool = require("./db");

// นำเข้า GraphQL Schema และ Resolvers
const schema = require("./schema");
const resolvers = require("./resolvers");

const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งค่า Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

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

// ==========================================
// TASKS API ROUTES (MySQL)
// ==========================================

// 1. GET: ดึงรายการงานทั้งหมด (รองรับ ?category=...)
app.get("/api/v1/tasks", async (req, res, next) => {
  try {
    const { category } = req.query;
    let query = "SELECT * FROM tasks";
    let params = [];

    if (category) {
      query += " WHERE LOWER(category) = LOWER(?)";
      params.push(category);
    }

    const [rows] = await pool.query(query, params);
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. GET: ดึงข้อมูลงานตาม id (รองรับ ?include=user)
app.get("/api/v1/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const shouldIncludeUser = req.query.include === "user";

    let query = "SELECT * FROM tasks WHERE id = ?";
    if (shouldIncludeUser) {
      query = `
        SELECT t.*, 
               u.id AS user_id, u.name AS user_name, u.email AS user_email 
        FROM tasks t 
        LEFT JOIN users u ON t.userId = u.id 
        WHERE t.id = ?
      `;
    }

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" },
      });
    }

    let resultData = rows[0];

    // จัดโครงสร้าง response กรณีต้องการข้อมูล user
    if (shouldIncludeUser) {
      const { user_id, user_name, user_email, ...taskData } = rows[0];
      resultData = {
        ...taskData,
        user: user_id
          ? { id: user_id, name: user_name, email: user_email }
          : null,
      };
    }

    res.status(200).json({ message: "สำเร็จ", data: resultData });
  } catch (err) {
    next(err);
  }
});

// 3. POST: เพิ่มข้อมูลงานใหม่
app.post("/api/v1/tasks", async (req, res, next) => {
  const { title, description, category, dueDate, status, userId } = req.body;

  if (!title || !dueDate || !status || !userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message: "กรุณาระบุ title, dueDate, status และ userId ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO tasks (title, description, category, dueDate, status, userId) VALUES (?, ?, ?, ?, ?, ?)",
      [
        title,
        description || "",
        category || "General",
        dueDate,
        status,
        userId,
      ],
    );

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: {
        id: result.insertId,
        title,
        description: description || "",
        category: category || "General",
        dueDate,
        status,
        userId: Number(userId),
      },
    });
  } catch (err) {
    if (
      err.code === "ER_NO_REFERENCED_ROW_2" ||
      err.code === "ER_NO_REFERENCED_ROW"
    ) {
      return res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "ไม่พบข้อมูลผู้ใช้ในระบบ" },
      });
    }
    next(err);
  }
});

// 4. PUT: แก้ไขข้อมูลงานทั้งระเบียน
app.put("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const { title, description, category, dueDate, status, userId } = req.body;

  if (!title || !dueDate || !status || !userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message: "กรุณาระบุ title, dueDate, status และ userId ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "UPDATE tasks SET title = ?, description = ?, category = ?, dueDate = ?, status = ?, userId = ? WHERE id = ?",
      [
        title,
        description || "",
        category || "General",
        dueDate,
        status,
        userId,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" } });
    }

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: { id, title, description, category, dueDate, status, userId },
    });
  } catch (err) {
    next(err);
  }
});

// 4.1 PATCH: แก้ไขข้อมูลงานบางฟิลด์
app.patch("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const updates = req.body;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: { code: "NO_UPDATES", message: "กรุณาระบุข้อมูลที่ต้องการแก้ไข" },
    });
  }

  try {
    // สร้าง Dynamic Query สำหรับฟิลด์ที่ส่งมาแก้ไข
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });

    values.push(id); // สำหรับ WHERE id = ?

    const [result] = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" } });
    }

    const [updatedTask] = await pool.query("SELECT * FROM tasks WHERE id = ?", [
      id,
    ]);

    res.status(200).json({
      message: "แก้ไขข้อมูลงานสำเร็จ",
      data: updatedTask[0],
    });
  } catch (err) {
    next(err);
  }
});

// 5. DELETE: ลบข้อมูลงาน
app.delete("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  try {
    const [result] = await pool.query("DELETE FROM tasks WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" } });
    }

    res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------
// MIDDLEWARES
// ------------------------------------------

// 404: ไม่พบ route ที่ร้องขอ
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});

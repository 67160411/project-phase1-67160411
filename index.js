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

// 1. GET: ดึงรายการงานทั้งหมด (รองรับ ?category=... หรือ ?category_id=...)
app.get("/api/v1/tasks", async (req, res, next) => {
  try {
    const { category, category_id } = req.query;
    let query = `
      SELECT t.*, c.name AS category_name 
      FROM tasks t 
      LEFT JOIN categories c ON t.category_id = c.id
    `;
    let params = [];

    if (category) {
      query += " WHERE LOWER(c.name) = LOWER(?)";
      params.push(category);
    } else if (category_id) {
      query += " WHERE t.category_id = ?";
      params.push(category_id);
    }

    const [rows] = await pool.query(query, params);
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. GET: ดึงข้อมูลงานตาม id (รองรับ ?include=user,category)
app.get("/api/v1/tasks/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const query = `
      SELECT t.*, 
             u.id AS u_id, u.name AS u_name, u.email AS u_email,
             c.id AS c_id, c.name AS c_name, c.description AS c_description
      FROM tasks t 
      LEFT JOIN users u ON t.user_id = u.id 
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `;

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" },
      });
    }

    const row = rows[0];
    const taskData = {
      id: row.id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      status: row.status,
      user_id: row.user_id,
      category_id: row.category_id,
      created_at: row.created_at,
      user: row.u_id
        ? { id: row.u_id, name: row.u_name, email: row.u_email }
        : null,
      category: row.c_id
        ? { id: row.c_id, name: row.c_name, description: row.c_description }
        : null,
    };

    res.status(200).json({ message: "สำเร็จ", data: taskData });
  } catch (err) {
    next(err);
  }
});

// 3. POST: เพิ่มข้อมูลงานใหม่
app.post("/api/v1/tasks", async (req, res, next) => {
  const { title, description, due_date, status, user_id, category_id } =
    req.body;

  if (!title || !due_date || !status || !user_id || !category_id) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message:
          "กรุณาระบุ title, due_date, status, user_id และ category_id ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO tasks (title, description, due_date, status, user_id, category_id) VALUES (?, ?, ?, ?, ?, ?)",
      [title, description || "", due_date, status, user_id, category_id],
    );

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: {
        id: result.insertId,
        title,
        description: description || "",
        due_date,
        status,
        user_id: Number(user_id),
        category_id: Number(category_id),
      },
    });
  } catch (err) {
    if (
      err.code === "ER_NO_REFERENCED_ROW_2" ||
      err.code === "ER_NO_REFERENCED_ROW"
    ) {
      return res.status(404).json({
        error: {
          code: "FOREIGN_KEY_NOT_FOUND",
          message: "ไม่พบข้อมูล user_id หรือ category_id ที่อ้างอิงในระบบ",
        },
      });
    }
    next(err);
  }
});

// 4. PUT: แก้ไขข้อมูลงานทั้งระเบียน
app.put("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const { title, description, due_date, status, user_id, category_id } =
    req.body;

  if (!title || !due_date || !status || !user_id || !category_id) {
    return res.status(400).json({
      error: {
        code: "MISSING_FIELDS",
        message:
          "กรุณาระบุ title, due_date, status, user_id และ category_id ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ?, user_id = ?, category_id = ? WHERE id = ?",
      [title, description || "", due_date, status, user_id, category_id, id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลงาน" } });
    }

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: { id, title, description, due_date, status, user_id, category_id },
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
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });

    values.push(id);

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

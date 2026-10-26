require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { graphqlHTTP } = require("express-graphql");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("fs");
const path = require("path");

const pool = require("./db");
const schema = require("../schema");
const resolvers = require("../resolvers");

const {
  sendTaskNotification,
  getExternalTodo,
} = require("./services/external-api");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// SWAGGER / OPENAPI
// ==========================================

const openapiPath = path.join(__dirname, "..", "openapi.yaml");
const openapiFile = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiFile);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

// ==========================================
// FRONTEND
// ==========================================

app.use("/app", express.static(path.join(__dirname, "../frontend")));

app.get("/app", (req, res) => {
  res.redirect("/app/");
});

// ==========================================
// MIDDLEWARES
// ==========================================

app.use(helmet());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(morgan("dev"));

// JSON parser สำหรับ REST API และ GraphQL แบบ JSON
app.use(express.json({ limit: "10kb" }));

// Text parser สำหรับ GraphQL raw body: Content-Type: application/graphql
app.use(
  express.text({
    type: "application/graphql",
    limit: "10kb",
  }),
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isValidId(id) {
  return Number.isInteger(id) && id > 0;
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function handleDuplicateTitle(res, err) {
  if (err && err.code === "ER_DUP_ENTRY") {
    return sendError(
      res,
      409,
      "DUPLICATE_TASK_TITLE",
      "ชื่องานนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น",
    );
  }

  return null;
}

// Notification ต้องไม่ทำให้ API หลักล้มเหลว
async function notifySafely(task, event) {
  try {
    if (typeof sendTaskNotification !== "function") {
      throw new Error("sendTaskNotification is not a function");
    }

    return await sendTaskNotification(task, event);
  } catch (error) {
    console.error("Notification failed:", error.message);

    return {
      success: false,
      message: "บันทึกข้อมูลสำเร็จ แต่ส่งการแจ้งเตือนไม่สำเร็จ",
    };
  }
}

function isForeignKeyError(err) {
  return (
    err &&
    (err.code === "ER_NO_REFERENCED_ROW_2" ||
      err.code === "ER_NO_REFERENCED_ROW")
  );
}

function handleForeignKeyError(res, err) {
  if (isForeignKeyError(err)) {
    return sendError(
      res,
      404,
      "FOREIGN_KEY_NOT_FOUND",
      "ไม่พบข้อมูล user_id หรือ category_id ที่อ้างอิงในระบบ",
    );
  }

  return null;
}

// ==========================================
// GRAPHQL
// ==========================================

// express-graphql รองรับ body แบบ { query: "..." }.
// สำหรับ Content-Type: application/graphql ให้แปลงข้อความเป็น object ก่อน
app.use(
  "/graphql",
  (req, res, next) => {
    if (typeof req.body === "string") {
      req.body = { query: req.body };
    }
    next();
  },
  graphqlHTTP((req) => ({
    schema,
    rootValue: resolvers,
    graphiql: true,
    customFormatErrorFn: (error) => ({
      message: error.message,
      ...(error.locations ? { locations: error.locations } : {}),
      ...(error.path ? { path: error.path } : {}),
    }),
  })),
);

// ==========================================
// ROOT ENDPOINT
// ==========================================

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "project-phase1-67160411 พร้อมใช้งาน",
    endpoints: {
      tasks: "/api/v1/tasks",
      externalTodo: "/api/external/todo",
      graphql: "/graphql",
      swagger: "/api-docs",
      frontend: "/app/",
    },
  });
});

// ==========================================
// EXTERNAL API WITH RETRY / TIMEOUT / FALLBACK
// ==========================================

app.get("/api/external/todo", async (req, res) => {
  try {
    const result = await getExternalTodo();

    return res.status(200).json({
      message: "ดึงข้อมูลจาก External API สำเร็จ",
      ...result,
    });
  } catch (error) {
    console.error(
      "[Fallback] External API failed after retries:",
      error.message,
    );

    return res.status(200).json({
      message: "External API ไม่พร้อมใช้งาน ใช้ข้อมูลสำรองแทน",
      success: true,
      source: "fallback",
      warning: "ข้อมูลนี้เป็นข้อมูลสำรอง ไม่ใช่ข้อมูลสดจาก API",
      data: {
        userId: 1,
        id: 1,
        title: "ตัวอย่างข้อมูลสำรอง",
        completed: false,
      },
    });
  }
});

// ==========================================
// TASKS API
// ==========================================

// 1. GET: รายการงานทั้งหมด
// รองรับ ?category=ชื่อหมวดหมู่ หรือ ?category_id=1
app.get("/api/v1/tasks", async (req, res, next) => {
  try {
    const { category, category_id } = req.query;

    let query = `
      SELECT t.*, c.name AS category_name
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
    `;
    const params = [];

    if (category) {
      query += " WHERE LOWER(c.name) = LOWER(?)";
      params.push(category);
    } else if (category_id !== undefined) {
      const categoryId = Number(category_id);

      if (!isValidId(categoryId)) {
        return sendError(
          res,
          400,
          "INVALID_CATEGORY_ID",
          "category_id ต้องเป็นจำนวนเต็มบวก",
        );
      }

      query += " WHERE t.category_id = ?";
      params.push(categoryId);
    }

    query += " ORDER BY t.id ASC";

    const [rows] = await pool.query(query, params);

    return res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    return next(err);
  }
});

// 2. GET: งานตาม ID
app.get("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!isValidId(id)) {
    return sendError(res, 400, "INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก");
  }

  try {
    const query = `
      SELECT
        t.*,
        u.id AS u_id,
        u.name AS u_name,
        u.email AS u_email,
        c.id AS c_id,
        c.name AS c_name,
        c.description AS c_description
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `;

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลงาน");
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
        ? {
            id: row.c_id,
            name: row.c_name,
            description: row.c_description,
          }
        : null,
    };

    return res.status(200).json({ message: "สำเร็จ", data: taskData });
  } catch (err) {
    return next(err);
  }
});

// 3. POST: เพิ่มงานใหม่
app.post("/api/v1/tasks", async (req, res, next) => {
  const { title, description, due_date, status, user_id, category_id } =
    req.body || {};

  if (
    !title ||
    !String(title).trim() ||
    !due_date ||
    !status ||
    user_id === undefined ||
    user_id === null ||
    category_id === undefined ||
    category_id === null
  ) {
    return sendError(
      res,
      400,
      "MISSING_FIELDS",
      "กรุณาระบุ title, due_date, status, user_id และ category_id ให้ครบถ้วน",
    );
  }

  const userId = Number(user_id);
  const categoryId = Number(category_id);

  if (!isValidId(userId) || !isValidId(categoryId)) {
    return sendError(
      res,
      400,
      "INVALID_FOREIGN_KEY",
      "user_id และ category_id ต้องเป็นจำนวนเต็มบวก",
    );
  }

  try {
    const cleanTitle = String(title).trim();
    const cleanDescription = description || "";

    const [result] = await pool.query(
      `INSERT INTO tasks
        (title, description, due_date, status, user_id, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanTitle, cleanDescription, due_date, status, userId, categoryId],
    );

    const [rows] = await pool.query("SELECT * FROM tasks WHERE id = ?", [
      result.insertId,
    ]);

    const newTask = rows[0] || {
      id: result.insertId,
      title: cleanTitle,
      description: cleanDescription,
      due_date,
      status,
      user_id: userId,
      category_id: categoryId,
    };

    const notification = await notifySafely(newTask, "CREATED");

    return res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: newTask,
      notification,
    });
  } catch (err) {
    const duplicateResponse = handleDuplicateTitle(res, err);
    if (duplicateResponse) return duplicateResponse;

    const foreignKeyResponse = handleForeignKeyError(res, err);
    if (foreignKeyResponse) return foreignKeyResponse;

    return next(err);
  }
});

// 4. PUT: แก้ไขงานทั้งระเบียน
app.put("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!isValidId(id)) {
    return sendError(res, 400, "INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก");
  }

  const { title, description, due_date, status, user_id, category_id } =
    req.body || {};

  if (
    !title ||
    !String(title).trim() ||
    !due_date ||
    !status ||
    user_id === undefined ||
    user_id === null ||
    category_id === undefined ||
    category_id === null
  ) {
    return sendError(
      res,
      400,
      "MISSING_FIELDS",
      "กรุณาระบุ title, due_date, status, user_id และ category_id ให้ครบถ้วน",
    );
  }

  const userId = Number(user_id);
  const categoryId = Number(category_id);

  if (!isValidId(userId) || !isValidId(categoryId)) {
    return sendError(
      res,
      400,
      "INVALID_FOREIGN_KEY",
      "user_id และ category_id ต้องเป็นจำนวนเต็มบวก",
    );
  }

  try {
    const [result] = await pool.query(
      `UPDATE tasks
       SET title = ?, description = ?, due_date = ?, status = ?,
           user_id = ?, category_id = ?
       WHERE id = ?`,
      [
        String(title).trim(),
        description || "",
        due_date,
        status,
        userId,
        categoryId,
        id,
      ],
    );

    const [rows] = await pool.query("SELECT * FROM tasks WHERE id = ?", [id]);

    if (rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลงาน");
    }

    const updatedTask = rows[0];
    const notification =
      result.affectedRows > 0
        ? await notifySafely(updatedTask, "UPDATED")
        : { success: true, message: "ข้อมูลไม่มีการเปลี่ยนแปลง" };

    return res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: updatedTask,
      notification,
    });
  } catch (err) {
    const duplicateResponse = handleDuplicateTitle(res, err);
    if (duplicateResponse) return duplicateResponse;

    const foreignKeyResponse = handleForeignKeyError(res, err);
    if (foreignKeyResponse) return foreignKeyResponse;

    return next(err);
  }
});

// 5. PATCH: แก้ไขงานบางฟิลด์
app.patch("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const updates = req.body;

  if (!isValidId(id)) {
    return sendError(res, 400, "INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก");
  }

  if (
    !updates ||
    typeof updates !== "object" ||
    Array.isArray(updates) ||
    Object.keys(updates).length === 0
  ) {
    return sendError(res, 400, "NO_UPDATES", "กรุณาระบุข้อมูลที่ต้องการแก้ไข");
  }

  const allowedFields = [
    "title",
    "description",
    "due_date",
    "status",
    "user_id",
    "category_id",
  ];

  const fields = Object.keys(updates);
  const invalidFields = fields.filter(
    (field) => !allowedFields.includes(field),
  );

  if (invalidFields.length > 0) {
    return sendError(
      res,
      400,
      "INVALID_FIELDS",
      `ไม่อนุญาตให้แก้ไขฟิลด์: ${invalidFields.join(", ")}`,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, "title") &&
    (typeof updates.title !== "string" || !updates.title.trim())
  ) {
    return sendError(
      res,
      400,
      "INVALID_TITLE",
      "title ต้องเป็นข้อความที่ไม่ว่างเปล่า",
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, "user_id") &&
    !isValidId(Number(updates.user_id))
  ) {
    return sendError(
      res,
      400,
      "INVALID_USER_ID",
      "user_id ต้องเป็นจำนวนเต็มบวก",
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, "category_id") &&
    !isValidId(Number(updates.category_id))
  ) {
    return sendError(
      res,
      400,
      "INVALID_CATEGORY_ID",
      "category_id ต้องเป็นจำนวนเต็มบวก",
    );
  }

  try {
    const [existingRows] = await pool.query(
      "SELECT id FROM tasks WHERE id = ?",
      [id],
    );

    if (existingRows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลงาน");
    }

    const setClause = fields.map((field) => `\`${field}\` = ?`).join(", ");
    const values = fields.map((field) => {
      if (field === "title") return updates[field].trim();
      if (field === "user_id" || field === "category_id") {
        return Number(updates[field]);
      }
      return updates[field];
    });

    await pool.query(`UPDATE tasks SET ${setClause} WHERE id = ?`, [
      ...values,
      id,
    ]);

    const [updatedRows] = await pool.query("SELECT * FROM tasks WHERE id = ?", [
      id,
    ]);

    const updatedTask = updatedRows[0];
    const notification = await notifySafely(updatedTask, "PARTIALLY_UPDATED");

    return res.status(200).json({
      message: "แก้ไขข้อมูลงานสำเร็จ",
      data: updatedTask,
      notification,
    });
  } catch (err) {
    const duplicateResponse = handleDuplicateTitle(res, err);
    if (duplicateResponse) return duplicateResponse;

    const foreignKeyResponse = handleForeignKeyError(res, err);
    if (foreignKeyResponse) return foreignKeyResponse;

    return next(err);
  }
});

// 6. DELETE: ลบงานตาม ID
app.delete("/api/v1/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!isValidId(id)) {
    return sendError(res, 400, "INVALID_ID", "id ต้องเป็นจำนวนเต็มบวก");
  }

  try {
    const [result] = await pool.query("DELETE FROM tasks WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลงาน");
    }

    return res.status(200).json({
      message: "ลบข้อมูลสำเร็จ",
      data: { id },
    });
  } catch (err) {
    return next(err);
  }
});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  return sendError(res, 404, "ROUTE_NOT_FOUND", "ไม่พบเส้นทางที่ร้องขอ");
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error(err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    Object.prototype.hasOwnProperty.call(err, "body")
  ) {
    return sendError(res, 400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง");
  }

  const statusCode = err.status || err.statusCode || 500;

  return res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

// ==========================================
// START SERVER
// ==========================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`GraphQL: http://localhost:${PORT}/graphql`);
    console.log(`TaskFlow: http://localhost:${PORT}/app/`);
  });
}

module.exports = app;

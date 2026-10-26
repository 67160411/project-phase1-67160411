const pool = require("./db");

// แปลงข้อมูล Task จาก MySQL ให้ตรงกับ GraphQL Schema
function formatTask(row) {
  if (!row) return null;

  return {
    ...row,
    id: String(row.id),
    dueDate:
      row.dueDate instanceof Date
        ? row.dueDate.toISOString().slice(0, 10)
        : String(row.dueDate).slice(0, 10),
    userId: String(row.userId),
    categoryId: String(row.categoryId),
  };
}

// ดึงข้อมูล Task พร้อม User และ Category
async function getTaskWithRelations(task) {
  if (!task) return null;

  const [users] = await pool.query(
    `SELECT id, name, email
     FROM users
     WHERE id = ?`,
    [task.userId],
  );

  // ดึงเฉพาะ id และ name ของ Category
  const [categories] = await pool.query(
    `SELECT id, name
     FROM categories
     WHERE id = ?`,
    [task.categoryId],
  );

  return {
    ...formatTask(task),
    user: users[0]
      ? {
          ...users[0],
          id: String(users[0].id),
        }
      : null,
    category: categories[0]
      ? {
          ...categories[0],
          id: String(categories[0].id),
        }
      : null,
  };
}

const resolvers = {
  // ดึงงานตาม ID พร้อมข้อมูล User และ Category
  task: async ({ id }) => {
    const [rows] = await pool.query(
      `SELECT
         id,
         title,
         description,
         due_date AS dueDate,
         status,
         user_id AS userId,
         category_id AS categoryId
       FROM tasks
       WHERE id = ?`,
      [Number(id)],
    );

    return getTaskWithRelations(rows[0] ?? null);
  },

  // ดึงงานทั้งหมดพร้อมข้อมูล User และ Category
  tasks: async () => {
    const [rows] = await pool.query(
      `SELECT
         id,
         title,
         description,
         due_date AS dueDate,
         status,
         user_id AS userId,
         category_id AS categoryId
       FROM tasks
       ORDER BY id`,
    );

    return Promise.all(rows.map(getTaskWithRelations));
  },

  // ดึงผู้ใช้ตาม ID
  user: async ({ id }) => {
    const [rows] = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE id = ?`,
      [Number(id)],
    );

    if (!rows[0]) return null;

    return {
      ...rows[0],
      id: String(rows[0].id),
    };
  },

  // ดึงผู้ใช้ทั้งหมด
  users: async () => {
    const [rows] = await pool.query(
      `SELECT id, name, email
       FROM users
       ORDER BY id`,
    );

    return rows.map((user) => ({
      ...user,
      id: String(user.id),
    }));
  },

  // ดึงหมวดหมู่ตาม ID
  category: async ({ id }) => {
    const [rows] = await pool.query(
      `SELECT id, name
       FROM categories
       WHERE id = ?`,
      [Number(id)],
    );

    if (!rows[0]) return null;

    return {
      ...rows[0],
      id: String(rows[0].id),
    };
  },

  // ดึงหมวดหมู่ทั้งหมด
  categories: async () => {
    const [rows] = await pool.query(
      `SELECT id, name
       FROM categories
       ORDER BY id`,
    );

    return rows.map((category) => ({
      ...category,
      id: String(category.id),
    }));
  },
};

module.exports = resolvers;

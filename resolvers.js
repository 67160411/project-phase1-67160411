let users = [
  {
    id: 1,
    name: "สมจิต",
    email: "somjit@example.com",
  },
  {
    id: 2,
    name: "สมชาย",
    email: "somchai@example.com",
  },
  {
    id: 3,
    name: "สมหญิง",
    email: "somying@example.com",
  },
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

const resolvers = {
  // ดึงรายการงานตาม ID พร้อมข้อมูล User ที่ผูกกัน
  task: ({ id }, req) => {
    const task = tasks.find((t) => t.id === Number(id));
    if (!task) return null;

    const user = users.find((u) => u.id === task.userId);
    return { ...task, user };
  },

  // ดึงรายการงานทั้งหมด
  tasks: () => {
    return tasks.map((task) => {
      const user = users.find((u) => u.id === task.userId);
      return { ...task, user };
    });
  },

  // ดึงข้อมูล User ตาม ID
  user: ({ id }) => {
    return users.find((u) => u.id === Number(id));
  },

  // ดึงข้อมูล Users ทั้งหมด
  users: () => {
    return users;
  },
};

module.exports = resolvers;

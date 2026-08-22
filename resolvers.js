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

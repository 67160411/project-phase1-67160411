jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");
const resolvers = require("../resolvers");

const tasksData = [
  {
    id: 1,
    title: "ทำ project-phase1",
    description: "ทำโปรเจกต์",
    dueDate: "2026-11-15",
    status: "pending",
    userId: 1,
    categoryId: 1,
  },
  {
    id: 2,
    title: "งานของสมชาย",
    description: "ทดสอบระบบ",
    dueDate: "2026-11-20",
    status: "in_progress",
    userId: 2,
    categoryId: 2,
  },
  {
    id: 3,
    title: "งานของสมหญิง",
    description: "ตรวจสอบงาน",
    dueDate: "2026-11-25",
    status: "done",
    userId: 3,
    categoryId: 1,
  },
];

const usersData = [
  { id: 1, name: "สมจิต", email: "somjit@example.com" },
  { id: 2, name: "สมชาย", email: "somchai@example.com" },
  { id: 3, name: "สมหญิง", email: "somying@example.com" },
];

const categoriesData = [
  { id: 1, name: "Project" },
  {
    id: 2,
    name: "Homework",
    description: "การบ้านและงานที่ได้รับมอบหมาย",
  },
];

function mockDatabase() {
  pool.query.mockImplementation(async (sql, params = []) => {
    const query = sql.replace(/\s+/g, " ").trim();

    if (query.includes("FROM tasks") && query.includes("WHERE id = ?")) {
      const task = tasksData.find((item) => item.id === Number(params[0]));
      return [[...(task ? [task] : [])]];
    }

    if (query.includes("FROM tasks")) {
      return [[...tasksData]];
    }

    if (query.includes("FROM users") && query.includes("WHERE id = ?")) {
      const user = usersData.find((item) => item.id === Number(params[0]));
      return [[...(user ? [user] : [])]];
    }

    if (query.includes("FROM users")) {
      return [[...usersData]];
    }

    if (query.includes("FROM categories") && query.includes("WHERE id = ?")) {
      const category = categoriesData.find(
        (item) => item.id === Number(params[0]),
      );
      return [[...(category ? [category] : [])]];
    }

    if (query.includes("FROM categories")) {
      return [[...categoriesData]];
    }

    throw new Error(`Unexpected SQL query: ${query}`);
  });
}

describe("GraphQL Resolvers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase();
  });

  test("tasks returns all tasks with associated users and categories", async () => {
    const result = await resolvers.tasks();

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("ทำ project-phase1");
    expect(result[0].user.name).toBe("สมจิต");
    expect(result[1].user.name).toBe("สมชาย");
    expect(result[2].user.name).toBe("สมหญิง");
    expect(result[0].category.name).toBe("Project");
  });

  test("task returns a task by ID with its relations", async () => {
    const result = await resolvers.task({ id: 1 });

    expect(result).not.toBeNull();
    expect(result.title).toBe("ทำ project-phase1");
    expect(result.user.email).toBe("somjit@example.com");
    expect(result.category.name).toBe("Project");
    expect(result.id).toBe("1");
  });

  test("task returns null when ID does not exist", async () => {
    const result = await resolvers.task({ id: 999 });

    expect(result).toBeNull();
  });

  test("user returns a user by ID", async () => {
    const result = await resolvers.user({ id: 2 });

    expect(result.name).toBe("สมชาย");
    expect(result.email).toBe("somchai@example.com");
    expect(result.id).toBe("2");
  });

  test("user returns null when ID does not exist", async () => {
    expect(await resolvers.user({ id: 999 })).toBeNull();
  });

  test("users returns all users", async () => {
    const result = await resolvers.users();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("สมจิต");
  });

  test("category returns a category by ID", async () => {
    const result = await resolvers.category({ id: 2 });

    expect(result.name).toBe("Homework");
    expect(result.id).toBe("2");
  });

  test("category returns null when ID does not exist", async () => {
    expect(await resolvers.category({ id: 999 })).toBeNull();
  });

  test("categories returns all categories", async () => {
    const result = await resolvers.categories();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Project");
    expect(result[1].name).toBe("Homework");
  });

  test("task has null user when related user is missing", async () => {
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM tasks")) {
        return [[tasksData[0]]];
      }
      return [[]];
    });

    const result = await resolvers.task({ id: 1 });

    expect(result.user).toBeNull();
    expect(result.category).toBeNull();
  });

  test("task formats a Date dueDate as YYYY-MM-DD", async () => {
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM tasks")) {
        return [
          [{ ...tasksData[0], dueDate: new Date("2026-11-15T00:00:00Z") }],
        ];
      }
      if (sql.includes("FROM users")) {
        return [[usersData[0]]];
      }
      if (sql.includes("FROM categories")) {
        return [[categoriesData[0]]];
      }
      return [[]];
    });

    const result = await resolvers.task({ id: 1 });

    expect(result.dueDate).toBe("2026-11-15");
  });
});

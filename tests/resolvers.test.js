const resolvers = require("../resolvers");

describe("GraphQL Resolvers", () => {
  test("tasks returns all tasks with associated users", () => {
    const result = resolvers.tasks();

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("ทำ project-phase1");
    expect(result[0].user.name).toBe("สมจิต");
    expect(result[1].user.name).toBe("สมชาย");
    expect(result[2].user.name).toBe("สมหญิง");
  });

  test("task returns a task by ID with its user", () => {
    const result = resolvers.task({ id: 1 });

    expect(result).not.toBeNull();
    expect(result.title).toBe("ทำ project-phase1");
    expect(result.user.email).toBe("somjit@example.com");
  });

  test("task returns null when ID does not exist", () => {
    const result = resolvers.task({ id: 999 });

    expect(result).toBeNull();
  });

  test("user returns a user by ID", () => {
    const result = resolvers.user({ id: 2 });

    expect(result.name).toBe("สมชาย");
    expect(result.email).toBe("somchai@example.com");
  });

  test("users returns all users", () => {
    const result = resolvers.users();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("สมจิต");
  });

  test("category returns a category by ID", () => {
    const result = resolvers.category({ id: 2 });

    expect(result.name).toBe("Homework");
    expect(result.description).toBe("การบ้านและงานที่ได้รับมอบหมาย");
  });

  test("category returns null when ID does not exist", () => {
    const result = resolvers.category({ id: 999 });

    expect(result).toBeNull();
  });

  test("categories returns all categories", () => {
    const result = resolvers.categories();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Project");
    expect(result[1].name).toBe("Homework");
  });
});

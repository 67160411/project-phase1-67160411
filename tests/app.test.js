jest.mock("../db", () => ({
  query: jest.fn(),
}));

jest.mock("../src/services/external-api", () => ({
  sendTaskNotification: jest.fn().mockResolvedValue({
    success: true,
    message: "Notification logged successfully",
  }),
  getExternalTodo: jest.fn().mockResolvedValue({
    success: true,
    source: "external-api",
    data: {
      userId: 1,
      id: 1,
      title: "Test todo",
      completed: false,
    },
  }),
}));

const request = require("supertest");
const pool = require("../db");
const { getExternalTodo } = require("../src/services/external-api");
const app = require("../src/index");

describe("TaskFlow API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET / returns 200 and endpoint information", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.endpoints.tasks).toBe("/api/v1/tasks");
  });

  test("GET /api/v1/tasks returns task list", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          title: "Test task",
          status: "pending",
          category_name: "Study",
        },
      ],
    ]);

    const response = await request(app).get("/api/v1/tasks");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Test task");
  });

  test("GET /api/v1/tasks rejects invalid category_id", async () => {
    const response = await request(app)
      .get("/api/v1/tasks")
      .query({ category_id: "abc" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CATEGORY_ID");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("GET /api/v1/tasks/:id rejects invalid ID", async () => {
    const response = await request(app).get("/api/v1/tasks/abc");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ID");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("GET /api/v1/tasks/:id returns 404 when task does not exist", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app).get("/api/v1/tasks/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("POST /api/v1/tasks rejects missing fields", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .send({ title: "Incomplete task" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MISSING_FIELDS");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("PATCH /api/v1/tasks/:id rejects empty updates", async () => {
    const response = await request(app).patch("/api/v1/tasks/1").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("NO_UPDATES");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("DELETE /api/v1/tasks/:id returns 404 for missing task", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const response = await request(app).delete("/api/v1/tasks/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  test("GET /api/external/todo returns external data", async () => {
    const response = await request(app).get("/api/external/todo");

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("external-api");
    expect(response.body.data.title).toBe("Test todo");
    expect(getExternalTodo).toHaveBeenCalledTimes(1);
  });

  test("GET unknown route returns 404", async () => {
    const response = await request(app).get("/route-does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  test("POST /api/v1/tasks creates a task", async () => {
    pool.query
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockResolvedValueOnce([
        [
          {
            id: 101,
            title: "Jest test task",
            description: "Created by automated test",
            due_date: "2026-11-15",
            status: "pending",
            user_id: 3,
            category_id: 2,
          },
        ],
      ]);

    const response = await request(app).post("/api/v1/tasks").send({
      title: "Jest test task",
      description: "Created by automated test",
      due_date: "2026-11-15",
      status: "pending",
      user_id: 3,
      category_id: 2,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(101);
    expect(response.body.data.title).toBe("Jest test task");
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("PUT /api/v1/tasks/:id updates an existing task", async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            id: 101,
            title: "Updated Jest task",
            description: "Updated by automated test",
            due_date: "2026-11-20",
            status: "done",
            user_id: 3,
            category_id: 2,
          },
        ],
      ]);

    const response = await request(app).put("/api/v1/tasks/101").send({
      title: "Updated Jest task",
      description: "Updated by automated test",
      due_date: "2026-11-20",
      status: "done",
      user_id: 3,
      category_id: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Updated Jest task");
    expect(response.body.data.status).toBe("done");
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("PATCH /api/v1/tasks/:id updates selected fields", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 101 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [
          {
            id: 101,
            title: "Updated by PATCH",
            status: "done",
          },
        ],
      ]);

    const response = await request(app)
      .patch("/api/v1/tasks/101")
      .send({ title: "Updated by PATCH", status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Updated by PATCH");
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test("DELETE /api/v1/tasks/:id deletes an existing task", async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app).delete("/api/v1/tasks/101");

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(101);
  });

  test("POST /api/v1/tasks returns 409 for duplicate title", async () => {
    const duplicateError = new Error("Duplicate entry");
    duplicateError.code = "ER_DUP_ENTRY";
    pool.query.mockRejectedValueOnce(duplicateError);

    const response = await request(app).post("/api/v1/tasks").send({
      title: "Duplicate task",
      description: "Test duplicate handling",
      due_date: "2026-11-15",
      status: "pending",
      user_id: 3,
      category_id: 2,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_TASK_TITLE");
  });

  test("GET /api/v1/tasks/:id returns an existing task", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: 101,
          title: "Existing Jest task",
          description: "Test task",
          due_date: "2026-11-15",
          status: "pending",
          user_id: 3,
          category_id: 2,
        },
      ],
    ]);

    const response = await request(app).get("/api/v1/tasks/101");

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(101);
    expect(response.body.data.title).toBe("Existing Jest task");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/external/todo returns fallback when external API fails", async () => {
    const { getExternalTodo } = require("../src/services/external-api");

    getExternalTodo.mockRejectedValueOnce(
      new Error("External API unavailable"),
    );

    const response = await request(app).get("/api/external/todo");

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("fallback");
  });

  test("GET /api/v1/tasks handles database errors", async () => {
    pool.query.mockRejectedValueOnce(new Error("Database connection failed"));

    const response = await request(app).get("/api/v1/tasks");

    expect(response.status).toBe(500);
  });

  describe("GraphQL API", () => {
    test("GET /graphql without query returns a client error", async () => {
      const response = await request(app).get("/graphql");

      expect(response.status).toBe(400);
    });

    test("POST /graphql returns tasks", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              id: 101,
              title: "GraphQL test task",
              description: "Test task",
              dueDate: "2026-11-15",
              status: "pending",
              userId: 3,
              categoryId: 2,
            },
          ],
        ])
        .mockResolvedValueOnce([
          [{ id: 3, name: "Test User", email: "test@example.com" }],
        ])
        .mockResolvedValueOnce([[{ id: 2, name: "Study" }]]);

      const response = await request(app)
        .post("/graphql")
        .send({
          query: `
      {
        tasks {
          id
          title
          status
        }
      }
    `,
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data).toHaveProperty("tasks");
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
      expect(response.body.data.tasks[0].title).toBe("GraphQL test task");
    });

    test("POST /graphql returns a GraphQL error for an unknown field", async () => {
      const response = await request(app).post("/graphql").send({
        query: "{ unknownField }",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });
  });
});

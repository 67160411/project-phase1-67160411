const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Category {
    id: ID!
    name: String!
    description: String
  }

  type Task {
    id: ID!
    title: String!
    description: String
    dueDate: String!
    status: String!
    userId: ID!
    categoryId: ID!
    user: User
    category: Category
  }

  type Query {
    task(id: ID!): Task
    tasks: [Task!]!
    user(id: ID!): User
    users: [User!]!
    category(id: ID!): Category
    categories: [Category!]!
  }
`);

module.exports = schema;

const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Task {
    id: ID!
    title: String!
    description: String!
    category: String!
    dueDate: String!
    status: String!
    userId: ID!
    user: User
  }

  type Query {
    task(id: ID!): Task
    tasks: [Task!]!
    user(id: ID!): User
    users: [User!]!
  }
`);

module.exports = schema;
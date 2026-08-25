require("dotenv").config();
const { CreateTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { client, Tables } = require("./db");

const tableDefs = [
  {
    TableName: Tables.USERS,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "username", AttributeType: "S" },
      { AttributeName: "employee_code", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "username-index",
        KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "employeeCode-index",
        KeySchema: [{ AttributeName: "employee_code", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: Tables.TASKS,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "category", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "category-index",
        KeySchema: [{ AttributeName: "category", KeyType: "HASH" }, { AttributeName: "id", KeyType: "RANGE" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: Tables.USER_TASKS,
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "taskId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "taskId", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "taskId-index",
        KeySchema: [{ AttributeName: "taskId", KeyType: "HASH" }, { AttributeName: "userId", KeyType: "RANGE" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: Tables.COMPLETIONS,
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "taskId_periodKey", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "taskId_periodKey", AttributeType: "S" },
      { AttributeName: "periodKey", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "periodKey-index",
        KeySchema: [{ AttributeName: "periodKey", KeyType: "HASH" }, { AttributeName: "userId", KeyType: "RANGE" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: Tables.REVIEW_CHECKS,
    KeySchema: [
      { AttributeName: "periodKey", KeyType: "HASH" },
      { AttributeName: "cat_loc_task", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "periodKey", AttributeType: "S" },
      { AttributeName: "cat_loc_task", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: Tables.ISSUES,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: Tables.VISITORS,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: Tables.CHECKLIST_PHOTOS,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "userPeriod", AttributeType: "S" },
      { AttributeName: "category", AttributeType: "S" },
      { AttributeName: "periodKey", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "userPeriod-index",
        KeySchema: [{ AttributeName: "userPeriod", KeyType: "HASH" }, { AttributeName: "category", KeyType: "RANGE" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "periodKey-index",
        KeySchema: [{ AttributeName: "periodKey", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: Tables.ALERTS,
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "id", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "id", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: Tables.ERROR_LOGS,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "level", AttributeType: "S" },
      { AttributeName: "created_at", AttributeType: "S" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "level-index",
        KeySchema: [
          { AttributeName: "level", KeyType: "HASH" },
          { AttributeName: "created_at", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
];

async function initDb() {
  const { TableNames: existing } = await client.send(new ListTablesCommand({}));

  for (const def of tableDefs) {
    if (existing.includes(def.TableName)) {
      console.log(`Table ${def.TableName} already exists — skipping.`);
      continue;
    }
    await client.send(new CreateTableCommand(def));
    console.log(`Created table ${def.TableName}`);
  }

  console.log("All DynamoDB tables ready.");
}

initDb().catch((err) => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});

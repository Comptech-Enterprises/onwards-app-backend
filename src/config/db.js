const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const config = {
  region: process.env.AWS_REGION || "ap-south-1",
};

if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
  };
}

const client = new DynamoDBClient(config);
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_PREFIX = process.env.TABLE_PREFIX || "onwards_";

const Tables = {
  USERS: `${TABLE_PREFIX}users`,
  TASKS: `${TABLE_PREFIX}tasks`,
  USER_TASKS: `${TABLE_PREFIX}user_tasks`,
  COMPLETIONS: `${TABLE_PREFIX}completions`,
  REVIEW_CHECKS: `${TABLE_PREFIX}review_checks`,
  ISSUES: `${TABLE_PREFIX}issues`,
  VISITORS: `${TABLE_PREFIX}visitors`,
  CHECKLIST_PHOTOS: `${TABLE_PREFIX}checklist_photos`,
  ALERTS: `${TABLE_PREFIX}alerts`,
  ERROR_LOGS: `${TABLE_PREFIX}error_logs`,
};

module.exports = { docClient, client, Tables };

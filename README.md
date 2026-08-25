# Onwards Workspaces — Backend API

Operations management backend for Onwards coworking spaces. Handles daily checklists, task tracking, visitor logs, issue reporting, photo uploads, and summary reports.

## Tech Stack

- **Runtime:** Node.js + Express 5
- **Database:** AWS DynamoDB (on-demand billing)
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **File Uploads:** Multer
- **Email:** Nodemailer (SMTP)

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm run db:init         # create DynamoDB tables
npm run db:seed         # seed users + tasks
npm run dev             # start dev server (port 4000)
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 4000) |
| `AWS_REGION` | DynamoDB region |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `DYNAMODB_ENDPOINT` | Local DynamoDB URL (omit for real AWS) |
| `TABLE_PREFIX` | Table name prefix (default: `onwards_`) |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `APP_TIMEZONE` | Process timezone (default: `Asia/Kolkata`) |
| `SMTP_USER` | SMTP email address |
| `SMTP_PASS` | SMTP app password |
| `SUMMARY_TO` | Summary email recipient |
| `NOTIFY_DEADLINE` | Daily deadline time (HH:MM) |
| `SUMMARY_AT` | Daily summary time (HH:MM) |

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/` | Hello world |
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login, returns JWT |

### Authenticated (Bearer token required)

**Users**
| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user (manager only) |
| PUT | `/api/users/:id` | Update user (manager only) |
| DELETE | `/api/users/:id` | Delete user (manager only) |

**Tasks**
| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task (manager only) |
| PUT | `/api/tasks/:id` | Update task (manager only) |
| DELETE | `/api/tasks/:id` | Delete task (manager only) |

**Completions**
| Method | Path | Description |
|---|---|---|
| GET | `/api/completions/my` | My completions for today |
| GET | `/api/completions/user/:userId` | User's completions |
| GET | `/api/completions/all` | All completions (manager) |
| POST | `/api/completions/toggle/:taskId` | Mark task done |

**Reviews**
| Method | Path | Description |
|---|---|---|
| GET | `/api/reviews` | Get review checks |
| POST | `/api/reviews` | Submit review check (manager) |

**Issues**
| Method | Path | Description |
|---|---|---|
| GET | `/api/issues` | List issues |
| POST | `/api/issues` | Report issue |
| PUT | `/api/issues/:id` | Update issue |

**Visitors**
| Method | Path | Description |
|---|---|---|
| GET | `/api/visitors` | List visitors |
| POST | `/api/visitors` | Log visitor |

**Photos**
| Method | Path | Description |
|---|---|---|
| GET | `/api/photos/my` | My photos |
| GET | `/api/photos/all` | All photos (manager) |
| POST | `/api/photos` | Upload photo |
| DELETE | `/api/photos/:photoId` | Delete photo |

**Alerts**
| Method | Path | Description |
|---|---|---|
| GET | `/api/alerts` | My alerts |
| POST | `/api/alerts` | Create alert |

**Summary**
| Method | Path | Description |
|---|---|---|
| GET | `/api/summary` | Daily completion summary |

**Error Logs**
| Method | Path | Description |
|---|---|---|
| GET | `/api/error-logs` | View error logs (manager only) |

## Roles

- **manager** — full access: CRUD users, tasks, reviews, view all data
- **employee** — complete tasks, report issues, log visitors, upload photos

## Project Structure

```
src/
  config/
    db.js          # DynamoDB client + table names
    initDb.js      # Create tables
    seed.js        # Seed data
  controllers/     # Route handlers
  middleware/
    auth.js        # JWT authentication
    upload.js      # Multer config
  routes/          # Express routers
  server.js        # App entry point
```

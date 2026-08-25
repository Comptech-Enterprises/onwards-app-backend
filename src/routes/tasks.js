const { Router } = require("express");
const { listTasks, getTasksByUser, getTasksByCategory, createTask, updateTask, deleteTask, assignTask, unassignTask } = require("../controllers/taskController");
const { authenticate, requireManager } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, listTasks);
router.get("/my", authenticate, getTasksByUser);
router.get("/user/:userId", authenticate, getTasksByUser);
router.get("/category/:category", authenticate, getTasksByCategory);
router.post("/", authenticate, requireManager, createTask);
router.put("/:taskId", authenticate, requireManager, updateTask);
router.delete("/:taskId", authenticate, requireManager, deleteTask);
router.post("/:taskId/assign", authenticate, requireManager, assignTask);
router.delete("/:taskId/assign/:userId", authenticate, requireManager, unassignTask);

module.exports = router;

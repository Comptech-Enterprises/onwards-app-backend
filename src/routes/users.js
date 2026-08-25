const { Router } = require("express");
const { listUsers, listEmployees, createUser, deleteUser } = require("../controllers/userController");
const { authenticate, requireManager } = require("../middleware/auth");

const router = Router();

router.get("/", authenticate, listUsers);
router.get("/employees", authenticate, listEmployees);
router.post("/", authenticate, requireManager, createUser);
router.delete("/:userId", authenticate, requireManager, deleteUser);

module.exports = router;

const { Router } = require("express");
const { listIssues, createIssue, updateIssueStatus, deleteIssue } = require("../controllers/issueController");
const { authenticate, requireManager } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = Router();

router.get("/", authenticate, listIssues);
router.post("/", authenticate, upload.single("photo"), createIssue);
router.patch("/:issueId/status", authenticate, requireManager, updateIssueStatus);
router.delete("/:issueId", authenticate, deleteIssue);

module.exports = router;

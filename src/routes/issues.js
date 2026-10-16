const { Router } = require("express");
const {
  listIssues,
  createIssue,
  updateIssueProgress,
  updateIssueStatus,
  deleteIssue,
} = require("../controllers/issueController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = Router();

router.get("/", authenticate, listIssues);
router.post("/", authenticate, upload.single("photo"), createIssue);
router.patch("/:issueId/progress", authenticate, updateIssueProgress);
router.patch("/:issueId/status", authenticate, updateIssueStatus);
router.delete("/:issueId", authenticate, deleteIssue);

module.exports = router;

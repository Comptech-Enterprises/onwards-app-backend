const { Router } = require("express");
const { getPhotos, getAllPhotos, uploadPhoto, deletePhoto, clearPhotos } = require("../controllers/photoController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = Router();

router.get("/my", authenticate, getPhotos);
router.get("/user/:userId", authenticate, getPhotos);
router.get("/all", authenticate, getAllPhotos);
router.post("/", authenticate, upload.single("photo"), uploadPhoto);
router.delete("/my", authenticate, clearPhotos);
router.delete("/user/:userId", authenticate, clearPhotos);
router.delete("/:photoId", authenticate, deletePhoto);

module.exports = router;

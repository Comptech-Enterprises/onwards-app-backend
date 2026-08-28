const { Router } = require("express");

const router = Router();

router.get("/version", (req, res) => {
  res.json({
    minVersionAndroid: process.env.MIN_VERSION_ANDROID || "1.0",
    minVersionIos: process.env.MIN_VERSION_IOS || "1.0",
    storeUrlAndroid: process.env.STORE_URL_ANDROID || "",
    storeUrlIos: process.env.STORE_URL_IOS || "",
  });
});

module.exports = router;

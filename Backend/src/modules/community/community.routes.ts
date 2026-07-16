import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { postCreateLimiter, commentCreateLimiter } from "../../middlewares/community-rate-limit.middleware";
import { communityController } from "./community.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

// Communities
router.post("/", communityController.createCommunity);
router.get("/discover", communityController.discover);
router.get("/search", communityController.search);
router.get("/:id", communityController.getCommunity);
router.post("/:id/join", communityController.join);
router.post("/:id/leave", communityController.leave);

// Feed & posts
router.get("/feed/list", communityController.getFeed);
router.post("/posts", postCreateLimiter, upload.array("media", 5), communityController.createPost);
router.get("/posts/:id", communityController.getPost);
router.delete("/posts/:id", communityController.deletePost);
router.post("/posts/:id/reactions", communityController.reactToPost);
router.post("/posts/:id/comments", commentCreateLimiter, communityController.createComment);
router.get("/posts/:id/comments", communityController.listComments);

// Comments
router.post("/comments/:id/reactions", communityController.reactToComment);

// Follow
router.post("/follow/:customerId", communityController.follow);
router.delete("/follow/:customerId", communityController.unfollow);

// Moderation
router.post("/report", communityController.report);

export const communityRoutes = router;

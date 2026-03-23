import { Router } from "express";
import { supportController } from "./support.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/tickets", supportController.getTickets);
router.post("/tickets", supportController.createTicket);
router.get("/tickets/:ticketId", supportController.getTicket);
router.post("/tickets/:ticketId/messages", supportController.addMessage);

router.get("/faqs", supportController.getFaqs);
router.get("/chat-flow", supportController.getChatFlow);
router.get("/info", supportController.getSupportInfo);

export { router as supportRoutes };

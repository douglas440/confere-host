import express from "express";
import {
  login,
  verificarSessao,
} from "../controllers/authController.js";
import { autenticar } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/sessao", autenticar, verificarSessao);

export default router;

import express from "express";
import { login, sessao } from "../controllers/authController.js";
import { autenticar } from "../middlewares/autenticacao.js";

const router = express.Router();
router.post("/login", login);
router.get("/sessao", autenticar, sessao);
export default router;

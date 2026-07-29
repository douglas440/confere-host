import express from "express";
import multer from "multer";
import { autenticar } from "../middlewares/autenticacao.js";
import { atualizarFatorProduto, atualizarFatoresProdutos, buscarProdutosPorCodigos, importarProdutos, listarProdutos } from "../controllers/produtoController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter(req, file, callback) {
  const nome = file.originalname.toLowerCase();
  return nome.endsWith(".xls") || nome.endsWith(".xlsx") || nome.endsWith(".csv") ? callback(null, true) : callback(new Error("Envie um arquivo XLS, XLSX ou CSV."));
}});
router.use(autenticar);
router.get("/", listarProdutos);
router.post("/importar", upload.single("arquivo"), importarProdutos);
router.post("/buscar-codigos", buscarProdutosPorCodigos);
router.patch("/fatores", atualizarFatoresProdutos);
router.patch("/:id/fator", atualizarFatorProduto);
export default router;

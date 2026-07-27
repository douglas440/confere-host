import express from "express";
import multer from "multer";
import { autenticar } from "../middlewares/authMiddleware.js";

import {
  atualizarFatorProduto,
  atualizarFatoresProdutos,
  buscarProdutosPorCodigos,
  importarProdutos,
  listarProdutos,
} from "../controllers/produtoController.js";

const router = express.Router();

router.use(autenticar);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const nomeArquivo = file.originalname.toLowerCase();

    const extensaoPermitida =
      nomeArquivo.endsWith(".xls") ||
      nomeArquivo.endsWith(".xlsx") ||
      nomeArquivo.endsWith(".csv");

    if (!extensaoPermitida) {
      return callback(
        new Error("Envie um arquivo XLS, XLSX ou CSV.")
      );
    }

    return callback(null, true);
  },
});

router.get("/", listarProdutos);

router.post(
  "/importar",
  upload.single("arquivo"),
  importarProdutos
);

router.post(
  "/buscar-codigos",
  buscarProdutosPorCodigos
);

router.patch("/fatores", atualizarFatoresProdutos);

router.patch("/:id/fator", atualizarFatorProduto);

export default router;
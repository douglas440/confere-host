import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pool from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import produtoRoutes from "./routes/produtoRoutes.js";
import conferenciaRoutes from "./routes/conferenciaRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.json({
      sucesso: true,
      mensagem: "API funcionando!",
      banco: "Conectado",
    });
  } catch (error) {
    console.error("Erro de conexão com o banco:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar com o banco de dados.",
      erro: error.message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtoRoutes);
app.use("/api/conferencias", conferenciaRoutes);

app.use((req, res) => {
  return res.status(404).json({
    sucesso: false,
    mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("Erro no servidor:", error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      sucesso: false,
      mensagem:
        "O arquivo ou a conferência enviada é muito grande.",
    });
  }

  return res.status(500).json({
    sucesso: false,
    mensagem: error.message || "Erro interno no servidor.",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
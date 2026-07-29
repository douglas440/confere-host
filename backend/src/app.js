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

const origensPermitidas = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || origensPermitidas.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não autorizada pelo CORS."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "20mb" }));

app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ sucesso: true, mensagem: "API funcionando!", banco: "PostgreSQL conectado" });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Erro ao conectar com o banco.", erro: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtoRoutes);
app.use("/api/conferencias", conferenciaRoutes);

app.use((req, res) => res.status(404).json({
  sucesso: false,
  mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
}));

app.use((error, req, res, next) => {
  console.error("Erro no servidor:", error);
  return res.status(500).json({ sucesso: false, mensagem: error.message || "Erro interno no servidor." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

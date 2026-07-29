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
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://confere-host.vercel.app",
  "https://confere-host-2cqn.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (
        origensPermitidas.includes(origin) ||
        /^https:\/\/confere-host-.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }

      console.log("CORS bloqueou:", origin);

      return callback(new Error("Origem não autorizada."));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      sucesso: true,
      mensagem: "API funcionando!",
      banco: "PostgreSQL conectado",
    });
  } catch (error) {
    res.status(500).json({
      sucesso: false,
      mensagem: error.message,
    });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      api: "online",
      banco: "online",
    });
  } catch (error) {
    res.status(500).json({
      api: "online",
      banco: "offline",
      erro: error.message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/produtos", produtoRoutes);
app.use("/api/conferencias", conferenciaRoutes);

app.use((req, res) => {
  res.status(404).json({
    sucesso: false,
    mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    sucesso: false,
    mensagem: err.message || "Erro interno no servidor.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV}`);
});
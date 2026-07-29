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

const corsOptions = {
  origin(origin, callback) {
    // Permite requisições sem Origin, como Render, Postman e testes diretos.
    if (!origin) {
      return callback(null, true);
    }

    // Permite origens cadastradas.
    if (origensPermitidas.includes(origin)) {
      return callback(null, true);
    }

    // Permite previews da Vercel deste projeto.
    const ehPreviewVercel =
      /^https:\/\/confere-host-[a-z0-9-]+\.vercel\.app$/i.test(
        origin
      );

    if (ehPreviewVercel) {
      return callback(null, true);
    }

    console.warn(`Origem bloqueada pelo CORS: ${origin}`);

    return callback(
      new Error(`Origem não autorizada pelo CORS: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
  ],

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Responde corretamente às requisições preflight do navegador.
app.options("*", cors(corsOptions));

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

// Rota para testar se a API e o banco estão funcionando.
app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      sucesso: true,
      mensagem: "API funcionando!",
      banco: "PostgreSQL conectado",
      ambiente: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("Erro ao testar banco:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar com o banco.",
      erro: error.message,
    });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      sucesso: true,
      api: "online",
      banco: "online",
    });
  } catch (error) {
    return res.status(500).json({
      sucesso: false,
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
  return res.status(404).json({
    sucesso: false,
    mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Middleware central de erros.
app.use((error, req, res, next) => {
  console.error("Erro no servidor:", error);

  if (
    error.message?.startsWith(
      "Origem não autorizada pelo CORS"
    )
  ) {
    return res.status(403).json({
      sucesso: false,
      mensagem: error.message,
    });
  }

  return res.status(error.status || 500).json({
    sucesso: false,
    mensagem:
      error.message || "Erro interno no servidor.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(
    `Ambiente: ${process.env.NODE_ENV || "development"}`
  );
  console.log(
    "Origens CORS permitidas:",
    origensPermitidas
  );
});
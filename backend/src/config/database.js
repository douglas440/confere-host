import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("A variável DATABASE_URL não foi configurada.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : process.env.DATABASE_URL.includes("supabase")
        ? { rejectUnauthorized: false }
        : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on("error", (error) => {
  console.error("Erro inesperado no pool PostgreSQL:", error);
});

export default pool;

import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pool from "../config/database.js";

dotenv.config();

const empresas = [
  {
    nome: "Delícias do Trigo",
    usuario: "delicias",
    senha: "123456",
  },
  {
    nome: "Moinho",
    usuario: "moinho",
    senha: "123456",
  },
];

async function localizarOuCriarLoja(nome) {
  const [existentes] = await pool.query(
    `SELECT id, nome
     FROM lojas
     WHERE LOWER(nome) = LOWER(?)
     LIMIT 1`,
    [nome]
  );

  if (existentes.length > 0) {
    return existentes[0];
  }

  const [resultado] = await pool.query(
    "INSERT INTO lojas (nome) VALUES (?)",
    [nome]
  );

  return {
    id: resultado.insertId,
    nome,
  };
}

async function executar() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_lojas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        loja_id INT NOT NULL UNIQUE,
        usuario VARCHAR(80) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_login_lojas_loja
          FOREIGN KEY (loja_id)
          REFERENCES lojas(id)
          ON DELETE CASCADE
      )
    `);

    const [colunasEmail] = await pool.query(`
      SHOW COLUMNS FROM login_lojas LIKE 'email'
    `);

    if (colunasEmail.length > 0) {
      const [colunasUsuario] = await pool.query(`
        SHOW COLUMNS FROM login_lojas LIKE 'usuario'
      `);

      if (colunasUsuario.length === 0) {
        await pool.query(`
          ALTER TABLE login_lojas
          CHANGE COLUMN email usuario VARCHAR(80) NOT NULL
        `);
      }
    }

    for (const empresa of empresas) {
      const loja = await localizarOuCriarLoja(empresa.nome);
      const senhaHash = await bcrypt.hash(empresa.senha, 12);

      await pool.query(
        `INSERT INTO login_lojas (
          loja_id,
          usuario,
          senha_hash,
          ativo
        ) VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          usuario = VALUES(usuario),
          senha_hash = VALUES(senha_hash),
          ativo = 1`,
        [
          loja.id,
          empresa.usuario,
          senhaHash,
        ]
      );

      console.log(
        `Acesso configurado: ${loja.nome} | usuário: ${empresa.usuario}`
      );
    }

    console.log("\nLogins configurados com sucesso.");
  } catch (error) {
    console.error("Erro ao criar os logins:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

executar();

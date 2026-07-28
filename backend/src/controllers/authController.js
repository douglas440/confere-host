import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export async function login(req, res) {
  try {
    const usuario = String(req.body?.usuario || "")
      .trim()
      .toLowerCase();

    const senha = String(req.body?.senha || "");

    if (!usuario || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o usuário e a senha.",
      });
    }

    const [registros] = await pool.query(
      `SELECT
        login_lojas.id,
        login_lojas.loja_id,
        login_lojas.usuario,
        login_lojas.senha_hash,
        login_lojas.ativo,
        lojas.nome AS loja_nome
      FROM login_lojas
      INNER JOIN lojas ON lojas.id = login_lojas.loja_id
      WHERE login_lojas.usuario = ?
      LIMIT 1`,
      [usuario]
    );

    if (registros.length === 0) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Usuário ou senha incorretos.",
      });
    }

    const acesso = registros[0];

    if (!acesso.ativo) {
      return res.status(403).json({
        sucesso: false,
        mensagem: "Este acesso está desativado.",
      });
    }

    const senhaCorreta = await bcrypt.compare(
      senha,
      acesso.senha_hash
    );

    if (!senhaCorreta) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Usuário ou senha incorretos.",
      });
    }

    const segredo = process.env.JWT_SECRET;

    if (!segredo) {
      throw new Error(
        "JWT_SECRET não foi configurado no arquivo .env."
      );
    }

    const token = jwt.sign(
      {
        acesso_id: acesso.id,
        loja_id: acesso.loja_id,
        usuario: acesso.usuario,
      },
      segredo,
      {
        expiresIn: "12h",
      }
    );

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: {
        id: acesso.id,
        usuario: acesso.usuario,
        loja_id: acesso.loja_id,
        loja_nome: acesso.loja_nome,
      },
    });
  } catch (error) {
    console.error("Erro ao realizar login:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível realizar o login.",
      erro: error.message,
    });
  }
}

export async function verificarSessao(req, res) {
  return res.json({
    sucesso: true,
    usuario: req.usuario,
  });
}

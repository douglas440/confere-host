import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export async function login(req, res) {
  try {
    const usuario = String(req.body?.usuario || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");

    if (!usuario || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o usuário e a senha.",
      });
    }

    const resultado = await pool.query(
      `
        SELECT
          ll.id,
          ll.loja_id,
          ll.usuario,
          ll.senha_hash,
          l.nome AS loja_nome
        FROM login_lojas ll
        INNER JOIN lojas l ON l.id = ll.loja_id
        WHERE LOWER(ll.usuario) = $1
          AND ll.ativo = 1
          AND l.ativo = 1
        LIMIT 1
      `,
      [usuario]
    );

    const conta = resultado.rows[0];

    if (!conta || !(await bcrypt.compare(senha, conta.senha_hash))) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Usuário ou senha incorretos.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET não foi configurado.");
    }

    const payload = {
      id: conta.id,
      usuario: conta.usuario,
      loja_id: conta.loja_id,
      loja_nome: conta.loja_nome,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "12h",
    });

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: payload,
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível realizar o login.",
      erro: error.message,
    });
  }
}

export function sessao(req, res) {
  return res.json({ sucesso: true, usuario: req.usuario });
}

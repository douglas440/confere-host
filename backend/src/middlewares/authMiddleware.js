import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || "";

  if (!cabecalho.startsWith("Bearer ")) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Acesso não autorizado.",
    });
  }

  const token = cabecalho.substring(7);

  try {
    const usuario = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.usuario = usuario;
    return next();
  } catch (error) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Sessão inválida ou expirada.",
    });
  }
}

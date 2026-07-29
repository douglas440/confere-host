import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || "";
  const [tipo, token] = cabecalho.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Token de acesso não informado.",
    });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Token inválido ou expirado.",
    });
  }
}

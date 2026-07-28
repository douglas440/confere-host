import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash, FaLock, FaStore } from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

function Login() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!usuario.trim() || !senha.trim()) {
      setMensagem("Informe o usuário e a senha.");
      return;
    }

    try {
      setCarregando(true);
      setMensagem("");

      const resposta = await axios.post(
        `${API_URL}/api/auth/login`,
        {
          usuario: usuario.trim(),
          senha,
        }
      );

      const tokenRecebido = resposta.data?.token;
      const usuarioRecebido =
        resposta.data?.usuario ||
        resposta.data?.dadosUsuario ||
        resposta.data?.loja;

      if (!tokenRecebido) {
        throw new Error("Token não foi retornado pelo servidor.");
      }

      localStorage.setItem("token", tokenRecebido);

      if (usuarioRecebido) {
        localStorage.setItem(
          "usuario",
          JSON.stringify(usuarioRecebido)
        );

        localStorage.setItem(
          "usuarioLogado",
          JSON.stringify(usuarioRecebido)
        );
      }

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      const mensagemServidor =
        error.response?.data?.mensagem ||
        error.response?.data?.message;

      setMensagem(
        mensagemServidor ||
          "Não foi possível realizar o login."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">CH</div>

          <div>
            <h1>Confere Host</h1>
            <span>Auditoria de entradas</span>
          </div>
        </div>

        <div className="login-icon">
          <FaStore />
        </div>

        <h2>Acessar sua loja</h2>

        <p className="login-subtitle">
          Entre com o acesso da unidade para continuar.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="usuario">Usuário</label>

            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(event) =>
                setUsuario(event.target.value)
              }
              placeholder="Digite seu usuário"
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="senha">Senha</label>

            <div className="login-password-wrapper">
              <FaLock className="login-field-icon" />

              <input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(event) =>
                  setSenha(event.target.value)
                }
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="login-password-toggle"
                onClick={() =>
                  setMostrarSenha((valor) => !valor)
                }
                aria-label={
                  mostrarSenha
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {mostrarSenha ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </button>
            </div>
          </div>

          {mensagem && (
            <div className="login-message">
              {mensagem}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={carregando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
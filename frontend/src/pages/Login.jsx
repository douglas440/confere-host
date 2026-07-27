import { useState } from "react";
import axios from "axios";
import { FaEye, FaEyeSlash, FaLock, FaStore } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

function Login() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(event) {
    event.preventDefault();
    setErro("");

    if (!usuario.trim() || !senha) {
      setErro("Preencha o usuário e a senha.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await axios.post(
        `${API_URL}/api/auth/login`,
        {
          usuario: usuario.trim(),
          senha,
        }
      );

      localStorage.setItem(
        "confereHost:token",
        resposta.data.token
      );

      localStorage.setItem(
        "confereHost:usuario",
        JSON.stringify(resposta.data.usuario)
      );

      navigate("/dashboard", { replace: true });
      window.location.reload();
    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível entrar no sistema."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={styles.pagina}>
      <div style={styles.caixa}>
        <div style={styles.marca}>
          <div style={styles.logo}>CH</div>

          <div>
            <strong style={styles.nome}>Confere Host</strong>
            <span style={styles.subtitulo}>
              Auditoria de entradas
            </span>
          </div>
        </div>

        <div style={styles.icone}>
          <FaStore />
        </div>

        <h1 style={styles.titulo}>Acessar sua loja</h1>

        <p style={styles.descricao}>
          Entre com o acesso da unidade para continuar.
        </p>

        <form onSubmit={entrar} style={styles.formulario}>
          <label style={styles.label}>
            Usuário
            <input
              type="text"
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Senha

            <div style={styles.senhaArea}>
              <FaLock style={styles.cadeado} />

              <input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                style={styles.inputSenha}
              />

              <button
                type="button"
                onClick={() =>
                  setMostrarSenha((valor) => !valor)
                }
                style={styles.olho}
                aria-label={
                  mostrarSenha
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {mostrarSenha ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          {erro && <div style={styles.erro}>{erro}</div>}

          <button
            type="submit"
            disabled={carregando}
            style={{
              ...styles.botao,
              opacity: carregando ? 0.7 : 1,
            }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  pagina: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background:
      "linear-gradient(135deg, #eef4ff 0%, #f7f9fc 55%, #e9f0ff 100%)",
  },
  caixa: {
    width: "100%",
    maxWidth: "430px",
    padding: "34px",
    background: "#ffffff",
    border: "1px solid #e4eaf2",
    borderRadius: "22px",
    boxShadow: "0 24px 65px rgba(23, 43, 77, 0.14)",
  },
  marca: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "30px",
  },
  logo: {
    width: "46px",
    height: "46px",
    display: "grid",
    placeItems: "center",
    borderRadius: "13px",
    background: "#2f6fec",
    color: "#ffffff",
    fontWeight: "800",
  },
  nome: {
    display: "block",
    color: "#111c33",
    fontSize: "17px",
  },
  subtitulo: {
    display: "block",
    marginTop: "2px",
    color: "#71809a",
    fontSize: "12px",
  },
  icone: {
    width: "54px",
    height: "54px",
    display: "grid",
    placeItems: "center",
    marginBottom: "18px",
    borderRadius: "16px",
    background: "#eaf1ff",
    color: "#2f6fec",
    fontSize: "23px",
  },
  titulo: {
    margin: 0,
    color: "#111c33",
    fontSize: "28px",
  },
  descricao: {
    margin: "9px 0 25px",
    color: "#6c7890",
    lineHeight: 1.5,
  },
  formulario: {
    display: "grid",
    gap: "17px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#25324a",
    fontSize: "13px",
    fontWeight: "700",
  },
  input: {
    width: "100%",
    height: "48px",
    padding: "0 14px",
    border: "1px solid #d8e0eb",
    borderRadius: "12px",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  senhaArea: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  cadeado: {
    position: "absolute",
    left: "14px",
    color: "#8a96aa",
  },
  inputSenha: {
    width: "100%",
    height: "48px",
    padding: "0 45px 0 41px",
    border: "1px solid #d8e0eb",
    borderRadius: "12px",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  olho: {
    position: "absolute",
    right: "10px",
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    border: 0,
    background: "transparent",
    color: "#6f7c92",
    cursor: "pointer",
  },
  erro: {
    padding: "12px 14px",
    borderRadius: "11px",
    background: "#ffe7e7",
    color: "#b42318",
    fontSize: "13px",
  },
  botao: {
    height: "49px",
    border: 0,
    borderRadius: "12px",
    background: "#2f6fec",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
    cursor: "pointer",
  },
};

export default Login;

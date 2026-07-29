import { FaBell, FaUserCircle } from "react-icons/fa";
import { useLocation } from "react-router-dom";

function lerUsuarioSalvo() {
  const chaves = ["usuario", "usuarioLogado", "loja"];

  for (const chave of chaves) {
    try {
      const conteudo = localStorage.getItem(chave);
      if (conteudo) {
        const dados = JSON.parse(conteudo);
        if (dados && typeof dados === "object") return dados;
      }
    } catch (error) {
      console.error(`Erro ao ler ${chave}:`, error);
    }
  }

  return {};
}

function obterNomeExibicao(usuario) {
  return (
    usuario.nome ||
    usuario.nome_usuario ||
    usuario.usuario ||
    usuario.login ||
    usuario.loja_nome ||
    usuario.nome_loja ||
    usuario.empresa ||
    "Usuário"
  );
}

function obterPerfilExibicao(usuario) {
  return (
    usuario.perfil ||
    usuario.tipo ||
    usuario.cargo ||
    usuario.loja_nome ||
    usuario.nome_loja ||
    usuario.empresa ||
    "Conta conectada"
  );
}

function Header() {
  const location = useLocation();
  const usuario = lerUsuarioSalvo();

  const titulos = {
    "/dashboard": "Dashboard",
    "/produtos": "Produtos",
    "/conferencia": "Nova Conferência",
    "/historico": "Histórico",
  };

  const titulo = titulos[location.pathname] || "Confere Host";

  return (
    <header className="header">
      <div>
        <p className="header-subtitle">Sistema de auditoria</p>
        <h2>{titulo}</h2>
      </div>

      <div className="header-actions">
        <button
          className="icon-button"
          type="button"
          aria-label="Notificações"
          title="Notificações"
        >
          <FaBell />
        </button>

        <div className="user-info">
          <FaUserCircle />

          <div>
            <strong>{obterNomeExibicao(usuario)}</strong>
            <span>{obterPerfilExibicao(usuario)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

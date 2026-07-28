import {
  FaBuilding,
  FaRegCalendarAlt,
  FaUserCircle,
} from "react-icons/fa";
import { useLocation } from "react-router-dom";

function obterUsuario() {
  try {
    return JSON.parse(
      localStorage.getItem("confereHost:usuario")
    );
  } catch {
    return null;
  }
}

function Header() {
  const location = useLocation();
  const usuario = obterUsuario();

  const titulos = {
    "/dashboard": {
      titulo: "Dashboard",
      subtitulo: "Visão geral da operação",
    },
    "/produtos": {
      titulo: "Produtos",
      subtitulo: "Cadastro, estoque e fatores",
    },
    "/conferencia": {
      titulo: "Nova Conferência",
      subtitulo: "Auditoria do relatório diário",
    },
    "/historico": {
      titulo: "Histórico",
      subtitulo: "Conferências registradas",
    },
  };

  const pagina = titulos[location.pathname] || {
    titulo: "Confere Host",
    subtitulo: "Sistema de auditoria",
  };

  const dataAtual = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(new Date());

  return (
    <header className="header">
      <div className="header-title-area">
        <p className="header-subtitle">{pagina.subtitulo}</p>
        <h2>{pagina.titulo}</h2>
      </div>

      <div className="header-actions">
        <div className="header-date">
          <FaRegCalendarAlt />
          <span>{dataAtual}</span>
        </div>

        <div className="header-company">
          <FaBuilding />
          <div>
            <span>Empresa</span>
            <strong>
              {usuario?.loja_nome || "Não identificada"}
            </strong>
          </div>
        </div>

        <div className="user-info">
          <FaUserCircle />

          <div>
            <strong>{usuario?.usuario || "Usuário"}</strong>
            <span>Conta conectada</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

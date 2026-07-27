import { NavLink, useNavigate } from "react-router-dom";
import {
  FaBoxes,
  FaBuilding,
  FaChartPie,
  FaClipboardCheck,
  FaHistory,
  FaSignOutAlt,
} from "react-icons/fa";

function obterUsuario() {
  try {
    return JSON.parse(
      localStorage.getItem("confereHost:usuario")
    );
  } catch {
    return null;
  }
}

function Sidebar() {
  const navigate = useNavigate();
  const usuario = obterUsuario();

  const menuItems = [
    {
      nome: "Dashboard",
      descricao: "Visão geral",
      rota: "/dashboard",
      icone: <FaChartPie />,
    },
    {
      nome: "Produtos",
      descricao: "Cadastro e fatores",
      rota: "/produtos",
      icone: <FaBoxes />,
    },
    {
      nome: "Conferência",
      descricao: "Analisar relatório",
      rota: "/conferencia",
      icone: <FaClipboardCheck />,
    },
    {
      nome: "Histórico",
      descricao: "Registros salvos",
      rota: "/historico",
      icone: <FaHistory />,
    },
  ];

  function sair() {
    localStorage.removeItem("confereHost:token");
    localStorage.removeItem("confereHost:usuario");
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">CH</div>

        <div>
          <h1>Confere Host</h1>
          <span>Auditoria de entradas</span>
        </div>
      </div>

      <div className="sidebar-company">
        <div className="sidebar-company-icon">
          <FaBuilding />
        </div>

        <div>
          <span>Empresa conectada</span>
          <strong>
            {usuario?.loja_nome || "Não identificada"}
          </strong>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-menu-label">Menu principal</span>

        {menuItems.map((item) => (
          <NavLink
            key={item.rota}
            to={item.rota}
            className={({ isActive }) =>
              isActive
                ? "sidebar-link active"
                : "sidebar-link"
            }
          >
            <span className="sidebar-link-icon">
              {item.icone}
            </span>

            <span className="sidebar-link-text">
              <strong>{item.nome}</strong>
              <small>{item.descricao}</small>
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {(usuario?.usuario || "U")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>{usuario?.usuario || "Usuário"}</strong>
            <span>Acesso da empresa</span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-logout"
          onClick={sair}
        >
          <FaSignOutAlt />
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

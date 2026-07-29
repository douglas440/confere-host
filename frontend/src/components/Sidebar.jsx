import { NavLink, useNavigate } from "react-router-dom";
import {
  FaChartPie,
  FaClipboardCheck,
  FaHistory,
  FaBoxes,
  FaSignOutAlt,
} from "react-icons/fa";

function Sidebar() {
  const navigate = useNavigate();

  const menuItems = [
    {
      nome: "Dashboard",
      rota: "/dashboard",
      icone: <FaChartPie />,
    },
    {
      nome: "Produtos",
      rota: "/produtos",
      icone: <FaBoxes />,
    },
    {
      nome: "Conferência",
      rota: "/conferencia",
      icone: <FaClipboardCheck />,
    },
    {
      nome: "Histórico",
      rota: "/historico",
      icone: <FaHistory />,
    },
  ];


  function handleLogout() {
  localStorage.clear();
  sessionStorage.clear();

  window.location.href = "/login";
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

      <nav className="sidebar-nav">
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

            <span>{item.nome}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt />

          <span>Sair do sistema</span>
        </button>

        <div className="sidebar-version">
          <p>Sistema interno</p>
          <span>Versão 1.0</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
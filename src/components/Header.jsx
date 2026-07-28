import { FaBell, FaUserCircle } from "react-icons/fa";
import { useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();

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
        <button className="icon-button" type="button">
          <FaBell />
        </button>

        <div className="user-info">
          <FaUserCircle />

          <div>
            <strong>Douglas</strong>
            <span>Operador</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
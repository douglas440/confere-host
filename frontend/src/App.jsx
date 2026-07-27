import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/Produtos";
import Conferencia from "./pages/Conferencia";
import Historico from "./pages/Historico";
import Login from "./pages/Login";

function obterUsuario() {
  try {
    return JSON.parse(
      localStorage.getItem("confereHost:usuario")
    );
  } catch {
    return null;
  }
}

function estaAutenticado() {
  return Boolean(
    localStorage.getItem("confereHost:token") &&
      obterUsuario()
  );
}

function LayoutProtegido({ children }) {
  if (!estaAutenticado()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <Sidebar />

      <div className="main-content">
        <Header />

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function RotaProtegida({ children }) {
  return (
    <LayoutProtegido>
      {children}
    </LayoutProtegido>
  );
}

function App() {
  const autenticado = estaAutenticado();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          autenticado
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to={autenticado ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      <Route
        path="/dashboard"
        element={
          <RotaProtegida>
            <Dashboard />
          </RotaProtegida>
        }
      />

      <Route
        path="/produtos"
        element={
          <RotaProtegida>
            <Produtos />
          </RotaProtegida>
        }
      />

      <Route
        path="/conferencia"
        element={
          <RotaProtegida>
            <Conferencia />
          </RotaProtegida>
        }
      />

      <Route
        path="/historico"
        element={
          <RotaProtegida>
            <Historico />
          </RotaProtegida>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={autenticado ? "/dashboard" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;

import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/Produtos";
import Conferencia from "./pages/Conferencia";
import Historico from "./pages/Historico";

function App() {
  return (
    <div className="app">
      <Sidebar />

      <div className="main-content">
        <Header />

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/conferencia" element={<Conferencia />} />
            <Route path="/historico" element={<Historico />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
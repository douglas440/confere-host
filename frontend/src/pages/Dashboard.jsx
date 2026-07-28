import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFileImport,
  FaHistory,
  FaPlus,
  FaSyncAlt,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

const API_PRODUTOS = `${API_URL}/api/produtos`;
const API_CONFERENCIAS = `${API_URL}/api/conferencias`;

function obterUsuario() {
  try {
    return JSON.parse(
      localStorage.getItem("confereHost:usuario")
    );
  } catch {
    return null;
  }
}

function obterCabecalhoAutenticacao() {
  return {
    Authorization: `Bearer ${localStorage.getItem(
      "confereHost:token"
    )}`,
  };
}

function obterSaudacao() {
  const hora = new Date().getHours();

  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarDataHora(data) {
  if (!data) return "-";

  const valor = new Date(data);

  if (Number.isNaN(valor.getTime())) {
    return String(data);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(valor);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Dashboard() {
  const usuario = useMemo(() => obterUsuario(), []);

  const [totalProdutos, setTotalProdutos] = useState(0);
  const [conferencias, setConferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarDados() {
    try {
      setCarregando(true);
      setErro("");

      const headers = obterCabecalhoAutenticacao();

      const [respostaProdutos, respostaConferencias] =
        await Promise.all([
          axios.get(API_PRODUTOS, {
            params: {
              pagina: 1,
              busca: "",
            },
            headers,
          }),
          axios.get(API_CONFERENCIAS, {
            headers,
          }),
        ]);

      setTotalProdutos(
        Number(
          respostaProdutos.data?.paginacao?.total
        ) || 0
      );

      setConferencias(
        respostaConferencias.data?.conferencias || []
      );
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);

      if (error.response?.status === 401) {
        localStorage.removeItem("confereHost:token");
        localStorage.removeItem("confereHost:usuario");
        window.location.href = "/login";
        return;
      }

      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível carregar os dados do dashboard."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const resumo = useMemo(() => {
    return conferencias.reduce(
      (acumulado, item) => {
        acumulado.totalConferencias += 1;
        acumulado.totalItens += Number(item.totalItens || 0);
        acumulado.totalPendencias += Number(item.erros || 0);
        acumulado.valorTotal += Number(item.valorTotal || 0);

        if (item.status === "finalizada") {
          acumulado.finalizadas += 1;
        }

        if (item.status === "com_erro") {
          acumulado.comPendencias += 1;
        }

        return acumulado;
      },
      {
        totalConferencias: 0,
        finalizadas: 0,
        comPendencias: 0,
        totalItens: 0,
        totalPendencias: 0,
        valorTotal: 0,
      }
    );
  }, [conferencias]);

  const ultimasConferencias = useMemo(
    () => conferencias.slice(0, 6),
    [conferencias]
  );

  const percentualSemPendencia =
    resumo.totalConferencias > 0
      ? Math.round(
          (resumo.finalizadas /
            resumo.totalConferencias) *
            100
        )
      : 0;

  return (
    <div className="dashboard dashboard-modern">
      <section className="welcome-card dashboard-hero">
        <div>
          <span className="welcome-badge">
            {usuario?.loja_nome || "Empresa conectada"}
          </span>

          <h1>
            {obterSaudacao()},{" "}
            <strong>{usuario?.usuario || "usuário"}</strong>
          </h1>

          <p>
            Acompanhe os produtos e todas as conferências
            registradas da empresa conectada.
          </p>
        </div>

        <div className="welcome-actions">
          <Link
            to="/produtos"
            className="button button-secondary"
          >
            <FaFileImport />
            Importar produtos
          </Link>

          <Link
            to="/conferencia"
            className="button button-primary"
          >
            <FaPlus />
            Nova conferência
          </Link>
        </div>
      </section>

      {erro && (
        <div className="dashboard-alert error-message">
          <FaExclamationTriangle />
          <span>{erro}</span>

          <button
            type="button"
            onClick={carregarDados}
            className="dashboard-retry"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <section className="stats-grid dashboard-stats-grid">
        <article className="stat-card stat-card-blue">
          <div className="stat-icon">
            <FaBoxOpen />
          </div>

          <div>
            <span>Produtos cadastrados</span>
            <strong>
              {carregando
                ? "..."
                : totalProdutos.toLocaleString("pt-BR")}
            </strong>
            <small>Somente desta empresa</small>
          </div>
        </article>

        <article className="stat-card stat-card-green">
          <div className="stat-icon">
            <FaClipboardCheck />
          </div>

          <div>
            <span>Conferências realizadas</span>
            <strong>
              {carregando
                ? "..."
                : resumo.totalConferencias.toLocaleString(
                    "pt-BR"
                  )}
            </strong>
            <small>
              {resumo.totalItens.toLocaleString("pt-BR")} itens
              analisados
            </small>
          </div>
        </article>

        <article className="stat-card stat-card-red">
          <div className="stat-icon">
            <FaExclamationTriangle />
          </div>

          <div>
            <span>Itens com pendência</span>
            <strong>
              {carregando
                ? "..."
                : resumo.totalPendencias.toLocaleString(
                    "pt-BR"
                  )}
            </strong>
            <small>
              {resumo.comPendencias} conferência(s) com atenção
            </small>
          </div>
        </article>

        <article className="stat-card stat-card-purple">
          <div className="stat-icon">
            <FaCheckCircle />
          </div>

          <div>
            <span>Conferências corretas</span>
            <strong>
              {carregando
                ? "..."
                : resumo.finalizadas.toLocaleString("pt-BR")}
            </strong>
            <small>{percentualSemPendencia}% sem pendência</small>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="content-card dashboard-performance">
          <div className="section-header">
            <div>
              <span>Resumo geral</span>
              <h3>Desempenho das conferências</h3>
            </div>
          </div>

          <div className="performance-list">
            <div className="performance-row">
              <div>
                <span>Valor total conferido</span>
                <strong>{formatarMoeda(resumo.valorTotal)}</strong>
              </div>
              <FaClipboardCheck />
            </div>

            <div className="performance-row">
              <div>
                <span>Conferências sem pendência</span>
                <strong>{resumo.finalizadas}</strong>
              </div>
              <FaCheckCircle />
            </div>

            <div className="performance-row">
              <div>
                <span>Conferências com pendência</span>
                <strong>{resumo.comPendencias}</strong>
              </div>
              <FaExclamationTriangle />
            </div>
          </div>
        </article>

        <article className="content-card dashboard-quick-actions">
          <div className="section-header">
            <div>
              <span>Acesso rápido</span>
              <h3>Principais ações</h3>
            </div>
          </div>

          <div className="quick-actions-grid">
            <Link to="/conferencia" className="quick-action">
              <FaPlus />
              <div>
                <strong>Nova conferência</strong>
                <span>Importar relatório diário</span>
              </div>
            </Link>

            <Link to="/produtos" className="quick-action">
              <FaBoxOpen />
              <div>
                <strong>Produtos</strong>
                <span>Consultar e atualizar fatores</span>
              </div>
            </Link>

            <Link to="/historico" className="quick-action">
              <FaHistory />
              <div>
                <strong>Histórico</strong>
                <span>Consultar conferências salvas</span>
              </div>
            </Link>
          </div>
        </article>
      </section>

      <section className="content-card">
        <div className="section-header">
          <div>
            <span>Dados reais</span>
            <h3>Últimas conferências</h3>
          </div>

          <div className="dashboard-table-actions">
            <button
              type="button"
              className="text-link dashboard-refresh"
              onClick={carregarDados}
              disabled={carregando}
            >
              <FaSyncAlt />
              Atualizar
            </button>

            <Link to="/historico" className="text-link">
              Ver histórico completo
            </Link>
          </div>
        </div>

        {carregando ? (
          <div className="empty-state">
            <FaSyncAlt className="spinner" />
            <h3>Carregando dados...</h3>
          </div>
        ) : ultimasConferencias.length === 0 ? (
          <div className="empty-state">
            <FaClipboardCheck />
            <h3>Nenhuma conferência cadastrada</h3>
            <p>
              Faça uma nova conferência para os registros
              aparecerem aqui.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Fornecedor</th>
                  <th>Conferida em</th>
                  <th>Itens</th>
                  <th>Pendências</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {ultimasConferencias.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>NF {item.nota}</strong>
                    </td>
                    <td>{item.fornecedor}</td>
                    <td>{formatarDataHora(item.conferidoEm)}</td>
                    <td>{item.totalItens}</td>
                    <td>{item.erros}</td>
                    <td>{formatarMoeda(item.valorTotal)}</td>
                    <td>
                      <span
                        className={
                          item.status === "finalizada"
                            ? "status-badge success"
                            : "status-badge danger"
                        }
                      >
                        {item.status === "finalizada"
                          ? "Finalizada"
                          : "Com pendências"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;

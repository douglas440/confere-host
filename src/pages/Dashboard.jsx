import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFileImport,
  FaPlus,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

const API_PRODUTOS = `${API_URL}/api/produtos`;
const CHAVE_CONFERENCIA = "confereHost:conferenciaAtual";

function carregarConferenciaSalva() {
  try {
    const conteudo = localStorage.getItem(CHAVE_CONFERENCIA);

    if (!conteudo) {
      return null;
    }

    const conferencia = JSON.parse(conteudo);

    if (!Array.isArray(conferencia?.notas)) {
      return null;
    }

    return conferencia;
  } catch (error) {
    console.error("Erro ao carregar conferência salva:", error);
    return null;
  }
}

function obterSaudacao() {
  const hora = new Date().getHours();

  if (hora < 12) {
    return "Bom dia";
  }

  if (hora < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

function Dashboard() {
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [carregandoProdutos, setCarregandoProdutos] =
    useState(true);
  const [erroProdutos, setErroProdutos] = useState("");

  const conferencia = useMemo(
    () => carregarConferenciaSalva(),
    []
  );

  const notas = conferencia?.notas || [];

  useEffect(() => {
    async function carregarResumoProdutos() {
      try {
        setCarregandoProdutos(true);
        setErroProdutos("");

        const resposta = await axios.get(API_PRODUTOS, {
          params: {
            pagina: 1,
            busca: "",
          },
        });

        setTotalProdutos(
          Number(resposta.data?.paginacao?.total) || 0
        );
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);

        setErroProdutos(
          error.response?.data?.mensagem ||
            "Não foi possível consultar os produtos."
        );
      } finally {
        setCarregandoProdutos(false);
      }
    }

    carregarResumoProdutos();
  }, []);

  const resumoConferencia = useMemo(() => {
    const itens = notas.flatMap((nota) => nota.itens || []);

    const corretos = itens.filter(
      (item) => item.status === "correto"
    ).length;

    const erros = itens.filter(
      (item) =>
        item.status !== "correto" &&
        item.status !== "aguardando"
    ).length;

    const notasCorretas = notas.filter((nota) => {
      return !(nota.itens || []).some(
        (item) =>
          item.status !== "correto" &&
          item.status !== "aguardando"
      );
    }).length;

    return {
      totalNotas: notas.length,
      totalItens: itens.length,
      corretos,
      erros,
      notasCorretas,
    };
  }, [notas]);

  const ultimasConferencias = useMemo(() => {
    return [...notas]
      .reverse()
      .slice(0, 5)
      .map((nota) => {
        const itens = nota.itens || [];

        const erros = itens.filter(
          (item) =>
            item.status !== "correto" &&
            item.status !== "aguardando"
        ).length;

        return {
          id: nota.id,
          nota: nota.numero,
          fornecedor: nota.fornecedor,
          data: nota.data,
          produtos: itens.length,
          erros,
          status: erros === 0 ? "Correta" : "Com erro",
        };
      });
  }, [notas]);

  return (
    <div className="dashboard">
      <section className="welcome-card">
        <div>
          <span className="welcome-badge">
            Auditoria de entradas
          </span>

          <h1>
            {obterSaudacao()}, <strong>Douglas</strong>
          </h1>

          <p>
            Importe os relatórios do Host, consulte os
            produtos cadastrados e acompanhe o resultado
            da conferência atual.
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

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon">
            <FaClipboardCheck />
          </div>

          <div>
            <span>Notas na conferência atual</span>
            <strong>{resumoConferencia.totalNotas}</strong>
            <small>
              {resumoConferencia.totalItens} item(ns)
              analisado(s)
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <FaExclamationTriangle />
          </div>

          <div>
            <span>Itens com atenção</span>
            <strong>{resumoConferencia.erros}</strong>
            <small>
              Divergências, sem fator ou não cadastrados
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <FaBoxOpen />
          </div>

          <div>
            <span>Produtos cadastrados</span>
            <strong>
              {carregandoProdutos
                ? "..."
                : totalProdutos.toLocaleString("pt-BR")}
            </strong>
            <small>
              {erroProdutos
                ? "Falha ao consultar a base"
                : "Total registrado no sistema"}
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <FaCheckCircle />
          </div>

          <div>
            <span>Itens corretos</span>
            <strong>{resumoConferencia.corretos}</strong>
            <small>
              {resumoConferencia.notasCorretas} nota(s)
              sem erro
            </small>
          </div>
        </article>
      </section>

      <section className="content-card">
        <div className="section-header">
          <div>
            <span>Conferência atual</span>
            <h3>Notas importadas recentemente</h3>
          </div>

          <Link to="/conferencia" className="text-link">
            Abrir conferência
          </Link>
        </div>

        {ultimasConferencias.length === 0 ? (
          <div className="empty-state">
            <FaClipboardCheck />
            <h3>Nenhuma conferência salva</h3>
            <p>
              Importe um relatório para os dados aparecerem
              no dashboard.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número da nota</th>
                  <th>Fornecedor</th>
                  <th>Data</th>
                  <th>Produtos</th>
                  <th>Erros</th>
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
                    <td>{item.data}</td>
                    <td>{item.produtos}</td>
                    <td>{item.erros}</td>

                    <td>
                      <span
                        className={
                          item.erros === 0
                            ? "status-badge success"
                            : "status-badge danger"
                        }
                      >
                        {item.status}
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
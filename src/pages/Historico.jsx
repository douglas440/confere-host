import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaFilter,
  FaHistory,
  FaSearch,
  FaSpinner,
  FaTimesCircle,
  FaTrash,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

const API_CONFERENCIAS = `${API_URL}/api/conferencias`;

function formatarDataHora(data) {
  if (!data) return "-";
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return String(data);

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

function formatarNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "-";
  }

  return Number(valor).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

function textoStatusItem(status) {
  return {
    correto: "Correto",
    produto_nao_encontrado: "Produto não cadastrado",
    sem_fator: "Produto sem fator",
    volume_incompleto: "Quantidade não fecha o volume",
    fator_suspeito: "Revisar fator cadastrado",
  }[status] || "Aguardando";
}

function Historico() {
  const [historico, setHistorico] = useState([]);
  const [pesquisa, setPesquisa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [registroAberto, setRegistroAberto] = useState(null);
  const [detalhes, setDetalhes] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(null);
  const [erro, setErro] = useState("");

  async function carregarHistorico() {
    setCarregando(true);
    setErro("");

    try {
      const resposta = await axios.get(API_CONFERENCIAS);
      setHistorico(resposta.data?.conferencias || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível carregar o histórico."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarHistorico();
  }, []);

  const historicoFiltrado = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return historico.filter((item) => {
      const pesquisaOk =
        !termo ||
        String(item.nota || "").toLowerCase().includes(termo) ||
        String(item.fornecedor || "").toLowerCase().includes(termo);

      const statusOk =
        filtroStatus === "todos" ||
        item.status === filtroStatus;

      const data = item.conferidoEm
        ? new Date(item.conferidoEm)
        : null;

      const inicialOk =
        !dataInicial ||
        (data && data >= new Date(`${dataInicial}T00:00:00`));

      const finalOk =
        !dataFinal ||
        (data && data <= new Date(`${dataFinal}T23:59:59`));

      return pesquisaOk && statusOk && inicialOk && finalOk;
    });
  }, [historico, pesquisa, filtroStatus, dataInicial, dataFinal]);

  const resumo = useMemo(
    () => ({
      total: historico.length,
      finalizadas: historico.filter(
        (item) => item.status === "finalizada"
      ).length,
      comErro: historico.filter(
        (item) => item.status === "com_erro"
      ).length,
      problemas: historico.reduce(
        (total, item) => total + Number(item.erros || 0),
        0
      ),
    }),
    [historico]
  );

  async function alternarDetalhes(item) {
    if (registroAberto === item.id) {
      setRegistroAberto(null);
      return;
    }

    setRegistroAberto(item.id);

    if (detalhes[item.id]) return;

    setCarregandoDetalhe(item.id);
    setErro("");

    try {
      const resposta = await axios.get(
        `${API_CONFERENCIAS}/${item.id}`
      );

      setDetalhes((atual) => ({
        ...atual,
        [item.id]: resposta.data.conferencia,
      }));
    } catch (error) {
      console.error("Erro ao abrir detalhes:", error);
      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível abrir os detalhes."
      );
    } finally {
      setCarregandoDetalhe(null);
    }
  }

  async function excluirRegistro(item) {
    const confirmou = window.confirm(
      `Deseja excluir a conferência da NF ${item.nota}?`
    );

    if (!confirmou) return;

    try {
      await axios.delete(`${API_CONFERENCIAS}/${item.id}`);

      setHistorico((atual) =>
        atual.filter((registro) => registro.id !== item.id)
      );

      setRegistroAberto(null);
    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível excluir a conferência."
      );
    }
  }

  function limparFiltros() {
    setPesquisa("");
    setFiltroStatus("todos");
    setDataInicial("");
    setDataFinal("");
  }

  return (
    <div className="page-section">
      <section className="page-title">
        <div>
          <span>Consultas</span>
          <h1>Histórico de conferências</h1>
          <p>
            Consulte notas salvas no banco de dados e veja todas
            as pendências encontradas.
          </p>
        </div>
      </section>

      <section className="history-summary-grid">
        <article className="history-summary-card">
          <FaHistory />
          <div>
            <span>Total</span>
            <strong>{resumo.total}</strong>
          </div>
        </article>
        <article className="history-summary-card">
          <FaCheckCircle />
          <div>
            <span>Finalizadas</span>
            <strong>{resumo.finalizadas}</strong>
          </div>
        </article>
        <article className="history-summary-card">
          <FaExclamationTriangle />
          <div>
            <span>Com pendências</span>
            <strong>{resumo.comErro}</strong>
          </div>
        </article>
        <article className="history-summary-card">
          <FaTimesCircle />
          <div>
            <span>Problemas</span>
            <strong>{resumo.problemas}</strong>
          </div>
        </article>
      </section>

      <section className="content-card">
        <div className="filters-row">
          <div className="search-box large">
            <FaSearch />
            <input
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
              placeholder="Pesquisar nota ou fornecedor..."
            />
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={() => setMostrarFiltros((valor) => !valor)}
          >
            <FaFilter />
            Filtrar
          </button>
        </div>

        {mostrarFiltros && (
          <div className="history-filter-panel">
            <label>
              <span>Situação</span>
              <select
                value={filtroStatus}
                onChange={(event) =>
                  setFiltroStatus(event.target.value)
                }
              >
                <option value="todos">Todas</option>
                <option value="finalizada">Finalizadas</option>
                <option value="com_erro">Com pendências</option>
              </select>
            </label>

            <label>
              <span>Data inicial</span>
              <input
                type="date"
                value={dataInicial}
                onChange={(event) =>
                  setDataInicial(event.target.value)
                }
              />
            </label>

            <label>
              <span>Data final</span>
              <input
                type="date"
                value={dataFinal}
                onChange={(event) =>
                  setDataFinal(event.target.value)
                }
              />
            </label>

            <button
              type="button"
              className="button button-secondary"
              onClick={limparFiltros}
            >
              Limpar
            </button>
          </div>
        )}

        {erro && <div className="message error">{erro}</div>}

        {carregando ? (
          <div className="history-empty">
            <FaSpinner className="spinner" />
            <strong>Carregando histórico...</strong>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Fornecedor</th>
                  <th>Data da nota</th>
                  <th>Conferida em</th>
                  <th>Itens</th>
                  <th>Pendências</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {historicoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="history-empty">
                        <FaHistory />
                        <strong>Nenhuma conferência encontrada</strong>
                        <span>
                          Faça uma nova conferência para criar o
                          primeiro registro.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historicoFiltrado.map((item) => {
                    const detalhe = detalhes[item.id];

                    return [
                      <tr key={item.id}>
                        <td><strong>NF {item.nota}</strong></td>
                        <td>{item.fornecedor}</td>
                        <td>{item.dataNota || "-"}</td>
                        <td>
                          <span className="history-date">
                            <FaCalendarAlt />
                            {formatarDataHora(item.conferidoEm)}
                          </span>
                        </td>
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
                        <td>
                          <div className="history-actions">
                            <button
                              type="button"
                              className="history-details-button"
                              onClick={() => alternarDetalhes(item)}
                            >
                              {registroAberto === item.id
                                ? <FaChevronUp />
                                : <FaChevronDown />}
                              Detalhes
                            </button>

                            <button
                              type="button"
                              className="history-delete-button"
                              onClick={() => excluirRegistro(item)}
                              title="Excluir"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>,

                      registroAberto === item.id && (
                        <tr
                          key={`${item.id}-detalhes`}
                          className="history-details-row"
                        >
                          <td colSpan="9">
                            {carregandoDetalhe === item.id ? (
                              <div className="history-empty">
                                <FaSpinner className="spinner" />
                                <strong>Carregando detalhes...</strong>
                              </div>
                            ) : (
                              <div className="history-details">
                                <strong>
                                  Itens da NF {item.nota}
                                </strong>

                                <div className="history-items-table">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Código</th>
                                        <th>Descrição</th>
                                        <th>Quantidade</th>
                                        <th>Fator</th>
                                        <th>Volumes</th>
                                        <th>Situação</th>
                                        <th>Orientação</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(detalhe?.itens || []).map(
                                        (produto) => (
                                          <tr key={produto.id}>
                                            <td>{produto.codigo}</td>
                                            <td>
                                              <strong>
                                                {produto.descricao}
                                              </strong>
                                            </td>
                                            <td>
                                              {formatarNumero(
                                                produto.quantidade
                                              )}
                                            </td>
                                            <td>
                                              {formatarNumero(
                                                produto.fator
                                              )}
                                            </td>
                                            <td>
                                              {formatarNumero(
                                                produto.quantidadeCaixas
                                              )}
                                            </td>
                                            <td>
                                              <span
                                                className={
                                                  produto.status === "correto"
                                                    ? "status-badge success"
                                                    : produto.status ===
                                                        "sem_fator" ||
                                                      produto.status ===
                                                        "fator_suspeito"
                                                    ? "status-badge warning"
                                                    : "status-badge danger"
                                                }
                                              >
                                                {textoStatusItem(
                                                  produto.status
                                                )}
                                              </span>
                                            </td>
                                            <td>
                                              {produto.observacao || "-"}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ),
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .history-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .history-summary-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px;
          background: #fff;
          border: 1px solid #e5eaf0;
          border-radius: 16px;
        }
        .history-summary-card > svg {
          font-size: 22px;
        }
        .history-summary-card span {
          display: block;
          color: #697386;
          font-size: 13px;
        }
        .history-summary-card strong {
          display: block;
          margin-top: 4px;
          font-size: 26px;
        }
        .history-filter-panel {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 14px;
          align-items: end;
          padding: 18px;
          margin: 16px 0;
          background: #f8fafc;
          border-radius: 14px;
        }
        .history-filter-panel label span {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 700;
        }
        .history-filter-panel input,
        .history-filter-panel select {
          width: 100%;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid #dce3eb;
          border-radius: 10px;
          background: #fff;
        }
        .history-date,
        .history-actions,
        .history-details-button,
        .history-delete-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .history-actions {
          gap: 8px;
        }
        .history-details-button,
        .history-delete-button {
          min-height: 36px;
          padding: 0 11px;
          border: 1px solid #dce3eb;
          border-radius: 9px;
          background: #fff;
          cursor: pointer;
          font-weight: 700;
        }
        .history-delete-button {
          width: 36px;
          padding: 0;
          color: #c53b3b;
          border-color: #f1cccc;
          justify-content: center;
        }
        .history-details-row td {
          padding: 0 !important;
          background: #f8fafc;
        }
        .history-details {
          padding: 22px;
        }
        .history-items-table {
          overflow-x: auto;
          margin-top: 15px;
          background: #fff;
          border: 1px solid #e5eaf0;
          border-radius: 12px;
        }
        .history-items-table table {
          min-width: 950px;
        }
        .history-empty {
          display: flex;
          min-height: 220px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #7a8494;
          text-align: center;
        }
        .status-badge.warning {
          background: #fff4d6;
          color: #9a6700;
        }
        @media (max-width: 1050px) {
          .history-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .history-filter-panel {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .history-summary-grid,
          .history-filter-panel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Historico;

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaBoxOpen,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationCircle,
  FaFileExcel,
  FaSave,
  FaSearch,
  FaSyncAlt,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/produtos`
    : "http://localhost:3001/api/produtos";

function obterCabecalhoAutenticacao() {
  const token = localStorage.getItem("confereHost:token");

  return {
    Authorization: `Bearer ${token}`,
  };
}

function Produtos() {
  const [arquivo, setArquivo] = useState(null);
  const [carregandoImportacao, setCarregandoImportacao] =
    useState(false);

  const [resultadoImportacao, setResultadoImportacao] =
    useState(null);

  const [erroImportacao, setErroImportacao] = useState("");

  const [produtos, setProdutos] = useState([]);
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalProdutos, setTotalProdutos] = useState(0);

  const [carregandoProdutos, setCarregandoProdutos] =
    useState(false);

  const [erroProdutos, setErroProdutos] = useState("");
  const [fatores, setFatores] = useState({});
  const [fatoresOriginais, setFatoresOriginais] = useState({});
  const [salvandoFatores, setSalvandoFatores] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [tipoMensagem, setTipoMensagem] = useState("info");

  const carregarProdutos = useCallback(async () => {
    try {
      setCarregandoProdutos(true);
      setErroProdutos("");

      const resposta = await axios.get(API_URL, {
        params: {
          busca: buscaAplicada,
          pagina,
        },
        headers: obterCabecalhoAutenticacao(),
      });

      const dados = resposta.data;

      setProdutos(dados.produtos || []);
      setTotalPaginas(dados.paginacao?.totalPaginas || 1);
      setTotalProdutos(dados.paginacao?.total || 0);

      const fatoresRecebidos = {};

      for (const produto of dados.produtos || []) {
        fatoresRecebidos[produto.id] =
          produto.fator === null || produto.fator === undefined
            ? ""
            : String(produto.fator);
      }

      setFatores(fatoresRecebidos);
      setFatoresOriginais(fatoresRecebidos);
    } catch (error) {
      console.error(error);

      setErroProdutos(
        error.response?.data?.mensagem ||
          "Não foi possível carregar os produtos."
      );
    } finally {
      setCarregandoProdutos(false);
    }
  }, [buscaAplicada, pagina]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const normalizarFator = useCallback((valor) => {
    return String(valor ?? "").trim().replace(",", ".");
  }, []);

  const fatorFoiAlterado = useCallback(
    (id) => {
      const fatorAtual = normalizarFator(fatores[id]);
      const fatorOriginal = normalizarFator(fatoresOriginais[id]);

      return fatorAtual !== fatorOriginal;
    },
    [fatores, fatoresOriginais, normalizarFator]
  );

  const totalAlteracoes = useMemo(() => {
    return produtos.filter((produto) =>
      fatorFoiAlterado(produto.id)
    ).length;
  }, [produtos, fatorFoiAlterado]);

  function selecionarArquivo(event) {
    const arquivoSelecionado = event.target.files?.[0] || null;

    setArquivo(arquivoSelecionado);
    setResultadoImportacao(null);
    setErroImportacao("");
  }

  async function importarProdutos() {
    if (!arquivo) {
      setErroImportacao("Selecione o relatório de produtos.");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      setCarregandoImportacao(true);
      setErroImportacao("");
      setResultadoImportacao(null);

      const resposta = await axios.post(
        `${API_URL}/importar`,
        formData,
        {
          headers: obterCabecalhoAutenticacao(),
        }
      );

      setResultadoImportacao(resposta.data);
      setPagina(1);
      setArquivo(null);

      await carregarProdutos();
    } catch (error) {
      console.error(error);

      setErroImportacao(
        error.response?.data?.mensagem ||
          "Não foi possível importar os produtos."
      );
    } finally {
      setCarregandoImportacao(false);
    }
  }

  function pesquisar(event) {
    event.preventDefault();

    setPagina(1);
    setBuscaAplicada(buscaDigitada.trim());
  }

  function limparPesquisa() {
    setBuscaDigitada("");
    setBuscaAplicada("");
    setPagina(1);
  }

  function alterarFator(id, valor) {
    setFatores((estadoAnterior) => ({
      ...estadoAnterior,
      [id]: valor,
    }));

    setMensagem("");
  }

  async function salvarTodosFatores() {
    const alteracoes = produtos
      .filter((produto) => fatorFoiAlterado(produto.id))
      .map((produto) => ({
        id: produto.id,
        fator: fatores[produto.id],
      }));

    if (alteracoes.length === 0) {
      setTipoMensagem("info");
      setMensagem("Nenhum fator foi alterado.");
      return;
    }

    const fatorInvalido = alteracoes.some((alteracao) => {
      const fator = Number(normalizarFator(alteracao.fator));

      return !Number.isFinite(fator) || fator <= 0;
    });

    if (fatorInvalido) {
      setTipoMensagem("erro");
      setMensagem(
        "Todos os fatores alterados precisam ser maiores que zero."
      );

      return;
    }

    try {
      setSalvandoFatores(true);
      setMensagem("");

      const resposta = await axios.patch(
        `${API_URL}/fatores`,
        {
          alteracoes,
        },
        {
          headers: obterCabecalhoAutenticacao(),
        }
      );

      const novosFatoresOriginais = {
        ...fatoresOriginais,
      };

      for (const alteracao of alteracoes) {
        novosFatoresOriginais[alteracao.id] =
          alteracao.fator;
      }

      setFatoresOriginais(novosFatoresOriginais);
      setTipoMensagem("sucesso");
      setMensagem(
        resposta.data.mensagem ||
          `${alteracoes.length} fator(es) atualizado(s) com sucesso.`
      );
    } catch (error) {
      console.error(error);

      setTipoMensagem("erro");
      setMensagem(
        error.response?.data?.mensagem ||
          "Não foi possível salvar os fatores."
      );
    } finally {
      setSalvandoFatores(false);
    }
  }

  function fatorConfigurado(produtoId) {
    const fator = Number(normalizarFator(fatores[produtoId]));

    return Number.isFinite(fator) && fator > 0;
  }

  function obterEstiloLinha(produto) {
    const alterado = fatorFoiAlterado(produto.id);
    const configurado = fatorConfigurado(produto.id);

    if (alterado) {
      return styles.linhaAlterada;
    }

    if (!configurado) {
      return styles.linhaSemFator;
    }

    return undefined;
  }

  function obterEstiloMensagem() {
    if (tipoMensagem === "sucesso") {
      return {
        ...styles.mensagem,
        ...styles.mensagemSucesso,
      };
    }

    if (tipoMensagem === "erro") {
      return {
        ...styles.mensagem,
        ...styles.mensagemErro,
      };
    }

    return styles.mensagem;
  }

  return (
    <main style={styles.container}>
      <section style={styles.importacaoCard}>
        <div>
          <p style={styles.legenda}>Cadastro geral</p>

          <h1 style={styles.titulo}>Produtos</h1>

          <p style={styles.texto}>
            Importe o relatório de produtos do Host. O sistema atualizará
            produtos, estoque, preços e fatores automaticamente.
          </p>
        </div>

        <div style={styles.importacaoArea}>
          <label style={styles.arquivoLabel}>
            <FaFileExcel />

            <span>
              {arquivo
                ? arquivo.name
                : "Selecionar relatório de produtos com fator"}
            </span>

            <input
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={selecionarArquivo}
              style={styles.inputEscondido}
            />
          </label>

          <button
            type="button"
            onClick={importarProdutos}
            disabled={carregandoImportacao}
            style={{
              ...styles.botaoPrimario,
              opacity: carregandoImportacao ? 0.6 : 1,
              cursor: carregandoImportacao
                ? "not-allowed"
                : "pointer",
            }}
          >
            {carregandoImportacao ? (
              <>
                <FaSyncAlt /> Importando...
              </>
            ) : (
              <>
                <FaFileExcel /> Atualizar produtos do Host
              </>
            )}
          </button>
        </div>

        {erroImportacao && (
          <div style={styles.erro}>{erroImportacao}</div>
        )}

        {resultadoImportacao?.sucesso && (
          <div style={styles.sucesso}>
            <strong>Importação concluída.</strong>

            <span>
              Encontrados:{" "}
              {resultadoImportacao.resumo.encontrados}
            </span>

            <span>
              Novos: {resultadoImportacao.resumo.novos}
            </span>

            <span>
              Atualizados:{" "}
              {resultadoImportacao.resumo.atualizados}
            </span>

            <span>
              Fatores importados:{" "}
              {resultadoImportacao.resumo.fatoresImportados ?? 0}
            </span>

            <span>
              Sem fator:{" "}
              {resultadoImportacao.resumo.semFator ?? 0}
            </span>
          </div>
        )}
      </section>

      <section style={styles.listaCard}>
        <div style={styles.listaCabecalho}>
          <div>
            <p style={styles.legenda}>Produtos cadastrados</p>

            <h2 style={styles.subtitulo}>
              {totalProdutos.toLocaleString("pt-BR")} produtos
            </h2>
          </div>

          <div style={styles.acoesCabecalho}>
            <form onSubmit={pesquisar} style={styles.pesquisa}>
              <div style={styles.campoPesquisa}>
                <FaSearch />

                <input
                  type="text"
                  value={buscaDigitada}
                  onChange={(event) =>
                    setBuscaDigitada(event.target.value)
                  }
                  placeholder="Buscar por código, barras ou nome"
                  style={styles.inputPesquisa}
                />
              </div>

              <button
                type="submit"
                style={styles.botaoPesquisar}
              >
                Pesquisar
              </button>

              {buscaAplicada && (
                <button
                  type="button"
                  onClick={limparPesquisa}
                  style={styles.botaoSecundario}
                >
                  Limpar
                </button>
              )}
            </form>

            <button
              type="button"
              onClick={salvarTodosFatores}
              disabled={
                salvandoFatores || totalAlteracoes === 0
              }
              style={{
                ...styles.botaoSalvarTodos,
                opacity:
                  salvandoFatores || totalAlteracoes === 0
                    ? 0.6
                    : 1,
                cursor:
                  salvandoFatores || totalAlteracoes === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <FaSave />

              {salvandoFatores
                ? "Salvando..."
                : totalAlteracoes > 0
                  ? `Salvar alterações (${totalAlteracoes})`
                  : "Salvar alterações"}
            </button>
          </div>
        </div>

        {mensagem && (
          <div style={obterEstiloMensagem()}>
            {tipoMensagem === "sucesso" && <FaCheckCircle />}

            {tipoMensagem === "erro" && (
              <FaExclamationCircle />
            )}

            <span>{mensagem}</span>
          </div>
        )}

        {erroProdutos && (
          <div style={styles.erro}>{erroProdutos}</div>
        )}

        {carregandoProdutos ? (
          <div style={styles.estadoVazio}>
            <FaSyncAlt />
            <p>Carregando produtos...</p>
          </div>
        ) : produtos.length === 0 ? (
          <div style={styles.estadoVazio}>
            <FaBoxOpen />
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div style={styles.tabelaContainer}>
            <table style={styles.tabela}>
              <thead>
                <tr>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Unidade</th>
                  <th style={styles.th}>Estoque</th>
                  <th style={styles.th}>Fator</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {produtos.map((produto) => {
                  const alterado = fatorFoiAlterado(
                    produto.id
                  );

                  const configurado = fatorConfigurado(
                    produto.id
                  );

                  return (
                    <tr
                      key={produto.id}
                      style={obterEstiloLinha(produto)}
                    >
                      <td style={styles.td}>
                        <strong>{produto.codigo}</strong>
                      </td>

                      <td style={styles.td}>
                        {produto.descricao}
                      </td>

                      <td style={styles.td}>
                        {produto.unidade || "-"}
                      </td>

                      <td style={styles.td}>
                        {Number(
                          produto.estoque || 0
                        ).toLocaleString("pt-BR")}
                      </td>

                      <td style={styles.td}>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={fatores[produto.id] ?? ""}
                          onChange={(event) =>
                            alterarFator(
                              produto.id,
                              event.target.value
                            )
                          }
                          placeholder="Ex.: 12"
                          style={{
                            ...styles.inputFator,
                            ...(alterado
                              ? styles.inputFatorAlterado
                              : {}),
                          }}
                        />
                      </td>

                      <td style={styles.td}>
                        {alterado ? (
                          <span style={styles.statusAlterado}>
                            <FaSyncAlt />
                            Alterado
                          </span>
                        ) : configurado ? (
                          <span style={styles.statusOk}>
                            <FaCheckCircle />
                            Configurado
                          </span>
                        ) : (
                          <span style={styles.statusErro}>
                            <FaExclamationCircle />
                            Sem fator
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={styles.paginacao}>
          <button
            type="button"
            onClick={() =>
              setPagina((paginaAtual) =>
                Math.max(paginaAtual - 1, 1)
              )
            }
            disabled={pagina === 1}
            style={{
              ...styles.botaoPagina,
              opacity: pagina === 1 ? 0.5 : 1,
              cursor:
                pagina === 1 ? "not-allowed" : "pointer",
            }}
          >
            <FaChevronLeft />
            Anterior
          </button>

          <span style={styles.paginaTexto}>
            Página {pagina} de {totalPaginas}
          </span>

          <button
            type="button"
            onClick={() =>
              setPagina((paginaAtual) =>
                Math.min(
                  paginaAtual + 1,
                  totalPaginas
                )
              )
            }
            disabled={pagina >= totalPaginas}
            style={{
              ...styles.botaoPagina,
              opacity: pagina >= totalPaginas ? 0.5 : 1,
              cursor:
                pagina >= totalPaginas
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Próxima
            <FaChevronRight />
          </button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  container: {
    padding: "28px",
    display: "grid",
    gap: "24px",
  },

  importacaoCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "26px",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
  },

  legenda: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "600",
    textTransform: "uppercase",
  },

  titulo: {
    margin: "6px 0",
    fontSize: "28px",
    color: "#0f172a",
  },

  subtitulo: {
    margin: "5px 0 0",
    color: "#0f172a",
  },

  texto: {
    margin: 0,
    color: "#64748b",
  },

  importacaoArea: {
    marginTop: "22px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  arquivoLabel: {
    minWidth: "300px",
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "13px 15px",
    border: "1px dashed #94a3b8",
    borderRadius: "10px",
    cursor: "pointer",
    color: "#475569",
  },

  inputEscondido: {
    display: "none",
  },

  botaoPrimario: {
    border: "none",
    borderRadius: "10px",
    background: "#2563eb",
    color: "#ffffff",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "700",
  },

  sucesso: {
    marginTop: "18px",
    padding: "14px",
    borderRadius: "10px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
  },

  erro: {
    marginTop: "18px",
    padding: "14px",
    borderRadius: "10px",
    background: "#fee2e2",
    color: "#b91c1c",
  },

  mensagem: {
    marginTop: "18px",
    padding: "12px 14px",
    borderRadius: "10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "600",
  },

  mensagemSucesso: {
    background: "#dcfce7",
    color: "#166534",
  },

  mensagemErro: {
    background: "#fee2e2",
    color: "#b91c1c",
  },

  listaCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "26px",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
  },

  listaCabecalho: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },

  acoesCabecalho: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },

  botaoSalvarTodos: {
    minHeight: "42px",
    padding: "0 18px",
    border: "none",
    borderRadius: "9px",
    background: "#0f766e",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: "700",
  },

  pesquisa: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  campoPesquisa: {
    minWidth: "280px",
    padding: "0 13px",
    height: "42px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
  },

  inputPesquisa: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: "14px",
  },

  botaoPesquisar: {
    height: "42px",
    padding: "0 17px",
    border: "none",
    borderRadius: "9px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: "600",
    cursor: "pointer",
  },

  botaoSecundario: {
    height: "42px",
    padding: "0 17px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    background: "#ffffff",
    color: "#475569",
    fontWeight: "600",
    cursor: "pointer",
  },

  tabelaContainer: {
    marginTop: "22px",
    overflowX: "auto",
  },

  tabela: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "800px",
  },

  th: {
    padding: "13px",
    textAlign: "left",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: "12px",
    textTransform: "uppercase",
  },

  td: {
    padding: "14px 13px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontSize: "14px",
  },

  linhaAlterada: {
    background: "#ecfdf5",
  },

  linhaSemFator: {
    background: "#fff7ed",
  },

  inputFator: {
    width: "90px",
    padding: "9px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    outline: "none",
    background: "#ffffff",
  },

  inputFatorAlterado: {
    border: "1px solid #16a34a",
    boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.12)",
  },

  statusOk: {
    color: "#15803d",
    fontWeight: "700",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
  },

  statusErro: {
    color: "#dc2626",
    fontWeight: "700",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
  },

  statusAlterado: {
    color: "#047857",
    fontWeight: "700",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
  },

  estadoVazio: {
    minHeight: "220px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "28px",
  },

  paginacao: {
    marginTop: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "18px",
    flexWrap: "wrap",
  },

  botaoPagina: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },

  paginaTexto: {
    color: "#475569",
    fontWeight: "600",
  },
};

export default Produtos;
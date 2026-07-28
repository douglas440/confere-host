import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

import {
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFileExcel,
  FaFilter,
  FaSearch,
  FaSpinner,
  FaTimesCircle,
  FaUpload,
} from "react-icons/fa";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

const API_PRODUTOS = `${API_URL}/api/produtos`;
const API_CONFERENCIAS = `${API_URL}/api/conferencias`;

function obterCabecalhoAutenticacao() {
  const token = localStorage.getItem("confereHost:token");

  return {
    Authorization: `Bearer ${token}`,
  };
}

function obterLojaIdLogada() {
  try {
    const usuario = JSON.parse(
      localStorage.getItem("confereHost:usuario")
    );

    return usuario?.loja_id || "sem-loja";
  } catch {
    return "sem-loja";
  }
}


const CHAVE_CONFERENCIA =
  `confereHost:conferenciaAtual:v4:${obterLojaIdLogada()}`;

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
    localStorage.removeItem(CHAVE_CONFERENCIA);
    return null;
  }
}

function Conferencia() {
  const inputRef = useRef(null);
  const recalculoInicialExecutado = useRef(false);

  const conferenciaSalva = useMemo(
    () => carregarConferenciaSalva(),
    []
  );

  const [arquivo, setArquivo] = useState(null);

  const [notas, setNotas] = useState(
    () => conferenciaSalva?.notas || []
  );

  const [pesquisa, setPesquisa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [mensagem, setMensagem] = useState(
    () => conferenciaSalva?.mensagem || ""
  );

  const [erro, setErro] = useState("");

  const [carregandoArquivo, setCarregandoArquivo] =
    useState(false);

  const [conferindo, setConferindo] = useState(false);

  const [conferenciaRealizada, setConferenciaRealizada] =
    useState(
      () => Boolean(conferenciaSalva?.conferenciaRealizada)
    );

  useEffect(() => {
    if (notas.length === 0) {
      localStorage.removeItem(CHAVE_CONFERENCIA);
      return;
    }

    try {
      localStorage.setItem(
        CHAVE_CONFERENCIA,
        JSON.stringify({
          notas,
          conferenciaRealizada,
          mensagem,
          salvoEm: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error("Erro ao salvar conferência:", error);
    }
  }, [notas, conferenciaRealizada, mensagem]);


  useEffect(() => {
    if (
      recalculoInicialExecutado.current ||
      !conferenciaSalva?.notas?.length
    ) {
      return;
    }

    recalculoInicialExecutado.current = true;
    iniciarConferencia(conferenciaSalva.notas, false);
  }, []);

  function limparTexto(valor) {
    if (valor === null || valor === undefined) {
      return "";
    }

    return String(valor).trim();
  }

  function converterNumeroBrasileiro(valor) {
    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {
      return 0;
    }

    if (typeof valor === "number") {
      return Number.isFinite(valor) ? valor : 0;
    }

    let texto = String(valor)
      .trim()
      .replace(/R\$/gi, "")
      .replace(/\s/g, "");

    if (!texto) {
      return 0;
    }

    if (texto.includes(",") && texto.includes(".")) {
      texto = texto.replace(/\./g, "").replace(",", ".");
    } else if (texto.includes(",")) {
      texto = texto.replace(",", ".");
    }

    const numero = Number(texto);

    return Number.isFinite(numero) ? numero : 0;
  }

  function pareceData(valor) {
    const texto = limparTexto(valor);

    return /^\d{2}\/\d{2}\/\d{4}$/.test(texto);
  }

  function normalizarCodigo(valor) {
    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {
      return "";
    }

    const texto = String(valor).trim();

    if (/^\d+(\.0+)?$/.test(texto)) {
      return texto.replace(/\.0+$/, "");
    }

    return texto;
  }

  function normalizarCodigoComparacao(valor) {
    const codigo = normalizarCodigo(valor);

    if (/^\d+$/.test(codigo)) {
      return codigo.replace(/^0+(?=\d)/, "");
    }

    return codigo.toLowerCase();
  }

  function numerosSaoIguais(numero1, numero2) {
    const diferenca = Math.abs(
      Number(numero1) - Number(numero2)
    );

    return diferenca < 0.0001;
  }

  function produtoAceitaQuantidadeDecimal(produto, item) {
    const unidade = limparTexto(produto?.unidade)
      .toUpperCase()
      .replace(/\./g, "");

    const descricao = limparTexto(
      produto?.descricao || item?.descricao
    ).toUpperCase();

    const unidadesPesaveis = [
      "KG", "KILO", "QUILO", "KILOGRAMA",
      "KILOGRAMAS", "G", "GR", "GRAMA", "GRAMAS"
    ];

    if (unidadesPesaveis.includes(unidade)) {
      return true;
    }

    return (
      /(?:^|\s)(KG|KILO|QUILO|KILOGRAMA|GR|GRAMA)(?:\s|$)/.test(
        descricao
      ) ||
      descricao.endsWith("KG") ||
      descricao.includes(" KG ")
    );
  }

  function lerRelatorio(linhas) {
    const notasEncontradas = [];
    let notaAtual = null;

    linhas.forEach((linha, indice) => {
      if (!Array.isArray(linha)) {
        return;
      }

      const primeiraColuna = limparTexto(linha[0]);
      const codigoProduto = linha[1];
      const numeroNota = limparTexto(linha[2]);
      const descricaoProduto = limparTexto(linha[4]);
      const fornecedor = limparTexto(linha[8]);
      const quantidade = linha[11];
      const valorUnitario = linha[14];
      const valorTotalLinha = linha[33];

      const linhaDeNota =
        pareceData(primeiraColuna) &&
        numeroNota &&
        fornecedor;

      if (linhaDeNota) {
        notaAtual = {
          id: `${numeroNota}-${indice}`,
          data: primeiraColuna,
          numero: numeroNota,
          fornecedor,
          valorTotal:
            converterNumeroBrasileiro(valorTotalLinha),
          status: "aguardando",
          itens: [],
        };

        notasEncontradas.push(notaAtual);
        return;
      }

      const linhaDeItem =
        notaAtual &&
        primeiraColuna &&
        codigoProduto !== null &&
        codigoProduto !== undefined &&
        descricaoProduto;

      if (!linhaDeItem) {
        return;
      }

      notaAtual.itens.push({
        id: `${notaAtual.numero}-${indice}`,
        numeroItem: primeiraColuna,
        codigo: normalizarCodigo(codigoProduto),
        descricao: descricaoProduto,
        quantidade:
          converterNumeroBrasileiro(quantidade),
        valorUnitario:
          converterNumeroBrasileiro(valorUnitario),
        valorTotal:
          converterNumeroBrasileiro(valorTotalLinha),

        produtoId: null,
        produtoEncontrado: false,
        fator: null,
        quantidadeCaixas: null,
        status: "aguardando",
        observacao: "Aguardando conferência.",
      });
    });

    return notasEncontradas.filter(
      (nota) => nota.itens.length > 0
    );
  }

  async function selecionarArquivo(event) {
    const arquivoSelecionado =
      event.target.files?.[0];

    if (!arquivoSelecionado) {
      return;
    }

    setArquivo(arquivoSelecionado);
    setNotas([]);
    setMensagem("");
    setErro("");
    setPesquisa("");
    setFiltroStatus("todos");
    setConferenciaRealizada(false);
    setCarregandoArquivo(true);

    try {
      const dados =
        await arquivoSelecionado.arrayBuffer();

      const workbook = XLSX.read(dados, {
        type: "array",
        cellDates: false,
      });

      if (!workbook.SheetNames.length) {
        setErro(
          "O arquivo não possui nenhuma planilha."
        );
        return;
      }

      const nomeAba = workbook.SheetNames[0];
      const aba = workbook.Sheets[nomeAba];

      const linhas = XLSX.utils.sheet_to_json(aba, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      });

      const notasEncontradas =
        lerRelatorio(linhas);

      if (notasEncontradas.length === 0) {
        setErro(
          "Nenhuma nota com itens foi encontrada. Confira se o arquivo é o relatório de compras por itens."
        );
        return;
      }

      const totalItens =
        notasEncontradas.reduce(
          (total, nota) =>
            total + nota.itens.length,
          0
        );

      setNotas(notasEncontradas);

      setMensagem(
        `${notasEncontradas.length} nota(s) e ${totalItens} item(ns) encontrados. Iniciando conferência...`
      );

      await iniciarConferencia(notasEncontradas);
    } catch (errorLeitura) {
      console.error(
        "Erro ao ler relatório:",
        errorLeitura
      );

      setErro(
        "Não foi possível ler o relatório. Verifique se o arquivo está no formato XLS, XLSX ou CSV."
      );
    } finally {
      setCarregandoArquivo(false);
      event.target.value = "";
    }
  }
  async function iniciarConferencia(
    notasRecebidas = null,
    salvarNoHistorico = true
  ) {
    const notasParaConferir = Array.isArray(notasRecebidas)
      ? notasRecebidas
      : notas;

    if (notasParaConferir.length === 0) {
      setErro("Importe primeiro um relatório do Host.");
      return;
    }

    try {
      setConferindo(true);
      setErro("");
      setMensagem("");

      const codigosUnicos = [
        ...new Set(
          notasParaConferir
            .flatMap((nota) =>
              nota.itens.map((item) =>
                normalizarCodigo(item.codigo)
              )
            )
            .filter(Boolean)
        ),
      ];

      const resposta = await axios.post(
        `${API_PRODUTOS}/buscar-codigos`,
        {
          codigos: codigosUnicos,
        },
        {
          headers: obterCabecalhoAutenticacao(),
        }
      );

      const produtosRecebidos =
        resposta.data?.produtos || [];

      const totalSolicitados =
        Number(resposta.data?.solicitados) ||
        codigosUnicos.length;

      const totalEncontrados =
        Number(resposta.data?.encontrados) ||
        produtosRecebidos.length;

      const produtosPorCodigo = new Map();

      produtosRecebidos.forEach((produto) => {
        produtosPorCodigo.set(
          normalizarCodigoComparacao(produto.codigo),
          produto
        );
      });

      const notasConferidas = notasParaConferir.map((nota) => {
        const itensConferidos = nota.itens.map((item) => {
          const codigoNormalizado =
            normalizarCodigoComparacao(item.codigo);

          const produto =
            produtosPorCodigo.get(codigoNormalizado);

          if (!produto) {
            return {
              ...item,
              produtoId: null,
              produtoEncontrado: false,
              fator: null,
              quantidadeCaixas: null,
              status: "produto_nao_encontrado",
              observacao:
                "Produto não cadastrado. Importe ou cadastre este código na tela de Produtos.",
            };
          }

          const fator = Number(
            String(produto.fator ?? "")
              .replace(",", ".")
              .trim()
          );

          if (!Number.isFinite(fator) || fator <= 0) {
            return {
              ...item,
              produtoId: produto.id,
              produtoEncontrado: true,
              fator: null,
              quantidadeCaixas: null,
              status: "sem_fator",
              observacao:
                "Produto sem fator. Cadastre ou corrija o fator deste produto na tela de Produtos.",
            };
          }

          const quantidade = Number(item.quantidade);
          const quantidadeValida =
            Number.isFinite(quantidade);

          const quantidadeCaixas =
            quantidadeValida && fator > 0
              ? quantidade / fator
              : null;

          const aceitaDecimal =
            produtoAceitaQuantidadeDecimal(produto, item);

          const fatorUnitario = numerosSaoIguais(fator, 1);

          const quantidadeCorreta =
            quantidadeValida &&
            quantidade > 0 &&
            Number.isFinite(quantidadeCaixas) &&
            (
              fatorUnitario ||
              aceitaDecimal ||
              numerosSaoIguais(
                quantidadeCaixas,
                Math.round(quantidadeCaixas)
              )
            );

          if (!quantidadeCorreta) {
            const fatorSuspeito =
              Number.isFinite(quantidadeCaixas) &&
              quantidadeCaixas > 0 &&
              quantidadeCaixas < 1;

            if (fatorSuspeito) {
              return {
                ...item,
                produtoId: produto.id,
                produtoEncontrado: true,
                unidade: produto.unidade || "",
                fator,
                quantidadeCaixas,
                status: "fator_suspeito",
                observacao:
                  `Fator pode estar cadastrado incorretamente. A quantidade ${formatarQuantidade(
                    quantidade
                  )} é menor que um volume do fator ${formatarQuantidade(
                    fator
                  )}, resultando em apenas ${formatarQuantidade(
                    quantidadeCaixas
                  )} volume(s). Revise o fator do produto.`,
              };
            }

            return {
              ...item,
              produtoId: produto.id,
              produtoEncontrado: true,
              unidade: produto.unidade || "",
              fator,
              quantidadeCaixas,
              status: "volume_incompleto",
              observacao:
                `Quantidade não fecha um volume completo. ${formatarQuantidade(
                  quantidade
                )} ÷ ${formatarQuantidade(
                  fator
                )} = ${formatarQuantidade(
                  quantidadeCaixas
                )} volume(s). Confira a quantidade lançada na nota.`,
            };
          }

          if (fatorUnitario || aceitaDecimal) {
            return {
              ...item,
              produtoId: produto.id,
              produtoEncontrado: true,
              unidade: produto.unidade || "",
              fator,
              quantidadeCaixas,
              status: "correto",
              observacao:
                fatorUnitario
                  ? `Fator 1: a quantidade ${formatarQuantidade(
                      quantidade
                    )} é válida, inclusive quando decimal.`
                  : `Produto vendido por peso. A quantidade decimal de ${formatarQuantidade(
                      quantidade
                    )} é válida.`,
            };
          }

          return {
            ...item,
            produtoId: produto.id,
            produtoEncontrado: true,
            unidade: produto.unidade || "",
            fator,
            quantidadeCaixas:
              Math.round(quantidadeCaixas),
            status: "correto",
            observacao:
              `${formatarQuantidade(
                quantidade
              )} unidade(s) correspondem a ${formatarQuantidade(
                Math.round(quantidadeCaixas)
              )} volume(s) completo(s).`,
          };
        });

        const temErro = itensConferidos.some(
          (item) =>
            item.status === "produto_nao_encontrado" ||
            item.status === "sem_fator" ||
            item.status === "volume_incompleto" ||
            item.status === "fator_suspeito"
        );

        return {
          ...nota,
          itens: itensConferidos,
          status: temErro ? "com_erro" : "correta",
        };
      });

      const totalItens = notasConferidas.reduce(
        (total, nota) => total + nota.itens.length,
        0
      );

      const totalErros = notasConferidas.reduce(
        (total, nota) =>
          total +
          nota.itens.filter(
            (item) => item.status !== "correto"
          ).length,
        0
      );

      setNotas(notasConferidas);
      setConferenciaRealizada(true);

      if (salvarNoHistorico) {
        try {
          const respostaHistorico = await axios.post(
            API_CONFERENCIAS,
            { notas: notasConferidas },
            {
              headers: obterCabecalhoAutenticacao(),
            }
          );

          console.log(
            respostaHistorico.data?.mensagem ||
              "Conferência salva no histórico."
          );
        } catch (erroHistorico) {
          console.error(
            "Conferência concluída, mas não salva no histórico:",
            erroHistorico
          );

          setErro(
            erroHistorico.response?.data?.mensagem ||
              "A conferência foi concluída, mas não foi possível salvá-la no histórico do MySQL."
          );
        }
      }

      if (totalErros === 0) {
        setMensagem(
          `Conferência concluída. Os ${totalItens} itens estão corretos.`
        );
      } else {
        setMensagem(
          `Conferência concluída. ${totalEncontrados} de ${totalSolicitados} código(s) foram localizados e ${totalErros} item(ns) precisam de atenção.`
        );
      }
    } catch (errorConferencia) {
      console.error(
        "Erro ao iniciar conferência:",
        errorConferencia
      );

      setErro(
        errorConferencia.response?.data?.mensagem ||
          errorConferencia.message ||
          "Não foi possível realizar a conferência."
      );
    } finally {
      setConferindo(false);
    }
  }

  const resumo = useMemo(() => {
    const todosItens = notas.flatMap(
      (nota) => nota.itens
    );

    const valorTotal = notas.reduce(
      (total, nota) =>
        total + Number(nota.valorTotal || 0),
      0
    );

    const corretos = todosItens.filter(
      (item) => item.status === "correto"
    ).length;

    const volumesIncompletos = todosItens.filter(
      (item) => item.status === "volume_incompleto"
    ).length;

    const fatoresSuspeitos = todosItens.filter(
      (item) => item.status === "fator_suspeito"
    ).length;

    const semFator = todosItens.filter(
      (item) => item.status === "sem_fator"
    ).length;

    const naoEncontrados = todosItens.filter(
      (item) =>
        item.status === "produto_nao_encontrado"
    ).length;

    const totalErros =
      volumesIncompletos +
      fatoresSuspeitos +
      semFator +
      naoEncontrados;

    return {
      totalNotas: notas.length,
      totalItens: todosItens.length,
      valorTotal,
      corretos,
      volumesIncompletos,
      fatoresSuspeitos,
      semFator,
      naoEncontrados,
      totalErros,
    };
  }, [notas]);

  const notasFiltradas = useMemo(() => {
    const termo = pesquisa
      .trim()
      .toLowerCase();

    return notas
      .map((nota) => {
        const notaEncontrada =
          nota.numero
            .toLowerCase()
            .includes(termo) ||
          nota.fornecedor
            .toLowerCase()
            .includes(termo);

        let itensFiltrados = nota.itens;

        if (termo && !notaEncontrada) {
          itensFiltrados =
            itensFiltrados.filter((item) => {
              return (
                item.codigo
                  .toLowerCase()
                  .includes(termo) ||
                item.descricao
                  .toLowerCase()
                  .includes(termo)
              );
            });
        }

        if (filtroStatus !== "todos") {
          if (filtroStatus === "erros") {
            itensFiltrados =
              itensFiltrados.filter(
                (item) =>
                  item.status !== "correto" &&
                  item.status !== "aguardando"
              );
          } else {
            itensFiltrados =
              itensFiltrados.filter(
                (item) =>
                  item.status === filtroStatus
              );
          }
        }

        if (
          termo &&
          !notaEncontrada &&
          itensFiltrados.length === 0
        ) {
          return null;
        }

        if (
          filtroStatus !== "todos" &&
          itensFiltrados.length === 0
        ) {
          return null;
        }

        return {
          ...nota,
          itens: itensFiltrados,
        };
      })
      .filter(Boolean);
  }, [notas, pesquisa, filtroStatus]);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }

  function formatarQuantidade(valor) {
    return Number(valor || 0).toLocaleString(
      "pt-BR",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }
    );
  }

  function obterStatusItem(status) {
    if (status === "correto") {
      return {
        texto: "Correto",
        icone: <FaCheckCircle />,
        estilo: styles.statusCorreto,
      };
    }

    if (status === "volume_incompleto") {
      return {
        texto: "Quantidade não fecha o volume",
        icone: <FaTimesCircle />,
        estilo: styles.statusErro,
      };
    }

    if (status === "fator_suspeito") {
      return {
        texto: "Revisar fator cadastrado",
        icone: <FaExclamationTriangle />,
        estilo: styles.statusAtencao,
      };
    }

    if (status === "sem_fator") {
      return {
        texto: "Produto sem fator",
        icone: <FaExclamationTriangle />,
        estilo: styles.statusAtencao,
      };
    }

    if (
      status === "produto_nao_encontrado"
    ) {
      return {
        texto: "Produto não cadastrado",
        icone: <FaTimesCircle />,
        estilo: styles.statusErro,
      };
    }

    return {
      texto: "Aguardando",
      icone: <FaSpinner />,
      estilo: styles.statusAguardando,
    };
  }

  function obterEstiloLinha(status) {
    if (status === "correto") {
      return styles.linhaCorreta;
    }

    if (
      status === "sem_fator" ||
      status === "fator_suspeito"
    ) {
      return styles.linhaAtencao;
    }

    if (
      status === "volume_incompleto" ||
      status === "produto_nao_encontrado"
    ) {
      return styles.linhaErro;
    }

    return undefined;
  }

  function novaImportacao() {
    localStorage.removeItem(CHAVE_CONFERENCIA);

    setArquivo(null);
    setNotas([]);
    setPesquisa("");
    setFiltroStatus("todos");
    setMensagem("");
    setErro("");
    setConferenciaRealizada(false);

    inputRef.current?.click();
  }

  return (
    <main style={styles.container}>
      <section style={styles.tituloPagina}>
        <div>
          <p style={styles.legenda}>
            Auditoria de entradas
          </p>

          <h1 style={styles.titulo}>
            Nova conferência
          </h1>

          <p style={styles.texto}>
            Importe o relatório de compras por
            itens. O sistema separará as notas e
            comparará as quantidades com os fatores
            cadastrados.
          </p>
        </div>
      </section>

      <section style={styles.cardImportacao}>
        <div style={styles.iconeUpload}>
          <FaFileExcel />
        </div>

        <div style={styles.importacaoConteudo}>
          <h2 style={styles.subtitulo}>
            Importar relatório diário
          </h2>

          <p style={styles.texto}>
            Use o relatório de compras por itens
            exportado pelo Host.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            hidden
            onChange={selecionarArquivo}
          />

          <button
            type="button"
            style={styles.areaUpload}
            onClick={() =>
              inputRef.current?.click()
            }
            disabled={carregandoArquivo}
          >
            {carregandoArquivo ? (
              <FaSpinner />
            ) : (
              <FaUpload />
            )}

            <div>
              <strong>
                {carregandoArquivo
                  ? "Lendo relatório..."
                  : arquivo
                    ? arquivo.name
                    : "Clique para selecionar o relatório"}
              </strong>

              <span style={styles.textoUpload}>
                Formatos aceitos: XLS, XLSX e CSV
              </span>
            </div>
          </button>

          <div style={styles.acoesImportacao}>
            <button
              type="button"
              onClick={() => iniciarConferencia()}
              disabled={
                notas.length === 0 || conferindo
              }
              style={{
                ...styles.botaoPrimario,
                opacity:
                  notas.length === 0 || conferindo
                    ? 0.6
                    : 1,
                cursor:
                  notas.length === 0 || conferindo
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {conferindo ? (
                <>
                  <FaSpinner />
                  Conferindo produtos...
                </>
              ) : (
                <>
                  <FaClipboardCheck />
                  Iniciar conferência
                </>
              )}
            </button>

            {notas.length > 0 && (
              <button
                type="button"
                onClick={novaImportacao}
                style={styles.botaoSecundario}
              >
                <FaUpload />
                Importar outro relatório
              </button>
            )}
          </div>

          {mensagem && (
            <div style={styles.mensagemSucesso}>
              <FaCheckCircle />
              <span>{mensagem}</span>
            </div>
          )}

          {erro && (
            <div style={styles.mensagemErro}>
              <FaExclamationTriangle />
              <span>{erro}</span>
            </div>
          )}
        </div>
      </section>

      {notas.length > 0 && (
        <>
          <section style={styles.resumoGrid}>
            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Notas encontradas
              </span>

              <strong style={styles.resumoNumero}>
                {resumo.totalNotas}
              </strong>
            </article>

            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Itens encontrados
              </span>

              <strong style={styles.resumoNumero}>
                {resumo.totalItens}
              </strong>
            </article>

            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Itens corretos
              </span>

              <strong
                style={{
                  ...styles.resumoNumero,
                  color: "#15803d",
                }}
              >
                {resumo.corretos}
              </strong>
            </article>

            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Itens com erro
              </span>

              <strong
                style={{
                  ...styles.resumoNumero,
                  color: "#dc2626",
                }}
              >
                {resumo.totalErros}
              </strong>
            </article>

            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Sem fator
              </span>

              <strong
                style={{
                  ...styles.resumoNumero,
                  color: "#d97706",
                }}
              >
                {resumo.semFator}
              </strong>
            </article>

            <article style={styles.resumoCard}>
              <span style={styles.resumoLabel}>
                Valor total
              </span>

              <strong style={styles.resumoValor}>
                {formatarMoeda(resumo.valorTotal)}
              </strong>
            </article>
          </section>

          <section style={styles.listaCard}>
            <div style={styles.listaCabecalho}>
              <div>
                <p style={styles.legenda}>
                  Resultado da conferência
                </p>

                <h2 style={styles.subtitulo}>
                  Notas e produtos
                </h2>
              </div>

              <div style={styles.filtros}>
                <div style={styles.campoPesquisa}>
                  <FaSearch />

                  <input
                    type="text"
                    value={pesquisa}
                    onChange={(event) =>
                      setPesquisa(
                        event.target.value
                      )
                    }
                    placeholder="Nota, fornecedor, código ou produto"
                    style={styles.inputPesquisa}
                  />
                </div>

                <div style={styles.campoFiltro}>
                  <FaFilter />

                  <select
                    value={filtroStatus}
                    onChange={(event) =>
                      setFiltroStatus(
                        event.target.value
                      )
                    }
                    style={styles.selectFiltro}
                  >
                    <option value="todos">
                      Todos os itens
                    </option>

                    <option value="erros">
                      Somente erros
                    </option>

                    <option value="correto">
                      Corretos
                    </option>

                    <option value="volume_incompleto">
                      Quantidade não fecha o volume
                    </option>

                    <option value="fator_suspeito">
                      Revisar fator cadastrado
                    </option>

                    <option value="sem_fator">
                      Produto sem fator
                    </option>

                    <option value="produto_nao_encontrado">
                      Produto não cadastrado
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {notasFiltradas.length === 0 ? (
              <div style={styles.estadoVazio}>
                <FaBoxOpen />

                <h3>Nenhum resultado encontrado</h3>

                <p>
                  Altere a pesquisa ou o filtro
                  selecionado.
                </p>
              </div>
            ) : (
              <div style={styles.listaNotas}>
                {notasFiltradas.map((nota) => {
                  const itensComErro =
                    nota.itens.filter(
                      (item) =>
                        item.status !== "correto" &&
                        item.status !==
                          "aguardando"
                    ).length;

                  return (
                    <article
                      key={nota.id}
                      style={styles.notaCard}
                    >
                      <div
                        style={styles.notaCabecalho}
                      >
                        <div>
                          <span
                            style={styles.notaEtiqueta}
                          >
                            Nota fiscal
                          </span>

                          <h3
                            style={styles.notaNumero}
                          >
                            NF {nota.numero}
                          </h3>

                          <p style={styles.notaDados}>
                            {nota.fornecedor} •{" "}
                            {nota.data}
                          </p>
                        </div>

                        <div
                          style={
                            styles.notaResumoDireita
                          }
                        >
                          {conferenciaRealizada && (
                            <span
                              style={
                                itensComErro > 0
                                  ? styles.notaComErro
                                  : styles.notaCorreta
                              }
                            >
                              {itensComErro > 0 ? (
                                <>
                                  <FaExclamationTriangle />
                                  {itensComErro} erro(s)
                                </>
                              ) : (
                                <>
                                  <FaCheckCircle />
                                  Nota correta
                                </>
                              )}
                            </span>
                          )}

                          <span
                            style={styles.notaTotalLabel}
                          >
                            Valor da nota
                          </span>

                          <strong
                            style={styles.notaTotal}
                          >
                            {formatarMoeda(
                              nota.valorTotal
                            )}
                          </strong>
                        </div>
                      </div>

                      <div
                        style={
                          styles.tabelaContainer
                        }
                      >
                        <table style={styles.tabela}>
                          <thead>
                            <tr>
                              <th style={styles.th}>
                                Item
                              </th>

                              <th style={styles.th}>
                                Código
                              </th>

                              <th style={styles.th}>
                                Produto
                              </th>

                              <th style={styles.th}>
                                Quantidade
                              </th>

                              <th style={styles.th}>
                                Fator cadastrado
                              </th>

                              <th style={styles.th}>
                                Volumes
                              </th>

                              <th style={styles.th}>
                                Status
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {nota.itens.map(
                              (item) => {
                                const status =
                                  obterStatusItem(
                                    item.status
                                  );

                                return (
                                  <tr
                                    key={item.id}
                                    style={obterEstiloLinha(
                                      item.status
                                    )}
                                  >
                                    <td
                                      style={styles.td}
                                    >
                                      {
                                        item.numeroItem
                                      }
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      <strong>
                                        {item.codigo}
                                      </strong>
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      <strong>
                                        {
                                          item.descricao
                                        }
                                      </strong>

                                      {conferenciaRealizada && (
                                        <small
                                          style={
                                            styles.observacao
                                          }
                                        >
                                          {
                                            item.observacao
                                          }
                                        </small>
                                      )}
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      <span
                                        style={
                                          styles.quantidade
                                        }
                                      >
                                        {formatarQuantidade(
                                          item.quantidade
                                        )}
                                      </span>
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      {item.fator
                                        ? formatarQuantidade(
                                            item.fator
                                          )
                                        : "-"}
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      {item.quantidadeCaixas !==
                                        null &&
                                      Number.isFinite(
                                        item.quantidadeCaixas
                                      )
                                        ? formatarQuantidade(
                                            item.quantidadeCaixas
                                          )
                                        : "-"}
                                    </td>

                                    <td
                                      style={styles.td}
                                    >
                                      <span
                                        style={
                                          status.estilo
                                        }
                                      >
                                        {
                                          status.icone
                                        }

                                        {
                                          status.texto
                                        }
                                      </span>
                                    </td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const styles = {
  container: {
    padding: "28px",
    display: "grid",
    gap: "24px",
  },

  tituloPagina: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
  },

  legenda: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  titulo: {
    margin: "6px 0",
    color: "#0f172a",
    fontSize: "30px",
  },

  subtitulo: {
    margin: "5px 0",
    color: "#0f172a",
  },

  texto: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
  },

  cardImportacao: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "26px",
    boxShadow:
      "0 8px 30px rgba(15, 23, 42, 0.06)",
    display: "flex",
    gap: "22px",
    alignItems: "flex-start",
  },

  iconeUpload: {
    width: "58px",
    height: "58px",
    borderRadius: "14px",
    background: "#dcfce7",
    color: "#15803d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "27px",
    flexShrink: 0,
  },

  importacaoConteudo: {
    flex: 1,
  },

  areaUpload: {
    width: "100%",
    marginTop: "20px",
    padding: "22px",
    border: "2px dashed #cbd5e1",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "13px",
    cursor: "pointer",
    fontSize: "22px",
  },

  textoUpload: {
    display: "block",
    marginTop: "5px",
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "400",
  },

  acoesImportacao: {
    marginTop: "18px",
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  botaoPrimario: {
    minHeight: "44px",
    padding: "0 20px",
    border: "none",
    borderRadius: "9px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  botaoSecundario: {
    minHeight: "44px",
    padding: "0 20px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    background: "#ffffff",
    color: "#475569",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },

  mensagemSucesso: {
    marginTop: "18px",
    padding: "13px 15px",
    borderRadius: "10px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontWeight: "600",
  },

  mensagemErro: {
    marginTop: "18px",
    padding: "13px 15px",
    borderRadius: "10px",
    background: "#fee2e2",
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontWeight: "600",
  },

  resumoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "16px",
  },

  resumoCard: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "20px",
    boxShadow:
      "0 6px 24px rgba(15, 23, 42, 0.05)",
    border: "1px solid #f1f5f9",
  },

  resumoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "600",
  },

  resumoNumero: {
    display: "block",
    marginTop: "7px",
    color: "#0f172a",
    fontSize: "28px",
  },

  resumoValor: {
    display: "block",
    marginTop: "9px",
    color: "#0f172a",
    fontSize: "20px",
  },

  listaCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "26px",
    boxShadow:
      "0 8px 30px rgba(15, 23, 42, 0.06)",
  },

  listaCabecalho: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
  },

  filtros: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  campoPesquisa: {
    minWidth: "290px",
    height: "42px",
    padding: "0 13px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: "#64748b",
  },

  inputPesquisa: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: "14px",
  },

  campoFiltro: {
    height: "42px",
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#64748b",
  },

  selectFiltro: {
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#334155",
    fontWeight: "600",
  },

  listaNotas: {
    marginTop: "22px",
    display: "grid",
    gap: "20px",
  },

  notaCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    overflow: "hidden",
  },

  notaCabecalho: {
    padding: "18px 20px",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
  },

  notaEtiqueta: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
  },

  notaNumero: {
    margin: "4px 0",
    color: "#0f172a",
    fontSize: "21px",
  },

  notaDados: {
    margin: 0,
    color: "#64748b",
  },

  notaResumoDireita: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
  },

  notaTotalLabel: {
    color: "#64748b",
    fontSize: "12px",
  },

  notaTotal: {
    color: "#0f172a",
    fontSize: "19px",
  },

  notaCorreta: {
    marginBottom: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#15803d",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "700",
    fontSize: "12px",
  },

  notaComErro: {
    marginBottom: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#dc2626",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "700",
    fontSize: "12px",
  },

  tabelaContainer: {
    width: "100%",
    overflowX: "auto",
  },

  tabela: {
    width: "100%",
    minWidth: "1000px",
    borderCollapse: "collapse",
  },

  th: {
    padding: "13px 14px",
    textAlign: "left",
    color: "#64748b",
    fontSize: "12px",
    textTransform: "uppercase",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "14px",
    color: "#334155",
    fontSize: "14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },

  linhaCorreta: {
    background: "#f0fdf4",
  },

  linhaAtencao: {
    background: "#fffbeb",
  },

  linhaErro: {
    background: "#fef2f2",
  },

  quantidade: {
    display: "inline-block",
    minWidth: "50px",
    padding: "6px 9px",
    borderRadius: "7px",
    background: "#e0e7ff",
    color: "#3730a3",
    fontWeight: "700",
    textAlign: "center",
  },

  observacao: {
    display: "block",
    marginTop: "5px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "400",
  },

  statusCorreto: {
    color: "#15803d",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: "700",
  },

  statusAtencao: {
    color: "#d97706",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: "700",
  },

  statusErro: {
    color: "#dc2626",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: "700",
  },

  statusAguardando: {
    color: "#64748b",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: "700",
  },

  estadoVazio: {
    minHeight: "240px",
    marginTop: "22px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    textAlign: "center",
    fontSize: "28px",
  },
};

export default Conferencia;
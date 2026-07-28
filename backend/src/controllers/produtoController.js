import * as XLSX from "xlsx";
import pool from "../config/database.js";

function obterLojaId(req) {
  const lojaId = Number(req.usuario?.loja_id);

  if (!Number.isInteger(lojaId) || lojaId <= 0) {
    const erro = new Error("Loja do usuário não identificada.");
    erro.statusCode = 401;
    throw erro;
  }

  return lojaId;
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function limparCodigo(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "";
  }

  let texto = String(valor).trim();

  // Evita códigos convertidos para notação científica.
  if (/^\d+(\.0+)?$/.test(texto)) {
    texto = texto.replace(/\.0+$/, "");
  }

  return texto;
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return 0;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "");

  if (!texto) {
    return 0;
  }

  /*
   * Formatos aceitos:
   * 1.234,56
   * 1234,56
   * 1234.56
   */
  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : 0;
}

function converterEstoque(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return 0;
  }

  /*
   * O relatório apresenta:
   * estoque atual / estoque crítico
   *
   * Exemplo:
   * 12 / 0
   * -8 / 0
   */
  const texto = String(valor).trim();
  const estoqueAtual = texto.split("/")[0]?.trim() ?? "";

  return converterNumero(estoqueAtual);
}

function localizarColuna(cabecalhos, nomesPermitidos) {
  return cabecalhos.findIndex((cabecalho) => {
    return nomesPermitidos.some((nome) => {
      return (
        cabecalho === nome ||
        cabecalho.includes(nome)
      );
    });
  });
}

function criarMapeamento(cabecalho) {
  const colunas = cabecalho.map(normalizarTexto);

  return {
    codigo: localizarColuna(colunas, [
      "id_produto",
      "id produto",
      "codigo",
      "cod.",
      "cod",
    ]),

    codigoBarras: localizarColuna(colunas, [
      "gtin",
      "codigo de barras",
      "codigo barras",
      "cod. barras",
      "barras",
      "ean",
    ]),

    descricao: localizarColuna(colunas, [
      "nome do produto",
      "nome de produto",
      "nome produto",
      "descricao do produto",
      "descricao produto",
      "descricao",
      "produto",
      "nome",
    ]),

    unidade: localizarColuna(colunas, [
      "unidade",
      "unid",
      "und",
      "un",
    ]),

    margem: localizarColuna(colunas, [
      "margem",
    ]),

    estoque: localizarColuna(colunas, [
      "est / critco",
      "est / critico",
      "est/critco",
      "est/critico",
      "estoque",
      "saldo",
    ]),

    custo: localizarColuna(colunas, [
      "custo",
    ]),

    preco: localizarColuna(colunas, [
      "valor_vend",
      "valor vend",
      "preco",
      "valor de venda",
      "valor venda",
    ]),

    fator: localizarColuna(colunas, [
      "fator",
      "fator de conversao",
      "fator conversao",
    ]),
  };
}

function localizarCabecalho(linhas) {
  return linhas.findIndex((linha) => {
    if (!Array.isArray(linha)) {
      return false;
    }

    const mapeamento = criarMapeamento(linha);

    return (
      mapeamento.codigo !== -1 &&
      mapeamento.descricao !== -1
    );
  });
}

function valorDaLinha(linha, indice) {
  if (!Array.isArray(linha) || indice < 0) {
    return "";
  }

  return linha[indice] ?? "";
}

function linhaEhCabecalhoRepetido(codigo, descricao) {
  const codigoNormalizado = normalizarTexto(codigo);
  const descricaoNormalizada = normalizarTexto(descricao);

  return (
    codigoNormalizado === "codigo" ||
    descricaoNormalizada === "nome do produto" ||
    descricaoNormalizada === "produto" ||
    descricaoNormalizada === "descricao"
  );
}

function linhaDeveSerIgnorada(descricao) {
  const texto = normalizarTexto(descricao);

  return (
    !texto ||
    texto.startsWith("total") ||
    texto.startsWith("subtotal") ||
    texto.startsWith("relatorio de produtos") ||
    texto.startsWith("data/hora da impressao")
  );
}

export async function importarProdutos(req, res) {
  const lojaId = obterLojaId(req);

  if (!req.file) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nenhum arquivo foi enviado.",
    });
  }

  let conexao;

  try {
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: false,
      cellText: true,
    });

    if (!workbook.SheetNames.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O arquivo não possui nenhuma planilha.",
      });
    }

    const nomePrimeiraAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[nomePrimeiraAba];

    const linhas = XLSX.utils.sheet_to_json(planilha, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (!linhas.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A planilha está vazia.",
      });
    }

    const indiceCabecalho = localizarCabecalho(linhas);

    if (indiceCabecalho === -1) {
      const primeirasLinhas = linhas
        .slice(0, 15)
        .map((linha) => linha.filter(Boolean).join(" | "))
        .filter(Boolean);

      console.log(
        "Cabeçalhos encontrados no relatório:",
        primeirasLinhas
      );

      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Não foi possível localizar as colunas Código e Nome do produto.",
      });
    }

    const cabecalho = linhas[indiceCabecalho];
    const mapeamento = criarMapeamento(cabecalho);

    if (
      mapeamento.codigo === -1 ||
      mapeamento.descricao === -1
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "O relatório precisa possuir as colunas Código e Nome do produto.",
      });
    }

    const produtosPorCodigo = new Map();

    for (
      let indice = indiceCabecalho + 1;
      indice < linhas.length;
      indice += 1
    ) {
      const linha = linhas[indice];

      if (!Array.isArray(linha)) {
        continue;
      }

      const codigo = limparCodigo(
        valorDaLinha(linha, mapeamento.codigo)
      );

      const descricao = String(
        valorDaLinha(linha, mapeamento.descricao)
      ).trim();

      if (!codigo || !descricao) {
        continue;
      }

      if (linhaEhCabecalhoRepetido(codigo, descricao)) {
        continue;
      }

      if (linhaDeveSerIgnorada(descricao)) {
        continue;
      }

      const produto = {
        codigo,

        codigo_barras: limparCodigo(
          valorDaLinha(linha, mapeamento.codigoBarras)
        ),

        descricao,

        unidade: String(
          valorDaLinha(linha, mapeamento.unidade)
        )
          .trim()
          .toUpperCase(),

        margem: converterNumero(
          valorDaLinha(linha, mapeamento.margem)
        ),

        estoque: converterEstoque(
          valorDaLinha(linha, mapeamento.estoque)
        ),

        custo: converterNumero(
          valorDaLinha(linha, mapeamento.custo)
        ),

        preco: converterNumero(
          valorDaLinha(linha, mapeamento.preco)
        ),

        fator:
          mapeamento.fator >= 0
            ? converterNumero(
                valorDaLinha(linha, mapeamento.fator)
              )
            : null,
      };

      // Caso um código apareça novamente, mantém a última ocorrência.
      produtosPorCodigo.set(produto.codigo, produto);
    }

    const produtos = Array.from(produtosPorCodigo.values());

    if (!produtos.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Nenhum produto válido foi encontrado no arquivo.",
      });
    }

    conexao = await pool.getConnection();
    await conexao.beginTransaction();

    let novos = 0;
    let atualizados = 0;
    let fatoresImportados = 0;
    let semFator = 0;

    for (const produto of produtos) {
      const [existentes] = await conexao.execute(
        `
          SELECT id
          FROM produtos
          WHERE loja_id = ?
            AND codigo = ?
          LIMIT 1
        `,
        [lojaId, produto.codigo]
      );

      if (existentes.length > 0) {
        await conexao.execute(
          `
            UPDATE produtos
            SET
              codigo_barras = ?,
              descricao = ?,
              unidade = ?,
              margem = ?,
              estoque = ?,
              custo = ?,
              preco = ?,
              fator = CASE
                WHEN ? IS NOT NULL AND ? > 0 THEN ?
                ELSE fator
              END
            WHERE loja_id = ?
              AND codigo = ?
          `,
          [
            produto.codigo_barras || null,
            produto.descricao,
            produto.unidade || null,
            produto.margem,
            produto.estoque,
            produto.custo,
            produto.preco,
            produto.fator,
            produto.fator,
            produto.fator,
            lojaId,
            produto.codigo,
          ]
        );

        atualizados += 1;
      } else {
        await conexao.execute(
          `
            INSERT INTO produtos (
              loja_id,
              codigo,
              codigo_barras,
              descricao,
              unidade,
              margem,
              estoque,
              custo,
              preco,
              fator
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            lojaId,
            produto.codigo,
            produto.codigo_barras || null,
            produto.descricao,
            produto.unidade || null,
            produto.margem,
            produto.estoque,
            produto.custo,
            produto.preco,
            produto.fator && produto.fator > 0
              ? produto.fator
              : null,
          ]
        );

        novos += 1;
      }

      if (produto.fator && produto.fator > 0) {
        fatoresImportados += 1;
      } else {
        semFator += 1;
      }
    }

    await conexao.commit();

    return res.status(201).json({
      sucesso: true,
      mensagem: "Produtos e fatores importados com sucesso.",
      resumo: {
        encontrados: produtos.length,
        novos,
        atualizados,
        fatoresImportados,
        semFator,
      },
    });
  } catch (error) {
    if (conexao) {
      try {
        await conexao.rollback();
      } catch (rollbackError) {
        console.error(
          "Erro ao desfazer a importação:",
          rollbackError
        );
      }
    }

    console.error("Erro ao importar produtos:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem:
        error.message ||
        "Não foi possível importar os produtos.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
}

export async function listarProdutos(req, res) {
  const lojaId = obterLojaId(req);

  try {
    const busca = String(req.query.busca || "").trim();

    const pagina = Math.max(
      Number.parseInt(req.query.pagina, 10) || 1,
      1
    );

    const limite = 50;
    const offset = (pagina - 1) * limite;

    const termoBusca = `%${busca}%`;

    const [quantidadeResultado] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM produtos
        WHERE loja_id = ?
          AND (
            codigo LIKE ?
            OR codigo_barras LIKE ?
            OR descricao LIKE ?
          )
      `,
      [lojaId, termoBusca, termoBusca, termoBusca]
    );

    const total = Number(quantidadeResultado[0].total);
    const totalPaginas = Math.max(Math.ceil(total / limite), 1);

    const [produtos] = await pool.execute(
      `
        SELECT
          id,
          codigo,
          codigo_barras,
          descricao,
          unidade,
          margem,
          estoque,
          custo,
          preco,
          fator
        FROM produtos
        WHERE loja_id = ?
          AND (
            codigo LIKE ?
            OR codigo_barras LIKE ?
            OR descricao LIKE ?
          )
        ORDER BY descricao ASC
        LIMIT ${limite}
        OFFSET ${offset}
      `,
      [lojaId, termoBusca, termoBusca, termoBusca]
    );

    return res.json({
      sucesso: true,
      produtos,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas,
      },
    });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível listar os produtos.",
    });
  }
}

export async function atualizarFatorProduto(req, res) {
  const lojaId = obterLojaId(req);

  try {
    const id = Number(req.params.id);
    const fatorRecebido = req.body.fator;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Produto inválido.",
      });
    }

    if (
      fatorRecebido === null ||
      fatorRecebido === undefined ||
      fatorRecebido === ""
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o fator de conversão.",
      });
    }

    const fator = Number(
      String(fatorRecebido).replace(",", ".")
    );

    if (!Number.isFinite(fator) || fator <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O fator precisa ser maior que zero.",
      });
    }

    const [resultado] = await pool.execute(
      `
        UPDATE produtos
        SET fator = ?
        WHERE id = ?
          AND loja_id = ?
      `,
      [fator, id, lojaId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Produto não encontrado.",
      });
    }

    const [produtos] = await pool.execute(
      `
        SELECT
          id,
          codigo,
          codigo_barras,
          descricao,
          unidade,
          margem,
          estoque,
          custo,
          preco,
          fator
        FROM produtos
        WHERE id = ?
          AND loja_id = ?
        LIMIT 1
      `,
      [id, lojaId]
    );

    return res.json({
      sucesso: true,
      mensagem: "Fator atualizado com sucesso.",
      produto: produtos[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar fator:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível atualizar o fator.",
    });
  }
}


export async function atualizarFatoresProdutos(req, res) {
  const lojaId = obterLojaId(req);

  const alteracoes = req.body.alteracoes;

  if (!Array.isArray(alteracoes) || alteracoes.length === 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nenhuma alteração foi enviada.",
    });
  }

  let conexao;

  try {
    const fatoresValidados = alteracoes.map((alteracao) => {
      const id = Number(alteracao.id);

      const fator = Number(
        String(alteracao.fator).replace(",", ".")
      );

      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Existe um produto inválido na lista.");
      }

      if (!Number.isFinite(fator) || fator <= 0) {
        throw new Error(
          "Todos os fatores precisam ser maiores que zero."
        );
      }

      return {
        id,
        fator,
      };
    });

    conexao = await pool.getConnection();
    await conexao.beginTransaction();

    let atualizados = 0;

    for (const produto of fatoresValidados) {
      const [resultado] = await conexao.execute(
        `
          UPDATE produtos
          SET fator = ?
          WHERE id = ?
            AND loja_id = ?
        `,
        [produto.fator, produto.id, lojaId]
      );

      atualizados += resultado.affectedRows;
    }

    await conexao.commit();

    return res.json({
      sucesso: true,
      mensagem: `${atualizados} fator(es) atualizado(s) com sucesso.`,
      atualizados,
    });
  } catch (error) {
    if (conexao) {
      await conexao.rollback();
    }

    console.error("Erro ao atualizar fatores:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem:
        error.message ||
        "Não foi possível atualizar os fatores.",
    });
  } finally {
    if (conexao) {
      conexao.release();
    }
  }
}

export async function buscarProdutosPorCodigos(req, res) {
  const lojaId = obterLojaId(req);

  try {
    const codigosRecebidos = req.body?.codigos;

    if (
      !Array.isArray(codigosRecebidos) ||
      codigosRecebidos.length === 0
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum código enviado.",
      });
    }

    const codigos = [
      ...new Set(
        codigosRecebidos
          .map(limparCodigo)
          .filter(Boolean)
      ),
    ];

    if (codigos.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum código válido foi enviado.",
      });
    }

    const codigosNumericos = [
      ...new Set(
        codigos
          .filter((codigo) => /^\d+(\.0+)?$/.test(codigo))
          .map((codigo) =>
            codigo
              .replace(/\.0+$/, "")
              .replace(/^0+(?=\d)/, "")
          )
          .filter(Boolean)
      ),
    ];

    const condicoes = [];
    const parametros = [];

    const placeholdersTexto = codigos
      .map(() => "?")
      .join(",");

    condicoes.push(
      `TRIM(CAST(codigo AS CHAR)) IN (${placeholdersTexto})`
    );

    parametros.push(...codigos);

    if (codigosNumericos.length > 0) {
      const placeholdersNumericos = codigosNumericos
        .map(() => "?")
        .join(",");

      condicoes.push(`
        (
          TRIM(CAST(codigo AS CHAR))
            REGEXP '^[0-9]+(\\\\.0+)?$'
          AND CAST(
            TRIM(CAST(codigo AS CHAR))
            AS DECIMAL(65, 0)
          ) IN (${placeholdersNumericos})
        )
      `);

      parametros.push(...codigosNumericos);
    }

    const [produtos] = await pool.execute(
      `
        SELECT
          id,
          codigo,
          codigo_barras,
          descricao,
          unidade,
          fator
        FROM produtos
        WHERE loja_id = ?
          AND (${condicoes.join(" OR ")})
      `,
      [lojaId, ...parametros]
    );

    return res.json({
      sucesso: true,
      produtos,
      encontrados: produtos.length,
      solicitados: codigos.length,
    });
  } catch (error) {
    console.error(
      "Erro ao buscar produtos por códigos:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        error.message ||
        "Erro ao buscar produtos por códigos.",
    });
  }
}
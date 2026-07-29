import * as XLSX from "xlsx";
import pool from "../config/database.js";

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
   * Exemplos:
   * 12 / 0
   * -8 / 0
   */
  const texto = String(valor).trim();
  const estoqueAtual = texto.split("/")[0]?.trim() ?? "";

  return converterNumero(estoqueAtual);
}

function localizarColuna(cabecalhos, nomesPermitidos) {
  // Primeiro procura o nome exato da coluna.
  for (const nome of nomesPermitidos) {
    const indiceExato = cabecalhos.findIndex(
      (cabecalho) => cabecalho === nome
    );

    if (indiceExato !== -1) {
      return indiceExato;
    }
  }

  // Só usa busca parcial para nomes mais específicos.
  const nomesGenericos = new Set([
    "produto",
    "nome",
    "codigo",
    "cod",
    "un",
  ]);

  return cabecalhos.findIndex((cabecalho) =>
    nomesPermitidos.some((nome) => {
      if (nomesGenericos.has(nome)) {
        return false;
      }

      return cabecalho.includes(nome);
    })
  );
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

    margem: localizarColuna(colunas, ["margem"]),

    estoque: localizarColuna(colunas, [
      "est / critco",
      "est / critico",
      "est/critco",
      "est/critico",
      "estoque",
      "saldo",
    ]),

    custo: localizarColuna(colunas, ["custo"]),

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

function obterLojaId(req) {
  const lojaId = Number(req.usuario?.loja_id);

  return Number.isInteger(lojaId) && lojaId > 0
    ? lojaId
    : null;
}

function dividirEmLotes(lista, tamanho = 500) {
  const lotes = [];

  for (let indice = 0; indice < lista.length; indice += tamanho) {
    lotes.push(lista.slice(indice, indice + tamanho));
  }

  return lotes;
}

export async function importarProdutos(req, res) {
  if (!req.file) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nenhum arquivo foi enviado.",
    });
  }

  const lojaId = obterLojaId(req);

  if (!lojaId) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Loja inválida.",
    });
  }

  let client;

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

    const planilha = workbook.Sheets[workbook.SheetNames[0]];

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
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Não foi possível localizar as colunas Código e Nome do produto.",
      });
    }

    const mapeamento = criarMapeamento(
      linhas[indiceCabecalho]
    );

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

      if (
        !codigo ||
        !descricao ||
        linhaEhCabecalhoRepetido(codigo, descricao) ||
        linhaDeveSerIgnorada(descricao)
      ) {
        continue;
      }

      const fatorConvertido =
        mapeamento.fator >= 0
          ? converterNumero(
              valorDaLinha(linha, mapeamento.fator)
            )
          : null;

      produtosPorCodigo.set(codigo, {
        codigo,

        codigo_barras:
          limparCodigo(
            valorDaLinha(linha, mapeamento.codigoBarras)
          ) || null,

        descricao,

        unidade:
          String(
            valorDaLinha(linha, mapeamento.unidade)
          )
            .trim()
            .toUpperCase() || null,

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
          fatorConvertido && fatorConvertido > 0
            ? fatorConvertido
            : null,
      });
    }

    const produtos = [...produtosPorCodigo.values()];

    if (!produtos.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "Nenhum produto válido foi encontrado no arquivo.",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");

    // Aumenta o limite de tempo apenas durante esta importação.
    await client.query(
      "SET LOCAL statement_timeout = '180s'"
    );

    const lotes = dividirEmLotes(produtos, 500);

    let novos = 0;
    let atualizados = 0;
    let fatoresImportados = 0;
    let semFator = 0;

    for (const lote of lotes) {
      const resultado = await client.query(
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
        SELECT
          $1,
          produto.codigo,
          produto.codigo_barras,
          produto.descricao,
          produto.unidade,
          produto.margem,
          produto.estoque,
          produto.custo,
          produto.preco,
          produto.fator
        FROM jsonb_to_recordset($2::jsonb) AS produto (
          codigo TEXT,
          codigo_barras TEXT,
          descricao TEXT,
          unidade TEXT,
          margem NUMERIC,
          estoque NUMERIC,
          custo NUMERIC,
          preco NUMERIC,
          fator NUMERIC
        )
        ON CONFLICT (loja_id, codigo)
        DO UPDATE SET
          codigo_barras = EXCLUDED.codigo_barras,
          descricao = EXCLUDED.descricao,
          unidade = EXCLUDED.unidade,
          margem = EXCLUDED.margem,
          estoque = EXCLUDED.estoque,
          custo = EXCLUDED.custo,
          preco = EXCLUDED.preco,
          fator = CASE
            WHEN EXCLUDED.fator IS NOT NULL
              AND EXCLUDED.fator > 0
            THEN EXCLUDED.fator
            ELSE produtos.fator
          END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserido
        `,
        [lojaId, JSON.stringify(lote)]
      );

      for (const registro of resultado.rows) {
        if (registro.inserido) {
          novos += 1;
        } else {
          atualizados += 1;
        }
      }

      for (const produto of lote) {
        if (produto.fator && produto.fator > 0) {
          fatoresImportados += 1;
        } else {
          semFator += 1;
        }
      }
    }

    await client.query("COMMIT");

    return res.status(201).json({
      sucesso: true,
      mensagem:
        "Produtos e fatores importados com sucesso.",
      loja_id: lojaId,
      resumo: {
        encontrados: produtos.length,
        novos,
        atualizados,
        fatoresImportados,
        semFator,
      },
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Erro ao importar produtos:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem:
        error.message ||
        "Não foi possível importar os produtos.",
    });
  } finally {
    client?.release();
  }
}

export async function listarProdutos(req, res) {
  try {
    const lojaId = obterLojaId(req);

    if (!lojaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Loja inválida.",
      });
    }

    const busca = String(req.query.busca || "").trim();

    const pagina = Math.max(
      Number.parseInt(req.query.pagina, 10) || 1,
      1
    );

    const limite = 50;
    const offset = (pagina - 1) * limite;
    const termo = `%${busca}%`;

    const quantidade = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM produtos
      WHERE loja_id = $1
        AND (
          codigo ILIKE $2
          OR COALESCE(codigo_barras, '') ILIKE $2
          OR descricao ILIKE $2
        )
      `,
      [lojaId, termo]
    );

    const total = quantidade.rows[0].total;

    const resultado = await pool.query(
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
      WHERE loja_id = $1
        AND (
          codigo ILIKE $2
          OR COALESCE(codigo_barras, '') ILIKE $2
          OR descricao ILIKE $2
        )
      ORDER BY descricao ASC
      LIMIT $3
      OFFSET $4
      `,
      [lojaId, termo, limite, offset]
    );

    return res.json({
      sucesso: true,
      loja_id: lojaId,
      produtos: resultado.rows,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.max(
          Math.ceil(total / limite),
          1
        ),
      },
    });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível listar os produtos.",
    });
  }
}

export async function atualizarFatorProduto(req, res) {
  try {
    const lojaId = obterLojaId(req);

    if (!lojaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Loja inválida.",
      });
    }

    const id = Number(req.params.id);

    const fator = Number(
      String(req.body.fator ?? "").replace(",", ".")
    );

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Produto inválido.",
      });
    }

    if (!Number.isFinite(fator) || fator <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "O fator precisa ser maior que zero.",
      });
    }

    const resultado = await pool.query(
      `
      UPDATE produtos
      SET
        fator = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND loja_id = $3
      RETURNING
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
      `,
      [fator, id, lojaId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Produto não encontrado.",
      });
    }

    return res.json({
      sucesso: true,
      mensagem: "Fator atualizado com sucesso.",
      produto: resultado.rows[0],
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar fator do produto:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível atualizar o fator.",
    });
  }
}

export async function atualizarFatoresProdutos(req, res) {
  const alteracoes = req.body.alteracoes;

  if (!Array.isArray(alteracoes) || !alteracoes.length) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nenhuma alteração foi enviada.",
    });
  }

  let client;

  try {
    const lojaId = obterLojaId(req);

    if (!lojaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Loja inválida.",
      });
    }

    const validados = alteracoes.map(
      ({ id, fator }) => {
        const idNumero = Number(id);

        const fatorNumero = Number(
          String(fator).replace(",", ".")
        );

        if (
          !Number.isInteger(idNumero) ||
          idNumero <= 0 ||
          !Number.isFinite(fatorNumero) ||
          fatorNumero <= 0
        ) {
          throw new Error(
            "Há produto ou fator inválido na lista."
          );
        }

        return {
          id: idNumero,
          fator: fatorNumero,
        };
      }
    );

    client = await pool.connect();

    await client.query("BEGIN");

    let atualizados = 0;

    for (const produto of validados) {
      const resultado = await client.query(
        `
        UPDATE produtos
        SET
          fator = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND loja_id = $3
        `,
        [produto.fator, produto.id, lojaId]
      );

      atualizados += resultado.rowCount;
    }

    await client.query("COMMIT");

    return res.json({
      sucesso: true,
      mensagem: `${atualizados} fator(es) atualizado(s) com sucesso.`,
      atualizados,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(
      "Erro ao atualizar fatores:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        error.message ||
        "Não foi possível atualizar os fatores.",
    });
  } finally {
    client?.release();
  }
}

export async function buscarProdutosPorCodigos(req, res) {
  try {
    const lojaId = obterLojaId(req);

    if (!lojaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Loja inválida.",
      });
    }

    const codigos = [
      ...new Set(
        (req.body?.codigos || [])
          .map(limparCodigo)
          .filter(Boolean)
      ),
    ];

    if (!codigos.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum código enviado.",
      });
    }

    const resultado = await pool.query(
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
      WHERE loja_id = $1
        AND codigo = ANY($2::text[])
      ORDER BY descricao
      `,
      [lojaId, codigos]
    );

    return res.json({
      sucesso: true,
      produtos: resultado.rows,
    });
  } catch (error) {
    console.error(
      "Erro ao buscar produtos por códigos:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível buscar os produtos.",
    });
  }
}
import pool from "../config/database.js";

function numeroOuZero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function textoOuPadrao(valor, padrao = "") {
  const texto = String(valor ?? "").trim();
  return texto || padrao;
}

function normalizarNota(nota) {
  const itens = Array.isArray(nota?.itens) ? nota.itens : [];

  const totalErros = itens.filter(
    (item) => item?.status !== "correto"
  ).length;

  return {
    numeroNota: textoOuPadrao(nota?.numero, "SEM-NÚMERO"),

    fornecedor: textoOuPadrao(
      nota?.fornecedor,
      "Fornecedor não informado"
    ),

    dataNota: textoOuPadrao(nota?.data),

    totalItens: itens.length,

    totalErros,

    valorTotal: numeroOuZero(nota?.valorTotal),

    status:
      totalErros === 0
        ? "finalizada"
        : "com_erro",

    itens,
  };
}

function obterLojaId(req) {
  const lojaId = Number(req.usuario?.loja_id);

  return Number.isInteger(lojaId) && lojaId > 0
    ? lojaId
    : null;
}

async function verificarLojaExiste(conexao, lojaId) {
  const [lojas] = await conexao.query(
    `
      SELECT id
      FROM lojas
      WHERE id = ?
      LIMIT 1
    `,
    [lojaId]
  );

  return lojas.length > 0;
}

export async function criarConferencias(req, res) {
  const notasRecebidas = Array.isArray(req.body?.notas)
    ? req.body.notas
    : [];

  if (notasRecebidas.length === 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Envie pelo menos uma nota para salvar.",
    });
  }

  const lojaId = obterLojaId(req);

  if (!lojaId) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Loja do usuário não identificada.",
    });
  }

  let conexao;

  try {
    conexao = await pool.getConnection();

    const lojaExiste = await verificarLojaExiste(
      conexao,
      lojaId
    );

    if (!lojaExiste) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `A loja de ID ${lojaId} não está cadastrada.`,
      });
    }

    await conexao.beginTransaction();

    const idsCriados = [];

    for (const notaRecebida of notasRecebidas) {
      const nota = normalizarNota(notaRecebida);

      const [resultado] = await conexao.query(
        `
          INSERT INTO conferencias (
            loja_id,
            numero_nota,
            fornecedor,
            data_nota,
            total_itens,
            total_erros,
            valor_total,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          lojaId,
          nota.numeroNota,
          nota.fornecedor,
          nota.dataNota || null,
          nota.totalItens,
          nota.totalErros,
          nota.valorTotal,
          nota.status,
        ]
      );

      const conferenciaId = resultado.insertId;

      idsCriados.push(conferenciaId);

      for (const item of nota.itens) {
        const fator =
          item?.fator === null ||
          item?.fator === undefined ||
          item?.fator === ""
            ? null
            : numeroOuZero(item.fator);

        const volumes =
          item?.quantidadeCaixas === null ||
          item?.quantidadeCaixas === undefined ||
          item?.quantidadeCaixas === ""
            ? null
            : numeroOuZero(item.quantidadeCaixas);

        await conexao.query(
          `
            INSERT INTO conferencia_itens (
              conferencia_id,
              codigo,
              descricao,
              unidade,
              quantidade,
              fator,
              volumes,
              status,
              observacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            conferenciaId,

            textoOuPadrao(
              item?.codigo,
              "SEM-CÓDIGO"
            ),

            textoOuPadrao(
              item?.descricao,
              "Produto sem descrição"
            ),

            textoOuPadrao(
              item?.unidade
            ) || null,

            numeroOuZero(
              item?.quantidade
            ),

            fator,

            volumes,

            textoOuPadrao(
              item?.status,
              "aguardando"
            ),

            textoOuPadrao(
              item?.observacao
            ) || null,
          ]
        );
      }
    }

    await conexao.commit();

    return res.status(201).json({
      sucesso: true,

      mensagem:
        notasRecebidas.length === 1
          ? "Conferência salva no histórico."
          : `${notasRecebidas.length} conferências salvas no histórico.`,

      loja_id: lojaId,

      ids: idsCriados,
    });
  } catch (error) {
    if (conexao) {
      try {
        await conexao.rollback();
      } catch (rollbackError) {
        console.error(
          "Erro ao desfazer transação:",
          rollbackError
        );
      }
    }

    console.error(
      "Erro ao salvar conferências:",
      error
    );

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          "A loja informada não existe no banco de dados.",
        erro: error.message,
      });
    }

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível salvar o histórico.",
      erro: error.message,
    });
  } finally {
    conexao?.release();
  }
}

export async function listarConferencias(req, res) {
  try {
    const lojaId = obterLojaId(req);

    if (!lojaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Loja inválida.",
      });
    }

    const pesquisa = textoOuPadrao(
      req.query?.pesquisa
    );

    const status = textoOuPadrao(
      req.query?.status
    );

    const dataInicial = textoOuPadrao(
      req.query?.dataInicial
    );

    const dataFinal = textoOuPadrao(
      req.query?.dataFinal
    );

    const condicoes = [
      "loja_id = ?",
    ];

    const parametros = [
      lojaId,
    ];

    if (pesquisa) {
      condicoes.push(
        `
          (
            numero_nota LIKE ?
            OR fornecedor LIKE ?
          )
        `
      );

      parametros.push(
        `%${pesquisa}%`,
        `%${pesquisa}%`
      );
    }

    if (
      status &&
      ["finalizada", "com_erro"].includes(status)
    ) {
      condicoes.push(
        "status = ?"
      );

      parametros.push(
        status
      );
    }

    if (dataInicial) {
      condicoes.push(
        "criado_em >= ?"
      );

      parametros.push(
        `${dataInicial} 00:00:00`
      );
    }

    if (dataFinal) {
      condicoes.push(
        "criado_em <= ?"
      );

      parametros.push(
        `${dataFinal} 23:59:59`
      );
    }

    const where = `
      WHERE ${condicoes.join(" AND ")}
    `;

    const [conferencias] = await pool.query(
      `
        SELECT
          id,
          loja_id AS lojaId,
          numero_nota AS nota,
          fornecedor,
          data_nota AS dataNota,
          total_itens AS totalItens,
          total_erros AS erros,
          valor_total AS valorTotal,
          status,
          criado_em AS conferidoEm
        FROM conferencias
        ${where}
        ORDER BY criado_em DESC, id DESC
      `,
      parametros
    );

    return res.json({
      sucesso: true,
      loja_id: lojaId,
      conferencias,
    });
  } catch (error) {
    console.error(
      "Erro ao listar conferências:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível carregar o histórico.",
      erro: error.message,
    });
  }
}

export async function buscarConferenciaPorId(
  req,
  res
) {
  const id = Number(
    req.params.id
  );

  const lojaId = obterLojaId(req);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return res.status(400).json({
      sucesso: false,
      mensagem:
        "Identificador da conferência inválido.",
    });
  }

  if (!lojaId) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Loja do usuário não identificada.",
    });
  }

  try {
    const [conferencias] = await pool.query(
      `
        SELECT
          id,
          loja_id AS lojaId,
          numero_nota AS nota,
          fornecedor,
          data_nota AS dataNota,
          total_itens AS totalItens,
          total_erros AS erros,
          valor_total AS valorTotal,
          status,
          criado_em AS conferidoEm
        FROM conferencias
        WHERE id = ?
          AND loja_id = ?
        LIMIT 1
      `,
      [
        id,
        lojaId,
      ]
    );

    if (
      conferencias.length === 0
    ) {
      return res.status(404).json({
        sucesso: false,
        mensagem:
          "Conferência não encontrada.",
      });
    }

    const [itens] = await pool.query(
      `
        SELECT
          id,
          codigo,
          descricao,
          unidade,
          quantidade,
          fator,
          volumes AS quantidadeCaixas,
          status,
          observacao
        FROM conferencia_itens
        WHERE conferencia_id = ?
        ORDER BY id
      `,
      [id]
    );

    return res.json({
      sucesso: true,

      conferencia: {
        ...conferencias[0],
        itens,
      },
    });
  } catch (error) {
    console.error(
      "Erro ao buscar conferência:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível abrir a conferência.",
      erro: error.message,
    });
  }
}

export async function excluirConferencia(
  req,
  res
) {
  const id = Number(
    req.params.id
  );

  const lojaId = obterLojaId(req);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return res.status(400).json({
      sucesso: false,
      mensagem:
        "Identificador da conferência inválido.",
    });
  }

  if (!lojaId) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Loja do usuário não identificada.",
    });
  }

  try {
    const [resultado] = await pool.query(
      `
        DELETE FROM conferencias
        WHERE id = ?
          AND loja_id = ?
      `,
      [
        id,
        lojaId,
      ]
    );

    if (
      resultado.affectedRows === 0
    ) {
      return res.status(404).json({
        sucesso: false,
        mensagem:
          "Conferência não encontrada.",
      });
    }

    return res.json({
      sucesso: true,
      mensagem:
        "Conferência excluída do histórico.",
    });
  } catch (error) {
    console.error(
      "Erro ao excluir conferência:",
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem:
        "Não foi possível excluir a conferência.",
      erro: error.message,
    });
  }
}
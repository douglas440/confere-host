import pool from "../config/database.js";

function numeroOuZero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function textoOuPadrao(valor, padrao = "") {
  const texto = String(valor ?? "").trim();
  return texto || padrao;
}

function obterLojaId(req) {
  const lojaId = Number(req.usuario?.loja_id);
  return Number.isInteger(lojaId) && lojaId > 0 ? lojaId : null;
}

function normalizarNota(nota) {
  const itens = Array.isArray(nota?.itens) ? nota.itens : [];
  const totalErros = itens.filter((item) => item?.status !== "correto").length;
  return {
    numeroNota: textoOuPadrao(nota?.numero, "SEM-NÚMERO"),
    fornecedor: textoOuPadrao(nota?.fornecedor, "Fornecedor não informado"),
    dataNota: textoOuPadrao(nota?.data) || null,
    totalItens: itens.length,
    totalErros,
    valorTotal: numeroOuZero(nota?.valorTotal),
    status: totalErros === 0 ? "finalizada" : "com_erro",
    itens,
  };
}

export async function criarConferencias(req, res) {
  const notasRecebidas = Array.isArray(req.body?.notas) ? req.body.notas : [];
  if (!notasRecebidas.length) return res.status(400).json({ sucesso: false, mensagem: "Envie pelo menos uma nota para salvar." });

  const lojaId = obterLojaId(req);
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const ids = [];

    for (const recebida of notasRecebidas) {
      const nota = normalizarNota(recebida);
      const inserida = await client.query(
        `INSERT INTO conferencias (loja_id, numero_nota, fornecedor, data_nota, total_itens, total_erros, valor_total, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [lojaId, nota.numeroNota, nota.fornecedor, nota.dataNota, nota.totalItens, nota.totalErros, nota.valorTotal, nota.status]
      );
      const conferenciaId = inserida.rows[0].id;
      ids.push(conferenciaId);

      for (const item of nota.itens) {
        const fator = item?.fator === null || item?.fator === undefined || item?.fator === "" ? null : numeroOuZero(item.fator);
        const volumes = item?.quantidadeCaixas === null || item?.quantidadeCaixas === undefined || item?.quantidadeCaixas === "" ? null : numeroOuZero(item.quantidadeCaixas);
        await client.query(
          `INSERT INTO conferencia_itens (conferencia_id, codigo, descricao, unidade, quantidade, fator, volumes, status, observacao)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [conferenciaId, textoOuPadrao(item?.codigo, "SEM-CÓDIGO"), textoOuPadrao(item?.descricao, "Produto sem descrição"),
           textoOuPadrao(item?.unidade) || null, numeroOuZero(item?.quantidade), fator, volumes,
           textoOuPadrao(item?.status, "aguardando"), textoOuPadrao(item?.observacao) || null]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(201).json({ sucesso: true, mensagem: notasRecebidas.length === 1 ? "Conferência salva no histórico." : `${notasRecebidas.length} conferências salvas no histórico.`, loja_id: lojaId, ids });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Erro ao salvar conferências:", error);
    return res.status(500).json({ sucesso: false, mensagem: "Não foi possível salvar o histórico.", erro: error.message });
  } finally { client?.release(); }
}

export async function listarConferencias(req, res) {
  try {
    const lojaId = obterLojaId(req);
    const pesquisa = textoOuPadrao(req.query?.pesquisa);
    const status = textoOuPadrao(req.query?.status);
    const dataInicial = textoOuPadrao(req.query?.dataInicial);
    const dataFinal = textoOuPadrao(req.query?.dataFinal);
    const condicoes = ["loja_id = $1"];
    const parametros = [lojaId];
    const add = (valor) => { parametros.push(valor); return `$${parametros.length}`; };

    if (pesquisa) {
      const p = add(`%${pesquisa}%`);
      condicoes.push(`(numero_nota ILIKE ${p} OR fornecedor ILIKE ${p})`);
    }
    if (["finalizada", "com_erro"].includes(status)) condicoes.push(`status = ${add(status)}`);
    if (dataInicial) condicoes.push(`criado_em >= ${add(`${dataInicial} 00:00:00`)}`);
    if (dataFinal) condicoes.push(`criado_em <= ${add(`${dataFinal} 23:59:59`)}`);

    const resultado = await pool.query(
      `SELECT id, loja_id AS "lojaId", numero_nota AS nota, fornecedor, data_nota AS "dataNota",
              total_itens AS "totalItens", total_erros AS erros, valor_total AS "valorTotal", status, criado_em AS "conferidoEm"
       FROM conferencias WHERE ${condicoes.join(" AND ")} ORDER BY criado_em DESC, id DESC`,
      parametros
    );
    return res.json({ sucesso: true, loja_id: lojaId, conferencias: resultado.rows });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Não foi possível carregar o histórico.", erro: error.message });
  }
}

export async function buscarConferenciaPorId(req, res) {
  const id = Number(req.params.id);
  const lojaId = obterLojaId(req);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Identificador inválido." });
  try {
    const conferencia = await pool.query(
      `SELECT id, loja_id AS "lojaId", numero_nota AS nota, fornecedor, data_nota AS "dataNota",
              total_itens AS "totalItens", total_erros AS erros, valor_total AS "valorTotal", status, criado_em AS "conferidoEm"
       FROM conferencias WHERE id=$1 AND loja_id=$2 LIMIT 1`, [id, lojaId]
    );
    if (!conferencia.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Conferência não encontrada." });
    const itens = await pool.query(
      `SELECT id, codigo, descricao, unidade, quantidade, fator, volumes AS "quantidadeCaixas", status, observacao
       FROM conferencia_itens WHERE conferencia_id=$1 ORDER BY id`, [id]
    );
    return res.json({ sucesso: true, conferencia: { ...conferencia.rows[0], itens: itens.rows } });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Não foi possível abrir a conferência.", erro: error.message });
  }
}

export async function excluirConferencia(req, res) {
  const id = Number(req.params.id);
  const lojaId = obterLojaId(req);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: "Identificador inválido." });
  try {
    const resultado = await pool.query("DELETE FROM conferencias WHERE id=$1 AND loja_id=$2", [id, lojaId]);
    if (!resultado.rowCount) return res.status(404).json({ sucesso: false, mensagem: "Conferência não encontrada." });
    return res.json({ sucesso: true, mensagem: "Conferência excluída do histórico." });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: "Não foi possível excluir a conferência.", erro: error.message });
  }
}

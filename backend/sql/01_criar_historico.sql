CREATE TABLE IF NOT EXISTS conferencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_nota VARCHAR(60) NOT NULL,
  fornecedor VARCHAR(180) NOT NULL DEFAULT 'Fornecedor não informado',
  data_nota VARCHAR(20) NULL,
  total_itens INT NOT NULL DEFAULT 0,
  total_erros INT NOT NULL DEFAULT 0,
  valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('finalizada', 'com_erro') NOT NULL DEFAULT 'finalizada',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conferencias_numero_nota (numero_nota),
  INDEX idx_conferencias_fornecedor (fornecedor),
  INDEX idx_conferencias_status (status),
  INDEX idx_conferencias_criado_em (criado_em)
);

CREATE TABLE IF NOT EXISTS conferencia_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conferencia_id INT NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  unidade VARCHAR(30) NULL,
  quantidade DECIMAL(14,3) NOT NULL DEFAULT 0,
  fator DECIMAL(14,3) NULL,
  volumes DECIMAL(14,3) NULL,
  status VARCHAR(60) NOT NULL,
  observacao TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conferencia_itens_conferencia
    FOREIGN KEY (conferencia_id)
    REFERENCES conferencias(id)
    ON DELETE CASCADE,
  INDEX idx_conferencia_itens_conferencia (conferencia_id),
  INDEX idx_conferencia_itens_codigo (codigo),
  INDEX idx_conferencia_itens_status (status)
);

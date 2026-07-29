# Confere Host — PostgreSQL/Supabase

## 1. Criar as tabelas e importar os dados

No Supabase, abra **SQL Editor**, crie uma nova consulta e execute o arquivo:

`sql/01_migracao_completa_supabase.sql`

O arquivo cria as tabelas, importa as lojas, logins e cerca de 12 mil produtos, e ajusta as sequências dos IDs.

## 2. Obter a conexão do Supabase

Em **Project Settings > Database > Connect**, copie a URI do **Session Pooler**. Troque `[YOUR-PASSWORD]` pela senha do banco.

## 3. Configurar o Render

Crie estas variáveis:

- `DATABASE_URL`: URI do Session Pooler do Supabase
- `JWT_SECRET`: uma chave longa e aleatória
- `FRONTEND_URL`: `https://confere-host.vercel.app`
- `NODE_ENV`: `production`

Configuração do serviço:

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: deixe vazio se esta pasta for a raiz do repositório

## 4. Rotas

- `POST /api/auth/login`
- `GET /api/auth/sessao`
- `/api/produtos/*` (exige token)
- `/api/conferencias/*` (exige token)

Nas chamadas protegidas, envie:

`Authorization: Bearer SEU_TOKEN`

O backend usa o `loja_id` contido no token. Assim, uma empresa não acessa produtos ou conferências de outra.

## 5. Teste local

Copie `.env.example` para `.env`, preencha os valores e execute:

```bash
npm install
npm run dev
```

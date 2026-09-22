# progete-os

App de Ordens de Serviço sobre a API de Manutenção da Progete. Login, listagem,
detalhe, criação e edição de O.S. — tudo direto na Progete, sem banco próprio.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

### Domínio da API

- **Com `PROGETE_URL` no `.env`** (ou nas variáveis da Vercel): o domínio é fixo.
  O app vai direto para o login e o servidor usa sempre esse domínio, ignorando
  qualquer outro vindo do navegador.
- **Sem `PROGETE_URL`**: antes de cada login aparece a etapa de **conexão** — o
  usuário informa o domínio (ex.: `teste.progete.com.br`), o app consulta
  `https://<domínio>/api/v1.json` e só continua se a resposta for
  `{"code": "api_ativada"}`. O último domínio usado já vem preenchido.

Veja `.env.example`. Depois de mudar o `.env`, reinicie o `npm run dev`.

Sem domínio fixo, por segurança a função `api/progete.ts` só aceita, via https
e porta padrão, os domínios `progete.com.br`, `profinancas.com.br` e `progete.com`
(e seus subdomínios), além dos hosts listados em `PROGETE_HOSTS`.

## Como funciona

- O navegador não pode chamar a Progete direto (ela não libera CORS). Por isso
  toda chamada passa por `api/progete.ts`, uma função serverless que só repassa
  a requisição com o JWT do usuário. Ela não guarda credenciais e só aceita as
  rotas listadas em `ROTAS`.
- Em `npm run dev`, o `vite.config.ts` serve essa mesma função em `/api/progete`.
- Na Vercel, a pasta `api/` vira função automaticamente.

| Tela | Endpoint da Progete |
|---|---|
| Conexão | `GET /api/v1.json` → `{"code":"api_ativada"}` |
| Login | `POST auth/authenticate?email=&password=` |
| Cadastros (selects) | `GET manutencaos/{equipamentos,tipos,prioridades,fluxos,areas,outros,mantenedores,produtos}`, `GET produto_unidade_medidas` |
| Lista | `GET manutencaos` |
| Detalhe / Painel | `GET manutencaos` (o `GET manutencaos/:id` não traz equipamento, itens e serviços) |
| Nova O.S. | `POST manutencaos` |
| Editar O.S. | `PATCH manutencaos/:id` (itens/serviços com `id` alteram, `_destroy: true` remove, sem `id` cria) |

A Progete responde **200 mesmo em erro de validação** (`{ campo: [mensagens] }`);
o app trata sucesso como "resposta com `id`".

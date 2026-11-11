# Especificação - Document Management System

## 1. Objetivo

Disponibilizar uma aplicação web para que usuários identificados possam enviar documentos, consultar os metadados dos próprios envios e baixar os arquivos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Cadastro e login com senha protegida por hash e token JWT.
- Listagem dos documentos associados ao usuário autenticado.
- Download de um documento pelo identificador público, limitado ao mesmo usuário.
- Armazenamento dos binários no filesystem local em `backend/storage`, usando Multer com `diskStorage`.
- Armazenamento em memória dos metadados e da associação entre documento, usuário e nome interno do arquivo.
- Armazenamento local de usuários em `backend/data/users.json`.
- Interface web React para upload, listagem, estados de carregamento/erro e download.
- Configuração do servidor e dos limites de upload por variáveis de ambiente.

### Fora do escopo

- Armazenamento em nuvem, provedores externos ou banco de dados para metadados.
- Versionamento, edição, compartilhamento, busca avançada ou exclusão de documentos.
- Recuperação de senha, compartilhamento, papéis administrativos e revogação antecipada de tokens.
- Garantia de persistência dos metadados depois que o processo do backend for reiniciado.
- Upload de múltiplos arquivos em uma única requisição.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo por requisição de upload em `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema deve autenticar documentos com `Authorization: Bearer <token>` e obter o usuário exclusivamente do JWT validado. |
| RF-03 | O sistema deve rejeitar requisições sem arquivo, com mais de um arquivo, campos multipart extras, arquivo vazio ou arquivo que exceda o limite configurado. |
| RF-04 | O sistema deve aceitar somente os tipos de arquivo definidos na configuração do MVP, validando a extensão e o MIME informado. A implementação deve tratar esses valores como entrada não confiável; essa validação não equivale à inspeção do conteúdo do arquivo. |
| RF-05 | Após um upload válido, o sistema deve armazenar o binário em `backend/storage`, gerar um identificador público único e registrar seus metadados em memória. |
| RF-06 | O nome físico do arquivo deve ser gerado pela aplicação e não pode depender do nome enviado pelo usuário. A API não deve expor caminhos nem nomes físicos do filesystem. |
| RF-07 | O sistema deve retornar os metadados do documento criado e não o conteúdo binário no resultado do upload. |
| RF-08 | O sistema deve listar somente documentos cujo `userId` corresponda ao usuário autenticado. A lista deve vir ordenada por `uploadedAt` decrescente; em caso de empate, a ordem deve ser determinística. |
| RF-09 | O sistema deve permitir baixar um documento somente quando o identificador existir e o `owner` corresponder ao usuário da requisição. Um documento inexistente ou pertencente a outro usuário deve resultar em `404`, sem revelar qual condição ocorreu. |
| RF-10 | O download deve ser entregue como anexo, usando o nome original para apresentação ao cliente e um `Content-Type` coerente com o tipo registrado. |
| RF-11 | Se o registro de metadados falhar após a gravação do arquivo, o sistema deve tentar remover o arquivo recém-gravado e retornar erro interno, evitando deixar um arquivo órfão sempre que possível. |
| RF-12 | A interface deve apresentar o resultado da listagem, permitir selecionar um arquivo para upload, exibir estados de carregamento e erros compreensíveis e iniciar o download de um documento listado. |
| RF-13 | O sistema deve permitir cadastrar usuários e autenticar credenciais, sem expor senhas ou hashes nas respostas. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os binários devem ser armazenados exclusivamente no filesystem local em `backend/storage`, usando Multer `diskStorage`; não usar armazenamento externo. |
| RNF-02 | Os metadados devem permanecer em memória nesta fase. Reiniciar o processo do backend remove os metadados, embora os arquivos no disco possam permanecer. |
| RNF-03 | Porta e parâmetros operacionais devem ser configuráveis por variáveis de ambiente, seguindo o princípio 12-Factor. |
| RNF-04 | O limite inicial sugerido é de 10 MB por arquivo, configurável por ambiente. A lista inicial de tipos permitidos deve ser definida/configurada antes da implementação; extensão e MIME sozinhos não comprovam o conteúdo real. |
| RNF-05 | Erros da API devem usar respostas JSON consistentes, exceto quando uma resposta de download estiver sendo transmitida. Mensagens não devem incluir caminhos locais ou detalhes internos. |
| RNF-06 | O nome original do arquivo deve ser tratado como dado não confiável ao compor cabeçalhos HTTP ou exibi-lo na interface. |
| RNF-07 | A aplicação deve tratar falhas de leitura e gravação no filesystem sem encerrar o processo e sem informar detalhes internos ao cliente. |
| RNF-08 | O código deve seguir JavaScript sem TypeScript, backend Node.js/Express em CommonJS, frontend React/Vite em ESM e testes backend com `node:test`. |
| RNF-09 | O backend deve validar assinatura, algoritmo, expiração e usuário do JWT em todos os ambientes; deve falhar ao iniciar sem segredo válido. |
| RNF-10 | O backend deve limitar uploads por IP (20 por minuto por padrão, configurável por `MAX_UPLOADS_PER_MINUTE`) e limitar partes, campos e quantidade de arquivos multipart. O limite de taxa não substitui quota total de armazenamento. |
| RNF-11 | Usuários devem ser persistidos em arquivo JSON local com hashes bcrypt; cadastro e login têm limite de 20 tentativas por IP por minuto. |

## 5. Modelo de dados (metadados do documento)

Os metadados são mantidos por um repositório em memória. O nome físico é um detalhe interno de persistência: não deve ser serializado para o cliente.

| Campo | Tipo | Visibilidade | Descrição |
| --- | --- | --- | --- |
| `id` | string | Público | Identificador único, opaco e não sequencial do documento. Gerado pelo backend. |
| `originalName` | string | Público | Nome original fornecido pelo cliente, preservado para exibição e download com tratamento seguro. |
| `size` | number | Público | Tamanho do arquivo em bytes. Deve ser maior que zero e não exceder o limite configurado. |
| `uploadedAt` | string | Público | Data e hora do recebimento bem-sucedido, em ISO 8601 UTC. |
| `owner` | string | Público | Identificador do usuário autenticado, correspondente ao `userId` interno. |
| `userId` | string | Interno | Identificador do proprietário extraído do token validado. |
| `mimeType` | string | Interno | Tipo MIME registrado para validação e cabeçalho de download. É metadado fornecido pelo cliente, não prova do conteúdo. |
| `storageName` | string | Interno | Nome gerado pelo backend para localizar o binário dentro de `backend/storage`; nunca é um caminho fornecido pelo cliente nem enviado na resposta da API. |

Exemplo de representação pública:

```json
{
  "id": "9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2",
  "originalName": "relatorio.pdf",
  "size": 48231,
  "uploadedAt": "2026-11-11T14:30:00.000Z",
  "owner": "c0d0e112-3ba9-44d1-8101-c9e430263889"
}
```

A referência interna ao binário é resolvida exclusivamente no backend. Nenhum endpoint aceita um caminho de filesystem como entrada.

## 6. Contratos de API

### Convenções

- As rotas abaixo são relativas ao backend Express e não incluem prefixo `/api`.
- No navegador, o frontend usa `/api` e o proxy do Vite remove esse prefixo antes de encaminhar ao backend. Portanto, por exemplo, `POST /api/upload` no frontend chega como `POST /upload` no Express.
- As requisições de upload usam `multipart/form-data`; listagem e erros usam JSON. O download retorna conteúdo binário.
- Os endpoints de documentos exigem `Authorization: Bearer <token>`. Cadastro, login e `/health` são públicos.
- Resposta de erro JSON:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Não foi possível processar a solicitação."
  }
}
```

As mensagens são destinadas ao usuário; o campo `code` é estável para tratamento pelo frontend. Não incluir stack trace, caminho local ou informação que permita distinguir documento inexistente de documento pertencente a outro usuário.

### POST /auth/register e POST /auth/login

- Ambos recebem JSON com `email` e `password`. A senha deve ter ao menos 8 caracteres e no máximo 72 bytes UTF-8.
- Cadastro retorna `201` com `{ "user": { "id", "email" } }`; email duplicado retorna `409`.
- Login retorna `200` com `{ "token", "user": { "id", "email" } }`; credenciais incorretas retornam `401` genérico.
- Dados inválidos retornam `400`; excesso de tentativas retorna `429`.

### POST /upload

- Finalidade: armazenar um documento e registrar seus metadados.
- Cabeçalho obrigatório: `Authorization: Bearer <token>`.
- Entrada: `multipart/form-data` com exatamente um campo de arquivo chamado `file`.
- Limite sugerido: 10 MB, configurável por ambiente. O nome e a lista dos parâmetros devem ser definidos na implementação, sem codificar valores operacionais espalhados por camadas.
- Saída de sucesso: `201 Created`.

```json
{
  "document": {
    "id": "9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2",
    "originalName": "relatorio.pdf",
    "size": 48231,
    "uploadedAt": "2026-11-11T14:30:00.000Z",
    "owner": "c0d0e112-3ba9-44d1-8101-c9e430263889"
  }
}
```

- Erros esperados:
  - `400 Bad Request`: campo `file` ausente, campo com nome inesperado ou mais de um arquivo.
  - `401 Unauthorized`: token ausente ou inválido.
  - `413 Payload Too Large`: arquivo acima do limite.
  - `415 Unsupported Media Type`: extensão ou MIME fora da allowlist configurada.
  - `500 Internal Server Error`: falha de gravação ou registro interno. A resposta não deve revelar detalhes internos; o backend deve tentar remover um binário que tenha sido gravado sem metadados.

### GET /documents

- Finalidade: listar metadados dos documentos associados ao usuário.
- Cabeçalho obrigatório: `Authorization: Bearer <token>`.
- Entrada: sem corpo. Paginação e filtros ficam fora do MVP.
- Saída de sucesso: `200 OK`, inclusive quando não houver documentos.

```json
{
  "documents": [
    {
      "id": "9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2",
      "originalName": "relatorio.pdf",
      "size": 48231,
      "uploadedAt": "2026-11-11T14:30:00.000Z",
      "owner": "c0d0e112-3ba9-44d1-8101-c9e430263889"
    }
  ]
}
```

- Ordenação: `uploadedAt` decrescente, com desempate determinístico por `id`.
- Erros esperados: `401 Unauthorized` para token ausente/inválido; `500 Internal Server Error` para falha inesperada.

### GET /documents/:id/download

- Finalidade: baixar o binário associado ao identificador público.
- Cabeçalho obrigatório: `Authorization: Bearer <token>`.
- Saída de sucesso: `200 OK`, corpo binário, `Content-Disposition: attachment` com o nome original tratado com segurança e `Content-Type` derivado do tipo registrado.
- Erros esperados:
  - `400 Bad Request`: formato do identificador inválido.
  - `401 Unauthorized`: token ausente ou inválido.
  - `404 Not Found`: documento inexistente, de outro usuário ou binário local indisponível. A resposta não deve distinguir esses casos.
  - `500 Internal Server Error`: falha inesperada antes do início da transmissão.
- Se ocorrer erro depois de iniciado o envio do binário, o backend deve encerrar a resposta de forma apropriada; não deve tentar enviar um segundo corpo JSON.

### Endpoint operacional existente

`GET /health` é um endpoint operacional já existente no seed do backend. Ele não faz parte dos contratos funcionais de gestão de documentos e deve continuar independente deles.

## 7. Decisões arquiteturais

### Backend

- Manter o fluxo de dependências `routes -> controllers -> services -> repositories`.
- `routes/`: declarar caminhos e middlewares necessários, incluindo a integração de upload com Multer.
- `controllers/`: adaptar cabeçalhos, parâmetros e arquivos recebidos para chamadas de serviço; mapear resultados e erros para HTTP.
- `services/`: validar regras de negócio, controlar associação ao usuário, metadados, autorização por owner e coordenação de operações de arquivo.
- `repositories/`: encapsular os metadados em memória e a localização interna dos arquivos, sem dependência de HTTP.
- Configurar Multer com `diskStorage` em `backend/storage`. Usar nome interno gerado pelo servidor, nunca o nome original como caminho. Garantir que o diretório exista ou seja criado pela inicialização apropriada.
- Restringir os limites multipart a um arquivo e nenhuma parte de formulário adicional; aplicar `MAX_UPLOADS_PER_MINUTE` por endereço IP e validar que nomes internos usados para resolver caminhos sejam UUIDs gerados pelo servidor.
- O middleware JWT valida o token e define `req.user.id` antes do upload ou acesso aos documentos. `X-User-Id` não é uma credencial.
- Manter erros de validação do Multer e de negócio mapeados para respostas HTTP consistentes na borda do sistema.

### Frontend

- Usar componentes funcionais React e separar apresentação, página e acesso HTTP conforme a estrutura existente (`components/`, `pages/`, `services/`).
- Centralizar chamadas `fetch` no serviço de API e usar o prefixo `/api` do proxy Vite.
- Manter o token somente em memória; logout e recarregamento encerram a sessão no frontend. O token permanece válido no servidor até a expiração.
- Renderizar apenas metadados públicos. Fazer download pelo endpoint dedicado, tratando resposta não-2xx e evitando construir URLs com caminhos de arquivo locais.

### Armazenamento e ciclo de vida

- Não introduzir banco de dados ou serviço externo: arquivos e usuários são locais, e metadados de documentos ficam em memória.
- O JSON de usuários e os limitadores em memória pressupõem um único processo backend; cópias de segurança devem proteger os hashes e permissões do arquivo.
- Uma reinicialização do backend esvazia o repositório em memória, mas não necessariamente remove os arquivos do disco. Arquivos remanescentes ficam inacessíveis pela API e podem consumir espaço; reconciliação e limpeza automática ficam fora do MVP.
- O diretório de armazenamento deve ser tratado como dado operacional local. Não servir seu conteúdo diretamente como diretório estático.

## 8. Operação

Configuração, execução e testes estão descritos no README. Em produção, usar HTTPS e configurar um proxy para encaminhar `/api` ao backend removendo o prefixo.

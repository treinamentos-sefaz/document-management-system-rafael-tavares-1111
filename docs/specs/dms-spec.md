# Especificação - Document Management System

## 1. Objetivo

Disponibilizar uma aplicação web para que usuários identificados possam enviar documentos, consultar os metadados dos próprios envios e baixar os arquivos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos documentos associados ao identificador do usuário informado na requisição.
- Download de um documento pelo identificador público, limitado ao mesmo usuário.
- Armazenamento dos binários no filesystem local em `backend/storage`, usando Multer com `diskStorage`.
- Armazenamento em memória dos metadados e da associação entre documento, usuário e nome interno do arquivo.
- Interface web React para upload, listagem, estados de carregamento/erro e download.
- Configuração do servidor e dos limites de upload por variáveis de ambiente.

### Fora do escopo

- Armazenamento em nuvem, provedores externos ou banco de dados para metadados.
- Versionamento, edição, compartilhamento, busca avançada ou exclusão de documentos.
- Cadastro, login, emissão de tokens ou outro mecanismo de autenticação nesta versão.
- Garantia de persistência dos metadados depois que o processo do backend for reiniciado.
- Upload de múltiplos arquivos em uma única requisição.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve aceitar um arquivo por requisição de upload em `multipart/form-data`, no campo `file`. |
| RF-02 | Em desenvolvimento, o sistema deve exigir um identificador não vazio no cabeçalho `X-User-Id`; em produção, deve obter a identidade exclusivamente de middleware de autenticação confiável. |
| RF-03 | O sistema deve rejeitar requisições sem arquivo, com mais de um arquivo, campos multipart extras, arquivo vazio ou arquivo que exceda o limite configurado. |
| RF-04 | O sistema deve aceitar somente os tipos de arquivo definidos na configuração do MVP, validando a extensão e o MIME informado. A implementação deve tratar esses valores como entrada não confiável; essa validação não equivale à inspeção do conteúdo do arquivo. |
| RF-05 | Após um upload válido, o sistema deve armazenar o binário em `backend/storage`, gerar um identificador público único e registrar seus metadados em memória. |
| RF-06 | O nome físico do arquivo deve ser gerado pela aplicação e não pode depender do nome enviado pelo usuário. A API não deve expor caminhos nem nomes físicos do filesystem. |
| RF-07 | O sistema deve retornar os metadados do documento criado e não o conteúdo binário no resultado do upload. |
| RF-08 | O sistema deve listar somente documentos cujo `owner` corresponda ao `X-User-Id` da requisição. A lista deve vir ordenada por `uploadedAt` decrescente; em caso de empate, a ordem deve ser determinística. |
| RF-09 | O sistema deve permitir baixar um documento somente quando o identificador existir e o `owner` corresponder ao usuário da requisição. Um documento inexistente ou pertencente a outro usuário deve resultar em `404`, sem revelar qual condição ocorreu. |
| RF-10 | O download deve ser entregue como anexo, usando o nome original para apresentação ao cliente e um `Content-Type` coerente com o tipo registrado. |
| RF-11 | Se o registro de metadados falhar após a gravação do arquivo, o sistema deve tentar remover o arquivo recém-gravado e retornar erro interno, evitando deixar um arquivo órfão sempre que possível. |
| RF-12 | A interface deve apresentar o resultado da listagem, permitir selecionar um arquivo para upload, exibir estados de carregamento e erros compreensíveis e iniciar o download de um documento listado. |

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
| RNF-09 | O modo de demonstração usa `X-User-Id`, que pode ser falsificado. Em `NODE_ENV=production`, o backend deve falhar ao iniciar sem middleware confiável configurado por `DMS_AUTH_MIDDLEWARE`; esse middleware deve definir `req.user.id`. |
| RNF-10 | O backend deve limitar uploads por IP (20 por minuto por padrão, configurável por `MAX_UPLOADS_PER_MINUTE`) e limitar partes, campos e quantidade de arquivos multipart. O limite de taxa não substitui quota total de armazenamento. |

## 5. Modelo de dados (metadados do documento)

Os metadados são mantidos por um repositório em memória. O nome físico é um detalhe interno de persistência: não deve ser serializado para o cliente.

| Campo | Tipo | Visibilidade | Descrição |
| --- | --- | --- | --- |
| `id` | string | Público | Identificador único, opaco e não sequencial do documento. Gerado pelo backend. |
| `originalName` | string | Público | Nome original fornecido pelo cliente, preservado para exibição e download com tratamento seguro. |
| `size` | number | Público | Tamanho do arquivo em bytes. Deve ser maior que zero e não exceder o limite configurado. |
| `uploadedAt` | string | Público | Data e hora do recebimento bem-sucedido, em ISO 8601 UTC. |
| `owner` | string | Público | Identidade do usuário: no modo de demonstração vem de `X-User-Id`; em produção vem de `req.user.id` fornecido pelo middleware confiável. |
| `mimeType` | string | Interno | Tipo MIME registrado para validação e cabeçalho de download. É metadado fornecido pelo cliente, não prova do conteúdo. |
| `storageName` | string | Interno | Nome gerado pelo backend para localizar o binário dentro de `backend/storage`; nunca é um caminho fornecido pelo cliente nem enviado na resposta da API. |

Exemplo de representação pública:

```json
{
  "id": "9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2",
  "originalName": "relatorio.pdf",
  "size": 48231,
  "uploadedAt": "2026-11-11T14:30:00.000Z",
  "owner": "usuario-123"
}
```

A referência interna ao binário é resolvida exclusivamente no backend. Nenhum endpoint aceita um caminho de filesystem como entrada.

## 6. Contratos de API

### Convenções

- As rotas abaixo são relativas ao backend Express e não incluem prefixo `/api`.
- No navegador, o frontend usa `/api` e o proxy do Vite remove esse prefixo antes de encaminhar ao backend. Portanto, por exemplo, `POST /api/upload` no frontend chega como `POST /upload` no Express.
- As requisições de upload usam `multipart/form-data`; listagem e erros usam JSON. O download retorna conteúdo binário.
- No modo de demonstração, `X-User-Id` é obrigatório em todos os endpoints funcionais e não autentica o cliente. Em produção, o owner vem de `req.user.id`; o cabeçalho declarado pelo cliente não é fonte de identidade.
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

### POST /upload

- Finalidade: armazenar um documento e registrar seus metadados.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
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
    "owner": "usuario-123"
  }
}
```

- Erros esperados:
  - `400 Bad Request`: cabeçalho ausente/inválido, campo `file` ausente, campo com nome inesperado ou mais de um arquivo.
  - `413 Payload Too Large`: arquivo acima do limite.
  - `415 Unsupported Media Type`: extensão ou MIME fora da allowlist configurada.
  - `500 Internal Server Error`: falha de gravação ou registro interno. A resposta não deve revelar detalhes internos; o backend deve tentar remover um binário que tenha sido gravado sem metadados.

### GET /documents

- Finalidade: listar metadados dos documentos associados ao usuário.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
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
      "owner": "usuario-123"
    }
  ]
}
```

- Ordenação: `uploadedAt` decrescente, com desempate determinístico por `id`.
- Erros esperados: `400 Bad Request` para cabeçalho ausente/inválido; `500 Internal Server Error` para falha inesperada.

### GET /documents/:id/download

- Finalidade: baixar o binário associado ao identificador público.
- Cabeçalho obrigatório: `X-User-Id: <identificador>`.
- Saída de sucesso: `200 OK`, corpo binário, `Content-Disposition: attachment` com o nome original tratado com segurança e `Content-Type` derivado do tipo registrado.
- Erros esperados:
  - `400 Bad Request`: cabeçalho ou formato do identificador inválido.
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
- Em produção, carregar por `DMS_AUTH_MIDDLEWARE` um módulo CommonJS que exporte o middleware de autenticação e defina `req.user.id`. A aplicação deve falhar ao iniciar se o middleware não estiver configurado.
- Manter erros de validação do Multer e de negócio mapeados para respostas HTTP consistentes na borda do sistema.

### Frontend

- Usar componentes funcionais React e separar apresentação, página e acesso HTTP conforme a estrutura existente (`components/`, `pages/`, `services/`).
- Centralizar chamadas `fetch` no serviço de API e usar o prefixo `/api` do proxy Vite.
- Para desenvolvimento local, obter o identificador de usuário por configuração de demonstração definida para a aplicação; não tratar esse valor como credencial nem alegar que protege os dados. Em produção, o owner deve vir da identidade autenticada no backend.
- Renderizar apenas metadados públicos. Fazer download pelo endpoint dedicado, tratando resposta não-2xx e evitando construir URLs com caminhos de arquivo locais.

### Armazenamento e ciclo de vida

- Não introduzir banco de dados ou serviço externo: arquivos locais e metadados em memória são restrições desta versão.
- Uma reinicialização do backend esvazia o repositório em memória, mas não necessariamente remove os arquivos do disco. Arquivos remanescentes ficam inacessíveis pela API e podem consumir espaço; reconciliação e limpeza automática ficam fora do MVP.
- O diretório de armazenamento deve ser tratado como dado operacional local. Não servir seu conteúdo diretamente como diretório estático.

## 8. Plano de execução

As etapas abaixo descrevem trabalho futuro após aprovação desta especificação. Nesta etapa de planejamento, somente este documento deve ser criado; não executar tarefas de backend ou frontend.

1. Revisar e aprovar requisitos, limite de upload, allowlist de tipos e a premissa temporária de `X-User-Id` sem autenticação.
2. Definir variáveis de ambiente e configuração do backend, incluindo limite, tipos permitidos e localização fixa `backend/storage`.
3. Implementar repositório em memória, persistência local com Multer `diskStorage` e geração de nomes/IDs internos seguros.
4. Implementar serviços e controllers para upload, listagem e download, incluindo isolamento por owner, tratamento de falhas e limpeza compensatória quando possível.
5. Registrar as rotas Express e os mapeamentos consistentes de status e erros; preservar o endpoint operacional existente.
6. Criar testes backend com `node:test` para upload válido/inválido, limites, tipos, listagem ordenada e isolada, download, documento ausente e falhas de armazenamento.
7. Implementar no frontend o serviço de API e as telas/componentes de upload, listagem, estados de erro/carregamento e download.
8. Validar o fluxo integrado via proxy `/api`, executar testes e verificações disponíveis e atualizar a documentação operacional necessária.

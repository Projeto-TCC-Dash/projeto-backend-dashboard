<!--
SYNC IMPACT REPORT:
- Version change: 2.0.0 → 2.1.0 (MINOR: Expansão material de governança para suporte a Contas Bancárias/Cartões e esclarecimento LGPD na ingestão OFX)
- Last Amended Date: 2026-10-19
- Modified Principles:
  - PRINCIPLE_5 → V. Ingestão de Extratos Bancários (OFX/CSV) e Provedor Local de Dados Sintéticos (Seed)
    - Formalizada a associação de transações do Esquema Canônico à entidade de Conta bancária/cartão (accountId).
    - Motor de seed sintético atualizado para provisionar contas padrão estruturadas (ex: Conta Corrente, Cartão de Crédito) e vincular as transações geradas.
  - PRINCIPLE_7 → VII. Autenticação Stateless e Conformidade Estrita com LGPD (JWT & Privacy-by-Design)
    - Clarificada a ingestão OFX: metadados transitórios de extrato (como BANKID e ACCTID) podem ser processados exclusivamente em memória e em tempo de execução para identificação da instituição financeira ou derivação de apelidos amigáveis/mascarados (ex: "Conta Final 1234").
    - Reafirmada a proibição irrevogável de persistir números reais e completos de agência, conta corrente ou cartão no MongoDB.
- Added Sections: Nenhuma
- Removed Sections: Nenhuma
- Follow-up TODOs: Nenhum
-->

# Plataforma de Inteligência Financeira Pessoal Constitution

## Core Principles

### I. Escopo Estrito de Backend (TypeScript & Node.js Strict)
O escopo deste repositório é estritamente restrito à API de Backend executada em Node.js com TypeScript configurado em modo estrito (`strict: true`).
- É TERMINANTEMENTE PROIBIDO o uso de `any` explícito ou implícito em qualquer módulo de negócio, contratos de API, DTOs e entidades de banco.
- O compilador TypeScript (`tsconfig.json`) DEVE aplicar as regras: `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitReturns` e `noUncheckedIndexedAccess`.
- Qualquer tipagem dinâmica externa DEVE ser recebida como `unknown` e obrigatoriamente submetida a *narrowing* via esquemas Zod ou *type guards* verificáveis antes do processamento.
- Nenhuma dependência, código ou marcação de interface gráfica (frontend) DEVE ser introduzida neste projeto.

*Rationale*: A gestão de dados financeiros exige previsibilidade absoluta e integridade de tipos em tempo de compilação, prevenindo erros de execução e garantindo consistência em pipelines críticos de dados.

### II. Stack Tecnológica Sem Dependências Relacionais (Fastify, Zod & MongoDB/Mongoose)
A arquitetura do backend DEVE ser sustentada exclusivamente pelo ecossistema Fastify, validação de esquemas Zod e persistência em banco de dados NoSQL MongoDB através do Mongoose.
- O Fastify é o único framework HTTP homologado, com serialização e tipagem integradas via provedores de tipos Zod (`fastify-type-provider-zod`).
- Todas as rotas DEVEM declarar contratos rígidos de entrada (`params`, `querystring`, `body`, `headers`) e esquemas de resposta validados em runtime com Zod.
- O armazenamento persistente DEVE ser executado exclusivamente em MongoDB nativo gerenciado via Mongoose ODM.
- É EXPRESSAMENTE PROIBIDA a adição de bancos de dados relacionais (PostgreSQL, MySQL, SQLite, etc.) ou ORMs relacionais (Prisma relacional, TypeORM relacional, Sequelize).

*Rationale*: O Fastify oferece alto rendimento e baixo overhead de memória. A validação via Zod unifica inferência estática e proteção em tempo de execução. O modelo NoSQL orientado a documentos do MongoDB é a estrutura ideal para schemas polimórficos de transações originadas de múltiplos formatos heterogêneos.

### III. Arquitetura BYOK & Custo Zero de IA no Servidor (AES-256-GCM)
O backend adota o modelo Bring Your Own Key (BYOK) para todos os serviços de inteligência artificial generativa, assegurando custo zero de inferência na infraestrutura do servidor.
- O servidor NÃO DEVE prover, compartilhar ou custear chaves de API para consumo de IA da plataforma. As requisições à API do Google AI Studio (Gemini) utilizam exclusivamente a API Key do usuário autenticado.
- A chave do usuário NUNCA DEVE ser armazenada em texto plano no banco de dados, exposta em payloads de resposta ou registrada em arquivos de log.
- O backend DEVE criptografar a API Key do usuário utilizando o padrão `AES-256-GCM` antes de persistir no MongoDB, gerando vetor de inicialização (IV) exclusivo de 96 bits por documento e autenticação por *tag* de 128 bits, sob uma chave mestra do sistema (`ENCRYPTION_KEY`) de 256 bits gerenciada via variáveis de ambiente.
- A chave do usuário só DEVE ser descriptografada em memória volátil durante o ciclo de vida estrito da requisição que interage com o Gemini, sendo imediatamente descartada após a execução.

*Rationale*: Elimina passivos operacionais e riscos financeiros associados a custos imprevisíveis de LLM, mantendo o controle financeiro sob posse do usuário e protegendo credenciais sensíveis com padrões criptográficos consolidados.

### IV. Minimização Extrema de Tokens & Processamento Local Pré-LLM
É TERMINANTEMENTE PROIBIDO encaminhar payloads brutos de arquivos (.ofx, .csv) ou metadados desnecessários do banco de dados para a LLM. O backend DEVE executar triagem, sanitização e deduplicação local antes de qualquer requisição externa de IA.
- O processamento de extratos DEVE seguir obrigatoriamente três etapas locais determinísticas pré-LLM:
  1. *Parsing e Sanitização*: Extração dos campos essenciais da transação e remoção de ruídos de formato.
  2. *Deduplicação de Descrições*: Agrupamento de descrições repetidas de transações, isolando e enviando à LLM apenas uma lista com os textos únicos de lançamentos para classificação.
  3. *Reassociação Local*: Mapeamento das categorias retornadas pela IA de volta para todas as transações correspondentes no banco de dados, executado inteiramente pelo backend.
- Prompts para o Gemini DEVEM exigir respostas estritamente estruturadas (JSON Schema / Structured Outputs), limitando o contexto aos dados mínimos requeridos para a tarefa de enriquecimento/categorização.

*Rationale*: Reduz drasticamente a latência de rede, economiza a cota de tokens e taxa de requisições (rate limits) da chave do usuário, previne envio acidental de dados redundantes e otimiza a performance global do sistema.

### V. Ingestão de Extratos Bancários (OFX/CSV) e Provedor Local de Dados Sintéticos (Seed)
A plataforma DEVE prover suporte nativo à ingestão de dados financeiros através de arquivos de extrato bancário e disponibilizar um motor autônomo e 100% local de geração de dados sintéticos para testes e amostragem, eliminando dependências de provedores externos de Open Finance.
- Canal de Ingestão de Produção: O backend DEVE aceitar upload multipart de extratos nos formatos OFX (SGML) e CSV, tratando adequadamente variações de encoding (UTF-8, ISO-8859-1/Windows-1252) e delimitadores locais (; ou ,).
- Motor Local de Dados Sintéticos (Seed): O ambiente de desenvolvimento e testes DEVE dispor de script de seed autônomo e determinístico, capaz de gerar e popular o banco de dados com contas padrão estruturadas (ex: Conta Corrente, Cartão de Crédito) e massa de transações brasileiras realistas associadas a essas contas, sem requisições de rede ou dependências de serviços de terceiros.
- Esquema Canônico Unificado e Associação a Contas: Todos os lançamentos ingeridos via extratos ou gerados via seed DEVEM ser normalizados para o Esquema Canônico Unificado de Transação antes da sanitização, categorização e persistência, suportando associação relacional lógica à entidade de Conta bancária/cartão (`accountId`).
- Desacoplamento dos Módulos: Os parsers de extrato e o gerador de dados sintéticos DEVEM ser concebidos como adaptadores desacoplados e testáveis de maneira isolada.

*Rationale*: O upload manual de extratos (OFX/CSV) é o padrão universal e soberano adotado pelos usuários da plataforma, eliminando fricção regulatória, contratos de Open Finance e passivos de segurança. A geração local de dados sintéticos estruturados com contas e transações confere velocidade instantânea (<1s), confiabilidade e independência total de conexão externa para demonstrações e testes do dashboard.

### VI. Containerização Integral e Resiliência (Docker Compose & Healthcheck)
Todo o ecossistema da aplicação DEVE ser 100% conteinerizado e executável via Docker Compose, sem dependências de binários instalados na máquina do host além da engine do Docker.
- A orquestração via Docker Compose DEVE definir healthchecks explícitos para o serviço do MongoDB (via comando de ping administrativo).
- O serviço do backend no Compose DEVE declarar dependência condicional ao status saudável do banco de dados (`depends_on: { mongodb: { condition: service_healthy } }`).
- A aplicação Fastify DEVE disponibilizar uma rota de monitoramento `/health` que reporte a prontidão operacional e a conectividade com o banco de dados.
- O Dockerfile da aplicação DEVE utilizar *multi-stage build* para produzir imagens enxutas e executar sob usuário não-root (*non-root user*) em ambiente de produção.

*Rationale*: Garante paridade rigorosa entre ambientes de desenvolvimento e produção, mitiga condições de corrida durante a inicialização do cluster e segue boas práticas consagradas de segurança de containers.

### VII. Autenticação Stateless e Conformidade Estrita com LGPD (JWT & Privacy-by-Design)
A autenticação na API DEVE ser totalmente stateless baseada em JSON Web Tokens (JWT), e todos os fluxos de ingestão e armazenamento DEVEM cumprir integralmente o princípio de minimização de dados da Lei Geral de Proteção de Dados (LGPD).
- As requisições protegidas DEVEM ser autenticadas via JWT no cabeçalho `Authorization: Bearer <token>`, validadas em hooks globais de ciclo de vida (`onRequest` ou `preHandler`) do Fastify.
- *Privacy by Design na Ingestão*: Durante a leitura e processamento de extratos (OFX e CSV), identificadores bancários sensíveis e dados pessoais identificáveis (PII) — incluindo números de agência, conta corrente, CPF, CNPJ, dados de cartão e documentos de titularidade — DEVEM ser descartados sumariamente na camada de parsing. Metadados transitórios de extrato (como tags `<BANKID>` ou `<ACCTID>`) podem ser processados exclusivamente em memória e em tempo de execução para identificação da instituição financeira ou derivação de apelidos amigáveis/mascarados para contas (ex: "Conta Final 1234").
- É PROIBIDO persistir números reais completos de agência, conta corrente e documentos pessoais no MongoDB.
- É TERMINANTEMENTE PROIBIDO enviar qualquer PII ou identificador bancário pessoal para a LLM.
- Registros de logs da aplicação NÃO DEVEM conter tokens JWT, senhas, chaves de API ou dados de transações que identifiquem diretamente a titularidade civil do usuário.

*Rationale*: Reduz a superfície de exposição a ataques, atende às exigências de privacidade da legislação brasileira (LGPD) e garante que nenhum vazamento acidental exponha dados bancários cadastrais dos usuários.

## Diretrizes de Segurança, Criptografia e Privacidade

A implementação do backend DEVE obedecer às seguintes diretrizes operacionais de proteção de dados:
- **Gestão de Segredos**: Segredos da aplicação (`JWT_SECRET`, `ENCRYPTION_KEY`) DEVEM ser fornecidos exclusivamente via variáveis de ambiente, validadas na inicialização do servidor por um esquema Zod de ambiente. A ausência de qualquer variável obrigatória DEVE interromper imediatamente a inicialização do processo com erro claro.
- **Padrão Criptográfico AES-256-GCM**: O módulo criptográfico DEVE derivar ou utilizar uma chave de 32 bytes (256 bits), gerar um vetor de inicialização (IV) aleatório de 12 bytes por cifragem e anexar a tag de autenticação de 16 bytes junto ao texto cifrado, garantindo confidencialidade e autenticidade da chave BYOK do usuário.
- **Sanitização de Strings Financeiras**: Expressões regulares e rotinas locais DEVEM expurgar padrões de CPFs/CNPJs e códigos numéricos de agência/conta contidos incidentalmente em descrições textuais de transações antes de qualquer persistência ou envio à IA.
- **Isolamento Multi-tenant Lógico**: Todas as operações de leitura, escrita e consulta no MongoDB DEVEM filtrar estritamente pelo identificador do usuário autenticado extraído do payload do JWT verificado.

## Fluxo de Desenvolvimento e Garantia de Qualidade

Todo o ciclo de engenharia do backend DEVE seguir as seguintes práticas de qualidade e verificação:
- **Contratos como Fonte Única da Verdade**: Schemas Zod definem a tipagem de entrada, saída e validação de rotas do Fastify, impedindo divergências entre documentação e código em execução.
- **Estratégia de Testes**:
  - *Testes Unitários*: Cobertura obrigatória para os algoritmos de parsing (OFX/CSV), rotinas de criptografia/decriptografia AES-256-GCM, funções de sanitização/LGPD e agrupamento/deduplicação de transações.
  - *Testes de Integração*: Cobertura de rotas Fastify, ciclo de autenticação JWT, integração com MongoDB (utilizando instâncias isoladas de teste ou MongoDB em memória) e testes determinísticos do gerador de seed sintético local.
- **Verificação Estática e Linting**: O pipeline de integração contínua (CI) e os scripts de validação local DEVEM executar `tsc --noEmit` para garantir conformidade estrita de tipos TypeScript e análise de linter sem supressões não autorizadas.
- **Pipeline Determinístico de Ingestão**: O fluxo de dados de transações DEVE cumprir a ordem imutável: Upload/Fetch → Parsing do Formato → Descarte LGPD de PII → Deduplicação de Descrições → Enriquecimento BYOK Gemini → Reassociação Local → Persistência no MongoDB.

## Governance

A presente Constituição estabelece as diretrizes arquiteturais e normativas soberanas para o desenvolvimento do backend da Plataforma de Inteligência Financeira Pessoal.
- **Soberania da Constituição**: Nenhuma convenção local, preferência de implementação ou solicitação de pull request pode violar os princípios fundamentais aqui estabelecidos. Violações identificadas em code reviews DEVEM bloquear a mesclagem até a completa adequação.
- **Procedimento de Emenda**: Qualquer alteração, inclusão ou revogação de princípios DEVE ser proposta através de documentação clara de justificativa arquitetural, discussão formal e aprovação antes da atualização deste documento.
- **Política de Versionamento SemVer**:
  - *MAJOR*: Modificações que alterem princípios fundamentais, quebrem a política de BYOK, substituam a stack Fastify/Zod/MongoDB ou alterem as garantias centrais de segurança e privacidade.
  - *MINOR*: Adição de novos princípios, novos canais de ingestão compatíveis ou expansão material das diretrizes de segurança sem invalidar regras vigentes.
  - *PATCH*: Correções de texto, melhorias de redação, clarificações técnicas ou correções tipográficas sem alteração semântica das obrigações.
- **Auditoria de Conformidade**: Cada nova funcionalidade, rota ou refatoração DEVE ser auditada contra os 7 Princípios Centrais antes de ser integrada à branch principal.

**Version**: 2.1.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-19

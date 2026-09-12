# Onboarding de transportadoras

Como a RookHub recebe, aprova e entrega um ambiente pronto para uma transportadora nova — conectado
à telemetria, com a marca do cliente e com os módulos contratados ativos — e como o Dono ganha
autonomia para desenhar os cargos e montar o próprio time.

⚠️ **Proposta, não implementação.** Nada descrito aqui existe no código ainda. O PDF equivalente,
para circular com a equipe, está em `docs/pdf/RookHub-Plano-Onboarding-Transportadoras.pdf`.
Atualizar os dois juntos.

⚠️ **O PDF está defasado desde 11/09/2026.** As seções `O produto que isto constrói` e
`Fase 6c` entraram só neste Markdown. Regerar o PDF antes de circular com a equipe.

## Por que existe

A RookHub vai deixar de ser um sistema de um cliente só, e hoje **não existe nenhum caminho para
criar acesso**:

- `users` e `tenants` são somente leitura no Java: sem setters, sem endpoint de escrita.
- Não há tabela de convites, nem qualquer transporte de e-mail no projeto.
- Em produção o banco nasce vazio. O `docker-compose.prod.yml` registra o motivo: *"a seed de
  demonstração não roda e o banco nasce sem usuário nenhum"* — ninguém consegue logar.
- `/convite/:token`, `/admin-saas/*` e `/gestao/equipe` existem no `System-web`, mas são mock
  (`src/mocks/saas.ts`, `login-page.tsx:518`).
- Os perfis são um enum fixo de 6 valores (`UserRole.java`), repetido no `CHECK` do banco e no mapa
  `ROLE_PERMISSIONS` do frontend. Não existe "Diretor", e não há como criar um.

O fluxo pretendido, fechado: a transportadora pede acesso pelo site institucional → o time da
RookHub é avisado por e-mail e decide no backoffice → a aprovação parametriza e provisiona a empresa
e cria **apenas a credencial do Dono** → o Dono define os cargos e cadastra o time.

## O produto que isto constrói

⚠️ **Visão registrada pelo Lucas em 11/09/2026.** Ela quase não contradiz o plano abaixo: é a
leitura de negócio dele, e serve para conferir se o plano já cobre tudo. Onde faltava, virou fase
nova ou ponto em aberto, e a tabela aponta onde.

A RookHub passa a ter **dois tipos de endereço**:

- `app.rookhub.com.br` é a casa da equipe RookHub. Nós, desenvolvedores, entramos por ali com conta
  de plataforma, e é a única porta do backoffice.
- `<cliente>.rookhub.com.br` é a casa de cada transportadora, com dados isolados, marca própria e
  tela de login personalizada. `amazonas.rookhub.com.br` é o exemplo de trabalho.

Da tela de Super Admin, a equipe precisa conseguir:

| O que o Lucas descreveu | Onde está no plano |
| ----------------------- | ------------------ |
| Alcançar as empresas que já estão na plataforma | Fase 7, leitura auditada. **Entrar como o cliente não está previsto**, ver os pontos em aberto |
| **Criar uma empresa do zero**, sem esperar solicitação | **Fase 6c**, escrita a partir desta conversa |
| Informar CNPJ, logo e os parâmetros globais da empresa | Fase 6b, passos 1 e 2 |
| Escrever o subdomínio e vê-lo criado sozinho na Cloudflare | Fase 10, registro do domínio via API |
| Ter o banco do cliente criado sozinho | Fase 2, `TenantProvisioningService`. ⚠️ Ver a ressalva abaixo |
| Entregar ao cliente um login com a logo dele | Fase 6b, `platform.tenant_branding`, lida antes do login |

⚠️ **"Banco isolado" precisa de uma decisão explícita.** O Lucas descreveu *um banco totalmente
isolado por cliente*; o plano escolheu **schema por tenant num só Postgres**, pelos motivos em
`Por que schema, e não banco físico por cliente`. As duas formas entregam a garantia que ele está
pedindo, que é nenhuma consulta de um cliente alcançar dado de outro, mesmo com bug de `WHERE`. A
diferença entre elas é de custo operacional e de capacidade, não de vazamento. Como a escolha muda
a Fase 2 inteira, ela está nos pontos em aberto, para ser confirmada antes de a Fase 2 começar.

### Organização, matriz e filiais

⚠️ **Acrescentado pelo Lucas em 11/09/2026.** É a única parte da visão dele que o plano não
modelava, e mexe no desenho de dados.

A regra que ele descreveu: os usuários da Servioeste podem estar na **matriz** ou numa **filial**, e
seguem pertencendo à organização Servioeste. Cada empresa do grupo tem os próprios usuários
cadastrados.

**O que já existe, e não basta.** A árvore de matriz e filiais **já está no banco**, em
`fleet_sites` (`parent_id`, `kind = 'OrganisationGroup'`), com as views `fleet_companies` e
`fleet_site_company` subindo por ela recursivamente. A Servioeste hoje tem dois níveis. Só que essa
árvore é **sincronizada da MiX**: `fleet_sites.integration_id` é `NOT NULL`, então ela só existe
para cliente com telemetria conectada. Duas consequências:

1. a Fase 6b libera ambiente **sem** telemetria (`PENDING_CONNECTOR` e `PENDING_CONTRACT`), e esse
   cliente não teria filial nenhuma a que vincular usuário;
2. a `V16` já registra que a filial crua do fornecedor não descreve operação: 14 dos 40 caminhões da
   Servioeste caem em "Default Site" e 2 em "DESLIGADOS / INATIVOS".

**Decisão que isto exige:** matriz e filial viram **cadastro da RookHub**, e a árvore da MiX volta a
ser o que sempre foi, ponto de partida para conferência. É a mesma regra já aplicada ao cadastro de
veículo e de motorista.

```sql
-- No schema do cliente: a estrutura é da organização dele, não da plataforma.
CREATE TABLE units (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants (id),
    parent_id  UUID REFERENCES units (id),        -- nulo = matriz
    name       TEXT NOT NULL,
    cnpj       TEXT,
    site_id    UUID REFERENCES fleet_sites (id),  -- espelho do fornecedor, só para conferência
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nulo = enxerga a organização inteira. É como o Dono nasce.
ALTER TABLE users ADD COLUMN unit_id UUID REFERENCES units (id);
```

⚠️ **`unit_id` nulo não pode virar "vê tudo" por acidente.** A regra precisa ser explícita no
`WHERE`, do mesmo jeito que `tenant_id` é: quem tem unidade enxerga a dela e as que estão abaixo
dela na árvore; quem não tem enxerga a organização inteira. Esquecer a checagem não gera erro, gera
filial lendo dado de filial, em silêncio.

### Mesma pessoa em duas transportadoras

O Lucas confirmou em 11/09/2026 a decisão que já estava na tabela abaixo: quem trabalha na
Servioeste e na Amazonas Transportes tem **dois acessos**, um em cada.

Vale registrar por que isso sai de graça nos dois desenhos de isolamento em disputa: tanto com
schema por tenant quanto com banco por cliente, `users` é uma tabela **por cliente**, e a unicidade
de e-mail passa a valer dentro de cada um. O mesmo e-mail existe nos dois sem colidir, e o
subdomínio do login já diz qual dos dois responder. **É o desenho de hoje, com um `public`
compartilhado e a `users_email_unique` global da `V1`, que proibiria exatamente o caso que o Lucas
descreveu.** A Fase 2 formaliza isso trocando a restrição por um índice parcial que ainda ignora
quem foi anonimizado, para o endereço poder ser reusado.

## Decisões tomadas

| Tema | Decisão |
| ---- | ------- |
| Isolamento | Schema por tenant, num só Postgres |
| Vínculo usuário↔empresa | 1:1. Mesma pessoa em duas empresas = duas credenciais. Confirmado pelo Lucas em 11/09/2026 |
| Matriz e filial | Unidades **dentro** do tenant, cadastradas pela RookHub. Um subdomínio por organização, não por filial |
| Perfis do cliente | Cargos customizáveis: o Dono cria, nomeia e escolhe as permissões |
| Equipe RookHub | Dois papéis fixos: TI Topo e TI Operacional |
| Suporte | Leitura dos dados do cliente, todo acesso auditado |
| Exclusão de conta | Desativar na hora + anonimizar depois. Nunca `DELETE` |
| Quem cria/deleta | TI Topo: contas da plataforma e o Dono. Dono: a equipe dele |
| Telemetria | MiX conecta na hora; outro fornecedor entra pendente e não trava o onboarding |
| Conta no fornecedor | É do cliente. A RookHub intermedia, não revende — mantém o que a V6 assume |
| Marca | Logo e cores pelo TI Topo; fonte de lista homologada. Aparece já no login |
| Planos | O plano barra no backend e na tela. É o teto; o cargo distribui o que sobrou |
| Notificação | Resend (HTTP) |
| Credencial do Dono | Link de convite por e-mail, token de uso único |
| Formulário de pedido | Site institucional → endpoint público na API |
| Cadastro direto | O TI Topo também cria a empresa sem solicitação nenhuma (Fase 6c) |
| Subdomínio | Slug definido pelo time da RookHub na aprovação |
| Bootstrap | `ROOKHUB_BOOTSTRAP_*`, idempotente no boot |
| Hospedagem do SPA | Cloudflare Pages, domínio por tenant via API |
| Dados atuais | Migração in-place `public` → `tenant_servioeste` |

## Duas medições que definem o tamanho da obra

**A tenancy não se espalha pelo código.** As colunas `tenant_id` e os `WHERE tenant_id = :tenant`
**não mudam** — são 136 ocorrências de `tenant_id` em **15** arquivos Java (os 22 arquivos saem de
uma contagem mais larga, que inclui o `tenantId` do lado Java; conferido em 11/09/2026). O schema
isola; o `WHERE` vira defesa em profundidade de graça. O único código de tenancy que muda é *como a
conexão escolhe o schema*.

**A autorização também não.** O backend inteiro tem **19 `@PreAuthorize` em 3 controllers**
(`FleetController` 10, `MixDiagnosticsController` 7, `VoiceController` 2) mais uma checagem solta em
`FleetContextBuilder.java:67`. No frontend são 50 usos em 19 arquivos, mas quase todos já passam por
`hasPermission()` — a abstração certa já existe, muda só quem a alimenta.

### Por que schema, e não banco físico por cliente

Banco por transportadora entrega isolamento máximo a um custo operacional alto: 29 migrations em N
bancos a cada deploy, N pools, backup em laço e — o pior — o painel de Super Admin deixaria de
conseguir um único `SELECT` para métricas globais. Schema no mesmo Postgres entrega a garantia que
importa (nenhuma consulta atravessa clientes, mesmo com bug de `WHERE`) por uma fração do custo.

⚠️ Detalhe específico desta stack: `daily_vehicle_metrics` é uma *continuous aggregate*
(`V4__telemetria_desempenho.sql:79`) e `timescaledb.max_background_workers` é limite **por
instância**, não por schema. Com banco por cliente isso viraria problema real de capacidade.

⚠️ **Precisão sobre as métricas globais, conferida em 11/09/2026.** A Fase 6 implementa o agregador
**em laço**, percorrendo os tenants ativos, que é exatamente o que aconteceria com banco por
cliente. A vantagem do schema não é evitar o laço agora, é **manter a saída aberta**: num Postgres
só, trocar o laço por um `UNION ALL` entre schemas é reescrever uma consulta; com banco por cliente
essa saída não existe, e o laço vira permanente. Lidas sem esta observação, as duas passagens
parecem se contradizer.

### O que o mercado faz, e a recomendação

⚠️ **Escrito em 11/09/2026, a pedido do Lucas.** Serve à decisão que está em aberto no fim do
documento, e não substitui a confirmação dele.

O vocabulário da indústria, o mesmo do AWS SaaS Lens, tem três níveis:

| Modelo | Como é | Quem usa |
| ------ | ------ | -------- |
| **Pool** | Uma tabela para todos, separada por `tenant_id` | A maioria dos SaaS no começo. É o desenho de hoje aqui |
| **Bridge** | Um schema por cliente, num banco só | A escolha deste plano. Comum em B2B com dezenas a centenas de clientes |
| **Silo** | Banco ou instância por cliente | Enterprise e setor regulado, vendido como plano dedicado |

O padrão corrente **não é escolher um e ficar nele**: é rodar *pool* ou *bridge* por padrão e
**vender o silo como camada premium** ao cliente que exigir isolamento físico em contrato.

**Recomendação: manter schema por tenant.** Três motivos medidos neste repositório:

1. ⚠️ **O TimescaleDB corre CONTRA o banco separado, não a favor.** São 3 hypertables e **3
   agregados contínuos por cliente**, cada um com política de refresh (`V4`). O
   `max_background_workers` é limite por **instância**, e o TimescaleDB ainda quer um worker de
   scheduler **por banco**. Banco por cliente no mesmo servidor paga esse custo e **não compra
   isolamento de capacidade nenhum**. Só servidor separado compraria, e aí é outro orçamento.
2. **O teto real é o Cloudflare, não o Postgres.** O plano free registra no máximo **100 domínios
   por projeto** no Pages (Fase 10). Schema por tenant é confortável nessa ordem de grandeza; os
   problemas conhecidos de muitos schemas aparecem na casa dos milhares.
3. **A migração é de mão única.** Sair de schema para banco depois é copiar um schema para um banco
   novo, operação conhecida. O caminho inverso é bem pior.

**O que acrescentar por precaução:** o `TenantRegistry` da Fase 2 deve guardar **como se conecta a
cada cliente**, em vez de "mesmo banco, outro schema" ficar implícito espalhado pelo código. Custa
quase nada agora, e é o que permite depois mover um cliente grande para o banco dele sem reescrever
a camada de dados, que é exatamente como se vende o plano dedicado.

---

# O modelo de perfis

O enum de seis valores é substituído por dois modelos diferentes, um por lado da plataforma.

## Lado RookHub — papéis fixos

| Papel | Quem é | O que pode |
| ----- | ------ | ---------- |
| `PLATFORM_ADMIN` | TI Nível Topo | Controle global. **Único** que cria e desliga contas — da plataforma e o Dono de cada transportadora. Aprova solicitações, suspende empresas |
| `PLATFORM_SUPPORT` | TI Nível Operacional | Suporte e manutenção. **Leitura** dos dados de qualquer cliente, sempre auditada. Nenhuma escrita, nenhuma gestão de conta |

Ficam em `platform.platform_users`, fora de qualquer transportadora — pelo motivo já registrado na
seed de dev: *"quem administra a plataforma não entra pela porta de quem opera uma transportadora"*.

## Lado cliente — cargos que o Dono desenha

```sql
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants (id),
    key         TEXT NOT NULL,            -- 'dono', 'diretor-financeiro'
    name        TEXT NOT NULL,            -- 'Diretor Financeiro'
    description TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    landing     TEXT NOT NULL DEFAULT 'operacional',  -- 'gestao' | 'operacional'
    -- Cargo de sistema: semeado por nós, não pode ser apagado nem renomeado.
    -- O Dono é o único com system = TRUE.
    system      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT roles_key_unique UNIQUE (key)
);

ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles (id);
```

Toda transportadora nova nasce com seis cargos semeados:

| Cargo | `system` | Landing | Observação |
| ----- | :------: | ------- | ---------- |
| Dono | ✅ | gestao | Todas as permissões, mais `team.manage` e `roles.manage`. Indelével |
| Gestor | — | gestao | Editável e apagável pelo Dono |
| Diretor | — | gestao | **Novo.** Visão gerencial sem gestão de equipe |
| Operador | — | operacional | Mantém a regra RF-007 de não ver financeiro |
| Manutenção | — | operacional | |
| Motorista | — | operacional | Só o app do motorista |

Os cinco não-sistema nascem como sugestão: o Dono renomeia, altera permissões, apaga ou cria outros.

## Quem pode o quê

| Ação | TI Topo | TI Oper. | Dono | Demais cargos |
| ---- | :-----: | :------: | :--: | :-----------: |
| Criar/desligar conta de plataforma | ✅ | — | — | — |
| Aprovar transportadora e criar o Dono | ✅ | — | — | — |
| Criar/editar/apagar cargos da empresa | intervenção auditada | — | ✅ | — |
| Convidar/desligar membro da equipe | intervenção auditada | — | ✅ | — |
| Ler dados operacionais do cliente | ✅ auditado | ✅ auditado | ✅ | conforme o cargo |
| Escrever dados operacionais | — | — | ✅ | conforme o cargo |

⚠️ **Suposição a confirmar.** Como o Dono é o *responsável exclusivo* pela equipe, `team.manage` e
`roles.manage` ficam **não delegáveis**: pertencem só ao cargo Dono e não aparecem no editor de
cargos. Liberá-las no catálogo é o suficiente para relaxar isso depois.

---

# Fase 1 — Plano de controle: schema `platform`

Nova pasta `src/main/resources/db/migration/platform/`, com instância Flyway própria
(`defaultSchema=platform`).

```sql
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE platform.tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,   -- subdomínio E nome do schema
    schema_name TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    document    TEXT,
    plan        TEXT NOT NULL DEFAULT 'business',
    status      TEXT NOT NULL DEFAULT 'trial',
    trial_ends_at      TIMESTAMPTZ,
    provisioning_state TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|RUNNING|READY|FAILED
    provisioning_error TEXT,
    telemetry_state    TEXT NOT NULL DEFAULT 'PENDING_CONTRACT',
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]{2,30}$'),
    CONSTRAINT tenants_plan_check   CHECK (plan IN ('starter','business','enterprise')),
    CONSTRAINT tenants_status_check CHECK (status IN ('active','trial','suspended','cancelled'))
);

-- Equipe interna da RookHub. Papéis FIXOS: são nossos, não têm por que ser configuráveis.
CREATE TABLE platform.platform_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ,
    anonymized_at  TIMESTAMPTZ,
    created_by    UUID REFERENCES platform.platform_users (id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT platform_users_role_check
        CHECK (role IN ('PLATFORM_ADMIN','PLATFORM_SUPPORT'))
);
```

Mais `platform.access_requests` (fila de solicitações), `platform.email_outbox` (fila de envio,
para o convite não se perder se a Resend falhar), `platform.audit_log` e `platform.tenant_branding`
(ver Fase 6b).

Slugs reservados, como constante Java: `app, api, www, admin, mail, cdn, status, docs, dev, staging,
painel, suporte`.

# Fase 2 — Migrations por tenant, cargos e provisionamento

**Mover** `db/migration/V1..V27` para `db/migration/tenant/` **sem editar**. Dentro do schema do
cliente os `tenant_id` são inofensivos, e reescrever 27 arquivos não pagaria.

`V28__cargos_convites_e_desligamento.sql` cria a tabela `roles` mostrada acima, mais:

```sql
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN invited_by     UUID REFERENCES users (id);
ALTER TABLE users ADD COLUMN last_login_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deactivated_by UUID REFERENCES users (id);
ALTER TABLE users ADD COLUMN anonymized_at  TIMESTAMPTZ;

-- O e-mail passa a ser único DENTRO da empresa, não no mundo.
-- Anonimizados saem do índice, então o endereço pode ser reusado.
ALTER TABLE users DROP CONSTRAINT users_email_unique;
CREATE UNIQUE INDEX users_email_unique ON users (lower(email)) WHERE anonymized_at IS NULL;

CREATE TABLE invites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants (id),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256; o token cru só existe no e-mail
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`V29__enum_de_papel_aposentado.sql` migra `users.role` para o `role_id` equivalente, torna a coluna
obrigatória e derruba `users_role_check` e a coluna de texto.

## Catálogo de permissões

As 21 permissões de `System-web/src/types/auth.ts` viram a fonte canônica, espelhadas num enum
`Permission` em Java e servidas por `GET /v1/permissions` (chave, rótulo, grupo) para o editor de
cargos montar os checkboxes sem hardcode. Entram quatro novas: `team.manage`, `roles.manage` (não
delegáveis) e, do lado plataforma, `accounts.manage` e `support.read`.

## `TenantProvisioningService`

1. valida o slug (formato, reservados, unicidade);
2. `CREATE SCHEMA tenant_<slug>`;
3. roda o Flyway de `db/migration/tenant` apontado para esse schema;
4. insere a linha espelho em `tenant_<slug>.tenants` com o **mesmo UUID** de `platform.tenants` — é
   o que mantém os 136 `WHERE tenant_id` funcionando;
5. semeia os seis cargos;
6. cria o usuário Dono com o cargo Dono, sem senha utilizável, e gera o convite.

Roda **assíncrono**: 29 migrations levam segundos demais para um request HTTP. A tela de aprovação
acompanha por polling; falha grava `provisioning_error` e descarta o schema parcial.

O `FlywayAutoConfiguration` é desligado (`spring.flyway.enabled: false`) e substituído por um bean
que roda no boot: primeiro o Flyway do `platform`, depois o `tenant` para cada cliente ativo — assim
um deploy novo migra todas as empresas antes do primeiro request.

**Arquivos:** `application.yml`, novos `api/config/FlywayConfig.java`,
`api/tenancy/TenantProvisioningService.java`, `api/tenancy/TenantRegistry.java`.

# Fase 3 — Roteamento de schema por requisição

Em `api/tenancy/`:

- **`CurrentTenant`** — `ThreadLocal<String>` com o schema da requisição.
- **`TenantAwareDataSource extends DelegatingDataSource`** — em `getConnection()`, executa
  `SET search_path TO "<schema>", public`.
- **`TenantFilter extends OncePerRequestFilter`** — resolve o tenant e valida host contra token.

## Por que no DataSource, e não no Hibernate

O Hibernate tem `MultiTenantConnectionProvider` para schema, mas ele **não cobriria este projeto**:
a maior parte das consultas usa `JdbcClient` cru, que passa por fora dele. No `DataSource`, cobre
JPA e `JdbcClient` de uma vez.

## Três cuidados obrigatórios

1. **Injeção.** `search_path` não aceita bind parameter. O schema **nunca** vem de string do
   request: vem do `TenantRegistry`, alimentado por `platform.tenants`. A allowlist é a proteção.
2. **Vazamento entre clientes.** Conexão de pool é reaproveitada. O `search_path` é reescrito em
   **todo checkout**, sem depender de reset no `close()`.
3. **Ordem dos filtros.** O `TenantFilter` roda **antes** da cadeia de segurança, porque a Fase 4
   resolve permissões consultando `roles` dentro do schema do cliente. Invertido, a consulta cai no
   schema errado e todo mundo perde acesso.

## Ordem de resolução do tenant

1. JWT autenticado → claim `tenant` (fonte de verdade, como manda o javadoc do `TenantContext`);
2. rota pública (`/v1/auth/login`, `/v1/public/invites/**`) → slug do `Origin`/`Host`;
3. token de plataforma + header `X-Rookhub-Tenant` → acesso de suporte (Fase 7).

Token de um tenant no host de outro → **403**. Sem tenant no contexto: `platform, public`.

# Fase 4 — Autorização por permissão (o enum morre)

Com cargos livres, "gestor" deixa de significar a mesma coisa em duas transportadoras. A autorização
passa a perguntar *o que você pode fazer*, não *qual é seu cargo*.

| Antes | Depois |
| ----- | ------ |
| `hasRole('OWNER') or hasRole('MANAGER')` | `hasAuthority('vehicles.create')` |
| `... or hasRole('OPERATOR')` (registry) | `hasAuthority('vehicles.update')` |
| `hasRole('OWNER') or hasRole('SUPER_ADMIN')` (MiX) | `hasAuthority('integrations.manage')` |
| `FleetContextBuilder.java:67` | `permissions.contains("analytics.view")` |

## De onde vêm as permissões

O JWT carrega `role_id`, **não** a lista de permissões. Um `RoleCatalog` em memória, chaveado por
`(tenantId, roleId)` e invalidado a cada escrita em `roles`, resolve as authorities por requisição.

⚠️ **Por que não colocar as permissões no token.** O access token dura 60 minutos por decisão já
registrada em `application.yml`, e não é revogável. Com as permissões embutidas, tirar o acesso de
alguém só valeria até uma hora depois — o tipo de coisa que vira chamado de suporte ("removi o
acesso dele e ele continua entrando"). Resolvendo por requisição, vale na requisição seguinte.

Contas de plataforma não têm cargo: o converter emite `ROLE_PLATFORM_ADMIN`/`ROLE_PLATFORM_SUPPORT`
mais as permissões implícitas.

## Gestão de cargos — `RoleController` (`hasAuthority('roles.manage')`)

`GET /v1/roles`, `POST /v1/roles`, `PATCH /v1/roles/{id}`, `DELETE /v1/roles/{id}`,
`GET /v1/permissions`. Regras que o serviço impõe:

- cargo `system` não é editável nem apagável;
- apagar cargo em uso exige informar para qual cargo migrar os usuários;
- `team.manage` e `roles.manage` no corpo → 422: não são delegáveis;
- permissão fora do catálogo → 422;
- toda escrita invalida o `RoleCatalog` e grava no `audit_log`.

# Fase 5 — Autenticação com dois mundos

`LoginRequest` ganha `tenantSlug`, derivado pelo SPA de `window.location.hostname`:

- `app` → procura em `platform.platform_users`; JWT com `scope: "platform"`, sem claim `tenant`;
- outro slug → resolve a empresa, exige `provisioning_state = READY` e `active`, procura o usuário
  **dentro do schema do cliente**; JWT com `scope: "tenant"`, `tenant`, `slug` e `role_id`.

⚠️ **Quem manda é o host, não o corpo (conflito resolvido em 11/09/2026).** A `Ordem de resolução
do tenant` da Fase 3 resolve rota pública pelo `Origin`/`Host`, e a regra de ouro do `TenantContext`
proíbe tenant vindo do corpo da requisição. O `tenantSlug` do `LoginRequest` é conveniência do SPA:
o servidor **compara com o host e recusa com 403 se divergirem**, em vez de confiar no JSON. Sem
essa comparação as duas passagens se contradizem, e a implementação escolhe a errada.

`/refresh` passa a guardar o schema junto do refresh token no Redis — hoje faz `users.findById` sem
saber onde procurar.

**Bootstrap** — `ApplicationRunner`: sem nenhum `PLATFORM_ADMIN` ativo e com
`ROOKHUB_BOOTSTRAP_EMAIL`/`_PASSWORD` definidos, cria um com `must_change_password = true`.
Idempotente, nenhuma senha no repositório.

⚠️ **CORS quebra sem correção.** `SecurityConfig` usa `setAllowedOrigins(split(","))`, que não aceita
curinga com `allowCredentials(true)` — e ele está ligado. Trocar por
`setAllowedOriginPatterns("https://*.rookhub.com.br")`. Sem isso, nenhum cliente novo consegue logar.

# Fase 6 — Fluxo de acesso e ciclo de vida das contas

## Público (rate limit por IP + campo-armadilha)

| Rota | O que faz |
| ---- | --------- |
| `POST /v1/public/access-requests` | Grava em `platform.access_requests` + enfileira e-mail ao time |
| `GET /v1/public/invites/{token}` | Devolve empresa, e-mail e cargo. Nada além |
| `POST /v1/public/invites/{token}/accept` | Define a senha, ativa o usuário, emite sessão |
| `GET /v1/public/branding` | Marca do cliente pelo host, antes do login (Fase 6b) |

O contrato do primeiro precisa de documentação para o site institucional consumir.

## Plataforma

`hasRole('PLATFORM_ADMIN')`: `GET/POST /v1/saas/access-requests`, `/{id}/approve`, `/{id}/reject`,
`POST /v1/saas/tenants/{id}/suspend|reactivate`, CRUD de `/v1/saas/platform-users`.

`PLATFORM_ADMIN` ou `PLATFORM_SUPPORT`: `GET /v1/saas/tenants`, `/{id}`, `GET /v1/saas/metrics`.

**Métricas globais:** um serviço percorre os tenants ativos trocando o `CurrentTenant` e agrega em
Java. Suficiente na ordem de grandeza atual; se pesar, vira `UNION ALL` — possível porque é um
Postgres só.

## Equipe da transportadora — `TeamController`, `hasAuthority('team.manage')`

`GET /v1/team` (já existe), `POST /v1/team` (convida: nome, e-mail, `roleId`),
`PATCH /v1/team/{id}`, `DELETE /v1/team/{id}`, `POST /v1/team/{id}/resend-invite`.

⚠️ **Falha atual:** `GET /v1/team` **não tem `@PreAuthorize`** — qualquer usuário autenticado,
inclusive um operador, lista e-mail e cargo de todo o painel da empresa. Corrigir mesmo que o resto
seja recusado.

## Desligamento: desativar + anonimizar

`DELETE /v1/team/{id}` **não** faz `DELETE`. Faz:

1. `active = false`, grava `deactivated_at` e `deactivated_by`;
2. **revoga os refresh tokens no Redis na hora** — sem isso a pessoa segue logada por até 30 dias;
3. registra no `audit_log`.

Um job diário anonimiza quem passou do prazo de retenção: nome vira `Usuário removido`, e-mail vira
`removido+<id>@rookhub.invalid`, `password_hash` é zerado, `anonymized_at` é marcado.

⚠️ **Por que não apagar a linha.** `assistant_queries`, `notification_reads` e
`notification_dismissals` têm FK para `users`. A seed de dev documenta que um `DELETE` em users já
**derrubou o boot da API** por causa de `assistant_queries_user_id_fkey`. Desativar preserva
histórico e auditoria; anonimizar atende o direito de eliminação da LGPD. Na tela o botão continua
se chamando "excluir".

Guarda obrigatória: **não é possível desativar o último Dono ativo** da transportadora.

# Fase 6b — A aprovação parametriza o ambiente

A tela de aprovação vira um formulário de quatro passos: **dados e slug → telemetria → marca →
plano**. O ambiente só vira `READY` quando os quatro estiverem resolvidos.

⚠️ **"Resolvido" é ter decidido, não é estar conectado (esclarecido em 11/09/2026).**
`provisioning_state` e `telemetry_state` são colunas separadas em `platform.tenants`, e só a
primeira barra o login (Fase 5). Escolher "outro fornecedor" ou "nenhum ainda" **resolve** o passo
da telemetria, e o ambiente vira `READY` do mesmo jeito, como diz a tabela abaixo. Ler "os quatro
resolvidos" como "telemetria conectada" deixaria todo cliente fora da MiX sem conseguir entrar.

## 1. Telemetria

A arquitetura **já é multi-fornecedor**: `integrations (tenant_id, provider, label)`,
`integration_credentials` cifradas em AES-256-GCM e `IntegrationRegistry.ensure(...)`. Falta só a
parametrização na aprovação. Mas **só a MiX tem conector implementado**.

| Escolha do TI Topo | O que acontece |
| ------------------ | -------------- |
| MiX | Grava a credencial com o `MixCredentialStore` que já existe, testa a conexão e libera a coleta. `telemetry_state = CONNECTED` |
| Outro fornecedor | `integrations` com `active = false` e o nome do fornecedor. `telemetry_state = PENDING_CONNECTOR`. **O ambiente é liberado assim mesmo** |
| Nenhum ainda | A RookHub indica o fornecedor homologado; a contratação é do cliente. `telemetry_state = PENDING_CONTRACT` |

A conta no fornecedor é **do cliente**. Isso preserva o que a V6 documenta (*"cada transportadora
contrata a MiX diretamente… a RookHub não é a revendedora do rastreamento"*) e evita que a saída de
um cliente vire disputa sobre rastreador instalado.

A tela de integrações precisa dizer em que estado está, em vez de mostrar frota vazia sem explicação.

## 2. Marca

```sql
-- Em platform, não no schema do cliente: é parametrizado pela RookHub e lido
-- ANTES do login, quando ainda não há sessão nem tenant no token.
CREATE TABLE platform.tenant_branding (
    tenant_id     UUID PRIMARY KEY REFERENCES platform.tenants (id) ON DELETE CASCADE,
    logo_mime     TEXT,
    logo_bytes    BYTEA,
    color_primary TEXT NOT NULL DEFAULT '#d5623a',
    color_accent  TEXT,
    font_family   TEXT NOT NULL DEFAULT 'default',  -- chave da lista homologada
    updated_by    UUID REFERENCES platform.platform_users (id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT branding_color_check CHECK (color_primary ~ '^#[0-9a-fA-F]{6}$')
);
```

`BYTEA` segue o padrão de `driver_photos` (V15), cuja decisão está documentada: o Object Storage da
Oracle é o destino, mas a conta ainda está em teste; migrar depois é trocar o corpo de duas rotas.
Limite de 256 KB, PNG ou SVG.

**Aplicação no frontend:** `System-web/src/styles/palette.css` já define `--primary: #d5623a` e
`globals.css` mapeia `--color-primary: var(--primary)`. A marca do cliente é um bloco `<style>`
injetado no boot sobrescrevendo essas variáveis — **nenhum componente muda**, e a estrutura de telas
permanece padronizada.

A **fonte** vem de lista homologada (chave, não arquivo). Upload livre traria licenciamento de
terceiro para dentro da nossa hospedagem e risco de tipografia ilegível em tela de operação.

## 3. Módulos por plano

⚠️ Hoje `plans.ts` define `modulesForPlan` e `isModuleEnabled` **só no navegador**; o backend nunca
verifica. Bastaria abrir o DevTools para usar um módulo não contratado.

O catálogo de permissões ganha um mapa `ModuleKey → Permission[]`, e o plano vira um **filtro sobre
o catálogo**:

1. o plano da empresa define quais módulos existem;
2. o `RoleCatalog` (Fase 4) **intersecta** as permissões do cargo com as do plano;
3. o editor de cargos só oferece o que o plano cobre;
4. rota de módulo não contratado devolve **402**, não 403 — a distinção permite à tela oferecer
   upgrade em vez de dizer "sem acesso".

O plano é o teto da empresa; o cargo distribui o que sobrou. Trocar o plano vale na requisição
seguinte, pelo mesmo mecanismo da Fase 4.

`PLAN_DEFINITIONS` também define `vehicleLimit` e `userLimit`. Ficam **fora** deste plano: entram
quando houver cobrança de verdade.

# Fase 6c — Criação direta pelo backoffice

⚠️ **Pedido do Lucas em 11/09/2026.** Até aqui, o plano só previa empresa nascendo de uma
solicitação vinda do site. Na prática, as primeiras transportadoras vão chegar por conversa
comercial, e obrigar o time a preencher o formulário público em nome do cliente, para depois
aprovar a si mesmo, seria teatro.

O backoffice ganha um botão **Cadastrar transportadora**, restrito ao `PLATFORM_ADMIN`. Ele abre o
mesmo formulário de quatro passos da aprovação, com duas diferenças:

1. o passo 1 nasce vazio, em vez de vir preenchido pela solicitação;
2. não há solicitação para marcar como aprovada, então nada muda em `access_requests`.

Tudo o que vem depois é idêntico: mesma validação de slug, mesmo `TenantProvisioningService`, mesmo
registro de domínio na Cloudflare, mesmo convite ao Dono, mesma linha de auditoria. **O assistente é
um código só**, e a origem da empresa entra como coluna:

```sql
ALTER TABLE platform.tenants
    ADD COLUMN origin TEXT NOT NULL DEFAULT 'ACCESS_REQUEST';
    -- 'ACCESS_REQUEST' | 'BACKOFFICE'
```

Vale uma coluna, e não um detalhe de tela, porque responde a uma pergunta de negócio que vai ser
feita: quantos clientes chegaram sozinhos pelo site e quantos vieram de venda ativa.

**Frontend:** `saas-tenants-page.tsx` ganha o botão, e reaproveita o `approval-wizard.tsx`, que hoje
recebe a solicitação por prop e passa a aceitar também a ausência dela. Nenhuma tela nova.

# Fase 7 — Acesso de suporte aos dados do cliente

O TI Operacional precisa enxergar o problema para resolvê-lo. O mecanismo: token de plataforma mais
o header `X-Rookhub-Tenant: <slug>`.

⚠️ **Isto contradiz o javadoc do `TenantContext`** (*"SEMPRE da claim do token, nunca de parâmetro,
cabeçalho ou corpo"*). É exceção deliberada e precisa ficar documentada no próprio arquivo — senão
vira a brecha que aquele comentário existe para evitar. O que a torna segura:

1. o header **só** é lido quando o token tem `scope: "platform"`;
2. **qualquer método diferente de GET é recusado com 403**, no filtro, antes do controller;
3. toda requisição grava em `platform.audit_log`: quem, quando, qual empresa, qual rota;
4. o backoffice tem tela de auditoria de acessos de suporte, visível ao TI Topo.

Impersonação ("entrar como o cliente") encaixa aqui se a equipe quiser depois — exige consentimento
do Dono, prazo e trilha própria. Fora deste plano.

# Fase 8 — E-mail (Resend)

`api/notification/`: `EmailSender` (interface), `ResendEmailSender` (`RestClient`, no padrão de
`integration/mix/MixClient.java`), `EmailOutboxService`, `EmailOutboxScheduler` (backoff
exponencial, 5 tentativas), `EmailTemplates` (HTML embutido, sem dependência nova).

Modelos: `access-request-received` (interno), `tenant-approved-owner-invite`, `team-member-invite`,
`access-request-rejected`, `account-deactivated`. Config sob `rookhub.email`, com `enabled: false`
em dev — grava no log em vez de enviar.

Pré-requisito externo: verificar `rookhub.com.br` na Resend (registros DNS na Cloudflare).

## Estado do DNS, conferido em 11/09/2026

A zona `rookhub.com.br` está ativa na Cloudflare e tem **4 registros**: um `A`, um `CNAME` e dois
`AAAA`. Duas conclusões úteis:

- ⚠️ **O domínio não envia nem recebe e-mail hoje.** Não há `MX`, nem `TXT` de SPF, nem DKIM, nem
  DMARC. Isso é **boa notícia**: a verificação da Resend não vai brigar com SPF de outro provedor,
  que é o atrito clássico. Começa do zero.
- ⚠️ **O curinga `*.rookhub.com.br` da Fase 10 ainda não existe.** Sem ele nenhum subdomínio de
  cliente resolve, por mais que a aprovação registre o domínio no Pages.

**Ordem que evita espera parada**, já que verificação de domínio depende de propagação e de
aprovação de terceiro:

1. criar a conta na Resend e pegar os registros que ela pede (DKIM, e o SPF do subdomínio de envio);
2. publicá-los na Cloudflare e esperar a verificação;
3. só então implementar o `ResendEmailSender`, que já encontra o domínio pronto.

O passo 1 é de quem tem o cartão e o acesso à conta, e **não** está feito. Enquanto não estiver, o
`rookhub.email.enabled: false` de desenvolvimento mantém tudo funcionando com o e-mail indo para o
log, então nada aqui bloqueia as outras fases.

# Fase 9 — Frontend

Novo `src/app/tenant-host.ts`: extrai o slug de `window.location.hostname`; `app` é modo plataforma;
`localhost` cai em `VITE_TENANT_SLUG`. O slug entra no login e num header de todo request.

**O mapa estático de permissões morre.** Hoje `services/auth.ts` monta a sessão com
`permissionsForRole(role)` a partir de `ROLE_PERMISSIONS`. Passa a vir do servidor.

⚠️ **A tabela abaixo envelheceu em 11/09/2026.** `saas-requests-page.tsx` e `saas-team-page.tsx`
estão marcadas como **nova**, mas **já existem**, criadas no redesenho do backoffice, sobre mock.
Para as duas a tarefa é desmocar, não criar. Continuam mesmo por fazer: `change-password-page.tsx`,
`features/roles/`, `features/units/` e `app/tenant-host.ts`.

⚠️ **A lista de slugs reservados já existe em TypeScript**, em `src/app/tenant-slug.ts`, com os
mesmos doze valores e o mesmo formato que a Fase 1 pede em Java. São duas cópias da mesma regra, e
quem mexer numa precisa mexer na outra: o slug é subdomínio **e** nome de schema, então divergir
aqui cria empresa que o backend aceita e o frontend recusa, ou o contrário.

| Arquivo | Mudança |
| ------- | ------- |
| `src/app/permissions.ts` | `ROLE_PERMISSIONS`, `permissionsForRole`, `ROLE_LABELS` e `HUB_ROLES` saem |
| `src/types/auth.ts` | `AuthUser` troca `role: UserRole` por `role: { id, name, landing }`, ganha `scope` e `tenantSlug` |
| `src/app/router.tsx` | landing vem de `role.landing`; `AdminRoute` exige `scope === 'platform'`; guarda nova valida slug contra host |
| `src/management/features/roles/` | **novo** — lista de cargos, editor com checkboxes por módulo, exclusão com migração |
| `src/management/features/units/` | **novo**, árvore de matriz e filiais, do Dono. O convite de membro passa a escolher a unidade |
| `src/management/features/team/api.ts` | trocar `mockTeam()` por `/v1/team` + convidar, trocar cargo, desligar |
| `src/pages/saas/saas-requests-page.tsx` | **nova** — fila de solicitações, aprovar/recusar, slug, telemetria, marca, plano |
| `src/pages/saas/saas-team-page.tsx` | **nova** — contas da equipe RookHub (só TI Topo) |
| `src/pages/saas/saas-audit-page.tsx` | desmocar; inclui os acessos de suporte |
| `src/pages/saas/saas-tenants-page.tsx` + detalhe | trocar mocks por `/v1/saas/tenants` |
| `src/pages/login/login-page.tsx` (`InvitePage`) | substituir o `login({ role: 'MANAGER' })` mockado pelo aceite real |
| `src/pages/misc/change-password-page.tsx` | **nova** — primeiro acesso |
| `src/components/layout/demo-controls.tsx` | o seletor de perfil assume cargos dinâmicos ou fica restrito aos mocks |

# Fase 10 — Infraestrutura e publicação

| Item | O que muda |
| ---- | ---------- |
| DNS | `*.rookhub.com.br` → projeto Pages. O SSL universal cobre um nível de subdomínio |
| Cloudflare Pages | Plano free não aceita domínio curinga: cada aprovação registra o domínio via API. Limite de 100 por projeto |
| `docker-compose.prod.yml` | `CORS_ORIGINS` com curinga; entram `RESEND_API_KEY`, `ROOKHUB_BOOTSTRAP_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` |
| `deploy/Caddyfile` | Sem mudança — a API segue só em `api.rookhub.com.br` |
| TimescaleDB | Cada schema tem suas próprias continuous aggregates. Subir `timescaledb.max_background_workers` conforme crescer |
| `deploy/backup-postgres.sh` | Comando não muda; documentar restore de um cliente: `pg_restore -n tenant_<slug>` |

**Migração in-place** — novo `deploy/migrate-to-schema-per-tenant.sql`, rodado uma vez com a API
parada: move todas as tabelas e views de `public` para `tenant_servioeste`, **incluindo o
`flyway_schema_history`**. Levar o histórico junto é o que faz o Flyway do tenant enxergar V1..V27
como aplicadas e rodar só V28/V29. Nenhuma telemetria se perde.

**Seed de dev** (`db/dev/R__seed_desenvolvimento.sql`): passa a criar a Servioeste pelo
provisionador e a semear um `PLATFORM_ADMIN` de desenvolvimento — que hoje, deliberadamente, não
existe.

---

# Verificação

## Automatizada

`./mvnw test` e `npm run typecheck && npm test && npm run lint`.

- `TenantAwareDataSourceTest`: conexão reaproveitada do pool não vaza `search_path`.
- `TenantProvisioningServiceTest`: schema criado, 29 migrations aplicadas, 6 cargos semeados,
  desfazimento limpo em falha.
- `RoleServiceTest`: cargo `system` não é editável nem apagável; `team.manage` no corpo → 422;
  permissão fora do catálogo → 422; apagar cargo em uso sem destino → 409.
- `RoleCatalogTest`: tirar uma permissão do cargo vale na **requisição seguinte**, sem esperar o
  token expirar.
- `AuthControllerTest`: mesmo e-mail em dois tenants loga em cada um com a sua senha; token da
  Servioeste em host da Amazonas → 403; slug reservado → 422.
- `SupportAccessTest`: `PLATFORM_SUPPORT` faz GET com `X-Rookhub-Tenant` e a linha aparece no
  `audit_log`; POST no mesmo caminho → 403; token de tenant com o header → header ignorado.
- `TeamServiceTest`: desativar revoga o refresh token na hora; desativar o último Dono → 409;
  anonimização preserva `assistant_queries` e `notification_reads`.
- `PlanGuardTest`: rota de módulo fora do plano → 402; subir o plano libera na requisição seguinte.
- `BrandingTest`: marca servida sem sessão; logo > 256 KB → 413; cor fora de `#rrggbb` → 422; fonte
  fora da lista → 422.

## Manual, ponta a ponta (dev)

1. `docker compose up -d`; API com perfil `dev`.
2. `POST /v1/public/access-requests` → conferir a linha e o e-mail no log.
3. Logar como `PLATFORM_ADMIN` (`VITE_TENANT_SLUG=app`) e aprovar com slug `amazonas`, fornecedor
   "outro", logo e cor próprios, plano `starter`.
4. No psql: `\dn` mostra `tenant_amazonas`; `SELECT * FROM tenant_amazonas.roles` tem 6 cargos;
   `users` tem **só** o Dono, inativo.
5. Abrir a Amazonas **sem logar**: a tela de login já mostra o logo e a cor. Em desenvolvimento o
   host não resolve, então vale `VITE_TENANT_SLUG=amazonas`, o mesmo recurso usado no passo 3.
6. Abrir o convite, definir senha, entrar em `/gestao`. A tela de integrações diz "aguardando
   conector", não frota vazia sem explicação.
7. Confirmar que Analytics e IA não aparecem (fora do `starter`) e que a rota direto devolve **402**.
   Subir para `business` no backoffice e confirmar que aparecem **sem novo login**.
8. Como Dono, criar o cargo "Diretor Financeiro" com `analytics.view` e `billing.manage`, convidar
   alguém, aceitar, e confirmar que essa pessoa não vê veículos nem consegue editar.
9. Tirar `billing.manage` do cargo e confirmar que a tela some **sem novo login**.
10. Tentar desativar o Dono → recusado. Desativar o Diretor → ele cai na próxima requisição.
11. Como `PLATFORM_SUPPORT`, abrir a Amazonas em leitura; tentar escrita → 403; conferir as duas
    linhas no `audit_log`.
12. **Prova de isolamento:** logar na Servioeste, chamar uma rota de frota e conferir no log do
    Postgres (`log_statement=all`) que o `search_path` é `tenant_servioeste`. Repetir na Amazonas.

## Produção

Rodar `deploy/migrate-to-schema-per-tenant.sql` com a API parada, subir com `ROOKHUB_BOOTSTRAP_*`
definidos, logar em `app.rookhub.com.br`, trocar a senha, **remover as variáveis de bootstrap** do
`.env` e reiniciar.

---

# Ordem de execução

| Ordem | Fases | Observação |
| :---: | ----- | ---------- |
| 1º | 1, 2, 3 — plataforma, cargos, roteamento de schema | Base. Não entrega tela nenhuma, e nada depois funciona sem ela |
| 2º | 4 — autorização por permissão | Mecânico, mas toca 19 anotações e a sessão do frontend. Melhor de uma vez |
| 3º | 5 — autenticação e bootstrap | Primeiro momento em que dá para logar em produção |
| 4º | 6, 6b, 6c, 7, 8 — endpoints, parametrização, cadastro direto, suporte, e-mail | O fluxo passa a existir ponta a ponta, ainda sem telas |
| 5º | 9 — telas | Desmocar backoffice, convite e equipe; editor de cargos |
| 6º | 10 — infra | Variáveis acompanham a fase 5; DNS e domínios no fim |

## Pontos em aberto para a equipe

- ⚠️ **Confirmar o isolamento: schema por tenant ou um banco por cliente.** O plano escolheu schema
  e o Lucas descreveu banco isolado, em 11/09/2026. Precisa ser decidido **antes** da Fase 2, que
  depende inteiramente disso, e é a única divergência real entre a visão dele e este plano. A
  recomendação, com o que o mercado faz e os três motivos medidos, está em
  `O que o mercado faz, e a recomendação`. **É a decisão que destrava o resto.**
- **O Lucas pediu para "entrar nas empresas" pelo Super Admin.** Isso é impersonação, que a Fase 7
  deixa de fora de propósito. O ponto sobre leitura auditada bastar, mais abaixo, deixa de ser
  hipotético: existe um pedido concreto esperando resposta.
- **A Fase 6c cabe no mesmo lote da 6b**, porque depende só do provisionador e reaproveita o
  assistente. Confirmar que entra junto, e não depois.
- ⚠️ **Filial é unidade dentro do tenant, ou tenant próprio?** O plano assumiu a primeira, seguindo
  a descrição do Lucas de que a filial continua vinculada à organização. Se aparecer cliente cujas
  filiais tenham CNPJ, cobrança e dados que **não** podem se enxergar, a resposta muda para tenant
  próprio, e aí cada filial ganha subdomínio e ambiente separados. Decidir com um caso real na mão,
  não antes.
- **A tabela `units` precisa nascer semeada pela árvore da MiX** quando o cliente já tem telemetria,
  senão alguém vai recadastrar à mão 40 veículos de filial. Encaixa no
  `TenantProvisioningService`, mas só depois da primeira coleta, que é quando `fleet_sites` existe.
- **Cargos customizáveis aposentam o enum `UserRole`.** É a mudança de maior alcance e não gera tela
  nova até a fase 9. Confirmar o apetite antes de começar.
- A migração para schema por tenant também não gera tela. Fazer agora é bem mais barato que fazer
  com cinco clientes em produção.
- Reservar `app.rookhub.com.br` ao Super Admin **muda o endereço que a Servioeste já usa hoje**.
  Precisa de aviso e, de preferência, redirecionamento temporário.
- O acesso de suporte por header é exceção consciente à regra de ouro da tenancy. Confirmar se
  leitura auditada basta, ou se o time vai querer impersonação depois.
- Confirmar que `team.manage` e `roles.manage` **não** são delegáveis pelo Dono.
- **Só a MiX tem conector.** Aceitar cliente de outro fornecedor significa entregar ambiente sem
  telemetria por tempo indeterminado. Decidir se isso se vende, e com qual promessa de prazo.
- **Limites de veículos e usuários dos planos ficam de fora**, apesar de definidos em `plans.ts`.
  Entram quando houver cobrança.
- O registro de domínio na Cloudflare é ponto de falha externo no meio da aprovação: se falhar, a
  empresa fica provisionada e inacessível. O backoffice precisa de um botão para tentar de novo.

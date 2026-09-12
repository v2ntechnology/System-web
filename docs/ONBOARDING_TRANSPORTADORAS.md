# Onboarding de transportadoras

⚠️ **Este documento não vive aqui. A fonte única é o `Backend-web`:**

```
../Backend-web/docs/ONBOARDING_TRANSPORTADORAS.md
```

No GitHub: `v2ntechnology/Backend-web`, em `docs/ONBOARDING_TRANSPORTADORAS.md`.

## Por que virou ponteiro (12/09/2026)

Até aqui existiam duas cópias do mesmo plano, uma em cada repositório, e elas divergiram: a deste
lado ficou 208 linhas atrás, sem a Fase 1 já implementada nem as decisões de autenticação de
12/09/2026.

Divergência de cópia não é só incômodo de manutenção. A cópia velha continuou afirmando que no login
o `tenantSlug` deve ser comparado com o **`Host`**, e essa instrução está errada: o `Host` é sempre
`api.rookhub.com.br`, para todo cliente, porque o `deploy/Caddyfile` do `Backend-web` tem um site
block único. Quem seguisse a cópia implementaria uma checagem que **sempre passa**. O que identifica
o painel chamador é o cabeçalho `Origin`.

Ou seja, a duplicação passou a propagar um defeito de segurança, e foi o que motivou a decisão de ter
um lugar só.

## O plano fica no `Backend-web` porque

- O conteúdo é majoritariamente de backend: schemas por empresa, Flyway, provisionamento, escopo do
  JWT, migrations e infraestrutura.
- A implementação começou lá: a **Fase 1**, o schema `platform`, existe em código desde 12/09/2026.
- As decisões que o plano precisa registrar são medidas contra aquele repositório.

## O que continua sendo deste lado

As fases que geram tela, principalmente a **6b** (parametrização e marca do cliente) e a **9**
(editor de cargos e equipe), descrevem trabalho do `System-web`. O plano as descreve, mas quem as
implementa é este repositório, e as decisões de frontend continuam em `.claude/memoria.md` e em
`docs/referencias/ARQUITETURA_FRONTEND.md`.

## PDF

O PDF para circular com a equipe continua versionado aqui, em
`docs/pdf/RookHub-Plano-Onboarding-Transportadoras.pdf`, porque é onde ficam todos os outros PDFs do
projeto.

⚠️ Ele está defasado desde 11/09/2026 e não há gerador no repositório: quem for circular o plano
precisa regerar à mão, a partir do Markdown do `Backend-web`.

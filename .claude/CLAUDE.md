# Instruções para Claude — RookHub (pt-BR)

## Comportamento

- Responder sempre em pt-BR, direto e objetivo, resumo breve no fim.
- **Nunca usar travessão (`—`)** em texto de interface, README, documentação, comentário de
  código ou mensagem de commit (decisão do usuário em 15/08/2026). Quebrar a frase em duas, ou usar
  dois-pontos e parênteses, em vez de trocar o travessão por vírgula.
- Fazer só o que foi pedido — sem refatoração, limpeza ou melhoria não solicitada.
- `.claude/memoria.md` guarda o que o código não mostra. Na primeira tarefa de código ou infra da
  sessão, rodar Grep `^#{2,3} ` nele — lista as seções e as linhas, custa pouco. Ler a seção cujo
  título casar com a tarefa **e sempre `Gotchas`** (armadilhas que causam retrabalho); nunca o
  arquivo inteiro.

## Código

- Comentário só quando a lógica não for óbvia; editar arquivo existente; sem tratamento de erro
  para cenário impossível; não criar abstração sem uso real.
- Nomes de variáveis, funções, arquivos e pastas em **inglês**; textos de interface em **pt-BR**.
- TypeScript estrito: nunca `any` para silenciar erro (usar `unknown` + narrowing); `import type`
  é obrigatório porque `verbatimModuleSyntax` está ligado.
- Tela nova entra na pasta da **categoria do menu** a que pertence (`src/pages/<categoria>/`), e o
  mock correspondente na mesma categoria em `src/mocks/`. Não recriar `src/features/<dominio>/` nem
  subdividir `components/` em data-display/forms/feedback — foram achatados de propósito.
- Telas consomem `src/services` pelos hooks de dados, **nunca** os mocks diretamente. Array grande
  de mock nunca dentro de componente React.
- Tabela: usar o `DataTable` de `components/shared` — não recriar tabela por módulo.
- Cor literal nunca no componente: usar os tokens do `@theme` em `src/styles/globals.css`.
- ⚠️ `src/management/` é o **painel de gestão portado** do `System-mobile` (rota `/gestao`,
  proprietário e gestor) e segue as convenções **de origem**: organização por feature,
  exportação nomeada, primitivos próprios em `management/ui`, tokens de vidro escopados em
  `.management-theme`. Não aplicar ali as regras do painel operacional nem misturar os dois
  conjuntos de tokens — ver `Painel de gestão` na memória antes de editar.
- Antes de fechar um marco, rodar e deixar limpo:
  `npm run format:check && npm run typecheck && npm run lint && npm run test && npm run build`.

## Segredos

- `.env` na raiz (gitignored) é a única cópia de valores reais. Só variáveis `VITE_*` chegam ao
  bundle do navegador.
- `GEMINI_API_KEY` e `ELEVENLABS_API_KEY` são **server-side**: nunca com prefixo `VITE_`, nunca
  lidas por código do navegador. A chave da ElevenLabs vive só no processo Node do proxy do Vite.
- Nunca pôr o literal de um segredo em comando de shell (a harness grava comandos como permissão no
  `settings.local.json`); buscar pelo nome da variável.
- Não recriar `.env.example` nem documentar nomes de chaves no `README.md` — os dois foram removidos
  a pedido do usuário.
- Guardas de permissão e plano no frontend são **UX, não segurança**: a validação definitiva terá de
  existir no backend. Não persistir dado sensível em `localStorage`.

## Git / autoria

- Repo: `https://github.com/v2ntechnology/System-web.git`, branch `main`.
- Cada pessoa configura a **própria identidade**, e **apenas com `--local`** — nunca alterar o
  Git global da máquina: `git config --local user.name "Seu Nome"` e
  `git config --local user.email "seu.email@exemplo.com"`. Autor = committer: usar
  `git commit -m "<msg>"` sem `--author`, senão o GitHub mostra dois avatares.
- Commits pequenos, mensagem em pt-BR e **sem prefixo de Conventional Commits** (decisão do
  usuário em 15/08/2026): nada de `feat:`, `fix(escopo):` e afins. O assunto explica em uma frase o
  que a mudança faz, como `Adiciona mapa da operação`. O time tem 3 desenvolvedores e o histórico
  precisa ser legível por todos.
- Sem `Co-Authored-By`. Nunca `push --force`, `reset --hard` ou reescrita de histórico.
- ⚠️ **`.claude/` é versionado** desde 11/08/2026: `CLAUDE.md` e `memoria.md` valem para os 3
  desenvolvedores e entram no commit como qualquer documento. Só `settings.json` e
  `settings.local.json` ficam de fora — são as permissões desta máquina. Por isso, **nada de dado
  pessoal aqui dentro**: exemplo de configuração usa placeholder, nunca a conta de alguém.
- Antes de commitar: revisar `git diff` e confirmar que nenhum segredo entrou; e registrar em
  `.claude/memoria.md` a decisão, armadilha ou combinado que o commit não revela — é o momento de
  alimentar a memória.

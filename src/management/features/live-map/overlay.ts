/**
 * O desenho de tudo que flutua SOBRE um mapa da gestão.
 *
 * A receita nasceu no mapa ao vivo, a pedido do usuário em 30/08/2026: papel a
 * 80%, traço de divisória, canto pequeno e desfoque padrão. ⚠️ Ela saiu de
 * dentro da página para cá em 18/09/2026, quando o mapa da **visão geral**
 * passou a receber a mesma legenda: são dois mapas do mesmo produto, e a
 * informação que flutua sobre eles não pode ter dois desenhos. Copiar a string
 * era o caminho curto, e o custo dele já está documentado no `status-color.ts`,
 * que existe porque uma tabela de cores morava copiada em três arquivos.
 *
 * Os tokens têm nomes diferentes nos dois painéis e apontam para os mesmos
 * valores: `background`, `border` e `muted-foreground` do painel operacional são
 * aliases de `surface`, `outline-variant` e `on-surface-muted`, declarados em
 * `globals.css`. Aqui usa-se o nome da gestão, que é a convenção da pasta.
 *
 * ⚠️ O caminho até esta linha passou por duas versões recusadas, e as duas valem
 * como aviso. A primeira era uma placa quase preta: sobre o Liberty, que é um
 * mapa claro, ela não lê como vidro, lê como buraco. A segunda era branco puro
 * com desfoque muito forte, que ficava mais pesado que o mapa. O papel a 80% é o
 * que deixa o território aparecer sem disputar com ele.
 *
 * ⚠️ Quem garante a leitura é a camada de papel, e não o desfoque. O
 * `backdrop-blur` só dissolve a malha de ruas; ele não escurece nem clareia
 * nada, e um cartão com blur e fundo transparente fica ilegível sobre mapa
 * detalhado.
 */
export const SOBRE_O_MAPA =
  'border-outline-variant bg-surface/80 text-on-surface-muted pointer-events-auto rounded-md border backdrop-blur';

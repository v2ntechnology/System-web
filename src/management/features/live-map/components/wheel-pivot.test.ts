import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { comPivoNoEixo } from './fleet-3d-layer';

/**
 * O defeito que estes testes travam.
 *
 * O GLB do Quaternius traz as rodas como nós irmãos da carroceria, com a
 * geometria já posicionada e o PIVÔ NA ORIGEM do modelo. Girar a roda direto,
 * com `roda.rotation.x`, faz cada uma descrever uma órbita em volta do centro do
 * caminhão em vez de girar no próprio eixo. Parado quase não se nota; numa curva
 * fechada as rodas descolam e ficam boiando ao lado da carroceria, que foi
 * exatamente o que o usuário relatou em 06/09/2026.
 */

/** Uma roda como o GLB entrega: geometria deslocada, nó na origem. */
function rodaComPivoNaOrigem(deslocamento: Vector3) {
  const pai = new Group();
  const geometria = new BoxGeometry(1, 1, 1);
  /* O deslocamento está na GEOMETRIA, e não na posição do nó: é essa a forma
     que cria o problema. */
  geometria.translate(deslocamento.x, deslocamento.y, deslocamento.z);
  const roda = new Mesh(geometria, new MeshStandardMaterial());
  pai.add(roda);
  pai.updateMatrixWorld(true);
  return { pai, roda };
}

/** Onde está o centro da roda, em coordenadas de mundo. */
function centroNoMundo(roda: Mesh): Vector3 {
  roda.updateMatrixWorld(true);
  roda.geometry.computeBoundingBox();
  const centro = roda.geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
  return roda.localToWorld(centro);
}

describe('comPivoNoEixo', () => {
  it('não move a roda ao pendurá-la no pivô', () => {
    const { pai, roda } = rodaComPivoNaOrigem(new Vector3(2, 0, 0.5));
    const antes = centroNoMundo(roda);

    comPivoNoEixo(roda);
    pai.updateMatrixWorld(true);
    const depois = centroNoMundo(roda);

    expect(depois.x).toBeCloseTo(antes.x, 6);
    expect(depois.y).toBeCloseTo(antes.y, 6);
    expect(depois.z).toBeCloseTo(antes.z, 6);
  });

  it('gira a roda no próprio eixo, sem levá-la para outro lugar', () => {
    const { pai, roda } = rodaComPivoNaOrigem(new Vector3(2, 0, 0.5));
    const pivo = comPivoNoEixo(roda);
    pai.updateMatrixWorld(true);
    const antes = centroNoMundo(roda);

    /* Meia volta: o caso mais duro. Com o pivô errado, o centro atravessaria o
       caminhão inteiro e pararia do outro lado. */
    pivo.rotation.x = Math.PI;
    pai.updateMatrixWorld(true);
    const depois = centroNoMundo(roda);

    expect(depois.distanceTo(antes)).toBeLessThan(1e-6);
  });

  it('sem o pivô, a mesma rotação joga a roda longe: é o defeito antigo', () => {
    const { pai, roda } = rodaComPivoNaOrigem(new Vector3(2, 0, 0.5));
    const antes = centroNoMundo(roda);

    roda.rotation.x = Math.PI;
    pai.updateMatrixWorld(true);
    const depois = centroNoMundo(roda);

    /* A roda sai de z = 0,5 para z = -0,5: um comprimento inteiro de distância,
       que na tela é a roda solta ao lado da carroceria. */
    expect(depois.distanceTo(antes)).toBeGreaterThan(0.9);
  });

  it('devolve a própria roda quando ela não tem pai, sem quebrar', () => {
    const solta = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    expect(comPivoNoEixo(solta)).toBe(solta);
  });
});

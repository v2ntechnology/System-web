import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * O caminhão girando no alto do drawer, como num salão.
 *
 * <h2>Um modelo só, por enquanto</h2>
 *
 * Hoje todo veículo mostra `public/models/truck.glb`, que é o mesmo do mapa. A
 * frota da SERVIOESTE tem tipos diferentes (van, toco, truck, cavalo, bitrem) e
 * a intenção do usuário é que cada placa carregue o seu, quando os modelos
 * existirem. É por isso que a escolha do arquivo mora numa função só
 * (): quando os GLB por tipo chegarem, muda ali, e nada
 * mais nesta tela precisa saber.
 *
 * <h2>⚠️ O que já custou tempo neste modelo, e continua valendo</h2>
 *
 * A altura do GLB é +Y e a frente é +Z, medido carregando o arquivo e lendo as
 * caixas envolventes, e não deduzido. Aqui isso importa menos que na camada do
 * mapa (não há norte para acertar), mas o giro é em Y justamente porque é o eixo
 * vertical: girar em Z faria o caminhão capotar em vez de rodar.
 *
 * <h2>Custo</h2>
 *
 * O `three` já era dependência (globo, vórtice e esfera de voz usam), e o chunk
 * dele já é carregado por esta tela por causa da camada 3D do mapa. Este
 * componente não acrescenta dependência nenhuma: só mais uma cena pequena.
 */

/**
 * O arquivo do veículo. Um só hoje; por tipo quando os modelos existirem.
 *
 * Não é exportado de propósito: o arquivo só exporta o componente, que é o que
 * mantém o refresh rápido do Vite funcionando nele.
 */
function modeloDoVeiculo(): string {
  return '/models/truck.glb';
}

export function Vehicle3dPreview({ plate, className }: { plate: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(alvo.clientWidth, alvo.clientHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    alvo.appendChild(renderer.domElement);

    /*
     * Três luzes, e não uma.
     *
     * ⚠️ A camada do mapa descarta a textura do modelo para poder pintar a cor
     * do status, e por isso quem desenha o volume lá é a diferença de luz entre
     * as faces. Aqui a textura é MANTIDA (não há status para pintar), mas a
     * lição continua: com uma luz só, o caminhão vira uma silhueta chapada.
     */
    cena.add(new THREE.AmbientLight(0xffffff, 1.6));
    const principal = new THREE.DirectionalLight(0xffffff, 2.2);
    principal.position.set(4, 6, 4);
    cena.add(principal);
    const contra = new THREE.DirectionalLight(0xffffff, 0.9);
    contra.position.set(-5, 3, -4);
    cena.add(contra);

    const grupo = new THREE.Group();
    cena.add(grupo);

    let quadro = 0;
    let vivo = true;

    new GLTFLoader().load(
      modeloDoVeiculo(),
      (gltf) => {
        if (!vivo) return;

        const modelo = gltf.scene;

        /*
         * Centralizar e escalar pelo PRÓPRIO modelo, e não por números fixos.
         *
         * Quando os GLB por tipo chegarem, uma van e um bitrem terão tamanhos
         * bem diferentes: medir a caixa envolvente aqui faz os dois nascerem
         * enquadrados sem ninguém ajustar constante nenhuma.
         */
        const caixa = new THREE.Box3().setFromObject(modelo);
        const tamanho = caixa.getSize(new THREE.Vector3());
        const centro = caixa.getCenter(new THREE.Vector3());
        const maior = Math.max(tamanho.x, tamanho.y, tamanho.z) || 1;

        modelo.position.sub(centro);
        grupo.scale.setScalar(2.9 / maior);
        grupo.add(modelo);

        camera.position.set(0, 0.9, 3.6);
        camera.lookAt(0, 0, 0);
      },
      undefined,
      () => {
        /* Modelo que não carrega não pode derrubar o drawer: a ficha continua
           útil sem o desenho, e o espaço fica vazio em vez de quebrado. */
      },
    );

    function animar() {
      if (!vivo) return;
      /* Giro em Y, que é o eixo vertical do modelo.

         ⚠️ 0,0022 radiano por quadro, o que dá uma volta a cada 48 segundos.
         Estava quase três vezes mais rápido e o usuário pediu para desacelerar:
         é vitrine, e não animação de carregamento. Quem lê a ficha ao lado não
         pode ter um movimento puxando o olho o tempo todo. */
      grupo.rotation.y += 0.0022;
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    }
    animar();

    /* O drawer abre e fecha, e a largura muda junto: sem observar, a cena fica
       esticada até alguém redimensionar a janela. */
    const observador = new ResizeObserver(() => {
      const largura = alvo.clientWidth;
      const altura = alvo.clientHeight;
      if (largura === 0 || altura === 0) return;
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
      renderer.setSize(largura, altura, false);
    });
    observador.observe(alvo);

    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      /* Descartar geometria e material: sem isto, abrir e fechar o drawer vinte
         vezes deixa vinte cópias do caminhão na memória da GPU. */
      cena.traverse((no) => {
        if (no instanceof THREE.Mesh) {
          no.geometry.dispose();
          const materiais = Array.isArray(no.material) ? no.material : [no.material];
          materiais.forEach((material) => material.dispose());
        }
      });
    };
  }, []);

  return (
    <div
      ref={container}
      className={className}
      role="img"
      aria-label={`Modelo tridimensional do caminhão ${plate}, girando`}
    />
  );
}

/**
 * Preparo da foto do motorista antes de subir.
 *
 * <h2>Por que reduzir no navegador, e não no servidor</h2>
 *
 * A foto vai para o Postgres (decisão do usuário em 27/08/2026, enquanto não há
 * Object Storage). Uma foto de celular tem 3 a 8 MB, e cento e cinquenta delas
 * encheriam o banco de imagem que ninguém precisa nesse tamanho: a carteira
 * mostra um quadrado de 96 pixels.
 *
 * Reduzir aqui também poupa a subida. Quem cadastra costuma estar num
 * escritório de transportadora, e mandar 8 MB por uma conexão ruim é a
 * diferença entre o cadastro funcionar e o usuário achar que travou.
 *
 * <h2>O corte é quadrado, e centralizado no topo</h2>
 *
 * ⚠️ Centralizar no meio da imagem corta a testa em foto de retrato vertical,
 * que é o formato de quase toda foto de documento. O recorte começa mais acima
 * de propósito: em retrato, o rosto fica no terço superior.
 */

/** Lado do quadrado final. 320 dá nitidez em telas retina num avatar de 96. */
const SIDE = 320;

/** Teto do que o backend aceita. A redução abaixo entrega bem menos que isso. */
export const MAX_PHOTO_BYTES = 512 * 1024;

export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * Lê o arquivo, corta em quadrado, reduz e devolve um data URL em JPEG.
 *
 * Rejeita com uma frase pronta para a tela: quem escolheu um PDF por engano
 * precisa saber disso, e não ver o campo simplesmente não reagir.
 */
export async function prepareDriverPhoto(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
    throw new Error('Formato não suportado. Escolha uma imagem JPEG, PNG ou WebP.');
  }

  const bitmap = await loadBitmap(file);

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    /* Em retrato, o rosto fica no terço superior: começar no meio cortaria a
       testa. Em imagem já quadrada ou deitada isto vira zero. */
    const sy = Math.min((bitmap.height - side) / 2, (bitmap.height - side) * 0.25);

    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');

    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, SIDE, SIDE);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    if (estimateBytes(dataUrl) > MAX_PHOTO_BYTES) {
      throw new Error('A imagem ficou grande demais mesmo depois de reduzida.');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

/**
 * `createImageBitmap` direto do `File`.
 *
 * Sem `FileReader` e sem data URL intermediário: o arquivo cru pode ter 8 MB, e
 * convertê-lo para base64 antes de reduzir gastaria uns 11 MB de string à toa,
 * que é justamente o que esta função existe para evitar.
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível ler esta imagem. Tente outro arquivo.');
  }
}

/** Tamanho aproximado do binário por trás de um data URL base64. */
function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil((base64.length * 3) / 4);
}

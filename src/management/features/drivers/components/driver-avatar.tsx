import { useEffect, useState } from 'react';

import { fetchDriverPhoto } from '@/management/lib/fleet-api';
import { Avatar } from '@/management/ui';

/**
 * Avatar que busca a foto pela rota autenticada.
 *
 * ⚠️ Não dá para apontar o `src` direto para `/v1/drivers/{id}/photo`: a rota
 * exige `Authorization` e `<img>` não manda cabeçalho. A imagem é buscada com
 * `fetch` autenticado e vira um blob local, revogado ao desmontar.
 *
 * Só busca quem tem foto. A lista informa isso em `hasPhoto`, e sem essa dica
 * cada linha sem foto geraria um 404 por linha: com 149 motoristas, 149
 * requisições inúteis a cada abertura da tela.
 */
export function DriverAvatar({
  driverId,
  name,
  hasPhoto,
  className,
}: {
  driverId: string;
  name: string;
  hasPhoto: boolean;
  className?: string | undefined;
}) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!hasPhoto) return;

    let vivo = true;
    let criada: string | undefined;

    void fetchDriverPhoto(driverId)
      .then((objectUrl) => {
        /* Desmontou antes da resposta: revoga na hora, senão o blob fica
           pendurado na memória da aba sem ninguém para liberá-lo. */
        if (!vivo) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        criada = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => {
        /* Foto some ou falha: as iniciais do `Avatar` já são o estado normal
           de quem não tem foto, então não há erro a mostrar. */
      });

    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [driverId, hasPhoto]);

  return <Avatar src={url} name={name} className={className} />;
}

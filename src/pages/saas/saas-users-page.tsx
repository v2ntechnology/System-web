import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/states';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/shared/filters';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/format';
import { SAAS_USERS, type SaasUser } from '@/mocks/saas';

export default function SaasUsersPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return SAAS_USERS;
    return SAAS_USERS.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.tenant.toLowerCase().includes(term),
    );
  }, [search]);

  const columns: DataTableColumn<SaasUser>[] = [
    {
      id: 'name',
      header: 'Usuário',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px]">{getInitials(u.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    { id: 'tenant', header: 'Empresa', cell: (u) => u.tenant },
    { id: 'role', header: 'Perfil', cell: (u) => u.role },
    {
      id: 'status',
      header: 'Status',
      cell: (u) => (
        <Badge variant={u.active ? 'success' : 'muted'}>{u.active ? 'Ativo' : 'Inativo'}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Todos os usuários da plataforma, entre as empresas."
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome, e-mail ou empresa"
        className="w-full md:max-w-sm"
        aria-label="Buscar usuários"
      />
      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(u) => u.id}
        emptyState={<EmptyState title="Nenhum usuário encontrado" />}
      />
    </div>
  );
}

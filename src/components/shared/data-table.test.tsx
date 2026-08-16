import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  plate: string;
  unit: string;
}

const rows: Row[] = [
  { id: 'v1', plate: 'RKH-1A23', unit: 'Curitiba/PR' },
  { id: 'v2', plate: 'RKH-4B56', unit: 'Londrina/PR' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'plate', header: 'Placa', cell: (row) => row.plate, sortField: 'plate' },
  { id: 'unit', header: 'Unidade', cell: (row) => row.unit },
];

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable<Row> columns={columns} data={rows} getRowId={(row) => row.id} {...props} />,
  );
}

describe('DataTable', () => {
  it('renderiza cabeçalhos e uma linha por registro', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: /placa/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /unidade/i })).toBeInTheDocument();
    // 1 linha de cabeçalho + 2 de dados
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('RKH-1A23')).toBeInTheDocument();
  });

  it('alterna a direção da ordenação ao clicar na coluna ordenável', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    const { rerender } = renderTable({ onSortChange });
    await user.click(screen.getByRole('button', { name: /placa/i }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'plate', dir: 'asc' });

    rerender(
      <DataTable<Row>
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        sort={{ field: 'plate', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /placa/i }));
    expect(onSortChange).toHaveBeenLastCalledWith({ field: 'plate', dir: 'desc' });
  });

  it('não torna ordenável a coluna sem sortField', () => {
    renderTable({ onSortChange: vi.fn() });
    expect(screen.queryByRole('button', { name: /unidade/i })).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há dados', () => {
    renderTable({ data: [], emptyState: <p>Nenhum veículo encontrado.</p> });
    expect(screen.getByText('Nenhum veículo encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('mostra o estado de erro com ação de nova tentativa', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderTable({ isError: true, onRetry });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('dispara onRowClick ao clicar numa linha', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    renderTable({ onRowClick });
    await user.click(screen.getByText('RKH-4B56'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});

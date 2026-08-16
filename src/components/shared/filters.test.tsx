import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchInput } from './filters';

describe('SearchInput', () => {
  it('só propaga a busca depois do debounce', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SearchInput value="" onChange={onChange} debounceMs={50} />);
    await user.type(screen.getByRole('textbox', { name: /buscar/i }), 'RKH');

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('RKH'));
  });

  it('reflete a mudança do valor vindo de fora sem render em cascata', () => {
    const { rerender } = render(<SearchInput value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /buscar/i });
    expect(input).toHaveValue('');

    rerender(<SearchInput value="Londrina" onChange={vi.fn()} />);
    expect(input).toHaveValue('Londrina');
  });

  it('limpa a busca pelo botão e avisa o consumidor imediatamente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<SearchInput value="RKH" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /limpar busca/i }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('textbox', { name: /buscar/i })).toHaveValue('');
  });

  it('esconde o botão de limpar quando o campo está vazio', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /limpar busca/i })).not.toBeInTheDocument();
  });
});

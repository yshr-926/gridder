import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../CommandPalette';
import { CommandInput } from '../CommandInput';
import { CommandHistory } from '../CommandHistory';
import { CommandSuggestions } from '../CommandSuggestions';
import { createOutputLine } from '@/utils/outputLine';
import type { CommandDefinition } from '@/features/commands/types';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock useCommandExecutor hook
vi.mock('@/hooks/useCommandExecutor', () => ({
  useCommandExecutor: () => ({
    execute: vi.fn((input: string) => {
      if (input.toUpperCase() === 'HELP') {
        return {
          success: true,
          message: 'Available commands: LINE, RECT, FILL, UNDO, HELP',
        };
      }
      if (input.toUpperCase().startsWith('LINE')) {
        return {
          success: true,
          message: 'Line created',
        };
      }
      return {
        success: false,
        message: `Unknown command: ${input}`,
      };
    }),
    availableCommands: [
      { name: 'LINE', aliases: ['L'], description: '2点間に線を引く', syntax: 'LINE x1,y1 x2,y2', requiredArgs: 2, optionalArgs: 0, execute: vi.fn() },
      { name: 'RECT', aliases: ['R'], description: '矩形を作成', syntax: 'RECT x1,y1 x2,y2', requiredArgs: 2, optionalArgs: 1, execute: vi.fn() },
      { name: 'FILL', aliases: ['F'], description: '塗りつぶし', syntax: 'FILL x,y', requiredArgs: 1, optionalArgs: 0, execute: vi.fn() },
      { name: 'UNDO', aliases: ['U'], description: '取り消し', syntax: 'UNDO', requiredArgs: 0, optionalArgs: 0, execute: vi.fn() },
      { name: 'HELP', aliases: ['H', '?'], description: 'ヘルプ表示', syntax: 'HELP [command]', requiredArgs: 0, optionalArgs: 1, execute: vi.fn() },
    ] as CommandDefinition[],
    currentPrompt: null,
    getHistory: vi.fn(() => []),
    clearHistory: vi.fn(),
  }),
}));

describe('CommandPalette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CommandPalette {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows initial help message', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText(/HELP で使い方を確認できます/)).toBeInTheDocument();
  });

  it('calls onClose when ESC button is clicked', async () => {
    const onClose = vi.fn();
    render(<CommandPalette {...defaultProps} onClose={onClose} />);

    const escButton = screen.getByRole('button', { name: /閉じる/ });
    await userEvent.click(escButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<CommandPalette {...defaultProps} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('executes command on Enter', async () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'HELP');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/> HELP/)).toBeInTheDocument();
    });
  });

  it('shows error message for invalid command', async () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'INVALID_CMD');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Unknown command/)).toBeInTheDocument();
    });
  });

  it('clears input after executing command', async () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.type(input, 'HELP');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});

describe('CommandInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
  };

  it('renders with default prompt', () => {
    render(<CommandInput {...defaultProps} />);
    expect(screen.getByText('>')).toBeInTheDocument();
  });

  it('renders with custom prompt', () => {
    render(<CommandInput {...defaultProps} prompt="$" />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('renders placeholder text', () => {
    render(<CommandInput {...defaultProps} placeholder="Enter command..." />);
    expect(screen.getByPlaceholderText('Enter command...')).toBeInTheDocument();
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    render(<CommandInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'test');

    expect(onChange).toHaveBeenCalled();
  });

  it('calls onKeyDown when key is pressed', () => {
    const onKeyDown = vi.fn();
    render(<CommandInput {...defaultProps} onKeyDown={onKeyDown} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onKeyDown).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<CommandInput {...defaultProps} disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});

describe('CommandHistory', () => {
  it('shows initial message when output is empty', () => {
    render(<CommandHistory output={[]} />);
    expect(screen.getByText(/HELP で使い方を確認できます/)).toBeInTheDocument();
  });

  it('renders command lines with blue color class', () => {
    const output = [createOutputLine('> LINE 0,0 5,5', 'command')];
    render(<CommandHistory output={output} />);

    const line = screen.getByText('> LINE 0,0 5,5');
    expect(line).toHaveClass('text-blue-400');
  });

  it('renders success lines with green color class', () => {
    const output = [createOutputLine('Success!', 'success')];
    render(<CommandHistory output={output} />);

    const line = screen.getByText('Success!');
    expect(line).toHaveClass('text-green-400');
  });

  it('renders error lines with red color class', () => {
    const output = [createOutputLine('Error occurred', 'error')];
    render(<CommandHistory output={output} />);

    const line = screen.getByText('Error occurred');
    expect(line).toHaveClass('text-red-400');
  });

  it('renders info lines with gray color class', () => {
    const output = [createOutputLine('Info message', 'info')];
    render(<CommandHistory output={output} />);

    const line = screen.getByText('Info message');
    expect(line).toHaveClass('text-gray-300');
  });

  it('renders multiple lines', () => {
    const output = [
      createOutputLine('> HELP', 'command'),
      createOutputLine('Available commands...', 'success'),
      createOutputLine('LINE: Draw line', 'info'),
    ];
    render(<CommandHistory output={output} />);

    expect(screen.getByText('> HELP')).toBeInTheDocument();
    expect(screen.getByText('Available commands...')).toBeInTheDocument();
    expect(screen.getByText('LINE: Draw line')).toBeInTheDocument();
  });
});

describe('CommandSuggestions', () => {
  const mockCommands: CommandDefinition[] = [
    { name: 'LINE', aliases: ['L'], description: '2点間に線を引く', syntax: 'LINE x1,y1 x2,y2', requiredArgs: 2, optionalArgs: 0, execute: vi.fn() },
    { name: 'RECT', aliases: ['R'], description: '矩形を作成', syntax: 'RECT x1,y1 x2,y2', requiredArgs: 2, optionalArgs: 1, execute: vi.fn() },
  ];

  const defaultProps = {
    input: '',
    commands: mockCommands,
    onSelect: vi.fn(),
  };

  it('does not render when input is empty', () => {
    render(<CommandSuggestions {...defaultProps} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not render when no suggestions match', () => {
    render(<CommandSuggestions {...defaultProps} input="XYZ" />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders matching suggestions', () => {
    render(<CommandSuggestions {...defaultProps} input="LI" />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('LINE')).toBeInTheDocument();
  });

  it('filters suggestions by prefix match', () => {
    render(<CommandSuggestions {...defaultProps} input="L" />);
    expect(screen.getByText('LINE')).toBeInTheDocument();
    expect(screen.queryByText('RECT')).not.toBeInTheDocument();
  });

  it('matches aliases', () => {
    render(<CommandSuggestions {...defaultProps} input="R" />);
    expect(screen.getByText('RECT')).toBeInTheDocument();
  });

  it('calls onSelect when suggestion is clicked', async () => {
    const onSelect = vi.fn();
    render(<CommandSuggestions {...defaultProps} input="L" onSelect={onSelect} />);

    const suggestion = screen.getByText('LINE');
    await userEvent.click(suggestion);

    expect(onSelect).toHaveBeenCalledWith('LINE');
  });

  it('highlights selected suggestion', () => {
    render(<CommandSuggestions {...defaultProps} input="L" selectedIndex={0} />);

    const lineButton = screen.getByRole('option', { selected: true });
    expect(lineButton).toHaveClass('bg-gray-700');
  });

  it('shows command description', () => {
    render(<CommandSuggestions {...defaultProps} input="L" />);
    expect(screen.getByText('2点間に線を引く')).toBeInTheDocument();
  });

  it('shows command aliases', () => {
    render(<CommandSuggestions {...defaultProps} input="L" />);
    expect(screen.getByText('(L)')).toBeInTheDocument();
  });
});

describe('createOutputLine', () => {
  it('creates output line with default type', () => {
    const line = createOutputLine('test');
    expect(line.text).toBe('test');
    expect(line.type).toBe('info');
    expect(line.timestamp).toBeDefined();
  });

  it('creates output line with specified type', () => {
    const line = createOutputLine('error message', 'error');
    expect(line.text).toBe('error message');
    expect(line.type).toBe('error');
  });
});

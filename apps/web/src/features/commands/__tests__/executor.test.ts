import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandExecutor, createCommandExecutor } from '../executor';
import type { CommandDefinition, CommandContext, CommandArg } from '../types';
import { useCanvasStore } from '@/stores/canvasStore';
import { useGridSettingsStore } from '@/stores/gridSettingsStore';
import { useHistoryStore } from '@/stores/historyStore';

/**
 * テスト用のモックコンテキストを作成
 */
const createMockContext = (): CommandContext => ({
  canvasStore: useCanvasStore,
  gridSettingsStore: useGridSettingsStore,
  historyStore: useHistoryStore,
  cursorPosition: null,
  lastPoint: null,
  getNextObjectColor: () => '#ff0000',
});

/**
 * テスト用のコマンド定義
 */
const createTestCommand = (
  overrides: Partial<CommandDefinition> = {}
): CommandDefinition => ({
  name: 'TEST',
  description: 'Test command',
  syntax: 'TEST [arg]',
  requiredArgs: 0,
  optionalArgs: 1,
  execute: vi.fn(() => ({ success: true, message: 'Test success' })),
  ...overrides,
});

describe('CommandExecutor', () => {
  let executor: CommandExecutor;
  let context: CommandContext;

  beforeEach(() => {
    context = createMockContext();
    executor = new CommandExecutor(context);
  });

  describe('registerCommand', () => {
    it('should register a command', () => {
      const command = createTestCommand();
      executor.registerCommand(command);

      expect(executor.hasCommand('TEST')).toBe(true);
      expect(executor.getCommand('TEST')).toBe(command);
    });

    it('should register command aliases', () => {
      const command = createTestCommand({
        name: 'LINE',
        aliases: ['L', 'LN'],
      });
      executor.registerCommand(command);

      expect(executor.hasCommand('LINE')).toBe(true);
      expect(executor.hasCommand('L')).toBe(true);
      expect(executor.hasCommand('LN')).toBe(true);
      expect(executor.getCommand('L')).toBe(command);
    });

    it('should convert command name to uppercase', () => {
      const command = createTestCommand({ name: 'lowercase' });
      executor.registerCommand(command);

      expect(executor.hasCommand('LOWERCASE')).toBe(true);
    });

    it('should overwrite existing command with same name', () => {
      const command1 = createTestCommand({ description: 'First' });
      const command2 = createTestCommand({ description: 'Second' });

      executor.registerCommand(command1);
      executor.registerCommand(command2);

      expect(executor.getCommand('TEST')?.description).toBe('Second');
    });
  });

  describe('registerCommands', () => {
    it('should register multiple commands', () => {
      const commands = [
        createTestCommand({ name: 'CMD1' }),
        createTestCommand({ name: 'CMD2' }),
        createTestCommand({ name: 'CMD3' }),
      ];

      executor.registerCommands(commands);

      expect(executor.hasCommand('CMD1')).toBe(true);
      expect(executor.hasCommand('CMD2')).toBe(true);
      expect(executor.hasCommand('CMD3')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute a registered command', () => {
      const executeFn = vi.fn(() => ({ success: true }));
      const command = createTestCommand({ execute: executeFn });
      executor.registerCommand(command);

      const result = executor.execute('TEST');

      expect(result.success).toBe(true);
      expect(executeFn).toHaveBeenCalled();
    });

    it('should pass arguments to command execute', () => {
      const executeFn = vi.fn(
        (args: CommandArg[]) => ({ success: true, message: `Got ${args.length} args` })
      );
      const command = createTestCommand({
        requiredArgs: 2,
        optionalArgs: 0,
        execute: executeFn,
      });
      executor.registerCommand(command);

      executor.execute('TEST arg1 arg2');

      expect(executeFn).toHaveBeenCalledWith(
        ['arg1', 'arg2'],
        expect.any(Object)
      );
    });

    it('should return error for empty input', () => {
      const result = executor.execute('');

      expect(result.success).toBe(false);
      expect(result.message).toContain('無効');
    });

    it('should return error for unknown command', () => {
      const result = executor.execute('UNKNOWN');

      expect(result.success).toBe(false);
      expect(result.message).toContain('不明なコマンド');
      expect(result.message).toContain('UNKNOWN');
    });

    it('should return error when required args are missing', () => {
      const command = createTestCommand({
        requiredArgs: 2,
        optionalArgs: 0,
      });
      executor.registerCommand(command);

      const result = executor.execute('TEST arg1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('引数が不足');
    });

    it('should return error when too many args are provided', () => {
      const command = createTestCommand({
        requiredArgs: 1,
        optionalArgs: 0,
      });
      executor.registerCommand(command);

      const result = executor.execute('TEST arg1 arg2 arg3');

      expect(result.success).toBe(false);
      expect(result.message).toContain('引数が多すぎます');
    });

    it('should add successful commands to history', () => {
      const command = createTestCommand({
        execute: () => ({ success: true }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');
      executor.execute('TEST arg1');

      const history = executor.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].name).toBe('TEST');
    });

    it('should not add failed commands to history', () => {
      const command = createTestCommand({
        execute: () => ({ success: false, message: 'Failed' }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');

      expect(executor.getHistory()).toHaveLength(0);
    });

    it('should handle command execution errors', () => {
      const command = createTestCommand({
        execute: () => {
          throw new Error('Execution error');
        },
      });
      executor.registerCommand(command);

      const result = executor.execute('TEST');

      expect(result.success).toBe(false);
      expect(result.message).toContain('エラー');
      expect(result.message).toContain('Execution error');
    });

    it('should update context from result stateUpdate', () => {
      const command = createTestCommand({
        execute: () => ({
          success: true,
          stateUpdate: { lastPoint: { x: 10, y: 20 } },
        }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');

      expect(executor.getContext().lastPoint).toEqual({ x: 10, y: 20 });
    });

    it('should update currentPrompt from result', () => {
      const command = createTestCommand({
        execute: () => ({
          success: true,
          prompt: 'Enter next point:',
        }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');

      expect(executor.getCurrentPrompt()).toBe('Enter next point:');
    });

    it('should clear prompt when result has no prompt', () => {
      const command1 = createTestCommand({
        name: 'CMD1',
        execute: () => ({ success: true, prompt: 'Prompt' }),
      });
      const command2 = createTestCommand({
        name: 'CMD2',
        execute: () => ({ success: true }),
      });
      executor.registerCommand(command1);
      executor.registerCommand(command2);

      executor.execute('CMD1');
      expect(executor.getCurrentPrompt()).toBe('Prompt');

      executor.execute('CMD2');
      expect(executor.getCurrentPrompt()).toBeNull();
    });
  });

  describe('getAvailableCommands', () => {
    it('should return all unique commands', () => {
      executor.registerCommand(
        createTestCommand({ name: 'CMD1', aliases: ['C1'] })
      );
      executor.registerCommand(createTestCommand({ name: 'CMD2' }));

      const commands = executor.getAvailableCommands();

      expect(commands).toHaveLength(2);
      expect(commands.map((c) => c.name)).toContain('CMD1');
      expect(commands.map((c) => c.name)).toContain('CMD2');
    });

    it('should not include duplicates from aliases', () => {
      executor.registerCommand(
        createTestCommand({ name: 'LINE', aliases: ['L', 'LN'] })
      );

      const commands = executor.getAvailableCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('LINE');
    });
  });

  describe('hasCommand / getCommand', () => {
    it('should find command case-insensitively', () => {
      executor.registerCommand(createTestCommand({ name: 'LINE' }));

      expect(executor.hasCommand('LINE')).toBe(true);
      expect(executor.hasCommand('line')).toBe(true);
      expect(executor.hasCommand('Line')).toBe(true);
    });

    it('should return undefined for unknown command', () => {
      expect(executor.getCommand('UNKNOWN')).toBeUndefined();
    });
  });

  describe('history management', () => {
    it('should clear history', () => {
      const command = createTestCommand({
        execute: () => ({ success: true }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');
      expect(executor.getHistory()).toHaveLength(1);

      executor.clearHistory();
      expect(executor.getHistory()).toHaveLength(0);
    });
  });

  describe('context management', () => {
    it('should get current context', () => {
      expect(executor.getContext()).toBe(context);
    });

    it('should update context', () => {
      executor.updateContext({ lastPoint: { x: 5, y: 10 } });

      expect(executor.getContext().lastPoint).toEqual({ x: 5, y: 10 });
    });

    it('should set last point', () => {
      executor.setLastPoint({ x: 15, y: 25 });

      expect(executor.getContext().lastPoint).toEqual({ x: 15, y: 25 });
    });

    it('should set cursor position', () => {
      executor.setCursorPosition({ x: 20, y: 30 });

      expect(executor.getContext().cursorPosition).toEqual({ x: 20, y: 30 });
    });

    it('should clear last point', () => {
      executor.setLastPoint({ x: 15, y: 25 });
      executor.setLastPoint(null);

      expect(executor.getContext().lastPoint).toBeNull();
    });
  });

  describe('prompt management', () => {
    it('should clear prompt', () => {
      const command = createTestCommand({
        execute: () => ({ success: true, prompt: 'Test prompt' }),
      });
      executor.registerCommand(command);

      executor.execute('TEST');
      expect(executor.getCurrentPrompt()).toBe('Test prompt');

      executor.clearPrompt();
      expect(executor.getCurrentPrompt()).toBeNull();
    });
  });
});

describe('createCommandExecutor', () => {
  it('should create a new CommandExecutor instance', () => {
    const context = createMockContext();
    const executor = createCommandExecutor(context);

    expect(executor).toBeInstanceOf(CommandExecutor);
    expect(executor.getContext()).toBe(context);
  });
});

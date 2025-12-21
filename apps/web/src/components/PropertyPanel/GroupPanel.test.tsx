import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupPanel } from './GroupPanel';
import { useGroupStore } from '@/stores/groupStore';
import { useCanvasStore } from '@/stores/canvasStore';

// Mock stores
vi.mock('@/stores/groupStore', () => ({
  useGroupStore: vi.fn(),
}));

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: vi.fn(),
}));

vi.mock('@/features/selection/useMultiSelection', () => ({
  useMultiSelection: () => ({
    deleteSelectedObjects: vi.fn(),
    duplicateSelectedObjects: vi.fn(),
  }),
}));

describe('GroupPanel', () => {
  const mockCreateGroup = vi.fn();
  const mockDeleteGroup = vi.fn();
  const mockRenameGroup = vi.fn();
  const mockSelectGroup = vi.fn();
  const mockGetGroupByObjectId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useGroupStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          groups: [],
          createGroup: mockCreateGroup,
          deleteGroup: mockDeleteGroup,
          renameGroup: mockRenameGroup,
          selectGroup: mockSelectGroup,
        };
        return selector ? selector(state) : state;
      }
    );

    (useGroupStore as unknown as { getState: () => unknown }).getState = () => ({
      getGroupByObjectId: mockGetGroupByObjectId,
    });

    (useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          selection: {
            selectedIds: [],
            primaryId: null,
            mode: 'single',
          },
        };
        return selector ? selector(state) : state;
      }
    );
  });

  it('should render group operation buttons', () => {
    render(<GroupPanel />);

    expect(screen.getByText('グループ化')).toBeInTheDocument();
    expect(screen.getByText('グループ解除')).toBeInTheDocument();
  });

  it('should disable group button when less than 2 objects selected', () => {
    render(<GroupPanel />);

    const groupButton = screen.getByText('グループ化');
    expect(groupButton).toBeDisabled();
  });

  it('should enable group button when 2 or more objects selected', () => {
    (useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          selection: {
            selectedIds: ['obj-1', 'obj-2'],
            primaryId: 'obj-1',
            mode: 'multiple',
          },
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    const groupButton = screen.getByText('グループ化');
    expect(groupButton).not.toBeDisabled();
  });

  it('should call createGroup when group button clicked', () => {
    (useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          selection: {
            selectedIds: ['obj-1', 'obj-2'],
            primaryId: 'obj-1',
            mode: 'multiple',
          },
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    const groupButton = screen.getByText('グループ化');
    fireEvent.click(groupButton);

    expect(mockCreateGroup).toHaveBeenCalledWith(['obj-1', 'obj-2']);
  });

  it('should display group list when groups exist', () => {
    (useGroupStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          groups: [
            {
              id: 'group-1',
              objectIds: ['obj-1', 'obj-2'],
              anchorObjectId: 'obj-1',
              name: 'Test Group',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          createGroup: mockCreateGroup,
          deleteGroup: mockDeleteGroup,
          renameGroup: mockRenameGroup,
          selectGroup: mockSelectGroup,
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByText('グループ一覧')).toBeInTheDocument();
  });

  it('should display default group name when no name is set', () => {
    (useGroupStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          groups: [
            {
              id: 'group-1',
              objectIds: ['obj-1', 'obj-2'],
              anchorObjectId: 'obj-1',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          createGroup: mockCreateGroup,
          deleteGroup: mockDeleteGroup,
          renameGroup: mockRenameGroup,
          selectGroup: mockSelectGroup,
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    expect(screen.getByText('グループ (2)')).toBeInTheDocument();
  });

  it('should not display group list when no groups exist', () => {
    render(<GroupPanel />);

    expect(screen.queryByText('グループ一覧')).not.toBeInTheDocument();
  });

  it('should call selectGroup when group item is clicked', () => {
    (useGroupStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          groups: [
            {
              id: 'group-1',
              objectIds: ['obj-1', 'obj-2'],
              anchorObjectId: 'obj-1',
              name: 'Test Group',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          createGroup: mockCreateGroup,
          deleteGroup: mockDeleteGroup,
          renameGroup: mockRenameGroup,
          selectGroup: mockSelectGroup,
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    const groupItem = screen.getByText('Test Group');
    fireEvent.click(groupItem);

    expect(mockSelectGroup).toHaveBeenCalledWith('group-1');
  });

  it('should call deleteGroup when delete button is clicked', () => {
    (useGroupStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          groups: [
            {
              id: 'group-1',
              objectIds: ['obj-1', 'obj-2'],
              anchorObjectId: 'obj-1',
              name: 'Test Group',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          createGroup: mockCreateGroup,
          deleteGroup: mockDeleteGroup,
          renameGroup: mockRenameGroup,
          selectGroup: mockSelectGroup,
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    const deleteButton = screen.getByLabelText('グループを削除');
    fireEvent.click(deleteButton);

    expect(mockDeleteGroup).toHaveBeenCalledWith('group-1');
  });

  it('should show multiple selection actions when more than one object is selected', () => {
    (useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          selection: {
            selectedIds: ['obj-1', 'obj-2'],
            primaryId: 'obj-1',
            mode: 'multiple',
          },
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    expect(screen.getByText('選択操作')).toBeInTheDocument();
    expect(screen.getByText('複製')).toBeInTheDocument();
    expect(screen.getByText('削除')).toBeInTheDocument();
  });

  it('should not show multiple selection actions when single object is selected', () => {
    (useCanvasStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector?: (state: unknown) => unknown) => {
        const state = {
          selection: {
            selectedIds: ['obj-1'],
            primaryId: 'obj-1',
            mode: 'single',
          },
        };
        return selector ? selector(state) : state;
      }
    );

    render(<GroupPanel />);

    expect(screen.queryByText('選択操作')).not.toBeInTheDocument();
  });
});

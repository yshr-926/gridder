import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GridObject } from '../../types';
import { useCanvasStore } from '../../stores';
import { PropertyPanel } from './PropertyPanel';

const selectedObject: GridObject = {
  id: 'shape-1',
  cells: [
    [0, 0],
    [1, 0],
  ],
  position: { x: 0, y: 0 },
  rotation: 0,
  color: '#2563eb',
};

describe('PropertyPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      objects: [],
      selectedObjectId: null,
      selection: { selectedIds: [], primaryId: null, mode: 'single' },
    });
  });

  it('does not render without a selected shape', () => {
    render(<PropertyPanel />);

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('renders the contextual inspector for a selected shape', () => {
    useCanvasStore.setState({
      objects: [selectedObject],
      selectedObjectId: selectedObject.id,
      selection: {
        selectedIds: [selectedObject.id],
        primaryId: selectedObject.id,
        mode: 'single',
      },
    });

    render(<PropertyPanel />);

    expect(screen.getByRole('complementary', { name: '図形インスペクター' })).toBeInTheDocument();
    expect(screen.getByText('選択中の図形')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

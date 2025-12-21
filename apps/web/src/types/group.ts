import type { Position } from './index';

/**
 * オブジェクトグループ
 * 複数のオブジェクトをまとめて管理するための構造
 */
export interface ObjectGroup {
  /** グループID */
  id: string;
  /** グループに含まれるオブジェクトID */
  objectIds: string[];
  /** グループの基準位置（最初のオブジェクトを基準） */
  anchorObjectId: string;
  /** グループ名（任意） */
  name?: string;
  /** グループ作成日時 */
  createdAt: string;
}

/**
 * オブジェクト間の相対位置情報
 * アンカーオブジェクトからの相対位置を保持
 */
export interface RelativePosition {
  /** 対象オブジェクトID */
  objectId: string;
  /** アンカーからの相対位置 */
  offset: Position;
}

/**
 * 選択状態
 * 単一選択・複数選択・グループ選択に対応
 */
export interface SelectionState {
  /** 選択中のオブジェクトID（複数可） */
  selectedIds: string[];
  /** プライマリ選択（操作の基準となるオブジェクト） */
  primaryId: string | null;
  /** 選択モード */
  mode: 'single' | 'multiple' | 'group';
}

/**
 * グループ操作結果
 * グループ化・解除などの操作の結果を表す
 */
export interface GroupOperationResult {
  /** 操作が成功したかどうか */
  success: boolean;
  /** 操作対象のグループID（成功時） */
  groupId?: string;
  /** エラーメッセージ（失敗時） */
  error?: string;
}

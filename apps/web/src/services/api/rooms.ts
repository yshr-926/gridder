/**
 * ルーム管理 API
 *
 * ルームの作成、情報取得、パスフレーズ管理を行う REST API クライアント。
 */

import { apiClient } from './client';
import type {
  RoomInfoResponse,
  HasPassphraseResponse,
  SetPassphraseRequest,
  SetPassphraseResponse,
} from '@gridder/shared-types';

/**
 * ルーム作成リクエスト
 */
export interface CreateRoomRequest {
  /** ルーム ID（指定しない場合は自動生成） */
  id?: string;
  /** ルーム名（オプション） */
  name?: string;
  /** パスフレーズ（オプション） */
  passphrase?: string;
}

/**
 * パスフレーズ検証リクエスト
 */
export interface VerifyPassphraseRequest {
  /** 検証するパスフレーズ */
  passphrase: string;
}

/**
 * パスフレーズ検証レスポンス
 */
export interface VerifyPassphraseResponse {
  /** 検証結果 */
  valid: boolean;
}

/**
 * ルーム管理 API
 */
export const roomsApi = {
  /**
   * ルーム情報を取得
   *
   * @param roomId - ルーム ID
   * @returns ルーム情報
   * @throws ApiError (ROOM_NOT_FOUND)
   */
  async getRoomInfo(roomId: string): Promise<RoomInfoResponse> {
    return apiClient.get<RoomInfoResponse>(`/api/rooms/${encodeURIComponent(roomId)}`);
  },

  /**
   * ルームのパスフレーズ有無を確認
   *
   * @param roomId - ルーム ID
   * @returns パスフレーズ有無
   */
  async hasPassphrase(roomId: string): Promise<HasPassphraseResponse> {
    return apiClient.get<HasPassphraseResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/has-passphrase`
    );
  },

  /**
   * パスフレーズを設定または解除
   *
   * @param roomId - ルーム ID
   * @param request - パスフレーズ設定リクエスト
   * @returns 設定結果
   * @throws ApiError (INVALID_PASSPHRASE, PASSPHRASE_REQUIRED)
   */
  async setPassphrase(
    roomId: string,
    request: SetPassphraseRequest
  ): Promise<SetPassphraseResponse> {
    return apiClient.post<SetPassphraseResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/passphrase`,
      request
    );
  },

  /**
   * パスフレーズを検証
   *
   * @param roomId - ルーム ID
   * @param passphrase - 検証するパスフレーズ
   * @returns 検証結果
   */
  async verifyPassphrase(
    roomId: string,
    passphrase: string
  ): Promise<VerifyPassphraseResponse> {
    return apiClient.post<VerifyPassphraseResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/passphrase/verify`,
      { passphrase } as VerifyPassphraseRequest
    );
  },

  /**
   * ルームが存在するかチェック
   *
   * @param roomId - ルーム ID
   * @returns 存在する場合は true
   */
  async exists(roomId: string): Promise<boolean> {
    try {
      await this.getRoomInfo(roomId);
      return true;
    } catch (error) {
      // ROOM_NOT_FOUND の場合は false を返す
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'ROOM_NOT_FOUND'
      ) {
        return false;
      }
      throw error;
    }
  },
};

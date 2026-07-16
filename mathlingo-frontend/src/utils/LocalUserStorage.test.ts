import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocalUserData,
  getLocalUserData,
  getDisplayUserData,
  saveLocalUserData,
  updateLocalUserData,
} from './LocalUserStorage';

describe('LocalUserStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores only display data in session storage', () => {
    saveLocalUserData({
      id: 1,
      username: 'student',
      email: 'student@example.com',
      avatarId: 3,
    });

    expect(getDisplayUserData()).toEqual({ username: 'student', avatarId: 3 });
    expect(localStorage.getItem('mathlingo_user_data')).toBeNull();
    expect(sessionStorage.getItem('user_display_data')).not.toContain('student@example.com');
  });

  it('returns null when stored user data is malformed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('mathlingo_user_data', '{invalid json');

    expect(getLocalUserData()).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it('updates and clears local profile data atomically', () => {
    localStorage.setItem(
      'mathlingo_user_data',
      JSON.stringify({ id: 1, username: 'student', email: 'student@example.com' }),
    );

    expect(updateLocalUserData({ username: 'updated', avatarId: 4 })).toEqual({
      id: 1,
      username: 'updated',
      email: 'student@example.com',
      avatarId: 4,
    });

    expect(clearLocalUserData()).toBe(true);
    expect(getLocalUserData()).toBeNull();
    expect(localStorage.getItem('mathlingo_update_lock')).toBeNull();
  });
});

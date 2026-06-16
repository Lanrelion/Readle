// src/services/profileService.js
import { supabase } from './supabase';

/**
 * Get current user's profile
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Profile] Failed to get profile:', error);
    return null;
  }

  return data;
}

/**
 * Update last seen timestamp (call on each app load)
 */
export async function updateLastSeen(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[Profile] Failed to update last seen:', error);
  }
}

/**
 * Update book/quote counts in profile
 */
export async function updateProfileStats(userId, totalBooks, totalQuotes) {
  const { error } = await supabase
    .from('profiles')
    .update({
      total_books: totalBooks,
      total_quotes: totalQuotes,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[Profile] Failed to update stats:', error);
  }
}

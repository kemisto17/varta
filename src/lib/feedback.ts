import type { TablesInsert } from '../types/database';
import { supabase } from './supabase';

export const MAX_FEEDBACK_CHARACTERS = 2000;
export const MIN_FEEDBACK_CHARACTERS = 10;

export type FeedbackCategory = 'bug' | 'idea' | 'other';

export const FEEDBACK_CATEGORIES: readonly {
  label: string;
  value: FeedbackCategory;
}[] = [
  { label: 'Bug', value: 'bug' },
  { label: 'Idea', value: 'idea' },
  { label: 'Other', value: 'other' },
];

export async function submitFeedback({
  category,
  message,
  userId,
}: {
  category: FeedbackCategory;
  message: string;
  userId: string;
}) {
  const normalizedMessage = message.trim();

  if (normalizedMessage.length < MIN_FEEDBACK_CHARACTERS) {
    throw new Error(
      `Share at least ${MIN_FEEDBACK_CHARACTERS} characters so we can understand the feedback.`
    );
  }

  if (normalizedMessage.length > MAX_FEEDBACK_CHARACTERS) {
    throw new Error(
      `Feedback can be up to ${MAX_FEEDBACK_CHARACTERS.toLocaleString()} characters.`
    );
  }

  const feedback: TablesInsert<'feedback'> = {
    category,
    message: normalizedMessage,
    user_id: userId,
  };
  const { error } = await supabase.from('feedback').insert(feedback);

  if (error) {
    throw error;
  }
}

export function getFeedbackErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.startsWith('Share at least') ||
      error.message.startsWith('Feedback can be'))
  ) {
    return error.message;
  }

  return 'We could not send your feedback. Check your connection and try again.';
}

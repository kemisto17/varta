import { useEffect, useRef, useState } from 'react';

import type { ModerationUser } from '../../lib/moderation';
import {
  blockUser,
  getModerationErrorMessage,
  unblockUser,
} from '../../lib/moderation';
import { ActionSheet } from './ActionSheet';

type BlockUserSheetProps = {
  currentUserId: string | null;
  mode?: 'block' | 'unblock';
  onChanged: () => void;
  onClose: () => void;
  user: ModerationUser | null;
};

export function BlockUserSheet({
  currentUserId,
  mode = 'block',
  onChanged,
  onClose,
  user,
}: BlockUserSheetProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const changePendingRef = useRef(false);

  useEffect(() => {
    if (user) {
      setErrorMessage(null);
      setIsPending(false);
      changePendingRef.current = false;
    }
  }, [mode, user]);

  const isBlocking = mode === 'block';

  const handleChange = async () => {
    if (!currentUserId || !user || changePendingRef.current) {
      return;
    }

    changePendingRef.current = true;
    setIsPending(true);
    setErrorMessage(null);

    try {
      if (isBlocking) {
        await blockUser(currentUserId, user.id);
      } else {
        await unblockUser(currentUserId, user.id);
      }

      onClose();
      onChanged();
    } catch (error) {
      changePendingRef.current = false;
      setErrorMessage(getModerationErrorMessage(error));
      setIsPending(false);
    }
  };

  return (
    <ActionSheet
      actions={[
        {
          closeOnPress: false,
          disabled: isPending,
          label: isPending
            ? isBlocking
              ? 'Blocking…'
              : 'Unblocking…'
            : isBlocking
              ? 'Block student'
              : 'Unblock student',
          onPress: () => void handleChange(),
          tone: isBlocking ? 'danger' : 'default',
        },
      ]}
      message={
        errorMessage ??
        (isBlocking
          ? `You will no longer see ${user?.fullName ?? 'this student'}'s posts or comments. They are not notified.`
          : `You will be able to see ${user?.fullName ?? 'this student'}'s campus posts and comments again.`)
      }
      onClose={isPending ? () => undefined : onClose}
      title={isBlocking ? 'Block this student?' : 'Unblock this student?'}
      visible={user !== null}
    />
  );
}

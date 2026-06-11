export type HeaderMenuActionKey = "logout";

type RunHeaderMenuActionOptions = {
  actionKey: HeaderMenuActionKey;
  pendingAction: HeaderMenuActionKey | null;
  setPendingAction: (value: HeaderMenuActionKey | null) => void;
  action: () => void | Promise<void>;
};

export async function runHeaderMenuAction({
  actionKey,
  pendingAction,
  setPendingAction,
  action,
}: RunHeaderMenuActionOptions) {
  if (pendingAction !== null) return;

  setPendingAction(actionKey);
  try {
    await action();
  } finally {
    setPendingAction(null);
  }
}

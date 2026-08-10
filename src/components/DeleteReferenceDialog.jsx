import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onClose,
  onConfirm
}) {
  const [saving, setSaving] = useState(false);

  function handleOpenChange(nextOpen) {
    if (!nextOpen && !saving) onClose?.();
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'destructive' : 'default'}
            onClick={() => void handleConfirm()}
            disabled={saving}
          >
            {saving ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteReferenceDialog({
  open,
  title,
  itemName,
  usageCount = 0,
  usageLoading = false,
  replacementLabel = 'Replacement',
  replacementOptions = [],
  extraFields = null,
  requireReplacement = false,
  confirmLabel = 'Delete',
  canConfirm,
  onClose,
  onConfirm
}) {
  const selectId = useId();
  const [replacementId, setReplacementId] = useState('');
  const [extraValues, setExtraValues] = useState({});
  const [saving, setSaving] = useState(false);

  const needsReplacement = !usageLoading && (usageCount > 0 || requireReplacement);
  const extrasValid = typeof canConfirm === 'function'
    ? canConfirm({ replacementId, usageCount, ...extraValues })
    : true;

  useEffect(() => {
    if (!open) return;
    setReplacementId('');
    setExtraValues({});
  }, [open, itemName]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen && !saving) onClose?.();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (usageLoading) return;
    if (needsReplacement && !replacementId) return;
    setSaving(true);
    try {
      await onConfirm?.({
        replacementId,
        ...extraValues
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>
                {usageLoading ? (
                  <p>Checking whether this item is used in transactions…</p>
                ) : usageCount > 0 ? (
                  <p>
                    <strong>{itemName}</strong> is used by <strong>{usageCount}</strong>
                    {' '}transaction{usageCount === 1 ? '' : 's'}. Choose a replacement before deleting.
                  </p>
                ) : (
                  <p>
                    Delete <strong>{itemName}</strong>? This cannot be undone.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {!usageLoading && needsReplacement ? (
            <div className="grid gap-1.5">
              <Label htmlFor={selectId}>{replacementLabel}</Label>
              <NativeSelect
                id={selectId}
                required
                value={replacementId}
                disabled={saving || !replacementOptions.length}
                onChange={(event) => {
                  setReplacementId(event.target.value);
                  setExtraValues({});
                }}
              >
                <option value="">
                  {replacementOptions.length ? `Select ${replacementLabel.toLowerCase()}` : 'No replacements available'}
                </option>
                {replacementOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label || option.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          {!usageLoading && typeof extraFields === 'function'
            ? extraFields({
              replacementId,
              values: extraValues,
              setValues: setExtraValues,
              saving
            })
            : null}

          {!usageLoading && extraFields && typeof extraFields !== 'function' ? extraFields : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                saving
                || usageLoading
                || !extrasValid
                || (needsReplacement && (!replacementId || !replacementOptions.length))
              }
            >
              {saving ? 'Deleting…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteReferenceDialog;

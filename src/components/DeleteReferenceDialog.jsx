import { useEffect, useId, useRef, useState } from 'react';

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
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (saving) return;
    onClose?.();
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
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onClose={handleClose}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <div className="form-stack">
        <div className="dialog-title">
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
            Close
          </button>
        </div>
        <p className="dialog-copy">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger' : undefined}
            onClick={() => void handleConfirm()}
            disabled={saving}
          >
            {saving ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
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
  const dialogRef = useRef(null);
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (saving) return;
    onClose?.();
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
    <dialog
      ref={dialogRef}
      className="delete-reference-dialog"
      onClose={handleClose}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="dialog-title">
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
            Close
          </button>
        </div>

        {usageLoading ? (
          <p className="dialog-copy">Checking whether this item is used in transactions…</p>
        ) : (
          <p className="dialog-copy">
            {usageCount > 0
              ? (
                <>
                  <strong>{itemName}</strong> is used by <strong>{usageCount}</strong>
                  {' '}transaction{usageCount === 1 ? '' : 's'}. Choose a replacement before deleting.
                </>
              )
              : (
                <>
                  Delete <strong>{itemName}</strong>? This cannot be undone.
                </>
              )}
          </p>
        )}

        {!usageLoading && needsReplacement ? (
          <label htmlFor={selectId}>
            {replacementLabel}
            <select
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
            </select>
          </label>
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

        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="danger"
            disabled={
              saving
              || usageLoading
              || !extrasValid
              || (needsReplacement && (!replacementId || !replacementOptions.length))
            }
          >
            {saving ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default DeleteReferenceDialog;

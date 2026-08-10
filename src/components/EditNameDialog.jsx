import { useEffect, useId, useRef, useState } from 'react';

export function EditNameDialog({
  open,
  title,
  label = 'Name',
  initialValue = '',
  placeholder = '',
  submitLabel = 'Save changes',
  onClose,
  onSubmit
}) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue || '');
  }, [open, initialValue]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
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
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setSaving(true);
    try {
      await onSubmit?.(nextValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="edit-name-dialog"
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
        <label htmlFor={inputId}>
          {label}
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={value}
            placeholder={placeholder}
            required
            disabled={saving}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !String(value || '').trim()}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default EditNameDialog;

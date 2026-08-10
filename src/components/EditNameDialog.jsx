import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const inputRef = useRef(null);
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue || '');
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen && !saving) onClose?.();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{label}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={inputId}>{label}</Label>
            <Input
              id={inputId}
              ref={inputRef}
              type="text"
              value={value}
              placeholder={placeholder}
              required
              disabled={saving}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !String(value || '').trim()}>
              {saving ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditNameDialog;

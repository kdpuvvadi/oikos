import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSignInMethods, unlinkOAuth } from '@/lib/api';
import {
  clearAuthEvent,
  dismissGoogleLinkPrompt,
  readAuthEvent,
  wasGoogleLinkPromptDismissed
} from '@/lib/googleLinkPrompt';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { GoogleMark } from '@/components/GoogleMark';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

function googleMethod(methods) {
  return (methods?.oauth || []).find((provider) => provider.name === 'google') || null;
}

export function LinkGoogleDialog() {
  const { user, linkOAuth } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('offer');

  useEffect(() => {
    if (!user?.id) {
      setOpen(false);
      return undefined;
    }
    if (wasGoogleLinkPromptDismissed(user.id)) {
      clearAuthEvent();
      setOpen(false);
      return undefined;
    }

    const event = readAuthEvent();
    if (!event || (event.userId && event.userId !== user.id)) {
      setOpen(false);
      return undefined;
    }

    let cancelled = false;
    void getSignInMethods().then((methods) => {
      if (cancelled) return;
      const google = googleMethod(methods);
      if (!google) {
        clearAuthEvent();
        setOpen(false);
        return;
      }

      const googleLogin = event.method === 'google';
      if (googleLogin) {
        clearAuthEvent();
        setOpen(false);
        return;
      }
      if (!google.linked) {
        setMode('offer');
        setOpen(true);
        return;
      }
      clearAuthEvent();
      setOpen(false);
    }).catch(() => {
      if (!cancelled) setOpen(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function finish(linked) {
    dismissGoogleLinkPrompt(user?.id);
    setOpen(false);
    if (linked) toast('Google account linked.');
  }

  function handleSkip() {
    if (busy) return;
    if (mode !== 'confirm') {
      finish(false);
      return;
    }
    setBusy(true);
    unlinkOAuth('google')
      .then(() => {
        finish(false);
        toast('Google was not linked. You can still use email and password.');
      })
      .catch((error) => {
        toast(error.message);
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function handleLink() {
    if (busy) return;
    if (mode === 'confirm') {
      finish(true);
      return;
    }
    setBusy(true);
    linkOAuth('google')
      .then(() => {
        finish(true);
      })
      .catch((error) => {
        toast(error.message);
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen && !busy) handleSkip();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy} id="linkGoogleDialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GoogleMark />
            {mode === 'confirm' ? 'Link Google to this account?' : 'Link Google for easier sign-in?'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'confirm'
              ? 'You signed in with Google, and this email already has an Oikos account. Link Google so you can use it next time. You can also keep using email and password.'
              : 'Google is not linked yet. Link it now to sign in without typing your password. You can also do this later under Me.'}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          By linking Google you agree to the{' '}
          <Link to="/terms" className="underline-offset-4 hover:underline">Terms of Service</Link>
          {' and '}
          <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={handleSkip}>
            {busy && mode === 'confirm' ? 'Working…' : 'Not now'}
          </Button>
          <Button type="button" disabled={busy} onClick={handleLink}>
            {busy && mode === 'offer' ? 'Linking…' : 'Link Google'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

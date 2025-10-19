import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import logo from '../assets/fitspace-logo-gradient-nobkg.svg';
import googleLogo from '../assets/google-logo.svg';

import styles from './ExitGuestUser.module.scss';
import {
  DEFAULT_POST_LOGIN_ROUTE,
  POST_LOGIN_REDIRECT_KEY,
  GUEST_AVATAR_NAME_KEY,
  GUEST_POST_LOGIN_REDIRECT,
} from '../config/authRedirect';
import { logoutToHostedUi, triggerHostedLogoutSilently } from '../utils/authHelpers';

export default function ExitGuestUser() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [avatarName, setAvatarName] = useState('');
  const [hasPendingAvatarData, setHasPendingAvatarData] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(GUEST_AVATAR_NAME_KEY);
      if (saved) setAvatarName(saved);
    } catch (_err) {
      // namjerno ignorirano (npr. Safari private mode)
      void _err;
    }

    try {
      const pendingData = localStorage.getItem('pendingAvatarData');
      const pendingId = localStorage.getItem('pendingAvatarId');
      setHasPendingAvatarData(Boolean(pendingData || pendingId));
    } catch (_err) {
      // ako ne možemo pristupiti localStorage-u samo pretpostavi da nema pending podataka
      void _err;
      setHasPendingAvatarData(false);
    }
  }, []);

  const trimmedAvatarName = avatarName.trim();

  const handleSignIn = useCallback(() => {
    // spremi upisano ime da ga kasnije pročitaš nakon povratka iz OIDC-a
    try {
      sessionStorage.setItem(GUEST_AVATAR_NAME_KEY, trimmedAvatarName);
    } catch (_err) {
      // namjerno ignorirano (npr. Safari private mode)
      void _err;
    }

    if (trimmedAvatarName) {
      try {
        const pendingRaw = localStorage.getItem('pendingAvatarData');
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as {
            type?: string;
            data?: { avatarName?: string };
          } | null;
          if (pending?.type === 'createAvatar' && pending.data && typeof pending.data === 'object') {
            const updated = {
              ...pending,
              data: { ...pending.data, avatarName: trimmedAvatarName },
            };
            localStorage.setItem('pendingAvatarData', JSON.stringify(updated));
            setHasPendingAvatarData(true);
          }
        }
      } catch (err) {
        console.warn('Failed to persist guest avatar name to pending data', err);
      }
    }
  
    const state = location.state as { from?: Location } | undefined;
    const redirectTarget = state?.from
      ? `${state.from.pathname ?? ''}${state.from.search ?? ''}${state.from.hash ?? ''}`
      : hasPendingAvatarData
        ? GUEST_POST_LOGIN_REDIRECT
        : DEFAULT_POST_LOGIN_ROUTE;

    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectTarget);

    if (auth.signinRedirect) {
      auth.signinRedirect({ state: redirectTarget }).catch(e => console.error('signinRedirect failed', e));
    } else {
      console.warn('signinRedirect not available', auth);
    }
  }, [auth, trimmedAvatarName, location, hasPendingAvatarData]);

  const handleBack = useCallback(() => {
    // povratak na prethodni ekran
    navigate(-1);
  }, [navigate]);

  const handleExit = useCallback(() => {
    // poruka + izlaz (po potrebi promijeni odredište)
    alert('Avatar saved. See you soon!\nExiting to PandoMoto...');

    const redirectToStart = () => {
      window.location.replace('/');
    };

    const cleanupLocalSession = () => {
      auth.removeUser().catch(err => {
        console.error('Guest exit failed to clear local OIDC session', err);
      });
    };

    cleanupLocalSession();

    if (triggerHostedLogoutSilently()) {
      redirectToStart();
      return;
    }

    try {
      const result = logoutToHostedUi(auth);
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          console.error('Guest exit signout failed, fallback redirect', err);
          redirectToStart();
        });
      }
    } catch (err) {
      console.error('Guest exit signout threw, fallback redirect', err);
      redirectToStart();
    }
  }, [auth]);

  // Jednostavna detekcija "web" rasporeda (isti prag kao na loginu možeš promijeniti)
  const mode: 'mobile' | 'web' = useMemo(() => (window.matchMedia('(min-width: 1024px)').matches ? 'web' : 'mobile'), []);

  return (
    <div className={styles.page}>
        {/* MOBILE CANVAS – skalira se proporcionalno (do 800px širine) */}
        <div className={styles.mobileShell}>
            <div className={styles.mobileCanvas} aria-hidden={mode !== 'mobile'}>
                <div className={styles.mInner}>
                    <img src={logo} alt="Fitspace" className={styles.mLogo} />

                    <div className={styles.mContent}>
                        <p className={styles.mTitle}>Would you like to save your avatar for future use?</p>

                        <label className={styles.mInputWrap}>
                            <input
                                className={styles.mInput}
                                type="text"
                                placeholder="Avatar’s Name"
                                value={avatarName}
                                onChange={(e) => setAvatarName(e.target.value)}
                            />
                        </label>

                        <button type="button" className={styles.mGoogleBtn} onClick={handleSignIn}>
                            <img src={googleLogo} alt="Google" className={styles.mGoogleIcon} />
                            <span className={styles.mGoogleLabel}>Save with Google</span>
                        </button>

                        <div className={styles.mFooterRow}>
                            <button type="button" className={styles.mBackBtn} onClick={handleBack}>
                                Back
                            </button>
                            <button type="button" className={styles.mExitBtn} onClick={handleExit}>
                                Exit to PandoMoto
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* WEB LAYOUT – skalirani stage 1440×1024 */}
        <div className={styles.webShell} aria-hidden={mode !== 'web'}>
            <div className={styles.webStage}>
                <img src={logo} alt="Fitspace" className={styles.wLogo} />
                {/* Centralni stack od 291px na dolje */}
                <div className={styles.wStack}>
                    <p className={styles.wTitle}>Would you like to save your avatar for future use?</p>

                    <label className={styles.wInputWrap}>
                            <input
                                className={styles.wInput}
                                type="text"
                                placeholder="Avatar’s Name"
                                value={avatarName}
                                onChange={(e) => setAvatarName(e.target.value)}
                            />
                    </label>

                    <button type="button" className={styles.wGoogleBtn} onClick={handleSignIn}>
                        <img src={googleLogo} alt="Google" className={styles.wGoogleIcon} />
                        <span className={styles.wGoogleLabel}>Save with Google</span>
                    </button>
                    {/* 290px ispod Google gumba */}
                    <div className={styles.wFooterRow}>
                        <button type="button" className={styles.wBackBtn} onClick={handleBack}>
                        Back
                        </button>
                        <button type="button" className={styles.wExitBtn} onClick={handleExit}>
                        Exit to PandoMoto
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}

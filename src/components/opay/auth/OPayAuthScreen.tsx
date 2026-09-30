import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Smartphone, 
  Mail, 
  User, 
  CreditCard, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles,
  KeyRound,
  Shield,
  ChevronLeft,
  X,
  HelpCircle,
  Delete,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  Keyboard
} from 'lucide-react';
import { OPayNumericKeypad } from '../../common/OPayNumericKeypad';
import { useDemoWallet } from '../../../context/DemoWalletContext';
import { VerificationAuditLog, VerificationStatus, RegisteredUserAccount } from '../../../types';
import { normalizePhone, isSamePhone } from '../../../utils/phone';

interface OPayAuthScreenProps {
  onLogin: (credentials: { identifier: string; pinOrPass: string }) => Promise<{ 
    success: boolean; 
    error?: string; 
    verificationStatus?: VerificationStatus;
    accountData?: any;
  }>;
  onRegister?: (data: {
    fullName: string;
    phone: string;
    email?: string;
    nin?: string;
    password: string; // Login password
    pin: string; // 4-digit transaction PIN
    verificationLog?: VerificationAuditLog;
  }) => Promise<{ success: boolean; error?: string }>;
  existingAccountsCount: number;
  onQuickDemoLogin?: () => void;
  onClose?: () => void;
  initialMode?: 'login' | 'register' | 'welcome_back' | 'forgot_password';
}

export const OPayAuthScreen: React.FC<OPayAuthScreenProps> = ({
  onLogin,
  onRegister,
  existingAccountsCount,
  onQuickDemoLogin,
  onClose,
  initialMode = 'login',
}) => {
  const { 
    rememberedAccount, 
    isManuallyLoggedOut, 
    registeredAccounts,
    setRememberedAccount,
    clearRememberedAccount,
    updateAccountPasswordInClient,
    refreshAccountsFromServer
  } = useDemoWallet();

  // Determine starting mode: Screen 2 ("Log in to your account") is standard entry matching OPay 4-step flow
  const determineStartMode = (): 'welcome_back' | 'full_login' | 'forgot_password' => {
    if (initialMode === 'forgot_password') return 'forgot_password';
    if (initialMode === 'welcome_back' && rememberedAccount && !isManuallyLoggedOut) return 'welcome_back';
    if (rememberedAccount && !isManuallyLoggedOut) return 'welcome_back';
    return 'full_login';
  };

  const [activeMode, setActiveMode] = useState<'welcome_back' | 'full_login' | 'forgot_password'>(determineStartMode);

  // Welcome back state (Screens 3 & 4)
  const [welcomePassword, setWelcomePassword] = useState('');
  const [showWelcomePassword, setShowWelcomePassword] = useState(false);
  const [isKeypadVisible, setIsKeypadVisible] = useState(false);

  // Full login state (Screen 2: IMG_2779.png)
  const [loginStep, setLoginStep] = useState<1 | 2>(1); // 1: Identifier, 2: Password
  const [loginIdentifier, setLoginIdentifier] = useState(rememberedAccount?.phone || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [welcomeKeypadMode, setWelcomeKeypadMode] = useState<'keypad' | 'native'>('keypad');
  const [loginInputType, setLoginInputType] = useState<'phone' | 'email'>('phone');

  // Physical keyboard support for Welcome Back screen (Screens 3 & 4)
  useEffect(() => {
    if (activeMode !== 'welcome_back') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setIsKeypadVisible(true);
        setLoginError(null);
        setWelcomePassword((prev) => {
          if (prev.length < 6) return prev + e.key;
          return prev;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setLoginError(null);
        setWelcomePassword((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (welcomePassword.length === 6) {
          handleWelcomeSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, welcomePassword]);

  // Forgot Password flow state (Step 1: Phone -> Step 2: New Password -> Step 3: Success)
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1); // 1: Phone, 2: New Password, 3: Success
  const [forgotPhone, setForgotPhone] = useState(rememberedAccount?.phone || '');
  const [forgotAccountName, setForgotAccountName] = useState('');
  const [forgotMaskedPhone, setForgotMaskedPhone] = useState('');
  const [forgotAccountId, setForgotAccountId] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Help modal state
  const [showHelpToast, setShowHelpToast] = useState(false);

  // Dynamic matched account based on user login input or remembered profile
  const matchedLoginAccount = useMemo(() => {
    const clean = loginIdentifier.trim().replace(/\D/g, '');
    if (clean) {
      const found = registeredAccounts.find(acc => {
        const pDigits = acc.phone.replace(/\D/g, '');
        const accDigits = (acc.accountNumber || '').replace(/\D/g, '');
        return (
          pDigits === clean ||
          (clean.length === 10 && pDigits.endsWith(clean)) ||
          (clean.length === 11 && clean.endsWith(pDigits)) ||
          accDigits === clean ||
          ((acc.id === 'acc-musaraf-default' || acc.role === 'owner') &&
           (clean.endsWith('7075817357') || clean.endsWith('8104443906')))
        );
      });
      if (found) return found;
    }
    if (loginIdentifier.trim().includes('@')) {
      const cleanEmail = loginIdentifier.trim().toLowerCase();
      const found = registeredAccounts.find(acc => 
        acc.email.toLowerCase() === cleanEmail ||
        ((acc.id === 'acc-musaraf-default' || acc.role === 'owner') &&
         (cleanEmail === 'moriobee44@gmail.com' || cleanEmail === 'musaraf.olawale@gmail.com'))
      );
      if (found) return found;
    }
    return null;
  }, [loginIdentifier, registeredAccounts]);

  const activeDisplayAccount = matchedLoginAccount || rememberedAccount;

  // Format Nigerian phone numbers with space (e.g. 0707 581 7357)
  const formatDisplayPhone = (rawPhone: string) => {
    if (!rawPhone) return '';
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `0${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return rawPhone;
  };

  const handleKeypadPress = (val: string) => {
    setLoginError(null);
    if (val === '⌫') {
      setWelcomePassword(prev => prev.slice(0, -1));
    } else if (val === 'C') {
      setWelcomePassword('');
    } else if (welcomePassword.length < 6) {
      setWelcomePassword(prev => prev + val);
    }
  };

  // Open Forgot Password Flow
  const handleOpenForgotPassword = (prefillPhone?: string) => {
    setForgotError(null);
    setForgotSuccessMsg(null);
    setForgotStep(1);
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    if (prefillPhone) {
      setForgotPhone(prefillPhone);
    } else if (rememberedAccount?.phone) {
      setForgotPhone(rememberedAccount.phone);
    } else if (loginIdentifier) {
      setForgotPhone(loginIdentifier);
    }
    setActiveMode('forgot_password');
  };

  // Step 1: Verify phone number belongs to an existing account
  const handleForgotVerifyPhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotError(null);
    setForgotSuccessMsg(null);

    const cleanInput = forgotPhone.trim();
    if (!cleanInput) {
      setForgotError('Please enter the phone number registered with your account.');
      return;
    }

    const norm = normalizePhone(cleanInput);
    const cleanDigits = cleanInput.replace(/\D/g, '');

    if (!norm.isValid && cleanDigits.length < 10) {
      setForgotError('Please enter a valid 10-digit (e.g. 7075817357) or 11-digit (e.g. 07075817357) mobile number.');
      return;
    }

    const targetLocal11 = norm.national11 || cleanDigits;
    const target10 = norm.subscriber10 || cleanDigits.slice(-10);
    const targetE164 = norm.e164 || `+234${target10}`;

    setIsForgotLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: targetLocal11,
          rawPhone: cleanInput,
          strippedPhone: target10,
          internationalPhone: targetE164,
        }),
      });

      const serverData = await response.json().catch(() => null);

      if (response.ok && serverData && serverData.success && serverData.exists) {
        setForgotPhone(serverData.phone || targetLocal11);
        setForgotMaskedPhone(serverData.maskedPhone || `${targetLocal11.slice(0, 3)} •••• ${targetLocal11.slice(-4)}`);
        setForgotAccountName(serverData.fullName || '');
        setForgotAccountId(serverData.accountId || '');
        setForgotError(null);
        setForgotStep(2);
        return;
      }

      setForgotError(
        serverData?.message || 'No account found matching this phone number. Please check the number and try again.'
      );
    } catch (err: unknown) {
      console.error('Verify phone error:', err);
      setForgotError('Network error checking phone number. Please check your connection and try again.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Step 2: Create & confirm new password directly on authoritative server database
  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const cleanNewPass = forgotNewPassword.trim();
    const cleanConfirmPass = forgotConfirmPassword.trim();

    if (!cleanNewPass || cleanNewPass.length < 6) {
      setForgotError('Password must be at least 6 characters or digits long.');
      return;
    }

    if (cleanNewPass !== cleanConfirmPass) {
      setForgotError('The new password and confirmation do not match.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone.trim(),
          accountId: forgotAccountId,
          newPassword: cleanNewPass,
          confirmPassword: cleanConfirmPass,
        }),
      });

      const serverData = await response.json().catch(() => null);

      if (!response.ok || !serverData || !serverData.success) {
        setForgotError(
          serverData?.message || 'Failed to permanently update password on server. Please try again.'
        );
        return;
      }

      // Authoritative permanent account updated successfully on server!
      const targetAccId = serverData.accountId || forgotAccountId;
      const targetPhone = serverData.phone || forgotPhone.trim();

      // Invalidate any stale session or token in browser
      try {
        localStorage.removeItem('opay_session_token');
        localStorage.removeItem('opay_active_account');
      } catch {}

      // Synchronize in client context & remember this account
      if (targetAccId) {
        setRememberedAccount(targetAccId);
        updateAccountPasswordInClient(targetAccId, cleanNewPass);
      }
      try {
        await refreshAccountsFromServer();
      } catch {}

      if (targetPhone) setLoginIdentifier(targetPhone);
      setLoginPassword(cleanNewPass);
      setWelcomePassword(cleanNewPass);
      setForgotError(null);

      // ONLY advance to Step 3 after the server confirmed the update!
      setForgotStep(3);
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      setForgotError(
        err instanceof Error ? err.message : 'Network error updating password. Please check your connection and try again.'
      );
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleDirectLoginAfterReset = async () => {
    setIsForgotLoading(true);
    setForgotError(null);
    try {
      const targetPhone = loginIdentifier.trim() || forgotPhone.trim() || (rememberedAccount?.phone ?? '');
      const targetPass = loginPassword.trim() || forgotNewPassword.trim() || welcomePassword.trim();

      if (!targetPhone) {
        setForgotError('Please enter your registered phone number to sign in.');
        return;
      }

      if (!targetPass) {
        setForgotError('Please enter your new password to sign in.');
        return;
      }

      const result = await onLogin({
        identifier: targetPhone,
        pinOrPass: targetPass,
      });

      if (result.success) {
        onClose?.();
        return;
      }

      setForgotError(result.error || 'Failed to sign in with new password. Please try again.');
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsForgotLoading(false);
    }
  };


  const handleWelcomeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError(null);

    const cleanPass = welcomePassword.trim();
    if (!cleanPass) {
      setLoginError('Please enter your 6-digit login password.');
      return;
    }

    const targetAccount = matchedLoginAccount || rememberedAccount;
    const identifier = loginIdentifier.trim() || targetAccount?.phone || targetAccount?.accountNumber || '';
    if (!identifier) {
      setLoginError('Please enter your Mobile No. or Email first.');
      setActiveMode('full_login');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await onLogin({
        identifier,
        pinOrPass: cleanPass,
      });

      if (result.success && result.requiresPermanentPasswordReset) {
        setForgotPhone(result.accountData?.phone || identifier);
        setForgotAccountName(result.accountData?.fullName || '');
        setForgotAccountId(result.accountData?.id || '');
        setForgotStep(2);
        setActiveMode('forgot_password');
        return;
      }

      if (result.success) {
        onClose?.();
        return;
      }

      if (!result.success) {
        setLoginError(result.error || 'Incorrect login password. Please check your credentials and try again.');
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFullLoginNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanId = loginIdentifier.trim();
    if (!cleanId) {
      setLoginError('Please enter your Mobile No. or Email.');
      return;
    }

    setIsLoggingIn(true);
    try {
      // 2. NORMAL LOGIN MUST BE LOGIN ONLY
      // Check if the phone number exists in permanent database before allowing progression
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.exists) {
        setLoginError('Account not found. Please contact the owner to register your account.');
        return;
      }

      if (data.accountId) {
        setRememberedAccount(data.accountId);
      }
      setLoginIdentifier(data.phone || cleanId);
      setWelcomePassword('');
      // Advance to password entry on "Welcome back!" screen with keypad ready
      setActiveMode('welcome_back');
      setIsKeypadVisible(true);
    } catch (err: unknown) {
      const found = registeredAccounts.find(a => isSamePhone(a.phone, cleanId) || a.accountNumber === cleanId || a.email.toLowerCase() === cleanId.toLowerCase());
      if (!found) {
        setLoginError('Account not found. Please contact the owner to register your account.');
        return;
      }
      if (found.id) setRememberedAccount(found.id);
      setWelcomePassword('');
      setActiveMode('welcome_back');
      setIsKeypadVisible(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleFullLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanId = loginIdentifier.trim();
    if (!cleanId) {
      setLoginError('Please enter your registered phone number or email.');
      setLoginStep(1);
      return;
    }

    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await onLogin({
        identifier: cleanId,
        pinOrPass: loginPassword,
      });

      if (result.success && result.requiresPermanentPasswordReset) {
        setForgotPhone(result.accountData?.phone || cleanId);
        setForgotAccountName(result.accountData?.fullName || '');
        setForgotAccountId(result.accountData?.id || '');
        setForgotStep(2);
        setActiveMode('forgot_password');
        return;
      }

      if (result.success) {
        onClose?.();
        return;
      }

      if (!result.success) {
        const errMsg = result.error || 'Incorrect login password. Please check your credentials and try again.';
        if (errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('no account')) {
          setLoginError('Account not found. Please contact the owner to register your account.');
        } else {
          setLoginError(errMsg);
        }
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      id="opay-auth-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111317] p-3 sm:p-4 overflow-y-auto select-none"
    >
      {/* Toast Notification */}
      {showHelpToast && (
        <div className="fixed top-6 z-60 rounded-full bg-slate-800/95 px-4 py-2 text-xs font-semibold text-white shadow-xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-top-2">
          <HelpCircle className="h-4 w-4 text-[#00D589]" />
          <span>24/7 Helpline: 0700 8888 328 | support@opaydigital.com</span>
        </div>
      )}

      <div className="relative flex flex-col w-full max-w-md my-auto rounded-3xl bg-[#16181E] border border-slate-800/90 text-white shadow-2xl overflow-hidden min-h-[580px]">
        
        {/* Top Header: Back button on left, Help link on right matching IMG_2487 & IMG_2489 */}
        <header className="shrink-0 flex items-center justify-between px-5 py-4 bg-[#16181E] border-b border-slate-800/40 z-10">
          <button
            type="button"
            onClick={() => {
              if (activeMode === 'forgot_password') {
                if (forgotStep === 2) {
                  setForgotStep(1);
                  setForgotError(null);
                } else if (forgotStep === 3) {
                  setForgotStep(2);
                  setForgotError(null);
                } else {
                  if (rememberedAccount && !isManuallyLoggedOut) {
                    setActiveMode('welcome_back');
                  } else {
                    setActiveMode('full_login');
                  }
                  setForgotError(null);
                }
              } else if (activeMode === 'welcome_back') {
                if (isKeypadVisible) {
                  setIsKeypadVisible(false);
                } else {
                  setActiveMode('full_login');
                  setLoginStep(1);
                }
              } else if (activeMode === 'full_login') {
                if (onClose) {
                  onClose();
                }
              } else if (activeMode === 'register') {
                setActiveMode('full_login');
              } else if (onClose) {
                onClose();
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-slate-800 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={() => setShowHelpToast(!showHelpToast)}
            className="text-sm font-semibold text-[#00D589] hover:underline flex items-center gap-1 cursor-pointer"
          >
            Help
          </button>
        </header>

        {/* Dynamic View Content */}
        <div className="flex-1 px-6 py-5 flex flex-col justify-between overflow-y-auto">
          
          {/* ========================================================= */}
          {/* VIEW 1: "WELCOME BACK!" SCREEN (Screens 3 & 4)            */}
          {/* ========================================================= */}
          {activeMode === 'welcome_back' && (
            <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-200">
              <div className="space-y-4">
                {/* 1. User Avatar & Display Phone (IMG_2780.png) */}
                <div className="flex flex-col items-center text-center space-y-2 pt-2">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full border-2 border-[#00D589]/60 p-0.5 bg-[#0D261C] shadow-[0_0_20px_rgba(0,213,137,0.25)] overflow-hidden flex items-center justify-center">
                      {activeDisplayAccount?.userProfile?.avatarUrl ? (
                        <img 
                          src={activeDisplayAccount.userProfile.avatarUrl} 
                          alt={activeDisplayAccount.fullName}
                          className="h-full w-full object-cover rounded-full"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[#00D589]/15 text-[#00D589]">
                          <User className="h-10 w-10 text-[#00D589]" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Formatted Phone Number */}
                  <div className="text-sm font-semibold text-slate-300 tracking-wider font-mono">
                    {formatDisplayPhone(activeDisplayAccount?.phone || loginIdentifier) || 'OPay Account'}
                  </div>
                </div>

                {/* 2. Headline: Welcome back! */}
                <div className="space-y-1 text-center pt-0.5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Welcome back!
                  </h1>
                </div>

                <div className="text-left pt-1">
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">
                    Enter your 6-digit Password to log in
                  </p>
                </div>

                {/* Error Banner */}
                {loginError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-300 border border-red-900/60 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* 3. Password Input Box (Read-only to prevent mobile OS keyboard, clicks open OPay Secure Keypad) */}
                <form onSubmit={handleWelcomeSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <div 
                      id="welcome-password-box"
                      onClick={() => setIsKeypadVisible(true)}
                      className={`relative flex items-center rounded-2xl bg-[#1A1D24] p-1 cursor-pointer transition-all ${
                        isKeypadVisible 
                          ? 'border-2 border-[#00D589] shadow-[0_0_15px_rgba(0,213,137,0.3)] ring-1 ring-[#00D589]/40' 
                          : 'border border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <input
                        id="welcome-password-input"
                        type={showWelcomePassword ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={welcomePassword}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setWelcomePassword(val);
                          setLoginError(null);
                        }}
                        onFocus={() => setIsKeypadVisible(true)}
                        placeholder="Enter 6-digit Password"
                        className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono tracking-widest cursor-text"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowWelcomePassword(!showWelcomePassword);
                        }}
                        className="pr-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showWelcomePassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {/* Forgot Password link on right */}
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          clearRememberedAccount();
                          setLoginIdentifier('');
                          setWelcomePassword('');
                          setLoginPassword('');
                          setLoginError(null);
                          setLoginStep(1);
                          setActiveMode('full_login');
                          setIsKeypadVisible(false);
                        }}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Switch Account
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenForgotPassword(loginIdentifier || rememberedAccount?.phone)}
                        className="font-medium text-[#00D589] hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  {/* 4. Log in Button (Dark green disabled when < 6 digits, bright green when 6 digits) */}
                  <button
                    id="welcome-login-btn"
                    type="submit"
                    disabled={isLoggingIn || welcomePassword.length < 6}
                    className={`w-full rounded-full py-4 text-sm font-black transition-all flex items-center justify-center gap-2 mt-3 ${
                      welcomePassword.length === 6
                        ? 'bg-[#00D589] text-[#072418] hover:bg-[#00E599] active:scale-[0.99] shadow-lg shadow-emerald-950/40 cursor-pointer'
                        : 'bg-[#0D4831] text-[#008254] cursor-not-allowed opacity-90'
                    }`}
                  >
                    {isLoggingIn ? (
                      <span>Logging in...</span>
                    ) : (
                      <span>Log in</span>
                    )}
                  </button>
                </form>

                {/* 5. Embedded OPay Secure Numeric Keypad (Screen 4 / IMG_2781.png) */}
                {isKeypadVisible && (
                  <div className="pt-2 animate-in slide-in-from-bottom-3 duration-200">
                    <OPayNumericKeypad
                      title="OPay Secure Numeric Keypad"
                      onKeyPress={(key) => handleKeypadPress(key)}
                      onDelete={() => {
                        setLoginError(null);
                        setWelcomePassword(prev => prev.slice(0, -1));
                      }}
                      onClear={() => {
                        setLoginError(null);
                        setWelcomePassword('');
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Regulatory Footer */}
              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Shield className="h-4 w-4 text-[#00D589]" />
                <span>Protected by OPay End-to-End Encryption</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: FULL LOGIN SCREEN matching IMG_2487.png           */}
          {/* ========================================================= */}
          {activeMode === 'full_login' && (
            <div className="flex-1 flex flex-col justify-between space-y-6 animate-in fade-in duration-200">
              <div className="space-y-6">
                
                {/* 1. OPay Emblem Logo */}
                <div className="flex flex-col items-start pt-1 space-y-3">
                  <div className="inline-flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-[#0D261C] border border-[#00D589]/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,213,137,0.2)]">
                      <svg className="h-6 w-6" viewBox="0 0 100 100" fill="none">
                        <circle cx="50" cy="50" r="34" stroke="#00D589" strokeWidth="16" />
                        <rect x="12" y="44.5" width="24" height="11" rx="2" fill="#FFFFFF" />
                      </svg>
                    </div>
                    <span className="text-xl font-black tracking-tight text-white font-mono">OPay</span>
                  </div>

                  {/* Headline: Log in to your account */}
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Log in to your account
                  </h1>
                </div>

                {/* Error Message */}
                {loginError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-300 border border-red-900/60 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Step 1: Phone / Email Entry */}
                {loginStep === 1 && (
                  <form onSubmit={handleFullLoginNext} className="space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between pb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Enter your Mobile No./Email
                        </label>
                        <div className="flex items-center gap-1 bg-[#14161C] p-0.5 rounded-lg border border-slate-800 text-[10.5px]">
                          <button
                            type="button"
                            onClick={() => setLoginInputType('phone')}
                            className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                              loginInputType === 'phone' ? 'bg-[#00D589] text-[#072418]' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Phone (123)
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoginInputType('email')}
                            className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                              loginInputType === 'email' ? 'bg-[#00D589] text-[#072418]' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Email (ABC)
                          </button>
                        </div>
                      </div>

                      <div className="relative flex items-center rounded-2xl bg-[#1A1D24] border border-slate-700/80 focus-within:border-[#00D589] transition-colors">
                        <input
                          type={loginInputType === 'phone' ? 'tel' : 'email'}
                          inputMode={loginInputType === 'phone' ? 'tel' : 'email'}
                          pattern={loginInputType === 'phone' ? '[0-9]*' : undefined}
                          autoFocus
                          value={loginIdentifier}
                          onChange={(e) => {
                            setLoginIdentifier(e.target.value);
                            setLoginError(null);
                          }}
                          placeholder={loginInputType === 'phone' ? 'e.g. 08012345678' : 'name@email.com'}
                          className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-medium font-mono"
                        />
                      </div>

                      {/* Sub-text under input matching IMG_2487 */}
                      <div className="pt-1 text-xs text-slate-400">
                        <span>Lost Your Mobile Number, </span>
                        <button
                          type="button"
                          onClick={() => setShowHelpToast(true)}
                          className="font-medium text-[#00D589] hover:underline cursor-pointer"
                        >
                          Change Now
                        </button>
                      </div>
                    </div>

                    {/* Green Pill Button: NEXT */}
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full rounded-full bg-[#00D589] py-4 text-sm font-black text-[#072418] hover:bg-[#00E599] active:scale-[0.99] transition-all shadow-lg shadow-emerald-950/40 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isLoggingIn ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>CHECKING ACCOUNT...</span>
                        </div>
                      ) : (
                        <span>NEXT</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Step 2: Password Entry after NEXT */}
                {loginStep === 2 && (
                  <form onSubmit={handleFullLoginSubmit} className="space-y-4">
                    <div className="rounded-xl bg-[#121419] p-3 border border-slate-800 text-xs">
                      <span className="text-slate-400 block">Account Identifier</span>
                      <span className="font-mono text-white font-bold">{loginIdentifier}</span>
                      <button
                        type="button"
                        onClick={() => setLoginStep(1)}
                        className="text-[11px] text-[#00D589] font-semibold ml-2 hover:underline"
                      >
                        Change
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Enter your Login Password
                      </label>
                      <div className="relative flex items-center rounded-2xl bg-[#1A1D24] border border-slate-700/80 focus-within:border-[#00D589] transition-colors">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          enterKeyHint="done"
                          autoFocus
                          value={loginPassword}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setLoginPassword(clean);
                            setLoginError(null);
                          }}
                          placeholder="Enter 6-digit password"
                          className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="pr-4 text-slate-400 hover:text-white"
                        >
                          {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      
                      {/* Forgot Password link */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenForgotPassword(loginIdentifier)}
                          className="text-xs font-medium text-[#00D589] hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full rounded-full bg-[#00D589] py-4 text-sm font-black text-[#072418] hover:bg-[#00E599] active:scale-[0.99] transition-all shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      {isLoggingIn ? <span>Signing In...</span> : <span>Log In</span>}
                    </button>
                  </form>
                )}
              </div>

              {/* Regulatory Footer matching IMG_2487 */}
              <div className="pt-6 border-t border-slate-800/60 text-center text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-center gap-1.5 font-medium text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-[#00D589]" />
                  <span>Licensed by the CBN and insured by the NDIC</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 3: FORGOT PASSWORD FLOW                              */}
          {/* ========================================================= */}
          {activeMode === 'forgot_password' && (
            <div className="flex-1 flex flex-col justify-between space-y-4 animate-in fade-in duration-200">
              <div className="space-y-4">
                
                {/* Header title */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-[#0D261C] border border-[#00D589]/40 flex items-center justify-center text-[#00D589]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-[#00D589] uppercase tracking-wider">Password Recovery</span>
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {forgotStep === 1 && 'Find Your Account'}
                    {forgotStep === 2 && 'Create New Password'}
                    {forgotStep === 3 && 'Password Changed'}
                  </h1>
                  <p className="text-xs text-slate-300 font-medium">
                    {forgotStep === 1 && 'Enter the registered mobile number associated with your OPay account.'}
                    {forgotStep === 2 && `Enter and confirm your new 6-digit password for ${forgotAccountName ? forgotAccountName : 'your account'}.`}
                    {forgotStep === 3 && 'Your account password has been updated. You can now log in with your new password.'}
                  </p>
                </div>

                {/* Error Banner */}
                {forgotError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-950/60 p-3 text-xs text-red-300 border border-red-900/60 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{forgotError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {forgotSuccessMsg && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-950/60 p-3 text-xs text-emerald-300 border border-emerald-900/60 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00D589]" />
                    <span>{forgotSuccessMsg}</span>
                  </div>
                )}

                {/* STEP 1: Phone Number Input */}
                {forgotStep === 1 && (
                  <form onSubmit={handleForgotVerifyPhone} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Registered Mobile Number
                      </label>
                      <div className="relative flex items-center rounded-2xl bg-[#1A1D24] border border-slate-700/80 focus-within:border-[#00D589] transition-colors">
                        <div className="pl-4 pr-2 text-xs font-bold text-[#00D589] border-r border-slate-700/80 py-3.5 flex items-center gap-1">
                          <span>🇳🇬 +234</span>
                        </div>
                        <input
                          type="tel"
                          inputMode="tel"
                          pattern="[0-9]*"
                          autoFocus
                          value={forgotPhone}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                            setForgotPhone(digitsOnly);
                            setForgotError(null);
                          }}
                          placeholder="e.g. 08012345678 or 8012345678"
                          title="Enter a 10-digit or 11-digit Nigerian mobile number"
                          className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 pt-1">
                        Enter your 10 or 11-digit Nigerian mobile number (e.g. 08012345678).
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="w-full rounded-full bg-[#00D589] py-4 text-sm font-black text-[#072418] hover:bg-[#00E599] active:scale-[0.99] transition-all shadow-lg shadow-emerald-950/40 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      {isForgotLoading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Verifying Account...</span>
                        </div>
                      ) : (
                        <span>Verify & Continue</span>
                      )}
                    </button>

                    <div className="text-center pt-2 text-xs text-slate-400">
                      <span>Remembered your password? </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (rememberedAccount && !isManuallyLoggedOut) {
                            setActiveMode('welcome_back');
                          } else {
                            setActiveMode('full_login');
                          }
                        }}
                        className="font-semibold text-[#00D589] hover:underline cursor-pointer"
                      >
                        Back to Log In
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 2: Create & Confirm New Password */}
                {forgotStep === 2 && (
                  <form onSubmit={handleForgotResetPassword} className="space-y-4">
                    {/* Account preview card */}
                    <div className="rounded-xl bg-[#121419] p-3 border border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Verified Account</span>
                        <span className="font-semibold text-white">
                          {forgotAccountName || 'Account Found'}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px] block">
                          {forgotMaskedPhone || forgotPhone}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep(1);
                          setForgotError(null);
                        }}
                        className="text-[11px] text-[#00D589] font-semibold hover:underline"
                      >
                        Change Number
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        New 6-Digit Password
                      </label>
                      <div className="relative flex items-center rounded-2xl bg-[#1A1D24] border border-slate-700/80 focus-within:border-[#00D589] transition-colors">
                        <input
                          type={showForgotNewPassword ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoFocus
                          value={forgotNewPassword}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setForgotNewPassword(clean);
                            setForgotError(null);
                          }}
                          placeholder="Enter new 6-digit password"
                          className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                          className="pr-4 text-slate-400 hover:text-white"
                        >
                          {showForgotNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Confirm New Password
                      </label>
                      <div className="relative flex items-center rounded-2xl bg-[#1A1D24] border border-slate-700/80 focus-within:border-[#00D589] transition-colors">
                        <input
                          type={showForgotConfirmPassword ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={forgotConfirmPassword}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setForgotConfirmPassword(clean);
                            setForgotError(null);
                          }}
                          placeholder="Re-enter new 6-digit password"
                          className="w-full bg-transparent py-3.5 px-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                          className="pr-4 text-slate-400 hover:text-white"
                        >
                          {showForgotConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#121419] p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#00D589]" />
                        <span>Security Requirement</span>
                      </div>
                      <p>Use at least 6 digits/characters that you can remember. Do not share your password with anyone.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={isForgotLoading}
                      className="w-full rounded-full bg-[#00D589] py-4 text-sm font-black text-[#072418] hover:bg-[#00E599] active:scale-[0.99] transition-all shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      {isForgotLoading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Updating Password...</span>
                        </div>
                      ) : (
                        <span>Confirm & Change Password</span>
                      )}
                    </button>

                    <div className="text-center pt-1 text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMode('full_login');
                          setLoginStep(2);
                        }}
                        className="font-semibold text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel & Return to Log In
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 3: Success Screen */}
                {forgotStep === 3 && (
                  <div className="space-y-6 text-center py-4 animate-in fade-in">
                    <div className="h-20 w-20 rounded-full bg-[#0D261C] border-2 border-[#00D589] text-[#00D589] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(0,213,137,0.3)] animate-in zoom-in-50">
                      <CheckCircle className="h-10 w-10" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-white">Password Changed Successfully!</h2>
                      <p className="text-xs text-slate-300 max-w-xs mx-auto">
                        Your account password has been permanently updated. You can now use your new password to log in at any time.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isForgotLoading}
                        onClick={handleDirectLoginAfterReset}
                        className="w-full rounded-full bg-[#00D589] py-4 text-sm font-black text-[#072418] hover:bg-[#00E599] active:scale-[0.99] transition-all shadow-lg shadow-emerald-950/40 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isForgotLoading ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Logging In...</span>
                          </div>
                        ) : (
                          <span>Log In Now With New Password</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveMode('welcome_back');
                          setLoginError(null);
                        }}
                        className="w-full rounded-full bg-[#1A1D24] border border-slate-700/80 py-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-[#222630] transition-colors cursor-pointer"
                      >
                        Go to Welcome Back Screen
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Regulatory Footer */}
              <div className="pt-4 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <Shield className="h-4 w-4 text-[#00D589]" />
                <span>Protected by OPay End-to-End Encryption</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

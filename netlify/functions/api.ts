// Netlify Serverless Function: Complete API Router with Account Registration & Cloud Persistence
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const BANKING_SALT = 'OPAY_SECURE_NIGERIA_BANKING_SALT_2026';
const TMP_ACCOUNTS_FILE = path.join('/tmp', 'opay_persistent_accounts.json');

function computeHash(value: string, salt: string = BANKING_SALT): string {
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

// In-Memory store for Lambda container lifetime
let inMemoryAccounts: any[] = [];

// Built-in Seed Accounts for Netlify Serverless Runtime
const DEFAULT_OWNER_ACCOUNT = {
  id: 'acc-musaraf-default',
  fullName: 'MUSARAF OLAWALE ABDULAZEEZ',
  phone: '07075817357',
  normalizedPhone: '07075817357',
  email: 'moriobee44@gmail.com',
  role: 'owner',
  ninMasked: '•••••••4821',
  password: '112212',
  loginPasswordHash: '615cf99a20726a47ad691da88059834c33d8c5ec47420d8894b84bdaa9160edc',
  passwordSalt: BANKING_SALT,
  customPin: '1122',
  transactionPinHash: 'a81ced1b8da7a0b6db36b614fd3f073ca8d48069bcdb9d1c4b3c482f5b3b070f',
  pinSalt: BANKING_SALT,
  failedPinAttempts: 0,
  pinLockoutUntil: null,
  accountStatus: 'active',
  lastLoginAt: Date.now(),
  verificationStatus: 'account_active',
  accountNumber: '7075817357',
  balanceNgn: 613900.0,
  createdAt: 1724800000000,
  userProfile: {
    name: 'MUSARAF',
    fullName: 'MUSARAF OLAWALE ABDULAZEEZ',
    phone: '+2347075817357',
    accountNumber: '7075817357',
    tier: 3,
    tierName: 'Tier 3',
    dailyLimitNgn: 5000000,
    singleMaxNgn: 1000000,
    avatarUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300&auto=format&fit=crop&q=80',
    todaySalesNgn: 11300.0,
    savingsBalanceNgn: 33450.0,
    owealthBalanceNgn: 498200.0,
    cashbackPointsNgn: 1490.0,
    isKycVerified: true,
    email: 'moriobee44@gmail.com',
    bvnLinked: true,
    ninLinked: true,
    role: 'owner',
    gender: 'Male',
    dob: '**-**-95',
    nickname: 'Musaraf',
    address: '10 Allen Avenue, Ikeja, Lagos State',
  },
  transactions: [
    {
      id: 'tx-init-1',
      title: 'Transfer to OPay - SUCCESSFUL',
      type: 'op_transfer',
      category: 'outflow',
      amountNgn: 5000,
      timestamp: Date.now() - 3600000 * 2,
      status: 'successful',
      recipient: {
        name: 'FATIMAH BELLO',
        accountOrPhone: '8021984421',
        bankName: 'OPay (Paycom)',
      },
      reference: 'OPAY_TX_INIT_1',
    },
    {
      id: 'tx-init-2',
      title: 'Wallet Top-up via Bank Card',
      type: 'deposit',
      category: 'inflow',
      amountNgn: 150000,
      timestamp: Date.now() - 3600000 * 24,
      status: 'successful',
      reference: 'OPAY_TX_INIT_2',
    },
  ],
  cards: [
    {
      id: 'card-1',
      cardType: 'Virtual Visa',
      cardNumber: '5399 •••• •••• 4821',
      cardHolder: 'MUSARAF OLAWALE ABDULAZEEZ',
      expiryDate: '08/29',
      cvv: '•••',
      isFrozen: false,
      isOnlineEnabled: true,
      isAtmEnabled: true,
      isPosEnabled: true,
      dailySpendLimit: 500000,
      colorTheme: 'teal',
    },
  ],
  safeBoxes: [],
  activeLoan: {
    loanLimitNgn: 500000,
    currentBorrowedNgn: 0,
    dueDate: Date.now() + 86400000 * 30,
    dailyInterestPercent: 0.1,
    status: 'eligible',
  },
  notifications: [
    {
      id: 'notif-seed-1',
      title: 'Security Alert 🛡️',
      message: 'Your account is secured with two-factor PIN protection.',
      timestamp: Date.now() - 3600000,
      read: true,
      type: 'security',
    },
  ],
};

function getAccountsList(): any[] {
  // 1. Try reading from writable /tmp store first (captures newly registered users across invocations in warm containers)
  try {
    if (fs.existsSync(TMP_ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(TMP_ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryAccounts = parsed;
        return inMemoryAccounts;
      }
    }
  } catch {}

  // 2. If memory store has entries, return it
  if (inMemoryAccounts.length > 0) {
    return inMemoryAccounts;
  }

  // 3. Try bundled data/db.json
  try {
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'db.json'),
      path.resolve(__dirname, '../../data/db.json'),
      path.resolve(__dirname, '../data/db.json'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          inMemoryAccounts = parsed.accounts;
          return inMemoryAccounts;
        }
      }
    }
  } catch {}

  // 4. Fallback to default owner account
  inMemoryAccounts = [DEFAULT_OWNER_ACCOUNT];
  return inMemoryAccounts;
}

function saveAccountToStore(account: any): void {
  const current = [...getAccountsList()];
  const cleanPhone = (account.phone || '').replace(/\D/g, '');
  const idx = current.findIndex((a: any) => 
    a.id === account.id || 
    (cleanPhone && (a.phone || '').replace(/\D/g, '') === cleanPhone)
  );

  if (idx >= 0) {
    current[idx] = { ...current[idx], ...account };
  } else {
    current.push(account);
  }

  inMemoryAccounts = current;

  try {
    fs.writeFileSync(TMP_ACCOUNTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write to /tmp:', err);
  }
}

function findAccount(identifier: string): any | null {
  const clean = (identifier || '').trim();
  const digits = clean.replace(/\D/g, '');
  const lower = clean.toLowerCase();

  const accounts = getAccountsList();

  // 1. Direct phone / email / ID match
  let found = accounts.find((a: any) => {
    const aDigits = (a.phone || '').replace(/\D/g, '');
    const accDigits = (a.accountNumber || '').replace(/\D/g, '');
    const aEmail = (a.email || '').toLowerCase();

    if (a.id === clean) return true;
    if (a.phone === clean) return true;
    if (a.accountNumber === clean) return true;
    if (aEmail && aEmail === lower) return true;
    if (digits && aDigits === digits) return true;
    if (digits && accDigits === digits) return true;
    if (digits.length === 10 && aDigits.endsWith(digits)) return true;
    if (digits.length === 11 && digits.startsWith('0') && aDigits.endsWith(digits.slice(1))) return true;

    return false;
  });

  if (found) return found;

  // 2. Canonical Owner identifiers: 07075817357, 08104443906, moriobee44@gmail.com
  const isOwnerId =
    digits.endsWith('7075817357') ||
    digits.endsWith('8104443906') ||
    lower === 'moriobee44@gmail.com' ||
    lower === 'musaraf.olawale@gmail.com';

  if (isOwnerId) {
    const owner = accounts.find((a: any) => a.id === 'acc-musaraf-default' || a.role === 'owner');
    return owner || DEFAULT_OWNER_ACCOUNT;
  }

  return null;
}

export const handler = async (event: any) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  const rawPath = event.path || '';
  let body: any = {};
  try {
    body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body) : {};
  } catch {
    body = {};
  }

  // Health check
  if (rawPath.includes('/health')) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'ok', environment: 'netlify' }),
    };
  }

  // 1. POST /api/admin/register-user or POST /api/auth/register (Register user for somebody)
  if (rawPath.includes('/admin/register-user') || rawPath.includes('/auth/register')) {
    const fullName = (body.fullName || '').trim();
    const phone = (body.phone || '').trim();
    const password = (body.password || '123456').trim();
    const pin = (body.pin || '1234').trim();
    const initialBalance = typeof body.initialBalance === 'number' ? body.initialBalance : (parseFloat(body.initialBalance) || 0);
    const email = (body.email || `${phone.replace(/\D/g, '')}@opay.ng`).trim().toLowerCase();

    if (!fullName || !phone) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Full name and phone number are required.' }),
      };
    }

    const cleanPhoneDigits = phone.replace(/\D/g, '');
    const subscriber10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : cleanPhoneDigits.padStart(10, '0');
    const national11 = cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith('0') ? cleanPhoneDigits : `0${subscriber10}`;

    // Check duplicate
    const existing = findAccount(subscriber10) || findAccount(national11);
    if (existing && existing.id !== 'acc-musaraf-default') {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'This phone number is already registered in the system.' }),
      };
    }

    const userId = `acc-${subscriber10}-${Date.now().toString(36)}`;
    const passHash = computeHash(password, BANKING_SALT);
    const pinHash = computeHash(pin, BANKING_SALT);

    const newAccount = {
      id: userId,
      fullName: fullName.toUpperCase(),
      phone: national11,
      normalizedPhone: national11,
      email,
      role: 'user',
      ninMasked: '•••••••8921',
      password,
      loginPasswordHash: passHash,
      passwordSalt: BANKING_SALT,
      customPin: pin,
      transactionPinHash: pinHash,
      pinSalt: BANKING_SALT,
      failedPinAttempts: 0,
      pinLockoutUntil: null,
      accountStatus: 'active',
      lastLoginAt: Date.now(),
      verificationStatus: 'account_active',
      accountNumber: subscriber10,
      balanceNgn: initialBalance,
      createdAt: Date.now(),
      userProfile: {
        name: fullName.split(' ')[0] || 'User',
        fullName: fullName.toUpperCase(),
        phone: national11,
        accountNumber: subscriber10,
        tier: 3,
        tierName: 'Tier 3',
        dailyLimitNgn: 5000000,
        singleMaxNgn: 1000000,
        avatarUrl: '',
        todaySalesNgn: 0,
        savingsBalanceNgn: 0,
        owealthBalanceNgn: 0,
        cashbackPointsNgn: 500,
        isKycVerified: true,
        email,
        bvnLinked: true,
        ninLinked: true,
        gender: 'Verified',
        dob: '**-**-**',
        nickname: fullName.split(' ')[0] || 'User',
        address: 'Lagos, Nigeria',
      },
      transactions: initialBalance > 0 ? [
        {
          id: `tx-init-${Date.now()}`,
          userId,
          reference: `OPAY${Date.now().toString(36).toUpperCase()}`,
          type: 'deposit',
          title: 'Initial Deposit / Opening Balance',
          amountNgn: initialBalance,
          status: 'successful',
          timestamp: Date.now(),
          category: 'inflow',
          balanceAfterNgn: initialBalance,
        }
      ] : [],
      cards: [],
      safeBoxes: [],
      activeLoan: {
        loanLimitNgn: 200000,
        currentBorrowedNgn: 0,
        dueDate: Date.now() + 86400000 * 30,
        dailyInterestPercent: 0.1,
        status: 'eligible',
      },
      notifications: [
        {
          id: `notif-welcome-${Date.now()}`,
          title: 'Welcome to OPay 🛡️',
          message: `Welcome to OPay, ${fullName}! Your account (${subscriber10}) is active and ready.`,
          timestamp: Date.now(),
          read: false,
          type: 'security',
        },
      ],
      recentRecipients: [],
    };

    saveAccountToStore(newAccount);

    const sanitized = { ...newAccount };
    delete (sanitized as any).password;
    delete (sanitized as any).customPin;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        account: sanitized,
        message: `Account for ${fullName} (${national11}) successfully registered and saved.`,
      }),
    };
  }

  // 2. POST /api/accounts/sync-single (Save client changes to persistent store)
  if (rawPath.includes('/accounts/sync-single')) {
    const { account } = body;
    if (account && account.id) {
      saveAccountToStore(account);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, message: 'Account synchronized.' }),
      };
    }
  }

  // 3. POST /api/auth/check-phone
  if (rawPath.includes('/auth/check-phone') || rawPath.includes('/forgot-password/check-phone')) {
    const phoneInput = (body.phone || body.identifier || '').trim();
    if (!phoneInput) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Phone number or email is required.' }),
      };
    }

    const acc = findAccount(phoneInput);
    if (!acc) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          exists: false,
          message: 'Account not found. Please contact the owner to register your account.',
        }),
      };
    }

    const cleanP = (acc.phone || '').replace(/\D/g, '');
    const masked = cleanP.length >= 10
      ? `${cleanP.slice(0, 3)} •••• ${cleanP.slice(-4)}`
      : '••••••••••';

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        exists: true,
        accountId: acc.id,
        phone: acc.phone,
        fullName: acc.fullName,
        maskedPhone: masked,
        accountName: acc.fullName,
        role: acc.role,
        message: 'Account found.',
      }),
    };
  }

  // 4. POST /api/auth/login
  if (rawPath.includes('/auth/login')) {
    const identifier = (body.identifier || '').trim();
    const password = (body.password || body.pinOrPass || '').trim();

    if (!identifier) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Account identifier is required.' }),
      };
    }

    if (!password) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Password is required.' }),
      };
    }

    const acc = findAccount(identifier);
    if (!acc) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          message: 'Account not found. Please contact the owner to register your account.',
        }),
      };
    }

    const isOwner =
      acc.id === 'acc-musaraf-default' ||
      acc.role === 'owner' ||
      (acc.phone && (acc.phone.includes('7075817357') || acc.phone.includes('8104443906')));

    const salt = acc.passwordSalt || BANKING_SALT;
    const inputHash = computeHash(password, salt);

    // Accept:
    // 1. Exact match with password hash
    // 2. 112212 or 123456 for owner account
    // 3. Plain password match if present
    // 4. Transaction PIN match (1122, 1234)
    const isPasswordValid = Boolean(
      acc.loginPasswordHash === inputHash ||
      computeHash(password, BANKING_SALT) === acc.loginPasswordHash ||
      acc.password === password ||
      (isOwner && (password === '112212' || password === '123456')) ||
      (acc.customPin && acc.customPin === password) ||
      (isOwner && (password === '1122' || password === '1234'))
    );

    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          message: 'Incorrect login password. Please check your credentials and try again.',
        }),
      };
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    const sanitized = { ...acc };
    delete sanitized.password;
    delete sanitized.customPin;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        token,
        requiresPermanentPasswordReset: false,
        account: sanitized,
        message: 'Login successful.',
      }),
    };
  }

  // 5. POST /api/auth/verify-pin
  if (rawPath.includes('/auth/verify-pin')) {
    const { accountId, pin } = body;
    const cleanPin = (pin || '').trim();

    if (!cleanPin || cleanPin.length !== 4) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, verified: false, message: '4-digit PIN is required.' }),
      };
    }

    const acc = findAccount(accountId || 'acc-musaraf-default');
    const isOwner = !acc || acc.id === 'acc-musaraf-default' || acc.role === 'owner';

    const isValidPin = Boolean(
      (isOwner && (cleanPin === '1122' || cleanPin === '1234')) ||
      (acc && acc.customPin === cleanPin) ||
      (acc && acc.transactionPinHash && computeHash(cleanPin, acc.pinSalt || BANKING_SALT) === acc.transactionPinHash) ||
      (!acc?.transactionPinHash && (cleanPin === '1122' || cleanPin === '1234' || cleanPin === '0000'))
    );

    if (isValidPin) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          verified: true,
          message: 'PIN verified successfully.',
        }),
      };
    }

    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        verified: false,
        message: 'Incorrect transaction PIN. Please try again.',
      }),
    };
  }

  // 6. POST /api/admin/switch-account
  if (rawPath.includes('/admin/switch-account')) {
    const { targetAccountId } = body;
    const acc = findAccount(targetAccountId || '');
    if (acc) {
      const sanitized = { ...acc };
      delete sanitized.password;
      delete sanitized.customPin;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, account: sanitized }),
      };
    }
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Account not found.' }),
    };
  }

  // 7. POST /api/auth/forgot-password/reset-password
  if (rawPath.includes('/forgot-password/reset-password')) {
    const { phone, newPassword } = body;
    const acc = findAccount(phone || '');
    if (!acc) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Account not found.' }),
      };
    }

    if (newPassword) {
      acc.loginPasswordHash = computeHash(newPassword, BANKING_SALT);
      acc.password = newPassword;
      saveAccountToStore(acc);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.',
      }),
    };
  }

  // 8. GET /api/accounts
  if (rawPath.includes('/accounts')) {
    const accounts = getAccountsList().map((a: any) => {
      const copy = { ...a };
      delete copy.password;
      delete copy.customPin;
      delete copy.loginPasswordHash;
      delete copy.transactionPinHash;
      return copy;
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        accounts,
      }),
    };
  }

  // 9. GET /api/user/me
  if (rawPath.includes('/user/me')) {
    const sanitized = { ...DEFAULT_OWNER_ACCOUNT };
    delete (sanitized as any).password;
    delete (sanitized as any).customPin;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        account: sanitized,
      }),
    };
  }

  // 10. POST /api/transfers/send
  if (rawPath.includes('/transfers/send')) {
    const { amountNgn, recipientName, recipientPhone, bankName, remark } = body;
    const tx = {
      id: `tx-${Date.now()}`,
      title: `Transfer to ${recipientName || 'Beneficiary'}`,
      type: bankName ? 'bank_transfer' : 'op_transfer',
      category: 'outflow',
      amountNgn: parseFloat(amountNgn) || 0,
      timestamp: Date.now(),
      status: 'successful',
      recipient: {
        name: recipientName || 'Beneficiary',
        accountOrPhone: recipientPhone || '',
        bankName: bankName || 'OPay (Paycom)',
      },
      remark: remark || undefined,
      reference: `OPAY_TX_${Date.now()}`,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        transaction: tx,
        message: 'Transfer successful.',
      }),
    };
  }

  // 11. POST /api/identity/verify-nin
  if (rawPath.includes('/identity/verify-nin')) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        verified: true,
        ninMasked: '•••••••4821',
        provider: 'NIMC / OPay Identity Gateway',
        message: 'NIN verified successfully.',
      }),
    };
  }

  // 12. POST /api/identity/verify-face-liveness
  if (rawPath.includes('/identity/verify-face-liveness')) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        verified: true,
        status: 'approved',
        livenessScore: 99.4,
        facialMatchScore: 98.2,
        provider: 'OPay Biometric Gateway',
        message: 'Biometric verification approved.',
      }),
    };
  }

  // 13. Default fallback
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      status: 'ok',
    }),
  };
};

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Admin Login Route to verify admin credentials
router.post('/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Admin username/email and password are required.' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. Account does not have ADMIN privileges.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Admin access granted.',
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Master Security PIN verification for high-security Admin Gate
router.post('/verify-pin', async (req: any, res: any) => {
  const { pin, email, password } = req.body;
  const MASTER_PIN = process.env.ADMIN_MASTER_PIN || '889900';

  if (!pin || pin.trim().length === 0) {
    return res.status(400).json({ error: '6-digit Master Admin PIN is required.' });
  }

  if (pin.trim() !== MASTER_PIN) {
    return res.status(401).json({ error: 'Invalid Master Security PIN. Access denied.' });
  }

  // If email and password are provided alongside PIN for dual-factor verification
  if (email && password) {
    try {
      const bcrypt = require('bcryptjs');
      const user = await prisma.user.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
      });

      if (!user) {
        return res.status(401).json({ error: 'Admin account not found.' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect Admin password.' });
      }

      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied. Account does not have ADMIN role.' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        message: 'Admin 2FA Authorization successful.',
        token,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Authentication verification failed.' });
    }
  }

  // If bearer token exists in header, verify role
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user && user.role === 'ADMIN') {
        return res.json({
          success: true,
          message: 'Admin Master PIN verified successfully.',
          user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        });
      }
    } catch (err) {}
  }

  return res.json({
    success: true,
    message: 'Master Security PIN accepted.',
  });
});

// Middleware to authenticate and ensure ADMIN role or provide access
export const authenticateAdmin = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized. Admin token required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden. Access restricted to administrators only.' });
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// 1. Bank Statistics / Overview
router.get('/stats', authenticateAdmin, async (req: any, res: any) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalTransactions = await prisma.transaction.count();
    
    const balanceSum = await prisma.user.aggregate({
      _sum: { balance: true },
    });

    const depositSum = await prisma.transaction.aggregate({
      where: { type: 'DEPOSIT' },
      _sum: { amount: true },
    });

    const withdrawalSum = await prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL' },
      _sum: { amount: true },
    });

    res.json({
      totalUsers,
      totalTransactions,
      totalBankReserves: balanceSum._sum.balance || 0,
      totalDepositedVolume: depositSum._sum.amount || 0,
      totalWithdrawnVolume: withdrawalSum._sum.amount || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// 2. List All Registered Users
router.get('/users', authenticateAdmin, async (req: any, res: any) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        balance: true,
        role: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user list.' });
  }
});

// 3. Adjust User Balance (Credit or Debit)
router.post('/user/adjust-balance', authenticateAdmin, async (req: any, res: any) => {
  const { userId, amount, type, reason } = req.body;
  const numAmount = parseFloat(amount);

  if (!userId || isNaN(numAmount) || numAmount <= 0 || !['CREDIT', 'DEBIT'].includes(type)) {
    return res.status(400).json({ error: 'Valid userId, amount, and adjustment type (CREDIT/DEBIT) are required.' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (type === 'DEBIT' && targetUser.balance < numAmount) {
      return res.status(400).json({ error: 'User does not have sufficient balance for debit.' });
    }

    const isCredit = type === 'CREDIT';
    const balanceChange = isCredit ? { increment: numAmount } : { decrement: numAmount };
    const txType = isCredit ? 'DEPOSIT' : 'WITHDRAWAL';
    const txTitle = `Admin Adjustment: ${isCredit ? 'Credited' : 'Debited'} $${numAmount.toFixed(2)}${reason ? ` (${reason})` : ''}`;

    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: { balance: balanceChange },
      }),
      prisma.transaction.create({
        data: {
          title: txTitle,
          amount: numAmount,
          type: txType,
          senderName: isCredit ? 'Bank Administrator' : targetUser.fullName,
          senderEmail: isCredit ? (req.user?.email || 'admin@bank.com') : targetUser.email,
          recipientName: isCredit ? targetUser.fullName : 'Bank Reserve (Debit)',
          recipientEmail: isCredit ? targetUser.email : 'admin@bank.com',
          userId: targetUser.id,
        },
      }),
    ]);

    res.json({
      message: `Successfully ${isCredit ? 'credited' : 'debited'} $${numAmount.toFixed(2)} to ${targetUser.fullName}.`,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        balance: updatedUser.balance,
      },
      transaction,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to adjust balance.' });
  }
});

// 4. Update User Role (Promote/Demote Admin)
router.post('/user/role', authenticateAdmin, async (req: any, res: any) => {
  const { userId, role } = req.body;
  if (!userId || !['USER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Valid userId and role (USER/ADMIN) are required.' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: { id: true, fullName: true, email: true, role: true },
    });

    res.json({ message: `Role updated to ${role}.`, user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// 5. Delete User Account
router.delete('/user/:id', authenticateAdmin, async (req: any, res: any) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    // Delete related transactions first
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User account and associated transactions deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// 6. Global Transaction Ledger across ALL users
router.get('/transactions', authenticateAdmin, async (req: any, res: any) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    const enrichedTransactions = transactions.map((tx: any) => {
      let senderName = tx.senderName;
      let senderEmail = tx.senderEmail;
      let recipientName = tx.recipientName;
      let recipientEmail = tx.recipientEmail;

      // Smart inference for past transactions where columns were empty
      if (!senderName || !recipientName) {
        if (tx.title.startsWith('Transfer to ')) {
          senderName = tx.user.fullName;
          senderEmail = tx.user.email;
          recipientName = tx.title.replace('Transfer to ', '').split(' (')[0].trim();
          recipientEmail = '';
        } else if (tx.title.startsWith('Transfer from ')) {
          senderName = tx.title.replace('Transfer from ', '').split(' (')[0].trim();
          senderEmail = '';
          recipientName = tx.user.fullName;
          recipientEmail = tx.user.email;
        } else if (tx.title.includes('Deposit')) {
          senderName = tx.title.includes('Admin') ? 'Bank Administrator' : 'Direct Deposit';
          senderEmail = 'system@bank.com';
          recipientName = tx.user.fullName;
          recipientEmail = tx.user.email;
        } else if (tx.title.includes('Adjustment') || tx.title.includes('Admin')) {
          senderName = tx.type === 'DEPOSIT' ? 'Bank Administrator' : tx.user.fullName;
          senderEmail = 'admin@bank.com';
          recipientName = tx.type === 'DEPOSIT' ? tx.user.fullName : 'Bank Reserve';
          recipientEmail = tx.user.email;
        } else {
          senderName = tx.type === 'DEPOSIT' ? 'Bank Deposit' : tx.user.fullName;
          senderEmail = '';
          recipientName = tx.type === 'DEPOSIT' ? tx.user.fullName : 'Withdrawal / ATM';
          recipientEmail = tx.user.email;
        }
      }

      return {
        ...tx,
        senderName: senderName || 'Direct Sender',
        senderEmail: senderEmail || '',
        recipientName: recipientName || 'Account Holder',
        recipientEmail: recipientEmail || '',
      };
    });

    res.json(enrichedTransactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transaction ledger.' });
  }
});

// 7. Reset Customer Password (by Administrator)
router.post('/user/reset-password', authenticateAdmin, async (req: any, res: any) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Valid userId and a new password of at least 6 characters are required.' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Customer account not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { password: hashedPassword },
    });

    res.json({
      message: `Password for ${targetUser.fullName} (${targetUser.email}) has been successfully updated.`,
      user: {
        id: targetUser.id,
        fullName: targetUser.fullName,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reset customer password.' });
  }
});

// 8. Create New Customer Account (by Administrator)
router.post('/user/create', authenticateAdmin, async (req: any, res: any) => {
  const { fullName, email, password, initialBalance, role } = req.body;

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'Customer full name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Valid username or email address is required.' });
  }
  if (!password || password.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';
  const balanceNum = initialBalance !== undefined && !isNaN(parseFloat(initialBalance))
    ? Math.max(0, parseFloat(initialBalance))
    : 1000.0;

  try {
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return res.status(400).json({ error: `An account with email/username "${cleanEmail}" already exists.` });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const newUser = await prisma.user.create({
      data: {
        fullName: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        balance: balanceNum,
        role: assignedRole,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        balance: true,
        role: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (balanceNum > 0) {
      await prisma.transaction.create({
        data: {
          title: 'Initial Account Deposit (Admin Issued)',
          amount: balanceNum,
          type: 'DEPOSIT',
          senderName: 'Bank Administrator',
          senderEmail: req.user?.email || 'admin@bank.com',
          recipientName: newUser.fullName,
          recipientEmail: newUser.email,
          userId: newUser.id,
        },
      });
    }

    res.status(201).json({
      message: `Account for ${newUser.fullName} successfully created!`,
      user: newUser,
      issuedCredentials: {
        username: newUser.email,
        password: password.trim(),
        role: newUser.role,
        initialBalance: newUser.balance,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create new customer account.' });
  }
});

export default router;


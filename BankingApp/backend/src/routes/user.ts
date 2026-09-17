import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

router.get('/dashboard', authenticate, async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      fullName: user.fullName,
      email: user.email,
      balance: user.balance,
      role: user.role,
      transactions: user.transactions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/transactions', authenticate, async (req: any, res: any) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
    });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/deposit', authenticate, async (req: any, res: any) => {
  const { amount } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid deposit amount.' });
  }

  try {
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: { balance: { increment: numAmount } },
      }),
      prisma.transaction.create({
        data: {
          title: 'Deposit',
          amount: numAmount,
          type: 'DEPOSIT',
          userId: req.userId,
        },
      }),
    ]);

    res.json({
      message: 'Deposit successful.',
      balance: updatedUser.balance,
      transaction,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/transfer', authenticate, async (req: any, res: any) => {
  const { recipientEmail, amount, note } = req.body;
  const numAmount = parseFloat(amount);

  if (!recipientEmail || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Please provide recipient email and a valid amount.' });
  }

  try {
    const sender = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!sender) {
      return res.status(404).json({ error: 'Sender account not found.' });
    }

    const cleanRecipientEmail = recipientEmail.trim().toLowerCase();

    if (sender.email.toLowerCase() === cleanRecipientEmail) {
      return res.status(400).json({ error: 'You cannot transfer money to yourself.' });
    }

    if (sender.balance < numAmount) {
      return res.status(400).json({ error: 'Insufficient balance for this transfer.' });
    }

    const recipient = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanRecipientEmail,
          mode: 'insensitive',
        },
      },
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient account not found with that email.' });
    }

    const transferNote = note ? ` (${note})` : '';

    const [updatedSender] = await prisma.$transaction([
      // Deduct from sender
      prisma.user.update({
        where: { id: sender.id },
        data: { balance: { decrement: numAmount } },
      }),
      // Add to recipient
      prisma.user.update({
        where: { id: recipient.id },
        data: { balance: { increment: numAmount } },
      }),
      // Record sender withdrawal
      prisma.transaction.create({
        data: {
          title: `Transfer to ${recipient.fullName}${transferNote}`,
          amount: numAmount,
          type: 'WITHDRAWAL',
          userId: sender.id,
        },
      }),
      // Record recipient deposit
      prisma.transaction.create({
        data: {
          title: `Transfer from ${sender.fullName}${transferNote}`,
          amount: numAmount,
          type: 'DEPOSIT',
          userId: recipient.id,
        },
      }),
    ]);

    res.json({
      message: 'Transfer completed successfully.',
      balance: updatedSender.balance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Change Password (for customers to replace admin-issued/general password with their own)
router.post('/change-password', authenticate, async (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current or admin-issued password is required.' });
  }

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New personal password must be at least 6 characters.' });
  }

  if (currentPassword.trim() === newPassword.trim()) {
    return res.status(400).json({ error: 'New password must be different from the current password.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword.trim(), user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password. Please verify the password given to you.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password successfully updated! You can now sign in with your new personal password.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export default router;

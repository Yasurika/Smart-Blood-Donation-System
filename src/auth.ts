import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Hospital from '@/lib/models/Hospital';
import { authConfig } from '@/auth.config';
import logger from '@/lib/logger';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: {},
                password: {},
            },
            authorize: async (credentials) => {
                await dbConnect();

                const email = (credentials.email as string)?.toLowerCase()?.trim();
                const password = credentials.password as string;

                if (!email || !password) {
                    throw new Error('Email and password are required.');
                }

                // Auto-detect: search User collection first, then Hospital
                let user = await User.findOne({ email, isActive: true });
                let detectedRole: string = user?.role || 'donor';
                let Model = User;

                if (!user) {
                    user = await Hospital.findOne({ email, isActive: true });
                    if (user) {
                        detectedRole = 'hospital';
                        Model = Hospital;
                    }
                } 

                if (!user) {
                    logger.warn('Login attempt for non-existent user', { email });
                    throw new Error('Invalid email or password.');
                }

                // Check account lockout
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    const remainingMs = user.lockedUntil.getTime() - Date.now();
                    const remainingMin = Math.ceil(remainingMs / 60000);
                    logger.warn('Login attempt on locked account', { email, remainingMin });
                    throw new Error(`Account locked. Try again in ${remainingMin} minute(s).`);
                }

                const isPasswordValid = await bcrypt.compare(password, user.password);

                if (!isPasswordValid) {
                    // Increment failed attempts
                    const attempts = (user.failedLoginAttempts || 0) + 1;
                    const updateData: Record<string, unknown> = { failedLoginAttempts: attempts };

                    if (attempts >= MAX_LOGIN_ATTEMPTS) {
                        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
                        logger.warn('Account locked due to too many failed attempts', { email, attempts });
                    }

                    await Model.updateOne({ _id: user._id }, { $set: updateData });

                    const remaining = MAX_LOGIN_ATTEMPTS - attempts;
                    if (remaining > 0) {
                        throw new Error(`Invalid email or password. ${remaining} attempt(s) remaining.`);
                    }
                    throw new Error('Account locked due to too many failed attempts. Try again in 15 minutes.');
                }

                // Reset failed attempts on successful login
                if (user.failedLoginAttempts > 0) {
                    await Model.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: null } });
                }

                logger.info('User logged in successfully', { userId: user._id, email, role: detectedRole });

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: user.name,
                    role: detectedRole,
                };
            },
        }),
    ],
});

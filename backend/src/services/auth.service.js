import { z } from 'zod';
import prisma from '../config/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors.js';

// Zod schema for registration
export const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .transform((val) => val.toLowerCase()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
  role: z
    .string({ required_error: 'Role is required' })
    .trim()
    .refine(
      (val) => {
        const lower = val.toLowerCase();
        return lower === 'tenant' || lower === 'owner';
      },
      {
        message: 'Role must be either "tenant" or "owner". Public registration as admin is not permitted.',
      }
    )
    .transform((val) => val.toUpperCase()),
});

// Zod schema for login
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .transform((val) => val.toLowerCase()),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

/**
 * Register a new user
 * @param {object} input
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function registerUser(input) {
  const parseResult = registerSchema.safeParse(input);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { name, email, password, role } = parseResult.data;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role, // TENANT or OWNER
      isActive: true,
    },
  });

  const safeUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    isActive: newUser.isActive,
    createdAt: newUser.createdAt,
    updatedAt: newUser.updatedAt,
  };

  const token = generateToken({
    id: newUser.id,
    role: newUser.role,
  });

  return {
    user: safeUser,
    token,
  };
}

/**
 * Authenticate user login
 * @param {object} input
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function loginUser(input) {
  const parseResult = loginSchema.safeParse(input);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { email, password } = parseResult.data;

  // Look up user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verify account active status
  if (!user.isActive) {
    throw new UnauthorizedError('Account is inactive. Please contact support.');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const token = generateToken({
    id: user.id,
    role: user.role,
  });

  return {
    user: safeUser,
    token,
  };
}

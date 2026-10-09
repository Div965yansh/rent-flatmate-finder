import { registerUser, loginUser } from '../services/auth.service.js';

/**
 * Handle user registration
 */
export async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle user login
 */
export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Return current authenticated user profile
 */
export async function getMe(req, res, next) {
  try {
    res.status(200).json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
}

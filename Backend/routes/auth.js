const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate, authRateLimit } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
  verifyEmailValidation,
  refreshTokenValidation
} = require('../middleware/validation');

router.post('/register', authRateLimit, registerValidation, AuthController.register);
router.post('/login', authRateLimit, loginValidation, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);
router.post('/refresh-token', AuthController.refreshToken);

router.post('/verify-email', verifyEmailValidation, AuthController.verifyEmail);
router.post('/resend-verification', authenticate, AuthController.resendVerificationEmail);

router.post('/forgot-password', authRateLimit, forgotPasswordValidation, AuthController.forgotPassword);
router.post('/reset-password', authRateLimit, resetPasswordValidation, AuthController.resetPassword);
router.post('/change-password', authenticate, changePasswordValidation, AuthController.changePassword);

router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, AuthController.updateProfile);



module.exports = router;

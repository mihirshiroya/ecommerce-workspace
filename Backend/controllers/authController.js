const prisma = require('../config/database');
const AuthUtils = require('../utils/auth');
const emailService = require('../services/emailService');

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, firstName, lastName } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      const hashedPassword = await AuthUtils.hashPassword(password);

      const emailVerificationToken = AuthUtils.generateEmailVerificationToken();

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          emailVerificationToken,
          provider: 'LOCAL'
        }
      });

      try {
        if (emailService.isConfigured()) await emailService.sendVerificationEmail(email, firstName, emailVerificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      const tokenPayload = AuthUtils.createTokenPayload(user);
      const { accessToken, refreshToken } = AuthUtils.generateTokens(tokenPayload);

      await AuthUtils.saveRefreshToken(user.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      res.status(201).json({
        success: true,
        message: emailService.isConfigured() ? 'Account created. Check your email for verification.' : 'Account created. Email delivery is not configured; verification is pending.',
        data: {
          user: AuthUtils.sanitizeUser(user),
          tokens: {
            accessToken,
            refreshToken
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!user.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      if (!user.password) return res.status(400).json({ success: false, message: 'Use password recovery to set a local password.' });

      const isPasswordValid = await AuthUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      const tokenPayload = AuthUtils.createTokenPayload(user);
      const { accessToken, refreshToken } = AuthUtils.generateTokens(tokenPayload);

      await AuthUtils.saveRefreshToken(user.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: AuthUtils.sanitizeUser(user),
          tokens: {
            accessToken,
            refreshToken
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  static async logout(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (refreshToken) {
        await AuthUtils.removeRefreshToken(refreshToken);
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }
  static async logoutAll(req, res) {
    try {
      const userId = req.user.id;

      await AuthUtils.removeAllRefreshTokens(userId);

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out from all devices'
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout from all devices failed'
      });
    }
  }

  static async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(404).json({
          success: false,
          message: 'Refresh token not found'
        });
      }

      const decoded = AuthUtils.verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

      if (!decoded) {
        return res.status(404).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const tokenRecord = await AuthUtils.findRefreshToken(refreshToken);

      if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      const user = tokenRecord.user;

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      const tokenPayload = AuthUtils.createTokenPayload(user);
      const { accessToken, refreshToken: newRefreshToken } = AuthUtils.generateTokens(tokenPayload);

      await AuthUtils.removeRefreshToken(refreshToken);
      await AuthUtils.saveRefreshToken(user.id, newRefreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 15 * 60 * 1000
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken,
            refreshToken: newRefreshToken
          }
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Token refresh failed'
      });
    }
  }
static async verifyEmail(req, res) {
  try {
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

      if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
        data: {
          user: AuthUtils.sanitizeUser(user)
        }
      });
    }

  
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      }
    });

    // Send welcome email
    // try {
    //   await emailService.sendWelcomeEmail(user.email, user.firstName);
    // } catch (emailError) {
    //   console.error('Failed to send welcome email:', emailError);
    // }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: AuthUtils.sanitizeUser(updatedUser)
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
}


  static async resendVerificationEmail(req, res) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      const emailVerificationToken = AuthUtils.generateEmailVerificationToken();

      await prisma.user.update({
        where: { id: userId },
        data: { emailVerificationToken }
      });

      // Send verification email
      await emailService.sendVerificationEmail(user.email, user.firstName, emailVerificationToken);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      console.error('Resend verification email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
      }


      const { token, expires } = AuthUtils.generatePasswordResetToken();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires
        }
      });

      await emailService.sendPasswordResetEmail(user.email, user.firstName, token);

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const hashedPassword = await AuthUtils.hashPassword(password);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });

      await AuthUtils.removeAllRefreshTokens(user.id);

      res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Password reset failed'
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      const isCurrentPasswordValid = await AuthUtils.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      const hashedNewPassword = await AuthUtils.hashPassword(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      const currentRefreshToken = req.cookies.refreshToken;
      await prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: { not: currentRefreshToken }
        }
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Password change failed'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          _count: {
            select: {
              refreshTokens: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          user: AuthUtils.sanitizeUser(user),
          activeDevices: user._count.refreshTokens
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile'
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { firstName, lastName, email } = req.body;
      const userId = req.user.id;

      const updateData = {};

      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email && email !== req.user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use'
          });
        }

        updateData.email = email;
        updateData.isEmailVerified = false;
        updateData.emailVerificationToken = AuthUtils.generateEmailVerificationToken();
        updateData.emailVerifiedAt = null;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      if (email && email !== req.user.email) {
        try {
          await emailService.sendVerificationEmail(email, updatedUser.firstName, updateData.emailVerificationToken);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
        }
      }

      res.json({
        success: true,
        message: email && email !== req.user.email
          ? 'Profile updated successfully. Please verify your new email address.'
          : 'Profile updated successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Profile update failed'
      });
    }
  }
}

module.exports = AuthController;

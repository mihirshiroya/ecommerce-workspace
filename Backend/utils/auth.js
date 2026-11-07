const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/database');

class AuthUtils {
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  static generateTokens(payload) {
    payload = { ...payload, sessionId: crypto.randomUUID() };
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d', jwtid: crypto.randomUUID() }
    );

    return { accessToken, refreshToken };
  }

  static verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
       return null;
    }
  }

  static generateRandomToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  static generatePasswordResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    return { token, expires };
  }

  static async saveRefreshToken(userId, refreshToken) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    return await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt
      }
    });
  }

  static async removeRefreshToken(refreshToken) {
    return await prisma.refreshToken.delete({
      where: { token: refreshToken }
    });
  }

  static async removeAllRefreshTokens(userId) {
    return await prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  static async findRefreshToken(refreshToken) {
    return await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });
  }

  static async cleanExpiredTokens() {
    return await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lte: new Date()
        }
      }
    });
  }

  static createTokenPayload(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
      isEmailVerified: user.isEmailVerified
    };
  }

  static sanitizeUser(user) {
    const { password, passwordResetToken, passwordResetExpires, emailVerificationToken, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = AuthUtils;

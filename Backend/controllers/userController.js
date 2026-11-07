const prisma = require('../config/database');
const AuthUtils = require('../utils/auth');

class UserController {
  static async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, search, role, provider, verified } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      if (role) {
        where.role = role;
      }
      
      if (provider) {
        where.provider = provider;
      }
      
      if (verified !== undefined) {
        where.isEmailVerified = verified === 'true';
      }

      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            provider: true,
            isEmailVerified: true,
            isActive: true,
            avatar: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      if (requestingUser.id !== id && requestingUser.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              refreshTokens: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: AuthUtils.sanitizeUser(user),
          activeDevices: user._count.refreshTokens
        }
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user'
      });
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, role, isActive } = req.body;
      const requestingUser = req.user;

      if (requestingUser.id !== id && requestingUser.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updateData = {};

      if (requestingUser.role !== 'ADMIN') {
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        
        if (email && email !== user.email) {
          const existingUser = await prisma.user.findUnique({ where: { email } });
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
      } else {
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email;
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        if (requestingUser.id === id && isActive === false) {
          return res.status(400).json({
            success: false,
            message: 'You cannot deactivate your own account'
          });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      if (requestingUser.id !== id && requestingUser.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (requestingUser.id === id && requestingUser.role === 'ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own admin account'
        });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await prisma.user.delete({ where: { id } });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }

  static async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;

      if (requestingUser.id === id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own account'
        });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      await AuthUtils.removeAllRefreshTokens(id);

      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user'
      });
    }
  }

  static async activateUser(req, res) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: true }
      });

      res.json({
        success: true,
        message: 'User activated successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate user'
      });
    }
  }

  static async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const requestingUser = req.user;

      if (requestingUser.id === id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot change your own role'
        });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role }
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
          user: AuthUtils.sanitizeUser(updatedUser)
        }
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user role'
      });
    }
  }
  static async getUserStats(req, res) {
    try {
      const stats = await prisma.user.groupBy({
        by: ['role', 'provider', 'isEmailVerified', 'isActive'],
        _count: true
      });

      const totalUsers = await prisma.user.count();
      const activeUsers = await prisma.user.count({
        where: { isActive: true }
      });
      const verifiedUsers = await prisma.user.count({
        where: { isEmailVerified: true }
      });
      const recentUsers = await prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          verifiedUsers,
          recentUsers,
          breakdown: stats
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics'
      });
    }
  }

  static async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;

      const sessions = await prisma.refreshToken.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isExpired: session.expiresAt < new Date()
          }))
        }
      });
    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active sessions'
      });
    }
  }

  static async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = await prisma.refreshToken.findFirst({
        where: {
          id: sessionId,
          userId
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      await prisma.refreshToken.delete({
        where: { id: sessionId }
      });

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      console.error('Revoke session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke session'
      });
    }
  }
}

module.exports = UserController;
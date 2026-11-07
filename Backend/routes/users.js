const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate, authorize, generalRateLimit } = require('../middleware/auth');

router.use(generalRateLimit);

router.use(authenticate);

router.get('/', authorize('ADMIN'), UserController.getAllUsers);
router.get('/stats', authorize('ADMIN'), UserController.getUserStats);
router.get('/:id', UserController.getUserById);
router.put('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

router.patch('/:id/deactivate', authorize('ADMIN'), UserController.deactivateUser);
router.patch('/:id/activate', authorize('ADMIN'), UserController.activateUser);
router.patch('/:id/role', authorize('ADMIN'), UserController.updateUserRole);

router.get('/me/sessions', UserController.getActiveSessions);
router.delete('/me/sessions/:sessionId', UserController.revokeSession);

module.exports = router;
import express from 'express';
import { 
  getAllUsers, 
  addUser, 
  deleteUser,
  getUserByAuthUsername 
} from '../services/userService.js';

const router = express.Router();

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

// Get user by auth username
router.get('/:authUsername', async (req, res, next) => {
  try {
    const user = await getUserByAuthUsername(req.params.authUsername);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// Add new user
router.post('/', async (req, res, next) => {
  try {
    const { authUsername, username, password, domain } = req.body;
    
    if (!authUsername || !username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: authUsername, username, password' 
      });
    }

    const result = await addUser({ authUsername, username, password, domain });
    res.status(201).json({ 
      success: true, 
      message: 'User added successfully',
      user: result 
    });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/:authUsername', async (req, res, next) => {
  try {
    await deleteUser(req.params.authUsername);
    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

export default router;


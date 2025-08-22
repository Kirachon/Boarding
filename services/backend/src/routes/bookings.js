/**
 * Bookings Routes
 * CRUD operations for booking management
 */

const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Placeholder routes - will be implemented in Core API Endpoints task
router.get('/', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), (req, res) => {
  res.json({ message: 'Bookings API - Coming soon' });
});

router.get('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), (req, res) => {
  res.json({ message: 'Get booking by ID - Coming soon' });
});

router.post('/', auth.authorize(['super_admin', 'house_owner', 'house_manager']), (req, res) => {
  res.json({ message: 'Create booking - Coming soon' });
});

router.put('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager']), (req, res) => {
  res.json({ message: 'Update booking - Coming soon' });
});

router.delete('/:id', auth.authorize(['super_admin', 'house_owner']), (req, res) => {
  res.json({ message: 'Delete booking - Coming soon' });
});

module.exports = router;

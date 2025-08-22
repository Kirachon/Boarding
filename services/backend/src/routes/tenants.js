/**
 * Tenants Routes
 * CRUD operations for tenant management
 */

const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Placeholder routes - will be implemented in Core API Endpoints task
router.get('/', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), (req, res) => {
  res.json({ message: 'Tenants API - Coming soon' });
});

router.get('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager', 'house_viewer']), (req, res) => {
  res.json({ message: 'Get tenant by ID - Coming soon' });
});

router.post('/', auth.authorize(['super_admin', 'house_owner', 'house_manager']), (req, res) => {
  res.json({ message: 'Create tenant - Coming soon' });
});

router.put('/:id', auth.authorize(['super_admin', 'house_owner', 'house_manager']), (req, res) => {
  res.json({ message: 'Update tenant - Coming soon' });
});

router.delete('/:id', auth.authorize(['super_admin', 'house_owner']), (req, res) => {
  res.json({ message: 'Delete tenant - Coming soon' });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { protectBranch } = require('../../middleware/protectBranch');

const generateInvoiceNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${random}`;
};

// GET all invoices
router.get('/', protectBranch, async (req, res) => {
  try {
    const invoices = await Invoice.find({ branch: req.branch._id }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CREATE invoice
router.post('/', protectBranch, async (req, res) => {
  try {
    const { customerName, items, tax } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ message: 'Customer name and items are required' });
    }

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = (subtotal * (tax || 0)) / 100;
    const totalAmount = subtotal + taxAmount;

    const invoice = await Invoice.create({
      branch: req.branch._id,
      invoiceNumber: generateInvoiceNumber(),
      customerName,
      items,
      tax: tax || 0,
      subtotal,
      totalAmount,
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET single invoice
router.get('/:id', protectBranch, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      branch: req.branch._id,
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
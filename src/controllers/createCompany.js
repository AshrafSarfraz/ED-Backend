const Partner = require('../models/becomePartner');
const Company = require('../models/createCompany');
const generateTempPassword = require('../utils/generatePassword');
const {
  sendNewRequestConfirmation,
  sendAdminNewRequestNotification,
  sendApprovalEmail,
  sendRejectionEmail,
} = require('../utils/sendEmail');

// POST /api/becomePartner — New request
exports.createPartner = async (req, res) => {
  try {
    const partner = await Partner.create(req.body);

    // User ko confirmation + Admin ko notification
    await sendNewRequestConfirmation({
      toEmail: partner.email,
      brandName: partner.brandName,
    });

    await sendAdminNewRequestNotification({
      brandName: partner.brandName,
      email: partner.email,
      phone: partner.phone,
      businessType: partner.businessType,
      accountType: partner.accountType,
    });

    res.status(201).json({ success: true, data: partner });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field === 'email' ? 'Email' : 'Trade License Number'} already registered`,
      });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/becomePartner/:id/status — Approved / Rejected
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['New Request', 'Approved', 'Rejected'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const partner = await Partner.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (status === 'Approved') {
      const existing = await Company.findOne({ partnerId: partner._id });
      if (!existing) {
        const tempPassword = generateTempPassword();
        await Company.create({
          partnerId: partner._id,
          brandName: partner.brandName,
          email: partner.email,
          phone: partner.phone,
          tradeLicenseNumber: partner.tradeLicenseNumber,
          accountType: partner.accountType,
          businessType: partner.businessType,
          password: tempPassword,
        });
        await sendApprovalEmail({
          toEmail: partner.email,
          brandName: partner.brandName,
          tempPassword,
        });
      }
    }

    if (status === 'Rejected') {
      await sendRejectionEmail({
        toEmail: partner.email,
        brandName: partner.brandName,
      });
    }

    res.json({ success: true, data: partner });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
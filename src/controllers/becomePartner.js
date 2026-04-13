const Partner = require("../models/becomePartner");
const Company = require("../models/createCompany");
const bcrypt = require("bcryptjs");
const generateTempPassword = require("../utils/generatePassword");
const {
  sendNewRequestConfirmation,
  sendAdminNewRequestNotification,
  sendApprovalEmail,
  sendRejectionEmail,
} = require("../utils/sendEmail");


exports.createPartner = async (req, res) => {
  try {
    const partner = await Partner.create(req.body);
    await sendNewRequestConfirmation({
      toEmail: partner.email,
      brandName: partner.brandName,
    });
    await sendAdminNewRequestNotification({
      firstName:partner.firstName,
      lastName:partner.lastName,
      numberOfBranches:partner.numberOfBranches,
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
      return res
        .status(400)
        .json({
          success: false,
          message: `${
            field === "email" ? "Email" : "Trade License Number"
          } already registered`,
        });
    }
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: messages.join(", ") });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllPartners = async (req, res) => {
  try {
    const { status, accountType, businessType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (accountType) filter.accountType = accountType;
    if (businessType) filter.businessType = businessType;
    const skip = (page - 1) * limit;
    const total = await Partner.countDocuments(filter);
    const partners = await Partner.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: partners,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getPartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner)
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    res.json({ success: true, data: partner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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
      { returnDocument: 'after' }
    );
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    console.log('Status updated:', status, '| Partner:', partner.email);

    if (status === 'Approved') {
      const existing = await Company.findOne({ partnerId: partner._id });
      console.log('Existing company:', existing ? 'Found' : 'Not found');

      if (!existing) {
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        console.log('Creating company...');

        await Company.create({
          partnerId: partner._id,
          brandName: partner.brandName,
          firstName: partner.firstName,
          lastName: partner.lastName,
          email: partner.email,
          phone: partner.phone,
          businessType: partner.businessType,
          accountType: partner.accountType,
          numberOfBranches: partner.numberOfBranches,
          roleInBusiness: partner.roleInBusiness,
          tradeLicenseNumber: partner.tradeLicenseNumber,
          password: hashedPassword, // ✅ hashed stored in DB
        });

        console.log('Company created ✅');

        await sendApprovalEmail({
          toEmail: partner.email,
          brandName: partner.brandName,
          tempPassword, // ✅ plain text sent in email
          partnerData: partner,
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

exports.updatePartner = async (req, res) => {
  try {
    const partner = await Partner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!partner)
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    res.json({ success: true, data: partner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner)
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    res.json({ success: true, message: "Partner deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

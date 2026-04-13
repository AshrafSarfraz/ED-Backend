const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    console.log('✅ Email sent to:', to, '| ID:', info.messageId);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
  }
};

// ─── Company Emails ───────────────────────────────────────

const sendNewRequestConfirmation = async ({ toEmail, brandName }) => {
  await sendMail({
    to: toEmail,
    subject: 'We received your request — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#1a1a1a;margin-top:0;">Request Received! ✅</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
          <p style="color:#444;font-size:15px;">We have received your partner request. Our team will review it and get back to you soon.</p>
          <p style="color:#999;font-size:13px;margin-top:32px;">Questions? Contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

const sendAdminNewRequestNotification = async ({ brandName, email, phone, businessType, accountType, numberOfBranches, firstName, lastName }) => {
  await sendMail({
    to: process.env.EMAIL_USER,
    subject: `New Partner Request — ${brandName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#1a1a1a;margin-top:0;">New Partner Request 🔔</h2>
          <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
            <p style="margin:4px 0;font-size:15px;"><strong>First Name:</strong> ${firstName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Last Name:</strong> ${lastName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Brand:</strong> ${brandName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Number of Branches:</strong> ${numberOfBranches}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${email}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Phone:</strong> ${phone}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Business Type:</strong> ${businessType}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Join As:</strong> ${accountType}</p>
          </div>
          <p style="color:#555;font-size:14px;">Login to admin panel to review this request.</p>
        </div>
      </div>`,
  });
};

const sendApprovalEmail = async ({ toEmail, brandName, tempPassword, partnerData }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your request has been Approved — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#16a34a;margin-top:0;">Congratulations! You're Approved 🎉</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Your partner request has been approved.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">🔐 Login Credentials</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Temporary Password:</strong>
              <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
            </p>
            <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after first login.</p>
          </div>
          <a href="https://eldistributor.com/login"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;">
            Login to Your Account →
          </a>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

const sendRejectionEmail = async ({ toEmail, brandName }) => {
  await sendMail({
    to: toEmail,
    subject: 'Update on your request — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#dc2626;margin-top:0;">Request Not Approved</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
          <p style="color:#444;font-size:15px;">We regret to inform you that your partner request has not been approved at this time.</p>
          <p style="color:#444;font-size:15px;">If you have any questions, feel free to contact us.</p>
          <p style="color:#999;font-size:13px;margin-top:32px;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your New Password — El Distributor',
    html: `
      <h2>Hello, ${brandName}</h2>
      <p>Your password has been reset. Here is your new temporary password:</p>
      <h3 style="color: #e74c3c;">${tempPassword}</h3>
      <p><strong>Please change your password after logging in.</strong></p>
    `,
  });
};

// ─── Branch Emails ────────────────────────────────────────

// Branch Created — credentials email (sent immediately on creation)
const sendBranchCredentialsEmail = async ({ toEmail, managerName, companyName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your Branch Account Credentials — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#16a34a;margin-top:0;">Branch Account Created ✅</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Your account has been created. Your credentials are below.</p>
           <p style="color:#444;font-size:15px;">Account is currently pending admin approval. </p>
            <p style="color:#444;font-size:15px;">You will receive another email once approved.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">🔐 Login Credentials</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Temporary Password:</strong>
              <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
            </p>
            <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after first login.</p>
          </div>
          <a href="https://eldistributor.com/branch/login"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;">
            Login to Your Branch →
          </a>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

const sendBranchApprovalEmail = async ({ toEmail, managerName, companyName }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your Branch Account is Approved — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#16a34a;margin-top:0;">Branch Approved! 🎉</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Your branch account under <strong>${companyName}</strong> has been approved by admin.</p>
          <p style="color:#444;font-size:15px;">You can now login using the credentials sent to you earlier.</p>
          <a href="https://eldistributor.com/branch/login"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:16px;">
            Login Now →
          </a>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

// Branch Rejected — email
const sendBranchRejectionEmail = async ({ toEmail, managerName, companyName, reason }) => {
  await sendMail({
    to: toEmail,
    subject: 'Update on your Branch Account — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#dc2626;margin-top:0;">Branch Not Approved</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Your branch account under <strong>${companyName}</strong> has not been approved.</p>
          ${reason ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-size:14px;color:#dc2626;"><strong>Reason:</strong> ${reason}</p>
          </div>` : ''}
          <p style="color:#444;font-size:15px;">If you have any questions, please contact your company admin.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

// Branch Forgot Password
const sendBranchForgotPasswordEmail = async ({ toEmail, managerName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your New Password — El Distributor',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#1a1a1a;margin-top:0;">Password Reset</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>New Temporary Password:</strong>
              <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
            </p>
            <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after logging in.</p>
          </div>
          <a href="https://eldistributor.com/branch/login"
             style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
            Login Now →
          </a>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};


// ─── Bidding Emails ───────────────────────────────────────

// Buyer — No supplier found today
const sendNoBidEmail = async ({ toEmail, managerName, itemName, country, dayCount }) => {
  await sendMail({
    to: toEmail,
    subject: `No Supplier Found Today — El Distributor`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#d97706;margin-top:0;">No Supplier Found Today ⚠️</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Unfortunately, no supplier placed a bid for your order today.</p>
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Attempt:</strong> Day ${dayCount} of 3</p>
          </div>
          <p style="color:#444;font-size:15px;">We will automatically retry your order in tomorrow's bidding. No action needed from your side.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

// Buyer — Order cancelled after 3 days
const sendOrderCancelledEmail = async ({ toEmail, managerName, itemName, country }) => {
  await sendMail({
    to: toEmail,
    subject: `Your Order Has Been Cancelled — El Distributor`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#dc2626;margin-top:0;">Order Cancelled ❌</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">We tried to find a supplier for your order for 3 consecutive days, but unfortunately no supplier was available.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
            <p style="margin:4px 0;font-size:15px;color:#dc2626;"><strong>Status:</strong> Cancelled</p>
          </div>
          <p style="color:#444;font-size:15px;">You are welcome to place a new order anytime before 6:00 PM.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

// Buyer — Order won
const sendOrderWonEmail = async ({ toEmail, managerName, itemName, country, quantity, unit, pricePerUnit, totalAmount }) => {
  await sendMail({
    to: toEmail,
    subject: `Your Order Has Been Placed — El Distributor`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
        <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          <h2 style="color:#16a34a;margin-top:0;">Order Placed Successfully 🎉</h2>
          <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
          <p style="color:#444;font-size:15px;">Great news! A supplier has been found for your order and it has been successfully placed.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">📦 Order Details</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Quantity:</strong> ${quantity} ${unit}</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Price per ${unit}:</strong> ${pricePerUnit} QAR</p>
            <p style="margin:4px 0;font-size:15px;"><strong>Total Amount:</strong> ${totalAmount} QAR</p>
          </div>
          <p style="color:#444;font-size:15px;">Your order is now being processed. You will be notified once it is delivered.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
          <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
        </div>
      </div>`,
  });
};

module.exports = {
  sendNewRequestConfirmation,
  sendAdminNewRequestNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendForgotPasswordEmail,
  sendBranchCredentialsEmail,
  sendBranchApprovalEmail,
  sendBranchRejectionEmail,
  sendBranchForgotPasswordEmail,
  
  sendNoBidEmail,
  sendOrderCancelledEmail,
  sendOrderWonEmail,
};




// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: Number(process.env.EMAIL_PORT),
//   secure: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// const sendMail = async ({ to, subject, html }) => {
//   try {
//     const info = await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
//     console.log('✅ Email sent to:', to, '| ID:', info.messageId);
//   } catch (err) {
//     console.error('❌ Email failed:', err.message);
//   }
// };

// // 1. New request — user confirmation
// const sendNewRequestConfirmation = async ({ toEmail, brandName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'We received your request — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#1a1a1a;margin-top:0;">Request Received! ✅</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">We have received your partner request. Our team will review it and get back to you soon.</p>
//           <p style="color:#999;font-size:13px;margin-top:32px;">Questions? Contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// // 2. New request — admin  notification
// const sendAdminNewRequestNotification = async ({ brandName, email, phone, businessType, accountType,numberOfBranches,firstName,lastName }) => {
//   await sendMail({
//     to: process.env.EMAIL_USER,
//     subject: `New Partner Request — ${brandName}`,
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#1a1a1a;margin-top:0;">New Partner Request 🔔</h2>
//           <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
//             <p style="margin:4px 0;font-size:15px;"><strong>First Name:</strong> ${firstName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Last Name:</strong> ${lastName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Brand:</strong> ${brandName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Number of Branches:</strong> ${numberOfBranches}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${email}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Phone:</strong> ${phone}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Business Type:</strong> ${businessType}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Join As:</strong> ${accountType}</p>
//           </div>
//           <p style="color:#555;font-size:14px;">Login to admin panel to review this request.</p>
//         </div>
//       </div>`,
//   });
// };

// // 3. Approved — user approval + credentials
// const sendApprovalEmail = async ({ toEmail, brandName, tempPassword, partnerData }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your request has been Approved — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
          
//           <h2 style="color:#16a34a;margin-top:0;">Congratulations! You're Approved 🎉</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your partner request has been approved. Your account has been created successfully.</p>

//           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">🔐 Login Credentials</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Temporary Password:</strong> 
//               <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
//             </p>
//             <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after first login.</p>
//           </div>

//           <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#1a1a1a;">📋 Account Details</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Brand Name:</strong> ${partnerData.brandName}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Name:</strong> ${partnerData.firstName} ${partnerData.lastName}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Phone:</strong> ${partnerData.phone}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Business Type:</strong> ${partnerData.businessType}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Join As:</strong> ${partnerData.accountType}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Trade License:</strong> ${partnerData.tradeLicenseNumber}</p>
//             <p style="margin:4px 0;font-size:14px;"><strong>Branches:</strong> ${partnerData.numberOfBranches}</p>
//           </div>

//           <a href="https://eldistributor.com/login" 
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;">
//             Login to Your Account →
//           </a>

//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? Contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// // 4. Rejected — user rejected
// const sendRejectionEmail = async ({ toEmail, brandName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Update on your request — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#dc2626;margin-top:0;">Request Not Approved</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">We regret to inform you that your partner request has not been approved at this time.</p>
//           <p style="color:#444;font-size:15px;">If you have any questions, feel free to contact us.</p>
//           <p style="color:#999;font-size:13px;margin-top:32px;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });};


// // Forget Password 
// const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
//   await transporter.sendMail({
//     from: process.env.EMAIL_FROM,
//     to: toEmail,
//     subject: "Your New Password",
//     html: `
//       <h2>Hello, ${brandName}</h2>
//       <p>Your password has been reset. Here is your new temporary password:</p>
//       <h3 style="color: #e74c3c;">${tempPassword}</h3>
//       <p><strong>Please change your password after logging in.</strong></p>
//     `,
//   });
// };






// module.exports = {
//   sendNewRequestConfirmation,
//   sendAdminNewRequestNotification,
//   sendApprovalEmail,
//   sendRejectionEmail,
//   sendForgotPasswordEmail,
// };
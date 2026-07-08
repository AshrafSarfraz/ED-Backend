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


// // ─── Company Emails ───────────────────────────────────────

// const sendAdminCredentialsEmail = async ({ toEmail, name, password, role }) => {
//   await transporter.sendMail({
//     from:    process.env.EMAIL_FROM,
//     to:      toEmail,
//     subject: "El Distributor Admin — Login Credentials",
//     html: `
//       <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
//         <h2>Welcome to El Distributor Admin Panel</h2>
//         <p>Hello <strong>${name}</strong>,</p>
//         <p>Your account has been created with role: <strong>${role.toUpperCase()}</strong></p>
//         <hr/>
//         <p><strong>Email:</strong> ${toEmail}</p>
//         <p><strong>Password:</strong> ${password}</p>
//         <hr/>
//         <p>Please login and change your password immediately.</p>
//         <p style="color: red;">Do not share these credentials with anyone.</p>
//       </div>
//     `,
//   });
// };



// // ─── Company Emails ───────────────────────────────────────

// const sendNewRequestConfirmation = async ({ toEmail, brandName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'We received your request — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#F15A21;margin-top:0;">Request Received! ✅</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">We have received your partner request. Our team will review it and get back to you soon.</p>
//           <p style="color:#999;font-size:13px;margin-top:32px;">Questions? Contact us at <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// const sendAdminNewRequestNotification = async ({ brandName, email, phone, businessType, accountType, numberOfBranches, firstName, lastName }) => {
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

// const sendApprovalEmail = async ({ toEmail, brandName, tempPassword, partnerData }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your request has been Approved — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#16a34a;margin-top:0;">Congratulations! You're Approved 🎉</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your partner request has been approved.</p>
//           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">🔐 Login Credentials</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Temporary Password:</strong>
//               <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
//             </p>
//             <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after first login.</p>
//           </div>
//           <a href="https://eldistributor.com/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;">
//             Login to Your Account →
//           </a>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

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
//   });
// };

// const sendCompanyDocumentEmail = async ({ toEmail, brandName, action, reason }) => {
//   let subject, html;

//   if (action === "approved") {
//     subject = "Documents Approved — El Distributor";
//     html = `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#16a34a;margin-top:0;">Documents Approved! ✅</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your documents have been verified and approved.</p>
//           <p style="color:#444;font-size:15px;">You can now login and start adding your branches.</p>
//           <a href="https://eldistributor.com/company/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
//             Login Now →
//           </a>
//         </div>
//       </div>`;
//   } else {
//     subject = "Documents Not Approved — El Distributor";
//     html = `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#dc2626;margin-top:0;">Documents Not Approved ❌</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your documents were not approved.</p>
//           ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
//             <p style="margin:0;font-size:14px;color:#dc2626;"><strong>Reason:</strong> ${reason}</p>
//           </div>` : ""}
//           <p style="color:#444;font-size:15px;">Please login and re-upload your documents.</p>
//           <a href="https://eldistributor.com/company/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
//             Login & Re-upload →
//           </a>
//         </div>
//       </div>`;
//   }

//   await transporter.sendMail({
//     from: process.env.EMAIL_FROM,
//     to:   toEmail,
//     subject,
//     html,
//   });
// };


// const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
//   await transporter.sendMail({
//     from: process.env.EMAIL_FROM,
//     to: toEmail,
//     subject: 'Your New Password — El Distributor',
//     html: `
//       <h2>Hello, ${brandName}</h2>
//       <p>Your password has been reset. Here is your new temporary password:</p>
//       <h3 style="color: #e74c3c;">${tempPassword}</h3>
//       <p><strong>Please change your password after logging in.</strong></p>
//     `,
//   });
// };

// // ─── Branch Emails ────────────────────────────────────────

// // Branch Created — credentials email (sent immediately on creation)
// const sendBranchCredentialsEmail = async ({ toEmail, managerName, companyName, tempPassword }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your Branch Account Credentials — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#16a34a;margin-top:0;">Branch Account Created ✅</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your account has been created. Your credentials are below.</p>
//            <p style="color:#444;font-size:15px;">Account is currently pending admin approval. </p>
//             <p style="color:#444;font-size:15px;">You will receive another email once approved.</p>
//           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">🔐 Login Credentials</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Temporary Password:</strong>
//               <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
//             </p>
//             <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after first login.</p>
//           </div>
//           <a href="https://eldistributor.com/branch/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;">
//             Login to Your Branch →
//           </a>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// const sendBranchApprovalEmail = async ({ toEmail, managerName, companyName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your Branch Account is Approved — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#16a34a;margin-top:0;">Branch Approved! 🎉</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your branch account under <strong>${companyName}</strong> has been approved by admin.</p>
//           <p style="color:#444;font-size:15px;">You can now login using the credentials sent to you earlier.</p>
//           <a href="https://eldistributor.com/branch/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:16px;">
//             Login Now →
//           </a>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// // Branch Rejected — email
// const sendBranchRejectionEmail = async ({ toEmail, managerName, companyName, reason }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Update on your Branch Account — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#dc2626;margin-top:0;">Branch Not Approved</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your branch account under <strong>${companyName}</strong> has not been approved.</p>
//           ${reason ? `
//           <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
//             <p style="margin:0;font-size:14px;color:#dc2626;"><strong>Reason:</strong> ${reason}</p>
//           </div>` : ''}
//           <p style="color:#444;font-size:15px;">If you have any questions, please contact your company admin.</p>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// // Branch Forgot Password
// const sendBranchForgotPasswordEmail = async ({ toEmail, managerName, tempPassword }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your New Password — El Distributor',
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#1a1a1a;margin-top:0;">Password Reset</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
//           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:4px 0;font-size:15px;"><strong>Email:</strong> ${toEmail}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>New Temporary Password:</strong>
//               <span style="background:#e2e8f0;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</span>
//             </p>
//             <p style="margin:12px 0 0;font-size:13px;color:#e53e3e;">⚠️ Please change your password after logging in.</p>
//           </div>
//           <a href="https://eldistributor.com/branch/login"
//              style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
//             Login Now →
//           </a>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;"><a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };


// // ─── Bidding Emails ───────────────────────────────────────

// // Buyer — No supplier found today
// const sendNoBidEmail = async ({ toEmail, managerName, itemName, country, dayCount }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `No Supplier Found Today — El Distributor`,
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#d97706;margin-top:0;">No Supplier Found Today ⚠️</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Unfortunately, no supplier placed a bid for your order today.</p>
//           <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Attempt:</strong> Day ${dayCount} of 3</p>
//           </div>
//           <p style="color:#444;font-size:15px;">We will automatically retry your order in tomorrow's bidding. No action needed from your side.</p>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// // Buyer — Order cancelled after 3 days
// const sendOrderCancelledEmail = async ({ toEmail, managerName, itemName, country }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `No Supplier Found — Order Cancelled — El Distributor`,
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#dc2626;margin-top:0;">No Supplier Found ❌</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">No supplier was found for your order today, so it has been cancelled.</p>
//           <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
//             <p style="margin:4px 0;font-size:15px;color:#dc2626;"><strong>Status:</strong> Cancelled</p>
//           </div>
//           <p style="color:#444;font-size:15px;">Please place your order again. Your PDC limit has been released.</p>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };
 

// // Buyer — Order won
// const sendOrderWonEmail = async ({ toEmail, managerName, itemName, country, quantity, unit, pricePerUnit, totalAmount }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `Your Order Has Been Placed — El Distributor`,
//     html: `
//       <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9f9f9;">
//         <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;">
//           <h2 style="color:#16a34a;margin-top:0;">Order Placed Successfully 🎉</h2>
//           <p style="color:#444;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//           <p style="color:#444;font-size:15px;">Great news! A supplier has been found for your order and it has been successfully placed.</p>
//           <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
//             <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#15803d;">📦 Order Details</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Item:</strong> ${itemName}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Country:</strong> ${country}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Quantity:</strong> ${quantity} ${unit}</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Price per ${unit}:</strong> ${pricePerUnit} QAR</p>
//             <p style="margin:4px 0;font-size:15px;"><strong>Total Amount:</strong> ${totalAmount} QAR</p>
//           </div>
//           <p style="color:#444;font-size:15px;">Your order is now being processed. You will be notified once it is delivered.</p>
//           <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
//           <p style="color:#999;font-size:12px;margin:0;">Need help? <a href="mailto:${process.env.EMAIL_USER}" style="color:#555;">${process.env.EMAIL_USER}</a></p>
//         </div>
//       </div>`,
//   });
// };

// module.exports = {
//   sendAdminCredentialsEmail,
//   sendNewRequestConfirmation,
//   sendAdminNewRequestNotification,
//   sendApprovalEmail,
//   sendRejectionEmail,
//   sendForgotPasswordEmail,
//   sendBranchCredentialsEmail,
//   sendBranchApprovalEmail,
//   sendBranchRejectionEmail,
//   sendBranchForgotPasswordEmail,
  
//   sendNoBidEmail,
//   sendOrderCancelledEmail,
//   sendOrderWonEmail,
//   sendCompanyDocumentEmail,
// };



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

// ─── Shared Components ────────────────────────────────────

const emailWrapper = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#F5E6E1;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #F15A21;">
      <div style="margin-bottom:24px;">
        <span style="font-size:22px;font-weight:800;color:#F15A21;letter-spacing:0.5px;">EL Distributor</span>
      </div>
      ${content}
      <hr style="border:none;border-top:1px solid #F5E6E1;margin:32px 0;" />
      <p style="color:#888;font-size:12px;margin:0;">
        Need help? Contact us at 
        <a href="mailto:support@eldistributor.com" style="color:#F15A21;">support@eldistributor.com</a>
      </p>
    </div>
  </div>
`;

// ─── Admin Emails ─────────────────────────────────────────

const sendAdminCredentialsEmail = async ({ toEmail, name, password, role }) => {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: "EL Distributor Admin — Login Credentials",
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">Welcome to EL Distributor Admin Panel</h2>
      <p style="color:#000000;font-size:15px;">Hello <strong>${name}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your account has been created with role: <strong style="color:#F15A21;">${role.toUpperCase()}</strong></p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Password:</strong> ${password}</p>
      </div>
      <p style="color:#000000;font-size:14px;">Please login and change your password immediately.</p>
      <p style="color:#FF2526;font-size:13px;">Do not share these credentials with anyone.</p>
    `),
  });
};

// ─── Company Emails ───────────────────────────────────────

const sendNewRequestConfirmation = async ({ toEmail, brandName }) => {
  await sendMail({
    to: toEmail,
    subject: 'We received your request — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Request Received!</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">We have received your partner request. Our team will review it and get back to you soon.</p>
    `),
  });
};

const sendAdminNewRequestNotification = async ({ brandName, email, phone, businessType, accountType, numberOfBranches, firstName, lastName }) => {
  await sendMail({
    to: process.env.EMAIL_USER,
    subject: `New Partner Request — ${brandName}`,
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">New Partner Request</h2>
      <div style="background:#F5E6E1;border-radius:8px;padding:20px;margin:16px 0;">
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>First Name:</strong> ${firstName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Last Name:</strong> ${lastName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Brand:</strong> ${brandName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Number of Branches:</strong> ${numberOfBranches}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${email}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Phone:</strong> ${phone}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Business Type:</strong> ${businessType}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Join As:</strong> ${accountType}</p>
      </div>
      <p style="color:#000000;font-size:14px;">Login to admin panel to review this request.</p>
    `),
  });
};

const sendApprovalEmail = async ({ toEmail, brandName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your request has been Approved — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Congratulations! You're Approved</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your partner request has been approved.</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong>
          <span style="background:#F5E6E1;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
      </div>
      <a href="https://eldistributor.com/login"
         style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;font-weight:700;">
        Login to Your Account →
      </a>
    `),
  });
};

const sendRejectionEmail = async ({ toEmail, brandName }) => {
  await sendMail({
    to: toEmail,
    subject: 'Update on your request — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#FF2526;margin-top:0;">Request Not Approved</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">We regret to inform you that your partner request has not been approved at this time.</p>
      <p style="color:#000000;font-size:15px;">If you have any questions, feel free to contact us.</p>
    `),
  });
};

const sendCompanyDocumentEmail = async ({ toEmail, brandName, action, reason }) => {
  const approved = action === "approved";
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to:   toEmail,
    subject: approved ? "Documents Approved — EL Distributor" : "Documents Not Approved — EL Distributor",
    html: emailWrapper(approved ? `
      <h2 style="color:#F15A21;margin-top:0;">Documents Approved!</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your documents have been verified and approved.</p>
      <p style="color:#000000;font-size:15px;">You can now login and start adding your branches.</p>
      <a href="https://company.eldistributor.com/"
         style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:700;">
        Login Now →
      </a>
    ` : `
      <h2 style="color:#FF2526;margin-top:0;">Documents Not Approved</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your documents were not approved.</p>
      ${reason ? `
      <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
      </div>` : ""}
      <p style="color:#000000;font-size:15px;">Please login and re-upload your documents.</p>
      <a href=https://company.eldistributor.com/"
         style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:700;">
        Login & Re-upload →
      </a>
    `),
  });
};

const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your New Password — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">Password Reset</h2>
      <p style="color:#000000;font-size:15px;">Hello <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;font-size:15px;color:#F15A21;font-family:monospace;font-size:18px;font-weight:800;">${tempPassword}</p>
      </div>
      <p style="color:#FF2526;font-size:14px;">Please change your password after logging in.</p>
    `),
  });
};

// ─── Branch Emails ────────────────────────────────────────

const sendBranchCredentialsEmail = async ({ toEmail, managerName, companyName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your Branch Account Credentials — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Branch Account Created</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your account has been created. Your credentials are below.</p>
      <p style="color:#000000;font-size:15px;">Account is currently pending admin approval. You will receive another email once approved.</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong>
          <span style="background:#FFFFFF;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
      </div>
   
    `),
  });
};

const sendBranchApprovalEmail = async ({ toEmail, managerName, companyName }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your Branch Account is Approved — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Branch Approved!</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your branch account under <strong>${companyName}</strong> has been approved by admin.</p>
      <p style="color:#000000;font-size:15px;">You can now login using the credentials sent to you earlier.</p>
    `),
  });
};

const sendBranchRejectionEmail = async ({ toEmail, managerName, companyName, reason }) => {
  await sendMail({
    to: toEmail,
    subject: 'Update on your Branch Account — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#FF2526;margin-top:0;">Branch Not Approved</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your branch account under <strong>${companyName}</strong> has not been approved.</p>
      ${reason ? `
      <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
      </div>` : ''}
      <p style="color:#000000;font-size:15px;">If you have any questions, please contact your company admin.</p>
    `),
  });
};

const sendBranchForgotPasswordEmail = async ({ toEmail, managerName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your New Password — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">Password Reset</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>New Temporary Password:</strong>
          <span style="background:#FFFFFF;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after login in mobile Application</p>
      </div>
    `),
  });
};

// ─── Bidding Emails ───────────────────────────────────────

const sendNoBidEmail = async ({ toEmail, managerName, itemName, country, dayCount }) => {
  await sendMail({
    to: toEmail,
    subject: `No Supplier Found Today — EL Distributor`,
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">No Supplier Found Today</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Unfortunately, no supplier placed a bid for your order today.</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Attempt:</strong> Day ${dayCount} of 3</p>
      </div>
      <p style="color:#000000;font-size:15px;">We will automatically retry your order in tomorrow's bidding. No action needed from your side.</p>
    `),
  });
};

const sendOrderCancelledEmail = async ({ toEmail, managerName, itemName, country }) => {
  await sendMail({
    to: toEmail,
    subject: `No Supplier Found — Order Cancelled — EL Distributor`,
    html: emailWrapper(`
      <h2 style="color:#FF2526;margin-top:0;">No Supplier Found — Order Cancelled</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">No supplier was found for your order, so it has been cancelled.</p>
      <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
        <p style="margin:4px 0;font-size:15px;color:#FF2526;"><strong>Status:</strong> Cancelled</p>
      </div>
      <p style="color:#000000;font-size:15px;">Please place your order again. Your PDC limit has been released.</p>
    `),
  });
};

const sendOrderWonEmail = async ({ toEmail, managerName, itemName, country, quantity, unit, pricePerUnit, totalAmount }) => {
  await sendMail({
    to: toEmail,
    subject: `Your Order Has Been Placed — EL Distributor`,
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Order Placed Successfully</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">A supplier has been found for your order and it has been successfully placed.</p>
      <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Order Details</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Quantity:</strong> ${quantity} ${unit}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Price per ${unit}:</strong> ${pricePerUnit} QAR</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Total Amount:</strong> ${totalAmount} QAR</p>
      </div>
      <p style="color:#000000;font-size:15px;">Your order is now being processed. You will be notified once it is delivered.</p>
    `),
  });
};

module.exports = {
  sendAdminCredentialsEmail,
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
  sendCompanyDocumentEmail,
};

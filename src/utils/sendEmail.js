


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

// // ─── Shared Components ────────────────────────────────────

// const emailWrapper = (content) => `
//   <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#F5E6E1;">
//     <div style="background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #F15A21;">
//       <div style="margin-bottom:24px;">
//         <span style="font-size:22px;font-weight:800;color:#F15A21;letter-spacing:0.5px;">EL Distributor</span>
//       </div>
//       ${content}
//       <hr style="border:none;border-top:1px solid #F5E6E1;margin:32px 0;" />
//       <p style="color:#888;font-size:12px;margin:0;">
//         Need help? Contact us at 
//         <a href="mailto:support@eldistributor.com" style="color:#F15A21;">support@eldistributor.com</a>
//       </p>
//     </div>
//   </div>
// `;

// // ─── Admin Emails ─────────────────────────────────────────

// const sendAdminCredentialsEmail = async ({ toEmail, name, password, role }) => {
//   await transporter.sendMail({
//     from:    process.env.EMAIL_FROM,
//     to:      toEmail,
//     subject: "EL Distributor Admin — Login Credentials",
//     html: emailWrapper(`
//       <h2 style="color:#000000;margin-top:0;">Welcome to EL Distributor Admin Panel</h2>
//       <p style="color:#000000;font-size:15px;">Hello <strong>${name}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your account has been created with role: <strong style="color:#F15A21;">${role.toUpperCase()}</strong></p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Password:</strong> ${password}</p>
//       </div>
//       <p style="color:#000000;font-size:14px;">Please login and change your password immediately.</p>
//       <p style="color:#FF2526;font-size:13px;">Do not share these credentials with anyone.</p>
//     `),
//   });
// };

// // ─── Company Emails ───────────────────────────────────────

// const sendNewRequestConfirmation = async ({ toEmail, brandName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'We received your request — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">Request Received!</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">We have received your partner request. Our team will review it and get back to you soon.</p>
//     `),
//   });
// };

// const sendAdminNewRequestNotification = async ({ brandName, email, phone, businessType, accountType, numberOfBranches, firstName, lastName }) => {
//   await sendMail({
//     to: process.env.EMAIL_USER,
//     subject: `New Partner Request — ${brandName}`,
//     html: emailWrapper(`
//       <h2 style="color:#000000;margin-top:0;">New Partner Request</h2>
//       <div style="background:#F5E6E1;border-radius:8px;padding:20px;margin:16px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>First Name:</strong> ${firstName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Last Name:</strong> ${lastName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Brand:</strong> ${brandName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Number of Branches:</strong> ${numberOfBranches}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${email}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Phone:</strong> ${phone}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Business Type:</strong> ${businessType}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Join As:</strong> ${accountType}</p>
//       </div>
//       <p style="color:#000000;font-size:14px;">Login to admin panel to review this request.</p>
//     `),
//   });
// };

// const sendApprovalEmail = async ({ toEmail, brandName, tempPassword }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your request has been Approved — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">Congratulations! You're Approved</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your partner request has been approved.</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong>
//           <span style="background:#F5E6E1;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
//         </p>
//         <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
//       </div>
//       <a href="https://company.eldistributor.com/"
//          style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin-top:8px;font-weight:700;">
//         Login to Your Account →
//       </a>
//     `),
//   });
// };

// const sendRejectionEmail = async ({ toEmail, brandName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Update on your request — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#FF2526;margin-top:0;">Request Not Approved</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">We regret to inform you that your partner request has not been approved at this time.</p>
//       <p style="color:#000000;font-size:15px;">If you have any questions, feel free to contact us.</p>
//     `),
//   });
// };

// const sendCompanyDocumentEmail = async ({ toEmail, brandName, action, reason }) => {
//   const approved = action === "approved";
//   await transporter.sendMail({
//     from: process.env.EMAIL_FROM,
//     to:   toEmail,
//     subject: approved ? "Documents Approved — EL Distributor" : "Documents Not Approved — EL Distributor",
//     html: emailWrapper(approved ? `
//       <h2 style="color:#F15A21;margin-top:0;">Documents Approved!</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your documents have been verified and approved.</p>
//       <p style="color:#000000;font-size:15px;">You can now login and start adding your branches.</p>
//       <a href="https://company.eldistributor.com/"
//          style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:700;">
//         Login Now →
//       </a>
//     ` : `
//       <h2 style="color:#FF2526;margin-top:0;">Documents Not Approved</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your documents were not approved.</p>
//       ${reason ? `
//       <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:16px;margin:16px 0;">
//         <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
//       </div>` : ""}
//       <p style="color:#000000;font-size:15px;">Please login and re-upload your documents.</p>
//       <a href=https://company.eldistributor.com/"
//          style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:700;">
//         Login & Re-upload →
//       </a>
//     `),
//   });
// };

// const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
//   await transporter.sendMail({
//     from: process.env.EMAIL_FROM,
//     to: toEmail,
//     subject: 'Your New Password — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#000000;margin-top:0;">Password Reset</h2>
//       <p style="color:#000000;font-size:15px;">Hello <strong>${brandName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#F15A21;font-family:monospace;font-size:18px;font-weight:800;">${tempPassword}</p>
//       </div>
//       <p style="color:#FF2526;font-size:14px;">Please change your password after logging in.</p>
//     `),
//   });
// };

// // ─── Branch Emails ────────────────────────────────────────

// const sendBranchCredentialsEmail = async ({ toEmail, managerName, companyName, tempPassword }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your Branch Account Credentials — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">Branch Account Created</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your account has been created. Your credentials are below.</p>
//       <p style="color:#000000;font-size:15px;">Account is currently pending admin approval. You will receive another email once approved.</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong>
//           <span style="background:#FFFFFF;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
//         </p>
//         <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
//       </div>
   
//     `),
//   });
// };

// const sendBranchApprovalEmail = async ({ toEmail, managerName, companyName }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your Branch Account is Approved — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">Branch Approved!</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your branch account under <strong>${companyName}</strong> has been approved by admin.</p>
//       <p style="color:#000000;font-size:15px;">You can now login using the credentials sent to you earlier.</p>
//     `),
//   });
// };

// const sendBranchRejectionEmail = async ({ toEmail, managerName, companyName, reason }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Update on your Branch Account — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#FF2526;margin-top:0;">Branch Not Approved</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your branch account under <strong>${companyName}</strong> has not been approved.</p>
//       ${reason ? `
//       <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:16px;margin:16px 0;">
//         <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
//       </div>` : ''}
//       <p style="color:#000000;font-size:15px;">If you have any questions, please contact your company admin.</p>
//     `),
//   });
// };

// const sendBranchForgotPasswordEmail = async ({ toEmail, managerName, tempPassword }) => {
//   await sendMail({
//     to: toEmail,
//     subject: 'Your New Password — EL Distributor',
//     html: emailWrapper(`
//       <h2 style="color:#000000;margin-top:0;">Password Reset</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>New Temporary Password:</strong>
//           <span style="background:#FFFFFF;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${tempPassword}</span>
//         </p>
//         <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after login in mobile Application</p>
//       </div>
//     `),
//   });
// };

// // ─── Bidding Emails ───────────────────────────────────────

// const sendNoBidEmail = async ({ toEmail, managerName, itemName, country, dayCount }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `No Supplier Found Today — EL Distributor`,
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">No Supplier Found Today</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">Unfortunately, no supplier placed a bid for your order today.</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Attempt:</strong> Day ${dayCount} of 3</p>
//       </div>
//       <p style="color:#000000;font-size:15px;">We will automatically retry your order in tomorrow's bidding. No action needed from your side.</p>
//     `),
//   });
// };

// const sendOrderCancelledEmail = async ({ toEmail, managerName, itemName, country }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `No Supplier Found — Order Cancelled — EL Distributor`,
//     html: emailWrapper(`
//       <h2 style="color:#FF2526;margin-top:0;">No Supplier Found — Order Cancelled</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">No supplier was found for your order, so it has been cancelled.</p>
//       <div style="background:#F5E6E1;border:1px solid #FF2526;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
//         <p style="margin:4px 0;font-size:15px;color:#FF2526;"><strong>Status:</strong> Cancelled</p>
//       </div>
//       <p style="color:#000000;font-size:15px;">Please place your order again. Your PDC limit has been released.</p>
//     `),
//   });
// };

// const sendOrderWonEmail = async ({ toEmail, managerName, itemName, country, quantity, unit, pricePerUnit, totalAmount }) => {
//   await sendMail({
//     to: toEmail,
//     subject: `Your Order Has Been Placed — EL Distributor`,
//     html: emailWrapper(`
//       <h2 style="color:#F15A21;margin-top:0;">Order Placed Successfully</h2>
//       <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
//       <p style="color:#000000;font-size:15px;">A supplier has been found for your order and it has been successfully placed.</p>
//       <div style="background:#F5E6E1;border:1px solid #F15A21;border-radius:8px;padding:20px;margin:20px 0;">
//         <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Order Details</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Item:</strong> ${itemName}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Country:</strong> ${country}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Quantity:</strong> ${quantity} ${unit}</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Price per ${unit}:</strong> ${pricePerUnit} QAR</p>
//         <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Total Amount:</strong> ${totalAmount} QAR</p>
//       </div>
//       <p style="color:#000000;font-size:15px;">Your order is now being processed. You will be notified once it is delivered.</p>
//     `),
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
//  Palette:
//    #F15A21  brand orange   (headings, borders, buttons)
//    #FF2526  red            (rejected / cancelled)
//    #000000  body text
//    #FFFFFF  background     ← koi light orange bg nahi
//    #F9F9F9  neutral fill   (info box / table stripe)
//    #EEEEEE  hairline       (divider / small borders)

const emailWrapper = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#FFFFFF;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;border:1px solid #F15A21;">
      <div style="margin-bottom:24px;">
        <span style="font-size:22px;font-weight:800;color:#F15A21;letter-spacing:0.5px;">EL Distributor</span>
      </div>
      ${content}
      <hr style="border:none;border-top:1px solid #EEEEEE;margin:32px 0;" />
      <p style="color:#888;font-size:12px;margin:0;">
        Need help? Contact us at
        <a href="mailto:support@eldistributor.com" style="color:#F15A21;">support@eldistributor.com</a>
      </p>
    </div>
  </div>
`;

// Info box — neutral fill + accent border
const infoBox = (content, accent = "#F15A21") => `
  <div style="background:#F9F9F9;border:1px solid ${accent};border-radius:8px;padding:20px;margin:20px 0;">
    ${content}
  </div>
`;

// Password / code chip
const chip = (text) => `
  <span style="background:#FFFFFF;border:1px solid #EEEEEE;padding:2px 10px;border-radius:4px;font-family:monospace;font-size:15px;color:#F15A21;">${text}</span>
`;

// Summary table — pehla column left, baaki right aligned
const summaryTable = (headers, rows) => `
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
    <thead>
      <tr style="background:#F15A21;">
        ${headers.map((h, i) => `
          <th style="padding:10px 12px;text-align:${i === 0 ? "left" : "right"};color:#FFFFFF;font-weight:bold;">${h}</th>
        `).join("")}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
`;

// ─── Admin Emails ─────────────────────────────────────────

const sendAdminCredentialsEmail = async ({ toEmail, name, password, role }) => {
  await sendMail({
    to: toEmail,
    subject: "EL Distributor Admin — Login Credentials",
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">Welcome to EL Distributor Admin Panel</h2>
      <p style="color:#000000;font-size:15px;">Hello <strong>${name}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your account has been created with role: <strong style="color:#F15A21;">${role.toUpperCase()}</strong></p>
      ${infoBox(`
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Password:</strong> ${password}</p>
      `)}
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
      ${infoBox(`
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>First Name:</strong> ${firstName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Last Name:</strong> ${lastName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Brand:</strong> ${brandName}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Number of Branches:</strong> ${numberOfBranches}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${email}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Phone:</strong> ${phone}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Business Type:</strong> ${businessType}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Join As:</strong> ${accountType}</p>
      `)}
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
      ${infoBox(`
        <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong> ${chip(tempPassword)}</p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
      `)}
      <a href="https://company.eldistributor.com/"
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
  await sendMail({
    to: toEmail,
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
      ${reason ? infoBox(`
        <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
      `, "#FF2526") : ""}
      <p style="color:#000000;font-size:15px;">Please login and re-upload your documents.</p>
      <a href="https://company.eldistributor.com/"
         style="display:inline-block;background:#F15A21;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:700;">
        Login &amp; Re-upload →
      </a>
    `),
  });
};

const sendForgotPasswordEmail = async ({ toEmail, brandName, tempPassword }) => {
  await sendMail({
    to: toEmail,
    subject: 'Your New Password — EL Distributor',
    html: emailWrapper(`
      <h2 style="color:#000000;margin-top:0;">Password Reset</h2>
      <p style="color:#000000;font-size:15px;">Hello <strong>${brandName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">Your password has been reset. Here is your new temporary password:</p>
      ${infoBox(`
        <p style="margin:4px 0;font-family:monospace;font-size:18px;font-weight:800;color:#F15A21;">${tempPassword}</p>
      `)}
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
      ${infoBox(`
        <p style="margin:0 0 12px;font-weight:bold;font-size:15px;color:#F15A21;">Login Credentials</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Temporary Password:</strong> ${chip(tempPassword)}</p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after first login.</p>
      `)}
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
      ${reason ? infoBox(`
        <p style="margin:0;font-size:14px;color:#FF2526;"><strong>Reason:</strong> ${reason}</p>
      `, "#FF2526") : ''}
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
      ${infoBox(`
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin:4px 0;font-size:15px;color:#000000;"><strong>New Temporary Password:</strong> ${chip(tempPassword)}</p>
        <p style="margin:12px 0 0;font-size:13px;color:#FF2526;">Please change your password after login in mobile Application</p>
      `)}
    `),
  });
};

// ─── Bidding Emails (batched) ─────────────────────────────
//  Winner cron ke END me call hote hain. Buyer ke 10 orders ho to bhi
//  max 2 email jaati hain: ek won ki list, ek cancelled ki list.

//  billNumber — us din ka BILL-B-… (buyer bill). Optional: null ho to email
//  pehle jaisa hi bina bill header ke chala jayega.
const sendOrdersWonSummaryEmail = async ({ toEmail, managerName, orders, billNumber = null }) => {
  const grandTotal = Math.round(orders.reduce((s, o) => s + (o.totalAmount || 0), 0) * 100) / 100;
  const issueDate  = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const rows = orders.map((o, i) => `
    <tr style="background:${i % 2 ? "#FFFFFF" : "#F9F9F9"};">
      <td style="padding:10px 12px;color:#000000;">
        <span style="font-family:monospace;font-size:11px;color:#F15A21;">${o.invoiceNumber || "-"}</span><br />
        <strong>${o.itemName || "-"}</strong><br />
        <span style="color:#888;font-size:12px;">${o.country || "-"}</span>
      </td>
      <td style="padding:10px 12px;text-align:right;color:#000000;">${o.quantity} / ${o.unit || ""}</td>
      <td style="padding:10px 12px;text-align:right;color:#000000;">${o.pricePerUnit} QAR</td>
      <td style="padding:10px 12px;text-align:right;color:#000000;"><strong>${o.totalAmount} QAR</strong></td>
    </tr>
  `).join("");

  // ─── Bill header — is bill number pe aage outstanding statement bhi jaayega ───
  const billHeader = billNumber ? `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #F15A21;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;background:#F9F9F9;">
          <span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Bill Invoice No.</span><br />
          <span style="font-family:monospace;font-size:16px;font-weight:bold;color:#F15A21;">${billNumber}</span>
        </td>
        <td style="padding:14px 16px;background:#F9F9F9;text-align:right;">
          <span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Bill Date</span><br />
          <span style="font-size:14px;font-weight:bold;color:#000000;">${issueDate}</span>
        </td>
      </tr>
    </table>
  ` : "";

  await sendMail({
    to: toEmail,
    subject: billNumber
      ? `Bill ${billNumber} — ${orders.length} Order${orders.length > 1 ? "s" : ""} Placed — EL Distributor`
      : `${orders.length} Order${orders.length > 1 ? "s" : ""} Placed Successfully — EL Distributor`,
    html: emailWrapper(`
      <h2 style="color:#F15A21;margin-top:0;">Orders Placed Successfully</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">
        Suppliers have been found for <strong>${orders.length}</strong>
        of your order${orders.length > 1 ? "s" : ""}. Here is the summary:
      </p>
      ${billHeader}
      ${summaryTable(["Invoice No. / Item", "Quantity", "Unit Price", "Total"], rows)}
      ${infoBox(`
        <p style="margin:0;font-size:16px;color:#000000;">
          <strong>Grand Total:</strong>
          <span style="color:#F15A21;font-weight:bold;">${grandTotal} QAR</span>
        </p>
      `)}
      <p style="color:#000000;font-size:15px;">
        Your orders are now being processed. You will be notified once they are delivered.
      </p>
      ${billNumber ? `
        <p style="color:#888;font-size:12px;">
          Please quote <strong style="color:#F15A21;font-family:monospace;">${billNumber}</strong>
          in all payments and correspondence related to these orders.
        </p>` : ""}
    `),
  });
};

const sendOrdersCancelledSummaryEmail = async ({ toEmail, managerName, orders }) => {
  const rows = orders.map((o, i) => `
    <tr style="background:${i % 2 ? "#FFFFFF" : "#F9F9F9"};">
      <td style="padding:10px 12px;color:#000000;">
        <strong>${o.itemName || "-"}</strong><br />
        <span style="color:#888;font-size:12px;">${o.country || "-"}</span>
      </td>
      <td style="padding:10px 12px;text-align:right;color:#000000;">${o.quantity} / ${o.unit || ""}</td>
      <td style="padding:10px 12px;text-align:right;color:#FF2526;">Cancelled</td>
    </tr>
  `).join("");

  await sendMail({
    to: toEmail,
    subject: `${orders.length} Order${orders.length > 1 ? "s" : ""} Cancelled — No Supplier Found — EL Distributor`,
    html: emailWrapper(`
      <h2 style="color:#FF2526;margin-top:0;">No Supplier Found — Orders Cancelled</h2>
      <p style="color:#000000;font-size:15px;">Dear <strong>${managerName}</strong>,</p>
      <p style="color:#000000;font-size:15px;">
        No supplier placed a bid for the following <strong>${orders.length}</strong>
        order${orders.length > 1 ? "s" : ""}, so they have been cancelled:
      </p>
      ${summaryTable(["Item", "Quantity", "Status"], rows)}
      <p style="color:#000000;font-size:15px;">
        Please place these orders again. Your PDC limit has been released.
      </p>
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
  sendOrdersWonSummaryEmail,
  sendOrdersCancelledSummaryEmail,
  sendCompanyDocumentEmail,
};
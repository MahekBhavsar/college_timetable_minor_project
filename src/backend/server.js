const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json()); 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'mahek.bhavsar29@gmail.com', 
    pass: 'lwqr fiqo ftnr vyhp'    
  }
});

app.post('/send-email', async (req, res) => {
  const { to, subject, studentName, assignmentTitle, type } = req.body;
  let htmlContent = '';

  // 🎨 Email Design 1: Assignment Reminder
  if (type === 'reminder') {
    htmlContent = `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; border: 1px solid #d32f2f; border-radius: 10px;">
        <h2 style="color: #d32f2f;">📅 Assignment Deadline Alert</h2>
        <p>Hi <strong>${studentName}</strong>,</p>
        <p>This is a reminder that your assignment <b>"${assignmentTitle}"</b> is due in <b>3 days</b>.</p>
        <p>Don't forget to upload your work before the deadline.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 11px; color: #888;">BCA Portal - Academic Planner System</p>
      </div>`;
  } 
  // 🎨 Email Design 2: Application Approval
  else if (type === 'approval') {
    htmlContent = `
      <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; border: 1px solid #28a745; border-radius: 10px; background-color: #f8fff9;">
        <h2 style="color: #28a745;">🎉 Application Approved!</h2>
        <p>Hello <strong>${studentName}</strong>,</p>
        <p>Great news! Your application for the <b>BCA Portal</b> has been verified and approved by our staff.</p>
        <p>You can now log in to access your dashboard and view assignments.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 11px; color: #888;">BCA Portal - Official Registration Update</p>
      </div>`;
  }
  // 🎨 Email Design: Assignment Submission Approved
  else if (type === 'submission_approved') {
    htmlContent = `
      <div style="font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Submission Approved! ✨</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #1e293b;">Hello <b>${studentName}</b>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6;">Your submission for the assignment <b>"${assignmentTitle}"</b> has been reviewed and <span style="color: #059669; font-weight: bold;">Approved</span> by your instructor.</p>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">Keep up the great work! You can view your graded assignments and feedback on the portal.</p>
          </div>
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #f1f5f9;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">BCA Portal Academic System • Automated Notification</p>
        </div>
      </div>`;
  }
  // 🎨 Email Design: Assignment Submission Rejected
  else if (type === 'submission_rejected') {
    htmlContent = `
      <div style="font-family: 'Inter', 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Action Required: Submission Rejected</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #1e293b;">Hello <b>${studentName}</b>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6;">Your submission for <b>"${assignmentTitle}"</b> was <span style="color: #dc2626; font-weight: bold;">Rejected</span>. Please review the requirements or feedback provided and re-submit if necessary.</p>
          <div style="background-color: #fff1f2; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 13px; color: #991b1b;">Note: Please ensure your file matches the requested format and content before re-uploading.</p>
          </div>
          <hr style="margin: 30px 0; border: 0; border-top: 1px solid #f1f5f9;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">BCA Portal Academic System • Automated Notification</p>
        </div>
      </div>`;
  }

  const mailOptions = {
    from: '"BCA Portal Admin" <mahek.bhavsar29@gmail.com>', 
    to: to,
    subject: subject,
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).send({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend Server: http://localhost:${PORT}`);
});
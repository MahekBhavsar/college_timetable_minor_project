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
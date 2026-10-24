const nodemailer = require('nodemailer');

//transporter used to communicate with google SMTP SERVER (simple mail transfer protocols)
// Email is optional: without the OAuth variables it is skipped (nothing else breaks).
const emailEnabled = ['EMAIL_USER', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'].every((key) => process.env[key]);

const transporter = emailEnabled ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
}) : null;

if (transporter) {
  // Verify the connection configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('Error connecting to email server:', error);
    } else {
      console.log('Email server is ready to send messages');
    }
  });
} else {
  console.log('Email notifications are disabled (EMAIL_USER / CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN not set)');
}


// Function to send email
const sendEmail = async (to, subject, text, html) => {
  if (!transporter) {
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Banking Transaction" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

//send email when an user create a new account
async function sendingRegistrationEmail(username, name) {
    const subject = 'Welcome to Banking Transaction System';
    const text = `Hello ${name}, \n\nThank you for registering at Banking Transaction System. We're excited to having youn on board!\n\nBest regards, \nThe Backend Transaction System Team`;
    const html = `<p>Hello ${name},</p><p>Thank you for registering at Banking Transaction System. We're excited to having youn on board!</p><p>Best regards,</p><br> The Banking Transaction Sytem Team`

    await sendEmail(username, subject, text, html);
}

//send email when transaction being successfull
async function sendTransactionEmail(userEmail, name, amount, toAccount) {
  const subject = 'Transaction Successfully!'
  const text = `Hello ${name}, \n\nYour transaction of ${amount} to account ${toAccount} was successful,\n\nBest regards,\nThe Backend Transaction System Team`
  const html = `<p>Hello ${name}</p><p>Your transaction of amount ${amount} to account ${toAccount} was successful.</p><p>Best regards, <br>The Backend Transaction System Team </p>`
  
  await sendEmail(userEmail, subject, text, html);
}

//send email when transaction being failed
async function sendTransactionFailureEmail(userEmail, name, amount, toAccount) {
  const subject = 'Transaction Failed'
  const text = `Hello ${name}, \n\nWe regret to inform you that your transaction of amount ${amount} to account ${toAccount} was failed,\n\nBest regards,\nThe Backend Transaction System Team`
  const html = `<p>Hello ${name}</p><p>Your transaction of amount ${amount} to account ${toAccount} was failed.</p><p>Best regards, <br>The Backend Transaction System Team</p>`

  await sendEmail(userEmail, subject, text, html);
}

module.exports = { sendingRegistrationEmail, sendTransactionEmail, sendTransactionFailureEmail };
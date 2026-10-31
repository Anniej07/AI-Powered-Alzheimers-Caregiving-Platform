const nodemailer = require('nodemailer');
const twilio     = require('twilio');
const User       = require('../models/User');
const Alert      = require('../models/Alert');

// ── Nodemailer transporter ────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Twilio client ─────────────────────────────────────────────
const twilioClient = process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
// ─────────────────────────────────────────────────────────────
// Send email
// ─────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to, subject, html,
    });
    return { success: true };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────
// Send SMS
// ─────────────────────────────────────────────────────────────
const sendSMS = async ({ to, body }) => {
  if (!twilioClient) {
    console.log('SMS skipped — Twilio not configured');
    return;
  }
  try {
    await twilioClient.messages.create({      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return { success: true };
  } catch (err) {
    console.error('SMS error:', err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────
// Build alert email HTML
// ─────────────────────────────────────────────────────────────
const buildAlertEmail = (alert, patient, recipient) => `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#2c3e50;padding:20px;text-align:center;">
      <h2 style="color:#fff;margin:0;">🏥 AlzheimerCare Alert</h2>
    </div>
    <div style="padding:30px;">
      <p>Dear ${recipient.name},</p>
      <p>A <strong>${alert.severity.toUpperCase()}</strong> alert has been triggered for your patient:</p>
      <div style="background:#ffeaa7;border-left:4px solid #e17055;padding:15px;border-radius:4px;margin:20px 0;">
        <h3 style="margin:0 0 8px;">${alert.title}</h3>
        <p style="margin:0;">${alert.message}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr><td style="padding:8px;background:#f8f9fa;font-weight:bold;">Patient</td>
            <td style="padding:8px;">${patient.name}</td></tr>
        <tr><td style="padding:8px;background:#f8f9fa;font-weight:bold;">Alert Type</td>
            <td style="padding:8px;">${alert.type.replace(/_/g, ' ')}</td></tr>
        <tr><td style="padding:8px;background:#f8f9fa;font-weight:bold;">Severity</td>
            <td style="padding:8px;">${alert.severity}</td></tr>
        <tr><td style="padding:8px;background:#f8f9fa;font-weight:bold;">Time</td>
            <td style="padding:8px;">${new Date().toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:25px;">Please log in to the platform to review and take action.</p>
    </div>
    <div style="background:#f4f4f4;padding:15px;text-align:center;font-size:12px;color:#999;">
      AlzheimerCare Platform &nbsp;|&nbsp; Automated Alert System
    </div>
  </div>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────
// Core: dispatch alert to all assigned caregivers & doctors
// ─────────────────────────────────────────────────────────────
const sendAlertNotifications = async (alert) => {
  try {
    const patient = await User.findById(alert.patient)
      .populate('assignedCaregivers', 'name email phone notificationPreferences')
      .populate('assignedDoctors',    'name email phone notificationPreferences');

    if (!patient) return;

    const recipients = [
      ...patient.assignedCaregivers,
      ...patient.assignedDoctors,
    ];

    const notified = [];

    for (const recipient of recipients) {
      const prefs = recipient.notificationPreferences || { email: true, sms: true };

      // Email
      if (prefs.email && recipient.email) {
        const result = await sendEmail({
          to:      recipient.email,
          subject: `[${alert.severity.toUpperCase()}] AlzheimerCare Alert: ${alert.title}`,
          html:    buildAlertEmail(alert, patient, recipient),
        });
        notified.push({
          user:   recipient._id,
          method: 'email',
          sentAt: new Date(),
          status: result.success ? 'sent' : 'failed',
        });
      }

      // SMS
      if (prefs.sms && recipient.phone) {
        const smsBody = `[AlzheimerCare] ${alert.severity.toUpperCase()} Alert for ${patient.name}: ${alert.title}. ${alert.message}`;
        const result  = await sendSMS(recipient.phone, smsBody);
        notified.push({
          user:   recipient._id,
          method: 'sms',
          sentAt: new Date(),
          status: result.success ? 'sent' : 'failed',
        });
      }
    }

    // Update alert with notification records
    await Alert.findByIdAndUpdate(alert._id, {
      status:        'sent',
      notifiedUsers: notified,
    });

    return notified;
  } catch (err) {
    console.error('sendAlertNotifications error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────
// Medication reminder email
// ─────────────────────────────────────────────────────────────
const sendMedicationReminder = async (patient, medication, scheduledTime) => {
  const html = `
    <div style="font-family:Arial,sans-serif;padding:20px;">
      <h2>💊 Medication Reminder</h2>
      <p>Dear ${patient.name},</p>
      <p>This is a reminder to take your medication:</p>
      <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:15px;border-radius:4px;">
        <strong>${medication.name}</strong><br/>
        Dosage: ${medication.dosage.amount} ${medication.dosage.unit}<br/>
        Scheduled Time: ${scheduledTime}<br/>
        Instructions: ${medication.instructions || 'None'}
      </div>
      <p style="margin-top:20px;color:#666;">AlzheimerCare Platform</p>
    </div>`;

  const results = [];

  if (patient.notificationPreferences?.email && patient.email) {
    results.push(await sendEmail({ to: patient.email, subject: `💊 Medication Reminder: ${medication.name}`, html }));
  }

  if (patient.notificationPreferences?.sms && patient.phone) {
    const sms = `AlzheimerCare Reminder: Take ${medication.name} (${medication.dosage.amount}${medication.dosage.unit}) now. Time: ${scheduledTime}`;
    results.push(await sendSMS(patient.phone, sms));
  }

  // Also notify caregivers
  const fullPatient = await User.findById(patient._id)
    .populate('assignedCaregivers', 'name email phone notificationPreferences');

  for (const cg of fullPatient.assignedCaregivers || []) {
    if (cg.notificationPreferences?.sms && cg.phone) {
      const sms = `AlzheimerCare: Reminder sent to ${patient.name} for ${medication.name} at ${scheduledTime}.`;
      await sendSMS(cg.phone, sms);
    }
  }

  return results;
};

module.exports = { sendAlertNotifications, sendMedicationReminder, sendEmail, sendSMS };

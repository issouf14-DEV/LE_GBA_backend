const nodemailer = require('nodemailer');

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  // simple regex for basic validation
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
};

exports.handler = async function (event, context) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { to, subject, body, type } = payload;

  if (!to || !subject || !body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: to, subject, body' }) };
  }

  if (!isValidEmail(to)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid recipient email address' }) };
  }

  // Prefer SendGrid if API key present
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com',
        subject,
        html: body
      };

      const [response] = await sgMail.send(msg);
      const messageId = response && response.headers && response.headers['x-message-id'];
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, provider: 'sendgrid', messageId, statusCode: response && response.statusCode })
      };
    } catch (err) {
      // If SendGrid fails, continue to try nodemailer fallback below
      console.error('SendGrid send error:', err && err.message ? err.message : err);
    }
  }

  // Nodemailer fallback
  try {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined;
    const secure = process.env.EMAIL_SECURE === 'true' || (port === 465);

    const transportOptions = {};
    if (host) {
      transportOptions.host = host;
      if (port) transportOptions.port = port;
      transportOptions.secure = !!secure;
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transportOptions.auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
      }
    } else if (process.env.EMAIL_SERVICE) {
      transportOptions.service = process.env.EMAIL_SERVICE;
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transportOptions.auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
      }
    } else {
      // No configuration provided
      return { statusCode: 500, body: JSON.stringify({ error: 'Email provider not configured. Set SENDGRID_API_KEY or EMAIL_HOST/EMAIL_SERVICE and credentials.' }) };
    }

    const transporter = nodemailer.createTransport(transportOptions);

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com',
      to,
      subject,
      html: body
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, provider: 'nodemailer', messageId: info.messageId })
    };
  } catch (err) {
    console.error('Nodemailer send error:', err && err.message ? err.message : err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email', details: err && err.message ? err.message : String(err) }) };
  }
};

import admin from "../configs/firebase.js";
import { invoiceEmail, sendEmailWithAttachments } from "../utils/sendEmail.js";
import { generatePadPDF } from "../utils/generatePDF.js";
import { generatePadPDFWithPuppeteer } from "../utils/generatePDF_puppeteer.js";
import PadStatement from "../models/padStatementModel.js";

const notifyOneUser = async (req, res) => {
  try {
    const fcmToken = req.params.token;
    const { title, message } = req.body;
    const messageJson = {
      token: fcmToken,
      notification: {
        title: title,
        body: message,
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        status: "done",
      },
    };
    const response = await admin.messaging().send(messageJson);

    console.log("Notification sent:", response);
    res
      .status(200)
      .json({ success: true, message: "Notification sent", response });
  } catch (error) {
    console.error("Error sending FCM notification:", error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send notification",
        error: error.message,
      });
  }
};

const notifyAllUsers = async (req, res) => {
  try {
    const { title, message } = req.body;

    const messageJson = {
      topic: "all_users",
      notification: {
        title,
        body: message,
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        status: "done",
      },
    };

    const response = await admin.messaging().send(messageJson);

    console.log("Notification sent:", response);
    res
      .status(200)
      .json({ success: true, message: "Notification sent", response });
  } catch (error) {
    console.error("Error sending FCM notification:", error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send notification",
        error: error.message,
      });
  }
};

const sendPadStatementEmail = async (req, res) => {
  try {
    const { receiverEmail, subject = "pcIST Statement", statement, authorizedBy, authorizerName, contactEmail, contactPhone, address } = req.body;
    if (!receiverEmail || !statement) {
      return res.status(400).json({ success: false, message: "receiverEmail and statement are required" });
    }

    const { buffer, serial, dateStr } = await generatePadPDF({
      statement,
      authorizedBy,
      authorizerName,
      contactEmail,
      contactPhone,
      address,
    });

    // Save request to DB (raw data + generated metadata)
    const record = await PadStatement.create({
      receiverEmail,
      subject,
      statement,
      authorizedBy,
      authorizerName,
      contactEmail,
      contactPhone,
      address,
      serial,
      dateStr,
      createdBy: req.user?._id,
      sent: false,
    });

    const html = `<p>Dear recipient,</p>
      <p>Please find attached a formal statement from the Programming Club of IST.</p>
      <p>Serial: <strong>${serial}</strong><br/>Date: <strong>${dateStr}</strong></p>
      <p>Regards,<br/>pcIST</p>`;

    await sendEmailWithAttachments({
      emailTo: receiverEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${serial}.pdf`,
          content: buffer,
        },
      ],
    });

    // Mark as sent
    record.sent = true;
    record.sentAt = new Date();
    await record.save();

    return res.status(200).json({ success: true, message: "Statement email sent", serial, date: dateStr, id: record._id });
  } catch (error) {
    console.error("Error sending statement email:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

const sendPadStatementEmailPuppeteer = async (req, res) => {
  try {
    const { receiverEmail, subject = "pcIST Statement", statement, authorizedBy, authorizerName, contactEmail, contactPhone, address } = req.body;
    if (!receiverEmail || !statement) {
      return res.status(400).json({ success: false, message: "receiverEmail and statement are required" });
    }

    const { buffer, serial, dateStr } = await generatePadPDFWithPuppeteer({ statement, authorizedBy, authorizerName, contactEmail, contactPhone, address });

    // Save request to DB (raw data + generated metadata)
    const record = await PadStatement.create({
      receiverEmail,
      subject,
      statement,
      authorizedBy,
      authorizerName,
      contactEmail,
      contactPhone,
      address,
      serial,
      dateStr,
      createdBy: req.user?._id,
      sent: false,
      // mark that this was generated using puppeteer
      meta: { generator: 'puppeteer' },
    });

    const html = `<p>Dear recipient,</p>
      <p>Please find attached a formal statement from the Programming Club of IST.</p>
      <p>Serial: <strong>${serial}</strong><br/>Date: <strong>${dateStr}</strong></p>
      <p>Regards,<br/>pcIST</p>`;

    await sendEmailWithAttachments({
      emailTo: receiverEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${serial}.pdf`,
          content: buffer,
        },
      ],
    });

    // Mark as sent
    record.sent = true;
    record.sentAt = new Date();
    await record.save();

    return res.status(200).json({ success: true, message: "Statement email sent (puppeteer)", serial, date: dateStr, id: record._id });
  } catch (error) {
    console.error("Error sending statement email (puppeteer):", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// List pad statement history
const listPadStatementHistory = async (req, res) => {
  try {
    const items = await PadStatement.find({})
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

const sendInvoiceEmail = async (req, res) => {
  try {
    const { email, subject = "Invoice", description = {"NULL" : "NULL"} } = req.body;
    if (!email || !description) {
      return res.status(400).json({ success: false, message: "email and description are required" });
    }

    await invoiceEmail({ emailTo: email, subject, description });
    return res.status(200).json({ success: true, message: "Invoice email sent" });
  } catch (error) {
    console.error("Error sending invoice email:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export { notifyAllUsers, notifyOneUser, sendInvoiceEmail, sendPadStatementEmail, sendPadStatementEmailPuppeteer, listPadStatementHistory };


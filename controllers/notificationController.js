import admin from "../configs/firebase.js";
import { invoiceEmail, sendEmailWithAttachments } from "../utils/sendEmail.js";
import { generatePadPDFWithPuppeteer, generateInvoicePDFWithPuppeteer } from "../utils/generatePDF_puppeteer.js";
import PadStatement from "../models/padStatementModel.js";
import Invoice from "../models/invoiceModel.js";

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
    const { 
      receiverEmail, 
      subject = "pcIST Statement", 
      statement, 
      // New array format (preferred)
      authorizers,
      // Legacy individual fields (for backward compatibility)
      authorizedBy, 
      authorizerName, 
      authorizedBy2, 
      authorizerName2, 
      authorizedBy3, 
      authorizerName3, 
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;
    
    if (!receiverEmail || !statement) {
      return res.status(400).json({ success: false, message: "receiverEmail and statement are required" });
    }

    // Prepare parameters for PDF generation
    const pdfParams = {
      statement,
      contactEmail,
      contactPhone,
      address,
    };

    // Use new array format if provided, otherwise fall back to legacy fields
    if (Array.isArray(authorizers) && authorizers.length > 0) {
      pdfParams.authorizers = authorizers;
    } else {
      // Legacy format support
      pdfParams.authorizedBy = authorizedBy;
      pdfParams.authorizerName = authorizerName;
      pdfParams.authorizedBy2 = authorizedBy2;
      pdfParams.authorizerName2 = authorizerName2;
      pdfParams.authorizedBy3 = authorizedBy3;
      pdfParams.authorizerName3 = authorizerName3;
    }

    // Use Puppeteer-based PDF generator
    const { buffer, serial, dateStr } = await generatePadPDFWithPuppeteer(pdfParams);

    // Save request to DB (raw data + generated metadata)
    const record = await PadStatement.create({
      receiverEmail,
      subject,
      statement,
      // Save both formats for backward compatibility
      authorizers: Array.isArray(authorizers) ? authorizers : undefined,
      authorizedBy,
      authorizerName,
      authorizedBy2,
      authorizerName2,
      authorizedBy3,
      authorizerName3,
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

// (Removed separate puppeteer-only handler — main send route now uses Puppeteer.)

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

const downloadPadStatementPDF = async (req, res) => {
  try {
    const { 
      statement, 
      // New array format (preferred)
      authorizers,
      // Legacy individual fields (for backward compatibility)
      authorizedBy, 
      authorizerName, 
      authorizedBy2, 
      authorizerName2, 
      authorizedBy3, 
      authorizerName3, 
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;
    
    if (!statement) {
      return res.status(400).json({ success: false, message: "statement is required" });
    }

    // Prepare parameters for PDF generation
    const pdfParams = {
      statement,
      contactEmail,
      contactPhone,
      address,
    };

    // Use new array format if provided, otherwise fall back to legacy fields
    if (Array.isArray(authorizers) && authorizers.length > 0) {
      pdfParams.authorizers = authorizers;
    } else {
      // Legacy format support
      pdfParams.authorizedBy = authorizedBy;
      pdfParams.authorizerName = authorizerName;
      pdfParams.authorizedBy2 = authorizedBy2;
      pdfParams.authorizerName2 = authorizerName2;
      pdfParams.authorizedBy3 = authorizedBy3;
      pdfParams.authorizerName3 = authorizerName3;
    }

    // Generate PDF using Puppeteer
    const { buffer, serial, dateStr } = await generatePadPDFWithPuppeteer(pdfParams);

    // Save request to DB for tracking (without email sending)
    const record = await PadStatement.create({
      receiverEmail: null, // No email recipient for download
      subject: "PDF Download",
      statement,
      // Save both formats for backward compatibility
      authorizers: Array.isArray(authorizers) ? authorizers : undefined,
      authorizedBy,
      authorizerName,
      authorizedBy2,
      authorizerName2,
      authorizedBy3,
      authorizerName3,
      contactEmail,
      contactPhone,
      address,
      serial,
      dateStr,
      createdBy: req.user?._id,
      sent: false,
      downloadedAt: new Date(),
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error generating PDF for download:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const sendInvoiceEmail = async (req, res) => {
  try {
    const { 
      receiverEmail, 
      subject = "Invoice from pcIST", 
      products = [], 
      authorizerName = '', 
      authorizerDesignation = '',
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;

    if (!receiverEmail || !products || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "receiverEmail and products array are required" 
      });
    }

    // Validate products structure
    for (const product of products) {
      if (!product.description || !product.unitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: "Each product must have description and unitPrice" 
        });
      }
    }

    // Generate invoice PDF
    const { buffer, serial, dateStr, grandTotal } = await generateInvoicePDFWithPuppeteer({
      products,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
    });

    // Calculate product totals and prepare for database
    const processedProducts = products.map(product => {
      const quantity = product.quantity || 1;
      const unitPrice = parseFloat(product.unitPrice) || 0;
      const total = quantity * unitPrice;
      return {
        description: product.description,
        quantity,
        unitPrice,
        total
      };
    });

    // Save invoice to database
    const invoice = await Invoice.create({
      serial,
      products: processedProducts,
      grandTotal,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      dateStr,
      createdBy: req.user?._id,
      sentViaEmail: true,
      sentAt: new Date(),
    });

    const html = `<p>Dear Valued Client,</p>
      <p>Please find attached your invoice from the Programming Club of IST.</p>
      <p><strong>Invoice #:</strong> ${serial}<br/>
      <strong>Date:</strong> ${dateStr}<br/>
      <strong>Total Amount:</strong> ৳${grandTotal.toFixed(2)}</p>
      <p>Thank you for your business!</p>
      <p>Regards,<br/>Programming Club of IST</p>`;

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

    return res.status(200).json({ 
      success: true, 
      message: "Invoice email sent successfully", 
      invoiceId: invoice._id,
      serial, 
      date: dateStr,
      total: grandTotal 
    });
  } catch (error) {
    console.error("Error sending invoice email:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadInvoicePDF = async (req, res) => {
  try {
    const { 
      products = [], 
      authorizerName = '', 
      authorizerDesignation = '',
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "products array is required" 
      });
    }

    // Validate products structure
    for (const product of products) {
      if (!product.description || !product.unitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: "Each product must have description and unitPrice" 
        });
      }
    }

    // Generate invoice PDF
    const { buffer, serial, dateStr, grandTotal } = await generateInvoicePDFWithPuppeteer({
      products,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
    });

    // Calculate product totals and prepare for database
    const processedProducts = products.map(product => {
      const quantity = product.quantity || 1;
      const unitPrice = parseFloat(product.unitPrice) || 0;
      const total = quantity * unitPrice;
      return {
        description: product.description,
        quantity,
        unitPrice,
        total
      };
    });

    // Save invoice to database for tracking
    const invoice = await Invoice.create({
      serial,
      products: processedProducts,
      grandTotal,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      dateStr,
      createdBy: req.user?._id,
      sentViaEmail: false,
      downloadedAt: new Date(),
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error generating invoice PDF for download:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadPadStatementBySerial = async (req, res) => {
  try {
    const { serial } = req.params;

    if (!serial) {
      return res.status(400).json({ 
        success: false, 
        message: "PAD statement serial number is required" 
      });
    }

    // Find the PAD statement in the database
    const padStatement = await PadStatement.findOne({ serial });

    if (!padStatement) {
      return res.status(404).json({ 
        success: false, 
        message: "PAD statement not found" 
      });
    }

    // Regenerate the PDF using the stored data
    const { buffer } = await generatePadPDFWithPuppeteer({
      statement: padStatement.statement,
      authorizedBy: padStatement.authorizedBy,
      authorizerName: padStatement.authorizerName,
      authorizedBy2: padStatement.authorizedBy2,
      authorizerName2: padStatement.authorizerName2,
      authorizedBy3: padStatement.authorizedBy3,
      authorizerName3: padStatement.authorizerName3,
      contactEmail: padStatement.contactEmail,
      contactPhone: padStatement.contactPhone,
      address: padStatement.address,
    });

    // Update download timestamp (add this field to existing records if needed)
    padStatement.downloadedAt = new Date();
    await padStatement.save();

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloading PAD statement:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadInvoiceBySerial = async (req, res) => {
  try {
    const { serial } = req.params;

    if (!serial) {
      return res.status(400).json({ 
        success: false, 
        message: "Invoice serial number is required" 
      });
    }

    // Find the invoice in the database
    const invoice = await Invoice.findOne({ serial });

    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        message: "Invoice not found" 
      });
    }

    // Regenerate the PDF using the stored data
    const { buffer } = await generateInvoicePDFWithPuppeteer({
      products: invoice.products,
      authorizerName: invoice.authorizerName,
      authorizerDesignation: invoice.authorizerDesignation,
      contactEmail: invoice.contactEmail,
      contactPhone: invoice.contactPhone,
      address: invoice.address,
    });

    // Update download timestamp
    invoice.downloadedAt = new Date();
    await invoice.save();

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloading invoice:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listInvoiceHistory = async (req, res) => {
  try {
    const invoices = await Invoice.find({})
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ 
      success: true, 
      count: invoices.length, 
      data: invoices 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const sendInvoiceEmail_legacy = async (req, res) => {
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

export { 
  notifyAllUsers, 
  notifyOneUser, 
  sendInvoiceEmail_legacy, 
  sendPadStatementEmail, 
  downloadPadStatementPDF,
  downloadPadStatementBySerial, 
  listPadStatementHistory,
  sendInvoiceEmail,
  downloadInvoicePDF,
  downloadInvoiceBySerial,
  listInvoiceHistory
};


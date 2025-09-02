import mongoose from 'mongoose';

const padStatementSchema = new mongoose.Schema(
  {
    receiverEmail: { type: String, required: false },
    subject: { type: String, default: 'pcIST Statement' },
    statement: { type: String, required: true },
    // Array-based authorizers
    authorizers: [{
      name: { type: String, required: true },
      role: { type: String, required: true }
    }],
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String },
    serial: { type: String },
    dateStr: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    sent: { type: Boolean, default: false },
    sentAt: { type: Date },
    downloadedAt: { type: Date },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const PadStatement =
  mongoose.models.PadStatement || mongoose.model('PadStatement', padStatementSchema);

export default PadStatement;

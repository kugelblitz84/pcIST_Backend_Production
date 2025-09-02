import mongoose from 'mongoose';

const padStatementSchema = new mongoose.Schema(
  {
    receiverEmail: { type: String, required: false },
    subject: { type: String, default: 'pcIST Statement' },
    statement: { type: String, required: true },
    // Legacy individual authorizer fields (for backward compatibility)
    authorizedBy: { type: String },
    authorizerName: { type: String },
    authorizedBy2: { type: String },
    authorizerName2: { type: String },
    authorizedBy3: { type: String },
    authorizerName3: { type: String },
    // New array-based authorizers (preferred format)
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

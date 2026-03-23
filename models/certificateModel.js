import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema({
  name: { type: String },
  role: { type: String },
  org: { type: String },
  imageUrl: { type: String },
}, { _id: false });

const certificateSchema = new mongoose.Schema(
  {
    serial: { type: String, required: true, unique: true },
    recipientName: { type: String, required: true },
    certificateType: { type: String, default: 'participation' },
    placement: { type: String },
    eventName: { type: String },
    eventYear: { type: String },
    issueDate: { type: Date, required: true },
    dateStr: { type: String, required: true },
    organizationName: { type: String },
    subtitle: { type: String },
    description: { type: String },
    signatures: [signatureSchema],
    pdfUrl: { type: String },
    pdfPublicId: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    sentViaEmail: { type: Boolean, default: false },
    sentAt: { type: Date },
    downloadedAt: { type: Date },
  },
  { timestamps: true }
);

const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);

export default Certificate;

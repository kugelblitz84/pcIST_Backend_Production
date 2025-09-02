import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    serial: { type: String, required: true, unique: true },
    products: [productSchema],
    grandTotal: { type: Number, required: true },
    authorizerName: { type: String },
    authorizerDesignation: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: { type: String, default: 'Institute of Science & Technology (IST), Dhaka' },
    dateStr: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    sentViaEmail: { type: Boolean, default: false },
    sentAt: { type: Date },
    downloadedAt: { type: Date },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;

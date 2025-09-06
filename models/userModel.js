import mongoose from 'mongoose'


// role : 1 - member, 2 - admin

const userSchema = new mongoose.Schema({
	classroll: { type: Number, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	verificationCode: {type: String},
	is_email_verified: { type: Boolean, default: false },
	forgotPasswordCode: {type: String},
	password: { type: String, required: true },
	phone: { type: String },
	profileimage: { type: String },
	name: { type: String },
	gender: { type: String },
	tshirt: { type: String },
	batch: { type: Number },
	dept: { type: String },
	role: { type: Number, required: true, default: 1 },
	membership: { type: Boolean, default: false },
	membershipExpiresAt: {type: Date, default: null},
	cfhandle: { type: String },
	atchandle: { type: String },
	cchandle: { type: String },
	badges: [{ type: String}],
	certificates: [{ type: String }],
	slug: { type: String, unique: true },
	// Separate categories for participations
	myParticipations: {
		solo: [
			{
				eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'solo-events' },
				eventName: { type: String }
			}
		],
		team: [
			{
				eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'team-events' },
				eventName: { type: String }
			}
		]
	},
}, {
	minimize: false,
	timestamps: true
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel
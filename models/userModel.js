import mongoose from 'mongoose'


// role : 1 - member, 2 - admin

const userSchema = new mongoose.Schema({
	classroll: { type: Number, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	is_email_verified: { type: Boolean },
	password: { type: String, required: true },
	phone: { type: Number },
	profileimage: { type: String },
	name: { type: String },
	gender: { type: String },
	tshirt: { type: String },
	batch: { type: String },
	dept: { type: String },
	role: { type: Number },
	membership: { type: Boolean },
	cfhandle: { type: String, unique: true },
	atchandle: { type: String, unique: true },
	cchandle: { type: String, unique: true },
	is_cfhandle_verified: { type: Boolean },
	is_atchandle_verified: { type: Boolean },
	is_cchandle_verified: { type: Boolean },
	badges: [{ type: String}],
	certificates: [{ type: String }],
	slug: { type: String, unique: true }
}, {
	minimize: false,
	timestamps: true
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel
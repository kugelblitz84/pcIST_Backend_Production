import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import generateOTP from '../utils/generateOTP.js';
import sendEmail from '../utils/sendEmail.js';

const createToken = ({ id, classroll, email }) => {
    return jwt.sign({ id, classroll, email }, process.env.JWT_SECRET);
};

const superAdminLogin = async (req, res) => {
	try{
		const { email, password } = req.body;

		if( email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD){
			const token = jwt.sign(email+password,process.env.JWT_SECRET);
            res.json({success:true, token});
		}
		else{
           res.json({success:false, message:"Invalid credentials"});
        }
	}
	catch(error) {
		console.log(error);
        res.json({success:false, message:error.message});
	}
}

const registerMember = async (req, res) => {
	try{
		const { classroll, email, password } = req.body;

		// Check is roll is valid or not
		const exits = await userModel.findOne({classroll});
		if(exits){
			return res.json({success: false, message: "Someone has already registerd using this roll. Please contact to pcist."})
		}

		// Check if email is valid or not
		if(!validator.isEmail(email)){
			return res.json({success: false, message: "Please enter a valid email"})
		}

		// Check if email is a Gmail address
		if (!email.endsWith('@gmail.com')) {
		    return res.json({ success: false, message: "Only Gmail accounts are allowed" });
		}

		// Password validation
		if(password.length < 8){
            return res.json({success: false, message: "Please enter strong password and put atleast 8 characters"})
        }


        // Password hashing
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = new userModel({
            classroll,
            email,
            password: hashedPassword
        })

        const user = await newUser.save()

        // const token = createToken(user._id, user.classroll, user.email );
        res.json({success: true, message: "User created successfully"});
	}
	catch(error) {
		console.log(error);
        res.json({success:false, message:error.message});
	}
}

const sendVerificationEmail = async ( req, res ) => {
	try{
		const { email } = req.body;

		if (!email) {
	        return res.status(400).json({ code: 400, status: false, message: "Please provide email" });
	    }

	    const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ code: 404, status: false, message: "User not found" });
        }

        // Generate verification code and send it to the user's email
        const code = generateOTP();

        user.verificationCode = code;
        await user.save();

        // Send the verification code to the user's email
        const subject = "Verification Code";
        const content = "Please verify your email.";
        const emailTo = email;
        await sendEmail({ emailTo, subject, code, content });

        res.status(200).json({ code: 200, status: true, message: "Verification code sent successfully" });
	}
	catch(error) {
		console.log(error);
        res.json({success:false, message:error.message});
	}
}

const verifyUser = async (req, res, next) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ code: 400, status: false, message: "Please provide email and code" });
    }

    try {

        const user = await userModel.findOne({ email});
        if(!user){
            return res.status(404).json({ code: 404, status: false, message: "User not found" });
        }

        if(user.verificationCode !== code){
            return res.status(401).json({ code: 401, status: false, message: "Invalid verification code" });
        }

        user.is_email_verified = true;
        user.verificationCode = null;
        await user.save();

        res.json({ code: 200, status: true, message: "User verified successfully" });

    } catch (error) {
    	console.log(error);
        res.json({ code: 500, staus: false, message: "Internal server error." });
    }
}

export { superAdminLogin, registerMember, sendVerificationEmail, verifyUser };
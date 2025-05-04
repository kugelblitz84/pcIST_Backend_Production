import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js';
import validator from 'validator';
import bcrypt from 'bcryptjs';

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
	catch {
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

        const token = createToken(user._id, user.classroll, user.email );
        res.json({success: true, token});
	}
	catch {
		console.log(error);
        res.json({success:false, message:error.message});
	}
}

export { superAdminLogin, registerMember };
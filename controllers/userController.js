import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import validator from "validator";
import bcrypt from "bcryptjs";
import generateOTP from "../utils/generateOTP.js";
import sendEmail from "../utils/sendEmail.js";
import slugify from "slugify";
import agenda from '../configs/agenda.js'

const createToken = ({ id, classroll, email, role }) => {
  return jwt.sign({ id, classroll, email, role }, process.env.JWT_SECRET);
};

const verifyPassword = async (password, hashedPassword) => {
  const isValid = await bcrypt.compare(password, hashedPassword);
  return isValid;
};

const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({ status: true, token });
    } else {
      res.json({ status: false, message: "Invalid credentials" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: false, message: error.message });
  }
};

const registerMember = async (req, res) => {
  try {
    const { classroll, email, password } = req.body;

    // Check is roll is valid or not
    const exits = await userModel.findOne({ classroll });
    if (exits) {
      return res.json({
        status: false,
        message:
          "Someone has already registerd using this roll. Please contact to pcist.",
      });
    }

    // Check if email is valid or not
    if (!validator.isEmail(email)) {
      return res.json({
        status: false,
        message: "Please enter a valid email",
      });
    }

    // Check if email is a Gmail address
    if (!email.endsWith("@gmail.com")) {
      return res.json({
        status: false,
        message: "Only Gmail accounts are allowed",
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.json({
        status: false,
        message: "Please enter strong password and put atleast 8 characters",
      });
    }

    // Password hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const slug = slugify(classroll.toString(), { lower: true, strict: true });

    const newUser = new userModel({
      classroll,
      email,
      password: hashedPassword,
      slug,
      role: 1,
    });

    await newUser.save();

    const token = createToken({
      id: newUser._id.toString(),
      classroll: newUser.classroll,
      email: newUser.email,
      role: newUser.role,
    });
    res.json({
      status: true,
      message: "User created successfully",
      token: token,
      slug: slug,
    });
  } catch (error) {
    console.log(error);
    res.json({ status: false, message: error.message });
  }
};

const getUserData = async (req, res) => {
  try {
    const { slug } = req.body;
    const user = await userModel
      .findOne({ slug })
      .select("-password -slug -forgotPasswordCode");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user data:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { classroll, password } = req.body;

    if (!classroll || !password) {
      return res.status(400).json({
        code: 400,
        status: false,
        message: "Please provide classroll and password",
      });
    }

    const user = await userModel.findOne({ classroll });
    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ code: 401, status: false, message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = createToken({
      id: user._id.toString(),
      classroll: user.classroll,
      email: user.email,
      role: user.role,
    });

    // Send the token and user data in the response
    res.status(200).json({
      status: true,
      message: "Login Successfull",
      token: token,
      slug: user.slug,
    });
  } catch (error) {
    res.json({ code: 500, status: false, message: "Internal server error" });
  }
};

const sendVerificationEmail = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    // Generate verification code and send it to the user's email
    const code = generateOTP();

    user.verificationCode = code;
    await user.save();

    // Send the verification code to the user's email
    const subject = "Verification Code";
    const content = "Please verify your email.";
    const emailTo = user.email;
    await sendEmail({ emailTo, subject, code, content });

    res.status(200).json({
      code: 200,
      status: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    console.log(error);
    res.json({ status: false, message: error.message });
  }
};

const verifyUser = async (req, res, next) => {
  const { code } = req.body;
  const email = req.user.email;

  if (!email || !code) {
    return res.status(400).json({
      code: 400,
      status: false,
      message: "Please provide email and code",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    if (user.verificationCode !== code) {
      return res.status(401).json({
        code: 401,
        status: false,
        message: "Invalid verification code",
      });
    }

    user.is_email_verified = true;
    user.verificationCode = null;
    await user.save();

    res.json({
      code: 200,
      status: true,
      message: "User verified successfully",
    });
  } catch (error) {
    console.log(error);
    res.json({ code: 500, staus: false, message: "Internal server error." });
  }
};

// forgot password mail verification
const sendForgotPasswordCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ code: 400, status: false, message: "Please provide email" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    // Generate verification code and send it to the user's email
    const code = generateOTP();

    user.forgotPasswordCode = code;
    await user.save();

    // Send the verification code to the user's email
    const subject = "Verification Code";
    const content = "Please verify your email";
    const emailTo = email;
    await sendEmail({ emailTo, subject, code, content });

    res.status(200).json({
      code: 200,
      status: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    res.json({ code: 500, status: false, message: "Internal server error" });
  }
};

// recover password function
const recoverPassword = async (req, res) => {
  const { email, code, password } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    if (user.forgotPasswordCode !== code) {
      return res
        .status(404)
        .json({ code: 400, status: false, message: "Code not matched" });
    }

    // Password validation
    if (password.length < 8) {
      return res.json({
        status: false,
        message: "Please enter strong password and put atleast 8 characters",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    user.forgotPasswordCode = null;

    await user.save();

    res.status(200).json({
      code: 200,
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.json({ code: 500, status: false, message: "Internal server error" });
  }
};

// update profile
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      gender,
      tshirt,
      batch,
      dept,
      cfhandle,
      atchandle,
      cchandle,
    } = req.body;

    const user = req.user;
    if (!user) {
      return res
        .status(404)
        .json({ code: 404, status: false, message: "User not found" });
    }

    user.name = name;
    user.phone = phone;
    user.gender = gender;
    user.tshirt = tshirt;
    user.batch = batch;
    user.dept = dept;
    user.cfhandle = cfhandle;
    user.atchandle = atchandle;
    user.cchandle = cchandle;

    await user.save();

    res.json({
      code: 200,
      status: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.json({ code: 500, status: false, message: "Internal server error" });
  }
};

const getUserList = async (req, res) => {
  try {
    const users = await userModel.find({}, "name role slug email membership membershipExpiresAt");

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
};

const updateMembershipStatus = async (req, res) => {
  try {
    

    const { id } = req.params;
    const { membership, durationInMonths } = req.body;

    await agenda.cancel({ name: 'expire membership', 'data.userId': id });  //erasing any previous agenda first.
    //console.log(membership, typeof membership);
    // if (typeof membership !== "boolean") {
    //   return res.status(400).json({ message: "Membership must be a boolean." });
    // }

    const update = { membership };

    if (membership) {
      if (![1, 2, 3].includes(durationInMonths)) {
        return res
          .status(400)
          .json({ message: "durationInMonths must be 1, 2, or 3." });
      }

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + durationInMonths);
      update.membershipExpiresAt = expirationDate;

      // Schedule the background job
      await agenda.schedule(expirationDate, "expire membership", {
        userId: id,
      });
    } else {
      update.membershipExpiresAt = null;
    }

    const updatedUser = await userModel.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      message: "Membership updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Server error while updating membership." });
  }
};

export {
  superAdminLogin,
  registerMember,
  login,
  sendVerificationEmail,
  verifyUser,
  sendForgotPasswordCode,
  recoverPassword,
  updateProfile,
  getUserData,
  getUserList,
  updateMembershipStatus,
};

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendVerificationEmail } = require("../services/EmailService");

/* ======================
	 UPDATE PROFILE DETAILS
	 Accepts: fullName, skills, bio, location
	 Protected: requires session
====================== */
exports.updateProfile = async (req, res) => {
	try {
		const userId = (req.session && req.session.user && req.session.user.id) || req.body.userId;
		if (!userId) return res.status(400).json({ message: "userId is required when not authenticated" });

		const { fullName, skills, bio, location } = req.body;

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		if (fullName) user.fullName = fullName;
		if (Array.isArray(skills)) user.skills = skills;
		if (typeof bio === "string") user.bio = bio;

		if (
			location &&
			Array.isArray(location.coordinates) &&
			location.coordinates.length === 2
		) {
			user.location = {
				type: "Point",
				coordinates: location.coordinates
			};
		}

		await user.save();

		// update session with latest fields so front-end refresh picks them up
		if (req.session && req.session.user) {
			req.session.user.fullName = user.fullName;
			req.session.user.email = user.email;
			req.session.user.username = user.username;
			req.session.user.role = user.role;
			req.session.user.skills = user.skills || [];
			req.session.user.bio = user.bio || "";
			req.session.user.location = user.location || null;
		}

		res.status(200).json({ message: "Profile updated successfully" });
	} catch (error) {
		console.error("updateProfile error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

/* ======================
	 UPDATE EMAIL (simple)
	 Accepts: userId, email
	 Note: OTP verification is handled on frontend via /auth endpoints.
====================== */
exports.updateEmail = async (req, res) => {
	try {
		const userId = (req.session && req.session.user && req.session.user.id) || req.body.userId;
		if (!userId) return res.status(400).json({ message: "userId is required when not authenticated" });

		let { email, otp } = req.body;
		if (!email) return res.status(400).json({ message: "email is required" });
		if (typeof otp === 'undefined' || otp === null) return res.status(400).json({ message: "otp is required" });

		email = email.toLowerCase().trim();

		const currentUser = await User.findById(userId);
		if (!currentUser) return res.status(404).json({ message: "User not found" });

		// Ensure OTP was requested and exists on user
		if (!currentUser.otp || !currentUser.otpExpiresAt) {
			return res.status(400).json({ message: "OTP not requested" });
		}

		// Compare OTP (allow numeric or string input)
		if (Number(otp) !== Number(currentUser.otp)) {
			return res.status(400).json({ message: "Invalid OTP" });
		}

		// Check expiry
		if (currentUser.otpExpiresAt < new Date()) {
			return res.status(400).json({ message: "OTP expired" });
		}

		// If another completed user already uses this email, reject
		const existing = await User.findOne({ email });
		if (existing && existing._id.toString() !== userId && existing.isProfileCompleted) {
			return res.status(400).json({ message: "Email already in use" });
		}

		// All checks passed — update email and clear OTP
		currentUser.email = email;
		currentUser.otp = undefined;
		currentUser.otpExpiresAt = undefined;

		await currentUser.save();

		// Update session if present
		if (req.session && req.session.user) {
			req.session.user.email = currentUser.email;
		}

		res.status(200).json({ message: "Email updated successfully", email: currentUser.email });
	} catch (error) {
		console.error("updateEmail error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

/* ======================
	 CHANGE PASSWORD
	 Accepts: userId, password
	 Password will be hashed with bcrypt before storing.
====================== */
exports.changePassword = async (req, res) => {
	try {
		const userId = (req.session && req.session.user && req.session.user.id) || req.body.userId;
		if (!userId) return res.status(400).json({ message: "userId is required when not authenticated" });

		const { curpassword, newpassword } = req.body;
		if (!curpassword || typeof curpassword !== "string") return res.status(400).json({ message: "curpassword is required" });
		if (!newpassword || typeof newpassword !== "string") return res.status(400).json({ message: "newpassword is required" });

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		const isMatch = await bcrypt.compare(curpassword, user.password);
		if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

		const hashed = await bcrypt.hash(newpassword, 10);
		user.password = hashed;

		await user.save();

		res.status(200).json({ message: "Password changed successfully" });
	} catch (error) {
		console.error("changePassword error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

/* ======================
	 SEND OTP FOR EMAIL UPDATE
	 Accepts: userId, email
	 Function: send OTP to the provided email but DO NOT change user's saved email
====================== */
exports.sendOTPForUpdate = async (req, res) => {
	try {
		const userId = (req.session && req.session.user && req.session.user.id) || req.body.userId;
		if (!userId) return res.status(400).json({ message: "userId is required when not authenticated" });

		let { email } = req.body;
		if (!email) return res.status(400).json({ message: "email is required" });

		const targetEmail = email.toLowerCase().trim();

		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ message: "User not found" });

		// Generate and send OTP using EmailService
		const otp = await sendVerificationEmail(targetEmail);
		const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

		// Update only otp fields on the user. Do NOT change user.email here.
		user.otp = otp;
		user.otpExpiresAt = otpExpiry;

		await user.save();

		res.status(200).json({ message: "OTP sent successfully.\nPlease check your email." });
	} catch (error) {
		console.error("sendOTPForUpdate error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

/* ======================
	 GET CURRENT USER (sanitized)
	 Returns user object excluding password, otp, otpExpiresAt, isProfileCompleted
	 Protected: requires session
====================== */
exports.getMe = async (req, res) => {
	try {
		const userId = (req.session && req.session.user && req.session.user.id);
		if (!userId) return res.status(401).json({ message: "Not authenticated" });

		const user = await User.findById(userId).select('-password -otp -otpExpiresAt -isProfileCompleted');
		if (!user) return res.status(404).json({ message: "User not found" });

		res.status(200).json({ user });
	} catch (error) {
		console.error("getMe error:", error);
		res.status(500).json({ message: "Server error" });
	}
};
// Note: applications are tracked with the Application model and
// ApplicationController endpoints. The previous `opportunitiesApplied`
// per-user field was removed as it's not used by the frontend.


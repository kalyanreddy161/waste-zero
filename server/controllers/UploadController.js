const imagekit = require("../services/ImageKitService");

const uploadImage = async (req, res) => {
    try {
        console.log("Upload request received");
        if (!req.file) {
            console.warn("Upload failed: No file in request");
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const file = req.file;
        console.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);

        const response = await imagekit.upload({
            file: file.buffer,
            fileName: `${Date.now()}-${file.originalname}`,
            folder: "/uploads",
        });

        console.log("ImageKit upload success:", response.url);
        res.status(200).json({
            success: true,
            url: response.url,
            fileId: response.fileId,
        });
    } catch (error) {
        console.error("ImageKit error details:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Upload failed",
            details: error
        });
    }
};

module.exports = {
    uploadImage,
};

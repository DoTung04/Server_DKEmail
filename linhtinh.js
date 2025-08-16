const express = require('express');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Khởi tạo Firebase Admin SDK
const serviceAccount = require('./firebase-service-account.json'); // Thay bằng đường dẫn đến tệp khóa dịch vụ Firebase của bạn
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Cấu hình Nodemailer với Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'dohoangtung313@gmail.com', // Thay bằng địa chỉ Gmail của bạn
    pass: 'wztz dpxv xkrm qiws', // Thay bằng Mật khẩu ứng dụng 16 ký tự của bạn
  },
});

// Điểm cuối API để gửi mã xác minh
app.post('/send-verification-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email là bắt buộc' });
  }

  try {
    // Tạo mã xác minh 6 chữ số
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu mã vào Firestore với thời gian hết hạn (ví dụ: 15 phút)
    await db.collection('verificationCodes').doc(email).set({
      code: verificationCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 15 * 60 * 1000) // 15 phút kể từ bây giờ
      ),
    });

    // Tùy chọn email
    const mailOptions = {
      from: 'dohoangtung313@gmail.com', // Thay bằng địa chỉ Gmail của bạn
      to: email,
      subject: 'Mã Xác Minh Đăng Ký',
      text: `Mã xác minh của bạn là: ${verificationCode}. Mã này có hiệu lực trong 15 phút.`,
      html: `<p>Mã xác minh của bạn là: <b>${verificationCode}</b>. Mã này có hiệu lực trong 15 phút.</p>`,
    };

    // Gửi email
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Mã xác minh đã được gửi đến email của bạn.' });
  } catch (error) {
    console.error('Lỗi khi gửi email xác minh:', error);
    res.status(500).json({ error: 'Gửi mã xác minh thất bại: ' + error.message });
  }
});

// Điểm cuối API để xác minh mã
app.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email và mã xác minh là bắt buộc' });
  }

  try {
    const doc = await db.collection('verificationCodes').doc(email).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Không tìm thấy mã xác minh' });
    }

    const data = doc.data();
    const now = new Date();

    // Kiểm tra xem mã có hợp lệ và chưa hết hạn không
    if (data.code === code && data.expiresAt.toDate() > now) {
      // Tùy chọn: xóa mã sau khi xác minh thành công
      await db.collection('verificationCodes').doc(email).delete();
      res.status(200).json({ message: 'Xác minh thành công' });
    } else {
      res.status(400).json({ error: 'Mã xác minh không hợp lệ hoặc đã hết hạn' });
    }
  } catch (error) {
    console.error('Lỗi khi xác minh mã:', error);
    res.status(500).json({ error: 'Xác minh thất bại: ' + error.message });
  }
});

// Khởi động máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang chạy trên cổng ${PORT}`);
});
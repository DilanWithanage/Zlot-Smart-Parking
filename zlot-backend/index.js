const express = require('express');
const cors = require('cors');
const { db, admin } = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// --- LOCAL STORAGE SETUP ---
const dir = './uploads';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, 'ZLOT_IMG_' + Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Serve the uploads folder so the mobile app and web dashboard can view them!
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 1. IMAGE UPLOAD API ---
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  // Send back the relative path so the app can construct the full network URL
  res.json({ url: `/uploads/${req.file.filename}` });
});

// --- 2. Check-In API Route ---
app.post('/api/checkin', async (req, res) => {
  try {
    const { lotId, plateNumber } = req.body;
    const lotRef = db.collection('parking_lots').doc(lotId);
    const lotDoc = await lotRef.get();

    if (!lotDoc.exists) return res.status(404).json({ error: "Parking lot not found!" });
    const lotData = lotDoc.data();
    if (lotData.available_spots <= 0) return res.status(400).json({ error: "Lot is completely full!" });

    const newTransaction = {
      lot_id: lotId,
      plate_number: plateNumber,
      entry_time: admin.firestore.FieldValue.serverTimestamp(),
      status: "Active"
    };
    
    await db.collection('transactions').add(newTransaction);
    await lotRef.update({ available_spots: lotData.available_spots - 1 });

    res.status(200).json({ message: `Success! ${plateNumber} checked in.`, spots_left: lotData.available_spots - 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong during check-in." });
  }
});

// --- 3. Check-Out API Route ---
app.post('/api/checkout', async (req, res) => {
  try {
    const { lotId, plateNumber } = req.body;
    const transactionsRef = db.collection('transactions');
    const snapshot = await transactionsRef
      .where('lot_id', '==', lotId)
      .where('plate_number', '==', plateNumber)
      .where('status', '==', 'Active')
      .get();

    if (snapshot.empty) return res.status(404).json({ error: "Vehicle not found." });

    const transactionDoc = snapshot.docs[0];
    await transactionDoc.ref.update({ status: 'Completed' });

    const simulatedHours = (Math.random() * 3 + 1).toFixed(2);
    const hourlyRate = 150; 
    const totalFee = Math.round(simulatedHours * hourlyRate);

    const lotRef = db.collection('parking_lots').doc(lotId);
    await lotRef.update({ available_spots: admin.firestore.FieldValue.increment(1) });

    res.json({
      plate: plateNumber,
      timeParked: `${simulatedHours} hours`,
      fee: `LKR ${totalFee}`,
      message: 'Checkout successful!'
    });

  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({ error: 'Failed to process checkout.' });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and ready to receive images!`);
});
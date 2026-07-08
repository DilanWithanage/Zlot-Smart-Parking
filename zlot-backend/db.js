const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log("Zlot Database connected successfully!");

module.exports = { db, admin };
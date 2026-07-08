import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, MapPin, LogOut, TrendingUp, 
  CreditCard, Banknote, Shield, Trash2, UserX, 
  UserCheck, Edit2, AlertCircle, Lock, Flame, QrCode, Eye, BrainCircuit, Activity, Map as MapIcon, Send, Mail
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'firebase/auth';

import { initializeApp } from 'firebase/app'; 
import { db } from './firebase'; 

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import './index.css';
import './App.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const auth = getAuth();
const LOCAL_BACKEND_URL = `http://${window.location.hostname}:3000`;

// --- 1. LOGIN COMPONENT ---
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">Zlot.</h1>
          <p className="text-slate-500 mt-2 font-medium">Super Admin Access Portal</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 flex items-center gap-2 text-sm border border-red-100"><AlertCircle size={18} /> {error}</div>}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
            <input type="email" required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input type="password" required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"><Lock size={18} /> Sign In</button>
        </form>
      </div>
    </div>
  );
};

// --- 2. LIVE OVERVIEW COMPONENT WITH DATE FILTER ---
const Overview = () => {
  const [lotUsageData, setLotUsageData] = useState([]);
  const [revenueStats, setRevenueStats] = useState({ total: 0, qr: 0, card: 0, cash: 0 });
  const [chartData, setChartData] = useState([{ time: '00:00', cash: 0, qr: 0, card: 0 }]); 
  const [timeFilter, setTimeFilter] = useState('ALL_TIME'); 

  useEffect(() => {
    const verifiedLotsQuery = query(collection(db, 'parking_lots'), where('status', '==', 'VERIFIED'));
    const unsubscribeLots = onSnapshot(verifiedLotsQuery, (snapshot) => {
      setLotUsageData(snapshot.docs.map(doc => {
        const data = doc.data();
        const total = data.capacity_total || 50; 
        const spotsAvailable = data.available_spots !== undefined ? data.available_spots : total;
        return { name: data.name || doc.id, capacity: total, occupied: total - spotsAvailable };
      }));
    });
    return () => unsubscribeLots();
  }, []);

  useEffect(() => {
    const unsubscribeTrans = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      let tot = 0, qr = 0, card = 0, cash = 0;
      const hourlyBuckets = {};

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfWeek = startOfToday - (now.getDay() * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Completed' || data.status === 'Active') {
          const timeToUse = data.timestamp || data.arrivalTime;
          if (!timeToUse || typeof timeToUse.toDate !== 'function') return;
          
          const transactionMs = timeToUse.toDate().getTime();

          if (timeFilter === 'TODAY' && transactionMs < startOfToday) return;
          if (timeFilter === 'WEEK' && transactionMs < startOfWeek) return;
          if (timeFilter === 'MONTH' && transactionMs < startOfMonth) return;

          const amount = data.amountPaid || 0;
          tot += amount;
          
          const method = data.finalPaymentMethod || data.paymentMethod || 'CASH';
          if (method === 'LANKAQR') qr += amount;
          else if (method === 'CARD' || method === 'ONLINE') card += amount;
          else cash += amount;

          const date = timeToUse.toDate();
          const hourStr = date.getHours().toString().padStart(2, '0') + ':00';
          
          if (!hourlyBuckets[hourStr]) hourlyBuckets[hourStr] = { time: hourStr, cash: 0, qr: 0, card: 0 };
          
          if (method === 'LANKAQR') hourlyBuckets[hourStr].qr += amount;
          else if (method === 'CARD' || method === 'ONLINE') hourlyBuckets[hourStr].card += amount;
          else hourlyBuckets[hourStr].cash += amount;
        }
      });

      setRevenueStats({ total: tot, qr, card, cash });
      
      const sortedChartData = Object.values(hourlyBuckets).sort((a, b) => a.time.localeCompare(b.time));
      if (sortedChartData.length > 0) {
        setChartData(sortedChartData);
      } else {
        setChartData([{ time: '00:00', cash: 0, qr: 0, card: 0 }]);
      }
    });
    return () => unsubscribeTrans();
  }, [timeFilter]); 

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">System Overview</h2>
          <p className="text-gray-500">Live analytics and financial tracking directly from driver bookings.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm self-start sm:self-auto">
          <span className="text-sm font-semibold text-gray-500">Timeframe:</span>
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            className="text-sm font-bold text-gray-800 bg-transparent outline-none cursor-pointer"
          >
            <option value="ALL_TIME">All Time</option>
            <option value="TODAY">Today Only</option>
            <option value="WEEK">This Week</option>
            <option value="MONTH">This Month</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 rounded-lg text-green-600"><TrendingUp size={28} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Total Revenue</p><p className="text-2xl font-bold text-gray-800">Rs. {revenueStats.total.toLocaleString()}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-lg text-blue-600"><QrCode size={28} /></div>
          <div><p className="text-sm text-gray-500 font-medium">LANKAQR</p><p className="text-2xl font-bold text-gray-800">Rs. {revenueStats.qr.toLocaleString()}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-purple-100 rounded-lg text-purple-600"><CreditCard size={28} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Card Payments</p><p className="text-2xl font-bold text-gray-800">Rs. {revenueStats.card.toLocaleString()}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-orange-100 rounded-lg text-orange-600"><Banknote size={28} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Cash Collected</p><p className="text-2xl font-bold text-gray-800">Rs. {revenueStats.cash.toLocaleString()}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Live Revenue Trend</h3>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold animate-pulse">● LIVE</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="time" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${v}`} />
                <Tooltip wrapperStyle={{ borderRadius: '8px' }} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="qr" name="LANKAQR" stroke="#3b82f6" strokeWidth={3} />
                <Line type="monotone" dataKey="card" name="Card" stroke="#a855f7" strokeWidth={3} />
                <Line type="monotone" dataKey="cash" name="Cash" stroke="#f97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Current Lot Occupancy (Verified)</h3>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold animate-pulse">● LIVE</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lotUsageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="capacity" name="Total Capacity" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="occupied" name="Currently Occupied" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. AI PREDICTIONS COMPONENT ---
const AIPredictions = () => {
  const [lots, setLots] = useState([]);
  const [predictions, setPredictions] = useState({});

  useEffect(() => {
    const verifiedLotsQuery = query(collection(db, 'parking_lots'), where('status', '==', 'VERIFIED'));
    const unsubscribe = onSnapshot(verifiedLotsQuery, (snapshot) => {
      const activeLots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLots(activeLots);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (lots.length === 0) return;

    const fetchPredictions = async () => {
      const newPredictions = {};
      
      await Promise.all(
        lots.map(async (lot) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          try {
            const mlUrl = `http://${window.location.hostname}:5000/predict_availability`;
            const response = await fetch(mlUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lot_id: lot.id, total_capacity: lot.capacity_total || 50 }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            newPredictions[lot.id] = data;
          } catch (error) {
            clearTimeout(timeoutId);
            newPredictions[lot.id] = { error: true, text: "Python Model Offline" };
          }
        })
      );
      setPredictions(newPredictions);
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 15000);
    return () => clearInterval(interval);
  }, [lots]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><BrainCircuit className="text-indigo-600"/> AI Predictive Analytics</h2>
        <p className="text-gray-500">Forecasting 30-minute capacity trends across all municipal zones using Random Forest ML.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lots.length === 0 && <p className="text-gray-500 col-span-3">No active parking lots to analyze.</p>}
        
        {lots.map(lot => {
          const pred = predictions[lot.id];
          const isFilling = pred?.trend === 'filling_up';
          const isOffline = pred?.error;

          return (
            <div key={lot.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{lot.name}</h3>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-bold">{lot.capacity_total} Total Spots</span>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={16} className="text-gray-400"/>
                <p className="text-sm text-gray-500">{lot.location_text || 'Zone Location'}</p>
              </div>

              <div className={`p-4 rounded-lg mt-4 ${isOffline ? 'bg-gray-100' : isFilling ? 'bg-red-50' : 'bg-indigo-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={18} className={isOffline ? 'text-gray-400' : isFilling ? 'text-red-600' : 'text-indigo-600'} />
                  <p className={`text-sm font-bold ${isOffline ? 'text-gray-500' : isFilling ? 'text-red-700' : 'text-indigo-700'}`}>
                    30-Minute AI Forecast
                  </p>
                </div>
                
                {isOffline ? (
                  <p className="text-gray-500 font-medium">Model Connection Failed</p>
                ) : (
                  <>
                    <p className="text-3xl font-black text-gray-900 mb-1">{pred?.predicted_available_spots} <span className="text-lg font-medium text-gray-500">Spots Left</span></p>
                    <div className="flex justify-between items-center mt-2">
                      <p className={`text-xs font-bold ${isFilling ? 'text-red-500' : 'text-indigo-500'}`}>Trend: {isFilling ? 'Congesting Rapidly' : 'Stable / Emptying'}</p>
                      <p className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">{pred?.accuracy_confidence} Confidence</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LocationMarker = ({ coords, setCoords }) => {
  useMapEvents({
    click(e) {
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return coords ? <Marker position={coords} /> : null;
};

// --- 4. LIVE USER MANAGEMENT COMPONENT ---
const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);

  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', phone: '', nic: '', role: 'DRIVER',
    parkName: '', parkLocation: '', 
    is247: true, openTime: '06:00 AM', closeTime: '10:00 PM',
  });
  
  const [isMapVisible, setMapVisible] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null); 
  const [tempCoords, setTempCoords] = useState(null); 

  const [licenseFile, setLicenseFile] = useState(null);
  const [spotFile, setSpotFile] = useState(null);

  const [spots, setSpots] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });
  const [rates, setRates] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });
  const [amenities, setAmenities] = useState({ hasCCTV: false, hasSecurity: false, isIndoor: false, hasRoof: false, isOutdoor: false });

  const [reviewUser, setReviewUser] = useState(null);
  const [reviewLotData, setReviewLotData] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [globalPricingLimits, setGlobalPricingLimits] = useState(null);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const mappedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mappedUsers.sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
        
        const getTimestamp = (val) => {
          if (!val) return 0;
          if (val.seconds !== undefined) return val.seconds;
          if (typeof val.toDate === 'function') return val.toDate().getTime() / 1000;
          return new Date(val).getTime() / 1000;
        };
        
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      });
      setUsers(mappedUsers);
    });

    const fetchPricing = async () => {
      const docRef = doc(db, 'system_settings', 'pricing');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setGlobalPricingLimits(docSnap.data());
    };
    fetchPricing();

    return () => unsubscribeUsers();
  }, []);

  const toggleAmenity = (key) => {
    setAmenities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenMap = () => {
    setMapVisible(true);
    if (!tempCoords) {
      setTempCoords({ lat: 7.2906, lng: 80.6337 });
    }
  };

  const handleAutoLocate = () => {
    setFetchingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTempCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setFetchingGps(false);
        },
        () => {
          alert("Ensure GPS/Location permission is granted in your browser.");
          setFetchingGps(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setFetchingGps(false);
    }
  };

  const uploadImageToLocalServer = async (file, prefix) => {
    try {
      const uploadData = new FormData();
      uploadData.append('photo', file, `${prefix}_${Date.now()}_${file.name}`);

      const res = await fetch(`${LOCAL_BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: uploadData,
      });
      
      const data = await res.json();
      return `${LOCAL_BACKEND_URL}${data.url}`; 
    } catch (err) {
      return null;
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault(); 
    
    if (formData.role === 'OWNER') {
      if (!gpsCoords) {
        return alert("Please set the Parking Lot Location using the map.");
      }

      if (globalPricingLimits) {
        const carVal = Number(rates.car) || 0;
        if (rates.car && (carVal < globalPricingLimits.car.min || carVal > globalPricingLimits.car.max)) return alert(`Car/Van rate must be between Rs. ${globalPricingLimits.car.min} and Rs. ${globalPricingLimits.car.max}`);
        const bikeVal = Number(rates.bike) || 0;
        if (rates.bike && (bikeVal < globalPricingLimits.bike.min || bikeVal > globalPricingLimits.bike.max)) return alert(`Bike/Scooter rate must be between Rs. ${globalPricingLimits.bike.min} and Rs. ${globalPricingLimits.bike.max}`);
        const tuktukVal = Number(rates.tuktuk) || 0;
        if (rates.tuktuk && (tuktukVal < globalPricingLimits.tuktuk.min || tuktukVal > globalPricingLimits.tuktuk.max)) return alert(`Tuk Tuk rate must be between Rs. ${globalPricingLimits.tuktuk.min} and Rs. ${globalPricingLimits.tuktuk.max}`);
        const lorryVal = Number(rates.lorry) || 0;
        if (rates.lorry && (lorryVal < globalPricingLimits.lorry.min || lorryVal > globalPricingLimits.lorry.max)) return alert(`Lorry rate must be between Rs. ${globalPricingLimits.lorry.min} and Rs. ${globalPricingLimits.lorry.max}`);
      }
    }

    setLoadingAdd(true);
    try {
      const tempAppName = `TempApp_${Date.now()}`;
      const secondaryApp = initializeApp(db.app.options, tempAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      await secondaryAuth.signOut();

      await setDoc(doc(db, 'users', uid), { 
        name: formData.name, 
        email: formData.email, 
        phone: formData.phone,
        nic: formData.nic,
        role: formData.role, 
        status: 'ACTIVE',
        adminMessage: 'Verified & Added by Super Admin',
        createdAt: serverTimestamp()
      });

      if (formData.role === 'OWNER') {
        let finalLicenseUrl = null;
        let finalSpotUrl = null;

        if (licenseFile) finalLicenseUrl = await uploadImageToLocalServer(licenseFile, 'license');
        if (spotFile) finalSpotUrl = await uploadImageToLocalServer(spotFile, 'spot');

        const vehiclesAllowed = [];
        if (Number(spots.car) > 0) vehiclesAllowed.push('CAR');
        if (Number(spots.bike) > 0) vehiclesAllowed.push('BIKE');
        if (Number(spots.tuktuk) > 0) vehiclesAllowed.push('TUKTUK');
        if (Number(spots.lorry) > 0) vehiclesAllowed.push('LORRY');

        const totalCap = (Number(spots.car)||0) + (Number(spots.bike)||0) + (Number(spots.tuktuk)||0) + (Number(spots.lorry)||0);

        await setDoc(doc(db, 'parking_lots', uid), {
          ownerId: uid, 
          ownerName: formData.name, 
          phone: formData.phone,
          name: formData.parkName, 
          location_text: formData.parkLocation,
          capacity_total: totalCap, 
          available_spots: totalCap,
          is_open: true, 
          status: 'VERIFIED', 
          adminMessage: 'Verified & Added by Super Admin',
          operating_hours: formData.is247 ? { open: '12:00 AM', close: '11:59 PM', is247: true } : { open: formData.openTime, close: formData.closeTime, is247: false },
          vehicle_spots: { CAR: Number(spots.car)||0, BIKE: Number(spots.bike)||0, TUKTUK: Number(spots.tuktuk)||0, LORRY: Number(spots.lorry)||0 },
          vehicle_rates: { CAR: Number(rates.car)||0, BIKE: Number(rates.bike)||0, TUKTUK: Number(rates.tuktuk)||0, LORRY: Number(rates.lorry)||0 },
          vehicles_allowed: vehiclesAllowed,
          amenities: amenities,
          business_license_uri: finalLicenseUrl, 
          spot_photo_uri: finalSpotUrl,
          latitude: gpsCoords.lat, 
          longitude: gpsCoords.lng
        });
      }

      setIsModalOpen(false);
      alert(`Success! The ${formData.role} can now log into the mobile app.`);
      
      setFormData({ name: '', email: '', password: '', phone: '', nic: '', role: 'DRIVER', parkName: '', parkLocation: '', is247: true, openTime: '06:00 AM', closeTime: '10:00 PM' });
      setSpots({ car: '', bike: '', tuktuk: '', lorry: '' });
      setRates({ car: '', bike: '', tuktuk: '', lorry: '' });
      setAmenities({ hasCCTV: false, hasSecurity: false, isIndoor: false, hasRoof: false, isOutdoor: false });
      setGpsCoords(null);
      setTempCoords(null);
      setLicenseFile(null);
      setSpotFile(null);

    } catch (err) { 
      alert("Error: " + err.message);
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleToggleSuspend = async (id, current) => {
    await updateDoc(doc(db, 'users', id), { status: current === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' });
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("Delete this user?")) await deleteDoc(doc(db, 'users', id));
  };

  const handleOpenUserDetails = async (user) => {
    setReviewUser(user);
    setAdminMessage(''); 
    
    if (user.role === 'OWNER') {
      try {
        const lotDoc = await getDoc(doc(db, 'parking_lots', user.id));
        if (lotDoc.exists()) {
          setReviewLotData({ id: lotDoc.id, ...lotDoc.data() });
        } else {
          const q = query(collection(db, 'parking_lots'), where('ownerId', '==', user.id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setReviewLotData({ id: snap.docs[0].id, ...snap.docs[0].data() });
          } else {
            setReviewLotData(null);
          }
        }
      } catch (error) { console.error("Error fetching lot data:", error); }
    } else {
      setReviewLotData(null); 
    }
    setIsReviewOpen(true);
  };

  const handleConfirmApprove = async () => {
    try {
      await updateDoc(doc(db, 'users', reviewUser.id), { status: 'ACTIVE', adminMessage: adminMessage });
      if (reviewLotData && reviewLotData.id) {
        await updateDoc(doc(db, 'parking_lots', reviewLotData.id), { status: 'VERIFIED', adminMessage: adminMessage });
      }
      setIsReviewOpen(false); setReviewUser(null); setReviewLotData(null);
    } catch (err) { console.error("Error approving user:", err); }
  };

  const handleRejectOrRequestChanges = async () => {
    try {
      await updateDoc(doc(db, 'users', reviewUser.id), { status: 'REJECTED', adminMessage: adminMessage || 'Your application was rejected. Please review and update your details.' });
      if (reviewLotData && reviewLotData.id) {
        await updateDoc(doc(db, 'parking_lots', reviewLotData.id), { status: 'REJECTED', adminMessage: adminMessage || 'Your application was rejected. Please review and update your details.' });
      }
      setIsReviewOpen(false); setReviewUser(null); setReviewLotData(null);
    } catch (err) { console.error("Error rejecting user:", err); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <div className="mb-8 flex justify-between items-end">
        <div><h2 className="text-3xl font-bold text-gray-800">User Management</h2><p className="text-gray-500">RBAC Controls & Approvals.</p></div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">+ Add New User</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-gray-100 text-gray-500 text-sm">
            <tr><th className="p-4">Name / Email</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4"><b>{user.name}</b><br/><span className="text-sm text-gray-500">{user.email}</span></td>
                <td className="p-4"><span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{user.role}</span></td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold 
                    ${user.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 
                      user.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 
                      user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-green-100 text-green-700'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="p-4 flex justify-end items-center gap-2">
                  {(user.status === 'PENDING' || user.status === 'REJECTED') && user.role === 'OWNER' ? (
                    <button onClick={() => handleOpenUserDetails(user)} className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-yellow-600 transition-colors">Review App</button>
                  ) : (
                    <button onClick={() => handleOpenUserDetails(user)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="View Details"><Eye size={18} /></button>
                  )}
                  <button onClick={() => handleToggleSuspend(user.id, user.status)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg">{user.status === 'SUSPENDED' ? <UserCheck size={18}/> : <UserX size={18}/>}</button>
                  <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isReviewOpen && reviewUser && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-2xl font-bold text-gray-800">
                {(reviewUser.status === 'PENDING' || reviewUser.status === 'REJECTED') && reviewUser.role === 'OWNER' ? 'Review Owner Application' : 'User Profile Details'}
              </h3>
              <button onClick={() => setIsReviewOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">X</button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-sm font-bold text-blue-600 uppercase mb-3">User Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500 block">Full Name:</span> <span className="font-bold">{reviewUser.name || 'N/A'}</span></div>
                  <div><span className="text-gray-500 block">Email:</span> <span className="font-bold">{reviewUser.email}</span></div>
                  <div><span className="text-gray-500 block">Phone:</span> <span className="font-bold">{reviewUser.phone || 'N/A'}</span></div>
                  <div><span className="text-gray-500 block">NIC Number:</span> <span className="font-bold">{reviewUser.nic || 'N/A'}</span></div>
                  <div><span className="text-gray-500 block">System Role:</span> <span className="font-bold">{reviewUser.role}</span></div>
                  <div><span className="text-gray-500 block">Current Status:</span> <span className="font-bold">{reviewUser.status}</span></div>
                </div>
              </div>

              {reviewUser.role === 'OWNER' && (
                reviewLotData ? (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <h4 className="text-sm font-bold text-blue-600 uppercase mb-3">Parking Lot Details</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div><span className="text-gray-500 block">Lot Name:</span> <span className="font-bold">{reviewLotData.name}</span></div>
                      <div><span className="text-gray-500 block">Location:</span> <span className="font-bold">{reviewLotData.location_text}</span></div>
                      <div><span className="text-gray-500 block">Total Capacity:</span> <span className="font-bold">{reviewLotData.capacity_total} Spots</span></div>
                      <div>
                        <span className="text-gray-500 block">Operating Hours:</span> 
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {reviewLotData.operating_hours?.is247 
                            ? 'Open 24/7' 
                            : `${reviewLotData.operating_hours?.open || 'N/A'} - ${reviewLotData.operating_hours?.close || 'N/A'}`}
                        </span>
                      </div>
                    </div>

                    <div className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                          <tr><th className="p-3 font-bold">Vehicle Type</th><th className="p-3 font-bold text-center">Declared Spots</th><th className="p-3 font-bold text-center">Hourly Rate</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr><td className="p-3 font-medium">🚗 car/van</td><td className="p-3 text-center">{reviewLotData.vehicle_spots?.CAR || 0}</td><td className="p-3 text-center text-blue-600 font-bold">Rs. {reviewLotData.vehicle_rates?.CAR || 0}</td></tr>
                          <tr><td className="p-3 font-medium">🏍️ bike/scooter</td><td className="p-3 text-center">{reviewLotData.vehicle_spots?.BIKE || 0}</td><td className="p-3 text-center text-blue-600 font-bold">Rs. {reviewLotData.vehicle_rates?.BIKE || 0}</td></tr>
                          <tr><td className="p-3 font-medium">🛺 tuk tuk</td><td className="p-3 text-center">{reviewLotData.vehicle_spots?.TUKTUK || 0}</td><td className="p-3 text-center text-blue-600 font-bold">Rs. {reviewLotData.vehicle_rates?.TUKTUK || 0}</td></tr>
                          <tr><td className="p-3 font-medium">🚚 lorry</td><td className="p-3 text-center">{reviewLotData.vehicle_spots?.LORRY || 0}</td><td className="p-3 text-center text-blue-600 font-bold">Rs. {reviewLotData.vehicle_rates?.LORRY || 0}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mb-4">
                      <span className="text-gray-500 block mb-2 text-sm">Declared Amenities:</span>
                      <div className="flex gap-2 flex-wrap">
                        {reviewLotData.amenities?.hasCCTV && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">CCTV</span>}
                        {reviewLotData.amenities?.hasSecurity && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Security</span>}
                        {reviewLotData.amenities?.isIndoor && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Indoor</span>}
                        {reviewLotData.amenities?.hasRoof && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Covered Roof</span>}
                        {reviewLotData.amenities?.isOutdoor && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Outdoor/Road</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <span className="text-gray-500 block mb-2 text-sm">Business License <span className="text-xs text-blue-500">(Click to zoom)</span>:</span>
                        {reviewLotData.business_license_uri ? (
                          <img 
                            src={reviewLotData.business_license_uri} 
                            alt="License" 
                            className="w-full h-40 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition" 
                            onClick={() => setFullscreenImage(reviewLotData.business_license_uri)}
                          />
                        ) : <div className="w-full h-40 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs border border-gray-300 border-dashed">No File</div>}
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-2 text-sm">Spot Photo <span className="text-xs text-blue-500">(Click to zoom)</span>:</span>
                        {reviewLotData.spot_photo_uri ? (
                          <img 
                            src={reviewLotData.spot_photo_uri} 
                            alt="Spot" 
                            className="w-full h-40 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition" 
                            onClick={() => setFullscreenImage(reviewLotData.spot_photo_uri)}
                          />
                        ) : <div className="w-full h-40 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs border border-gray-300 border-dashed">No Photo</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100"><AlertCircle size={16} className="inline mr-2" />Warning: No corresponding business lot files exist.</div>
                )
              )}

              {(reviewUser.status === 'PENDING' || reviewUser.status === 'REJECTED') && reviewUser.role === 'OWNER' && (
                <div className="mt-6">
                  <label className="text-gray-700 block mb-2 text-sm font-bold">Message to Owner (Will appear on their Mobile Dashboard):</label>
                  <textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows="3" placeholder="E.g., Please clarify your opening time metrics." value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)}></textarea>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-4 bg-gray-50 rounded-b-xl">
              <button onClick={() => setIsReviewOpen(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-100 transition">Close Profile</button>
              {(reviewUser.status === 'PENDING' || reviewUser.status === 'REJECTED') && reviewUser.role === 'OWNER' && (
                <>
                  <button onClick={handleRejectOrRequestChanges} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">Reject / Request Changes</button>
                  <button onClick={handleConfirmApprove} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">Approve & Activate Owner</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 bg-slate-900/95 flex items-center justify-center z-[100] p-4 cursor-pointer" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-full max-h-full flex items-center justify-center p-4">
            <button className="absolute -top-12 right-0 text-white hover:text-gray-300 font-bold text-3xl" onClick={() => setFullscreenImage(null)}>&times;</button>
            <img src={fullscreenImage} alt="Lightbox View" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-40 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-8 w-full max-w-3xl my-auto max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-2xl font-bold mb-2 text-gray-800">Add New User <span className="text-sm font-normal text-blue-500 bg-blue-50 px-2 py-1 rounded">(Instant Admin Approval)</span></h3>
            <p className="text-sm text-gray-500 mb-6 border-b border-gray-100 pb-4">Accounts created here bypass the standard review queue.</p>
            
            <form onSubmit={handleAddUser} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign System Role</label>
                <select className="w-full border border-gray-300 p-3 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                  <option value="DRIVER">Driver</option>
                  <option value="OWNER">Park Owner</option>
                </select>
              </div>

              <div>
                <h4 className="text-sm font-bold text-blue-600 uppercase mb-3">1. Personal Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Full Name" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  <input type="email" placeholder="Email Address" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  <input type="password" placeholder="Account Password" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                  <input type="text" placeholder="Phone Number" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  <input type="text" placeholder="NIC Number" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500" value={formData.nic} onChange={(e) => setFormData({...formData, nic: e.target.value})} />
                </div>
              </div>

              {formData.role === 'OWNER' && (
                <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-blue-600 uppercase mb-3">2. Business Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input type="text" placeholder="Parking Lot Name" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500 bg-white" value={formData.parkName} onChange={(e) => setFormData({...formData, parkName: e.target.value})} />
                      <input type="text" placeholder="Location Address" required className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:border-blue-500 bg-white" value={formData.parkLocation} onChange={(e) => setFormData({...formData, parkLocation: e.target.value})} />
                    </div>

                    <div className="mb-4">
                      <button type="button" onClick={handleOpenMap} className={`w-full p-4 border-2 border-dashed rounded-lg font-bold transition-colors ${gpsCoords ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-400 bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>{gpsCoords ? '✅ Parking Lot Location Saved (Click to Edit)' : '📍 Set Parking Lot Location (Required)'}</button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Official Documents</h4>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-white p-3 rounded-lg border border-gray-300">
                        <label className="text-xs font-bold text-gray-500 block mb-2">📄 Business License</label>
                        <input type="file" accept="image/*" onChange={(e) => setLicenseFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      </div>
                      <div className="flex-1 bg-white p-3 rounded-lg border border-gray-300">
                        <label className="text-xs font-bold text-gray-500 block mb-2">📸 Photo of Park</label>
                        <input type="file" accept="image/*" onChange={(e) => setSpotFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Operating Hours</h4>
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={formData.is247} onChange={(e) => setFormData({...formData, is247: e.target.checked})} />
                      <span className="font-medium text-gray-800">Park is open 24/7</span>
                    </label>
                    {!formData.is247 && (
                      <div className="flex gap-4">
                        <div className="flex-1"><label className="text-xs text-gray-500 font-bold mb-1 block">Open Time</label><input type="text" placeholder="06:00 AM" className="w-full border border-gray-300 p-3 rounded-lg bg-white" value={formData.openTime} onChange={(e) => setFormData({...formData, openTime: e.target.value})} /></div>
                        <div className="flex-1"><label className="text-xs text-gray-500 font-bold mb-1 block">Close Time</label><input type="text" placeholder="10:00 PM" className="w-full border border-gray-300 p-3 rounded-lg bg-white" value={formData.closeTime} onChange={(e) => setFormData({...formData, closeTime: e.target.value})} /></div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Vehicle Capacities & Rates</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <div className="flex bg-gray-100 p-3 border-b border-gray-200">
                        <div className="flex-[2] text-xs font-bold text-gray-500 uppercase">Vehicle Type</div>
                        <div className="flex-1 text-xs font-bold text-gray-500 uppercase text-center">Spots</div>
                        <div className="flex-1 text-xs font-bold text-gray-500 uppercase text-center">Rate (Rs/hr)</div>
                      </div>
                      
                      <div className="flex items-center p-3 border-b border-gray-100">
                        <div className="flex-[2] font-medium text-gray-800">🚗 car/van</div>
                        <div className="flex-1 px-2"><input type="number" placeholder="0" className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={spots.car} onChange={e => setSpots({...spots, car: e.target.value})} /></div>
                        <div className="flex-1 px-2"><input type="number" placeholder={globalPricingLimits ? `${globalPricingLimits.car.min}-${globalPricingLimits.car.max}` : "Rs"} className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={rates.car} onChange={e => setRates({...rates, car: e.target.value})} /></div>
                      </div>
                      <div className="flex items-center p-3 border-b border-gray-100">
                        <div className="flex-[2] font-medium text-gray-800">🏍️ bike/scooter</div>
                        <div className="flex-1 px-2"><input type="number" placeholder="0" className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={spots.bike} onChange={e => setSpots({...spots, bike: e.target.value})} /></div>
                        <div className="flex-1 px-2"><input type="number" placeholder={globalPricingLimits ? `${globalPricingLimits.bike.min}-${globalPricingLimits.bike.max}` : "Rs"} className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={rates.bike} onChange={e => setRates({...rates, bike: e.target.value})} /></div>
                      </div>
                      <div className="flex items-center p-3 border-b border-gray-100">
                        <div className="flex-[2] font-medium text-gray-800">🛺 tuk tuk</div>
                        <div className="flex-1 px-2"><input type="number" placeholder="0" className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={spots.tuktuk} onChange={e => setSpots({...spots, tuktuk: e.target.value})} /></div>
                        <div className="flex-1 px-2"><input type="number" placeholder={globalPricingLimits ? `${globalPricingLimits.tuktuk.min}-${globalPricingLimits.tuktuk.max}` : "Rs"} className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={rates.tuktuk} onChange={e => setRates({...rates, tuktuk: e.target.value})} /></div>
                      </div>
                      <div className="flex items-center p-3">
                        <div className="flex-[2] font-medium text-gray-800">🚚 lorry</div>
                        <div className="flex-1 px-2"><input type="number" placeholder="0" className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={spots.lorry} onChange={e => setSpots({...spots, lorry: e.target.value})} /></div>
                        <div className="flex-1 px-2"><input type="number" placeholder={globalPricingLimits ? `${globalPricingLimits.lorry.min}-${globalPricingLimits.lorry.max}` : "Rs"} className="w-full border border-gray-300 rounded p-2 text-center outline-none" value={rates.lorry} onChange={e => setRates({...rates, lorry: e.target.value})} /></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Facility Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => toggleAmenity('hasCCTV')} className={`px-3 py-2 border rounded-lg text-sm font-bold transition-colors ${amenities.hasCCTV ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>📷 CCTV</button>
                      <button type="button" onClick={() => toggleAmenity('hasSecurity')} className={`px-3 py-2 border rounded-lg text-sm font-bold transition-colors ${amenities.hasSecurity ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>👮 Security</button>
                      <button type="button" onClick={() => toggleAmenity('isIndoor')} className={`px-3 py-2 border rounded-lg text-sm font-bold transition-colors ${amenities.isIndoor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>🏢 Indoor</button>
                      <button type="button" onClick={() => toggleAmenity('hasRoof')} className={`px-3 py-2 border rounded-lg text-sm font-bold transition-colors ${amenities.hasRoof ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>☂️ Covered Roof</button>
                      <button type="button" onClick={() => toggleAmenity('isOutdoor')} className={`px-3 py-2 border rounded-lg text-sm font-bold transition-colors ${amenities.isOutdoor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>🛣️ Outdoor</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold p-3 rounded-lg hover:bg-gray-200 transition">Cancel</button>
                <button type="submit" disabled={loadingAdd} className="flex-1 bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50">{loadingAdd ? 'Creating...' : 'Register User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMapVisible && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col">
            <div className="p-6 text-center border-b border-gray-100">
              <h3 className="text-2xl font-black text-gray-800">Pinpoint Your Lot</h3>
              <p className="text-sm text-gray-500 mt-1">Drag and tap anywhere on the map to set your exact entrance, or use Auto-Locate.</p>
            </div>
            
            <div className="w-full h-80 relative bg-gray-100">
              {tempCoords ? (
                <MapContainer center={[tempCoords.lat, tempCoords.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                  <LocationMarker coords={tempCoords} setCoords={setTempCoords} />
                </MapContainer>
              ) : <div className="w-full h-full flex items-center justify-center text-gray-400">Loading Map...</div>}
            </div>

            <div className="p-6 bg-gray-50 flex flex-col gap-3">
              <button type="button" onClick={handleAutoLocate} disabled={fetchingGps} className="w-full bg-blue-50 border border-blue-200 text-blue-600 font-bold py-3 rounded-xl hover:bg-blue-100 transition flex justify-center items-center gap-2">
                {fetchingGps ? 'Locating...' : '🎯 Auto-Locate Me'}
              </button>
              <button type="button" disabled={!tempCoords} onClick={() => { setGpsCoords(tempCoords); setMapVisible(false); }} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-200 disabled:opacity-50">Confirm & Save Location</button>
              <button type="button" onClick={() => setMapVisible(false)} className="text-red-500 font-bold py-2 mt-1 hover:text-red-600 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 5. GLOBAL PRICE CONTROL COMPONENT ---
const PriceControl = () => {
  const [pricing, setPricing] = useState({
    car: { min: 0, max: 300 },
    bike: { min: 0, max: 150 },
    tuktuk: { min: 0, max: 200 },
    lorry: { min: 0, max: 500 }
  });
  const [timeIncrement, setTimeIncrement] = useState('1 Hour'); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const vehicleLabels = { car: 'car/van', bike: 'bike/scooter', tuktuk: 'tuk tuk', lorry: 'lorry' };
  const vehicleIcons = { car: '🚗', bike: '🏍️', tuktuk: '🛺', lorry: '🚚' };

  useEffect(() => {
    const fetchPricing = async () => {
      const docRef = doc(db, 'system_settings', 'pricing');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPricing({
          car: data.car || { min: 0, max: 300 },
          bike: data.bike || { min: 0, max: 150 },
          tuktuk: data.tuktuk || { min: 0, max: 200 },
          lorry: data.lorry || { min: 0, max: 500 }
        });
        if (data.timeIncrement) setTimeIncrement(data.timeIncrement);
      }
      setLoading(false);
    };
    fetchPricing();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'pricing'), { ...pricing, timeIncrement }, { merge: true });
      alert("Global price limits updated successfully!");
    } catch (error) {
      alert("Failed to save price controls.");
    }
    setSaving(false);
  };

  const handleChange = (vehicle, type, value) => {
    setPricing(prev => ({ ...prev, [vehicle]: { ...prev[vehicle], [type]: Number(value) } }));
  };

  if (loading) return <div className="p-6 text-gray-500">Loading price settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Global Price Control</h2>
        <p className="text-gray-500">Set the minimum and maximum rates (LKR) that owners can legally charge.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* NEW: TIME INCREMENT CONFIG */}
        <div className="p-6 border-b border-gray-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div>
              <h3 className="font-bold text-gray-800">Base Time Increment</h3>
              <p className="text-xs text-gray-500">Configure the time period these prices apply to.</p>
           </div>
           <select 
              value={timeIncrement} 
              onChange={(e) => setTimeIncrement(e.target.value)} 
              className="p-3 rounded-lg border border-gray-300 font-bold text-gray-800 outline-none focus:border-blue-500"
           >
              <option value="1 Hour">Per 1 Hour</option>
              <option value="30 Minutes">Per 30 Minutes</option>
              <option value="Day">Per Day</option>
           </select>
        </div>

        <div className="p-6 space-y-6">
          {['car', 'bike', 'tuktuk', 'lorry'].map(v => (
            <div key={v} className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-6 last:border-0 last:pb-0 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl">{vehicleIcons[v]}</div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800 capitalize">{vehicleLabels[v]}</h3>
                  <p className="text-xs text-gray-500">Municipal limits {timeIncrement === '1 Hour' ? 'per hour' : `per ${timeIncrement}`}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Min Price (Rs.)</label>
                  <input type="number" className="border border-gray-300 p-3 rounded-lg w-28 text-center font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" value={pricing[v].min} onChange={e => handleChange(v, 'min', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Max Price (Rs.)</label>
                  <input type="number" className="border border-gray-300 p-3 rounded-lg w-28 text-center font-bold text-red-600 focus:ring-2 focus:ring-red-500 outline-none" value={pricing[v].max} onChange={e => handleChange(v, 'max', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">{saving ? 'Saving to Database...' : 'Save Global Price Limits'}</button>
        </div>
      </div>
    </div>
  );
};

// --- 6. CONGESTION HEATMAP COMPONENT ---
const CongestionMap = () => {
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    const verifiedLotsQuery = query(collection(db, 'parking_lots'), where('status', '==', 'VERIFIED'));
    const unsubscribe = onSnapshot(verifiedLotsQuery, (snapshot) => {
      const processedLots = snapshot.docs.map(doc => {
        const data = doc.data();
        const capacity = data.capacity_total || 50;
        const available = data.available_spots !== undefined ? data.available_spots : capacity;
        const occupied = capacity - available;
        const percentage = Math.round((occupied / capacity) * 100);
        
        let statusColor = 'bg-green-500'; let textColor = 'text-green-600'; let bgColor = 'bg-green-50'; let borderColor = 'border-green-200'; let statusText = 'Optimal';

        if (percentage >= 85) {
          statusColor = 'bg-red-500'; textColor = 'text-red-600'; bgColor = 'bg-red-50'; borderColor = 'border-red-200'; statusText = 'Critical';
        } else if (percentage >= 50) {
          statusColor = 'bg-orange-500'; textColor = 'text-orange-600'; bgColor = 'bg-orange-50'; borderColor = 'border-orange-200'; statusText = 'Warning';
        }

        return { id: doc.id, name: data.name || doc.id, capacity, available, occupied, percentage, statusColor, textColor, bgColor, borderColor, statusText };
      });
      setHeatmapData(processedLots.sort((a, b) => b.percentage - a.percentage));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">City Congestion Heatmap</h2>
        <p className="text-gray-500">Live grid monitoring of parking zone capacities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {heatmapData.length === 0 ? (
           <div className="col-span-full p-12 text-center text-gray-400">
             <Flame size={48} className="mx-auto mb-4 opacity-20" />
             <p>No parking zones connected yet.</p>
           </div>
        ) : (
          heatmapData.map((zone) => (
            <div key={zone.id} className={`p-6 rounded-2xl border-2 ${zone.borderColor} ${zone.bgColor} transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className={`text-xl font-bold ${zone.textColor}`}>{zone.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${zone.statusColor} animate-pulse`}>{zone.statusText}</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Available Spots</p>
                  <p className="text-3xl font-black text-slate-800">{zone.available}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-700">{zone.occupied} Occupied</p>
                  <p className="text-sm text-gray-500">{zone.capacity} Total Spots</p>
                </div>
              </div>
              <div className="w-full bg-white/50 rounded-full h-4 overflow-hidden border border-white/50">
                <div className={`h-4 rounded-full transition-all duration-1000 ease-out ${zone.statusColor}`} style={{ width: `${zone.percentage}%` }}></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- 🔥 7. NEW: ADMIN BROADCAST CENTER COMPONENT 🔥 ---
const BroadcastCenter = () => {
  const [targetType, setTargetType] = useState('ALL'); // ALL, DRIVER, OWNER, SPECIFIC
  const [specificEmail, setSpecificEmail] = useState('');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!msgTitle.trim() || !msgBody.trim()) return alert("Please fill title and body content.");

    setSending(true);
    try {
      let targetedUid = null;

      // Locate specific user target if applicable
      if (targetType === 'SPECIFIC') {
        if (!specificEmail.trim()) {
          setSending(false);
          return alert("Please supply a valid user target email.");
        }
        const userQuery = query(collection(db, 'users'), where('email', '==', specificEmail.trim().toLowerCase()));
        const snapshot = await getDocs(userQuery);
        if (snapshot.empty) {
          setSending(false);
          return alert("Target email not found in active database directory.");
        }
        targetedUid = snapshot.docs[0].id;
      }

      // Log configuration bundle down to global messaging queue collection
      await addDoc(collection(db, 'announcements'), {
        title: msgTitle.trim(),
        body: msgBody.trim(),
        target: targetType, 
        targetUid: targetedUid,
        timestamp: serverTimestamp(),
        sender: 'SUPER_ADMIN'
      });

      alert("🚀 Message Broadcast successfully routed to all active inboxes!");
      setMsgTitle('');
      setMsgBody('');
      setSpecificEmail('');
    } catch (err) {
      alert("Broadcast transmission exception: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><Mail className="text-blue-600"/> Broadcast Command Center</h2>
        <p className="text-gray-500">Dispatch instant notifications and messages directly into mobile application user inboxes.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSendBroadcast} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Target Audience Group</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'ALL', label: '👥 All Users' },
                { key: 'DRIVER', label: '🚗 Drivers' },
                { key: 'OWNER', label: '🅿️ Lot Owners' },
                { key: 'SPECIFIC', label: '🎯 Isolated Account' }
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTargetType(opt.key)}
                  className={`p-3 border rounded-xl font-semibold text-sm transition-all ${targetType === opt.key ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {targetType === 'SPECIFIC' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fadeIn">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Account Email Reference</label>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="driver@gmail.com"
                  className="flex-1 border border-gray-300 p-3 rounded-lg outline-none bg-white text-sm focus:border-blue-500 font-medium"
                  value={specificEmail}
                  onChange={(e) => setSpecificEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notification Header / Title</label>
            <input 
              type="text" 
              placeholder="E.g., System Update Maintenance Notice"
              className="w-full border border-gray-300 p-3 rounded-lg outline-none text-sm focus:border-blue-500 font-medium"
              value={msgTitle}
              onChange={(e) => setMsgTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Message Body Content</label>
            <textarea 
              placeholder="Write the text configuration message here..."
              rows="5"
              className="w-full border border-gray-300 p-3 rounded-lg outline-none text-sm focus:border-blue-500 font-medium"
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              required
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={sending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-200 flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <Send size={18} /> {sending ? 'Transmitting Data Arrays...' : 'Transmit Global Broadcast Message'}
          </button>
        </form>
      </div>
    </div>
  );
};


// --- 8. MAIN APP LAYOUT (Sidebar Router Wrapper Tree) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const SidebarLink = ({ to, icon: Icon, label, colorClass }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
      <Link to={to} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-slate-800' : 'hover:bg-slate-800 group'}`}>
        <Icon className={`w-6 h-6 shrink-0 ${colorClass || (isActive ? 'text-white' : 'text-blue-400')}`} />
        <span className={isActive ? 'text-white font-bold' : 'text-slate-300'}>{label}</span>
      </Link>
    );
  };

  if (loading) return <div className="h-screen bg-slate-900 flex items-center justify-center text-white font-bold">Initializing Zlot...</div>;
  if (!user) return <Login />;

  return (
    <Router>
      <div className="flex h-screen bg-gray-50 font-sans">
        
        <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-3xl font-extrabold text-blue-500 tracking-tight">Zlot.</h1>
            <p className="text-slate-400 text-sm mt-1">Super Admin Portal</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <SidebarLink to="/" icon={LayoutDashboard} label="Overview" />
            <SidebarLink to="/ai-predictions" icon={BrainCircuit} label="AI Analytics" colorClass="text-indigo-400 group-hover:text-indigo-300" />
            <SidebarLink to="/heatmap" icon={Flame} label="Live Heatmap" colorClass="text-orange-400 group-hover:text-red-500" />
            <SidebarLink to="/users" icon={Users} label="User Management" />
            <SidebarLink to="/broadcast" icon={Mail} label="Broadcast Center" colorClass="text-emerald-400 group-hover:text-emerald-300" />
            <SidebarLink to="/price-control" icon={Banknote} label="Price Control" />
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button onClick={() => signOut(auth)} className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-red-900/50 text-red-400 transition-colors">
              <LogOut className="w-6 h-6 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
            <div className="text-gray-500 font-medium">City Command Center</div>
            <div className="flex items-center gap-3 text-right">
              <div><p className="text-sm font-bold text-gray-800">Super Admin</p><p className="text-xs text-green-500 font-medium">● Online</p></div>
              <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold border-2 border-blue-500">A</div>
            </div>
          </header>

          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/ai-predictions" element={<AIPredictions />} />
            <Route path="/heatmap" element={<CongestionMap />} />
            <Route path="/users" element={<ManageUsers />} />
            <Route path="/broadcast" element={<BroadcastCenter />} />
            <Route path="/price-control" element={<PriceControl />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
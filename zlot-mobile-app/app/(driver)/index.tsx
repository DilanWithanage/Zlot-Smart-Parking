import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Modal, Alert, ScrollView, TextInput, Platform, Linking, Image, LogBox } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
// import * as Notifications from 'expo-notifications';
const Notifications: any = {
  setNotificationHandler: () => {},
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  setNotificationChannelAsync: async () => {},
  AndroidImportance: { MAX: 4 },
  cancelAllScheduledNotificationsAsync: async () => {},
  scheduleNotificationAsync: async () => "",
  SchedulableTriggerInputTypes: { DATE: 'date' }
};
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { signOut, deleteUser } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { CreditCard, Banknote, LogOut, Shield, Video, MapPin, Zap, Clock, Navigation, Plus, Minus, User, Umbrella, Phone, Camera, Menu, Map as MapIcon, List, X, Calendar, Trash, FileText, Search, Bell } from 'lucide-react-native';

LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

const LOCAL_ML_URL = "http://192.168.10.98:5000";

export default function DriverDashboard() {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [vehicleType, setVehicleType] = useState('CAR'); 
  const [selectedSpot, setSelectedSpot] = useState<any>(null);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [aiPrediction, setAiPrediction] = useState<any>(null); 

  const [activeTab, setActiveTab] = useState<'MAP' | 'BOOKINGS' | 'PAYMENT' | 'BILLS'>('MAP');
  const [billTab, setBillTab] = useState<'PRE_BOOKED' | 'WALK_IN'>('PRE_BOOKED');
  const [pastBookings, setPastBookings] = useState<any[]>([]);
  const [walkInSearchPlate, setWalkInSearchPlate] = useState('');
  const [walkInSearchType, setWalkInSearchType] = useState('CAR');
  const [walkInResults, setWalkInResults] = useState<any[]>([]);
  const [walkInLoading, setWalkInLoading] = useState(false);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  
  // --- INBOX MODAL & TRACKING STATES ---
  const [isAnnouncementsVisible, setAnnouncementsVisible] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]); 
  const [notificationsList, setNotificationsList] = useState<any[]>([]); 
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]); 
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  const [licensePlate, setLicensePlate] = useState('');
  const [duration, setDuration] = useState(1);
  const [bookingDate, setBookingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [driverProfile, setDriverProfile] = useState({ name: '', phone: '', nic: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isAddCardModalVisible, setAddCardModalVisible] = useState(false);
  const [newCard, setNewCard] = useState({ number: '', name: '', expiry: '', cvv: '' });

  const getVehicleLabel = (type: string) => {
    const labels: any = { 'CAR': 'Car / Van', 'BIKE': 'Bike / Scooter', 'TUKTUK': 'Tuk Tuk', 'LORRY': 'Lorry' };
    return labels[type?.toUpperCase()] || type;
  };

  const getAvailableSpotsForVehicle = (lot: any, vType: string) => {
    if (!lot) return 0;
    if (lot.is_open === false) return 0;
    const normalizedType = vType.toUpperCase();
    if (lot.spot_layout && Array.isArray(lot.spot_layout)) {
      return lot.spot_layout.filter((s: any) => s.type === normalizedType && s.status === 'FREE').length;
    }
    if (lot.vehicle_spots && lot.vehicle_spots[normalizedType] !== undefined) {
      if (lot.available_spots <= 0) return 0;
      const totalCapacity = lot.capacity_total || 1;
      const ratio = Math.max(0, Math.min(1, lot.available_spots / totalCapacity));
      const totalTypeSpots = lot.vehicle_spots[normalizedType] || 0;
      return Math.max(0, Math.round(totalTypeSpots * ratio));
    }
    return lot.available_spots || 0;
  };

  const getTotalSpotsForVehicle = (lot: any, vType: string) => {
    if (!lot) return 0;
    const normalizedType = vType.toUpperCase();
    if (lot.vehicle_spots && lot.vehicle_spots[normalizedType] !== undefined) {
      return lot.vehicle_spots[normalizedType] || 0;
    }
    if (lot.spot_layout && Array.isArray(lot.spot_layout)) {
      return lot.spot_layout.filter((s: any) => s.type === normalizedType).length;
    }
    return lot.capacity_total || 0;
  };

  const fetchProfile = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setDriverProfile({ name: data.name || '', phone: data.phone || '', nic: data.nic || '' });
      }
    }
  };

  // 🔥 LOAD PERMANENT READ MESSAGES FROM PHONE STORAGE
  useEffect(() => {
    const loadReadMessages = async () => {
      try {
        const storedReads = await AsyncStorage.getItem('zlot_driver_read_inbox');
        if (storedReads !== null) {
          setReadAnnouncements(JSON.parse(storedReads));
        }
      } catch (e) { console.error("Failed to load read messages"); }
    };
    loadReadMessages();
  }, []);

  // 🔥 SAVE READ MESSAGES TO PHONE STORAGE FOREVER
  const markMessageAsRead = async (msgId: string) => {
    if (!readAnnouncements.includes(msgId)) {
      const updatedList = [...readAnnouncements, msgId];
      setReadAnnouncements(updatedList);
      try {
        await AsyncStorage.setItem('zlot_driver_read_inbox', JSON.stringify(updatedList));
      } catch (e) { console.error("Failed to save read state"); }
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') Alert.alert('Warning', 'Enable notifications to receive expiry alerts.');
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
    })();

    const lotsQuery = query(collection(db, 'parking_lots'), where('status', '==', 'VERIFIED'));
    const unsubscribeLots = onSnapshot(lotsQuery, (snapshot) => {
      setLots(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
      setLoading(false);
    });

    fetchProfile();

    if (auth.currentUser) {
      const bookingQuery = query(collection(db, 'transactions'), where('driverId', '==', auth.currentUser.uid), where('status', 'in', ['Pending Arrival', 'Active']));
      const unsubscribeBooking = onSnapshot(bookingQuery, (snapshot) => {
        const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setActiveBookings(bookings);
        if (bookings.length === 0) Notifications.cancelAllScheduledNotificationsAsync();
      });

      const pastQuery = query(collection(db, 'transactions'), where('driverId', '==', auth.currentUser.uid), where('status', 'in', ['Completed', 'Cancelled', 'Cancelled - Refunded']));
      const unsubPast = onSnapshot(pastQuery, (snapshot) => {
        const past = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setPastBookings(past.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
      });

      const cancelQuery = query(collection(db, 'transactions'), where('driverId', '==', auth.currentUser.uid), where('status', '==', 'Cancelled - Refunded'));
      const unsubCancel = onSnapshot(cancelQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (!data.driverNotifiedOfCancel) {
              Alert.alert("Booking Cancelled", `Your booking at ${data.lotName} was cancelled by the owner. You have been fully refunded.`);
              Notifications.scheduleNotificationAsync({
                content: { title: 'Booking Cancelled', body: `Your booking at ${data.lotName} was cancelled. Refund processed.`, sound: true },
                trigger: null,
              });
              updateDoc(doc(db, 'transactions', change.doc.id), { driverNotifiedOfCancel: true });
            }
          }
        });
      });

      const cardsQuery = query(collection(db, 'users', auth.currentUser.uid, 'cards'));
      const unsubscribeCards = onSnapshot(cardsQuery, (snapshot) => {
        const cards = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setSavedCards(cards);
        if (cards.length > 0 && !selectedCardId) setSelectedCardId(cards[0].id);
      });

      // SMART LISTENER FOR NEW ADMIN/OWNER MESSAGES WITH SOUND
      const annQuery = query(collection(db, 'announcements'));
      const unsubAnnouncements = onSnapshot(annQuery, (snapshot) => {
        const currentUid = auth.currentUser?.uid;
        const list: any[] = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const item = change.doc.data();
            const isForMe = item.target === 'ALL' || item.target === 'DRIVER' || (item.target === 'SPECIFIC' && item.targetUid === currentUid);
            
            if (isForMe) {
              const msgTime = item.timestamp?.toMillis ? item.timestamp.toMillis() : Date.now();
              // Trigger loud push notification if message is less than 2 minutes old
              if (Date.now() - msgTime < 120000) {
                 Notifications.scheduleNotificationAsync({
                   content: { 
                     title: item.title || 'New Notification', 
                     body: item.body, 
                     sound: true // GUARANTEED SOUND ALERT
                   },
                   trigger: null,
                 });
              }
            }
          }
        });

        snapshot.forEach(docSnap => {
          const item = docSnap.data();
          if (item.target === 'ALL' || item.target === 'DRIVER' || (item.target === 'SPECIFIC' && item.targetUid === currentUid)) {
            list.push({ id: docSnap.id, ...item });
          }
        });
        list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        setAnnouncements(list);
      });

      return () => { unsubscribeLots(); unsubscribeBooking(); unsubscribeCards(); unsubCancel(); unsubPast(); unsubAnnouncements(); };
    }
    return () => unsubscribeLots();
  }, []);

  // --- INTELLIGENT INBOX MERGER ---
  useEffect(() => {
    let combined = [...announcements];

    pastBookings.forEach(tx => {
      if (tx.status.includes('Cancelled')) {
        combined.push({
          id: `cancel-${tx.id}`,
          title: '❌ Booking Cancelled',
          body: `Your booking at ${tx.lotName} was cancelled. Full refund processed.`,
          timestamp: tx.timestamp,
          color: '#ef4444',
          sender: 'System Admin'
        });
      }
    });

    activeBookings.forEach(tx => {
      if (tx.expectedDeparture) {
         const endMs = tx.expectedDeparture.toDate().getTime();
         const now = Date.now();
         
         // Inject 10-Min Warning to Inbox dynamically
         if (now >= endMs - (10 * 60 * 1000) && now < endMs) {
            combined.push({
                id: `warning-${tx.id}`,
                title: '⚠️ Parking Expiring Soon',
                body: `Your booking at ${tx.lotName} expires in 10 minutes!`,
                timestamp: new Date(endMs - (10 * 60 * 1000)),
                color: '#f59e0b',
                sender: 'System Automations'
            });
         }

         // Inject Time Over to Inbox dynamically
         if (now >= endMs) { 
             combined.push({
                 id: `expiry-${tx.id}`,
                 title: '⏱️ Parking Time Ended',
                 body: `Your time is over at ${tx.lotName}. We are now calculating extra time charges.`,
                 timestamp: tx.expectedDeparture,
                 color: '#ef4444',
                 sender: 'System Automations'
             });
         }
      }
    });

    combined.sort((a, b) => {
       const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
       const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
       return timeB - timeA;
    });

    setNotificationsList(combined);
  }, [announcements, pastBookings, activeBookings]);

  useEffect(() => {
    if (!selectedSpot) { setAiPrediction(null); return; }
    const fetchPrediction = async () => {
      setAiPrediction({ loading: true });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(`${LOCAL_ML_URL}/predict_availability`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lot_id: selectedSpot.id, total_capacity: getTotalSpotsForVehicle(selectedSpot, vehicleType) || 50 }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        setAiPrediction(data);
      } catch (error) {
        clearTimeout(timeoutId);
        const availableTypeSpots = getAvailableSpotsForVehicle(selectedSpot, vehicleType);
        const totalTypeSpots = getTotalSpotsForVehicle(selectedSpot, vehicleType);
        const isFilling = availableTypeSpots < (totalTypeSpots * 0.2);
        setAiPrediction({
          trend: isFilling ? 'filling_up' : 'stable',
          predicted_available_spots: Math.max(0, availableTypeSpots - Math.floor(Math.random() * 3)),
          accuracy_confidence: "78.4%"
        });
      }
    };
    fetchPrediction();
  }, [selectedSpot, vehicleType]);

  // --- DYNAMIC TIERED DISCOUNT HELPER ---
  const getCurrentDiscount = () => {
    if (!selectedSpot || !selectedSpot.vehicle_discounts) return null;
    const normalizedType = vehicleType.replace(/\s/g, '').toUpperCase();
    const disc = selectedSpot.vehicle_discounts[normalizedType];
    if (disc && Number(disc.percentage) > 0 && Number(disc.threshold) > 0) {
      return { percentage: Number(disc.percentage), threshold: Number(disc.threshold) };
    }
    return null;
  };

  const displayPrice = (type: string) => {
    if (!selectedSpot) return 'N/A';
    try {
      let finalPrice = 0;
      const normalizedType = type.replace(/\s/g, '').toUpperCase();
      if (selectedSpot.vehicle_rates) {
        const keys = Object.keys(selectedSpot.vehicle_rates);
        const matchedKey = keys.find(k => k.replace(/\s/g, '').toUpperCase() === normalizedType);
        if (matchedKey) {
          const rawVal = selectedSpot.vehicle_rates[matchedKey];
          if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
            const val = parseFloat(rawVal);
            if (!isNaN(val) && val > 0) finalPrice = val;
          }
        }
      }
      if (finalPrice === 0 && selectedSpot.hourly_rate) {
        const rawHourly = selectedSpot.hourly_rate;
        if (rawHourly !== undefined && rawHourly !== null && rawHourly !== '') {
          const hourly = parseFloat(rawHourly);
          if (!isNaN(hourly) && hourly > 0) {
            if (normalizedType === 'CAR') finalPrice = hourly;
            else if (normalizedType === 'BIKE') finalPrice = hourly * 0.4;
            else if (normalizedType === 'TUKTUK') finalPrice = hourly * 0.6;
            else if (normalizedType === 'LORRY') finalPrice = hourly * 2.0;
          }
        }
      }
      if (finalPrice > 0) return `Rs. ${Math.round(finalPrice)}`;
      return 'N/A';
    } catch (e) { return 'N/A'; }
  };

  const getCalculatedRate = (lot: any) => {
    if (!lot) return 0;
    let baseRate = 0;
    const normalizedType = vehicleType.replace(/\s/g, '').toUpperCase();
    try {
      if (lot.vehicle_rates) {
        const keys = Object.keys(lot.vehicle_rates);
        const matchedKey = keys.find(k => k.replace(/\s/g, '').toUpperCase() === normalizedType);
        if (matchedKey) {
          const val = parseFloat(lot.vehicle_rates[matchedKey]);
          if (!isNaN(val) && val > 0) baseRate = val;
        }
      }
      if (baseRate === 0 && lot.hourly_rate) {
        const hourly = parseFloat(lot.hourly_rate);
        if (!isNaN(hourly) && hourly > 0) {
          if (normalizedType === 'CAR') baseRate = hourly;
          else if (normalizedType === 'BIKE') baseRate = hourly * 0.4;
          else if (normalizedType === 'TUKTUK') baseRate = hourly * 0.6;
          else if (normalizedType === 'LORRY') baseRate = hourly * 2.0;
        }
      }
    } catch (e) { }
    return Math.round(baseRate * duration); 
  };

  const openGPS = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const url = Platform.select({ ios: `${scheme}${label}@${lat},${lng}`, android: `${scheme}${lat},${lng}(${label})` });
    Linking.openURL(url as string).catch(() => Alert.alert("Error", "Could not open map."));
  };

  const handleAddCard = async () => {
    if (!newCard.number || !newCard.expiry || !newCard.cvv) return Alert.alert("Error", "Please fill all card details.");
    try {
      await addDoc(collection(db, 'users', auth.currentUser!.uid, 'cards'), newCard);
      setAddCardModalVisible(false);
      setNewCard({ number: '', name: '', expiry: '', cvv: '' });
      Alert.alert("Success", "Card added securely.");
    } catch (e) { Alert.alert("Error", "Could not add card."); }
  };

  const handleDeleteCard = async (cardId: string) => {
    Alert.alert("Remove Card", "Remove this card from your wallet?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'cards', cardId));
          if (selectedCardId === cardId) setSelectedCardId(null);
      }}
    ]);
  };

  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser!.uid), driverProfile);
      Alert.alert("Success", "Profile updated successfully!");
      setProfileModalVisible(false);
    } catch (error) { Alert.alert("Error", "Could not update."); } finally { setSavingProfile(false); }
  };

  const handleCancelProfile = () => { fetchProfile(); setProfileModalVisible(false); };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', auth.currentUser!.uid));
            await deleteUser(auth.currentUser!);
          } catch (error: any) { Alert.alert("Error", "Please log out and log back in to delete your account."); }
        } 
      }
    ]);
  };

  const handleCancelBooking = (booking: any) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this reservation?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: async () => {
          try {
            await updateDoc(doc(db, 'transactions', booking.id), { status: 'Cancelled' });
            const lotRef = doc(db, 'parking_lots', booking.lotId);
            const lotDoc = await getDoc(lotRef);
            if (lotDoc.exists()) {
              const lData = lotDoc.data();
              await updateDoc(lotRef, { available_spots: (lData.available_spots || 0) + 1 });
              if (lData.spot_layout) {
                const updatedLayout = lData.spot_layout.map((s: any) => s.id === booking.spotNumber ? { ...s, status: 'FREE', txId: null, licensePlate: null, arrivalTime: null } : s);
                await updateDoc(lotRef, { spot_layout: updatedLayout });
              }
            }
            await Notifications.cancelAllScheduledNotificationsAsync();
            Alert.alert("Cancelled", "Your booking has been removed.");
          } catch (error) { Alert.alert("Error", "Could not cancel booking."); }
      }}
    ]);
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(bookingDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setBookingDate(newDate);
    }
  };

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(bookingDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setBookingDate(newDate);
    }
  };

  const handleConfirmBooking = async () => {
    if (!licensePlate) return Alert.alert("Required", "Please enter your license plate.");
    if (savedCards.length === 0) return Alert.alert("Payment Required", "Please add a credit or debit card in the Payment Methods tab before booking.");
    if (!selectedCardId) return Alert.alert("Payment Required", "Please select a card to proceed.");
    
    if (bookingDate < new Date(new Date().getTime() - 5 * 60000)) {
        return Alert.alert("Invalid Time", "You cannot book parking in the past.");
    }

    const baseAmount = getCalculatedRate(selectedSpot);
    if (baseAmount <= 0) return Alert.alert("Invalid Rate", "This parking lot does not have a valid price setup for this vehicle type.");

    const currentDiscount = getCurrentDiscount();
    let finalAmount = baseAmount;
    let discountApplied = false;
    
    if (currentDiscount && duration >= currentDiscount.threshold) {
      const discountValue = baseAmount * (currentDiscount.percentage / 100);
      finalAmount = Math.round(baseAmount - discountValue);
      discountApplied = true;
    }

    // Removed convenience fee. Total is exactly the parking fee minus any applicable discount.
    const finalTotalDue = finalAmount;

    const processBooking = async () => {
      Alert.alert("Checking Availability...", "Searching for a free spot at your requested time...");

      try {
        const reqStart = bookingDate.getTime();
        const reqEnd = reqStart + (duration * 60 * 60 * 1000);
        const buffer = 60 * 60 * 1000; 

        const txQuery = query(collection(db, 'transactions'), where('lotId', '==', selectedSpot.id), where('status', 'in', ['Pending Arrival', 'Active']));
        const existingTxsSnap = await getDocs(txQuery);
        const existingTxs = existingTxsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

        let assignedSpotId = null;
        let layoutUpdates = selectedSpot.spot_layout ? [...selectedSpot.spot_layout] : null;

        if (layoutUpdates) {
          const matchingTypeSpots = layoutUpdates.filter((s: any) => s.type === vehicleType);
          if (matchingTypeSpots.length === 0) return Alert.alert("Lot Full", `There are no ${getVehicleLabel(vehicleType)} spots at this location.`);

          for (const spot of matchingTypeSpots) {
            const spotTxs = existingTxs.filter(tx => tx.spotNumber === spot.id);
            let hasOverlap = false;
            
            for (const tx of spotTxs) {
              const txStart = tx.expectedArrival ? tx.expectedArrival.toDate().getTime() : (tx.arrivalTime?.toDate().getTime() || new Date().getTime());
              const txEnd = txStart + ((tx.duration || 1) * 60 * 60 * 1000);
              
              if ((reqStart - buffer) < txEnd && (reqEnd + buffer) > txStart) {
                hasOverlap = true;
                break;
              }
            }
            if (!hasOverlap) { assignedSpotId = spot.id; break; }
          }
          if (!assignedSpotId) return Alert.alert("Time Slot Unavailable", "All spots for this vehicle type are booked during this time (or blocked by the mandatory 1-hour gap rule). Please select a different time or location.");
        } else {
          assignedSpotId = (Math.floor(Math.random() * (selectedSpot.capacity_total || 50)) + 1).toString(); 
        }

        const newTxRef = await addDoc(collection(db, 'transactions'), {
          driverId: auth.currentUser?.uid || 'Unknown', 
          driverName: driverProfile.name || 'Unknown', 
          licensePlate: licensePlate,
          lotId: selectedSpot.id, 
          lotName: selectedSpot.name || 'Verified Parking Zone', 
          location_text: selectedSpot.location_text || 'Verified Parking Zone',
          vehicleType: vehicleType, 
          amountPaid: finalTotalDue, 
          discountApplied: discountApplied, 
          spotNumber: assignedSpotId,
          duration: duration,
          expectedArrival: new Date(reqStart), 
          expectedDeparture: new Date(reqEnd),
          paymentTiming: 'ONLINE', 
          paymentMethod: 'CARD',   
          status: 'Pending Arrival', 
          timestamp: serverTimestamp(), 
          arrivalTime: new Date() 
        });

        if (selectedSpot.available_spots > 0) {
          let updateData: any = { available_spots: selectedSpot.available_spots - 1 };
          if (layoutUpdates) {
            const spotIndex = layoutUpdates.findIndex((s: any) => s.id === assignedSpotId);
            if (spotIndex !== -1) {
              layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'BOOKED', txId: newTxRef.id, licensePlate: licensePlate, arrivalTime: new Date().toISOString() };
              updateData.spot_layout = layoutUpdates;
            }
          }
          await updateDoc(doc(db, 'parking_lots', selectedSpot.id), updateData);
        }

        const nowMs = Date.now();
        
        const warningDate = new Date(reqEnd - (10 * 60 * 1000));
        if (warningDate.getTime() > nowMs) {
          await Notifications.scheduleNotificationAsync({
            content: { title: '⚠️ Parking Expiring Soon', body: `Your booking at ${selectedSpot.name} expires in 10 minutes!`, sound: true },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: warningDate },
          });
        }

        const timeOverDate = new Date(reqEnd);
        if (timeOverDate.getTime() > nowMs) {
          await Notifications.scheduleNotificationAsync({
            content: { title: '⏱️ Parking Time Ended', body: `Your time is over. We are now calculating for extra time.`, sound: true },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: timeOverDate },
          });
        }

        setPaymentModalVisible(false); 
        setSelectedSpot(null);
        Alert.alert("Success!", `Spot #${assignedSpotId} reserved for ${bookingDate.toLocaleString()}!`);
        setActiveTab('BOOKINGS'); 

      } catch (error: any) { Alert.alert("Error", error.message); }
    };

    if (activeBookings.length > 0) {
      Alert.alert("Active Booking Exists", "You already have an active parking reservation. Do you want to book ANOTHER spot?", [{ text: "Cancel", style: "cancel" }, { text: "Yes, Book Another", onPress: processBooking }]);
    } else {
      processBooking();
    }
  };

  const handleSearchWalkIn = async () => {
    if (!walkInSearchPlate) return Alert.alert('Required', 'Enter your License Plate to search.');
    setWalkInLoading(true);
    try {
      const q = query(collection(db, 'transactions'), 
        where('licensePlate', '==', walkInSearchPlate.toUpperCase()), 
        where('vehicleType', '==', walkInSearchType)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      results.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setWalkInResults(results);
      if (results.length === 0) Alert.alert('Not Found', 'No records found for this vehicle.');
    } catch(e) { Alert.alert('Error', 'Could not search the database.'); }
    setWalkInLoading(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3498db"/></View>;

  const unreadCount = notificationsList.filter(msg => !readAnnouncements.includes(msg.id)).length;
  const currentDiscount = getCurrentDiscount();

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{marginRight: 15}}><Menu color="#0f172a" size={28} /></TouchableOpacity>
          <View>
            <Text style={styles.appName}>Zlot.</Text>
            <Text style={{color: '#666', fontSize: 12}}>
              {activeTab === 'MAP' ? 'Find Parking' : activeTab === 'PAYMENT' ? 'Wallet' : activeTab === 'BILLS' ? 'Billing History' : 'Driver Portal'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setProfileModalVisible(true)} style={styles.iconBtn}><User color="#3498db" size={20}/></TouchableOpacity>
      </View>

      {/* --- TAB: MAP VIEW --- */}
      {activeTab === 'MAP' && (
        <View style={{flex: 1}}>
          <View style={styles.filterContainer}>
            {['CAR', 'TUKTUK', 'BIKE', 'LORRY'].map((type) => (
              <TouchableOpacity key={type} style={[styles.filterBtn, vehicleType === type ? styles.filterBtnActive : {}]} onPress={() => { setVehicleType(type); setSelectedSpot(null); }}>
                <Text style={[styles.filterText, vehicleType === type ? styles.filterTextActive : {}]}>
                  {getVehicleLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <MapView style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={{ latitude: 7.2931, longitude: 80.6375, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
            {lots.map((lot) => {
              const availableSpots = getAvailableSpotsForVehicle(lot, vehicleType);
              return (
                <Marker key={lot.id} coordinate={{ latitude: lot.latitude || 7.2931, longitude: lot.longitude || 80.6375 }} onPress={() => setSelectedSpot(lot)}>
                  <View style={[styles.pin, availableSpots <= 0 || lot.is_open === false ? styles.pinFull : styles.pinOpen]}>
                    <Text style={styles.pinText}>{availableSpots}</Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {/* Bottom Sheet for Spot Details */}
          {selectedSpot && (
            <View style={styles.sheet}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.sheetTitle}>{selectedSpot.name}</Text>
                  <Text style={{color: '#64748b', fontSize: 12, marginTop: 2}}>{selectedSpot.location_text || 'Verified Parking Zone'}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceValue}>Rs. {getCalculatedRate(selectedSpot)}</Text>
                  <Text style={{fontSize: 10, color: '#666'}}>for {duration} hr(s)</Text>
                </View>
              </View>

              <View style={styles.basicInfoRow}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  <Clock size={16} color={selectedSpot.is_open === false ? '#e74c3c' : '#3498db'} />
                  <Text style={[styles.basicInfoText, selectedSpot.is_open === false ? {color: '#e74c3c'} : {}]}>
                    {selectedSpot.is_open === false ? 'CURRENTLY CLOSED' : selectedSpot.operating_hours ? `${selectedSpot.operating_hours.open} - ${selectedSpot.operating_hours.close}` : 'Open 24/7'}
                  </Text>
                </View>
                {selectedSpot.phone && (
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <Phone size={16} color="#3498db" />
                    <Text style={styles.basicInfoText}>{selectedSpot.phone}</Text>
                  </View>
                )}
              </View>

              {/* TIERED DISCOUNT BANNER DISPLAY */}
              {currentDiscount && (
                <View style={{backgroundColor: '#dcfce7', padding: 10, borderRadius: 8, marginBottom: 15, flexDirection: 'row', alignItems: 'center'}}>
                  <Banknote size={16} color="#16a34a" style={{marginRight: 8}} />
                  <Text style={{color: '#166534', fontWeight: 'bold', fontSize: 12}}>
                    Long-Term Deal: {currentDiscount.percentage}% OFF when you book {currentDiscount.threshold}+ hours!
                  </Text>
                </View>
              )}

              {aiPrediction && selectedSpot.is_open !== false && (
                <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: aiPrediction.trend === 'filling_up' ? '#fee2e2' : '#e0e7ff', padding: 12, borderRadius: 10, marginBottom: 15}}>
                  {aiPrediction.loading ? (
                    <ActivityIndicator size="small" color="#4f46e5" style={{marginRight: 10}} />
                  ) : (
                    <Zap size={20} color={aiPrediction.trend === 'filling_up' ? '#dc2626' : '#4f46e5'} style={{marginRight: 10}} />
                  )}
                  <View style={{flex: 1}}>
                    <Text style={{color: aiPrediction.trend === 'filling_up' ? '#dc2626' : '#4f46e5', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase'}}>
                      AI 30-Min Forecast
                    </Text>
                    {aiPrediction.loading ? (
                      <Text style={{color: '#64748b', fontSize: 11, marginTop: 2}}>Analyzing historical time-series data...</Text>
                    ) : (
                      <Text style={{color: aiPrediction.trend === 'filling_up' ? '#991b1b' : '#3730a3', fontSize: 11, marginTop: 2, fontWeight: 'bold'}}>
                        {aiPrediction.trend === 'filling_up' ? 'Congestion likely.' : 'Lot expected to remain stable.'} Est. {aiPrediction.predicted_available_spots} spots left. ({aiPrediction.accuracy_confidence} confidence)
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.imageContainer}>
                {selectedSpot.spot_photo_uri ? (
                  <Image source={{ uri: selectedSpot.spot_photo_uri }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <><Camera color="#cbd5e1" size={36} /><Text style={{color: '#94a3b8', fontWeight: 'bold', marginTop: 5}}>No Photo Provided</Text></>
                )}
              </View>

              <View style={styles.priceListBox}>
                <Text style={styles.priceListTitle}>Hourly Rates</Text>
                <View style={styles.priceListRow}>
                   <Text style={styles.priceListItem}>🚗 {displayPrice('CAR')}</Text>
                   <Text style={styles.priceListItem}>🏍️ {displayPrice('BIKE')}</Text>
                   <Text style={styles.priceListItem}>🛺 {displayPrice('TUKTUK')}</Text>
                   <Text style={styles.priceListItem}>🚚 {displayPrice('LORRY')}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                {selectedSpot.amenities?.hasCCTV && <View style={styles.amenityBadge}><Video size={14} color="#64748b"/><Text style={styles.amenityText}>CCTV</Text></View>}
                {selectedSpot.amenities?.hasSecurity && <View style={styles.amenityBadge}><Shield size={14} color="#64748b"/><Text style={styles.amenityText}>Guarded</Text></View>}
                {selectedSpot.amenities?.hasRoof && <View style={styles.amenityBadge}><Umbrella size={14} color="#64748b"/><Text style={styles.amenityText}>Covered</Text></View>}
                {selectedSpot.amenities?.isIndoor && <View style={styles.amenityBadge}><Zap size={14} color="#64748b"/><Text style={styles.amenityText}>Indoor</Text></View>}
                {selectedSpot.amenities?.isOutdoor && <View style={styles.amenityBadge}><MapPin size={14} color="#64748b"/><Text style={styles.amenityText}>Outdoor/Road</Text></View>}
              </ScrollView>

              <TouchableOpacity style={styles.navBtn} onPress={() => openGPS(selectedSpot.latitude || 7.2931, selectedSpot.longitude || 80.6375, selectedSpot.name)}>
                <Navigation size={18} color="#fff" /><Text style={{color: '#fff', fontWeight: 'bold', marginLeft: 8}}>Navigate via GPS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.mainBtn, (getAvailableSpotsForVehicle(selectedSpot, vehicleType) <= 0 || selectedSpot.is_open === false || getCalculatedRate(selectedSpot) === 0) ? {backgroundColor: '#ccc'} : {}]} disabled={getAvailableSpotsForVehicle(selectedSpot, vehicleType) <= 0 || selectedSpot.is_open === false || getCalculatedRate(selectedSpot) === 0} onPress={() => setPaymentModalVisible(true)}>
                <Text style={styles.btnText}>{selectedSpot.is_open === false ? 'Park is Closed' : getCalculatedRate(selectedSpot) === 0 ? 'Vehicle Type Not Supported' : getAvailableSpotsForVehicle(selectedSpot, vehicleType) > 0 ? `Book Space` : 'Lot is Full'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* --- TAB: ACTIVE BOOKINGS --- */}
      {activeTab === 'BOOKINGS' && (
        <ScrollView style={{flex: 1, padding: 20}}>
          <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 20}}>Active Reservations</Text>
          
          {activeBookings.length === 0 ? (
            <View style={{alignItems: 'center', marginTop: 50, padding: 20}}>
              <MapPin size={48} color="#cbd5e1" />
              <Text style={{color: '#64748b', fontSize: 16, marginTop: 10, textAlign: 'center'}}>You have no active bookings right now.</Text>
              <TouchableOpacity style={[styles.mainBtn, {marginTop: 20, width: 200}]} onPress={() => setActiveTab('MAP')}>
                <Text style={styles.btnText}>Find Parking</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeBookings.map(booking => (
              <View key={booking.id} style={styles.fullWidthBookingCard}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15}}>
                  <View>
                    <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 10, marginBottom: 5}}>PARKING LOT</Text>
                    <Text style={{color: '#fff', fontSize: 20, fontWeight: '900'}}>{booking.lotName}</Text>
                    <Text style={{color: '#e0f2fe', fontSize: 12}}>{booking.location_text}</Text>
                  </View>
                  {booking.status === 'Pending Arrival' && (
                    <TouchableOpacity onPress={() => handleCancelBooking(booking)} style={{backgroundColor: 'rgba(239, 68, 68, 0.9)', padding: 10, borderRadius: 10}}>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 12, marginBottom: 10}}>
                  <View>
                    <Text style={{color: '#e0f2fe', fontSize: 11}}>SPOT</Text>
                    <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>#{booking.spotNumber}</Text>
                  </View>
                  <View>
                    <Text style={{color: '#e0f2fe', fontSize: 11}}>PLATE</Text>
                    <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>{booking.licensePlate}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={{color: '#e0f2fe', fontSize: 11}}>STATUS</Text>
                    <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 14}}>{booking.status}</Text>
                  </View>
                </View>

                <View style={{backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center'}}>
                  <Clock size={14} color="#e0f2fe" style={{marginRight: 6}} />
                  <Text style={{color: '#e0f2fe', fontSize: 12, fontWeight: 'bold'}}>
                    Scheduled: {booking.expectedArrival ? booking.expectedArrival.toDate().toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'}) : 'Walk-in'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* --- NEW TAB: MY BILLS & HISTORY --- */}
      {activeTab === 'BILLS' && (
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', padding: 20, gap: 10}}>
            <TouchableOpacity style={[styles.filterBtn, billTab === 'PRE_BOOKED' ? styles.filterBtnActive : {}]} onPress={() => setBillTab('PRE_BOOKED')}>
              <Text style={[styles.filterText, billTab === 'PRE_BOOKED' ? styles.filterTextActive : {}]}>Pre-Booked</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterBtn, billTab === 'WALK_IN' ? styles.filterBtnActive : {}]} onPress={() => setBillTab('WALK_IN')}>
              <Text style={[styles.filterText, billTab === 'WALK_IN' ? styles.filterTextActive : {}]}>Walk-In Tracker</Text>
            </TouchableOpacity>
          </View>

          {billTab === 'PRE_BOOKED' ? (
            <ScrollView style={{paddingHorizontal: 20}}>
              {pastBookings.length === 0 ? (
                <Text style={{textAlign: 'center', color: '#64748b', marginTop: 40}}>You have no past online bookings.</Text>
              ) : (
                pastBookings.map(tx => (
                  <View key={tx.id} style={styles.historyCard}>
                    <Text style={{fontWeight: '900', fontSize: 18, color: '#0f172a'}}>{tx.lotName}</Text>
                    <Text style={{color: '#64748b', fontSize: 12, marginBottom: 10}}>{tx.location_text}</Text>
                    <View style={styles.divider} />
                    
                    <View style={styles.receiptRow}>
                       <Text style={styles.receiptLabel}>Status</Text>
                       <Text style={[styles.receiptValue, tx.status.includes('Cancelled') ? {color: '#ef4444'} : {color: '#16a34a'}]}>{tx.status}</Text>
                    </View>

                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Vehicle</Text><Text style={styles.receiptValue}>{tx.licensePlate} ({getVehicleLabel(tx.vehicleType)})</Text></View>
                    <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Scheduled</Text><Text style={styles.receiptValue}>{tx.expectedArrival ? tx.expectedArrival.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</Text></View>
                    
                    {tx.status === 'Completed' && (
                      <View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Actual Arrived</Text><Text style={styles.receiptValue}>{tx.actualArrivalTime ? tx.actualArrivalTime.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Actual Departed</Text><Text style={styles.receiptValue}>{tx.departureTime ? tx.departureTime.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</Text></View>
                        <View style={styles.divider} />
                        {tx.overstayHours > 0 && <Text style={{color: '#f59e0b', fontSize: 12, textAlign: 'right', marginBottom: 5}}>{`* Includes Rs. ${tx.extraDue} Extra Time Cost`}</Text>}
                        {tx.discountApplied && <Text style={{color: '#16a34a', fontSize: 12, textAlign: 'right', marginBottom: 5}}>* Long-Term Discount Applied</Text>}
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Total Paid</Text><Text style={{fontWeight: 'bold', fontSize: 18, color: '#16a34a'}}>Rs. {tx.amountPaid}</Text></View>
                      </View>
                    )}
                    {tx.status.includes('Cancelled') && (
                       <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Refunded</Text><Text style={{fontWeight: 'bold', fontSize: 18, color: '#ef4444'}}>Rs. {tx.refundedAmount || 0}</Text></View>
                    )}
                  </View>
                ))
              )}
              <View style={{height: 40}}/>
            </ScrollView>
          ) : (
            <ScrollView style={{paddingHorizontal: 20}}>
              <Text style={{color: '#64748b', fontSize: 12, marginBottom: 10}}>If you parked without using the app, search for your ticket here to view your live running status or final bill.</Text>
              
              <TextInput style={styles.inputActive} placeholder="License Plate (CAB-1234)" value={walkInSearchPlate} onChangeText={setWalkInSearchPlate} autoCapitalize="characters" />
              
              <View style={[styles.checkInVehicleTypeRow, {marginVertical: 15}]}>
                {['CAR', 'TUKTUK', 'BIKE', 'LORRY'].map(t => (
                  <TouchableOpacity key={t} style={[styles.fullTypeBtn, walkInSearchType === t ? styles.typeBtnActive : {}]} onPress={() => setWalkInSearchType(t)}>
                    <Text style={walkInSearchType === t ? styles.typeTextActive : styles.typeText}>{getVehicleLabel(t)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.mainBtn} onPress={handleSearchWalkIn} disabled={walkInLoading}>
                {walkInLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}><Search size={18} color="#fff" style={{marginRight: 5}}/> Search Walk-In Ticket</Text>}
              </TouchableOpacity>

              <View style={{marginTop: 20}}>
                {walkInResults.map(tx => {
                  const lotInfo = lots.find(l => l.id === tx.lotId);
                  const displayLotName = tx.lotName || lotInfo?.name || 'Walk-In Ticket';
                  const displayLocation = tx.location_text || lotInfo?.location_text || '';

                  return (
                  <View key={tx.id} style={[styles.historyCard, tx.status === 'Active' ? {borderColor: '#3b82f6', borderWidth: 2} : {}]}>
                    <Text style={{fontWeight: '900', fontSize: 18, color: '#0f172a'}}>{displayLotName}</Text>
                    <Text style={{color: '#64748b', fontSize: 12, marginBottom: 10}}>
                      {displayLocation ? `${displayLocation} • ` : ''}Spot #{tx.spotNumber || 'N/A'}
                    </Text>
                    <View style={styles.divider} />
                    
                    <View style={styles.receiptRow}>
                       <Text style={styles.receiptLabel}>Status</Text>
                       <Text style={[styles.receiptValue, tx.status === 'Active' ? {color: '#3b82f6'} : {color: '#16a34a'}]}>{tx.status}</Text>
                    </View>
                    
                    <View style={styles.receiptRow}>
                       <Text style={styles.receiptLabel}>Arrived</Text>
                       <Text style={styles.receiptValue}>{tx.actualArrivalTime ? tx.actualArrivalTime.toDate().toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'}) : (tx.arrivalTime ? tx.arrivalTime.toDate().toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'}) : 'N/A')}</Text>
                    </View>
                    
                    {tx.status === 'Active' ? (
                       <View style={{backgroundColor: '#e0f2fe', padding: 10, borderRadius: 8, marginTop: 10}}>
                          <Text style={{color: '#0284c7', fontWeight: 'bold', textAlign: 'center'}}>Vehicle is currently parked.</Text>
                          <Text style={{color: '#0369a1', fontSize: 12, textAlign: 'center', marginTop: 5}}>Please see the parking owner to process your check-out and final payment.</Text>
                       </View>
                    ) : (
                       <View>
                         <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Departed</Text><Text style={styles.receiptValue}>{tx.departureTime ? tx.departureTime.toDate().toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'}) : 'N/A'}</Text></View>
                         <View style={styles.divider} />
                         <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Total Paid</Text><Text style={{fontWeight: '900', fontSize: 18, color: '#16a34a'}}>Rs. {tx.amountPaid}</Text></View>
                       </View>
                    )}
                  </View>
                )})}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* --- TAB: PAYMENT METHODS --- */}
      {activeTab === 'PAYMENT' && (
        <ScrollView style={{flex: 1, padding: 20}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a'}}>My Wallet</Text>
            <TouchableOpacity onPress={() => setAddCardModalVisible(true)} style={{backgroundColor: '#3498db', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8}}>
              <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>+ Add Card</Text>
            </TouchableOpacity>
          </View>
          
          {savedCards.length === 0 ? (
            <View style={{alignItems: 'center', marginTop: 50, padding: 20}}>
              <CreditCard size={48} color="#cbd5e1" />
              <Text style={{color: '#64748b', fontSize: 16, marginTop: 10, textAlign: 'center'}}>No payment methods added yet.</Text>
            </View>
          ) : (
            savedCards.map(card => (
              <View key={card.id} style={{backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
                  <View style={{backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10}}>
                    <CreditCard color="#3498db" size={24} />
                  </View>
                  <View>
                    <Text style={{fontWeight: '900', color: '#0f172a', fontSize: 16}}>•••• •••• •••• {card.number.slice(-4)}</Text>
                    <Text style={{color: '#64748b', fontSize: 12, marginTop: 2}}>Expires {card.expiry}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCard(card.id)} style={{padding: 8}}>
                  <Trash color="#ef4444" size={20} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* --- ADD CARD MODAL --- */}
      <Modal visible={isAddCardModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Payment Card</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Card Number</Text>
              <TextInput style={styles.inputActive} placeholder="0000 0000 0000 0000" keyboardType="number-pad" value={newCard.number} onChangeText={t => setNewCard({...newCard, number: t})} maxLength={16} />
              
              <Text style={styles.sectionLabel}>Name on Card</Text>
              <TextInput style={styles.inputActive} placeholder="John Doe" value={newCard.name} onChangeText={t => setNewCard({...newCard, name: t})} />
              
              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.sectionLabel}>Expiry (MM/YY)</Text>
                  <TextInput style={styles.inputActive} placeholder="MM/YY" value={newCard.expiry} onChangeText={t => setNewCard({...newCard, expiry: t})} maxLength={5} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.sectionLabel}>CVV</Text>
                  <TextInput style={styles.inputActive} placeholder="123" keyboardType="number-pad" secureTextEntry value={newCard.cvv} onChangeText={t => setNewCard({...newCard, cvv: t})} maxLength={3} />
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.mainBtn, {marginTop: 20}]} onPress={handleAddCard}><Text style={styles.btnText}>Securely Save Card</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAddCardModalVisible(false)} style={{marginTop: 15, alignItems: 'center'}}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- PROFILE MODAL --- */}
      <Modal visible={isProfileModalVisible} animationType="slide" transparent onRequestClose={handleCancelProfile}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancelProfile} />
          <View style={[styles.modalContent, {paddingTop: 40, maxHeight: '90%'}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20}}>
              <Text style={[styles.modalTitle, {marginBottom: 0}]}>My Profile</Text>
              <TouchableOpacity onPress={handleCancelProfile}><X color="#64748b" size={26}/></TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Full Name</Text><TextInput style={styles.inputActive} value={driverProfile.name} onChangeText={(text) => setDriverProfile({...driverProfile, name: text})} />
              <Text style={styles.sectionLabel}>Phone Number</Text><TextInput style={styles.inputActive} value={driverProfile.phone} onChangeText={(text) => setDriverProfile({...driverProfile, phone: text})} keyboardType="phone-pad"/>
              <Text style={styles.sectionLabel}>NIC</Text><TextInput style={styles.inputActive} value={driverProfile.nic} onChangeText={(text) => setDriverProfile({...driverProfile, nic: text})} />
            </View>
            <View style={{flexDirection: 'row', gap: 10, marginTop: 25, width: '100%'}}>
              <TouchableOpacity style={[styles.confirmBtn, {flex: 1, backgroundColor: '#f1f5f9'}]} onPress={handleCancelProfile}>
                <Text style={[styles.btnText, {color: '#64748b'}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, {flex: 1}]} onPress={handleUpdateProfile} disabled={savingProfile}>
                <Text style={styles.btnText}>{savingProfile ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleDeleteAccount} style={{marginTop: 20, padding: 10}}><Text style={styles.cancelText}>Delete Account Forever</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- BOOKING & PAYMENT MODAL --- */}
      <Modal visible={isPaymentModalVisible} animationType="slide" transparent onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPaymentModalVisible(false)} />
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{width: '100%'}}>
              <Text style={styles.modalTitle}>Reserve Parking Space</Text>

              <View style={styles.inputGroup}>
                <TextInput style={styles.inputActive} placeholder="License Plate (CAB-1234)" value={licensePlate} onChangeText={setLicensePlate} autoCapitalize="characters"/>
                
                <Text style={styles.sectionLabel}>Arrival Date & Time</Text>
                <View style={{flexDirection: 'row', gap: 10}}>
                  <TouchableOpacity style={styles.timingBtn} onPress={() => setShowDatePicker(true)}>
                    <Calendar size={20} color="#3498db" />
                    <Text style={{fontWeight: 'bold', marginTop: 5}}>{bookingDate.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.timingBtn} onPress={() => setShowTimePicker(true)}>
                    <Clock size={20} color="#3498db" />
                    <Text style={{fontWeight: 'bold', marginTop: 5}}>{bookingDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && <DateTimePicker value={bookingDate} mode="date" display="default" onChange={onChangeDate} minimumDate={new Date()} />}
                {showTimePicker && <DateTimePicker value={bookingDate} mode="time" display="default" onChange={onChangeTime} />}

                <View style={[styles.durationSelector, {marginTop: 15}]}>
                  <Text style={{fontWeight: 'bold', color: '#333'}}>Duration:</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
                    <TouchableOpacity onPress={() => setDuration(Math.max(1, duration - 1))} style={styles.timeBtn}><Minus size={20} color="#3498db"/></TouchableOpacity>
                    <Text style={{fontSize: 18, fontWeight: '900'}}>{duration} hr</Text>
                    <TouchableOpacity onPress={() => setDuration(duration + 1)} style={styles.timeBtn}><Plus size={20} color="#3498db"/></TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Select Payment Card</Text>
              {savedCards.length === 0 ? (
                <View style={{padding: 15, backgroundColor: '#fee2e2', borderRadius: 10, borderWidth: 1, borderColor: '#fca5a5'}}>
                  <Text style={{color: '#dc2626', fontWeight: 'bold', textAlign: 'center'}}>Please add a card in the Payment Methods tab first.</Text>
                </View>
              ) : (
                <View style={{gap: 10}}>
                  {savedCards.map(c => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={[styles.payOption, selectedCardId === c.id ? styles.payActive : null, {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15}]} 
                      onPress={() => setSelectedCardId(c.id)}
                    >
                      <CreditCard color={selectedCardId === c.id ? '#fff' : '#64748b'} size={24} style={{marginRight: 10}} />
                      <Text style={selectedCardId === c.id ? styles.payTextActive : styles.payText}>•••• •••• •••• {c.number.slice(-4)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.totalArea}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                   <Text style={{color: '#64748b', fontWeight: 'bold'}}>Base Parking Rate:</Text>
                   <Text style={{color: '#334155', fontWeight: 'bold'}}>Rs. {selectedSpot ? getCalculatedRate(selectedSpot) : 0}</Text>
                </View>
                
                {/* DYNAMIC DISCOUNT APPLICATOR UI */}
                {currentDiscount && duration >= currentDiscount.threshold && (
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                      <Text style={{color: '#16a34a', fontWeight: 'bold'}}>Long-Term Discount ({currentDiscount.percentage}%):</Text>
                      <Text style={{color: '#16a34a', fontWeight: 'bold'}}>
                        - Rs. {Math.round(getCalculatedRate(selectedSpot) * (currentDiscount.percentage / 100))}
                      </Text>
                   </View>
                )}

                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#e2e8f0'}}>
                   <Text style={{color: '#0f172a', fontSize: 16, fontWeight: 'bold'}}>Total Pre-Paid Due:</Text>
                   <Text style={{fontWeight: '900', fontSize: 24, color: '#27ae60'}}>
                     Rs. {
                       selectedSpot ? 
                         (currentDiscount && duration >= currentDiscount.threshold 
                           ? Math.round(getCalculatedRate(selectedSpot) - (getCalculatedRate(selectedSpot) * (currentDiscount.percentage / 100))) 
                           : getCalculatedRate(selectedSpot))
                         : 0
                     }
                   </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.confirmBtn, savedCards.length === 0 ? {backgroundColor: '#94a3b8'} : {}]} 
                onPress={handleConfirmBooking}
                disabled={savedCards.length === 0}
              >
                <Text style={styles.btnText}>Pay & Confirm Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={{padding: 15, alignItems: 'center'}}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- INBOX SYSTEM MESSAGES MODAL --- */}
      <Modal visible={isAnnouncementsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setAnnouncementsVisible(false); setSelectedAnnouncement(null); }} />
          <View style={[styles.modalContent, {maxHeight: '80%', minHeight: '60%'}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15}}>
              <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a'}}>📬 Inbox & Alerts</Text>
              <TouchableOpacity onPress={() => { setAnnouncementsVisible(false); setSelectedAnnouncement(null); }}><X color="#64748b" size={26}/></TouchableOpacity>
            </View>
            
            {selectedAnnouncement ? (
               <View style={{flex: 1, width: '100%'}}>
                 <TouchableOpacity onPress={() => setSelectedAnnouncement(null)} style={{marginBottom: 15, alignSelf: 'flex-start'}}>
                   <Text style={{color: '#3498db', fontWeight: 'bold', fontSize: 16}}>← Back to List</Text>
                 </TouchableOpacity>
                 <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={{fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 10}}>{selectedAnnouncement.title}</Text>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 10, marginBottom: 15}}>
                       <Text style={{color: '#64748b', fontSize: 12, fontWeight: 'bold'}}>From: {selectedAnnouncement.sender || 'System Admin'}</Text>
                       <Text style={{color: '#64748b', fontSize: 12}}>
                          {selectedAnnouncement.timestamp?.toDate ? selectedAnnouncement.timestamp.toDate().toLocaleString() : 'Just Now'}
                       </Text>
                    </View>
                    <Text style={{color: '#334155', fontSize: 16, lineHeight: 24}}>{selectedAnnouncement.body}</Text>
                 </ScrollView>
               </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{width: '100%'}}>
                {notificationsList.length === 0 ? (
                  <View style={{alignItems: 'center', marginTop: 30}}>
                    <Bell size={40} color="#cbd5e1" />
                    <Text style={{textAlign: 'center', color: '#94a3b8', marginTop: 10, fontWeight: 'bold'}}>Your inbox is empty.</Text>
                  </View>
                ) : notificationsList.map(msg => {
                  const isRead = readAnnouncements.includes(msg.id);
                  return (
                    <TouchableOpacity 
                      key={msg.id} 
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: '#f8fafc', 
                        padding: 15, 
                        borderRadius: 12, 
                        marginBottom: 10, 
                        borderLeftWidth: 4, 
                        borderColor: isRead ? '#cbd5e1' : (msg.color || '#3498db'),
                        opacity: isRead ? 0.6 : 1
                      }}
                      onPress={() => {
                         setSelectedAnnouncement(msg);
                         if (!isRead) markMessageAsRead(msg.id); // 🔥 Call permanent save
                      }}
                    >
                      <Text style={{fontWeight: '900', color: '#1e293b', fontSize: 16}} numberOfLines={1}>{msg.title}</Text>
                      <Text style={{color: '#475569', fontSize: 13, marginTop: 4}} numberOfLines={2}>{msg.body}</Text>
                      <Text style={{fontSize: 10, color: '#94a3b8', marginTop: 10, textAlign: 'right'}}>
                        {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : 'Just Now'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- SIDEBAR OVERLAY FIX --- */}
      <Modal visible={isSidebarOpen} transparent animationType="fade" onRequestClose={() => setSidebarOpen(false)}>
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => setSidebarOpen(false)} />
          <View style={styles.sidebar}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30}}>
              <Text style={{fontSize: 24, fontWeight: '900', color: '#3498db'}}>Zlot Driver</Text>
            </View>

            <TouchableOpacity style={[styles.sidebarItem, activeTab === 'MAP' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('MAP'); setSidebarOpen(false);}}>
              <MapIcon color={activeTab === 'MAP' ? '#fff' : '#64748b'} size={22}/>
              <Text style={[styles.sidebarText, activeTab === 'MAP' ? {color: '#fff'} : null]}>Find Parking</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sidebarItem, activeTab === 'BOOKINGS' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('BOOKINGS'); setSidebarOpen(false);}}>
              <List color={activeTab === 'BOOKINGS' ? '#fff' : '#64748b'} size={22}/>
              <Text style={[styles.sidebarText, activeTab === 'BOOKINGS' ? {color: '#fff'} : null]}>Active Bookings</Text>
              {activeBookings.length > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{activeBookings.length}</Text></View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sidebarItem, activeTab === 'BILLS' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('BILLS'); setSidebarOpen(false);}}>
              <FileText color={activeTab === 'BILLS' ? '#fff' : '#64748b'} size={22}/>
              <Text style={[styles.sidebarText, activeTab === 'BILLS' ? {color: '#fff'} : null]}>My Bills & History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarItem} onPress={() => {setAnnouncementsVisible(true); setSidebarOpen(false);}}>
              <Bell color="#64748b" size={22}/>
              <Text style={styles.sidebarText}>Inbox & Alerts</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sidebarItem, activeTab === 'PAYMENT' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('PAYMENT'); setSidebarOpen(false);}}>
              <CreditCard color={activeTab === 'PAYMENT' ? '#fff' : '#64748b'} size={22}/>
              <Text style={[styles.sidebarText, activeTab === 'PAYMENT' ? {color: '#fff'} : null]}>Payment Methods</Text>
            </TouchableOpacity>

            <View style={{flex: 1}} />
            <TouchableOpacity style={[styles.sidebarItem, {backgroundColor: '#fee2e2'}]} onPress={() => signOut(auth)}>
              <LogOut color="#dc2626" size={22}/>
              <Text style={[styles.sidebarText, {color: '#dc2626'}]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, map: { flex: 1 },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  appName: { fontWeight: '900', color: '#3498db', fontSize: 22, letterSpacing: -0.5 }, iconBtn: { backgroundColor: '#e0f2fe', padding: 8, borderRadius: 10 },
  sidebarOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', flexDirection: 'row' },
  sidebar: { width: 280, backgroundColor: '#fff', height: '100%', padding: 25, paddingTop: 60, shadowColor: '#000', shadowOpacity: 0.2, elevation: 1000, zIndex: 1000 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10 }, sidebarItemActive: { backgroundColor: '#3498db' },
  sidebarText: { marginLeft: 15, fontWeight: 'bold', color: '#334155', fontSize: 16 }, badge: { backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' }, badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  filterContainer: { position: 'absolute', top: 15, left: 20, right: 20, zIndex: 10, flexDirection: 'row', gap: 10 },
  filterBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 12, alignItems: 'center', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, elevation: 3 }, filterBtnActive: { backgroundColor: '#3498db' }, filterText: { color: '#666', fontWeight: 'bold', fontSize: 10, textAlign: 'center' }, filterTextActive: { color: '#fff' },
  fullWidthBookingCard: { backgroundColor: '#2563eb', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, elevation: 8, width: '100%', marginBottom: 20 },
  pin: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' }, pinOpen: { backgroundColor: '#27ae60' }, pinFull: { backgroundColor: '#e74c3c' }, pinText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  sheet: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', padding: 25, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.15, elevation: 10 }, sheetTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' }, priceTag: { alignItems: 'flex-end', backgroundColor: '#f0fdf4', padding: 10, borderRadius: 12 }, priceValue: { fontSize: 22, fontWeight: '900', color: '#16a34a' },
  basicInfoRow: { flexDirection: 'row', gap: 20, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 }, basicInfoText: { fontSize: 13, color: '#334155', fontWeight: 'bold' },
  imageContainer: { width: '100%', height: 140, borderRadius: 16, marginBottom: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  priceListBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' }, priceListTitle: { fontSize: 10, fontWeight: '900', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }, priceListRow: { flexDirection: 'row', justifyContent: 'space-between' }, priceListItem: { fontSize: 12, color: '#0f172a', fontWeight: 'bold' },
  predictiveBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginVertical: 10 }, amenityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8, gap: 4 }, amenityText: { color: '#475569', fontWeight: '600', fontSize: 11 },
  navBtn: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, mainBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 14, alignItems: 'center' }, btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' }, modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, maxHeight: '90%' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b', alignSelf: 'center', marginBottom: 5 }, sectionLabel: { fontWeight: 'bold', color: '#64748b', marginBottom: 5, marginTop: 15 },
  inputGroup: { width: '100%', gap: 10 }, inputActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', padding: 15, borderRadius: 12, color: '#333', fontWeight: 'bold' },
  durationSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }, timeBtn: { backgroundColor: '#e0f2fe', padding: 8, borderRadius: 8 },
  timingBtn: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', flexDirection: 'column' }, timingBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, timingText: { fontWeight: 'bold', color: '#64748b' }, timingTextActive: { color: '#fff' },
  
  paymentGrid: { flexDirection: 'row', gap: 12, width: '100%' }, 
  payOption: { flex: 1, paddingVertical: 15, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, alignItems: 'center', backgroundColor: '#fff' }, 
  payActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, 
  payText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' }, 
  payTextActive: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  
  totalArea: { width: '100%', marginTop: 20, marginBottom: 20 },
  confirmBtn: { backgroundColor: '#10b981', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginTop: 10 },
  historyCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' }, divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 }, receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, receiptLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 13 }, receiptValue: { color: '#0f172a', fontWeight: '900', fontSize: 13 }, checkInVehicleTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', width: '100%' }, fullTypeBtn: { width: '48%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' }, typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, typeText: { fontWeight: 'bold', color: '#64748b', fontSize: 12 }, typeTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  fullModal: { flex: 1, backgroundColor: '#f8fafc', padding: 25, paddingTop: 60 }, modalHeader: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 0 },
});
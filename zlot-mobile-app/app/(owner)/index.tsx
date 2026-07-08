import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Modal, ScrollView, TextInput, Alert, Image } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { Camera, Plus, Minus, LogOut, User, Banknote, ShieldAlert, MapPin, AlertCircle, CreditCard, Menu, LayoutGrid, LayoutDashboard, X, Power, CheckCircle2, Image as ImageIcon, Clock, QrCode as QrCodeIcon, Shield, Mail, Bell } from 'lucide-react-native';

const LOCAL_BACKEND_URL = "http://192.168.10.98:3000"; 

export default function OwnerDashboard() {
  const [lotData, setLotData] = useState<any>(null);
  const [userAdminMsg, setUserAdminMsg] = useState(''); 
  const [allTransactions, setAllTransactions] = useState<any[]>([]); 
  const [violationsLog, setViolationsLog] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const [globalPricingLimits, setGlobalPricingLimits] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'BLUEPRINT'>('DASHBOARD');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isLedgerVisible, setLedgerVisible] = useState(false);
  const [isViolationModalVisible, setViolationModalVisible] = useState(false);
  const [isViolationsLogVisible, setViolationsLogVisible] = useState(false); 

  const [isInboxVisible, setIsInboxVisible] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  const [isSpotScheduleVisible, setIsSpotScheduleVisible] = useState(false);
  const [scheduleSpot, setScheduleSpot] = useState<{spot: any, txs: any[]}>({ spot: null, txs: [] });

  const [businessLicenseUri, setBusinessLicenseUri] = useState<string | null>(null);
  const [spotPhotoUri, setSpotPhotoUri] = useState<string | null>(null);
  const [lankaQrUri, setLankaQrUri] = useState<string | null>(null); 

  const [violationPlate, setViolationPlate] = useState('');
  const [violationVehicleType, setViolationVehicleType] = useState('CAR');
  const [violationReason, setViolationReason] = useState('');
  const [violationPhoto, setViolationPhoto] = useState<string | null>(null);
  const [violationStep, setViolationStep] = useState(1);
  const [violationDriverDetails, setViolationDriverDetails] = useState<any>(null);
  const [isCheckingVehicle, setIsCheckingVehicle] = useState(false);

  const [ownerProfile, setOwnerProfile] = useState({ name: '', phone: '', parkName: '', openTime: '06:00 AM', closeTime: '10:00 PM' });
  const [spots, setSpots] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });
  const [rates, setRates] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });

  // --- NEW: LONG-TERM DISCOUNT STATE ---
  const [discounts, setDiscounts] = useState({
    car: { threshold: '', percentage: '' },
    bike: { threshold: '', percentage: '' },
    tuktuk: { threshold: '', percentage: '' },
    lorry: { threshold: '', percentage: '' }
  });

  const [manualPlateInput, setManualPlateInput] = useState('');
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState<any>(null);
  const [walkInVehicleType, setWalkInVehicleType] = useState('CAR');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('CASH');

  const getVehicleLabel = (type: string) => {
    if (!type) return 'Unknown';
    const labels: any = { 'CAR': 'Car / Van', 'BIKE': 'Bike / Scooter', 'TUKTUK': 'Tuk Tuk', 'LORRY': 'Lorry' };
    return labels[type.toUpperCase()] || type;
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) setUserAdminMsg(docSnap.data().adminMessage || '');
    });

    const lotQuery = query(collection(db, 'parking_lots'), where('ownerId', '==', auth.currentUser.uid));
    const unsubscribeLot = onSnapshot(lotQuery, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setLotData({ id: snapshot.docs[0].id, ...data });
        setOwnerProfile({ name: data.ownerName || '', phone: data.phone || '', parkName: data.name || '', openTime: data.operating_hours?.open || '06:00 AM', closeTime: data.operating_hours?.close || '10:00 PM' });
        setBusinessLicenseUri(data.business_license_uri || null);
        setSpotPhotoUri(data.spot_photo_uri || null);
        setLankaQrUri(data.lanka_qr_uri || null);
        if (data.vehicle_spots) setSpots({ car: data.vehicle_spots.CAR?.toString()||'', bike: data.vehicle_spots.BIKE?.toString()||'', tuktuk: data.vehicle_spots.TUKTUK?.toString()||'', lorry: data.vehicle_spots.LORRY?.toString()||'' });
        if (data.vehicle_rates) setRates({ car: data.vehicle_rates.CAR?.toString()||'', bike: data.vehicle_rates.BIKE?.toString()||'', tuktuk: data.vehicle_rates.TUKTUK?.toString()||'', lorry: data.vehicle_rates.LORRY?.toString()||'' });
        
        // Load Discounts if they exist
        if (data.vehicle_discounts) {
          setDiscounts({
            car: { threshold: data.vehicle_discounts.CAR?.threshold?.toString()||'', percentage: data.vehicle_discounts.CAR?.percentage?.toString()||'' },
            bike: { threshold: data.vehicle_discounts.BIKE?.threshold?.toString()||'', percentage: data.vehicle_discounts.BIKE?.percentage?.toString()||'' },
            tuktuk: { threshold: data.vehicle_discounts.TUKTUK?.threshold?.toString()||'', percentage: data.vehicle_discounts.TUKTUK?.percentage?.toString()||'' },
            lorry: { threshold: data.vehicle_discounts.LORRY?.threshold?.toString()||'', percentage: data.vehicle_discounts.LORRY?.percentage?.toString()||'' }
          });
        }
      } else { setLotData(null); }
      setLoading(false);
    });

    const pricingRef = doc(db, 'system_settings', 'pricing');
    const unsubscribePricing = onSnapshot(pricingRef, (pricingSnap) => {
      if (pricingSnap.exists()) setGlobalPricingLimits(pricingSnap.data());
    });

    const annQuery = query(collection(db, 'announcements'));
    const unsubAnnouncements = onSnapshot(annQuery, (snapshot) => {
      const currentUid = auth.currentUser?.uid;
      const list: any[] = [];
      
      snapshot.forEach(docSnap => {
        const item = docSnap.data();
        if (item.target === 'ALL' || item.target === 'OWNER' || (item.target === 'SPECIFIC' && item.targetUid === currentUid)) {
          list.push({ id: docSnap.id, ...item });
        }
      });
      
      list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setNotificationsList(list);
    });

    return () => { unsubscribeLot(); unsubUser(); unsubscribePricing(); unsubAnnouncements(); };
  }, []);

  useEffect(() => {
    if (!lotData?.id) return;
    
    const transQuery = query(collection(db, 'transactions'), where('lotId', '==', lotData.id));
    const unsubscribeTrans = onSnapshot(transQuery, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })); 
      const getSafeTime = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime(); 
        if (typeof val.getTime === 'function') return val.getTime(); 
        return new Date(val).getTime(); 
      };
      setAllTransactions(txs.sort((a: any, b: any) => getSafeTime(b.arrivalTime) - getSafeTime(a.arrivalTime)));
    });

    const violQuery = query(collection(db, 'violations'), where('lotId', '==', lotData.id));
    const unsubscribeViolations = onSnapshot(violQuery, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setViolationsLog(logs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)));
    });

    return () => { unsubscribeTrans(); unsubscribeViolations(); };
  }, [lotData?.id]);

  const uploadImageToLocalServer = async (localUri: string) => {
    try {
      const formData = new FormData();
      formData.append('photo', { uri: localUri, name: `photo_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      const res = await fetch(`${LOCAL_BACKEND_URL}/api/upload`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const data = await res.json();
      return `${LOCAL_BACKEND_URL}${data.url}`;
    } catch (err) { return null; }
  };

  const pickImage = async (setter: Function) => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) setter(result.assets[0].uri); 
  };

  const toggleParkStatus = async () => {
    if (!lotData) return;
    await updateDoc(doc(db, 'parking_lots', lotData.id), { is_open: !lotData.is_open });
  };

  const generateBlueprint = async () => {
    if (!lotData || lotData.spot_layout) return;
    let generatedSpots: any[] = [];
    const addSpots = (type: string, count: number, prefix: string) => {
      for(let i = 0; i < count; i++) { generatedSpots.push({ id: `${prefix}-${i+1}`, label: `${prefix}${i+1}`, type: type, status: 'FREE', txId: null, licensePlate: null, arrivalTime: null }); }
    };
    if (lotData.vehicle_spots?.CAR) addSpots('CAR', lotData.vehicle_spots.CAR, 'C');
    if (lotData.vehicle_spots?.BIKE) addSpots('BIKE', lotData.vehicle_spots.BIKE, 'B');
    if (lotData.vehicle_spots?.TUKTUK) addSpots('TUKTUK', lotData.vehicle_spots.TUKTUK, 'T');
    if (lotData.vehicle_spots?.LORRY) addSpots('LORRY', lotData.vehicle_spots.LORRY, 'L');
    await updateDoc(doc(db, 'parking_lots', lotData.id), { spot_layout: generatedSpots });
  };

  const adjustCapacity = async (change: number) => {
    if (!lotData) return;
    const newSpots = Math.max(0, Math.min(lotData.capacity_total, lotData.available_spots + change));
    await updateDoc(doc(db, 'parking_lots', lotData.id), { available_spots: newSpots });
  };

  const handleUpdateProfile = async () => {
    if (!lotData) return;
    if (globalPricingLimits) {
      const carVal = Number(rates.car) || 0;
      if (carVal < globalPricingLimits.car.min || carVal > globalPricingLimits.car.max) return Alert.alert("Limit Exceeded", `Car rate must be between Rs. ${globalPricingLimits.car.min} and Rs. ${globalPricingLimits.car.max}`);
      const bikeVal = Number(rates.bike) || 0;
      if (bikeVal < globalPricingLimits.bike.min || bikeVal > globalPricingLimits.bike.max) return Alert.alert("Limit Exceeded", `Bike rate must be between Rs. ${globalPricingLimits.bike.min} and Rs. ${globalPricingLimits.bike.max}`);
      const tuktukVal = Number(rates.tuktuk) || 0;
      if (tuktukVal < globalPricingLimits.tuktuk.min || tuktukVal > globalPricingLimits.tuktuk.max) return Alert.alert("Limit Exceeded", `Tuk Tuk rate must be between Rs. ${globalPricingLimits.tuktuk.min} and Rs. ${globalPricingLimits.tuktuk.max}`);
      const lorryVal = Number(rates.lorry) || 0;
      if (lorryVal < globalPricingLimits.lorry.min || lorryVal > globalPricingLimits.lorry.max) return Alert.alert("Limit Exceeded", `Lorry rate must be between Rs. ${globalPricingLimits.lorry.min} and Rs. ${globalPricingLimits.lorry.max}`);
    }

    Alert.alert("Uploading Data...", "Please wait while we sync your data.");
    try {
      let finalLicenseUrl = businessLicenseUri;
      let finalSpotUrl = spotPhotoUri;
      let finalQrUrl = lankaQrUri;

      if (businessLicenseUri?.startsWith('file://')) finalLicenseUrl = await uploadImageToLocalServer(businessLicenseUri);
      if (spotPhotoUri?.startsWith('file://')) finalSpotUrl = await uploadImageToLocalServer(spotPhotoUri);
      if (lankaQrUri?.startsWith('file://')) finalQrUrl = await uploadImageToLocalServer(lankaQrUri);

      const totalCap = (parseInt(spots.car)||0) + (parseInt(spots.bike)||0) + (parseInt(spots.tuktuk)||0) + (parseInt(spots.lorry)||0);
      
      let currentLayout = lotData.spot_layout ? [...lotData.spot_layout] : [];
      const adjustLayoutForType = (type: string, count: number, prefix: string) => {
        const existingSpots = currentLayout.filter(s => s.type === type);
        if (existingSpots.length < count) {
          const startIdx = existingSpots.length;
          for (let i = startIdx; i < count; i++) {
             currentLayout.push({ id: `${prefix}-${Date.now()}-${i}`, label: `${prefix}${i+1}`, type: type, status: 'FREE', txId: null, licensePlate: null, arrivalTime: null });
          }
        } else if (existingSpots.length > count) {
          let diff = existingSpots.length - count;
          for (let i = currentLayout.length - 1; i >= 0 && diff > 0; i--) {
             if (currentLayout[i].type === type && currentLayout[i].status === 'FREE') {
                currentLayout.splice(i, 1);
                diff--;
             }
          }
        }
      };

      adjustLayoutForType('CAR', Number(spots.car)||0, 'C');
      adjustLayoutForType('BIKE', Number(spots.bike)||0, 'B');
      adjustLayoutForType('TUKTUK', Number(spots.tuktuk)||0, 'T');
      adjustLayoutForType('LORRY', Number(spots.lorry)||0, 'L');
      
      const occupiedCount = currentLayout.filter(s => s.status !== 'FREE').length;

      const updatePayload: any = {
        name: ownerProfile.parkName, ownerName: ownerProfile.name, phone: ownerProfile.phone, capacity_total: totalCap,
        available_spots: Math.max(0, totalCap - occupiedCount),
        operating_hours: { open: ownerProfile.openTime, close: ownerProfile.closeTime },
        vehicle_spots: { CAR: Number(spots.car)||0, BIKE: Number(spots.bike)||0, TUKTUK: Number(spots.tuktuk)||0, LORRY: Number(spots.lorry)||0 },
        vehicle_rates: { CAR: Number(rates.car)||0, BIKE: Number(rates.bike)||0, TUKTUK: Number(rates.tuktuk)||0, LORRY: Number(rates.lorry)||0 },
        
        // --- ADDED LONG-TERM DISCOUNTS PAYLOAD ---
        vehicle_discounts: {
          CAR: { threshold: Number(discounts.car.threshold)||0, percentage: Number(discounts.car.percentage)||0 },
          BIKE: { threshold: Number(discounts.bike.threshold)||0, percentage: Number(discounts.bike.percentage)||0 },
          TUKTUK: { threshold: Number(discounts.tuktuk.threshold)||0, percentage: Number(discounts.tuktuk.percentage)||0 },
          LORRY: { threshold: Number(discounts.lorry.threshold)||0, percentage: Number(discounts.lorry.percentage)||0 }
        },
        
        business_license_uri: finalLicenseUrl, spot_photo_uri: finalSpotUrl, lanka_qr_uri: finalQrUrl,
        spot_layout: currentLayout
      };

      if (lotData.status === 'REJECTED') { updatePayload.status = 'PENDING_APPROVAL'; updatePayload.adminMessage = ''; }

      await updateDoc(doc(db, 'parking_lots', lotData.id), updatePayload);

      if (auth.currentUser) {
        const userUpdate: any = { name: ownerProfile.name, phone: ownerProfile.phone };
        if (lotData.status === 'REJECTED') { userUpdate.status = 'PENDING'; userUpdate.adminMessage = ''; }
        await updateDoc(doc(db, 'users', auth.currentUser.uid), userUpdate);
      }

      setProfileModalVisible(false);
      Alert.alert("Success", "Profile and capacity updated successfully!");
    } catch (e) { Alert.alert("Error", "Update failed."); }
  };

  const handleCancelProfile = () => {
    if (lotData) {
      setOwnerProfile({ name: lotData.ownerName || '', phone: lotData.phone || '', parkName: lotData.name || '', openTime: lotData.operating_hours?.open || '06:00 AM', closeTime: lotData.operating_hours?.close || '10:00 PM' });
      setBusinessLicenseUri(lotData.business_license_uri || null);
      setSpotPhotoUri(lotData.spot_photo_uri || null);
      setLankaQrUri(lotData.lanka_qr_uri || null);
      if (lotData.vehicle_spots) setSpots({ car: lotData.vehicle_spots.CAR?.toString()||'', bike: lotData.vehicle_spots.BIKE?.toString()||'', tuktuk: lotData.vehicle_spots.TUKTUK?.toString()||'', lorry: lotData.vehicle_spots.LORRY?.toString()||'' });
      if (lotData.vehicle_rates) setRates({ car: lotData.vehicle_rates.CAR?.toString()||'', bike: lotData.vehicle_rates.BIKE?.toString()||'', tuktuk: lotData.vehicle_rates.TUKTUK?.toString()||'', lorry: lotData.vehicle_rates.LORRY?.toString()||'' });
      
      // Reset discounts
      if (lotData.vehicle_discounts) {
        setDiscounts({
          car: { threshold: lotData.vehicle_discounts.CAR?.threshold?.toString()||'', percentage: lotData.vehicle_discounts.CAR?.percentage?.toString()||'' },
          bike: { threshold: lotData.vehicle_discounts.BIKE?.threshold?.toString()||'', percentage: lotData.vehicle_discounts.BIKE?.percentage?.toString()||'' },
          tuktuk: { threshold: lotData.vehicle_discounts.TUKTUK?.threshold?.toString()||'', percentage: lotData.vehicle_discounts.TUKTUK?.percentage?.toString()||'' },
          lorry: { threshold: lotData.vehicle_discounts.LORRY?.threshold?.toString()||'', percentage: lotData.vehicle_discounts.LORRY?.percentage?.toString()||'' }
        });
      }
    }
    setProfileModalVisible(false);
  };

  const getRateForVehicle = (type: string) => {
    if (lotData?.vehicle_rates && lotData.vehicle_rates[type]) return lotData.vehicle_rates[type];
    return lotData?.hourly_rate || 100; 
  };

  const openSpotDetails = (spot: any) => {
    const spotTransactions = allTransactions.filter(t => t.spotNumber === spot.id && (t.status === 'Pending Arrival' || t.status === 'Active'));
    spotTransactions.sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      const timeA = a.expectedArrival ? a.expectedArrival.toDate().getTime() : 0;
      const timeB = b.expectedArrival ? b.expectedArrival.toDate().getTime() : 0;
      return timeA - timeB;
    });

    setScheduleSpot({ spot, txs: spotTransactions });
    setIsSpotScheduleVisible(true);
  };

  const processVehiclePlate = async (plateStr: string) => {
    const plate = plateStr.trim().toUpperCase();
    if (!plate || !lotData) return;

    try {
      const activeTxList = allTransactions.filter(t => 
        t.licensePlate && t.licensePlate.toUpperCase() === plate && 
        (t.status === 'Pending Arrival' || t.status === 'Active')
      );

      let activeTx = activeTxList.length > 0 ? { ...activeTxList[0] } : null;

      if (activeTx) {
        const now = new Date();
        
        if (activeTx.status === 'Active') {
          const arrivalTime = activeTx.actualArrivalTime ? activeTx.actualArrivalTime.toDate() : (activeTx.arrivalTime?.toDate() || new Date());
          const expectedDeparture = activeTx.expectedDeparture ? activeTx.expectedDeparture.toDate() : null;
          
          const stayMinutes = Math.max(1, Math.floor((now.getTime() - arrivalTime.getTime()) / 60000));
          const stayHours = stayMinutes / 60;
          
          const vType = (activeTx.vehicleType || 'CAR').toUpperCase();
          const vehicleRate = getRateForVehicle(vType);
          const minCharge = Math.round(vehicleRate / 4);
          const vDiscount = lotData?.vehicle_discounts?.[vType] || { threshold: 0, percentage: 0 };
          
          let extraDue = 0;
          let overstayMins = 0;
          let baseCost = 0;
          let discountMsg = '';

          if (expectedDeparture) {
             if (now.getTime() > expectedDeparture.getTime()) {
                 overstayMins = Math.floor((now.getTime() - expectedDeparture.getTime()) / 60000);
                 if (overstayMins > 0) {
                     let rawOverstayCost = (overstayMins / 60) * vehicleRate;
                     
                     // Check if Total Stay qualifies for discount on the overstay fee
                     if (vDiscount.threshold > 0 && stayHours >= vDiscount.threshold) {
                         rawOverstayCost = rawOverstayCost * (1 - (vDiscount.percentage / 100));
                         discountMsg = `Overstay Discounted (${vDiscount.percentage}%)`;
                     }

                     extraDue = Math.max(Math.round(rawOverstayCost), minCharge); 
                 }
             }
          } else {
             let rawStayCost = stayHours * vehicleRate;
             
             // Check if Walk-in Total Stay qualifies for long-stay discount
             if (vDiscount.threshold > 0 && stayHours >= vDiscount.threshold) {
                 rawStayCost = rawStayCost * (1 - (vDiscount.percentage / 100));
                 discountMsg = `Long-Stay Discount (${vDiscount.percentage}%)`;
             }

             baseCost = Math.max(Math.round(rawStayCost), minCharge);
             extraDue = Math.max(0, baseCost - (activeTx.amountPaid || 0));
          }

          activeTx.arrivalTimeStr = arrivalTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          activeTx.departureTimeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          activeTx.actualHoursStayedStr = stayMinutes >= 60 ? `${Math.floor(stayMinutes/60)} hr ${stayMinutes%60 > 0 ? `${stayMinutes%60} min` : ''}` : `${stayMinutes} min`;
          activeTx.overstayStr = overstayMins > 0 ? (overstayMins >= 60 ? `${Math.floor(overstayMins/60)} hr ${overstayMins%60 > 0 ? `${overstayMins%60} min` : ''}` : `${overstayMins} min`) : '0 min';
          activeTx.hourlyRate = vehicleRate;
          activeTx.extraDue = extraDue;
          activeTx.discountMsg = discountMsg; // Attach discount string to receipt
          activeTx.finalTotal = (activeTx.amountPaid || 0) + extraDue;

          setCheckoutPaymentMethod('CASH'); 
        } else {
           const start = activeTx.expectedArrival ? activeTx.expectedArrival.toDate() : null;
           const end = activeTx.expectedDeparture ? activeTx.expectedDeparture.toDate() : null;

           if (start && now.getTime() < start.getTime()) {
               const startTimeStr = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
               return Alert.alert(
                 "Too Early for Check-In", 
                 `This vehicle is scheduled to arrive at ${startTimeStr}. Check-ins are strictly disabled before the scheduled time.`
               );
           }
           if (end && now.getTime() > end.getTime()) {
               return Alert.alert("Reservation Expired", "This vehicle completely missed its booking allocation window.");
           }
           if(!activeTx.spotNumber || activeTx.spotNumber === "AUTO") activeTx.spotNumber = findFreeSpot(activeTx.vehicleType || 'CAR');
        }

        setCurrentVehicle(activeTx);
        setIsSpotScheduleVisible(false);
        setVehicleModalVisible(true);
      } else {
        setWalkInVehicleType('CAR'); 
        setCurrentVehicle({ isNew: true, licensePlate: plate, status: 'Walk-up', spotNumber: findFreeSpot('CAR') });
        setIsSpotScheduleVisible(false); 
        setVehicleModalVisible(true);
      }
      setManualPlateInput('');
    } catch (error) { Alert.alert("Error", "Process allocation exception occurred."); }
  };

  const findFreeSpot = (type: string) => {
    if (!lotData?.spot_layout) return "A-1";
    const freeSpot = lotData.spot_layout.find((s: any) => s.type === type && s.status === 'FREE');
    return freeSpot ? freeSpot.id : "FULL";
  };

  const handleCancelBooking = (booking: any) => {
    Alert.alert(
      "Cancel Booking & Refund",
      `Are you sure you want to cancel ${booking.licensePlate}'s reservation? The driver will be fully refunded.`,
      [
        { text: "No, Keep it", style: "cancel" },
        { text: "Yes, Cancel & Refund", style: "destructive", onPress: async () => {
            try {
              const amountPaid = booking.amountPaid || 0;
              await updateDoc(doc(db, 'transactions', booking.id), { 
                status: 'Cancelled - Refunded',
                amountPaid: 0, 
                refundedAmount: amountPaid,
                driverNotifiedOfCancel: false, 
                adminMessage: 'Cancelled by Owner. Full refund initiated.'
              });

              let layoutUpdates = lotData.spot_layout ? [...lotData.spot_layout] : [];
              const spotIndex = layoutUpdates.findIndex((s: any) => s.id === booking.spotNumber);
              
              if (spotIndex !== -1 && layoutUpdates[spotIndex].txId === booking.id) {
                 layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'FREE', txId: null, licensePlate: null };
                 await updateDoc(doc(db, 'parking_lots', lotData.id), { 
                    spot_layout: layoutUpdates,
                    available_spots: Math.min(lotData.capacity_total, lotData.available_spots + 1)
                 });
              } else {
                 await updateDoc(doc(db, 'parking_lots', lotData.id), {
                    available_spots: Math.min(lotData.capacity_total, lotData.available_spots + 1)
                 });
              }

              Alert.alert("Cancelled", "Booking cancelled. Refund processed and driver notified via app.");
              setIsSpotScheduleVisible(false);
              setVehicleModalVisible(false);
            } catch (e) {
              Alert.alert("Error", "Could not cancel the booking.");
            }
        }}
      ]
    );
  };

  const confirmVehicleAction = async () => {
    try {
      let assignedSpotId = currentVehicle.spotNumber;
      let layoutUpdates = lotData.spot_layout ? [...lotData.spot_layout] : [];

      if (currentVehicle.isNew) {
        if (!assignedSpotId || assignedSpotId === "FULL") {
          return Alert.alert("Capacity Reached", `There are no free spots available for ${getVehicleLabel(walkInVehicleType)}s at this moment.`);
        }
        
        if (layoutUpdates.length > 0) {
          const spotCheck = layoutUpdates.find(s => s.id === assignedSpotId);
          if (!spotCheck) return Alert.alert("Invalid Spot", `Spot ${assignedSpotId} does not exist in your layout.`);
          if (spotCheck.status !== 'FREE') return Alert.alert("Spot Occupied", `Spot ${assignedSpotId} is currently ${spotCheck.status}.`);
        }

        const newTxRef = await addDoc(collection(db, 'transactions'), {
          lotId: lotData.id, licensePlate: currentVehicle.licensePlate, vehicleType: walkInVehicleType, 
          status: 'Active', actualArrivalTime: new Date(), arrivalTime: new Date(), paymentMethod: 'PENDING', amountPaid: 0, 
          spotNumber: assignedSpotId, timestamp: serverTimestamp(), convenienceFee: 0 
        });
        await updateDoc(doc(db, 'parking_lots', lotData.id), { available_spots: Math.max(0, lotData.available_spots - 1) });
        
        const spotIndex = layoutUpdates.findIndex((s: any) => s.id === assignedSpotId);
        if (spotIndex !== -1) {
          layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'OCCUPIED', txId: newTxRef.id, licensePlate: currentVehicle.licensePlate };
          await updateDoc(doc(db, 'parking_lots', lotData.id), { spot_layout: layoutUpdates });
        }
      } 
      else if (currentVehicle.status === 'Pending Arrival') {
        if (!assignedSpotId || assignedSpotId === "FULL") return Alert.alert("Spot Issue", "Invalid spot assignment.");

        await updateDoc(doc(db, 'transactions', currentVehicle.id), { status: 'Active', actualArrivalTime: new Date() });
        const spotIndex = layoutUpdates.findIndex((s: any) => s.id === assignedSpotId);
        if (spotIndex !== -1) {
          layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'OCCUPIED', txId: currentVehicle.id, licensePlate: currentVehicle.licensePlate };
          await updateDoc(doc(db, 'parking_lots', lotData.id), { spot_layout: layoutUpdates });
        }
      } 
      else if (currentVehicle.status === 'Active') {
        await updateDoc(doc(db, 'transactions', currentVehicle.id), { 
          status: 'Completed', departureTime: new Date(), 
          amountPaid: currentVehicle.finalTotal,
          paymentMethod: checkoutPaymentMethod, 
          finalPaymentMethod: currentVehicle.extraDue > 0 ? checkoutPaymentMethod : currentVehicle.paymentMethod
        });
        await updateDoc(doc(db, 'parking_lots', lotData.id), { available_spots: Math.min(lotData.capacity_total, lotData.available_spots + 1) });

        const spotIndex = layoutUpdates.findIndex((s: any) => s.id === currentVehicle.spotNumber);
        if (spotIndex !== -1) {
          const futureTxs = allTransactions.filter(t => t.spotNumber === assignedSpotId && t.status === 'Pending Arrival' && t.id !== currentVehicle.id);
          if (futureTxs.length > 0) {
            layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'BOOKED', txId: futureTxs[0].id, licensePlate: futureTxs[0].licensePlate };
          } else {
            layoutUpdates[spotIndex] = { ...layoutUpdates[spotIndex], status: 'FREE', txId: null, licensePlate: null };
          }
          await updateDoc(doc(db, 'parking_lots', lotData.id), { spot_layout: layoutUpdates });
        }
      }
      setVehicleModalVisible(false);
      setCurrentVehicle(null);
    } catch (e) { Alert.alert("Error", "Could not process transaction updates."); }
  };

  const handleTakeReportPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) setViolationPhoto(result.assets[0].uri);
  };

  const resetViolationState = () => {
    setViolationPlate('');
    setViolationReason('');
    setViolationPhoto(null);
    setViolationVehicleType('CAR');
    setViolationStep(1);
    setViolationDriverDetails(null);
  };

  const handleCheckVehicle = async () => {
    if (!violationPlate || !violationReason) return Alert.alert("Required", "Please enter the vehicle number and reason.");
    setIsCheckingVehicle(true);
    
    try {
        const cleanSearchPlate = violationPlate.replace(/[^A-Z0-9]/ig, '').toUpperCase();
        
        const activeTx = allTransactions.find(t => 
            t.licensePlate && 
            t.licensePlate.replace(/[^A-Z0-9]/ig, '').toUpperCase() === cleanSearchPlate &&
            (t.status === 'Active' || t.status === 'Pending Arrival')
        );

        let foundDriverId = activeTx?.driverId;
        
        if (foundDriverId && foundDriverId !== 'Unknown') {
            const dDoc = await getDoc(doc(db, 'users', foundDriverId));
            if (dDoc.exists()) {
                setViolationDriverDetails({
                    driverId: foundDriverId,
                    name: dDoc.data().name || 'Unknown',
                    phone: dDoc.data().phone || 'N/A',
                    nic: dDoc.data().nic || 'N/A',
                    txId: activeTx.id
                });
            } else {
                setViolationDriverDetails(null);
            }
        } else {
            setViolationDriverDetails(null);
        }
        setViolationStep(2);
    } catch (e) {
        Alert.alert("Error", "Could not check vehicle registration status.");
    }
    setIsCheckingVehicle(false);
  };

  const handleSendWarning = async () => {
    if (!violationDriverDetails) return;
    Alert.alert("Sending Warning...", "Please wait.");
    try {
        await addDoc(collection(db, 'announcements'), {
            title: `⚠️ Parking Warning from ${lotData.name}`,
            body: `Vehicle: ${violationPlate}\nType: ${getVehicleLabel(violationVehicleType)}\nMessage: ${violationReason}`,
            target: 'SPECIFIC',
            targetUid: violationDriverDetails.driverId,
            timestamp: serverTimestamp(),
            sender: lotData.name
        });
        setViolationModalVisible(false);
        resetViolationState();
        Alert.alert("Warning Sent", "A direct message has been sent to the driver's inbox.");
    } catch (error) {
        Alert.alert("Error", "Failed to send warning message.");
    }
  };

  const handleReportViolation = async () => {
    Alert.alert("Uploading Report...", "Please wait while we log the violation.");
    
    try {
      let finalNetworkUrl = null;
      if (violationPhoto) {
        finalNetworkUrl = await uploadImageToLocalServer(violationPhoto);
      }

      let driverId = violationDriverDetails ? violationDriverDetails.driverId : null;
      let txId = violationDriverDetails ? violationDriverDetails.txId : null;
      let driverDetails = violationDriverDetails ? 
         { name: violationDriverDetails.name, phone: violationDriverDetails.phone, nic: violationDriverDetails.nic } : 
         { name: 'Unknown Walk-In', phone: 'N/A', nic: 'N/A' };

      if (txId) {
          await updateDoc(doc(db, 'transactions', txId), {
              isImpounded: true,
              impoundFee: 5000,
              driverNotifiedOfImpound: false,
              adminMessage: `Owner Reported: ${violationReason}` 
          });
      }

      await addDoc(collection(db, 'violations'), {
        lotId: lotData.id, 
        ownerId: auth.currentUser?.uid, 
        licensePlate: violationPlate,
        vehicleType: violationVehicleType, 
        driverId: driverId, 
        driverName: driverDetails.name,
        driverPhone: driverDetails.phone,
        driverNic: driverDetails.nic,
        txId: txId,
        reason: violationReason, 
        photoUri: finalNetworkUrl, 
        timestamp: serverTimestamp(), 
        status: 'IMPOUNDED', 
        fineAmount: 5000
      });

      setViolationModalVisible(false); 
      resetViolationState();
      Alert.alert("Vehicle Reported", "Violation logged. If this is a registered driver, they have been penalized and notified instantly.");
    } catch (error) { Alert.alert("Error", "Failed to report vehicle."); }
  };

  const handleAIScan = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert("Denied", "Camera access is required.");
      const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
      if (!result.canceled && result.assets[0].base64) {
        setManualPlateInput('Scanning...'); 
        const FREE_API_TOKEN = "c3d1ed1bc0497453bbd916d8cd8022ce748a1eb3"; 
        const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${FREE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            upload: `data:image/jpeg;base64,${result.assets[0].base64}`
          })
        });
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          let cleanPlate = data.results[0].plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (/^[A-Z]{2,3}\d{4}$/.test(cleanPlate)) cleanPlate = cleanPlate.replace(/^([A-Z]{2,3})(\d{4})$/, "$1-$2");
          setManualPlateInput(cleanPlate);
        } else {
          setManualPlateInput('');
          Alert.alert("No Plate Found", "The AI couldn't clearly read a vehicle plate in that image.");
        }
      }
    } catch (error) {
      setManualPlateInput('');
      Alert.alert("AI Offline", "Make sure your phone is connected to the internet.");
    }
  };

  const renderSafeTime = (timeObj: any) => {
    if (!timeObj) return 'N/A';
    if (timeObj.toDate) return timeObj.toDate().toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'});
    return new Date(timeObj).toLocaleString([], {hour: '2-digit', minute:'2-digit', month:'short', day:'numeric'});
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3498db"/></View>;
  const isBlocked = !lotData || lotData.status === 'PENDING_APPROVAL' || lotData.status === 'REJECTED';
  const displayAdminMsg = lotData?.adminMessage || userAdminMsg || '';

  const unreadCount = notificationsList.filter(msg => !readAnnouncements.includes(msg.id)).length;

  return (
    <View style={styles.container}>
      {isBlocked ? (
        <View style={[styles.center, {padding: 30, backgroundColor: '#f8fafc'}]}>
          <AlertCircle size={60} color={lotData?.status === 'REJECTED' ? "#e74c3c" : "#f59e0b"} style={{marginBottom: 20}} />
          <Text style={{fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 10, textAlign: 'center'}}>
            {lotData?.status === 'REJECTED' ? 'Application Needs Update' : 'Account Under Review'}
          </Text>
          {lotData?.status === 'REJECTED' && displayAdminMsg ? (
            <View style={{backgroundColor: '#fee2e2', padding: 20, borderRadius: 12, marginTop: 10, width: '100%', borderWidth: 1, borderColor: '#fca5a5'}}>
              <Text style={{color: '#991b1b', fontWeight: '900', fontSize: 12, marginBottom: 5, textTransform: 'uppercase'}}>Admin Feedback:</Text>
              <Text style={{color: '#7f1d1d', fontSize: 14, fontWeight: 'bold'}}>{displayAdminMsg}</Text>
            </View>
          ) : null}
          {lotData?.status === 'REJECTED' && (
            <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#3b82f6', marginTop: 20}]} onPress={() => setProfileModalVisible(true)}>
              <Text style={styles.btnText}>Edit Application Details</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#0f172a', marginTop: lotData?.status === 'REJECTED' ? 10 : 20}]} onPress={() => signOut(auth)}>
            <Text style={styles.btnText}>{lotData?.status === 'REJECTED' ? 'Sign Out' : 'Sign Out & Refresh'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {isSidebarOpen && (
            <View style={styles.sidebarOverlay}>
              <TouchableOpacity style={{flex: 1}} onPress={() => setSidebarOpen(false)} />
              <View style={styles.sidebar}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30}}>
                  <Text style={{fontSize: 24, fontWeight: '900', color: '#3498db'}}>Zlot Owner</Text>
                  <TouchableOpacity onPress={() => setSidebarOpen(false)}><X color="#64748b" size={28}/></TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.sidebarItem, activeTab === 'DASHBOARD' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('DASHBOARD'); setSidebarOpen(false);}}>
                  <LayoutDashboard color={activeTab === 'DASHBOARD' ? '#fff' : '#64748b'} size={22}/>
                  <Text style={[styles.sidebarText, activeTab === 'DASHBOARD' ? {color: '#fff'} : null]}>Command Center</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sidebarItem, activeTab === 'BLUEPRINT' ? styles.sidebarItemActive : null]} onPress={() => {setActiveTab('BLUEPRINT'); generateBlueprint(); setSidebarOpen(false);}}>
                  <LayoutGrid color={activeTab === 'BLUEPRINT' ? '#fff' : '#64748b'} size={22}/>
                  <Text style={[styles.sidebarText, activeTab === 'BLUEPRINT' ? {color: '#fff'} : null]}>Live Blueprint</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.sidebarItem} onPress={() => {setViolationsLogVisible(true); setSidebarOpen(false);}}>
                  <Shield color="#64748b" size={22}/>
                  <Text style={styles.sidebarText}>Violations Log</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarItem} onPress={() => {setIsInboxVisible(true); setSidebarOpen(false);}}>
                  <Mail color="#64748b" size={22}/>
                  <Text style={styles.sidebarText}>Inbox Messages</Text>
                  {unreadCount > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarItem} onPress={() => {setLedgerVisible(true); setSidebarOpen(false);}}>
                  <Banknote color="#64748b" size={22}/>
                  <Text style={styles.sidebarText}>Financial Ledger</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarItem} onPress={() => {setViolationModalVisible(true); setSidebarOpen(false);}}>
                  <ShieldAlert color="#ef4444" size={22}/>
                  <Text style={[styles.sidebarText, {color: '#ef4444'}]}>Report Violation</Text>
                </TouchableOpacity>

                <View style={{flex: 1}} />
                <TouchableOpacity style={[styles.sidebarItem, {backgroundColor: '#fee2e2'}]} onPress={() => signOut(auth)}>
                  <LogOut color="#dc2626" size={22}/>
                  <Text style={[styles.sidebarText, {color: '#dc2626'}]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.header}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={() => setSidebarOpen(true)} style={{marginRight: 15}}><Menu color="#0f172a" size={28} /></TouchableOpacity>
              <View>
                <Text style={styles.greeting}>{activeTab === 'DASHBOARD' ? 'Command Center' : 'Live Blueprint'}</Text>
                <Text style={styles.parkName}>{lotData?.name}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setProfileModalVisible(true)} style={styles.iconBtn}><User color="#27ae60" size={20}/></TouchableOpacity>
          </View>

          {activeTab === 'DASHBOARD' && (
            <ScrollView>
              <View style={styles.card}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Text style={styles.cardTitle}>Live Capacity Status</Text>
                  <TouchableOpacity onPress={toggleParkStatus} style={{backgroundColor: lotData?.is_open === false ? '#fee2e2' : '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5}}>
                    <Power size={14} color={lotData?.is_open === false ? '#dc2626' : '#16a34a'} />
                    <Text style={{color: lotData?.is_open === false ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: 12}}>{lotData?.is_open === false ? 'PARK CLOSED' : 'PARK OPEN'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.capacityRow}>
                  <TouchableOpacity style={styles.circleBtn} onPress={() => adjustCapacity(-1)}><Minus size={24} color="#e74c3c"/></TouchableOpacity>
                  <View style={styles.capacityDisplay}><Text style={styles.capacityNumber}>{lotData?.available_spots || 0}</Text></View>
                  <TouchableOpacity style={styles.circleBtn} onPress={() => adjustCapacity(1)}><Plus size={24} color="#27ae60"/></TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.scannerBtn} onPress={handleAIScan}>
                <Camera size={40} color="#fff" />
                <Text style={styles.scannerTitle}>AI License Plate Scanner</Text>
              </TouchableOpacity>

              <View style={{flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, gap: 10}}>
                <TextInput style={[styles.input, {flex: 1, marginBottom: 0}]} placeholder="Enter Plate (CAB-1234)" value={manualPlateInput} onChangeText={setManualPlateInput} autoCapitalize="characters"/>
                <TouchableOpacity style={{backgroundColor: '#1e293b', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center'}} onPress={() => processVehiclePlate(manualPlateInput)}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Process</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {activeTab === 'BLUEPRINT' && (
            <ScrollView style={{flex: 1}}>
              <View style={{padding: 20}}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12}}>
                  <View style={{alignItems: 'center'}}><View style={[styles.legendBox, {backgroundColor: '#22c55e'}]} /><Text style={styles.legendText}>Free</Text></View>
                  <View style={{alignItems: 'center'}}><View style={[styles.legendBox, {backgroundColor: '#eab308'}]} /><Text style={styles.legendText}>Booked</Text></View>
                  <View style={{alignItems: 'center'}}><View style={[styles.legendBox, {backgroundColor: '#ef4444'}]} /><Text style={styles.legendText}>Occupied</Text></View>
                </View>
                {lotData?.spot_layout && (
                  <View style={styles.blueprintGrid}>
                    {lotData.spot_layout.map((spot: any) => (
                      <TouchableOpacity key={spot.id} style={[styles.blueprintSpot, { width: spot.type==='LORRY'?'100%':spot.type==='BIKE'?'23%':spot.type==='TUKTUK'?'31%':'48%', backgroundColor: spot.status === 'OCCUPIED' ? '#ef4444' : spot.status === 'BOOKED' ? '#eab308' : '#22c55e' }]} onPress={() => openSpotDetails(spot)}>
                        <Text style={{color: '#fff', fontWeight: '900', fontSize: 16}}>{spot.label}</Text>
                        {spot.status === 'OCCUPIED' && <Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>{spot.licensePlate}</Text>}
                        {spot.status === 'BOOKED' && <Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>Reserved</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* --- MODAL: REPORT VIOLATION --- */}
      <Modal visible={isViolationModalVisible} animationType="fade" transparent onRequestClose={() => {setViolationModalVisible(false); resetViolationState();}}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {setViolationModalVisible(false); resetViolationState();}} />
          <View style={styles.modalContent}>
            {violationStep === 1 ? (
               <ScrollView showsVerticalScrollIndicator={false} style={{width: '100%'}}>
                  <View style={{alignItems: 'center'}}>
                      <ShieldAlert size={40} color="#dc2626" style={{marginBottom: 10}}/>
                      <Text style={styles.modalTitle}>Report Violation</Text>
                      <Text style={{color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 15}}>Enter vehicle details to check registration status.</Text>
                  </View>
                  
                  <Text style={styles.sectionLabel}>Vehicle Number</Text>
                  <TextInput style={styles.input} placeholder="e.g. CAB-1234" value={violationPlate} onChangeText={setViolationPlate} autoCapitalize="characters"/>
                  
                  <Text style={styles.sectionLabel}>Vehicle Type</Text>
                  <View style={[styles.checkInVehicleTypeRow, {marginBottom: 15}]}>
                    {['CAR', 'TUKTUK', 'BIKE', 'LORRY'].map(v => (
                      <TouchableOpacity key={v} style={[styles.fullTypeBtn, violationVehicleType === v ? styles.typeBtnActive : null]} onPress={() => setViolationVehicleType(v)}>
                        <Text style={violationVehicleType === v ? styles.typeTextActive : styles.typeText}>{getVehicleLabel(v)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>Message / Reason</Text>
                  <TextInput style={[styles.input, {height: 80}]} placeholder="e.g. Blocking entrance, Overstayed..." value={violationReason} onChangeText={setViolationReason} multiline/>
                  
                  {violationPhoto && <Image source={{ uri: violationPhoto }} style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 10 }} />}

                  <TouchableOpacity onPress={handleTakeReportPhoto} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 15, width: '100%', justifyContent: 'center'}}>
                    <Camera size={20} color="#64748b" style={{marginRight: 8}}/>
                    <Text style={{fontWeight: 'bold', color: '#64748b'}}>{violationPhoto ? 'Retake Photo' : 'Attach Photo Evidence'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#3b82f6'}]} onPress={handleCheckVehicle} disabled={isCheckingVehicle}>
                      {isCheckingVehicle ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Check Vehicle Data</Text>}
                  </TouchableOpacity>
               </ScrollView>
            ) : (
               <View style={{width: '100%', alignItems: 'center'}}>
                   <Text style={styles.modalTitle}>Vehicle Search Result</Text>
                   <Text style={{fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 20}}>{violationPlate}</Text>

                   {violationDriverDetails ? (
                       <View style={{width: '100%', backgroundColor: '#f0fdf4', padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0'}}>
                           <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                               <CheckCircle2 color="#16a34a" size={24} style={{marginRight: 10}}/>
                               <Text style={{color: '#16a34a', fontWeight: 'bold', fontSize: 16}}>Registered Driver Found</Text>
                           </View>
                           <Text style={{color: '#334155', fontWeight: 'bold', fontSize: 14, marginBottom: 5}}>Name: {violationDriverDetails.name}</Text>
                           <Text style={{color: '#334155', fontWeight: 'bold', fontSize: 14}}>Phone: {violationDriverDetails.phone}</Text>
                           
                           <View style={{marginTop: 20, gap: 10}}>
                               <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#3b82f6'}]} onPress={handleSendWarning}>
                                   <Text style={styles.btnText}>Send Warning to Inbox</Text>
                               </TouchableOpacity>
                               <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#dc2626'}]} onPress={handleReportViolation}>
                                   <Text style={styles.btnText}>Skip Warning & Penalize</Text>
                               </TouchableOpacity>
                           </View>
                       </View>
                   ) : (
                       <View style={{width: '100%', backgroundColor: '#fef2f2', padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca'}}>
                           <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                               <AlertCircle color="#dc2626" size={24} style={{marginRight: 10}}/>
                               <Text style={{color: '#dc2626', fontWeight: 'bold', fontSize: 16}}>Unknown Walk-In Vehicle</Text>
                           </View>
                           <Text style={{color: '#64748b', fontSize: 13, marginBottom: 15}}>This vehicle is not linked to any registered driver account in the system.</Text>
                           
                           <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#dc2626'}]} onPress={handleReportViolation}>
                               <Text style={styles.btnText}>File Violation to Authorities</Text>
                           </TouchableOpacity>
                       </View>
                   )}

                   <TouchableOpacity onPress={() => setViolationStep(1)} style={{padding: 15}}>
                       <Text style={{color: '#64748b', fontWeight: 'bold'}}>← Back to Details</Text>
                   </TouchableOpacity>
               </View>
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL: VIOLATIONS LOG (HISTORY) --- */}
      <Modal visible={isViolationsLogVisible} animationType="slide">
        <View style={styles.fullModal}>
          <Text style={[styles.modalHeader, {color: '#ef4444'}]}>Violations Log</Text>
          <Text style={{color: '#64748b', fontSize: 14, marginBottom: 20}}>A complete history of reported and impounded vehicles.</Text>
          
          <ScrollView>
            {violationsLog.length === 0 ? (
              <Text style={{textAlign: 'center', color: '#94a3b8', marginTop: 50}}>No violations reported yet.</Text>
            ) : (
              violationsLog.map(vLog => (
                <View key={vLog.id} style={{backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0'}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10}}>
                    <Text style={{fontWeight: '900', fontSize: 22, color: '#0f172a'}}>{vLog.licensePlate}</Text>
                    <View style={{backgroundColor: vLog.status === 'RESOLVED' ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8}}>
                      <Text style={{color: vLog.status === 'RESOLVED' ? '#16a34a' : '#ef4444', fontWeight: 'bold', fontSize: 10}}>{vLog.status}</Text>
                    </View>
                  </View>
                  
                  <Text style={{color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 15}}>{vLog.reason}</Text>
                  
                  <View style={{backgroundColor: '#f8fafc', padding: 15, borderRadius: 12}}>
                    <Text style={{fontWeight: 'bold', color: '#334155', marginBottom: 8, fontSize: 12, textTransform: 'uppercase'}}>Driver Details</Text>
                    <Text style={{color: '#64748b', fontSize: 14}}><Text style={{fontWeight: 'bold'}}>Name:</Text> {vLog.driverName || 'Unknown Walk-in'}</Text>
                    <Text style={{color: '#64748b', fontSize: 14}}><Text style={{fontWeight: 'bold'}}>Phone:</Text> {vLog.driverPhone || 'N/A'}</Text>
                    <Text style={{color: '#64748b', fontSize: 14}}><Text style={{fontWeight: 'bold'}}>NIC:</Text> {vLog.driverNic || 'N/A'}</Text>
                  </View>

                  <Text style={{fontSize: 10, color: '#94a3b8', marginTop: 15, textAlign: 'right'}}>
                    {vLog.timestamp?.toDate ? vLog.timestamp.toDate().toLocaleString() : 'Unknown Date'}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setViolationsLogVisible(false)}>
            <Text style={styles.btnText}>Close Log</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* --- INBOX MODAL --- */}
      <Modal visible={isInboxVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setIsInboxVisible(false); setSelectedAnnouncement(null); }} />
          <View style={[styles.modalContent, {maxHeight: '80%', minHeight: '60%'}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15}}>
              <Text style={{fontSize: 22, fontWeight: 'bold', color: '#0f172a'}}>📬 Inbox Messages</Text>
              <TouchableOpacity onPress={() => { setIsInboxVisible(false); setSelectedAnnouncement(null); }}><X color="#64748b" size={26}/></TouchableOpacity>
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
                         if (!isRead) setReadAnnouncements([...readAnnouncements, msg.id]);
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

      {/* --- SPOT SCHEDULE MODAL --- */}
      <Modal visible={isSpotScheduleVisible} animationType="slide" transparent onRequestClose={() => setIsSpotScheduleVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsSpotScheduleVisible(false)} />
          <View style={[styles.modalContent, {padding: 20}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
              <View>
                <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a'}}>Spot {scheduleSpot.spot?.label}</Text>
                <Text style={{color: '#64748b', fontWeight: 'bold', fontSize: 12}}>Schedule & Details</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSpotScheduleVisible(false)}><X color="#64748b" size={26}/></TouchableOpacity>
            </View>

            {scheduleSpot.txs.length === 0 ? (
              <View style={{alignItems: 'center', padding: 30}}>
                <CheckCircle2 color="#22c55e" size={48} style={{marginBottom: 10}}/>
                <Text style={{fontWeight: 'bold', color: '#334155', fontSize: 16}}>Spot is completely free.</Text>
                <Text style={{color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 5}}>No upcoming reservations found.</Text>
              </View>
            ) : (
              <ScrollView style={{maxHeight: 400}}>
                {scheduleSpot.txs.map((tx, i) => (
                  <View key={tx.id} style={{backgroundColor: tx.status === 'Active' ? '#fef2f2' : '#f8fafc', borderWidth: 1, borderColor: tx.status === 'Active' ? '#fecaca' : '#e2e8f0', padding: 15, borderRadius: 12, marginBottom: 10}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                      <Text style={{fontSize: 18, fontWeight: '900', color: '#0f172a'}}>{tx.licensePlate}</Text>
                      <View style={{backgroundColor: tx.status === 'Active' ? '#ef4444' : '#eab308', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}>
                        <Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{tx.status === 'Active' ? 'Parked Now' : 'Arriving Soon'}</Text>
                      </View>
                    </View>
                    
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
                      <Clock size={14} color="#64748b" style={{marginRight: 5}}/>
                      <Text style={{fontSize: 12, color: '#475569', fontWeight: '600'}}>
                        {tx.expectedArrival ? tx.expectedArrival.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Walk-in'} 
                        {' '}to{' '} 
                        {tx.expectedDeparture ? tx.expectedDeparture.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}
                      </Text>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10}}>
                      <TouchableOpacity 
                        style={[styles.mainBtn, {flex: 2, padding: 12, backgroundColor: tx.status === 'Active' ? '#dc2626' : '#2563eb'}]} 
                        onPress={() => processVehiclePlate(tx.licensePlate)}
                      >
                        <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 14}}>{tx.status === 'Active' ? 'Process Check-Out' : 'Process Check-In'}</Text>
                      </TouchableOpacity>
                      
                      {tx.status === 'Pending Arrival' && (
                        <TouchableOpacity 
                          style={[styles.mainBtn, {flex: 1, padding: 12, backgroundColor: '#ef4444'}]} 
                          onPress={() => handleCancelBooking(tx)}
                        >
                          <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 12}}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- CHECK-IN / CHECK-OUT MODAL --- */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent onRequestClose={() => {setVehicleModalVisible(false); setCurrentVehicle(null);}}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {setVehicleModalVisible(false); setCurrentVehicle(null);}} />
          <View style={[styles.modalContent, currentVehicle?.status === 'Active' ? {backgroundColor: '#f8fafc', padding: 20} : null]}>
            {currentVehicle && (
              <ScrollView showsVerticalScrollIndicator={false}>
                
                {/* ---------- CHECK OUT UI ---------- */}
                {currentVehicle.status === 'Active' ? (
                  <>
                    <View style={{alignItems: 'center', marginBottom: 20, paddingTop: 10}}>
                      <Text style={{fontSize: 32, fontWeight: '900', color: '#0f172a'}}>{currentVehicle.licensePlate}</Text>
                      <Text style={{color: '#64748b', fontWeight: 'bold', fontSize: 16, marginTop: 5}}>Spot #{currentVehicle.spotNumber}</Text>
                    </View>

                    <View style={styles.newReceiptCard}>
                      <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Arrival Time</Text><Text style={styles.receiptValue}>{currentVehicle.arrivalTimeStr}</Text></View>
                      <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Departure Time</Text><Text style={styles.receiptValue}>{currentVehicle.departureTimeStr}</Text></View>
                      <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Actual Stay</Text><Text style={styles.receiptValue}>{currentVehicle.actualHoursStayedStr}</Text></View>
                      <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Hourly Rate</Text><Text style={styles.receiptValue}>Rs. {currentVehicle.hourlyRate}</Text></View>
                      
                      <View style={styles.divider} />

                      {/* --- NEW DISCOUNT DISPLAY IN RECEIPT --- */}
                      {currentVehicle.discountMsg ? (
                         <View style={styles.receiptRow}>
                           <Text style={[styles.receiptLabel, {color: '#16a34a'}]}>Discount</Text>
                           <Text style={[styles.receiptValue, {color: '#16a34a'}]}>{currentVehicle.discountMsg}</Text>
                         </View>
                      ) : null}

                      {currentVehicle.prepaidHours > 0 && currentVehicle.overstayHours > 0 && (
                        <View style={styles.receiptRow}>
                          <Text style={[styles.receiptLabel, {color: '#e74c3c'}]}>Overstay Penalty</Text>
                          <Text style={[styles.receiptValue, {color: '#e74c3c'}]}>{currentVehicle.overstayStr}</Text>
                        </View>
                      )}

                      <View style={styles.balanceRow}>
                        <Text style={styles.balanceText}>Balance Due</Text>
                        <Text style={styles.balanceAmount}>Rs. {currentVehicle.extraDue}</Text>
                      </View>

                      {currentVehicle.extraDue > 0 && (
                        <View style={{marginTop: 20}}>
                          <Text style={styles.paymentMethodLabel}>Select Payment Method</Text>
                          <View style={styles.paymentButtonGroup}>
                            {['CASH', 'CARD', 'LANKAQR'].map(method => (
                              <TouchableOpacity 
                                key={method} 
                                style={[styles.payOption, checkoutPaymentMethod === method ? styles.payActive : null]} 
                                onPress={() => setCheckoutPaymentMethod(method)}
                              >
                                <Text style={[styles.payOutlineText, checkoutPaymentMethod === method ? styles.paySolidText : null]}>
                                  {method === 'LANKAQR' ? 'LankaQR' : method}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          
                          {checkoutPaymentMethod === 'LANKAQR' && (
                            <View style={styles.qrArea}>
                              {lankaQrUri ? (
                                <Image source={{ uri: lankaQrUri }} style={{ width: 160, height: 160, borderRadius: 10 }} resizeMode="contain" />
                              ) : (
                                <QRCode value={`zlotpay://pay?amount=${currentVehicle.extraDue}&merchant=${lotData?.id}`} size={150} />
                              )}
                              <Text style={{marginTop: 15, fontWeight: 'bold', color: '#64748b', fontSize: 12}}>{lankaQrUri ? 'Scan Owner LankaQR to Pay' : 'Scan to Pay Balance'}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity style={styles.checkoutConfirmBtn} onPress={confirmVehicleAction}>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Confirm Check-Out</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  // --- WALK-IN & PRE-BOOKED CHECK-IN UI ---
                  <>
                    <View style={{alignItems: 'center', marginBottom: 20}}>
                      <Text style={styles.modalTitle}>{currentVehicle.status === 'Pending Arrival' ? 'Verify Pre-Booking' : 'New Walk-In'}</Text>
                      <Text style={{fontSize: 32, fontWeight: '900', color: '#0f172a'}}>{currentVehicle.licensePlate}</Text>
                      
                      {currentVehicle.status === 'Pending Arrival' ? (
                         <View style={{alignItems: 'center', marginTop: 10}}>
                           <Text style={{color: '#64748b', fontWeight: 'bold', fontSize: 16}}>Spot #{currentVehicle.spotNumber}</Text>
                         </View>
                      ) : (
                        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 15, borderRadius: 10}}>
                          <Text style={{color: '#64748b', fontWeight: 'bold'}}>Assign Spot #: </Text><TextInput style={{fontSize: 20, fontWeight: '900', color: '#0f172a', paddingVertical: 10, width: 80}} value={currentVehicle.spotNumber?.toString()} onChangeText={(t) => setCurrentVehicle({...currentVehicle, spotNumber: t})} />
                        </View>
                      )}
                    </View>

                    {currentVehicle.isNew ? (
                      <View style={{width: '100%', marginBottom: 20}}>
                        <Text style={{fontWeight: 'bold', color: '#64748b', marginBottom: 10, textAlign: 'center'}}>Select Vehicle Type:</Text>
                        <View style={styles.checkInVehicleTypeRow}>
                          {['CAR', 'TUKTUK', 'BIKE', 'LORRY'].map(v => (
                            <TouchableOpacity 
                              key={v} 
                              style={[styles.fullTypeBtn, walkInVehicleType === v ? styles.typeBtnActive : null]} 
                              onPress={() => {setWalkInVehicleType(v); setCurrentVehicle({...currentVehicle, spotNumber: findFreeSpot(v)});}}
                            >
                              <Text style={walkInVehicleType === v ? styles.typeTextActive : styles.typeText}>{getVehicleLabel(v)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={{backgroundColor: '#f0fdf4', padding: 20, borderRadius: 12, width: '100%', marginBottom: 20, alignItems: 'center'}}>
                        <CheckCircle2 color="#16a34a" size={40} style={{marginBottom: 10}} />
                        <Text style={{fontWeight: '900', fontSize: 18, color: '#16a34a', marginBottom: 5}}>Booking Verified!</Text>
                        <Text style={{color: '#334155', fontWeight: 'bold'}}>Vehicle Type: {getVehicleLabel(currentVehicle.vehicleType)}</Text>
                      </View>
                    )}

                    <View style={{flexDirection: 'row', gap: 10}}>
                      <TouchableOpacity style={[styles.mainBtn, {flex: 2, backgroundColor: currentVehicle.status === 'Pending Arrival' ? '#eab308' : '#27ae60'}]} onPress={confirmVehicleAction}>
                        <Text style={[styles.btnText, {color: '#fff'}]}>
                          {currentVehicle.status === 'Pending Arrival' ? 'Confirm Check-In' : 'Check-In Vehicle'}
                        </Text>
                      </TouchableOpacity>

                      {currentVehicle.status === 'Pending Arrival' && (
                        <TouchableOpacity style={[styles.mainBtn, {flex: 1, backgroundColor: '#ef4444'}]} onPress={() => handleCancelBooking(currentVehicle)}>
                          <Text style={[styles.btnText, {color: '#fff', fontSize: 12}]}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* --- PROFILE MODAL --- */}
      <Modal visible={isProfileModalVisible} animationType="slide" transparent onRequestClose={handleCancelProfile}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCancelProfile} />
          <View style={[styles.modalContent, {paddingTop: 40, maxHeight: '90%'}]}>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20}}>
              <Text style={[styles.modalTitle, {marginBottom: 0}]}>Business Profile</Text>
              <TouchableOpacity onPress={handleCancelProfile}><X color="#64748b" size={26}/></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{width: '100%'}}>
              
              <Text style={styles.sectionLabel}>Lot Details</Text>
              <Text style={styles.inputLabel}>Lot Name</Text><TextInput style={styles.input} placeholder="Lot Name" value={ownerProfile.parkName} onChangeText={t => setOwnerProfile({...ownerProfile, parkName: t})} />
              <Text style={styles.inputLabel}>Phone Number</Text><TextInput style={styles.input} placeholder="Phone" value={ownerProfile.phone} onChangeText={t => setOwnerProfile({...ownerProfile, phone: t})} keyboardType="phone-pad" />
              
              <Text style={[styles.sectionLabel, {marginTop: 10}]}>Official Documents & QR</Text>
              <View style={{flexDirection: 'row', gap: 10, width: '100%', marginBottom: 15}}>
                <TouchableOpacity onPress={() => pickImage(setBusinessLicenseUri)} style={{flex: 1, backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed'}}>
                  {businessLicenseUri ? (
                    <Image source={{uri: businessLicenseUri}} style={{width: '100%', height: 60, borderRadius: 8}} />
                  ) : (
                    <><ImageIcon size={24} color="#64748b"/><Text style={{fontSize: 10, color: '#64748b', marginTop: 5, textAlign: 'center'}}>Upload License</Text></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pickImage(setSpotPhotoUri)} style={{flex: 1, backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed'}}>
                  {spotPhotoUri ? (
                    <Image source={{uri: spotPhotoUri}} style={{width: '100%', height: 60, borderRadius: 8}} />
                  ) : (
                    <><Camera size={24} color="#64748b"/><Text style={{fontSize: 10, color: '#64748b', marginTop: 5, textAlign: 'center'}}>Upload Spot Photo</Text></>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => pickImage(setLankaQrUri)} style={{backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', marginBottom: 15}}>
                {lankaQrUri ? (
                  <Image source={{uri: lankaQrUri}} style={{width: 100, height: 100, borderRadius: 8}} />
                ) : (
                  <><QrCodeIcon size={24} color="#64748b"/><Text style={{fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: 'bold'}}>Upload your LankaQR Image</Text></>
                )}
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Operating Hours</Text>
              <View style={{flexDirection: 'row', gap: 10, width: '100%'}}>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>Open Time</Text><TextInput style={styles.input} placeholder="e.g. 06:00 AM" value={ownerProfile.openTime} onChangeText={t => setOwnerProfile({...ownerProfile, openTime: t})} /></View>
                <View style={{flex: 1}}><Text style={styles.inputLabel}>Close Time</Text><TextInput style={styles.input} placeholder="e.g. 10:00 PM" value={ownerProfile.closeTime} onChangeText={t => setOwnerProfile({...ownerProfile, closeTime: t})} /></View>
              </View>

              <Text style={styles.sectionLabel}>Pricing & Availability</Text>
              <View style={styles.gridContainer}>
                <View style={styles.gridHeader}><Text style={[styles.gridText, {flex: 2}]}>Type</Text><Text style={[styles.gridText, {flex: 1.2}]}>Spots</Text><Text style={[styles.gridText, {flex: 1.5}]}>Rate</Text></View>
                
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>car/van</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.2}]} value={spots.car} onChangeText={t => setSpots({...spots, car: t})} />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={rates.car} onChangeText={t => setRates({...rates, car: t})} placeholder={globalPricingLimits ? `${globalPricingLimits.car.min}-${globalPricingLimits.car.max}` : "Rate"} />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>bike/scooter</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.2}]} value={spots.bike} onChangeText={t => setSpots({...spots, bike: t})} />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={rates.bike} onChangeText={t => setRates({...rates, bike: t})} placeholder={globalPricingLimits ? `${globalPricingLimits.bike.min}-${globalPricingLimits.bike.max}` : "Rate"} />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>tuk tuk</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.2}]} value={spots.tuktuk} onChangeText={t => setSpots({...spots, tuktuk: t})} />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={rates.tuktuk} onChangeText={t => setRates({...rates, tuktuk: t})} placeholder={globalPricingLimits ? `${globalPricingLimits.tuktuk.min}-${globalPricingLimits.tuktuk.max}` : "Rate"} />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>lorry</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.2}]} value={spots.lorry} onChangeText={t => setSpots({...spots, lorry: t})} />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={rates.lorry} onChangeText={t => setRates({...rates, lorry: t})} placeholder={globalPricingLimits ? `${globalPricingLimits.lorry.min}-${globalPricingLimits.lorry.max}` : "Rate"} />
                </View>
              </View>

              {/* --- NEW: LONG-TERM DISCOUNT CONFIGURATION GRID --- */}
              <Text style={styles.sectionLabel}>Long-Term Discounts (Optional)</Text>
              <View style={styles.gridContainer}>
                <View style={styles.gridHeader}>
                  <Text style={[styles.gridText, {flex: 2}]}>Type</Text>
                  <Text style={[styles.gridText, {flex: 1.5}]}>Min Hours</Text>
                  <Text style={[styles.gridText, {flex: 1.5}]}>Discount %</Text>
                </View>
                
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>car/van</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.car.threshold} onChangeText={t => setDiscounts({...discounts, car: {...discounts.car, threshold: t}})} placeholder="e.g. 8" keyboardType="number-pad" />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.car.percentage} onChangeText={t => setDiscounts({...discounts, car: {...discounts.car, percentage: t}})} placeholder="%" keyboardType="number-pad" />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>bike/scooter</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.bike.threshold} onChangeText={t => setDiscounts({...discounts, bike: {...discounts.bike, threshold: t}})} placeholder="e.g. 8" keyboardType="number-pad" />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.bike.percentage} onChangeText={t => setDiscounts({...discounts, bike: {...discounts.bike, percentage: t}})} placeholder="%" keyboardType="number-pad" />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>tuk tuk</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.tuktuk.threshold} onChangeText={t => setDiscounts({...discounts, tuktuk: {...discounts.tuktuk, threshold: t}})} placeholder="e.g. 8" keyboardType="number-pad" />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.tuktuk.percentage} onChangeText={t => setDiscounts({...discounts, tuktuk: {...discounts.tuktuk, percentage: t}})} placeholder="%" keyboardType="number-pad" />
                </View>
                <View style={styles.gridRow}>
                  <Text style={[styles.gridLabel, {flex: 2}]}>lorry</Text>
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.lorry.threshold} onChangeText={t => setDiscounts({...discounts, lorry: {...discounts.lorry, threshold: t}})} placeholder="e.g. 8" keyboardType="number-pad" />
                  <TextInput style={[styles.gridInput, {flex: 1.5}]} value={discounts.lorry.percentage} onChangeText={t => setDiscounts({...discounts, lorry: {...discounts.lorry, percentage: t}})} placeholder="%" keyboardType="number-pad" />
                </View>
              </View>
              
              <View style={{flexDirection: 'row', gap: 10, marginTop: 10, width: '100%', paddingBottom: 30}}>
                <TouchableOpacity style={[styles.mainBtn, {flex: 1, backgroundColor: '#f1f5f9'}]} onPress={handleCancelProfile}>
                  <Text style={[styles.btnText, {color: '#64748b'}]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mainBtn, {flex: 1}]} onPress={handleUpdateProfile}>
                  <Text style={styles.btnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isLedgerVisible} animationType="slide" onRequestClose={() => setLedgerVisible(false)}>
        <View style={styles.fullModal}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <Text style={styles.modalHeader}>Financial Ledger</Text>
            <TouchableOpacity onPress={() => setLedgerVisible(false)}><X color="#64748b" size={28} /></TouchableOpacity>
          </View>

          {allTransactions.length === 0 ? (
            <View style={{alignItems: 'center', marginTop: 50}}>
              <Banknote size={48} color="#cbd5e1" />
              <Text style={{color: '#64748b', fontSize: 16, marginTop: 10}}>No transactions recorded yet.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {allTransactions.map(tx => (
                <View key={tx.id} style={styles.ledgerItem}>
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: '900', fontSize: 18, color: '#0f172a'}}>{tx.licensePlate}</Text>
                    <Text style={{color: '#64748b', fontSize: 12}}>Spot #{tx.spotNumber || 'N/A'} • {tx.finalPaymentMethod || tx.paymentMethod || 'CASH'}</Text>
                    <Text style={{color: tx.status === 'Completed' ? '#64748b' : '#3b82f6', fontSize: 12, fontWeight: 'bold'}}>{tx.status}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={{fontWeight: '900', color: '#16a34a', fontSize: 18}}>Rs. {tx.finalTotal || tx.amountPaid || 0}</Text>
                    <Text style={{fontSize: 10, color: '#94a3b8'}}>{renderSafeTime(tx.timestamp || tx.arrivalTime)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  greeting: { color: '#64748b', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }, parkName: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  iconBtn: { backgroundColor: '#dcfce7', padding: 10, borderRadius: 12 }, card: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' }, capacityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  circleBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }, capacityDisplay: { alignItems: 'center' }, capacityNumber: { fontSize: 48, fontWeight: '900', color: '#0f172a' },
  scannerBtn: { backgroundColor: '#10b981', marginHorizontal: 20, padding: 30, borderRadius: 24, alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, elevation: 5, marginBottom: 20 }, scannerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 10 },
  blueprintGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' }, blueprintSpot: { height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, elevation: 2 },
  legendBox: { width: 16, height: 16, borderRadius: 4, marginBottom: 4 }, legendText: { fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', padding: 20 }, modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 24, alignItems: 'center', width: '95%', alignSelf: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 5, color: '#0f172a' },
  input: { width: '100%', backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 15, fontWeight: 'bold', color: '#334155' }, mainBtn: { backgroundColor: '#27ae60', width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }, cancelText: { color: '#ef4444', fontWeight: 'bold', padding: 10 },
  sectionLabel: { fontWeight: 'bold', color: '#64748b', marginBottom: 5, marginTop: 5, alignSelf: 'flex-start' }, inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4, marginLeft: 4, textTransform: 'uppercase', alignSelf: 'flex-start' },
  gridContainer: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 15, marginBottom: 15, width: '100%' }, gridHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 10, marginBottom: 10 }, gridText: { color: '#64748b', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' }, gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, gridLabel: { color: '#334155', fontSize: 13, fontWeight: 'bold', textTransform: 'capitalize' }, gridInput: { backgroundColor: '#fff', color: '#0f172a', padding: 10, borderRadius: 8, marginHorizontal: 4, textAlign: 'center', fontSize: 14, fontWeight: 'bold', borderWidth: 1, borderColor: '#e2e8f0' },
  fullModal: { flex: 1, backgroundColor: '#f8fafc', padding: 25, paddingTop: 60 }, modalHeader: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 0 },
  closeBtn: { backgroundColor: '#0f172a', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  ledgerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, elevation: 1 },
  sidebarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 100, flexDirection: 'row' },
  sidebar: { width: 280, backgroundColor: '#fff', height: '100%', padding: 25, paddingTop: 60, shadowColor: '#000', shadowOpacity: 0.2, elevation: 20 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10 }, sidebarItemActive: { backgroundColor: '#3498db' },
  sidebarText: { marginLeft: 15, fontWeight: 'bold', color: '#334155', fontSize: 16 },
  checkInVehicleTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', width: '100%' }, fullTypeBtn: { width: '48%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' }, typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }, typeText: { fontWeight: 'bold', color: '#64748b', fontSize: 12 }, typeTextActive: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // --- BEAUTIFUL RECEIPT STYLES ---
  newReceiptCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', width: '100%', marginBottom: 20 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  receiptValue: { color: '#0f172a', fontWeight: '900', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceText: { color: '#e74c3c', fontWeight: '900', fontSize: 18 },
  balanceAmount: { color: '#e74c3c', fontWeight: '900', fontSize: 24 },
  
  // PAYMENT SELECTOR
  paymentMethodLabel: { color: '#64748b', fontWeight: 'bold', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  paymentButtonGroup: { flexDirection: 'row', gap: 10 },
  payOption: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  payActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  payOutlineText: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
  paySolidText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  qrArea: { padding: 20, backgroundColor: '#fff', borderRadius: 12, marginTop: 15, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  
  checkoutConfirmBtn: { backgroundColor: '#22c55e', padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
  badge: { backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' }, 
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
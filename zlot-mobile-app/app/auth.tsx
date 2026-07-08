import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore'; 
import { auth, db } from '../firebase';
import * as Location from 'expo-location'; 
import * as ImagePicker from 'expo-image-picker'; // IMPORTED IMAGE PICKER
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

// 🔥 CHANGE THIS TO YOUR LAPTOP'S WI-FI IP ADDRESS
const LOCAL_BACKEND_URL = "http://192.168.10.98:3000"; 

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [role, setRole] = useState('DRIVER'); 

  const [parkName, setParkName] = useState('');
  const [parkLocation, setParkLocation] = useState('');
  
  // Operating Hours State
  const [is247, setIs247] = useState(true);
  const [openTime, setOpenTime] = useState('06:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  
  // Vehicle Specific Capacities and Rates
  const [spots, setSpots] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });
  const [rates, setRates] = useState({ car: '', bike: '', tuktuk: '', lorry: '' });
  
  // Auto-calculated (or manual) total capacity
  const [parkCapacity, setParkCapacity] = useState('');
  const [isManualCapacity, setIsManualCapacity] = useState(false);
  
  const [amenities, setAmenities] = useState({ hasCCTV: false, hasSecurity: false, isIndoor: false, hasRoof: false, isOutdoor: false });
  
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [spotImage, setSpotImage] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(false);

  // Map Modal States
  const [isMapVisible, setMapVisible] = useState(false);
  const [tempCoords, setTempCoords] = useState<{lat: number, lng: number} | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // --- Auto-calculate Total Spots ---
  useEffect(() => {
    if (!isManualCapacity) {
      const total = (parseInt(spots.car) || 0) + 
                    (parseInt(spots.bike) || 0) + 
                    (parseInt(spots.tuktuk) || 0) + 
                    (parseInt(spots.lorry) || 0);
      setParkCapacity(total > 0 ? total.toString() : '');
    }
  }, [spots, isManualCapacity]);

  const handleOpenMap = async () => {
    setMapVisible(true);
    setFetchingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setTempCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
      } else {
        setTempCoords({ lat: 7.2906, lng: 80.6337 }); 
      }
    } catch (error) {
      setTempCoords({ lat: 7.2906, lng: 80.6337 }); 
    } finally {
      setFetchingGps(false);
    }
  };

  const handleAutoLocate = async () => {
    setFetchingGps(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      setTempCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
    } catch (error) {
      Alert.alert('Error', 'Ensure GPS is turned on.');
    } finally {
      setFetchingGps(false);
    }
  };

  // 🚀 REAL IMAGE PICKER
  const handlePickImage = async (type: 'license' | 'spot') => {
    let result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.5 
    });
    if (!result.canceled) {
      if (type === 'license') setLicenseImage(result.assets[0].uri);
      if (type === 'spot') setSpotImage(result.assets[0].uri);
    }
  };

  // 🚀 REAL LOCAL NETWORK UPLOADER
  const uploadImageToLocalServer = async (localUri: string, prefix: string) => {
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: localUri,
        name: `${prefix}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const res = await fetch(`${LOCAL_BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const data = await res.json();
      return `${LOCAL_BACKEND_URL}${data.url}`; 
    } catch (err) {
      console.error(err);
      return null; // Fallback to null if upload fails
    }
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim();

    if (isLogin) {
      if (!cleanEmail || !password) return Alert.alert("Error", "Fill in all fields.");
    } else {
      if (!cleanEmail || !password || !name || !phone || !nic) return Alert.alert("Error", "Please fill in personal details.");
      if (role === 'OWNER') {
        if (!parkName || !parkLocation || !parkCapacity) return Alert.alert("Error", "Fill in business details and capacity.");
        if (!rates.car && !rates.bike && !rates.tuktuk && !rates.lorry) return Alert.alert("Error", "Enter a rate for at least one vehicle type.");
        if (!licenseImage) return Alert.alert("Error", "Business License is required.");
        if (!gpsCoords) return Alert.alert("Error", "Please Set GPS Location.");
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        
        let finalLicenseUrl = licenseImage;
        let finalSpotUrl = spotImage;

        // 1. Upload Images to the Node.js Server first!
        if (role === 'OWNER') {
          if (licenseImage && licenseImage.startsWith('file://')) {
             finalLicenseUrl = await uploadImageToLocalServer(licenseImage, 'license');
          }
          if (spotImage && spotImage.startsWith('file://')) {
             finalSpotUrl = await uploadImageToLocalServer(spotImage, 'spot');
          }
        }

        // 2. Create the User in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const uid = userCredential.user.uid;

        // 3. Batch write all the data to Firestore
        const batch = writeBatch(db);

        const userRef = doc(db, 'users', uid);
        batch.set(userRef, {
          email: cleanEmail, role: role, status: role === 'OWNER' ? 'PENDING' : 'ACTIVE',
          name: name, phone: phone, nic: nic, createdAt: new Date()
        });

        if (role === 'OWNER') {
           const lotRef = doc(db, 'parking_lots', uid);
           
           const vehiclesAllowed = [];
           if (Number(spots.car) > 0) vehiclesAllowed.push('CAR');
           if (Number(spots.bike) > 0) vehiclesAllowed.push('BIKE');
           if (Number(spots.tuktuk) > 0) vehiclesAllowed.push('TUKTUK');
           if (Number(spots.lorry) > 0) vehiclesAllowed.push('LORRY');

           batch.set(lotRef, { 
             ownerId: uid, ownerName: name, phone: phone,
             name: parkName, location_text: parkLocation, 
             capacity_total: Number(parkCapacity) || 0, 
             available_spots: Number(parkCapacity) || 0, 
             hourly_rate: Number(rates.car) || Number(rates.bike) || 0,
             
             // SAVING OPERATING HOURS
             is_open: true, // Default to true when created
             operating_hours: is247 ? { open: '12:00 AM', close: '11:59 PM', is247: true } : { open: openTime, close: closeTime, is247: false },
             
             vehicle_spots: {
               CAR: Number(spots.car) || 0,
               BIKE: Number(spots.bike) || 0,
               TUKTUK: Number(spots.tuktuk) || 0,
               LORRY: Number(spots.lorry) || 0,
             },
             vehicle_rates: {
               CAR: Number(rates.car) || 0,
               BIKE: Number(rates.bike) || 0,
               TUKTUK: Number(rates.tuktuk) || 0,
               LORRY: Number(rates.lorry) || 0,
             },
             vehicles_allowed: vehiclesAllowed,
             
             amenities: amenities, 
             business_license_uri: finalLicenseUrl, // NEW NETWORK URL!
             spot_photo_uri: finalSpotUrl,          // NEW NETWORK URL!
             latitude: gpsCoords?.lat || 7.2931, 
             longitude: gpsCoords?.lng || 80.6375,
             status: 'PENDING_APPROVAL'
           });
        }
        await batch.commit();
      }
    } catch (error: any) { 
      Alert.alert("Registration Failed", error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const toggleAmenity = (key: keyof typeof amenities) => setAmenities(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Zlot.</Text>
        <Text style={styles.subtitle}>{isLogin ? "Welcome back" : "Create an account"}</Text>

        {!isLogin && (
          <View style={styles.roleContainer}>
            <Text style={{color: '#fff', marginBottom: 10, fontWeight: 'bold'}}>I am a:</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.roleBtn, role === 'DRIVER' && styles.roleBtnActive]} onPress={() => setRole('DRIVER')}><Text style={{color: '#fff'}}>🚗 Driver</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.roleBtn, role === 'OWNER' && styles.roleBtnActive]} onPress={() => setRole('OWNER')}><Text style={{color: '#fff'}}>🅿️ Park Owner</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />

        {!isLogin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#888" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#888" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="NIC Number" placeholderTextColor="#888" value={nic} onChangeText={setNic} />
          </View>
        )}

        {!isLogin && role === 'OWNER' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Details</Text>
            <TextInput style={styles.input} placeholder="Parking Lot Name" placeholderTextColor="#888" value={parkName} onChangeText={setParkName} />
            <TextInput style={styles.input} placeholder="Address / Location" placeholderTextColor="#888" value={parkLocation} onChangeText={setParkLocation} />
            
            {/* --- NEW: OPERATING HOURS SECTION --- */}
            <Text style={[styles.sectionTitle, {marginTop: 5, color: '#aaa'}]}>Operating Hours</Text>
            <View style={styles.hoursContainer}>
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setIs247(!is247)}>
                <View style={[styles.checkbox, is247 && styles.checkboxActive]}>
                  {is247 && <Text style={{color: '#fff', fontSize: 12, fontWeight: '900'}}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Park is open 24/7</Text>
              </TouchableOpacity>

              {!is247 && (
                <View style={styles.timeInputsRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.timeLabel}>Open Time</Text>
                    <TextInput style={[styles.input, {marginBottom: 0, padding: 12}]} placeholder="06:00 AM" placeholderTextColor="#666" value={openTime} onChangeText={setOpenTime} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.timeLabel}>Close Time</Text>
                    <TextInput style={[styles.input, {marginBottom: 0, padding: 12}]} placeholder="10:00 PM" placeholderTextColor="#666" value={closeTime} onChangeText={setCloseTime} />
                  </View>
                </View>
              )}
            </View>

            {/* --- DETAILED VEHICLE GRID --- */}
            <Text style={[styles.sectionTitle, {marginTop: 5, color: '#aaa'}]}>Pricing & Availability</Text>
            <View style={styles.gridContainer}>
              <View style={styles.gridHeader}>
                <Text style={[styles.gridText, {flex: 2}]}>Vehicle Type</Text>
                <Text style={[styles.gridText, {flex: 1.2, textAlign: 'center'}]}>Spots</Text>
                <Text style={[styles.gridText, {flex: 1.5, textAlign: 'center'}]}>Rate (Rs/hr)</Text>
              </View>
              
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, {flex: 2}]}>🚗 Car / Van</Text>
                <TextInput style={[styles.gridInput, {flex: 1.2}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={spots.car} onChangeText={t => setSpots({...spots, car: t})} />
                <TextInput style={[styles.gridInput, {flex: 1.5}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={rates.car} onChangeText={t => setRates({...rates, car: t})} />
              </View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, {flex: 2}]}>🏍️ Bike / Scooter</Text>
                <TextInput style={[styles.gridInput, {flex: 1.2}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={spots.bike} onChangeText={t => setSpots({...spots, bike: t})} />
                <TextInput style={[styles.gridInput, {flex: 1.5}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={rates.bike} onChangeText={t => setRates({...rates, bike: t})} />
              </View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, {flex: 2}]}>🛺 Tuk Tuk</Text>
                <TextInput style={[styles.gridInput, {flex: 1.2}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={spots.tuktuk} onChangeText={t => setSpots({...spots, tuktuk: t})} />
                <TextInput style={[styles.gridInput, {flex: 1.5}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={rates.tuktuk} onChangeText={t => setRates({...rates, tuktuk: t})} />
              </View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridLabel, {flex: 2}]}>🚚 Lorry</Text>
                <TextInput style={[styles.gridInput, {flex: 1.2}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={spots.lorry} onChangeText={t => setSpots({...spots, lorry: t})} />
                <TextInput style={[styles.gridInput, {flex: 1.5}]} keyboardType="number-pad" placeholder="0" placeholderTextColor="#666" value={rates.lorry} onChangeText={t => setRates({...rates, lorry: t})} />
              </View>
            </View>

            {/* TOTAL SPOTS OVERRIDE */}
            <Text style={[styles.sectionTitle, {marginTop: 5}]}>Total Lot Capacity</Text>
            <TextInput 
              style={[styles.input, {borderColor: isManualCapacity ? '#3498db' : 'transparent', borderWidth: isManualCapacity ? 1 : 0}]} 
              placeholder="Total Spots" 
              placeholderTextColor="#888" 
              keyboardType="number-pad"
              value={parkCapacity} 
              onChangeText={(t) => {
                setParkCapacity(t);
                if(t === '') setIsManualCapacity(false);
                else setIsManualCapacity(true);
              }} 
            />

            <Text style={[styles.sectionTitle, {marginTop: 10}]}>Facility Features</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15}}>
              {(Object.keys(amenities) as Array<keyof typeof amenities>).map((key) => (
                <TouchableOpacity key={key} style={[styles.amenityBtn, amenities[key] && styles.amenityBtnActive]} onPress={() => toggleAmenity(key)}>
                  <Text style={{color: amenities[key] ? '#fff' : '#888', fontSize: 12}}>
                    {key === 'hasCCTV' ? '📷 CCTV' : 
                     key === 'hasSecurity' ? '👮 Security' : 
                     key === 'isIndoor' ? '🏢 Indoor' : 
                     key === 'hasRoof' ? '☂️ Covered Roof' : 
                     '🛣️ Outdoor/Road'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, {marginTop: 10}]}>Location & Documents</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleOpenMap}>
              <Text style={{color: gpsCoords ? '#27ae60' : '#3498db', fontWeight: 'bold'}}>
                {gpsCoords ? '✅ Parking Lot Location Saved (Tap to Edit)' : '📍 Set Parking Lot Location (Required)'}
              </Text>
            </TouchableOpacity>

            {/* --- NEW UPLOAD BUTTONS --- */}
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={[styles.uploadBtn, {flex: 1, padding: 10}]} onPress={() => handlePickImage('license')}>
                {licenseImage ? <Image source={{uri: licenseImage}} style={{width: '100%', height: 60, borderRadius: 5}}/> : <Text style={{color: '#3498db', textAlign: 'center'}}>📄 Business License</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, {flex: 1, padding: 10}]} onPress={() => handlePickImage('spot')}>
                {spotImage ? <Image source={{uri: spotImage}} style={{width: '100%', height: 60, borderRadius: 5}}/> : <Text style={{color: '#3498db', textAlign: 'center'}}>📸 Photo of Park</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isLogin ? "Sign In" : "Submit Registration"}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{marginTop: 20, alignItems: 'center', marginBottom: 40}}>
          <Text style={{color: '#3498db'}}>{isLogin ? "Need an account? Register." : "Have an account? Sign In."}</Text>
        </TouchableOpacity>

        {/* Map Modal */}
        <Modal visible={isMapVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={{padding: 20, paddingBottom: 15, width: '100%', alignItems: 'center'}}>
                <Text style={{fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 5}}>Pinpoint Your Lot</Text>
                <Text style={{color: '#64748b', textAlign: 'center', fontSize: 13}}>Drag and tap anywhere on the map to set your exact entrance, or use Auto-Locate.</Text>
              </View>
              {tempCoords && (
                <MapView
                  style={{width: '100%', height: 350}}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={{ latitude: tempCoords.lat, longitude: tempCoords.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  onPress={(e) => setTempCoords({lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude})}
                >
                  <Marker coordinate={{latitude: tempCoords.lat, longitude: tempCoords.lng}}><View style={styles.pin}><Text style={{fontSize: 20}}>📍</Text></View></Marker>
                </MapView>
              )}
              <View style={{padding: 20, width: '100%', gap: 12}}>
                <TouchableOpacity style={[styles.uploadBtn, {borderColor: '#3498db', backgroundColor: '#e0f2fe', marginBottom: 0}]} onPress={handleAutoLocate} disabled={fetchingGps}>
                  <Text style={{color: '#3498db', fontWeight: 'bold'}}>{fetchingGps ? 'Locating...' : '🎯 Auto-Locate Me'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, {marginTop: 0, backgroundColor: tempCoords ? '#27ae60' : '#ccc'}]} disabled={!tempCoords} onPress={() => { setGpsCoords(tempCoords); setMapVisible(false); }}>
                  <Text style={styles.btnText}>Confirm & Save Location</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMapVisible(false)} style={{alignItems: 'center', padding: 10}}><Text style={{color: '#ef4444', fontWeight: 'bold'}}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 25, paddingVertical: 50 },
  title: { fontSize: 48, fontWeight: '900', color: '#3498db', marginBottom: 5 },
  subtitle: { fontSize: 18, color: '#aaa', marginBottom: 20 },
  section: { marginTop: 10, marginBottom: 10 },
  sectionTitle: { color: '#3498db', fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  input: { backgroundColor: '#2a2a2a', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15 },
  roleContainer: { marginBottom: 20 },
  roleBtn: { flex: 1, padding: 15, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  roleBtnActive: { backgroundColor: '#27ae60' },
  
  // Operating Hours Styles
  hoursContainer: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxActive: { backgroundColor: '#3498db', borderColor: '#3498db' },
  checkboxLabel: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  timeInputsRow: { flexDirection: 'row', gap: 12, marginTop: 15, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15 },
  timeLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginLeft: 2 },

  // Vehicle Grid Styles
  gridContainer: { backgroundColor: '#1e1e1e', borderRadius: 10, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  gridHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#444', paddingBottom: 10, marginBottom: 10 },
  gridText: { color: '#888', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  gridLabel: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  gridInput: { backgroundColor: '#2a2a2a', color: '#fff', padding: 10, borderRadius: 8, marginHorizontal: 4, textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  
  amenityBtn: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#444', backgroundColor: '#222' },
  amenityBtnActive: { backgroundColor: '#3498db', borderColor: '#3498db' },
  uploadBtn: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#3498db', borderStyle: 'dashed', alignItems: 'center', marginBottom: 10, justifyContent: 'center' },
  primaryBtn: { backgroundColor: '#3498db', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }, 
  modalContent: { backgroundColor: '#f8fafc', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  pin: { backgroundColor: '#fff', padding: 5, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.3, elevation: 5 }
});
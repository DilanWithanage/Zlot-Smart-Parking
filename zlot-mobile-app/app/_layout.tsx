import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; 

export default function RootLayout() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/auth');
        setIsChecking(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'OWNER') {
            router.replace('/(owner)');
          } else {
            router.replace('/(driver)');
          }
        } else {
          router.replace('/auth');
        }
      } catch (error) {
        router.replace('/auth');
      } finally {
        setIsChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* 1. We load the Stack immediately so Expo Router doesn't crash */}
      <Stack screenOptions={{ headerShown: false }} />
      
      {/* 2. We put a loading overlay on top while checking the database */}
      {isChecking && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      )}
    </View>
  );
}
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function PendingScreen() {
  return (
    <View style={{flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20}}>
      <Text style={{fontSize: 24, fontWeight: 'bold', color: '#f39c12', marginBottom: 10}}>Account Pending</Text>
      <Text style={{color: '#aaa', textAlign: 'center', marginBottom: 30}}>Your Park Owner account is waiting for Super Admin approval.</Text>
      <TouchableOpacity onPress={() => signOut(auth)} style={{backgroundColor: '#e74c3c', padding: 15, borderRadius: 10}}>
        <Text style={{color: '#fff', fontWeight: 'bold'}}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
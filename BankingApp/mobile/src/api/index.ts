import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect correct API host (Web, Physical Device on Wi-Fi, or Emulator)
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000/api`;
  }
  return 'http://10.0.2.2:3000/api';
};

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  let token;
  if (Platform.OS === 'web') {
    token = localStorage.getItem('userToken');
  } else {
    token = await SecureStore.getItemAsync('userToken');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

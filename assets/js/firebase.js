import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  initializeAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCbObbT42LhRDkrr-9-mbG8IjZQvfzeJyA",
  authDomain: "derstakippro.com",
  databaseURL: "https://derstakip-pro-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "derstakip-pro",
  storageBucket: "derstakip-pro.firebasestorage.app",
  messagingSenderId: "195676093041",
  appId: "1:195676093041:web:8376b2bc719ec8b1e139d0",
  measurementId: "G-QLSQ05VNQQ"
};

const PLACEHOLDER_VALUES = [
  "YOUR_API_KEY",
  "YOUR_AUTH_DOMAIN",
  "YOUR_PROJECT_ID",
  "YOUR_STORAGE_BUCKET",
  "YOUR_MESSAGING_SENDER_ID",
  "YOUR_APP_ID"
];

const hasPlaceholderConfig = Object.values(firebaseConfig).some(function(value){
  return PLACEHOLDER_VALUES.includes(String(value || "").trim());
});

if(hasPlaceholderConfig){
  console.warn("Firebase config doldurulmalı");
}

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver
});
window.AppAuth = auth;
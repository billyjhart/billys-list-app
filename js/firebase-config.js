// Firebase Configuration
// Billy's List App Project - Updated March 8, 2026

const firebaseConfig = {
    apiKey: "AIzaSyAl0Cl3Z5njIdl7ZbbfB0-p4uNq_4gkXdE",
    authDomain: "billys-list-app-project.firebaseapp.com",
    databaseURL: "https://billys-list-app-project-default-rtdb.firebaseio.com",
    projectId: "billys-list-app-project",
    storageBucket: "billys-list-app-project.firebasestorage.app",
    messagingSenderId: "1061592949202",
    appId: "1:1061592949202:web:3d3e30a515d5fff16d280b",
    measurementId: "G-ZG5CHTBF8N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Configure Auth
const provider = new firebase.auth.GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');
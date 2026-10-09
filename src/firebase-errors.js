export function firebaseErrorMessage(error) {
 const messages = {
  'auth/invalid-credential': 'The email or password was not accepted. Check your team account details and try again.',
  'auth/user-not-found': 'The email or password was not accepted. Check your team account details and try again.',
  'auth/wrong-password': 'The email or password was not accepted. Check your team account details and try again.',
  'auth/invalid-email': 'Enter a valid email address for your team account.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled. Ask your administrator to enable it in Firebase Authentication.',
  'auth/unauthorized-domain': 'This website is not authorized for sign-in. Ask your administrator to add this domain in Firebase Authentication settings.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your internet connection and try again.',
  'auth/too-many-requests': 'Too many sign-in attempts. Wait a few minutes before trying again.',
  'auth/user-disabled': 'This account is disabled. Contact your team administrator.',
  'permission-denied': 'Team access was denied. Ask your administrator to check your active team membership and the Firestore rules.',
  'unavailable': 'The shared database is unavailable. Check your connection and try again.',
 };
 return messages[error?.code] || error?.message || 'Could not connect. Please try again.';
}

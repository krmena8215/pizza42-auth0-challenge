import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { apiConfig } from '../auth0-config';

const Profile: React.FC = () => {
  const { user, getIdTokenClaims, getAccessTokenSilently } = useAuth0();
  const [orderHistory, setOrderHistory] = React.useState<any[]>([]);
  const [idTokenVerification, setIdTokenVerification] = React.useState<any>(null);
  const [verificationStatus, setVerificationStatus] = React.useState<string>('checking...');

  React.useEffect(() => {
    const checkIdTokenVerification = async () => {
      try {
        // Get ID token claims first to check verification
        const claims = await getIdTokenClaims();
        const namespace = 'https://pizza42.com/';
        
        console.log('ID Token Claims:', claims);
        
        // Extract verification information
        const verification = {
          tokenVerifiedAt: claims?.[`${namespace}token_verified_at`],
          emailVerified: claims?.[`${namespace}email_verified`],
          canPlaceOrders: claims?.[`${namespace}can_place_orders`],
          authMetadata: claims?.[`${namespace}auth_metadata`],
          sessionSecurity: claims?.[`${namespace}session_security`],
          customerProfile: claims?.[`${namespace}customer_profile`],
          authWarnings: claims?.[`${namespace}auth_warnings`],
          verificationRequired: claims?.[`${namespace}verification_required`]
        };
        
        setIdTokenVerification(verification);
        
        // Set verification status
        if (verification.tokenVerifiedAt) {
          if (verification.canPlaceOrders) {
            setVerificationStatus('VERIFIED: Ready to place orders');
          } else if (!verification.emailVerified) {
            setVerificationStatus('WARNING: Email verification required');
          } else {
            setVerificationStatus('RESTRICTED: Order access restricted');
          }
        } else {
          setVerificationStatus('WARNING: ID Token not verified by Post-Login Action');
        }
        
        // Try to get order history from ID token first
        if (claims && claims[`${namespace}order_history`]) {
          console.log('Found orders in verified ID token:', claims[`${namespace}order_history`]);
          setOrderHistory(claims[`${namespace}order_history`]);
          return;
        }
        
        // If verification allows and no orders in ID token, fetch from API
        if (verification.canPlaceOrders) {
          console.log('Fetching orders from API with verified ID token...');
          await fetchOrdersFromAPI();
        } else {
          console.log('Cannot fetch orders - verification failed or email not verified');
        }
        
      } catch (error) {
        console.error('Error checking ID token verification:', error);
        setVerificationStatus('ERROR: Verification check failed');
      }
    };
    
    const fetchOrdersFromAPI = async () => {
      try {
        // Get access token for API call
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: 'https://pizza42-api',
            scope: 'place:orders',
          },
        });
        
        const response = await fetch(`${apiConfig.baseURL}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('API Response:', data);
          setOrderHistory(data.orders || []);
          
          // Update verification status with API response info
          if (data.verification) {
            console.log('API Verification Info:', data.verification);
          }
        } else {
          const errorData = await response.json();
          console.error('Failed to fetch orders:', response.status, errorData);
          
          if (response.status === 403 && errorData.error === 'Email verification required') {
            setVerificationStatus('ERROR: Email verification required for API access');
          }
        }
      } catch (error) {
        console.error('Error fetching orders from API:', error);
      }
    };

    checkIdTokenVerification();
  }, [getIdTokenClaims, getAccessTokenSilently]);

  return (
    <div style={{ marginBottom: '30px' }}>
      <h3>Your Profile</h3>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Name:</strong> {user?.name}</p>
      <p><strong>Email Verified:</strong> {user?.email_verified ? 'Yes' : 'No'}</p>
      
      {/* ID Token Verification Status */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: verificationStatus.includes('Verified & Ready') ? '#d4edda' : 
                         verificationStatus.includes('Required') || verificationStatus.includes('Not Verified') ? '#fff3cd' : '#f8d7da',
        borderRadius: '8px',
        border: '1px solid ' + (verificationStatus.includes('Verified & Ready') ? '#c3e6cb' : 
                                verificationStatus.includes('Required') || verificationStatus.includes('Not Verified') ? '#ffeaa7' : '#f5c6cb')
      }}>
        <h4>ID Token Verification Status</h4>
        <p><strong>Status:</strong> {verificationStatus}</p>
        
        {idTokenVerification && (
          <div style={{ marginTop: '10px' }}>
            {idTokenVerification.tokenVerifiedAt && (
              <p><strong>Verified At:</strong> {new Date(idTokenVerification.tokenVerifiedAt).toLocaleString()}</p>
            )}
            
            <p><strong>Email Verified:</strong> {idTokenVerification.emailVerified ? 'Yes' : 'No'}</p>
            <p><strong>Can Place Orders:</strong> {idTokenVerification.canPlaceOrders ? 'Yes' : 'No'}</p>
            
            {/* Auth Metadata */}
            {idTokenVerification.authMetadata && (
              <div style={{ marginTop: '10px' }}>
                <p><strong>Login Method:</strong> {idTokenVerification.authMetadata.login_method}</p>
                <p><strong>Connection:</strong> {idTokenVerification.authMetadata.connection}</p>
                <p><strong>Login Time:</strong> {new Date(idTokenVerification.authMetadata.login_time).toLocaleString()}</p>
              </div>
            )}
            
            {/* Customer Profile */}
            {idTokenVerification.customerProfile && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <h5>Customer Profile</h5>
                <p><strong>Status:</strong> {idTokenVerification.customerProfile.status}</p>
                <p><strong>Total Orders:</strong> {idTokenVerification.customerProfile.total_orders}</p>
                <p><strong>Total Spent:</strong> ${idTokenVerification.customerProfile.total_spent}</p>
                {idTokenVerification.customerProfile.favorite_pizza && (
                  <p><strong>Favorite Pizza:</strong> {idTokenVerification.customerProfile.favorite_pizza} ({idTokenVerification.customerProfile.favorite_size})</p>
                )}
                <p><strong>Customer Since:</strong> {new Date(idTokenVerification.customerProfile.customer_since).toLocaleDateString()}</p>
              </div>
            )}
            
            {/* Warnings */}
            {idTokenVerification.authWarnings && idTokenVerification.authWarnings.length > 0 && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                <h5>Authentication Warnings</h5>
                {idTokenVerification.authWarnings.map((warning: string, index: number) => (
                  <p key={index} style={{ margin: '5px 0', color: '#856404' }}>• {warning}</p>
                ))}
              </div>
            )}
            
            {/* Verification Required Notice */}
            {idTokenVerification.verificationRequired && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
                <h5>Action Required</h5>
                <p style={{ color: '#721c24' }}>{idTokenVerification.verificationRequired.message}</p>
                <p style={{ color: '#721c24' }}>Action: {idTokenVerification.verificationRequired.action}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Order History */}
      {orderHistory.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4>Order History</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', borderRadius: '4px' }}>
            {orderHistory.map((order, index) => (
              <div key={index} style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <p><strong>Order #{order.id}</strong> - {new Date(order.date).toLocaleDateString()}</p>
                <p>Pizza: {order.pizza} (Size: {order.size})</p>
                <p>Total: ${order.total}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
            Orders loaded from: {idTokenVerification?.tokenVerifiedAt ? 'ID Token (Post-Login Action)' : 'API'}
          </p>
        </div>
      )}
      
      {orderHistory.length === 0 && idTokenVerification?.canPlaceOrders && (
        <div style={{ marginTop: '20px', textAlign: 'center', color: '#666' }}>
          <p>No orders yet. Place your first order!</p>
        </div>
      )}
    </div>
  );
};

export default Profile;

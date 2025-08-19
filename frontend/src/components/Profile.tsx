import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const Profile: React.FC = () => {
  const { user, getIdTokenClaims } = useAuth0();
  const [orderHistory, setOrderHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    const getTokenClaims = async () => {
      try {
        const claims = await getIdTokenClaims();
        if (claims && claims['https://pizza42.com/order_history']) {
          setOrderHistory(claims['https://pizza42.com/order_history']);
        }
      } catch (error) {
        console.error('Error getting token claims:', error);
      }
    };

    getTokenClaims();
  }, [getIdTokenClaims]);

  return (
    <div style={{ marginBottom: '30px' }}>
      <h3>Your Profile</h3>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Name:</strong> {user?.name}</p>
      <p><strong>Email Verified:</strong> {user?.email_verified ? 'Yes' : 'No'}</p>
      
      {orderHistory.length > 0 && (
        <div>
          <h4>Order History</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {orderHistory.map((order, index) => (
              <div key={index} style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <p><strong>Order #{order.id}</strong> - {new Date(order.date).toLocaleDateString()}</p>
                <p>Pizza: {order.pizza} (Size: {order.size})</p>
                <p>Total: ${order.total}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

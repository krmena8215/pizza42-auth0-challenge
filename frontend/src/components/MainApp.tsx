import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';
import Profile from './Profile';
import PizzaOrder from './PizzaOrder';

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading, user, error } = useAuth0();
  
  // Debug logging
  console.log('Auth0 State:', { isAuthenticated, isLoading, user: user?.email, error });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Pizza 42 - Order Online</h1>
      
      {!isAuthenticated ? (
        <div>
          <p>Welcome to Pizza 42! Please log in to place your order.</p>
          <LoginButton />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Welcome back, {user?.name || user?.email}</h3>
              {!user?.email_verified && (
                <p style={{ color: 'orange' }}>
                  Please verify your email to place orders.
                </p>
              )}
            </div>
            <LogoutButton />
          </div>
          
          <Profile />
          
          {user?.email_verified && <PizzaOrder />}
        </div>
      )}
    </div>
  );
};

export default MainApp;

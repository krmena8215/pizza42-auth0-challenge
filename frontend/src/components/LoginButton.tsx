import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const LoginButton: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  const handleLogin = () => {
    console.log('Login button clicked, calling loginWithRedirect');
    console.log('Auth0 config:', { domain: process.env.REACT_APP_AUTH0_DOMAIN, clientId: process.env.REACT_APP_AUTH0_CLIENT_ID });
    loginWithRedirect();
  };

  const handleSocialLogin = () => {
    console.log('Google login button clicked');
    loginWithRedirect({
      authorizationParams: {
        connection: 'google-oauth2',
      },
    });
  };

  return (
    <div>
      <button 
        onClick={handleLogin}
        style={{ 
          padding: '10px 20px', 
          margin: '10px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Log In with Email
      </button>
      
      <button 
        onClick={handleSocialLogin}
        style={{ 
          padding: '10px 20px', 
          margin: '10px', 
          backgroundColor: '#dc3545', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Log In with Google
      </button>
    </div>
  );
};

export default LoginButton;

import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { apiConfig } from '../auth0-config';

const PizzaOrder: React.FC = () => {
  const { getIdTokenClaims } = useAuth0();
  const [selectedPizza, setSelectedPizza] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const pizzaOptions = [
    { name: 'Margherita', price: { small: 12, medium: 16, large: 20 } },
    { name: 'Pepperoni', price: { small: 14, medium: 18, large: 22 } },
    { name: 'Supreme', price: { small: 16, medium: 20, large: 24 } },
    { name: 'Hawaiian', price: { small: 13, medium: 17, large: 21 } },
  ];

  const sizeOptions = ['small', 'medium', 'large'];

  const calculateTotal = () => {
    const pizza = pizzaOptions.find(p => p.name === selectedPizza);
    if (pizza && selectedSize) {
      return pizza.price[selectedSize as keyof typeof pizza.price];
    }
    return 0;
  };

  const handlePlaceOrder = async () => {
    if (!selectedPizza || !selectedSize) {
      alert('Please select a pizza and size');
      return;
    }

    setIsOrdering(true);
    try {
      // Get ID token claims which contain email verification and custom claims from Post-Login Action
      const idTokenClaims = await getIdTokenClaims();
      if (!idTokenClaims || !idTokenClaims.__raw) {
        throw new Error('Unable to get ID token. Please log in again.');
      }

      const orderData = {
        pizza: selectedPizza,
        size: selectedSize,
        total: calculateTotal(),
        date: new Date().toISOString(),
      };

      const response = await fetch(`${apiConfig.baseURL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idTokenClaims.__raw}`,
        },
        body: JSON.stringify(orderData),
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        setOrderSuccess(true);
        setSelectedPizza('');
        setSelectedSize('');
        setTimeout(() => setOrderSuccess(false), 3000);
      } else {
        console.error('Order failed:', responseData);
        throw new Error(`Failed to place order: ${responseData.error || response.status}`);
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div>
      <h3>Place Your Order</h3>
      
      {orderSuccess && (
        <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
          Order placed successfully! 🍕
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h4>Select Pizza</h4>
        {pizzaOptions.map(pizza => (
          <label key={pizza.name} style={{ display: 'block', margin: '8px 0' }}>
            <input
              type="radio"
              name="pizza"
              value={pizza.name}
              checked={selectedPizza === pizza.name}
              onChange={(e) => setSelectedPizza(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            {pizza.name} - Small: ${pizza.price.small} | Medium: ${pizza.price.medium} | Large: ${pizza.price.large}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Select Size</h4>
        {sizeOptions.map(size => (
          <label key={size} style={{ display: 'block', margin: '8px 0' }}>
            <input
              type="radio"
              name="size"
              value={size}
              checked={selectedSize === size}
              onChange={(e) => setSelectedSize(e.target.value)}
              style={{ marginRight: '8px' }}
            />
            {size.charAt(0).toUpperCase() + size.slice(1)}
          </label>
        ))}
      </div>

      {selectedPizza && selectedSize && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Order Summary:</strong><br />
          {selectedPizza} ({selectedSize}) - ${calculateTotal()}
        </div>
      )}

      <button
        onClick={handlePlaceOrder}
        disabled={!selectedPizza || !selectedSize || isOrdering}
        style={{
          padding: '12px 24px',
          backgroundColor: selectedPizza && selectedSize ? '#28a745' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: selectedPizza && selectedSize ? 'pointer' : 'not-allowed',
          fontSize: '16px'
        }}
      >
        {isOrdering ? 'Placing Order...' : 'Place Order'}
      </button>
    </div>
  );
};

export default PizzaOrder;

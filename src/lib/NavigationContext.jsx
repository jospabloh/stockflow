import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const location = useLocation();
  const [navigationStack, setNavigationStack] = useState([]);
  const [direction, setDirection] = useState('forward');

  useEffect(() => {
    setNavigationStack(prev => {
      const currentPath = location.pathname;
      const lastPath = prev[prev.length - 1];
      
      if (lastPath === currentPath) {
        return prev;
      }

      // Determine if this is a back navigation
      const isBackNavigation = prev.length > 0 && prev.slice(0, -1).includes(currentPath);
      
      if (isBackNavigation) {
        setDirection('back');
        return prev.slice(0, prev.indexOf(currentPath) + 1);
      } else {
        setDirection('forward');
        return [...prev, currentPath];
      }
    });
  }, [location.pathname]);

  const goBack = () => {
    setDirection('back');
    if (navigationStack.length > 1) {
      window.history.back();
    }
  };

  return (
    <NavigationContext.Provider value={{ direction, navigationStack, goBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
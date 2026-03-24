import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const NavigationContext = createContext();

// Detect Android hardware back button
const setupAndroidBackButton = (navigationStack, goBackCallback) => {
  const handleBackButton = (event) => {
    // Respect navigation stack: only go back if there's history to go to
    // and current path is not root
    const path = window.location.pathname;
    const isRoot = path === '/' || path === '/Dashboard';
    
    // Strict validation: only proceed if there's actual navigation history
    if (!isRoot && navigationStack.length > 1) {
      event.preventDefault();
      goBackCallback();
    }
  };

  // Listen for popstate (browser back button)
  window.addEventListener('popstate', handleBackButton);
  
  // For Android WebView/Cordova support
  if (window.document && window.document.addEventListener) {
    window.document.addEventListener('backbutton', handleBackButton, false);
  }

  return () => {
    window.removeEventListener('popstate', handleBackButton);
    if (window.document && window.document.removeEventListener) {
      window.document.removeEventListener('backbutton', handleBackButton);
    }
  };
};

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

  const goBack = useCallback(() => {
    setDirection('back');
    if (navigationStack.length > 1) {
      window.history.back();
    }
  }, [navigationStack.length]);

  // Setup Android back button handling
  useEffect(() => {
    const cleanup = setupAndroidBackButton(goBack);
    return cleanup;
  }, [goBack]);

  return (
    <NavigationContext.Provider value={{ direction, navigationStack, goBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
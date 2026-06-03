import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69af971d0fdb362c9ae52ed3/5032b5555_StockFlow_logo.png';

/**
 * Shared visual shell for the custom authentication pages (login, register,
 * forgot/reset password). Keeps branding and layout consistent.
 */
const AuthShell = ({ title, subtitle, children, footer }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={LOGO_URL} alt="StockFlow" className="h-14 w-14 object-contain" />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">StockFlow</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        )}
      </div>
    </div>
  );
};

export default AuthShell;
